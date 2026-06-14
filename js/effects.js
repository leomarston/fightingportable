/* ============================================================
   effects.js — combat VFX built on top of the particle system,
   plus screen-level effects (shake, flash, freeze, slashes).
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP, U = FP.U;

  class Effects {
    constructor() {
      this.ps = new FP.ParticleSystem(1600);
      this.fore = new FP.ParticleSystem(500); // foreground (drawn over fighters)
      this.flashes = [];   // {x,y,r,life,max,color,kind,rot}
      this.shakeMag = 0; this.shakeT = 0;
      this.flashAlpha = 0; this.flashColor = "#fff";
      this.freeze = 0;     // hit-stop seconds remaining
      this.slowmo = 0;
      this.texts = [];     // floating combat text
    }
    clear() { this.ps.clear(); this.fore.clear(); this.flashes.length = 0; this.texts.length = 0; this.shakeMag = 0; this.freeze = 0; this.flashAlpha = 0; this.slowmo = 0; }

    shake(mag, time = 0.25) { this.shakeMag = Math.max(this.shakeMag, mag); this.shakeT = Math.max(this.shakeT, time); }
    flash(color = "#fff", a = 0.5) { this.flashColor = color; this.flashAlpha = Math.max(this.flashAlpha, a); }
    hitStop(t) { this.freeze = Math.max(this.freeze, t); }

    addText(x, y, txt, color = "#ffd24a", big = false) {
      this.texts.push({ x, y, txt, color, life: 0.9, max: 0.9, vy: -42, big });
    }

    // ---------- combat events ----------
    dust(x, y, dir = 0, n = 7, scale = 1) {
      for (let i = 0; i < n; i++) {
        this.ps.spawn({
          x: x + U.rand(-8, 8), y: y - U.rand(0, 6),
          vx: dir * U.rand(20, 90) + U.rand(-30, 30), vy: -U.rand(20, 90) * scale,
          g: 220, drag: 0.92, life: U.rand(0.35, 0.7), r: U.rand(6, 13) * scale, r1: U.rand(10, 18) * scale,
          color: "#cfc4ad", kind: "smoke", add: false,
        });
      }
    }
    landDust(x, y, scale = 1) {
      for (let i = 0; i < 12; i++) {
        const a = U.rand(-Math.PI, 0);
        const sp = U.rand(60, 200) * scale;
        this.ps.spawn({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, g: 260, drag: 0.9,
          life: U.rand(0.3, 0.6), r: U.rand(5, 11) * scale, r1: U.rand(12, 20) * scale,
          color: "#d8cdb4", kind: "smoke", add: false,
        });
      }
    }
    runDust(x, y, dir) {
      this.ps.spawn({
        x, y, vx: -dir * U.rand(30, 90), vy: -U.rand(10, 50), g: 200, drag: 0.92,
        life: 0.4, r: U.rand(4, 8), r1: 12, color: "#cdbf9f", kind: "smoke", add: false,
      });
    }
    hitSpark(x, y, power = 1, color = "#fff3c0", dir = 1) {
      const n = 10 + power * 8;
      for (let i = 0; i < n; i++) {
        const a = U.rand(0, U.TAU);
        const sp = U.rand(120, 360) * (0.6 + power * 0.5);
        this.ps.spawn({
          x, y, vx: Math.cos(a) * sp + dir * 60, vy: Math.sin(a) * sp, g: 60, drag: 0.86,
          life: U.rand(0.12, 0.3), r: U.rand(2, 5) * (0.7 + power * 0.4), r1: 0,
          color, kind: "spark", rot: a, add: true,
        });
      }
      // central flash star
      this.fore.spawn({ x, y, vx: 0, vy: 0, life: 0.16, r: 18 + power * 14, r1: 4, color: "#ffffff", kind: "star", rot: U.rand(0, U.TAU), vr: 8, add: true });
      this.fore.spawn({ x, y, vx: 0, vy: 0, life: 0.22, r: 10 + power * 10, r1: 2, color, kind: "ring", add: true });
      this.flash(color, 0.06 + power * 0.05);
    }
    blockSpark(x, y, dir) {
      for (let i = 0; i < 10; i++) {
        const a = U.rand(-0.7, 0.7) + (dir < 0 ? Math.PI : 0);
        const sp = U.rand(120, 280);
        this.ps.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 120, drag: 0.85, life: U.rand(0.1, 0.22), r: U.rand(2, 4), color: "#bfe6ff", kind: "spark", rot: a, add: true });
      }
      this.fore.spawn({ x, y, life: 0.14, r: 16, r1: 3, color: "#dff0ff", kind: "ring", add: true });
    }
    aura(x, y, color, intensity = 1) {
      for (let i = 0; i < intensity * 3; i++) {
        const a = U.rand(0, U.TAU), rr = U.rand(8, 40);
        this.ps.spawn({
          x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 1.4 + 10,
          vx: Math.cos(a) * 10, vy: -U.rand(60, 150), g: -30, drag: 0.95,
          life: U.rand(0.3, 0.6), r: U.rand(3, 7), r1: 0, color, kind: "dot", add: true,
        });
      }
    }
    chargeRing(x, y, color, pct) {
      this.fore.spawn({ x, y, life: 0.4, r: 60 * pct, r1: 12, color, kind: "ring", add: true });
    }
    fireballTrail(x, y, color, color2, dir) {
      for (let i = 0; i < 3; i++) {
        this.ps.spawn({
          x: x + U.rand(-6, 6), y: y + U.rand(-6, 6), vx: -dir * U.rand(20, 80) + U.rand(-20, 20), vy: U.rand(-40, 40),
          g: 0, drag: 0.9, life: U.rand(0.18, 0.34), r: U.rand(5, 11), r1: 0,
          color, color1: color2, kind: "dot", add: true,
        });
      }
    }
    explode(x, y, color, color2, n = 30, power = 1) {
      for (let i = 0; i < n; i++) {
        const a = U.rand(0, U.TAU), sp = U.rand(80, 420) * power;
        this.ps.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 80, drag: 0.88, life: U.rand(0.25, 0.6), r: U.rand(3, 9) * power, r1: 0, color, color1: color2, kind: U.chance(0.5) ? "spark" : "dot", rot: a, add: true });
      }
      this.fore.spawn({ x, y, life: 0.3, r: 40 * power, r1: 8, color: "#ffffff", kind: "ring", add: true });
      this.flash(color, 0.25 * power);
    }
    debris(x, y, color, n = 8) {
      for (let i = 0; i < n; i++) {
        const a = U.rand(-Math.PI, 0), sp = U.rand(120, 320);
        this.ps.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 700, drag: 0.99, life: U.rand(0.5, 1), r: U.rand(2, 5), color, kind: "dot", add: false });
      }
    }

    // ---------- update / draw ----------
    step(dt) {
      this.ps.step(dt); this.fore.step(dt);
      if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeMag = 0; }
      else this.shakeMag *= Math.pow(0.001, dt);
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.2);
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i]; t.life -= dt; t.y += t.vy * dt; t.vy *= Math.pow(0.4, dt);
        if (t.life <= 0) this.texts.splice(i, 1);
      }
    }
    shakeOffset() {
      if (this.shakeMag < 0.2) return { x: 0, y: 0 };
      return { x: U.rand(-1, 1) * this.shakeMag, y: U.rand(-1, 1) * this.shakeMag };
    }
    drawWorldBehind(ctx) { this.ps.draw(ctx); }
    drawWorldFront(ctx) { this.fore.draw(ctx); }
    drawTexts(ctx) {
      ctx.save();
      ctx.textAlign = "center";
      for (const t of this.texts) {
        const a = U.clamp(t.life / t.max, 0, 1);
        const sz = t.big ? 38 : 22;
        const pop = t.life > t.max - 0.12 ? U.map(t.life, t.max, t.max - 0.12, 1.5, 1) : 1;
        ctx.globalAlpha = a;
        ctx.font = `900 ${sz * pop}px "Trebuchet MS", sans-serif`;
        ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.8)";
        ctx.fillStyle = t.color;
        ctx.strokeText(t.txt, t.x, t.y);
        ctx.fillText(t.txt, t.x, t.y);
      }
      ctx.restore();
    }
    drawScreenFlash(ctx, w, h) {
      if (this.flashAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = this.flashAlpha;
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = this.flashColor;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    }
  }

  FP.Effects = Effects;
})(window);
