/**
 * Синхронизация позиций спутников из CelesTrak (TLE) с расчётом через satellite.js.
 * Запуск: npm run sync:satellites. Требует DATABASE_URL и установленный satellite.js.
 * Дедупликация по sourceId (norad_<NORAD_CAT_NUMBER>). Позиции пересчитываются на текущий момент.
 */
import { PrismaClient } from "@prisma/client";
import * as satellite from "satellite.js";

const prisma = new PrismaClient();

const CELESTRAK_ACTIVE_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle";
const MAX_SATELLITES = 150;

function parseTLE(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.length > 0);
  const out = [];
  for (let i = 0; i + 2 <= lines.length; i += 3) {
    const name = lines[i].trim();
    const tle1 = lines[i + 1];
    const tle2 = lines[i + 2];
    if (tle1?.startsWith("1 ") && tle2?.startsWith("2 ")) {
      const norad = tle2.slice(2, 7).trim();
      out.push({ name, tle1, tle2, norad });
    }
  }
  return out;
}

function getPositionAt(tleLine1, tleLine2, date) {
  try {
    const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
    const posVel = satellite.propagate(satrec, date);
    const pos = posVel.position;
    if (!pos || typeof pos.x !== "number") return null;
    const gmst = satellite.gstime(date);
    const gd = satellite.eciToGeodetic(pos, gmst);
    const lat = (gd.latitude * 180) / Math.PI;
    const lng = (gd.longitude * 180) / Math.PI;
    const altitude = gd.height;
    return { lat, lng, altitude };
  } catch {
    return null;
  }
}

async function main() {
  let provider = await prisma.networkProvider.findFirst({
    where: { scope: "GLOBAL", name: { contains: "CelesTrak" } },
  });
  if (!provider) {
    provider = await prisma.networkProvider.create({
      data: {
        name: "CelesTrak (NORAD)",
        scope: "GLOBAL",
        sourceUrl: "https://celestrak.org/NORAD/elements/",
      },
    });
  }

  const res = await fetch(CELESTRAK_ACTIVE_URL);
  if (!res.ok) {
    console.error("CelesTrak fetch failed:", res.status);
    process.exit(1);
  }
  const text = await res.text();
  const satellites = parseTLE(text).slice(0, MAX_SATELLITES);
  console.log("Parsed", satellites.length, "TLE sets (using first", MAX_SATELLITES, ")");

  const now = new Date();
  let created = 0;
  let updated = 0;
  for (const sat of satellites) {
    const pos = getPositionAt(sat.tle1, sat.tle2, now);
    if (!pos) continue;
    const sourceId = `norad_${sat.norad}`;
    const payload = {
      scope: "GLOBAL",
      type: "SATELLITE",
      providerId: provider.id,
      name: sat.name.slice(0, 255),
      lat: pos.lat,
      lng: pos.lng,
      altitude: pos.altitude,
      sourceId,
      metadata: { norad: sat.norad, updatedAt: now.toISOString() },
    };

    const existing = await prisma.networkElement.findUnique({ where: { sourceId } });
    if (existing) {
      await prisma.networkElement.update({ where: { id: existing.id }, data: payload });
      updated++;
    } else {
      await prisma.networkElement.create({ data: payload });
      created++;
    }
  }

  console.log("Done. Created:", created, "Updated:", updated);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
