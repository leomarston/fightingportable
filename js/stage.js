/* ============================================================
   stage.js — procedural parallax stages. Backgrounds are drawn in
   screen space (scrolled by camera) for depth; the floor is drawn
   in world space so fighters stand on it correctly.
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP, U = FP.U;

  class Stage {
    constructor(id, worldW, groundY, vw, vh) {
      this.id = id;
      this.worldW = worldW;
      this.groundY = groundY;
      this.vw = vw; this.vh = vh;
      this.t = 0;
      this.petals = [];
      this.embers = [];
      this.gulls = [];
      if (id === "temple") for (let i = 0; i < 40; i++) this.petals.push(this._petal(true));
      if (id === "harbor") for (let i = 0; i < 30; i++) this.embers.push(this._ember(true));
    }
    _petal(init) {
      return {
        x: U.rand(0, this.worldW), y: init ? U.rand(0, this.groundY) : -20,
        vx: U.rand(-30, -8), vy: U.rand(20, 55), s: U.rand(3, 7),
        rot: U.rand(0, U.TAU), vr: U.rand(-3, 3), sway: U.rand(0, U.TAU), z: U.rand(0.4, 1),
      };
    }
    _ember(init) {
      return { x: U.rand(0, this.worldW), y: init ? U.rand(0, this.groundY) : this.groundY, vx: U.rand(-8, 8), vy: U.rand(-30, -10), s: U.rand(1.5, 3.5), life: U.rand(0, 1), z: U.rand(0.4, 1) };
    }

    step(dt) {
      this.t += dt;
      for (const p of this.petals) {
        p.sway += dt * 2;
        p.x += (p.vx + Math.sin(p.sway) * 18) * dt;
        p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.y > this.groundY + 10 || p.x < -20) Object.assign(p, this._petal(false), { x: U.rand(0, this.worldW) });
      }
      for (const e of this.embers) {
        e.x += e.vx * dt; e.y += e.vy * dt; e.life += dt * 0.6;
        if (e.y < this.groundY - 260 || e.life > 1) Object.assign(e, this._ember(false));
      }
    }

    // ---------- background (screen space) ----------
    drawBackground(ctx, cam) {
      if (this.id === "harbor") return this._harborBG(ctx, cam);
      return this._templeBG(ctx, cam);
    }

    _scroll(cam, factor) {
      // how far camera has moved from world centre, scaled by depth factor
      return -(cam.x - this.worldW / 2) * factor;
    }

    _templeBG(ctx, cam) {
      const w = this.vw, h = this.vh;
      // sky gradient (sunset)
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#3a2a6b");
      sky.addColorStop(0.35, "#9b4d8a");
      sky.addColorStop(0.6, "#e98c5a");
      sky.addColorStop(0.85, "#ffd98a");
      sky.addColorStop(1, "#ffe9b0");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

      // sun
      const sx = w * 0.5 + this._scroll(cam, 0.04), sy = h * 0.52;
      const sun = ctx.createRadialGradient(sx, sy, 10, sx, sy, 160);
      sun.addColorStop(0, "rgba(255,247,210,1)");
      sun.addColorStop(0.4, "rgba(255,210,120,.9)");
      sun.addColorStop(1, "rgba(255,170,90,0)");
      ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(sx, sy, 160, 0, U.TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,250,225,.95)"; ctx.beginPath(); ctx.arc(sx, sy, 46, 0, U.TAU); ctx.fill();

      // distant mountains
      this._mountains(ctx, this._scroll(cam, 0.08), h * 0.55, "#5b3d70", 0.55);
      this._mountains(ctx, this._scroll(cam, 0.13), h * 0.6, "#7a4a6e", 0.42);

      // clouds
      ctx.fillStyle = "rgba(255,220,200,.45)";
      const co = this._scroll(cam, 0.06);
      for (let i = 0; i < 6; i++) {
        const cx = (i * 320 + this.t * 6 + co) % (w + 400) - 200;
        this._cloud(ctx, cx, h * (0.18 + (i % 3) * 0.07), 60 + (i % 3) * 30);
      }

      // pagoda / temple skyline (mid)
      const m1 = this._scroll(cam, 0.22);
      this._templeSkyline(ctx, m1, h, "#3c2746", 0.85);
      // closer temple buildings + torii
      const m2 = this._scroll(cam, 0.4);
      this._templeMid(ctx, m2, h);

      // cherry trees (foreground-ish)
      const m3 = this._scroll(cam, 0.6);
      this._cherryTrees(ctx, m3, h);
    }

    _mountains(ctx, off, baseY, color, alpha) {
      ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(-100, baseY);
      let x = -100; const seed = 7;
      let r = U.rng(seed);
      while (x < this.vw + 200) {
        const peak = baseY - (60 + r() * 130);
        ctx.lineTo(x + 90 + off * 0.0, peak);
        x += 150 + r() * 80;
        ctx.lineTo(x + off * 0.0, baseY);
      }
      ctx.lineTo(this.vw + 200, this.vh); ctx.lineTo(-100, this.vh); ctx.closePath();
      ctx.translate(off % 1, 0); ctx.fill(); ctx.restore();
    }
    _cloud(ctx, x, y, r) {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.6, 0, U.TAU);
      ctx.arc(x + r * 0.7, y + 6, r * 0.5, 0, U.TAU);
      ctx.arc(x - r * 0.7, y + 8, r * 0.45, 0, U.TAU);
      ctx.arc(x, y + 14, r * 0.7, 0, U.TAU);
      ctx.fill();
    }
    _templeSkyline(ctx, off, h, color, a) {
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = color;
      const baseY = h * 0.66;
      let r = U.rng(21);
      for (let x = -200; x < this.worldW + 200; x += 230) {
        const bx = x + off; const bw = 120 + r() * 60; const bh = 120 + r() * 120;
        this._pagoda(ctx, bx, baseY, bw, bh, color, color);
      }
      ctx.restore();
    }
    _pagoda(ctx, x, baseY, w, h, body, roof) {
      const tiers = 3;
      ctx.fillStyle = body;
      for (let i = 0; i < tiers; i++) {
        const tw = w * (1 - i * 0.22), ty = baseY - h * (i / tiers) - h / tiers;
        const th = h / tiers * 0.7;
        ctx.fillRect(x - tw / 2, ty, tw, th);
        // roof
        ctx.beginPath();
        ctx.moveTo(x - tw / 2 - 14, ty);
        ctx.quadraticCurveTo(x, ty - th * 0.7, x + tw / 2 + 14, ty);
        ctx.quadraticCurveTo(x, ty - th * 0.25, x - tw / 2 - 14, ty);
        ctx.fill();
      }
    }
    _templeMid(ctx, off, h) {
      const baseY = h * 0.72;
      // big torii gate
      const tx = this.worldW * 0.5 + off;
      ctx.save();
      ctx.fillStyle = "#7a1f1a";
      // pillars
      ctx.fillRect(tx - 110, baseY - 150, 22, 150);
      ctx.fillRect(tx + 90, baseY - 150, 22, 150);
      // top beams
      ctx.fillRect(tx - 140, baseY - 158, 280, 16);
      ctx.beginPath();
      ctx.moveTo(tx - 160, baseY - 150); ctx.lineTo(tx + 160, baseY - 150);
      ctx.lineTo(tx + 150, baseY - 138); ctx.lineTo(tx - 150, baseY - 138); ctx.closePath(); ctx.fill();
      ctx.fillRect(tx - 120, baseY - 124, 240, 12);
      ctx.fillStyle = "#5a1612";
      ctx.fillRect(tx - 16, baseY - 142, 32, 30);
      ctx.restore();

      // side pagodas closer/darker
      ctx.save(); ctx.globalAlpha = 0.95;
      this._pagoda(ctx, tx - 360, baseY + 10, 150, 200, "#5a3550", "#3a2038");
      this._pagoda(ctx, tx + 360, baseY + 10, 150, 200, "#5a3550", "#3a2038");
      ctx.restore();
    }
    _cherryTrees(ctx, off, h) {
      const baseY = h * 0.84;
      for (const side of [-1, 1]) {
        const x = this.worldW * 0.5 + side * 520 + off;
        // trunk
        ctx.strokeStyle = "#3a2418"; ctx.lineWidth = 16; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x, baseY); ctx.quadraticCurveTo(x + side * 20, baseY - 60, x + side * 50, baseY - 110); ctx.stroke();
        ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(x + side * 30, baseY - 80); ctx.lineTo(x + side * 80, baseY - 130); ctx.stroke();
        // blossoms
        for (let i = 0; i < 22; i++) {
          const bx = x + side * U.rand(0, 130), by = baseY - U.rand(80, 200);
          const r = U.rand(16, 30);
          ctx.fillStyle = U.chance(0.5) ? "rgba(255,183,209,.92)" : "rgba(255,205,224,.92)";
          ctx.beginPath(); ctx.arc(bx, by, r, 0, U.TAU); ctx.fill();
        }
      }
    }

    // ---------- harbor night ----------
    _harborBG(ctx, cam) {
      const w = this.vw, h = this.vh;
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#04060f"); sky.addColorStop(0.5, "#0a1430"); sky.addColorStop(1, "#13294a");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      // moon
      const mx = w * 0.7 + this._scroll(cam, 0.03), my = h * 0.24;
      const mg = ctx.createRadialGradient(mx, my, 6, mx, my, 120);
      mg.addColorStop(0, "rgba(220,235,255,1)"); mg.addColorStop(0.3, "rgba(180,210,255,.7)"); mg.addColorStop(1, "rgba(120,160,230,0)");
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 120, 0, U.TAU); ctx.fill();
      ctx.fillStyle = "#eef4ff"; ctx.beginPath(); ctx.arc(mx, my, 40, 0, U.TAU); ctx.fill();
      // stars
      let r = U.rng(99);
      ctx.fillStyle = "rgba(255,255,255,.8)";
      for (let i = 0; i < 90; i++) { const x = r() * w, y = r() * h * 0.5; ctx.globalAlpha = 0.3 + r() * 0.7 * (0.6 + 0.4 * Math.sin(this.t * 2 + i)); ctx.fillRect(x, y, 2, 2); }
      ctx.globalAlpha = 1;
      // skyline with windows
      this._cityline(ctx, this._scroll(cam, 0.18), h, "#0a1830", 0.95);
      this._cityline(ctx, this._scroll(cam, 0.32), h, "#0e2240", 1);
      // cranes
      this._cranes(ctx, this._scroll(cam, 0.5), h);
    }
    _cityline(ctx, off, h, color, a) {
      ctx.save(); ctx.globalAlpha = a; const baseY = h * 0.7;
      let r = U.rng(color.length * 13);
      for (let x = -200; x < this.worldW + 200; x += 90) {
        const bw = 60 + r() * 30, bh = 90 + r() * 220;
        ctx.fillStyle = color; ctx.fillRect(x + off, baseY - bh, bw, bh);
        // windows
        for (let wy = baseY - bh + 14; wy < baseY - 14; wy += 22)
          for (let wx = x + off + 8; wx < x + off + bw - 8; wx += 16)
            if (r() > 0.55) { ctx.fillStyle = U.chance(0.5) ? "rgba(255,210,120,.8)" : "rgba(150,200,255,.7)"; ctx.fillRect(wx, wy, 7, 10); }
      }
      ctx.restore();
    }
    _cranes(ctx, off, h) {
      const baseY = h * 0.72;
      for (const side of [-1, 1]) {
        const x = this.worldW * 0.5 + side * 500 + off;
        ctx.strokeStyle = "#b34a2a"; ctx.lineWidth = 8; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x, baseY - 160); ctx.lineTo(x + side * 130, baseY - 150); ctx.stroke();
        ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + side * 100, baseY - 150); ctx.lineTo(x + side * 100, baseY - 100); ctx.stroke();
      }
    }

    // ---------- floor (world space) ----------
    drawFloor(ctx) {
      const g = this.groundY, w = this.worldW;
      if (this.id === "harbor") {
        // wet dock
        const grd = ctx.createLinearGradient(0, g, 0, g + 160);
        grd.addColorStop(0, "#22344f"); grd.addColorStop(1, "#0c1626");
        ctx.fillStyle = grd; ctx.fillRect(-200, g, w + 400, 200);
        ctx.strokeStyle = "rgba(120,170,230,.18)"; ctx.lineWidth = 2;
        for (let x = -200; x < w + 200; x += 60) { ctx.beginPath(); ctx.moveTo(x, g); ctx.lineTo(x - 30, g + 160); ctx.stroke(); }
        // reflection strip
        ctx.fillStyle = "rgba(120,170,230,.07)"; ctx.fillRect(-200, g + 6, w + 400, 10);
      } else {
        // stone temple ground
        const grd = ctx.createLinearGradient(0, g, 0, g + 160);
        grd.addColorStop(0, "#6b5640"); grd.addColorStop(0.4, "#4f3f2e"); grd.addColorStop(1, "#2c2218");
        ctx.fillStyle = grd; ctx.fillRect(-200, g, w + 400, 200);
        // tile lines with simple perspective
        ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 2;
        for (let x = -200; x < w + 200; x += 80) {
          ctx.beginPath(); ctx.moveTo(x, g); ctx.lineTo(x + (x - w / 2) * 0.25, g + 170); ctx.stroke();
        }
        for (let i = 1; i < 5; i++) {
          const yy = g + i * 32;
          ctx.beginPath(); ctx.moveTo(-200, yy); ctx.lineTo(w + 200, yy); ctx.stroke();
        }
      }
      // top edge highlight
      ctx.fillStyle = "rgba(255,240,200,.12)"; ctx.fillRect(-200, g - 2, w + 400, 3);
      // soft vignette of arena bounds
    }

    drawForeground(ctx, cam) {
      // petals / embers drawn in world space (called inside camera transform)
      if (this.id === "temple") {
        for (const p of this.petals) {
          ctx.save(); ctx.globalAlpha = 0.85 * p.z; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = U.chance(0.5) ? "#ffc2d6" : "#ffd6e6";
          ctx.beginPath();
          ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, U.TAU); ctx.fill();
          ctx.restore();
        }
      } else {
        ctx.globalCompositeOperation = "lighter";
        for (const e of this.embers) {
          ctx.globalAlpha = (1 - e.life) * 0.8 * e.z;
          ctx.fillStyle = U.chance(0.5) ? "#ffb04a" : "#ff7a2a";
          ctx.beginPath(); ctx.arc(e.x, e.y, e.s, 0, U.TAU); ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      }
    }

    // lanterns etc. drawn behind fighters but in world space
    drawProps(ctx) {
      if (this.id === "temple") {
        // hanging lanterns near edges with glow
        for (const x of [this.worldW * 0.18, this.worldW * 0.82]) {
          this._lantern(ctx, x, this.groundY - 220);
        }
        // barrels & crates near the walls (from asset sheet's stage objects)
        this._barrel(ctx, 70, this.groundY);
        this._crate(ctx, this.worldW - 90, this.groundY);
        this._crate(ctx, this.worldW - 130, this.groundY, 0.8);
      } else {
        for (const x of [this.worldW * 0.2, this.worldW * 0.8]) this._dockLamp(ctx, x, this.groundY - 200);
        this._container(ctx, 80, this.groundY, "#b34a2a");
        this._container(ctx, this.worldW - 110, this.groundY, "#2a6ab3");
      }
    }
    _lantern(ctx, x, y) {
      ctx.save();
      ctx.strokeStyle = "#222"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - 60); ctx.lineTo(x, y); ctx.stroke();
      const glow = ctx.createRadialGradient(x, y + 16, 4, x, y + 16, 70);
      glow.addColorStop(0, "rgba(255,170,90,.6)"); glow.addColorStop(1, "rgba(255,170,90,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y + 16, 70, 0, U.TAU); ctx.fill();
      ctx.fillStyle = "#d8403a";
      ctx.beginPath(); ctx.ellipse(x, y + 16, 16, 22, 0, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.3)";
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x - 16, y + 16 + i * 7); ctx.lineTo(x + 16, y + 16 + i * 7); ctx.stroke(); }
      ctx.restore();
    }
    _barrel(ctx, x, g) {
      ctx.save(); ctx.fillStyle = "#6b4a2a"; ctx.translate(x, g);
      ctx.beginPath(); ctx.ellipse(0, -28, 22, 30, 0, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = "#3a2614"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, -28, 22, 8, 0, 0, U.TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -50, 19, 6, 0, 0, U.TAU); ctx.stroke();
      ctx.restore();
    }
    _crate(ctx, x, g, s = 1) {
      ctx.save(); ctx.translate(x, g); ctx.scale(s, s);
      ctx.fillStyle = "#7a5630"; ctx.fillRect(-26, -52, 52, 52);
      ctx.strokeStyle = "#4a3216"; ctx.lineWidth = 4; ctx.strokeRect(-26, -52, 52, 52);
      ctx.beginPath(); ctx.moveTo(-26, -52); ctx.lineTo(26, 0); ctx.moveTo(26, -52); ctx.lineTo(-26, 0); ctx.stroke();
      ctx.restore();
    }
    _container(ctx, x, g, col) {
      ctx.save(); ctx.translate(x, g); ctx.fillStyle = col; ctx.fillRect(-46, -64, 92, 64);
      ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 3;
      for (let i = -40; i < 46; i += 10) { ctx.beginPath(); ctx.moveTo(i, -64); ctx.lineTo(i, 0); ctx.stroke(); }
      ctx.strokeRect(-46, -64, 92, 64); ctx.restore();
    }
    _dockLamp(ctx, x, y) {
      ctx.save(); ctx.strokeStyle = "#333"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, y + 200); ctx.lineTo(x, y); ctx.stroke();
      const glow = ctx.createRadialGradient(x, y, 4, x, y, 80);
      glow.addColorStop(0, "rgba(180,210,255,.5)"); glow.addColorStop(1, "rgba(180,210,255,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 80, 0, U.TAU); ctx.fill();
      ctx.fillStyle = "#dfeaff"; ctx.beginPath(); ctx.arc(x, y, 7, 0, U.TAU); ctx.fill();
      ctx.restore();
    }
  }

  FP.Stage = Stage;
})(window);
