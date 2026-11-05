import { ArenaEventKind, ArenaEventStage, GameEventKind, type ArenaEventState, type SimState } from "@/types/game";
import {
  ARENA_EVENT_GAP_MAX,
  ARENA_EVENT_GAP_MIN,
  ARENA_EVENT_ORDER,
  ARENA_EVENT_SECONDS,
  ARENA_FIRST_EVENT_SECONDS,
  ARENA_WARNING_SECONDS,
} from "@/game/constants";
import { pushEvent } from "@/game/events";
import { isRed } from "@/game/red-ball";
import { nextRandom } from "@/game/vector";

/** Retry soon when an event is due while the ball is red, so two dangers never stack. */
const RED_BALL_RETRY_SECONDS = 2;

export const createArenaEventState = (): ArenaEventState => ({
  kind: null,
  stage: ArenaEventStage.Idle,
  timer: 0,
  nextIn: ARENA_FIRST_EVENT_SECONDS,
  lastKind: null,
});

const roll = (state: SimState): number => {
  const [value, next] = nextRandom(state.rngState);
  state.rngState = next;
  return value;
};

export const kindIndex = (kind: ArenaEventKind | null): number => (kind ? ARENA_EVENT_ORDER.indexOf(kind) : -1);

const pickKind = (state: SimState): ArenaEventKind => {
  const choices = ARENA_EVENT_ORDER.filter((kind) => kind !== state.arenaEvent.lastKind);
  return choices[Math.floor(roll(state) * choices.length) % choices.length];
};

export const isArenaEventActive = (state: SimState, kind: ArenaEventKind): boolean =>
  state.arenaEvent.stage === ArenaEventStage.Active && state.arenaEvent.kind === kind;

/** Runs the event schedule; only called while the ball is in play. */
export const tickArenaEvents = (state: SimState, dt: number): void => {
  if (!state.config.arenaEvents) return;
  const ev = state.arenaEvent;
  if (ev.stage === ArenaEventStage.Idle) {
    ev.nextIn -= dt;
    if (ev.nextIn > 0) return;
    if (isRed(state.ball)) {
      ev.nextIn = RED_BALL_RETRY_SECONDS;
      return;
    }
    ev.kind = pickKind(state);
    ev.stage = ArenaEventStage.Warning;
    ev.timer = ARENA_WARNING_SECONDS;
    pushEvent(state, { kind: GameEventKind.ArenaWarn, value: kindIndex(ev.kind) });
    return;
  }
  ev.timer -= dt;
  if (ev.timer > 0 || !ev.kind) return;
  if (ev.stage === ArenaEventStage.Warning) {
    ev.stage = ArenaEventStage.Active;
    ev.timer = ARENA_EVENT_SECONDS[ev.kind];
    pushEvent(state, { kind: GameEventKind.ArenaStart, value: kindIndex(ev.kind) });
    return;
  }
  pushEvent(state, { kind: GameEventKind.ArenaEnd, value: kindIndex(ev.kind) });
  ev.lastKind = ev.kind;
  ev.kind = null;
  ev.stage = ArenaEventStage.Idle;
  ev.timer = 0;
  ev.nextIn = ARENA_EVENT_GAP_MIN + roll(state) * (ARENA_EVENT_GAP_MAX - ARENA_EVENT_GAP_MIN);
};
