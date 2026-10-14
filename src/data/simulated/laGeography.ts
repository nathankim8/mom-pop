/**
 * SIMULATED geography for Los Angeles.
 *
 * Activity hubs and corridors are hand-placed approximations of well-known LA
 * neighborhoods, freeways and boulevards. Their strengths are illustrative
 * guesses — NOT measurements. They exist only to make the prototype feel
 * realistic until real datasets are connected.
 */
import type { BusinessType, CandidateSite, LngLat } from '../../types';

export type HubType =
  | 'office' | 'nightlife' | 'campus' | 'beach' | 'residential'
  | 'retail' | 'transit' | 'industrial' | 'event' | 'tourist';

export interface ActivityHub {
  name: string;
  center: LngLat;
  type: HubType;
  /** 0–1 relative pull of the hub. */
  strength: number;
  /** Spread of activity around the center (≈ 1 standard deviation). */
  radiusKm: number;
  /** Multipliers applied to the local cuisine mix of simulated competitors. */
  cuisineBias?: Partial<Record<BusinessType, number>>;
}

export interface Corridor {
  name: string;
  kind: 'freeway' | 'arterial';
  path: LngLat[];
}

const MEX = { tacos: 2.4 };
const ASIAN = { asian: 2.6 };

export const HUBS: ActivityHub[] = [
  // Downtown
  { name: 'DTLA Financial District', center: [-118.255, 34.0505], type: 'office', strength: 1.0, radiusKm: 0.8 },
  { name: 'Historic Core', center: [-118.2489, 34.0475], type: 'retail', strength: 0.8, radiusKm: 0.6 },
  { name: 'Fashion District', center: [-118.251, 34.039], type: 'retail', strength: 0.75, radiusKm: 0.6, cuisineBias: MEX },
  { name: 'Arts District', center: [-118.233, 34.041], type: 'nightlife', strength: 0.7, radiusKm: 0.6 },
  { name: 'Little Tokyo', center: [-118.24, 34.05], type: 'tourist', strength: 0.65, radiusKm: 0.4, cuisineBias: ASIAN },
  { name: 'Chinatown', center: [-118.2383, 34.0623], type: 'retail', strength: 0.55, radiusKm: 0.4, cuisineBias: ASIAN },
  { name: 'Union Station', center: [-118.2365, 34.056], type: 'transit', strength: 0.7, radiusKm: 0.35 },
  { name: 'LA Live / Arena', center: [-118.2673, 34.043], type: 'event', strength: 0.85, radiusKm: 0.5 },
  { name: 'Produce District', center: [-118.243, 34.03], type: 'industrial', strength: 0.55, radiusKm: 0.6, cuisineBias: MEX },
  // Central
  { name: 'USC', center: [-118.2851, 34.0224], type: 'campus', strength: 0.85, radiusKm: 0.6 },
  { name: 'Exposition Park', center: [-118.287, 34.016], type: 'tourist', strength: 0.5, radiusKm: 0.5 },
  { name: 'Koreatown', center: [-118.3005, 34.0617], type: 'nightlife', strength: 0.95, radiusKm: 1.1, cuisineBias: { asian: 2.8 } },
  { name: 'Westlake / MacArthur Park', center: [-118.278, 34.0577], type: 'residential', strength: 0.7, radiusKm: 0.6, cuisineBias: MEX },
  { name: 'Echo Park', center: [-118.2606, 34.078], type: 'residential', strength: 0.55, radiusKm: 0.6 },
  { name: 'Silver Lake', center: [-118.27, 34.087], type: 'nightlife', strength: 0.6, radiusKm: 0.7 },
  { name: 'Los Feliz', center: [-118.287, 34.105], type: 'residential', strength: 0.45, radiusKm: 0.6 },
  { name: 'Dodger Stadium', center: [-118.24, 34.0739], type: 'event', strength: 0.7, radiusKm: 0.45 },
  { name: 'Mid-Wilshire offices', center: [-118.33, 34.062], type: 'office', strength: 0.5, radiusKm: 0.8 },
  // Hollywood / Westside
  { name: 'Hollywood & Highland', center: [-118.3387, 34.1016], type: 'tourist', strength: 0.95, radiusKm: 0.6 },
  { name: 'Hollywood & Vine', center: [-118.3267, 34.1016], type: 'nightlife', strength: 0.8, radiusKm: 0.5 },
  { name: 'West Hollywood', center: [-118.385, 34.09], type: 'nightlife', strength: 0.85, radiusKm: 0.8 },
  { name: 'Fairfax / Melrose', center: [-118.3615, 34.0837], type: 'retail', strength: 0.7, radiusKm: 0.6 },
  { name: 'The Grove / Farmers Market', center: [-118.358, 34.0722], type: 'retail', strength: 0.8, radiusKm: 0.45 },
  { name: 'Miracle Mile', center: [-118.3592, 34.0638], type: 'tourist', strength: 0.55, radiusKm: 0.5 },
  { name: 'Century City', center: [-118.417, 34.056], type: 'office', strength: 0.75, radiusKm: 0.55 },
  { name: 'Westwood / UCLA', center: [-118.445, 34.068], type: 'campus', strength: 0.9, radiusKm: 0.8 },
  { name: 'Culver City', center: [-118.396, 34.023], type: 'retail', strength: 0.65, radiusKm: 0.6 },
  { name: 'Santa Monica Promenade', center: [-118.496, 34.016], type: 'tourist', strength: 0.95, radiusKm: 0.6 },
  { name: 'Santa Monica Pier', center: [-118.497, 34.009], type: 'beach', strength: 0.8, radiusKm: 0.4 },
  { name: 'Venice Boardwalk', center: [-118.472, 33.985], type: 'beach', strength: 0.85, radiusKm: 0.55 },
  { name: 'Abbot Kinney', center: [-118.4645, 33.9905], type: 'retail', strength: 0.6, radiusKm: 0.4 },
  { name: 'Playa Vista', center: [-118.424, 33.976], type: 'office', strength: 0.55, radiusKm: 0.6 },
  { name: 'LAX', center: [-118.4, 33.945], type: 'transit', strength: 0.6, radiusKm: 0.8 },
  // South & East
  { name: 'SoFi / Inglewood', center: [-118.3392, 33.9535], type: 'event', strength: 0.8, radiusKm: 0.6 },
  { name: 'Leimert Park', center: [-118.332, 34.005], type: 'residential', strength: 0.5, radiusKm: 0.7 },
  { name: 'Vermont & Manchester', center: [-118.2915, 33.96], type: 'residential', strength: 0.55, radiusKm: 0.9, cuisineBias: MEX },
  { name: 'Huntington Park', center: [-118.225, 33.981], type: 'retail', strength: 0.65, radiusKm: 0.6, cuisineBias: MEX },
  { name: 'Vernon industrial', center: [-118.23, 34.0], type: 'industrial', strength: 0.6, radiusKm: 1.0, cuisineBias: MEX },
  { name: 'Boyle Heights', center: [-118.219, 34.047], type: 'residential', strength: 0.7, radiusKm: 0.8, cuisineBias: MEX },
  { name: 'East LA', center: [-118.172, 34.023], type: 'residential', strength: 0.75, radiusKm: 1.0, cuisineBias: MEX },
  { name: 'Highland Park', center: [-118.192, 34.111], type: 'nightlife', strength: 0.6, radiusKm: 0.6, cuisineBias: MEX },
  // North
  { name: 'Old Pasadena', center: [-118.15, 34.145], type: 'retail', strength: 0.8, radiusKm: 0.6 },
  { name: 'Glendale', center: [-118.255, 34.146], type: 'retail', strength: 0.75, radiusKm: 0.6 },
  { name: 'Burbank media district', center: [-118.329, 34.156], type: 'office', strength: 0.55, radiusKm: 0.8 },
  { name: 'NoHo Arts District', center: [-118.377, 34.168], type: 'nightlife', strength: 0.55, radiusKm: 0.6 },
];

