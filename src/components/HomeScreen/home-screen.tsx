"use client";

import { useState } from "react";
import type { LobbySettings } from "@/types/net";
import { ButtonVariant, HomePanel } from "@/types/ui";
import { Logo } from "@/components/Common/logo";
import { MenuBackground } from "@/components/Common/menu-background";
import { NeonButton } from "@/components/Common/neon-button";
import { Panel } from "@/components/Common/panel";
import { HowToPlay } from "@/components/HomeScreen/how-to-play";
import { JoinPanel } from "@/components/HomeScreen/join-panel";
import { NameField } from "@/components/HomeScreen/name-field";
import { PracticePanel } from "@/components/HomeScreen/practice-panel";
import { CLASSIC_URL } from "@/lib/version";

interface HomeScreenProps {
  name: string;
  onNameChange: (name: string) => void;
  inviteCode: string;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onPractice: (settings: LobbySettings) => void;
}

export const HomeScreen = ({ name, onNameChange, inviteCode, onCreate, onJoin, onPractice }: HomeScreenProps) => {
  const [chosenPanel, setPanel] = useState<HomePanel | null>(null);
  const panel = chosenPanel ?? (inviteCode ? HomePanel.Join : HomePanel.Main);
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <MenuBackground />
      <div className="relative z-10 w-full max-w-xl space-y-8 animate-pop-in">
        <Logo />
        {inviteCode && panel === HomePanel.Join && (
          <p className="text-center font-display text-sm uppercase tracking-[0.25em] text-fuchsia-200">
            Tumhe room <span className="font-mono text-lg text-white">{inviteCode}</span> mein bulaya gaya hai 🎉
          </p>
        )}
        <Panel>
          <div className="space-y-5">
            <NameField value={name} onChange={onNameChange} />
            {panel === HomePanel.Main && (
              <div className="grid gap-3 animate-float-up">
                <NeonButton wide onClick={onCreate}>
                  ⚡ Room Banao
                </NeonButton>
                <div className="grid grid-cols-2 gap-3">
                  <NeonButton variant={ButtonVariant.Secondary} onClick={() => setPanel(HomePanel.Join)}>
                    Join Karo
                  </NeonButton>
                  <NeonButton variant={ButtonVariant.Secondary} onClick={() => setPanel(HomePanel.Practice)}>
                    Practice
                  </NeonButton>
                </div>
              </div>
            )}
            {panel === HomePanel.Join && (
              <JoinPanel initialCode={inviteCode} onJoin={onJoin} onBack={() => setPanel(HomePanel.Main)} />
            )}
            {panel === HomePanel.Practice && <PracticePanel onStart={onPractice} onBack={() => setPanel(HomePanel.Main)} />}
          </div>
        </Panel>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
          <button type="button" onClick={() => setHelpOpen(true)} className="font-display uppercase tracking-widest text-cyan-300 hover:text-cyan-100">
            ? Kaise khelein
          </button>
          <span>100% free · No login · Dosto ko code bhejo</span>
          {CLASSIC_URL && (
            <a href={CLASSIC_URL} className="font-display uppercase tracking-widest text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline">
              V1 Classic khelo →
            </a>
          )}
        </div>
      </div>
      <HowToPlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
};
