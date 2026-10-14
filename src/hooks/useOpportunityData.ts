import { useEffect, useMemo, useState } from 'react';
import type { ActivitySignals, CandidateSite, Competitor, Filters, GridCell, TimeOfDay } from '../types';
import type { LocationDataProvider } from '../data/provider';
import { TIME_SLOTS } from '../config/labels';
import { QUARTER_MILE_M } from '../lib/geo';
import { CompetitorIndex, competitionPressure } from '../analysis/competition';
import { opportunityScore } from '../analysis/scoring';
import { rankSites } from '../analysis/rankings';

export interface ScoredCell extends GridCell {
  opportunity: number;
}

/** Loads map-wide data from one provider for the current filters and derives opportunity scores + rankings. */
export function useOpportunityData(provider: LocationDataProvider, filters: Filters) {
  const { timeOfDay, day, businessType } = filters;
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [sites, setSites] = useState<CandidateSite[]>([]);
  const [grid, setGrid] = useState<GridCell[]>([]);
  const [siteSignals, setSiteSignals] = useState<Record<string, Record<TimeOfDay, ActivitySignals>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Clear the previous source's data so nothing from one source is shown with the other's.
    setCompetitors([]);
    setSites([]);
    setGrid([]);
    setSiteSignals({});
    setError(null);
    Promise.all([provider.getCompetitors(), provider.getCandidateSites()])
      .then(([c, s]) => {
        if (cancelled) return;
        setCompetitors(c);
        setSites(s);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [provider]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    provider
      .getActivityGrid({ timeOfDay, day })
      .then((cells) => {
        if (cancelled) return;
        setGrid(cells);
        setLoading(false);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [provider, timeOfDay, day]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      sites.map(async (site) => {
        const slots = await Promise.all(TIME_SLOTS.map((t) => provider.getSignalsAt(site.position, { timeOfDay: t, day })));
        if (slots.some((s) => s === null)) return null;
        return [site.id, Object.fromEntries(TIME_SLOTS.map((t, i) => [t, slots[i]])) as Record<TimeOfDay, ActivitySignals>] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setSiteSignals(Object.fromEntries(entries.filter((e) => e !== null)));
    });
    return () => {
      cancelled = true;
    };
  }, [provider, sites, day]);

  const index = useMemo(() => new CompetitorIndex(competitors), [competitors]);

  const scoredGrid: ScoredCell[] = useMemo(
    () =>
      grid.map((cell) => {
        const pressure = competitionPressure(index.near(cell.position, QUARTER_MILE_M, businessType), QUARTER_MILE_M);
        return { ...cell, opportunity: opportunityScore(cell, pressure, businessType, timeOfDay).score };
      }),
    [grid, index, businessType, timeOfDay],
  );

  const rankings = useMemo(
    () => rankSites(sites, siteSignals, index, businessType, timeOfDay),
    [sites, siteSignals, index, businessType, timeOfDay],
  );

  return { competitors, index, grid: scoredGrid, rankings, loading, error };
}
