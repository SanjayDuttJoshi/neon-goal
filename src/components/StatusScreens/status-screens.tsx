import { SessionError } from "@/types/net";
import { ButtonVariant } from "@/types/ui";
import { MenuBackground } from "@/components/Common/menu-background";
import { NeonButton } from "@/components/Common/neon-button";
import { Panel } from "@/components/Common/panel";

const ERROR_TEXT: Record<SessionError, { title: string; body: string }> = {
  [SessionError.RoomNotFound]: {
    title: "Room nahi mila",
    body: "Code check karo, ya host se pucho ki room abhi khula hai ya nahi. Kabhi kabhi network slow hota hai — ek baar aur try karo.",
  },
  [SessionError.VersionMismatch]: {
    title: "Purana version",
    body: "Tumhara aur host ka game version alag hai. Page refresh karo (dono log).",
  },
  [SessionError.Kicked]: { title: "Room se nikaal diya", body: "Host ne tumhe is room se hata diya." },
  [SessionError.ConnectionFailed]: {
    title: "Connection nahi bana",
    body: "Internet check karo. Kuch networks (office/college WiFi) direct connection block karte hain — mobile data ya hotspot try karo.",
  },
  [SessionError.HostLeft]: { title: "Host chala gaya", body: "Room band ho gaya. Naya room banao aur dosto ko code bhejo." },
  [SessionError.InvalidCode]: { title: "Galat code", body: "Room code 5 letters ka hota hai, jaise K7QX2." },
};

interface ConnectingScreenProps {
  code: string;
  onCancel: () => void;
}

export const ConnectingScreen = ({ code, onCancel }: ConnectingScreenProps) => (
  <main className="relative flex min-h-dvh items-center justify-center px-4">
    <MenuBackground />
    <Panel className="relative z-10 w-full max-w-sm text-center animate-pop-in">
      <div className="mx-auto mb-5 h-14 w-14 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
      <p className="font-display text-sm uppercase tracking-[0.3em] text-cyan-200">Connect ho raha hai</p>
      {code && <p className="mt-2 font-mono text-2xl tracking-[0.4em] text-white">{code}</p>}
      <p className="mt-3 text-sm text-slate-400">Dosto se direct (peer-to-peer) connection ban raha hai…</p>
      <NeonButton variant={ButtonVariant.Ghost} className="mt-5" onClick={onCancel}>
        Cancel
      </NeonButton>
    </Panel>
  </main>
);

interface ErrorScreenProps {
  error: SessionError | null;
  onRetry: (() => void) | null;
  onHome: () => void;
}

export const ErrorScreen = ({ error, onRetry, onHome }: ErrorScreenProps) => {
  const text = ERROR_TEXT[error ?? SessionError.ConnectionFailed];
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4">
      <MenuBackground />
      <Panel className="relative z-10 w-full max-w-md text-center animate-pop-in">
        <p className="text-4xl" aria-hidden>
          ⚠️
        </p>
        <h2 className="mt-3 font-display text-xl font-bold uppercase tracking-[0.2em] text-rose-200">{text.title}</h2>
        <p className="mt-3 text-slate-300">{text.body}</p>
        <div className="mt-6 flex justify-center gap-3">
          {onRetry && <NeonButton onClick={onRetry}>Dobara try</NeonButton>}
          <NeonButton variant={ButtonVariant.Secondary} onClick={onHome}>
            Home
          </NeonButton>
        </div>
      </Panel>
    </main>
  );
};
