# Gameweek — project brain

Read this first every session. Update the phase checkboxes and "things that burned us" before ending a session.

## One line

A weekly fantasy league web app where the picks are real Coinbase Tokenized Stocks, bought into the player's own wallet on Base. A gameweek runs Friday close to Friday close; draft night is the Sunday in between.

## What we are building and why it qualifies

Hackathon: Base Builder Quest, "Request for Builders: Tokenized Stocks". $5,000 prize pool. Brief: build a project that helps people trade or use Coinbase Tokenized Stocks on Base. Deadline, judging criteria and submission form: UNKNOWN, fill in from the @base / @buildonbase X posts before Phase 1.

Gameweek makes people trade tokenized stocks every week:
- A league is 3 to 20 friends who join by invite link. Each member has a league wallet (a Base Account Sub Account) funded with a small USDC budget.
- The week locks Friday 21:00 UTC (US close, Chainlink feeds fresh). Over the weekend, while TradFi is closed, members draft: swipe to buy any of the 13 tickers with real swaps on Base. Sunday night is draft night.
- A live leaderboard ranks members by return on their league wallet all week. The next Friday 21:00 UTC the contract settles from Chainlink, pays the pot to the winner, and a new week opens. Re-drafting every week is the trading volume.
- Every swap carries our Builder Code and a 0x affiliate fee. Fees fund the pots. Nobody's principal is pooled. Spot only, no leverage.

Why it wins on the brief: real B20 swaps on every action, a weekly ritual that repeats, stacks four Base primitives (B20 stocks, Base Account Sub Accounts + Spend Permissions, Paymaster, Builder Codes), and does the one thing Robinhood cannot: a stock draft on a Sunday.

Delivery: a plain web app (mobile-first, works on desktop). No Farcaster mini app, no Base App manifest. Decided 2026-09-06 to cut the unknown of running the Sub Account flow inside the Base App webview. Distribution is invite links and share-to-X/WhatsApp.

Winning layer on top of the loop (decided 2026-09-06):
- Weekend gap badge on every card (DEX price vs frozen Friday close). The unique-to-onchain property made visible.
- Top 3 payout 60/30/10 so the league stays alive until Friday.
- Receipts tab, pot transparency page, Basenames on the leaderboard, budget ring and trust strip. Judges verify in seconds.
- One public open league for cold start.
- A bot player in every league (AI agent with its own wallet, drafts Sunday night). "Beat the bot" covers the RFB agents bullet.
- Coach card: one cached line per ticker on why this week, plus "draft for me" from a stated thesis. Covers the RFB AI-portfolio bullet without building an index product. Information, not advice.
- Dividend badge from MultiplierUpdated events.
- A real settled week with real players before submission. Biggest single lever. Dated in Milestones below.

US-based judges cannot legally hold these tokens. Give them a spectator view and a video with real transactions. Never build the pitch around "join our league".

Solo build, 5 days plus one live week, Claude Code.

## Budget: $5 total

Hard cap, and it shapes the product rather than just the ops. Measured onchain 2026-09-06 at
0.006 gwei with ETH at $2,493: deploying both contracts is $0.066, registering all ten tokens is
$0.007, a three-pick draft is $0.010, and locking plus settling a league is $0.007. The entire
build, run several times over, stays under $0.15 of gas.

USDC is the only real spend, and it is not consumed: a $1 draft becomes $1 of stock. The burn is the
50 bps router fee plus 5 bps pool fee plus slippage, about 1% per round trip, so a $3 float can be
drafted and unwound many times.

Allocation: $0.75 of ETH to the deployer, $3 of USDC as the drafting float, $0.50 to the bot,
$0.50 to seed a visible pot, $0.25 spare.

This is why a stake is 25 cents and a gameweek costs a dollar. Lean into it: the Request for
Builders opens on emerging markets shut out by high fees and minimums. A game you can play for a
dollar is the answer to that, not a compromise forced by a small wallet. Never present the small
numbers apologetically.

## Tech stack (pinned 2026-09-06)

| Layer | Choice | Version |
|---|---|---|
| Chain | Base mainnet (B20 stocks exist only on mainnet, no testnet) | chainId 8453 |
| Contracts | Solidity + Foundry, OpenZeppelin | forge 1.7.1, OZ 5.x |
| Oracle | Chainlink tokenized equity feeds (8 decimals, 24/5, total-return) | proxy addresses below |
| Swaps | 0x Swap API v2, allowance-holder endpoints | header 0x-version: v2 |
| Wallet | @base-org/account (Base Account SDK, Sub Accounts, Spend Permissions) | 2.5.10 |
| Gas | CDP Paymaster (portal.cdp.coinbase.com) via wallet_sendCalls capability | n/a |
| Attribution | Builder Code (ERC-8021) from base.dev, dataSuffix capability | n/a |
| App | Next.js (App Router), React, TypeScript, Tailwind, mobile-first | 16.3.4 / 19.2.8 / 5.9.3 / 4.3.3 |
| Chain client | viem, @tanstack/react-query (no wagmi, see below) | 2.56.3 / 5.102.8 |
| AI | Claude API (@anthropic-ai/sdk), model claude-sonnet-5, server-side only, daily cached | latest |
| Runtime | Node 25.2.0, bun 1.3.14 | |
| Hosting | Vercel | |

