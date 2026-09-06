# PHASE_0_CHECKLIST — Gameweek

Everything to have in place before opening Claude Code for Phase 1. Every box should be checkable with certainty. Delete this file before submission.

## 0. The quest itself (do first, it changes the plan)

- [ ] Open the @base post (x.com/base/status/2091918568019374542) and the @buildonbase article (x.com/buildonbase/article/2094829597372088619) in a logged-in browser. No tool here can fetch them.
- [ ] Copy into CLAUDE.md "What we are building": deadline with timezone, submission link or form, judging criteria, team and eligibility rules, whether a video or live URL is required, anything about Builder Codes or Base App.
- [ ] Count days to the deadline. 8 or more: keep the live week in Milestones and fill the Friday dates. Fewer: switch Milestones to a 3-day demo league and note it.
- [ ] Confirm you are an eligible non-US person for Coinbase Tokenized Stocks (Regulation S offering). Every test player must be too. They will hold real securities.

## 1. Accounts and API keys

Coinbase Developer Platform (portal.cdp.coinbase.com)
- [ ] Create a project named `gameweek`.
- [ ] Onchain Tools -> Paymaster -> enable Base Mainnet. Copy the RPC URL into `NEXT_PUBLIC_PAYMASTER_URL`.
- [ ] Set Paymaster per-user limit (suggest $1 per user per day) and a global cap (suggest $20). Contract allowlist gets filled in Phase 1 after deploy: Gameweek, USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, and the 0x AllowanceHolder address returned in `issues.allowance.spender`.
- [ ] Node -> Base Mainnet RPC URL. Copy into `BASE_RPC_URL`. Do not rely on the public `https://mainnet.base.org` endpoint for fork tests, it rate-limits.
- [ ] Optional: apply for Base gas credits from the Paymaster page.

0x (dashboard.0x.org)
- [ ] Create an app, copy the API key into `ZEROEX_API_KEY`.
- [ ] Prove it works (replace the taker with any address):
```
curl -s -H "0x-api-key: $ZEROEX_API_KEY" -H "0x-version: v2" "https://api.0x.org/swap/allowance-holder/price?chainId=8453&sellToken=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&buyToken=0xb200000000000000000000C2e324d24d7eEcd1fb&sellAmount=2000000&taker=0x0000000000000000000000000000000000000001" | jq .
```
  Success: JSON with `buyAmount` > 0 and `liquidityAvailable: true`.

base.dev
- [ ] Sign in, Settings -> Builder Code -> register. Copy the exact dataSuffix hex into `NEXT_PUBLIC_BUILDER_CODE_SUFFIX`.
- [ ] Bookmark the checker: builder-code-checker.vercel.app. You will paste your first tx hash into it in Phase 0.4.

Basescan (basescan.org)
- [ ] Account + API key for `forge --verify`. Copy into `BASESCAN_API_KEY` in your shell profile, not the repo.

Anthropic (console.anthropic.com)
- [ ] API key into `ANTHROPIC_API_KEY`. Load $5 of credit. Model for coach and bot: `claude-sonnet-5`.

Vercel
- [ ] Account exists. `bun add -g vercel && vercel login` succeeds.

GitHub
- [ ] Create an empty public repo `gameweek`. Do not push anything until section 2's git identity step is done.

## 2. Wallets and credentials

Read the safety block before creating anything.

Safety
- Private keys go into the Foundry keystore only (`~/.foundry/keystores`, outside the repo). Never into a file in the repo, never into the Claude Code chat, never into `.env`.
- Every wallet below holds small amounts. Total at risk across the build: about 150 USDC and 0.02 ETH.
- The Base Account (passkey wallet) has no seed phrase. Turn on iCloud Keychain or Google Password Manager sync before creating it, or you can lose it with the device.
- `.gitignore` must contain: `.env*`, `contracts/broadcast/**/dry-run/`, `contracts/cache/`, `contracts/out/`, `node_modules/`, `.next/`, `*.key`, `*.json.bak`.

