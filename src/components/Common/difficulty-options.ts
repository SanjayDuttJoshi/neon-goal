import { BotDifficulty, RedBallMode } from "@/types/game";

export const DIFFICULTY_OPTIONS = [
  { value: BotDifficulty.Easy, label: "Aasaan" },
  { value: BotDifficulty.Normal, label: "Normal" },
  { value: BotDifficulty.Hard, label: "Khatarnak" },
];

export const DURATION_OPTIONS = [
  { value: 360, label: "6 min" },
  { value: 480, label: "8 min" },
  { value: 600, label: "10 min" },
];

export const RED_BALL_OPTIONS = [
  { value: RedBallMode.Off, label: "Red OFF" },
  { value: RedBallMode.Short, label: "Red 6s" },
  { value: RedBallMode.Long, label: "Red 12s" },
];

export const EVENT_OPTIONS = [
  { value: "on", label: "Events ON" },
  { value: "off", label: "Events OFF" },
];
