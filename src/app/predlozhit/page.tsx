"use client";

/**
 * Страница «Предложить» (маршрут /predlozhit).
 * Заглушка до этапа 5 — режим редактирования сети.
 */
import Link from "next/link";

export default function PredlozhitPage() {
  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h1>Предложить</h1>
      <p>Режим редактирования сети (этап 5). Пока заглушка.</p>
      <Link href="/" style={{ color: "#1a3a52" }}>← На главную</Link>
    </div>
  );
}
