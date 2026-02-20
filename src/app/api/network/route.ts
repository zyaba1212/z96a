/**
 * Данные сети для визуализации: GET /api/network?scope=GLOBAL|LOCAL
 * GLOBAL — для глобуса (и для 2D при отображении глобальных кабелей). LOCAL — только для 2D-карты.
 * Без scope возвращает все элементы.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope"); // "GLOBAL" | "LOCAL" | null

  try {
    const where = scope === "GLOBAL" || scope === "LOCAL" ? { scope } : {};
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
