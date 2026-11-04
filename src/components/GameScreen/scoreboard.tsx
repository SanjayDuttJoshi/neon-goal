import { GameMode } from "@/types/game";
import type { HudState } from "@/types/render";
import { TEAM_COLORS, TEAM_NAMES } from "@/game/constants";
import { formatClock } from "@/lib/format";

interface ScoreboardProps {
  hud: HudState;
  mode: GameMode;
  ping: number | null;
  weak: boolean;
  isPractice: boolean;
  muted: boolean;
  onMenu: () => void;
  onToggleMute: () => void;
}

const TeamScore = ({ team, value, mine, label }: { team: number; value: number; mine: boolean; label?: string }) => (
  <div className={`flex min-w-11 flex-col items-center px-1 sm:min-w-14 sm:px-2 ${mine ? "scale-110" : ""}`}>
    <span className="whitespace-nowrap font-display text-[8px] font-bold uppercase tracking-[0.15em] sm:text-[9px] sm:tracking-[0.25em]" style={{ color: TEAM_COLORS[team] }}>
      {label ?? TEAM_NAMES[team]}
      {mine ? " ★" : ""}
    </span>
    <span className="font-mono text-2xl font-bold leading-none text-white sm:text-3xl" style={{ textShadow: `0 0 16px ${TEAM_COLORS[team]}` }}>
      {value}
    </span>
  </div>
);

export const Scoreboard = ({ hud, mode, ping, weak, isPractice, muted, onMenu, onToggleMute }: ScoreboardProps) => {
  const ffa = mode === GameMode.FreeForAll;
  const clock = hud.overtime ? `OT ${formatClock(hud.overtimeElapsed)}` : formatClock(hud.timeLeft);
  const urgent = !hud.overtime && hud.timeLeft <= 10;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-2 pt-2 sm:px-4">
      <div className="pointer-events-auto flex gap-1">
        <button type="button" onClick={onMenu} className="glass clip-corner px-3 py-2 font-display text-xs uppercase tracking-widest text-slate-200 hover:text-white" aria-label="Menu">
          ☰
        </button>
        <button type="button" onClick={onToggleMute} className="glass clip-corner px-3 py-2 text-sm" aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇" : "🔊"}
        </button>
      </div>
      <div className="glass clip-corner flex items-center gap-1 px-3 py-1.5">
        {ffa
          ? hud.lives.map((lives, team) => <TeamScore key={team} team={team} value={lives} mine={hud.selfTeam === team} label={`${TEAM_NAMES[team]} ♥`} />)
          : [0, 1].map((team, i) => (
              <div key={team} className="flex items-center">
                {i === 1 && (
                  <span className={`mx-1 whitespace-nowrap font-mono text-base font-bold sm:mx-4 sm:text-xl ${urgent ? "animate-pulse text-rose-300" : hud.overtime ? "text-amber-300" : "text-slate-200"}`}>
                    {clock}
                  </span>
                )}
                <TeamScore team={team} value={hud.scores[team] ?? 0} mine={hud.selfTeam === team} />
              </div>
            ))}
        {ffa && <span className={`ml-2 font-mono text-lg font-bold ${urgent ? "text-rose-300" : "text-slate-200"}`}>{clock}</span>}
      </div>
      <div className="glass clip-corner px-2 py-2 text-right font-mono text-[10px] sm:min-w-16 sm:px-3 sm:text-xs">
        {isPractice ? (
          <span className="text-slate-400">BOTS</span>
        ) : (
          <span className={weak ? "text-rose-300" : ping !== null && ping > 150 ? "text-amber-300" : "text-lime-300"}>
            {weak ? "LAG!" : ping === null ? "HOST" : `${ping}ms`}
          </span>
        )}
      </div>
    </div>
  );
};