Deployer (deploys the contract, runs setToken)
- [ ] `cast wallet new` in a terminal, copy the private key, then `cast wallet import deployer --interactive` and paste it. Clear the terminal (`clear && history -c` in zsh: `clear; history -p`).
- [ ] Fund with 0.01 ETH on Base. Deploy plus 13 setToken calls costs cents; this is headroom.
- [ ] `cast wallet address --account deployer` prints the address. Write it here: `DEPLOYER=`

Treasury (receives the 0x swap fee, calls sponsor())
- [ ] Same steps, keystore name `treasury`. Fund 0.003 ETH. Write it here and in `TREASURY_ADDRESS`: `TREASURY=`

Bot (the agent player, swaps directly as an EOA)
- [ ] Same steps, keystore name `bot`. Fund 0.005 ETH and 50 USDC. Write it here and in `BOT_ADDRESS`: `BOT=`

Player 1 (you)
- [ ] Base Account created with a passkey on your phone. It is created the first time you connect to the Phase 0 scratch page, or at any Base Account site. Write the universal address: `PLAYER1=`
- [ ] Fund the universal account with 60 USDC on Base. League wallets pull from it through the Spend Permission.

Player 2 (second real wallet for the leaderboard)
- [ ] A second passkey identity: a different browser profile with a different passkey provider, a second device, or a friend who is eligible. Fund 20 USDC. `PLAYER2=`

Getting USDC and ETH onto Base
- [ ] Withdraw from any exchange that supports the Base network (Coinbase, Binance, Bybit, OKX). Network must say "Base", not Ethereum or Arbitrum. Send a $2 test first.
- [ ] Confirm on basescan.org that each wallet shows the expected balance.

Git identity (before the first commit, always)
- [ ] `git config --global user.name "<your name>"` and `git config --global user.email "<your email>"`. `git config --global -l | grep user` shows both.

## 3. Tools to install

Already on this machine (verified 2026-09-06): Node 25.2.0, bun 1.3.14, Foundry forge 1.7.1.

- [ ] `foundryup` to refresh forge, cast and anvil. `forge --version` still 1.7.x or newer.
- [ ] `git --version` prints. `jq --version` prints, else `brew install jq`.
- [ ] `bun add -g vercel`. `vercel --version` prints.
- [ ] Phone: Safari (iOS) or Chrome (Android) with pop-ups allowed for your Vercel domain. Settings -> Safari -> Block Pop-ups off, or Chrome site settings.
- [ ] Screen recording ready: iOS Control Center recorder, or QuickTime with the phone on a cable for crisp demo footage.
- [ ] Two browser profiles on the laptop for two-player testing on desktop.

## 4. Documentation and repos to read (what to extract from each)

Base
- [ ] docs.base.org/base-chain/asset-issuance/tokenized-stocks-on-base. Re-check all 13 token addresses against the table in CLAUDE.md. Note which contract emits `MultiplierUpdated` and `Announcement` (token or registry) for lib/events.ts.
- [ ] docs.base.org/specifications/b20/reference/interfaces/ib20. Confirm `balanceOf` is raw units and note `decimals()` semantics.
- [ ] docs.base.org/sdks/base-account/improve-ux/sub-accounts. Extract the `createBaseAccountSDK` sub-account config and the `wallet_sendCalls` shape with `from: subAccount`.
- [ ] docs.base.org/sdks/base-account/improve-ux/spend-permissions. Extract `requestSpendPermission` params for the explicit weekly cap variant and `prepareSpendCallData`.
- [ ] Base Account paymaster capability page (search llms.txt for "paymasterService"). Extract the exact capability key name for `wallet_sendCalls`.
- [ ] docs.base.org/specifications/builder-codes/overview. Extract the `dataSuffix` capability shape.
- [ ] Basenames docs (search llms.txt for "Basenames" or "basename resolution"). Extract the L2 resolver address or the viem call for reverse resolution. Fallback plan: OnchainKit Identity component.
- [ ] If any docs.base.org deep link redirects to the index, fetch docs.base.org/llms.txt and find the current URL.