export const CORRIDORS: Corridor[] = [
  { name: 'I-10', kind: 'freeway', path: [[-118.495, 34.015], [-118.45, 34.03], [-118.4, 34.035], [-118.35, 34.035], [-118.31, 34.035], [-118.275, 34.035], [-118.255, 34.03], [-118.22, 34.05], [-118.18, 34.06], [-118.12, 34.07]] },
  { name: 'US-101', kind: 'freeway', path: [[-118.23, 34.055], [-118.25, 34.06], [-118.27, 34.07], [-118.3, 34.085], [-118.33, 34.1], [-118.345, 34.12], [-118.36, 34.14], [-118.39, 34.15], [-118.45, 34.155], [-118.53, 34.16]] },
  { name: 'I-110', kind: 'freeway', path: [[-118.28, 33.92], [-118.28, 33.98], [-118.275, 34.02], [-118.265, 34.045], [-118.25, 34.065], [-118.225, 34.09], [-118.2, 34.11], [-118.16, 34.13]] },
  { name: 'I-405', kind: 'freeway', path: [[-118.39, 33.92], [-118.395, 33.96], [-118.42, 34.0], [-118.44, 34.04], [-118.45, 34.07], [-118.475, 34.1], [-118.48, 34.15]] },
  { name: 'I-5', kind: 'freeway', path: [[-118.16, 34.02], [-118.2, 34.04], [-118.22, 34.06], [-118.23, 34.09], [-118.25, 34.12], [-118.28, 34.15], [-118.32, 34.19]] },
  { name: 'I-105', kind: 'freeway', path: [[-118.4, 33.93], [-118.3, 33.928], [-118.2, 33.928]] },
  { name: 'Wilshire Blvd', kind: 'arterial', path: [[-118.49, 34.03], [-118.44, 34.06], [-118.4, 34.065], [-118.35, 34.062], [-118.3, 34.062], [-118.26, 34.05]] },
  { name: 'Sunset Blvd', kind: 'arterial', path: [[-118.45, 34.075], [-118.39, 34.09], [-118.34, 34.098], [-118.29, 34.095], [-118.26, 34.077], [-118.24, 34.06]] },
  { name: 'Santa Monica Blvd', kind: 'arterial', path: [[-118.49, 34.02], [-118.42, 34.06], [-118.39, 34.087], [-118.33, 34.09], [-118.28, 34.09]] },
  { name: 'Vermont Ave', kind: 'arterial', path: [[-118.2915, 33.92], [-118.2915, 34.1]] },
  { name: 'Western Ave', kind: 'arterial', path: [[-118.309, 33.92], [-118.309, 34.1]] },
  { name: 'Crenshaw Blvd', kind: 'arterial', path: [[-118.335, 33.92], [-118.335, 34.06]] },
  { name: 'Figueroa St', kind: 'arterial', path: [[-118.282, 33.92], [-118.272, 34.03], [-118.25, 34.06], [-118.2, 34.11]] },
  { name: 'Whittier Blvd', kind: 'arterial', path: [[-118.22, 34.035], [-118.12, 34.02]] },
  { name: 'Lincoln Blvd', kind: 'arterial', path: [[-118.49, 34.03], [-118.44, 33.98], [-118.42, 33.92]] },
  { name: 'Venice Blvd', kind: 'arterial', path: [[-118.47, 33.99], [-118.4, 34.015], [-118.33, 34.04], [-118.27, 34.042]] },
  { name: 'Colorado Blvd', kind: 'arterial', path: [[-118.26, 34.14], [-118.2, 34.14], [-118.12, 34.146]] },
];

