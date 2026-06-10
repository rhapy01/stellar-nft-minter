// ─── Soroban NFT Contract interactions ───────────────────────────────────────

import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Account,
} from '@stellar/stellar-sdk';
import { rpc } from '@stellar/stellar-sdk';
import {
  NFT_CONTRACT_ADDRESS,
  NETWORK_PASSPHRASE,
  CONTRACT_NOT_DEPLOYED,
} from './constants';
import { sorobanRpc } from './stellar';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NFTMetadata {
  tokenId: number;
  name: string;
  description: string;
  imageUrl: string;
  owner: string;
  createdAt: number;
}

export interface MintEvent {
  id: string;
  ledger: number;
  owner: string;
  tokenId: number;
}

// ─── Helper: read-only dummy account for simulations ─────────────────────────
//
// Soroban simulations require an account but don't submit a transaction.
// We use the well-known Stellar "burn" address (the SDF issuer account).

function readAccount() {
  return new Account(
    'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    '0',
  );
}

// ─── Mint transaction ─────────────────────────────────────────────────────────

/**
 * Build and simulate a Soroban `mint` transaction.
 * Returns the assembled transaction as an XDR string, ready to be signed
 * by the user's wallet.
 */
export async function buildMintTransaction(
  publicKey: string,
  name: string,
  description: string,
  imageUrl: string,
): Promise<string> {
  if (CONTRACT_NOT_DEPLOYED) {
    throw new Error(
      'Contract not deployed. Run scripts/deploy-contract.mjs and set VITE_CONTRACT_ADDRESS.',
    );
  }

  const account = await sorobanRpc.getAccount(publicKey);
  const contract = new Contract(NFT_CONTRACT_ADDRESS);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'mint',
        nativeToScVal(publicKey, { type: 'address' }),
        nativeToScVal(name, { type: 'string' }),
        nativeToScVal(description, { type: 'string' }),
        nativeToScVal(imageUrl, { type: 'string' }),
      ),
    )
    .setTimeout(300)
    .build();

  // prepareTransaction simulates the tx, fills in resource usage & footprint.
  const prepared = await sorobanRpc.prepareTransaction(tx);
  return prepared.toXDR();
}

// ─── Read-only contract calls ─────────────────────────────────────────────────

/** Read the total number of minted NFTs directly from the contract. */
export async function getTotalSupply(): Promise<number> {
  if (CONTRACT_NOT_DEPLOYED) return 0;
  try {
    const contract = new Contract(NFT_CONTRACT_ADDRESS);
    const tx = new TransactionBuilder(readAccount(), {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('total_supply'))
      .setTimeout(30)
      .build();

    const result = await sorobanRpc.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(result)) return 0;
    const sim = result as rpc.Api.SimulateTransactionSuccessResponse;
    if (!sim.result?.retval) return 0;
    return scValToNative(sim.result.retval) as number;
  } catch {
    return 0;
  }
}

/** Fetch metadata for a single token by its ID. */
export async function getNFTMetadata(tokenId: number): Promise<NFTMetadata | null> {
  if (CONTRACT_NOT_DEPLOYED) return null;
  try {
    const contract = new Contract(NFT_CONTRACT_ADDRESS);
    const tx = new TransactionBuilder(readAccount(), {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call('get_nft', nativeToScVal(tokenId, { type: 'u32' })),
      )
      .setTimeout(30)
      .build();

    const result = await sorobanRpc.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(result)) return null;
    const sim = result as rpc.Api.SimulateTransactionSuccessResponse;
    if (!sim.result?.retval) return null;
    const raw: any = scValToNative(sim.result.retval);
    if (!raw) return null;

    return {
      tokenId,
      name: String(raw.name ?? ''),
      description: String(raw.description ?? ''),
      imageUrl: String(raw.image_url ?? ''),
      owner: String(raw.owner ?? ''),
      createdAt: Number(raw.created_at ?? 0),
    };
  } catch {
    return null;
  }
}

// ─── Soroban event polling ────────────────────────────────────────────────────

/**
 * Fetch contract events for the NFT minter contract starting from `startLedger`.
 * Returns an array of MintEvent, newest last.
 */
export async function getMintEvents(startLedger: number): Promise<MintEvent[]> {
  if (CONTRACT_NOT_DEPLOYED || startLedger <= 0) return [];
  try {
    const response = await sorobanRpc.getEvents({
      startLedger,
      filters: [
        {
          type: 'contract' as const,
          contractIds: [NFT_CONTRACT_ADDRESS],
        },
      ],
      limit: 100,
    });

    return (response.events ?? []).map(e => {
      let owner = '';
      let tokenId = 0;
      try {
        // Contract emits: topics=(MINT, nft)  value=(to: Address, token_id: u32)
        const val: unknown = scValToNative(e.value);
        if (Array.isArray(val)) {
          owner = String(val[0]);
          tokenId = Number(val[1]);
        }
      } catch {
        // best-effort
      }
      return { id: e.id, ledger: e.ledger, owner, tokenId } satisfies MintEvent;
    });
  } catch {
    return [];
  }
}
