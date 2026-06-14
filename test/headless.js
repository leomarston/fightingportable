/* Headless smoke test: fake DOM + 2D canvas, run the real engine
   for thousands of frames across every character to surface runtime
   errors that `node --check` can't (undefined refs, bad math, etc.). */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ---- fake 2D context -------------------------------------------------
function makeCtx() {
  const noop = () => {};
  const grad = () => ({ addColorStop: noop });
  const ctx = {
    canvas: { width: 1280, height: 720 },
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
    arcTo: noop, quadraticCurveTo: noop, bezierCurveTo: noop, ellipse: noop, rect: noop,
    fill: noop, stroke: noop, clip: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    fillText: noop, strokeText: noop, setLineDash: noop, drawImage: noop,
    createLinearGradient: grad, createRadialGradient: grad, createPattern: () => null,
    measureText: () => ({ width: 42 }),
    setTransform: noop, resetTransform: noop, save2: noop,
  };
  // allow arbitrary property assignment (fillStyle, font, etc.)
  return new Proxy(ctx, {
    get(t, k) { return k in t ? t[k] : (typeof k === "string" ? () => {} : undefined); },
    set(t, k, v) { t[k] = v; return true; },
  });
}

// ---- fake DOM --------------------------------------------------------
function makeEl() {
  return {
    width: 1280, height: 720, style: {}, classList: { add() {}, remove() {}, contains() { return false; } },
    getContext: () => makeCtx(),
    addEventListener() {}, removeEventListener() {},
    querySelectorAll() { return []; }, querySelector() { return makeEl(); },
    dataset: {},
  };
}
const document = {
  readyState: "complete",
  getElementById: () => makeEl(),
  querySelector: () => makeEl(),
  querySelectorAll: () => [],
  addEventListener() {}, createElement: () => makeEl(),
};

let _t = 0;
const sandbox = {
  window: null,
  document,
  performance: { now: () => (_t += 16.67) },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => 0,
  setTimeout: (fn) => { try { fn(); } catch (e) {} return 0; },
  clearTimeout: () => {},
  setInterval: () => 0, clearInterval: () => {},
  Math, Date, JSON, console,
  parseInt, parseFloat, isNaN, isFinite, Object, Array, Set, Map, Number, String, Boolean,
  addEventListener() {}, removeEventListener() {},
};
sandbox.window = sandbox;       // window === global
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// ---- load engine files in index.html order --------------------------
const order = ["utils", "input", "audio", "particles", "effects", "camera",
  "skeleton", "characters", "render", "stage", "projectile", "fighter", "ai", "hud", "match", "game", "main"];
const base = path.join(__dirname, "..", "js");
for (const name of order) {
  const src = fs.readFileSync(path.join(base, name + ".js"), "utf8");
  vm.runInContext(src, sandbox, { filename: name + ".js" });
}

const FP = sandbox.FP;
if (!FP) throw new Error("FP namespace missing");
console.log("Engine loaded. Roster:", FP.ROSTER.map((c) => c.id).join(", "));

// ---- run CPU-vs-CPU matches for every pair, a few rounds each --------
function runMatch(p1, p2, stage, frames) {
  let koSeen = false, matchEnded = -1;
  const m = new FP.Match({
    p1: FP.ROSTER[p1], p2: FP.ROSTER[p2],
    pads: [new FP.PlayerInput({}), new FP.PlayerInput({})],
    cpu: [true, true], difficulty: 0.7, stage, bestOf: 3,
    vw: 1280, vh: 720, onMatchEnd: (w) => { matchEnded = w; },
  });
  const ctx = makeCtx();
  for (let i = 0; i < frames; i++) {
    m.step();
    FP.Input.advance();
    if (i % 3 === 0) m.draw(ctx);   // exercise the renderer too
    if (m.roundState === "ko") koSeen = true;
    if (matchEnded >= 0) break;
  }
  return { koSeen, matchEnded, state: m.roundState, hp: [m.fighters[0].health, m.fighters[1].health], wins: m.roundsWon.slice() };
}

let pass = 0, fail = 0;
const stages = ["temple", "harbor"];
for (let a = 0; a < FP.ROSTER.length; a++) {
  const b = (a + 1) % FP.ROSTER.length;
  try {
    const r = runMatch(a, b, stages[a % 2], 8000);
    console.log(`  ${FP.ROSTER[a].id} vs ${FP.ROSTER[b].id} @${stages[a % 2]} -> state=${r.state} wins=${r.wins} koSeen=${r.koSeen} end=${r.matchEnded}`);
    pass++;
  } catch (e) {
    fail++;
    console.error(`  FAIL ${FP.ROSTER[a].id} vs ${FP.ROSTER[b].id}:`, e && e.stack || e);
  }
}

// ---- exercise the menu / game shell too -----------------------------
try {
  const g = new FP.Game(makeEl());
  g.start();
  for (let i = 0; i < 200; i++) g.fixedUpdate(), FP.Input.advance(), g.render();
  // drive into select + fight via direct calls
  g.mode = "cpu"; g.sel.p1 = 1; g.sel.p2 = 4; g._enter("fight");
  for (let i = 0; i < 4000 && g.screen === "fight"; i++) {
    g.fixedUpdate(); FP.Input.advance();
    if (i % 4 === 0) g.render();
  }
  console.log("  Game shell ran. screen=" + g.screen);
  pass++;
} catch (e) { fail++; console.error("  FAIL game shell:", e && e.stack || e); }

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
