import type { ArenaDef, PlayerInput, PlayerState, RosterEntry, Vec2, WallDef } from "@/types/game";
import {
  DASH_COOLDOWN,
  DASH_DURATION,
  DASH_SPEED,
  PLAYER_ACCEL_RESPONSE,
  PLAYER_BODY_RESTITUTION,
  PLAYER_MAX_SPEED,
  PLAYER_RADIUS,
  SLOW_MULTIPLIER,
} from "@/game/constants";
import { slideOffSurface, wallContact } from "@/game/physics";
import { clamp } from "@/game/vector";

const INPUT_DEADZONE = 0.12;
const DASH_INPUT_THRESHOLD = 0.2;
const DASH_VELOCITY_THRESHOLD = 20;

export const NEUTRAL_INPUT: PlayerInput = { mx: 0, my: 0, dash: 0 };

export const normalizeInput = (input: PlayerInput): Vec2 => {
  const mx = clamp(Number.isFinite(input.mx) ? input.mx : 0, -1, 1);
  const my = clamp(Number.isFinite(input.my) ? input.my : 0, -1, 1);
  const len = Math.hypot(mx, my);
  if (len < INPUT_DEADZONE) return { x: 0, y: 0 };
  if (len > 1) return { x: mx / len, y: my / len };
  return { x: mx, y: my };
};

export const createPlayer = (entry: RosterEntry, spawn: Vec2): PlayerState => ({
  id: entry.id,
  name: entry.name,
  team: entry.team,
  botControlled: entry.isBot,
  x: spawn.x,
  y: spawn.y,
  vx: 0,
  vy: 0,
  faceX: entry.team % 2 === 0 ? 1 : -1,
  faceY: 0,
  dashTime: 0,
  dashCooldown: 0,
  dashX: 0,
  dashY: 0,
  lastDashCount: 0,
  slowTime: 0,
  slowImmunity: 0,
  trail: [],
  eliminated: false,
  stats: { goals: 0, ownGoals: 0, saves: 0, bounces: 0, powerShots: 0 },
  brain: { thinkTimer: 0, targetX: spawn.x, targetY: spawn.y, wantDash: false, aimNoise: 0 },
});

/** Consumes a dash request. Returns true when a dash actually started. */
export const tryStartDash = (player: PlayerState, input: PlayerInput, move: Vec2): boolean => {
  const count = Number.isFinite(input.dash) ? input.dash : player.lastDashCount;
  if (count < player.lastDashCount) {
    player.lastDashCount = count;
    return false;
  }
  if (count === player.lastDashCount) return false;
  player.lastDashCount = count;
  if (player.dashCooldown > 0 || player.eliminated) return false;
  let dirX = move.x;
  let dirY = move.y;
  let len = Math.hypot(dirX, dirY);
  if (len < DASH_INPUT_THRESHOLD) {
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > DASH_VELOCITY_THRESHOLD) {
      dirX = player.vx;
      dirY = player.vy;
    } else {
      dirX = player.faceX;
      dirY = player.faceY;
    }
    len = Math.hypot(dirX, dirY) || 1;
  }
  player.dashX = dirX / len;
  player.dashY = dirY / len;
  player.dashTime = DASH_DURATION;
  player.dashCooldown = DASH_COOLDOWN;
  return true;
};

export const tickPlayerTimers = (player: PlayerState, dt: number): void => {
  player.dashTime = Math.max(0, player.dashTime - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.slowTime = Math.max(0, player.slowTime - dt);
  player.slowImmunity = Math.max(0, player.slowImmunity - dt);
};

export const steerPlayer = (player: PlayerState, move: Vec2, dt: number, speedFactor: number): void => {
  if (Math.hypot(move.x, move.y) > DASH_INPUT_THRESHOLD) {
    const len = Math.hypot(move.x, move.y);
    player.faceX = move.x / len;
    player.faceY = move.y / len;
  }
  if (player.dashTime > 0) {
    player.vx = player.dashX * DASH_SPEED;
    player.vy = player.dashY * DASH_SPEED;
    return;
  }
  const slow = player.slowTime > 0 ? SLOW_MULTIPLIER : 1;
  const maxSpeed = PLAYER_MAX_SPEED * speedFactor * slow;
  const k = Math.min(1, PLAYER_ACCEL_RESPONSE * dt);
  player.vx += (move.x * maxSpeed - player.vx) * k;
  player.vy += (move.y * maxSpeed - player.vy) * k;
};

const PLAYER_WALL_CACHE = new WeakMap<ArenaDef, WallDef[]>();

/** Players collide with field walls and every goal mouth, they never enter nets. */
export const playerWallSegments = (arena: ArenaDef): WallDef[] => {
  const cached = PLAYER_WALL_CACHE.get(arena);
  if (cached) return cached;
  const segments = [...arena.walls, ...arena.goals.map((goal) => goal.mouth)];
  PLAYER_WALL_CACHE.set(arena, segments);
  return segments;
};

export const collidePlayerWithWalls = (player: PlayerState, arena: ArenaDef): void => {
  for (const wall of playerWallSegments(arena)) {
    const hit = wallContact(player.x, player.y, PLAYER_RADIUS, wall);
    if (hit) slideOffSurface(player, hit);
  }
  player.x = clamp(player.x, PLAYER_RADIUS, arena.width - PLAYER_RADIUS);
  player.y = clamp(player.y, PLAYER_RADIUS, arena.height - PLAYER_RADIUS);
};

export const collidePlayers = (a: PlayerState, b: PlayerState): void => {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let dist = Math.hypot(dx, dy);
  const minDist = PLAYER_RADIUS * 2;
  if (dist >= minDist) return;
  if (dist < 1e-6) {
    dx = 1;
    dy = 0;
    dist = 1;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  const push = (minDist - Math.min(dist, minDist)) / 2;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel < 0) {
    const impulse = ((1 + PLAYER_BODY_RESTITUTION) * rel) / 2;
    a.vx += impulse * nx;
    a.vy += impulse * ny;
    b.vx -= impulse * nx;
    b.vy -= impulse * ny;
  }
};
