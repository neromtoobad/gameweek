# Sunday League

A weekly fantasy league where the picks are real Coinbase Tokenized Stocks on Base.

Fund a small league wallet, draft three stocks by swiping, and a live leaderboard ranks you against
your friends all week. Every swipe is a real swap into your own wallet. On Friday at the US close a
contract reads Chainlink, ranks the league, and pays a USDC pot to the top three. Then the next
draft opens.

Draft night is Sunday, when Wall Street is shut and Base is not.

Status: contract complete and tested. Application in progress.

## Repository

| Path | What |
|---|---|
| `contracts/` | Foundry project. `SundayLeague.sol`, unit tests, Base mainnet fork tests, deploy scripts |
| `contracts/config/tokens.json` | The 13 tokenized stocks with their Chainlink feeds, verified onchain |
| `app/` | Next.js web app (not started) |

## Contract

`SundayLeague.sol` never custodies a player's stocks. It records a start-of-week net asset value per
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
