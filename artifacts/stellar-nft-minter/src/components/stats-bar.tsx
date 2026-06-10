// ─── Stats Bar ───────────────────────────────────────────────────────────────
//
// Reads live data directly from the Stellar Testnet:
//   • Total NFTs minted  → Soroban contract `total_supply()`
//   • Latest ledger      → Soroban RPC `getLatestLedger()`
//   • Network indicator  → static Testnet label
//   • Protocol           → Soroban label

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Globe, Zap, Code2 } from "lucide-react";
import { getTotalSupply } from "@/lib/contract";
import { getLatestLedger } from "@/lib/stellar";
import { CONTRACT_NOT_DEPLOYED } from "@/lib/constants";

export function StatsBar() {
  const { data: totalSupply, isLoading: loadingSupply } = useQuery({
    queryKey: ["total_supply"],
    queryFn: getTotalSupply,
    refetchInterval: 15_000,
    enabled: !CONTRACT_NOT_DEPLOYED,
  });

  const { data: ledger, isLoading: loadingLedger } = useQuery({
    queryKey: ["latest_ledger"],
    queryFn: getLatestLedger,
    refetchInterval: 5_000,
  });

  const stats = [
    {
      label: "NFTs Minted",
      value: CONTRACT_NOT_DEPLOYED
        ? "–"
        : loadingSupply
          ? null
          : String(totalSupply ?? 0),
      icon: Activity,
      color: "text-primary",
    },
    {
      label: "Network",
      value: "TESTNET",
      icon: Globe,
      color: "text-secondary",
    },
    {
      label: "Latest Ledger",
      value: loadingLedger ? null : (ledger?.toLocaleString() ?? "–"),
      icon: Zap,
      color: "text-yellow-400",
    },
    {
      label: "Smart Contract",
      value: "Soroban",
      icon: Code2,
      color: "text-violet-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((item, i) => {
        const Icon = item.icon;
        return (
          <Card
            key={i}
            className="p-4 border-border/50 bg-card/50 backdrop-blur hover:border-primary/30 transition-colors flex items-center gap-4"
          >
            <div className={`p-3 rounded-md bg-muted/30 ${item.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
                {item.label}
              </p>
              {item.value === null ? (
                <Skeleton className="h-7 w-16 mt-1" />
              ) : (
                <p className="text-xl font-bold font-mono mt-1">{item.value}</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
