import { useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MLMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Bounds, LngLat, MapLayerKind, ObservedCountSite } from '../types';
import type { RankedSite } from '../analysis/rankings';
import { LAYERS } from '../config/labels';
import { BASEMAP_STYLE_URL, LA_MAX_BOUNDS } from '../config/map';

export type HeatCollection = GeoJSON.FeatureCollection<GeoJSON.Point, { v: number }>;
export type CompetitorCollection = GeoJSON.FeatureCollection<GeoJSON.Point, { direct: number }>;
/** Model grid cells as squares, with a class 0–4 (quintile of the fixed percentile scale). */
export type CellCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon, { c: number }>;

interface Props {
  layer: MapLayerKind;
  heat: HeatCollection;
  /** When set, drawn instead of the heat map (USC model). */
  cells: CellCollection | null;
  cellColors: string[];
  lowConfidence: GeoJSON.FeatureCollection<GeoJSON.Polygon> | null;
  modelArea: Bounds;
  modelAreaActive: boolean;
  observed: ObservedCountSite[];
  selectedObservedId: string | null;
  onObservedClick: (id: string) => void;
  frame: { bounds: Bounds; key: number } | null;
  /** View to open on (read once, at map creation). */
  initialBounds: Bounds;
  competitors: CompetitorCollection;
  sites: RankedSite[];
  showSites: boolean;
  selectedSiteId: string | null;
  marker: LngLat | null;
  area: GeoJSON.Feature<GeoJSON.Polygon> | null;
  focus: { center: LngLat; key: number } | null;
  crosshair: boolean;
  onMapClick: (p: LngLat) => void;
  onSiteClick: (siteId: string) => void;
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function boundsPolygon(b: Bounds): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: LngLat[] = [[b.west, b.south], [b.east, b.south], [b.east, b.north], [b.west, b.north], [b.west, b.south]];
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

/** Diagonal hatch used to mark low-confidence model cells. */
function hatchImage(size = 10): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x + y) % size < 2) data.set([51, 65, 85, 150], (y * size + x) * 4);
    }
  }
  return { width: size, height: size, data };
}

/**
 * Heatmap kernels are sized in screen pixels. To keep the heat looking the same at every zoom,
 * the radius doubles with each zoom level (≈ 4× one 420 m grid cell, so neighbouring cells blend smoothly).
 */
const LAYER_STYLE: Record<MapLayerKind, { intensity: number; radiusAtZ10: number }> = {
  pedestrian: { intensity: 0.75, radiusAtZ10: 13 },
  vehicle: { intensity: 0.75, radiusAtZ10: 13 },
  opportunity: { intensity: 1.35, radiusAtZ10: 13 },
  competition: { intensity: 0.35, radiusAtZ10: 6 },
};

type HeatPaint = NonNullable<maplibregl.HeatmapLayerSpecification['paint']>;

function heatPaint(layer: MapLayerKind): HeatPaint {
  const { intensity, radiusAtZ10 } = LAYER_STYLE[layer];
  return {
    'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], ...LAYERS[layer].ramp.flat()] as HeatPaint['heatmap-color'],
    'heatmap-intensity': intensity,
    'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 10, radiusAtZ10, 16, radiusAtZ10 * 64],
  };
}

