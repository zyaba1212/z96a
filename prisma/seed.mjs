/**
 * Сидер этапа 4: глобальные и локальные провайдеры, тестовые элементы сети.
 * Источники: глобальные кабели — TeleGeography submarine cable map (официальные данные).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.networkElement.count();
  if (count > 0) {
    console.log("Network already seeded, skip.");
    return;
  }

  const globalProvider = await prisma.networkProvider.create({
    data: {
      name: "Global backbone (sample)",
      scope: "GLOBAL",
      sourceUrl: "https://www.telegeography.com/submarine-cable-map",
    },
  });

  const localProvider = await prisma.networkProvider.create({
    data: {
      name: "Local (sample)",
      scope: "LOCAL",
      sourceUrl: null,
    },
  });

  await prisma.networkElement.createMany({
    data: [
      {
        scope: "GLOBAL",
        type: "CABLE_FIBER",
        providerId: globalProvider.id,
        name: "Sample transatlantic (segment)",
        path: [
          { lat: 51.5, lng: -0.1 },
          { lat: 50.2, lng: -4.2 },
          { lat: 40.4, lng: -73.9 },
        ],
      },
      {
        scope: "GLOBAL",
        type: "CABLE_COPPER",
        providerId: globalProvider.id,
        name: "Sample copper (segment)",
        path: [
          { lat: 55.75, lng: 37.62 },
          { lat: 55.5, lng: 38.0 },
          { lat: 55.2, lng: 38.5 },
        ],
      },
      {
        scope: "GLOBAL",
        type: "BASE_STATION",
        providerId: globalProvider.id,
        name: "BS sample",
        lat: 55.75,
        lng: 37.62,
      },
      {
        scope: "GLOBAL",
        type: "SATELLITE",
        providerId: globalProvider.id,
        name: "Sat (sample)",
        lat: 0,
        lng: -30,
      },
      {
        scope: "LOCAL",
        type: "EQUIPMENT",
        providerId: localProvider.id,
        name: "Local node",
        lat: 55.76,
        lng: 37.63,
      },
    ],
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
