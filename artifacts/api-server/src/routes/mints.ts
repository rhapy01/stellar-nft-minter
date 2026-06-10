import { Router, type IRouter } from "express";
import { eq, desc, sql, countDistinct } from "drizzle-orm";
import { db, mintsTable } from "@workspace/db";
import {
  CreateMintBody,
  UpdateMintBody,
  UpdateMintParams,
  GetMintParams,
  ListMintsQueryParams,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/mints/stats", async (req, res): Promise<void> => {
  req.log.info("Fetching mint stats");

  const rows = await db
    .select({
      status: mintsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(mintsTable)
    .groupBy(mintsTable.status);

  const [walletRow] = await db
    .select({ uniqueWallets: countDistinct(mintsTable.walletAddress) })
    .from(mintsTable);

  const totalMints = rows.reduce((sum, r) => sum + r.count, 0);
  const successfulMints = rows.find((r) => r.status === "success")?.count ?? 0;
  const failedMints = rows.find((r) => r.status === "failed")?.count ?? 0;
  const pendingMints = rows.find((r) => r.status === "pending")?.count ?? 0;
  const uniqueWallets = walletRow?.uniqueWallets ?? 0;

  res.json({ totalMints, successfulMints, failedMints, pendingMints, uniqueWallets });
});

router.get("/mints/recent", async (req, res): Promise<void> => {
  req.log.info("Fetching recent mints");

  const mints = await db
    .select()
    .from(mintsTable)
    .where(eq(mintsTable.status, "success"))
    .orderBy(desc(mintsTable.updatedAt))
    .limit(10);

  res.json(
    mints.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }))
  );
});

router.get("/mints/:id", async (req, res): Promise<void> => {
  const parsed = GetMintParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [mint] = await db
    .select()
    .from(mintsTable)
    .where(eq(mintsTable.id, parsed.data.id));

  if (!mint) {
    res.status(404).json({ error: "Mint not found" });
    return;
  }

  res.json({
    ...mint,
    createdAt: mint.createdAt.toISOString(),
    updatedAt: mint.updatedAt.toISOString(),
  });
});

router.patch("/mints/:id", async (req, res): Promise<void> => {
  const params = UpdateMintParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateMintBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (body.data.status !== undefined) updateData.status = body.data.status;
  if (body.data.txHash !== undefined) updateData.txHash = body.data.txHash;
  if (body.data.nftId !== undefined) updateData.nftId = body.data.nftId;
  if (body.data.errorMessage !== undefined) updateData.errorMessage = body.data.errorMessage;
  if (body.data.contractAddress !== undefined) updateData.contractAddress = body.data.contractAddress;

  const [mint] = await db
    .update(mintsTable)
    .set(updateData)
    .where(eq(mintsTable.id, params.data.id))
    .returning();

  if (!mint) {
    res.status(404).json({ error: "Mint not found" });
    return;
  }

  res.json({
    ...mint,
    createdAt: mint.createdAt.toISOString(),
    updatedAt: mint.updatedAt.toISOString(),
  });
});

router.get("/mints", async (req, res): Promise<void> => {
  req.log.info("Listing mints");

  const queryParsed = ListMintsQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }

  const { walletAddress, limit = 50, offset = 0 } = queryParsed.data;

  let query = db.select().from(mintsTable).$dynamic();

  if (walletAddress) {
    query = query.where(eq(mintsTable.walletAddress, walletAddress));
  }

  const mints = await query
    .orderBy(desc(mintsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(
    mints.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }))
  );
});

router.post("/mints", async (req, res): Promise<void> => {
  const parsed = CreateMintBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid mint request body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [mint] = await db
    .insert(mintsTable)
    .values({
      walletAddress: parsed.data.walletAddress,
      nftName: parsed.data.nftName,
      description: parsed.data.description,
      imageUrl: parsed.data.imageUrl,
      attributes: parsed.data.attributes ?? null,
      contractAddress: parsed.data.contractAddress ?? null,
      network: parsed.data.network,
      status: "pending",
    })
    .returning();

  logger.info({ mintId: mint.id }, "Mint record created");

  res.status(201).json({
    ...mint,
    createdAt: mint.createdAt.toISOString(),
    updatedAt: mint.updatedAt.toISOString(),
  });
});

export default router;
