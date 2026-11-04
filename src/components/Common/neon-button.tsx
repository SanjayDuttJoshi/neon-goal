import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ButtonVariant } from "@/types/ui";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  [ButtonVariant.Primary]:
    "bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.45)] hover:shadow-[0_0_38px_rgba(244,114,182,0.6)]",
  [ButtonVariant.Secondary]:
    "border border-cyan-300/40 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20 hover:border-cyan-300/70",
  [ButtonVariant.Ghost]: "text-slate-300 hover:text-white hover:bg-white/5",
  [ButtonVariant.Danger]: "border border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/25",
};

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
  wide?: boolean;
}

export const NeonButton = ({ variant = ButtonVariant.Primary, children, wide = false, className = "", ...rest }: NeonButtonProps) => (
  <button
    type="button"
    className={`clip-corner relative inline-flex select-none items-center justify-center gap-2 px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.18em] transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${VARIANT_CLASSES[variant]} ${wide ? "w-full" : ""} ${className}`}
    {...rest}
  >
    {children}
  </button>
);
