import { ButtonVariant } from "@/types/ui";
import { NeonButton } from "@/components/Common/neon-button";

interface PauseMenuProps {
  isPractice: boolean;
  muted: boolean;
  onResume: () => void;
  onToggleMute: () => void;
  onHelp: () => void;
  onLeave: () => void;
}

export const PauseMenu = ({ isPractice, muted, onResume, onToggleMute, onHelp, onLeave }: PauseMenuProps) => (
  <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onResume}>
    <div className="glass clip-corner w-full max-w-xs animate-pop-in space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
      <h2 className="text-center font-display text-lg font-bold uppercase tracking-[0.3em] text-cyan-200">{isPractice ? "Paused" : "Menu"}</h2>
      {!isPractice && <p className="text-center text-xs text-slate-400">Online match chal raha hai — game ruka nahi hai</p>}
      <NeonButton wide onClick={onResume}>
        {isPractice ? "▶ Resume" : "Wapas khelo"}
      </NeonButton>
      <NeonButton wide variant={ButtonVariant.Secondary} onClick={onToggleMute}>
        {muted ? "🔇 Sound OFF" : "🔊 Sound ON"}
      </NeonButton>
      <NeonButton wide variant={ButtonVariant.Secondary} onClick={onHelp}>
        Kaise khelein
      </NeonButton>
      <NeonButton wide variant={ButtonVariant.Danger} onClick={onLeave}>
        {isPractice ? "Quit" : "Leave match"}
      </NeonButton>
    </div>
  </div>
);