Stack decisions taken during Phase 2:
- **wagmi dropped.** Sub Accounts and Spend Permissions are Base Account SDK APIs, and wagmi would only wrap the same EIP-1193 provider. The app uses `@base-org/account` for writes and a viem public client for reads.
- **TypeScript 5.9.3, not 7.x.** create-next-app pins ^5 and TS 7 is the Go rewrite. Not a risk worth taking mid-build.
- **tsconfig target raised to ES2022** so BigInt literals compile. Delete `tsconfig.tsbuildinfo` after changing it or the old target is cached.
- **Builder Code and paymaster are SDK-native**: `preference.attribution.dataSuffix` and `paymasterUrls` on `createBaseAccountSDK`. No manual calldata suffixing needed.

Runtime toggles:
- Runs in any browser. Primary demo surface is mobile Safari/Chrome; desktop must also work. Base Account SDK opens keys.coinbase.com in a popup, so never block popups in the demo browser.
- No database in the MVP. League state is onchain. Live prices from 0x price endpoint cached 30s in a route handler.

## Constants (Base mainnet)

VERIFIED ONCHAIN 2026-09-06 at block 50943159. All 13 B20 tokens: 8 decimals. All 13 Chainlink feeds: 8 decimals. USDC: 6 decimals.

NAV formula (USD with 6 decimals, matching USDC):
```
navUsd6 = usdcBalance + SUM ( balanceOf(token) * feedPrice ) / 1e10
where 1e10 = 10 ** (tokenDecimals 8 + feedDecimals 8 - usdcDecimals 6)
```
Do not hardcode 1e10 in the contract. Compute the scale per token from stored decimals so a future 18-decimal B20 still works.

LIQUIDITY, verified onchain 2026-09-06. The tradeable set is 10, not 13. Every listing with supply
has an Aerodrome Slipstream pool against USDC at tick spacing 10, under factory
`0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef`. Note that is NOT the published Slipstream factory
(`0x5e7BB104...`), whose router and quoter do not know these pools, which is why Gameweek routes
itself. Aerodrome v2 volatile pools exist for a couple of tickers but hold about half a cent, so
they are dust and must be ignored.

Live weekend gaps on 2026-09-06, pool price against the Chainlink Friday close: AMZNc +9.5%,
MSFTc +6.0%, SNDKc +2.9%, SPCXc +1.8%, TSLAc +0.9%, NVDAc +0.6%, AAPLc +0.5%, MSTRc +0.3%,
GOOGLc +0.2%, METAc +0.1%. Everything traded at a premium to the close. The thin pools show the
widest gaps, so depth has to be shown next to the number.

ZERO SUPPLY as of 2026-09-06: COINc, CRCLc and INTCc have totalSupply 0. Nothing minted, so no Aerodrome liquidity and 0x will not route them. Ship with the 10 live tickers and let scripts/prices-check.ts decide the final list. Re-check before the demo, supply can appear at any time.

Weekend behaviour confirmed live: on Sunday 06:21 UTC every feed's updatedAt was 33 to 40 hours old, holding the Friday close. The weekend gap badge premise is real.

USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (6 decimals)
B20 registry: 0x3f3E8cf41cdd3b1D118c16471aB0113DfDDd5CaD
0x API: https://api.0x.org, headers `0x-api-key`, `0x-version: v2`. Never hardcode the AllowanceHolder address, read `issues.allowance.spender` from the quote.

