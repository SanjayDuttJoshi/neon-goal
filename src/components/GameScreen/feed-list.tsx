import type { FeedItem } from "@/types/render";
import { TEAM_COLORS } from "@/game/constants";

const VISIBLE_MS = 5000;
const MAX_VISIBLE = 3;

interface FeedListProps {
  feed: FeedItem[];
  now: number;
}

export const FeedList = ({ feed, now }: FeedListProps) => (
  // Phones: under the scoreboard, clear of the joystick, DASH button and your own goal.
  <ul className="pointer-events-none absolute left-1/2 top-16 z-20 flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-1 px-4 sm:left-auto sm:right-3 sm:top-20 sm:translate-x-0 sm:items-end">
    {feed
      .filter((item) => now - item.at < VISIBLE_MS)
      .slice(-MAX_VISIBLE)
      .map((item) => (
        <li
          key={item.id}
          className="glass animate-float-up px-3 py-1 text-xs font-semibold text-slate-100 sm:text-sm"
          style={{ borderLeft: `3px solid ${TEAM_COLORS[item.team] ?? "#e2e8f0"}` }}
        >
          {item.text}
        </li>
      ))}
  </ul>
);
