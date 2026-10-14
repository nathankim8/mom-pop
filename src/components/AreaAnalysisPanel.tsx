import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, MapPinOff, MousePointerClick, RotateCcw, Store } from 'lucide-react';
import type { BusinessType, CandidateSite, DataSourceInfo } from '../types';
import type { Severity } from '../analysis/areaReport';
import type { AreaReportState } from '../hooks/useAreaReport';
import { BUSINESS_LABELS, DAY_LABELS, FORMAT_LABELS, TIME_LABELS, TIME_SLOTS } from '../config/labels';
import { MILE_M, QUARTER_MILE_M, formatDistance } from '../lib/geo';
import { scoreTone } from '../lib/format';
import { ScoreRing } from './ScoreRing';
import { ProvenanceBadge } from './ProvenanceBadge';
import { ConfidenceList, TransitSlots } from './ModelConfidence';

export const RADIUS_OPTIONS = [
  { label: '¼ mi', value: QUARTER_MILE_M },
  { label: '½ mi', value: MILE_M / 2 },
  { label: '1 mi', value: MILE_M },
];

interface Props {
  state: AreaReportState | null;
  info: DataSourceInfo;
  onSwitchToSimulated: () => void;
  hasPoint: boolean;
  businessType: BusinessType;
  radiusM: number;
  onRadiusChange: (m: number) => void;
  examples: CandidateSite[];
  onPickExample: (s: CandidateSite) => void;
  onClear: () => void;
}

const SEVERITY_STYLE: Record<Severity, string> = {
  high: 'bg-rose-50 text-rose-700 ring-rose-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  low: 'bg-slate-50 text-slate-600 ring-slate-200',
};

function Section({ title, children, badge }: { title: string; children: ReactNode; badge?: ReactNode }) {
  return (
    <section className="border-b border-slate-100 px-4 py-4">
      <h3 className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
        {badge && <span className="ml-auto normal-case tracking-normal">{badge}</span>}
      </h3>
      {children}
    </section>
  );
}

