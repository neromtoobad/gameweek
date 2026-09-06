# Base Builder Quest: Tokenized Stocks — ideas and stress test

Date: 2026-09-06. Prize pool $5,000. Brief: build a project that helps people trade or use Coinbase Tokenized Stocks on Base.

## 1. What we know (verified)

Assets
- 13 tickers live as B20 tokens: AAPLc, AMZNc, COINc, CRCLc, GOOGLc, INTCc, METAc, MSFTc, MSTRc, NVDAc, SNDKc, SPCXc, TSLAc. Registry contract 0x3f3E8cf41cdd3b1D118c16471aB0113DfDDd5CaD. Addresses in docs.base.org/base-chain/asset-issuance/tokenized-stocks-on-base.
- B20 = ERC-20 + issuer controls, implemented as a Base precompile. Works with every ERC-20 wallet, router and protocol.
- Secondary market (hold, transfer, DEX trade) is permissionless. Only mint/redeem is KYC'd (Authorized Participants). Optional allowlist/blocklist policies exist; approve() is not policy gated, so a transfer can still fail. Test with a real transfer before relying on it.
- Corporate actions and cash dividends are applied through an onchain multiplier, not cash payouts. 1 token != 1 share forever. Use scaledBalanceOf(), index MultiplierUpdated and Announcement events.
- Prices: Chainlink feeds per ticker, 24/5, hold last close on weekends, freeze during corporate actions. Always check updatedAt. Token price = underlying price x multiplier (WAD 1e18). DEX price (Aerodrome) is live 24/7 and can diverge from the feed on weekends.
- Non-US eligible jurisdictions only. Fine for us as builders and demo users.

Distribution and Base primitives worth stacking
- Base App mini apps (MiniKit) for social distribution inside the feed.
- Base Account: passkey smart wallet, Sub Accounts, Spend Permissions (recurring allowances with period + start time, built for subscriptions and DCA).
- Coinbase Onramp API (headless, 60+ fiat currencies, USDC on Base free).
- 0x / 1inch / KyberSwap / CoW APIs for swaps; Aerodrome for pools. Builder Codes (ERC-8021) for attribution of the volume we route.

## 2. What is already built (do not rebuild)

- Liquidity and trading: Aerodrome pools ($103M volume in first days), 0x, 1inch, KyberSwap, CoW Swap, Matcha, Base App trading. Bankr: AI agent that manages Aerodrome LP positions by natural language.
- Lending and credit: Aave, Morpho, Euler. Carry-trade vaults from 628 Labs, Superform, IPOR, Portals.
- Derivatives: Wasabi perps and options.
- Personalized portfolios: Glider (custom auto-rebalanced baskets, no wallet needed) and Bitwise Automated Token Portfolios on Coinbase stocks via Glider. Also Glider x Ondo. This category is owned by funded teams.
- Analytics: SoSoValue, Treasures, ZyfAI. Bots: Sigma, Banana Gun, Maestro.
- Emerging-market brokerage: Luno and Blockchain.com sell tokenized US stocks to Nigerians, but on xStocks/Ondo and custodial, not on Base.
- Memestocks: exist on BNB Chain (memestock/GMEB pairs on PancakeSwap). Nothing found on Base yet.
- Gifting and rewards: nothing found. Open lane.
- Prediction/conditional markets on tokenized stocks: nothing found. Open lane but heavy.

## 3. Ideas

### A. StockGift — send a tokenized stock as a gift, optionally time-locked  (RECOMMENDED)
Personal gifting from the RFB, nothing shipped yet. Sender picks a ticker and amount, writes a note, optionally sets an unlock date (birthday, graduation, "when you turn 18"). App swaps USDC into the stock via 0x, deposits it into an escrow contract, and produces a claim link or Farcaster cast. Recipient opens the link, creates a Base Account with a passkey if they do not have one, and claims once unlocked. Dividends accrue automatically through the multiplier while locked.
- Onchain: GiftVault contract (create, claim, reclaim-if-unclaimed, unlock timestamp, message hash). Real B20 transfers on mainnet.
- Demo moment: a real NVDAc gift claimed live from a second phone, showing the share balance land in a wallet that did not exist 30 seconds earlier.
- Stack: Next.js mini app with MiniKit, Base Account SDK, 0x Swap API, viem/wagmi, Foundry for the vault.
- Stretch (only if the loop above closes on day 1): corporate mode. Upload a CSV of customer addresses or emails, fund once, distribute stock rewards in a batch. That covers the RFB's "Corporate rewards" bullet with the same contract.
- Risks: policy gating could block transfers to or from a contract. Aave and Morpho hold these tokens, so contracts can hold them, but test with $5 first. Claim links must not embed private keys; use an onchain claim by recipient address, or a signed voucher redeemed with the recipient's wallet.

