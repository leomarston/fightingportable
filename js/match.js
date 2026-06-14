/* ============================================================
   match.js — the battle "world". Owns the two fighters, stage,
   camera, HUD, projectiles and the round/timer/KO state machine.
   Fighters hold a reference to this object as `world`.
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP, U = FP.U;

  const ROUND_TIME = 99;

  class Match {
    constructor(cfg) {
      // cfg: {p1, p2 (char), pads:[p1pad,p2pad], cpu:[bool,bool], difficulty, stage, bestOf, vw, vh}
      this.vw = cfg.vw; this.vh = cfg.vh;
      this.bestOf = cfg.bestOf || 3;
      this.needWins = Math.ceil(this.bestOf / 2);
      this.stageId = cfg.stage || "temple";

      // world bounds
      this.worldW = 1760;
      this.groundY = 600;
      this.leftWall = 0; this.rightWall = this.worldW;
      this.gravity = 2600;
      this.dt = FP.DT;

      this.fx = new FP.Effects();
      this.projectiles = [];

      this.stage = new FP.Stage(this.stageId, this.worldW, this.groundY, this.vw, this.vh);
      this.camera = new FP.Camera(this.vw, this.vh, this.worldW);
      this.hud = new FP.HUD(this.vw, this.vh);

      // build fighters
      this.fighters = [
        new FP.Fighter(cfg.p1, 0, cfg.pads[0], this),
        new FP.Fighter(cfg.p2, 1, cfg.pads[1], this),
      ];
      this.ais = [null, null];
      if (cfg.cpu[0]) this.ais[0] = new FP.AI(this.fighters[0], cfg.pads[0], cfg.difficulty);
      if (cfg.cpu[1]) this.ais[1] = new FP.AI(this.fighters[1], cfg.pads[1], cfg.difficulty);
      this.cpu = cfg.cpu.slice();

      this.roundsWon = [0, 0];
      this.round = 1;
      this.tookDamage = [false, false];

      this.roundState = "start";   // start | fight | ko | roundEnd | matchEnd
      this.stateT = 0;
      this.timer = ROUND_TIME;
      this.slow = 0;               // slow-mo factor counter
      this.matchWinner = -1;
      this.onMatchEnd = cfg.onMatchEnd || (() => {});
      this.paused = false;

      this.beginRound(true);
    }

    // ----- world API used by fighters -----
    spawnProjectile(p) { this.projectiles.push(p); }
    addText(x, y, t, color, big) { this.fx.addText(x, y, t, color, big); }
    addCallout(side, text, color) { this.hud.setCallout(side, text, color); }
    superFlash(f) {
      this.fx.flash(f.char.auraColor, 0.5);
      this.fx.shake(8, 0.3);
      this.cinematic = 0.5;
      this.hud.setAnnounce(f.char.moves.super.name, f.char.auraColor, 1.3, 0.6);
    }
    onKO(loser, winner) {
      if (this.roundState !== "fight") return;
      this.startKOSequence(loser, winner || this.fighters[1 - loser.index]);
    }

    // ----- rounds -----
    beginRound(first) {
      const g = this.groundY;
      this.fighters[0].reset(g, this.worldW / 2 - 240, 1);
      this.fighters[1].reset(g, this.worldW / 2 + 240, -1);
      this.fighters[0].wins = this.roundsWon[0];
      this.fighters[1].wins = this.roundsWon[1];
      this.projectiles.length = 0;
      this.fx.clear();
      this.hud.reset();
      this.timer = ROUND_TIME;
      this.tookDamage = [false, false];
      this.roundState = "start"; this.stateT = 0;
      this.camera.follow(this.fighters[0].x, g, this.fighters[1].x, g, g);
      this.camera.snap();
      this.hud.setAnnounce("ROUND " + this.round, "#ffd24a", 1.4, 0.7);
      FP.Audio.announce("round"); FP.Audio.bell();
    }

    startKOSequence(loser, winner) {
      this.roundState = "ko"; this.stateT = 0;
      loser.startKO(winner);
      winner.attack = null;
      this.slow = 1.4;
      const perfect = !this.tookDamage[winner.index];
      this.hud.setAnnounce(perfect ? "PERFECT" : "K.O.", perfect ? "#ffd24a" : "#ff5b5b", 1.8, 1);
      FP.Audio.announce("ko"); FP.Audio.ko();
      this.fx.shake(18, 0.6); this.fx.flash("#fff", 0.6);
      this.fx.hitStop(0.25);
      this._koWinner = winner; this._koLoser = loser;
    }

    endRound(winnerIdx) {
      this.roundsWon[winnerIdx]++;
      if (this.roundsWon[winnerIdx] >= this.needWins) {
        this.roundState = "matchEnd"; this.stateT = 0;
        this.matchWinner = winnerIdx;
        this.fighters[winnerIdx].celebrate();
        this.hud.setAnnounce("WINNER", winnerIdx === 0 ? "#3fb6ff" : "#ff5b5b", 3, 1);
        FP.Audio.announce("winner");
      } else {
        this.round++;
        this.roundState = "roundEnd"; this.stateT = 0;
      }
    }

    // ----- main fixed-step update -----
    step() {
      if (this.paused) return;
      let dt = this.dt;
      // slow-mo on KO
      let simDt = dt;
      if (this.slow > 0) { this.slow -= dt; simDt = dt * 0.4; }

      // hit-stop freezes the sim but keeps particles lively
      if (this.fx.freeze > 0) {
        this.fx.freeze -= dt;
        this.fx.step(dt);
        this.stage.step(dt * 0.2);
        this.updateCamera(dt);
        return;
      }

      this.stateT += dt;
      this.stage.step(simDt);
      if (this.cinematic > 0) this.cinematic -= dt;

      switch (this.roundState) {
        case "start": this.updateStart(); break;
        case "fight": this.updateFight(simDt); break;
        case "ko": this.updateKO(simDt); break;
        case "roundEnd": this.updateRoundEnd(); break;
        case "matchEnd": this.updateMatchEnd(simDt); break;
      }

      this.fx.step(dt);
      this.hud.step(dt, this.fighters);
      this.updateCamera(dt);
    }

    updateStart() {
      // brief intro then FIGHT
      if (this.stateT > 1.3 && !this._saidFight) {
        this._saidFight = true;
        this.hud.setAnnounce("FIGHT!", "#ff7a18", 1.0, 1);
        FP.Audio.announce("fight"); FP.Audio.bell();
        FP.Audio.startMusic(132 + this.round * 4);
      }
      if (this.stateT > 2.0) { this.roundState = "fight"; this.stateT = 0; this._saidFight = false; }
      // let intro anim play; keep fighters idle-ish (their own intro state handles it)
      for (const f of this.fighters) { this.runController(f); f.update(this.other(f)); }
      this.faceOff();
    }

    updateFight(dt) {
      // timer
      this.timer -= dt;
      if (this.timer <= 0) { this.timer = 0; this.timeOver(); return; }

      this.faceOff();
      for (const f of this.fighters) {
        this.runController(f);
      }
      for (const f of this.fighters) f.update(this.other(f));
      this.separate();
      this.resolveCombat();
      this.updateProjectiles(dt);
      this.advancePads();

      // track damage for perfect
      for (let i = 0; i < 2; i++) if (this.fighters[i].health < this.fighters[i].maxHP) this.tookDamage[i] = true;
    }

    updateKO(dt) {
      for (const f of this.fighters) {
        if (f === this._koLoser) { f.update(this.other(f)); }
        else { this.runController(f, true); f.update(this.other(f)); }
      }
      this.updateProjectiles(dt);
      this.advancePads();
      FP.Audio.stopMusic();
      if (this.stateT > 1.8) this.endRound(this._koWinner.index);
    }

    updateRoundEnd() {
      for (const f of this.fighters) f.update(this.other(f));
      if (this.stateT > 1.2) this.beginRound(false);
    }

    updateMatchEnd(dt) {
      for (const f of this.fighters) { if (f.state !== "ko") this.runController(f, true); f.update(this.other(f)); }
      this.updateProjectiles(dt);
      this.advancePads();
      if (this.stateT > 3.2 && !this._ended) { this._ended = true; this.onMatchEnd(this.matchWinner); }
    }

    timeOver() {
      const a = this.fighters[0].health, b = this.fighters[1].health;
      const winner = a === b ? -1 : (a > b ? 0 : 1);
      this.hud.setAnnounce("TIME UP", "#ffd24a", 1.6, 1);
      if (winner < 0) { // draw -> sudden death-ish: just pick higher or replay; we end round to nobody, replay
        this.roundState = "roundEnd"; this.stateT = -0.5; return;
      }
      this.startKOSequence(this.fighters[1 - winner], this.fighters[winner]);
    }

    // ----- helpers -----
    other(f) { return this.fighters[1 - f.index]; }
    runController(f, forceNeutral) {
      const ai = this.ais[f.index];
      if (ai) {
        if (forceNeutral) { ai.apply ? ai.apply([]) : 0; }
        else ai.update(this.other(f));
      }
    }
    advancePads() {
      // human pads (p1/p2) are advanced once per fixed step in main.js;
      // here we only roll the CPU's private virtual pads.
      for (let i = 0; i < 2; i++) {
        const ai = this.ais[i];
        if (ai && ai.pad && ai.pad !== FP.Input.p1 && ai.pad !== FP.Input.p2) ai.pad.advance();
      }
    }

    faceOff() {
      const [a, b] = this.fighters;
      // flip to face opponent when allowed
      for (const f of this.fighters) {
        const o = this.other(f);
        if (f.onGround && (f.actionable() || f.state === "idle" || f.state === "intro") && f.facingLockT <= 0) {
          const want = o.x >= f.x ? 1 : -1;
          if (want !== f.facing) { f.facing = want; }
        }
      }
    }

    separate() {
      const [a, b] = this.fighters;
      if (!a.onGround || !b.onGround) return;
      const minSep = 46 * ((a.char.prop.bulk || 1) + (b.char.prop.bulk || 1)) / 2 * ((a.scale + b.scale) / 2);
      const dx = b.x - a.x; const adx = Math.abs(dx);
      if (adx < minSep && adx > 0.001) {
        const push = (minSep - adx) / 2;
        const dir = U.sign(dx);
        // respect walls: if one is cornered, push the other more
        let aMove = -dir * push, bMove = dir * push;
        const half = 30;
        if (a.x + aMove < this.leftWall + half) { const ex = (this.leftWall + half) - (a.x + aMove); aMove += ex; bMove += ex; }
        if (b.x + bMove > this.rightWall - half) { const ex = (b.x + bMove) - (this.rightWall - half); aMove -= ex; bMove -= ex; }
        a.x += aMove; b.x += bMove;
      }
    }

    resolveCombat() {
      for (const atk of this.fighters) {
        const hb = atk.activeHitbox();
        if (!hb) continue;
        const def = this.other(atk);
        if (def.state === "ko") continue;
        if (U.overlap(hb, def.hurtbox())) {
          def.tryGetHit(atk, hb);
        }
      }
    }

    updateProjectiles(dt) {
      const ps = this.projectiles;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.step(dt);
        // vs fighters
        for (const f of this.fighters) {
          if (f.index === p.owner || f.state === "ko") continue;
          if (!p.dead && U.overlap(p.box(), f.hurtbox())) {
            f.getHitByProjectile(p);
            p.onHit();
          }
        }
        // vs opposing projectiles (clash)
        for (let j = i - 1; j >= 0; j--) {
          const q = ps[j];
          if (q.owner !== p.owner && !p.dead && !q.dead && U.overlap(p.box(), q.box())) {
            p.onHit(); q.onHit();
            this.fx.explode((p.x + q.x) / 2, (p.y + q.y) / 2, "#fff", p.color, 18, 0.8);
            FP.Audio.block();
          }
        }
        // bounds
        if (p.x < this.leftWall - 80 || p.x > this.rightWall + 80) p.dead = true;
        if (p.dead) ps.splice(i, 1);
      }
    }

    updateCamera(dt) {
      const [a, b] = this.fighters;
      this.camera.follow(a.x, a.y, b.x, b.y, this.groundY);
      if (this.roundState === "ko" || this.roundState === "matchEnd") {
        // push toward the winner for drama
        const w = this._koWinner || this.fighters[this.matchWinner] || a;
        this.camera.tx = U.lerp(this.camera.tx, w.x, 0.4);
        this.camera.targetZoom = U.lerp(this.camera.targetZoom, 1.25, 0.5);
      }
      this.camera.step(dt);
    }

    // ----- draw -----
    draw(ctx) {
      const cam = this.camera;
      const shake = this.fx.shakeOffset();

      // background (screen space, parallax)
      this.stage.drawBackground(ctx, cam);

      ctx.save();
      cam.apply(ctx, shake);

      // world: floor, props (behind), particles behind, fighters, projectiles, particles front
      this.stage.drawFloor(ctx);
      this.stage.drawProps(ctx);
      this.fx.drawWorldBehind(ctx);

      // draw fighters back-to-front by x-depth (farther one first): use facing/closeness — simply draw the lower-y last
      const order = this.fighters.slice().sort((m, n) => (m.y - n.y) || (m.index - n.index));
      for (const f of order) f.draw(ctx);

      for (const p of this.projectiles) p.draw(ctx);
      this.fx.drawWorldFront(ctx);
      this.stage.drawForeground(ctx, cam);
      this.fx.drawTexts(ctx);

      ctx.restore();

      // screen flash + vignette
      this.fx.drawScreenFlash(ctx, this.vw, this.vh);
      this.drawVignette(ctx);

      // HUD
      this.hud.draw(ctx, this.fighters, this.timer, this.roundsWon, this.bestOf);

      if (this.paused) this.drawPause(ctx);
    }

    drawVignette(ctx) {
      const g = ctx.createRadialGradient(this.vw / 2, this.vh / 2, this.vh * 0.4, this.vw / 2, this.vh / 2, this.vh * 0.9);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.45)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.vw, this.vh);
    }
    drawPause(ctx) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(0, 0, this.vw, this.vh);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "900 64px 'Trebuchet MS'";
      ctx.fillText("PAUSED", this.vw / 2, this.vh / 2);
      ctx.font = "20px 'Trebuchet MS'"; ctx.fillStyle = "#ffd24a";
      ctx.fillText("Press START to resume", this.vw / 2, this.vh / 2 + 44);
      ctx.restore();
    }
  }

  FP.Match = Match;
  FP.ROUND_TIME = ROUND_TIME;
})(window);
