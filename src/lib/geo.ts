import type { LngLat } from '../types';

const EARTH_RADIUS_M = 6_371_000;
const KM_PER_DEG_LAT = 110.574;

export const QUARTER_MILE_M = 402;
export const MILE_M = 1609;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function kmPerDegLng(lat: number): number {
  return 111.32 * Math.cos(toRad(lat));
}

/** Great-circle distance in meters. */
export function distanceM(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Fast flat-earth offset in km — accurate enough at city scale. */
function offsetKm(origin: LngLat, p: LngLat): [number, number] {
  return [(p[0] - origin[0]) * kmPerDegLng(origin[1]), (p[1] - origin[1]) * KM_PER_DEG_LAT];
}

export function distanceKmFast(a: LngLat, b: LngLat): number {
  const [dx, dy] = offsetKm(a, b);
  return Math.hypot(dx, dy);
}

export function distanceToPathKm(p: LngLat, path: LngLat[]): number {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = offsetKm(p, path[i]);
    const [bx, by] = offsetKm(p, path[i + 1]);
    const vx = bx - ax;
    const vy = by - ay;
    const lenSq = vx * vx + vy * vy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, -(ax * vx + ay * vy) / lenSq));
    const d = Math.hypot(ax + t * vx, ay + t * vy);
    if (d < best) best = d;
  }
  return best;
}

/** Move a point by a distance in km (east, north). */
export function offsetPoint(p: LngLat, eastKm: number, northKm: number): LngLat {
  return [p[0] + eastKm / kmPerDegLng(p[1]), p[1] + northKm / KM_PER_DEG_LAT];
}

export function circlePolygon(center: LngLat, radiusM: number, steps = 72): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: LngLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push(offsetPoint(center, (Math.cos(a) * radiusM) / 1000, (Math.sin(a) * radiusM) / 1000));
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

export function formatDistance(m: number): string {
  const miles = m / MILE_M;
  return miles < 0.1 ? `${Math.round(m * 3.281)} ft` : `${miles.toFixed(2)} mi`;
}
