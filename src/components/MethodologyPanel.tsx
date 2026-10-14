import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import type { ModelMethodology } from '../types';
import { ProvenanceBadge } from './ProvenanceBadge';

interface Props {
  methodology: ModelMethodology | null;
  onClose: () => void;
}

function H({ children }: { children: ReactNode }) {
  return <h3 className="mb-1.5 mt-5 text-[12px] font-semibold uppercase tracking-wider text-slate-400">{children}</h3>;
}

/** In-app summary of pipeline/VALIDATION.md. Numbers come from the exported model file, not from this component. */
export function MethodologyPanel({ methodology: m, onClose }: Props) {
  const v = m?.validation;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="methodology-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 text-[13px] leading-relaxed text-slate-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="methodology-title" className="text-[17px] font-semibold text-slate-900">How the USC-area model works</h2>
            <p className="text-[12px] text-slate-500">{m ? `${m.version} · exported ${m.generated}` : 'Loading…'}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {m && v && (
          <>
            <H>What the map shows</H>
            <p>
              <b>Modeled Pedestrian Activity</b> is a relative ranking: each 100 m cell's percentile within the USC / Exposition Park model
              area. It is <b>not a pedestrian count, not live, and not hourly</b>. One percentile scale is computed once for the whole area,
              so it never changes with the time, day or business filters. Cells are drawn in five classes (quintiles), because the
              validation supports rankings, not fine distinctions.
            </p>

            <H>Inputs (public data)</H>
            <p className="mb-1">An equal-weight average of six standardised, log-scaled features, fixed before looking at any counts:</p>
            <ul className="list-disc space-y-0.5 pl-5">
              {m.features.map((f) => <li key={f}>{f}</li>)}
            </ul>

            <H>Validation against LADOT counts</H>
            <p>
              Checked against {v.nSites} LADOT Walk &amp; Bike Count sites (weekday totals for 7–10 AM + 3–6 PM, years 2019–2025). Every
              site was predicted without using its own count.
            </p>
            <table className="mt-2 w-full text-[12px] tabular-nums">
              <tbody className="[&_td]:border-t [&_td]:border-slate-100 [&_td]:py-1">
                <tr><td>Rank correlation, all sites</td><td className="text-right font-medium">ρ = {v.spearmanLOO} (95% CI {v.spearmanLOOci95[0]}–{v.spearmanLOOci95[1]})</td></tr>
                <tr><td>Outside downtown ({v.nOutsideDowntown} sites, most like the USC area)</td><td className="text-right font-medium">ρ = {v.spearmanOutsideDowntown}</td></tr>
                <tr><td>Within downtown ({v.nDowntown} sites)</td><td className="text-right font-medium">ρ = {v.spearmanDowntown} — can't rank blocks there</td></tr>
                <tr><td>Above vs below median correctly classified</td><td className="text-right font-medium">{v.medianSplitCorrect} of {v.nSites}</td></tr>
                <tr><td>Typical error if converted to counts</td><td className="text-right font-medium">×{v.typicalFactorLOO}–{v.typicalFactorSpatial} (no-model baseline ×{v.nullTypicalFactor})</td></tr>
                <tr><td>Same site, different years (noise in the counts)</td><td className="text-right font-medium">median {v.yearToYearMedianChangePct}% change</td></tr>
                <tr><td>Ridge regression / random forest (for comparison)</td><td className="text-right font-medium">ρ = {v.ridgeSpearmanLOO} / {v.forestSpearmanLOO}</td></tr>
              </tbody>
            </table>
            <p className="mt-2">
              Because count errors are ×2–3, the app shows percentiles only. The simple index was kept because fitted models did no better
              with 22 sites.
            </p>

            <H>Are the LADOT counts comparable?</H>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>Published totals equal weekday + weekend in all {v.comparability.total_equals_weekday_plus_weekend} checked records.</li>
              <li>Weekday (6 h) and weekend (2 h) windows differ, so the two are never compared directly. Only the year is published, with no dates.</li>
              <li>
                2021 (COVID era) weekday counts are about {Math.round((1 - v.comparability.weekday_2021_vs_other_years_median_ratio) * 100)}% lower
                than other years at the same {v.comparability.sites_with_2021_and_other_years} sites. Results hold when 2021 is excluded.
              </li>
              <li>{v.comparability.sites_counted_only_in_one_year.length} sites were counted in only one year. One record is flagged as a likely error: {v.comparability.weekend_outliers.join('; ')}.</li>
              <li>{v.countSitesOnMajorStreets} of {v.nSites} sites are on major streets. None measure residential streets.</li>
            </ul>

            <H>Labels used in the app</H>
            <ul className="space-y-1.5">
              <li><ProvenanceBadge kind="observed" /> Published data shown as-is: LADOT counts, Metro schedules, OpenStreetMap food places.</li>
              <li><ProvenanceBadge kind="modeled" /> The validated percentile index.</li>
              <li><ProvenanceBadge kind="assumption" /> Judgement-based weights, e.g. how much coffee depends on mornings. Not fitted to data.</li>
              <li><ProvenanceBadge kind="simulated" /> The illustrative all-LA mode. Never mixed into the USC model.</li>
            </ul>

            <H>Limitations</H>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>No hourly or day-of-week pedestrian data. Time filters change only assumed business weights. Transit departures by hour ({m.transitReferenceDate} schedule) are real but measure service, not people.</li>
              <li>The USC campus edge is under-predicted 1.6–3×, because student activity isn't in the inputs. Cells there are flagged.</li>
              <li>{v.gridCellsOutOfRangePct}% of cells have inputs beyond the validated range, and {v.gridCellsMinorStreetPct}% are on minor or residential streets that were never counted. Both are flagged.</li>
              <li>Vehicle traffic isn't modeled, so scores here are pedestrian-only. Food trucks and carts are rarely in OpenStreetMap.</li>
              <li>Features are from 2020–2026 sources of different vintages. LADOT counts carry no stated license and are used for validation only.</li>
            </ul>
            <p className="mt-4 text-[11.5px] text-slate-400">Full details: pipeline/VALIDATION.md in the project repository.</p>
          </>
        )}
      </div>
    </div>
  );
}
