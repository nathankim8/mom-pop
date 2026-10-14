import type { DataSourceId } from '../types';
import type { LocationDataProvider } from './provider';
import { createSimulatedProvider } from './simulated/simulatedProvider';
import { createUscModelProvider } from './usc/uscModelProvider';

// The app's data sources. They are shown one at a time and never blended (see provider.ts).
export const DATA_PROVIDERS: Record<DataSourceId, LocationDataProvider> = {
  'usc-model': createUscModelProvider(),
  simulated: createSimulatedProvider(),
};

export const DEFAULT_SOURCE: DataSourceId = 'usc-model';
