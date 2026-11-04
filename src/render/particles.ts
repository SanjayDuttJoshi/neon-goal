export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: "spark" | "dot";
}

export interface Ring {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
  width: number;
}

const MAX_PARTICLES = 700;
const PARTICLE_DRAG = 3.2;

/** Lightweight particle and shockwave system in world coordinates. */
export class ParticleSystem {
  private particles: Particle[] = [];
  private rings: Ring[] = [];

  burst(x: number, y: number, color: string, count: number, speed: number, life = 0.6, kind: Particle["kind"] = "spark"): void {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.9);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * s,
        vy: Math.sin(angle) * s,
        life: life * (0.6 + Math.random() * 0.6),
        maxLife: life,
        size: kind === "dot" ? 2 + Math.random() * 4 : 1.5 + Math.random() * 2,
        color,
        kind,
      });
    }
    if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES);
  }

  ring(x: number, y: number, color: string, radius: number, life = 0.5, width = 4): void {
    this.rings.push({ x, y, life, maxLife: life, radius, color, width });
  }

  update(dt: number): void {
    const drag = Math.exp(-PARTICLE_DRAG * dt);
    for (const p of this.particles) {
      p.life -= dt;
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const r of this.rings) {
      const t = 1 - r.life / r.maxLife;
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - t * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius * (0.2 + t * 0.8), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.strokeStyle = p.color;
      ctx.fillStyle = p.color;
      if (p.kind === "spark") {
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