### B. AutoStock — self-custodial recurring buys (DCA) with Spend Permissions
Neobrokerage-lite. User onramps fiat to USDC (Coinbase Onramp), grants a Spend Permission of, say, 20 USDC per week, and an executor buys a chosen ticker or a 2 to 3 stock basket every period via 0x. User keeps custody the whole time. Glider does auto portfolios but abstracts wallets away; this is the wallet-native version.
- Onchain: Spend Permission grant, weekly executor transactions, real fills. Every run is a tx hash a judge can check.
- Demo moment: show the schedule, trigger a run, watch USDC leave and AAPLc arrive with no signature prompt.
- Risks: executor is a hosted cron; that is an offchain dependency in the critical path. Pre-fund and pre-run before the demo. Onramp KYC flows are hard to demo live; show USDC already in the account.

### C. StockBack — pay with USDC, get cashback in stock
Corporate rewards from the RFB. A checkout button (Base Pay / x402) where the merchant pays 1 to 3 percent of each order to the customer as a fraction of a tokenized stock instead of points. Merchant dashboard sets the ticker and rate; a RewardRouter contract swaps and pays on each settled order.
- Demo moment: buy a $10 item, receive 0.00xx NVDAc in the same block.
- Risks: needs a fake merchant storefront, and the pitch depends on judges believing merchants want this. Good second idea, weaker single-moment demo than A.

### D. FairValue — premium/discount and corporate-action tracker
Infra utility. Index MultiplierUpdated and Announcement events, show current multiplier, dividend history, and live DEX price vs Chainlink x multiplier for every ticker, with weekend premium/discount alerts. The docs spend most of their words on exactly this confusion.
- Cheap to build, genuinely useful, low wow. Better as a feature inside A or B (show "fair value" next to the gift) than as a standalone entry.

### E. Earnings markets — binary markets on tokenized stocks settled by Chainlink
"Will NVDAc close above X after earnings" with Chainlink settlement, or conditional markets that pay out in the stock itself. Squarely in the RFB's memes-and-agents section and nobody has built it.
- Ambitious: oracle staleness rules, resolution edge cases, liquidity. This is the one the workflow says to kill for a solo build. Keep it for a later grant pitch.

## 4. Stress test (workflow step 2)

| | A StockGift | B AutoStock | C StockBack | D FairValue | E Earnings mkts |
|---|---|---|---|---|---|
| 90s demo, no narration | yes | yes | yes | no | no |
| Single memorable moment | claim on a fresh wallet | buy with no prompt | cashback in stock | none | market resolves |
| Breaks live? | swap API; pre-fund fallback | cron + swap; pre-run | swap; pre-fund | RPC only | oracle, liquidity |
| Real onchain action | yes | yes | yes | read-only | yes |
| Already shipped by someone | no | partly (Glider, custodial) | no | partly (analytics) | no |
| Solo build in 3 to 5 days | yes | yes | yes | yes | no |
| Base primitives stacked | B20 + Base Account + MiniKit + 0x | B20 + Spend Permissions + Onramp + 0x | B20 + Base Pay/x402 + 0x | B20 + Chainlink | B20 + Chainlink |

Recommendation: build A. Fold a tiny piece of D into it (show fair value and next unlock in the gift card). Keep B as the fallback if the escrow transfer test fails on policy grounds, because B never needs a contract to hold the stock.

## 5. Unknowns to resolve before writing CLAUDE.md

- Deadline, timezone, submission form and judging criteria. Not in any indexed page; x.com blocks fetching. Read the @base and @buildonbase posts directly and paste the details here.
- Whether entries must be Base App mini apps or any web app qualifies.
- Confirm a B20 transfer into and out of a fresh contract succeeds on mainnet (policy gating). Do this on day 0 with $5 of AAPLc.
- Whether Builder Codes attribution is expected or scored.
- Which quote asset the Aerodrome pools use (USDC assumed) and the 0x API's support for the B20 addresses.

## 6. Sources

