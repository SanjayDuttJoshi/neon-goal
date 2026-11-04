import { BotDifficulty, GameMode, type MatchConfig, type RosterEntry, type SimState } from "@/types/game";
import { LobbyStatus, type LobbyMember, type LobbySettings, type LobbyState, type MatchSummary } from "@/types/net";
import { DEFAULT_DURATION_SEC, MATCH_DURATIONS_SEC, MODE_INFO } from "@/game/constants";
import { PROTOCOL_VERSION } from "@/net/protocol";

export const MAX_NAME_LENGTH = 14;
export const MAX_MEMBERS = 16;

export const DEFAULT_SETTINGS: LobbySettings = {
  mode: GameMode.Duo,
  durationSec: DEFAULT_DURATION_SEC,
  botFill: true,
  botDifficulty: BotDifficulty.Normal,
};

const BOT_NAMES = ["Robo Raju", "Chintu.exe", "Bot Bunty", "Pappu 2.0", "Golu AI", "Tinku Bot", "Munna MK2", "Babloo X"];

export const sanitizeName = (raw: string): string => {
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  return cleaned.length > 0 ? cleaned : "Player";
};

export const sanitizeSettings = (settings: LobbySettings): LobbySettings => ({
  mode: Object.values(GameMode).includes(settings.mode) ? settings.mode : DEFAULT_SETTINGS.mode,
  durationSec: (MATCH_DURATIONS_SEC as readonly number[]).includes(settings.durationSec)
    ? settings.durationSec
    : DEFAULT_SETTINGS.durationSec,
  botFill: Boolean(settings.botFill),
  botDifficulty: Object.values(BotDifficulty).includes(settings.botDifficulty)
    ? settings.botDifficulty
    : DEFAULT_SETTINGS.botDifficulty,
});

export const createLobby = (roomCode: string, host: LobbyMember, settings: LobbySettings): LobbyState => ({
  version: PROTOCOL_VERSION,
  roomCode,
  hostPeerId: host.peerId,
  settings: sanitizeSettings(settings),
  members: [{ ...host, team: 0 }],
  status: LobbyStatus.Waiting,
  matchId: 0,
  roster: [],
  summary: null,
});

export const membersOnTeam = (lobby: LobbyState, team: number): LobbyMember[] =>
  lobby.members.filter((m) => m.team === team);

/** Team with free capacity and the fewest members, or null when everything is full. */
export const pickOpenTeam = (lobby: LobbyState): number | null => {
  const info = MODE_INFO[lobby.settings.mode];
  let best: number | null = null;
  for (let team = 0; team < info.teamCount; team += 1) {
    const count = membersOnTeam(lobby, team).length;
    if (count >= info.teamSize) continue;
    if (best === null || count < membersOnTeam(lobby, best).length) best = team;
  }
  return best;
};