export function AreaAnalysisPanel(props: Props) {
  const { state, info, onSwitchToSimulated, hasPoint, businessType, radiusM, onRadiusChange, examples, onPickExample, onClear } = props;
  const modeled = !info.isSimulated;

  if (!hasPoint) {
    return (
      <div className="px-5 py-6">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <MousePointerClick size={20} />
        </div>
        <h2 className="mt-3 text-[15px] font-semibold">Analyze a restaurant location</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
          Click anywhere on the map to drop a pin on your current or prospective restaurant. We'll profile the surrounding area
          across every day and time slot, and flag location-related disadvantages for{' '}
          <span className="font-medium text-slate-700">{BUSINESS_LABELS[businessType]}</span>.
        </p>
        <div className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Or try an example</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {examples.map((s) => (
            <button
              key={s.id}
              onClick={() => onPickExample(s)}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-[12px] text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {s.neighborhood}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (state?.status === 'outside') {
    return (
      <div className="space-y-3 px-5 py-6 text-[12.5px] text-slate-600">
        <div className="flex items-center gap-2 font-medium text-slate-800">
          <MapPinOff size={15} /> Outside the real-data model area
        </div>
        <p>The USC / Exposition Park model only covers the outlined box, so this pin can't be analyzed with real data. Simulated data is not mixed in.</p>
        <div className="flex gap-2">
          <button onClick={onClear} className="flex-1 rounded-lg border border-slate-200 py-2 font-medium hover:bg-slate-50">New pin</button>
          <button onClick={onSwitchToSimulated} className="flex-1 rounded-lg border border-slate-200 py-2 font-medium hover:bg-slate-50">Use simulated data</button>
        </div>
      </div>
    );
  }

  if (!state) return <div className="px-5 py-6 text-[12px] text-slate-400">Analyzing area…</div>;
  const { report, confidence, transit, sampledOutside } = state;

  const maxSlot = Math.max(1, ...TIME_SLOTS.flatMap((t) => [report.slotAverages[t].weekday, report.slotAverages[t].weekend]));

  return (
    <div>
      <div className="flex items-start justify-between border-b border-slate-100 px-4 pb-3 pt-4">
        <div>
          <div className="text-[13px] font-semibold">Location report</div>
          <div className="text-[11.5px] text-slate-500">
            {report.center[1].toFixed(4)}, {report.center[0].toFixed(4)} · {BUSINESS_LABELS[report.businessType]}
          </div>
        </div>
        <button onClick={onClear} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-slate-500 hover:bg-slate-100">
          <RotateCcw size={12} /> New pin
        </button>
      </div>

      <div className="flex items-center justify-between px-4 py-4">
        <ScoreRing score={report.overall} size={72} label="Location score" />
        <div className="flex rounded-lg bg-slate-100 p-0.5">
          {RADIUS_OPTIONS.map((o) => (
            <button
              key={o.label}
              onClick={() => onRadiusChange(o.value)}
              className={`rounded-md px-2 py-1 text-[11.5px] font-medium ${
                Math.abs(radiusM - o.value) < 1 ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'text-slate-500'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {modeled && (
        <Section title="Data confidence" badge={<ProvenanceBadge kind="modeled" />}>
          {confidence && <ConfidenceList confidence={confidence} />}
          {sampledOutside > 0 && (
            <p className="mt-2 text-[11.5px] text-amber-800">
              {sampledOutside} of 7 sample points fall outside the model area and were left out (not filled with simulated data).
            </p>
          )}
        </Section>
      )}

      <Section title="Score breakdown">
        <div className="space-y-3">
          {report.subscores.map((s) => (
            <div key={s.key}>
              <div className="flex items-baseline justify-between text-[12.5px]">
                <span className="font-medium">{s.label}</span>
                <span className="tabular-nums text-slate-500">
                  {s.score}
                  <span className="ml-1 text-[10px] text-slate-400">· {Math.round(s.weight * 100)}% weight</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${scoreTone(s.score).bar}`} style={{ width: `${s.score}%` }} />
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">{s.explanation}</p>
            </div>
          ))}
          {report.omitted.map((o) => (
            <div key={o.label} className="flex items-baseline justify-between text-[12px] text-slate-400">
              <span>{o.label}</span>
              <span className="text-[11px]">left out — {o.reason}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Potential disadvantages (${report.disadvantages.length})`}>
        {report.disadvantages.length === 0 ? (
          <p className="text-[12px] text-slate-500">No significant location-related disadvantages flagged.</p>
        ) : (
          <ul className="space-y-2">
            {report.disadvantages.map((d) => (
              <li key={d.title} className="rounded-lg border border-slate-100 p-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className={d.severity === 'high' ? 'text-rose-600' : d.severity === 'medium' ? 'text-amber-600' : 'text-slate-400'} />
                  <span className="text-[12.5px] font-medium">{d.title}</span>
                  <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${SEVERITY_STYLE[d.severity]}`}>
                    {d.severity}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] leading-snug text-slate-500">{d.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {report.strengths.length > 0 && (
        <Section title="Strengths">
          <ul className="space-y-1.5">
            {report.strengths.map((s) => (
              <li key={s.title} className="flex gap-2 text-[12px]">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                <span>
                  <span className="font-medium">{s.title}.</span> <span className="text-slate-500">{s.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {modeled ? (
        <Section title="Time of day">
          {transit && <TransitSlots transit={transit} />}
          <p className="mt-3 text-[11.5px] leading-snug text-slate-500">
            <ProvenanceBadge kind="assumption" className="mr-1.5" />
            Pedestrian activity is not modeled by hour or day — the counts used for validation have no hourly data. Time weights
            for {BUSINESS_LABELS[report.businessType].toLowerCase()} in the score are assumptions.
          </p>
        </Section>
      ) : (
      <Section title="Demand by time slot">
        <div className="flex h-28 items-end gap-3">
          {TIME_SLOTS.map((t) => (
            <div key={t} className="flex flex-1 flex-col items-center">
              <div className="flex h-20 w-full items-end justify-center gap-1">
                {(['weekday', 'weekend'] as const).map((k) => (
                  <div
                    key={k}
                    title={`${k}: ${Math.round(report.slotAverages[t][k])}`}
                    className={`w-3.5 rounded-t ${k === 'weekday' ? 'bg-indigo-500' : 'bg-indigo-200'}`}
                    style={{ height: `${Math.max(3, (report.slotAverages[t][k] / maxSlot) * 80)}px` }}
                  />
                ))}
              </div>
              <div className="mt-1 text-[10.5px] text-slate-500">{TIME_LABELS[t].label}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-3 text-[10.5px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-indigo-500" /> Weekday avg</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-indigo-200" /> Weekend avg</span>
        </div>
        <p className="mt-2 text-[11.5px] text-slate-500">
          Busiest:{' '}
          {report.bestSlots.map((b) => `${DAY_LABELS[b.day]} ${TIME_LABELS[b.timeOfDay].label.toLowerCase()}`).join(', ')}
        </p>
      </Section>
      )}

      <Section
        title={`Nearest ${BUSINESS_LABELS[report.businessType].toLowerCase()} competitors`}
        badge={<ProvenanceBadge kind={info.provenance.competitors} />}
      >
        <p className="mb-2 text-[11.5px] text-slate-500">
          {report.competitors.direct.length} same-cuisine of {report.competitors.total} food {modeled ? 'places in OpenStreetMap' : 'businesses'} within{' '}
          {formatDistance(report.radiusM)}.{modeled && ' Cuisine is from OSM tags or obvious name keywords; unknown cuisines count as other food.'}
        </p>
        <ul className="space-y-1">
          {report.competitors.direct.slice(0, 6).map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-[12px]">
              <Store size={12} className="text-rose-500" />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-slate-400">{FORMAT_LABELS[c.format]}</span>
              <span className="w-14 text-right tabular-nums text-slate-500">{formatDistance(c.distanceM)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <p className="px-4 py-4 text-[10.5px] leading-snug text-slate-400">
        {modeled
          ? 'Pedestrian activity is a modeled percentile (validated for ranking against 22 LADOT counts, ρ ≈ 0.7), competitors are observed OSM listings, and time weights are assumptions. Treat this as a screening tool, not a basis for a lease.'
          : 'All figures come from a simulated model of LA activity and fictional competitor listings. Use them to explore the product concept — not to make real leasing decisions.'}
      </p>
    </div>
  );
}
