/* ============================================================
   input.js — keyboard + touch input, per-player command buffer,
   and fighting-game motion recognition (QCF / QCB / DP / charge).
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP;

  // Logical buttons a fighter understands.
  // Directions are stored relative to the keyboard (left/right), the
  // fighter converts to forward/back based on which way it faces.
  const BTN = ["up", "down", "left", "right", "lp", "mp", "hp", "lk", "mk", "hk", "start"];

  // Default key maps (KeyboardEvent.code) for two local players.
  const MAPS = {
    p1: {
      KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right",
      KeyF: "lp", KeyG: "mp", KeyH: "hp",
      KeyV: "lk", KeyB: "lk", KeyN: "mk", KeyJ: "hp", // extras / comfort
      KeyT: "lp", KeyY: "mp", KeyU: "hp",
      Digit1: "lp", Digit2: "mp", Digit3: "hp",
      Enter: "start",
    },
    // a clean, documented P1 layout (overrides the comfort extras above)
    _p1clean: {
      KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right",
      KeyF: "lp", KeyG: "mp", KeyH: "hp",
      KeyC: "lk", KeyV: "mk", KeyB: "hk",
      Enter: "start", Space: "start",
    },
    p2: {
      ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
      Numpad4: "lp", Numpad5: "mp", Numpad6: "hp",
      Numpad1: "lk", Numpad2: "mk", Numpad3: "hk",
      Delete: "lp", End: "mp", PageDown: "hp",
      Home: "lk", Insert: "mk", PageUp: "hk",
      NumpadEnter: "start",
    },
  };
  // promote the clean P1 layout
  MAPS.p1 = Object.assign({}, MAPS.p1, MAPS._p1clean);

  class PlayerInput {
    constructor(map) {
      this.map = map;
      this.down = {};        // current held state
      this.pressed = {};     // edge: pressed this frame
      this.released = {};
      this.buffer = [];      // recent inputs {dir, btns, t}
      this.frame = 0;
      this._touch = {};      // virtual presses from touch UI
      BTN.forEach((b) => { this.down[b] = false; });
    }

    _set(btn, val) {
      if (val && !this.down[btn]) this.pressed[btn] = true;
      if (!val && this.down[btn]) this.released[btn] = true;
      this.down[btn] = val;
    }

    handleKey(code, val) {
      const b = this.map[code];
      if (!b) return false;
      this._set(b, val);
      return true;
    }
    setTouch(b, val) { this._touch[b] = val; this._set(b, val); }

    // numeric direction (numpad notation): 5=neutral,6=right,4=left,8=up,2=down + diagonals
    dirNumpad() {
      const u = this.down.up, d = this.down.down, l = this.down.left, r = this.down.right;
      let x = (r ? 1 : 0) - (l ? 1 : 0);
      let y = (u ? 1 : 0) - (d ? 1 : 0);
      const tbl = {
        "-1,1": 7, "0,1": 8, "1,1": 9,
        "-1,0": 4, "0,0": 5, "1,0": 6,
        "-1,-1": 1, "0,-1": 2, "1,-1": 3,
      };
      return tbl[x + "," + y];
    }

    // Called once per fixed step AFTER fighters read pressed/released.
    advance() {
      const dir = this.dirNumpad();
      const last = this.buffer[this.buffer.length - 1];
      const btns = [];
      ["lp", "mp", "hp", "lk", "mk", "hk"].forEach((b) => { if (this.pressed[b]) btns.push(b); });
      if (!last || last.dir !== dir || btns.length) {
        this.buffer.push({ dir, btns, t: this.frame });
        if (this.buffer.length > 24) this.buffer.shift();
      }
      this.frame++;
      this.pressed = {};
      this.released = {};
    }

    /* Motion recognition. `facing` = +1 if fighter faces right, -1 if left.
       A special fires when (a) one of `withBtns` is pressed THIS frame AND
       (b) the required direction sequence appears in the recent history,
       all normalized so that "forward" always points toward the foe.
       Decoupling the button edge from the direction history makes input
       order-independent and tolerant of how fast the motion was done. */
    motion(seq, withBtns, facing, window = 14) {
      if (!withBtns.some((b) => this.pressed[b])) return false;
      const fwd = (d) => {
        if (facing === 1) return d;
        const m = { 1: 3, 3: 1, 4: 6, 6: 4, 7: 9, 9: 7 };
        return m[d] || d;
      };
      const now = this.frame;
      const dirs = [];
      for (let i = this.buffer.length - 1; i >= 0; i--) {
        const e = this.buffer[i];
        if (now - e.t > window) break;
        dirs.unshift(fwd(e.dir));
      }
      dirs.push(fwd(this.dirNumpad())); // include the live direction
      // match seq as an ordered subsequence
      let si = seq.length - 1;
      for (let i = dirs.length - 1; i >= 0 && si >= 0; i--) {
        if (dirs[i] === seq[si]) si--;
      }
      return si < 0;
    }
  }

  class InputManager {
    constructor() {
      this.p1 = new PlayerInput(MAPS.p1);
      this.p2 = new PlayerInput(MAPS.p2);
      this.anyStart = false;
      this._bind();
    }
    _bind() {
      const onKey = (e, val) => {
        // prevent page scroll on arrows/space
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
        let used = this.p1.handleKey(e.code, val);
        used = this.p2.handleKey(e.code, val) || used;
        if (val && (e.code === "Enter" || e.code === "Space" || e.code === "NumpadEnter")) this.anyStart = true;
      };
      window.addEventListener("keydown", (e) => { if (!e.repeat) onKey(e, true); });
      window.addEventListener("keyup", (e) => onKey(e, false));

      // touch overlay
      const touch = document.getElementById("touch");
      if (touch) {
        const map = { left: "left", right: "right", up: "up", down: "down", lp: "lp", mp: "mp", hp: "hp", lk: "lk", mk: "mk", hk: "hk" };
        touch.querySelectorAll(".tc-btn").forEach((btn) => {
          const k = map[btn.dataset.k];
          const press = (v) => (ev) => { ev.preventDefault(); this.p1.setTouch(k, v); this.anyStart = true; };
          btn.addEventListener("touchstart", press(true), { passive: false });
          btn.addEventListener("touchend", press(false), { passive: false });
          btn.addEventListener("touchcancel", press(false), { passive: false });
          btn.addEventListener("mousedown", press(true));
          btn.addEventListener("mouseup", press(false));
          btn.addEventListener("mouseleave", press(false));
        });
        if ("ontouchstart" in window) touch.classList.remove("hidden");
      }
    }
    consumeStart() { const s = this.anyStart; this.anyStart = false; return s; }
    advance() { this.p1.advance(); this.p2.advance(); }
  }

  FP.Input = new InputManager();
  FP.PlayerInput = PlayerInput;   // reused by the AI as a "virtual pad"
  FP.BTN = BTN;
})(window);
