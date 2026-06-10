import { useWallet, type WalletType } from "./wallet-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LogOut, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getSupportedWallets,
  WALLET_TYPE_TO_ID,
  WALLET_LABELS,
} from "@/lib/wallet";

const WALLET_OPTIONS: WalletType[] = ["freighter", "albedo"];

export function Header() {
  const { address, isConnecting, connect, disconnect } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availability, setAvailability] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    if (!isModalOpen) return;
    void getSupportedWallets().then(wallets => {
      const map: Record<string, boolean> = {};
      for (const w of wallets) map[w.id] = w.isAvailable;
      setAvailability(map);
    });
  }, [isModalOpen]);

  const truncateAddress = (addr: string) =>
    `${addr.substring(0, 6)}…${addr.substring(addr.length - 4)}`;

  return (
    <header className="border-b border-border/40 bg-background/70 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between max-w-6xl">
        <span className="font-semibold text-lg tracking-tight">
          Stellar<span className="text-primary">Minter</span>
        </span>

        <div>
          {address ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-muted-foreground">{truncateAddress(address)}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Disconnect</span>
              </Button>
            </div>
          ) : (
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Wallet className="w-4 h-4" />
                  Connect wallet
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Connect wallet</DialogTitle>
                  <DialogDescription>
                    Choose a wallet to connect to Stellar Testnet.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2 mt-2">
                  {WALLET_OPTIONS.map(type => {
                    const walletId = WALLET_TYPE_TO_ID[type];
                    const label = WALLET_LABELS[type];
                    const unavailable =
                      type === "freighter" &&
                      isModalOpen &&
                      availability[walletId] === false;

                    return (
                      <Button
                        key={type}
                        variant="outline"
                        className="h-12 justify-start"
                        onClick={() => {
                          connect(type);
                          setIsModalOpen(false);
                        }}
                        disabled={isConnecting || unavailable}
                      >
                        {label}
                        {unavailable && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            Not installed
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </header>
  );
}
