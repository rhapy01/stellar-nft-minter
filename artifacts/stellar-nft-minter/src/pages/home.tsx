import { Header } from "@/components/header";
import { StatsBar } from "@/components/stats-bar";
import { MintPanel } from "@/components/mint-panel";
import { ActivityFeed } from "@/components/activity-feed";
import { useWallet } from "@/components/wallet-context";

export default function Home() {
  const { address } = useWallet();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative selection:bg-primary/30 selection:text-primary-foreground">
      {/* Dynamic background noise/grid */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-20" style={{ 
        backgroundImage: 'radial-gradient(circle at center, var(--primary) 0, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />
      
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 rounded-full blur-[120px] pointer-events-none z-0" />

      <div className="relative z-10 flex flex-col flex-1">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl flex flex-col gap-8">
          <section>
            <StatsBar />
          </section>

          {!address && (
            <div className="w-full p-4 rounded-md border border-secondary/30 bg-secondary/5 text-secondary font-mono text-sm flex items-center justify-center">
              Connect a wallet to begin initializing mint transactions.
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2">
              <MintPanel />
            </div>
            <div className="xl:col-span-1">
              <ActivityFeed />
            </div>
          </div>
        </main>
        
        <footer className="py-6 border-t border-border/50 text-center font-mono text-xs text-muted-foreground">
          Stellar Minter Terminal v1.0.0 &copy; {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
