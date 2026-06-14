/* ============================================================
   projectile.js — fireballs, shuriken, slashes, shockwaves and
   super beams. They live in world space, collide with the foe's
   hurtbox, and self-render with per-character colours.
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP, U = FP.U;

  class Projectile {
    constructor(o) {
      this.x = o.x; this.y = o.y;
      this.vx = o.vx; this.vy = o.vy || 0;
      this.r = o.r || 18;
      this.dmg = o.dmg || 80;
      this.owner = o.owner;        // fighter index 0/1
      this.facing = o.facing;
      this.color = o.color; this.color2 = o.color2;
      this.life = o.life || 1.5;
      this.kind = o.kind || "ball"; // ball | fire | slash | spin | beam | shock
      this.hits = o.hits || 1;
      this.hitstun = o.hitstun || 18;
      this.dead = false;
      this.t = 0;
      this.alreadyHit = new Set();
      this.fx = o.fx;
      this.fixed = o.fixed || false; // shockwave stays put / expands
      this.maxR = o.maxR || this.r;
      this.spin = 0;
    }
    box() {
      return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 };
    }
    step(dt) {
      this.t += dt; this.life -= dt; this.spin += dt * 14;
      if (this.life <= 0) { this.dead = true; return; }
      if (this.fixed) {
        this.r = U.lerp(this.r, this.maxR, dt * 6);
      } else {
        this.x += this.vx * dt; this.y += this.vy * dt;
      }
      // trail
      if (this.fx && this.kind !== "shock") this.fx.fireballTrail(this.x, this.y, this.color, this.color2, this.facing);
    }
    onHit() {
      this.hits--;
      if (this.hits <= 0 && this.kind !== "beam") this.dead = true;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const pulse = 1 + Math.sin(this.t * 24) * 0.08;
      const r = this.r * pulse;
      if (this.kind === "slash") {
        ctx.rotate(this.facing > 0 ? 0 : Math.PI);
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = this.color; ctx.lineWidth = 8; ctx.lineCap = "round";
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = 0.8 - i * 0.22;
          ctx.beginPath();
          ctx.arc(-i * 8, 0, r + i * 4, -1.1, 1.1); ctx.stroke();
        }
        ctx.restore(); return;
      }
      if (this.kind === "spin") {
        ctx.rotate(this.spin);
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = this.color;
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.4, -3); ctx.lineTo(r * 1.6, 0); ctx.lineTo(r * 1.4, 3); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, U.TAU); ctx.fill();
        ctx.restore(); return;
      }
      if (this.kind === "shock") {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = this.color; ctx.lineWidth = 6;
        ctx.globalAlpha = U.clamp(this.life, 0, 1);
        ctx.beginPath(); ctx.ellipse(0, 0, this.r, this.r * 0.4, 0, 0, U.TAU); ctx.stroke();
        ctx.strokeStyle = this.color2; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, 0, this.r * 0.7, this.r * 0.28, 0, 0, U.TAU); ctx.stroke();
        ctx.restore(); return;
      }
      // ball / fire core
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 1.8);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.25, this.color);
      g.addColorStop(0.7, this.color2);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, U.TAU); ctx.fill();
      // core
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, U.TAU); ctx.fill();
      // flame tail
      if (this.kind === "fire") {
        ctx.fillStyle = this.color;
        for (let i = 0; i < 5; i++) {
          const fx = -this.facing * (r + i * 7), fy = Math.sin(this.t * 30 + i) * (r * 0.4);
          ctx.globalAlpha = 0.6 - i * 0.1;
          ctx.beginPath(); ctx.arc(fx, fy, r * (0.7 - i * 0.1), 0, U.TAU); ctx.fill();
        }
      } else {
        // energy tail streak
        ctx.strokeStyle = this.color; ctx.lineWidth = r * 0.7; ctx.lineCap = "round";
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-this.facing * r * 2.2, 0); ctx.stroke();
      }
      ctx.restore();
    }
  }

  FP.Projectile = Projectile;
})(window);
