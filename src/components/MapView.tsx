"use client";

/**
 * Отдельный вид 2D-карты (Leaflet): поиск, геолокация, стрелки для панорамирования.
 * Используется как альтернативный экран; кнопка «Глобус» возвращает на главную.
 */
import "leaflet/dist/leaflet.css";
import { useRef, useEffect, useState } from "react";

type LeafletMap = ReturnType<typeof import("leaflet").map>;

const PAN_STEP = 80;

export default function MapView({ onBackToGlobe }: { onBackToGlobe: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>("Загрузка…");

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;
    import("leaflet").then((L) => {
      const map = L.default.map(container).setView([55.75, 37.62], 3);
      L.default.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);
      mapRef.current = map;

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            map.setView([latitude, longitude], 6);
            setLocationStatus(`Ваше местоположение: ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
          },
          () => setLocationStatus("Местоположение недоступно"),
          { timeout: 8000, maximumAge: 60000 }
        );
      } else {
        setLocationStatus("Геолокация не поддерживается");
      }

      return () => {
        map.remove();
        mapRef.current = null;
      };
    });
  }, []);

  useEffect(() => {
    const keys = { up: false, down: false, left: false, right: false };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") { e.preventDefault(); keys.up = true; }
      if (e.key === "ArrowDown") { e.preventDefault(); keys.down = true; }
      if (e.key === "ArrowLeft") { e.preventDefault(); keys.left = true; }
      if (e.key === "ArrowRight") { e.preventDefault(); keys.right = true; }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") keys.up = false;
      if (e.key === "ArrowDown") keys.down = false;
      if (e.key === "ArrowLeft") keys.left = false;
      if (e.key === "ArrowRight") keys.right = false;
    };
    let rafId: number;
    const tick = () => {
      const map = mapRef.current;
      if (map) {
        let dx = 0, dy = 0;
        if (keys.left) dx += PAN_STEP;
        if (keys.right) dx -= PAN_STEP;
        if (keys.up) dy += PAN_STEP;
        if (keys.down) dy -= PAN_STEP;
        if (dx !== 0 || dy !== 0) map.panBy([-dx, -dy]);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchResult(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`
      );
      const data = await res.json();
      if (data?.[0]) {
        const { lat, lon, display_name } = data[0];
        const latN = parseFloat(lat);
        const lonN = parseFloat(lon);
        setSearchResult(display_name || `${latN.toFixed(2)}, ${lonN.toFixed(2)}`);
        mapRef.current?.setView([latN, lonN], 10);
      } else setSearchResult("Не найдено");
    } catch {
      setSearchResult("Ошибка поиска");
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={onBackToGlobe} style={{ padding: "8px 12px", background: "#1a3a52", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>
          ← Глобус
        </button>
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Поиск города…" style={{ padding: "8px 12px", flex: 1, minWidth: 120, maxWidth: 280, borderRadius: 6, border: "1px solid #ccc", fontSize: 14 }} />
        <button type="button" onClick={handleSearch} style={{ padding: "8px 12px", background: "#27ae60", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>
          Найти
        </button>
      </div>
      <div style={{ position: "absolute", bottom: 20, left: 10, right: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ background: "rgba(255,255,255,0.9)", padding: 8, borderRadius: 6, fontSize: 13 }}>{locationStatus}</div>
        {searchResult && <div style={{ background: "rgba(255,255,255,0.9)", padding: 8, borderRadius: 6, fontSize: 13 }}>{searchResult}</div>}
      </div>
    </div>
  );
}
