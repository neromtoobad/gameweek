// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISwapCallback {
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data)
        external;
}

/// @notice A fixed-price stand-in for an Aerodrome Slipstream pool.
///
/// @dev It reproduces the part of the protocol the router depends on: the pool sends the output
///      first, then calls back for payment, and reports the input as a positive delta and the
///      output as a negative one. Price is a constant so tests assert exact amounts; the real pool
///      moves along a curve, which is why the router takes a caller-supplied minimum out rather
///      than trusting any price of its own.
contract MockCLPool {
    address public immutable token0;
    address public immutable token1;

    /// @dev USDC (6 decimals) per whole unit of token1 (8 decimals).
    uint256 public immutable priceUsd6;

    constructor(address token0_, address token1_, uint256 priceUsd6_) {
        token0 = token0_;
        token1 = token1_;
        priceUsd6 = priceUsd6_;
    }

    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1) {
        require(amountSpecified > 0, "exact-in only");
        uint256 amountIn = uint256(amountSpecified);

        if (zeroForOne) {
            // Paying USDC (6 decimals) for token1 (8 decimals).
            uint256 amountOut = (amountIn * 1e8) / priceUsd6;
            IERC20(token1).transfer(recipient, amountOut);
            amount0 = int256(amountIn);
            amount1 = -int256(amountOut);
        } else {
            uint256 amountOut = (amountIn * priceUsd6) / 1e8;
            IERC20(token0).transfer(recipient, amountOut);
            amount1 = int256(amountIn);
            amount0 = -int256(amountOut);
        }

        uint256 balanceBefore =
            IERC20(zeroForOne ? token0 : token1).balanceOf(address(this));

        ISwapCallback(msg.sender).uniswapV3SwapCallback(amount0, amount1, data);

        uint256 balanceAfter = IERC20(zeroForOne ? token0 : token1).balanceOf(address(this));
        require(balanceAfter - balanceBefore >= amountIn, "callback underpaid");
    }
}

/// @notice A hostile pool that tries to re-enter the router's callback on behalf of a pool that is
///         not the one authorised for the current swap.
contract EvilPool {
    address public immutable router;
    address public immutable token0;
    address public immutable token1;

    constructor(address router_, address token_) {
        router = router_;
        token0 = token_;
        token1 = token_;
    }

    function swap(address, bool, int256, uint160, bytes calldata data) external returns (int256, int256) {
        // Ask a second address to call back, which the router must refuse.
        Helper(address(new Helper())).attack(router, data);
        return (int256(0), int256(0));
    }
}

contract Helper {
    function attack(address router, bytes calldata data) external {
        ISwapCallback(router).uniswapV3SwapCallback(int256(1e6), int256(0), data);
    }
}
