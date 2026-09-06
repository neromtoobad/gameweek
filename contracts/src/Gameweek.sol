// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

/// @title Gameweek
/// @notice Weekly fantasy leagues scored on real Coinbase Tokenized Stocks (B20) held in each
///         player's own wallet. The contract never custodies a player's stocks. It only records a
///         start-of-week net asset value per player, ranks players at the end of the week from
///         Chainlink prices, and pays a USDC pot to the top three.
///
/// @dev Scoring
///      navUsd6(wallet) = usdc.balanceOf(wallet)
///                      + sum over enabled tokens of balanceOf(wallet) * feedPrice / scale
///      where scale = 10 ** (tokenDecimals + feedDecimals - 6), so the result carries USDC's
///      6 decimals. On Base today every B20 token and every Chainlink equity feed uses 8 decimals,
///      giving scale = 1e10, but the value is derived per token at registration so a future token
///      with different decimals keeps working.
///
/// @dev KNOWN LIMITATION (documented, not hidden)
///      Players self-custody their league wallets, so the contract cannot distinguish trading gains
///      from fresh deposits made after lock(). A player who wires extra USDC into their league
///      wallet mid-week inflates their score. Mitigations shipped here: scores are capped at
///      MAX_SCORE_BPS, and lock/settle NAVs are emitted so anyone can audit a result against the
///      wallet's transfer history. A future version routes all funding through this contract, or
///      escrows league wallets, so deposits can be subtracted from the score.
contract Gameweek is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------- constants

    /// @notice Basis-point denominator. A score of 10_000 means the wallet ended flat.
    uint256 public constant BPS = 10_000;

    /// @notice Scores are capped at 5x so a single absurd wallet cannot dominate a league.
    uint256 public constant MAX_SCORE_BPS = 50_000;

    /// @notice Pot split for first, second and third place, in basis points.
    uint256 internal constant PAYOUT_FIRST = 6_000;
    uint256 internal constant PAYOUT_SECOND = 3_000;
    uint256 internal constant PAYOUT_THIRD = 1_000;

    /// @notice Upper bound on league size. Chosen so lock() and settle() stay well inside a block:
    ///         each member costs one balanceOf per enabled token plus one feed read per held token.
    uint16 public constant MAX_MEMBERS = 50;

    /// @notice Largest buy-in a league may charge, in USDC units (6 decimals).
    uint128 public constant MAX_BUY_IN = 10e6;

    /// @notice Longest staleness tolerance a league may configure.
    uint32 public constant MAX_STALENESS = 30 days;

    /// @notice How long after endTime anyone may settle a league while ignoring feed staleness.
    ///         This is the escape hatch for a feed frozen by a corporate action.
    uint256 public constant FORCE_SETTLE_DELAY = 72 hours;

    // ---------------------------------------------------------------- storage

    /// @notice The pot and buy-in token. USDC on Base.
    IERC20 public immutable usdc;

    struct TokenInfo {
        address feed; // Chainlink aggregator proxy
        uint256 scale; // 10 ** (tokenDecimals + feedDecimals - 6); zero means never registered
        bool enabled; // false hides a token from scoring without losing its scale
    }

    /// @notice Every token ever registered, in registration order.
    address[] public tokens;

    /// @notice Feed, scale and enabled flag per token address.
    mapping(address token => TokenInfo info) public tokenInfo;

    struct League {
        string name;
        uint64 startTime; // drafting is open until here; lock() may run from here
        uint64 endTime; // settle() may run from here
        uint32 stalenessTolerance; // max feed age accepted by lock() and settle()
        uint16 maxMembers;
        uint128 buyIn; // USDC each member pays to join; may be zero
        uint128 pot; // total USDC held for this league (buy-ins plus sponsorships)
        uint128 stakes; // the buy-in portion of pot, refundable if nobody is eligible
        bool locked;
        bool settled;
        bool refundMode; // set when a league settles with no eligible member
    }

    League[] internal _leagues;

    mapping(uint256 id => address[] members) internal _members;
    mapping(uint256 id => mapping(address member => bool joined)) public isMember;
    mapping(uint256 id => mapping(address member => uint256 nav)) public navStart;
    mapping(uint256 id => mapping(address member => uint128 stake)) public stakeOf;
    mapping(uint256 id => address[3] podium) internal _podium;

    // ---------------------------------------------------------------- events

    event TokenSet(address indexed token, address indexed feed, uint256 scale);
    event TokenEnabled(address indexed token, bool enabled);

    event LeagueCreated(
        uint256 indexed id,
        address indexed creator,
        string name,
        uint64 startTime,
        uint64 endTime,
        uint128 buyIn,
        uint16 maxMembers
    );
    event Joined(uint256 indexed id, address indexed member, uint128 stake);
    event Locked(uint256 indexed id, uint256 memberCount);
    event NavRecorded(uint256 indexed id, address indexed member, uint256 navStartUsd6);
    event Sponsored(uint256 indexed id, address indexed from, uint128 amount);
    event Settled(
        uint256 indexed id, address[3] podium, uint256[3] scoresBps, uint256[3] payouts, uint128 pot, uint256 eligible
    );
    event MemberScored(uint256 indexed id, address indexed member, uint256 navEndUsd6, uint256 scoreBps);
    event SettledNoWinner(uint256 indexed id, uint128 sponsorReturned);
    event StakeRefunded(uint256 indexed id, address indexed member, uint128 amount);

    // ---------------------------------------------------------------- errors

    error BadWindow();
    error BadMemberCap();
    error BadStaleness();
    error BuyInTooLarge();
    error UnknownLeague();
    error DraftClosed();
    error AlreadyMember();
    error LeagueFull();
    error NotStarted();
    error AlreadyLocked();
    error NotLocked();
    error AlreadySettled();
    error NotSettled();
    error TooEarly();
    error NoEligibleMembers();
    error NotRefundMode();
    error NothingToRefund();
    error StaleFeed(address token, uint256 updatedAt);
    error BadPrice(address token);
    error ScaleUnderflow();
    error UnknownToken();
    error ZeroAddress();
    error LengthMismatch();

    // ---------------------------------------------------------------- constructor

    constructor(address usdc_, address owner_) Ownable(owner_) {
        if (usdc_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
    }

    // ---------------------------------------------------------------- token registry

    /// @notice Register or update a scoreable token and its Chainlink feed.
    /// @dev Reads decimals from both sides so the NAV scale is never hardcoded.
    function setToken(address token, address feed) external onlyOwner {
        _setToken(token, feed);
    }

    /// @notice Register many tokens in one transaction.
    /// @dev Registration is always its own transaction, because `setToken` reads decimals() from a
    ///      B20 address and forge cannot simulate a node precompile. Doing all of them at once means
    ///      one signature and no chance of a half-registered contract.
    function setTokens(address[] calldata tokenList, address[] calldata feeds) external onlyOwner {
        uint256 n = tokenList.length;
        if (n != feeds.length) revert LengthMismatch();
        for (uint256 i; i < n; ++i) {
            _setToken(tokenList[i], feeds[i]);
        }
    }

    function _setToken(address token, address feed) internal {
        if (token == address(0) || feed == address(0)) revert ZeroAddress();

        uint256 td = IERC20Metadata(token).decimals();
        uint256 fd = IAggregatorV3(feed).decimals();
        if (td + fd < 6) revert ScaleUnderflow();
        uint256 scale = 10 ** (td + fd - 6);

        if (tokenInfo[token].scale == 0) tokens.push(token);
        tokenInfo[token] = TokenInfo({feed: feed, scale: scale, enabled: true});

        emit TokenSet(token, feed, scale);
    }

    /// @notice Include or exclude an already-registered token from scoring.
    function setTokenEnabled(address token, bool enabled) external onlyOwner {
        if (tokenInfo[token].scale == 0) revert UnknownToken();
        tokenInfo[token].enabled = enabled;
        emit TokenEnabled(token, enabled);
    }

    function tokenCount() external view returns (uint256) {
        return tokens.length;
    }

    // ---------------------------------------------------------------- leagues

    /// @notice Open a league. Anyone may create one.
    /// @param stalenessTolerance_ Maximum Chainlink feed age accepted at lock and settle. Two hours
    ///        suits a real league that locks at the Friday close. A demo league may pass a longer
    ///        value so it can settle over a weekend while feeds hold the last close.
    function createLeague(
        string calldata name,
        uint64 startTime,
        uint64 endTime,
        uint128 buyIn,
        uint32 stalenessTolerance_,
        uint16 maxMembers_
    ) external returns (uint256 id) {
        if (startTime < block.timestamp || endTime <= startTime) revert BadWindow();
        if (maxMembers_ < 2 || maxMembers_ > MAX_MEMBERS) revert BadMemberCap();
        if (stalenessTolerance_ == 0 || stalenessTolerance_ > MAX_STALENESS) revert BadStaleness();
        if (buyIn > MAX_BUY_IN) revert BuyInTooLarge();

        id = _leagues.length;
        _leagues.push(
            League({
                name: name,
                startTime: startTime,
                endTime: endTime,
                stalenessTolerance: stalenessTolerance_,
                maxMembers: maxMembers_,
                buyIn: buyIn,
                pot: 0,
                stakes: 0,
                locked: false,
                settled: false,
                refundMode: false
            })
        );

        emit LeagueCreated(id, msg.sender, name, startTime, endTime, buyIn, maxMembers_);
    }

    /// @notice Join a league. The caller is the league wallet that will be scored, so this is called
    ///         from the player's Sub Account (or from the bot's EOA).
    function join(uint256 id) external nonReentrant {
        League storage l = _league(id);
        if (block.timestamp >= l.startTime || l.locked) revert DraftClosed();
        if (isMember[id][msg.sender]) revert AlreadyMember();
        if (_members[id].length >= l.maxMembers) revert LeagueFull();

        isMember[id][msg.sender] = true;
        _members[id].push(msg.sender);

        uint128 buyIn = l.buyIn;
        if (buyIn > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), buyIn);
            l.pot += buyIn;
            l.stakes += buyIn;
            stakeOf[id][msg.sender] = buyIn;
        }

        emit Joined(id, msg.sender, buyIn);
    }

    /// @notice Add USDC to a league's pot. Used by the treasury to push accrued swap fees into pots.
    function sponsor(uint256 id, uint128 amount) external nonReentrant {
        League storage l = _league(id);
        if (l.settled) revert AlreadySettled();
        if (amount == 0) revert NothingToRefund();

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        l.pot += amount;

        emit Sponsored(id, msg.sender, amount);
    }

    /// @notice Snapshot every member's starting NAV. Callable by anyone once startTime has passed.
    /// @dev Feeds must be fresh, so this is meant to run at the Friday close when equity feeds are
    ///      still updating. A member who has not funded their league wallet records zero and is
    ///      skipped at settlement.
    function lock(uint256 id) external {
        League storage l = _league(id);
        if (block.timestamp < l.startTime) revert NotStarted();
        if (l.locked) revert AlreadyLocked();

        l.locked = true;

        address[] storage m = _members[id];
        uint256 n = m.length;
        uint256 maxAge = l.stalenessTolerance;

        for (uint256 i; i < n; ++i) {
            uint256 v = _nav(m[i], maxAge);
            navStart[id][m[i]] = v;
            emit NavRecorded(id, m[i], v);
        }

        emit Locked(id, n);
    }

    /// @notice Score the league from fresh Chainlink prices and pay the pot 60/30/10.
    function settle(uint256 id) external {
        _settle(id, false);
    }

    /// @notice Settle while ignoring feed staleness. Only available 72 hours after endTime, and only
    ///         intended for a feed frozen by a corporate action.
    function forceSettle(uint256 id) external {
        _settle(id, true);
    }

    function _settle(uint256 id, bool force) internal nonReentrant {
        League storage l = _league(id);
        if (!l.locked) revert NotLocked();
        if (l.settled) revert AlreadySettled();
        if (block.timestamp < l.endTime) revert TooEarly();
        if (force && block.timestamp < uint256(l.endTime) + FORCE_SETTLE_DELAY) revert TooEarly();

        uint256 maxAge = force ? type(uint256).max : l.stalenessTolerance;

        address[3] memory top;
        uint256[3] memory topScore;
        uint256 eligible;

        address[] storage m = _members[id];
        uint256 n = m.length;

        for (uint256 i; i < n; ++i) {
            address who = m[i];
            uint256 start = navStart[id][who];
            if (start == 0) continue;

            uint256 end = _nav(who, maxAge);
            uint256 score = (end * BPS) / start;
            if (score > MAX_SCORE_BPS) score = MAX_SCORE_BPS;

            unchecked {
                ++eligible;
            }
            emit MemberScored(id, who, end, score);

            // Single pass keeping the best three. Strict comparisons mean an earlier joiner keeps
            // the higher rank on a tie, which matches the documented tie-break.
            if (score > topScore[0]) {
                topScore[2] = topScore[1];
                top[2] = top[1];
                topScore[1] = topScore[0];
                top[1] = top[0];
                topScore[0] = score;
                top[0] = who;
            } else if (score > topScore[1]) {
                topScore[2] = topScore[1];
                top[2] = top[1];
                topScore[1] = score;
                top[1] = who;
            } else if (score > topScore[2]) {
                topScore[2] = score;
                top[2] = who;
            }
        }

        l.settled = true;
        uint128 pot = l.pot;
        l.pot = 0;

        if (eligible == 0) {
            // Nobody funded a league wallet. Members reclaim their buy-ins with refundStake and the
            // sponsored remainder goes back to the owner who put it up.
            l.refundMode = true;
            uint128 sponsored = pot - l.stakes;
            if (sponsored > 0) usdc.safeTransfer(owner(), sponsored);
            emit SettledNoWinner(id, sponsored);
            return;
        }

        _podium[id] = top;

        uint256[3] memory payouts;
        uint256 places = eligible < 3 ? eligible : 3;
        uint256 remaining = pot;

        // Pay third then second from fixed shares. Whatever is left, including the shares of places
        // that do not exist and any rounding dust, goes to first.
        if (places >= 3) {
            uint256 amt = (pot * PAYOUT_THIRD) / BPS;
            if (amt > 0) {
                payouts[2] = amt;
                remaining -= amt;
                usdc.safeTransfer(top[2], amt);
            }
        }
        if (places >= 2) {
            uint256 amt = (pot * PAYOUT_SECOND) / BPS;
            if (amt > 0) {
                payouts[1] = amt;
                remaining -= amt;
                usdc.safeTransfer(top[1], amt);
            }
        }
        if (remaining > 0) {
            payouts[0] = remaining;
            usdc.safeTransfer(top[0], remaining);
        }

        emit Settled(id, top, topScore, payouts, pot, eligible);
    }

    /// @notice Reclaim a buy-in from a league that settled with no eligible member.
    function refundStake(uint256 id) external nonReentrant {
        League storage l = _league(id);
        if (!l.settled) revert NotSettled();
        if (!l.refundMode) revert NotRefundMode();

        uint128 amount = stakeOf[id][msg.sender];
        if (amount == 0) revert NothingToRefund();
        stakeOf[id][msg.sender] = 0;

        usdc.safeTransfer(msg.sender, amount);
        emit StakeRefunded(id, msg.sender, amount);
    }

    // ---------------------------------------------------------------- views

    /// @notice Net asset value of a wallet in USD with 6 decimals, ignoring feed staleness.
    /// @dev For user interfaces and off-chain cross-checks. Scoring uses the strict internal path.
    function navOf(address wallet) external view returns (uint256) {
        return _nav(wallet, type(uint256).max);
    }

    /// @notice NAV plus the age of the oldest feed actually used, so a caller can judge freshness.
    function navWithAge(address wallet) external view returns (uint256 usd6, uint256 oldestFeedAge) {
        usd6 = usdc.balanceOf(wallet);
        uint256 n = tokens.length;
        for (uint256 i; i < n; ++i) {
            address t = tokens[i];
            TokenInfo memory info = tokenInfo[t];
            if (!info.enabled) continue;
            uint256 bal = IERC20(t).balanceOf(wallet);
            if (bal == 0) continue;

            (, int256 answer,, uint256 updatedAt,) = IAggregatorV3(info.feed).latestRoundData();
            if (answer <= 0) revert BadPrice(t);

            uint256 age = block.timestamp > updatedAt ? block.timestamp - updatedAt : 0;
            if (age > oldestFeedAge) oldestFeedAge = age;

            // casting to 'uint256' is safe because answer is checked to be strictly positive above
            // forge-lint: disable-next-line(unsafe-typecast)
            usd6 += (bal * uint256(answer)) / info.scale;
        }
    }

    function leagueCount() external view returns (uint256) {
        return _leagues.length;
    }

    function getLeague(uint256 id) external view returns (League memory) {
        return _league(id);
    }

    function getMembers(uint256 id) external view returns (address[] memory) {
        if (id >= _leagues.length) revert UnknownLeague();
        return _members[id];
    }

    function memberCount(uint256 id) external view returns (uint256) {
        if (id >= _leagues.length) revert UnknownLeague();
        return _members[id].length;
    }

    function getPodium(uint256 id) external view returns (address[3] memory) {
        if (id >= _leagues.length) revert UnknownLeague();
        return _podium[id];
    }

    // ---------------------------------------------------------------- internals

    /// @dev Sums USDC plus every enabled token the wallet actually holds. Tokens with a zero balance
    ///      are skipped before the feed is read, so a league never fails to settle because a feed
    ///      nobody is exposed to has frozen.
    function _nav(address wallet, uint256 maxAge) internal view returns (uint256 usd6) {
        usd6 = usdc.balanceOf(wallet);

        uint256 n = tokens.length;
        for (uint256 i; i < n; ++i) {
            address t = tokens[i];
            TokenInfo memory info = tokenInfo[t];
            if (!info.enabled) continue;

            uint256 bal = IERC20(t).balanceOf(wallet);
            if (bal == 0) continue;

            (, int256 answer,, uint256 updatedAt,) = IAggregatorV3(info.feed).latestRoundData();
            if (answer <= 0) revert BadPrice(t);
            if (maxAge != type(uint256).max) {
                if (updatedAt == 0 || block.timestamp - updatedAt > maxAge) revert StaleFeed(t, updatedAt);
            }

            // casting to 'uint256' is safe because answer is checked to be strictly positive above
            // forge-lint: disable-next-line(unsafe-typecast)
            usd6 += (bal * uint256(answer)) / info.scale;
        }
    }

    function _league(uint256 id) internal view returns (League storage) {
        if (id >= _leagues.length) revert UnknownLeague();
        return _leagues[id];
    }
}
