import type { ReactNode } from "react";

interface PanelProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export const Panel = ({ children, className = "", title }: PanelProps) => (
  <section className={`glass clip-corner relative p-5 sm:p-6 ${className}`}>
    {title && (
      <h2 className="mb-4 font-display text-xs font-bold uppercase tracking-[0.3em] text-cyan-300/90">{title}</h2>
    )}
    {children}
  </section>
);
