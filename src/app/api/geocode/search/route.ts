/**
 * Поиск по адресу/месту: GET /api/geocode/search?q=
 * Прокси к Nominatim Search, возвращает массив результатов (limit 10).
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q?.trim()) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=10`;
    const res = await fetch(url, { headers: { "User-Agent": "z96a/1.0" } });
    const data = await res.json();
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error("[geocode/search]", e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
