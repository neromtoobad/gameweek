# Submission kit

Everything needed to record and submit. Delete this file after submitting.

## Video script

Target 2:45. Roughly 400 words of narration at a normal speaking pace. Record the screen at
1280x800 or a phone at 390x844; the app is mobile-first and looks better narrow.

Have these open in tabs before you start:

1. https://gameweek-bay.vercel.app
2. https://gameweek-bay.vercel.app/draft
3. A terminal in `app/`, ready to run `node scripts/prove-live.mjs`
4. https://base.blockscout.com/address/0x91c0110852a7abd96e18a928e38d25ee8f384888?tab=contract

---

### 0:00 – 0:18 · Hook

*Shot: the home page. Let the marquee move. Scroll slowly to the board so the live prices land.*

> Wall Street shuts at four o'clock. Base does not.
>
> This is Gameweek. It is a fantasy football league where the players are real stocks, and the
> transfer market never closes.

### 0:18 – 0:35 · The number that only exists here

*Shot: the board. Hover or point at a card's percentage chip.*

> Every card shows a live price from an Aerodrome pool, and how far it has drifted from Friday's
> closing price on the exchange.
>
> That gap is the whole idea. It only exists because these stocks keep trading onchain after the
> exchange has gone home for the weekend.

### 0:35 – 1:12 · The draft

*Shot: /draft. Swipe through the deck. Pick a keeper, two defenders, two forwards. Give one the
armband. Let the pitch fill up.*

> You field five, in a one-two-two, the way you would pick a football side.
>
> Every stock has a position based on how hard it moves. Keepers are the steady names. Forwards are
> the ones that swing. You cannot field five forwards even when momentum says you should, and that
> constraint is the game.
>
> One pick wears the armband. The captain's stake is doubled, so it is a real position size, not a
> multiplier bolted onto a scoreboard. The chain settles exactly what the table shows.
>
> Scores are points. Ten points a percent, so a five percent day is fifty points.

### 1:12 – 1:38 · What actually happens onchain

*Shot: the team sheet with the budget ring, then cut to the verified source on Blockscout and
scroll `swapExactIn`.*

> A pick is not a bet. It is a real swap, into a wallet you own, held by a passkey.
>
> The whole draft is one batched transaction, so you sign once and never end up holding two picks
> out of five. The router takes fifty basis points, and that fee is what funds the league pot.
>
> Both contracts are deployed on Base mainnet with their source verified. Twenty-four hours later
> the contract reads Chainlink, ranks the league, and pays the top three sixty, thirty, ten.

### 1:38 – 2:20 · The proof

*Shot: the terminal. Run `node scripts/prove-live.mjs` and let it scroll. Hold on the summary line.*

> Here is the part I want to be straight about.
>
> No round has been played. The wallet holding the float became unreachable before the first one
> could open, and a round with nothing staked in it cannot settle, by design.
>
> So instead of showing you a result I did not get, everything the round depends on is proven
> against live mainnet. This script sends no transaction and spends nothing.
>
> It buys a quarter of a dollar of Nvidia through the real pool and lands within a sixth of a
> percent of the Chainlink price. It opens a league, locks it, and settles it against real feeds
> with the clock moved forward. Sixteen checks, all green.
>
> You can run it yourself. It is one command in the repo.

### 2:20 – 2:45 · Close

*Shot: back to the home page.*

> Sixty-four tests pass. Both contracts are live and verified. The app prices ten tokenized stocks
> from mainnet on every page load.
>
> Opening a real round is one funded transaction away, and it costs two tenths of a cent.
>
> Gameweek. A stock draft on a Sunday, which is the one thing a brokerage cannot give you.

---

### Recording notes

- Say the honest section in the same tone as the rest. It reads as rigour, not as an apology.
- Do not connect a wallet on camera. The popup needs Coinbase hosts, and if the network blocks
  them the failure is on tape.
- If the draft deck is slow to price, let it. Twenty seconds of real prices loading is more
  convincing than a cut.
- Export at 1080p. Keep it under three minutes.

## Four slides

Presentable deck: **https://claude.ai/code/artifact/b5afae36-d719-4fac-bd9e-41d21b3cb4ea**

The source is `deck.html` in this repo. Arrow keys move between slides. It carries the app's own
tokens (`#08080b` ground, volt `#d7ff3f` on live numbers only, Base blue reserved for the brand)
and the real Big Shoulders and Manrope faces, so the deck and the product look like one thing.
To export a PDF: open it, then print to PDF one slide at a time.

| # | Slide | The one thing it must land |
|---|---|---|
| 1 | Wall Street shuts at four. Base does not. | The weekend gap is a real, onchain-only number |
| 2 | Five stocks, one armband, ten points a percent | It is a game with a constraint, not a trading UI |
| 3 | Deployed, verified, and proven | Real addresses, 64 tests, 16 live checks |
| 4 | A dollar a gameweek | Twenty-five cents a pick answers the brief on access |

## Facts to keep straight

Use these exact numbers. They were all measured, not estimated.

| Claim | Value |
|---|---|
| `Gameweek` | `0x91c0110852a7abd96e18a928e38d25ee8f384888`, verified |
| `GameweekRouter` | `0x129e71616c4ad2a1f38c87502f7800ddbfdb1fdc`, verified |
| Tokenized stocks registered | 10, each against its Chainlink feed |
| Tests | 64 passing |
| Live checks in `prove-live.mjs` | 16, all passing |
| Simulated draft pick | $0.25 buys 0.0011 NVDAc, 0.14% from the Chainlink price |
| Router fee | 50 bps, funds the pot |
| Payout | 60 / 30 / 10 |
| Round | 24 hours, locks and settles 21:00 UTC at the US close |
| Deploy cost | $0.066 for both contracts |
| A three-pick draft | $0.010 of gas |

### Do not claim

- That a round has been played, or that any live draft has happened.
- Builder Codes or a Paymaster are active. Both are wired in the code but have no value set in
  production, so neither is live. Say "wired, one environment variable away" if asked.
- Sub Accounts have been exercised end to end. The SDK is configured for them and the draft path
  is built against them, but no player has ever connected.
