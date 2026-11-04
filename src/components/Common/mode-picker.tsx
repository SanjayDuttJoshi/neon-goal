import { GameMode } from "@/types/game";
import { MODE_INFO } from "@/game/constants";

const MODE_ICONS: Record<GameMode, string> = {
  [GameMode.Solo]: "●",
  [GameMode.Duo]: "●●",
  [GameMode.Squad]: "●●●●",
  [GameMode.FreeForAll]: "✦",
};

interface ModePickerProps {
  value: GameMode;
  onChange?: (mode: GameMode) => void;
  disabled?: boolean;
}

export const ModePicker = ({ value, onChange, disabled = false }: ModePickerProps) => (
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {Object.values(GameMode).map((mode) => {
      const active = mode === value;
      return (
        <button
          key={mode}
          type="button"
          disabled={disabled}
          onClick={() => onChange?.(mode)}
          aria-pressed={active}
          className={`clip-corner flex flex-col items-start gap-1 border px-3 py-3 text-left transition-all disabled:cursor-default ${
            active
              ? "border-cyan-300/80 bg-cyan-400/15 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
              : "border-white/10 bg-white/[0.03] hover:border-cyan-300/40 disabled:hover:border-white/10"
          }`}
        >
          <span className={`font-mono text-xs ${active ? "text-cyan-300" : "text-slate-500"}`}>{MODE_ICONS[mode]}</span>
          <span className="font-display text-xs font-bold uppercase tracking-widest text-slate-100">{MODE_INFO[mode].label}</span>
          <span className="text-xs text-slate-400">{MODE_INFO[mode].tagline}</span>
        </button>
      );
    })}
  </div>
);
