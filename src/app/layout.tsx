/**
 * Корневой layout приложения z96a.
 * Задаёт метаданные, язык и оборачивает всё в провайдеры (Solana wallet).
 */
import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "z96a",
  description: "Инфокоммуникационная сеть на планете",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" style={{ margin: 0, padding: 0, overflow: "hidden", width: "100%", height: "100%" }}>
      <body style={{ margin: 0, padding: 0, overflow: "hidden", width: "100%", height: "100%", minHeight: "100vh" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
