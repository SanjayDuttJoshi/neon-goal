import { SoundKind } from "@/types/audio";
import { synthesize } from "@/audio/synth";

const MIN_REPEAT_MS = 45;
const MASTER_VOLUME = 0.55;

type AudioContextCtor = typeof AudioContext;

const audioContextCtor = (): AudioContextCtor | null => {
  if (typeof window === "undefined") return null;
  const legacy = (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  return window.AudioContext ?? legacy ?? null;
};

/** All sounds are synthesised on the fly with Web Audio: no audio files to host. */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private readonly lastPlayed = new Map<SoundKind, number>();

  /** Must run inside a user gesture the first time (browser autoplay rules). */
  unlock(): void {
    const Ctor = audioContextCtor();
    if (!Ctor) return;
    if (!this.ctx) {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(this.ctx);
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => undefined);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.02);
  }

  isMuted(): boolean {
    return this.muted;
  }

  play(kind: SoundKind, intensity = 1): void {
    if (this.muted || !this.ctx || !this.master || !this.noise || this.ctx.state !== "running") return;
    const now = performance.now();
    if (kind !== SoundKind.Goal && now - (this.lastPlayed.get(kind) ?? 0) < MIN_REPEAT_MS) return;
    this.lastPlayed.set(kind, now);
    synthesize(this.ctx, this.master, this.noise, kind, Math.max(0.2, Math.min(1.5, intensity)));
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}

export const vibrate = (pattern: number | number[]): void => {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    // Vibration is optional.
  }
};
