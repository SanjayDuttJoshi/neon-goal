import { BotDifficulty } from "@/types/game";

export const DIFFICULTY_OPTIONS = [
  { value: BotDifficulty.Easy, label: "Aasaan" },
  { value: BotDifficulty.Normal, label: "Normal" },
  { value: BotDifficulty.Hard, label: "Khatarnak" },
];

export const DURATION_OPTIONS = [
  { value: 120, label: "2 min" },
  { value: 180, label: "3 min" },
  { value: 300, label: "5 min" },
];