| Ticker | B20 token (8 dec) | Chainlink feed (8 dec, 0.5% dev, 24h hb) | Supply 09-06 |
|---|---|---|
| AAPLc | 0xb200000000000000000000C2e324d24d7eEcd1fb | 0x787f13dEa48Db0897CbCDD985de77809D837F988 | 6,194 |
| AMZNc | 0xb200000000000000000000d9192b6B456483C2E8 | 0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295 | 2,975 |
| COINc | 0xb200000000000000000000c85a31389D71F3ecfb | 0x408e44f504A7371a345F03a73dDC96A4b48e8aa7 | 0 SKIP |
| CRCLc | 0xB20000000000000000000019f6E7C675b73C2e4D | 0x0231cF2635D1E17bB5c2462cc7504Ba1fBd61f33 | 0 SKIP |
| GOOGLc | 0xb2000000000000000000002D0BA3164cc74f58B7 | 0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2 | 6,114 |
| INTCc | 0xB2000000000000000000004AFF16039bA04bdFBc | 0xAB657C39bac0D5886250D70849e2E3E008F2EECB | 0 SKIP |
| METAc | 0xb2000000000000000000008bC8786B856E61707C | 0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D | 2,229 |
| MSFTc | 0xB200000000000000000000Ab99cFa739E253872B | 0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c | 560 |
| MSTRc | 0xb2000000000000000000004884b426556b92883d | 0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a | 1,528 |
| NVDAc | 0xb20000000000000000000078ee7ce2fE4908108C | 0x04689a41629776563E6822F76f2e57D148d28513 | 13,731 |
| SNDKc | 0xb200000000000000000000397293Cb8cda9a10c5 | 0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA | 141 |
| SPCXc | 0xb2000000000000000000007b9fcbd005511aCBd5 | 0x6A634B235903C4ad6376892180d6fF8612e3Fa68 | 5,723 |
| TSLAc | 0xb2000000000000000000001e800a7f5189430cD0 | 0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4 | 1,727 |

All addresses and symbols above were confirmed with `cast call` on 2026-09-06. Key everything by token address, never by symbol (symbols are mutable).

## Architecture

```
Mobile or desktop browser
  └─ Next.js web app (app/)
       ├─ Base Account SDK: universal account + Sub Account (league wallet)
       │    wallet_sendCalls from the Sub Account, paymaster + dataSuffix capabilities
       ├─ /api/quote      -> 0x allowance-holder quote with swapFee params (server-side key)
       ├─ /api/nav/[id]   -> live NAV per member from 0x price endpoint, 30s cache
       ├─ /api/gap        -> DEX price vs Chainlink frozen close per ticker, 60s cache
       ├─ /api/coach      -> cached daily one-liners per ticker + "draft for me" picks (Claude, server-side)
       └─ /api/og/[id]    -> recap share card image
Base mainnet
  ├─ Gameweek.sol   create/join/lock/sponsor/settle, reads B20 balances + Chainlink
  ├─ 13 B20 tokens, 13 Chainlink feeds, USDC
  └─ 0x AllowanceHolder -> Aerodrome and other pools
Treasury EOA           receives 0x swapFee (USDC), pushes it into pots with sponsor()
Bot EOA                scripts/bot.ts drafts Sunday night: Claude picks 3, 0x swaps, joins every league it is invited to
```

Scoring: NAV(wallet) = USDC balance + sum of balanceOf(token) * feedPrice / 10^(tokenDec + feedDec - 6), i.e. USD with 6 decimals. Return = NAV_end × 1e4 / NAV_start in bps. Highest return wins the pot. NAV_start is taken at `lock()` and NAV_end at `settle()`, both at Friday 21:00 UTC when feeds are fresh, so weekend price gaps are captured accurately at both ends.

Pot: optional buy-in (default 0) + `sponsor()` top-ups. The treasury pushes accrued 0x fees into pots. Say this plainly in the README: fee routing is operated by us in v1, buy-ins and payouts are trust-minimised in the contract.

## Contract spec: contracts/src/Gameweek.sol

State
- `struct League { string name; uint64 startTime; uint64 endTime; uint32 stalenessTolerance; uint16 maxMembers; uint128 buyIn; uint128 pot; bool locked; bool settled; address[3] podium; address[] members; }`
- `mapping(uint256 => mapping(address => uint256)) navStart;`
- `address[] tokens; mapping(address => address) feedOf; mapping(address => uint8) tokenDecimals;` (owner-set, max 13 for now, extendable)
- `IERC20 usdc;`

Functions
- `createLeague(name, startTime, endTime, buyIn, stalenessTolerance, maxMembers) returns (uint256 id)` — anyone. `stalenessTolerance` default 2 hours for real leagues; demo leagues may pass 7 days so settlement works on a weekend. `maxMembers` 20 for friend leagues, up to 100 for the public league.
- `join(id)` — `msg.sender` is the league wallet (Sub Account, or the bot EOA). Pulls `buyIn` USDC via `safeTransferFrom` if > 0. Up to `maxMembers`. Only before `startTime`.
- `lock(id)` — anyone, after `startTime`. Requires fresh feeds (each `updatedAt >= block.timestamp - stalenessTolerance`). Records `navStart` for every member. Emits `Locked`.
- `sponsor(id, amount)` — anyone. Adds USDC to pot.
- `settle(id)` — anyone, after `endTime`, fresh feeds required. Computes returns, ranks members (highest bps, earliest joiner on tie), pays the pot 60/30/10 to the top 3. If fewer than 3 eligible members, unpaid shares go to first place. Emits `Settled(id, podium, returnsBps, pot)`.
- `forceSettle(id)` — anyone, after `endTime + 72h`, ignores staleness. Documented degradation path for a frozen feed (corporate action).
- `nav(address wallet) view returns (uint256 usd6)` — used by the app for cross-checks.
- `setToken(token, feed)` — owner. Reads `decimals()` from the token and the feed, stores both, and precomputes the NAV scale divisor 10^(tokenDec + feedDec - 6). Reverts if that exponent would be negative.
- Members with `navStart == 0` are skipped at settle.
- Buy-ins stay at 0 for this build. Buy-in money is locked until settlement, so it cannot be recycled between gameweeks, which a $5 float cannot afford.

