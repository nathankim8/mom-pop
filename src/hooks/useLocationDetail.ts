import { useEffect, useState } from 'react';
import type { ActivitySignals, ConfidenceInfo, Filters, LngLat, TimeOfDay, TransitSupply } from '../types';
import type { LocationDataProvider } from '../data/provider';
import { TIME_SLOTS } from '../config/labels';
import { QUARTER_MILE_M } from '../lib/geo';
import { type CompetitorIndex, type NearbyCompetitor, competitionPressure } from '../analysis/competition';
import { type OpportunityResult, opportunityScore } from '../analysis/scoring';

export interface LocationDetail {
  position: LngLat;
  /** False when the point is outside the active source's coverage — no values are shown then. */
  covered: boolean;
  signals: ActivitySignals;
  opportunity: OpportunityResult;
  bySlot: { timeOfDay: TimeOfDay; opportunity: number; pedestrian: number }[];
  nearby: NearbyCompetitor[];
  confidence: ConfidenceInfo | null;
  transit: TransitSupply | null;
}

/** Everything the click-popup needs about a single point, for the current filters. */
export function useLocationDetail(provider: LocationDataProvider, position: LngLat | null, filters: Filters, index: CompetitorIndex) {
  const [detail, setDetail] = useState<LocationDetail | null>(null);
  const { timeOfDay, day, businessType } = filters;

  useEffect(() => {
    if (!position) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      Promise.all(TIME_SLOTS.map((t) => provider.getSignalsAt(position, { timeOfDay: t, day }))),
      provider.getConfidenceAt?.(position) ?? Promise.resolve(null),
      provider.getTransitSupplyAt?.(position) ?? Promise.resolve(null),
    ]).then(([slots, confidence, transit]) => {
      if (cancelled) return;
      if (slots.some((s) => s === null)) {
        const empty = { pedestrian: 0, vehicle: null };
        setDetail({ position, covered: false, signals: empty, opportunity: { score: 0, demand: 0, saturation: 0 }, bySlot: [], nearby: [], confidence: null, transit: null });
        return;
      }
      const s = slots as ActivitySignals[];
      const nearby = index.near(position, QUARTER_MILE_M, businessType);
      const pressure = competitionPressure(nearby, QUARTER_MILE_M);
      const bySlot = TIME_SLOTS.map((t, i) => ({
        timeOfDay: t,
        pedestrian: s[i].pedestrian,
        opportunity: opportunityScore(s[i], pressure, businessType, t).score,
      }));
      const i = TIME_SLOTS.indexOf(timeOfDay);
      setDetail({
        position,
        covered: true,
        signals: s[i],
        opportunity: opportunityScore(s[i], pressure, businessType, timeOfDay),
        bySlot,
        nearby,
        confidence,
        transit,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [provider, position, timeOfDay, day, businessType, index]);

  return detail;
}
