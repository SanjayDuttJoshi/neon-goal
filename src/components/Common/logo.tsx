interface LogoProps {
  size?: "lg" | "sm";
}

export const Logo = ({ size = "lg" }: LogoProps) => (
  <div className="select-none text-center">
    <h1
      className={`font-display font-black uppercase italic leading-none tracking-[0.12em] text-cyan-200 animate-glow-pulse ${
        size === "lg" ? "text-[clamp(2rem,11.5vw,3rem)] sm:text-7xl" : "text-2xl"
      }`}
    >
      Neon<span className="text-fuchsia-300">Goal</span>
      {size === "lg" && <sup className="ml-2 hidden align-super font-display text-xl not-italic tracking-widest text-amber-300 sm:inline">V2</sup>}
    </h1>
    {size === "lg" && (
      <p className="mt-3 font-body text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 sm:text-base sm:tracking-[0.45em]">
        Trail se maaro · Goal karo
      </p>
    )}
    {size === "lg" && (
      <p className="mt-2 font-display text-xs uppercase tracking-[0.3em] text-amber-300 sm:hidden">V2 · Red ball + Events</p>
    )}
  </div>
);