Rules
- OpenZeppelin `Ownable`, `SafeERC20`, `ReentrancyGuard` on settle.
- Chainlink `latestRoundData()`: require `answer > 0`, `updatedAt != 0`, staleness check. Never settle on a frozen feed unless `forceSettle`.
- No `approve` to anything. The contract only ever `safeTransferFrom` for buy-ins and `safeTransfer` for payouts.
- Gas: settle loops members × tokens (≤ 100 × 13 = 1,300 balance reads + 13 feed reads). Fine on Base. Do not add unbounded arrays. Ranking is a single pass keeping the top 3, not a sort.

Tests (contracts/test/)
- Unit: mock B20 tokens (plain ERC20, 8 decimals to match mainnet, plus one 18-decimal token to prove the scale maths generalises) and mock feeds. Cover create/join/lock/settle/tie/forceSettle/staleness revert/no-members/buy-in/podium with 1, 2, 3 and 20 members/maxMembers paths.
- Fork: `forge test --fork-url $BASE_RPC_URL --match-contract Fork` reads real `decimals()`, `balanceOf` and `latestRoundData()` for all 13 tokens and asserts prices are non-zero.

## Repo structure

```
base/
  CLAUDE.md                  this file (rename to AGENTS.md before submission, never commit as CLAUDE.md)
  IDEAS.md                   research and idea stress test (delete before submission)
  HACKATHON_WORKFLOW.md      process doc (delete before submission)
  PHASE_0_CHECKLIST.md       pre-build prep (delete before submission)
  BUILD_GUIDE.md             day-by-day steps (delete before submission)
  README.md                  product page: pitch, architecture, live tx links, AI tools used
  contracts/                 Foundry project
    src/Gameweek.sol
    src/interfaces/AggregatorV3Interface.sol
    test/Gameweek.t.sol
    test/Fork.t.sol
    script/Deploy.s.sol      deploys + setToken for 13 tokens from a JSON config
    config/tokens.json       token/feed addresses (the table above)
  app/                       Next.js 16 web app
    app/page.tsx             my leagues + join by invite link (/join/[id])
    app/league/[id]/page.tsx leaderboard (Basenames, bot row, gap stat), pot, countdown, share
    app/league/[id]/receipts/page.tsx every swap with Basescan link + Builder Code suffix highlighted
    app/draft/[id]/page.tsx  swipe deck with gap badge + coach line, budget ring, buy/sell
    app/pot/[id]/page.tsx    fee transfers that funded the pot
    app/spectate/[id]/page.tsx read-only view for judges, no wallet needed
    app/api/quote/route.ts   0x proxy, adds swapFee params, server-side key
    app/api/nav/[id]/route.ts live NAV per member
    app/api/gap/route.ts     DEX vs frozen close per ticker
    app/api/coach/route.ts   cached daily blurbs + draft-for-me picks (Claude, server-side)
    app/api/og/[id]/route.tsx recap share card image (next/og)
    components/              SwipeDeck, Leaderboard, LeagueCard, Countdown, TxToast
    lib/sdk.ts               createBaseAccountSDK config, sub account helpers
    lib/zeroex.ts            quote/price fetchers
    lib/contracts.ts         ABIs + addresses, generated from Foundry out/
    lib/tokens.ts            13 tickers, logos, addresses, feeds
    lib/pricing.ts           NAV math shared with server
    lib/share.ts             invite link + share-to-X/WhatsApp text builders
    lib/basenames.ts         reverse-resolve Basenames for leaderboard rows
    lib/events.ts            MultiplierUpdated / Announcement log reader for the dividend badge
    lib/coach.ts             Claude prompts, JSON schema, static fallback blurbs for the demo
    .env.local               never committed
  scripts/
    settle.ts                calls lock/settle for a league from the treasury key
    sponsor.ts               moves treasury USDC into a pot
    bot.ts                   Sunday-night agent: Claude picks 3, 0x swaps from the bot EOA, logs picks
    prices-check.ts          hits 0x /price for all 13 tickers, prints which ones route
```

## Build phases

