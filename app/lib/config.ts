/** Base mainnet. The tokenized stocks exist on no testnet, so there is no other network. */
export const CHAIN_ID = 8453;

export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const USDC_DECIMALS = 6;

/** Public RPC is fine for reads. Set NEXT_PUBLIC_RPC_URL to a dedicated node before the demo. */
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://mainnet.base.org";

/** Set once the contract is deployed. Until then the league views show an empty state. */
export const GAMEWEEK = (process.env.NEXT_PUBLIC_GAMEWEEK ?? "") as `0x${string}` | "";

/** GameweekRouter, which executes draft picks and takes the fee that funds pots. */
export const GAMEWEEK_ROUTER = (process.env.NEXT_PUBLIC_GAMEWEEK_ROUTER ?? "") as
  | `0x${string}`
  | "";

/** Sunday Bot's wallet, so the table can mark it. It plays like anyone else, it is just not human. */
export const BOT_ADDRESS = (process.env.NEXT_PUBLIC_BOT_ADDRESS ?? "").toLowerCase();

/** ERC-8021 Builder Code suffix from base.dev, attached to every transaction we send. */
export const BUILDER_CODE_SUFFIX = process.env.NEXT_PUBLIC_BUILDER_CODE_SUFFIX as
  | `0x${string}`
  | undefined;

/** CDP paymaster endpoint, so drafting costs the player no gas. */
export const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL;

export const APP_NAME = "Gameweek";
export const APP_URL = process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";

export const EXPLORER = "https://basescan.org";
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`;
