import { useEffect, useState } from 'react';
import type { ActivitySignals, BusinessType, ConfidenceInfo, DayOfWeek, LngLat, TimeOfDay, TransitSupply } from '../types';
import type { LocationDataProvider } from '../data/provider';
import { contains } from '../data/provider';
import { DAYS, TIME_SLOTS } from '../config/labels';
import { offsetPoint } from '../lib/geo';
import type { CompetitorIndex } from '../analysis/competition';
import { type AreaReport, buildAreaReport, buildProfile } from '../analysis/areaReport';

/** Average signals over the center + a ring of points, so one odd spot doesn't skew the result. */
function samplePoints(center: LngLat, radiusM: number): LngLat[] {
  const r = (radiusM * 0.6) / 1000;
  return [center, ...Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * 2 * Math.PI;
    return offsetPoint(center, Math.cos(a) * r, Math.sin(a) * r);
  })];
}

export type AreaReportState =
  | { status: 'outside' }
  | { status: 'ready'; report: AreaReport; confidence: ConfidenceInfo | null; transit: TransitSupply | null; sampledOutside: number };

export function useAreaReport(
  provider: LocationDataProvider,
  center: LngLat | null,
  radiusM: number,
  businessType: BusinessType,
  index: CompetitorIndex,
) {
  const [state, setState] = useState<AreaReportState | null>(null);

  useEffect(() => {
    if (!center) {
      setState(null);
      return;
    }
    if (!contains(provider.info, center)) {
      setState({ status: 'outside' });
      return;
    }
    let cancelled = false;
    setState(null);
    // Only sample points inside the source's coverage; never fill the gap with another source.
    const points = samplePoints(center, radiusM).filter((p) => contains(provider.info, p));
    const sampledOutside = 7 - points.length;
    const combos: { day: DayOfWeek; timeOfDay: TimeOfDay }[] = DAYS.flatMap((day) => TIME_SLOTS.map((timeOfDay) => ({ day, timeOfDay })));

    Promise.all([
      Promise.all(
        combos.map(async ({ day, timeOfDay }) => {
          const samples = (await Promise.all(points.map((p) => provider.getSignalsAt(p, { day, timeOfDay })))).filter(
            (s): s is ActivitySignals => s !== null,
          );
          const vehicles = samples.map((x) => x.vehicle);
          const signals: ActivitySignals = {
            pedestrian: samples.reduce((s, x) => s + x.pedestrian, 0) / samples.length,
            vehicle: vehicles.some((v) => v === null) ? null : vehicles.reduce((s: number, v) => s + (v ?? 0), 0) / samples.length,
            scale: samples[0]?.scale,
          };
          return { day, timeOfDay, signals };
        }),
      ),
      provider.getConfidenceAt?.(center) ?? Promise.resolve(null),
      provider.getTransitSupplyAt?.(center) ?? Promise.resolve(null),
    ]).then(([raw, confidence, transit]) => {
      if (cancelled) return;
      const profile = buildProfile(raw, businessType);
      const report = buildAreaReport(center, radiusM, businessType, profile, index.near(center, radiusM, businessType), {
        timeVarying: provider.info.timeVarying,
        hasVehicle: raw.every((r) => r.signals.vehicle !== null),
      });
      setState({ status: 'ready', report, confidence, transit, sampledOutside });
    });
    return () => {
      cancelled = true;
    };
  }, [provider, center, radiusM, businessType, index]);

  return state;
}
