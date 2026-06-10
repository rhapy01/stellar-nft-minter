import { Header } from "@/components/header";
import { StatsBar } from "@/components/stats-bar";
import { MintPanel } from "@/components/mint-panel";
import { ActivityFeed } from "@/components/activity-feed";

export default function Home() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/8 via-background to-background" />

      <div className="relative z-10 flex flex-col flex-1">
        <Header />

        <main className="flex-1 container mx-auto px-6 py-10 md:py-14 max-w-6xl">
          <div className="mb-10 space-y-4">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
                Mint your NFT
              </h1>
              <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
                Create and mint NFTs on Stellar Testnet with Soroban smart
                contracts. Connect a wallet, upload an image, and go.
              </p>
            </div>
            <StatsBar />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-12">
            <div className="lg:col-span-3">
              <MintPanel />
            </div>
            <div className="lg:col-span-2">
              <ActivityFeed />
            </div>
          </div>
        </main>

        <footer className="py-8 text-center text-xs text-muted-foreground border-t border-border/40">
          Stellar NFT Minter · {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
