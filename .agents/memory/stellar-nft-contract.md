---
name: Stellar NFT Minter contract
description: Deployed Soroban contract address and design notes for the Stellar NFT Minter.
---

## Deployed Contract (Stellar Testnet)
`CCR5FXO5HECHWEFFE4LOROEF6UOW4XWWKM6QKCSFBS72GJIXI2GMKO57`

Explorer: https://stellar.expert/explorer/testnet/contract/CCR5FXO5HECHWEFFE4LOROEF6UOW4XWWKM6QKCSFBS72GJIXI2GMKO57

Frontend reads from `VITE_CONTRACT_ADDRESS` env var. Dev: `artifacts/stellar-nft-minter/.env`.

## Key design decisions

**mint() needs no initialize():** The counter uses `unwrap_or(0)`, so the contract works immediately after deployment without calling `initialize()`. This is why the partially-deployed contract (init call failed) is fully usable.

**Why:** `initialize()` only sets an `Owner` key which is unused by `mint()`. Any caller can mint by authorizing via `to.require_auth()`.

**deploy-contract.ts double-sign bug (fixed):** The original script called `.sign(deployer)` before `sendAndWait()`, which also calls `.sign()`. This caused `txBadAuthExtra`. Fix: remove the manual `.sign()` call before `sendAndWait()`.

**Albedo:** Integrated via postMessage popup (no npm package) to avoid firewall issues. Uses `https://albedo.link/intent/public_key` and `https://albedo.link/intent/tx`.

**Freighter API v6:** Returns `{ address, signedTxXdr }` objects — access with `(result as any).address`.
