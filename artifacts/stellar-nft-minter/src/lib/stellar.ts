// ─── Stellar RPC / Horizon utilities ─────────────────────────────────────────

import { rpc, TransactionBuilder, Networks } from '@stellar/stellar-sdk';
import { SOROBAN_RPC_URL, HORIZON_URL, NETWORK_PASSPHRASE } from './constants';

/** Shared Soroban RPC client (re-used across all contract calls). */
export const sorobanRpc = new rpc.Server(SOROBAN_RPC_URL, { allowHttp: false });

// ─── Account ─────────────────────────────────────────────────────────────────

/** Fetch the account object needed to build a transaction. */
export async function getAccount(publicKey: string) {
  return sorobanRpc.getAccount(publicKey);
}

// ─── Balance ─────────────────────────────────────────────────────────────────

export interface XLMBalance {
  balance: string;
  xlm: number;
}

/** Fetch XLM (native) balance from Stellar Horizon. */
export async function getXLMBalance(publicKey: string): Promise<XLMBalance> {
  try {
    const resp = await fetch(`${HORIZON_URL}/accounts/${publicKey}`);
    if (!resp.ok) {
      if (resp.status === 404) return { balance: '0', xlm: 0 };
      throw new Error(`Horizon HTTP ${resp.status}`);
    }
    const data = await resp.json() as {
      balances: Array<{ asset_type: string; balance: string }>;
    };
    const native = data.balances.find(b => b.asset_type === 'native');
    const balance = native?.balance ?? '0';
    return { balance, xlm: parseFloat(balance) };
  } catch {
    return { balance: '0', xlm: 0 };
  }
}

// ─── Ledger ───────────────────────────────────────────────────────────────────

/** Latest closed ledger sequence number. */
export async function getLatestLedger(): Promise<number> {
  const ledger = await sorobanRpc.getLatestLedger();
  return ledger.sequence;
}

// ─── Transaction submission & polling ────────────────────────────────────────

export interface TxPollResult {
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  hash: string;
  returnValue?: any;
  resultXdr?: string;
}

/**
 * Poll the RPC until the transaction reaches a terminal status.
 *
 * @param hash - Transaction hash to poll.
 * @param maxAttempts - How many times to check before giving up.
 * @param intervalMs - Milliseconds between attempts.
 */
export async function pollTransaction(
  hash: string,
  maxAttempts = 40,
  intervalMs = 2_000,
): Promise<TxPollResult> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await sorobanRpc.getTransaction(hash);

    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { status: 'SUCCESS', hash, returnValue: (result as any).returnValue };
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      return {
        status: 'FAILED',
        hash,
        resultXdr: (result as any).resultXdr?.toString(),
      };
    }
    // NOT_FOUND → still pending; wait and retry
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return { status: 'TIMEOUT', hash };
}

/** Submit a signed transaction XDR string and return the send result. */
export async function submitSignedTransaction(
  signedXdr: string,
): Promise<rpc.Api.SendTransactionResponse> {
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  return sorobanRpc.sendTransaction(tx);
}

// ─── Friendbot ────────────────────────────────────────────────────────────────

/** Fund a testnet account with 10 000 XLM via Friendbot. */
export async function fundViaFriendbot(publicKey: string): Promise<boolean> {
  try {
    const resp = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
    );
    return resp.ok;
  } catch {
    return false;
  }
}
