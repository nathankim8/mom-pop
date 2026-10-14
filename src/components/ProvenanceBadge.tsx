import type { Provenance } from '../types';
import { PROVENANCE_STYLE } from '../config/labels';

/** Small chip saying where a value comes from: observed, modeled, assumption, simulated, or no data. */
export function ProvenanceBadge({ kind, className = '' }: { kind: Provenance; className?: string }) {
  const s = PROVENANCE_STYLE[kind];
  return (
    <span
      title={s.help}
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide ring-1 ${s.className} ${className}`}
    >
      {s.label}
    </span>
  );
}
