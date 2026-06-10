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
import { classifyError } from "@/lib/errors";
import {
  CONTRACT_NOT_DEPLOYED,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Image as ImageIcon, Upload, Link2 } from "lucide-react";
import {
  compressImageFile,
  resolveMintImageUrl,
  validateImageFile,
} from "@/lib/image";
import { MintStatus, MintIdleHint, type MintStatusState } from "./mint-status";

const formSchema = z.object({
  nftName: z.string().min(1, "Name is required").max(64, "Max 64 characters"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Max 500 characters"),
  imageUrl: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function truncateAddress(addr: string) {
  return `${addr.slice(0, 8)}…${addr.slice(-8)}`;
}

export function MintPanel() {
  const { address, signTx } = useWallet();
  const queryClient = useQueryClient();
  const [txState, setTxState] = useState<MintStatusState>({ status: "idle" });
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
    defaultValues: { nftName: "", description: "", imageUrl: "" },
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

      setTxState({ status: "pending", step: "Preparing NFT image…" });
      const imageUrl = await resolveMintImageUrl({
        file: imageMode === "upload" ? imageFile : null,
        url: imageMode === "url" ? data.imageUrl : undefined,
      });

      setTxState({ status: "pending", step: "Building transaction…" });
      const preparedXdr = await buildMintTransaction(
        address,
        data.nftName,
        data.description,
        imageUrl,
      );

      setTxState({ status: "pending", step: "Waiting for wallet approval…" });
      const signedXdr = await signTx(preparedXdr);

      setTxState({ status: "pending", step: "Submitting to testnet…" });
      const sendResult = await submitSignedTransaction(signedXdr);
      if (sendResult.status === "ERROR") {
        throw new Error(
          `Submission failed: ${(sendResult as { errorResultXdr?: string }).errorResultXdr ?? "unknown"}`,
        );
      }

      setTxState({ status: "pending", step: "Confirming on ledger…" });
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
        queryClient.invalidateQueries({ queryKey: ["total_supply"] });
        queryClient.invalidateQueries({ queryKey: ["mint_events"] });
      } else if (final.status === "FAILED") {
        throw new Error(
          `Transaction failed on-chain: ${final.resultXdr ?? "unknown reason"}`,
        );
      } else {
        throw new Error(
          "Confirmation timed out. Check Stellar Expert for status.",
        );
      }
    } catch (err: unknown) {
      setTxState({ status: "error", ...classifyError(err) });
    }
  };

  return (
    <Card className="border-border/60 bg-card/60 shadow-xl shadow-black/10 overflow-hidden">
      {address && balance && (
        <div className="border-b border-border/50 px-6 py-6 md:px-8">
          <p className="text-xs font-medium text-muted-foreground tracking-wide">
            Available balance
          </p>
          <p className="text-3xl md:text-4xl font-semibold tracking-tight mt-2">
            {balance.balance}{" "}
            <span className="text-lg text-muted-foreground font-normal">
              XLM
            </span>
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            {truncateAddress(address)}
            {balance.xlm < 0.5 && (
              <>
                {" · "}
                <a
                  href={`${FRIENDBOT_URL}?addr=${address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Fund with Friendbot
                </a>
              </>
            )}
          </p>
        </div>
      )}

      <CardContent className="p-6 md:p-8 space-y-8">
        {txState.status === "idle" && address && <MintIdleHint />}
        <MintStatus
          state={txState}
          onReset={() => setTxState({ status: "idle" })}
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="nftName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Cosmic Voyager #001"
                      className="h-11 bg-background/80"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What makes this NFT special?"
                      className="bg-background/80 resize-none min-h-[100px]"
                      rows={4}
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <Label>Image</Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div
                  className={`aspect-square rounded-xl border bg-background/50 overflow-hidden flex items-center justify-center ${
                    previewSrc ? "border-border" : "border-dashed border-border/80"
                  }`}
                >
                  {previewSrc ? (
                    <img
                      src={previewSrc}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-muted-foreground p-6">
                      <ImageIcon className="w-10 h-10 mx-auto opacity-30 mb-3" />
                      <p className="text-sm">Preview appears here</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4 flex flex-col justify-center">
                  <div className="flex rounded-lg border border-border/60 p-1 bg-muted/30">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setImageMode("upload");
                        setImageError(null);
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
                        imageMode === "upload"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      Upload
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setImageMode("url");
                        setImageError(null);
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
                        imageMode === "url"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Link2 className="w-4 h-4" />
                      URL
                    </button>
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
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-11"
                        disabled={isPending}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Choose file
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        JPEG, PNG, WebP, GIF · max 5 MB
                      </p>
                      {imageFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={clearImage}
                          disabled={isPending}
                        >
                          Remove
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
                              className="h-11 bg-background/80"
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
                          <FormDescription>
                            Public image link (http or https)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {imageError && (
                    <p className="text-sm text-destructive">{imageError}</p>
                  )}
                </div>
              </div>
            </div>

            {address ? (
              <Button
                type="submit"
                size="lg"
                className="w-full h-12 text-base font-medium"
                disabled={isPending || CONTRACT_NOT_DEPLOYED}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Minting…
                  </>
                ) : (
                  "Mint NFT"
                )}
              </Button>
            ) : (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                Connect your wallet using the button in the header to start
                minting.
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
