// ─── Activity Feed ────────────────────────────────────────────────────────────
//
// Polls Soroban contract events every 10 s and shows the most recent mints.
// Each row lazy-fetches NFT metadata via a separate query to display the image.

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLink,
  Clock,
  AlertTriangle,
  Hexagon,
} from "lucide-react";
import {
  getMintEvents,
  getNFTMetadata,
  type MintEvent,
} from "@/lib/contract";
import { getLatestLedger } from "@/lib/stellar";
import { CONTRACT_NOT_DEPLOYED, STELLAR_EXPERT_BASE } from "@/lib/constants";

function truncate(s: string, front = 6, back = 4): string {
  if (!s) return "–";
  if (s.length <= front + back + 3) return s;
  return `${s.slice(0, front)}…${s.slice(-back)}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ActivityFeed() {
  const { data: ledger } = useQuery({
    queryKey: ["latest_ledger"],
    queryFn: getLatestLedger,
    refetchInterval: 10_000,
  });

  const startLedger = ledger ? Math.max(1, ledger - 10_000) : 0;

  const { data: events, isLoading } = useQuery({
    queryKey: ["mint_events", startLedger],
    queryFn: () => getMintEvents(startLedger),
    refetchInterval: 10_000,
    enabled: !CONTRACT_NOT_DEPLOYED && startLedger > 0,
  });

  const sortedEvents = events ? [...events].reverse() : [];

  return (
    <Card className="border-border bg-card/50 backdrop-blur flex flex-col h-[500px]">
      <CardHeader className="border-b border-border/50 pb-4 shrink-0">
        <CardTitle className="font-mono text-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live Ledger Feed
        </CardTitle>
        <p className="text-[11px] text-muted-foreground font-mono">
          Soroban contract events · refreshes every 10 s
        </p>
      </CardHeader>

      <CardContent className="p-0 overflow-y-auto flex-1">
        {CONTRACT_NOT_DEPLOYED ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center gap-3">
            <AlertTriangle className="w-8 h-8 opacity-40 text-yellow-500" />
            <p className="font-mono text-sm font-semibold">Contract not deployed</p>
            <p className="font-mono text-xs opacity-60 max-w-[220px] text-center">
              Run <code className="bg-muted/30 px-1">scripts/deploy-contract.mjs</code>{" "}
              and set the <code className="bg-muted/30 px-1">VITE_CONTRACT_ADDRESS</code>{" "}
              env var.
            </p>
          </div>
        ) : isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="flex gap-4 p-3 rounded-lg border border-border/50 bg-background/50"
              >
                <Skeleton className="w-12 h-12 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedEvents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
            <Clock className="w-8 h-8 opacity-20 mb-3" />
            <p className="font-mono text-sm">No mints detected yet.</p>
            <p className="font-mono text-xs opacity-60 mt-1">
              Mint your first NFT to see it here!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {sortedEvents.map(event => (
              <ActivityEventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Single event row ─────────────────────────────────────────────────────────

function ActivityEventRow({ event }: { event: MintEvent }) {
  const { data: metadata } = useQuery({
    queryKey: ["nft_metadata", event.tokenId],
    queryFn: () => getNFTMetadata(event.tokenId),
    enabled: event.tokenId > 0,
    staleTime: Infinity,
  });

  return (
    <div className="p-4 flex gap-4 hover:bg-muted/10 transition-colors">
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded border border-border overflow-hidden bg-muted/30 flex-shrink-0 flex items-center justify-center">
        {metadata?.imageUrl ? (
          <img
            src={metadata.imageUrl}
            alt={metadata.name}
            className="w-full h-full object-cover"
            onError={e => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <Hexagon className="w-6 h-6 text-muted-foreground opacity-40" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1">
          <h4 className="font-mono text-sm font-bold truncate text-foreground pr-2">
            {metadata?.name || `NFT #${event.tokenId}`}
          </h4>
          <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
            #{event.tokenId}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-mono text-muted-foreground">
              Minter
            </span>
            <span
              className="font-mono text-xs text-secondary truncate"
              title={event.owner}
            >
              {truncate(event.owner)}
            </span>
          </div>
          <div className="flex flex-col items-end text-right">
            <span className="text-[9px] uppercase font-mono text-muted-foreground">
              Ledger
            </span>
            <a
              href={`${STELLAR_EXPERT_BASE}/ledger/${event.ledger}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
            >
              {event.ledger.toLocaleString()}
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
