import type { LobbyState, SessionError, SessionStatus, TransportKind } from "@/types/net";
import type { FeedItem, HudState } from "@/types/render";

export interface UiState {
  status: SessionStatus;
  error: SessionError | null;
  isPractice: boolean;
  transportKind: TransportKind;
  selfPeerId: string;
  selfClientId: string;
  isHost: boolean;
  lobby: LobbyState | null;
  hud: HudState | null;
  feed: FeedItem[];
  ping: number | null;
  notice: string | null;
  paused: boolean;
  weakConnection: boolean;
}
