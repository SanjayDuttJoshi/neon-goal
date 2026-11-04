"use client";

import { useEffect, useRef } from "react";
import { GameMode, MatchPhase } from "@/types/game";
import { SoundKind } from "@/types/audio";
import type { RoomSession } from "@/net/room-session";
import type { InputController } from "@/input/input-controller";
import type { SoundEngine } from "@/audio/sound-engine";
import { playEventSounds } from "@/audio/event-sounds";
import { NeonRenderer } from "@/render/renderer";
import { publishProbe } from "@/lib/debug-probe";

interface GameCanvasProps {
  session: RoomSession;
  input: InputController;
  sound: SoundEngine;
  mode: GameMode;
  selfId: string;
  selfTeam: number | null;
  topInset: number;
}

/** Owns the canvas and the per-frame loop: input -> session -> renderer -> sounds. */
export const GameCanvas = ({ session, input, sound, mode, selfId, selfTeam, topInset }: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optionsRef = useRef({ mode, selfId, selfTeam, topInset });
  useEffect(() => {
    optionsRef.current = { mode, selfId, selfTeam, topInset };
  }, [mode, selfId, selfTeam, topInset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new NeonRenderer(canvas);
    const resize = () => renderer.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    let raf = 0;
    let lastCount = -1;
    let lastPhase: MatchPhase | null = null;
    const loop = (now: number) => {
      const opts = optionsRef.current;
      const raw = input.read();
      const dir = renderer.camera.screenDirToWorld(raw.sx, raw.sy);
      session.setInput({ mx: dir.x, my: dir.y, dash: raw.dash });
      const { frame, effects } = session.frame(now);
      renderer.render(frame, effects, now, {
        mode: opts.mode,
        selfTeam: opts.selfTeam,
        insets: { top: opts.topInset, bottom: 10, side: 10 },
      });
      publishProbe(frame, renderer.camera, opts.selfTeam, opts.mode, now);
      playEventSounds(sound, effects, opts.selfId);
      if (frame) {
        if (frame.phase === MatchPhase.Countdown) {
          const count = Math.ceil(frame.phaseTimer);
          if (count !== lastCount && count > 0 && count <= 3) sound.play(SoundKind.Beep);
          lastCount = count;
        } else if (lastPhase === MatchPhase.Countdown && frame.phase === MatchPhase.Playing) {
          sound.play(SoundKind.Go);
          lastCount = -1;
        }
        lastPhase = frame.phase;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [session, input, sound]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none select-none" aria-label="Game arena" />;
};
