import { useEffect, useState } from 'react';
import type { ModelMethodology, ObservedCountSite } from '../types';
import type { LocationDataProvider } from '../data/provider';

/** Observed counts + methodology, for providers that have them (the USC real-data model). */
export function useModelExtras(provider: LocationDataProvider) {
  const [observed, setObserved] = useState<ObservedCountSite[]>([]);
  const [methodology, setMethodology] = useState<ModelMethodology | null>(null);

  useEffect(() => {
    let cancelled = false;
    setObserved([]);
    setMethodology(null);
    provider.getObservedCounts?.().then((o) => !cancelled && setObserved(o));
    provider.getMethodology?.().then((m) => !cancelled && setMethodology(m));
    return () => {
      cancelled = true;
    };
  }, [provider]);

  return { observed, methodology };
}
