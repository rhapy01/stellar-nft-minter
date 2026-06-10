import { createContext, useContext, useState, ReactNode } from "react";
import { toast } from "sonner";

export type WalletType = "freighter" | "albedo" | null;

interface WalletContextState {
  address: string | null;
  walletType: WalletType;
  isConnecting: boolean;
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextState | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = async (type: WalletType) => {
    setIsConnecting(true);
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Simulate random connection error 10% of the time
    if (Math.random() < 0.1) {
      setIsConnecting(false);
      toast.error(`Failed to connect to ${type === 'freighter' ? 'Freighter' : 'Albedo'}`, {
        description: "Please make sure the extension is installed and unlocked."
      });
      return;
    }

    const mockAddress = `G${Array.from({length: 55}, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]).join('')}`;
    setAddress(mockAddress);
    setWalletType(type);
    setIsConnecting(false);
    toast.success("Wallet Connected", {
      description: `Successfully connected to ${type === 'freighter' ? 'Freighter' : 'Albedo'}`
    });
  };

  const disconnect = () => {
    setAddress(null);
    setWalletType(null);
    toast.info("Wallet Disconnected");
  };

  return (
    <WalletContext.Provider value={{ address, walletType, isConnecting, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
