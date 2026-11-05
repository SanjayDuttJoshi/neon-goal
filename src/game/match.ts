import {
  ArenaEventKind,
  GameEventKind,
  GameMode,
  MatchPhase,
  type MatchConfig,
  type PlayerState,
  type RosterEntry,
  type SimState,
  type TouchInfo,
  type Vec2,
} from "@/types/game";
import { buildArena } from "@/game/arena";
import {
  COUNTDOWN_SECONDS,
  DEFLECTION_CREDIT_SECONDS,
  FFA_START_LIVES,
  GOAL_CELEBRATION_SECONDS,
  MODE_INFO,
  RED_KICKOFF_COOLDOWN_SECONDS,
} from "@/game/constants";
import { pushEvent } from "@/game/events";
import { createArenaEventState, isArenaEventActive } from "@/game/arena-events";
import { createPlayer } from "@/game/players";
import { isRed, resetBallHeat } from "@/game/red-ball";

const slotOf = (players: PlayerState[], player: PlayerState): number =>
  players.filter((p) => p.team === player.team).indexOf(player);

export const spawnPointOf = (state: SimState, player: PlayerState): Vec2 => {
  const spawns = state.arena.spawns[player.team] ?? state.arena.spawns[0];
  return spawns[slotOf(state.players, player) % spawns.length];
};

export const resetPositions = (state: SimState): void => {
  const { arena } = state;
  state.ball.x = arena.width / 2;
  state.ball.y = arena.height / 2;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.lastTouch = null;
  state.ball.prevTouch = null;
  resetBallHeat(state.ball);
  state.ball.coolTime = RED_KICKOFF_COOLDOWN_SECONDS;
  for (const player of state.players) {
    const spawn = spawnPointOf(state, player);
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.dashTime = 0;
    player.dashCooldown = 0;
    player.slowTime = 0;
    player.slowImmunity = 0;
    player.outTime = 0;
    player.shieldTime = 0;
    player.trail = [];
    player.brain.thinkTimer = 0;
  }
};

const beginCountdown = (state: SimState): void => {
  resetPositions(state);
  state.phase = MatchPhase.Countdown;
  state.phaseTimer = COUNTDOWN_SECONDS;
  pushEvent(state, { kind: GameEventKind.Kickoff, x: state.ball.x, y: state.ball.y });
};

export const createMatch = (config: MatchConfig, roster: RosterEntry[], seed: number): SimState => {
  const info = MODE_INFO[config.mode];
  const arena = buildArena(config.mode, info.teamSize);
  const players = roster.map((entry) => createPlayer(entry, arena.spawns[entry.team]?.[0] ?? { x: 0, y: 0 }));
  const isFfa = config.mode === GameMode.FreeForAll;
  const state: SimState = {
    config,
    arena,
    tick: 0,
    time: 0,
    phase: MatchPhase.Countdown,
    phaseTimer: COUNTDOWN_SECONDS,
    timeLeft: config.durationSec,
    overtime: false,
    overtimeElapsed: 0,
    scores: Array.from({ length: arena.teamCount }, () => 0),
    lives: Array.from({ length: arena.teamCount }, () => (isFfa ? FFA_START_LIVES : 0)),
    closedGoals: [],
    players,
    ball: { x: arena.width / 2, y: arena.height / 2, vx: 0, vy: 0, lastTouch: null, prevTouch: null, heat: 0, redLeft: 0, redTime: 0, coolTime: 0 },
    events: [],
    nextEventId: 1,
    winner: null,
    rngState: seed | 0,
    endAfterCelebration: false,
    arenaEvent: createArenaEventState(),
  };
  if (isFfa) {
    for (let team = 0; team < arena.teamCount; team += 1) {
      if (!players.some((p) => p.team === team)) {
        state.lives[team] = 0;
        state.closedGoals.push(team);
      }
    }
  }
  beginCountdown(state);
  return state;
};

export const aliveTeams = (state: SimState): number[] =>
  state.lives.map((lives, team) => ({ lives, team })).filter((t) => t.lives > 0).map((t) => t.team);

