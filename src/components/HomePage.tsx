"use client";

/**
 * Главная страница: глобус + 2D-карта (EarthScene), авторизация (AuthBlock).
 * Управление авто-вращением и передача API глобуса для зума/панорамирования с клавиатуры.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import EarthScene, { type GlobeControls } from "./EarthScene";
import AuthBlock from "./AuthBlock";

export default function HomePage() {
  const [autoRotate, setAutoRotate] = useState(true);
  const [mapOverlayVisible, setMapOverlayVisible] = useState(false);
  const globeApiRef = useRef<GlobeControls | null>(null);

  const onGlobeControlsReady = useCallback((api: GlobeControls) => {
    globeApiRef.current = api;
  }, []);

  useEffect(() => {
    const keys = { up: false, down: false, left: false, right: false };
    const step = 0.06;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") { e.preventDefault(); keys.up = true; }
      if (e.key === "ArrowDown") { e.preventDefault(); keys.down = true; }
      if (e.key === "ArrowLeft") { e.preventDefault(); keys.left = true; }
      if (e.key === "ArrowRight") { e.preventDefault(); keys.right = true; }
      const api = globeApiRef.current;
      if (api && (e.key === "+" || e.key === "=")) { e.preventDefault(); api.zoomIn(); }
      if (api && e.key === "-") { e.preventDefault(); api.zoomOut(); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") keys.up = false;
      if (e.key === "ArrowDown") keys.down = false;
      if (e.key === "ArrowLeft") keys.left = false;
      if (e.key === "ArrowRight") keys.right = false;
    };
    let rafId: number;
    const tick = () => {
      const api = globeApiRef.current;
      if (api) {
        let dx = 0, dy = 0;
        if (keys.left) dx += step;
        if (keys.right) dx -= step;
        if (keys.up) dy += step;
        if (keys.down) dy -= step;
        if (dx !== 0 || dy !== 0) api.pan(dx, dy);
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

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <EarthScene
        autoRotate={autoRotate}
        onControlsReady={onGlobeControlsReady}
        onMapOverlayChange={setMapOverlayVisible}
        onAutoRotateChange={setAutoRotate}
        authBlock={<AuthBlock />}
      />
    </div>
  );
}
