import type { LobbyMember } from "@/types/net";
import { TEAM_COLORS, TEAM_NAMES } from "@/game/constants";
import { MemberRow } from "@/components/LobbyScreen/member-row";

interface TeamColumnProps {
  team: number;
  members: LobbyMember[];
  capacity: number;
  botFill: boolean;
  selfClientId: string;
  hostPeerId: string;
  isHost: boolean;
  selfOnTeam: boolean;
  onJoinTeam: () => void;
  onKick: (peerId: string) => void;
  onBench: (peerId: string) => void;
}

export const TeamColumn = ({ team, members, capacity, botFill, selfClientId, hostPeerId, isHost, selfOnTeam, onJoinTeam, onKick, onBench }: TeamColumnProps) => {
  const color = TEAM_COLORS[team];
  const empty = Math.max(0, capacity - members.length);
  const canJoin = !selfOnTeam && members.length < capacity;
  return (
    <div className="clip-corner border bg-black/30 p-3" style={{ borderColor: `${color}55`, boxShadow: `0 0 28px -12px ${color}` }}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-sm font-black uppercase tracking-[0.25em]" style={{ color }}>
          {TEAM_NAMES[team]}
        </h3>
        <span className="font-mono text-xs text-slate-400">
          {members.length}/{capacity}
        </span>
      </div>
      <ul className="space-y-1.5">
        {members.map((m) => (
          <MemberRow
            key={m.clientId}
            member={m}
            isSelf={m.clientId === selfClientId}
            isHostMember={m.peerId === hostPeerId}
            canManage={isHost}
            onKick={() => onKick(m.peerId)}
            onBench={() => onBench(m.peerId)}
          />
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <li key={`empty-${i}`} className="border border-dashed border-white/10 px-3 py-2 text-sm text-slate-500">
            {botFill ? "🤖 Bot khelega" : "Khaali jagah"}
          </li>
        ))}
      </ul>
      {canJoin && (
        <button
          type="button"
          onClick={onJoinTeam}
          className="mt-2 w-full border border-white/10 py-1.5 font-display text-[11px] font-bold uppercase tracking-widest text-slate-300 hover:border-white/30 hover:text-white"
        >
          Is team mein jao →
        </button>
      )}
    </div>
  );
};
