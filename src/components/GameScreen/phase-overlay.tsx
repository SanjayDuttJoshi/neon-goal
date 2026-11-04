import { MatchPhase } from "@/types/game";
import type { FeedItem, HudState } from "@/types/render";
import { TEAM_COLORS } from "@/game/constants";

interface PhaseOverlayProps {
  hud: HudState;
  lastGoal: FeedItem | null;
  showKeys: boolean;
}

/** Big centre-screen moments: 3-2-1 countdown, GOAL! and golden goal. */
export const PhaseOverlay = ({ hud, lastGoal, showKeys }: PhaseOverlayProps) => {
  if (hud.phase === MatchPhase.Countdown) {
    const n = Math.max(1, Math.ceil(hud.phaseTimer));
    return (
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center">
        <span key={n} className="animate-count-pulse font-display text-8xl font-black text-white neon-text sm:text-9xl">
          {n}
        </span>
        <span className="mt-2 font-display text-sm uppercase tracking-[0.5em] text-cyan-200">Get ready</span>
        <span className="mt-6 text-center text-sm text-slate-300">
          {showKeys ? "WASD / Arrows = chalo · SPACE = Dash" : "Left = joystick · Right tap = Dash"}
          {hud.overtime ? " · GOLDEN GOAL" : ""}
        </span>
      </div>
    );
  }
  if (hud.phase === MatchPhase.GoalScored && lastGoal) {
    const color = TEAM_COLORS[lastGoal.team] ?? "#f8fafc";
    return (
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center">
        <span key={lastGoal.id} className="animate-goal-zoom font-display text-7xl font-black italic text-white sm:text-9xl" style={{ textShadow: `0 0 30px ${color}, 0 0 80px ${color}` }}>
          GOAL!
        </span>
        <span key={`t${lastGoal.id}`} className="mt-3 animate-goal-sub px-4 text-center font-display text-base uppercase tracking-[0.2em] text-white sm:text-lg">
          {lastGoal.text.replace(/^GOAL!\s*/, "")}
        </span>
      </div>
    );
  }
  return null;
};
