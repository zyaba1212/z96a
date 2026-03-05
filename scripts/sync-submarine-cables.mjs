/**
 * Синхронизация подводных кабелей: ArcGIS FeatureServer (TeleGeography) или локальный GeoJSON.
 * Запуск: npm run sync:cables (из корня проекта). Требует DATABASE_URL в .env.
 * Дедупликация по sourceId. Локальный файл: scripts/data/submarine-cables.geojson (GeoJSON FeatureCollection).
 */
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const ARCGIS_URL =
  "https://services.arcgis.com/6DIQcwlPy8knb6sg/arcgis/rest/services/SubmarineCables/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=json&resultRecordCount=200";

function coordsToPath(rings) {
  const pathOut = [];
  for (const ring of rings || []) {
    for (const pt of ring) {
      const [lng, lat] = Array.isArray(pt) ? pt : [pt?.lng, pt?.lat];
      if (typeof lat === "number" && typeof lng === "number") pathOut.push({ lat, lng });
    }
  }
  return pathOut;
}

/** Из GeoJSON geometry (LineString или MultiLineString) — массив {lat, lng}. */
function geoJsonCoordsToPath(geom) {
  if (!geom || !geom.coordinates) return [];
  const c = geom.coordinates;
  if (geom.type === "LineString") return c.map(([lng, lat]) => ({ lat, lng }));
  if (geom.type === "MultiLineString") return coordsToPath(c);
  return [];
}

async function main() {
  let provider = await prisma.networkProvider.findFirst({
    where: { scope: "GLOBAL", sourceUrl: { not: null } },
  });
  if (!provider) {
    provider = await prisma.networkProvider.create({
      data: {
        name: "Submarine cables",
        scope: "GLOBAL",
        sourceUrl: "https://www.telegeography.com/submarine-cable-map",
      },
    });
  }

  let features = [];
  const res = await fetch(ARCGIS_URL);
  if (res.ok) {
    const data = await res.json();
    if (!data.error && Array.isArray(data.features)) {
      features = data.features;
      console.log("Fetched", features.length, "cable features from ArcGIS");
    }
  }
  if (features.length === 0) {
    const localPath = path.join(__dirname, "data", "submarine-cables.geojson");
    if (fs.existsSync(localPath)) {
      const geojson = JSON.parse(fs.readFileSync(localPath, "utf8"));
      features = (geojson.features || []).map((f, i) => ({
        attributes: { ...f.properties, OBJECTID: f.id ?? i },
        geometry: f.geometry,
      }));
      console.log("Loaded", features.length, "cable features from", localPath);
    } else {
      console.warn("ArcGIS unavailable and no", localPath, "- add GeoJSON or check network. Exiting.");
      await prisma.$disconnect();
      return;
    }
  }

  let created = 0;
  let updated = 0;
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const attrs = f.attributes || {};
    const geom = f.geometry || {};
    const objectId = attrs.OBJECTID ?? attrs.FID ?? attrs.objectId ?? attrs.id;
    const sourceId = objectId != null ? `cable_${objectId}` : `cable_${i}`;
    const name = attrs.Name ?? attrs.name ?? attrs.CABLE ?? attrs.cable ?? attrs.id ?? `Cable ${sourceId}`;

    let path = [];
    if (geom.paths?.length || geom.rings?.length) path = coordsToPath(geom.paths || geom.rings);
    else if (geom.coordinates) path = geoJsonCoordsToPath(geom);
    if (path.length < 2) continue;

    const payload = {
      scope: "GLOBAL",
      type: "CABLE_FIBER",
      providerId: provider.id,
      name: String(name).slice(0, 255),
      path,
      sourceId,
      metadata: { owner: attrs.Owner ?? attrs.owner, readyForService: attrs.ReadyForService ?? attrs.readyForService },
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
