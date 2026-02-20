"use client";

/**
 * Провайдеры приложения: Solana RPC и кошелёк (Phantom).
 * RPC берётся из NEXT_PUBLIC_SOLANA_RPC или devnet по умолчанию.
 */
import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";

const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";

export function Providers({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider
        wallets={wallets}
        autoConnect={false}
        onError={(err) => {
          if (err?.name === "WalletNotSelectedError") return;
          if (err?.name === "WalletSignMessageError") return;
          console.error(err);
        }}
      >
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
