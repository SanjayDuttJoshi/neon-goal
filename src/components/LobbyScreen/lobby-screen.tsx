"use client";

import type { RoomSession } from "@/net/room-session";
import type { UiState } from "@/types/session";
import { ButtonVariant } from "@/types/ui";
import { MODE_INFO } from "@/game/constants";
import { canStart, membersOnTeam } from "@/net/lobby";
import { Logo } from "@/components/Common/logo";
import { MenuBackground } from "@/components/Common/menu-background";
import { NeonButton } from "@/components/Common/neon-button";
import { Panel } from "@/components/Common/panel";
import { InviteCard } from "@/components/LobbyScreen/invite-card";
import { SettingsPanel } from "@/components/LobbyScreen/settings-panel";
import { TeamColumn } from "@/components/LobbyScreen/team-column";
import { Toast } from "@/components/GameScreen/toast";

interface LobbyScreenProps {
  session: RoomSession;
  ui: UiState;
  onLeave: () => void;
}

export const LobbyScreen = ({ session, ui, onLeave }: LobbyScreenProps) => {
  const lobby = ui.lobby;
  if (!lobby) return null;
  const info = MODE_INFO[lobby.settings.mode];
  const self = lobby.members.find((m) => m.clientId === ui.selfClientId);
  const bench = lobby.members.filter((m) => m.team === null);
  const check = canStart(lobby);
  return (
    <main className="relative min-h-dvh px-3 py-6 sm:px-6">
      <MenuBackground />
      <div className="relative z-10 mx-auto max-w-5xl space-y-4 pb-6 animate-pop-in">
        <header className="flex items-center justify-between">
          <Logo size="sm" />
          <NeonButton variant={ButtonVariant.Danger} onClick={onLeave}>
            Leave
          </NeonButton>
        </header>
        <Panel>
          <InviteCard code={lobby.roomCode} />
        </Panel>
        <Panel title="Match settings">
          <SettingsPanel settings={lobby.settings} editable={ui.isHost} onChange={(patch) => session.updateSettings(patch)} />
        </Panel>
        <Panel title={`Teams · ${info.label}`}>
          <div className={`grid gap-3 ${info.teamCount === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"}`}>
            {Array.from({ length: info.teamCount }, (_, team) => (
              <TeamColumn
                key={team}
                team={team}
                members={membersOnTeam(lobby, team)}
                capacity={info.teamSize}
                botFill={lobby.settings.botFill}
                selfClientId={ui.selfClientId}
                hostPeerId={lobby.hostPeerId}
                isHost={ui.isHost}
                selfOnTeam={self?.team === team}
                onJoinTeam={() => session.requestTeam(team)}
                onKick={(peerId) => session.kick(peerId)}
                onBench={(peerId) => session.moveToTeam(peerId, null)}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <span className="font-display text-[11px] uppercase tracking-widest">Bench (dekh rahe hain):</span>
            {bench.length === 0 && <span>koi nahi</span>}
            {bench.map((m) => (
              <span key={m.clientId} className="border border-white/10 px-2 py-0.5 text-slate-200">
                {m.name}
              </span>
            ))}
            {self && self.team !== null && (
              <button type="button" onClick={() => session.requestTeam(null)} className="ml-auto text-xs uppercase tracking-widest text-slate-400 hover:text-white">
                Bench pe baitho
              </button>
            )}
          </div>
        </Panel>
        <div className="sticky bottom-0 z-20 -mx-3 bg-gradient-to-t from-void via-void/95 to-transparent px-3 pb-3 pt-8 sm:-mx-6 sm:px-6">
          {ui.isHost ? (
            <NeonButton wide disabled={!check.ok} onClick={() => session.startMatch()} className="py-4 text-base">
              {check.ok ? "▶ Match Start Karo" : check.reason}
            </NeonButton>
          ) : (
            <div className="glass clip-corner py-4 text-center font-display text-sm uppercase tracking-[0.25em] text-cyan-200">
              Host ke start ka intezaar… <span className="animate-pulse">●</span>
            </div>
          )}
        </div>
      </div>
      <Toast text={ui.notice} />
    </main>
  );
};
