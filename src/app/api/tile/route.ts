/**
 * API-прокси тайлов карты: GET /api/tile?z=&x=&y=&source=
 * source=osm — только OSM; иначе сначала ESRI, при ошибке fallback на OSM.
 * Возвращает бинарный PNG с кэшированием.
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OSM_TILE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ESRI_TILE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function getTileUrl(
  z: string,
  x: string,
  y: string,
  source: string | null
): string {
  if (source === "osm") {
    return OSM_TILE.replace("{z}", z).replace("{x}", x).replace("{y}", y);
  }
  return ESRI_TILE.replace("{z}", z).replace("{y}", y).replace("{x}", x);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const z = searchParams.get("z");
  const x = searchParams.get("x");
  const y = searchParams.get("y");
  const source = searchParams.get("source");
  if (!z || !x || !y) {
    return NextResponse.json({ error: "z, x, y required" }, { status: 400 });
  }
  const useOsmOnly = source === "osm";
  const url = useOsmOnly
    ? getTileUrl(z, x, y, "osm")
    : getTileUrl(z, x, y, null);
  const fallbackUrl = getTileUrl(z, x, y, "osm");

  const fetchWithTimeout = (u: string, ms: number) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return fetch(u, { signal: ctrl.signal, cache: "force-cache" }).finally(() =>
      clearTimeout(t)
    );
  };

  try {
    let res: Response;
    if (useOsmOnly) {
      res = await fetchWithTimeout(url, 10000);
    } else {
      try {
        res = await fetchWithTimeout(url, 4000);
      } catch {
        res = await fetchWithTimeout(fallbackUrl, 10000);
      }
    }
    const blob = await res.blob();
    const buf = await blob.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    if (!useOsmOnly) {
      try {
        const res = await fetchWithTimeout(fallbackUrl, 10000);
        const blob = await res.blob();
        const buf = await blob.arrayBuffer();
        return new NextResponse(buf, {
          headers: {
            "Content-Type": res.headers.get("Content-Type") ?? "image/png",
            "Cache-Control": "public, max-age=86400",
          },
        });
      } catch (_) {}
    }
    console.error("[tile]", e);
    return NextResponse.json({ error: "Tile fetch failed" }, { status: 500 });
  }
}
