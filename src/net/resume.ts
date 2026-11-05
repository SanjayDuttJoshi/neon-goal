import { ArenaEventStage, MatchPhase, type MatchConfig, type PlayerStats, type RosterEntry, type SimState } from "@/types/game";
import type { NetSnapshot } from "@/types/net";
import { COUNTDOWN_SECONDS, HEAT_TO_RED, RED_MAX_SECONDS, RESPAWN_SHIELD_SECONDS, SIM_DT } from "@/game/constants";
import { createMatch } from "@/game/match";

/**
 * Rebuilds an authoritative match from the last snapshot a peer saw. Used when
 * the host disappears and this peer takes over. Play resumes after a short
 * countdown so nobody gets surprised.
 */
export const resumeFromSnapshot = (
  config: MatchConfig,
  roster: RosterEntry[],
  snap: NetSnapshot,
  stats: PlayerStats[] | null,
  seed: number,
): SimState => {
  const state = createMatch(config, roster, seed);
  state.events = [];
  state.tick = snap.tick;
  state.time = snap.tick * SIM_DT;
  state.timeLeft = snap.timeLeft;
  state.overtime = snap.overtime;
  state.overtimeElapsed = snap.overtimeElapsed;
  state.scores = [...snap.scores];
  state.lives = [...snap.lives];
  state.closedGoals = [...snap.closedGoals];
  state.ball.x = snap.ball.x;
  state.ball.y = snap.ball.y;
  state.ball.vx = snap.ball.vx;
  state.ball.vy = snap.ball.vy;
  state.ball.heat = Math.round(snap.ball.heat * HEAT_TO_RED[config.mode]);
  state.ball.redLeft = snap.ball.redLeft;
  state.ball.redTime = snap.ball.redLeft > 0 ? RED_MAX_SECONDS / 2 : 0;
  state.arenaEvent.kind = snap.arenaEvent.kind;
  state.arenaEvent.stage = snap.arenaEvent.kind ? snap.arenaEvent.stage : ArenaEventStage.Idle;
  state.arenaEvent.timer = snap.arenaEvent.timer;
  state.winner = snap.winner;
  for (const net of snap.players) {
    const player = state.players[net.index];
    if (!player) continue;
    player.x = net.x;
    player.y = net.y;
    player.vx = 0;
    player.vy = 0;
    player.eliminated = net.eliminated;
    player.dashCooldown = net.dashCooldown;
    player.outTime = net.outTime;
    player.shieldTime = net.shielded ? RESPAWN_SHIELD_SECONDS : 0;
    const playerStats = stats?.[net.index];
    if (playerStats) player.stats = { ...playerStats };
  }
  if (snap.phase === MatchPhase.Ended) {
    state.phase = MatchPhase.Ended;
    state.phaseTimer = 0;
    return state;
  }
  if (snap.phase === MatchPhase.GoalScored) {
    state.phase = MatchPhase.GoalScored;
    state.phaseTimer = snap.phaseTimer;
    state.endAfterCelebration = snap.winner !== null;
    return state;
  }
  state.phase = MatchPhase.Countdown;
  state.phaseTimer = COUNTDOWN_SECONDS;
  return state;
};