Chainlink
- [ ] docs.chain.link/data-feeds/tokenized-equity-feeds/coinbase. Extract the staleness guidance and the weekend behaviour in their words for the README.
- [ ] Verify one feed live on a weekday:
```
cast call 0x787f13dEa48Db0897CbCDD985de77809D837F988 "latestRoundData()(uint80,int256,uint256,uint256,uint80)" --rpc-url $BASE_RPC_URL
```
  Success: second value is AAPL price × 1e8, fourth value (updatedAt) is within the last 24 hours during market hours.
- [x] DONE 2026-09-06: all 13 tokens and feeds verified onchain, 8 decimals each. See CLAUDE.md Constants.
- [ ] Verify a token:
```
cast call 0xb200000000000000000000C2e324d24d7eEcd1fb "decimals()(uint8)" --rpc-url $BASE_RPC_URL
cast call 0xb200000000000000000000C2e324d24d7eEcd1fb "symbol()(string)" --rpc-url $BASE_RPC_URL
```
  Write the decimals value into CLAUDE.md Constants.

0x
- [ ] docs.0x.org/evm/0x-swap-api/guides/swap-tokens-with-0x-swap-api. Extract the allowance-holder quote flow and `issues.allowance` handling.
- [ ] docs.0x.org/evm/0x-swap-api/guides/monetize-your-app-using-swap. Extract `swapFeeRecipient`, `swapFeeBps`, `swapFeeToken` rules (fee token must be sell or buy token).
- [ ] github.com/0xProject/0x-examples, the swap v2 allowance-holder example. Copy the approve-then-swap pattern.

Paymaster
- [ ] docs.cdp.coinbase.com/paymaster quickstart. Extract allowlist setup and the sponsored `wallet_sendCalls` example.

Anthropic
- [ ] docs.claude.com Messages API and structured output. Extract how to force JSON for the coach and bot outputs.

Next.js
- [ ] `next/og` ImageResponse docs for the recap share card.

Repos to skim
- [ ] github.com/coinbase/spend-permissions (contracts and accounting doc).
- [ ] github.com/base/account-sdk examples folder.

## 5. Risk parameters to decide before any code

Fill the right column. Defaults are recommendations.

| Parameter | Default | Decision |
|---|---|---|
| 0x swap fee | 50 bps, taken in USDC | |
| Slippage | 100 bps, 150 for thin tickers | |
| Default league budget | 20 USDC | |
| Swipe sizes | 2 / 5 / 10 USDC | |
| Minimum trade | 1 USDC | |
| Friend league maxMembers | 20 | |
| Public league maxMembers | 100 | |
| Payout split | 60 / 30 / 10 | |
| Buy-in | 0 by default, toggle, max 10 USDC | |
| Staleness tolerance, real league | 2 hours | |
| Staleness tolerance, demo league | 7 days | |
| forceSettle delay | 72 hours | |
| Lock and settle time | Friday 21:00 UTC | |
| Weekly Spend Permission cap shown to users | 20 to 100 USDC, UI hard max 250 | |
| Funding mode | Auto Spend Permissions first; switch to explicit `requestSpendPermission` weekly cap only if it costs under 2 hours | |
| Bot budget and sizing | 50 USDC total, 3 equal-weight picks, temperature 0 | |
| Bot draft time | Sunday 20:00 UTC | |
| Ticker list | 10 live (COINc, CRCLc, INTCc have zero supply, drop them) minus any failing prices-check | |
| Treasury sponsor policy | 100% of accrued fees into that week's leagues, split by member count | |
| Coach refresh | Once per day at 06:00 UTC, cached in a JSON file, static fallback for the demo | |
| Data stored offchain | None. No accounts, no emails | |

## 6. Content to pre-write (paste into lib/coach.ts and copy files later)

