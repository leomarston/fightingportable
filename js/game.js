/* ============================================================
   game.js — top-level flow: title menu, character select, VS
   splash, the fight (Match), and results. Runs on a fixed 60 Hz
   step driven by main.js.
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP, U = FP.U, A = FP.Skeleton.A;

  const STAGES = [
    { id: "temple", name: "DOWNTOWN TEMPLE" },
    { id: "harbor", name: "HARBOR NIGHT" },
  ];
  const MODES = [
    { id: "arcade", label: "ARCADE", sub: "1P · climb the ladder vs CPU" },
    { id: "versus", label: "VERSUS", sub: "2P · local head to head" },
    { id: "cpu", label: "CPU BATTLE", sub: "watch the AI fight" },
    { id: "training", label: "TRAINING", sub: "1P · endless vs a dummy" },
  ];

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.vw = canvas.width; this.vh = canvas.height;
      this.frame = 0;
      this.screen = "title";
      this.menuIndex = 0;
      this.difficulty = 0.62;
      this.bgStage = new FP.Stage("temple", 1760, 600, this.vw, this.vh);
      this.bgCam = new FP.Camera(this.vw, this.vh, 1760);
      this.bgCam.snap();
      this.fade = 1; this.fadeDir = -1; // fade in
      this.next = null;
      this.sel = { p1: 0, p2: 4, lockP1: false, lockP2: false, stage: 0 };
      this.mode = "arcade";
      this.ladder = null;
      this.match = null;
      this.t = 0;
      this.titleAnim = 0;
    }

    start() { this.toScreen("title"); }

    toScreen(s) { this.next = s; this.fadeDir = 1; }
    _enter(s) {
      this.screen = s; this.frame = 0;
      if (s === "title") { FP.Audio.stopMusic(); this.menuIndex = 0; }
      if (s === "select") { this.sel.lockP1 = false; this.sel.lockP2 = false; }
      if (s === "vs") this._vsT = 0;
      if (s === "fight") this.startMatch();
      if (s === "result") this._resT = 0;
    }

    // ---------------- fixed update ----------------
    fixedUpdate() {
      this.frame++; this.t += FP.DT;
      this.titleAnim += FP.DT;
      // background eye-candy drift
      this.bgStage.step(FP.DT);
      this.bgCam.x = 1760 / 2 + Math.sin(this.t * 0.15) * 220;
      this.bgCam.targetZoom = 1; this.bgCam.step(FP.DT);

      // fade handling
      if (this.fadeDir === 1) {
        this.fade = Math.min(1, this.fade + FP.DT * 3.2);
        if (this.fade >= 1 && this.next) { this._enter(this.next); this.next = null; this.fadeDir = -1; }
      } else if (this.fadeDir === -1) {
        this.fade = Math.max(0, this.fade - FP.DT * 3.2);
      }

      switch (this.screen) {
        case "title": this.updTitle(); break;
        case "select": this.updSelect(); break;
        case "vs": this.updVS(); break;
        case "fight": if (this.match) this.match.step(); break;
        case "result": this.updResult(); break;
      }
      // NB: FP.Input.advance() is called centrally by main.js after this.
    }

    // ---------------- TITLE ----------------
    updTitle() {
      const p = FP.Input.p1;
      if (p.pressed.up) { this.menuIndex = (this.menuIndex + MODES.length - 1) % MODES.length; FP.Audio.select(); }
      if (p.pressed.down) { this.menuIndex = (this.menuIndex + 1) % MODES.length; FP.Audio.select(); }
      if (p.pressed.left) { this.difficulty = U.clamp(this.difficulty - 0.13, 0.2, 1); FP.Audio.select(); }
      if (p.pressed.right) { this.difficulty = U.clamp(this.difficulty + 0.13, 0.2, 1); FP.Audio.select(); }
      if (this.confirm()) {
        this.mode = MODES[this.menuIndex].id;
        FP.Audio.confirm();
        this.toScreen("select");
      }
    }

    confirm() {
      const p = FP.Input.p1, p2 = FP.Input.p2;
      const c = (pad) => pad.pressed.start || pad.pressed.lp || pad.pressed.mp || pad.pressed.hp;
      return c(p) || c(p2) || FP.Input.consumeStart();
    }

    // ---------------- CHARACTER SELECT ----------------
    updSelect() {
      const R = FP.ROSTER;
      const moveCur = (pad, key, dir) => {
        if (pad.pressed.left) this.sel[key] = (this.sel[key] + R.length - 1) % R.length;
        if (pad.pressed.right) this.sel[key] = (this.sel[key] + 1) % R.length;
      };
      // P1 always selects
      if (!this.sel.lockP1) {
        moveCur(FP.Input.p1, "p1");
        if (FP.Input.p1.pressed.left || FP.Input.p1.pressed.right) FP.Audio.select();
        if (this.confirmPad(FP.Input.p1)) { this.sel.lockP1 = true; FP.Audio.confirm(); }
      }
      // P2 selects only in VERSUS
      const p2human = this.mode === "versus";
      if (p2human && !this.sel.lockP2) {
        if (FP.Input.p2.pressed.left) this.sel.p2 = (this.sel.p2 + R.length - 1) % R.length;
        if (FP.Input.p2.pressed.right) this.sel.p2 = (this.sel.p2 + 1) % R.length;
        if (FP.Input.p2.pressed.left || FP.Input.p2.pressed.right) FP.Audio.select();
        if (this.confirmPad(FP.Input.p2)) { this.sel.lockP2 = true; FP.Audio.confirm(); }
      }
      // back out
      if (FP.Input.p1.pressed.down && this.sel.lockP1 === false) {}

      const ready = this.sel.lockP1 && (!p2human || this.sel.lockP2);
      if (ready && !this._goneVS) {
        this._goneVS = true;
        // pick opponents
        if (this.mode === "arcade") {
          const others = FP.ROSTER.map((_, i) => i).filter((i) => i !== this.sel.p1);
          for (let i = others.length - 1; i > 0; i--) { const j = U.randInt(0, i);[others[i], others[j]] = [others[j], others[i]]; }
          this.ladder = { list: others, step: 0 };
          this.sel.p2 = others[0];
        } else if (this.mode === "cpu") {
          this.sel.p2 = (this.sel.p1 + 1 + U.randInt(0, 3)) % FP.ROSTER.length;
        } else if (this.mode === "training") {
          this.sel.p2 = (this.sel.p1 + 1) % FP.ROSTER.length;
        }
        this.sel.stage = U.randInt(0, STAGES.length - 1);
        this.toScreen("vs");
      } else if (!ready) { this._goneVS = false; }
    }
    confirmPad(pad) { return pad.pressed.start || pad.pressed.lp || pad.pressed.mp || pad.pressed.hp || pad.pressed.lk; }

    // ---------------- VS SPLASH ----------------
    updVS() {
      this._vsT = (this._vsT || 0) + FP.DT;
      if (this._vsT === FP.DT) FP.Audio.confirm();
      if (this._vsT > 1.9 || this.confirm()) { if (!this._toFight) { this._toFight = true; this.toScreen("fight"); } }
      if (this.screen !== "vs") this._toFight = false;
    }

    // ---------------- FIGHT ----------------
    startMatch() {
      this._toFight = false;
      const cpu = [false, false];
      if (this.mode === "arcade") cpu[1] = true;
      if (this.mode === "training") cpu[1] = true;
      if (this.mode === "cpu") { cpu[0] = true; cpu[1] = true; }

      const pads = [FP.Input.p1, FP.Input.p2];
      // CPU players need their own virtual pad (not the human one)
      if (cpu[0]) pads[0] = new FP.PlayerInput({});
      if (cpu[1]) pads[1] = new FP.PlayerInput({});

      this.match = new FP.Match({
        p1: FP.ROSTER[this.sel.p1], p2: FP.ROSTER[this.sel.p2],
        pads, cpu, difficulty: this.difficulty,
        stage: STAGES[this.sel.stage].id, bestOf: 3,
        vw: this.vw, vh: this.vh,
        onMatchEnd: (w) => this.onMatchEnd(w),
      });
      if (this.mode === "training" && this.match.ais[1]) this.match.ais[1].diff = 0.0, this.match.ais[1].training = true;
    }

    onMatchEnd(winner) {
      this.matchWinner = winner;
      if (this.mode === "arcade" && winner === 0) {
        this.ladder.step++;
        if (this.ladder.step < this.ladder.list.length) {
          // next opponent
          this.sel.p2 = this.ladder.list[this.ladder.step];
          this.sel.stage = U.randInt(0, STAGES.length - 1);
          this.arcadeWin = false;
          this.toScreen("vs");
          return;
        } else { this.arcadeWin = true; }
      }
      this.toScreen("result");
    }

    updResult() {
      this._resT = (this._resT || 0) + FP.DT;
      if (this._resT > 0.8 && this.confirm()) {
        this.match = null;
        this.toScreen("title");
      }
    }

    // ======================================================
    //  RENDER
    // ======================================================
    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.vw, this.vh);
      switch (this.screen) {
        case "title": this.drawTitle(ctx); break;
        case "select": this.drawSelect(ctx); break;
        case "vs": this.drawVS(ctx); break;
        case "fight": if (this.match) this.match.draw(ctx); break;
        case "result": this.drawResult(ctx); break;
      }
      // fade overlay
      if (this.fade > 0.001) { ctx.fillStyle = `rgba(0,0,0,${this.fade})`; ctx.fillRect(0, 0, this.vw, this.vh); }
    }

    drawBackdrop(ctx) {
      this.bgStage.drawBackground(ctx, this.bgCam);
      ctx.fillStyle = "rgba(4,5,12,.55)"; ctx.fillRect(0, 0, this.vw, this.vh);
    }

    // ---- live animated fighter preview ----
    previewFighter(ctx, char, x, y, scale, facing, anim = "idle", phase = null) {
      const p = phase != null ? phase : (this.titleAnim % 1);
      const fn = A[anim] || A.idle;
      const pose = fn(this.titleAnim % 1, {});
      ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
      FP.Render.draw(ctx, { x: 0, y: 0, facing, char, pose, airHeight: 0, flashWhite: 0, outlineGlow: null });
      ctx.restore();
    }

    drawTitle(ctx) {
      this.drawBackdrop(ctx);
      const cx = this.vw / 2;
      // showcase fighters along the floor
      const R = FP.ROSTER;
      for (let i = 0; i < R.length; i++) {
        const x = 150 + i * ((this.vw - 300) / (R.length - 1));
        const sc = 0.62 + (i % 2) * 0.04;
        ctx.globalAlpha = 0.55;
        this.previewFighter(ctx, R[i], x, 560, sc, i < 2 ? 1 : -1, "idle");
      }
      ctx.globalAlpha = 1;

      // logo
      const bob = Math.sin(this.titleAnim * 2) * 6;
      ctx.save(); ctx.translate(cx, 150 + bob); ctx.textAlign = "center";
      ctx.font = "900 italic 92px 'Trebuchet MS', sans-serif";
      ctx.lineWidth = 12; ctx.strokeStyle = "#000"; ctx.strokeText("FIGHTING", 0, 0);
      const g = ctx.createLinearGradient(0, -50, 0, 40);
      g.addColorStop(0, "#fff"); g.addColorStop(0.5, "#ffd24a"); g.addColorStop(1, "#ff7a18");
      ctx.fillStyle = g; ctx.fillText("FIGHTING", 0, 0);
      ctx.font = "900 44px 'Trebuchet MS'"; ctx.letterSpacing = "14px";
      ctx.lineWidth = 8; ctx.strokeText("PORTABLE", 0, 52); ctx.fillStyle = "#dfe6ff"; ctx.fillText("PORTABLE", 0, 52);
      ctx.restore();

      // menu
      ctx.textAlign = "center";
      const baseY = 330;
      for (let i = 0; i < MODES.length; i++) {
        const sel = i === this.menuIndex;
        const y = baseY + i * 56;
        if (sel) {
          ctx.fillStyle = "rgba(255,122,24,.18)";
          ctx.fillRect(cx - 230, y - 28, 460, 48);
          ctx.fillStyle = "#ff7a18"; ctx.font = "900 14px 'Trebuchet MS'"; ctx.textAlign = "left";
          ctx.fillText("▶", cx - 220, y + 2);
        }
        ctx.textAlign = "center";
        ctx.font = `900 ${sel ? 34 : 28}px 'Trebuchet MS'`;
        ctx.fillStyle = sel ? "#fff" : "#9aa0bd";
        ctx.fillText(MODES[i].label, cx, y + 4);
        if (sel) { ctx.font = "italic 15px 'Trebuchet MS'"; ctx.fillStyle = "#ffd24a"; ctx.fillText(MODES[i].sub, cx, y + 24); }
      }

      // difficulty
      const dy = baseY + MODES.length * 56 + 26;
      ctx.font = "900 16px 'Trebuchet MS'"; ctx.fillStyle = "#bcd";
      ctx.fillText("◄ DIFFICULTY: " + this.diffLabel() + " ►", cx, dy);

      // controls hint
      ctx.font = "13px 'Trebuchet MS'"; ctx.fillStyle = "rgba(255,255,255,.5)";
      ctx.fillText("MOVE: W A S D   ·   ATTACK: F G H / C V B   ·   P2: ARROWS + NUMPAD", cx, this.vh - 24);

      ctx.font = "900 18px 'Trebuchet MS'"; ctx.fillStyle = "#ffd24a";
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.titleAnim * 4);
      ctx.fillText("PRESS  ENTER  TO  SELECT", cx, dy + 34);
      ctx.globalAlpha = 1;
    }
    diffLabel() { const d = this.difficulty; return d < 0.35 ? "EASY" : d < 0.6 ? "NORMAL" : d < 0.85 ? "HARD" : "EXPERT"; }

    drawSelect(ctx) {
      this.drawBackdrop(ctx);
      const R = FP.ROSTER, cx = this.vw / 2;
      ctx.textAlign = "center";
      ctx.font = "900 italic 40px 'Trebuchet MS'"; ctx.fillStyle = "#fff";
      ctx.fillText("SELECT YOUR FIGHTER", cx, 70);

      const n = R.length, cw = 150, gap = 20, totalW = n * cw + (n - 1) * gap;
      const startX = cx - totalW / 2;
      const cardY = 300, ch = 190;
      for (let i = 0; i < n; i++) {
        const x = startX + i * (cw + gap);
        const isP1 = i === this.sel.p1, isP2 = (this.mode === "versus" || true) && i === this.sel.p2;
        // card
        ctx.fillStyle = "rgba(10,12,22,.7)";
        this._rr(ctx, x, cardY, cw, ch, 8); ctx.fill();
        // portrait fighter
        ctx.save(); ctx.beginPath(); this._rr(ctx, x, cardY, cw, ch, 8); ctx.clip();
        const grd = ctx.createLinearGradient(0, cardY, 0, cardY + ch);
        grd.addColorStop(0, U.hexA(R[i].pal.gi, 0.5)); grd.addColorStop(1, "rgba(0,0,0,.3)");
        ctx.fillStyle = grd; ctx.fillRect(x, cardY, cw, ch);
        this.previewFighter(ctx, R[i], x + cw / 2, cardY + ch - 18, 0.66, 1, "idle");
        ctx.restore();
        // name
        ctx.fillStyle = "#fff"; ctx.font = "900 18px 'Trebuchet MS'";
        ctx.fillText(R[i].name, x + cw / 2, cardY + ch - 6 + 22 - 18);
        // cursors
        if (isP1) this._cursor(ctx, x, cardY, cw, ch, "#3fb6ff", this.sel.lockP1, "P1");
        if (this.mode === "versus" && isP2) this._cursor(ctx, x, cardY, cw, ch, "#ff5b5b", this.sel.lockP2, "P2", true);
      }

      // big previews + bios on each side
      const p1c = R[this.sel.p1];
      ctx.globalAlpha = 0.9;
      this.previewFighter(ctx, p1c, 150, 560, 1.0, 1, this.sel.lockP1 ? "victory" : "idle");
      ctx.globalAlpha = 1;
      this._bio(ctx, p1c, 40, 110, "#3fb6ff", "left");

      if (this.mode === "versus") {
        const p2c = R[this.sel.p2];
        ctx.globalAlpha = 0.9;
        this.previewFighter(ctx, p2c, this.vw - 150, 560, 1.0, -1, this.sel.lockP2 ? "victory" : "idle");
        ctx.globalAlpha = 1;
        this._bio(ctx, p2c, this.vw - 40, 110, "#ff5b5b", "right");
      }

      ctx.textAlign = "center"; ctx.fillStyle = "#ffd24a"; ctx.font = "16px 'Trebuchet MS'";
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.titleAnim * 4);
      ctx.fillText("◄ ► CHOOSE   ·   PUNCH / ENTER TO LOCK IN", cx, this.vh - 24);
      ctx.globalAlpha = 1;
    }
    _bio(ctx, ch, x, y, color, align) {
      ctx.textAlign = align;
      ctx.font = "900 italic 34px 'Trebuchet MS'"; ctx.fillStyle = color;
      ctx.fillText(ch.name, x, y);
      ctx.font = "italic 16px 'Trebuchet MS'"; ctx.fillStyle = "#fff";
      ctx.fillText(ch.title, x, y + 22);
      ctx.font = "13px 'Trebuchet MS'"; ctx.fillStyle = "#bcd";
      this._wrap(ctx, ch.desc, x, y + 46, 260, 17, align);
    }
    _cursor(ctx, x, y, w, h, color, locked, tag, right) {
      ctx.strokeStyle = color; ctx.lineWidth = locked ? 5 : 3;
      ctx.globalAlpha = locked ? 1 : 0.6 + 0.4 * Math.sin(this.titleAnim * 8);
      this._rr(ctx, x - 3, y - 3, w + 6, h + 6, 9); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color; this._rr(ctx, right ? x + w - 36 : x, y - 22, 36, 20, 4); ctx.fill();
      ctx.fillStyle = "#000"; ctx.font = "900 13px 'Trebuchet MS'"; ctx.textAlign = "center";
      ctx.fillText(tag, right ? x + w - 18 : x + 18, y - 8);
      if (locked) { ctx.fillStyle = color; ctx.font = "900 14px 'Trebuchet MS'"; ctx.fillText("READY", x + w / 2, y + h + 18); }
    }

    drawVS(ctx) {
      this.drawBackdrop(ctx);
      const cx = this.vw / 2, t = this._vsT || 0;
      const p1 = FP.ROSTER[this.sel.p1], p2 = FP.ROSTER[this.sel.p2];
      const slide = U.easeOutBack(U.clamp(t / 0.5, 0, 1));
      // left fighter
      ctx.save(); ctx.globalAlpha = U.clamp(t / 0.3, 0, 1);
      this.previewFighter(ctx, p1, U.lerp(-200, this.vw * 0.27, slide), 600, 1.5, 1, "victory");
      ctx.restore();
      ctx.save(); ctx.globalAlpha = U.clamp(t / 0.3, 0, 1);
      this.previewFighter(ctx, p2, U.lerp(this.vw + 200, this.vw * 0.73, slide), 600, 1.5, -1, "victory");
      ctx.restore();

      // names
      ctx.textAlign = "center";
      ctx.font = "900 italic 48px 'Trebuchet MS'";
      ctx.fillStyle = "#3fb6ff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 6;
      ctx.strokeText(p1.name, this.vw * 0.27, 140); ctx.fillText(p1.name, this.vw * 0.27, 140);
      ctx.fillStyle = "#ff5b5b";
      ctx.strokeText(p2.name, this.vw * 0.73, 140); ctx.fillText(p2.name, this.vw * 0.73, 140);

      // VS
      const pop = U.easeOutBack(U.clamp((t - 0.4) / 0.4, 0, 1));
      ctx.save(); ctx.translate(cx, this.vh / 2); ctx.scale(pop, pop); ctx.rotate(-0.06);
      ctx.font = "900 italic 150px 'Trebuchet MS'"; ctx.lineWidth = 14; ctx.strokeStyle = "#000";
      ctx.strokeText("VS", 0, 50);
      const g = ctx.createLinearGradient(0, -60, 0, 60); g.addColorStop(0, "#fff"); g.addColorStop(1, "#ff7a18");
      ctx.fillStyle = g; ctx.fillText("VS", 0, 50);
      ctx.restore();

      // stage banner
      ctx.font = "900 18px 'Trebuchet MS'"; ctx.fillStyle = "#ffd24a"; ctx.textAlign = "center";
      ctx.fillText("STAGE: " + STAGES[this.sel.stage].name, cx, this.vh - 30);
      if (this.mode === "arcade" && this.ladder) {
        ctx.fillStyle = "#fff"; ctx.font = "14px 'Trebuchet MS'";
        ctx.fillText("MATCH " + (this.ladder.step + 1) + " / " + this.ladder.list.length, cx, this.vh - 52);
      }
    }

    drawResult(ctx) {
      if (this.match) this.match.draw(ctx);
      ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(0, 0, this.vw, this.vh);
      const cx = this.vw / 2;
      ctx.textAlign = "center";
      let title, color;
      if (this.mode === "cpu") { title = "K.O."; color = "#ffd24a"; }
      else if (this.mode === "arcade") {
        if (this.arcadeWin) { title = "ARCADE CLEAR!"; color = "#ffd24a"; }
        else if (this.matchWinner === 0) { title = "YOU WIN"; color = "#3fb6ff"; }
        else { title = "YOU LOSE"; color = "#ff5b5b"; }
      } else {
        title = "PLAYER " + (this.matchWinner + 1) + " WINS"; color = this.matchWinner === 0 ? "#3fb6ff" : "#ff5b5b";
      }
      const pop = U.easeOutBack(U.clamp((this._resT || 0) / 0.5, 0, 1));
      ctx.save(); ctx.translate(cx, this.vh * 0.34); ctx.scale(pop, pop);
      ctx.font = "900 italic 84px 'Trebuchet MS'"; ctx.lineWidth = 10; ctx.strokeStyle = "#000";
      ctx.strokeText(title, 0, 0);
      ctx.fillStyle = color; ctx.fillText(title, 0, 0); ctx.restore();

      // winner pose
      const wIdx = this.mode === "cpu" ? (this.match ? this.match.matchWinner : 0) : this.matchWinner;
      if (wIdx >= 0 && this.match) {
        const ch = this.match.fighters[wIdx].char;
        this.previewFighter(ctx, ch, cx, this.vh - 70, 1.6, wIdx === 0 ? 1 : -1, "victory");
      }
      ctx.fillStyle = "#ffd24a"; ctx.font = "18px 'Trebuchet MS'";
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin((this._resT || 0) * 4);
      if ((this._resT || 0) > 0.8) ctx.fillText("PRESS ENTER TO CONTINUE", cx, this.vh * 0.5);
      ctx.globalAlpha = 1;
    }

    // helpers
    _rr(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath(); ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    _wrap(ctx, text, x, y, maxW, lh, align) {
      ctx.textAlign = align;
      const words = text.split(" "); let line = "", yy = y;
      for (const w of words) {
        const test = line + w + " ";
        if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w + " "; yy += lh; }
        else line = test;
      }
      ctx.fillText(line, x, yy);
    }
  }

  FP.Game = Game;
})(window);
