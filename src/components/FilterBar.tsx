import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { BusinessType, DataSourceId, Filters, MapLayerKind } from '../types';
import {
  BUSINESS_LABELS, BUSINESS_TYPES, DAYS, DAY_LABELS, LAYERS, LAYER_ORDER, SOURCE_LABELS, TIME_LABELS, TIME_SLOTS, layerAvailable, layerMeta,
} from '../config/labels';

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  layer: MapLayerKind;
  onLayerChange: (l: MapLayerKind) => void;
  loading: boolean;
  source: DataSourceId;
  onSourceChange: (s: DataSourceId) => void;
  showObserved: boolean;
  onShowObservedChange: (v: boolean) => void;
  showLowConfidence: boolean;
  onShowLowConfidenceChange: (v: boolean) => void;
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({ options, value, onChange, render, disabled, title }: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  render: (v: T, active: boolean) => ReactNode;
  disabled?: (v: T) => boolean;
  title?: (v: T) => string | undefined;
}) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-0.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          disabled={disabled?.(o)}
          title={title?.(o)}
          className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[12.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${
            value === o ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {render(o, value === o)}
        </button>
      ))}
    </div>
  );
}

export function FilterBar(props: Props) {
  const { filters, onChange, layer, onLayerChange, loading, source, onSourceChange } = props;
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const modeled = source === 'usc-model';

  return (
    <div className="flex shrink-0 items-end gap-5 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2.5">
      <Group label="Data source">
        <Segmented
          options={['usc-model', 'simulated'] as DataSourceId[]}
          value={source}
          onChange={onSourceChange}
          title={(s) => SOURCE_LABELS[s].sub}
          render={(s) => SOURCE_LABELS[s].label}
        />
      </Group>

      <Group label="Map layer">
        <Segmented
          options={LAYER_ORDER}
          value={layer}
          onChange={onLayerChange}
          disabled={(l) => !layerAvailable(l, source)}
          title={(l) => (layerAvailable(l, source) ? undefined : 'No real vehicle data in the USC model')}
          render={(l) => (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: LAYERS[l].ramp[LAYERS[l].ramp.length - 2][1] }} />
              {layerMeta(l, source).short}
            </span>
          )}
        />
      </Group>

      {modeled && (
        <Group label="Overlays">
          <div className="flex h-[30px] items-center gap-3 text-[12px] text-slate-600">
            <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
              <input type="checkbox" checked={props.showObserved} onChange={(e) => props.onShowObservedChange(e.target.checked)} className="accent-sky-700" />
              LADOT counts
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
              <input type="checkbox" checked={props.showLowConfidence} onChange={(e) => props.onShowLowConfidenceChange(e.target.checked)} className="accent-slate-700" />
              Low confidence
            </label>
          </div>
        </Group>
      )}

      <div className="h-9 w-px shrink-0 bg-slate-200" />

      <Group label={modeled ? 'Time of day · assumed weights' : 'Time of day'}>
        <Segmented
          options={TIME_SLOTS}
          value={filters.timeOfDay}
          onChange={(timeOfDay) => set({ timeOfDay })}
          render={(t) => <span title={TIME_LABELS[t].hours}>{TIME_LABELS[t].label}</span>}
        />
      </Group>

      <Group label={modeled ? 'Day · not modeled' : 'Day'}>
        <Segmented options={DAYS} value={filters.day} onChange={(day) => set({ day })} render={(d) => DAY_LABELS[d]} />
      </Group>

      <Group label="Business type">
        <div className="relative">
          <select
            value={filters.businessType}
            onChange={(e) => set({ businessType: e.target.value as BusinessType })}
            className="h-[30px] appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-[12.5px] font-medium text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-indigo-200"
          >
            {BUSINESS_TYPES.map((b) => (
              <option key={b} value={b}>{BUSINESS_LABELS[b]}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-2 text-slate-400" />
        </div>
      </Group>

      <div className={`ml-auto shrink-0 self-center text-[11px] text-slate-400 transition-opacity ${loading ? 'opacity-100' : 'opacity-0'}`}>
        Updating…
      </div>
    </div>
  );
}
