import { AlertTriangle, Bus, CheckCircle2 } from 'lucide-react';
import type { ConfidenceInfo, TransitSupply } from '../types';
import { TIME_LABELS, TIME_SLOTS } from '../config/labels';
import { formatInt } from '../lib/format';
import { ProvenanceBadge } from './ProvenanceBadge';

const REASONS: { key: keyof ConfidenceInfo; title: string; detail: string }[] = [
  {
    key: 'minorStreet',
    title: 'Residential / minor street',
    detail: '20 of 22 validation counts were on major streets, so the model is untested on streets like this one.',
  },
  {
    key: 'outOfRange',
    title: 'Outside the validated range',
    detail: 'At least one input (restaurants, jobs, residents, intersections, transit) is beyond anything seen at the count sites.',
  },
  {
    key: 'campusEdge',
    title: 'USC campus edge',
    detail: 'Both count sites beside campus were under-predicted 1.6–3× — student activity is not in the input data.',
  },
];

/** Low-confidence indicators for a point in the USC model. */
export function ConfidenceList({ confidence }: { confidence: ConfidenceInfo }) {
  const active = REASONS.filter((r) => confidence[r.key]);
  if (active.length === 0) {
    return (
      <div className="flex gap-2 rounded-lg border border-slate-100 p-2.5 text-[11.5px] text-slate-600">
        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
        <span>No low-confidence flags here. Ranking accuracy still only moderate (see Methodology).</span>
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {active.map((r) => (
        <li key={r.key} className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-[11.5px] leading-snug">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
          <span>
            <span className="font-medium text-slate-800">Low confidence: {r.title}.</span>{' '}
            <span className="text-slate-600">{r.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Scheduled Metro departures by time slot — the only real time-of-day data in the USC model. */
export function TransitSlots({ transit, highlight }: { transit: TransitSupply; highlight?: string }) {
  const max = Math.max(1, ...TIME_SLOTS.map((t) => transit.bySlot[t]));
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium text-slate-500">
        <Bus size={12} /> Scheduled transit departures within {transit.radiusM} m
        <ProvenanceBadge kind="observed" className="ml-auto" />
      </div>
      {transit.stops === 0 ? (
        <p className="text-[11.5px] text-slate-500">No bus or rail stops within {transit.radiusM} m.</p>
      ) : (
        <div className="flex h-16 items-end gap-2">
          {TIME_SLOTS.map((t) => (
            <div key={t} className="flex flex-1 flex-col items-center gap-1">
              <div className="text-[10px] tabular-nums text-slate-500">{formatInt(transit.bySlot[t])}</div>
              <div
                className={`w-full rounded-t ${t === highlight ? 'bg-sky-600' : 'bg-sky-200'}`}
                style={{ height: `${Math.max(3, (transit.bySlot[t] / max) * 36)}px` }}
              />
              <div className="text-[10px] text-slate-500" title={TIME_LABELS[t].hours}>{TIME_LABELS[t].label}</div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-1 text-[10.5px] leading-snug text-slate-400">
        Metro GTFS · {transit.dayType}, {transit.referenceDate} · {transit.stops} stop{transit.stops === 1 ? '' : 's'}.
        Counts buses and trains, not people.
      </p>
    </div>
  );
}
