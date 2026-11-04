import { MAX_NAME_LENGTH } from "@/net/lobby";

interface NameFieldProps {
  value: string;
  onChange: (name: string) => void;
}

export const NameField = ({ value, onChange }: NameFieldProps) => (
  <label className="block">
    <span className="mb-1.5 block font-display text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400">Tumhara naam</span>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={MAX_NAME_LENGTH}
      placeholder="Player"
      autoComplete="nickname"
      spellCheck={false}
      className="clip-corner w-full border border-cyan-300/25 bg-black/40 px-4 py-3 font-display text-lg tracking-wider text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-300/80 focus:bg-black/60"
    />
  </label>
);
