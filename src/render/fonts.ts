export interface CanvasFonts {
  body: string;
  display: string;
}

let cached: CanvasFonts | null = null;

/** Canvas can't read CSS variables, so resolve the next/font family names once. */
export const canvasFonts = (): CanvasFonts => {
  if (cached) return cached;
  if (typeof document === "undefined") return { body: "system-ui", display: "system-ui" };
  const css = getComputedStyle(document.documentElement);
  const body = css.getPropertyValue("--font-rajdhani").trim();
  const display = css.getPropertyValue("--font-orbitron").trim();
  if (!body || !display) return { body: "system-ui, sans-serif", display: "system-ui, sans-serif" };
  cached = { body: `${body}, system-ui, sans-serif`, display: `${display}, system-ui, sans-serif` };
  return cached;
};
