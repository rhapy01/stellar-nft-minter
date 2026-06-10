# Stellar NFT Minter

A 100% blockchain NFT minting app on Stellar Testnet — no backend database required. Users connect a Freighter or Albedo wallet and mint NFTs via a deployed Soroban smart contract, with live activity feed and real transaction signing.

## Run & Operate

- `pnpm --filter @workspace/stellar-nft-minter run dev` — run the frontend (via workflow)
- `pnpm --filter @workspace/stellar-nft-minter run typecheck` — TypeScript check
- `pnpm --filter @workspace/scripts exec tsx src/deploy-contract.ts` — redeploy contract to Testnet

To compile the Soroban contract (requires the custom wasm32 sysroot setup):
```bash
export RUSTFLAGS="--sysroot /tmp/nix-wasm32-sysroot"
export CARGO_HOME=/tmp/cargo-wasm
NIX_CARGO="/nix/store/brzjqpcbk04hzmhsqlmp7vng4jdis2yc-rust-mixed/bin/cargo"
export RUSTC="/nix/store/brzjqpcbk04hzmhsqlmp7vng4jdis2yc-rust-mixed/bin/rustc"
cd contracts/nft && "$NIX_CARGO" build --target wasm32-unknown-unknown --release
```

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7 + Tailwind CSS + shadcn/ui
- Blockchain: Stellar Testnet, Soroban smart contracts, `@stellar/stellar-sdk` v15
- Wallets: Freighter v6 (browser extension) + Albedo (postMessage popup)
- No PostgreSQL, no Express backend — pure blockchain app

## Where things live

- `artifacts/stellar-nft-minter/` — React frontend
  - `src/lib/constants.ts` — network config, contract address (reads `VITE_CONTRACT_ADDRESS`)
  - `src/lib/wallet.ts` — Freighter v6 + Albedo wallet integration
  - `src/lib/contract.ts` — Soroban contract calls (mint, total_supply, events)
  - `src/lib/stellar.ts` — RPC utilities, transaction polling
  - `src/lib/errors.ts` — 6 typed error classes
  - `src/components/mint-panel.tsx` — 5-step mint flow
  - `src/components/activity-feed.tsx` — live Soroban events feed
  - `src/components/stats-bar.tsx` — live ledger + contract stats
  - `.env` — `VITE_CONTRACT_ADDRESS` for local dev
- `contracts/nft/src/lib.rs` — Soroban NFT contract (Rust, soroban-sdk 22)
- `scripts/src/deploy-contract.ts` — deployment script

## Architecture decisions

- Pure static frontend — no Express/PostgreSQL. All state lives on Stellar Testnet.
- Albedo integrated via postMessage (no npm package) — avoids firewall/CSP issues.
- Freighter API v6 returns `{ address, signedTxXdr }` objects — use `(result as any).address` for compatibility.
- Custom NixOS wasm32 sysroot: Nix `rustc` 1.88.0 + wasm32 stdlib downloaded separately from `static.rust-lang.org/dist/2025-06-26/rust-std-1.88.0-wasm32-unknown-unknown.tar.xz`. The `rustup` toolchain has TLS issues on NixOS; use the Nix cargo with RUSTFLAGS sysroot override instead.
- `mint()` uses `unwrap_or(0)` for the counter — no explicit `initialize()` call required.

## Product

- Connect Freighter or Albedo wallet
- Fill in NFT name, description, image URL, and optional attributes
- 5-step mint flow: simulate → sign → submit → confirm → done
- Live stats bar: total NFTs minted, latest ledger number (updates every 5 s)
- Live activity feed: Soroban contract events for each mint

## Deployed Contract

- **Testnet contract:** `CCR5FXO5HECHWEFFE4LOROEF6UOW4XWWKM6QKCSFBS72GJIXI2GMKO57`
- Stellar Expert: https://stellar.expert/explorer/testnet/contract/CCR5FXO5HECHWEFFE4LOROEF6UOW4XWWKM6QKCSFBS72GJIXI2GMKO57

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always set `VITE_CONTRACT_ADDRESS` in `.env` (local) or Vercel env vars (production) before running the frontend.
- `pnpm run dev` at workspace root has no `dev` script — use the workflow or `pnpm --filter` instead.
- Recompiling the contract requires rebuilding the custom wasm32 sysroot (see Run section above) because the Nix Rust toolchain doesn't include wasm32 by default, and the `rustup` stable toolchain has TLS issues in the NixOS environment.
- Vercel deploy: `vercel.json` sets `Cross-Origin-Opener-Policy: same-origin-allow-popups` for Albedo popup support.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
