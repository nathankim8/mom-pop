export const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));

export function scoreTone(score: number): { label: string; text: string; bg: string; bar: string } {
  if (score >= 70) return { label: 'Strong', text: 'text-emerald-700', bg: 'bg-emerald-50', bar: 'bg-emerald-500' };
  if (score >= 50) return { label: 'Promising', text: 'text-lime-700', bg: 'bg-lime-50', bar: 'bg-lime-500' };
  if (score >= 30) return { label: 'Moderate', text: 'text-amber-700', bg: 'bg-amber-50', bar: 'bg-amber-500' };
  return { label: 'Weak', text: 'text-rose-700', bg: 'bg-rose-50', bar: 'bg-rose-500' };
}

export function formatInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function ordinal(n: number): string {
  const v = Math.round(n);
  const s = v % 100 >= 11 && v % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[v % 10] ?? 'th';
  return `${v}${s}`;
}

/** Quintile class (0–4) of a 0–100 percentile — the classes the model map is drawn in. */
export const quintile = (pct: number) => Math.min(4, Math.floor(pct / 20));
