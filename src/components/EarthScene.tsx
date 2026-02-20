"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "leaflet/dist/leaflet.css";

const R = 1;
const MAP_THRESHOLD = 1.25;
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

function raDecToXYZ(raHours: number, decDeg: number, radius: number): [number, number, number] {
  const ra = (raHours * 15 * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const x = radius * Math.cos(dec) * Math.cos(ra);
  const y = radius * Math.sin(dec);
  const z = -radius * Math.cos(dec) * Math.sin(ra);
  return [x, y, z];
}

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

function latLngToXYZ(lat: number, lng: number): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = (lng * Math.PI) / 180;
  return [
    R * Math.sin(phi) * Math.cos(theta),
    R * Math.cos(phi),
    -R * Math.sin(phi) * Math.sin(theta),
  ];
}

function xyzToLatLon(x: number, y: number, z: number): { lat: number; lon: number } {
  const phi = Math.acos(Math.max(-1, Math.min(1, y / R)));
  const lat = 90 - (phi * 180) / Math.PI;
  const lon = (Math.atan2(-z, x) * 180) / Math.PI;
  return { lat, lon };
}

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

type LabelEntry = { pos: THREE.Vector3; el: HTMLDivElement };

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
  const mapInstanceRef = useRef<ReturnType<typeof import("leaflet").map> | null>(null);
  const overlayShownRef = useRef(false);

  const [showMapOverlay, setShowMapOverlay] = useState(false);
  const [mapCenter, setMapCenter] = useState<MapCenter | null>(null);
  const [locationText, setLocationText] = useState<string>("Загрузка…");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(12);
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const PAN_STEP = 80;
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

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
    const map = mapInstanceRef.current;
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!map || !controls || !camera || !renderer) {
      setShowMapOverlay(false);
      setMapCenter(null);
      return;
    }
    const center = map.getCenter();
    const lat = center.lat;
    const lon = center.lng;
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
    try {
      map.off();
      map.remove();
    } catch (_) {}
    mapInstanceRef.current = null;
    overlayShownRef.current = false;
    setShowMapOverlay(false);
    setMapCenter(null);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000814);
    const w = container.clientWidth;
    const h = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000);
    camera.position.set(0, 0, 7);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    cameraRef.current = camera;
    const timeRef = { current: 0 };
    const starfield = addStarfield(scene, timeRef);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.position = "relative";
    renderer.domElement.style.zIndex = "0";
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
    };
    window.addEventListener("resize", onResize);
    onResize();

    let id: number;
    const animate = () => {
      id = requestAnimationFrame(animate);
      const ctrl = controlsRef.current;
      if (ctrl) {
        ctrl.autoRotate = autoRotateRef.current;
        ctrl.update();
        const dist = camera.position.distanceTo(ctrl.target);
        if (dist < MAP_THRESHOLD && !overlayShownRef.current) {
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
          overlayShownRef.current = true;
          setMapCenter({ lat, lon });
          setShowMapOverlay(true);
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
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(id);
      mapInstanceRef.current?.remove();
      controls.dispose();
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

  useEffect(() => {
    if (!showMapOverlay || !mapCenter) return;
    const overlay = overlayRef.current;
    if (!overlay || typeof window === "undefined") return;
    let L: typeof import("leaflet");
    import("leaflet").then((leaflet) => {
      L = leaflet.default;
      requestAnimationFrame(() => {
        if (!overlay) return;
        const map = L.map(overlay, { attributionControl: false, zoomControl: false }).setView(
          [mapCenter!.lat, mapCenter!.lon],
          12
        );
        L.tileLayer("/api/tile?z={z}&x={x}&y={y}&source=osm", {}).addTo(map);
        map.invalidateSize();
        mapInstanceRef.current = map;
        map.on("zoomend", () => {
          if (mapInstanceRef.current !== map) return;
          try {
            const z = map.getZoom();
            setMapZoom(z);
            if (z < MIN_ZOOM_GLOBE) returnToGlobe();
          } catch (_) {}
        });
        map.on("moveend", () => {
          if (mapInstanceRef.current !== map) return;
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
        try {
          const c = map.getCenter();
          fetch(`/api/geocode/reverse?lat=${c.lat}&lng=${c.lng}`)
            .then((r) => r.json())
            .then((data: { display_name?: string }) => {
              setLocationText(data?.display_name || "Адрес не определён");
            })
            .catch(() => setLocationText("Адрес не определён"));
        } catch (_) {
          setLocationText("Адрес не определён");
        }
      });
      return () => {
        const m = mapInstanceRef.current;
        if (m) {
          try {
            m.off();
            m.remove();
          } catch (_) {}
          mapInstanceRef.current = null;
        }
      };
    });
  }, [showMapOverlay, mapCenter, returnToGlobe]);

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
        keysRef.current.up = true;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        keysRef.current.down = true;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        keysRef.current.left = true;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        keysRef.current.right = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") keysRef.current.up = false;
      if (e.key === "ArrowDown") keysRef.current.down = false;
      if (e.key === "ArrowLeft") keysRef.current.left = false;
      if (e.key === "ArrowRight") keysRef.current.right = false;
    };
    let rafId: number;
    const tick = () => {
      const map = mapInstanceRef.current;
      if (map) {
        let dx = 0,
          dy = 0;
        if (keysRef.current.left) dx += PAN_STEP;
        if (keysRef.current.right) dx -= PAN_STEP;
        if (keysRef.current.up) dy += PAN_STEP;
        if (keysRef.current.down) dy -= PAN_STEP;
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
  }, [showMapOverlay]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchResult(null);
    try {
      const res = await fetch(
        `/api/geocode/search?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        const { lat, lon, display_name } = data[0];
        const latN = parseFloat(lat);
        const lonN = parseFloat(lon);
        setSearchResult(display_name || `${latN.toFixed(2)}, ${lonN.toFixed(2)}`);
        mapInstanceRef.current?.setView([latN, lonN], 13);
      } else setSearchResult("Не найдено");
    } catch {
      setSearchResult("Ошибка поиска");
    }
  };

  const uiLayerStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    minHeight: "100vh",
    zIndex: 2147483647,
    pointerEvents: "none",
    overflow: "visible",
    visibility: "visible",
    display: "block",
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

  const layerBase = { ...uiLayerStyle };

  const globePanels = (
    <>
      <div className="z96a-panel" style={{ ...panelStyle, position: "absolute", top: 16, right: 16, maxWidth: "calc(100vw - 32px)", zIndex: 2, visibility: "visible", display: "block" }}>
        {authBlock}
      </div>
      <div className="z96a-panel z96a-globe-nav" style={{ ...panelStyle, background: "rgba(30, 41, 59, 0.92)", boxShadow: "none", overflow: "visible", minWidth: "min-content", position: "absolute", bottom: 20, left: 20, display: "flex", gap: 10, alignItems: "center", maxWidth: "calc(100vw - 40px)", zIndex: 2, visibility: "visible" }}>
        <button type="button" onClick={() => onAutoRotateChange?.(!autoRotate)} style={{ padding: "10px 16px", background: autoRotate ? "#16a34a" : "#475569", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
          {autoRotate ? "Стоп" : "Вращение"}
        </button>
        <button type="button" onClick={() => apiRef.current?.zoomIn()} style={{ padding: "10px 16px", background: "#475569", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16 }}>+</button>
        <button type="button" onClick={() => apiRef.current?.zoomOut()} style={{ padding: "10px 16px", background: "#475569", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16 }}>−</button>
      </div>
    </>
  );

  const map2dPanels = (
    <>
      <div className="z96a-panel" style={{ ...panelStyle, position: "absolute", top: 12, left: 12, right: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", maxWidth: "min(520px, calc(100vw - 24px))" }}>
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
        <span style={{ fontSize: 12, background: "rgba(0,0,0,0.3)", padding: "4px 10px", borderRadius: 6 }}>{locationText}</span>
      </div>
      <div className="z96a-panel" style={{ ...panelStyle, position: "absolute", bottom: 20, left: 20, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", maxWidth: "calc(100vw - 180px)" }}>
        <button type="button" onClick={returnToGlobe} style={{ padding: "10px 16px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
          На глобус
        </button>
        <span style={{ fontSize: 13 }}>Масштаб {mapZoom}. До перехода на глобус: ещё {Math.max(0, mapZoom - 11)} отдалений.</span>
      </div>
      <div className="z96a-panel" style={{ ...panelStyle, position: "absolute", bottom: 20, right: 20, padding: "10px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gridTemplateRows: "40px 40px 40px", gap: 4, alignItems: "center", justifyItems: "center" }}>
          <div />
          <button type="button" style={{ width: 40, height: 40, padding: 0, border: "none", borderRadius: 8, background: "rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 18, touchAction: "none" }} onPointerDown={() => { keysRef.current.up = true; }} onPointerUp={() => { keysRef.current.up = false; }} onPointerCancel={() => { keysRef.current.up = false; }}>↑</button>
          <div />
          <button type="button" style={{ width: 40, height: 40, padding: 0, border: "none", borderRadius: 8, background: "rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 18, touchAction: "none" }} onPointerDown={() => { keysRef.current.left = true; }} onPointerUp={() => { keysRef.current.left = false; }} onPointerCancel={() => { keysRef.current.left = false; }}>←</button>
          <div style={{ width: 40, height: 40 }} />
          <button type="button" style={{ width: 40, height: 40, padding: 0, border: "none", borderRadius: 8, background: "rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 18, touchAction: "none" }} onPointerDown={() => { keysRef.current.right = true; }} onPointerUp={() => { keysRef.current.right = false; }} onPointerCancel={() => { keysRef.current.right = false; }}>→</button>
          <div />
          <button type="button" style={{ width: 40, height: 40, padding: 0, border: "none", borderRadius: 8, background: "rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 18, touchAction: "none" }} onPointerDown={() => { keysRef.current.down = true; }} onPointerUp={() => { keysRef.current.down = false; }} onPointerCancel={() => { keysRef.current.down = false; }}>↓</button>
          <div />
        </div>
      </div>
      {searchResult && (
        <div className="z96a-panel" style={{ ...panelStyle, position: "absolute", top: 130, left: 16, right: 16, maxWidth: "calc(100vw - 32px)", color: "#e2e8f0" }}>
          {searchResult}
        </div>
      )}
    </>
  );

  const uiContent = (
    <div className="z96a-ui-layer" style={layerBase}>
      <div
        data-ui-branch="globe"
        style={{
          display: "block",
          visibility: showMapOverlay ? "hidden" : "visible",
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: showMapOverlay ? 0 : 2,
        }}
      >
        {globePanels}
      </div>
      <div
        data-ui-branch="2d"
        style={{
          display: "block",
          visibility: showMapOverlay ? "visible" : "hidden",
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: showMapOverlay ? 2 : 0,
        }}
      >
        {map2dPanels}
      </div>
    </div>
  );

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "100vh" }}>
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
        {showMapOverlay && (
          <div style={{ position: "absolute", inset: 0, zIndex: 10, width: "100%", height: "100%" }}>
            <div ref={overlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1 }} />
          </div>
        )}
      </div>
      <div
        id="z96a-ui-root"
        data-z96a-ui="root"
        role="presentation"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
          minHeight: "100vh",
          zIndex: 2147483647,
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
