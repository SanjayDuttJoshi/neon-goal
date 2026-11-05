import type { LobbySettings } from "@/types/net";
import { ModePicker } from "@/components/Common/mode-picker";
import { Segmented } from "@/components/Common/segmented";
import { DIFFICULTY_OPTIONS, DURATION_OPTIONS, EVENT_OPTIONS, RED_BALL_OPTIONS } from "@/components/Common/difficulty-options";

interface SettingsPanelProps {
  settings: LobbySettings;
  editable: boolean;
  onChange: (patch: Partial<LobbySettings>) => void;
}

export const SettingsPanel = ({ settings, editable, onChange }: SettingsPanelProps) => (
  <div className="space-y-4">
    <ModePicker value={settings.mode} disabled={!editable} onChange={(mode) => onChange({ mode })} />
    <div className="grid gap-3 sm:grid-cols-3">
      <Segmented label="Match length" options={DURATION_OPTIONS} value={settings.durationSec} disabled={!editable} onChange={(durationSec) => onChange({ durationSec })} />
      <Segmented
        label="Bots"
        options={[
          { value: "on", label: "Bots ON" },
          { value: "off", label: "Bots OFF" },
        ]}
        value={settings.botFill ? "on" : "off"}
        disabled={!editable}
        onChange={(v) => onChange({ botFill: v === "on" })}
      />
      <Segmented label="Bot difficulty" options={DIFFICULTY_OPTIONS} value={settings.botDifficulty} disabled={!editable || !settings.botFill} onChange={(botDifficulty) => onChange({ botDifficulty })} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <Segmented label="Red Ball" options={RED_BALL_OPTIONS} value={settings.redBall} disabled={!editable} onChange={(redBall) => onChange({ redBall })} />
      <Segmented
        label="Arena events"
        options={EVENT_OPTIONS}
        value={settings.arenaEvents ? "on" : "off"}
        disabled={!editable}
        onChange={(v) => onChange({ arenaEvents: v === "on" })}
      />
    </div>
    {!editable && <p className="text-center text-xs uppercase tracking-widest text-slate-500">Sirf host settings badal sakta hai</p>}
  </div>
);
