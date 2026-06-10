import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
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

  const items = [
    {
      label: "Minted",
      value: loadingSupply ? null : String(totalSupply ?? 0),
    },
    {
      label: "Ledger",
      value: loadingLedger ? null : (ledger?.toLocaleString() ?? "–"),
    },
    { label: "Network", value: "Testnet" },
    { label: "Protocol", value: "Soroban" },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {items.map(item => (
        <div
          key={item.label}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-4 py-2 text-sm"
        >
          <span className="text-muted-foreground">{item.label}</span>
          {item.value === null ? (
            <Skeleton className="h-4 w-12" />
          ) : (
            <span className="font-medium text-foreground">{item.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}
