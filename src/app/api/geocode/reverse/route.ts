/**
 * Обратный геокодинг: GET /api/geocode/reverse?lat=&lng=
 * Возвращает данные Nominatim (display_name и др.) по координатам.
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const res = await fetch(url, { headers: { "User-Agent": "z96a/1.0" } });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[geocode/reverse]", e);
    return NextResponse.json({ error: "Geocode failed" }, { status: 500 });
  }
}
