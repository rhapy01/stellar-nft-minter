// ─── Multi-wallet integration ─────────────────────────────────────────────────
//
// Supports:
//   • Freighter  — browser extension via @stellar/freighter-api
//   • Albedo     — web wallet via postMessage (no npm package needed)

import {
  isConnected,
  requestAccess,
  getAddress,
  signTransaction,
} from '@stellar/freighter-api';

// ─────────────────────────────────────────────────────────────────────────────
//  FREIGHTER
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true if the Freighter extension is installed and responsive. */
export async function isFreighterAvailable(): Promise<boolean> {
  try {
    const res = await isConnected();
    return (res as any).isConnected === true || (res as any) === true;
  } catch {
    return false;
  }
}

/**
 * Connect to Freighter and return the user's public key.
 * Throws a descriptive error if the wallet is not found or the user rejects.
 */
export async function connectFreighter(): Promise<string> {
  const available = await isFreighterAvailable();
  if (!available) {
    throw Object.assign(
      new Error('Freighter wallet not found. Install from freighter.app'),
      { code: 'WALLET_NOT_FOUND' },
    );
  }

  const result = await requestAccess();
  const err = (result as any)?.error;
  if (err) {
    const msg: string = err;
    if (
      msg.toLowerCase().includes('denied') ||
      msg.toLowerCase().includes('reject')
    ) {
      throw Object.assign(new Error('Connection denied by user'), {
        code: 'USER_DENIED',
      });
    }
    throw new Error(msg);
  }
  return (result as any).address ?? (result as unknown as string);
}

/** Get the currently connected Freighter address without re-requesting access. */
export async function getFreighterAddress(): Promise<string> {
  const result = await getAddress();
  const err = (result as any)?.error;
  if (err) throw new Error(err as string);
  return (result as any).address ?? (result as unknown as string);
}

/**
 * Sign a transaction XDR with Freighter.
 * Returns the signed XDR string.
 */
export async function signWithFreighter(
  xdr: string,
  networkPassphrase: string,
): Promise<string> {
  const result = await signTransaction(xdr, { networkPassphrase });
  const err = (result as any)?.error;
  if (err) {
    const msg: string = err;
    if (
      msg.toLowerCase().includes('declined') ||
      msg.toLowerCase().includes('denied') ||
      msg.toLowerCase().includes('reject')
    ) {
      throw Object.assign(new Error('Transaction rejected by user'), {
        code: 'USER_DENIED',
      });
    }
    throw new Error(msg);
  }
  return (result as any).signedTxXdr ?? (result as unknown as string);
}

// ─────────────────────────────────────────────────────────────────────────────
//  ALBEDO  (no npm package — uses postMessage / popup API directly)
//  Docs: https://albedo.link/docs
// ─────────────────────────────────────────────────────────────────────────────

const ALBEDO_ORIGIN = 'https://albedo.link';

function openAlbedoPopup(url: string): Window {
  const popup = window.open(
    url,
    'albedo_popup',
    'width=450,height=680,resizable=no,scrollbars=yes',
  );
  if (!popup) {
    throw new Error(
      'Popup blocked. Allow popups for this site in your browser settings.',
    );
  }
  return popup;
}

function waitForAlbedoMessage(popup: Window): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== ALBEDO_ORIGIN) return;
      cleanup();
      popup.close();
      if (event.data?.error) {
        reject(new Error(String(event.data.error)));
      } else {
        resolve(event.data as Record<string, unknown>);
      }
    };

    const closedCheck = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('Albedo window was closed'));
      }
    }, 500);

    // Auto-timeout after 2 minutes
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Albedo request timed out'));
    }, 120_000);

    function cleanup() {
      window.removeEventListener('message', handler);
      clearInterval(closedCheck);
      clearTimeout(timeout);
    }

    window.addEventListener('message', handler);
  });
}

/** Connect Albedo and return the user's Stellar public key. */
export async function connectAlbedo(): Promise<string> {
  const token = generateToken();
  const popup = openAlbedoPopup(
    `${ALBEDO_ORIGIN}/intent/public_key?token=${token}&callback=postMessage`,
  );
  const data = await waitForAlbedoMessage(popup);
  if (!data.pubkey) throw new Error('Albedo did not return a public key');
  return data.pubkey as string;
}

/**
 * Sign a transaction XDR via Albedo.
 * Returns the signed envelope XDR.
 */
export async function signWithAlbedo(
  xdr: string,
  network: 'TESTNET' | 'PUBLIC',
): Promise<string> {
  const token = generateToken();
  const params = new URLSearchParams({
    xdr,
    network: network.toLowerCase(),
    submit: 'false',
    callback: 'postMessage',
    token,
  });
  const popup = openAlbedoPopup(
    `${ALBEDO_ORIGIN}/intent/tx?${params.toString()}`,
  );
  const data = await waitForAlbedoMessage(popup);
  if (!data.signed_envelope_xdr) {
    throw new Error('Albedo did not return a signed transaction');
  }
  return data.signed_envelope_xdr as string;
}

function generateToken(): string {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