- [ ] Coach system prompt. Draft: "You write one factual sentence per ticker about the coming trading week: scheduled earnings, product events, index changes, macro dates. Max 18 words. No recommendations, no price targets, no adjectives about the stock. Output JSON mapping ticker to sentence for exactly these tickers: [list]."
- [ ] Draft-for-me prompt. Input: user thesis (one sentence), the 13 tickers with current gap %, weekend flag. Output JSON: three tickers, integer weights summing to 100, one factual sentence each. Rules: only the provided tickers, never exceed the user's budget, never suggest leverage.
- [ ] Bot prompt. Persona "Sunday Bot". Same output schema as draft-for-me, thesis fixed to "diversified across the three largest names by 0x liquidity", temperature 0.
- [ ] Static fallback: 13 one-liners written the day before the demo from public earnings calendars. Saved as lib/coach-fallback.json.
- [ ] Trust strip: "Spot only. Your wallet. Your stocks. Weekly cap set by you."
- [ ] Jurisdiction notice: "Coinbase Tokenized Stocks are available only to eligible persons outside the United States. By drafting you confirm you are eligible. Information shown is not investment advice."
- [ ] Onboarding, 3 screens, one sentence each: what a league is, what a league wallet is, when it locks and settles.
- [ ] Share card copy: "{name} is #{rank} in {league} · {return}% · picks: {A} {B} {C} · gameweek.xyz/join/{id}".
- [ ] Demo league names: "Lagos Bulls" (friends), "Sunday Public" (open).
- [ ] README skeleton headings: pitch, how a week works, architecture diagram, what is onchain, live numbers, tx links, AI tools used, run it yourself.
- [ ] Submission tweet, under 280 characters, with the spectator link.

## 7. Demo target (see it before building it)

Phone, portrait, 90 seconds, no narration needed:
1. Home: "Lagos Bulls · week 2 · pot $23.40 · settles Fri 21:00 UTC" with a five-row leaderboard, Basenames, one row tagged BOT.
2. Draft: a card for NVDAc with the coach line and a green "0.6% under Friday close" badge. Swipe right, one Base Account approval sheet, done. Two more swipes with no sheet. A budget ring drains from $20 to $0.
3. Receipts: three rows, each with a Basescan link and the Builder Code suffix highlighted in the calldata.
4. Leaderboard: your Basename row moves up; the bot sits at #2.
5. Demo league already ended: tap Settle, a transaction reads 13 feeds, podium banner shows 60/30/10, USDC lands in three wallets.
6. Share card rendered, posted to X with the invite link.

Assets to pre-capture the week before: a 20-second screen recording of steps 2 to 5, Basescan screenshots of a swap with the suffix and of a settle transaction, a Sunday screenshot of the gap badges while feeds are frozen.

## 8. Final sanity check (all yes before Phase 1)

- [ ] Deadline, submission link and judging criteria are in CLAUDE.md. Milestones have real dates.
- [ ] `cast wallet list` shows `deployer`, `treasury`, `bot`.
- [ ] Balances on basescan: deployer ≥ 0.01 ETH, treasury ≥ 0.003 ETH, bot ≥ 0.005 ETH and 50 USDC, Player 1 universal account ≥ 60 USDC, Player 2 ≥ 20 USDC.
- [ ] The 0x curl returns `liquidityAvailable: true` for AAPLc.
- [ ] `cast call decimals()` on AAPLc returns a number and it is written in CLAUDE.md.
- [ ] The Chainlink call returns a positive price with a recent `updatedAt` on a weekday.
- [ ] Builder Code suffix is in `.env.local` and matches base.dev exactly.
- [ ] Paymaster URL and Base RPC URL are in `.env.local`. 0x and Anthropic keys are in `.env.local` and nowhere else.
- [ ] `.gitignore` written and `git status` shows no `.env*`.
- [ ] `git config --global -l | grep user` shows your name and email.
- [ ] Phone allows pop-ups; passkey sync is on.
- [ ] Section 5 table has a decision in every row.
- [ ] Coach, draft-for-me and bot prompts are saved as text files.
- [ ] Two eligible test players have said yes and know draft night is Sunday.
