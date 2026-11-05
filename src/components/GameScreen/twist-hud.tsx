import { ArenaEventStage, MatchPhase } from "@/types/game";
import type { HudState } from "@/types/render";
import { ARENA_EVENT_INFO } from "@/lib/arena-event-info";

interface TwistHudProps {
  hud: HudState;
}

/** V2 twists on screen: incoming/active arena event, red ball status and your own knock-out timer. */
export const TwistHud = ({ hud }: TwistHudProps) => {
  const { arenaEvent: ev } = hud;
  const info = ev.kind ? ARENA_EVENT_INFO[ev.kind] : null;
  const playing = hud.phase === MatchPhase.Playing;
  const warning = playing && info && ev.stage === ArenaEventStage.Warning;
  const active = info && ev.stage === ArenaEventStage.Active;
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex flex-wrap justify-center gap-2 px-4">
        {active && (
          <span className="glass px-3 py-1 font-display text-[11px] font-bold uppercase tracking-widest" style={{ color: info.color, borderColor: info.color }}>
            {info.icon} {info.title} · {Math.ceil(ev.timer)}s
          </span>
        )}
        {hud.redLeft > 0 && (
          <span className="glass animate-pulse px-3 py-1 font-display text-[11px] font-bold uppercase tracking-widest text-red-300" style={{ borderColor: "#ef4444" }}>
            🔥 Red ball · {hud.redLeft} touch baaki
          </span>
        )}
      </div>
      {warning && (
        <div className="pointer-events-none absolute inset-x-0 top-[18%] z-20 flex flex-col items-center text-center">
          <span className="animate-pulse font-display text-3xl font-black uppercase tracking-widest sm:text-5xl" style={{ color: info.color, textShadow: `0 0 24px ${info.color}` }}>
            ⚠ {info.title}
          </span>
          <span className="mt-1 font-display text-xs uppercase tracking-[0.3em] text-slate-200 sm:text-sm">
            {info.hint} · {Math.ceil(ev.timer)}
          </span>
        </div>
      )}
      {hud.selfOutTime > 0 && playing && (
        <div className="pointer-events-none absolute inset-x-0 top-[56%] z-20 flex flex-col items-center text-center">
          <span className="font-display text-4xl font-black uppercase text-red-400 sm:text-6xl" style={{ textShadow: "0 0 30px #ef4444" }}>
            🔥 Jal gaye!
          </span>
          <span className="mt-2 font-display text-sm uppercase tracking-[0.3em] text-slate-200">Wapas aa rahe ho · {Math.ceil(hud.selfOutTime)}</span>
        </div>
      )}
    </>
  );
};
