interface LogoProps {
  size?: "lg" | "sm";
}

export const Logo = ({ size = "lg" }: LogoProps) => (
  <div className="select-none text-center">
    <h1
      className={`font-display font-black uppercase italic leading-none tracking-[0.12em] text-cyan-200 animate-glow-pulse ${
        size === "lg" ? "text-5xl sm:text-7xl" : "text-2xl"
      }`}
    >
      Neon<span className="text-fuchsia-300">Goal</span>
    </h1>
    {size === "lg" && (
      <p className="mt-3 font-body text-sm font-semibold uppercase tracking-[0.45em] text-slate-400 sm:text-base">
        Trail se maaro · Goal karo
      </p>
    )}
  </div>
);
