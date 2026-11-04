import { GameMode, type GoalDef, type PlayerInput, type PlayerState, type SimState, type Vec2 } from "@/types/game";
import { BALL_RADIUS, BOT_TUNING, PLAYER_MAX_SPEED, PLAYER_RADIUS, type BotTuning } from "@/game/constants";
import { isShotOnGoal } from "@/game/ball";
import { clamp, nextRandom, normalize, raySegmentDistance } from "@/game/vector";

const ARRIVE_RADIUS = 40;
const STOP_RADIUS = 6;
const BEHIND_GAP = BALL_RADIUS + PLAYER_RADIUS + 6;
const ALIGN_TOLERANCE = 22;
/** Close enough to the shooting line to just drive through the ball instead of re-aligning. */
const DRIVE_LANE = 30;
const DASH_ALIGN_DOT = 0.9;
const DASH_RANGE = 700;
const MAX_LEAD_SECONDS = 0.7;
const DEFEND_FRACTION = 0.42;
const PUSH_UP_FRACTION = 0.62;
const FIELD_MARGIN = PLAYER_RADIUS + 8;

const random = (state: SimState): number => {
  const [value, next] = nextRandom(state.rngState);
  state.rngState = next;
  return value;
};

const openGoals = (state: SimState, exceptTeam: number): GoalDef[] =>
  state.arena.goals.filter((g) => g.team !== exceptTeam && !state.closedGoals.includes(g.team));

const pickAttackGoal = (state: SimState, bot: PlayerState): GoalDef | undefined => {
  const goals = openGoals(state, bot.team);
  if (state.config.mode !== GameMode.FreeForAll) return goals[0];
  const { ball } = state;
  return goals.reduce<GoalDef | undefined>((best, goal) => {
    if (!best) return goal;
    const d = Math.hypot(goal.centerX - ball.x, goal.centerY - ball.y);
    const bestD = Math.hypot(best.centerX - ball.x, best.centerY - ball.y);
    return d < bestD ? goal : best;
  }, undefined);
};

const predictBall = (state: SimState, bot: PlayerState): Vec2 => {
  const { ball, arena } = state;
  const lead = clamp(Math.hypot(ball.x - bot.x, ball.y - bot.y) / PLAYER_MAX_SPEED, 0, MAX_LEAD_SECONDS);
  return {
    x: clamp(ball.x + ball.vx * lead * 0.8, FIELD_MARGIN, arena.width - FIELD_MARGIN),
    y: clamp(ball.y + ball.vy * lead * 0.8, FIELD_MARGIN, arena.height - FIELD_MARGIN),
  };
};

const isClosestTeammate = (state: SimState, bot: PlayerState): boolean => {
  const { ball } = state;
  const myDist = Math.hypot(ball.x - bot.x, ball.y - bot.y);
  return !state.players.some(
    (p) => p !== bot && !p.eliminated && p.team === bot.team && Math.hypot(ball.x - p.x, ball.y - p.y) < myDist - 1,
  );
};

/** The teammate closest to the own goal is the one that tracks back on shots. */
const isLastLine = (state: SimState, bot: PlayerState, ownGoal: GoalDef): boolean => {
  const myDist = Math.hypot(ownGoal.centerX - bot.x, ownGoal.centerY - bot.y);
  return !state.players.some(
    (p) =>
      p !== bot &&
      !p.eliminated &&
      p.team === bot.team &&
      Math.hypot(ownGoal.centerX - p.x, ownGoal.centerY - p.y) < myDist - 1,
  );
};

const setTarget = (state: SimState, bot: PlayerState, x: number, y: number, dash: boolean): void => {
  bot.brain.targetX = clamp(x, FIELD_MARGIN, state.arena.width - FIELD_MARGIN);
  bot.brain.targetY = clamp(y, FIELD_MARGIN, state.arena.height - FIELD_MARGIN);
  bot.brain.wantDash = dash;
};

const defendShot = (state: SimState, bot: PlayerState, ownGoal: GoalDef): void => {
  const { ball } = state;
  const speed = Math.hypot(ball.vx, ball.vy) || 1;
  const dirX = ball.vx / speed;
  const dirY = ball.vy / speed;
  const along = Math.max(0, (bot.x - ball.x) * dirX + (bot.y - ball.y) * dirY);
  const hitDist = raySegmentDistance(ball.x, ball.y, dirX, dirY, ownGoal.mouth) ?? along;
  const intercept = Math.min(along, Math.max(0, hitDist - PLAYER_RADIUS * 2.5));
  const tx = ball.x + dirX * intercept;
  const ty = ball.y + dirY * intercept;
  const far = Math.hypot(tx - bot.x, ty - bot.y) > 120;
  setTarget(state, bot, tx, ty, far);
};

