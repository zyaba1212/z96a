# Скрипты сбора данных (этап 4)

- **npm run sync:cables** — загрузка подводных кабелей. Сначала запрос к ArcGIS FeatureServer (TeleGeography); при недоступности — чтение из `scripts/data/submarine-cables.geojson` (GeoJSON FeatureCollection). Дедупликация по `sourceId`.
- **npm run sync:satellites** — загрузка позиций спутников из CelesTrak (TLE), расчёт координат через satellite.js, запись в БД (тип SATELLITE, lat/lng/altitude). Дедупликация по `sourceId` (norad_*).

Требования: `DATABASE_URL` в `.env`, выполненный `npx prisma db push` (или миграция) и `npx prisma generate`. Для спутников установлен пакет `satellite.js`.

Локальные данные кабелей: положите GeoJSON в `scripts/data/submarine-cables.geojson` (формат FeatureCollection, каждая feature — geometry типа LineString или MultiLineString, properties — по желанию).
