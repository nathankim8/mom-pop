/** SIMULATED competitor businesses. Clusters around hubs + scattered along boulevards. Not real businesses. */
import type { BusinessType, Competitor, LngLat, VendorFormat } from '../../types';
import { offsetPoint } from '../../lib/geo';
import { gaussian, mulberry32, pickWeighted } from '../../lib/random';
import { FORMAT_LABELS } from '../../config/labels';
import { CORRIDORS, HUBS, isWater, type HubType } from './laGeography';

const BASE_CUISINE: Record<BusinessType, number> = {
  tacos: 0.3, asian: 0.2, burgers: 0.16, coffee: 0.16, dessert: 0.09, healthy: 0.09,
};
const BASE_FORMAT: Record<VendorFormat, number> = { restaurant: 0.58, truck: 0.22, cart: 0.14, popup: 0.06 };
const FORMAT_BY_HUB: Partial<Record<HubType, Partial<Record<VendorFormat, number>>>> = {
  industrial: { truck: 0.55, cart: 0.15, restaurant: 0.25 },
  event: { truck: 0.35, cart: 0.25, popup: 0.1 },
  campus: { truck: 0.3 },
  beach: { cart: 0.25, popup: 0.1 },
};

export function generateCompetitors(seed = 42): Competitor[] {
  const rand = mulberry32(seed);
  const out: Competitor[] = [];

  const add = (position: LngLat, cuisine: Record<BusinessType, number>, formats: Record<VendorFormat, number>) => {
    if (isWater(position)) return;
    const category = pickWeighted(cuisine, rand);
    const format = pickWeighted(formats, rand);
    const n = String(out.length + 1).padStart(4, '0');
    out.push({
      id: `sim-${n}`,
      name: `Simulated ${FORMAT_LABELS[format].toLowerCase()} #${n}`,
      position,
      category,
      format,
    });
  };

  for (const hub of HUBS) {
    const count = Math.round(hub.strength * 200 * hub.radiusKm * hub.radiusKm + 8);
    const cuisine = { ...BASE_CUISINE };
    for (const [k, mult] of Object.entries(hub.cuisineBias ?? {})) cuisine[k as BusinessType] *= mult as number;
    const formats = { ...BASE_FORMAT, ...FORMAT_BY_HUB[hub.type] };
    for (let i = 0; i < count; i++) {
      const spread = hub.radiusKm * 0.9;
      add(offsetPoint(hub.center, gaussian(rand) * spread, gaussian(rand) * spread), cuisine, formats);
    }
  }

  // Scatter along boulevards (strip malls, corner stands).
  const arterials = CORRIDORS.filter((c) => c.kind === 'arterial');
  for (let i = 0; i < 1100; i++) {
    const c = arterials[Math.floor(rand() * arterials.length)];
    const seg = Math.floor(rand() * (c.path.length - 1));
    const t = rand();
    const [a, b] = [c.path[seg], c.path[seg + 1]];
    const base: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    add(offsetPoint(base, gaussian(rand) * 0.08, gaussian(rand) * 0.08), BASE_CUISINE, BASE_FORMAT);
  }
  return out;
}
