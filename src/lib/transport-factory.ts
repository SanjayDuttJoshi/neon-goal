import { TransportKind } from "@/types/net";
import type { Transport } from "@/net/transport";
import { createLocalTransport } from "@/net/local-transport";
import { createOfflineTransport } from "@/net/transport";

/** Builds the network layer for a room. Online uses free public Nostr relays + WebRTC. */
export const makeTransport = async (kind: TransportKind, roomCode: string): Promise<Transport> => {
  if (kind === TransportKind.Local) return createLocalTransport(roomCode);
  if (kind === TransportKind.Offline) return createOfflineTransport();
  const { createTrysteroTransport } = await import("@/net/trystero-transport");
  return createTrysteroTransport(roomCode);
};
