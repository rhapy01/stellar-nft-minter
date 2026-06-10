// ─── StellarWalletsKit integration ────────────────────────────────────────────
//
// Multi-wallet support via @creit.tech/stellar-wallets-kit (Freighter + Albedo).
// The kit provides a unified connect / sign API and normalizes wallet errors.

import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import {
  FREIGHTER_ID,
  FreighterModule,
} from '@creit.tech/stellar-wallets-kit/modules/freighter';
import {
  ALBEDO_ID,
  AlbedoModule,
} from '@creit.tech/stellar-wallets-kit/modules/albedo';
import {
  Networks,
  KitEventType,
  type ISupportedWallet,
} from '@creit.tech/stellar-wallets-kit/types';
import { NETWORK_PASSPHRASE } from './constants';

export type WalletType = 'freighter' | 'albedo';

export const WALLET_TYPE_TO_ID: Record<WalletType, string> = {
  freighter: FREIGHTER_ID,
  albedo: ALBEDO_ID,
};

export const WALLET_LABELS: Record<WalletType, string> = {
  freighter: 'Freighter',
  albedo: 'Albedo',
};

let initialized = false;

/** Initialize the kit once (Freighter + Albedo modules on Testnet). */
export function initWalletKit(): void {
  if (initialized) return;
  StellarWalletsKit.init({
    modules: [new FreighterModule(), new AlbedoModule()],
    network: Networks.TESTNET,
  });
  initialized = true;
}

/** List supported wallets and whether each is available in the browser. */
export async function getSupportedWallets(): Promise<ISupportedWallet[]> {
  initWalletKit();
  return StellarWalletsKit.refreshSupportedWallets();
}

/**
 * Connect a specific wallet and return the user's public key.
 * Throws with a `code` field for wallet-not-found / user-denied cases.
 */
export async function connectWallet(type: WalletType): Promise<string> {
  initWalletKit();
  const walletId = WALLET_TYPE_TO_ID[type];

  try {
    StellarWalletsKit.setWallet(walletId);
    const { address } = await StellarWalletsKit.fetchAddress();
    return address;
  } catch (err) {
    throw normalizeKitError(err, type);
  }
}

/**
 * Sign a prepared transaction XDR with the active wallet.
 * Returns the signed XDR string.
 */
export async function signTransactionXdr(
  xdr: string,
  address: string,
): Promise<string> {
  initWalletKit();
  try {
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
      address,
    });
    return signedTxXdr;
  } catch (err) {
    throw normalizeKitError(err);
  }
}

/** Disconnect the active wallet session. */
export async function disconnectWallet(): Promise<void> {
  initWalletKit();
  await StellarWalletsKit.disconnect();
}

/** Subscribe to kit state changes (address / network updates). */
export function onWalletStateChange(
  callback: (address: string | undefined) => void,
): () => void {
  initWalletKit();
  return StellarWalletsKit.on(KitEventType.STATE_UPDATED, event => {
    callback(event.payload.address);
  });
}

interface KitErrorShape {
  code?: number;
  message?: string;
}

/** Map StellarWalletsKit errors to app-friendly Error objects with codes. */
function normalizeKitError(err: unknown, walletType?: WalletType): Error {
  const kitErr = err as KitErrorShape;
  const msg =
    kitErr?.message ??
    (err instanceof Error ? err.message : String(err));
  const lower = msg.toLowerCase();

  if (
    lower.includes('not connected') ||
    lower.includes('not found') ||
    lower.includes('not installed') ||
    lower.includes('is not connected') ||
    (walletType === 'freighter' && lower.includes('freighter'))
  ) {
    return Object.assign(
      new Error(
        walletType === 'freighter'
          ? 'Freighter wallet not found. Install from freighter.app'
          : msg,
      ),
      { code: 'WALLET_NOT_FOUND' },
    );
  }

  if (
    lower.includes('denied') ||
    lower.includes('rejected') ||
    lower.includes('declined') ||
    lower.includes('cancelled') ||
    lower.includes('canceled') ||
    lower.includes('closed the modal') ||
    lower.includes('closed')
  ) {
    return Object.assign(new Error('Transaction rejected by user'), {
      code: 'USER_DENIED',
    });
  }

  if (err instanceof Error) return err;
  return new Error(msg);
}
