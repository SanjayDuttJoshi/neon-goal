import type { Channel } from "@/types/net";

export type MessageHandler = (data: unknown, peerId: string) => void;
export type PeerHandler = (peerId: string) => void;

/** Minimal peer-to-peer messaging surface the game needs. */
export interface Transport {
  readonly selfId: string;
  send: (channel: Channel, data: unknown, target?: string) => void;
  on: (channel: Channel, handler: MessageHandler) => void;
  onPeerJoin: (handler: PeerHandler) => void;
  onPeerLeave: (handler: PeerHandler) => void;
  onError: (handler: (message: string) => void) => void;
  peers: () => string[];
  ping: (peerId: string) => Promise<number>;
  leave: () => void;
}

/** Used for practice matches: nobody else is ever in the room. */
export const createOfflineTransport = (): Transport => ({
  selfId: "local-player",
  send: () => undefined,
  on: () => undefined,
  onPeerJoin: () => undefined,
  onPeerLeave: () => undefined,
  onError: () => undefined,
  peers: () => [],
  ping: async () => 0,
  leave: () => undefined,
});
