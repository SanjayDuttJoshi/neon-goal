/** 125.3 -> "2:06" (rounded up so the clock never shows 0:00 while time is left). */
export const formatClock = (seconds: number): string => {
  const total = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};
