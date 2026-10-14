import { useMemo, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import type { AppMode, Bounds, DataSourceId, Filters, LngLat, MapLayerKind } from './types';
import { CONFIDENCE_FLAGS } from './types';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { MapView, type CellCollection, type CompetitorCollection, type HeatCollection } from './components/MapView';
import { Legend } from './components/Legend';
import { LocationCard } from './components/LocationCard';
import { ObservedCountCard } from './components/ObservedCountCard';
import { RankingSidebar } from './components/RankingSidebar';
import { AreaAnalysisPanel } from './components/AreaAnalysisPanel';
import { MethodologyPanel } from './components/MethodologyPanel';
import { DATA_PROVIDERS, DEFAULT_SOURCE } from './data';
import { USC_MODEL_AREA } from './data/usc/uscModelProvider';
import { MODEL_CLASS_COLORS, layerAvailable } from './config/labels';
import { useOpportunityData } from './hooks/useOpportunityData';
import { useLocationDetail } from './hooks/useLocationDetail';
import { useAreaReport } from './hooks/useAreaReport';
import { useModelExtras } from './hooks/useModelExtras';
import { MILE_M, circlePolygon } from './lib/geo';
import { LA_VIEW } from './config/map';
import { quintile } from './lib/format';

const EXAMPLE_SITE_IDS: Record<DataSourceId, string[]> = {
  simulated: ['site-9', 'site-1', 'site-24', 'site-29', 'site-16', 'site-33'],
  'usc-model': ['usc-site-1', 'usc-site-15', 'usc-site-5', 'usc-site-11', 'usc-site-9', 'usc-site-7'],
};
const LOW_CONFIDENCE_MAP_FLAGS = CONFIDENCE_FLAGS.outOfRange | CONFIDENCE_FLAGS.campusEdge;

export default function App() {
  const [source, setSource] = useState<DataSourceId>(DEFAULT_SOURCE);
  const provider = DATA_PROVIDERS[source];
  const info = provider.info;
  const modeled = !info.isSimulated;

  const [mode, setMode] = useState<AppMode>('explore');
  const [layer, setLayer] = useState<MapLayerKind>(DEFAULT_SOURCE === 'usc-model' ? 'pedestrian' : 'opportunity');
  const [filters, setFilters] = useState<Filters>({ timeOfDay: 'lunch', day: 'fri', businessType: 'tacos' });
  const [selected, setSelected] = useState<{ position: LngLat; siteId: string | null } | null>(null);
  const [selectedObservedId, setSelectedObservedId] = useState<string | null>(null);
  const [analysisPoint, setAnalysisPoint] = useState<LngLat | null>(null);
  const [radiusM, setRadiusM] = useState(MILE_M / 2);
  const [focus, setFocus] = useState<{ center: LngLat; key: number } | null>(null);
  const [frame, setFrame] = useState<{ bounds: Bounds; key: number } | null>(null);
  const [showObserved, setShowObserved] = useState(true);
  const [showLowConfidence, setShowLowConfidence] = useState(true);
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  const { competitors, index, grid, rankings, loading, error } = useOpportunityData(provider, filters);
  const { observed, methodology } = useModelExtras(provider);
  const detail = useLocationDetail(provider, mode === 'explore' ? selected?.position ?? null : null, filters, index);
  const report = useAreaReport(provider, mode === 'analyze' ? analysisPoint : null, radiusM, filters.businessType, index);

  // USC model: draw the 100 m cells themselves (five fixed classes) instead of a blurred heat map.
  const cellLayer = modeled && (layer === 'pedestrian' || layer === 'opportunity') ? layer : null;
  const half = useMemo(() => {
    if (!modeled || grid.length < 2) return null;
    const dLng = grid[1].position[0] - grid[0].position[0];
    const nextRow = grid.find((c) => c.position[1] !== grid[0].position[1]);
    return nextRow ? { lng: dLng / 2, lat: (nextRow.position[1] - grid[0].position[1]) / 2 } : null;
  }, [modeled, grid]);

  const square = ([lng, lat]: LngLat): GeoJSON.Polygon => {
    const h = half!;
    return {
      type: 'Polygon',
      coordinates: [[[lng - h.lng, lat - h.lat], [lng + h.lng, lat - h.lat], [lng + h.lng, lat + h.lat], [lng - h.lng, lat + h.lat], [lng - h.lng, lat - h.lat]]],
    };
  };

  const cells: CellCollection | null = useMemo(() => {
    if (!cellLayer || !half) return null;
    return {
      type: 'FeatureCollection',
      features: grid.map((c) => ({
        type: 'Feature',
        // Pedestrian: quintile of the fixed percentile. Opportunity: fixed score bands 0–20 … 80–100.
        properties: { c: quintile(cellLayer === 'pedestrian' ? c.pedestrian : c.opportunity) },
        geometry: square(c.position),
      })),
    };
  }, [cellLayer, grid, half]);

  const lowConfidence = useMemo(() => {
    if (!modeled || !showLowConfidence || !half || layer === 'competition') return null;
    return {
      type: 'FeatureCollection' as const,
      features: grid
        .filter((c) => ((c.flags ?? 0) & LOW_CONFIDENCE_MAP_FLAGS) > 0)
        .map((c) => ({ type: 'Feature' as const, properties: {}, geometry: square(c.position) })),
    };
  }, [modeled, showLowConfidence, half, layer, grid]);

  const heat: HeatCollection = useMemo(() => {
    if (cellLayer) return { type: 'FeatureCollection', features: [] };
    if (layer === 'competition') {
      return {
        type: 'FeatureCollection',
        features: competitors.map((c) => ({
          type: 'Feature',
          properties: { v: c.category === filters.businessType ? 1 : 0.3 },
          geometry: { type: 'Point', coordinates: c.position },
        })),
      };
    }
    const value = (c: (typeof grid)[number]) =>
      layer === 'pedestrian' ? c.pedestrian : layer === 'vehicle' ? c.vehicle ?? 0 : c.opportunity;
    return {
      type: 'FeatureCollection',
      features: grid.map((c) => ({
        type: 'Feature',
        properties: { v: value(c) / 100 },
        geometry: { type: 'Point', coordinates: c.position },
      })),
    };
  }, [cellLayer, layer, grid, competitors, filters.businessType]);

  const competitorDots: CompetitorCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: competitors.map((c) => ({
        type: 'Feature',
        properties: { direct: c.category === filters.businessType ? 1 : 0 },
        geometry: { type: 'Point', coordinates: c.position },
      })),
    }),
    [competitors, filters.businessType],
  );

  const area = useMemo(() => (mode === 'analyze' && analysisPoint ? circlePolygon(analysisPoint, radiusM) : null), [mode, analysisPoint, radiusM]);

  const selectedSite = selected?.siteId ? rankings.find((r) => r.site.id === selected.siteId) : undefined;
  const selectedObserved = observed.find((o) => o.id === selectedObservedId) ?? null;
  const examples = useMemo(
    () => EXAMPLE_SITE_IDS[source].map((id) => rankings.find((r) => r.site.id === id)?.site).filter((s) => s !== undefined),
    [rankings, source],
  );

  const flyTo = (center: LngLat) => setFocus({ center, key: Date.now() });

  const handleSourceChange = (s: DataSourceId) => {
    if (s === source) return;
    setSource(s);
    setSelected(null);
    setSelectedObservedId(null);
    setAnalysisPoint(null);
    if (!layerAvailable(layer, s)) setLayer('pedestrian');
    setFrame({ bounds: s === 'usc-model' ? USC_MODEL_AREA : LA_VIEW, key: Date.now() });
  };

  const handleMapClick = (p: LngLat) => {
    setSelectedObservedId(null);
    if (mode === 'explore') setSelected({ position: p, siteId: null });
    else setAnalysisPoint(p);
  };

  const handleModeChange = (m: AppMode) => {
    setMode(m);
    setSelectedObservedId(null);
    if (m === 'analyze' && selected && !analysisPoint) setAnalysisPoint(selected.position);
  };

  return (
    <div className="flex h-dvh flex-col bg-slate-50 text-slate-900 antialiased">
      <Header mode={mode} onModeChange={handleModeChange} info={info} onOpenMethodology={() => setMethodologyOpen(true)} />
      <FilterBar
        filters={filters}
        onChange={setFilters}
        layer={layer}
        onLayerChange={setLayer}
        loading={loading}
        source={source}
        onSourceChange={handleSourceChange}
        showObserved={showObserved}
        onShowObservedChange={(v) => {
          setShowObserved(v);
          if (!v) setSelectedObservedId(null);
        }}
        showLowConfidence={showLowConfidence}
        onShowLowConfidenceChange={setShowLowConfidence}
      />

      <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        <aside className="h-[42vh] w-full shrink-0 overflow-y-auto border-t border-slate-200 bg-white md:h-auto md:w-[372px] md:border-r md:border-t-0">
          {mode === 'explore' ? (
            <RankingSidebar
              rankings={rankings}
              filters={filters}
              info={info}
              selectedId={selected?.siteId ?? null}
              onSelect={(r) => {
                setSelectedObservedId(null);
                setSelected({ position: r.site.position, siteId: r.site.id });
                flyTo(r.site.position);
              }}
            />
          ) : (
            <AreaAnalysisPanel
              state={report}
              info={info}
              onSwitchToSimulated={() => handleSourceChange('simulated')}
              hasPoint={analysisPoint !== null}
              businessType={filters.businessType}
              radiusM={radiusM}
              onRadiusChange={setRadiusM}
              examples={examples}
              onPickExample={(s) => {
                setAnalysisPoint(s.position);
                flyTo(s.position);
              }}
              onClear={() => setAnalysisPoint(null)}
            />
          )}
        </aside>

        <main className="relative min-h-0 flex-1">
          <MapView
            layer={layer}
            heat={heat}
            cells={cells}
            cellColors={MODEL_CLASS_COLORS[cellLayer ?? 'pedestrian']}
            lowConfidence={lowConfidence}
            modelArea={USC_MODEL_AREA}
            modelAreaActive={modeled}
            observed={modeled && showObserved ? observed : []}
            selectedObservedId={selectedObservedId}
            onObservedClick={(id) => {
              setSelected(null);
              setSelectedObservedId(id);
            }}
            frame={frame}
            initialBounds={DEFAULT_SOURCE === 'usc-model' ? USC_MODEL_AREA : LA_VIEW}
            competitors={competitorDots}
            sites={rankings}
            showSites={mode === 'explore'}
            selectedSiteId={selected?.siteId ?? null}
            marker={mode === 'explore' ? selected?.position ?? null : analysisPoint}
            area={area}
            focus={focus}
            crosshair={mode === 'analyze'}
            onMapClick={handleMapClick}
            onSiteClick={(id) => {
              const r = rankings.find((x) => x.site.id === id);
              setSelectedObservedId(null);
              if (r) setSelected({ position: r.site.position, siteId: id });
            }}
          />

          <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden sm:block">
            <Legend
              layer={layer}
              source={source}
              showLowConfidence={showLowConfidence}
              showObserved={showObserved}
              onOpenMethodology={() => setMethodologyOpen(true)}
            />
          </div>

          {error && (
            <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800 shadow">
              <AlertTriangle size={14} /> Could not load data: {error}
            </div>
          )}

          {selectedObserved && (
            <div className="pointer-events-none absolute right-4 top-4 z-10 max-h-[calc(100%-2rem)] overflow-y-auto">
              <ObservedCountCard site={selectedObserved} onClose={() => setSelectedObservedId(null)} />
            </div>
          )}

          {mode === 'explore' && detail && !selectedObserved && (
            <div className="pointer-events-none absolute right-4 top-4 z-10 max-h-[calc(100%-2rem)] overflow-y-auto">
              <LocationCard
                detail={detail}
                info={info}
                title={selectedSite ? `#${selectedSite.rank} ${selectedSite.site.name}` : undefined}
                subtitle={selectedSite?.site.neighborhood}
                filters={filters}
                onClose={() => setSelected(null)}
                onAnalyze={() => {
                  setAnalysisPoint(detail.position);
                  setMode('analyze');
                }}
                onSwitchToSimulated={() => handleSourceChange('simulated')}
              />
            </div>
          )}

          {mode === 'analyze' && !analysisPoint && (
            <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-[12.5px] font-medium text-white shadow-lg">
              {modeled ? 'Click inside the outlined model area to drop your restaurant pin' : 'Click the map to drop your restaurant pin'}
            </div>
          )}

          {mode === 'explore' && !detail && !selectedObserved && (
            <div className="pointer-events-none absolute right-4 top-4 z-10 hidden items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[12px] text-slate-600 shadow-sm md:flex">
              <Info size={14} className="text-indigo-500" />
              {modeled ? 'Click inside the outlined area for details · ◆ = LADOT count site' : 'Click anywhere on the map for location details'}
            </div>
          )}
        </main>
      </div>

      {methodologyOpen && <MethodologyPanel methodology={methodology} onClose={() => setMethodologyOpen(false)} />}
    </div>
  );
}
