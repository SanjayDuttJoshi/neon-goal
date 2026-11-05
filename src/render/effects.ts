import { GameEventKind, type GameEvent } from "@/types/game";
import type { RenderFrame } from "@/types/render";
import { TEAM_COLORS } from "@/game/constants";
import type { ParticleSystem } from "@/render/particles";

export interface EffectState {
  shake: number;
  flash: number;
  flashColor: string;
}

const colorOf = (team: number): string => TEAM_COLORS[team] ?? "#e0f2fe";

/** Spawns the particles, shakes and flashes that make each event feel punchy. */
export const spawnEffect = (event: GameEvent, particles: ParticleSystem, fx: EffectState, frame: RenderFrame): void => {
  const color = colorOf(event.team);
  switch (event.kind) {
    case GameEventKind.TrailBounce:
      particles.burst(event.x, event.y, color, 14, 320, 0.45);
      particles.ring(event.x, event.y, color, 46, 0.35, 3);
      fx.shake = Math.max(fx.shake, 2);
      break;
    case GameEventKind.PowerBounce:
      particles.burst(event.x, event.y, "#ffffff", 16, 520, 0.6);
      particles.burst(event.x, event.y, color, 26, 460, 0.7);
      particles.ring(event.x, event.y, color, 120, 0.5, 6);
      fx.shake = Math.max(fx.shake, 9);
      break;
    case GameEventKind.WallHit:
      particles.burst(event.x, event.y, "#7dd3fc", Math.min(12, 4 + event.value / 120), 220, 0.35);
      break;
    case GameEventKind.BodyHit:
      particles.burst(event.x, event.y, color, 8, 200, 0.35);
      break;
    case GameEventKind.Dash: {
      particles.ring(event.x, event.y, color, 60, 0.3, 3);
      particles.burst(event.x, event.y, color, 10, 180, 0.35, "dot");
      break;
    }
    case GameEventKind.Slowed:
      particles.burst(event.x, event.y, "#93c5fd", 12, 160, 0.5);
      break;
    case GameEventKind.Save:
      particles.ring(event.x, event.y, "#ffffff", 90, 0.5, 4);
      particles.burst(event.x, event.y, color, 18, 300, 0.6, "dot");
      break;
    case GameEventKind.Goal: {
      const goalColor = event.team >= 0 ? color : "#f8fafc";
      particles.burst(event.x, event.y, goalColor, 90, 700, 1.4, "dot");
      particles.burst(event.x, event.y, "#ffffff", 50, 900, 0.9);
      particles.ring(event.x, event.y, goalColor, 260, 0.9, 10);
      particles.ring(event.x, event.y, "#ffffff", 160, 0.6, 5);
      fx.shake = 22;
      fx.flash = 0.5;
      fx.flashColor = goalColor;
      break;
    }
    case GameEventKind.Eliminated: {
      const goal = frame.arena.goals.find((g) => g.team === event.team);
      if (goal) particles.burst(goal.centerX, goal.centerY, "#ef4444", 60, 500, 1.1, "dot");
      fx.shake = Math.max(fx.shake, 12);
      break;
    }
    case GameEventKind.BallRed:
      particles.burst(frame.ball.x, frame.ball.y, "#ef4444", 40, 420, 0.8, "dot");
      particles.ring(frame.ball.x, frame.ball.y, "#ef4444", 140, 0.6, 6);
      fx.flash = Math.max(fx.flash, 0.22);
      fx.flashColor = "#ef4444";
      break;
    case GameEventKind.BallCooled:
      particles.ring(frame.ball.x, frame.ball.y, "#bae6fd", 90, 0.5, 4);
      break;
    case GameEventKind.KnockOut:
      particles.burst(event.x, event.y, "#ef4444", 46, 520, 0.9, "dot");
      particles.burst(event.x, event.y, "#f97316", 30, 380, 0.7);
      particles.ring(event.x, event.y, "#ef4444", 110, 0.6, 6);
      fx.shake = Math.max(fx.shake, 14);
      break;
    case GameEventKind.Respawn:
      particles.ring(event.x, event.y, "#e0f2fe", 70, 0.5, 4);
      break;
    case GameEventKind.MatchEnd: {
      const cx = frame.arena.width / 2;
      const cy = frame.arena.height / 2;
      for (const c of TEAM_COLORS) particles.burst(cx, cy, c, 40, 800, 1.6, "dot");
      fx.flash = 0.35;
      fx.flashColor = event.team >= 0 ? color : "#ffffff";
      break;
    }
    default:
      break;
  }
};
