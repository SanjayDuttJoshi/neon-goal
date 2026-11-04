import type { GameEvent, GameEventKind, SimState } from "@/types/game";

export interface EventInput {
  kind: GameEventKind;
  x?: number;
  y?: number;
  team?: number;
  playerId?: string;
  otherId?: string;
  value?: number;
}

const MAX_PENDING_EVENTS = 64;

export const pushEvent = (state: SimState, input: EventInput): GameEvent => {
  const event: GameEvent = {
    id: state.nextEventId,
    kind: input.kind,
    x: input.x ?? 0,
    y: input.y ?? 0,
    team: input.team ?? -1,
    playerId: input.playerId ?? "",
    otherId: input.otherId ?? "",
    value: input.value ?? 0,
  };
  state.nextEventId += 1;
  state.events.push(event);
  if (state.events.length > MAX_PENDING_EVENTS) {
    state.events.splice(0, state.events.length - MAX_PENDING_EVENTS);
  }
  return event;
};

export const drainEvents = (state: SimState): GameEvent[] => {
  const drained = state.events;
  state.events = [];
  return drained;
};
