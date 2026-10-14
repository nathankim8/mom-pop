import type { BusinessType, Competitor, LngLat } from '../types';
import { distanceM, kmPerDegLng } from '../lib/geo';

export interface NearbyCompetitor extends Competitor {
  distanceM: number;
  /** Same cuisine as the business being evaluated. */
  direct: boolean;
}

/**
 * Spatial hash so "who's within X meters?" doesn't scan every business.
 * Competitors are bucketed into ~500 m squares; a query only checks nearby buckets.
 */
export class CompetitorIndex {
  private static CELL = 0.005;
  private buckets = new Map<string, Competitor[]>();

  constructor(competitors: Competitor[]) {
    for (const c of competitors) {
      const key = this.key(Math.floor(c.position[0] / CompetitorIndex.CELL), Math.floor(c.position[1] / CompetitorIndex.CELL));
      const list = this.buckets.get(key);
      if (list) list.push(c);
      else this.buckets.set(key, [c]);
    }
  }

  private key(ix: number, iy: number) {
    return `${ix}:${iy}`;
  }

  near(p: LngLat, radiusM: number, businessType: BusinessType): NearbyCompetitor[] {
    const cell = CompetitorIndex.CELL;
    const dLng = radiusM / 1000 / kmPerDegLng(p[1]);
    const dLat = radiusM / 1000 / 110.574;
    const out: NearbyCompetitor[] = [];
    for (let ix = Math.floor((p[0] - dLng) / cell); ix <= Math.floor((p[0] + dLng) / cell); ix++) {
      for (let iy = Math.floor((p[1] - dLat) / cell); iy <= Math.floor((p[1] + dLat) / cell); iy++) {
        for (const c of this.buckets.get(this.key(ix, iy)) ?? []) {
          const d = distanceM(p, c.position);
          if (d <= radiusM) out.push({ ...c, distanceM: d, direct: c.category === businessType });
        }
      }
    }
    return out.sort((a, b) => a.distanceM - b.distanceM);
  }
}

/**
 * How much competition a spot faces, in "direct-competitor equivalents".
 * Same-cuisine businesses count fully, other food counts a little, and closer ones count more.
 */
export function competitionPressure(nearby: NearbyCompetitor[], radiusM: number): number {
  let total = 0;
  for (const c of nearby) {
    const weight = c.direct ? (c.format === 'restaurant' ? 1 : 0.9) : 0.2;
    total += weight * (1 - 0.5 * (c.distanceM / radiusM));
  }
  return total;
}
