import { SessionStatus, TransportKind } from "@/types/net";
import type { UiState } from "@/types/session";

export const INITIAL_UI_STATE: UiState = {
  status: SessionStatus.Idle,
  error: null,
  isPractice: false,
  transportKind: TransportKind.Online,
  selfPeerId: "",
  selfClientId: "",
  isHost: false,
  lobby: null,
  hud: null,
  feed: [],
  ping: null,
  notice: null,
  paused: false,
  weakConnection: false,
};

type Listener = () => void;

/** Tiny external store consumed by React through useSyncExternalStore. */
export class UiStore {
  private state: UiState;
  private readonly listeners = new Set<Listener>();

  constructor(initial: UiState) {
    this.state = initial;
  }

  get = (): UiState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(patch: Partial<UiState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}