const uniqueName = (lobby: LobbyState, name: string, clientId: string): string => {
  const taken = new Set(lobby.members.filter((m) => m.clientId !== clientId).map((m) => m.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${name.slice(0, MAX_NAME_LENGTH - 3)} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return name;
};

export const addMember = (lobby: LobbyState, peerId: string, clientId: string, rawName: string): LobbyState => {
  const name = uniqueName(lobby, sanitizeName(rawName), clientId);
  const existing = lobby.members.find((m) => m.clientId === clientId);
  if (existing) {
    const members = lobby.members.map((m) => (m.clientId === clientId ? { ...m, peerId, name, connected: true } : m));
    return { ...lobby, members };
  }
  if (lobby.members.length >= MAX_MEMBERS) return lobby;
  const team = lobby.status === LobbyStatus.Playing ? null : pickOpenTeam(lobby);
  return { ...lobby, members: [...lobby.members, { peerId, clientId, name, team, connected: true }] };
};

export const markDisconnected = (lobby: LobbyState, peerId: string): LobbyState => {
  const member = lobby.members.find((m) => m.peerId === peerId);
  if (!member) return lobby;
  const inMatch = lobby.status === LobbyStatus.Playing && lobby.roster.some((r) => r.id === member.clientId);
  const members = inMatch
    ? lobby.members.map((m) => (m.peerId === peerId ? { ...m, connected: false } : m))
    : lobby.members.filter((m) => m.peerId !== peerId);
  return { ...lobby, members };
};

/** Applies new settings and moves members that no longer fit to another team or the bench. */
export const applySettings = (lobby: LobbyState, raw: LobbySettings): LobbyState => {
  const settings = sanitizeSettings(raw);
  const next: LobbyState = { ...lobby, settings, members: lobby.members.map((m) => ({ ...m })) };
  const info = MODE_INFO[settings.mode];
  const counts = Array.from({ length: info.teamCount }, () => 0);
  const overflow: LobbyMember[] = [];
  for (const member of next.members) {
    if (member.team === null) continue;
    if (member.team < info.teamCount && counts[member.team] < info.teamSize) {
      counts[member.team] += 1;
    } else {
      member.team = null;
      overflow.push(member);
    }
  }
  for (const member of overflow) member.team = pickOpenTeam(next);
  return next;
};

export const moveMember = (lobby: LobbyState, peerId: string, team: number | null): LobbyState => {
  const info = MODE_INFO[lobby.settings.mode];
  if (team !== null && (team < 0 || team >= info.teamCount)) return lobby;
  if (team !== null && membersOnTeam(lobby, team).filter((m) => m.peerId !== peerId).length >= info.teamSize) return lobby;
  return { ...lobby, members: lobby.members.map((m) => (m.peerId === peerId ? { ...m, team } : m)) };
};

export const removeMember = (lobby: LobbyState, peerId: string): LobbyState => ({
  ...lobby,
  members: lobby.members.filter((m) => m.peerId !== peerId),
});

export interface StartCheck {
  ok: boolean;
  reason: string;
}

export const canStart = (lobby: LobbyState): StartCheck => {
  const info = MODE_INFO[lobby.settings.mode];
  const playing = lobby.members.filter((m) => m.team !== null && m.connected);
  if (playing.length === 0) return { ok: false, reason: "Kam se kam ek player team mein hona chahiye" };
  if (lobby.settings.botFill) return { ok: true, reason: "" };
  const teamsWithPlayers = new Set(playing.map((m) => m.team)).size;
  const needed = lobby.settings.mode === GameMode.FreeForAll ? 2 : info.teamCount;
  if (teamsWithPlayers < needed) return { ok: false, reason: "Har team mein player chahiye, ya Bots ON karo" };
  return { ok: true, reason: "" };
};

export const buildRoster = (lobby: LobbyState): RosterEntry[] => {
  const info = MODE_INFO[lobby.settings.mode];
  const roster: RosterEntry[] = [];
  let botIndex = 0;
  for (let team = 0; team < info.teamCount; team += 1) {
    const humans = membersOnTeam(lobby, team).filter((m) => m.connected);
    humans.forEach((m) => roster.push({ id: m.clientId, name: m.name, team, isBot: false }));
    if (!lobby.settings.botFill) continue;
    for (let slot = humans.length; slot < info.teamSize; slot += 1) {
      roster.push({ id: `bot-${botIndex}`, name: BOT_NAMES[botIndex % BOT_NAMES.length], team, isBot: true });
      botIndex += 1;
    }
  }
  return roster;
};

export const matchConfigFor = (settings: LobbySettings): MatchConfig => ({
  mode: settings.mode,
  durationSec: settings.durationSec,
  botDifficulty: settings.botDifficulty,
});

export const buildSummary = (state: SimState, roster: RosterEntry[]): MatchSummary => ({
  winner: state.winner ?? -1,
  scores: [...state.scores],
  lives: [...state.lives],
  mode: state.config.mode,
  players: state.players.map((p) => ({
    id: p.id,
    name: p.name,
    team: p.team,
    isBot: roster.find((r) => r.id === p.id)?.isBot ?? p.botControlled,
    stats: { ...p.stats },
  })),
});