const attack = (state: SimState, bot: PlayerState, goal: GoalDef, tuning: BotTuning): void => {
  const ball = predictBall(state, bot);
  const mouthLen = Math.hypot(goal.mouth.bx - goal.mouth.ax, goal.mouth.by - goal.mouth.ay);
  const along = (bot.brain.aimNoise * mouthLen) / 2;
  const tangentX = (goal.mouth.bx - goal.mouth.ax) / mouthLen;
  const tangentY = (goal.mouth.by - goal.mouth.ay) / mouthLen;
  const aimX = goal.centerX + tangentX * along;
  const aimY = goal.centerY + tangentY * along;
  const toGoal = normalize(aimX - ball.x, aimY - ball.y);
  const behindX = ball.x - toGoal.x * BEHIND_GAP;
  const behindY = ball.y - toGoal.y * BEHIND_GAP;
  const ahead = (bot.x - ball.x) * toGoal.x + (bot.y - ball.y) * toGoal.y;
  if (ahead > -PLAYER_RADIUS) {
    const cross = toGoal.x * (bot.y - ball.y) - toGoal.y * (bot.x - ball.x);
    const side = cross >= 0 ? 1 : -1;
    const px = -toGoal.y * side;
    const py = toGoal.x * side;
    setTarget(state, bot, ball.x - toGoal.x * 70 + px * 75, ball.y - toGoal.y * 70 + py * 75, false);
    return;
  }
  const lane = Math.abs(toGoal.x * (bot.y - ball.y) - toGoal.y * (bot.x - ball.x));
  if (lane > DRIVE_LANE && Math.hypot(bot.x - behindX, bot.y - behindY) > ALIGN_TOLERANCE) {
    setTarget(state, bot, behindX, behindY, false);
    return;
  }
  const toBall = normalize(ball.x - bot.x, ball.y - bot.y);
  const aligned = toBall.x * toGoal.x + toBall.y * toGoal.y > DASH_ALIGN_DOT;
  const inRange = Math.hypot(aimX - ball.x, aimY - ball.y) < DASH_RANGE;
  const dash = aligned && inRange && random(state) < tuning.dashChance;
  setTarget(state, bot, ball.x + toGoal.x * 90, ball.y + toGoal.y * 90, dash);
};

const isBallInOwnHalf = (state: SimState, ownGoal: GoalDef): boolean => {
  const { ball, arena } = state;
  const depth = (ball.x - ownGoal.centerX) * ownGoal.inwardX + (ball.y - ownGoal.centerY) * ownGoal.inwardY;
  const fieldDepth = Math.abs(ownGoal.inwardX) > 0 ? arena.width : arena.height;
  return depth < fieldDepth / 2;
};

const support = (state: SimState, bot: PlayerState, ownGoal: GoalDef, slot: number): void => {
  const { ball } = state;
  if (slot === 0) {
    const fraction = isBallInOwnHalf(state, ownGoal) ? DEFEND_FRACTION : PUSH_UP_FRACTION;
    setTarget(
      state,
      bot,
      ownGoal.centerX + (ball.x - ownGoal.centerX) * fraction,
      ownGoal.centerY + (ball.y - ownGoal.centerY) * fraction,
      false,
    );
    return;
  }
  const laneY = state.arena.height * (slot % 2 === 0 ? 0.3 : 0.7);
  const backX = ball.x + ownGoal.inwardX * -160;
  setTarget(state, bot, backX, laneY, false);
};

const decide = (state: SimState, bot: PlayerState, tuning: BotTuning): void => {
  const ownGoal = state.arena.goals.find((g) => g.team === bot.team);
  const attackGoal = pickAttackGoal(state, bot);
  bot.brain.aimNoise = (random(state) * 2 - 1) * tuning.aimNoise;
  if (ownGoal && isShotOnGoal(state, bot.team) && isLastLine(state, bot, ownGoal) && random(state) < tuning.saveChance) {
    defendShot(state, bot, ownGoal);
    return;
  }
  if (!attackGoal) {
    setTarget(state, bot, state.ball.x, state.ball.y, false);
    return;
  }
  if (isClosestTeammate(state, bot) || !ownGoal) {
    attack(state, bot, attackGoal, tuning);
    return;
  }
  const mates = state.players.filter((p) => p.team === bot.team && !p.eliminated && p !== bot && !isClosestTeammate(state, p));
  const slot = mates.filter((p) => state.players.indexOf(p) < state.players.indexOf(bot)).length;
  support(state, bot, ownGoal, slot);
};

export const computeBotInput = (state: SimState, bot: PlayerState, dt: number): PlayerInput => {
  const tuning = BOT_TUNING[state.config.botDifficulty];
  bot.brain.thinkTimer -= dt;
  if (bot.brain.thinkTimer <= 0) {
    bot.brain.thinkTimer = tuning.thinkInterval * (0.7 + random(state) * 0.6);
    decide(state, bot, tuning);
  }
  const dx = bot.brain.targetX - bot.x;
  const dy = bot.brain.targetY - bot.y;
  const dist = Math.hypot(dx, dy);
  const scale = dist < STOP_RADIUS ? 0 : Math.min(1, dist / ARRIVE_RADIUS);
  const dir = normalize(dx, dy);
  let dash = bot.lastDashCount;
  if (bot.brain.wantDash && bot.dashCooldown <= 0) {
    dash = bot.lastDashCount + 1;
    bot.brain.wantDash = false;
  }
  return { mx: dir.x * scale, my: dir.y * scale, dash };
};

export const botSpeedFactor = (state: SimState): number => BOT_TUNING[state.config.botDifficulty].speedFactor;
