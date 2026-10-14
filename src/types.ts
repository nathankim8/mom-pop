// Shared domain types. These are deliberately independent of where the data
// comes from, so a real data provider can be swapped in without touching the UI.

export type LngLat = [lng: number, lat: number];

export type TimeOfDay = 'morning' | 'lunch' | 'dinner' | 'late';
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type BusinessType = 'tacos' | 'asian' | 'burgers' | 'coffee' | 'dessert' | 'healthy';
export type VendorFormat = 'truck' | 'cart' | 'popup' | 'restaurant';

export type MapLayerKind = 'pedestrian' | 'vehicle' | 'competition' | 'opportunity';
export type AppMode = 'explore' | 'analyze';
export type DataSourceId = 'usc-model' | 'simulated';

/** Where a number comes from. Shown in the UI next to every value. */
export type Provenance = 'observed' | 'modeled' | 'assumption' | 'simulated' | 'unavailable';

export interface Filters {
  timeOfDay: TimeOfDay;
  day: DayOfWeek;
  businessType: BusinessType;
}

export interface SignalQuery {
  timeOfDay: TimeOfDay;
  day: DayOfWeek;
}

/**
 * Activity indices on a 0–100 scale. Relative estimates, not raw counts.
 * For the USC model, `pedestrian` is a percentile within the model area and `vehicle` is null (no real data).
 */
export interface ActivitySignals {
  pedestrian: number;
  vehicle: number | null;
  /** 'percentile' = pedestrian is a percentile on one fixed scale (USC model). Default: simulated 0–100 index. */
  scale?: 'index' | 'percentile';
}

export interface GridCell extends ActivitySignals {
  position: LngLat;
  /** Low-confidence bit flags (see CONFIDENCE_FLAGS). Only set by the USC model. */
  flags?: number;
}

export interface Competitor {
  id: string;
  name: string;
  position: LngLat;
  /** 'other' = food place whose cuisine is unknown; counts as indirect competition. */
  category: BusinessType | 'other';
  format: VendorFormat;
}

export interface CandidateSite {
  id: string;
  name: string;
  neighborhood: string;
  position: LngLat;
}

export interface Bounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface DataSourceInfo {
  id: DataSourceId;
  label: string;
  isSimulated: boolean;
  description: string;
  /** Area the source covers. null = the whole LA map. */
  coverage: Bounds | null;
  /** Whether pedestrian activity itself changes with the time/day filters. */
  timeVarying: boolean;
  provenance: { pedestrian: Provenance; vehicle: Provenance; competitors: Provenance; timeOfDay: Provenance };
  pedestrianLabel: string;
  competitorLabel: string;
}

export const CONFIDENCE_FLAGS = { minorStreet: 1, outOfRange: 2, campusEdge: 4 } as const;

export interface ConfidenceInfo {
  minorStreet: boolean;
  outOfRange: boolean;
  campusEdge: boolean;
}

/** One LADOT count site with each year's numbers exactly as published. */
export interface ObservedCountSite {
  id: string;
  segment: string;
  street: string;
  between: string;
  position: LngLat;
  placement: string;
  observations: { year: number; weekday6h: number | null; weekend2h: number | null; note?: string }[];
  modelPercentile: number | null;
  insideModelArea: boolean;
}

/** Scheduled bus + rail departures near a point (GTFS). Transit service, not people. */
export interface TransitSupply {
  referenceDate: string;
  dayType: string;
  radiusM: number;
  stops: number;
  byHour: number[];
  bySlot: Record<TimeOfDay, number>;
}

export interface ModelValidation {
  nSites: number;
  spearmanLOO: number;
  spearmanLOOci95: [number, number];
  spearmanUncalibrated: number;
  spearmanOutsideDowntown: number;
  nOutsideDowntown: number;
  spearmanDowntown: number;
  nDowntown: number;
  medianSplitCorrect: number;
  typicalFactorLOO: number;
  typicalFactorSpatial: number;
  nullTypicalFactor: number;
  ridgeSpearmanLOO: number;
  forestSpearmanLOO: number;
  yearToYearMedianChangePct: number;
  gridCellsOutOfRangePct: number;
  gridCellsMinorStreetPct: number;
  countSitesOnMajorStreets: number;
  comparability: {
    total_equals_weekday_plus_weekend: number;
    total_mismatch: string[];
    weekend_outliers: string[];
    weekday_2021_vs_other_years_median_ratio: number;
    sites_with_2021_and_other_years: number;
    sites_counted_only_in_one_year: string[];
  };
}

export interface ModelMethodology {
  version: string;
  generated: string;
  features: string[];
  validation: ModelValidation;
  transitReferenceDate: string;
}
