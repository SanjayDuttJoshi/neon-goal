"use client";

import { useState, type FormEvent } from "react";
import { ButtonVariant } from "@/types/ui";
import { NeonButton } from "@/components/Common/neon-button";
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from "@/net/room-code";

interface JoinPanelProps {
  initialCode: string;
  onJoin: (code: string) => void;
  onBack: () => void;
}

export const JoinPanel = ({ initialCode, onJoin, onBack }: JoinPanelProps) => {
  const [code, setCode] = useState(initialCode);
  const valid = isValidRoomCode(code);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) onJoin(code);
  };
  return (
    <form onSubmit={submit} className="space-y-4 animate-float-up">
      <label className="block">
        <span className="mb-1.5 block font-display text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400">Room code</span>
        <input
          value={code}
          onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
          placeholder="ABCDE"
          autoFocus={!initialCode}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={ROOM_CODE_LENGTH}
          aria-invalid={code.length === ROOM_CODE_LENGTH && !valid}
          className="clip-corner w-full border border-fuchsia-300/30 bg-black/40 px-4 py-3 text-center font-mono text-3xl font-bold tracking-[0.6em] text-fuchsia-100 outline-none focus:border-fuchsia-300/80"
        />
      </label>
      {code.length === ROOM_CODE_LENGTH && !valid && (
        <p className="text-sm text-rose-300">Code galat lag raha hai — sirf A-Z aur 2-9 hote hain.</p>
      )}
      <div className="flex gap-3">
        <NeonButton variant={ButtonVariant.Ghost} onClick={onBack}>
          ← Back
        </NeonButton>
        <NeonButton type="submit" wide disabled={!valid}>
          Join Karo
        </NeonButton>
      </div>
    </form>
  );
};
