"use client";

/**
 * Блок авторизации: подключение Phantom, подпись сообщения, вызов /api/auth/verify.
 * После успешного входа — короткий адрес кошелька, ссылка «Предложить», кнопка «Выйти».
 */
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";

const AUTH_MESSAGE_PREFIX = "Login to z96a at ";

export default function AuthBlock() {
  const { publicKey, connected, connect, disconnect, signMessage, wallets, select } = useWallet();
  const [authDone, setAuthDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);
    try {
      const phantom = wallets?.find((w) => w.adapter.name === "Phantom");
      if (phantom) {
        select(phantom.adapter.name);
        await connect();
      } else {
        setError("Установите расширение Phantom");
      }
    } catch (e) {
      setError("Не удалось подключить кошелёк");
    }
  };

  const handleAuth = async () => {
    if (!publicKey || !signMessage) return;
    setLoading(true);
    setError(null);
    try {
      const message = AUTH_MESSAGE_PREFIX + new Date().toISOString();
      const msgBytes = new TextEncoder().encode(message);
      const sig = await signMessage(msgBytes);
      const signaturePayload = typeof sig === "string" ? sig : bs58.encode(sig);
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: publicKey.toBase58(),
          message,
          signature: signaturePayload,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Ошибка входа");
      }
      setAuthDone(true);
    } catch (e) {
      const msg =
        e && typeof e === "object" && "name" in e && (e as Error).name === "WalletSignMessageError"
          ? "Подпись отменена или ошибка расширения. Попробуйте снова."
          : e instanceof Error
            ? e.message
            : "Ошибка подписи";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (connected && publicKey) {
    if (authDone) {
      return (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#666" }} title={publicKey.toBase58()}>
            {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
          </span>
          <a
            href="/propose"
            style={{
              padding: "8px 12px",
              background: "#27ae60",
              color: "#fff",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Предложить
          </a>
          <button
            type="button"
            onClick={() => { disconnect(); setAuthDone(false); }}
            style={{ padding: "8px 12px", background: "#666", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
          >
            Выйти
          </button>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleAuth}
          disabled={loading}
          style={{ padding: "8px 12px", background: "#1a3a52", color: "#fff", border: "none", borderRadius: 6, cursor: loading ? "wait" : "pointer", fontSize: 14 }}
        >
          {loading ? "Подпись…" : "Подписать для входа"}
        </button>
        <button type="button" onClick={() => disconnect()} style={{ padding: "8px 12px", background: "#666", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>
          Отмена
        </button>
        {error && <span style={{ fontSize: 12, color: "#c00" }}>{error}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button
        type="button"
        onClick={handleConnect}
        style={{ padding: "8px 12px", background: "#9945ff", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
      >
        Подключить Phantom
      </button>
      {error && <span style={{ fontSize: 12, color: "#c00" }}>{error}</span>}
    </div>
  );
}
