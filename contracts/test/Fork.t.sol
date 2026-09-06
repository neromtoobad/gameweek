// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SundayLeague} from "../src/SundayLeague.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {MockToken} from "./mocks/Mocks.sol";

/// @notice Runs against a Base mainnet fork so scoring is proven against the real Chainlink equity
///         feeds rather than invented prices.
///
///         forge test --fork-url $BASE_RPC_URL --match-contract Fork -vv
///
/// @dev THE B20 PRECOMPILE CONSTRAINT
///      Coinbase Tokenized Stocks are not deployed contracts. They are Rust precompiles compiled
///      into the Base node. `eth_getCode` at a B20 address returns a single placeholder byte, just
///      enough for an EXTCODESIZE check to accept it as a contract. A live RPC executes the real
///      behaviour natively, but a Foundry fork only copies code and storage, so it has nothing to
///      run: every call to a B20 address on a fork burns the whole gas limit and reverts.
///      test_b20TokensHaveNoBytecode below pins that so it never surprises anyone again.
///
///      The consequence for these tests: feeds are real, and the token side is etched with a mock
///      whose decimals match what was read from mainnet (8 for every listing, verified by
///      scripts/verify-listings.ts). That still proves the part that can go wrong, which is the
///      scale derivation and the NAV arithmetic against genuine 8-decimal feed prices.
contract ForkTest is Test {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    struct Listing {
        string ticker;
        address token;
        address feed;
    }

    Listing[13] listings;
    SundayLeague league;
    address owner = makeAddr("owner");
    address player = makeAddr("player");

    function setUp() public {
        if (block.chainid != 8453) return;

        listings[0] =
            Listing("AAPLc", 0xb200000000000000000000C2e324d24d7eEcd1fb, 0x787f13dEa48Db0897CbCDD985de77809D837F988);
        listings[1] =
            Listing("AMZNc", 0xb200000000000000000000d9192b6B456483C2E8, 0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295);
        listings[2] =
            Listing("COINc", 0xb200000000000000000000c85a31389D71F3ecfb, 0x408e44f504A7371a345F03a73dDC96A4b48e8aa7);
        listings[3] =
            Listing("CRCLc", 0xB20000000000000000000019f6E7C675b73C2e4D, 0x0231cF2635D1E17bB5c2462cc7504Ba1fBd61f33);
        listings[4] =
            Listing("GOOGLc", 0xb2000000000000000000002D0BA3164cc74f58B7, 0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2);
        listings[5] =
            Listing("INTCc", 0xB2000000000000000000004AFF16039bA04bdFBc, 0xAB657C39bac0D5886250D70849e2E3E008F2EECB);
        listings[6] =
            Listing("METAc", 0xb2000000000000000000008bC8786B856E61707C, 0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D);
        listings[7] =
            Listing("MSFTc", 0xB200000000000000000000Ab99cFa739E253872B, 0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c);
        listings[8] =
            Listing("MSTRc", 0xb2000000000000000000004884b426556b92883d, 0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a);
        listings[9] =
            Listing("NVDAc", 0xb20000000000000000000078ee7ce2fE4908108C, 0x04689a41629776563E6822F76f2e57D148d28513);
        listings[10] =
            Listing("SNDKc", 0xb200000000000000000000397293Cb8cda9a10c5, 0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA);
        listings[11] =
            Listing("SPCXc", 0xb2000000000000000000007b9fcbd005511aCBd5, 0x6A634B235903C4ad6376892180d6fF8612e3Fa68);
        listings[12] =
            Listing("TSLAc", 0xb2000000000000000000001e800a7f5189430cD0, 0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4);

        league = new SundayLeague(USDC, owner);
    }

    modifier onlyFork() {
        if (block.chainid != 8453) {
            emit log("skipped: not running against a Base mainnet fork");
            return;
        }
        _;
    }

    /// @dev Put executable 8-decimal ERC20 code at a B20 address so the fork can price it.
    function _etchToken(address b20) internal returns (MockToken) {
        MockToken impl = new MockToken("etched", "ETCH", 8);
        vm.etch(b20, address(impl).code);
        return MockToken(b20);
    }

    // ---------------------------------------------------------------- the constraint

    /// @notice Pins the fact that B20 tokens carry no bytecode, which is why every other test here
    ///         has to etch them. If this ever fails, Coinbase moved off the precompile model and the
    ///         etching can be deleted.
    function test_b20TokensHaveNoBytecode() public onlyFork {
        for (uint256 i; i < listings.length; ++i) {
            // A B20 address carries a single placeholder byte, enough for an EXTCODESIZE check to
            // treat it as a contract, but nowhere near a real ERC20 implementation. The behaviour
            // lives in the node, so a fork has nothing to execute.
            assertEq(listings[i].token.code.length, 1, "B20 tokens are node precompiles, not contracts");
        }
        // Ordinary contracts on the same chain do have code, so this is not an RPC failure.
        assertGt(USDC.code.length, 0, "USDC is a normal contract");
        assertGt(listings[0].feed.code.length, 0, "Chainlink feeds are normal contracts");
    }

    // ---------------------------------------------------------------- real feeds

    /// @notice Every listed feed answers with a positive 8-decimal price on mainnet.
    function test_allFeedsReturnAPositivePrice() public onlyFork {
        for (uint256 i; i < listings.length; ++i) {
            Listing memory l = listings[i];
            assertGt(l.feed.code.length, 0, "feed has no code");
            assertEq(IAggregatorV3(l.feed).decimals(), 8, "equity feeds are 8 decimals");

            (, int256 answer,, uint256 updatedAt,) = IAggregatorV3(l.feed).latestRoundData();
            assertGt(answer, 0, "feed price must be positive");
            assertGt(updatedAt, 0, "feed must have a round");

            emit log_named_string("feed", l.ticker);
            emit log_named_uint("price e8", uint256(answer));
            emit log_named_uint("age seconds", block.timestamp - updatedAt);
        }
    }

    /// @notice Documents the weekend behaviour the product is built on: outside US market hours the
    ///         equity feeds hold the last close, so their age grows past a normal heartbeat.
    function test_reportFeedAgeSpread() public onlyFork {
        uint256 minAge = type(uint256).max;
        uint256 maxAge;
        for (uint256 i; i < listings.length; ++i) {
            (,,, uint256 updatedAt,) = IAggregatorV3(listings[i].feed).latestRoundData();
            uint256 age = block.timestamp - updatedAt;
            if (age < minAge) minAge = age;
            if (age > maxAge) maxAge = age;
        }
        emit log_named_uint("youngest feed age (s)", minAge);
        emit log_named_uint("oldest feed age (s)", maxAge);
        // A real league locks and settles at the Friday close with a two hour tolerance. Whenever
        // this run happens outside market hours the spread above is what a demo league's longer
        // tolerance has to absorb.
    }

    // ---------------------------------------------------------------- scale and NAV

    /// @notice setToken derives scale 1e10 for every listing from live feed decimals.
    function test_setTokenDerivesTenDecimalScaleForEveryListing() public onlyFork {
        for (uint256 i; i < listings.length; ++i) {
            _etchToken(listings[i].token);
            vm.prank(owner);
            league.setToken(listings[i].token, listings[i].feed);
            (, uint256 scale,) = league.tokenInfo(listings[i].token);
            assertEq(scale, 1e10, "token 8 decimals + feed 8 decimals - USDC 6 decimals");
        }

        assertEq(league.tokenCount(), listings.length);
    }

    /// @notice A wallet holding one share of each stock is worth the sum of the live feed prices.
    ///         This is the end-to-end proof that decimals, scale and pricing line up.
    function test_navOfOneShareOfEachEqualsSumOfLiveFeedPrices() public onlyFork {
        uint256 expected;

        // Etch before registering: setToken reads decimals() from the token, which a bare B20
        // address on a fork cannot answer.
        for (uint256 i; i < listings.length; ++i) {
            MockToken t = _etchToken(listings[i].token);
            t.mint(player, 1e8); // exactly one share

            vm.prank(owner);
            league.setToken(listings[i].token, listings[i].feed);

            (, int256 answer,,,) = IAggregatorV3(listings[i].feed).latestRoundData();
            expected += uint256(answer) / 100; // an e8 price is an e6 USD amount divided by 100
        }
        deal(USDC, player, 25e6, true);
        expected += 25e6;

        uint256 nav = league.navOf(player);
        emit log_named_uint("nav usd6", nav);
        emit log_named_uint("expected usd6", expected);
        assertEq(nav, expected, "NAV must equal cash plus the sum of the 13 live feed prices");
    }

    // ---------------------------------------------------------------- full lifecycle

    /// @notice A whole league week priced by real Chainlink feeds: create, join, lock, settle, pay.
    function test_fullWeekPricedByRealFeeds() public onlyFork {
        address aapl = listings[0].token;
        address nvda = listings[9].token;

        MockToken aaplToken = _etchToken(aapl);
        MockToken nvdaToken = _etchToken(nvda);

        vm.startPrank(owner);
        league.setToken(aapl, listings[0].feed); // etched first, see _etchToken
        league.setToken(nvda, listings[9].feed);
        vm.stopPrank();

        address p1 = makeAddr("p1");
        address p2 = makeAddr("p2");

        // A wide tolerance so this passes whenever it runs. Outside market hours the equity feeds
        // hold the Friday close and are far older than a real league's two hour tolerance.
        uint64 start = uint64(block.timestamp + 1 hours);
        uint64 end = uint64(block.timestamp + 7 days);
        uint256 id = league.createLeague("Fork League", start, end, 0, 30 days, 10);

        vm.prank(p1);
        league.join(id);
        vm.prank(p2);
        league.join(id);

        aaplToken.mint(p1, 1e8); // p1 holds one Apple share
        nvdaToken.mint(p2, 2e8); // p2 holds two Nvidia shares

        vm.warp(start);
        league.lock(id);

        uint256 nav1 = league.navStart(id, p1);
        uint256 nav2 = league.navStart(id, p2);
        emit log_named_uint("p1 start nav, 1 AAPLc (usd6)", nav1);
        emit log_named_uint("p2 start nav, 2 NVDAc (usd6)", nav2);

        (, int256 aaplPrice,,,) = IAggregatorV3(listings[0].feed).latestRoundData();
        (, int256 nvdaPrice,,,) = IAggregatorV3(listings[9].feed).latestRoundData();
        assertEq(nav1, uint256(aaplPrice) / 100, "one Apple share is priced by its live feed");
        assertEq(nav2, (2 * uint256(nvdaPrice)) / 100, "two Nvidia shares are priced by their live feed");

        deal(USDC, address(this), 10e6, true);
        IERC20(USDC).approve(address(league), 10e6);
        league.sponsor(id, 10e6);

        // p1's holding doubles during the week, p2's is untouched.
        vm.warp(end);
        aaplToken.mint(p1, 1e8);

        league.settle(id);

        assertTrue(league.getLeague(id).settled);
        assertEq(IERC20(USDC).balanceOf(address(league)), 0, "pot fully paid out");

        address[3] memory podium = league.getPodium(id);
        assertEq(podium[0], p1, "the doubled portfolio wins");
        assertEq(podium[1], p2);
        assertEq(IERC20(USDC).balanceOf(p1), 7e6, "60 percent plus the unused third-place share");
        assertEq(IERC20(USDC).balanceOf(p2), 3e6);
    }
}
