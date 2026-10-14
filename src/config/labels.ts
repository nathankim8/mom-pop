import type { BusinessType, DataSourceId, DayOfWeek, MapLayerKind, Provenance, TimeOfDay, VendorFormat } from '../types';

export const PRODUCT_NAME = 'Mom & Pop Atlas';

export const TIME_SLOTS: TimeOfDay[] = ['morning', 'lunch', 'dinner', 'late'];
export const TIME_LABELS: Record<TimeOfDay, { label: string; hours: string }> = {
  morning: { label: 'Morning', hours: '7–10 AM' },
  lunch: { label: 'Lunch', hours: '11 AM–2 PM' },
  dinner: { label: 'Dinner', hours: '5–8 PM' },
  late: { label: 'Late night', hours: '9 PM–1 AM' },
};

export const DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};
export const WEEKDAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
export const WEEKEND: DayOfWeek[] = ['sat', 'sun'];

export const BUSINESS_TYPES: BusinessType[] = ['tacos', 'asian', 'burgers', 'coffee', 'dessert', 'healthy'];
export const BUSINESS_LABELS: Record<BusinessType, string> = {
  tacos: 'Tacos & Mexican',
  asian: 'Asian street food',
  burgers: 'Burgers & American',
  coffee: 'Coffee & breakfast',
  dessert: 'Desserts & drinks',
  healthy: 'Healthy & bowls',
};

export const FORMAT_LABELS: Record<VendorFormat, string> = {
  truck: 'Food truck',
  cart: 'Food cart',
  popup: 'Pop-up',
  restaurant: 'Restaurant',
};

export interface LayerMeta {
  label: string;
  short: string;
  description: string;
  /** heatmap-density stops → colors. Also used to draw the legend. */
  ramp: [number, string][];
}

export const LAYERS: Record<MapLayerKind, LayerMeta> = {
  pedestrian: {
    label: 'Simulated foot traffic',
    short: 'Foot traffic',
    description: 'Simulated people on foot, from hand-placed activity hubs (offices, nightlife, campuses, beaches…). Not observed.',
    ramp: [
      [0, 'rgba(99,102,241,0)'],
      [0.17, 'rgba(129,140,248,0.18)'],
      [0.3, '#818cf8'],
      [0.5, '#a855f7'],
      [0.7, '#ec4899'],
      [0.88, '#f97316'],
      [1, '#f59e0b'],
    ],
  },
  vehicle: {
    label: 'Vehicle traffic',
    short: 'Vehicles',
    description: 'Estimated drive-by traffic along freeways and major boulevards. Good for visibility, less for walk-ups.',
    ramp: [
      [0, 'rgba(56,189,248,0)'],
      [0.17, 'rgba(125,211,252,0.18)'],
      [0.3, '#7dd3fc'],
      [0.55, '#0ea5e9'],
      [0.8, '#0369a1'],
      [1, '#1e3a8a'],
    ],
  },
  competition: {
    label: 'Competitor density',
    short: 'Competitors',
    description: 'Concentration of simulated food businesses. Same-cuisine competitors count most.',
    ramp: [
      [0, 'rgba(248,113,113,0)'],
      [0.17, 'rgba(254,202,202,0.25)'],
      [0.3, '#fca5a5'],
      [0.55, '#f87171'],
      [0.8, '#dc2626'],
      [1, '#7f1d1d'],
    ],
  },
  opportunity: {
    label: 'Business opportunity',
    short: 'Opportunity',
    description: 'Demand for your business type, discounted by how crowded the area already is.',
    ramp: [
      [0, 'rgba(74,222,128,0)'],
      [0.17, 'rgba(187,247,208,0.2)'],
      [0.3, '#86efac'],
      [0.5, '#4ade80'],
      [0.7, '#16a34a'],
      [0.88, '#15803d'],
      [1, '#14532d'],
    ],
  },
};

export const LAYER_ORDER: MapLayerKind[] = ['opportunity', 'pedestrian', 'vehicle', 'competition'];

/**
 * Overrides for the USC real-data model. Values there are drawn as 100 m cells in five equal classes
 * (quintiles of the one, fixed percentile scale), because the validation supports a ranking, not fine-grained values.
 */
export const MODEL_LAYERS: Partial<Record<MapLayerKind, Omit<LayerMeta, 'ramp'>>> = {
  pedestrian: {
    label: 'Modeled Pedestrian Activity',
    short: 'Modeled activity',
    description:
      'Relative ranking within the USC / Exposition Park model area, from 6 public datasets. Not a pedestrian count, ' +
      'not live, and the same for every time and day filter (no hourly data was validated).',
  },
  opportunity: {
    label: 'Business opportunity',
    short: 'Opportunity',
    description:
      'Modeled pedestrian percentile × assumed time weights for your business type, discounted for nearby OpenStreetMap food places.',
  },
  competition: {
    label: 'Food places (OpenStreetMap)',
    short: 'Competitors',
    description: 'Observed OSM listings. Cuisine comes from OSM tags or obvious name keywords; food trucks and carts are rarely mapped.',
  },
};

/** Five classes for the model cells, low → high. */
export const MODEL_CLASS_COLORS: Record<'pedestrian' | 'opportunity', string[]> = {
  pedestrian: ['#eef2ff', '#c7d2fe', '#a78bfa', '#db2777', '#f59e0b'],
  opportunity: ['#f0fdf4', '#bbf7d0', '#4ade80', '#16a34a', '#14532d'],
};
export const MODEL_CLASS_LABELS = ['Bottom 20%', '20–40%', '40–60%', '60–80%', 'Top 20%'];

export function layerMeta(layer: MapLayerKind, source: DataSourceId): Omit<LayerMeta, 'ramp'> & { ramp: LayerMeta['ramp'] } {
  const base = LAYERS[layer];
  const override = source === 'usc-model' ? MODEL_LAYERS[layer] : undefined;
  return { ...base, ...override };
}

/** Layers a source can show. The USC model has no real vehicle data. */
export function layerAvailable(layer: MapLayerKind, source: DataSourceId): boolean {
  return !(source === 'usc-model' && layer === 'vehicle');
}

export const SOURCE_LABELS: Record<DataSourceId, { label: string; sub: string }> = {
  'usc-model': { label: 'USC area · real data', sub: 'Modeled from public datasets' },
  simulated: { label: 'All LA · simulated', sub: 'Illustrative only' },
};

export const PROVENANCE_STYLE: Record<Provenance, { label: string; className: string; help: string }> = {
  observed: { label: 'Observed', className: 'bg-sky-50 text-sky-800 ring-sky-200', help: 'Published measurements or listings, shown as published.' },
  modeled: { label: 'Modeled', className: 'bg-violet-50 text-violet-800 ring-violet-200', help: 'Prediction from the validated USC model — a relative ranking.' },
  assumption: { label: 'Assumption', className: 'bg-amber-50 text-amber-800 ring-amber-200', help: 'A judgement-based weight, not fitted to data.' },
  simulated: { label: 'Simulated', className: 'bg-orange-50 text-orange-800 ring-orange-200', help: 'Generated by the illustrative simulation.' },
  unavailable: { label: 'No data', className: 'bg-slate-50 text-slate-500 ring-slate-200', help: 'This source has no real data for this value.' },
};
