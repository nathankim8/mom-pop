/**
 * Restaurant area analysis: turns a demand profile (every time slot × day) and nearby
 * competitors into sub-scores and plain-language strengths / disadvantages.
 */
import type { ActivitySignals, BusinessType, DayOfWeek, LngLat, TimeOfDay } from '../types';
import { BUSINESS_LABELS, DAYS, TIME_LABELS, TIME_SLOTS, WEEKDAYS, WEEKEND } from '../config/labels';
import { clamp } from '../lib/format';
import { type NearbyCompetitor, competitionPressure } from './competition';
import { BUSINESS_TIME_WEIGHT, competitorCapacity, demandIndex } from './scoring';

export interface ProfilePoint extends ActivitySignals {
  day: DayOfWeek;
  timeOfDay: TimeOfDay;
  demand: number;
}

export interface SubScore {
  key: 'foot' | 'visibility' | 'competition' | 'consistency' | 'mobile';
  label: string;
  score: number;
  weight: number;
  explanation: string;
}

export type Severity = 'high' | 'medium' | 'low';
export interface Insight {
  severity: Severity;
  title: string;
  detail: string;
}

export interface AreaReport {
  center: LngLat;
  radiusM: number;
  businessType: BusinessType;
  overall: number;
  subscores: SubScore[];
  slotAverages: Record<TimeOfDay, { weekday: number; weekend: number }>;
  bestSlots: { day: DayOfWeek; timeOfDay: TimeOfDay; demand: number }[];
  competitors: { direct: NearbyCompetitor[]; total: number; mobileDirect: number };
  disadvantages: Insight[];
  strengths: Insight[];
  /** Sub-scores left out because the data source has no basis for them (e.g. no real vehicle data). */
  omitted: { label: string; reason: string }[];
}