- Base docs, Tokenized Stocks on Base: https://docs.base.org/base-chain/asset-issuance/tokenized-stocks-on-base
- Base stocks page (partner list): https://www.base.org/stocks
- Chainlink tokenized equity feeds: https://docs.chain.link/data-feeds/tokenized-equity-feeds/coinbase
- Launch coverage: https://www.coindesk.com/business/2026/08/24/coinbase-debuts-tokenized-stocks-on-base-network-joining-race-to-bring-equities-on-blockchain
- Six more tickers added: https://crypto.news/coinbase-adds-six-tokenized-stocks-after-228m-debut
- Nine DeFi integrations at launch: https://thedefiant.io/news/defi/coinbase-launches-tokenized-stocks-on-base
- Aerodrome volume: https://primexbt.com/news/aerodromes-tokenized-stock-pools-draw-103-million-in-volume-within-days-of-launc/
- Bankr LP agent: https://chainwire.org/2026/08/28/bankr-launches-agent-powered-liquidity-for-tokenized-stocks-on-aerodrome/
- Carry trade vaults: https://cryptobriefing.com/base-carry-trade-vaults-coinbase-tokenized-stocks/
- Glider + Bitwise portfolios: https://www.coindesk.com/business/2026/08/25/bitwise-turns-coinbase-s-tokenized-stocks-into-automated-ai-robotics-and-tech-portfolios
- Glider + Ondo: https://cointelegraph.com/news/glider-ondo-launch-platform-for-custom-tokenized-stock-portfolios
- Memestock pairs on BNB: https://finance.yahoo.com/markets/crypto/articles/crypto-next-meme-coin-war-101228037.html
- Luno tokenized stocks in Nigeria: https://www.mariblock.com/luno-expands-access-to-tokenized-us-stocks-to-nigeria/
- Base Account Sub Accounts and Spend Permissions: https://docs.base.org/base-account/improve-ux/sub-accounts
- Coinbase Onramp: https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview
- Mini apps: https://docs.base.org/cookbook/converting-customizing-mini-apps
- 1inch integration: https://1inch.com/blog/post/coinbase-tokenized-stocks
- Request for Builders (needs login): https://x.com/buildonbase/article/2094829597372088619

## 7. Addiction pass (2026-09-06, second round)

Goal changed: not "help people use stocks" but "make people trade stocks repeatedly". Volume is what Base measures through Builder Codes.

What makes trading habit-forming (Robinhood, Polymarket, fantasy sports, pump.fun, Duolingo):
- Frequent small decisions with fast, visible feedback.
- A scoreboard among people you know.
- A recurring deadline (daily/weekly) so there is always a reason to come back.
- Variable rewards on top of the expected one.
- Zero friction on the action itself. Every wallet popup kills the loop.

### F. Gameweek (working name) — fantasy league where the picks are real stocks
Weekly leagues of 3 to 20 friends inside Base App. Each member funds a small league wallet (say $20), drafts 3 of the 13 tickers by swiping, and the app buys them for real. Live leaderboard all week by wallet value. Sunday night is draft night because TradFi is closed and onchain is the only place the picks can be placed; Monday's open settles who read the weekend right. Winner takes the prize pot. Re-draft every week, which forces swaps, which is the volume.

Loop: push "draft closes in 2h" -> swipe picks (no signature) -> leaderboard moves all week -> prize + streak + rank -> next week's draft.

Technical insight that makes it work: each member's league wallet is a Base Account Sub Account funded by a Spend Permission from their main account. The app trades inside it without popups, the user keeps custody, the score is the Sub Account's USDC value read from Chainlink x multiplier, and the weekly cap on the Spend Permission is also the responsible-gaming cap.

Prize pot funding, two options: (1) 0x affiliate fee on every swap routed with our Builder Code, so the pot is self-funding and nobody's principal is at risk; (2) optional USDC buy-in per league. Ship (1); make (2) a toggle and mention the regulatory line in the pitch.

Guardrails to say out loud in the pitch: spot only, no leverage, no 5-minute binaries, weekly cap set by the user, real shares in the user's own wallet. Robinhood was fined for gamification; judges from Coinbase will notice if we ignore this.

Scope for solo build: League contract (create, join, snapshot start, settle, pay pot) + Sub Account trading via 0x + leaderboard + swipe draft screen. Weekend mode is a copy change, not code. Streaks and mystery stock drops are stretch.

Ranked alternatives for the same goal:
- Swipe-to-trade feed (Tinder for stocks) with $1 swipes via Spend Permissions. Strongest single UI, but only 13 tickers so the feed repeats; needs event cards (news, weekend gap, friend trades) to stay fresh. Works as the draft screen inside F.
- Trades as casts with a one-tap copy button, most-copied leaderboard. Social status loop, good volume multiplier, weaker weekly ritual.
- Daily $1 buy streak. Cheap layer, weak alone.
- 5-minute up/down on Chainlink prices. Binary betting, feed updates on 0.5% moves so it does not even work. Skip.
