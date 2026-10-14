/** SIMULATED temporal patterns: how busy each kind of place is by time slot and weekday. */
import type { DayOfWeek, TimeOfDay } from '../../types';
import type { HubType } from './laGeography';

type TimeProfile = Record<TimeOfDay, number>;
//                         Mon   Tue   Wed   Thu   Fri   Sat   Sun
type DayProfile = [number, number, number, number, number, number, number];

const t = (morning: number, lunch: number, dinner: number, late: number): TimeProfile => ({ morning, lunch, dinner, late });

export const HUB_TIME: Record<HubType, TimeProfile> = {
  office: t(0.8, 1.0, 0.35, 0.05),
  nightlife: t(0.2, 0.5, 0.9, 1.0),
  campus: t(0.7, 1.0, 0.6, 0.45),
  beach: t(0.4, 0.95, 0.75, 0.25),
  residential: t(0.55, 0.5, 0.9, 0.3),
  retail: t(0.3, 0.9, 0.8, 0.2),
  transit: t(1.0, 0.65, 0.85, 0.3),
  industrial: t(0.95, 1.0, 0.2, 0.05),
  event: t(0.1, 0.3, 0.95, 0.65),
  tourist: t(0.35, 0.95, 0.9, 0.55),
};

export const HUB_DAY: Record<HubType, DayProfile> = {
  office: [1, 1, 1, 1, 0.85, 0.25, 0.15],
  nightlife: [0.5, 0.55, 0.65, 0.8, 1, 1, 0.7],
  campus: [1, 1, 1, 0.95, 0.75, 0.4, 0.35],
  beach: [0.55, 0.55, 0.6, 0.65, 0.75, 1, 1],
  residential: [0.85, 0.85, 0.85, 0.9, 0.95, 1, 1],
  retail: [0.65, 0.65, 0.7, 0.75, 0.85, 1, 0.9],
  transit: [1, 1, 1, 1, 0.95, 0.55, 0.45],
  industrial: [1, 1, 1, 1, 0.95, 0.4, 0.1],
  event: [0.35, 0.45, 0.45, 0.55, 0.85, 1, 0.8],
  tourist: [0.6, 0.6, 0.65, 0.7, 0.85, 1, 0.95],
};

/** General street-level foot traffic along boulevards. */
export const STREET_TIME: TimeProfile = t(0.6, 0.85, 0.8, 0.3);
export const STREET_DAY: DayProfile = [0.9, 0.9, 0.9, 0.95, 1, 0.95, 0.85];

/** Car traffic: rush-hour peaks, lighter weekends. */
export const VEHICLE_TIME: TimeProfile = t(1.0, 0.7, 0.95, 0.35);
export const VEHICLE_DAY: DayProfile = [1, 1, 1, 1, 1, 0.75, 0.65];

const DAY_INDEX: Record<DayOfWeek, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
export const dayValue = (profile: DayProfile, day: DayOfWeek) => profile[DAY_INDEX[day]];
