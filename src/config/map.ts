import type { Bounds, LngLat } from '../types';

// OpenFreeMap: free vector basemap, no API key, commercial use allowed.
// Swap this URL to change the basemap (e.g. a MapTiler or Mapbox style — those require keys/billing).
export const BASEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/** Initial view for the simulated all-LA source. */
export const LA_VIEW: Bounds = { south: 33.92, north: 34.19, west: -118.53, east: -118.12 };
export const LA_MAX_BOUNDS: [LngLat, LngLat] = [
  [-118.9, 33.6],
  [-117.8, 34.45],
];
