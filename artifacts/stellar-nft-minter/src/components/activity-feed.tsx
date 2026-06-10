import { useGetRecentMints } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Clock, ImageIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function ActivityFeed() {
  const { data: mints, isLoading } = useGetRecentMints({
    query: { refetchInterval: 10000 }
  });

  const truncateAddress = (addr: string) => `${addr.substring(0, 5)}...${addr.substring(addr.length - 4)}`;
  const truncateHash = (hash: string) => `${hash.substring(0, 8)}...${hash.substring(hash.length - 6)}`;

  return (
    <Card className="border-border bg-card/50 backdrop-blur flex flex-col h-[500px]">
      <CardHeader className="border-b border-border/50 pb-4 shrink-0">
        <CardTitle className="font-mono text-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live Ledger Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-y-auto flex-1">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex gap-4 p-3 rounded-lg border border-border/50 bg-background/50">
                <Skeleton className="w-12 h-12 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : !mints || mints.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
            <Clock className="w-8 h-8 opacity-20 mb-3" />
            <p className="font-mono text-sm">No recent activity detected on the network.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {mints.map(mint => (
              <div key={mint.id} className="p-4 flex gap-4 hover:bg-muted/10 transition-colors">
                <div className="w-14 h-14 rounded border border-border overflow-hidden bg-muted/30 flex-shrink-0 flex items-center justify-center">
                  {mint.imageUrl ? (
                    <img src={mint.imageUrl} alt={mint.nftName} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-muted-foreground opacity-50" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-mono text-sm font-bold truncate text-foreground pr-4">
                      {mint.nftName}
                    </h4>
                    <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(mint.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2">
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase font-mono text-muted-foreground">Minter</span>
                      <span className="font-mono text-xs text-secondary truncate" title={mint.walletAddress}>
                        {truncateAddress(mint.walletAddress)}
                      </span>
                    </div>
                    
                    {mint.txHash && (
                      <div className="flex flex-col items-end text-right">
                        <span className="text-[9px] uppercase font-mono text-muted-foreground">Transaction</span>
                        <a 
                          href={`https://stellar.expert/explorer/testnet/tx/${mint.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-primary hover:underline flex items-center gap-1 truncate max-w-full"
                          title={mint.txHash}
                        >
                          {truncateHash(mint.txHash)}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
