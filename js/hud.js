/* ============================================================
   hud.js — screen-space combat UI: health bars with delayed
   "chip ghost", super meters, timer, round pips, portraits and
   the big arcade announcer text.
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP, U = FP.U;

  class HUD {
    constructor(vw, vh) {
      this.vw = vw; this.vh = vh;
      this.ghost = [1, 1];      // delayed health %
      this.shown = [1, 1];      // smoothed health %
      this.meterShown = [0, 0];
      this.exShown = [0, 0];
      this.callouts = [null, null]; // per-side {text,color,t,life}
      this.announce = null;     // {text, color, t, life, scale}
    }
    reset() { this.ghost = [1, 1]; this.shown = [1, 1]; this.meterShown = [0, 0]; this.exShown = [0, 0]; this.callouts = [null, null]; this.announce = null; }

    setCallout(side, text, color) { this.callouts[side] = { text, color, t: 0, life: 0.85 }; }

    setAnnounce(text, color = "#ffd24a", life = 1.4, big = 1) {
      this.announce = { text, color, t: 0, life, big };
    }

    step(dt, fighters) {
      for (let i = 0; i < 2; i++) {
        const f = fighters[i];
        const hp = f.health / f.maxHP;
        this.shown[i] = U.approach(this.shown[i], hp, dt * 2.4);
        // ghost slowly catches up
        if (this.ghost[i] > this.shown[i]) this.ghost[i] = U.approach(this.ghost[i], this.shown[i], dt * 0.7);
        else this.ghost[i] = this.shown[i];
        this.meterShown[i] = U.approach(this.meterShown[i], f.meter / 100, dt * 3);
        this.exShown[i] = U.approach(this.exShown[i], (f.ex || 0) / 100, dt * 3);
        if (this.callouts[i]) { this.callouts[i].t += dt; if (this.callouts[i].t > this.callouts[i].life) this.callouts[i] = null; }
      }
      if (this.announce) {
        this.announce.t += dt;
        if (this.announce.t > this.announce.life) this.announce = null;
      }
    }

    draw(ctx, fighters, timer, roundsWon, bestOf) {
      const w = this.vw;
      this._bar(ctx, fighters[0], 0, false, this.shown[0], this.ghost[0]);
      this._bar(ctx, fighters[1], 1, true, this.shown[1], this.ghost[1]);
      this._timer(ctx, timer);
      this._pips(ctx, roundsWon, bestOf);
      this._superBars(ctx, fighters);
      this._combo(ctx, fighters);
      this._callouts(ctx);
      this._announce(ctx);
    }

    _callouts(ctx) {
      for (let i = 0; i < 2; i++) {
        const c = this.callouts[i];
        if (!c) continue;
        const mirror = i === 1;
        const x = mirror ? this.vw * 0.72 : this.vw * 0.28;
        const y = 168;
        const inS = U.easeOutBack(U.clamp(c.t / 0.18, 0, 1));
        const out = c.t > c.life - 0.2 ? U.map(c.t, c.life - 0.2, c.life, 1, 0) : 1;
        ctx.save();
        ctx.globalAlpha = out; ctx.translate(x, y); ctx.rotate(-0.06); ctx.scale(inS, inS);
        ctx.textAlign = "center";
        ctx.font = "900 italic 40px 'Trebuchet MS', sans-serif";
        ctx.lineWidth = 7; ctx.strokeStyle = "rgba(0,0,0,.85)";
        ctx.strokeText(c.text, 0, 0);
        const g = ctx.createLinearGradient(0, -22, 0, 22);
        g.addColorStop(0, "#fff"); g.addColorStop(0.55, c.color); g.addColorStop(1, U.shade(c.color, -0.35));
        ctx.fillStyle = g; ctx.fillText(c.text, 0, 0);
        ctx.restore();
      }
    }

    _bar(ctx, f, side, mirror, hp, ghost) {
      const w = this.vw, margin = 28, barW = w / 2 - 150, h = 26;
      const x = mirror ? w - margin - barW : margin + 96;
      const y = 30;
      ctx.save();
      // portrait
      this._portrait(ctx, f.char, mirror ? w - margin - 70 : margin, 18, 64, mirror);

      // frame
      const fx = mirror ? x : x;
      this._panel(ctx, fx - 4, y - 4, barW + 8, h + 8);
      // empty
      ctx.fillStyle = "#1a1a22"; this._rrect(ctx, fx, y, barW, h, 4); ctx.fill();

      const drawFill = (pct, grad, fromRight) => {
        const ww = barW * U.clamp(pct, 0, 1);
        const bx = fromRight ? fx + barW - ww : fx;
        ctx.fillStyle = grad; this._rrect(ctx, bx, y, ww, h, 4); ctx.fill();
      };
      // ghost (chip) in pale red/orange
      drawFill(ghost, "rgba(255,120,60,.55)", mirror);
      // health gradient
      const g = ctx.createLinearGradient(fx, y, fx, y + h);
      const c1 = hp > 0.3 ? "#7bdc4a" : "#ff5b5b", c2 = hp > 0.3 ? "#2f9e2a" : "#a01818";
      const top = hp > 0.55 ? "#d6ff8a" : hp > 0.3 ? "#ffe08a" : "#ff9a9a";
      g.addColorStop(0, top); g.addColorStop(0.5, c1); g.addColorStop(1, c2);
      drawFill(hp, g, mirror);
      // gloss
      ctx.fillStyle = "rgba(255,255,255,.18)";
      const gw = barW * U.clamp(hp, 0, 1);
      this._rrect(ctx, mirror ? fx + barW - gw : fx, y, gw, h * 0.42, 3); ctx.fill();
      // border
      ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 2;
      this._rrect(ctx, fx, y, barW, h, 4); ctx.stroke();

      // name + title
      ctx.fillStyle = "#fff"; ctx.font = "900 18px 'Trebuchet MS', sans-serif";
      ctx.textAlign = mirror ? "right" : "left";
      const nx = mirror ? fx + barW : fx;
      ctx.fillText(f.char.name, nx, y + h + 22);
      ctx.fillStyle = "#b9b9d0"; ctx.font = "italic 12px 'Trebuchet MS', sans-serif";
      ctx.fillText(f.char.title, nx, y + h + 38);
      ctx.restore();
    }

    _portrait(ctx, ch, x, y, s, mirror) {
      // use the supplied sprite-sheet portrait when available
      const sh = window.FP.Sprites && window.FP.Sprites.get(ch.id);
      const fr = window.FP.AtlasRyu && ch.id === "ryu" && window.FP.AtlasRyu.namedFrame("portrait");
      if (sh && sh.ready && sh.img && fr) {
        ctx.save();
        this._rrect(ctx, x, y, s, s, 6); ctx.clip();
        ctx.translate(mirror ? x + s : x, y); if (mirror) ctx.scale(-1, 1);
        try { ctx.drawImage(sh.img, fr.x, fr.y, fr.w, fr.h, 0, 0, s, s * (fr.h / fr.w)); } catch (e) {}
        ctx.restore();
        ctx.strokeStyle = ch.pal.trim; ctx.lineWidth = 3; this._rrect(ctx, x, y, s, s, 6); ctx.stroke();
        return;
      }
      ctx.save();
      ctx.translate(x, y);
      // frame
      const grd = ctx.createLinearGradient(0, 0, 0, s);
      grd.addColorStop(0, U.shade(ch.pal.gi, 0.2)); grd.addColorStop(1, ch.pal.giSh);
      this._rrect(ctx, 0, 0, s, s, 6); ctx.fillStyle = grd; ctx.fill();
      ctx.clip();
      // mini head
      ctx.translate(s / 2, s * 0.62);
      if (mirror) ctx.scale(-1, 1);
      const r = s * 0.32;
      // skin
      ctx.fillStyle = ch.pal.skin; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.1, 0, 0, U.TAU); ctx.fill();
      // hair
      ctx.fillStyle = ch.pal.hair;
      ctx.beginPath(); ctx.ellipse(-2, -r * 0.5, r * 1.05, r * 0.7, 0, Math.PI, U.TAU); ctx.fill();
      if (ch.style.mask) { ctx.fillStyle = ch.pal.gi; ctx.beginPath(); ctx.ellipse(0, r * 0.25, r, r * 0.8, 0, -0.2, Math.PI + 0.2); ctx.fill(); }
      if (ch.style.headband) { ctx.fillStyle = ch.pal.band; ctx.fillRect(-r, -r * 0.55, r * 2, r * 0.4); }
      // eye
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(r * 0.35, -r * 0.05, r * 0.16, 0, U.TAU); ctx.fill();
      ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(r * 0.4, -r * 0.05, r * 0.08, 0, U.TAU); ctx.fill();
      ctx.restore();
      // border
      ctx.strokeStyle = ch.pal.trim; ctx.lineWidth = 3; this._rrect(ctx, x, y, s, s, 6); ctx.stroke();
    }

    _timer(ctx, timer) {
      const w = this.vw, cx = w / 2, y = 30;
      this._panel(ctx, cx - 46, y - 6, 92, 56);
      ctx.fillStyle = timer <= 10 ? "#ff5b5b" : "#ffd24a";
      ctx.font = "900 46px 'Trebuchet MS', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const v = Math.max(0, Math.ceil(timer));
      ctx.fillText((v < 10 ? "0" : "") + v, cx, y + 26);
      ctx.textBaseline = "alphabetic";
    }

    _pips(ctx, roundsWon, bestOf) {
      const w = this.vw, cx = w / 2, y = 76;
      const need = Math.ceil(bestOf / 2);
      const cols = ["#3fb6ff", "#ff5b5b"];
      for (let side = 0; side < 2; side++) {
        const dir = side === 0 ? -1 : 1;
        // P1 / P2 round badge
        ctx.fillStyle = cols[side];
        const bx = cx + dir * (24 + need * 19) - (side === 0 ? 26 : -6);
        ctx.save(); ctx.globalAlpha = 0.9;
        this._rrect(ctx, side === 0 ? cx - 24 - need * 19 - 4 : cx + 24 + need * 19 - 16, y - 9, 22, 18, 3); ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#06080f"; ctx.font = "900 11px 'Trebuchet MS'"; ctx.textAlign = "center";
        ctx.fillText(side === 0 ? "P1" : "P2", side === 0 ? cx - 24 - need * 19 + 7 : cx + 24 + need * 19 - 5, y + 4);
        // win stars
        for (let i = 0; i < need; i++) {
          const px = cx + dir * (24 + i * 19);
          const won = roundsWon[side] > i;
          this._star(ctx, px, y, 7.5, won ? cols[side] : "rgba(255,255,255,.16)", won);
        }
      }
    }
    _star(ctx, x, y, r, color, glow) {
      ctx.save(); ctx.translate(x, y);
      if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 8; }
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * (U.TAU / 5);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        const a2 = a + U.TAU / 10;
        ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
      }
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }

    _superBars(ctx, fighters) {
      const w = this.vw, bw = 280, h = 15, exH = 8, y = this.vh - 34;
      for (let i = 0; i < 2; i++) {
        const mirror = i === 1;
        const x = mirror ? w - 28 - bw : 28;
        const pct = this.meterShown[i];
        const exPct = this.exShown[i];
        this._panel(ctx, x - 4, y - 4, bw + 8, h + exH + 9);

        // ---- SUPER BAR (4 segments) ----
        ctx.fillStyle = "#12121a"; this._rrect(ctx, x, y, bw, h, 3); ctx.fill();
        const ww = bw * pct, bx = mirror ? x + bw - ww : x;
        const full = pct >= 1;
        const g = ctx.createLinearGradient(x, y, x, y + h);
        if (full) { g.addColorStop(0, "#fff7c0"); g.addColorStop(0.5, fighters[i].char.auraColor); g.addColorStop(1, fighters[i].char.pal.energy2); }
        else { g.addColorStop(0, "#8fd0ff"); g.addColorStop(1, "#2a6ab3"); }
        ctx.fillStyle = g; this._rrect(ctx, bx, y, ww, h, 3); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 1;
        for (let s = 1; s < 4; s++) { const sx = x + bw * s / 4; ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx, y + h); ctx.stroke(); }
        ctx.strokeStyle = full ? "#ffe98a" : "rgba(255,255,255,.3)"; ctx.lineWidth = 2; this._rrect(ctx, x, y, bw, h, 3); ctx.stroke();
        // label
        ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.font = "900 9px 'Trebuchet MS'"; ctx.textAlign = mirror ? "right" : "left";
        ctx.fillText("SUPER", mirror ? x + bw : x, y - 6);

        // ---- EX BAR (thinner, beneath) ----
        const ey = y + h + 3, ebw = bw * 0.62, ex0 = mirror ? x + bw - ebw : x;
        ctx.fillStyle = "#0e1018"; this._rrect(ctx, ex0, ey, ebw, exH, 2); ctx.fill();
        const eww = ebw * exPct, ebx = mirror ? ex0 + ebw - eww : ex0;
        const exFull = exPct >= 0.5;
        const eg = ctx.createLinearGradient(ex0, ey, ex0, ey + exH);
        eg.addColorStop(0, exFull ? "#a6f0ff" : "#5fb0d0"); eg.addColorStop(1, "#1d6fa0");
        ctx.fillStyle = eg; this._rrect(ctx, ebx, ey, eww, exH, 2); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 1;
        const mid = ex0 + ebw / 2; ctx.beginPath(); ctx.moveTo(mid, ey); ctx.lineTo(mid, ey + exH); ctx.stroke();
        ctx.strokeStyle = "rgba(120,200,255,.4)"; this._rrect(ctx, ex0, ey, ebw, exH, 2); ctx.stroke();
        ctx.fillStyle = "rgba(150,210,255,.7)"; ctx.font = "900 8px 'Trebuchet MS'";
        ctx.fillText("EX", mirror ? ex0 + ebw : ex0, ey + exH + 8);

        if (full) {
          ctx.fillStyle = "#ffe98a"; ctx.font = "900 12px 'Trebuchet MS'"; ctx.textAlign = "center";
          const blink = 0.5 + 0.5 * Math.sin(performance.now() / 120);
          ctx.globalAlpha = blink; ctx.fillText("SUPER READY", x + bw / 2, y - 6); ctx.globalAlpha = 1;
        }
      }
    }

    _combo(ctx, fighters) {
      for (let i = 0; i < 2; i++) {
        const f = fighters[i];
        if (f.comboHits >= 2 && f.comboTimer > 0) {
          const mirror = i === 1;
          const x = mirror ? this.vw - 120 : 120;
          const y = 130;
          ctx.save(); ctx.textAlign = "center";
          const pop = 1 + 0.2 * Math.sin(f.comboTimer * 0.6);
          ctx.font = `900 ${34 * pop}px 'Trebuchet MS'`;
          ctx.fillStyle = "#ffd24a"; ctx.strokeStyle = "#000"; ctx.lineWidth = 4;
          ctx.strokeText(f.comboHits + "", x, y); ctx.fillText(f.comboHits + "", x, y);
          ctx.font = "900 16px 'Trebuchet MS'"; ctx.fillStyle = "#fff";
          ctx.strokeText("HITS", x + 34, y); ctx.fillText("HITS", x + 34, y);
          ctx.restore();
        }
      }
    }

    _announce(ctx) {
      if (!this.announce) return;
      const a = this.announce, w = this.vw, cx = w / 2, cy = this.vh * 0.4;
      const t = a.t / a.life;
      const inS = U.easeOutBack(U.clamp(a.t / 0.3, 0, 1));
      const out = t > 0.8 ? U.map(t, 0.8, 1, 1, 0) : 1;
      ctx.save();
      ctx.globalAlpha = out;
      ctx.translate(cx, cy);
      ctx.scale(inS * a.big, inS * a.big);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "900 italic 84px 'Trebuchet MS', sans-serif";
      ctx.lineWidth = 10; ctx.strokeStyle = "rgba(0,0,0,.85)";
      ctx.strokeText(a.text, 0, 0);
      const grd = ctx.createLinearGradient(0, -40, 0, 40);
      grd.addColorStop(0, "#fff"); grd.addColorStop(0.5, a.color); grd.addColorStop(1, U.shade(a.color, -0.3));
      ctx.fillStyle = grd; ctx.fillText(a.text, 0, 0);
      ctx.restore();
      ctx.textBaseline = "alphabetic";
    }

    // helpers
    _rrect(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    _panel(ctx, x, y, w, h) {
      ctx.save();
      ctx.fillStyle = "rgba(8,8,14,.72)";
      this._rrect(ctx, x, y, w, h, 6); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 1.5;
      this._rrect(ctx, x, y, w, h, 6); ctx.stroke();
      ctx.restore();
    }
  }

  FP.HUD = HUD;
})(window);
