// ─── Mint Panel ───────────────────────────────────────────────────────────────
//
// Real Soroban blockchain minting:
//   1. Validates inputs
//   2. Checks XLM balance (≥ 0.5 XLM required)
//   3. Builds & simulates the Soroban `mint` transaction
//   4. Signs via StellarWalletsKit (Freighter or Albedo)
//   5. Submits to Stellar Testnet
//   6. Polls for confirmation and shows the tx hash

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRef, useState } from "react";
import { useWallet } from "./wallet-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildMintTransaction } from "@/lib/contract";
import {
  getXLMBalance,
  pollTransaction,
  submitSignedTransaction,
} from "@/lib/stellar";
import { classifyError, type MintError } from "@/lib/errors";
import {
  CONTRACT_NOT_DEPLOYED,
  STELLAR_EXPERT_BASE,
  FRIENDBOT_URL,
} from "@/lib/constants";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Loader2,
  XCircle,
  ExternalLink,
  Image as ImageIcon,
  Upload,
  Link2,
} from "lucide-react";
import {
  compressImageFile,
  resolveMintImageUrl,
  validateImageFile,
} from "@/lib/image";

// ─── Form schema ──────────────────────────────────────────────────────────────

const formSchema = z.object({
  nftName: z
    .string()
    .min(1, "Name is required")
    .max(64, "Max 64 characters"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Max 500 characters"),
  imageUrl: z.string().optional(),
  attributes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Transaction state machine ────────────────────────────────────────────────

type TxState =
  | { status: "idle" }
  | { status: "pending"; step: string }
  | { status: "success"; txHash: string; tokenId?: number; imageUrl?: string }
  | ({ status: "error" } & MintError);

// ─── Component ────────────────────────────────────────────────────────────────

export function MintPanel() {
  const { address, signTx } = useWallet();
  const queryClient = useQueryClient();
  const [txState, setTxState] = useState<TxState>({ status: "idle" });
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: balance } = useQuery({
    queryKey: ["balance", address],
    queryFn: () => getXLMBalance(address!),
    enabled: !!address,
    refetchInterval: 30_000,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nftName: "",
      description: "",
      imageUrl: "",
      attributes: "",
    },
  });

  const watchImageUrl = form.watch("imageUrl");
  const isPending = txState.status === "pending";
  const previewSrc =
    imagePreview ?? (imageMode === "url" ? watchImageUrl : null) ?? null;

  const handleImageFile = async (file: File | null) => {
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setImageError(validationError);
      return;
    }

    try {
      setImageError(null);
      const compressed = await compressImageFile(file);
      setImageFile(file);
      setImagePreview(compressed.dataUrl);
      form.setValue("imageUrl", "");
      form.clearErrors("imageUrl");
    } catch (err: unknown) {
      setImageError(
        err instanceof Error ? err.message : "Could not process image.",
      );
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
    form.setValue("imageUrl", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = async (data: FormValues) => {
    if (!address) return;

    try {
      // ── 1. Balance check ──────────────────────────────────────────────────
      setTxState({ status: "pending", step: "Checking wallet balance…" });
      const bal = await getXLMBalance(address);
      if (bal.xlm < 0.5) {
        setTxState({
          status: "error",
          ...classifyError(
            new Error("Insufficient balance — need at least 0.5 XLM"),
          ),
        });
        return;
      }

      // ── 2. Resolve image (upload or URL) ─────────────────────────────────
      setTxState({ status: "pending", step: "Preparing NFT image…" });
      const imageUrl = await resolveMintImageUrl({
        file: imageMode === "upload" ? imageFile : null,
        url: imageMode === "url" ? data.imageUrl : undefined,
      });

      // ── 3. Build & simulate the Soroban transaction ───────────────────────
      setTxState({ status: "pending", step: "Building Soroban transaction…" });
      const preparedXdr = await buildMintTransaction(
        address,
        data.nftName,
        data.description,
        imageUrl,
      );

      // ── 4. Sign via the connected wallet ──────────────────────────────────
      setTxState({
        status: "pending",
        step: "Waiting for wallet signature…",
      });
      const signedXdr = await signTx(preparedXdr);

      // ── 5. Submit to Stellar Testnet ──────────────────────────────────────
      setTxState({
        status: "pending",
        step: "Broadcasting to Stellar Testnet…",
      });
      const sendResult = await submitSignedTransaction(signedXdr);

      if (sendResult.status === "ERROR") {
        throw new Error(
          `Submission failed: ${(sendResult as any).errorResultXdr ?? "unknown"}`,
        );
      }

      // ── 6. Poll for ledger confirmation ───────────────────────────────────
      setTxState({
        status: "pending",
        step: "Waiting for ledger confirmation…",
      });
      const final = await pollTransaction(sendResult.hash);

      if (final.status === "SUCCESS") {
        let tokenId: number | undefined;
        try {
          const { scValToNative } = await import("@stellar/stellar-sdk");
          if (final.returnValue) {
            tokenId = Number(scValToNative(final.returnValue));
          }
        } catch {
          // best-effort
        }

        setTxState({
          status: "success",
          txHash: sendResult.hash,
          tokenId,
          imageUrl,
        });
        form.reset();
        clearImage();

        // Refresh live stats and activity feed
        queryClient.invalidateQueries({ queryKey: ["total_supply"] });
        queryClient.invalidateQueries({ queryKey: ["mint_events"] });
      } else if (final.status === "FAILED") {
        throw new Error(`Transaction failed on-chain: ${final.resultXdr ?? "unknown reason"}`);
      } else {
        throw new Error("Transaction confirmation timed out. Check Stellar Expert for status.");
      }
    } catch (err: unknown) {
      setTxState({ status: "error", ...classifyError(err) });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ─── Form ────────────────────────────────────────────────────────── */}
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-mono text-lg text-primary">
            Initialize Mint
          </CardTitle>
          <CardDescription>
            {CONTRACT_NOT_DEPLOYED
              ? "⚠ Contract not deployed — see README for deployment steps"
              : "Mint an NFT on Stellar Testnet via Soroban smart contract"}
          </CardDescription>

          {/* XLM balance indicator */}
          {address && balance && (
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Balance:{" "}
              <span
                className={
                  balance.xlm < 0.5 ? "text-destructive" : "text-green-400"
                }
              >
                {balance.balance} XLM
              </span>
              {balance.xlm < 0.5 && (
                <>
                  {" · "}
                  <a
                    href={`${FRIENDBOT_URL}?addr=${address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    Fund via Friendbot ↗
                  </a>
                </>
              )}
            </p>
          )}
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Name */}
              <FormField
                control={form.control}
                name="nftName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase text-muted-foreground">
                      Asset Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Cosmic Voyager #001"
                        className="bg-background font-mono"
                        {...field}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase text-muted-foreground">
                      Description
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the asset…"
                        className="bg-background resize-none"
                        rows={3}
                        {...field}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Image + Attributes + Preview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-4">
                  <div className="space-y-3">
                    <FormLabel className="font-mono text-xs uppercase text-muted-foreground">
                      NFT Image
                    </FormLabel>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={imageMode === "upload" ? "default" : "outline"}
                        className="font-mono text-xs"
                        onClick={() => {
                          setImageMode("upload");
                          setImageError(null);
                        }}
                        disabled={isPending}
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        Upload
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={imageMode === "url" ? "default" : "outline"}
                        className="font-mono text-xs"
                        onClick={() => {
                          setImageMode("url");
                          setImageError(null);
                        }}
                        disabled={isPending}
                      >
                        <Link2 className="w-3.5 h-3.5 mr-1.5" />
                        Image URL
                      </Button>
                    </div>

                    {imageMode === "upload" ? (
                      <div className="space-y-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          disabled={isPending}
                          onChange={e => {
                            void handleImageFile(e.target.files?.[0] ?? null);
                          }}
                        />
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={e => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onDrop={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleImageFile(e.dataTransfer.files?.[0] ?? null);
                          }}
                          className="w-full min-h-[110px] rounded-md border border-dashed border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-2 px-4 py-6 disabled:opacity-50"
                        >
                          <Upload className="w-5 h-5 text-muted-foreground" />
                          <span className="font-mono text-xs text-muted-foreground text-center">
                            {imageFile
                              ? imageFile.name
                              : "Click or drag an image here"}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground/70">
                            JPEG, PNG, WebP, GIF · max 5 MB
                          </span>
                        </button>
                        {imageFile && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="font-mono text-xs"
                            onClick={clearImage}
                            disabled={isPending}
                          >
                            Remove image
                          </Button>
                        )}
                      </div>
                    ) : (
                      <FormField
                        control={form.control}
                        name="imageUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="https://example.com/image.png"
                                className="bg-background font-mono text-xs"
                                {...field}
                                disabled={isPending}
                                onChange={e => {
                                  field.onChange(e);
                                  setImageFile(null);
                                  setImagePreview(null);
                                  setImageError(null);
                                }}
                              />
                            </FormControl>
                            <FormDescription className="text-[10px]">
                              Paste a public image link (http or https)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {imageError && (
                      <p className="font-mono text-xs text-destructive">
                        {imageError}
                      </p>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="attributes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">
                          Attributes (JSON)
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder='{"trait": "value"}'
                            className="bg-background font-mono text-xs"
                            {...field}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormDescription className="text-[10px]">
                          Optional — stored as transaction memo
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Image preview */}
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-xs uppercase text-muted-foreground font-medium">
                    Preview
                  </span>
                  <div className="flex-1 min-h-[120px] rounded border border-border bg-background flex items-center justify-center overflow-hidden">
                    {previewSrc ? (
                      <img
                        src={previewSrc}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={e => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="text-muted-foreground flex flex-col items-center gap-2">
                        <ImageIcon className="w-8 h-8 opacity-50" />
                        <span className="text-[10px] uppercase tracking-wider font-mono">
                          No Image
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-4 border-t border-border">
                {address ? (
                  <Button
                    type="submit"
                    className="w-full font-mono uppercase tracking-widest font-bold"
                    disabled={isPending || CONTRACT_NOT_DEPLOYED}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Transmitting…
                      </>
                    ) : (
                      "Execute Mint"
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full font-mono uppercase tracking-widest font-bold opacity-50 cursor-not-allowed"
                    disabled
                  >
                    Connect Wallet First
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* ─── Telemetry panel ─────────────────────────────────────────────── */}
      <Card className="border-border bg-card/50 backdrop-blur overflow-hidden relative">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:16px_16px]" />
        <CardHeader className="relative z-10 border-b border-border/50 pb-4">
          <CardTitle className="font-mono text-lg">Telemetry & Status</CardTitle>
          <CardDescription>Live transaction monitoring.</CardDescription>
        </CardHeader>

        <CardContent className="relative z-10 p-6 flex flex-col items-center justify-center min-h-[300px]">
          <AnimatePresence mode="wait">
            {/* ── Idle ──────────────────────────────────────────────────── */}
            {txState.status === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center text-muted-foreground flex flex-col items-center"
              >
                <div className="w-16 h-16 rounded-full border border-dashed border-border flex items-center justify-center mb-4">
                  <Activity className="w-8 h-8 opacity-20" />
                </div>
                <p className="font-mono text-sm">Awaiting payload…</p>
                {CONTRACT_NOT_DEPLOYED && (
                  <p className="font-mono text-[11px] text-yellow-500 mt-3 max-w-[220px] text-center">
                    Deploy the contract first and set
                    <br />
                    <code>VITE_CONTRACT_ADDRESS</code>
                  </p>
                )}
              </motion.div>
            )}

            {/* ── Pending ───────────────────────────────────────────────── */}
            {txState.status === "pending" && (
              <motion.div
                key="pending"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center flex flex-col items-center w-full"
              >
                <div className="relative w-24 h-24 flex items-center justify-center mb-6">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                  <div
                    className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin"
                    style={{ animationDuration: "3s" }}
                  />
                  <div
                    className="absolute inset-2 rounded-full border-r-2 border-secondary animate-spin"
                    style={{
                      animationDuration: "1.5s",
                      animationDirection: "reverse",
                    }}
                  />
                  <Loader2 className="w-8 h-8 text-primary animate-pulse" />
                </div>
                <h3 className="font-mono text-primary font-bold text-lg mb-2">
                  Broadcasting to Network
                </h3>
                <p className="font-mono text-xs text-muted-foreground max-w-[80%] mx-auto">
                  {txState.step}
                </p>
              </motion.div>
            )}

            {/* ── Success ───────────────────────────────────────────────── */}
            {txState.status === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center flex flex-col items-center w-full"
              >
                <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="font-mono text-green-400 font-bold text-xl mb-1">
                  Mint Successful
                </h3>
                {txState.imageUrl && (
                  <div className="w-28 h-28 rounded-lg border border-green-500/20 overflow-hidden mb-4">
                    <img
                      src={txState.imageUrl}
                      alt="Minted NFT"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {txState.tokenId !== undefined && (
                  <p className="font-mono text-sm text-muted-foreground mb-4">
                    Token ID: <span className="text-primary font-bold">#{txState.tokenId}</span>
                  </p>
                )}

                <div className="w-full bg-background rounded-lg border border-border overflow-hidden text-left">
                  <div className="px-4 py-2 border-b border-border bg-muted/20">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Transaction Receipt
                    </span>
                  </div>
                  <div className="p-4">
                    <span className="font-mono text-[10px] text-muted-foreground block">
                      Hash
                    </span>
                    <a
                      href={`${STELLAR_EXPERT_BASE}/tx/${txState.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-primary hover:underline flex items-center gap-1 break-all mt-1"
                    >
                      {txState.txHash}
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="mt-6 font-mono"
                  onClick={() => setTxState({ status: "idle" })}
                >
                  Mint Another
                </Button>
              </motion.div>
            )}

            {/* ── Error ─────────────────────────────────────────────────── */}
            {txState.status === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center flex flex-col items-center w-full"
              >
                <div className="w-20 h-20 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-4">
                  <XCircle className="w-10 h-10 text-destructive" />
                </div>
                <h3 className="font-mono text-destructive font-bold text-xl mb-1">
                  Mint Failed
                </h3>
                <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider mb-3">
                  {txState.code}
                </p>

                <div className="w-full bg-destructive/5 rounded-lg border border-destructive/20 p-4 text-left mb-3">
                  <p className="font-mono text-[11px] text-destructive/70 font-medium uppercase tracking-wider mb-1">
                    Error
                  </p>
                  <p className="font-mono text-sm text-foreground">
                    {txState.message}
                  </p>
                </div>

                <div className="w-full bg-muted/10 rounded-lg border border-border p-4 text-left">
                  <p className="font-mono text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1">
                    Suggestion
                  </p>
                  <p className="font-mono text-xs text-foreground">
                    {txState.suggestion}
                  </p>
                </div>

                <Button
                  variant="outline"
                  className="mt-6 font-mono"
                  onClick={() => setTxState({ status: "idle" })}
                >
                  Acknowledge & Reset
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
