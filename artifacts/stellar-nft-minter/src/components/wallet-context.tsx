// ─── Wallet Context ───────────────────────────────────────────────────────────
//
// React state layer on top of StellarWalletsKit (Freighter + Albedo).

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  type WalletType,
  connectWallet,
  disconnectWallet,
  signTransactionXdr,
  onWalletStateChange,
  initWalletKit,
} from "@/lib/wallet";
import { classifyError } from "@/lib/errors";

interface WalletContextState {
  address: string | null;
  walletType: WalletType | null;
  isConnecting: boolean;
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => void;
  /** Sign a prepared transaction XDR and return the signed XDR. */
  signTx: (xdr: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextState | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    initWalletKit();
    return onWalletStateChange(kitAddress => {
      if (!kitAddress) {
        setAddress(null);
        setWalletType(null);
      }
    });
  }, []);

  const connect = useCallback(async (type: WalletType) => {
    setIsConnecting(true);
    try {
      const pubkey = await connectWallet(type);
      setAddress(pubkey);
      setWalletType(type);

      toast.success(
        type === "freighter" ? "Freighter Connected" : "Albedo Connected",
        {
          description: `Connected to Stellar Testnet · ${pubkey.slice(0, 6)}…${pubkey.slice(-4)}`,
        },
      );
    } catch (err: unknown) {
      const classified = classifyError(err);
      if (classified.code === "WALLET_NOT_FOUND") {
        toast.error("Wallet Not Found", { description: classified.suggestion });
      } else if (classified.code === "USER_DENIED") {
        toast.error("Connection Cancelled", {
          description: classified.suggestion,
        });
      } else {
        toast.error("Connection Failed", { description: classified.message });
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    void disconnectWallet();
    setAddress(null);
    setWalletType(null);
    toast.info("Wallet Disconnected");
  }, []);

  const signTx = useCallback(
    async (xdr: string): Promise<string> => {
      if (!address) throw new Error("No wallet connected");
      return signTransactionXdr(xdr, address);
    },
    [address],
  );

  return (
    <WalletContext.Provider
      value={{ address, walletType, isConnecting, connect, disconnect, signTx }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

export type { WalletType };
