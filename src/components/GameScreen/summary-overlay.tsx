import type { MatchSummary } from "@/types/net";
import { ButtonVariant } from "@/types/ui";
import { TEAM_COLORS } from "@/game/constants";
import { pickMvp, resultHeadline, scoreLine, sortPlayers } from "@/lib/summary";
import { NeonButton } from "@/components/Common/neon-button";

interface SummaryOverlayProps {
  summary: MatchSummary;
  selfId: string;
  selfTeam: number | null;
  isHost: boolean;
  isPractice: boolean;
  onRematch: () => void;
  onLobby: () => void;
  onLeave: () => void;
}

const STAT_COLUMNS = [
  { key: "goals", label: "Goal" },
  { key: "saves", label: "Save" },
  { key: "powerShots", label: "Power" },
  { key: "bounces", label: "Bounce" },
] as const;

export const SummaryOverlay = ({ summary, selfId, selfTeam, isHost, isPractice, onRematch, onLobby, onLeave }: SummaryOverlayProps) => {
  const mvp = pickMvp(summary);
  const winColor = TEAM_COLORS[summary.winner] ?? "#e2e8f0";
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm">
      <div className="glass clip-corner w-full max-w-2xl animate-pop-in p-5 sm:p-7">
        <p className="text-center font-display text-xs uppercase tracking-[0.4em] text-slate-400">Match khatam</p>
        <h2 className="mt-1 text-center font-display text-4xl font-black italic sm:text-5xl" style={{ color: winColor, textShadow: `0 0 28px ${winColor}` }}>
          {resultHeadline(summary, selfTeam)}
        </h2>
        <p className="mt-2 text-center font-mono text-2xl text-white">{scoreLine(summary)}</p>
        {mvp && (
          <p className="mt-3 text-center text-slate-200">
            ⭐ MVP: <span className="font-bold" style={{ color: TEAM_COLORS[mvp.team] }}>{mvp.name}</span>
          </p>
        )}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="font-display text-[10px] uppercase tracking-widest text-slate-500">
                <th className="py-1">Player</th>
                {STAT_COLUMNS.map((c) => (
                  <th key={c.key} className="py-1 text-center">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortPlayers(summary).map((p) => (
                <tr key={p.id} className={`border-t border-white/5 ${p.id === selfId ? "bg-white/5" : ""}`}>
                  <td className="py-1.5 font-semibold" style={{ color: TEAM_COLORS[p.team] }}>
                    {p.isBot ? "🤖 " : ""}
                    {p.name}
                    {p.id === selfId ? " (tum)" : ""}
                  </td>
                  {STAT_COLUMNS.map((c) => (
                    <td key={c.key} className="py-1.5 text-center font-mono text-slate-200">
                      {p.stats[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {isHost ? (
            <>
              <NeonButton onClick={onRematch}>↻ {isPractice ? "Phir se khelo" : "Rematch"}</NeonButton>
              {!isPractice && (
                <NeonButton variant={ButtonVariant.Secondary} onClick={onLobby}>
                  Lobby
                </NeonButton>
              )}
            </>
          ) : (
            <p className="w-full text-center font-display text-xs uppercase tracking-[0.25em] text-cyan-200">Host rematch shuru karega…</p>
          )}
          <NeonButton variant={ButtonVariant.Danger} onClick={onLeave}>
            {isPractice ? "Home" : "Leave"}
          </NeonButton>
        </div>
      </div>
    </div>
  );
};
