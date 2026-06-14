/* ============================================================
   fighter.js — the Fighter: state machine, physics, combat,
   motion-input specials, blocking, throws, combos and meter.
   Runs on a fixed 60 fps step (dt = 1/60). Timers are in frames.
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP, U = FP.U, SK = FP.Skeleton, A = FP.Skeleton.A;

  const FPS = 60, DT = 1 / 60;

  // states that allow starting a new action
  const ACTIONABLE = { idle: 1, walkF: 1, walkB: 1, crouch: 1, block: 1, blockLow: 1, dash: 1 };

  class Fighter {
    constructor(char, index, pad, world) {
      this.char = char;
      this.index = index;          // 0 = left/P1, 1 = right/P2
      this.pad = pad;
      this.world = world;
      this.scale = char.prop.scale || 1;
      this.maxHP = char.stats.hp;
      this.reset(world.groundY, index === 0 ? world.leftWall + 320 : world.rightWall - 320, index === 0 ? 1 : -1);
      this.aiCtrl = null;
    }

    reset(groundY, x, facing) {
      this.x = x; this.y = groundY;
      this.vx = 0; this.vy = 0;
      this.facing = facing;
      this.onGround = true;
      this.health = this.maxHP;
      this.meter = 0;
      this.state = "intro";
      this.stateT = 0;
      this.hitstun = 0; this.blockstun = 0;
      this.attack = null;
      this.attackId = 0;
      this.hitThisAttack = false;
      this.comboHits = 0; this.comboTimer = 0;
      this.flashWhite = 0;
      this.dead = false; this.koAnim = 0;
      this.invuln = 0;
      this.airAttacked = false;
      this.dashCD = 0; this.lastTapDir = 0; this.lastTapT = -99;
      this.wins = 0;
      this.facingLockT = 0;
      this.setAnim("intro", 60, false);
      this.grabbing = null; this.grabbedBy = null;
      this.pushTimer = 0;
      this.chargeGlow = 0;
    }

    // ---------- animation ----------
    setAnim(name, durFrames, loop) {
      this.animFn = A[name] || A.idle;
      this.animName = name;
      this.animDur = durFrames || 36;
      this.animLoop = loop !== false;
      this.animT = 0;
    }
    poseNow() {
      let p = this.animLoop ? (this.animT / this.animDur) % 1 : U.clamp(this.animT / this.animDur, 0, 1);
      return this.animFn(p, { fighter: this });
    }

    setState(s) {
      if (this.state === s) return;
      this.state = s; this.stateT = 0;
    }

    actionable() {
      return ACTIONABLE[this.state] && this.hitstun <= 0 && this.blockstun <= 0 && !this.grabbedBy;
    }

    // ---------- geometry ----------
    height() { return 196 * this.scale; }
    hurtbox() {
      const s = this.scale, w = 60 * (this.char.prop.bulk || 1) * s;
      if (this.state === "crouch" || this.state === "blockLow" || (this.attack && this.attack.move.crouch) || this.state === "hurtCrouch") {
        return { x: this.x - w / 2, y: this.y - 120 * s, w, h: 120 * s };
      }
      if (this.state === "knockdown") {
        return { x: this.x - 70 * s, y: this.y - 36 * s, w: 140 * s, h: 36 * s };
      }
      const top = this.onGround ? this.y - this.height() : this.y - this.height();
      return { x: this.x - w / 2, y: top, w, h: this.height() };
    }

    activeHitbox() {
      if (!this.attack) return null;
      const a = this.attack, m = a.move;
      if (a.phase !== "active") return null;
      if (m.crouch && m.startup === undefined) return null;
      const s = this.scale;
      const reach = (m.reach || 1);
      const f = this.facing;
      let cx, cy, w, h;
      const bodyMidY = this.onGround ? this.y - 120 * s : this.y - 60 * s;
      if (m.air) {
        w = 70 * s; h = 64 * s;
        cx = this.x + f * 34 * s; cy = this.y - 56 * s;
      } else if (m.low) {
        w = (70 + 60 * reach) * s; h = 36 * s;
        cx = this.x + f * (50 + 40 * reach) * s; cy = this.y - 22 * s;
      } else {
        w = (60 + 70 * reach) * s; h = 50 * s;
        cx = this.x + f * (44 + 56 * reach) * s; cy = this.y - 140 * s;
      }
      return { x: cx - (f > 0 ? 0 : w), y: cy - h / 2, w, h, move: m, id: a.id, fighter: this };
    }

    // grab range box (command grabs / throws)
    grabBox(range) {
      const s = this.scale, f = this.facing;
      return { x: f > 0 ? this.x : this.x - range, y: this.y - this.height(), w: range, h: this.height() };
    }

    // ---------- per-frame ----------
    update(opp) {
      this.opp = opp;
      this.gframe = (this.gframe || 0) + 1;
      this.animT++;
      this.stateT++;
      if (this.flashWhite > 0) this.flashWhite = Math.max(0, this.flashWhite - 0.12);
      if (this.invuln > 0) this.invuln--;
      if (this.dashCD > 0) this.dashCD--;
      if (this.comboTimer > 0) { this.comboTimer--; if (this.comboTimer === 0) this.comboHits = 0; }
      if (this.facingLockT > 0) this.facingLockT--;
      this.chargeGlow = Math.max(0, this.chargeGlow - 0.04);

      if (this.state === "ko") { this.koPhysics(); return; }
      if (this.grabbedBy) { this.followGrab(); return; }

      // count down stuns
      if (this.hitstun > 0) this.hitstun--;
      if (this.blockstun > 0) this.blockstun--;

      // controller produces input into this.pad before update (AI) ; humans already have it
      const pad = this.pad;
      const fwd = this.facing;             // forward = facing dir
      const dir = pad.dirNumpad();
      const holdingBack = (fwd > 0 && pad.down.left) || (fwd < 0 && pad.down.right);
      const holdingFwd = (fwd > 0 && pad.down.right) || (fwd < 0 && pad.down.left);
      const holdingDown = pad.down.down;

      // resolve current high-level state behaviour
      this.handleState(pad, dir, holdingBack, holdingFwd, holdingDown);

      // physics
      this.integrate();

      // meter clamp
      this.meter = U.clamp(this.meter, 0, 100);
      this.health = Math.max(0, this.health);
    }

    handleState(pad, dir, back, fwd, down) {
      // hurt / recovery states first
      if (this.state === "hurt" || this.state === "hurtCrouch") {
        if (this.hitstun <= 0 && this.onGround) this.toNeutral();
        return;
      }
      if (this.state === "hurtAir") {
        if (this.onGround) { this.land(true); }
        return;
      }
      if (this.state === "knockdown") {
        if (this.stateT > 38) { this.setState("getup"); this.setAnim("getup", 26, false); this.invuln = 14; }
        return;
      }
      if (this.state === "getup") {
        if (this.stateT >= this.animDur) this.toNeutral();
        return;
      }
      if (this.state === "intro") {
        if (this.stateT >= this.animDur) this.toNeutral();
        return;
      }
      if (this.state === "victory") return;

      // attacks / specials in progress
      if (this.state === "attack" || this.state === "special" || this.state === "super") {
        this.tickAttack();
        return;
      }
      if (this.state === "throwStart") { this.tickThrow(); return; }

      if (this.state === "dash") {
        if (this.stateT >= this.animDur) this.toNeutral();
        // allow cancelling dash into attacks
        if (this.tryAttacks(pad)) return;
        return;
      }

      // ----- grounded neutral / movement -----
      if (this.onGround) {
        // jump
        if (pad.down.up && this.blockstun <= 0) {
          this.startJump(fwd ? this.facing : (back ? -this.facing : 0));
          return;
        }
        // specials & supers (motion) — highest priority
        if (this.trySpecials(pad)) return;
        // throws (LP+LK close)
        if (this.tryThrow(pad)) return;
        // normals
        if (this.tryAttacks(pad)) return;
        // dash (double tap forward)
        if (this.checkDash(pad)) return;

        // movement / block
        if (down) {
          if (back) { this.setState("blockLow"); this.setAnim("blockLow", 10, false); }
          else { this.setState("crouch"); this.setAnim("crouch", 10, false); }
          this.vx = 0;
        } else if (back) {
          // walk back (and ready to block)
          this.setState(this.threatened() ? "block" : "walkB");
          this.setAnim(this.state === "block" ? "block" : "walkB", this.state === "block" ? 10 : 38, this.state !== "block");
          this.vx = -this.facing * this.char.stats.walkB;
        } else if (fwd) {
          this.setState("walkF"); this.setAnim("walkF", 34, true);
          this.vx = this.facing * this.char.stats.walkF;
        } else {
          this.setState("idle"); this.setAnim("idle", 96, true);
          this.vx = U.approach(this.vx, 0, 40);
        }
      } else {
        // airborne: air attacks, air control
        this.tryAirAttack(pad);
      }
    }

    threatened() {
      const o = this.opp; if (!o) return false;
      return o.state === "attack" || o.state === "special" || o.state === "super" || (!o.onGround && o.attack);
    }

    toNeutral() {
      this.attack = null; this.hitThisAttack = false;
      this.setState("idle"); this.setAnim("idle", 96, true);
    }

    // ---------- movement ----------
    startJump(dirX) {
      this.onGround = false;
      this.vy = -this.char.stats.jump;
      this.vx = dirX * this.char.stats.walkF * 1.15;
      this.airAttacked = false;
      this.setState("jump"); this.setAnim("jump", 48, false);
      FP.Audio.jump();
      this.world.fx.dust(this.x, this.y, 0, 6, 0.8);
    }
    checkDash(pad) {
      if (this.dashCD > 0) return false;
      // double-tap forward within 12 frames
      const f = this.facing;
      const tapDir = (pad.pressed.right ? 1 : pad.pressed.left ? -1 : 0);
      if (tapDir !== 0) {
        const forwardTap = (tapDir === f);
        if (forwardTap && this.lastTapDir === tapDir && (this.animTGlobal() - this.lastTapT) < 14) {
          this.startDash(1);
          this.lastTapT = -99; this.lastTapDir = 0;
          return true;
        }
        this.lastTapDir = tapDir; this.lastTapT = this.animTGlobal();
      }
      return false;
    }
    animTGlobal() { return this.gframe || 0; }
    startDash(d) {
      this.setState("dash"); this.setAnim("dash", 22, false);
      this.vx = this.facing * this.char.stats.dashF * d;
      this.dashCD = 26;
      FP.Audio.dash();
      this.world.fx.dust(this.x, this.y, this.facing, 8, 1);
    }

    integrate() {
      const w = this.world;
      // gravity
      if (!this.onGround) {
        this.vy += w.gravity * DT;
        // limited air drift
        if (this.state === "jump" || this.state === "hurtAir") {
          this.x += this.vx * DT;
        }
        this.y += this.vy * DT;
        if (this.y >= w.groundY) { this.y = w.groundY; this.land(false); }
      } else {
        this.x += this.vx * DT;
        // ground friction on knockback states
        if (this.state === "hurt" || this.state === "knockdown" || this.pushTimer > 0) {
          this.vx = U.approach(this.vx, 0, 24);
          if (this.pushTimer > 0) this.pushTimer--;
        }
      }
      // walls
      const half = 30 * this.scale;
      if (this.x < w.leftWall + half) { this.x = w.leftWall + half; if (this.vx < 0) this.vx *= 0.2; }
      if (this.x > w.rightWall - half) { this.x = w.rightWall - half; if (this.vx > 0) this.vx *= 0.2; }
    }

    land(fromHurt) {
      this.onGround = true; this.vy = 0;
      if (this.state === "jump") {
        FP.Audio.land();
        this.world.fx.landDust(this.x, this.y, 0.9 * this.scale);
        this.toNeutral();
      } else if (this.state === "hurtAir") {
        // hit the ground -> knockdown
        this.knockdown();
      } else if (this.state === "attack" && this.attack && this.attack.move.air) {
        this.toNeutral();
      }
    }

    knockdown() {
      this.setState("knockdown"); this.setAnim("knockdown", 38, false);
      this.vx = 0; this.vy = 0;
      this.world.fx.landDust(this.x, this.y, 1.1 * this.scale);
      this.world.fx.shake(8, 0.2);
      FP.Audio.land();
    }

    // ---------- attacks ----------
    pressedAttack(pad) {
      for (const b of ["hp", "hk", "mp", "mk", "lp", "lk"]) if (pad.pressed[b]) return b;
      return null;
    }
    tryAttacks(pad) {
      const b = this.pressedAttack(pad);
      if (!b) return false;
      const down = pad.down.down;
      let key = b;
      if (down) {
        if (b === "lp" || b === "mp" || b === "hp") key = "clp";
        else if (b === "hk") key = "chk";
        else key = "clk";
      }
      const m = FP.NORMALS[key];
      if (!m) return false;
      this.startAttack(m);
      return true;
    }
    tryAirAttack(pad) {
      if (this.airAttacked) return false;
      const b = this.pressedAttack(pad);
      if (!b) return false;
      const key = (b === "lp" || b === "mp" || b === "hp") ? "jp" : "jk";
      this.startAttack(FP.NORMALS[key]);
      this.airAttacked = true;
      return true;
    }
    startAttack(m) {
      this.attack = { move: m, total: m.startup + m.active + m.recovery, phase: "startup", id: ++this.attackId };
      this.hitThisAttack = false;
      this.setState("attack");
      this.setAnim(m.anim, m.startup + m.active + m.recovery, false);
      this.vx = this.onGround ? U.approach(this.vx, 0, 80) : this.vx;
      FP.Audio.whiff();
    }
    tickAttack() {
      const a = this.attack; if (!a) { this.toNeutral(); return; }
      const t = this.stateT, m = a.move;
      if (t < m.startup) a.phase = "startup";
      else if (t < m.startup + m.active) a.phase = "active";
      else if (t < a.total) a.phase = "recovery";
      else { this.endAttack(); return; }

      // special behaviours
      if (a.special) this.tickSpecialBehaviour(a, t);
    }
    endAttack() {
      this.attack = null;
      if (!this.onGround) this.setState("jump"); // keep falling
      else this.toNeutral();
    }

    // ---------- specials ----------
    trySpecials(pad) {
      const moves = this.char.moves;
      const f = this.facing;
      // SUPER first (needs full meter)
      const sm = moves.super;
      if (this.meter >= 100) {
        const seq = sm.double ? [2, 3, 6, 2, 3, 6] : sm.motion;
        if (pad.motion(seq, sm.btns, f, 24)) { this.startSuper(sm); return true; }
      }
      for (const sp of moves.specials) {
        if (pad.motion(sp.motion, sp.btns, f, 16)) {
          if (this.meter >= sp.meter * 0) { this.startSpecial(sp); return true; }
        }
      }
      return false;
    }
    startSpecial(sp) {
      this.attack = { move: sp, special: sp, total: sp.startup + sp.active + sp.recovery, phase: "startup", id: ++this.attackId, fired: false };
      this.hitThisAttack = false;
      this.setState("special");
      this.setAnim(sp.anim, this.attack.total, false);
      this.meter = Math.min(100, this.meter + (sp.meter || 0) * 0.3);
      if (sp.invuln) this.invuln = sp.invuln + sp.startup;
      // movement impetus
      if (sp.kind === "uppercut") { /* rise handled in tick */ }
      if (sp.kind === "advance") { this.vx = this.facing * (sp.adv || 300); }
      if (sp.kind === "command_grab") { /* checked at active */ }
      this.world.fx.aura(this.x, this.y - 80 * this.scale, this.char.auraColor, 2);
      this.chargeGlow = 1;
    }
    startSuper(sm) {
      this.meter = 0;
      this.attack = { move: sm, special: sm, total: sm.startup + sm.active + sm.recovery, phase: "startup", id: ++this.attackId, fired: false, isSuper: true };
      this.hitThisAttack = false;
      this.setState("super");
      this.setAnim(sm.anim, this.attack.total, false);
      this.invuln = sm.startup + 6;
      this.world.superFlash(this);
      FP.Audio.super();
      this.chargeGlow = 1.6;
    }
    tickSpecialBehaviour(a, t) {
      const sp = a.special;
      // uppercut rise
      if (sp.kind === "uppercut") {
        if (t === sp.startup) { this.onGround = false; this.vy = -(sp.rise || 700); this.vx = this.facing * 90; }
        // landing handled by integrate -> land
        if (!this.onGround) { /* in air */ }
      }
      if (sp.kind === "advance" && a.phase === "recovery") this.vx = U.approach(this.vx, 0, 30);
      // fire projectile / shock at active start
      if ((sp.kind === "projectile" || sp.kind === "shock") && a.phase === "active" && !a.fired) {
        a.fired = true; this.spawnProjectile(sp);
      }
      // super beam
      if (a.isSuper && a.phase === "active" && !a.fired) {
        a.fired = true; this.spawnSuper(sp);
      }
      // command grab check
      if ((sp.kind === "command_grab" || (a.isSuper && sp.grab)) && a.phase === "active" && !a.fired) {
        a.fired = true; this.tryCommandGrab(sp);
      }
      this.chargeGlow = Math.max(this.chargeGlow, 0.6);
    }
    spawnProjectile(sp) {
      const pj = sp.proj || { speed: 540, color: this.char.pal.energy, color2: this.char.pal.energy2, r: 20, life: 1.5, dmg: sp.dmg };
      const y = this.y - 110 * this.scale;
      const p = new FP.Projectile({
        x: this.x + this.facing * 60 * this.scale, y, vx: this.facing * pj.speed, vy: 0,
        r: pj.r, dmg: pj.dmg, owner: this.index, facing: this.facing,
        color: pj.color, color2: pj.color2, life: pj.life,
        kind: pj.fire ? "fire" : pj.slash ? "slash" : pj.spin ? "spin" : "ball",
        hits: pj.hits || 1, fx: this.world.fx,
      });
      this.world.spawnProjectile(p);
      this.world.fx.explode(p.x, y, pj.color, pj.color2, 16, 0.7);
      if (sp.kind === "shock") {
        // ground shockwave that travels
        p.kind = "shock"; p.fixed = false; p.vy = 0; p.y = this.y - 8; p.r = 30; p.maxR = 30;
        this.world.fx.shake(6, 0.2);
      }
      FP.Audio.fireball();
    }
    spawnSuper(sp) {
      if (sp.kind === "beam") {
        // big multi-hit fast projectile
        const y = this.y - 110 * this.scale;
        const p = new FP.Projectile({
          x: this.x + this.facing * 70 * this.scale, y, vx: this.facing * 760, vy: 0,
          r: 44, dmg: sp.dmg / 6, owner: this.index, facing: this.facing,
          color: sp.color, color2: sp.color2, life: 1.4,
          kind: sp.fire ? "fire" : "ball", hits: 8, hitstun: 10, fx: this.world.fx,
        });
        this.world.spawnProjectile(p);
        this.world.fx.explode(p.x, y, sp.color, sp.color2, 40, 1.4);
        this.world.fx.shake(14, 0.4);
      } else if (sp.kind === "rush_super") {
        // dash forward multi-hit, handled as advancing hitbox via attack.active multi
        this.vx = this.facing * 700;
        this.attack.multiHit = true;
      }
      FP.Audio.super();
    }
    tryCommandGrab(sp) {
      const o = this.opp;
      if (!o) return;
      const range = sp.range || 80;
      if (Math.abs(o.x - this.x) <= range && o.onGround && !o.invuln && o.state !== "knockdown") {
        o.getThrown(this, sp.dmg, true);
        this.world.fx.explode(o.x, o.y - 90, this.char.auraColor, this.char.pal.energy2, 30, 1.2);
        this.world.fx.shake(12, 0.35);
        FP.Audio.ko();
      }
    }

    // ---------- throws ----------
    tryThrow(pad) {
      const both = (pad.pressed.lp && (pad.down.lk || pad.pressed.lk)) || (pad.pressed.lk && (pad.down.lp || pad.pressed.lp));
      if (!both) return false;
      const o = this.opp;
      if (o && Math.abs(o.x - this.x) < 78 * this.scale && o.onGround && o.hitstun <= 0 && o.state !== "knockdown" && !o.invuln) {
        this.setState("throwStart"); this.setAnim("throw", 22, false);
        this._throwTarget = o; this._threw = false;
        return true;
      }
      return false;
    }
    tickThrow() {
      if (this.stateT === 8 && !this._threw) {
        this._threw = true;
        const o = this._throwTarget;
        if (o && Math.abs(o.x - this.x) < 100 * this.scale) {
          o.getThrown(this, 110, false);
          this.world.fx.explode(o.x, o.y - 80, "#ffd24a", "#a05010", 22, 1);
          this.world.fx.shake(9, 0.3);
          FP.Audio.hit(2);
        }
      }
      if (this.stateT >= this.animDur) this.toNeutral();
    }
    getThrown(by, dmg, isCommand) {
      this.damage(dmg, by, true);
      this.facing = -by.facing;
      this.x = by.x + by.facing * 60;
      this.onGround = false;
      this.vy = -520; this.vx = by.facing * (isCommand ? 360 : 280);
      this.setState("hurtAir"); this.setAnim("thrown", 40, false);
      this.hitstun = 30;
      this.world.addText(this.x, this.y - 200, "THROW", "#ff9b3d");
    }

    // ---------- taking hits ----------
    // called by match when an enemy hitbox connects
    tryGetHit(attacker, hb) {
      if (this.invuln > 0) return false;
      if (this.state === "knockdown" || this.state === "ko") return false;
      if (attacker._hitRegistered && attacker._hitRegistered.has(this.index + ":" + hb.id)) return false;

      const m = hb.move;
      const blocking = this.isBlocking(attacker, m);
      if (!attacker._hitRegistered) attacker._hitRegistered = new Set();
      attacker._hitRegistered.add(this.index + ":" + hb.id);

      if (blocking) {
        this.onBlock(attacker, m, hb);
      } else {
        this.onHit(attacker, m, hb);
      }
      return true;
    }

    isBlocking(attacker, m) {
      if (!this.onGround) return false; // no air block in this game
      if (this.state === "attack" || this.state === "special" || this.state === "super" || this.state === "hurt" || this.state === "hurtCrouch" || this.state === "throwStart") return false;
      const back = (this.facing > 0 && this.pad.down.left) || (this.facing < 0 && this.pad.down.right);
      if (!back) return false;
      const crouchBlock = this.pad.down.down;
      if (m.level === "low") return crouchBlock;
      if (m.level === "overhead") return !crouchBlock;
      return true; // mid/high: either
    }

    onBlock(attacker, m, hb) {
      const chip = Math.max(0, Math.round(m.dmg * 0.12));
      this.health -= chip;
      this.blockstun = (m.blockstun || 10);
      this.setState(this.pad.down.down ? "blockLow" : "block");
      this.setAnim(this.pad.down.down ? "blockLow" : "block", 12, false);
      const px = U.lerp(this.x, attacker.x, 0.5);
      const py = this.y - 120 * this.scale;
      this.world.fx.blockSpark(px, py, attacker.facing);
      this.world.fx.hitStop(Math.max(2, (m.hitstop || 4) - 2));
      this.world.fx.shake(2, 0.06);
      // pushback both
      this.vx = attacker.facing * (m.push || 80) * 1.2; this.pushTimer = 8;
      attacker.vx = -attacker.facing * (m.push || 80) * 0.4; attacker.pushTimer = 6;
      this.meter += 2; attacker.meter += 2;
      FP.Audio.block();
    }

    onHit(attacker, m, hb) {
      const counter = (this.state === "attack" || this.state === "special" || this.state === "super") && this.attack && this.attack.phase === "startup";
      let dmg = m.dmg;
      // combo scaling on attacker's running combo
      const combo = attacker.comboHits;
      const scale = Math.max(0.25, 1 - combo * 0.07);
      dmg = Math.round(dmg * scale * (counter ? 1.2 : 1));
      this.damage(dmg, attacker, false);

      attacker.comboHits++; attacker.comboTimer = 50;
      attacker.meter += (m.meter || 5); this.meter += Math.round((m.meter || 5) * 0.6);

      const power = U.clamp(m.dmg / 90, 0.5, 2);
      const px = U.lerp(this.x, attacker.x, 0.55);
      const py = this.y - (m.low ? 30 : m.air ? 60 : 130) * this.scale;
      this.world.fx.hitSpark(px, py, power, counter ? "#fff" : "#fff3c0", attacker.facing);
      this.world.fx.hitStop((m.hitstop || 6) + (m.dmg > 90 ? 3 : 0));
      this.world.fx.shake(3 + power * 4, 0.18);
      this.flashWhite = 0.85;

      if (counter) { this.world.addText(px, py - 30, "COUNTER!", "#ff5b5b", true); FP.Audio.counter(); }
      if (attacker.comboHits >= 2) this.world.addText(this.x, this.y - 210 * this.scale, attacker.comboHits + " HIT", "#ffd24a");

      // knockback & reaction
      const launch = m.launch || m.knockUp || (m.special && hb.move.knockUp);
      const kd = m.knockdown || m.sweep;
      if (!this.onGround || launch) {
        this.onGround = false;
        this.vy = -(launch ? 560 : 360);
        this.vx = attacker.facing * (m.kb || 180) * 0.6;
        this.setState("hurtAir"); this.setAnim("hurtHigh", 30, false);
        this.hitstun = m.hitstun + 6;
      } else if (kd) {
        this.vx = attacker.facing * (m.kb || 200);
        this.setState("hurt"); this.setAnim("hurtLow", 16, false);
        this.hitstun = 8; this.pushTimer = 6;
        // delayed knockdown
        this._pendingKD = true;
        this.knockdown();
      } else {
        this.vx = attacker.facing * (m.kb || 150);
        this.pushTimer = 6;
        if (m.low) { this.setState("hurtCrouch"); this.setAnim("hurtLow", m.hitstun, false); }
        else { this.setState("hurt"); this.setAnim("hurtHigh", m.hitstun, false); }
        this.hitstun = m.hitstun;
      }

      FP.Audio.hit(power);
      // check KO
      if (this.health <= 0) this.world.onKO(this, attacker);
    }

    // projectile hit
    getHitByProjectile(p) {
      if (this.invuln > 0 || this.state === "knockdown" || this.state === "ko") return false;
      const m = { dmg: p.dmg, level: "high", hitstun: p.hitstun || 16, kb: 220, push: 100, hitstop: 6, meter: 4 };
      const blocking = this.isBlocking({ facing: p.facing }, m);
      if (blocking) {
        const chip = Math.max(0, Math.round(p.dmg * 0.1));
        this.health -= chip; this.blockstun = 12;
        this.setState(this.pad.down.down ? "blockLow" : "block");
        this.setAnim(this.pad.down.down ? "blockLow" : "block", 12, false);
        this.world.fx.blockSpark(this.x + this.facing * 30, this.y - 120 * this.scale, p.facing);
        this.vx = p.facing * 120; this.pushTimer = 6;
        FP.Audio.block();
      } else {
        this.damage(p.dmg, { index: p.owner, facing: p.facing, comboHits: 0 }, false);
        this.world.fx.hitSpark(this.x, this.y - 120 * this.scale, 1.2, p.color, p.facing);
        this.world.fx.hitStop(6); this.world.fx.shake(6, 0.2); this.flashWhite = 0.85;
        this.vx = p.facing * 260; this.pushTimer = 8;
        this.setState("hurt"); this.setAnim("hurtHigh", m.hitstun, false); this.hitstun = m.hitstun;
        this.meter += 4;
        FP.Audio.hit(1.2);
        if (this.health <= 0) this.world.onKO(this, this.opp);
      }
      return true;
    }

    damage(d, attacker, raw) {
      this.health = Math.max(0, this.health - d);
    }

    // ---------- KO ----------
    startKO(byAttacker) {
      this.setState("ko"); this.koAnim = 0;
      this.onGround = false;
      this.vy = -360; this.vx = (byAttacker ? byAttacker.facing : -this.facing) * 220;
      this.setAnim("knockdown", 40, false);
      this.flashWhite = 1;
    }
    koPhysics() {
      const w = this.world;
      if (!this.onGround) {
        this.vy += w.gravity * DT; this.x += this.vx * DT; this.y += this.vy * DT;
        if (this.y >= w.groundY) { this.y = w.groundY; this.onGround = true; this.vy = 0; w.fx.landDust(this.x, this.y, 1.2); }
      } else { this.vx = U.approach(this.vx, 0, 16); }
      this.koAnim = Math.min(1, this.koAnim + 0.03);
    }
    celebrate() { this.setState("victory"); this.setAnim("victory", 90, true); this.vx = 0; }

    followGrab() { /* reserved for hold-type grabs */ }

    // ---------- draw ----------
    draw(ctx) {
      const airH = this.onGround ? 0 : (this.world.groundY - this.y);
      const glow = (this.chargeGlow > 0.15) ? U.hexA(this.char.auraColor, Math.min(0.9, this.chargeGlow)) : null;
      // meter-full shimmer
      const ready = this.meter >= 100 && this.state !== "ko";
      const anchor = FP.Render.draw(ctx, {
        x: this.x, y: this.y, facing: this.facing, char: this.char,
        pose: this.poseNow(), airHeight: airH,
        flashWhite: this.flashWhite,
        outlineGlow: glow || (ready ? U.hexA(this.char.auraColor, 0.5 + 0.3 * Math.sin(performance.now() / 120)) : null),
      });
      this._anchor = anchor;

      // charged aura particles
      if (this.chargeGlow > 0.3 || ready) {
        this.world.fx.aura(this.x, this.y - 70 * this.scale, this.char.auraColor, ready ? 1 : 2);
      }
    }
  }

  FP.Fighter = Fighter;
  FP.FPS = FPS; FP.DT = DT;
})(window);
