# Gameweek

A weekly fantasy league where the picks are real Coinbase Tokenized Stocks on Base.

A gameweek runs from one Friday US close to the next. Draft night is the Sunday in between, when
Wall Street is shut and Base is not.

Fund a small league wallet, draft three stocks by swiping, and a live leaderboard ranks you against
your friends all week. Every swipe is a real swap into your own wallet. On Friday at the US close a
contract reads Chainlink, ranks the league, and pays a USDC pot to the top three. Then the next
draft opens.

Status: contracts complete and tested, 61 tests green. Draft loop working against live Aerodrome
prices. Not yet deployed.

## Drafting

The deck offers the ten tokenized stocks that actually have an onchain pool. Each card shows the
live pool price and how far it sits from Friday's close, which is the number that only exists
because Base keeps trading after Wall Street shuts.

A pick is a real swap. `GameweekRouter` sends the trade to the Aerodrome Slipstream pool and takes
the 50 basis point fee that funds league pots, in one call. A whole draft is one batched
transaction, so a player signs once and never ends up holding two of three picks.

Gameweek routes itself rather than calling an aggregator, for two reasons. The published Slipstream
periphery points at a different factory and does not know about these pools. And a demo should not
have an HTTP request in the middle of its critical path.

## Repository

| Path | What |
|---|---|
| `contracts/` | Foundry project. `Gameweek.sol`, `GameweekRouter.sol`, unit tests, Base mainnet fork tests, deploy scripts |
| `contracts/config/tokens.json` | The 13 tokenized stocks with their Chainlink feeds, verified onchain |
| `app/` | Next.js web app: live board, swipe-to-draft deck, onchain pricing |

## Contract

`Gameweek.sol` never custodies a player's stocks. It records a start-of-week net asset value per
player, ranks players from Chainlink prices at the end of the week, and pays a USDC pot 60/30/10.

Scoring, in USD with USDC's 6 decimals:

```
nav(wallet) = usdc.balanceOf(wallet)
            + sum over enabled tokens of balanceOf(wallet) * feedPrice / scale
scale       = 10 ** (tokenDecimals + feedDecimals - 6)
```

Every B20 token and every Chainlink equity feed on Base uses 8 decimals today, so scale is 1e10, but
it is derived per token at registration rather than hardcoded.

### Design notes

- **A token nobody holds is skipped before its feed is read.** A feed frozen by a corporate action
  cannot block a league whose members have no exposure to it.
- **Stale feeds cannot settle a league.** `lock` and `settle` reject any feed older than the
  league's tolerance. `forceSettle` ignores staleness but only 72 hours after the end, as the
  documented escape hatch for a frozen feed.
- **Ties go to the earlier joiner**, resolved by a single ranking pass rather than a sort.
- **A league with no funded members** refunds buy-ins and returns the sponsorship instead of
  stranding the pot.

### Known limitation

Players self-custody their league wallets, so the contract cannot tell trading gains from fresh
deposits made after lock. Someone who wires extra USDC into their league wallet mid-week inflates
their score. Shipped mitigations: scores are capped at 5x, and both NAVs are emitted so any result
can be audited against the wallet's transfer history. A future version routes funding through the
contract so deposits can be subtracted.

## What it costs

A gameweek is a dollar. Measured onchain on 2026-09-06 at 0.006 gwei with ETH at $2,493:

| Action | Cost |
|---|---|
| Deploy both contracts | $0.066 |
| Register all ten tokens | $0.007 |
| Draft three picks in one batch | $0.010 |
| Lock and settle a league | $0.007 |

Gas is not the constraint on Base. The only real spend is the stake, and even that is not consumed:
a $1 draft becomes $1 of stock. The cost of playing is the 50 basis point router fee, the pool's 5
basis points, and slippage, so about 1% per round trip.

That is the point rather than a limitation. The Request for Builders opens on emerging markets shut
out of US equities by fees and minimums. Twenty-five cents a pick, with gas sponsored, is an answer
to that.

## Build and test

```bash
cd contracts
forge build
forge test                                              # 38 unit tests
forge test --fork-url $BASE_RPC_URL --match-contract Fork -vv   # 6 tests against Base mainnet
```

Gas at the 50-member cap: `lock` 1.72M, `settle` 578K.

## Deploying

B20 tokens are Base node precompiles with no bytecode. `forge script` simulates locally before
broadcasting and cannot execute them, so registration is a separate `cast send` step.

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_RPC_URL --account deployer --broadcast --verify
./script/register-tokens.sh 0xDeployedAddress
```

## Coinbase Tokenized Stocks on Base

Verified onchain on 2026-09-06 at block 50943159. Ten of the thirteen listings have supply; COINc,
CRCLc and INTCc had none, so nothing routes to them yet.

Tokenized stocks are available only to eligible persons outside the United States. Nothing here is
investment advice.
