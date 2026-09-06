// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {GameweekRouter} from "../src/GameweekRouter.sol";
import {MockToken} from "./mocks/Mocks.sol";
import {MockCLPool, EvilPool} from "./mocks/MockCLPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract GameweekRouterTest is Test {
    GameweekRouter router;
    MockToken usdc;
    MockToken nvda;
    MockCLPool pool;

    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address player = makeAddr("player");

    /// 1 NVDA share costs 230 USDC. Token amounts are 8 and 6 decimals, matching mainnet.
    uint256 constant PRICE_USD6 = 230e6;

    function setUp() public {
        usdc = new MockToken("USD Coin", "USDC", 6);
        nvda = new MockToken("Nvidia", "NVDAc", 8);

        // token0/token1 ordering follows the real pool: USDC sorts below the B20 address.
        pool = new MockCLPool(address(usdc), address(nvda), PRICE_USD6);
        nvda.mint(address(pool), 1_000e8);
        usdc.mint(address(pool), 1_000_000e6);

        router = new GameweekRouter(owner, treasury, 50); // 0.5%

        usdc.mint(player, 1_000e6);
        vm.prank(player);
        usdc.approve(address(router), type(uint256).max);
    }

    function _params(uint256 amountIn, uint256 minOut)
        internal
        view
        returns (GameweekRouter.SwapParams memory)
    {
        return GameweekRouter.SwapParams({
            pool: address(pool),
            tokenIn: address(usdc),
            tokenOut: address(nvda),
            amountIn: amountIn,
            minAmountOut: minOut,
            recipient: player,
            deadline: block.timestamp + 300
        });
    }

    // ---------------------------------------------------------------- happy path

    function test_swapDeliversStockAndTakesFee() public {
        vm.prank(player);
        uint256 out = router.swapExactIn(_params(100e6, 0));

        // 0.5% of 100 USDC is taken first, so 99.5 USDC reaches the pool.
        uint256 expected = (99_5e5 * 1e8) / PRICE_USD6;

        assertEq(out, expected, "output priced off the post-fee amount");
        assertEq(nvda.balanceOf(player), expected, "stock lands in the player's wallet");
        assertEq(usdc.balanceOf(treasury), 5e5, "0.5% fee to the treasury");
        assertEq(usdc.balanceOf(player), 900e6, "exactly amountIn left the player");
    }

    function test_routerKeepsNoBalance() public {
        vm.prank(player);
        router.swapExactIn(_params(100e6, 0));

        assertEq(usdc.balanceOf(address(router)), 0, "no cash left behind");
        assertEq(nvda.balanceOf(address(router)), 0, "no stock left behind");
    }

    function test_swapWorksWithZeroFee() public {
        vm.prank(owner);
        router.setFee(treasury, 0);

        vm.prank(player);
        uint256 out = router.swapExactIn(_params(100e6, 0));

        assertEq(out, (100e6 * 1e8) / PRICE_USD6);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_sellingStockBackWorks() public {
        nvda.mint(player, 1e8);
        vm.startPrank(player);
        nvda.approve(address(router), type(uint256).max);

        uint256 out = router.swapExactIn(
            GameweekRouter.SwapParams({
                pool: address(pool),
                tokenIn: address(nvda),
                tokenOut: address(usdc),
                amountIn: 1e8,
                minAmountOut: 0,
                recipient: player,
                deadline: block.timestamp + 300
            })
        );
        vm.stopPrank();

        // Fee is taken in the token being sold, so 0.995 of a share is sold.
        assertEq(out, (995e5 * PRICE_USD6) / 1e8);
        assertEq(nvda.balanceOf(treasury), 5e5, "fee taken in the input token");
    }

    // ---------------------------------------------------------------- guards

    function test_revertsWhenOutputBelowMinimum() public {
        uint256 fair = (99_5e5 * 1e8) / PRICE_USD6;

        vm.prank(player);
        vm.expectRevert(
            abi.encodeWithSelector(GameweekRouter.InsufficientOutput.selector, fair, fair + 1)
        );
        router.swapExactIn(_params(100e6, fair + 1));
    }

    function test_revertsAfterDeadline() public {
        GameweekRouter.SwapParams memory p = _params(100e6, 0);
        vm.warp(p.deadline + 1);

        vm.prank(player);
        vm.expectRevert(GameweekRouter.Expired.selector);
        router.swapExactIn(p);
    }

    function test_revertsOnZeroAmount() public {
        vm.prank(player);
        vm.expectRevert(GameweekRouter.ZeroAmount.selector);
        router.swapExactIn(_params(0, 0));
    }

    function test_revertsWhenTokensDoNotMatchThePool() public {
        MockToken other = new MockToken("Other", "OTH", 18);
        GameweekRouter.SwapParams memory p = _params(100e6, 0);
        p.tokenOut = address(other);

        vm.prank(player);
        vm.expectRevert(GameweekRouter.PoolTokenMismatch.selector);
        router.swapExactIn(p);
    }

    function test_revertsOnZeroRecipient() public {
        GameweekRouter.SwapParams memory p = _params(100e6, 0);
        p.recipient = address(0);

        vm.prank(player);
        vm.expectRevert(GameweekRouter.ZeroAddress.selector);
        router.swapExactIn(p);
    }

    // ---------------------------------------------------------------- callback security

    /// @notice The whole safety of the router rests on this: only the pool it is currently swapping
    ///         with may call back. Anyone else asking to be paid is refused.
    function test_callbackRejectsAnUnknownCaller() public {
        usdc.mint(address(router), 500e6); // pretend something was stranded here

        address attacker = makeAddr("attacker");
        vm.prank(attacker);
        vm.expectRevert(GameweekRouter.UnexpectedCallback.selector);
        router.uniswapV3SwapCallback(int256(500e6), int256(0), abi.encode(address(usdc)));

        assertEq(usdc.balanceOf(address(router)), 500e6, "nothing was paid out");
    }

    /// @notice A malicious pool cannot re-enter the callback to drain the router, because the guard
    ///         only ever authorises the single pool mid-swap and the router holds no float.
    function test_callbackCannotBeReenteredByAnotherPool() public {
        EvilPool evil = new EvilPool(address(router), address(usdc));
        usdc.mint(address(router), 500e6);

        vm.prank(player);
        vm.expectRevert(); // the re-entrant callback from a different address is rejected
        router.swapExactIn(
            GameweekRouter.SwapParams({
                pool: address(evil),
                tokenIn: address(usdc),
                tokenOut: address(nvda),
                amountIn: 10e6,
                minAmountOut: 0,
                recipient: player,
                deadline: block.timestamp + 300
            })
        );
    }

    function test_callbackGuardIsClearedAfterASwap() public {
        vm.prank(player);
        router.swapExactIn(_params(100e6, 0));

        // With the swap finished the pool itself is no longer authorised.
        usdc.mint(address(router), 100e6);
        vm.prank(address(pool));
        vm.expectRevert(GameweekRouter.UnexpectedCallback.selector);
        router.uniswapV3SwapCallback(int256(100e6), int256(0), abi.encode(address(usdc)));
    }

    // ---------------------------------------------------------------- admin

    function test_feeIsCapped() public {
        vm.prank(owner);
        vm.expectRevert(GameweekRouter.FeeTooHigh.selector);
        router.setFee(treasury, 101);
    }

    function test_onlyOwnerSetsFee() public {
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, player));
        router.setFee(player, 100);
    }

    function test_sweepReturnsStrandedTokens() public {
        usdc.mint(address(router), 42e6);

        vm.prank(owner);
        router.sweep(address(usdc), treasury);

        assertEq(usdc.balanceOf(treasury), 42e6);
        assertEq(usdc.balanceOf(address(router)), 0);
    }

    function test_onlyOwnerSweeps() public {
        usdc.mint(address(router), 1e6);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, player));
        router.sweep(address(usdc), player);
    }

    // ---------------------------------------------------------------- fuzz

    function testFuzz_feeAndOutputAlwaysReconcile(uint96 amountIn, uint16 bps) public {
        amountIn = uint96(bound(amountIn, 1e6, 500e6));
        bps = uint16(bound(bps, 0, router.MAX_FEE_BPS()));

        vm.prank(owner);
        router.setFee(treasury, bps);

        uint256 before = usdc.balanceOf(player);

        vm.prank(player);
        uint256 out = router.swapExactIn(_params(amountIn, 0));

        uint256 fee = (uint256(amountIn) * bps) / 10_000;
        assertEq(usdc.balanceOf(treasury), fee, "fee is exactly bps of the input");
        assertEq(before - usdc.balanceOf(player), amountIn, "player pays exactly amountIn");
        assertEq(out, ((uint256(amountIn) - fee) * 1e8) / PRICE_USD6, "output priced post-fee");
        assertEq(usdc.balanceOf(address(router)), 0, "router never retains input");
    }
}
