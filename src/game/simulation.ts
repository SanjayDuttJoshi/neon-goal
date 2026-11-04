import { GameEventKind, MatchPhase, type PlayerInput, type PlayerState, type SimState } from "@/types/game";
import {
  BALL_DRAG,
  BALL_STOP_SPEED,
  OVERTIME_MAX_SECONDS,
  PHYSICS_SUBSTEPS,
  PLAYER_RADIUS,
  SLOW_DURATION,
  SLOW_HIT_FACTOR,
  SLOW_IMMUNITY,
  TRAIL_HALF_WIDTH,
} from "@/game/constants";
import { ballWallSegments, detectGoal, stepBallSubstep } from "@/game/ball";
import { botSpeedFactor, computeBotInput } from "@/game/bots";
import { pushEvent } from "@/game/events";
import { endMatch, finishCelebration, handleTimeUp, leadingTeam, scoreGoal } from "@/game/match";
import {
  NEUTRAL_INPUT,
  collidePlayerWithWalls,
  collidePlayers,
  normalizeInput,
  steerPlayer,
  tickPlayerTimers,
  tryStartDash,
} from "@/game/players";
import { emitTrailPoint, expireTrail, forEachActiveSegment } from "@/game/trails";
import { distanceToSegment } from "@/game/vector";

export type InputMap = Record<string, PlayerInput | undefined>;

const activePlayers = (state: SimState): PlayerState[] => state.players.filter((p) => !p.eliminated);

const applyInputs = (state: SimState, inputs: InputMap, dt: number): void => {
  for (const player of activePlayers(state)) {
    tickPlayerTimers(player, dt);
    const input = player.botControlled ? computeBotInput(state, player, dt) : (inputs[player.id] ?? NEUTRAL_INPUT);
    const move = normalizeInput(input);
    if (tryStartDash(player, input, move)) {
      pushEvent(state, { kind: GameEventKind.Dash, x: player.x, y: player.y, team: player.team, playerId: player.id });
    }
    steerPlayer(player, move, dt, player.botControlled ? botSpeedFactor(state) : 1);
  }
};

const freezeForCountdown = (state: SimState, inputs: InputMap): void => {
  for (const player of state.players) {
    player.vx = 0;
    player.vy = 0;
    const input = inputs[player.id];
    if (input && Number.isFinite(input.dash)) player.lastDashCount = input.dash;
  }
};

const runPhysics = (state: SimState, dt: number): void => {
  const players = activePlayers(state);
  const walls = ballWallSegments(state);
  const h = dt / PHYSICS_SUBSTEPS;
  for (let step = 0; step < PHYSICS_SUBSTEPS; step += 1) {
    for (const player of players) {
      player.x += player.vx * h;
      player.y += player.vy * h;
    }
    for (let i = 0; i < players.length; i += 1) {
      for (let j = i + 1; j < players.length; j += 1) collidePlayers(players[i], players[j]);
    }
    stepBallSubstep(state, h, walls);
    for (const player of players) collidePlayerWithWalls(player, state.arena);
    if (state.phase === MatchPhase.Playing) {
      const conceding = detectGoal(state);
      if (conceding !== null) scoreGoal(state, conceding);
    }
  }
  const drag = Math.exp(-BALL_DRAG * dt);
  state.ball.vx *= drag;
  state.ball.vy *= drag;
  if (Math.hypot(state.ball.vx, state.ball.vy) < BALL_STOP_SPEED) {
    state.ball.vx = 0;
    state.ball.vy = 0;
  }
};

const updateTrails = (state: SimState): void => {
  for (const player of state.players) {
    if (!player.eliminated) {
      emitTrailPoint(player.trail, player.x, player.y, Math.hypot(player.vx, player.vy), state.time, player.dashTime > 0);
    }
    expireTrail(player.trail, state.time);
  }
};

const applySlowFromTrails = (state: SimState): void => {
  const players = activePlayers(state);
  for (const victim of players) {
    if (victim.slowImmunity > 0 || victim.dashTime > 0) continue;
    const reach = PLAYER_RADIUS * SLOW_HIT_FACTOR + TRAIL_HALF_WIDTH;
    const owner = players.find((other) => {
      if (other.team === victim.team) return false;
      let crossed = false;
      forEachActiveSegment(other, state.time, ({ seg }) => {
        crossed = distanceToSegment(victim.x, victim.y, seg) < reach;
        return crossed;
      });
      return crossed;
    });
    if (!owner) continue;
    victim.slowTime = SLOW_DURATION;
    victim.slowImmunity = SLOW_IMMUNITY;
    pushEvent(state, { kind: GameEventKind.Slowed, x: victim.x, y: victim.y, team: owner.team, playerId: victim.id });
  }
};

const advanceClock = (state: SimState, dt: number): void => {
  if (state.overtime) {
    state.overtimeElapsed += dt;
    if (state.overtimeElapsed >= OVERTIME_MAX_SECONDS) endMatch(state, leadingTeam(state) ?? -1);
    return;
  }
  state.timeLeft = Math.max(0, state.timeLeft - dt);
  if (state.timeLeft <= 0) handleTimeUp(state);
};

/** Advances the authoritative simulation by one fixed tick. */
export const stepSim = (state: SimState, inputs: InputMap, dt: number): void => {
  state.tick += 1;
  state.time += dt;
  if (state.phase === MatchPhase.Ended) return;
  if (state.phase === MatchPhase.Countdown) {
    freezeForCountdown(state, inputs);
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) {
      state.phase = MatchPhase.Playing;
      state.phaseTimer = 0;
    }
    return;
  }
  applyInputs(state, inputs, dt);
  runPhysics(state, dt);
  updateTrails(state);
  if (state.phase === MatchPhase.Playing) {
    applySlowFromTrails(state);
    advanceClock(state, dt);
    return;
  }
  if (state.phase === MatchPhase.GoalScored) {
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) finishCelebration(state);
  }
};