Phase 0 — Day-0 proofs (all must pass before writing product code)
- [ ] 0.1 Register Builder Code at base.dev, copy the dataSuffix value.
- [ ] 0.2 CDP: create project, get Paymaster URL for Base mainnet, get 0x API key, set env vars.
- [ ] 0.3 In a scratch Next page: Base Account SDK with `subAccounts: { creation: 'on-connect', defaultAccount: 'sub', funding: 'auto' }`. Connect, print universal + sub account addresses.
- [ ] 0.4 From the Sub Account, swap 2 USDC -> AAPLc via 0x allowance-holder quote in one `wallet_sendCalls` batch (approve spender from `issues.allowance.spender`, then `transaction.to/data`) with paymaster + dataSuffix capabilities. Save the tx hash. Confirm the fee landed in the treasury and the Builder Code suffix shows in calldata.
- [ ] 0.5 Transfer 0.001 AAPLc from the Sub Account to a throwaway contract and back. Confirms no policy gating on contract holders.
- [x] 0.6 DONE 2026-09-06. All 13 tokens and feeds verified: 8 decimals each, USDC 6. NAV divisor 1e10. COINc/CRCLc/INTCc have zero supply. Feeds held the Friday close 34h into the weekend.
- [ ] 0.7 Run the scratch page on a phone (Vercel preview URL) in Safari and Chrome. Confirm the Base Account popup, Sub Account creation and a sponsored swap all work on mobile. Record any popup-blocker or iOS quirks here.
- [ ] 0.8 Confirm 0x returns a quote for all 13 buyTokens on 8453 (script hitting /price for each).

Phase 1 — Contract
- [x] 1.1 DONE. Foundry project at contracts/, OpenZeppelin v5.1.0, IAggregatorV3 interface, config/tokens.json.
- [x] 1.2 DONE. Gameweek.sol written per spec.
- [x] 1.3 DONE. 38 unit tests and 6 fork tests green. Gas at 50 members: lock 1.72M, settle 578K.
- [ ] 1.4 Deploy. Fully scripted: `cd contracts && BASE_RPC_URL=... ./script/deploy-all.sh` preflights, deploys both contracts, verifies them, registers the 10 tradeable tickers in one call, writes app/.env.local and reads the result back. The only missing input is a funded keystore account. Record here: `GAMEWEEK=` `ROUTER=`
- [ ] 1.5 Create league #1 with a 7-day staleness tolerance (demo league) and league #2 with real Friday times.

Phase 2 — App shell
- [x] 2.1 DONE. Next.js 16 app at app/, Tailwind 4 theme, mobile-first shell, react-query provider, Base Account SDK wired with sub accounts on-connect.
- [x] 2.2 DONE. Connect flow resolves universal + sub account, league wallet card shows NAV split into cash and stocks, live board reads all 13 Chainlink feeds and labels market-closed and zero-supply listings.
- [ ] 2.3 Deploy to Vercel and confirm the connect popup works on a real phone. Needs a Vercel login. The passkey flow cannot be exercised headlessly.

Phase 3 — Trading
- [x] 3.1 DONE, differently. 0x is not used. GameweekRouter.sol swaps directly against the Slipstream pool and takes the 50 bps pot fee in the same call, so no API key and no HTTP hop sits in the demo's critical path. 17 tests including a fuzz run.
- [x] 3.2 DONE. SwipeDeck with pointer-event dragging and equivalent buttons, 10 draftable cards ordered by pool depth, $2/$5/$10 stepper, budget ring, picks list with undo. Verified in a real browser against live pool prices.
- [ ] 3.3 Batch is built (lib/execute.ts: one approve plus one swapExactIn per pick, atomic, paymaster capability attached) but unarmed until the router is deployed. The UI says "Router not deployed yet" rather than offering a button that cannot work.
- [ ] 3.4 Portfolio strip: holdings priced live from /api/nav.
- [x] 3.5 DONE. Gap is computed client-side from the pool's slot0 against the Chainlink close, so there is no API route to fail.
- [x] 3.6 DONE. Budget ring on the draft screen, trust strip and jurisdiction notice on the home screen.
- [ ] 3.7 Receipts tab: every swap for this league wallet with Basescan link and Builder Code suffix highlighted.

Phase 4 — League loop
- [ ] 4.1 Create league (name, buy-in, times) and join by invite link /join/[id].
- [ ] 4.2 Leaderboard: live return per member from /api/nav, onchain navStart, countdown to lock/settle.
- [ ] 4.3 lock/settle buttons (anyone can call) + scripts/settle.ts.
- [ ] 4.4 Pot display, sponsor flow from treasury, podium banner (60/30/10) after settle.
- [ ] 4.5 Basenames on every leaderboard row, hex fallback.
- [ ] 4.6 Pot page: list of fee transfers into the treasury and sponsor() calls into this pot.
- [ ] 4.7 Public open league created and pinned on the home page. maxMembers 100.
- [ ] 4.8 Spectator page: read-only league view with no wallet connect, linked from the README for judges.

