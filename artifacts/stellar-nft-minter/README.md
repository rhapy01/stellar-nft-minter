# Stellar NFT Minter

A fully on-chain NFT minting application built on the **Stellar Testnet** using **Soroban smart contracts**. No backend server — all interactions happen directly with the Stellar blockchain.

## Features

- **Multi-wallet support** — Freighter browser extension + Albedo web wallet
- **Soroban smart contract** — custom NFT contract deployed to Stellar Testnet
- **Real-time minting** — build, sign, and submit transactions directly from the browser
- **Live activity feed** — polls Soroban contract events every 10 seconds
- **XLM balance check** — warns when balance is too low before submitting
- **5+ error types handled** — wallet not found, user rejection, insufficient balance, contract failure, network errors
- **Responsive UI** — works on mobile and desktop
- **Vercel-ready** — static build, no backend required

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TypeScript |
| Blockchain | Stellar Testnet (Soroban) |
| SDK | `@stellar/stellar-sdk` v15 |
| Wallet A | `@stellar/freighter-api` v6 |
| Wallet B | Albedo (postMessage API) |
| Styling | Tailwind CSS + shadcn/ui |
| State | React Query |

## Smart Contract

The Soroban NFT contract is located in `contracts/nft/src/lib.rs`.

### Contract Functions

| Function | Description |
|----------|-------------|
| `initialize(owner)` | Deploy-time setup; sets admin address |
| `mint(to, name, description, image_url) → u32` | Mint a new NFT, returns token_id |
| `get_nft(token_id) → Option<NFTMetadata>` | Fetch metadata for a token |
| `total_supply() → u32` | Total number of minted NFTs |
| `owner_of(token_id) → Option<Address>` | Owner of a specific token |
| `exists(token_id) → bool` | Check if a token exists |

### Deployed Contract Address

```
VITE_CONTRACT_ADDRESS=<set after deployment — see below>
```

---

## Setup & Installation

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure the contract address

After deploying (see below), create `.env` in `artifacts/stellar-nft-minter/`:

```bash
VITE_CONTRACT_ADDRESS=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### 3. Start the dev server

```bash
pnpm --filter @workspace/stellar-nft-minter run dev
```

---

## Contract Deployment

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add WASM target
rustup target add wasm32-unknown-unknown
```

### Compile

```bash
cd contracts/nft
cargo build --target wasm32-unknown-unknown --release
```

### Deploy to Testnet

```bash
# From project root
npx tsx scripts/src/deploy-contract.ts
```

This script will:
1. Generate a fresh deployer keypair
2. Fund it via Friendbot (10 000 XLM, free)
3. Upload the WASM to Stellar Testnet
4. Instantiate the contract
5. Call `initialize()`
6. Print the **contract address** — copy this into your `.env`

---

## Using the App

### Connect a Wallet

**Freighter** (recommended):
1. Install the [Freighter extension](https://freighter.app)
2. Create or import a Stellar account
3. Switch to **Testnet** in Freighter settings
4. Click "Connect Wallet" → Freighter

**Albedo**:
1. Click "Connect Wallet" → Albedo
2. A popup opens — approve the connection
3. Allow popups for this site if prompted

### Fund Your Testnet Account

Your account needs XLM to pay Soroban gas fees. Click the **Fund via Friendbot** link shown in the UI, or visit:

```
https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY
```

### Mint an NFT

1. Connect your wallet
2. Fill in: Name, Description, Image URL
3. Click **Execute Mint**
4. Approve the transaction in your wallet
5. The transaction hash appears with a link to [Stellar Expert](https://stellar.expert/explorer/testnet)

---

## Vercel Deployment

1. Push to GitHub
2. Import the repo in Vercel
3. Set **Build Command**: `pnpm --filter @workspace/stellar-nft-minter run build`
4. Set **Output Directory**: `artifacts/stellar-nft-minter/dist/public`
5. Add environment variable: `VITE_CONTRACT_ADDRESS` = your deployed contract address
6. Deploy!

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `WALLET_NOT_FOUND` | Freighter not installed | Install from freighter.app |
| `USER_DENIED` | User rejected in wallet | Try again and approve |
| `INSUFFICIENT_BALANCE` | Less than 0.5 XLM | Fund via Friendbot |
| `CONTRACT_NOT_DEPLOYED` | Address not configured | Deploy and set env var |
| `CONTRACT_CALL_FAILED` | Soroban contract error | Check inputs / contract state |
| `NETWORK_ERROR` | RPC unreachable | Check internet, retry |

---

## Transaction Hash (Testnet)

> _Populate after minting: paste a verified tx hash from Stellar Expert here._

---

## Project Structure

```
├── artifacts/
│   └── stellar-nft-minter/       # React + Vite frontend
│       ├── src/
│       │   ├── lib/
│       │   │   ├── constants.ts  # Network config, contract address
│       │   │   ├── stellar.ts    # RPC utilities
│       │   │   ├── wallet.ts     # Freighter + Albedo integration
│       │   │   ├── contract.ts   # Soroban contract calls
│       │   │   └── errors.ts     # Error classification
│       │   └── components/       # React UI components
│       └── vercel.json
├── contracts/
│   └── nft/
│       └── src/lib.rs            # Soroban contract (Rust)
└── scripts/
    └── src/deploy-contract.ts    # Deployment script
```
