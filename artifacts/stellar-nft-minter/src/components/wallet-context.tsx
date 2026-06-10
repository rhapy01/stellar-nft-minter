// ─── Wallet Context ───────────────────────────────────────────────────────────
//
// Manages Freighter and Albedo wallet connections.
// Provides: address, walletType, connect(), disconnect(), signTx()

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  isFreighterAvailable,
  connectFreighter,
  signWithFreighter,
  connectAlbedo,
  signWithAlbedo,
} from "@/lib/wallet";
import { NETWORK_PASSPHRASE } from "@/lib/constants";

export type WalletType = "freighter" | "albedo";

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

  const connect = useCallback(async (type: WalletType) => {
    setIsConnecting(true);
    try {
      let pubkey: string;

      if (type === "freighter") {
        pubkey = await connectFreighter();
      } else {
        pubkey = await connectAlbedo();
      }

      setAddress(pubkey);
      setWalletType(type);

      toast.success(
        type === "freighter" ? "Freighter Connected" : "Albedo Connected",
        { description: `Connected to Stellar Testnet · ${pubkey.slice(0, 6)}…${pubkey.slice(-4)}` },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();

      if (lower.includes("not found") || lower.includes("install")) {
        toast.error("Wallet Not Found", {
          description:
            type === "freighter"
              ? "Install the Freighter extension from freighter.app and reload."
              : msg,
        });
      } else if (
        lower.includes("denied") ||
        lower.includes("rejected") ||
        lower.includes("closed") ||
        lower.includes("cancel")
      ) {
        toast.error("Connection Cancelled", {
          description: "You closed the wallet dialog.",
        });
      } else if (lower.includes("popup") || lower.includes("blocked")) {
        toast.error("Popup Blocked", {
          description:
            "Allow popups for this site in your browser, then try Albedo again.",
        });
      } else {
        toast.error("Connection Failed", { description: msg });
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setWalletType(null);
    toast.info("Wallet Disconnected");
  }, []);

  const signTx = useCallback(
    async (xdr: string): Promise<string> => {
      if (!walletType) throw new Error("No wallet connected");
      if (walletType === "freighter") {
        return signWithFreighter(xdr, NETWORK_PASSPHRASE);
      }
      return signWithAlbedo(xdr, "TESTNET");
    },
    [walletType],
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
