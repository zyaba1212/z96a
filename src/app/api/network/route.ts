/**
 * Данные сети для визуализации: GET /api/network?scope=GLOBAL|LOCAL&bbox=minLat,minLng,maxLat,maxLng
 * GLOBAL — для глобуса (и для 2D при отображении глобальных кабелей). LOCAL — только для 2D-карты.
 * bbox — опционально, для scope=LOCAL: фильтр по bounding box (lat/lng в пределах области).
 * Без scope возвращает все элементы.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope"); // "GLOBAL" | "LOCAL" | null
  const bbox = searchParams.get("bbox"); // "minLat,minLng,maxLat,maxLng" для LOCAL

  try {
    const where: { scope?: string; lat?: { gte: number; lte: number }; lng?: { gte: number; lte: number } } =
      scope === "GLOBAL" || scope === "LOCAL" ? { scope } : {};
    if (scope === "LOCAL" && bbox) {
      const [minLat, minLng, maxLat, maxLng] = bbox.split(",").map(Number);
      if ([minLat, minLng, maxLat, maxLng].every((n) => !Number.isNaN(n))) {
        where.lat = { not: null, gte: minLat, lte: maxLat };
        where.lng = { not: null, gte: minLng, lte: maxLng };
      }
    }
    const elements = await prisma.networkElement.findMany({
      where,
      include: { provider: { select: { id: true, name: true, scope: true, sourceUrl: true } } },
      orderBy: [{ scope: "asc" }, { type: "asc" }],
    });
    const providers = await prisma.networkProvider.findMany({
      select: { id: true, name: true, scope: true, sourceUrl: true },
    });
    return NextResponse.json({ elements, providers });
  } catch (e) {
    console.error("[api/network]", e);
    return NextResponse.json({ error: "Network fetch failed" }, { status: 500 });
  }
}
