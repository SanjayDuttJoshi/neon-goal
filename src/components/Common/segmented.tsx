interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T;
  onChange?: (value: T) => void;
  disabled?: boolean;
  label: string;
}

export const Segmented = <T extends string | number>({ options, value, onChange, disabled = false, label }: SegmentedProps<T>) => (
  <div role="radiogroup" aria-label={label} className="flex rounded-sm border border-white/10 bg-black/30 p-1">
    {options.map((option) => (
      <button
        key={String(option.value)}
        type="button"
        role="radio"
        aria-checked={option.value === value}
        disabled={disabled}
        onClick={() => onChange?.(option.value)}
        className={`flex-1 rounded-sm px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-widest transition-colors disabled:cursor-default ${
          option.value === value ? "bg-cyan-400/20 text-cyan-200" : "text-slate-400 hover:text-slate-200 disabled:hover:text-slate-400"
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);
