"use client";

import { useState } from "react";
import { ButtonVariant } from "@/types/ui";
import { NeonButton } from "@/components/Common/neon-button";
import { buildInviteLink } from "@/net/room-code";

interface InviteCardProps {
  code: string;
}

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const InviteCard = ({ code }: InviteCardProps) => {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const link = typeof window === "undefined" ? "" : buildInviteLink(window.location.origin, window.location.pathname, code);
  const message = `⚡ NEON GOAL khelne aao! Room code: ${code}\n${link}`;
  const flash = (what: "code" | "link") => {
    setCopied(what);
    setTimeout(() => setCopied(null), 1600);
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "NEON GOAL", text: message, url: link });
        return;
      } catch {
        // User cancelled the share sheet; fall back to copying.
      }
    }
    if (await copyText(message)) flash("link");
  };
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <button
        type="button"
        onClick={async () => (await copyText(code)) && flash("code")}
        className="group text-center sm:text-left"
        aria-label={`Room code ${code}, click to copy`}
      >
        <span className="block font-display text-[10px] uppercase tracking-[0.35em] text-slate-400">Room code</span>
        <span className="font-mono text-4xl font-bold tracking-[0.35em] text-fuchsia-200 neon-text group-hover:text-white">{code}</span>
        <span className="block h-4 text-xs text-lime-300">{copied === "code" ? "Copied!" : ""}</span>
      </button>
      <div className="flex flex-wrap justify-center gap-2">
        <NeonButton variant={ButtonVariant.Secondary} onClick={async () => (await copyText(link)) && flash("link")}>
          {copied === "link" ? "✓ Copied" : "🔗 Link copy"}
        </NeonButton>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="clip-corner inline-flex items-center gap-2 border border-emerald-300/40 bg-emerald-400/10 px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.18em] text-emerald-200 hover:bg-emerald-400/20"
        >
          WhatsApp
        </a>
        <NeonButton variant={ButtonVariant.Ghost} onClick={share} aria-label="Share">
          Share
        </NeonButton>
      </div>
    </div>
  );
};
