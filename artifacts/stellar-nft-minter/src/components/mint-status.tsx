import { motion } from "framer-motion";
import {
  CheckCircle2,
  Loader2,
  XCircle,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { STELLAR_EXPERT_BASE } from "@/lib/constants";
import type { MintError } from "@/lib/errors";

export type MintStatusState =
  | { status: "idle" }
  | { status: "pending"; step: string }
  | { status: "success"; txHash: string; tokenId?: number; imageUrl?: string }
  | ({ status: "error" } & MintError);

interface MintStatusProps {
  state: MintStatusState;
  onReset: () => void;
}

export function MintStatus({ state, onReset }: MintStatusProps) {
  if (state.status === "idle") return null;

  const borderClass =
    state.status === "success"
      ? "border-green-500/30 bg-green-500/5"
      : state.status === "error"
        ? "border-destructive/30 bg-destructive/5"
        : "border-primary/30 bg-primary/5";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-5 ${borderClass}`}
    >
      {state.status === "pending" && (
        <div className="flex items-start gap-4">
          <Loader2 className="w-5 h-5 text-primary animate-spin mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-foreground">Mint in progress</p>
            <p className="text-sm text-muted-foreground mt-1">{state.step}</p>
          </div>
        </div>
      )}

      {state.status === "success" && (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            {state.imageUrl ? (
              <img
                src={state.imageUrl}
                alt="Minted NFT"
                className="w-16 h-16 rounded-lg object-cover border border-green-500/20 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-green-400">Mint successful</p>
              {state.tokenId !== undefined && (
                <p className="text-sm text-muted-foreground mt-1">
                  Token #{state.tokenId}
                </p>
              )}
              <a
                href={`${STELLAR_EXPERT_BASE}/tx/${state.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2 break-all"
              >
                {state.txHash.slice(0, 16)}…{state.txHash.slice(-8)}
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onReset}>
            Mint another
          </Button>
        </div>
      )}

      {state.status === "error" && (
        <div className="space-y-3">
          <div className="flex items-start gap-4">
            <XCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-destructive">{state.message}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {state.suggestion}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onReset}>
            Try again
          </Button>
        </div>
      )}
    </motion.div>
  );
}

export function MintIdleHint() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
      <Sparkles className="w-4 h-4 text-primary shrink-0" />
      <span>Fill in the details below and mint your NFT on Stellar Testnet.</span>
    </div>
  );
}
