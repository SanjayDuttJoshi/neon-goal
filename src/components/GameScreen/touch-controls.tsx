"use client";

import { useRef, useState, type PointerEvent } from "react";
import type { InputController } from "@/input/input-controller";

const STICK_RADIUS = 56;

interface StickState {
  id: number;
  ox: number;
  oy: number;
  kx: number;
  ky: number;
}

interface TouchControlsProps {
  input: InputController;
  dashReady: number;
  onFirstTouch: () => void;
}

/** Floating joystick on the left half of the screen, tap anywhere on the right to dash. */
export const TouchControls = ({ input, dashReady, onFirstTouch }: TouchControlsProps) => {
  const [stick, setStick] = useState<StickState | null>(null);
  const [dashFlash, setDashFlash] = useState(false);
  const stickRef = useRef<StickState | null>(null);

  const updateStick = (next: StickState | null) => {
    stickRef.current = next;
    setStick(next);
    if (!next) {
      input.setStick(0, 0);
      return;
    }
    input.setStick((next.kx - next.ox) / STICK_RADIUS, (next.ky - next.oy) / STICK_RADIUS);
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    onFirstTouch();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < rect.width * 0.5 && !stickRef.current) {
      e.currentTarget.setPointerCapture(e.pointerId);
      updateStick({ id: e.pointerId, ox: x, oy: y, kx: x, ky: y });
      return;
    }
    input.dash();
    setDashFlash(true);
    setTimeout(() => setDashFlash(false), 140);
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const current = stickRef.current;
    if (!current || current.id !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let dx = e.clientX - rect.left - current.ox;
    let dy = e.clientY - rect.top - current.oy;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    updateStick({ ...current, kx: current.ox + dx, ky: current.oy + dy });
  };

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (stickRef.current?.id === e.pointerId) updateStick(null);
  };

  const ready = Math.max(0, Math.min(1, dashReady));
  return (
    <div
      className="absolute inset-x-0 bottom-0 top-14 z-10 touch-none select-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {stick ? (
        <div className="pointer-events-none absolute" style={{ left: stick.ox - STICK_RADIUS, top: stick.oy - STICK_RADIUS }}>
          <div className="h-28 w-28 rounded-full border-2 border-cyan-300/40 bg-cyan-400/10" />
          <div
            className="absolute h-12 w-12 rounded-full bg-cyan-300/70 shadow-[0_0_24px_#22d3ee]"
            style={{ left: stick.kx - stick.ox + STICK_RADIUS - 24, top: stick.ky - stick.oy + STICK_RADIUS - 24 }}
          />
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-8 left-8 h-24 w-24 rounded-full border-2 border-dashed border-cyan-300/25 opacity-70" />
      )}
      <div className="pointer-events-none absolute bottom-6 right-6 flex h-24 w-24 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(244,114,182,0.2)" strokeWidth="6" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="#f472b6" strokeWidth="6" strokeDasharray={`${276 * ready} 276`} strokeLinecap="round" />
        </svg>
        <span className={`font-display text-sm font-black uppercase tracking-widest transition-transform ${dashFlash ? "scale-125 text-white" : ready >= 1 ? "text-fuchsia-200" : "text-slate-500"}`}>
          Dash
        </span>
      </div>
    </div>
  );
};
