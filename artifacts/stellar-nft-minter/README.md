# Stellar NFT Minter

A fully on-chain NFT minting application on **Stellar Testnet** using **Soroban smart contracts** and **StellarWalletsKit**.

**Live:** https://stellar-nft-minter-rust.vercel.app

## Screenshots

![Mint app](./public/mint-app-screenshot.png)

![Mint success](./public/mint-success-screenshot.png)

Verified testnet mint: **Cosmic Voyager #001** (Token #1)

## Features

- **StellarWalletsKit** — unified Freighter + Albedo integration
- **Soroban smart contract** — custom NFT contract on Testnet
- **Real-time minting** — build, sign, and submit transactions from the browser
- **Live activity feed** — Soroban contract events every 10 seconds
- **XLM balance check** — warns when balance is too low
- **Error handling** — wallet not found, user rejection, insufficient balance, contract/network errors
- **Transaction status** — pending, success, and fail states in the UI

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TypeScript |
| Blockchain | Stellar Testnet (Soroban) |
| SDK | `@stellar/stellar-sdk` v15 |
| Wallets | `@creit.tech/stellar-wallets-kit` (Freighter + Albedo) |
| Styling | Tailwind CSS + shadcn/ui |
| State | React Query |

## Deployed contract

```
CCR5FXO5HECHWEFFE4LOROEF6UOW4XWWKM6QKCSFBS72GJIXI2GMKO57
```

[View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CCR5FXO5HECHWEFFE4LOROEF6UOW4XWWKM6QKCSFBS72GJIXI2GMKO57)

## Setup

```bash
pnpm install
```

Create `.env` in this directory:

```
VITE_CONTRACT_ADDRESS=CCR5FXO5HECHWEFFE4LOROEF6UOW4XWWKM6QKCSFBS72GJIXI2GMKO57
```

```bash
pnpm --filter @workspace/stellar-nft-minter run dev
```

## Contract deployment

```bash
rustup target add wasm32-unknown-unknown
cd contracts/nft && cargo build --target wasm32-unknown-unknown --release
pnpm --filter @workspace/scripts exec tsx src/deploy-contract.ts
```

## Using the app

1. Connect **Freighter** or **Albedo** via StellarWalletsKit
2. Fund testnet account via [Friendbot](https://friendbot.stellar.org) if needed
3. Fill in NFT name, description, and image URL
4. Click **Execute Mint** and approve in your wallet
5. Watch the telemetry panel and live activity feed update

## Vercel

Root `vercel.json` configures install, build, and `VITE_CONTRACT_ADDRESS`. Deploy from the monorepo root.