export function MapView(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const siteMarkers = useRef<Marker[]>([]);
  const pinMarker = useRef<Marker | null>(null);
  const observedMarkers = useRef<Marker[]>([]);

  // Keep latest callbacks without re-binding map events.
  const cb = useRef(props);
  cb.current = props;

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: BASEMAP_STYLE_URL,
      bounds: [[cb.current.initialBounds.west, cb.current.initialBounds.south], [cb.current.initialBounds.east, cb.current.initialBounds.north]],
      fitBoundsOptions: { padding: 30 },
      minZoom: 9,
      maxZoom: 16.5,
      maxBounds: LA_MAX_BOUNDS,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      // Put data layers underneath the basemap's text labels so street names stay readable.
      const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;

      map.addSource('heat', { type: 'geojson', data: EMPTY });
      map.addSource('cells', { type: 'geojson', data: EMPTY });
      map.addSource('lowconf', { type: 'geojson', data: EMPTY });
      map.addSource('model-area', { type: 'geojson', data: EMPTY });
      map.addImage('hatch', hatchImage());
      map.addSource('competitors', { type: 'geojson', data: EMPTY });
      map.addSource('area', { type: 'geojson', data: EMPTY });

      map.addLayer(
        {
          id: 'heat',
          type: 'heatmap',
          source: 'heat',
          paint: {
            ...heatPaint(cb.current.layer),
            'heatmap-weight': ['get', 'v'],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.85, 15, 0.6],
          },
        },
        firstLabel,
      );
      map.addLayer(
        {
          id: 'cells',
          type: 'fill',
          source: 'cells',
          paint: { 'fill-color': '#ffffff', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 16, 0.45], 'fill-antialias': false },
        },
        firstLabel,
      );
      map.addLayer({ id: 'lowconf', type: 'fill', source: 'lowconf', paint: { 'fill-pattern': 'hatch', 'fill-opacity': 0.8 } }, firstLabel);
      map.addLayer({
        id: 'model-area',
        type: 'line',
        source: 'model-area',
        paint: { 'line-color': '#1e293b', 'line-width': 1.5 },
      });
      map.addLayer({
        id: 'area-fill',
        type: 'fill',
        source: 'area',
        paint: { 'fill-color': '#4f46e5', 'fill-opacity': 0.06 },
      });
      map.addLayer({
        id: 'area-line',
        type: 'line',
        source: 'area',
        paint: { 'line-color': '#4f46e5', 'line-width': 2, 'line-dasharray': [2, 1.5] },
      });
      map.addLayer({
        id: 'competitors',
        type: 'circle',
        source: 'competitors',
        minzoom: 12.5,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12.5, ['case', ['==', ['get', 'direct'], 1], 2.5, 1.5], 16, ['case', ['==', ['get', 'direct'], 1], 6, 3.5]],
          'circle-color': ['case', ['==', ['get', 'direct'], 1], '#e11d48', '#64748b'],
          'circle-opacity': ['case', ['==', ['get', 'direct'], 1], 0.9, 0.45],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['case', ['==', ['get', 'direct'], 1], 1, 0],
        },
      });
      setReady(true);
    });

    map.on('click', (e) => cb.current.onMapClick([e.lngLat.lng, e.lngLat.lat]));

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current!);
    return () => {
      ro.disconnect();
      setReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const map = ready ? mapRef.current : null;

  useEffect(() => {
    (map?.getSource('heat') as GeoJSONSource | undefined)?.setData(props.heat);
  }, [map, props.heat]);

  useEffect(() => {
    (map?.getSource('competitors') as GeoJSONSource | undefined)?.setData(props.competitors);
  }, [map, props.competitors]);

  useEffect(() => {
    (map?.getSource('cells') as GeoJSONSource | undefined)?.setData(props.cells ?? EMPTY);
  }, [map, props.cells]);

  useEffect(() => {
    if (!map) return;
    const stops = props.cellColors.flatMap((c, i) => (i === 0 ? [c] : [i, c]));
    map.setPaintProperty('cells', 'fill-color', ['step', ['get', 'c'], ...stops] as unknown as string);
  }, [map, props.cellColors]);

  useEffect(() => {
    (map?.getSource('lowconf') as GeoJSONSource | undefined)?.setData(props.lowConfidence ?? EMPTY);
  }, [map, props.lowConfidence]);

  useEffect(() => {
    if (!map) return;
    (map.getSource('model-area') as GeoJSONSource).setData(boundsPolygon(props.modelArea));
    // Solid outline when the model is the active source; dashed "available here" hint otherwise.
    map.setPaintProperty('model-area', 'line-dasharray', props.modelAreaActive ? undefined : [3, 2]);
    map.setPaintProperty('model-area', 'line-opacity', props.modelAreaActive ? 0.9 : 0.6);
  }, [map, props.modelArea, props.modelAreaActive]);

  useEffect(() => {
    if (!map || !props.frame) return;
    const b = props.frame.bounds;
    map.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: 30, duration: 900 });
  }, [map, props.frame]);

  // LADOT observed count sites: diamond markers, visually distinct from modeled values and ranking badges.
  useEffect(() => {
    observedMarkers.current.forEach((m) => m.remove());
    observedMarkers.current = [];
    if (!map) return;
    for (const o of props.observed) {
      const el = document.createElement('button');
      el.type = 'button';
      el.title = `LADOT count site (observed, not live): ${o.segment}`;
      el.setAttribute('aria-label', el.title);
      const selected = o.id === props.selectedObservedId;
      el.className = 'ladot-marker-hit';
      const diamond = document.createElement('span');
      diamond.className = `ladot-marker${selected ? ' ladot-marker--selected' : ''}`;
      el.appendChild(diamond);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        cb.current.onObservedClick(o.id);
      });
      observedMarkers.current.push(new maplibregl.Marker({ element: el }).setLngLat(o.position).addTo(map));
    }
  }, [map, props.observed, props.selectedObservedId]);

  useEffect(() => {
    (map?.getSource('area') as GeoJSONSource | undefined)?.setData(props.area ?? EMPTY);
  }, [map, props.area]);

  useEffect(() => {
    if (!map) return;
    for (const [key, value] of Object.entries(heatPaint(props.layer))) {
      map.setPaintProperty('heat', key, value);
    }
  }, [map, props.layer]);

  useEffect(() => {
    if (map) map.getCanvas().style.cursor = props.crosshair ? 'crosshair' : '';
  }, [map, props.crosshair]);

  // Ranked site badges (HTML markers are easy to style with Tailwind).
  useEffect(() => {
    siteMarkers.current.forEach((m) => m.remove());
    siteMarkers.current = [];
    if (!map || !props.showSites) return;
    for (const r of [...props.sites].reverse()) {
      const top = r.rank <= 10;
      const selected = r.site.id === props.selectedSiteId;
      const el = document.createElement('button');
      el.type = 'button';
      el.title = `#${r.rank} ${r.site.name} — score ${r.score}`;
      el.textContent = String(r.rank);
      el.className = [
        'site-marker grid place-items-center rounded-full font-semibold shadow-md ring-2 transition-transform hover:scale-110',
        top ? 'h-7 w-7 text-[11px] bg-slate-900 text-white ring-white' : 'h-5 w-5 text-[9px] bg-white text-slate-600 ring-slate-300',
        selected ? '!bg-indigo-600 !text-white !ring-indigo-200 scale-125' : '',
      ].join(' ');
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        cb.current.onSiteClick(r.site.id);
      });
      siteMarkers.current.push(new maplibregl.Marker({ element: el }).setLngLat(r.site.position).addTo(map));
    }
  }, [map, props.sites, props.showSites, props.selectedSiteId]);

  useEffect(() => {
    pinMarker.current?.remove();
    pinMarker.current = null;
    if (!map || !props.marker) return;
    const el = document.createElement('div');
    el.className = 'pin-marker';
    pinMarker.current = new maplibregl.Marker({ element: el }).setLngLat(props.marker).addTo(map);
  }, [map, props.marker]);

  useEffect(() => {
    if (!map || !props.focus) return;
    map.flyTo({ center: props.focus.center, zoom: Math.max(map.getZoom(), 13.5), duration: 900 });
  }, [map, props.focus]);

  // Wrapper is positioned; the inner div belongs to MapLibre (its CSS forces position: relative).
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
