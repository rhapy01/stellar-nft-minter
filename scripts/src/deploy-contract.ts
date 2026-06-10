#!/usr/bin/env node
/**
 * Deploy the Stellar NFT Minter Soroban contract to Testnet.
 *
 * Prerequisites:
 *   1. Build the contract WASM:
 *        cd contracts/nft
 *        cargo build --target wasm32-unknown-unknown --release
 *   2. Make sure @stellar/stellar-sdk is installed (pnpm install)
 *   3. Run this script:
 *        npx tsx scripts/src/deploy-contract.ts
 *        (or: node --loader ts-node/esm scripts/src/deploy-contract.ts)
 *
 * Output: Prints the deployed contract address.
 *         Set this as VITE_CONTRACT_ADDRESS in your .env file.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Operation,
  xdr,
  Address,
} from "@stellar/stellar-sdk";
import { rpc } from "@stellar/stellar-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../");

const SOROBAN_RPC = "https://soroban-testnet.stellar.org";
const FRIENDBOT   = "https://friendbot.stellar.org";
const PASSPHRASE  = Networks.TESTNET;
const WASM_PATH   = path.resolve(
  WORKSPACE_ROOT,
  "contracts/nft/target/wasm32-unknown-unknown/release/nft_contract.wasm",
);

const server = new rpc.Server(SOROBAN_RPC, { allowHttp: false });

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function fundAccount(keypair: Keypair): Promise<void> {
  console.log("  Funding via Friendbot…");
  const res = await fetch(`${FRIENDBOT}?addr=${keypair.publicKey()}`);
  if (!res.ok) throw new Error(`Friendbot failed: ${res.status}`);
  console.log("  ✓ Funded");
  await sleep(3000);
}

async function sendAndWait(
  tx: ReturnType<TransactionBuilder["build"]>,
  keypair: Keypair,
) {
  tx.sign(keypair);
  const sendRes = await server.sendTransaction(tx);
  if (sendRes.status === "ERROR") {
    throw new Error(`Send error: ${JSON.stringify(sendRes)}`);
  }

  const hash = sendRes.hash;
  console.log(`  Submitted: ${hash}`);

  for (let i = 0; i < 40; i++) {
    await sleep(2000);
    const poll = await server.getTransaction(hash);
    if (poll.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      console.log("  ✓ Confirmed");
      return poll;
    }
    if (poll.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction FAILED: ${JSON.stringify(poll)}`);
    }
  }
  throw new Error("Timed out waiting for transaction");
}

async function main() {
  console.log("\n🚀 Stellar NFT Minter — Contract Deployer\n");

  // ── 1. Read compiled WASM ──────────────────────────────────────────────────
  if (!fs.existsSync(WASM_PATH)) {
    console.error(`❌ WASM not found at: ${WASM_PATH}`);
    console.error("   Build it first with:  cargo build --target wasm32-unknown-unknown --release");
    process.exit(1);
  }
  const wasmBytes = fs.readFileSync(WASM_PATH);
  console.log(`✓ Loaded WASM (${wasmBytes.length} bytes)`);

  // ── 2. Generate deployer keypair ───────────────────────────────────────────
  const deployer = Keypair.random();
  console.log(`\nDeployer public key: ${deployer.publicKey()}`);
  console.log(`Deployer secret key: ${deployer.secret()}  ← save this!\n`);

  await fundAccount(deployer);

  // ── 3. Upload WASM ─────────────────────────────────────────────────────────
  console.log("Uploading WASM to Testnet…");
  let account = await server.getAccount(deployer.publicKey());

  const uploadTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      Operation.uploadContractWasm({ wasm: wasmBytes }),
    )
    .setTimeout(300)
    .build();

  const preparedUpload = await server.prepareTransaction(uploadTx);
  const uploadResult = await sendAndWait(preparedUpload as any, deployer);

  // Extract the WASM hash from the result
  const wasmHashSym = (uploadResult as any).returnValue;
  const wasmHashBytes = xdr.ScVal.fromXDR(
    Buffer.from(wasmHashSym?.toXDR?.() ?? wasmHashSym),
  );
  console.log("✓ WASM uploaded");

  // ── 4. Create contract instance ────────────────────────────────────────────
  console.log("\nCreating contract instance…");
  account = await server.getAccount(deployer.publicKey());

  const createTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      Operation.createCustomContract({
        address: new Address(deployer.publicKey()),
        wasmHash: Buffer.from(
          (uploadResult as any).returnValue?.bytes?.() ??
          (uploadResult as any).returnValue,
        ),
      }),
    )
    .setTimeout(300)
    .build();

  const preparedCreate = await server.prepareTransaction(createTx);
  const createResult = await sendAndWait(preparedCreate as any, deployer);

  // The return value of createCustomContract is the contract address as ScVal
  const { scValToNative } = await import("@stellar/stellar-sdk");
  const contractAddress = scValToNative((createResult as any).returnValue!);
  console.log(`\n✓ Contract created: ${contractAddress}`);

  // ── 5. Initialize the contract ─────────────────────────────────────────────
  console.log("\nInitializing contract…");
  account = await server.getAccount(deployer.publicKey());
  const { Contract, nativeToScVal } = await import("@stellar/stellar-sdk");
  const contract = new Contract(String(contractAddress));

  const initTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "initialize",
        nativeToScVal(deployer.publicKey(), { type: "address" }),
      ),
    )
    .setTimeout(300)
    .build();

  const preparedInit = await server.prepareTransaction(initTx);
  await sendAndWait(preparedInit as any, deployer);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`  CONTRACT ADDRESS: ${contractAddress}`);
  console.log("═══════════════════════════════════════════════════════");
  console.log("\nNext steps:");
  console.log("  1. Copy the contract address above.");
  console.log("  2. Create  artifacts/stellar-nft-minter/.env  with:");
  console.log(`       VITE_CONTRACT_ADDRESS=${contractAddress}`);
  console.log("  3. Restart the dev server.");
  console.log("  4. Set the same var in Vercel environment variables.\n");
}

main().catch(err => {
  console.error("\n❌ Deployment failed:", err);
  process.exit(1);
});
