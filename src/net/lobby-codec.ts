import { BotDifficulty, GameMode, RedBallMode, type PlayerStats, type RosterEntry } from "@/types/game";
import {
  CommandKind,
  LobbyStatus,
  type CommandMessage,
  type HelloMessage,
  type LobbyMember,
  type LobbyState,
  type MatchSummary,
  type SummaryPlayer,
} from "@/types/net";
import { isEnumValue, isFiniteNumber, isNumberArray, isRecord, isString } from "@/lib/guards";
import { MAX_MEMBERS, sanitizeName, sanitizeSettings } from "@/net/lobby";

const MAX_ROSTER = 16;

const parseMember = (value: unknown): LobbyMember | null => {
  if (!isRecord(value)) return null;
  const { peerId, clientId, name, team, connected } = value;
  if (!isString(peerId, 64) || !isString(clientId, 64) || !isString(name, 64)) return null;
  if (team !== null && !isFiniteNumber(team)) return null;
  return { peerId, clientId, name: sanitizeName(name), team, connected: connected === true };
};

const parseRosterEntry = (value: unknown): RosterEntry | null => {
  if (!isRecord(value)) return null;
  const { id, name, team, isBot } = value;
  if (!isString(id, 64) || !isString(name, 64) || !isFiniteNumber(team)) return null;
  return { id, name: sanitizeName(name), team, isBot: isBot === true };
};

const parseStats = (value: unknown): PlayerStats | null => {
  if (!isRecord(value)) return null;
  const { goals, ownGoals, saves, bounces, powerShots, knockouts } = value;
  if (![goals, ownGoals, saves, bounces, powerShots].every(isFiniteNumber)) return null;
  return {
    goals: goals as number,
    ownGoals: ownGoals as number,
    saves: saves as number,
    bounces: bounces as number,
    powerShots: powerShots as number,
    knockouts: isFiniteNumber(knockouts) ? knockouts : 0,
  };
};

const parseSummary = (value: unknown): MatchSummary | null => {
  if (!isRecord(value)) return null;
  const { winner, scores, lives, mode, players } = value;
  if (!isFiniteNumber(winner) || !isNumberArray(scores, 8) || !isNumberArray(lives, 8)) return null;
  if (!isEnumValue(Object.values(GameMode), mode) || !Array.isArray(players) || players.length > MAX_ROSTER) return null;
  const parsed: SummaryPlayer[] = [];
  for (const p of players) {
    if (!isRecord(p)) return null;
    const entry = parseRosterEntry(p);
    const stats = parseStats(p.stats);
    if (!entry || !stats) return null;
    parsed.push({ ...entry, stats });
  }
  return { winner, scores, lives, mode, players: parsed };
};

/** Validates a lobby broadcast coming from a peer that claims to be host. */
export const parseLobby = (data: unknown): LobbyState | null => {
  if (!isRecord(data)) return null;
  const { version, roomCode, hostPeerId, settings, members, status, matchId, roster, summary } = data;
  if (!isFiniteNumber(version) || !isString(roomCode, 16) || !isString(hostPeerId, 64)) return null;
  if (!isEnumValue(Object.values(LobbyStatus), status) || !isFiniteNumber(matchId)) return null;
  if (!isRecord(settings) || !Array.isArray(members) || members.length > MAX_MEMBERS) return null;
  if (!Array.isArray(roster) || roster.length > MAX_ROSTER) return null;
  const mode = settings.mode;
  const difficulty = settings.botDifficulty;
  if (!isEnumValue(Object.values(GameMode), mode) || !isEnumValue(Object.values(BotDifficulty), difficulty)) return null;
  const parsedMembers = members.map(parseMember);
  const parsedRoster = roster.map(parseRosterEntry);
  if (parsedMembers.some((m) => m === null) || parsedRoster.some((r) => r === null)) return null;
  return {
    version,
    roomCode,
    hostPeerId,
    settings: sanitizeSettings({
      mode,
      durationSec: isFiniteNumber(settings.durationSec) ? settings.durationSec : 0,
      botFill: settings.botFill === true,
      botDifficulty: difficulty,
      redBall: isEnumValue(Object.values(RedBallMode), settings.redBall) ? settings.redBall : RedBallMode.Off,
      arenaEvents: settings.arenaEvents === true,
    }),
    members: parsedMembers as LobbyMember[],
    status,
    matchId,
    roster: parsedRoster as RosterEntry[],
    summary: summary === null || summary === undefined ? null : parseSummary(summary),
  };
};

export const parseHello = (data: unknown): HelloMessage | null => {
  if (!isRecord(data)) return null;
  const { v, clientId, name } = data;
  if (!isFiniteNumber(v) || !isString(clientId, 64) || clientId.length < 4 || !isString(name, 64)) return null;
  return { v, clientId, name };
};

export const parseCommand = (data: unknown): CommandMessage | null => {
  if (!isRecord(data)) return null;
  const { kind, team } = data;
  if (!isEnumValue(Object.values(CommandKind), kind) || !isFiniteNumber(team)) return null;
  return { kind, team };
};
