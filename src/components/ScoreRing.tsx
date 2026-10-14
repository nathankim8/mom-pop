import { scoreTone } from '../lib/format';

export function ScoreRing({ score, size = 64, label }: { score: number; size?: number; label?: string }) {
  const tone = scoreTone(score);
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const color = score >= 70 ? '#10b981' : score >= 50 ? '#84cc16' : score >= 30 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={6} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-lg font-semibold tabular-nums">{score}</div>
      </div>
      {label !== undefined && (
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</div>
          <div className={`text-sm font-semibold ${tone.text}`}>{tone.label}</div>
        </div>
      )}
    </div>
  );
}

export function ScorePill({ score }: { score: number }) {
  const tone = scoreTone(score);
  return (
    <span className={`inline-flex min-w-9 justify-center rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums ${tone.bg} ${tone.text}`}>
      {score}
    </span>
  );
}
