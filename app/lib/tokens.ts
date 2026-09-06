/**
 * Coinbase Tokenized Stocks on Base.
 *
 * Mirrors contracts/config/tokens.json, which is the source of truth for deployment. Run
 * `bun run check:tokens` to prove the two stay in step.
 *
 * Verified onchain 2026-09-06 at block 50943159: every token and every feed uses 8 decimals.
 * `live: false` means totalSupply was zero, so nothing has been minted and no router will trade it.
 */

export type Listing = {
  ticker: string;
  name: string;
  token: `0x${string}`;
  feed: `0x${string}`;
  live: boolean;
};

export const LISTINGS: Listing[] = [
  { ticker: "AAPLc",  name: "Apple",     token: "0xb200000000000000000000C2e324d24d7eEcd1fb", feed: "0x787f13dEa48Db0897CbCDD985de77809D837F988", live: true  },
  { ticker: "AMZNc",  name: "Amazon",    token: "0xb200000000000000000000d9192b6B456483C2E8", feed: "0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295", live: true  },
  { ticker: "COINc",  name: "Coinbase",  token: "0xb200000000000000000000c85a31389D71F3ecfb", feed: "0x408e44f504A7371a345F03a73dDC96A4b48e8aa7", live: false },
  { ticker: "CRCLc",  name: "Circle",    token: "0xB20000000000000000000019f6E7C675b73C2e4D", feed: "0x0231cF2635D1E17bB5c2462cc7504Ba1fBd61f33", live: false },
  { ticker: "GOOGLc", name: "Alphabet",  token: "0xb2000000000000000000002D0BA3164cc74f58B7", feed: "0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2", live: true  },
  { ticker: "INTCc",  name: "Intel",     token: "0xB2000000000000000000004AFF16039bA04bdFBc", feed: "0xAB657C39bac0D5886250D70849e2E3E008F2EECB", live: false },
  { ticker: "METAc",  name: "Meta",      token: "0xb2000000000000000000008bC8786B856E61707C", feed: "0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D", live: true  },
  { ticker: "MSFTc",  name: "Microsoft", token: "0xB200000000000000000000Ab99cFa739E253872B", feed: "0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c", live: true  },
  { ticker: "MSTRc",  name: "Strategy",  token: "0xb2000000000000000000004884b426556b92883d", feed: "0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a", live: true  },
  { ticker: "NVDAc",  name: "Nvidia",    token: "0xb20000000000000000000078ee7ce2fE4908108C", feed: "0x04689a41629776563E6822F76f2e57D148d28513", live: true  },
  { ticker: "SNDKc",  name: "SanDisk",   token: "0xb200000000000000000000397293Cb8cda9a10c5", feed: "0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA", live: true  },
  { ticker: "SPCXc",  name: "SpaceX",    token: "0xb2000000000000000000007b9fcbd005511aCBd5", feed: "0x6A634B235903C4ad6376892180d6fF8612e3Fa68", live: true  },
  { ticker: "TSLAc",  name: "Tesla",     token: "0xb2000000000000000000001e800a7f5189430cD0", feed: "0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4", live: true  },
];

/** Tickers with supply, and therefore the only ones a router can actually fill. */
export const TRADEABLE = LISTINGS.filter((l) => l.live);

/** Every B20 token and every Chainlink equity feed on Base uses 8 decimals. */
export const TOKEN_DECIMALS = 8;
export const FEED_DECIMALS = 8;

export function listingByToken(token: string): Listing | undefined {
  const lower = token.toLowerCase();
  return LISTINGS.find((l) => l.token.toLowerCase() === lower);
}
