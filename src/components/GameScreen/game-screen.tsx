"use client";

import { useEffect, useMemo, useState } from "react";
import { GameEventKind, GameMode } from "@/types/game";
import { LobbyStatus } from "@/types/net";
import type { UiState } from "@/types/session";
import type { RoomSession } from "@/net/room-session";
import type { SoundEngine } from "@/audio/sound-engine";
import { InputController } from "@/input/input-controller";
import { useIsTouch, useNow } from "@/hooks/use-device";
import { HowToPlay } from "@/components/HomeScreen/how-to-play";
import { FeedList } from "@/components/GameScreen/feed-list";
import { GameCanvas } from "@/components/GameScreen/game-canvas";
import { PauseMenu } from "@/components/GameScreen/pause-menu";
import { PhaseOverlay } from "@/components/GameScreen/phase-overlay";
import { Scoreboard } from "@/components/GameScreen/scoreboard";
import { SummaryOverlay } from "@/components/GameScreen/summary-overlay";
import { Toast } from "@/components/GameScreen/toast";
import { TouchControls } from "@/components/GameScreen/touch-controls";
import { TwistHud } from "@/components/GameScreen/twist-hud";

const TOP_INSET = 64;

interface GameScreenProps {
  session: RoomSession;
  ui: UiState;
  sound: SoundEngine;
  muted: boolean;
  onToggleMute: () => void;
  onLeave: () => void;
}

export const GameScreen = ({ session, ui, sound, muted, onToggleMute, onLeave }: GameScreenProps) => {
  const input = useMemo(() => new InputController(), []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const isTouch = useIsTouch();
  const now = useNow(250);
  const lobby = ui.lobby;
  const mode = lobby?.settings.mode ?? GameMode.Duo;
  const selfEntry = lobby?.roster.find((r) => r.id === ui.selfClientId);
  const selfTeam = selfEntry?.team ?? null;
  const lastGoal = [...ui.feed].reverse().find((f) => f.kind === GameEventKind.Goal) ?? null;

  useEffect(() => input.attach(window, () => setMenuOpen((open) => !open)), [input]);

  useEffect(() => {
    if (ui.isPractice) session.setPaused(menuOpen || helpOpen);
  }, [session, ui.isPractice, menuOpen, helpOpen]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && ui.isPractice) setMenuOpen(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [ui.isPractice]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-void" onPointerDown={() => sound.unlock()} onKeyDown={() => sound.unlock()}>
      <GameCanvas session={session} input={input} sound={sound} mode={mode} selfId={ui.selfClientId} selfTeam={selfTeam} topInset={TOP_INSET} />
      {ui.hud && (
        <Scoreboard
          hud={ui.hud}
          mode={mode}
          ping={ui.ping}
          weak={ui.weakConnection}
          isPractice={ui.isPractice}
          muted={muted}
          onMenu={() => setMenuOpen(true)}
          onToggleMute={onToggleMute}
        />
      )}
      {ui.hud && <PhaseOverlay hud={ui.hud} lastGoal={lastGoal} showKeys={!isTouch} />}
      {ui.hud && <TwistHud hud={ui.hud} />}
      <FeedList feed={ui.feed} now={now} />
      {!selfEntry && lobby?.status === LobbyStatus.Playing && (
        <p className="pointer-events-none absolute inset-x-0 bottom-4 z-20 text-center font-display text-xs uppercase tracking-[0.3em] text-slate-400">
          👀 Spectator mode — agla match mein khel paoge
        </p>
      )}
      {isTouch && selfEntry && <TouchControls input={input} dashReady={ui.hud?.selfDashReady ?? 1} onFirstTouch={() => sound.unlock()} />}
      {ui.weakConnection && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-30 text-center">
          <span className="glass px-4 py-1.5 font-display text-xs uppercase tracking-widest text-amber-200">Connection weak… ruk ke dekho</span>
        </div>
      )}
      <Toast text={ui.notice} />
      {lobby?.status === LobbyStatus.Summary && lobby.summary && (
        <SummaryOverlay
          summary={lobby.summary}
          selfId={ui.selfClientId}
          selfTeam={selfTeam}
          isHost={ui.isHost}
          isPractice={ui.isPractice}
          onRematch={() => session.startMatch()}
          onLobby={() => session.backToLobby()}
          onLeave={onLeave}
        />
      )}
      {menuOpen && (
        <PauseMenu
          isPractice={ui.isPractice}
          muted={muted}
          onResume={() => setMenuOpen(false)}
          onToggleMute={onToggleMute}
          onHelp={() => setHelpOpen(true)}
          onLeave={onLeave}
        />
      )}
      <HowToPlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
};
