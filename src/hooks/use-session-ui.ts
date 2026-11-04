"use client";

import { useSyncExternalStore } from "react";
import type { RoomSession } from "@/net/room-session";
import type { UiState } from "@/types/session";
import { INITIAL_UI_STATE } from "@/net/ui-store";

const NOOP_SUBSCRIBE = () => () => undefined;
const INITIAL = () => INITIAL_UI_STATE;

/** Subscribes a component to the session's UI state. */
export const useSessionUi = (session: RoomSession | null): UiState =>
  useSyncExternalStore(session ? session.subscribe : NOOP_SUBSCRIBE, session ? session.getUi : INITIAL, INITIAL);
