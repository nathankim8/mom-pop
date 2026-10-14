import type { ActivitySignals, BusinessType, CandidateSite, TimeOfDay } from '../types';
import { QUARTER_MILE_M } from '../lib/geo';
import { TIME_SLOTS } from '../config/labels';
import { CompetitorIndex, competitionPressure } from './competition';
import { opportunityScore } from './scoring';

export interface RankedSite {
  site: CandidateSite;
  rank: number;
  score: number;
  pedestrian: number;
  directCompetitors: number;
  totalCompetitors: number;
  bestTime: TimeOfDay;
}

export function rankSites(
  sites: CandidateSite[],
  signalsBySite: Record<string, Record<TimeOfDay, ActivitySignals>>,
  index: CompetitorIndex,
  businessType: BusinessType,
  timeOfDay: TimeOfDay,
): RankedSite[] {
  const scored = sites
    .filter((s) => signalsBySite[s.id])
    .map((site) => {
      const nearby = index.near(site.position, QUARTER_MILE_M, businessType);
      const pressure = competitionPressure(nearby, QUARTER_MILE_M);
      const bySlot = TIME_SLOTS.map((t) => ({ t, ...opportunityScore(signalsBySite[site.id][t], pressure, businessType, t) }));
      const current = bySlot.find((b) => b.t === timeOfDay)!;
      const best = bySlot.reduce((a, b) => (b.score > a.score ? b : a));
      return {
        site,
        rank: 0,
        score: current.score,
        pedestrian: signalsBySite[site.id][timeOfDay].pedestrian,
        directCompetitors: nearby.filter((c) => c.direct).length,
        totalCompetitors: nearby.length,
        bestTime: best.t,
      };
    });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s, i) => ({ ...s, rank: i + 1 }));
}
