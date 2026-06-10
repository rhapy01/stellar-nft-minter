import { useWallet } from "./wallet-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Activity, LogOut, Wallet } from "lucide-react";
import { useState } from "react";

export function Header() {
  const { address, isConnecting, connect, disconnect } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const truncateAddress = (addr: string) => `${addr.substring(0, 5)}...${addr.substring(addr.length - 4)}`;

  return (
    <header className="border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center border border-primary/50 text-primary">
            <Activity className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight font-mono">STELLAR<span className="text-primary">MINTER</span></span>
          <div className="ml-4 px-2 py-1 rounded-sm bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-mono uppercase font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            Testnet
          </div>
        </div>

        <div>
          {address ? (
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded bg-muted/30 border border-border flex items-center gap-2 text-sm font-mono">
                <Wallet className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{truncateAddress(address)}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={disconnect} title="Disconnect" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button className="font-mono uppercase text-xs tracking-wider" variant="outline">
                  Connect Wallet
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="font-mono text-xl">Connect Wallet</DialogTitle>
                  <DialogDescription>
                    Select a wallet provider to connect to the Stellar Testnet.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 mt-4">
                  <Button 
                    variant="outline" 
                    className="h-16 justify-start px-6 gap-4 text-lg bg-background hover:bg-primary/10 hover:border-primary hover:text-primary transition-all"
                    onClick={() => {
                      connect("freighter");
                      setIsModalOpen(false);
                    }}
                    disabled={isConnecting}
                  >
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                      <span className="font-bold text-xl leading-none -mt-0.5">F</span>
                    </div>
                    Freighter
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-16 justify-start px-6 gap-4 text-lg bg-background hover:bg-secondary/10 hover:border-secondary hover:text-secondary transition-all"
                    onClick={() => {
                      connect("albedo");
                      setIsModalOpen(false);
                    }}
                    disabled={isConnecting}
                  >
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                      <span className="font-bold text-xl leading-none -mt-0.5">A</span>
                    </div>
                    Albedo
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </header>
  );
}
