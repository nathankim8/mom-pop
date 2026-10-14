/**
 * The contract every data source must fulfil.
 *
 * Two providers implement it: the simulated all-LA model and the USC-area model built from public data
 * (see pipeline/VALIDATION.md). They are never blended: the app shows one source at a time, and the
 * USC provider returns null outside its coverage instead of falling back to simulated values.
 * All methods are async so network-backed providers fit without UI changes.
 */
import type {
  ActivitySignals, CandidateSite, Competitor, ConfidenceInfo, DataSourceInfo, GridCell, LngLat,
  ModelMethodology, ObservedCountSite, SignalQuery, TransitSupply,
} from '../types';

export interface LocationDataProvider {
  info: DataSourceInfo;
  /** Pedestrian + vehicle indices on a regular grid covering the source's area, for one time slot. */
  getActivityGrid(q: SignalQuery): Promise<GridCell[]>;
  /** Pedestrian + vehicle indices at a single point; null when the point is outside the source's coverage. */
  getSignalsAt(position: LngLat, q: SignalQuery): Promise<ActivitySignals | null>;
  /** Food businesses that compete for the same customers. */
  getCompetitors(): Promise<Competitor[]>;
  /** Named spots to rank for mobile vendors. */
  getCandidateSites(): Promise<CandidateSite[]>;

  // Optional capabilities (real-data sources only).
  getConfidenceAt?(position: LngLat): Promise<ConfidenceInfo | null>;
  getObservedCounts?(): Promise<ObservedCountSite[]>;
  getTransitSupplyAt?(position: LngLat): Promise<TransitSupply | null>;
  getMethodology?(): Promise<ModelMethodology>;
}

export function contains(info: DataSourceInfo, [lng, lat]: LngLat): boolean {
  const b = info.coverage;
  return !b || (lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east);
}
