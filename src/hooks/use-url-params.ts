"use client";

import { useSyncExternalStore } from "react";
import { TransportKind } from "@/types/net";
import { normalizeRoomCode } from "@/net/room-code";

const subscribe = (listener: () => void) => {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
};

const readRoom = () => normalizeRoomCode(new URLSearchParams(window.location.search).get("room") ?? "");
const readNet = () =>
  new URLSearchParams(window.location.search).get("net") === "local" ? TransportKind.Local : TransportKind.Online;

/** Room code from an invite link (?room=ABCDE), or "". */
export const useRoomParam = (): string => useSyncExternalStore(subscribe, readRoom, () => "");

/** ?net=local switches to the same-browser test network. */
export const useTransportKind = (): TransportKind => useSyncExternalStore(subscribe, readNet, () => TransportKind.Online);

export const setRoomParam = (code: string | null): void => {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set("room", code);
  else url.searchParams.delete("room");
  window.history.replaceState(null, "", url.toString());
};
