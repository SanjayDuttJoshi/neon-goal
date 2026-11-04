const HEX_CACHE = new Map<string, [number, number, number]>();

const parseHex = (hex: string): [number, number, number] => {
  const cached = HEX_CACHE.get(hex);
  if (cached) return cached;
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join("") : clean;
  const value = Number.parseInt(full, 16);
  const rgb: [number, number, number] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  HEX_CACHE.set(hex, rgb);
  return rgb;
};

/** "#22d3ee" + alpha -> "rgba(34, 211, 238, a)". Non-hex colors pass through. */
export const withAlpha = (color: string, alpha: number): string => {
  if (!color.startsWith("#")) return color;
  const [r, g, b] = parseHex(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Mixes a color towards white, t in [0, 1]. */
export const lighten = (color: string, t: number): string => {
  const [r, g, b] = parseHex(color);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
};
