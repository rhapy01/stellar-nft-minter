import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Clock, Hexagon } from "lucide-react";
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
    <Card className="border-border/60 bg-card/60 flex flex-col lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)]">
      <CardHeader className="pb-4 shrink-0">
        <CardTitle className="text-lg font-semibold">Recent mints</CardTitle>
        <p className="text-sm text-muted-foreground">
          Updates every 10 seconds
        </p>
      </CardHeader>

      <CardContent className="p-0 overflow-y-auto flex-1 min-h-[280px]">
        {CONTRACT_NOT_DEPLOYED ? (
          <div className="h-full flex items-center justify-center text-muted-foreground p-8 text-center text-sm">
            Contract not configured
          </div>
        ) : isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3 p-3">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedEvents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
            <Clock className="w-8 h-8 opacity-25 mb-3" />
            <p className="text-sm">No mints yet</p>
            <p className="text-xs mt-1 opacity-70">
              Your mints will show up here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {sortedEvents.map(event => (
              <ActivityEventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityEventRow({ event }: { event: MintEvent }) {
  const { data: metadata } = useQuery({
    queryKey: ["nft_metadata", event.tokenId],
    queryFn: () => getNFTMetadata(event.tokenId),
    enabled: event.tokenId > 0,
    staleTime: Infinity,
  });

  return (
    <div className="px-4 py-4 flex gap-3 hover:bg-muted/10 transition-colors">
      <div className="w-12 h-12 rounded-lg border border-border/60 overflow-hidden bg-muted/30 shrink-0 flex items-center justify-center">
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
          <Hexagon className="w-5 h-5 text-muted-foreground opacity-40" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between gap-2">
          <p className="font-medium text-sm truncate">
            {metadata?.name || `NFT #${event.tokenId}`}
          </p>
          <span className="text-xs text-muted-foreground shrink-0">
            #{event.tokenId}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {truncate(event.owner)}
        </p>
        <a
          href={`${STELLAR_EXPERT_BASE}/ledger/${event.ledger}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5"
        >
          Ledger {event.ledger.toLocaleString()}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
