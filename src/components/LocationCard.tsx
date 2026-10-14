import { Car, Footprints, MapPinOff, Store, Truck, X, ArrowRight } from 'lucide-react';
import type { DataSourceInfo, Filters, Provenance } from '../types';
import type { LocationDetail } from '../hooks/useLocationDetail';
import { BUSINESS_LABELS, DAY_LABELS, MODEL_CLASS_LABELS, TIME_LABELS } from '../config/labels';
import { PEOPLE_PER_HOUR_PER_INDEX_POINT } from '../analysis/scoring';
import { formatInt, ordinal, quintile } from '../lib/format';
import { ScoreRing } from './ScoreRing';
import { ProvenanceBadge } from './ProvenanceBadge';
import { ConfidenceList, TransitSlots } from './ModelConfidence';

interface Props {
  detail: LocationDetail;
  info: DataSourceInfo;
  title?: string;
  subtitle?: string;
  filters: Filters;
  onClose: () => void;
  onAnalyze: () => void;
  onSwitchToSimulated: () => void;
}

function Metric({ icon: Icon, label, value, sub, source }: { icon: typeof Car; label: string; value: string; sub?: string; source: Provenance }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <Icon size={12} /> <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 text-[15px] font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10.5px] leading-snug text-slate-400">{sub}</div>}
      <ProvenanceBadge kind={source} className="mt-1" />
    </div>
  );
}

export function LocationCard({ detail, info, title, subtitle, filters, onClose, onAnalyze, onSwitchToSimulated }: Props) {
  const direct = detail.nearby.filter((c) => c.direct);
  const mobile = detail.nearby.filter((c) => c.format !== 'restaurant');
  const maxPed = Math.max(1, ...detail.bySlot.map((s) => s.opportunity));
  const modeled = !info.isSimulated;

  const header = (
    <div className="flex items-start justify-between border-b border-slate-100 px-4 py-3">
      <div>
        <div className="text-[14px] font-semibold">{title ?? 'Selected location'}</div>
        <div className="text-[11.5px] text-slate-500">
          {subtitle ?? `${detail.position[1].toFixed(4)}, ${detail.position[0].toFixed(4)}`}
        </div>
      </div>
      <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
        <X size={16} />
      </button>
    </div>
  );

  if (!detail.covered) {
    return (
      <div className="pointer-events-auto w-[330px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        {header}
        <div className="space-y-3 px-4 py-4 text-[12.5px] text-slate-600">
          <div className="flex items-center gap-2 font-medium text-slate-800">
            <MapPinOff size={15} /> Outside the real-data model area
          </div>
          <p>The USC / Exposition Park model only covers the outlined box. No values are estimated here, and simulated data is not mixed in.</p>
          <button onClick={onSwitchToSimulated} className="w-full rounded-lg border border-slate-200 py-2 text-[12.5px] font-medium hover:bg-slate-50">
            Switch to simulated all-LA data
          </button>
        </div>
      </div>
    );
  }

  const pct = detail.signals.pedestrian;

  return (
    <div className="pointer-events-auto w-[330px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      {header}

      <div className="space-y-3 px-4 py-3">
        <div className="flex items-center justify-between">
          <ScoreRing score={detail.opportunity.score} label="Opportunity score" />
          <div className="text-right text-[11px] leading-tight text-slate-500">
            {BUSINESS_LABELS[filters.businessType]}
            <br />
            {DAY_LABELS[filters.day]} · {TIME_LABELS[filters.timeOfDay].label}
            {modeled && (
              <>
                <br />
                <span className="text-amber-700">time weight = assumption</span>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {modeled ? (
            <Metric
              icon={Footprints}
              label="Modeled ped. activity"
              value={`${ordinal(pct)} pct`}
              sub={`${MODEL_CLASS_LABELS[quintile(pct)]} of the model area · not a count`}
              source="modeled"
            />
          ) : (
            <Metric
              icon={Footprints}
              label="Foot traffic"
              value={`${Math.round(pct)} / 100`}
              sub={`≈ ${formatInt(pct * PEOPLE_PER_HOUR_PER_INDEX_POINT)} people/hr*`}
              source="simulated"
            />
          )}
          <Metric
            icon={Car}
            label="Vehicle traffic"
            value={detail.signals.vehicle === null ? 'No data' : `${Math.round(detail.signals.vehicle)} / 100`}
            sub={detail.signals.vehicle === null ? 'not used in this source' : 'relative index'}
            source={info.provenance.vehicle}
          />
          <Metric
            icon={Store}
            label="Same-cuisine nearby"
            value={String(direct.length)}
            sub={`${detail.nearby.length} food ${modeled ? 'places (OSM)' : 'businesses'} ≤ ¼ mi`}
            source={info.provenance.competitors}
          />
          <Metric
            icon={Truck}
            label="Mobile vendors"
            value={String(mobile.length)}
            sub={modeled ? 'trucks & carts are rarely mapped in OSM' : 'trucks, carts, pop-ups ≤ ¼ mi'}
            source={info.provenance.competitors}
          />
        </div>

        {modeled && detail.confidence && <ConfidenceList confidence={detail.confidence} />}

        {modeled && detail.transit && <TransitSlots transit={detail.transit} highlight={filters.timeOfDay} />}

        <div>
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium text-slate-500">
            Opportunity through the day ({DAY_LABELS[filters.day]})
            <ProvenanceBadge kind={modeled ? 'assumption' : 'simulated'} className="ml-auto" />
          </div>
          <div className="flex h-16 items-end gap-2">
            {detail.bySlot.map((s) => (
              <div key={s.timeOfDay} className="flex flex-1 flex-col items-center gap-1">
                <div className="text-[10px] tabular-nums text-slate-500">{s.opportunity}</div>
                <div
                  className={`w-full rounded-t ${s.timeOfDay === filters.timeOfDay ? 'bg-indigo-500' : 'bg-slate-200'}`}
                  style={{ height: `${Math.max(4, (s.opportunity / maxPed) * 36)}px` }}
                />
                <div className="text-[10px] text-slate-500">{TIME_LABELS[s.timeOfDay].label}</div>
              </div>
            ))}
          </div>
          {modeled && (
            <p className="mt-1 text-[10.5px] leading-snug text-slate-400">
              Modeled activity is the same at every hour; these bars change only through assumed time weights for your business type.
            </p>
          )}
        </div>

        <button
          onClick={onAnalyze}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2 text-[12.5px] font-medium text-white hover:bg-slate-800"
        >
          Analyze as a restaurant site <ArrowRight size={14} />
        </button>

        <p className="text-[10.5px] leading-snug text-slate-400">
          {modeled
            ? 'Percentile of a 6-feature index from public data, ranked within the USC model area. Validated against 22 LADOT counts for ranking (ρ ≈ 0.7); counts would be off by ×2–3, so none are shown.'
            : '* Simulated estimate for prototyping, derived from a modeled index — not an observed pedestrian count.'}
        </p>
      </div>
    </div>
  );
}
