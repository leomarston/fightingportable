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
      this.announce = null;     // {text, color, t, life, scale}
    }
    reset() { this.ghost = [1, 1]; this.shown = [1, 1]; this.meterShown = [0, 0]; this.announce = null; }

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
      this._announce(ctx);
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
      const w = this.vw, cx = w / 2, y = 74;
      const need = Math.ceil(bestOf / 2);
      for (let side = 0; side < 2; side++) {
        for (let i = 0; i < need; i++) {
          const dir = side === 0 ? -1 : 1;
          const px = cx + dir * (40 + i * 18);
          ctx.beginPath(); ctx.arc(px, y, 6, 0, U.TAU);
          ctx.fillStyle = (roundsWon[side] > i) ? (side === 0 ? "#3fb6ff" : "#ff5b5b") : "rgba(255,255,255,.18)";
          ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
    }

    _superBars(ctx, fighters) {
      const w = this.vw, bw = 280, h = 14, y = this.vh - 30;
      for (let i = 0; i < 2; i++) {
        const mirror = i === 1;
        const x = mirror ? w - 28 - bw : 28;
        const pct = this.meterShown[i];
        this._panel(ctx, x - 3, y - 3, bw + 6, h + 6);
        ctx.fillStyle = "#12121a"; this._rrect(ctx, x, y, bw, h, 3); ctx.fill();
        const ww = bw * pct;
        const bx = mirror ? x + bw - ww : x;
        const full = pct >= 1;
        const g = ctx.createLinearGradient(x, y, x, y + h);
        if (full) { g.addColorStop(0, "#fff7c0"); g.addColorStop(0.5, fighters[i].char.auraColor); g.addColorStop(1, fighters[i].char.pal.energy2); }
        else { g.addColorStop(0, "#8fd0ff"); g.addColorStop(1, "#2a6ab3"); }
        ctx.fillStyle = g; this._rrect(ctx, bx, y, ww, h, 3); ctx.fill();
        // segment ticks
        ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 1;
        for (let s = 1; s < 4; s++) { const sx = x + bw * s / 4; ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx, y + h); ctx.stroke(); }
        ctx.strokeStyle = full ? "#ffe98a" : "rgba(255,255,255,.3)"; ctx.lineWidth = 2; this._rrect(ctx, x, y, bw, h, 3); ctx.stroke();
        if (full) {
          ctx.fillStyle = "#ffe98a"; ctx.font = "900 13px 'Trebuchet MS'"; ctx.textAlign = mirror ? "right" : "left";
          const tx = mirror ? x + bw : x;
          const blink = 0.5 + 0.5 * Math.sin(performance.now() / 120);
          ctx.globalAlpha = blink; ctx.fillText("SUPER READY", tx, y - 8); ctx.globalAlpha = 1;
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
