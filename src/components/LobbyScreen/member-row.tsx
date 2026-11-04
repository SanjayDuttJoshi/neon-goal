import type { LobbyMember } from "@/types/net";

interface MemberRowProps {
  member: LobbyMember;
  isSelf: boolean;
  isHostMember: boolean;
  canManage: boolean;
  onKick: () => void;
  onBench: () => void;
}

export const MemberRow = ({ member, isSelf, isHostMember, canManage, onKick, onBench }: MemberRowProps) => (
  <li className={`flex items-center gap-2 border-l-2 bg-white/[0.04] px-3 py-2 animate-float-up ${isSelf ? "border-white" : "border-transparent"}`}>
    <span className={`h-2 w-2 shrink-0 rounded-full ${member.connected ? "bg-lime-400 shadow-[0_0_8px_#a3e635]" : "bg-slate-600"}`} />
    <span className="min-w-0 flex-1 truncate font-semibold text-slate-100">
      {member.name}
      {isSelf && <span className="ml-2 text-xs font-bold uppercase text-cyan-300">(tum)</span>}
    </span>
    {isHostMember && (
      <span title="Host" className="text-amber-300">
        👑
      </span>
    )}
    {canManage && !isSelf && (
      <span className="flex gap-1">
        <button type="button" onClick={onBench} title="Bench pe bhejo" className="px-1.5 text-xs text-slate-400 hover:text-white">
          ⇣
        </button>
        <button type="button" onClick={onKick} title="Kick" className="px-1.5 text-xs text-rose-300 hover:text-rose-100">
          ✕
        </button>
      </span>
    )}
  </li>
);
