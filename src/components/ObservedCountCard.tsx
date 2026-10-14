import { AlertTriangle, X } from 'lucide-react';
import type { ObservedCountSite } from '../types';
import { formatInt } from '../lib/format';
import { ProvenanceBadge } from './ProvenanceBadge';

interface Props {
  site: ObservedCountSite;
  onClose: () => void;
}

/** One LADOT count site, every year exactly as published. No averaging, no per-hour figures. */
export function ObservedCountCard({ site, onClose }: Props) {
  return (
    <div className="pointer-events-auto w-[330px] overflow-hidden rounded-xl border border-sky-200 bg-white shadow-xl">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ProvenanceBadge kind="observed" />
            <span className="text-[11px] font-medium text-sky-800">LADOT Walk &amp; Bike Count</span>
          </div>
          <div className="mt-1 text-[14px] font-semibold">{site.street}</div>
          <div className="text-[11.5px] text-slate-500">between {site.between}</div>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3 px-4 py-3">
        <table className="w-full text-[12px] tabular-nums">
          <thead>
            <tr className="text-left text-[10.5px] text-slate-500">
              <th className="pb-1 font-medium">Year</th>
              <th className="pb-1 text-right font-medium">Weekday<br /><span className="font-normal">7–10 AM + 3–6 PM</span></th>
              <th className="pb-1 text-right font-medium">Weekend<br /><span className="font-normal">11 AM–1 PM</span></th>
            </tr>
          </thead>
          <tbody>
            {site.observations.map((o) => (
              <tr key={o.year} className="border-t border-slate-100">
                <td className="py-1">
                  {o.year}
                  {o.year === 2021 && <span className="ml-1 text-[10px] text-amber-700" title="COVID-era count year">COVID era</span>}
                </td>
                <td className="py-1 text-right">{o.weekday6h === null ? '—' : formatInt(o.weekday6h)}</td>
                <td className="py-1 text-right">
                  {o.weekend2h === null ? '—' : formatInt(o.weekend2h)}
                  {o.note && <AlertTriangle size={11} className="ml-1 inline text-amber-600" aria-label={o.note} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {site.observations.some((o) => o.note) && (
          <p className="text-[11px] leading-snug text-amber-800">
            <AlertTriangle size={11} className="mr-1 inline" />
            {site.observations.find((o) => o.note)!.note} Shown as published.
          </p>
        )}

        <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] leading-snug text-slate-600">
          People counted walking past this segment, <b>totalled over each window</b>: 6 hours on a weekday, 2 hours on a weekend.
          The two columns cover different hours, so they are not directly comparable. Only the year is published — not the date, and
          not whether it was one day or an average. <b>These are past counts, not live or hourly traffic.</b>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-violet-100 bg-violet-50/50 p-2.5">
          <div className="text-[11px] text-slate-600">Model at this spot</div>
          {site.modelPercentile !== null ? (
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold tabular-nums">{site.modelPercentile}th pct</span>
              <ProvenanceBadge kind="modeled" />
            </div>
          ) : (
            <span className="text-[11px] text-slate-500">Outside model grid</span>
          )}
        </div>

        <p className="text-[10.5px] leading-snug text-slate-400">
          {site.placement}. Location matched from street names, not official coordinates. Source: LADOT via data.lacity.org (no
          license stated — used for validation only).
        </p>
      </div>
    </div>
  );
}
