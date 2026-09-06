// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {Gameweek} from "../src/Gameweek.sol";
import {MockToken, MockFeed} from "./mocks/Mocks.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract GameweekTest is Test {
    Gameweek gameweek;
    MockToken usdc;

    // Two stand-ins for B20 stocks, both 8 decimals like the real ones.
    MockToken nvda;
    MockToken aapl;
    MockFeed nvdaFeed;
    MockFeed aaplFeed;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");
    address treasury = makeAddr("treasury");

    uint64 startTime;
    uint64 endTime;
    uint32 constant TOLERANCE = 2 hours;

    // Prices with 8 decimals, matching the live feeds.
    int256 constant NVDA_PRICE = 229_96000000;
    int256 constant AAPL_PRICE = 320_08000000;

    function setUp() public {
        vm.warp(1_700_000_000);

        usdc = new MockToken("USD Coin", "USDC", 6);
        gameweek = new Gameweek(address(usdc), owner);

        nvda = new MockToken("Nvidia", "NVDAc", 8);
        aapl = new MockToken("Apple", "AAPLc", 8);
        nvdaFeed = new MockFeed(8, NVDA_PRICE);
        aaplFeed = new MockFeed(8, AAPL_PRICE);

        vm.startPrank(owner);
        gameweek.setToken(address(nvda), address(nvdaFeed));
        gameweek.setToken(address(aapl), address(aaplFeed));
        vm.stopPrank();

        startTime = uint64(block.timestamp + 1 days);
        endTime = uint64(block.timestamp + 8 days);
    }

    // ---------------------------------------------------------------- helpers

    function _newLeague(uint128 buyIn, uint16 cap) internal returns (uint256 id) {
        return gameweek.createLeague("Lagos Bulls", startTime, endTime, buyIn, TOLERANCE, cap);
    }

    function _join(uint256 id, address who, uint128 buyIn) internal {
        if (buyIn > 0) {
            usdc.mint(who, buyIn);
            vm.prank(who);
            usdc.approve(address(gameweek), buyIn);
        }
        vm.prank(who);
        gameweek.join(id);
    }

    /// @dev Refresh both feeds at the current timestamp so lock and settle see fresh data.
    function _refreshFeeds() internal {
        nvdaFeed.setAnswer(nvdaFeed.answer());
        aaplFeed.setAnswer(aaplFeed.answer());
    }

    // ---------------------------------------------------------------- token registry

    function test_setToken_computesScaleFrom8And8() public view {
        (address feed, uint256 scale, bool enabled) = gameweek.tokenInfo(address(nvda));
        assertEq(feed, address(nvdaFeed));
        assertEq(scale, 1e10, "8 + 8 - 6 = 10");
        assertTrue(enabled);
    }

    function test_setToken_computesScaleForAnOddDecimalToken() public {
        MockToken weird = new MockToken("Weird", "WEIRD", 18);
        MockFeed weirdFeed = new MockFeed(8, 1e8);

        vm.prank(owner);
        gameweek.setToken(address(weird), address(weirdFeed));

        (, uint256 scale,) = gameweek.tokenInfo(address(weird));
        assertEq(scale, 1e20, "18 + 8 - 6 = 20");
    }

    function test_setToken_doesNotDuplicateOnUpdate() public {
        assertEq(gameweek.tokenCount(), 2);
        MockFeed replacement = new MockFeed(8, NVDA_PRICE);

        vm.prank(owner);
        gameweek.setToken(address(nvda), address(replacement));

        assertEq(gameweek.tokenCount(), 2, "updating a token must not push it again");
        (address feed,,) = gameweek.tokenInfo(address(nvda));
        assertEq(feed, address(replacement));
    }

    function test_setToken_revertsWhenScaleWouldUnderflow() public {
        MockToken tiny = new MockToken("Tiny", "TINY", 2);
        MockFeed tinyFeed = new MockFeed(2, 1e2);

        vm.prank(owner);
        vm.expectRevert(Gameweek.ScaleUnderflow.selector);
        gameweek.setToken(address(tiny), address(tinyFeed));
    }

    function test_setToken_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        gameweek.setToken(address(nvda), address(nvdaFeed));
    }

    function test_disabledTokenIsExcludedFromNav() public {
        nvda.mint(alice, 1e8); // one share

        assertEq(gameweek.navOf(alice), 229_960000, "one NVDA share is 229.96 USD");

        vm.prank(owner);
        gameweek.setTokenEnabled(address(nvda), false);

        assertEq(gameweek.navOf(alice), 0, "disabled token drops out of NAV");
    }

    // ---------------------------------------------------------------- NAV maths

    function test_navCombinesUsdcAndStocks() public {
        usdc.mint(alice, 10e6); // 10 USDC
        nvda.mint(alice, 5e7); // half a share -> 114.98
        aapl.mint(alice, 1e8); // one share    -> 320.08

        assertEq(gameweek.navOf(alice), 10e6 + 114_980000 + 320_080000);
    }

    function test_navIgnoresStalenessButReportsAge() public {
        nvda.mint(alice, 1e8);
        nvdaFeed.freezeAt(block.timestamp - 40 hours);

        (uint256 usd6, uint256 age) = gameweek.navWithAge(alice);
        assertEq(usd6, 229_960000);
        assertEq(age, 40 hours, "weekend-held feed age is reported, not rejected");
    }

    function test_navRevertsOnNonPositivePrice() public {
        nvda.mint(alice, 1e8);
        nvdaFeed.setAnswer(0);

        vm.expectRevert(abi.encodeWithSelector(Gameweek.BadPrice.selector, address(nvda)));
        gameweek.navOf(alice);
    }

    // ---------------------------------------------------------------- league creation

    function test_createLeague_storesTheWindow() public {
        uint256 id = _newLeague(0, 20);
        Gameweek.League memory l = gameweek.getLeague(id);

        assertEq(l.name, "Lagos Bulls");
        assertEq(l.startTime, startTime);
        assertEq(l.endTime, endTime);
        assertEq(l.maxMembers, 20);
        assertFalse(l.locked);
        assertFalse(l.settled);
    }

    function test_createLeague_rejectsBadWindows() public {
        vm.expectRevert(Gameweek.BadWindow.selector);
        gameweek.createLeague("past", uint64(block.timestamp - 1), endTime, 0, TOLERANCE, 20);

        vm.expectRevert(Gameweek.BadWindow.selector);
        gameweek.createLeague("inverted", endTime, startTime, 0, TOLERANCE, 20);
    }

    function test_createLeague_rejectsBadCaps() public {
        // Read the bound before arming expectRevert: a view call inside the window would be
        // mistaken for the call under test.
        uint16 overCap = gameweek.MAX_MEMBERS() + 1;

        vm.expectRevert(Gameweek.BadMemberCap.selector);
        gameweek.createLeague("solo", startTime, endTime, 0, TOLERANCE, 1);

        vm.expectRevert(Gameweek.BadMemberCap.selector);
        gameweek.createLeague("huge", startTime, endTime, 0, TOLERANCE, overCap);
    }

    function test_createLeague_rejectsBadStalenessAndBuyIn() public {
        uint32 overStale = gameweek.MAX_STALENESS() + 1;
        uint128 overBuyIn = gameweek.MAX_BUY_IN() + 1;

        vm.expectRevert(Gameweek.BadStaleness.selector);
        gameweek.createLeague("zero", startTime, endTime, 0, 0, 20);

        vm.expectRevert(Gameweek.BadStaleness.selector);
        gameweek.createLeague("forever", startTime, endTime, 0, overStale, 20);

        vm.expectRevert(Gameweek.BuyInTooLarge.selector);
        gameweek.createLeague("rich", startTime, endTime, overBuyIn, TOLERANCE, 20);
    }

    // ---------------------------------------------------------------- joining

    function test_join_collectsBuyInIntoThePot() public {
        uint256 id = _newLeague(5e6, 20);
        _join(id, alice, 5e6);
        _join(id, bob, 5e6);

        Gameweek.League memory l = gameweek.getLeague(id);
        assertEq(l.pot, 10e6);
        assertEq(l.stakes, 10e6);
        assertEq(gameweek.stakeOf(id, alice), 5e6);
        assertEq(gameweek.memberCount(id), 2);
    }

    function test_join_rejectsDuplicates() public {
        uint256 id = _newLeague(0, 20);
        _join(id, alice, 0);

        vm.prank(alice);
        vm.expectRevert(Gameweek.AlreadyMember.selector);
        gameweek.join(id);
    }

    function test_join_rejectsWhenFull() public {
        uint256 id = _newLeague(0, 2);
        _join(id, alice, 0);
        _join(id, bob, 0);

        vm.prank(carol);
        vm.expectRevert(Gameweek.LeagueFull.selector);
        gameweek.join(id);
    }

    function test_join_closesAtStartTime() public {
        uint256 id = _newLeague(0, 20);
        vm.warp(startTime);

        vm.prank(alice);
        vm.expectRevert(Gameweek.DraftClosed.selector);
        gameweek.join(id);
    }

    function test_sponsor_addsToPotWithoutJoining() public {
        uint256 id = _newLeague(0, 20);

        usdc.mint(treasury, 12e6);
        vm.startPrank(treasury);
        usdc.approve(address(gameweek), 12e6);
        gameweek.sponsor(id, 12e6);
        vm.stopPrank();

        Gameweek.League memory l = gameweek.getLeague(id);
        assertEq(l.pot, 12e6);
        assertEq(l.stakes, 0, "a sponsorship is not a refundable stake");
        assertFalse(gameweek.isMember(id, treasury));
    }

    // ---------------------------------------------------------------- locking

    function test_lock_recordsStartingNav() public {
        uint256 id = _newLeague(0, 20);
        _join(id, alice, 0);
        _join(id, bob, 0);

        usdc.mint(alice, 20e6);
        nvda.mint(bob, 1e8);

        vm.warp(startTime);
        _refreshFeeds();
        gameweek.lock(id);

        assertEq(gameweek.navStart(id, alice), 20e6);
        assertEq(gameweek.navStart(id, bob), 229_960000);
        assertTrue(gameweek.getLeague(id).locked);
    }

    function test_lock_revertsBeforeStart() public {
        uint256 id = _newLeague(0, 20);
        _join(id, alice, 0);

        vm.expectRevert(Gameweek.NotStarted.selector);
        gameweek.lock(id);
    }

    function test_lock_revertsTwice() public {
        uint256 id = _newLeague(0, 20);
        _join(id, alice, 0);
        usdc.mint(alice, 20e6);

        vm.warp(startTime);
        _refreshFeeds();
        gameweek.lock(id);

        vm.expectRevert(Gameweek.AlreadyLocked.selector);
        gameweek.lock(id);
    }

    function test_lock_revertsOnStaleFeedForAHeldToken() public {
        uint256 id = _newLeague(0, 20);
        _join(id, alice, 0);
        nvda.mint(alice, 1e8);

        vm.warp(startTime);
        nvdaFeed.freezeAt(block.timestamp - 3 hours); // older than the 2 hour tolerance

        vm.expectRevert(abi.encodeWithSelector(Gameweek.StaleFeed.selector, address(nvda), block.timestamp - 3 hours));
        gameweek.lock(id);
    }

    /// @dev The design decision that keeps leagues settleable: a token nobody holds is skipped
    ///      before its feed is read, so a feed frozen by a corporate action cannot block the league.
    function test_staleFeedOnAnUnheldTokenDoesNotBlockLock() public {
        uint256 id = _newLeague(0, 20);
        _join(id, alice, 0);
        nvda.mint(alice, 1e8); // alice holds NVDA only

        vm.warp(startTime);
        nvdaFeed.setAnswer(NVDA_PRICE); // fresh
        aaplFeed.freezeAt(block.timestamp - 10 days); // AAPL frozen, nobody holds it

        gameweek.lock(id);
        assertEq(gameweek.navStart(id, alice), 229_960000);
    }

    // ---------------------------------------------------------------- settlement

    /// @dev Three funded players. Alice's stock doubles, Bob's rises a little, Carol sits in cash.
    function _threePlayerLeague() internal returns (uint256 id) {
        id = _newLeague(0, 20);
        _join(id, alice, 0);
        _join(id, bob, 0);
        _join(id, carol, 0);

        nvda.mint(alice, 1e8); // 229.96
        aapl.mint(bob, 1e8); // 320.08
        usdc.mint(carol, 300e6); // flat

        vm.warp(startTime);
        _refreshFeeds();
        gameweek.lock(id);

        usdc.mint(treasury, 100e6);
        vm.startPrank(treasury);
        usdc.approve(address(gameweek), 100e6);
        gameweek.sponsor(id, 100e6);
        vm.stopPrank();
    }

    function test_settle_paysTopThreeSixtyThirtyTen() public {
        uint256 id = _threePlayerLeague();

        vm.warp(endTime);
        nvdaFeed.setAnswer(NVDA_PRICE * 2); // alice +100%
        aaplFeed.setAnswer((AAPL_PRICE * 110) / 100); // bob +10%

        gameweek.settle(id);

        address[3] memory podium = gameweek.getPodium(id);
        assertEq(podium[0], alice, "biggest gain wins");
        assertEq(podium[1], bob);
        assertEq(podium[2], carol);

        assertEq(usdc.balanceOf(alice), 60e6, "60 percent of a 100 USDC pot");
        assertEq(usdc.balanceOf(bob), 30e6);
        // Carol started with 300 USDC of cash and takes the 10 percent third-place share.
        assertEq(usdc.balanceOf(carol), 300e6 + 10e6);

        Gameweek.League memory l = gameweek.getLeague(id);
        assertTrue(l.settled);
        assertEq(l.pot, 0, "pot is fully paid out");
        assertEq(usdc.balanceOf(address(gameweek)), 0);
    }

    function test_settle_withTwoEligibleGivesFirstTheUnusedThirdShare() public {
        uint256 id = _newLeague(0, 20);
        _join(id, alice, 0);
        _join(id, bob, 0);
        _join(id, carol, 0); // never funds, so never eligible

        nvda.mint(alice, 1e8);
        usdc.mint(bob, 100e6);

        vm.warp(startTime);
        _refreshFeeds();
        gameweek.lock(id);

        usdc.mint(treasury, 100e6);
        vm.startPrank(treasury);
        usdc.approve(address(gameweek), 100e6);
        gameweek.sponsor(id, 100e6);
        vm.stopPrank();

        vm.warp(endTime);
        nvdaFeed.setAnswer(NVDA_PRICE * 2);

        gameweek.settle(id);

        assertEq(usdc.balanceOf(alice), 70e6, "60 percent plus the unclaimed 10 percent");
        assertEq(usdc.balanceOf(bob), 100e6 + 30e6);
        assertEq(gameweek.getPodium(id)[2], address(0));
        assertEq(usdc.balanceOf(address(gameweek)), 0);
    }

    function test_settle_withOneEligibleTakesTheWholePot() public {
        uint256 id = _newLeague(0, 20);
        _join(id, alice, 0);
        _join(id, bob, 0); // never funds

        usdc.mint(alice, 50e6);

        vm.warp(startTime);
        _refreshFeeds();
        gameweek.lock(id);

        usdc.mint(treasury, 40e6);
        vm.startPrank(treasury);
        usdc.approve(address(gameweek), 40e6);
        gameweek.sponsor(id, 40e6);
        vm.stopPrank();

        vm.warp(endTime);
        gameweek.settle(id);

        assertEq(usdc.balanceOf(alice), 50e6 + 40e6);
        assertEq(usdc.balanceOf(address(gameweek)), 0);
    }

    function test_settle_withNoEligibleMembersRefundsStakesAndReturnsSponsorship() public {
        uint256 id = _newLeague(5e6, 20);
        _join(id, alice, 5e6);
        _join(id, bob, 5e6);
        // Neither funds a league wallet, so both record a zero starting NAV.

        vm.warp(startTime);
        _refreshFeeds();
        gameweek.lock(id);

        usdc.mint(treasury, 20e6);
        vm.startPrank(treasury);
        usdc.approve(address(gameweek), 20e6);
        gameweek.sponsor(id, 20e6);
        vm.stopPrank();

        vm.warp(endTime);
        gameweek.settle(id);

        assertEq(usdc.balanceOf(owner), 20e6, "sponsorship goes back to the owner who put it up");

        vm.prank(alice);
        gameweek.refundStake(id);
        vm.prank(bob);
        gameweek.refundStake(id);

        assertEq(usdc.balanceOf(alice), 5e6);
        assertEq(usdc.balanceOf(bob), 5e6);
        assertEq(usdc.balanceOf(address(gameweek)), 0);

        vm.prank(alice);
        vm.expectRevert(Gameweek.NothingToRefund.selector);
        gameweek.refundStake(id);
    }

    function test_refundStake_revertsWhenLeagueHadAWinner() public {
        uint256 id = _newLeague(5e6, 20);
        _join(id, alice, 5e6);
        _join(id, bob, 5e6);

        usdc.mint(alice, 10e6);

        vm.warp(startTime);
        _refreshFeeds();
        gameweek.lock(id);

        vm.warp(endTime);
        gameweek.settle(id);

        vm.prank(bob);
        vm.expectRevert(Gameweek.NotRefundMode.selector);
        gameweek.refundStake(id);
    }

    function test_settle_tieGoesToTheEarlierJoiner() public {
        uint256 id = _newLeague(0, 20);
        _join(id, alice, 0);
        _join(id, bob, 0);

        usdc.mint(alice, 100e6);
        usdc.mint(bob, 100e6); // identical flat portfolios

        vm.warp(startTime);
        _refreshFeeds();
        gameweek.lock(id);

        usdc.mint(treasury, 10e6);
        vm.startPrank(treasury);
        usdc.approve(address(gameweek), 10e6);
        gameweek.sponsor(id, 10e6);
        vm.stopPrank();

        vm.warp(endTime);
        gameweek.settle(id);

        assertEq(gameweek.getPodium(id)[0], alice, "alice joined first so she wins the tie");
        assertEq(gameweek.getPodium(id)[1], bob);
    }

    function test_settle_capsAbsurdScores() public {
        uint256 id = _newLeague(0, 20);
        _join(id, alice, 0);
        _join(id, bob, 0);

        nvda.mint(alice, 1e8);
        usdc.mint(bob, 230e6);

        vm.warp(startTime);
        _refreshFeeds();
        gameweek.lock(id);

        vm.warp(endTime);
        nvdaFeed.setAnswer(NVDA_PRICE * 1000); // 100_000 percent

        vm.recordLogs();
        gameweek.settle(id);

        // The cap does not change who wins, it bounds what the recorded score can be.
        assertEq(gameweek.getPodium(id)[0], alice);

        bool found;
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] == keccak256("MemberScored(uint256,address,uint256,uint256)")) {
                (, uint256 scoreBps) = abi.decode(logs[i].data, (uint256, uint256));
                if (address(uint160(uint256(logs[i].topics[2]))) == alice) {
                    assertEq(scoreBps, gameweek.MAX_SCORE_BPS(), "score is clamped to 5x");
                    found = true;
                }
            }
        }
        assertTrue(found, "expected a MemberScored event for alice");
    }

    function test_settle_revertsBeforeEndTime() public {
        uint256 id = _threePlayerLeague();

        vm.warp(endTime - 1);
        vm.expectRevert(Gameweek.TooEarly.selector);
        gameweek.settle(id);
    }

    function test_settle_revertsWhenNotLocked() public {
        uint256 id = _newLeague(0, 20);
        _join(id, alice, 0);

        vm.warp(endTime);
        vm.expectRevert(Gameweek.NotLocked.selector);
        gameweek.settle(id);
    }

    function test_settle_revertsTwice() public {
        uint256 id = _threePlayerLeague();

        vm.warp(endTime);
        _refreshFeeds();
        gameweek.settle(id);

        vm.expectRevert(Gameweek.AlreadySettled.selector);
        gameweek.settle(id);
    }

    function test_settle_revertsOnStaleFeed() public {
        uint256 id = _threePlayerLeague();

        vm.warp(endTime);
        // Feeds were last written at startTime, seven days ago.
        vm.expectRevert(
            abi.encodeWithSelector(Gameweek.StaleFeed.selector, address(nvda), uint256(startTime))
        );
        gameweek.settle(id);
    }

    // ---------------------------------------------------------------- force settle

    function test_forceSettle_worksAfterTheDelayWithFrozenFeeds() public {
        uint256 id = _threePlayerLeague();

        vm.warp(endTime + gameweek.FORCE_SETTLE_DELAY());
        // Feeds stay frozen at startTime, as they would during a corporate action.
        gameweek.forceSettle(id);

        assertTrue(gameweek.getLeague(id).settled);
        assertEq(usdc.balanceOf(address(gameweek)), 0);
    }

    function test_forceSettle_revertsBeforeTheDelay() public {
        uint256 id = _threePlayerLeague();

        vm.warp(endTime + gameweek.FORCE_SETTLE_DELAY() - 1);
        vm.expectRevert(Gameweek.TooEarly.selector);
        gameweek.forceSettle(id);
    }

    // ---------------------------------------------------------------- capacity

    function test_lockAndSettleAtMaxMembers() public {
        uint16 cap = gameweek.MAX_MEMBERS();
        uint256 id = _newLeague(0, cap);

        for (uint160 i = 1; i <= cap; ++i) {
            address who = address(0x1000 + i);
            usdc.mint(who, 20e6);
            nvda.mint(who, uint256(i) * 1e6);
            vm.prank(who);
            gameweek.join(id);
        }
        assertEq(gameweek.memberCount(id), cap);

        vm.warp(startTime);
        _refreshFeeds();
        uint256 gasLock = gasleft();
        gameweek.lock(id);
        gasLock -= gasleft();

        usdc.mint(treasury, 50e6);
        vm.startPrank(treasury);
        usdc.approve(address(gameweek), 50e6);
        gameweek.sponsor(id, 50e6);
        vm.stopPrank();

        vm.warp(endTime);
        // NVDA doubles, so the member holding the most of it posts the best ratio. Without a price
        // move every member would tie at 10_000 bps and the earliest joiner would win by tie-break.
        nvdaFeed.setAnswer(NVDA_PRICE * 2);
        aaplFeed.setAnswer(AAPL_PRICE);
        uint256 gasSettle = gasleft();
        gameweek.settle(id);
        gasSettle -= gasleft();

        emit log_named_uint("lock gas at max members", gasLock);
        emit log_named_uint("settle gas at max members", gasSettle);
        assertLt(gasLock, 15_000_000, "lock must fit comfortably in a Base block");
        assertLt(gasSettle, 15_000_000, "settle must fit comfortably in a Base block");

        // The member holding the most NVDA has the highest ratio of stock to flat cash.
        address[3] memory podium = gameweek.getPodium(id);
        assertEq(podium[0], address(0x1000 + uint160(cap)), "largest NVDA holder wins");
        assertEq(podium[1], address(0x1000 + uint160(cap) - 1));
        assertEq(podium[2], address(0x1000 + uint160(cap) - 2));
    }

    // ---------------------------------------------------------------- unknown ids

    function test_unknownLeagueReverts() public {
        vm.expectRevert(Gameweek.UnknownLeague.selector);
        gameweek.getLeague(99);

        vm.expectRevert(Gameweek.UnknownLeague.selector);
        gameweek.getMembers(99);
    }
}
