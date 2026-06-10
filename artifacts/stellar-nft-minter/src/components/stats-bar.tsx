import { useGetMintStats } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, CheckCircle, XCircle, Users } from "lucide-react";

export function StatsBar() {
  const { data: stats, isLoading } = useGetMintStats({
    query: { refetchInterval: 10000 }
  });

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4 border-border/50 bg-card/50 backdrop-blur">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>
    );
  }

  const statItems = [
    { label: "Total Mints", value: stats.totalMints, icon: Activity, color: "text-primary" },
    { label: "Successful", value: stats.successfulMints, icon: CheckCircle, color: "text-green-400" },
    { label: "Failed", value: stats.failedMints, icon: XCircle, color: "text-destructive" },
    { label: "Unique Wallets", value: stats.uniqueWallets, icon: Users, color: "text-secondary" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((item, i) => {
        const Icon = item.icon;
        return (
          <Card key={i} className="p-4 border-border/50 bg-card/50 backdrop-blur hover:border-primary/30 transition-colors flex items-center gap-4">
            <div className={`p-3 rounded-md bg-muted/30 ${item.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">{item.label}</p>
              <p className="text-2xl font-bold font-mono mt-1">{item.value}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
