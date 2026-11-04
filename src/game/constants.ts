import { BotDifficulty, GameMode } from "@/types/game";

export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;
export const PHYSICS_SUBSTEPS = 3;
export const SNAPSHOT_EVERY_TICKS = 2;

export const PLAYER_RADIUS = 18;
export const BALL_RADIUS = 15;
export const PLAYER_MAX_SPEED = 330;
export const PLAYER_ACCEL_RESPONSE = 9;

export const DASH_SPEED = 820;
export const DASH_DURATION = 0.16;
export const DASH_COOLDOWN = 2;

export const SLOW_DURATION = 0.55;
export const SLOW_IMMUNITY = 1.3;
export const SLOW_MULTIPLIER = 0.5;
export const SLOW_HIT_FACTOR = 0.6;

export const TRAIL_LIFETIME = 1.5;
export const POWER_TRAIL_LIFETIME = 2.2;
export const TRAIL_EMIT_DISTANCE = 7;
export const TRAIL_EMIT_MAX_INTERVAL = 0.05;
export const TRAIL_MIN_SPEED = 40;
export const TRAIL_ACTIVATION_DELAY = 0.09;
export const TRAIL_HALF_WIDTH = 4;
export const TRAIL_MAX_POINTS = 90;
export const TRAIL_BREAK_DISTANCE = 70;

export const TRAIL_MIN_BOUNCE_SPEED = 560;
export const POWER_MIN_BOUNCE_SPEED = 960;
export const TRAIL_BOUNCE_GAIN = 1.06;

export const BALL_MAX_SPEED = 1250;
export const BALL_DRAG = 0.34;
export const BALL_STOP_SPEED = 4;
export const BALL_WALL_RESTITUTION = 0.86;
export const BALL_BODY_RESTITUTION = 0.3;
export const PLAYER_BODY_RESTITUTION = 0.3;

export const COUNTDOWN_SECONDS = 3;
export const GOAL_CELEBRATION_SECONDS = 3.6;
export const OVERTIME_MAX_SECONDS = 120;
export const FFA_START_LIVES = 5;

export const SAVE_LOOKAHEAD = 420;
/** A shot deflected into the net by a defender within this window still counts for the shooter. */
export const DEFLECTION_CREDIT_SECONDS = 3;
export const SAVE_MIN_SPEED = 380;

export const MATCH_DURATIONS_SEC = [120, 180, 300] as const;
export const DEFAULT_DURATION_SEC = 180;

export const TEAM_COLORS = ["#22d3ee", "#f472b6", "#a3e635", "#fbbf24"] as const;
export const TEAM_NAMES = ["Cyan", "Magenta", "Lime", "Amber"] as const;

export interface ModeInfo {
  label: string;
  tagline: string;
  teamSize: number;
  teamCount: number;
}

export const MODE_INFO: Record<GameMode, ModeInfo> = {
  [GameMode.Solo]: { label: "Solo 1v1", tagline: "Aamne saamne", teamSize: 1, teamCount: 2 },
  [GameMode.Duo]: { label: "Duo 2v2", tagline: "Jodi mein jeeto", teamSize: 2, teamCount: 2 },
  [GameMode.Squad]: { label: "Squad 4v4", tagline: "Poori gang", teamSize: 4, teamCount: 2 },
  [GameMode.FreeForAll]: { label: "Chaar Kone", tagline: "4 goal, sab akele", teamSize: 1, teamCount: 4 },
};

export interface BotTuning {
  speedFactor: number;
  thinkInterval: number;
  aimNoise: number;
  dashChance: number;
  /** Chance the last defender reacts to a shot on goal. */
  saveChance: number;
}

export const BOT_TUNING: Record<BotDifficulty, BotTuning> = {
  [BotDifficulty.Easy]: { speedFactor: 0.72, thinkInterval: 0.32, aimNoise: 0.35, dashChance: 0.15, saveChance: 0.4 },
  [BotDifficulty.Normal]: { speedFactor: 0.88, thinkInterval: 0.18, aimNoise: 0.18, dashChance: 0.45, saveChance: 0.65 },
  [BotDifficulty.Hard]: { speedFactor: 1, thinkInterval: 0.08, aimNoise: 0.06, dashChance: 0.8, saveChance: 0.9 },
};
