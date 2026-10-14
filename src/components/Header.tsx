import { BookOpen, Database, FlaskConical, MapPinned, Store, Truck } from 'lucide-react';
import type { AppMode, DataSourceInfo } from '../types';
import { PRODUCT_NAME } from '../config/labels';

interface Props {
  mode: AppMode;
  onModeChange: (m: AppMode) => void;
  info: DataSourceInfo;
  onOpenMethodology: () => void;
}

const MODES: { id: AppMode; label: string; sub: string; icon: typeof Truck }[] = [
  { id: 'explore', label: 'Find vending spots', sub: 'Trucks, carts & pop-ups', icon: Truck },
  { id: 'analyze', label: 'Analyze my location', sub: 'Restaurants', icon: Store },
];

export function Header({ mode, onModeChange, info, onOpenMethodology }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white shadow-sm">
          <MapPinned size={17} strokeWidth={2.25} />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">{PRODUCT_NAME}</div>
          <div className="hidden text-[11px] text-slate-500 lg:block">Los Angeles · Location intelligence</div>
        </div>
      </div>

      <nav className="ml-2 hidden rounded-lg bg-slate-100 p-1 sm:flex">
        {MODES.map(({ id, label, sub, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onModeChange(id)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-left transition ${
              mode === id ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon size={15} className={mode === id ? 'text-indigo-600' : ''} />
            <span className="leading-tight">
              <span className="block whitespace-nowrap text-[13px] font-medium">{label}</span>
              <span className="hidden text-[10px] text-slate-400 lg:block">{sub}</span>
            </span>
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {!info.isSimulated && (
          <>
            <button
              onClick={onOpenMethodology}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
            >
              <BookOpen size={13} /> <span className="hidden md:inline">Methodology</span>
            </button>
            <div className="group relative">
              <div className="flex cursor-help items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[12px] font-medium text-violet-800">
                <Database size={13} />
                <span className="whitespace-nowrap">Modeled from public data</span>
              </div>
              <div className="pointer-events-none absolute right-0 top-9 z-50 w-72 rounded-lg border border-slate-200 bg-white p-3 text-[12px] leading-relaxed text-slate-600 opacity-0 shadow-lg transition group-hover:opacity-100">
                <div className="mb-1 font-semibold text-slate-900">{info.label}</div>
                {info.description}
              </div>
            </div>
          </>
        )}
        {info.isSimulated && (
          <div className="group relative">
            <div className="flex cursor-help items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-800">
              <FlaskConical size={13} />
              <span className="whitespace-nowrap">Simulated data</span>
            </div>
            <div className="pointer-events-none absolute right-0 top-9 z-50 w-72 rounded-lg border border-slate-200 bg-white p-3 text-[12px] leading-relaxed text-slate-600 opacity-0 shadow-lg transition group-hover:opacity-100">
              <div className="mb-1 font-semibold text-slate-900">{info.label}</div>
              {info.description}
            </div>
          </div>
        )}
      </div>

      {/* Mobile mode switcher */}
      <select
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm sm:hidden"
        value={mode}
        onChange={(e) => onModeChange(e.target.value as AppMode)}
      >
        {MODES.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>
    </header>
  );
}