Phase 5 — Ritual (only after Phase 4 is demoable end to end)
- [ ] 5.1 Sunday draft-night copy, countdowns, "weekend gap" badge showing DEX price vs Friday close.
- [ ] 5.2 Share card: "Gameweek 2, #2 in Lagos Bulls, +1.8%" as an OG image with share-to-X and WhatsApp buttons carrying the invite link.
- [ ] 5.3 Bot player: scripts/bot.ts joins every league the bot is invited to, drafts Sunday 20:00 UTC (Claude picks 3 with weights, 0x swaps from the bot EOA), leaderboard row shows a bot tag. Budget ≤ 50 USDC.
- [ ] 5.4 Coach card: one line per ticker generated daily and cached (Claude, server-side), static fallback file for the demo. "Draft for me" takes a one-sentence thesis and executes 3 swaps in one wallet_sendCalls batch. Labelled "information, not advice".
- [ ] 5.5 Dividend badge: read MultiplierUpdated events for held tokens, show "dividend applied" on the holding.
- [ ] 5.6 Stretch: email or web-push reminder for draft close and settle. Stretch: streak badge.

Phase 6 — Submission
- [ ] 6.1 README as product page with real tx hashes and Basescan links.
- [ ] 6.2 Cleanup: no console.log, no TODOs, .gitignore covers .env*, keystores, out/, broadcast/ secrets.
- [ ] 6.3 Rename CLAUDE.md -> AGENTS.md. Delete IDEAS.md, HACKATHON_WORKFLOW.md, PHASE_0_CHECKLIST.md, BUILD_GUIDE.md.
- [ ] 6.4 4 slides, sub-3-minute video, submit.

## Milestones (fill dates once the deadline is known)

| Date | What |
|---|---|
| D0 | Day-0 proofs done, contract deployed |
| D2 | Trading + league loop demoable end to end on a phone |
| Friday F1 21:00 UTC | Live league #1 locks with ≥ 8 real players + the bot. This Friday must be at least 8 days before the deadline |
| Sunday F1+2 | Draft night. Screenshots and screen recording captured |
| Friday F1+7 21:00 UTC | settle() on live league #1. Record tx hash, podium, volume attributed to the Builder Code |
| Deadline − 1 day | README with real numbers, video, AGENTS.md rename, submit |

Deadline: UNKNOWN. If the deadline is under 8 days away, drop the live week and run a 3-day demo league instead.

## Commands

Git (first, before any commit)
```
git init && git config user.name "<your name>" && git config user.email "<your email>"
```

Contracts
```
cd contracts
forge init --no-git .
forge install OpenZeppelin/openzeppelin-contracts
forge build
forge test -vvv
forge test --fork-url $BASE_RPC_URL --match-contract Fork -vvv
cast wallet import deployer --interactive
# two steps: forge cannot simulate B20 precompiles, so registration goes through cast
# one command: preflight, deploy both contracts, verify, register tokens, write app/.env.local
BASE_RPC_URL=... BASESCAN_API_KEY=... ACCOUNT=deployer ./script/deploy-all.sh

# or by hand
forge script script/Deploy.s.sol:Deploy --rpc-url $BASE_RPC_URL --account deployer --broadcast --verify --etherscan-api-key $BASESCAN_API_KEY
./script/register-tokens.sh 0xDeployedGameweekAddress
LEAGUE=0x... NAME="Lagos Bulls" START=<epoch> END=<epoch> TOLERANCE=7200 MAX_MEMBERS=20 \
  forge script script/Deploy.s.sol:CreateLeague --rpc-url $BASE_RPC_URL --account deployer --broadcast
cast call 0xb200000000000000000000C2e324d24d7eEcd1fb "decimals()(uint8)" --rpc-url $BASE_RPC_URL
cast call 0xb200000000000000000000C2e324d24d7eEcd1fb "balanceOf(address)(uint256)" <wallet> --rpc-url $BASE_RPC_URL
cast call 0x787f13dEa48Db0897CbCDD985de77809D837F988 "latestRoundData()(uint80,int256,uint256,uint256,uint80)" --rpc-url $BASE_RPC_URL
cast send $GAMEWEEK "setToken(address,address)" <token> <feed> --rpc-url $BASE_RPC_URL --account deployer
```

App
```
cd app
bunx create-next-app@latest . --ts --tailwind --app --src-dir=false --import-alias "@/*"
bun add @base-org/account viem wagmi @tanstack/react-query
bun dev
vercel                                  # preview URL for phone testing
vercel --prod
```

