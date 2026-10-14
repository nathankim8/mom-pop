# Mom & Pop Atlas — LA Opportunity Map (MVP)

Location intelligence for small food businesses in Los Angeles: food trucks, carts and pop-ups find
promising spots, and permanent restaurants understand the strengths and weaknesses of their area.

The app has two data sources, switched in the filter bar and never blended:

- **USC area · real data** (default): *Modeled Pedestrian Activity* for USC / Exposition Park — a percentile of a
  6-feature index built from public data (OSM, LA City business listings, Census LODES jobs, Census 2020 population,
  Metro GTFS), validated against 22 LADOT pedestrian count sites (rank correlation ≈ 0.7). It ranks places; it is not
  a count and not hourly. Competitors are OpenStreetMap food places. See `pipeline/VALIDATION.md` or the in-app
  *Methodology* panel.
- **All LA · simulated**: the original illustrative model (`src/data/simulated/`). Not observations — don't use it for
  real leasing or operating decisions.

### Rebuilding the real-data model

```bash
cd pipeline
python3 -I scripts/build_features.py .     # raw datasets → per-site and per-cell features
python3 -I scripts/model_validate.py .     # models + cross-validation against LADOT counts
python3 -I scripts/plot_validation.py .    # out/validation.png
python3 -I scripts/export_app_data.py .    # → public/data/usc-model-v1.json (read by src/data/usc/)
```

## Run it locally

Requires Node.js 18+ (tested with Node 24).

```bash
npm install      # first time only
npm run dev      # then open http://localhost:5173
```

Other scripts: `npm run build` (type-check + production build into `dist/`), `npm run preview` (serve the build).

No API keys or paid services are needed. The basemap comes from [OpenFreeMap](https://openfreemap.org) (free, no key).

## Features

| Feature | Where |
| --- | --- |
| Interactive LA map (MapLibre GL) | `components/MapView.tsx` |
| Heat map: opportunity / foot traffic / vehicles / competitors | `MapView.tsx` + `App.tsx` (`heat`) |
| Filters: time of day, day of week, business type | `components/FilterBar.tsx` |
| Click anywhere → foot traffic, competitors, opportunity score | `components/LocationCard.tsx`, `hooks/useLocationDetail.ts` |
| Ranked vending spots sidebar | `components/RankingSidebar.tsx`, `analysis/rankings.ts` |
| Restaurant area analysis (score breakdown, disadvantages, demand by time, competitors) | `components/AreaAnalysisPanel.tsx`, `analysis/areaReport.ts` |

## Architecture

```
src/
  components/   UI only — React + Tailwind, no business logic
  hooks/        Glue: fetch from the data provider, run analysis, hand results to UI
  analysis/     Pure scoring logic (provider-agnostic, easy to unit test & tune)
  data/
    provider.ts         The LocationDataProvider interface (the "contract")
    index.ts            The one line that chooses which provider the app uses
    simulated/          Simulated all-LA provider: LA hubs, roads, time patterns, fake competitors
    usc/                USC real-data model provider (loads public/data/usc-model-v1.json)
  config/       Labels, colors, map settings
  lib/          Geo math, seeded random, formatting
```

**Data flows one way:** provider → hooks → analysis → components. The UI never knows whether data is
simulated or real; it only sees `ActivitySignals` (0–100 indices), `Competitor`s and `CandidateSite`s.

### Connecting real data later

1. Create `src/data/live/liveProvider.ts` implementing `LocationDataProvider` (all methods are async, so API calls fit).
2. Register it in `DATA_PROVIDERS` in `src/data/index.ts` (and add it to the source switch in `FilterBar`).
3. Possible sources: foot-traffic vendors (e.g. Placer.ai, Advan, Unacast — paid), Caltrans / LADOT traffic counts,
   LA City Open Data business licenses, LA County health inspection records, Google Places / Yelp Fusion (keys & quotas).

Providers can also mix sources, e.g. real competitors from business licenses and simulated foot traffic,
as long as `info.isSimulated` stays honest so the UI keeps showing the "Simulated data" label.

### How the scores work (first-pass assumptions, all tunable in `analysis/scoring.ts`)

- **Demand** = 78% foot traffic + 22% vehicle traffic, weighted by how much that business type benefits from the
  time slot (e.g. coffee ×1.4 in the morning, tacos ×1.25 late night).
- **Competition pressure** = nearby same-cuisine businesses (full weight) + other food (20%), closer ones count more.
- **Opportunity** = demand, discounted exponentially as competition exceeds what that demand can support.
- **Restaurant location score** = foot traffic 35%, room to compete 25%, week-round consistency 15%,
  drive-by visibility 15%, mobile-vendor pressure 10%.
