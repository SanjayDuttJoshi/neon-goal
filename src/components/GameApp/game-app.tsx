"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SessionStatus, type LobbySettings } from "@/types/net";
import { SoundKind } from "@/types/audio";
import { RoomSession } from "@/net/room-session";
import { DEFAULT_SETTINGS } from "@/net/lobby";
import { SoundEngine } from "@/audio/sound-engine";
import { makeTransport } from "@/lib/transport-factory";
import { getActiveRoom, getClientId, getMuted, getSavedName, randomGuestName, saveActiveRoom, saveMuted, saveName } from "@/lib/storage";
import { useSessionUi } from "@/hooks/use-session-ui";
import { setRoomParam, useRoomParam, useTransportKind } from "@/hooks/use-url-params";
import { HomeScreen } from "@/components/HomeScreen/home-screen";
import { LobbyScreen } from "@/components/LobbyScreen/lobby-screen";
import { GameScreen } from "@/components/GameScreen/game-screen";
import { ConnectingScreen, ErrorScreen } from "@/components/StatusScreens/status-screens";

/** Top-level state machine: home -> connecting -> lobby -> match. */
export const GameApp = () => {
  const [session, setSession] = useState<RoomSession | null>(null);
  const [name, setName] = useState("");
  const [muted, setMuted] = useState(false);
  const [lastCode, setLastCode] = useState("");
  const [sound] = useState(() => new SoundEngine());
  const ui = useSessionUi(session);
  const inviteCode = useRoomParam();
  const transportKind = useTransportKind();

  useEffect(() => {
    const saved = getSavedName();
    const initialMuted = getMuted();
    queueMicrotask(() => {
      setName(saved || randomGuestName());
      setMuted(initialMuted);
    });
    sound.setMuted(initialMuted);
  }, [sound]);

  useEffect(() => {
    const leave = () => session?.leave();
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [session]);

  const roomCode = ui.lobby?.roomCode;
  useEffect(() => {
    if (!roomCode || ui.isPractice) return;
    setRoomParam(roomCode);
    saveActiveRoom(roomCode);
  }, [roomCode, ui.isPractice]);

  useEffect(() => {
    if (ui.status === SessionStatus.Error) saveActiveRoom(null);
  }, [ui.status]);

  const begin = useCallback(
    (playerName: string, start: (s: RoomSession) => void) => {
      sound.unlock();
      sound.play(SoundKind.Click);
      saveName(playerName);
      session?.leave();
      const next = new RoomSession(getClientId(), makeTransport);
      setSession(next);
      start(next);
    },
    [session, sound],
  );

  const create = () => begin(name, (s) => void s.hostRoom(name, transportKind, DEFAULT_SETTINGS));
  const join = useCallback(
    (code: string, playerName: string) => {
      setLastCode(code);
      begin(playerName, (s) => void s.joinRoom(playerName, transportKind, code));
    },
    [begin, transportKind],
  );

  // A refresh in the middle of a room lands back in it (same tab keeps the same player slot).
  const autoRejoinDone = useRef(false);
  useEffect(() => {
    if (autoRejoinDone.current || !inviteCode) return;
    autoRejoinDone.current = true;
    if (session || getActiveRoom() !== inviteCode) return;
    queueMicrotask(() => join(inviteCode, getSavedName() || randomGuestName()));
  }, [inviteCode, join, session]);
  const practice = (settings: LobbySettings) => begin(name, (s) => s.startPractice(name, settings));
  const leave = () => {
    session?.leave();
    setSession(null);
    setRoomParam(null);
    saveActiveRoom(null);
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    saveMuted(next);
    sound.setMuted(next);
  };

  if (!session || ui.status === SessionStatus.Idle) {
    return <HomeScreen name={name} onNameChange={setName} inviteCode={inviteCode} onCreate={create} onJoin={(code) => join(code, name)} onPractice={practice} />;
  }
  if (ui.status === SessionStatus.Connecting) return <ConnectingScreen code={lastCode} onCancel={leave} />;
  if (ui.status === SessionStatus.Error) {
    return <ErrorScreen error={ui.error} onRetry={lastCode ? () => join(lastCode, name || getSavedName()) : null} onHome={leave} />;
  }
  if (ui.status === SessionStatus.Lobby) return <LobbyScreen session={session} ui={ui} onLeave={leave} />;
  return <GameScreen session={session} ui={ui} sound={sound} muted={muted} onToggleMute={toggleMute} onLeave={leave} />;
};
