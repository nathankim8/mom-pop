/**
 * SIMULATED activity model.
 *
 * Pedestrian index = sum of Gaussian "bumps" around activity hubs (scaled by time-of-day
 * and day-of-week patterns) + light foot traffic along boulevards, with smooth noise for texture.
 * Vehicle index = proximity to freeways and boulevards, scaled by a rush-hour pattern.
 * Both are squashed to 0–100 with a saturating curve so overlapping hubs don't explode.
 */
import type { ActivitySignals, LngLat, SignalQuery } from '../../types';
import { distanceKmFast, distanceToPathKm } from '../../lib/geo';
import { valueNoise } from '../../lib/random';
import { CORRIDORS, HUBS, isWater } from './laGeography';
import { HUB_DAY, HUB_TIME, STREET_DAY, STREET_TIME, VEHICLE_DAY, VEHICLE_TIME, dayValue } from './profiles';

const saturate = (raw: number, k: number) => 100 * (1 - Math.exp(-k * raw));

export function simulateSignals(p: LngLat, q: SignalQuery): ActivitySignals {
  if (isWater(p)) return { pedestrian: 0, vehicle: 0 };

  let ped = 0.035; // baseline neighborhood activity
  let hubTraffic = 0;
  for (const hub of HUBS) {
    const d = distanceKmFast(p, hub.center);
    if (d > hub.radiusKm * 4) continue;
    const falloff = Math.exp(-(d * d) / (2 * hub.radiusKm * hub.radiusKm));
    const v = hub.strength * HUB_TIME[hub.type][q.timeOfDay] * dayValue(HUB_DAY[hub.type], q.day) * falloff;
    ped += v;
    hubTraffic += v;
  }

  let veh = 0.04 + 0.12 * hubTraffic;
  const streetFoot = STREET_TIME[q.timeOfDay] * dayValue(STREET_DAY, q.day);
  const vehTime = VEHICLE_TIME[q.timeOfDay] * dayValue(VEHICLE_DAY, q.day);
  for (const c of CORRIDORS) {
    const d = distanceToPathKm(p, c.path);
    if (c.kind === 'freeway') {
      veh += 1.0 * Math.exp(-(d * d) / (2 * 0.3 * 0.3)) * vehTime;
    } else {
      veh += 0.5 * Math.exp(-(d * d) / (2 * 0.18 * 0.18)) * vehTime;
      ped += 0.1 * Math.exp(-(d * d) / (2 * 0.12 * 0.12)) * streetFoot;
    }
  }

  // Smooth ±15% texture so the map doesn't look like perfect circles.
  const noise = 0.85 + 0.3 * valueNoise(p[0], p[1], 0.006, 7);
  const vNoise = 0.9 + 0.2 * valueNoise(p[0], p[1], 0.01, 11);
  return {
    pedestrian: Math.round(saturate(ped, 1.5) * noise * 10) / 10,
    vehicle: Math.round(saturate(veh, 1.6) * vNoise * 10) / 10,
  };
}
