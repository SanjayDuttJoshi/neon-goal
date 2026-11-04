import { GameMode, type ArenaDef, type GoalDef, type Vec2, type WallDef } from "@/types/game";

/** Builds a wall whose normal faces the given reference point. */
export const makeWall = (ax: number, ay: number, bx: number, by: number, towardX: number, towardY: number): WallDef => {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let nx = -(by - ay) / len;
  let ny = (bx - ax) / len;
  if ((towardX - ax) * nx + (towardY - ay) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { ax, ay, bx, by, nx, ny };
};

interface ArenaSize {
  width: number;
  height: number;
  goalWidth: number;
  chamfer: number;
  netDepth: number;
}

const ARENA_SIZES: Record<GameMode, ArenaSize> = {
  [GameMode.Solo]: { width: 1300, height: 760, goalWidth: 250, chamfer: 70, netDepth: 70 },
  [GameMode.Duo]: { width: 1500, height: 860, goalWidth: 350, chamfer: 80, netDepth: 72 },
  [GameMode.Squad]: { width: 1800, height: 1000, goalWidth: 430, chamfer: 90, netDepth: 76 },
  [GameMode.FreeForAll]: { width: 1100, height: 1100, goalWidth: 240, chamfer: 110, netDepth: 70 },
};

/** Formation slots for the left-side team, as fractions of width/height. */
const TEAM_FORMATIONS: Record<number, Array<[number, number]>> = {
  1: [[0.25, 0.5]],
  2: [
    [0.3, 0.36],
    [0.18, 0.64],
  ],
  4: [
    [0.36, 0.28],
    [0.36, 0.72],
    [0.22, 0.42],
    [0.13, 0.6],
  ],
};

const FFA_SPAWN_INSET = 150;

interface SideSpec {
  from: Vec2;
  to: Vec2;
  inward: Vec2;
  goalTeam: number | null;
}

const buildSide = (side: SideSpec, size: ArenaSize, walls: WallDef[], goals: GoalDef[]): void => {
  const cx = size.width / 2;
  const cy = size.height / 2;
  if (side.goalTeam === null) {
    walls.push(makeWall(side.from.x, side.from.y, side.to.x, side.to.y, cx, cy));
    return;
  }
  const midX = (side.from.x + side.to.x) / 2;
  const midY = (side.from.y + side.to.y) / 2;
  const len = Math.hypot(side.to.x - side.from.x, side.to.y - side.from.y);
  const dirX = (side.to.x - side.from.x) / len;
  const dirY = (side.to.y - side.from.y) / len;
  const half = size.goalWidth / 2;
  const p1 = { x: midX - dirX * half, y: midY - dirY * half };
  const p2 = { x: midX + dirX * half, y: midY + dirY * half };
  walls.push(makeWall(side.from.x, side.from.y, p1.x, p1.y, cx, cy));
  walls.push(makeWall(p2.x, p2.y, side.to.x, side.to.y, cx, cy));
  const backX = -side.inward.x * size.netDepth;
  const backY = -side.inward.y * size.netDepth;
  const netX = midX + backX / 2;
  const netY = midY + backY / 2;
  goals.push({
    team: side.goalTeam,
    mouth: makeWall(p1.x, p1.y, p2.x, p2.y, cx, cy),
    inwardX: side.inward.x,
    inwardY: side.inward.y,
    centerX: midX,
    centerY: midY,
    netWalls: [
      makeWall(p1.x, p1.y, p1.x + backX, p1.y + backY, netX, netY),
      makeWall(p1.x + backX, p1.y + backY, p2.x + backX, p2.y + backY, netX, netY),
      makeWall(p2.x + backX, p2.y + backY, p2.x, p2.y, netX, netY),
    ],
  });
};

const teamSpawns = (size: ArenaSize, teamSize: number): Vec2[][] => {
  const formation = TEAM_FORMATIONS[teamSize] ?? TEAM_FORMATIONS[1];
  const left = formation.map(([fx, fy]) => ({ x: size.width * fx, y: size.height * fy }));
  const right = left.map((p) => ({ x: size.width - p.x, y: size.height - p.y }));
  return [left, right];
};

export const buildArena = (mode: GameMode, teamSize: number): ArenaDef => {
  const size = ARENA_SIZES[mode];
  const { width: w, height: h, chamfer: c } = size;
  const isFfa = mode === GameMode.FreeForAll;
  const walls: WallDef[] = [];
  const goals: GoalDef[] = [];
  const sides: SideSpec[] = [
    { from: { x: 0, y: c }, to: { x: 0, y: h - c }, inward: { x: 1, y: 0 }, goalTeam: 0 },
    { from: { x: w, y: c }, to: { x: w, y: h - c }, inward: { x: -1, y: 0 }, goalTeam: 1 },
    { from: { x: c, y: 0 }, to: { x: w - c, y: 0 }, inward: { x: 0, y: 1 }, goalTeam: isFfa ? 2 : null },
    { from: { x: c, y: h }, to: { x: w - c, y: h }, inward: { x: 0, y: -1 }, goalTeam: isFfa ? 3 : null },
  ];
  sides.forEach((side) => buildSide(side, size, walls, goals));
  walls.push(makeWall(0, c, c, 0, w / 2, h / 2));
  walls.push(makeWall(w - c, 0, w, c, w / 2, h / 2));
  walls.push(makeWall(0, h - c, c, h, w / 2, h / 2));
  walls.push(makeWall(w, h - c, w - c, h, w / 2, h / 2));

  const spawns = isFfa
    ? goals.map((goal) => [
        { x: goal.centerX + goal.inwardX * FFA_SPAWN_INSET, y: goal.centerY + goal.inwardY * FFA_SPAWN_INSET },
      ])
    : teamSpawns(size, teamSize);

  return { width: w, height: h, walls, goals, spawns, teamCount: isFfa ? 4 : 2 };
};

export const getGoalForTeam = (arena: ArenaDef, team: number): GoalDef => {
  const goal = arena.goals.find((g) => g.team === team);
  if (!goal) throw new Error(`No goal for team ${team}`);
  return goal;
};

/** Margin around the field (net depth plus padding) used to frame the camera. */
export const ARENA_VIEW_MARGIN = 96;
