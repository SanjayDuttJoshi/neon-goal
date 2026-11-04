"use client";

import { useState } from "react";
import { BotDifficulty, GameMode } from "@/types/game";
import type { LobbySettings } from "@/types/net";
import { ButtonVariant } from "@/types/ui";
import { DEFAULT_SETTINGS } from "@/net/lobby";
import { ModePicker } from "@/components/Common/mode-picker";
import { NeonButton } from "@/components/Common/neon-button";
import { Segmented } from "@/components/Common/segmented";
import { DIFFICULTY_OPTIONS, DURATION_OPTIONS } from "@/components/Common/difficulty-options";

interface PracticePanelProps {
  onStart: (settings: LobbySettings) => void;
  onBack: () => void;
}

export const PracticePanel = ({ onStart, onBack }: PracticePanelProps) => {
  const [mode, setMode] = useState(GameMode.Solo);
  const [difficulty, setDifficulty] = useState(BotDifficulty.Normal);
  const [duration, setDuration] = useState(DEFAULT_SETTINGS.durationSec);
  return (
    <div className="space-y-4 animate-float-up">
      <ModePicker value={mode} onChange={setMode} />
      <Segmented label="Bot difficulty" options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setDifficulty} />
      <Segmented label="Match length" options={DURATION_OPTIONS} value={duration} onChange={setDuration} />
      <div className="flex gap-3">
        <NeonButton variant={ButtonVariant.Ghost} onClick={onBack}>
          ← Back
        </NeonButton>
        <NeonButton wide onClick={() => onStart({ mode, botDifficulty: difficulty, durationSec: duration, botFill: true })}>
          Bots se khelo
        </NeonButton>
      </div>
    </div>
  );
};