/** Approximate coastline (lng at a given lat); anything west of it is ocean. */
const COASTLINE: LngLat[] = [
  [-118.56, 34.05], [-118.52, 34.03], [-118.5, 34.015], [-118.485, 34.0], [-118.475, 33.985],
  [-118.46, 33.97], [-118.445, 33.95], [-118.435, 33.93], [-118.425, 33.9],
];

export function isWater([lng, lat]: LngLat): boolean {
  if (lat >= COASTLINE[0][1]) return lng < -118.56;
  for (let i = 0; i < COASTLINE.length - 1; i++) {
    const [lngA, latA] = COASTLINE[i];
    const [lngB, latB] = COASTLINE[i + 1];
    if (lat <= latA && lat >= latB) {
      const t = (latA - lat) / (latA - latB);
      return lng < lngA + t * (lngB - lngA);
    }
  }
  return lng < COASTLINE[COASTLINE.length - 1][0];
}

/** Area the simulated grid covers. */
export const GRID_BOUNDS = { west: -118.53, east: -118.12, south: 33.92, north: 34.19 };
export const GRID_STEP = { lng: 0.0045, lat: 0.0038 }; // ≈ 420 m cells

/** Public places (not businesses) used as example vending spots for the ranking sidebar. */
export const CANDIDATE_SITES: CandidateSite[] = [
  ['7th St & Figueroa', 'Financial District', [-118.2595, 34.0488]],
  ['Grand Park', 'Civic Center', [-118.2455, 34.0555]],
  ['Mateo St', 'Arts District', [-118.2325, 34.0365]],
  ['1st St & Central Ave', 'Little Tokyo', [-118.239, 34.0498]],
  ['Santee Alley', 'Fashion District', [-118.2535, 34.0395]],
  ['Olympic Blvd at LA Live', 'South Park', [-118.2665, 34.0445]],
  ['Jefferson & Hoover', 'USC', [-118.284, 34.0255]],
  ['Exposition Park', 'Exposition Park', [-118.287, 34.015]],
  ['Wilshire & Western', 'Koreatown', [-118.309, 34.0618]],
  ['6th St & Vermont', 'Koreatown', [-118.2915, 34.0635]],
  ['MacArthur Park', 'Westlake', [-118.2775, 34.058]],
  ['Echo Park Lake', 'Echo Park', [-118.2605, 34.0727]],
  ['Sunset Junction', 'Silver Lake', [-118.2765, 34.0905]],
  ['Hollywood & Vine', 'Hollywood', [-118.3267, 34.1016]],
  ['Hollywood & Highland', 'Hollywood', [-118.3387, 34.1016]],
  ['Melrose & Fairfax', 'Fairfax', [-118.3615, 34.0837]],
  ['Santa Monica Blvd', 'West Hollywood', [-118.383, 34.0905]],
  ['Wilshire & Fairfax', 'Miracle Mile', [-118.361, 34.0628]],
  ['Westwood Village', 'Westwood', [-118.4465, 34.061]],
  ['Avenue of the Stars', 'Century City', [-118.416, 34.0575]],
  ['Washington & Culver', 'Culver City', [-118.396, 34.0235]],
  ['Third Street Promenade', 'Santa Monica', [-118.4965, 34.016]],
  ['Windward Plaza', 'Venice', [-118.473, 33.9855]],
  ['Abbot Kinney Blvd', 'Venice', [-118.465, 33.99]],
  ['Runway at Playa Vista', 'Playa Vista', [-118.425, 33.9755]],
  ['Leimert Park Village', 'Leimert Park', [-118.3315, 34.0045]],
  ['Hollywood Park', 'Inglewood', [-118.34, 33.9545]],
  ['Mariachi Plaza', 'Boyle Heights', [-118.2195, 34.0475]],
  ['Whittier Blvd', 'East LA', [-118.172, 34.0235]],
  ['Pacific Blvd', 'Huntington Park', [-118.2255, 33.9815]],
  ['Santa Fe Ave', 'Vernon', [-118.231, 34.001]],
  ['York Blvd', 'Highland Park', [-118.196, 34.1115]],
  ['Colorado Blvd', 'Old Pasadena', [-118.15, 34.1455]],
  ['Brand Blvd', 'Glendale', [-118.2555, 34.145]],
  ['Broadway', 'Chinatown', [-118.2385, 34.063]],
  ['Lankershim Blvd', 'NoHo Arts District', [-118.377, 34.1665]],
].map(([name, neighborhood, position], i) => ({
  id: `site-${i + 1}`,
  name: name as string,
  neighborhood: neighborhood as string,
  position: position as LngLat,
}));
