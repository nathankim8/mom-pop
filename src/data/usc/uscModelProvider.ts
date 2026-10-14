/**
 * USC / Exposition Park pedestrian-activity model, built from public data by `pipeline/`
 * (OSM, LA City business listings, LODES, Census 2020, Metro GTFS) and checked against LADOT counts.
 *
 * What it can and cannot say (see pipeline/VALIDATION.md):
 *  - pedestrian = percentile of an equal-weight 6-feature index, computed ONCE over the whole model grid.
 *    It ranks places; it is not a count, and it does not vary by time or day (no hourly data was validated).
 *  - vehicle = null (no real vehicle data was used).
 *  - competitors = OpenStreetMap food places (observed listings, completeness varies).
 *  - Outside the model area every method returns null / nothing — it never falls back to simulated data.
 */
import type { LocationDataProvider } from '../provider';
import { contains } from '../provider';
import type {
  Bounds, CandidateSite, Competitor, ConfidenceInfo, DataSourceInfo, GridCell, LngLat, ModelMethodology,
  ModelValidation, ObservedCountSite, TimeOfDay, TransitSupply,
} from '../../types';
import { CONFIDENCE_FLAGS } from '../../types';
import { distanceM } from '../../lib/geo';

const DATA_URL = `${import.meta.env.BASE_URL}data/usc-model-v1.json`;

interface ModelFile {
  version: string;
  generated: string;
  area: Bounds;
  grid: { south: number; west: number; dLat: number; dLng: number; rows: number; cols: number; percentile: number[]; flags: number[] };
  features: string[];
  validation: ModelValidation;
  ladot: ObservedCountSite[];
  transit: { referenceDate: string; dayType: string; stops: { mode: 'bus' | 'rail'; name: string; position: LngLat; hourly: number[] }[] };
  competitors: Competitor[];
  candidateSites: CandidateSite[];
}

/** Model area as exported by pipeline/scripts/export_app_data.py (checked against the file on load). */
export const USC_MODEL_AREA: Bounds = { south: 33.98317, north: 34.05642, west: -118.32621, east: -118.24384 };

/** Hours (0–23) that make up each time slot, matching TIME_LABELS. */
const SLOT_HOURS: Record<TimeOfDay, number[]> = {
  morning: [7, 8, 9],
  lunch: [11, 12, 13],
  dinner: [17, 18, 19],
  late: [21, 22, 23, 0],
};
const TRANSIT_RADIUS_M = 400;

export function createUscModelProvider(): LocationDataProvider {
  let file: Promise<ModelFile> | null = null;
  const load = () =>
    (file ??= fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load ${DATA_URL}: ${r.status}`);
        return r.json() as Promise<ModelFile>;
      })
      .then((d) => {
        const a = d.area;
        const drift = Math.max(
          Math.abs(a.south - USC_MODEL_AREA.south), Math.abs(a.north - USC_MODEL_AREA.north),
          Math.abs(a.west - USC_MODEL_AREA.west), Math.abs(a.east - USC_MODEL_AREA.east),
        );
        if (drift > 1e-4) console.warn('USC_MODEL_AREA is out of date with', DATA_URL, a);
        return d;
      }));

  let gridCache: GridCell[] | null = null;

  /** Nearest grid cell index for a point, or -1 outside the grid. */
  const cellIndex = (d: ModelFile, [lng, lat]: LngLat) => {
    const g = d.grid;
    const r = Math.round((lat - g.south) / g.dLat);
    const c = Math.round((lng - g.west) / g.dLng);
    if (r < 0 || c < 0 || r >= g.rows || c >= g.cols) return -1;
    return r * g.cols + c;
  };

  const info: DataSourceInfo = {
    id: 'usc-model',
    label: 'USC / Exposition Park — real-data model',
    isSimulated: false,
    description:
      'Modeled pedestrian activity from public data (OpenStreetMap, LA City business listings, Census jobs & population, ' +
      'Metro schedules), checked against 22 LADOT count sites. Shows a relative percentile, not a pedestrian count.',
    coverage: USC_MODEL_AREA,
    timeVarying: false,
    provenance: { pedestrian: 'modeled', vehicle: 'unavailable', competitors: 'observed', timeOfDay: 'assumption' },
    pedestrianLabel: 'Modeled pedestrian activity',
    competitorLabel: 'OpenStreetMap food places',
  };

  return {
    info,

    async getActivityGrid() {
      // Time-invariant: the same cells (same percentile scale) for every filter selection.
      if (gridCache) return gridCache;
      const d = await load();
      const g = d.grid;
      const cells: GridCell[] = [];
      for (let r = 0; r < g.rows; r++) {
        for (let c = 0; c < g.cols; c++) {
          const i = r * g.cols + c;
          cells.push({
            position: [g.west + c * g.dLng, g.south + r * g.dLat], pedestrian: g.percentile[i], vehicle: null, scale: 'percentile', flags: g.flags[i],
          });
        }
      }
      return (gridCache = cells);
    },

    async getSignalsAt(position) {
      if (!contains(info, position)) return null;
      const d = await load();
      const i = cellIndex(d, position);
      return i < 0 ? null : { pedestrian: d.grid.percentile[i], vehicle: null, scale: 'percentile' };
    },

    async getConfidenceAt(position): Promise<ConfidenceInfo | null> {
      if (!contains(info, position)) return null;
      const d = await load();
      const i = cellIndex(d, position);
      if (i < 0) return null;
      const f = d.grid.flags[i];
      return {
        minorStreet: (f & CONFIDENCE_FLAGS.minorStreet) > 0,
        outOfRange: (f & CONFIDENCE_FLAGS.outOfRange) > 0,
        campusEdge: (f & CONFIDENCE_FLAGS.campusEdge) > 0,
      };
    },

    async getTransitSupplyAt(position): Promise<TransitSupply | null> {
      if (!contains(info, position)) return null;
      const d = await load();
      const byHour = Array<number>(24).fill(0);
      let stops = 0;
      for (const s of d.transit.stops) {
        if (distanceM(position, s.position) > TRANSIT_RADIUS_M) continue;
        stops++;
        s.hourly.forEach((n, h) => (byHour[h] += n));
      }
      const bySlot = Object.fromEntries(
        (Object.keys(SLOT_HOURS) as TimeOfDay[]).map((t) => [t, SLOT_HOURS[t].reduce((sum, h) => sum + byHour[h], 0)]),
      ) as Record<TimeOfDay, number>;
      return { referenceDate: d.transit.referenceDate, dayType: d.transit.dayType, radiusM: TRANSIT_RADIUS_M, stops, byHour, bySlot };
    },

    async getCompetitors() {
      return (await load()).competitors;
    },

    async getCandidateSites() {
      return (await load()).candidateSites;
    },

    async getObservedCounts() {
      return (await load()).ladot;
    },

    async getMethodology(): Promise<ModelMethodology> {
      const d = await load();
      return { version: d.version, generated: d.generated, features: d.features, validation: d.validation, transitReferenceDate: d.transit.referenceDate };
    },
  };
}
