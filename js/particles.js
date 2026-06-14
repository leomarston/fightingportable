/* ============================================================
   particles.js — lightweight pooled particle system used for
   dust, sparks, energy motes, debris and trails.
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP, U = FP.U;

  class Particle {
    constructor() { this.dead = true; }
    reset(o) {
      this.x = o.x; this.y = o.y;
      this.vx = o.vx || 0; this.vy = o.vy || 0;
      this.g = o.g || 0;              // gravity
      this.drag = o.drag != null ? o.drag : 1;
      this.life = o.life || 0.5; this.maxLife = this.life;
      this.r = o.r || 3; this.r0 = this.r;
      this.r1 = o.r1 != null ? o.r1 : 0;
      this.color = o.color || "#fff";
      this.color1 = o.color1 || null; // fade-to color
      this.kind = o.kind || "dot";    // dot | spark | smoke | ring | star
      this.rot = o.rot || 0; this.vr = o.vr || 0;
      this.add = o.add !== false;     // additive blend
      this.fade = o.fade != null ? o.fade : 1;
      this.dead = false;
    }
    step(dt) {
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      this.vy += this.g * dt;
      this.vx *= Math.pow(this.drag, dt * 60);
      this.vy *= Math.pow(this.drag, dt * 60);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rot += this.vr * dt;
    }
    draw(ctx) {
      const t = this.life / this.maxLife;          // 1 -> 0
      const a = Math.min(1, t / Math.max(0.0001, this.fade));
      const r = U.lerp(this.r1, this.r0, t);
      let col = this.color;
      if (this.color1) col = mixHex(this.color, this.color1, 1 - t);
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = this.add ? "lighter" : "source-over";
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      if (this.kind === "smoke") {
        ctx.globalAlpha = a * 0.5;
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, U.TAU); ctx.fill();
      } else if (this.kind === "spark") {
        ctx.lineWidth = Math.max(1, r * 0.5);
        const len = r * 2.4;
        const dx = Math.cos(this.rot) * len, dy = Math.sin(this.rot) * len;
        ctx.beginPath(); ctx.moveTo(this.x - dx, this.y - dy); ctx.lineTo(this.x + dx, this.y + dy); ctx.stroke();
      } else if (this.kind === "ring") {
        ctx.lineWidth = Math.max(1, r * 0.35);
        ctx.beginPath(); ctx.arc(this.x, this.y, U.lerp(this.r0, this.r0 * 2.2, 1 - t), 0, U.TAU); ctx.stroke();
      } else if (this.kind === "star") {
        drawStar(ctx, this.x, this.y, r, this.rot);
      } else {
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, U.TAU); ctx.fill();
      }
    }
  }

  function drawStar(ctx, x, y, r, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * U.TAU;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(a + 0.39) * r * 0.32, Math.sin(a + 0.39) * r * 0.32);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function mixHex(a, b, t) {
    if (a[0] !== "#" || b[0] !== "#") return a;
    const na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
    const r = U.lerp((na >> 16) & 255, (nb >> 16) & 255, t);
    const g = U.lerp((na >> 8) & 255, (nb >> 8) & 255, t);
    const bl = U.lerp(na & 255, nb & 255, t);
    return U.rgba(r, g, bl, 1);
  }

  class ParticleSystem {
    constructor(max = 1400) {
      this.pool = [];
      this.max = max;
      for (let i = 0; i < max; i++) this.pool.push(new Particle());
      this.cursor = 0;
    }
    spawn(o) {
      // find a dead one starting at cursor
      for (let i = 0; i < this.max; i++) {
        const idx = (this.cursor + i) % this.max;
        if (this.pool[idx].dead) { this.cursor = (idx + 1) % this.max; this.pool[idx].reset(o); return this.pool[idx]; }
      }
      // none free: recycle cursor
      this.pool[this.cursor].reset(o);
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.max;
      return p;
    }
    burst(o, n) { for (let i = 0; i < n; i++) this.spawn(typeof o === "function" ? o(i) : o); }
    step(dt) { for (const p of this.pool) if (!p.dead) p.step(dt); }
    draw(ctx) {
      ctx.save();
      for (const p of this.pool) if (!p.dead) p.draw(ctx);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    }
    clear() { for (const p of this.pool) p.dead = true; }
  }

  FP.ParticleSystem = ParticleSystem;
})(window);
