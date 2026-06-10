// ─── Stellar Network Configuration ───────────────────────────────────────────

export const NETWORK = 'TESTNET' as const;
export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
export const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';
export const FRIENDBOT_URL = 'https://friendbot.stellar.org';
export const STELLAR_EXPERT_BASE = 'https://stellar.expert/explorer/testnet';

// ─── NFT Contract ─────────────────────────────────────────────────────────────
//
// Deploy the contract with:
//   1. cargo build --target wasm32-unknown-unknown --release
//      (in contracts/nft/)
//   2. node scripts/deploy-contract.mjs
//
// Then set VITE_CONTRACT_ADDRESS in your .env or Vercel environment variables.

export const NFT_CONTRACT_ADDRESS: string =
  (import.meta as any).env?.VITE_CONTRACT_ADDRESS ??
  'PLACEHOLDER_DEPLOY_CONTRACT_AND_SET_VITE_CONTRACT_ADDRESS';

/** True when the contract has not yet been deployed / address not configured. */
export const CONTRACT_NOT_DEPLOYED =
  NFT_CONTRACT_ADDRESS.startsWith('PLACEHOLDER');
