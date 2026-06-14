/* ============================================================
   ai.js — CPU controller. It drives the SAME virtual pad a human
   would use, including executing real motion inputs for specials,
   so the fighter code path is identical for player and AI.
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP, U = FP.U;

  const BTNS = ["up", "down", "left", "right", "lp", "mp", "hp", "lk", "mk", "hk"];

  class AI {
    constructor(fighter, pad, difficulty = 0.6) {
      this.me = fighter; this.pad = pad;
      this.diff = difficulty;     // 0..1
      this.queue = [];            // scripted motion steps
      this.want = {};             // desired pad state this frame
      this.think = 0;             // reaction cooldown
      this.plan = "neutral";
      this.planT = 0;
    }
    set(o) { this.want = o; }
    fwdKey() { return this.me.facing > 0 ? "right" : "left"; }
    backKey() { return this.me.facing > 0 ? "left" : "right"; }

    // push a special-move motion onto the queue (frames are short taps).
    // pass ex=true (with a half EX bar) to press two buttons -> EX version.
    queueMotion(type, btn, ex) {
      const F = this.fwdKey(), B = this.backKey();
      const s = [];
      const useEx = ex && this.me.ex >= 50;
      const pressBtn = useEx ? [btn, btn === "lp" ? "mp" : btn === "lk" ? "mk" : "lp"] : btn;
      const step = (hold, frames, press) => s.push({ hold: hold.slice(), frames, press });
      if (type === "qcf") { step(["down"], 2); step(["down", F], 2); step([F], 2, pressBtn); }
      else if (type === "dp") { step([F], 2); step(["down"], 2); step(["down", F], 2, pressBtn); }
      else if (type === "qcb") { step(["down"], 2); step(["down", B], 2); step([B], 2, pressBtn); }
      else if (type === "super") { step(["down"], 2); step(["down", F], 1); step([F], 1); step(["down"], 1); step(["down", F], 1); step([F], 2, btn); }
      this.queue = s;
    }

    apply(holdArr, press) {
      const w = {};
      for (const k of holdArr) w[k] = true;
      if (press) { if (Array.isArray(press)) press.forEach((p) => (w[p] = true)); else w[press] = true; }
      for (const b of BTNS) this.pad._set(b, !!w[b]);
    }

    update(opp) {
      const me = this.me;
      // run scripted motion queue if present
      if (this.queue.length) {
        const step = this.queue[0];
        this.apply(step.hold, step._done ? null : step.press);
        step._done = true;
        step.frames--;
        if (step.frames <= 0) this.queue.shift();
        return;
      }

      // can't act -> just hold (maybe block)
      if (!me.actionable()) {
        // hold back to block if foe threatening
        if (this.shouldBlock(opp)) this.apply([this.backKey(), opp.attack && opp.attack.move && opp.attack.move.low ? "down" : ""].filter(Boolean));
        else this.apply([]);
        return;
      }

      if (this.think > 0) { this.think--; }
      const dx = opp.x - me.x; const adist = Math.abs(dx);
      const aboveClose = !opp.onGround && adist < 170 && opp.y < me.y - 50;

      // decision (re-evaluated when think timer elapses)
      if (this.think <= 0) {
        this.decide(opp, dx, adist, aboveClose);
        this.think = Math.round(U.lerp(9, 3, this.diff)) + U.randInt(0, 2);
      }
      // continue current plan
      this.execute(opp, dx, adist);
    }

    shouldBlock(opp) {
      if (this.training) return true;
      if (!(opp.state === "attack" || opp.state === "special" || opp.state === "super")) return false;
      if (!opp.attack || opp.attack.phase === "recovery") return false;
      const adist = Math.abs(opp.x - this.me.x);
      if (adist > 160) return false;
      return U.chance(U.lerp(0.2, 0.6, this.diff));
    }

    decide(opp, dx, adist, aboveClose) {
      if (this.training) { this.plan = "neutral"; this.planT = 8; return; }
      // anti-air
      if (aboveClose && U.chance(0.5 + this.diff * 0.35)) { this.queueMotion("dp", "hp"); return; }
      // sometimes block incoming, but stay aggressive
      if (this.shouldBlock(opp)) { this.plan = "block"; this.planT = 10; return; }

      const close = 132 * this.me.scale;
      if (adist > 400) {
        // far: fireball or rush in
        if (U.chance(0.45) && this.me.char.moves.specials[0].kind === "projectile") { this.queueMotion("qcf", U.pick(["lp", "hp"])); return; }
        this.plan = "approach"; this.planT = 20; return;
      }
      if (adist > close) {
        const r = U.rand();
        if (r < 0.5) { this.plan = "approach"; this.planT = 14; }
        else if (r < 0.62 && this.diff > 0.4) { this.plan = "jumpin"; this.planT = 2; this.apply(["up", this.fwdKey()]); }
        else if (r < 0.78) { this.queueMotion("qcb", U.pick(["mk", "hk"])); }   // advancing special to close
        else if (r < 0.9) { this.plan = "dashin"; this.planT = 2; }
        else { this.plan = "approach"; this.planT = 14; }
        return;
      }
      // close range — be busy
      if (this.me.meter >= 100 && U.chance(0.3 + this.diff * 0.35)) { this.queueMotion("super", "hp"); return; }
      const r = U.rand();
      if (r < 0.30) { this.plan = "poke"; this.planT = 2; this.pokeBtn = U.pick(["lp", "lk", "mp"]); }
      else if (r < 0.56) { this.plan = "heavy"; this.planT = 2; this.pokeBtn = U.pick(["hp", "hk", "mk"]); }
      else if (r < 0.70) { this.plan = "lowpoke"; this.planT = 2; }
      else if (r < 0.82) { this.plan = "throw"; this.planT = 2; }
      else if (r < 0.93 && U.chance(0.4 + this.diff * 0.4)) { this.queueMotion(U.pick(["qcf", "dp"]), "mp", U.chance(0.6)); }
      else { this.plan = "poke"; this.planT = 2; this.pokeBtn = "lp"; }
    }

    execute(opp, dx, adist) {
      const F = this.fwdKey(), B = this.backKey();
      if (this.planT > 0) this.planT--;
      switch (this.plan) {
        case "approach":
          this.apply([F]); if (this.planT <= 0) this.plan = "neutral";
          break;
        case "retreat":
          this.apply([B]); if (this.planT <= 0) this.plan = "neutral";
          break;
        case "block":
          this.apply([B]); if (this.planT <= 0) this.plan = "neutral";
          break;
        case "jumpin":
          // already jumped; press attack near apex
          if (!this.me.onGround && U.chance(0.4)) this.apply([F, "hp"]);
          else this.apply([F]);
          this.plan = "neutral";
          break;
        case "dashin":
          this.apply([F]); if (this.planT <= 0) this.plan = "neutral";
          break;
        case "poke":
          this.apply([], this.pokeBtn || "lp"); this.plan = "recover"; this.planT = 6;
          break;
        case "heavy":
          this.apply([], this.pokeBtn || "hp"); this.plan = "recover"; this.planT = 10;
          break;
        case "lowpoke":
          this.apply(["down"], "lk"); this.plan = "recover"; this.planT = 6;
          break;
        case "throw":
          this.apply([F, "lp", "lk"]); this.plan = "recover"; this.planT = 8;
          break;
        case "recover":
          this.apply([]); if (this.planT <= 0) this.plan = "neutral";
          break;
        default:
          // neutral: small spacing dance
          if (adist < 70 && U.chance(0.3)) this.apply([B]);
          else this.apply([]);
      }
    }
  }

  FP.AI = AI;
})(window);
