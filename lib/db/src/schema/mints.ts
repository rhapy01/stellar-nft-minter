import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mintsTable = pgTable("mints", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  nftName: text("nft_name").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  attributes: text("attributes"),
  status: text("status").notNull().default("pending"),
  txHash: text("tx_hash"),
  nftId: text("nft_id"),
  errorMessage: text("error_message"),
  contractAddress: text("contract_address"),
  network: text("network").notNull().default("testnet"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMintSchema = createInsertSchema(mintsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMint = z.infer<typeof insertMintSchema>;
export type Mint = typeof mintsTable.$inferSelect;