0x sanity check
```
curl -s -H "0x-api-key: $ZEROEX_API_KEY" -H "0x-version: v2" \
 "https://api.0x.org/swap/allowance-holder/price?chainId=8453&sellToken=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&buyToken=0xb200000000000000000000C2e324d24d7eEcd1fb&sellAmount=2000000&taker=<subAccount>"
```

Env vars (app/.env.local, never committed)
```
NEXT_PUBLIC_URL=
NEXT_PUBLIC_PAYMASTER_URL=
NEXT_PUBLIC_BUILDER_CODE_SUFFIX=
NEXT_PUBLIC_GAMEWEEK=
ZEROEX_API_KEY=
ANTHROPIC_API_KEY=
TREASURY_ADDRESS=
BOT_ADDRESS=
BASE_RPC_URL=
```
Server-only secrets: ZEROEX_API_KEY, ANTHROPIC_API_KEY. Treasury and bot keys live in the Foundry keystore and are used by scripts only, never by the app.

## Demo plan (what the judge sees, in order, under 90 seconds)

1. Open gameweek.xyz on a phone. "Gameweek 2 - Lagos Bulls", five members, live leaderboard, pot, countdown "settles Friday 21:00 UTC".
2. Tap Draft. Cards show the coach line and the weekend gap badge: NVDAc 0.6% over Friday close. Swipe right on NVDAc, TSLAc and MSTRc at $0.25 each. First swipe shows the one Base Account approval that funds the league wallet. Swipes two and three land with no prompt. Budget ring drains from $1.00.
3. Receipts tab: three Basescan links, Builder Code suffix highlighted, 0x fee visible in the treasury.
4. Back on the leaderboard: our Basename row moves, the bot is sitting at #2 with its tag.
5. Switch to the demo league that has already ended. Tap Settle. Transaction reads 13 Chainlink feeds, pays the pot in USDC to the winner. Show the winner's wallet: real stocks plus the pot.
6. Close on the share card: "I won Gameweek 2 in Lagos Bulls, +2.1%" with the invite link, posted to X.

Fallbacks: a pre-recorded 20-second clip of steps 2 to 5, pre-funded league wallets, a second league already locked so settle works on any day (7-day staleness tolerance), and pre-fetched quotes cached for 60 seconds if 0x is slow.

## Pitch script (60 seconds, spoken)

"Coinbase just put Apple, Nvidia and eleven other stocks on Base as real tokens. Fifty protocols let you trade them. Nobody has given people a reason to come back every week.

Gameweek is fantasy football for stocks, except the picks are real. You and your friends each fund a small league wallet. On Sunday night, while Wall Street is closed and Base is open, you draft three stocks by swiping. Those swipes are real swaps on Base, into your own wallet. All week a leaderboard ranks you by return. Friday at the close, a contract reads Chainlink, splits the pot across the top three, and the next gameweek opens.

There is a bot in every league, an agent with its own wallet that drafts on Sunday night. Beat it.

A whole gameweek costs a dollar. Twenty-five cents a pick, gas sponsored, so this works for someone in Lagos with a phone and no brokerage account, which is most of the people tokenized stocks were supposed to reach.

Under the hood every league wallet is a Base Account Sub Account funded by a Spend Permission, so there is one approval and then no popups, and the weekly cap is the responsible-gaming limit. Every swap carries our Builder Code and a 0x fee that funds the pots. Spot only, no leverage, nobody's principal is pooled.

We built the loop that makes people trade tokenized stocks every week. Gameweek."

## Things that burned us