export interface ReportOptions {
  /** Pedestrian activity varies by time/day in the source (false for the USC real-data model). */
  timeVarying: boolean;
  /** The source has vehicle data (false for the USC real-data model). */
  hasVehicle: boolean;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function buildProfile(
  raw: { day: DayOfWeek; timeOfDay: TimeOfDay; signals: ActivitySignals }[],
  businessType: BusinessType,
): ProfilePoint[] {
  return raw.map(({ day, timeOfDay, signals }) => ({
    day,
    timeOfDay,
    ...signals,
    demand: demandIndex(signals, businessType, timeOfDay),
  }));
}

export function buildAreaReport(
  center: LngLat,
  radiusM: number,
  businessType: BusinessType,
  profile: ProfilePoint[],
  nearby: NearbyCompetitor[],
  options: ReportOptions = { timeVarying: true, hasVehicle: true },
): AreaReport {
  const cuisine = BUSINESS_LABELS[businessType].toLowerCase();
  const weights = BUSINESS_TIME_WEIGHT[businessType];
  const coreSlots = TIME_SLOTS.filter((t) => weights[t] >= 1);

  const slotAverages = Object.fromEntries(
    TIME_SLOTS.map((t) => [
      t,
      {
        weekday: mean(profile.filter((p) => p.timeOfDay === t && WEEKDAYS.includes(p.day)).map((p) => p.demand)),
        weekend: mean(profile.filter((p) => p.timeOfDay === t && WEEKEND.includes(p.day)).map((p) => p.demand)),
      },
    ]),
  ) as AreaReport['slotAverages'];

  // --- Sub-scores -------------------------------------------------------------
  const coreProfile = profile.filter((p) => coreSlots.includes(p.timeOfDay));
  const footAvg = mean(coreProfile.map((p) => p.pedestrian * weights[p.timeOfDay]));
  const vehicleAvg = mean(profile.map((p) => p.vehicle ?? 0));
  const demandAvg = mean(coreProfile.map((p) => p.demand));

  // Competition is evaluated per ¼-mile-equivalent area so different radii are comparable.
  const areaFactor = (radiusM / 402) ** 2;
  const pressure = competitionPressure(nearby, radiusM) / areaFactor;
  const saturation = pressure / competitorCapacity(demandAvg);
  const direct = nearby.filter((c) => c.direct);
  const mobileDirect = direct.filter((c) => c.format !== 'restaurant').length;

  const dailyDemand = DAYS.map((d) => mean(coreProfile.filter((p) => p.day === d).map((p) => p.demand)));
  const dailyMean = mean(dailyDemand);
  const cv = dailyMean > 0 ? Math.sqrt(mean(dailyDemand.map((x) => (x - dailyMean) ** 2))) / dailyMean : 1;

  const allSubscores: SubScore[] = [
    options.timeVarying
      ? {
          key: 'foot', label: 'Foot traffic', weight: 0.35, score: Math.round(clamp(footAvg * 1.15)),
          explanation: `Average estimated pedestrian activity during your key hours (${coreSlots.map((t) => TIME_LABELS[t].label.toLowerCase()).join(', ')}).`,
        }
      : {
          key: 'foot', label: 'Modeled pedestrian activity', weight: 0.35, score: Math.round(mean(profile.map((p) => p.pedestrian))),
          explanation: 'Average modeled activity percentile around this spot, relative to the USC model area. Same at every hour — not a count.',
        },
    {
      key: 'competition', label: 'Room to compete', weight: 0.25, score: Math.round(clamp(100 * Math.exp(-0.6 * saturation))),
      explanation: `${direct.length} ${cuisine} competitor${direct.length === 1 ? '' : 's'} in this radius, compared with what local demand can likely support.`,
    },
    {
      key: 'consistency', label: 'Week-round consistency', weight: 0.15, score: Math.round(clamp(100 * (1 - cv * 2.2))),
      explanation: 'Whether demand is steady across the week, or spikes on a few days (harder for staffing and rent).',
    },
    {
      key: 'visibility', label: 'Drive-by visibility', weight: 0.15, score: Math.round(clamp(vehicleAvg * 1.1)),
      explanation: 'Estimated vehicle traffic. Helps awareness and signage, but drivers convert to customers less often than walkers.',
    },
    {
      key: 'mobile', label: 'Mobile vendor pressure', weight: 0.1, score: Math.round(clamp(100 * Math.exp(-mobileDirect / (3 * areaFactor)))),
      explanation: `${mobileDirect} food truck${mobileDirect === 1 ? '' : 's'}, carts or pop-ups selling ${cuisine} nearby. Higher score = less pressure.`,
    },
  ];
  const omitted: AreaReport['omitted'] = [];
  if (!options.timeVarying) omitted.push({ label: 'Week-round consistency', reason: 'No validated day-of-week data for this source.' });
  if (!options.hasVehicle) omitted.push({ label: 'Drive-by visibility', reason: 'No real vehicle-traffic data for this source.' });
  const kept = allSubscores.filter(
    (x) => !(x.key === 'consistency' && !options.timeVarying) && !(x.key === 'visibility' && !options.hasVehicle),
  );
  // Re-normalise the remaining weights so the overall score stays on a 0–100 scale.
  const weightSum = kept.reduce((s, x) => s + x.weight, 0);
  const subscores = kept.map((x) => ({ ...x, weight: x.weight / weightSum }));
  const overall = Math.round(subscores.reduce((s, x) => s + x.score * x.weight, 0));
  const sub = (k: SubScore['key']) => subscores.find((s) => s.key === k)?.score ?? NaN;

  // --- Disadvantages & strengths ------------------------------------------------
  const disadvantages: Insight[] = [];
  const strengths: Insight[] = [];

  const weekdayDemand = mean(coreProfile.filter((p) => WEEKDAYS.includes(p.day)).map((p) => p.demand));
  const weekendDemand = mean(coreProfile.filter((p) => WEEKEND.includes(p.day)).map((p) => p.demand));
  const weekendRatio = weekdayDemand > 0 ? weekendDemand / weekdayDemand : 1;

  if (!options.timeVarying) {
    // Weekday/weekend and time-slot insights would only restate assumptions — skip them.
  } else if (weekendRatio < 0.65) {
    disadvantages.push({
      severity: weekendRatio < 0.45 ? 'high' : 'medium',
      title: 'Weekday-dependent area',
      detail: `Weekend demand is about ${Math.round((1 - weekendRatio) * 100)}% lower than weekdays — typical of office districts. Expect slow Saturdays and Sundays unless you become a destination.`,
    });
  } else if (weekendRatio > 1.45) {
    disadvantages.push({
      severity: weekendRatio > 1.9 ? 'medium' : 'low',
      title: 'Weekend-dependent area',
      detail: `Weekend demand is about ${Math.round((weekendRatio - 1) * 100)}% higher than weekdays. Monday–Thursday may struggle to cover fixed costs.`,
    });
  }

  for (const t of options.timeVarying ? coreSlots : []) {
    const avg = (slotAverages[t].weekday * 5 + slotAverages[t].weekend * 2) / 7;
    if (avg < 25) {
      disadvantages.push({
        severity: avg < 15 ? 'high' : 'medium',
        title: `Weak ${TIME_LABELS[t].label.toLowerCase()} traffic`,
        detail: `${TIME_LABELS[t].label} (${TIME_LABELS[t].hours}) is a key period for ${cuisine}, but estimated demand here is low then.`,
      });
    }
  }

  const carShare = mean(profile.map((p) => (p.vehicle ?? 0) / Math.max(1, (p.vehicle ?? 0) + p.pedestrian)));
  if (options.hasVehicle && carShare > 0.6) {
    disadvantages.push({
      severity: carShare > 0.72 ? 'medium' : 'low',
      title: 'Car-oriented location',
      detail: 'Most activity here passes by in vehicles. Walk-in traffic will be limited — parking, signage, and delivery/takeout will matter more.',
    });
  }

  if (saturation > 1) {
    disadvantages.push({
      severity: saturation > 1.6 ? 'high' : 'medium',
      title: `Crowded for ${cuisine}`,
      detail: `${direct.length} direct competitors nearby — more than local demand likely supports. You'll need a clear point of difference (price, quality, niche).`,
    });
  } else if (saturation > 0.6) {
    disadvantages.push({
      severity: 'low',
      title: 'Moderate competition',
      detail: `${direct.length} ${cuisine} businesses nearby. Room exists, but differentiation still matters.`,
    });
  }

  if (mobileDirect >= Math.max(3, 3 * areaFactor)) {
    disadvantages.push({
      severity: mobileDirect >= 6 * areaFactor ? 'medium' : 'low',
      title: 'Mobile vendors intercept walk-by demand',
      detail: `${mobileDirect} trucks, carts or pop-ups selling ${cuisine} nearby can undercut on price and catch customers before they reach you.`,
    });
  }

  if (sub('foot') < 30) {
    disadvantages.push({
      severity: sub('foot') < 18 ? 'high' : 'medium',
      title: options.timeVarying ? 'Low foot traffic overall' : 'Low modeled pedestrian activity',
      detail: options.timeVarying
        ? 'Few people are estimated to walk past during your key hours. A permanent location here relies on destination visits and delivery.'
        : 'This spot ranks low within the USC model area. A permanent location here likely relies on destination visits and delivery.',
    });
  }

  const peak = Math.max(...profile.map((p) => p.demand));
  const lateAvg = mean(profile.filter((p) => p.timeOfDay === 'late').map((p) => p.demand));
  if (options.timeVarying && weights.late >= 1 && peak > 0 && lateAvg < 0.35 * peak) {
    disadvantages.push({
      severity: 'low',
      title: 'Late-night drop-off',
      detail: 'Activity falls off sharply after 9 PM, so extended hours are unlikely to pay off.',
    });
  }

  if (sub('foot') >= 65) {
    strengths.push(options.timeVarying
      ? { severity: 'low', title: 'Strong foot traffic', detail: 'Plenty of estimated pedestrian activity during your key hours.' }
      : { severity: 'low', title: 'High modeled pedestrian activity', detail: 'Ranks high within the USC model area (a relative ranking, not a count).' });
  }
  if (sub('competition') >= 70) strengths.push({ severity: 'low', title: `Underserved for ${cuisine}`, detail: 'Fewer direct competitors than local demand would suggest.' });
  if (sub('consistency') >= 70) strengths.push({ severity: 'low', title: 'Steady demand all week', detail: 'Demand stays fairly even from Monday to Sunday.' });
  if (sub('visibility') >= 65) strengths.push({ severity: 'low', title: 'High drive-by visibility', detail: 'Lots of passing vehicles — good for brand awareness and takeout.' });

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  disadvantages.sort((a, b) => order[a.severity] - order[b.severity]);

  const bestSlots = [...profile]
    .sort((a, b) => b.demand - a.demand)
    .slice(0, 3)
    .map(({ day, timeOfDay, demand }) => ({ day, timeOfDay, demand }));

  return {
    center, radiusM, businessType, overall, subscores, slotAverages, bestSlots,
    competitors: { direct, total: nearby.length, mobileDirect },
    disadvantages, strengths, omitted,
  };
}
