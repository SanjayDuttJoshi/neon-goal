import { Modal } from "@/components/Common/modal";

interface HowToPlayProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  { icon: "🏃", title: "Chalo, line banao", text: "Tum jahan chalte ho, peeche neon line banti hai jo ~1.5 sec rehti hai." },
  { icon: "⚽", title: "Ball line se bounce", text: "Ball kisi bhi line se takra ke tez bounce hoti hai. Tirchhi line = ramp, seedhi line = deewar." },
  { icon: "⚡", title: "Dash = power shot", text: "Dash se lambi chamakti line banti hai — ball goli ki tarah udti hai. Cooldown 2 sec." },
  { icon: "🧊", title: "Dushman ko slow karo", text: "Opponent tumhari line cross kare toh thodi der slow ho jaata hai." },
];

export const HowToPlay = ({ open, onClose }: HowToPlayProps) => (
  <Modal open={open} onClose={onClose} title="Kaise Khelein">
    <ol className="space-y-3">
      {STEPS.map((step, i) => (
        <li key={step.title} className="flex gap-3 animate-float-up" style={{ animationDelay: `${i * 70}ms` }}>
          <span className="text-2xl" aria-hidden>
            {step.icon}
          </span>
          <div>
            <p className="font-display text-sm font-bold uppercase tracking-wider text-cyan-200">{step.title}</p>
            <p className="text-[15px] leading-snug text-slate-300">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
    <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm text-slate-300">
      <div>
        <p className="font-display text-[11px] uppercase tracking-widest text-slate-500">Keyboard</p>
        <p>WASD / Arrows — chalo</p>
        <p>Space / Shift — Dash</p>
        <p>Esc — Menu</p>
      </div>
      <div>
        <p className="font-display text-[11px] uppercase tracking-widest text-slate-500">Phone / Controller</p>
        <p>Left side — joystick</p>
        <p>Right side tap — Dash</p>
        <p>Gamepad bhi chalta hai 🎮</p>
      </div>
    </div>
  </Modal>
);
