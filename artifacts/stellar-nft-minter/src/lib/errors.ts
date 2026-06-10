// ─── Error Classification ─────────────────────────────────────────────────────
//
// Minimum 3 error types are handled:
//   WALLET_NOT_FOUND      – extension missing / not installed
//   INSUFFICIENT_BALANCE  – not enough XLM to pay fees
//   CONTRACT_CALL_FAILED  – Soroban contract rejected the call
//   USER_DENIED           – user rejected in wallet UI
//   NETWORK_ERROR         – RPC / connectivity problem
//   CONTRACT_NOT_DEPLOYED – address not configured yet

export const ErrorCode = {
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  USER_DENIED: 'USER_DENIED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  CONTRACT_NOT_DEPLOYED: 'CONTRACT_NOT_DEPLOYED',
  CONTRACT_CALL_FAILED: 'CONTRACT_CALL_FAILED',
  INVALID_METADATA: 'INVALID_METADATA',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface MintError {
  code: ErrorCode;
  message: string;
  suggestion: string;
}

/** Map a caught error to a user-friendly MintError. */
export function classifyError(err: unknown): MintError {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  // Wallet not installed
  if (
    (lower.includes('freighter') && (lower.includes('not found') || lower.includes('install'))) ||
    lower.includes('no freighter')
  ) {
    return {
      code: ErrorCode.WALLET_NOT_FOUND,
      message: 'Freighter wallet not found',
      suggestion:
        'Install the Freighter browser extension from freighter.app, unlock it, then try again.',
    };
  }

  // User rejected / closed wallet dialog
  if (
    lower.includes('denied') ||
    lower.includes('rejected') ||
    lower.includes('cancelled') ||
    lower.includes('cancel') ||
    lower.includes('user declined') ||
    (lower.includes('albedo') && lower.includes('closed'))
  ) {
    return {
      code: ErrorCode.USER_DENIED,
      message: 'Transaction rejected',
      suggestion:
        'You declined the transaction in your wallet. Click "Execute Mint" again when ready.',
    };
  }

  // Popup blocked (Albedo)
  if (lower.includes('popup') || lower.includes('blocked')) {
    return {
      code: ErrorCode.USER_DENIED,
      message: 'Browser blocked the Albedo popup',
      suggestion:
        'Allow popups for this site in your browser settings, then click "Execute Mint" again.',
    };
  }

  // Insufficient XLM balance
  if (
    lower.includes('insufficient') ||
    lower.includes('balance') ||
    lower.includes('underfunded') ||
    lower.includes('op_underfunded')
  ) {
    return {
      code: ErrorCode.INSUFFICIENT_BALANCE,
      message: 'Insufficient XLM balance',
      suggestion:
        'Your wallet needs at least 1 XLM to pay Soroban fees. Visit friendbot.stellar.org?addr=YOUR_ADDRESS to fund your testnet account for free.',
    };
  }

  // Contract not deployed / address placeholder
  if (lower.includes('placeholder') || lower.includes('not deployed')) {
    return {
      code: ErrorCode.CONTRACT_NOT_DEPLOYED,
      message: 'Smart contract not deployed',
      suggestion:
        'Compile the contract (cargo build) then run node scripts/deploy-contract.mjs. Set VITE_CONTRACT_ADDRESS in your .env file.',
    };
  }

  // Soroban contract / simulation errors
  if (
    lower.includes('simulate') ||
    lower.includes('invoke') ||
    lower.includes('host') ||
    lower.includes('soroban') ||
    lower.includes('wasm') ||
    lower.includes('contract')
  ) {
    return {
      code: ErrorCode.CONTRACT_CALL_FAILED,
      message: 'Smart contract call failed',
      suggestion:
        'The Soroban contract rejected this invocation. Ensure your inputs are valid and that the contract is correctly initialized on Testnet.',
    };
  }

  // Network / RPC errors
  if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('timeout') ||
    lower.includes('rpc') ||
    lower.includes('econnreset') ||
    lower.includes('503') ||
    lower.includes('502')
  ) {
    return {
      code: ErrorCode.NETWORK_ERROR,
      message: 'Network connection failed',
      suggestion:
        'Cannot reach Stellar Testnet RPC. Check your internet connection and try again in a moment.',
    };
  }

  // Fallback
  return {
    code: ErrorCode.UNKNOWN,
    message: raw || 'An unexpected error occurred',
    suggestion:
      'Please try again. If the problem persists open the browser console for details.',
  };
}
