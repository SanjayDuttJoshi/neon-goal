"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const COARSE_QUERY = "(pointer: coarse)";

const subscribeCoarse = (listener: () => void) => {
  const query = window.matchMedia(COARSE_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};

/** True on phones/tablets where on-screen controls are needed. */
export const useIsTouch = (): boolean =>
  useSyncExternalStore(subscribeCoarse, () => window.matchMedia(COARSE_QUERY).matches, () => false);

/** performance.now(), refreshed every `intervalMs`. */
export const useNow = (intervalMs: number): number => {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};