/** Team with a strictly better record, or null when the top is tied. */
export const leadingTeam = (state: SimState): number | null => {
  const values = state.config.mode === GameMode.FreeForAll ? state.lives : state.scores;
  const best = Math.max(...values);
  const leaders = values.map((v, team) => ({ v, team })).filter((t) => t.v === best);
  return leaders.length === 1 ? leaders[0].team : null;
};

export const endMatch = (state: SimState, winner: number): void => {
  state.phase = MatchPhase.Ended;
  state.phaseTimer = 0;
  state.winner = winner;
  pushEvent(state, { kind: GameEventKind.MatchEnd, team: winner });
};

const eliminateTeam = (state: SimState, team: number): void => {
  state.closedGoals.push(team);
  for (const player of state.players) {
    if (player.team !== team) continue;
    player.eliminated = true;
    player.trail = [];
    player.vx = 0;
    player.vy = 0;
  }
  pushEvent(state, { kind: GameEventKind.Eliminated, team });
};

/**
 * Who gets the goal: the last toucher, unless that was a defender deflecting a
 * recent shot into their own net, in which case the shooter keeps the credit.
 */
const creditedTouch = (state: SimState, concedingTeam: number): TouchInfo | null => {
  const { lastTouch, prevTouch } = state.ball;
  if (!lastTouch || lastTouch.team !== concedingTeam) return lastTouch;
  const deflected = prevTouch && prevTouch.team !== concedingTeam && state.time - prevTouch.time <= DEFLECTION_CREDIT_SECONDS;
  return deflected ? prevTouch : lastTouch;
};

/** A red-ball goal and a golden-time goal are each worth one extra point. */
const goalPoints = (state: SimState): number =>
  1 + (isRed(state.ball) ? 1 : 0) + (isArenaEventActive(state, ArenaEventKind.GoldenTime) ? 1 : 0);

export const scoreGoal = (state: SimState, concedingTeam: number): void => {
  const { ball } = state;
  const isFfa = state.config.mode === GameMode.FreeForAll;
  const points = goalPoints(state);
  const touch = creditedTouch(state, concedingTeam);
  const scorer = touch ? state.players.find((p) => p.id === touch.playerId) : undefined;
  const isOwnGoal = !touch || touch.team === concedingTeam;
  let creditTeam = isFfa ? (isOwnGoal ? -1 : touch.team) : 1 - concedingTeam;
  if (scorer && isOwnGoal) scorer.stats.ownGoals += 1;
  if (scorer && !isOwnGoal) scorer.stats.goals += 1;
  if (creditTeam >= 0) state.scores[creditTeam] += points;
  if (isFfa) {
    state.lives[concedingTeam] = Math.max(0, state.lives[concedingTeam] - points);
  }
  pushEvent(state, {
    kind: GameEventKind.Goal,
    x: ball.x,
    y: ball.y,
    team: creditTeam,
    playerId: scorer?.id ?? "",
    otherId: isOwnGoal ? "own" : "",
    value: concedingTeam,
  });
  if (points > 1) pushEvent(state, { kind: GameEventKind.GoalBonus, x: ball.x, y: ball.y, team: creditTeam, value: points });
  state.phase = MatchPhase.GoalScored;
  state.phaseTimer = GOAL_CELEBRATION_SECONDS;
  if (isFfa && state.lives[concedingTeam] === 0) eliminateTeam(state, concedingTeam);
  if (isFfa) {
    const alive = aliveTeams(state);
    if (alive.length <= 1) {
      state.endAfterCelebration = true;
      state.winner = alive[0] ?? -1;
    } else if (state.overtime && leadingTeam(state) !== null) {
      state.endAfterCelebration = true;
      state.winner = leadingTeam(state);
    }
  } else if (state.overtime) {
    state.endAfterCelebration = true;
    creditTeam = creditTeam < 0 ? 1 - concedingTeam : creditTeam;
    state.winner = creditTeam;
  }
};

export const handleTimeUp = (state: SimState): void => {
  const leader = leadingTeam(state);
  if (leader !== null) {
    endMatch(state, leader);
    return;
  }
  state.overtime = true;
  state.timeLeft = 0;
  pushEvent(state, { kind: GameEventKind.Overtime });
};

export const finishCelebration = (state: SimState): void => {
  if (state.endAfterCelebration) {
    endMatch(state, state.winner ?? -1);
    return;
  }
  beginCountdown(state);
};
