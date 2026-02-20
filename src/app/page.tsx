"use client";

import dynamic from "next/dynamic";

const HomePage = dynamic(() => import("@/components/HomePage"), {
  ssr: false,
  loading: () => <div style={{ padding: 24, fontSize: 18 }}>Загрузка...</div>,
});

export default function Page() {
  return (
    <main style={{ width: "100vw", height: "100vh", position: "relative", transform: "none" }}>
      <HomePage />
    </main>
  );
}
