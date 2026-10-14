import { Clock, Footprints, Store, Trophy } from 'lucide-react';
import type { DataSourceInfo, Filters } from '../types';
import type { RankedSite } from '../analysis/rankings';
import { BUSINESS_LABELS, DAY_LABELS, TIME_LABELS } from '../config/labels';
import { ordinal, scoreTone } from '../lib/format';
import { ScorePill } from './ScoreRing';
import { ProvenanceBadge } from './ProvenanceBadge';

interface Props {
  rankings: RankedSite[];
  filters: Filters;
  info: DataSourceInfo;
  selectedId: string | null;
  onSelect: (r: RankedSite) => void;
}

export function RankingSidebar({ rankings, filters, info, selectedId, onSelect }: Props) {
  const modeled = !info.isSimulated;
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <Trophy size={15} className="text-indigo-600" /> Top vending spots
        </div>
        <p className="mt-1 text-[12px] leading-snug text-slate-500">
          Ranked for <span className="font-medium text-slate-700">{BUSINESS_LABELS[filters.businessType]}</span> on{' '}
          <span className="font-medium text-slate-700">{DAY_LABELS[filters.day]} · {TIME_LABELS[filters.timeOfDay].label}</span>{' '}
          ({TIME_LABELS[filters.timeOfDay].hours}). Score = expected demand, discounted for nearby competition.
        </p>
        {modeled ? (
          <p className="mt-2 text-[11.5px] leading-snug text-slate-500">
            <ProvenanceBadge kind="modeled" className="mr-1" /> Public places in the USC model area. Demand = modeled activity
            percentile (same at every hour) × <ProvenanceBadge kind="assumption" className="mx-0.5" /> time weights; competitors from
            OpenStreetMap.
          </p>
        ) : (
          <p className="mt-2 text-[11.5px] leading-snug text-slate-500">
            <ProvenanceBadge kind="simulated" className="mr-1" /> All values come from the illustrative all-LA simulation.
          </p>
        )}
      </div>

      <ol className="flex-1 divide-y divide-slate-100 overflow-y-auto">
        {rankings.map((r) => {
          const tone = scoreTone(r.score);
          const active = r.site.id === selectedId;
          return (
            <li key={r.site.id}>
              <button
                onClick={() => onSelect(r)}
                className={`flex w-full gap-3 px-4 py-3 text-left transition ${active ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}
              >
                <div
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                    active ? 'bg-indigo-600 text-white' : r.rank <= 10 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {r.rank}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">{r.site.name}</div>
                      <div className="truncate text-[11.5px] text-slate-500">{r.site.neighborhood}</div>
                    </div>
                    <ScorePill score={r.score} />
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${r.score}%` }} />
                  </div>
                  <div className="mt-1.5 flex gap-3 text-[11px] text-slate-500">
                    <span
                      className="flex items-center gap-1"
                      title={modeled ? 'Modeled pedestrian activity percentile (within the USC model area)' : 'Foot traffic index (simulated)'}
                    >
                      <Footprints size={11} /> {modeled ? `${ordinal(r.pedestrian)} pct` : Math.round(r.pedestrian)}
                    </span>
                    <span className="flex items-center gap-1" title="Same-cuisine competitors within ¼ mile">
                      <Store size={11} /> {r.directCompetitors} same / {r.totalCompetitors}
                    </span>
                    <span
                      className="flex items-center gap-1"
                      title={modeled ? 'Best slot from assumed business-type time weights only' : 'Best time slot on this day'}
                    >
                      <Clock size={11} /> Best: {TIME_LABELS[r.bestTime].label}{modeled && ' (assumed)'}
                    </span>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
        {rankings.length === 0 && <li className="px-4 py-6 text-[12px] text-slate-400">Scoring locations…</li>}
      </ol>
    </div>
  );
}
