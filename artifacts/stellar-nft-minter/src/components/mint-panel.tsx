import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useCreateMint, useUpdateMint } from "@workspace/api-client-react";
import { useWallet } from "./wallet-context";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, CheckCircle2, Loader2, XCircle, ExternalLink, Image as ImageIcon } from "lucide-react";

const formSchema = z.object({
  nftName: z.string().min(1, "Name is required").max(100),
  description: z.string().min(1, "Description is required").max(1000),
  imageUrl: z.string().url("Must be a valid URL"),
  attributes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function MintPanel() {
  const { address } = useWallet();
  const createMint = useCreateMint();
  const updateMint = useUpdateMint();

  const [txState, setTxState] = useState<{
    status: "idle" | "pending" | "success" | "error";
    mintId?: number;
    txHash?: string;
    errorMessage?: string;
  }>({ status: "idle" });

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

  const onSubmit = async (data: FormValues) => {
    if (!address) return;

    setTxState({ status: "pending" });

    try {
      // 1. Create the mint record
      const mintRecord = await createMint.mutateAsync({
        data: {
          walletAddress: address,
          nftName: data.nftName,
          description: data.description,
          imageUrl: data.imageUrl,
          attributes: data.attributes || undefined,
          network: "testnet",
        }
      });

      setTxState(prev => ({ ...prev, mintId: mintRecord.id }));

      // 2. Simulate transaction taking 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Simulate a random failure 10% of the time
      if (Math.random() < 0.1) {
        throw new Error("Contract execution failed: Invalid signature");
      }

      const mockTxHash = Array.from({length: 64}, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');

      // 3. Update the mint record
      await updateMint.mutateAsync({
        id: mintRecord.id,
        data: {
          status: "success",
          txHash: mockTxHash,
          nftId: `T-${mockTxHash.substring(0, 8)}`,
        }
      });

      setTxState({ status: "success", mintId: mintRecord.id, txHash: mockTxHash });
      form.reset();

    } catch (err: any) {
      const errorMessage = err.message || "An unknown error occurred";
      
      if (txState.mintId) {
        await updateMint.mutateAsync({
          id: txState.mintId,
          data: {
            status: "failed",
            errorMessage: errorMessage,
          }
        }).catch(console.error);
      }

      setTxState(prev => ({ ...prev, status: "error", errorMessage }));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form Panel */}
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-mono text-lg text-primary">Initialize Mint</CardTitle>
          <CardDescription>Enter the details for your new digital asset.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="nftName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Asset Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Cosmic Voyager #001" className="bg-background font-mono" {...field} disabled={txState.status === "pending"} />
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
                    <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe the asset..." className="bg-background resize-none" {...field} disabled={txState.status === "pending"} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-4">
                  <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Image URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." className="bg-background font-mono text-xs" {...field} disabled={txState.status === "pending"} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="attributes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Attributes (JSON)</FormLabel>
                        <FormControl>
                          <Input placeholder='{"trait": "value"}' className="bg-background font-mono text-xs" {...field} disabled={txState.status === "pending"} />
                        </FormControl>
                        <FormDescription className="text-[10px]">Optional key-value pairs</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-xs uppercase text-muted-foreground font-medium">Preview</span>
                  <div className="flex-1 min-h-[120px] rounded border border-border bg-background flex items-center justify-center overflow-hidden relative">
                    {watchImageUrl ? (
                      <img 
                        src={watchImageUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`text-muted-foreground flex flex-col items-center gap-2 ${watchImageUrl ? 'hidden' : ''}`}>
                      <ImageIcon className="w-8 h-8 opacity-50" />
                      <span className="text-[10px] uppercase tracking-wider font-mono">No Image</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                {address ? (
                  <Button type="submit" className="w-full font-mono uppercase tracking-widest font-bold" disabled={txState.status === "pending"}>
                    {txState.status === "pending" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Transmitting...
                      </>
                    ) : (
                      "Execute Mint"
                    )}
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" className="w-full font-mono uppercase tracking-widest font-bold opacity-50 cursor-not-allowed" disabled>
                    Wallet Required
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Transaction Status Panel */}
      <Card className="border-border bg-card/50 backdrop-blur overflow-hidden relative">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:16px_16px]" />
        <CardHeader className="relative z-10 border-b border-border/50 pb-4">
          <CardTitle className="font-mono text-lg">Telemetry & Status</CardTitle>
          <CardDescription>Live transaction monitoring.</CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 p-6 flex flex-col items-center justify-center min-h-[300px]">
          <AnimatePresence mode="wait">
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
                <p className="font-mono text-sm">Awaiting payload...</p>
              </motion.div>
            )}

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
                  <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" style={{ animationDuration: '3s' }} />
                  <div className="absolute inset-2 rounded-full border-r-2 border-secondary animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                  <Loader2 className="w-8 h-8 text-primary animate-pulse" />
                </div>
                <h3 className="font-mono text-primary font-bold text-lg mb-2">Broadcasting to Network</h3>
                <p className="font-mono text-xs text-muted-foreground max-w-[80%] mx-auto">
                  Awaiting consensus from Stellar Testnet validators. Please sign the transaction in your wallet if prompted.
                </p>
                {txState.mintId && (
                  <div className="mt-6 px-4 py-2 bg-background rounded border border-border w-full flex justify-between items-center text-xs font-mono">
                    <span className="text-muted-foreground">ID</span>
                    <span>#{txState.mintId}</span>
                  </div>
                )}
              </motion.div>
            )}

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
                <h3 className="font-mono text-green-400 font-bold text-xl mb-2">Mint Successful</h3>
                <p className="font-mono text-sm text-muted-foreground mb-6">
                  Asset has been secured on the ledger.
                </p>
                
                <div className="w-full bg-background rounded-lg border border-border overflow-hidden text-left">
                  <div className="px-4 py-2 border-b border-border bg-muted/20">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Transaction Receipt</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[10px] text-muted-foreground">Hash</span>
                      <a 
                        href={`https://stellar.expert/explorer/testnet/tx/${txState.txHash}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="font-mono text-xs text-primary hover:underline flex items-center gap-1 break-all"
                      >
                        {txState.txHash}
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </div>
                  </div>
                </div>
                
                <Button variant="outline" className="mt-6 font-mono" onClick={() => setTxState({ status: "idle" })}>
                  Mint Another
                </Button>
              </motion.div>
            )}

            {txState.status === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center flex flex-col items-center w-full"
              >
                <div className="w-20 h-20 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-6">
                  <XCircle className="w-10 h-10 text-destructive" />
                </div>
                <h3 className="font-mono text-destructive font-bold text-xl mb-2">Mint Failed</h3>
                
                <div className="w-full bg-destructive/5 rounded-lg border border-destructive/20 p-4 text-left mt-2 mb-6">
                  <p className="font-mono text-xs text-destructive/80 font-medium">Error Details:</p>
                  <p className="font-mono text-sm text-foreground mt-1">{txState.errorMessage}</p>
                </div>
                
                <Button variant="outline" className="font-mono" onClick={() => setTxState({ status: "idle" })}>
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
