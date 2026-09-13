# ETHOnline 2026 — submission sheet

Deadline: **Sun 13 Sep 2026, 12:00 pm EDT**. Every field below is ready to paste.

## Track: Start Fresh (Classic)

Gameweek qualifies outright. The hackathon opened 4 Sep; the first commit here is 6 Sep, and
all 33 commits fall inside the window, spread over four days with real history. Nothing
pre-existing to disclose, no Continuity paperwork, no large squashed commit to explain.

```
first commit   2026-09-06
last commit    2026-09-09
commits        33  (26 on 09-06, 2 on 09-08, 5 on 09-09)
```

## Partner prize: Chainlink

Pick Chainlink and leave the other two partner slots empty. The fit is structural, not a
sticker: `Gameweek.sol` reads `latestRoundData()` inside `lock()` and `settle()`, and the
answer it gets is what ranks the league and moves the USDC. Chainlink asks that feed data
drive onchain state rather than decorate a frontend, and here the payout cannot happen
without it.

| Where | What it does |
|---|---|
| `contracts/src/Gameweek.sol:441` | Reads the feed at lock to fix each pick's opening price |
| `contracts/src/Gameweek.sol:493` | Reads the feed at settle to score and pay 60/30/10 |
| `contracts/src/Gameweek.sol:207` | Two-hour staleness tolerance; a stale feed blocks settlement |

Ten tokenized stocks are registered, each against its own Chainlink equity feed.

**Do not claim the other partners.** The Graph needs a subgraph we have not built. Uniswap
needs a `FEEDBACK.md` and their developer feedback form, and our pool is Aerodrome
Slipstream — a Uniswap v3 fork, which is not the same as building on Uniswap. Claiming
either would be a misrepresentation on a form that gets inspected.

## Links

| Field | Value |
|---|---|
| Live demo | `https://gameweek-bay.vercel.app` |
| Source code | `https://github.com/neromtoobad/gameweek` |
| Demo video | **← record from the script in `SUBMISSION.md`, upload unlisted to YouTube, paste URL** |
| Network | Base mainnet (chain 8453) |
| `Gameweek` | `0x91c0110852a7abd96e18a928e38d25ee8f384888`, source verified |
| `GameweekRouter` | `0x129e71616c4ad2a1f38c87502f7800ddbfdb1fdc`, source verified |

## One-liner

```
A weekly fantasy league where the picks are real tokenized stocks on Base, drafted on a
Sunday when Wall Street is shut and the chain is not.
```

## Short description

```
Gameweek is a fantasy football league played with Coinbase Tokenized Stocks on Base. You
field five, in a one-two-two, and one pick wears the armband — the captain's stake is
doubled, so it is a real position size rather than a multiplier bolted onto a scoreboard.

Every pick is a real swap into a wallet you own, batched so a whole draft is one signature.
The router takes 50 basis points and that fee funds the pot. Twenty-four hours later the
contract reads Chainlink, ranks the league, and pays the top three 60/30/10.

The draft happens on Sunday, when the exchange is closed and Base is not. Each card shows
how far the onchain pool price has drifted from Friday's close — a number that only exists
because these stocks keep trading after Wall Street goes home.
```

## Long description — how it's made

```
Two Solidity contracts on Base mainnet, both deployed and source-verified.

Gameweek.sol holds the league. It registers ten tokenized stocks against their Chainlink
equity feeds, locks each member's opening valuation at the open, and at the final whistle
reads fresh Chainlink prices to score the table and pay a USDC pot 60/30/10. Feeds older
than two hours are rejected, so a stale oracle stops settlement rather than mispricing it.
Scoring is ten points a percent, and the captain's stake is doubled at the contract level.

GameweekRouter.sol makes a pick one tap. It routes the trade straight into the Aerodrome
Slipstream pool and takes the 50 bps league fee in the same call, rather than going out to
an HTTP aggregator and putting a network round-trip inside a swipe. The frontend batches a
whole draft via EIP-5792, so a Base Account signs once and never ends up holding two picks
out of five. Injected wallets mostly do not implement 5792, so they fall back to signing
each pick in turn; the connect card says so on screen.

The app is mobile-first, prices all ten stocks from mainnet on every page load, and reads
both pool prices and feed prices live.
```

## The honest section — say this, do not hide it

No round has been played. The wallet holding the float became unreachable before the first
one could open, and a round with nothing staked cannot settle, by design — the contract
skips members whose starting value is zero.

So rather than claim a result that did not happen, everything a round depends on is proven
against live mainnet:

```
cd app && node scripts/prove-live.mjs
```

It spends nothing and sends no transaction. It reads the deployed contracts, then uses
`eth_call` with an overridden USDC allowance to push a real draft pick through the real
Aerodrome pool, and runs a multi-block simulation with the clock moved forward to open,
lock and settle a whole round against the real Chainlink feeds. Sixteen checks, all green.
Sixty-four unit tests pass. Opening a real round is one funded transaction away and costs
about two tenths of a cent.

Put this in the description and in the video. It reads as rigour, and a judge who finds it
themselves after you omitted it reads it as something else.

## Numbers — use these exact ones

| Claim | Value |
|---|---|
| Tokenized stocks registered | 10, each against its Chainlink feed |
| Tests | 64 passing |
| Live checks in `prove-live.mjs` | 16, all passing |
| Simulated draft pick | $0.25 buys 0.0011 NVDAc, 0.14% from the Chainlink price |
| Router fee | 50 bps, funds the pot |
| Payout | 60 / 30 / 10 |
| Round | 24 hours, locks and settles 21:00 UTC at the US close |
| Deploy cost | $0.066 for both contracts |
| A draft | ~$0.010 of gas |

## Do not claim

- That a round has been played, or that any live draft has happened.
- That Builder Codes or a Paymaster are active. Both are wired but have no value set in
  production. "Wired, one environment variable away" is the accurate phrasing.
- That Sub Accounts have been exercised end to end.
- That a browser wallet gets the one-signature draft. Only the Base Account does.
- Any partner prize other than Chainlink.

## Deck

`deck.html` in this repo, four slides, arrow keys to move.
Published: https://claude.ai/code/artifact/b5afae36-d719-4fac-bd9e-41d21b3cb4ea
