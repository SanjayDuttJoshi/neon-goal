import { SoundKind } from "@/types/audio";

interface ToneSpec {
  type: OscillatorType;
  from: number;
  to: number;
  duration: number;
  gain: number;
  delay?: number;
}

const tone = (ctx: AudioContext, out: AudioNode, spec: ToneSpec): void => {
  const start = ctx.currentTime + (spec.delay ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.from, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.to), start + spec.duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(spec.gain, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + spec.duration);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + spec.duration + 0.02);
};

interface NoiseSpec {
  filter: BiquadFilterType;
  from: number;
  to: number;
  duration: number;
  gain: number;
  q?: number;
}

const noiseBurst = (ctx: AudioContext, out: AudioNode, noise: AudioBuffer, spec: NoiseSpec): void => {
  const start = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = spec.filter;
  filter.Q.value = spec.q ?? 1;
  filter.frequency.setValueAtTime(spec.from, start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to), start + spec.duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(spec.gain, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + spec.duration);
  src.connect(filter).connect(gain).connect(out);
  src.start(start, Math.random() * 0.5);
  src.stop(start + spec.duration + 0.02);
};

const GOAL_CHORD = [523.25, 659.25, 783.99, 1046.5];

export const synthesize = (ctx: AudioContext, out: AudioNode, noise: AudioBuffer, kind: SoundKind, k: number): void => {
  switch (kind) {
    case SoundKind.Bounce:
      tone(ctx, out, { type: "sine", from: 620 + k * 200, to: 980 + k * 300, duration: 0.11, gain: 0.22 });
      tone(ctx, out, { type: "triangle", from: 1240, to: 1500, duration: 0.06, gain: 0.06 });
      break;
    case SoundKind.Power:
      tone(ctx, out, { type: "sawtooth", from: 180, to: 1100, duration: 0.18, gain: 0.16 });
      noiseBurst(ctx, out, noise, { filter: "bandpass", from: 3000, to: 600, duration: 0.25, gain: 0.35, q: 2 });
      break;
    case SoundKind.Wall:
      tone(ctx, out, { type: "triangle", from: 160, to: 80, duration: 0.12, gain: 0.18 * k });
      break;
    case SoundKind.Body:
      tone(ctx, out, { type: "sine", from: 320, to: 180, duration: 0.08, gain: 0.14 });
      break;
    case SoundKind.Dash:
      noiseBurst(ctx, out, noise, { filter: "highpass", from: 900, to: 4500, duration: 0.18, gain: 0.18 });
      break;
    case SoundKind.Slowed:
      tone(ctx, out, { type: "square", from: 140, to: 90, duration: 0.22, gain: 0.07 });
      break;
    case SoundKind.Save:
      tone(ctx, out, { type: "sine", from: 880, to: 880, duration: 0.12, gain: 0.15 });
      tone(ctx, out, { type: "sine", from: 1320, to: 1320, duration: 0.18, gain: 0.13, delay: 0.09 });
      break;
    case SoundKind.Goal:
      noiseBurst(ctx, out, noise, { filter: "lowpass", from: 1800, to: 60, duration: 0.9, gain: 0.7 });
      tone(ctx, out, { type: "sine", from: 120, to: 40, duration: 0.6, gain: 0.5 });
      GOAL_CHORD.forEach((freq, i) =>
        tone(ctx, out, { type: "square", from: freq, to: freq, duration: 0.22, gain: 0.06, delay: 0.12 + i * 0.09 }),
      );
      break;
    case SoundKind.Beep:
      tone(ctx, out, { type: "square", from: 520, to: 520, duration: 0.13, gain: 0.08 });
      break;
    case SoundKind.Go:
      tone(ctx, out, { type: "square", from: 880, to: 880, duration: 0.32, gain: 0.09 });
      tone(ctx, out, { type: "sine", from: 1760, to: 1760, duration: 0.32, gain: 0.05 });
      break;
    case SoundKind.Whistle:
      tone(ctx, out, { type: "sine", from: 2100, to: 1900, duration: 0.7, gain: 0.12 });
      tone(ctx, out, { type: "sine", from: 2140, to: 1940, duration: 0.7, gain: 0.08 });
      break;
    case SoundKind.Click:
      tone(ctx, out, { type: "triangle", from: 1400, to: 900, duration: 0.05, gain: 0.08 });
      break;
    case SoundKind.Siren:
      [0, 0.26].forEach((delay) => {
        tone(ctx, out, { type: "sawtooth", from: 620, to: 980, duration: 0.13, gain: 0.07, delay });
        tone(ctx, out, { type: "sawtooth", from: 980, to: 620, duration: 0.13, gain: 0.07, delay: delay + 0.13 });
      });
      break;
    case SoundKind.Burn:
      noiseBurst(ctx, out, noise, { filter: "lowpass", from: 2600, to: 90, duration: 0.65, gain: 0.55 });
      tone(ctx, out, { type: "sawtooth", from: 320, to: 50, duration: 0.5, gain: 0.14 });
      break;
    case SoundKind.Respawn:
      tone(ctx, out, { type: "sine", from: 380, to: 1250, duration: 0.28, gain: 0.12 });
      break;
    case SoundKind.Alarm:
      [0, 0.18, 0.36].forEach((delay) => tone(ctx, out, { type: "square", from: 760, to: 760, duration: 0.11, gain: 0.07, delay }));
      break;
    case SoundKind.Cool:
      noiseBurst(ctx, out, noise, { filter: "highpass", from: 6500, to: 1800, duration: 0.4, gain: 0.16 });
      break;
    case SoundKind.Chime:
      GOAL_CHORD.forEach((freq, i) => tone(ctx, out, { type: "triangle", from: freq * 2, to: freq * 2, duration: 0.25, gain: 0.06, delay: i * 0.06 }));
      break;
    default:
      break;
  }
};
