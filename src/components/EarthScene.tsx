"use client";

/**
 * Сцена глобуса (Three.js) и 2D-карты (Leaflet overlay).
 * Глобус: текстура Земли, границы, звёзды, подписи стран; переход в 2D при приближении или по кнопке «На карту».
 * 2D: тайлы через /api/tile, поиск по адресу, обратный геокод, возврат на глобус по кнопке или при отдалении.
 */
import { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import "leaflet/dist/leaflet.css";

/** Радиус сферы Земли в сцене */
const R = 1;
/** Радиус для вершин кабелей (чуть выше поверхности, чтобы избежать z-fighting) */
const R_CABLE = R * 1.002;
const MAP_THRESHOLD = 1.25;
/** Гистерезис: переход глобус→2D только при минимальном расстоянии (зум колёсиком не сбрасывает кнопки) */
const MAP_THRESHOLD_ENTER_2D = 1.2;
/** Минимальный зум Leaflet, ниже которого выполняется возврат на глобус */
const MIN_ZOOM_GLOBE = 11;
const STAR_RADIUS = 250;
const TEXTURE_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1024px-Blue_Marble_2002.png";
const BORDERS_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

// Яркие звёзды: RA (часы), Dec (градусы), магнитуда (для размера)
const BRIGHT_STARS: [number, number, number][] = [
  [6.75, -16.72, 1.46],   // Сириус
  [5.58, 7.41, 0.12],     // Бетельгейзе
  [5.92, -9.67, 0.13],    // Ригель
  [14.66, -60.37, -0.72], // Канопус
  [6.40, 9.73, 0.50],     // Капелла
  [18.62, 38.78, 0.03],   // Вега
  [19.51, 8.87, 0.77],    // Альтаир
  [5.25, 45.99, 0.08],    // Капелла (другая)
  [7.66, 28.03, 1.35],    // Поллукс
  [2.53, 89.26, 1.98],    // Полярная
  [9.07, -47.29, 0.61],   // Ахернар
  [12.50, -63.10, 1.25],  // Альфа Центавра
  [13.40, -64.64, 1.30],  // Хадар
  [17.62, -26.43, 0.77],  // Антарес
  [16.49, -28.22, 1.06],  // Шаула
  [18.44, -34.38, 1.50],  // Фомальгаут
  [4.60, 16.51, 1.64],    // Альдебаран
  [7.76, 5.23, 1.65],     // Процион
  [10.14, 11.97, 0.85],   // Регул
  [12.44, -22.62, 1.50],  // Альфа Крукс
  [6.90, -33.96, 1.73],   // Канопус (Эридан)
  [3.31, 15.18, 2.00],    // Альнитак
  [3.78, 24.11, 1.77],    // Альнилам
  [5.60, -1.94, 1.70],    // Минтака
  [5.25, 45.99, 0.08],    // Менкалинан
  [9.73, 13.51, 2.14],    // Альгениб
  [12.27, -57.11, 1.63],  // Миаплацидус
  [22.96, -29.62, 1.16],  // Фомальгаут
  [20.69, 33.17, 2.90],   // Денеб
  [23.06, 15.96, 2.23],   // Пегас
  [1.63, -57.24, 2.65],   // Ахернар
  [8.17, 9.19, 2.56],     // Теят
  [11.06, 61.75, 1.79],   // Дубхе
  [11.03, 61.75, 2.37],   // Мерак
  [12.26, 57.03, 1.86],   // Мицар
  [14.07, 51.68, 2.23],   // Алькаид
  [7.43, 27.07, 2.01],    // Кастор
  [4.37, 15.96, 2.75],    // Эльнат
  [5.99, -9.67, 1.64],    // Саиф
  [6.37, -17.82, 2.75],   // Везен
  [7.40, -26.43, 2.45],   // Альнилам
  [5.60, 32.49, 2.90],    // Эльнат
  [3.82, 24.05, 2.05],    // Альнитак
  [5.08, -8.20, 2.56],    // Минтака
  [6.94, -25.29, 2.75],   // Ригель
  [18.62, 38.78, 2.20],   // Шеат
  [22.87, -15.82, 2.45],  // Маркаб
  [23.06, 28.08, 2.49],   // Садальбари
  [21.74, 9.87, 2.90],    // Энф
  [20.77, 33.17, 2.20],   // Альбирео
  [19.30, 53.37, 2.23],   // Денебола
  [13.40, -64.64, 2.30],  // Агена
  [12.44, -22.62, 2.75],  // Бекрукс
  [16.49, -28.22, 2.23],  // Шаула
  [17.62, -26.43, 2.75],  // Антарес B
];

/** Преобразование экваториальных координат (RA в часах, Dec в градусах) в декартовы x,y,z на сфере радиуса radius */
function raDecToXYZ(raHours: number, decDeg: number, radius: number): [number, number, number] {
  const ra = (raHours * 15 * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const x = radius * Math.cos(dec) * Math.cos(ra);
  const y = radius * Math.sin(dec);
  const z = -radius * Math.cos(dec) * Math.sin(ra);
  return [x, y, z];
}

/** Добавляет в сцену звёздное небо: яркие звёзды из BRIGHT_STARS + случайные точки с мерцанием (shader) */
function addStarfield(scene: THREE.Scene, timeRef: { current: number }) {
  const positions: number[] = [];
  const phases: number[] = [];
  BRIGHT_STARS.forEach(([ra, dec]) => {
    const [x, y, z] = raDecToXYZ(ra, dec, STAR_RADIUS);
    positions.push(x, y, z);
    phases.push(Math.random() * Math.PI * 2);
  });
  for (let i = 0; i < 400; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const x = STAR_RADIUS * Math.sin(phi) * Math.cos(theta);
    const y = STAR_RADIUS * Math.cos(phi);
    const z = -STAR_RADIUS * Math.sin(phi) * Math.sin(theta);
    positions.push(x, y, z);
    phases.push(Math.random() * Math.PI * 2);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("phase", new THREE.Float32BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      size: { value: 3.2 },
    },
    vertexShader: `
      attribute float phase;
      uniform float time;
      uniform float size;
      varying float vAlpha;
      void main() {
        vAlpha = 0.88 + 0.12 * sin(time + phase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        gl_FragColor = vec4(1.0, 1.0, 1.05, vAlpha * (1.0 - d * 1.6));
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geom, material);
  scene.add(points);
  return { points, material };
}

/** Широта/долгота → координаты на сфере единичного радиуса (для границ и подписей) */
function latLngToXYZ(lat: number, lng: number): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = (lng * Math.PI) / 180;
  return [
    R * Math.sin(phi) * Math.cos(theta),
    R * Math.cos(phi),
    -R * Math.sin(phi) * Math.sin(theta),
  ];
}

/** Широта/долгота → координаты на сфере заданного радиуса (для кабелей — R_CABLE) */
function latLngToXYZWithRadius(lat: number, lng: number, radius: number): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = (lng * Math.PI) / 180;
  return [
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    -radius * Math.sin(phi) * Math.sin(theta),
  ];
}

/** Декартовы x,y,z на сфере → широта и долгота */
function xyzToLatLon(x: number, y: number, z: number): { lat: number; lon: number } {
  const phi = Math.acos(Math.max(-1, Math.min(1, y / R)));
  const lat = 90 - (phi * 180) / Math.PI;
  const lon = (Math.atan2(-z, x) * 180) / Math.PI;
  return { lat, lon };
}

/** Пересечение луча с сферой; возвращает ближайшую точку пересечения или null */
function raySphereIntersection(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  sphereCenter: THREE.Vector3,
  radius: number
): THREE.Vector3 | null {
  const oc = origin.clone().sub(sphereCenter);
  const a = dir.dot(dir);
  const b = 2 * oc.dot(dir);
  const c = oc.dot(oc) - radius * radius;
  const d = b * b - 4 * a * c;
  if (d < 0) return null;
  const t = (-b - Math.sqrt(d)) / (2 * a);
  if (t <= 0) return null;
  return origin.clone().add(dir.multiplyScalar(t));
}

/** Асинхронно загружает GeoJSON границ стран и рисует их линиями на глобусе */
function addBorders(scene: THREE.Scene) {
  fetch(BORDERS_URL)
    .then((r) => r.json())
    .then(
      (
        gj: {
          features?: Array<{
            geometry: { type: string; coordinates: number[][] | number[][][] };
          }>;
        }
      ) => {
        const group = new THREE.Group();
        const mat = new THREE.LineBasicMaterial({ color: 0x4488ff });
        gj.features?.forEach((f) => {
          const g = f.geometry;
          if (!g?.coordinates) return;
          const coords = g.coordinates as unknown;
          const rings: number[][][] =
            g.type === "MultiPolygon"
              ? (coords as number[][][][]).flat()
              : (coords as number[][][]);
          rings.forEach((ring) => {
            const pts = ring.map(([lng, lat]) =>
              new THREE.Vector3(...latLngToXYZ(lat, lng))
            );
            group.add(
              new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(pts),
                mat
              )
            );
          });
        });
        scene.add(group);
      }
    )
    .catch(() => {});
}

/** Цвета кабелей по design.md: медь — оранжевый, оптика — зелёный */
const CABLE_COPPER_COLOR = 0xe67e22;
const CABLE_FIBER_COLOR = 0x22c55e;
const NODE_COLOR = 0x3498db;
/** Спутники — отдельный цвет для различимости */
const SATELLITE_COLOR = 0x9b59b6;

/** Типы элементов сети из API */
/** Радиус Земли в км (для размещения спутников по altitude). */
const EARTH_RADIUS_KM = 6371;
type NetworkElementApi = {
  id: string;
  scope: string;
  type: string;
  name: string | null;
  lat: number | null;
  lng: number | null;
  altitude?: number | null;
  path: Array<{ lat: number; lng: number }> | null;
};

/** Загружает /api/network?scope=GLOBAL и отрисовывает кабели (линии) и узлы (малые сферы) на глобусе. sceneRef — текущая сцена (группа добавляется в sceneRef.current при готовности). resolution — размер viewport для LineMaterial. containerRef — опционально, для актуального resolution при добавлении группы. cancelledRef — при true не добавлять группу в сцену. runIdRef/runId — только этот run добавляет группу (Strict Mode). */
function addNetworkLayer(
  sceneRef: { current: THREE.Scene | null },
  resolution?: THREE.Vector2,
  containerRef?: { current: HTMLDivElement | null },
  cancelledRef?: { current: boolean },
  runIdRef?: { current: number },
  runId?: number
) {
  const group = new THREE.Group();
  group.name = "network";
  group.renderOrder = 1;
  const res = resolution?.clone() ?? new THREE.Vector2(1, 1);
  fetch("/api/network?scope=GLOBAL")
    .then((r) => {
      if (!r.ok) {
        console.warn("[network] API status:", r.status);
        return r.json().catch(() => ({}));
      }
      return r.json();
    })
    .then((data: { elements?: NetworkElementApi[]; error?: string }) => {
      if (data.error) {
        console.warn("[network] API error:", data.error);
        return;
      }
      const elements = data.elements ?? [];
      console.log("[network] GLOBAL elements:", elements.length, elements.map((e) => ({ type: e.type, name: e.name })));
      const safeRes =
        res.x > 0 && res.y > 0
          ? res.clone()
          : typeof window !== "undefined"
            ? new THREE.Vector2(window.innerWidth, window.innerHeight)
            : new THREE.Vector2(1920, 1080);
      if (safeRes.x <= 0 || safeRes.y <= 0) safeRes.set(1920, 1080);
      if (cancelledRef?.current) {
        console.log("[network] addNetworkLayer cancelled (unmounted).");
        return;
      }
      if (runIdRef != null && runId !== undefined && runIdRef.current !== runId) {
        console.log("[network] addNetworkLayer skipped (stale run).");
        return;
      }
      let addedLines = 0;
      let addedNodes = 0;
      elements.forEach((el) => {
        const pathArr = Array.isArray(el.path)
          ? el.path
          : typeof el.path === "string"
            ? (() => {
                try {
                  return JSON.parse(el.path) as Array<{ lat: number; lng: number }>;
                } catch {
                  return [];
                }
              })()
            : el.path && typeof el.path === "object"
              ? (Object.values(el.path) as Array<{ lat: number; lng: number }>)
              : [];
        if (pathArr.length >= 2) {
          const color =
            el.type === "CABLE_FIBER" ? CABLE_FIBER_COLOR : CABLE_COPPER_COLOR;
          const positions: number[] = [];
          pathArr.forEach((p) => {
            const lat = Number((p as { lat?: unknown }).lat);
            const lng = Number((p as { lng?: unknown }).lng);
            if (Number.isNaN(lat) || Number.isNaN(lng)) return;
            const [x, y, z] = latLngToXYZWithRadius(lat, lng, R_CABLE);
            positions.push(x, y, z);
          });
          if (positions.length < 6) {
            console.warn("[network] skip cable: not enough valid points", el.type, el.name, "pathArr:", pathArr.length, "positions:", positions.length);
            return;
          }
          console.log("[network] cable:", el.type, el.name, "points:", pathArr.length, "positions:", positions.length);
          const geometry = new LineGeometry().setPositions(positions);
          const material = new LineMaterial({
            color,
            linewidth: 5,
            worldUnits: false,
            resolution: safeRes.clone(),
            depthTest: true,
            depthWrite: true,
          });
          const line = new Line2(geometry, material);
          group.add(line);
          addedLines++;
        } else if (el.lat != null && el.lng != null) {
          const rawLat = el.lat;
          const rawLng = el.lng;
          const lat = Number(rawLat);
          const lng = Number(rawLng);
          if (Number.isNaN(lat) || Number.isNaN(lng)) {
            console.warn("[network] skip element invalid lat/lng:", el.id, el.type, "raw lat:", rawLat, "raw lng:", rawLng);
            return;
          }
          const radius = Math.max(
            R,
            el.altitude != null && Number(el.altitude) > 0
              ? R + Number(el.altitude) / EARTH_RADIUS_KM
              : R
          );
          const [x, y, z] = latLngToXYZWithRadius(lat, lng, radius);
          const isSatellite = el.type === "SATELLITE";
          const nodeColor = isSatellite ? SATELLITE_COLOR : NODE_COLOR;
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(isSatellite ? 0.022 : 0.015, 8, 6),
            new THREE.MeshBasicMaterial({ color: nodeColor })
          );
          mesh.position.set(x, y, z);
          mesh.userData = { networkElement: el };
          group.add(mesh);
          addedNodes++;
          console.log("[network] node:", el.type, el.name, "lat:", lat, "lng:", lng, "radius:", radius);
        } else {
          console.log("[network] skip element (no path, no lat/lng):", el.type, el.name);
        }
      });
      if (cancelledRef?.current) {
        console.log("[network] addNetworkLayer cancelled before scene.add.");
        return;
      }
      if (runIdRef != null && runId !== undefined && runIdRef.current !== runId) {
        console.log("[network] addNetworkLayer skipped (stale run) before scene.add.");
        return;
      }
      const targetScene = sceneRef.current;
      if (!targetScene) {
        console.warn("[network] addNetworkLayer: no current scene (unmounted), skip adding group.");
        return;
      }
      const container = containerRef?.current;
      const rw = container && container.clientWidth > 0 && container.clientHeight > 0 ? container.clientWidth : safeRes.x;
      const rh = container && container.clientWidth > 0 && container.clientHeight > 0 ? container.clientHeight : safeRes.y;
      const resolutionVec = new THREE.Vector2(rw, rh);
      console.log("[network] adding group to scene, lines:", addedLines, "nodes:", addedNodes, "resolution:", resolutionVec.x, resolutionVec.y);
      targetScene.add(group);
      let lineCount = 0;
      group.children.forEach((c) => {
        if ((c as { isLine2?: boolean }).isLine2) {
          const line2 = c as Line2;
          const mat = line2.material as InstanceType<typeof LineMaterial>;
          if (mat && "resolution" in mat && mat.resolution) {
            mat.resolution.copy(resolutionVec);
            lineCount++;
          }
        }
      });
      if (lineCount > 0) console.log("[network] resolution set for", lineCount, "Line2");
      window.dispatchEvent(new Event("resize"));
    })
    .catch((err) => {
      console.warn("[network] fetch failed:", err);
    });
  return group;
}

type LabelEntry = { pos: THREE.Vector3; el: HTMLDivElement };

/** Загружает границы, по центру каждого полигона создаёт DOM-подпись (название страны), синхронизирует позиции в animate */
function addLabels(
  labelsContainer: HTMLDivElement | null,
  labelsDataRef: { current: LabelEntry[] }
) {
  if (!labelsContainer) return;
  labelsContainer.innerHTML = "";
  labelsDataRef.current = [];
  fetch(BORDERS_URL)
    .then((r) => r.json())
    .then(
      (
        gj: {
          features?: Array<{
            properties?: { NAME?: string; ADMIN?: string; name?: string };
            geometry: { type: string; coordinates: number[][] | number[][][] };
          }>;
        }
      ) => {
        gj.features?.forEach((f) => {
          const g = f.geometry;
          const props = f.properties;
          if (!g?.coordinates) return;
          const coords = g.coordinates as unknown;
          const rings: number[][][] =
            g.type === "MultiPolygon"
              ? (coords as number[][][][]).flat()
              : (coords as number[][][]);
          let ring = rings[0];
          if (g.type === "MultiPolygon" && rings.length > 1) {
            ring = rings.reduce((a, b) => (a.length >= b.length ? a : b));
          }
          if (!ring?.length) return;
          let sumLat = 0,
            sumLng = 0;
          ring.forEach(([lng, lat]) => {
            sumLng += lng;
            sumLat += lat;
          });
          const lat = sumLat / ring.length;
          const lng = sumLng / ring.length;
          const [x, y, z] = latLngToXYZ(lat, lng);
          const pos = new THREE.Vector3(x, y, z);
          const name =
            props?.NAME || props?.ADMIN || props?.name || "";
          if (!name) return;
          const el = document.createElement("div");
          el.textContent = name;
          el.style.position = "fixed";
          el.style.pointerEvents = "none";
          el.style.fontSize = "11px";
          el.style.fontWeight = "bold";
          el.style.color = "#fff";
          el.style.textShadow = "0 0 2px #000, 0 0 4px #000, 1px 1px 2px #000";
          el.style.whiteSpace = "nowrap";
          el.style.zIndex = "5";
          labelsContainer.appendChild(el);
          labelsDataRef.current.push({ pos, el });
        });
      }
    )
    .catch(() => {});
}

/** API управления глобусом снаружи (зум +/−, панорамирование) */
export type GlobeControls = {
  zoomIn: () => void;
  zoomOut: () => void;
  pan: (dx: number, dy: number) => void;
};

type MapCenter = { lat: number; lon: number };

export default function EarthScene({
  autoRotate,
  onReady,
  onControlsReady,
  onMapOverlayChange,
  onAutoRotateChange,
  authBlock,
}: {
  autoRotate: boolean;
  onReady?: () => void;
  onControlsReady?: (api: GlobeControls) => void;
  onMapOverlayChange?: (visible: boolean) => void;
  onAutoRotateChange?: (value: boolean) => void;
  authBlock?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const labelsContainerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<LabelEntry[]>([]);
  const autoRotateRef = useRef(autoRotate);
  const apiRef = useRef<GlobeControls | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const mapInstanceRef = useRef<ReturnType<typeof import("leaflet").map> | null>(null);
  const destroyingMapRef = useRef(false);
  const overlayShownRef = useRef(false);
  const transitionTo2DScheduledRef = useRef(false);

  const isMapContainerInDoc = useCallback((map: ReturnType<typeof import("leaflet").map> | null) => {
    if (!map) return false;
    const container = map.getContainer?.();
    return !!(container?.parentNode && typeof document !== "undefined" && document.body.contains(container));
  }, []);

  const safeMapCall = useCallback(<T,>(map: ReturnType<typeof import("leaflet").map> | null, fn: (m: NonNullable<ReturnType<typeof import("leaflet").map>>) => T): T | undefined => {
    if (!map || !isMapContainerInDoc(map)) return undefined;
    try {
      return fn(map);
    } catch {
      return undefined;
    }
  }, [isMapContainerInDoc]);
  const transitionTo2DRef = useRef<(() => void) | null>(null);
  const lastDistOver6Ref = useRef(false);
  const setShowGoToMapButtonRef = useRef<((v: boolean) => void) | null>(null);

  const [showMapOverlay, setShowMapOverlay] = useState(false);
  const [showGoToMapButton, setShowGoToMapButton] = useState(false);
  /** Текущее расстояние камеры до центра глобуса (для подсказки «до 2D»), обновляется с throttle */
  const [distanceTo2D, setDistanceTo2D] = useState<number | null>(null);
  const lastDistUpdateRef = useRef({ t: 0, dist: 0 });
  const networkCancelledRef = useRef(false);
  const networkRunIdRef = useRef(0);
  const [mapCenter, setMapCenter] = useState<MapCenter | null>(null);
  const [locationText, setLocationText] = useState<string>("Загрузка…");
  const [searchQuery, setSearchQuery] = useState("");
  type SearchResultItem = { lat: number; lon: number; display_name: string };
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchResultPage, setSearchResultPage] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(12);
  const [pressedKeys, setPressedKeys] = useState({ up: false, down: false, left: false, right: false });
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const PAN_STEP = 80;
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    setShowGoToMapButtonRef.current = setShowGoToMapButton;
    return () => {
      setShowGoToMapButtonRef.current = null;
    };
  }, []);

  useEffect(() => {
    onMapOverlayChange?.(showMapOverlay);
  }, [showMapOverlay, onMapOverlayChange]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      window.dispatchEvent(new Event("resize"));
    };
    const id = requestAnimationFrame(() => requestAnimationFrame(run));
    const t = setTimeout(run, 150);
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
      clearTimeout(t);
    };
  }, [showMapOverlay]);

  const returnToGlobe = useCallback(() => {
    if (destroyingMapRef.current) return;
    const map = mapInstanceRef.current;
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!map || !controls || !camera || !renderer) {
      setShowMapOverlay(false);
      setMapCenter(null);
      return;
    }
    destroyingMapRef.current = true;
    try {
      (map as { scrollWheelZoom?: { disable?: () => void } }).scrollWheelZoom?.disable?.();
    } catch (_) {}
    const center = safeMapCall(map, (m) => m.getCenter());
    const lat = center?.lat ?? 0;
    const lon = center?.lng ?? 0;
    const [tx, ty, tz] = latLngToXYZ(lat, lon);
    const dir = new THREE.Vector3(tx, ty, tz).normalize();
    const dist = 3;
    camera.position.copy(dir.clone().multiplyScalar(dist));
    controls.target.set(0, 0, 0);
    controls.dispose();
    const newControls = new OrbitControls(camera, renderer.domElement);
    newControls.enableZoom = true;
    newControls.minDistance = 1.2;
    newControls.maxDistance = 8;
    newControls.autoRotate = false;
    newControls.autoRotateSpeed = 0.4;
    newControls.target.set(0, 0, 0);
    newControls.update();
    controlsRef.current = newControls;
    map.off();
    mapInstanceRef.current = null;
    // Отложить remove, чтобы Leaflet _onZoomTransitionEnd успел выполниться (иначе _leaflet_pos)
    setTimeout(() => {
      try {
        const container = map.getContainer?.();
        if (container?.parentNode && typeof document !== "undefined" && document.body.contains(container)) {
          map.remove();
        }
      } catch (_) {}
    }, 400);
    overlayShownRef.current = false;
    transitionTo2DScheduledRef.current = false;
    lastDistOver6Ref.current = false;
    setShowGoToMapButton(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setShowMapOverlay(false);
        setMapCenter(null);
        destroyingMapRef.current = false;
      });
    });
  }, [safeMapCall]);

  /** Инициализация Three.js: сцена, камера, рендерер, OrbitControls, Земля, границы, подписи, звёзды; цикл animate и переход в 2D при приближении */
  useEffect(() => {
    networkCancelledRef.current = false;
    networkRunIdRef.current += 1;
    const runId = networkRunIdRef.current;
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x000814);
    const w = container.clientWidth;
    const h = container.clientHeight;
    const aspect = w > 0 && h > 0 ? w / h : 1;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    // Дистанция 7 при R=1 — узлы (0.015/0.022) и кабели видны в кадре
    camera.position.set(0, 0, 7);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    cameraRef.current = camera;
    const timeRef = { current: 0 };
    const starfield = addStarfield(scene, timeRef);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(Math.max(1, w), Math.max(1, h));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.position = "relative";
    renderer.domElement.style.zIndex = "0";
    renderer.domElement.style.pointerEvents = "auto";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true;
    controls.minDistance = 1.2;
    controls.maxDistance = 8;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.4;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    const STEP = 0.03;
    const ZOOM_STEP = 0.15;
    const api: GlobeControls = {
      zoomIn: () => {
        const ctrl = controlsRef.current;
        if (!ctrl) return;
        const d = camera.position.distanceTo(ctrl.target);
        const dir = camera.position
          .clone()
          .sub(ctrl.target)
          .normalize();
        const newD = Math.max(1.2, d * (1 - ZOOM_STEP));
        camera.position
          .copy(ctrl.target)
          .add(dir.multiplyScalar(newD));
      },
      zoomOut: () => {
        const ctrl = controlsRef.current;
        if (!ctrl) return;
        const d = camera.position.distanceTo(ctrl.target);
        const dir = camera.position
          .clone()
          .sub(ctrl.target)
          .normalize();
        camera.position
          .copy(ctrl.target)
          .add(
            dir.multiplyScalar(Math.min(8, d * (1 + ZOOM_STEP)))
          );
      },
      pan: (dx, dy) => {
        const ctrl = controlsRef.current;
        if (!ctrl) return;
        const up = new THREE.Vector3(0, 1, 0);
        const right = camera
          .position.clone()
          .sub(ctrl.target)
          .cross(up)
          .normalize();
        ctrl.target.add(right.multiplyScalar(-dx * STEP));
        ctrl.target.add(up.multiplyScalar(-dy * STEP));
      },
    };
    apiRef.current = api;
    onControlsReady?.(api);

    transitionTo2DRef.current = () => {
      const ctrl = controlsRef.current;
      const cam = cameraRef.current;
      if (!ctrl || !cam) return;
      const dist = cam.position.distanceTo(ctrl.target);
      if (dist > 1.2) {
        const dir = cam.position.clone().sub(ctrl.target).normalize();
        cam.position.copy(ctrl.target).add(dir.multiplyScalar(1.15));
      }
      const rayDir = ctrl.target.clone().sub(cam.position).normalize();
      const hit = raySphereIntersection(
        cam.position.clone(),
        rayDir,
        new THREE.Vector3(0, 0, 0),
        R
      );
      const point = hit || ctrl.target.clone().normalize();
      const { lat, lon } = xyzToLatLon(point.x, point.y, point.z);
      overlayShownRef.current = true;
      setMapCenter({ lat, lon });
      setShowMapOverlay(true);
    };

    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const dir = new THREE.DirectionalLight(0xffffff, 2.4);
    dir.position.set(5, 3, 5);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0xffffff, 0.8);
    fill.position.set(-3, -2, -2);
    scene.add(fill);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("");
    loader.load(
      TEXTURE_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          color: 0xffffff,
          roughness: 0.9,
          metalness: 0.05,
        });
        const earth = new THREE.Mesh(
          new THREE.SphereGeometry(R, 64, 64),
          mat
        );
        scene.add(earth);
        addBorders(scene);
        addNetworkLayer(sceneRef, new THREE.Vector2(container.clientWidth, container.clientHeight), containerRef, networkCancelledRef, networkRunIdRef, runId);
        requestAnimationFrame(() => {
          addLabels(labelsContainerRef.current, labelsRef);
        });
        onReady?.();
      },
      undefined,
      () => {
        scene.add(
          new THREE.Mesh(
            new THREE.SphereGeometry(R, 64, 64),
            new THREE.MeshStandardMaterial({ color: 0x1a3a52 })
          )
        );
        addBorders(scene);
        addNetworkLayer(sceneRef, new THREE.Vector2(container.clientWidth, container.clientHeight), containerRef, networkCancelledRef, networkRunIdRef, runId);
        requestAnimationFrame(() => {
          addLabels(labelsContainerRef.current, labelsRef);
        });
        onReady?.();
      }
    );

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      scene.traverse((obj) => {
        if (obj.name === "network" && obj instanceof THREE.Group) {
          obj.children.forEach((c) => {
            if ((c as { isLine2?: boolean }).isLine2) {
              const line2 = c as Line2;
              const mat = line2.material as InstanceType<typeof LineMaterial>;
              if (mat && "resolution" in mat && mat.resolution) mat.resolution.set(w, h);
            }
          });
        }
      });
    };
    window.addEventListener("resize", onResize);
    onResize();

    const RESIZE_DEBOUNCE_MS = 60;
    let resizeTimeoutId: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeoutId);
      resizeTimeoutId = setTimeout(() => onResize(), RESIZE_DEBOUNCE_MS);
    });
    resizeObserver.observe(container);

    let id: number;
    const animate = () => {
      id = requestAnimationFrame(animate);
      const ctrl = controlsRef.current;
      if (ctrl) {
        ctrl.autoRotate = autoRotateRef.current;
        ctrl.update();
        const dist = camera.position.distanceTo(ctrl.target);
        if (!overlayShownRef.current) {
          const over6 = dist >= 6;
          if (over6 !== lastDistOver6Ref.current) {
            lastDistOver6Ref.current = over6;
            setShowGoToMapButtonRef.current?.(over6);
          }
          const now = Date.now();
          const last = lastDistUpdateRef.current;
          if (now - last.t >= 100 || Math.abs(dist - last.dist) >= 0.15) {
            lastDistUpdateRef.current = { t: now, dist };
            setDistanceTo2D(dist);
          }
        }
        if (dist <= MAP_THRESHOLD_ENTER_2D && !overlayShownRef.current) {
          if (transitionTo2DScheduledRef.current) return;
          transitionTo2DScheduledRef.current = true;
          const origin = camera.position.clone();
          const rayDir = ctrl.target
            .clone()
            .sub(camera.position)
            .normalize();
          const hit = raySphereIntersection(
            origin,
            rayDir,
            new THREE.Vector3(0, 0, 0),
            R
          );
          const point = hit || ctrl.target.clone().normalize();
          const { lat, lon } = xyzToLatLon(point.x, point.y, point.z);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              overlayShownRef.current = true;
              setMapCenter({ lat, lon });
              setShowMapOverlay(true);
              setDistanceTo2D(null);
              transitionTo2DScheduledRef.current = false;
            });
          });
        }
      }
      timeRef.current += 0.016;
      if (starfield.points.material && "uniforms" in starfield.points.material && starfield.points.material.uniforms?.time)
        starfield.points.material.uniforms.time.value = timeRef.current;
      if (container && labelsRef.current.length) {
        const rect = container.getBoundingClientRect();
        const camDir = camera.position.clone().normalize();
        labelsRef.current.forEach(({ pos, el }) => {
          const toPoint = pos.clone().normalize();
          const onFront = toPoint.dot(camDir) > 0;
          if (!onFront) {
            el.style.display = "none";
            return;
          }
          const v = pos.clone().project(camera);
          const inFrustum =
            v.z > -1 &&
            v.z <= 1 &&
            v.x >= -1.1 &&
            v.x <= 1.1 &&
            v.y >= -1.1 &&
            v.y <= 1.1;
          if (!inFrustum) {
            el.style.display = "none";
            return;
          }
          const left = rect.left + (v.x * 0.5 + 0.5) * rect.width;
          const top = rect.top + (-v.y * 0.5 + 0.5) * rect.height;
          el.style.display = "block";
          el.style.left = `${left}px`;
          el.style.top = `${top}px`;
          el.style.transform = "translate(-50%, -50%)";
        });
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      networkCancelledRef.current = true;
      transitionTo2DRef.current = null;
      clearTimeout(resizeTimeoutId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(id);
      destroyingMapRef.current = true;
      const m = mapInstanceRef.current;
      if (m) {
        try {
          m.off();
        } catch (_) {}
        mapInstanceRef.current = null;
        try {
          const container = m.getContainer?.();
          if (container?.parentNode && typeof document !== "undefined" && document.body.contains(container)) {
            m.remove();
          }
        } catch (_) {}
      }
      destroyingMapRef.current = false;
      sceneRef.current = null;
      controls.dispose();
      scene.traverse((obj) => {
        if (obj.name === "network" && obj instanceof THREE.Group) {
          obj.children.forEach((c) => {
            if (c instanceof THREE.Line && c.geometry) c.geometry.dispose();
            if ((c as { isLine2?: boolean }).isLine2) {
              const line2 = c as Line2;
              line2.geometry?.dispose();
              if (line2.material) (Array.isArray(line2.material) ? line2.material : [line2.material]).forEach((m) => m.dispose());
            }
            if (c instanceof THREE.Mesh) {
              c.geometry?.dispose();
              if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose());
            }
          });
        }
      });
      starfield.points.geometry.dispose();
      (starfield.points.material as THREE.Material).dispose();
      renderer.dispose();
      labelsRef.current = [];
      cameraRef.current = null;
      apiRef.current = null;
      controlsRef.current = null;
      rendererRef.current = null;
      if (container.contains(renderer.domElement))
        container.removeChild(renderer.domElement);
    };
  }, [onReady, onControlsReady]);

  /** При включённом 2D: динамический импорт Leaflet, создание карты с тайлами /api/tile, reverse geocode при moveend, возврат на глобус при zoom < MIN_ZOOM_GLOBE */
  useEffect(() => {
    if (!showMapOverlay || !mapCenter) return;
    const overlay = overlayRef.current;
    if (!overlay || typeof window === "undefined" || !overlay.isConnected) return;
    let cancelled = false;
    let L: typeof import("leaflet");
    import("leaflet").then((leaflet) => {
      if (cancelled) return;
      L = leaflet.default;
      requestAnimationFrame(() => {
        if (cancelled) return;
        if (!overlay) return;
        const existing = mapInstanceRef.current;
        if (existing) {
          destroyingMapRef.current = true;
          try {
            existing.off();
            const container = existing.getContainer?.();
            if (container?.parentNode && typeof document !== "undefined" && document.body.contains(container)) {
              existing.remove();
            }
          } catch (_) {}
          mapInstanceRef.current = null;
          destroyingMapRef.current = false;
        }
        const map = L.map(overlay, { attributionControl: false, zoomControl: false }).setView(
          [mapCenter!.lat, mapCenter!.lon],
          12
        );
        L.tileLayer("/api/tile?z={z}&x={x}&y={y}&source=osm", {}).addTo(map);
        map.invalidateSize();
        mapInstanceRef.current = map;
        destroyingMapRef.current = false;
        map.on("zoomend", () => {
          if (destroyingMapRef.current) return;
          if (mapInstanceRef.current !== map) return;
          if (!overlayRef.current || (typeof document !== "undefined" && !document.contains(overlayRef.current))) return;
          try {
            const z = map.getZoom();
            setMapZoom(z);
            if (z < MIN_ZOOM_GLOBE) returnToGlobe();
          } catch (_) {}
        });
        map.on("moveend", () => {
          if (destroyingMapRef.current) return;
          if (mapInstanceRef.current !== map) return;
          if (!overlayRef.current || (typeof document !== "undefined" && !document.contains(overlayRef.current))) return;
          try {
            const c = map.getCenter();
            fetch(`/api/geocode/reverse?lat=${c.lat}&lng=${c.lng}`)
              .then((r) => r.json())
              .then((data: { display_name?: string }) => {
                setLocationText(data?.display_name || "Адрес не определён");
              })
              .catch(() => setLocationText("Адрес не определён"));
          } catch (_) {}
        });
        const initialCenter = safeMapCall(map, (m) => m.getCenter());
        if (initialCenter) {
          fetch(`/api/geocode/reverse?lat=${initialCenter.lat}&lng=${initialCenter.lng}`)
            .then((r) => r.json())
            .then((data: { display_name?: string }) => {
              setLocationText(data?.display_name || "Адрес не определён");
            })
            .catch(() => setLocationText("Адрес не определён"));
        } else {
          setLocationText("Адрес не определён");
        }
        // Сеть на 2D: глобальные кабели/узлы + локальные элементы (design.md: медь — оранжевый, оптика — зелёный)
        fetch("/api/network")
          .then((r) => r.json())
          .then((data: { elements?: NetworkElementApi[] }) => {
            if (mapInstanceRef.current !== map || cancelled) return;
            const elements = data.elements ?? [];
            safeMapCall(map, (m) => {
              elements.forEach((el) => {
                if (el.path && Array.isArray(el.path) && el.path.length >= 2) {
                  const latlngs = el.path.map((p) => [p.lat, p.lng] as [number, number]);
                  const color = el.type === "CABLE_FIBER" ? "#22c55e" : "#e67e22";
                  L.polyline(latlngs, { color, weight: 3 }).addTo(m);
                } else if (el.lat != null && el.lng != null) {
                  L.circleMarker([el.lat, el.lng], {
                    radius: 6,
                    fillColor: "#3498db",
                    color: "#fff",
                    weight: 1,
                    fillOpacity: 0.9,
                  }).addTo(m);
                }
              });
            });
          })
          .catch(() => {});
      });
    });
    return () => {
      cancelled = true;
      destroyingMapRef.current = true;
      const m = mapInstanceRef.current;
      if (m) {
        try {
          (m as { scrollWheelZoom?: { disable?: () => void } }).scrollWheelZoom?.disable?.();
        } catch (_) {}
        try {
          m.off();
        } catch (_) {}
        mapInstanceRef.current = null;
        setTimeout(() => {
          try {
            const container = m.getContainer?.();
            if (container?.parentNode && typeof document !== "undefined" && document.body.contains(container)) {
              m.remove();
            }
          } catch (_) {}
        }, 400);
      }
      destroyingMapRef.current = false;
    };
  }, [showMapOverlay, mapCenter, returnToGlobe, safeMapCall]);

  useEffect(() => {
    if (showMapOverlay) return;
    const t = setTimeout(() => {
      document.querySelectorAll(".leaflet-control-attribution, .leaflet-control-zoom, .leaflet-control-container").forEach((el) => el.remove());
    }, 100);
    return () => clearTimeout(t);
  }, [showMapOverlay]);

  useEffect(() => {
    if (!showMapOverlay) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        (document.activeElement as HTMLElement)?.blur();
        keysRef.current.up = true;
        setPressedKeys({ ...keysRef.current });
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        (document.activeElement as HTMLElement)?.blur();
        keysRef.current.down = true;
        setPressedKeys({ ...keysRef.current });
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        (document.activeElement as HTMLElement)?.blur();
        keysRef.current.left = true;
        setPressedKeys({ ...keysRef.current });
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        (document.activeElement as HTMLElement)?.blur();
        keysRef.current.right = true;
        setPressedKeys({ ...keysRef.current });
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") { keysRef.current.up = false; setPressedKeys({ ...keysRef.current }); }
      if (e.key === "ArrowDown") { keysRef.current.down = false; setPressedKeys({ ...keysRef.current }); }
      if (e.key === "ArrowLeft") { keysRef.current.left = false; setPressedKeys({ ...keysRef.current }); }
      if (e.key === "ArrowRight") { keysRef.current.right = false; setPressedKeys({ ...keysRef.current }); }
    };
    let rafId: number;
    const tick = () => {
      const map = mapInstanceRef.current;
      if (map && isMapContainerInDoc(map)) {
        let dx = 0,
          dy = 0;
        if (keysRef.current.left) dx += PAN_STEP;
        if (keysRef.current.right) dx -= PAN_STEP;
        if (keysRef.current.up) dy += PAN_STEP;
        if (keysRef.current.down) dy -= PAN_STEP;
        if (dx !== 0 || dy !== 0) {
          try {
            map.panBy([-dx, -dy]);
          } catch (_) {}
        }
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
  }, [showMapOverlay, isMapContainerInDoc]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchError(null);
    setSearchResults([]);
    if (showMapOverlay && !mapInstanceRef.current) {
      setSearchError("Дождитесь загрузки карты");
      return;
    }
    try {
      const res = await fetch(
        `/api/geocode/search?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setSearchError("Ошибка поиска");
        return;
      }
      const items: SearchResultItem[] = [];
      if (Array.isArray(data)) {
        for (const item of data) {
          const lat = item.lat != null ? parseFloat(item.lat) : NaN;
          const lon = item.lon != null ? parseFloat(item.lon) : (item.lng != null ? parseFloat(item.lng) : NaN);
          if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
            items.push({ lat, lon, display_name: item.display_name || `${lat.toFixed(2)}, ${lon.toFixed(2)}` });
          }
        }
      }
      setSearchResults(items);
      setSearchResultPage(0);
      if (items.length === 0) setSearchError("Не найдено");
    } catch {
      setSearchError("Ошибка поиска");
    }
  };

  const selectSearchResult = (item: SearchResultItem) => {
    safeMapCall(mapInstanceRef.current, (m) => m.setView([item.lat, item.lon], 13));
    setSearchResults([]);
  };

  const panelStyle: React.CSSProperties = {
    pointerEvents: "auto",
    background: "#1e293b",
    color: "#fff",
    padding: "12px 16px",
    borderRadius: 12,
    boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
    fontSize: 14,
    overflow: "hidden",
    minWidth: 0,
  };

  const globePanels = (
    <>
      <div className="z96a-panel" style={{ ...panelStyle, position: "absolute", top: 16, right: 16, maxWidth: "calc(100vw - 32px)", zIndex: 2, visibility: "visible", display: "block" }}>
        {authBlock}
      </div>
      <div className="z96a-panel z96a-globe-nav" style={{ ...panelStyle, background: "rgba(30, 41, 59, 0.92)", boxShadow: "none", overflow: "visible", minWidth: "min-content", position: "absolute", bottom: 20, left: 20, display: "flex", gap: 10, alignItems: "center", maxWidth: "calc(100vw - 40px)", zIndex: 2, visibility: "visible" }}>
        <button type="button" onClick={() => onAutoRotateChange?.(!autoRotate)} style={{ padding: "10px 16px", background: autoRotate ? "#16a34a" : "#475569", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
          {autoRotate ? "Стоп" : "Вращение"}
        </button>
        <button type="button" onClick={() => apiRef.current?.zoomOut()} style={{ padding: "10px 16px", background: "#475569", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16 }}>−</button>
        <button type="button" onClick={() => apiRef.current?.zoomIn()} style={{ padding: "10px 16px", background: "#475569", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16 }}>+</button>
        <button type="button" onClick={() => transitionTo2DRef.current?.()} style={{ padding: "10px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
          На карту
        </button>
        {!showMapOverlay && distanceTo2D != null && distanceTo2D > MAP_THRESHOLD_ENTER_2D && (
          <span style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>
            До 2D: ~{Math.min(100, Math.round(((distanceTo2D - MAP_THRESHOLD_ENTER_2D) / (6 - MAP_THRESHOLD_ENTER_2D)) * 100))}% • ещё ~{Math.max(0, Math.ceil(Math.log(distanceTo2D / MAP_THRESHOLD_ENTER_2D) / Math.log(1.1)))} приближ.
          </span>
        )}
      </div>
    </>
  );

  const zoomToGlobe = Math.max(0, mapZoom - MIN_ZOOM_GLOBE);
  const pluralOtdalenie = (n: number) => {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return "отдалений";
    if (mod10 === 1) return "отдаление";
    if (mod10 >= 2 && mod10 <= 4) return "отдаления";
    return "отдалений";
  };

  const RESULTS_PER_PAGE = 3;
  const searchResultMaxPage = Math.max(0, Math.ceil(searchResults.length / RESULTS_PER_PAGE) - 1);
  const searchResultSlice = searchResults.slice(searchResultPage * RESULTS_PER_PAGE, searchResultPage * RESULTS_PER_PAGE + RESULTS_PER_PAGE);

  const map2dPanels = (
    <>
      <div className="z96a-panel" style={{ ...panelStyle, position: "absolute", top: 16, right: 16, maxWidth: "calc(100vw - 32px)", zIndex: 2, visibility: "visible", display: "block" }}>
        {authBlock}
      </div>
      <div className="z96a-panel" style={{ ...panelStyle, position: "absolute", top: 12, left: 12, display: "flex", flexDirection: "column", gap: 4, maxWidth: "min(400px, calc(100vw - 120px))" }}>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>Текущее местоположение</span>
        <span style={{ fontSize: 12, background: "rgba(0,0,0,0.3)", padding: "4px 10px", borderRadius: 6 }}>{locationText}</span>
      </div>
      <div className="z96a-panel" style={{ ...panelStyle, position: "absolute", top: 100, left: 12, display: "flex", flexDirection: "column", gap: 8, maxWidth: "min(400px, calc(100vw - 120px))" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Город…"
            style={{ padding: "8px 12px", width: 140, borderRadius: 8, border: "2px solid #334155", fontSize: 14, background: "#fff", color: "#111" }}
          />
          <button type="button" onClick={handleSearch} style={{ padding: "8px 14px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            Найти
          </button>
        </div>
        {searchError && <span style={{ fontSize: 12, color: "#f87171" }}>{searchError}</span>}
        {searchResults.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Выберите место:</span>
            {searchResultSlice.map((item, i) => (
              <button
                key={`${item.lat}-${item.lon}-${i}`}
                type="button"
                onClick={() => selectSearchResult(item)}
                style={{ textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "1px solid #475569", background: "rgba(0,0,0,0.2)", color: "#fff", cursor: "pointer", fontSize: 12 }}
              >
                {item.display_name}
              </button>
            ))}
            {searchResultMaxPage > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" onClick={() => setSearchResultPage((p) => Math.max(0, p - 1))} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#475569", color: "#fff", cursor: "pointer", fontSize: 12 }}>‹</button>
                <input
                  type="range"
                  min={0}
                  max={searchResultMaxPage}
                  value={searchResultPage}
                  onChange={(e) => setSearchResultPage(parseInt(e.target.value, 10))}
                  style={{ flex: 1, minWidth: 60 }}
                />
                <button type="button" onClick={() => setSearchResultPage((p) => Math.min(searchResultMaxPage, p + 1))} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#475569", color: "#fff", cursor: "pointer", fontSize: 12 }}>›</button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="z96a-panel" style={{ ...panelStyle, position: "absolute", bottom: 20, left: 20 }}>
        <button type="button" onClick={returnToGlobe} style={{ padding: "10px 16px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
          На глобус
        </button>
      </div>
      <div className="z96a-panel" style={{ ...panelStyle, position: "absolute", bottom: 20, left: 170, display: "flex", flexDirection: "column", gap: 4, maxWidth: "min(240px, calc(100vw - 420px))" }}>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>Масштаб до перехода на глобус</span>
        <span style={{ fontSize: 13 }}>Масштаб {mapZoom}. Ещё {zoomToGlobe} {pluralOtdalenie(zoomToGlobe)}.</span>
      </div>
      <div className="z96a-panel" style={{ ...panelStyle, position: "absolute", bottom: 20, left: 430, display: "flex", gap: 6, alignItems: "center" }}>
        <button type="button" onClick={() => { if (showMapOverlay && mapInstanceRef.current && overlayRef.current && typeof document !== "undefined" && document.body.contains(overlayRef.current)) { try { mapInstanceRef.current.zoomOut(); } catch (_) {} } }} style={{ width: 36, height: 36, padding: 0, border: "none", borderRadius: 8, background: "#475569", color: "#fff", cursor: "pointer", fontSize: 18 }}>−</button>
        <button type="button" onClick={() => { if (showMapOverlay && mapInstanceRef.current && overlayRef.current && typeof document !== "undefined" && document.body.contains(overlayRef.current)) { try { mapInstanceRef.current.zoomIn(); } catch (_) {} } }} style={{ width: 36, height: 36, padding: 0, border: "none", borderRadius: 8, background: "#475569", color: "#fff", cursor: "pointer", fontSize: 18 }}>+</button>
      </div>
      <div className="z96a-panel" style={{ ...panelStyle, position: "absolute", bottom: 20, right: 20, padding: "10px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "40px 40px 40px", gridTemplateRows: "40px 40px 40px", gap: 4, alignItems: "center", justifyItems: "center" }}>
          <button type="button" style={{ width: 40, height: 40, padding: 0, border: "none", borderRadius: 8, background: pressedKeys.up && pressedKeys.left ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 16, touchAction: "none" }} onPointerDown={() => { keysRef.current.up = true; keysRef.current.left = true; setPressedKeys({ ...keysRef.current }); }} onPointerUp={() => { keysRef.current.up = false; keysRef.current.left = false; setPressedKeys({ ...keysRef.current }); }} onPointerCancel={() => { keysRef.current.up = false; keysRef.current.left = false; setPressedKeys({ ...keysRef.current }); }}>↖</button>
          <button type="button" style={{ width: 40, height: 40, padding: 0, border: "none", borderRadius: 8, background: pressedKeys.up ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 18, touchAction: "none" }} onPointerDown={() => { keysRef.current.up = true; setPressedKeys({ ...keysRef.current }); }} onPointerUp={() => { keysRef.current.up = false; setPressedKeys({ ...keysRef.current }); }} onPointerCancel={() => { keysRef.current.up = false; setPressedKeys({ ...keysRef.current }); }}>↑</button>
          <button type="button" style={{ width: 40, height: 40, padding: 0, border: "none", borderRadius: 8, background: pressedKeys.up && pressedKeys.right ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 16, touchAction: "none" }} onPointerDown={() => { keysRef.current.up = true; keysRef.current.right = true; setPressedKeys({ ...keysRef.current }); }} onPointerUp={() => { keysRef.current.up = false; keysRef.current.right = false; setPressedKeys({ ...keysRef.current }); }} onPointerCancel={() => { keysRef.current.up = false; keysRef.current.right = false; setPressedKeys({ ...keysRef.current }); }}>↗</button>
          <button type="button" style={{ width: 40, height: 40, padding: 0, border: "none", borderRadius: 8, background: pressedKeys.left ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 18, touchAction: "none" }} onPointerDown={() => { keysRef.current.left = true; setPressedKeys({ ...keysRef.current }); }} onPointerUp={() => { keysRef.current.left = false; setPressedKeys({ ...keysRef.current }); }} onPointerCancel={() => { keysRef.current.left = false; setPressedKeys({ ...keysRef.current }); }}>←</button>
          <div style={{ width: 40, height: 40 }} />
          <button type="button" style={{ width: 40, height: 40, padding: 0, border: "none", borderRadius: 8, background: pressedKeys.right ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 18, touchAction: "none" }} onPointerDown={() => { keysRef.current.right = true; setPressedKeys({ ...keysRef.current }); }} onPointerUp={() => { keysRef.current.right = false; setPressedKeys({ ...keysRef.current }); }} onPointerCancel={() => { keysRef.current.right = false; setPressedKeys({ ...keysRef.current }); }}>→</button>
          <button type="button" style={{ width: 40, height: 40, padding: 0, border: "none", borderRadius: 8, background: pressedKeys.down && pressedKeys.left ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 16, touchAction: "none" }} onPointerDown={() => { keysRef.current.down = true; keysRef.current.left = true; setPressedKeys({ ...keysRef.current }); }} onPointerUp={() => { keysRef.current.down = false; keysRef.current.left = false; setPressedKeys({ ...keysRef.current }); }} onPointerCancel={() => { keysRef.current.down = false; keysRef.current.left = false; setPressedKeys({ ...keysRef.current }); }}>↙</button>
          <button type="button" style={{ width: 40, height: 40, padding: 0, border: "none", borderRadius: 8, background: pressedKeys.down ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 18, touchAction: "none" }} onPointerDown={() => { keysRef.current.down = true; setPressedKeys({ ...keysRef.current }); }} onPointerUp={() => { keysRef.current.down = false; setPressedKeys({ ...keysRef.current }); }} onPointerCancel={() => { keysRef.current.down = false; setPressedKeys({ ...keysRef.current }); }}>↓</button>
          <button type="button" style={{ width: 40, height: 40, padding: 0, border: "none", borderRadius: 8, background: pressedKeys.down && pressedKeys.right ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 16, touchAction: "none" }} onPointerDown={() => { keysRef.current.down = true; keysRef.current.right = true; setPressedKeys({ ...keysRef.current }); }} onPointerUp={() => { keysRef.current.down = false; keysRef.current.right = false; setPressedKeys({ ...keysRef.current }); }} onPointerCancel={() => { keysRef.current.down = false; keysRef.current.right = false; setPressedKeys({ ...keysRef.current }); }}>↘</button>
        </div>
      </div>
    </>
  );

  // Одна обёртка с pointerEvents "none": клики проходят к канвасу (глобус) или к карте (2D). Панели с pointerEvents "auto".
  const uiContent = (
    <div
      className="z96a-ui-root-content"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      {/* При старте showMapOverlay === false → всегда рендерится globePanels, пустой ветки нет */}
      {!showMapOverlay ? globePanels : map2dPanels}
    </div>
  );

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0 }}>
        <div
          ref={containerRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 0,
            pointerEvents: "none",
          }}
        />
        <div
          ref={labelsContainerRef}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 5,
            visibility: showMapOverlay ? "hidden" : "visible",
          }}
        />
        <div style={{ position: "absolute", inset: 0, zIndex: 10, width: "100%", height: "100%", visibility: showMapOverlay ? "visible" : "hidden", pointerEvents: showMapOverlay ? "auto" : "none" }}>
          <div ref={overlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: "auto" }} />
        </div>
      </div>
      <div
        id="z96a-ui-root"
        data-z96a-ui="root"
        role="presentation"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 1000,
          pointerEvents: "none",
          display: "block",
          visibility: "visible",
          overflow: "visible",
        }}
      >
        {uiContent}
      </div>
    </div>
  );
}