- x.com is unreachable from every fetch tool here (402/403). Copy the quest post text into this file by hand.
- docs.base.org was reorganised in 2026 and many deep links redirect to the index. Fetch https://docs.base.org/llms.txt to find the current URL before trusting an old one.
- Farcaster mini app path was cut on day 0: manifest signing, Base App preview, and the unknown of Sub Accounts inside the Base App webview were not worth a day of a five-day build.
- Chainlink equity feeds hold the Friday close all weekend and freeze during corporate actions. Never settle or lock on a stale feed. Live weekend leaderboard must use 0x prices, not Chainlink.
- One B20 token is not one share. Dividends and splits change the multiplier. Chainlink total-return prices already include it, so NAV = balanceOf × feed price. Never multiply by the multiplier a second time.
- `approve()` on B20 is not policy gated. A successful approve does not guarantee the transfer. Test contract holding on Day 0.
- 0x: never approve the Settler contract, only the spender from `issues.allowance.spender`. `swapFeeToken` must be sellToken or buyToken. Max 1000 bps.
- Sub Account owner key lives in the user's browser storage. Trades are signed in the user's session, not by a server. Clearing site data loses the key; the universal account still owns the funds.
- Auto Spend Permissions prompt once on the first transaction that needs USDC from the universal account, then reuse the granted allowance. Do not describe the flow as "zero prompts", it is "one prompt, then none".
- Paymaster sponsorship needs the contract allowlist set in the CDP portal: Gameweek, USDC, the 0x AllowanceHolder.
- `forge script` simulates locally before it broadcasts, so a script that calls `setToken` (which reads `decimals()` from a B20 address) dies with `EvmError: OpcodeNotFound` even with --broadcast. Deploy and registration are therefore two steps: `forge script Deploy` for the contracts, then `./script/register-tokens.sh`, which uses one `cast send` of `setTokens` straight to the node. Ten separate `setToken` calls would mean ten password prompts and a contract that can end up half registered.
- forge-std JSON paths support `.listings[0].ticker` but not `.listings.length` or a `[*]` projection. config/tokens.json carries an explicit `count` field for that reason.
- B20 tokens are node precompiles, not deployed contracts. `cast code` on a B20 address returns a single placeholder byte. A live RPC executes them natively, but a Foundry fork has nothing to run, so every B20 call on a fork burns the gas limit and reverts. Fork tests must `vm.etch` an 8-decimal ERC20 at the B20 address; Chainlink feeds are ordinary contracts and work on a fork as-is. Anvil cannot simulate B20 at all. Verified and pinned by test_b20TokensHaveNoBytecode.
- `setToken` reads `decimals()` from the token, so in a fork test the etch must happen before the registration call, not after.
- `vm.expectRevert` claims the very next call. Reading a public constant like `league.MAX_MEMBERS()` inside the argument list consumes it and the test fails with "next call did not revert". Hoist those reads into locals first.
- No testnet has the B20 stocks. Everything is mainnet with small amounts. Deploy costs cents on Base.
- The public Base RPC throttles bursts, and viem reports a throttled batch as per-call failures that look exactly like reverts. A flatMap that drops failures silently blanks the whole board. lib/chain.ts `multicallResilient` retries only the failed entries; use it for every read.
- Do not spend an RPC call on something address ordering already tells you. A pool's token0 is just the lower address, so USDC (0x83...) is always token0 against a B20 (0xb2...).
- forge-std has no `.length` JSON path and no `[*]` projection, but `.listings[0].ticker` works.
- Next.js dev analytics fails in a sandboxed browser and puts a red issue badge on the dev overlay. `NEXT_TELEMETRY_DISABLED=1` keeps a judge's console clean.
- `next dev` writes its own app/AGENTS.md and app/CLAUDE.md. They are regenerated on every run, so commit them rather than fighting them. They are unrelated to this file.
- `react-hooks/set-state-in-effect` rejects the usual "set the clock after mount" pattern. Use `useSyncExternalStore` with a cached snapshot and a null server snapshot, which also removes the hydration mismatch.
- Turbopack walks up past the repo looking for a lockfile and finds one in the home directory. Pin `turbopack.root` in next.config.ts.
- Configure git identity before the first commit. An AI-attributed commit got a past submission marked down.

## Things NOT to do

- No leverage, perps, options, or up/down binaries. Spot swaps only.
- No pooled principal. Buy-ins are optional and default to 0. Pots come from fees and sponsors.
- No server-side signing of user trades. No custody of user keys.
- No logic keyed by ticker symbol. Addresses only.
- No `settle()` or `lock()` on a frozen feed. `forceSettle` only after 72 hours and only documented as degradation.
- No Chainlink for the live weekend leaderboard.
- No streaks, notifications, badges or AI features until Phase 4 is demoable end to end.
- No Farcaster mini app, MiniKit, manifest, or Base App preview work. Web app only. Revisit after submission if judges ask.
- No building an AMM, a lending market, or an index product. Glider, Aave and Aerodrome exist.
- No fake "submitted" screens. Every action a judge sees is a mainnet transaction with a hash.
- No committing CLAUDE.md, .env files, keystores, or the treasury key.
- No console.log, TODO, or commented-out code at submission.
- No Claude API call in the live demo path. Coach lines come from the daily cache or the static fallback file.
- No bot wallet balance above $0.50 USDC and 0.0001 ETH. No bot key outside the Foundry keystore.
- No league with a nonzero buy-in during this build. Buy-in money is locked until settlement and the float is too small to strand.
- No single transaction that spends more than $1 of USDC. The whole build has $5.
- No "join our league" ask to judges. Spectator page and video only.

## Status

Phase: 3 mostly done. Contract complete (44 tests green, not yet deployed). Draft loop built and working in a browser against live Aerodrome prices. GameweekRouter written and tested but not deployed. Next action: deploy Gameweek and GameweekRouter to Base mainnet, which needs a funded deployer key from PHASE_0_CHECKLIST.md, then a $2 live swap to prove the loop end to end. No 0x key is needed any more.
Deadline: UNKNOWN. Contract address: not deployed. Builder Code: not registered.
