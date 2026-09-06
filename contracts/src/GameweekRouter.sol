// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface ICLPool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}

/// @title Gameweek Router
/// @notice Executes a single-hop swap against an Aerodrome Slipstream pool and takes the protocol
///         fee that funds league pots, both in one transaction.
///
/// @dev WHY THIS EXISTS
///      A draft pick has to be one tap. Routing through an external aggregator would put an HTTP
///      call in the middle of the demo's critical path, and the canonical periphery for the
///      Slipstream deployment that holds the tokenized stock pools
///      (factory 0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef) is not the one published for the
///      original deployment. So Gameweek routes itself. The scope is deliberately tiny: one hop,
///      one pool, an explicit minimum out, and a capped fee.
///
///      Slipstream pools are Uniswap V3 shaped, verified onchain against the pool implementation at
///      0xc770898522D2A9c8Da7A10D63989b6b58305B665: swap(address,bool,int256,uint160,bytes) and the
///      uniswapV3SwapCallback(int256,int256,bytes) it calls back with.
///
/// @dev SAFETY
///      - The callback only accepts a call from the pool this contract is mid-swap with.
///      - Slippage is the caller's `minAmountOut`, never a price the router derives for itself.
///      - The router holds no balances between calls. Anything left is swept by the owner.
contract GameweekRouter is Ownable {
    using SafeERC20 for IERC20;

    /// @dev Uniswap V3 price bounds. Passing one of these means "no price limit, rely on
    ///      minAmountOut", which keeps slippage a single explicit number for the caller.
    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    /// @notice Hard ceiling on the protocol fee, so the owner can never raise it into extraction.
    uint16 public constant MAX_FEE_BPS = 100; // 1%
    uint16 public constant BPS = 10_000;

    address public feeRecipient;
    uint16 public feeBps;

    /// @dev The pool currently being swapped with. Transient, so it cannot leak between calls and
    ///      costs nothing to clear.
    address transient activePool;

    event Swapped(
        address indexed payer,
        address indexed recipient,
        address indexed pool,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 fee,
        uint256 amountOut
    );
    event FeeUpdated(address recipient, uint16 bps);
    event Swept(address token, address to, uint256 amount);

    error Expired();
    error ZeroAmount();
    error FeeTooHigh();
    error ZeroAddress();
    error PoolTokenMismatch();
    error UnexpectedCallback();
    error InsufficientOutput(uint256 amountOut, uint256 minAmountOut);
    error NothingOwed();

    struct SwapParams {
        address pool;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        address recipient;
        uint256 deadline;
    }

    constructor(address owner_, address feeRecipient_, uint16 feeBps_) Ownable(owner_) {
        if (owner_ == address(0)) revert ZeroAddress();
        _setFee(feeRecipient_, feeBps_);
    }

    // ---------------------------------------------------------------- admin

    function setFee(address recipient, uint16 bps) external onlyOwner {
        _setFee(recipient, bps);
    }

    function _setFee(address recipient, uint16 bps) internal {
        if (bps > MAX_FEE_BPS) revert FeeTooHigh();
        if (bps > 0 && recipient == address(0)) revert ZeroAddress();
        feeRecipient = recipient;
        feeBps = bps;
        emit FeeUpdated(recipient, bps);
    }

    /// @notice Recover anything stranded here. The router is not meant to hold balances.
    function sweep(address token, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = IERC20(token).balanceOf(address(this));
        if (amount == 0) revert NothingOwed();
        IERC20(token).safeTransfer(to, amount);
        emit Swept(token, to, amount);
    }

    // ---------------------------------------------------------------- swapping

    /// @notice Swap an exact amount of `tokenIn` for `tokenOut` through one Slipstream pool.
    /// @dev The caller must have approved this contract for `amountIn` of `tokenIn`. The protocol
    ///      fee is taken from the input before the swap, so what a player sees quoted is what the
    ///      pool actually receives.
    /// @return amountOut Tokens delivered to `recipient`.
    function swapExactIn(SwapParams calldata p) external returns (uint256 amountOut) {
        if (block.timestamp > p.deadline) revert Expired();
        if (p.amountIn == 0) revert ZeroAmount();
        if (p.recipient == address(0)) revert ZeroAddress();

        bool zeroForOne = _direction(p.pool, p.tokenIn, p.tokenOut);

        IERC20(p.tokenIn).safeTransferFrom(msg.sender, address(this), p.amountIn);

        uint256 fee = (p.amountIn * feeBps) / BPS;
        if (fee > 0) IERC20(p.tokenIn).safeTransfer(feeRecipient, fee);
        uint256 swapAmount = p.amountIn - fee;
        if (swapAmount == 0) revert ZeroAmount();

        amountOut = _swap(p.pool, p.recipient, zeroForOne, swapAmount, p.tokenIn);
        if (amountOut < p.minAmountOut) revert InsufficientOutput(amountOut, p.minAmountOut);

        emit Swapped(
            msg.sender, p.recipient, p.pool, p.tokenIn, p.tokenOut, p.amountIn, fee, amountOut
        );
    }

    /// @dev Which way round the pool holds the pair. Kept in its own frame so the token addresses
    ///      do not sit on the stack through the swap.
    function _direction(address pool, address tokenIn, address tokenOut)
        internal
        view
        returns (bool zeroForOne)
    {
        address token0 = ICLPool(pool).token0();
        address token1 = ICLPool(pool).token1();
        if (tokenIn == token0 && tokenOut == token1) return true;
        if (tokenIn == token1 && tokenOut == token0) return false;
        revert PoolTokenMismatch();
    }

    /// @dev Performs the pool call and reads the output side of the returned deltas.
    function _swap(
        address pool,
        address recipient,
        bool zeroForOne,
        uint256 swapAmount,
        address tokenIn
    ) internal returns (uint256 amountOut) {
        activePool = pool;
        (int256 amount0, int256 amount1) = ICLPool(pool).swap(
            recipient,
            zeroForOne,
            int256(swapAmount),
            zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
            abi.encode(tokenIn)
        );
        activePool = address(0);

        // The pool reports what it sent out as a negative delta.
        int256 delta = zeroForOne ? amount1 : amount0;
        amountOut = uint256(-delta);
    }

    /// @notice Pool callback. Pays the pool the input side of the swap it just performed.
    /// @dev Only callable by the pool this router is mid-swap with, which is what stops an
    ///      arbitrary contract calling in and draining whatever the router is holding.
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data)
        external
    {
        if (msg.sender != activePool) revert UnexpectedCallback();

        address tokenIn = abi.decode(data, (address));
        int256 owed = amount0Delta > 0 ? amount0Delta : amount1Delta;
        if (owed <= 0) revert NothingOwed();

        IERC20(tokenIn).safeTransfer(msg.sender, uint256(owed));
    }
}
