import { GameMode } from "@/types/game";
import type { MatchSummary, SummaryPlayer } from "@/types/net";
import { TEAM_NAMES } from "@/game/constants";

/** Busy trails rack up dozens of bounces, so style points are capped at half a goal. */
const MAX_STYLE_POINTS = 5;

/** Goals and saves decide MVP; bounces and power hits only break ties. */
const scoreOf = (p: SummaryPlayer): number =>
  p.stats.goals * 10 +
  p.stats.saves * 3 -
  p.stats.ownGoals * 4 +
  Math.min(MAX_STYLE_POINTS, p.stats.powerShots * 0.05 + p.stats.bounces * 0.02);

export const pickMvp = (summary: MatchSummary): SummaryPlayer | null =>
  summary.players.reduce<SummaryPlayer | null>((best, p) => (!best || scoreOf(p) > scoreOf(best) ? p : best), null);

export const sortPlayers = (summary: MatchSummary): SummaryPlayer[] => [...summary.players].sort((a, b) => scoreOf(b) - scoreOf(a));

export const resultHeadline = (summary: MatchSummary, selfTeam: number | null): string => {
  if (summary.winner < 0) return "DRAW!";
  if (selfTeam === null) return `${TEAM_NAMES[summary.winner]} JEETA!`;
  return selfTeam === summary.winner ? "TUM JEETE! 🏆" : "HAAR GAYE 😤";
};

export const scoreLine = (summary: MatchSummary): string =>
  summary.mode === GameMode.FreeForAll
    ? summary.lives.map((l, t) => `${TEAM_NAMES[t]} ${l}♥`).join(" · ")
    : `${summary.scores[0] ?? 0} — ${summary.scores[1] ?? 0}`;
