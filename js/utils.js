/* ============================================================
   utils.js — shared math / helpers
   Exposed on the global FP namespace so plain <script> tags
   can share state without a module bundler.
   ============================================================ */
(function (global) {
  "use strict";

  const FP = global.FP || (global.FP = {});

  const U = {
    TAU: Math.PI * 2,
    DEG: Math.PI / 180,

    clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp(a, b, t) { return a + (b - a) * t; },
    // angle-aware lerp (shortest path)
    alerp(a, b, t) {
      let d = (b - a) % U.TAU;
      d = ((2 * d) % U.TAU) - d;
      return a + d * t;
    },
    inv(a, b, v) { return b === a ? 0 : (v - a) / (b - a); },
    map(v, a, b, c, d) { return U.lerp(c, d, U.inv(a, b, v)); },
    sign(v) { return v < 0 ? -1 : v > 0 ? 1 : 0; },
    approach(v, target, step) {
      if (v < target) return Math.min(v + step, target);
      if (v > target) return Math.max(v - step, target);
      return v;
    },
    rad(d) { return d * U.DEG; },

    // easing
    smooth(t) { return t * t * (3 - 2 * t); },
    easeOut(t) { return 1 - (1 - t) * (1 - t); },
    easeIn(t) { return t * t; },
    easeOutBack(t) { const c = 1.70158, s = c + 1; return 1 + s * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    easeOutElastic(t) {
      const c = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
    },
    pulse(t) { return Math.sin(t * Math.PI); }, // 0->1->0
  };

  // Seedable RNG (mulberry32) so shuffles can be deterministic if needed
  U.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  let _r = U.rng((Math.random() * 1e9) | 0);
  U.rand = (a = 1, b) => (b === undefined ? _r() * a : a + _r() * (b - a));
  U.randInt = (a, b) => Math.floor(U.rand(a, b + 1));
  U.pick = (arr) => arr[(_r() * arr.length) | 0];
  U.chance = (p) => _r() < p;

  // Axis-aligned box overlap. Boxes are {x,y,w,h} with (x,y)=top-left.
  U.overlap = function (a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  };

  // color helpers ------------------------------------------------
  U.hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  U.rgba = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

  // Shade a hex color (#rrggbb) by amt (-1..1)
  U.shade = function (hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r += r * amt; g += g * amt; b += b * amt; }
    return U.rgba(r, g, b, 1);
  };
  U.hexA = function (hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return U.rgba((n >> 16) & 255, (n >> 8) & 255, n & 255, a);
  };

  // Vector helper used by skeleton / physics
  U.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  U.angle = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

  FP.U = U;
})(window);
