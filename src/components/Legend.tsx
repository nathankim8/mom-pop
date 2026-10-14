import type { DataSourceId, MapLayerKind } from '../types';
import { MODEL_CLASS_COLORS, MODEL_CLASS_LABELS, layerMeta } from '../config/labels';
import { ProvenanceBadge } from './ProvenanceBadge';

interface Props {
  layer: MapLayerKind;
  source: DataSourceId;
  showLowConfidence: boolean;
  showObserved: boolean;
  onOpenMethodology: () => void;
}

export function Legend({ layer, source, showLowConfidence, showObserved, onOpenMethodology }: Props) {
  const meta = layerMeta(layer, source);
  const modeled = source === 'usc-model';
  const classes = modeled && (layer === 'pedestrian' || layer === 'opportunity') ? MODEL_CLASS_COLORS[layer] : null;
  const gradient = `linear-gradient(to right, ${meta.ramp.slice(1).map(([s, c]) => `${c} ${s * 100}%`).join(', ')})`;
  const tag = !modeled ? (
    <ProvenanceBadge kind="simulated" />
  ) : layer === 'competition' ? (
    <ProvenanceBadge kind="observed" />
  ) : layer === 'opportunity' ? (
    <span className="flex gap-1"><ProvenanceBadge kind="modeled" /><ProvenanceBadge kind="assumption" /></span>
  ) : (
    <ProvenanceBadge kind="modeled" />
  );

  return (
    <div className="pointer-events-auto w-72 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] font-semibold leading-tight">{meta.label}</div>
        {tag}
      </div>

      {classes ? (
        <>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-sm">
            {classes.map((c) => <div key={c} className="flex-1" style={{ background: c }} />)}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>{layer === 'pedestrian' ? MODEL_CLASS_LABELS[0] : 'Score 0–20'}</span>
            <span>{layer === 'pedestrian' ? 'percentile, fixed scale' : 'fixed bands of 20'}</span>
            <span>{layer === 'pedestrian' ? MODEL_CLASS_LABELS[4] : '80–100'}</span>
          </div>
        </>
      ) : (
        <>
          <div className="mt-2 h-2 rounded-full" style={{ background: gradient }} />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>Low</span>
            <span>Relative index</span>
            <span>High</span>
          </div>
        </>
      )}
      <p className="mt-2 text-[11px] leading-snug text-slate-500">{meta.description}</p>

      <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[10.5px] text-slate-500">
        {(layer === 'competition' || layer === 'opportunity') && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-600" /> Same cuisine</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" /> Other food</span>
            <span className="text-slate-400">(zoom in)</span>
          </div>
        )}
        {modeled && showLowConfidence && layer !== 'competition' && (
          <div className="flex items-center gap-2">
            <span className="h-3 w-4 rounded-sm border border-slate-300" style={{ background: 'repeating-linear-gradient(135deg, #475569aa 0 1.5px, transparent 1.5px 6px)' }} />
            Low confidence: outside validated range or USC campus edge
          </div>
        )}
        {modeled && layer !== 'competition' && (
          <div className="text-slate-400">Residential streets (78% of cells) are untested — flagged when you click.</div>
        )}
        {modeled && showObserved && (
          <div className="flex items-center gap-2">
            <span className="ml-0.5 h-2.5 w-2.5 rotate-45 border-2 border-sky-900 bg-white" />
            LADOT count site — observed in past years, not live
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className={`h-0 w-4 border-t-2 border-slate-800 ${modeled ? '' : 'border-dashed'}`} />
          {modeled ? 'Model area — no data shown outside it' : 'Real-data model area (switch source to view)'}
        </div>
      </div>

      {modeled && (
        <button onClick={onOpenMethodology} className="mt-2 text-[11px] font-medium text-indigo-600 hover:underline">
          Methodology, validation &amp; limitations →
        </button>
      )}
    </div>
  );
}
