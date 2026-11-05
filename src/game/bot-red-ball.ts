import type { PlayerState, SimState } from "@/types/game";
import { BALL_RADIUS, PLAYER_RADIUS } from "@/game/constants";
import { isRed } from "@/game/red-ball";
import { clamp, normalize } from "@/game/vector";

const SAFE_DISTANCE = 120;
const DODGE_LOOKAHEAD_SECONDS = 0.6;
const DODGE_STEP = 150;
const DODGE_DASH_DISTANCE = 170;
const MIN_THREAT_SPEED = 60;
const HIT_LANE = PLAYER_RADIUS + BALL_RADIUS + 25;
const FIELD_MARGIN = PLAYER_RADIUS + 8;

const moveTo = (state: SimState, bot: PlayerState, x: number, y: number, dash: boolean): void => {
  bot.brain.targetX = clamp(x, FIELD_MARGIN, state.arena.width - FIELD_MARGIN);
  bot.brain.targetY = clamp(y, FIELD_MARGIN, state.arena.height - FIELD_MARGIN);
  bot.brain.wantDash = dash;
};

/**
 * While the ball is red a bot must never touch it: it sidesteps a ball coming
 * straight at it and keeps every target outside a safe circle around the ball,
 * so it only plays the ball with its trail.
 */
export const avoidRedBall = (state: SimState, bot: PlayerState): void => {
  const { ball } = state;
  if (!isRed(ball) || bot.shieldTime > 0) return;
  const rx = bot.x - ball.x;
  const ry = bot.y - ball.y;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > MIN_THREAT_SPEED) {
    const dx = ball.vx / speed;
    const dy = ball.vy / speed;
    const along = rx * dx + ry * dy;
    const lateral = rx * dy - ry * dx;
    if (along > 0 && along < speed * DODGE_LOOKAHEAD_SECONDS && Math.abs(lateral) < HIT_LANE) {
      const side = lateral >= 0 ? 1 : -1;
      moveTo(state, bot, bot.x + dy * side * DODGE_STEP, bot.y - dx * side * DODGE_STEP, along < DODGE_DASH_DISTANCE);
      return;
    }
  }
  const away = normalize(rx, ry);
  if (Math.hypot(rx, ry) < SAFE_DISTANCE * 0.75) {
    moveTo(state, bot, ball.x + away.x * SAFE_DISTANCE, ball.y + away.y * SAFE_DISTANCE, false);
    return;
  }
  const tx = bot.brain.targetX - ball.x;
  const ty = bot.brain.targetY - ball.y;
  const dist = Math.hypot(tx, ty);
  if (dist >= SAFE_DISTANCE) return;
  const dir = dist > 1 ? { x: tx / dist, y: ty / dist } : away;
  moveTo(state, bot, ball.x + dir.x * SAFE_DISTANCE, ball.y + dir.y * SAFE_DISTANCE, false);
};
