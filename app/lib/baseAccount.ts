"use client";

import { createBaseAccountSDK, type ProviderInterface } from "@base-org/account";
import { ensureBaseNetwork, getActiveWalletId, getInjectedProvider } from "./wallets";
import {
  APP_NAME,
  APP_URL,
  BUILDER_CODE_SUFFIX,
  CHAIN_ID,
  PAYMASTER_URL,
} from "./config";

/**
 * One SDK instance for the tab.
 *
 * Sub Accounts are the league wallets. `creation: 'on-connect'` provisions one the first time a
 * player connects, `defaultAccount: 'sub'` makes it the account transactions run from, and
 * `funding: 'spend-permissions'` lets it draw on the player's main Base Account balance. The net
 * effect is one approval on the first draft pick and none on the rest, which is what makes swiping
 * feel like a game instead of a wallet.
 */
let sdk: ReturnType<typeof createBaseAccountSDK> | null = null;

export function getSdk() {
  if (typeof window === "undefined") {
    throw new Error("Base Account SDK is browser only");
  }
  if (!sdk) {
    sdk = createBaseAccountSDK({
      appName: APP_NAME,
      appLogoUrl: `${APP_URL}/icon.png`,
      appChainIds: [CHAIN_ID],
      subAccounts: {
        creation: "on-connect",
        defaultAccount: "sub",
        funding: "spend-permissions",
      },
      // Every transaction carries our ERC-8021 Builder Code so the volume is attributable.
      ...(BUILDER_CODE_SUFFIX ? { preference: { attribution: { dataSuffix: BUILDER_CODE_SUFFIX } } } : {}),
      // Sponsored gas, so a draft pick costs the player nothing but the stock itself.
      ...(PAYMASTER_URL ? { paymasterUrls: { [CHAIN_ID]: PAYMASTER_URL } } : {}),
    });
  }
  return sdk;
}

/**
 * The provider for whichever wallet the player picked.
 *
 * Everything that writes goes through here, so supporting a second kind of wallet is a change in
 * one place rather than in every action. An injected wallet is an ordinary EIP-1193 provider, which
 * is all the callers ever needed from the Base Account one.
 */
export function getProvider(): ProviderInterface {
  const external = getInjectedProvider();
  if (external) return external as unknown as ProviderInterface;
  return getSdk().getProvider();
}

export type Accounts = {
  /** The player's main Base Account, which holds the funds and owns the league wallet. */
  universal: `0x${string}`;
  /** The Sub Account the league is scored on. Null until one has been provisioned. */
  league: `0x${string}` | null;
};

/** Opens the Base Account popup and returns both addresses. */
export async function connect(): Promise<Accounts> {
  const external = getInjectedProvider();
  if (external) {
    const accounts = (await external.request({
      method: "eth_requestAccounts",
    })) as `0x${string}`[];
    if (!accounts?.length) throw new Error("That wallet returned no accounts");
    await ensureBaseNetwork(external);
    // An injected wallet has no Sub Account: the account itself is the league wallet, so it is
    // what holds the stocks and what the league is scored on.
    return { universal: accounts[0], league: accounts[0] };
  }
  const provider = getProvider();
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as `0x${string}`[];
  return resolveAccounts(accounts);
}

/** Reads accounts without prompting. Returns null when the player has not connected yet. */
export async function restore(): Promise<Accounts | null> {
  const external = getInjectedProvider();
  if (external) {
    const accounts = (await external.request({ method: "eth_accounts" })) as `0x${string}`[];
    if (!accounts?.length) return null;
    return { universal: accounts[0], league: accounts[0] };
  }
  const provider = getProvider();
  const accounts = (await provider.request({ method: "eth_accounts" })) as `0x${string}`[];
  if (!accounts || accounts.length === 0) return null;
  return resolveAccounts(accounts);
}

/**
 * With `defaultAccount: 'sub'` the provider lists the league wallet first and the main account
 * after it. Ask the SDK for the sub account explicitly rather than trusting that order, and fall
 * back to positional reading if the lookup is unavailable.
 */
async function resolveAccounts(accounts: `0x${string}`[]): Promise<Accounts> {
  let league: `0x${string}` | null = null;
  try {
    const sub = await getSdk().subAccount.get();
    if (sub?.address) league = sub.address as `0x${string}`;
  } catch {
    // The lookup is best effort; the positional fallback below still gives a usable result.
  }

  if (league) {
    const universal = accounts.find((a) => a.toLowerCase() !== league!.toLowerCase()) ?? accounts[0];
    return { universal, league };
  }

  return accounts.length > 1
    ? { universal: accounts[1], league: accounts[0] }
    : { universal: accounts[0], league: null };
}

export async function disconnect(): Promise<void> {
  // An injected wallet has no disconnect: the extension owns that. Forgetting it locally is the
  // most an app can honestly do.
  if (getActiveWalletId() !== "base-account") return;
  await getSdk().getProvider().disconnect();
}
