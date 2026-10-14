/**
 * Scoring formulas. These are provider-agnostic: they only need activity indices and
 * competitor lists, so they keep working when real data replaces the simulation.
 * All weights are first-pass assumptions meant to be tuned with real customer outcomes.
 */
import type { ActivitySignals, BusinessType, TimeOfDay } from '../types';
import { clamp } from '../lib/format';

/** How much each business type benefits from each time slot (1 = neutral). ASSUMPTION — not fitted to any data. */
export const BUSINESS_TIME_WEIGHT: Record<BusinessType, Record<TimeOfDay, number>> = {
  tacos: { morning: 0.7, lunch: 1.0, dinner: 1.0, late: 1.25 },
  asian: { morning: 0.5, lunch: 1.0, dinner: 1.1, late: 0.9 },
  burgers: { morning: 0.5, lunch: 1.05, dinner: 1.05, late: 1.0 },
  coffee: { morning: 1.4, lunch: 0.9, dinner: 0.45, late: 0.25 },
  dessert: { morning: 0.35, lunch: 0.8, dinner: 1.15, late: 1.1 },
  healthy: { morning: 0.9, lunch: 1.25, dinner: 0.8, late: 0.3 },
};

/** Share of demand from people on foot vs. drive-by visibility. */
const PEDESTRIAN_WEIGHT = 0.78;

export function demandIndex(s: ActivitySignals, businessType: BusinessType, timeOfDay: TimeOfDay): number {
  // Without vehicle data (USC real-data model) demand is pedestrian-only rather than filled in with a guess.
  const base = s.vehicle === null ? s.pedestrian : PEDESTRIAN_WEIGHT * s.pedestrian + (1 - PEDESTRIAN_WEIGHT) * s.vehicle;
  const weights = BUSINESS_TIME_WEIGHT[businessType];
  if (s.scale === 'percentile') {
    // Percentiles already span 0–100, so weights are made relative to the business's best slot (≤ 1).
    // Otherwise the top fifth of the area would all clamp to 100 and rankings would tie.
    return base * (weights[timeOfDay] / Math.max(...Object.values(weights)));
  }
  return clamp(base * weights[timeOfDay]);
}

/** Roughly how many direct competitors (within ¼ mile) a given demand level can support. */
export function competitorCapacity(demand: number): number {
  return 1 + demand / 14;
}

export interface OpportunityResult {
  score: number;
  demand: number;
  /** pressure ÷ capacity; > 1 means more competitors than demand comfortably supports. */
  saturation: number;
}

export function opportunityScore(
  signals: ActivitySignals,
  pressure: number,
  businessType: BusinessType,
  timeOfDay: TimeOfDay,
): OpportunityResult {
  const demand = demandIndex(signals, businessType, timeOfDay);
  const saturation = pressure / competitorCapacity(demand);
  // The 1.25 gain stretches the simulated index, which rarely reaches 100; percentiles need no stretch.
  const gain = signals.scale === 'percentile' ? 1 : 1.25;
  const score = clamp(demand * Math.exp(-0.5 * saturation) * gain);
  return { score: Math.round(score), demand, saturation };
}

/** Converts the 0–100 index to an illustrative hourly figure. ASSUMPTION, not a measurement. */
export const PEOPLE_PER_HOUR_PER_INDEX_POINT = 18;
