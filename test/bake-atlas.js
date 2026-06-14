/* Bakes assets/ryu.png from the in-engine renderer using the "baked"
   atlas profile. This proves the entire sprite path end to end and
   gives Ryu a working sprite sheet out of the box. Replace the PNG
   with your own artwork (matching the grid, or use the "source"
   profile + calibration overlay) to ship hand-drawn frames. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createCanvas } = require("@napi-rs/canvas");

const ASSETS = path.join(__dirname, "..", "assets");
fs.mkdirSync(ASSETS, { recursive: true });

// ---- engine sandbox (no DOM needed for the renderer) ----
let _t = 0;
const s = {
  document: { readyState: "complete", getElementById: () => ({ getContext: () => createCanvas(8, 8).getContext("2d"), addEventListener() {}, style: {}, width: 8, height: 8 }), querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: () => ({ getContext: () => createCanvas(8, 8).getContext("2d") }) },
  performance: { now: () => (_t += 16.67) },
  requestAnimationFrame: () => 0, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  Math, Date, JSON, console, parseInt, parseFloat, isNaN, isFinite, Object, Array, Set, Map, Number, String, Boolean,
  addEventListener() {}, removeEventListener() {},
};
s.window = s; s.globalThis = s; vm.createContext(s);
// only the bits the renderer needs
for (const n of ["utils", "skeleton", "characters", "render", "sprites", "atlas_ryu"])
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", n + ".js"), "utf8"), s, { filename: n + ".js" });

const FP = s.FP;
const prof = FP.AtlasRyu.profiles.baked;
const ryu = FP.charById ? FP.charById("ryu") : FP.ROSTER[0];
const A = FP.Skeleton.A;

const canvas = createCanvas(prof.sheetW, prof.sheetH);
const ctx = canvas.getContext("2d");

console.log(`Baking ${prof.cells.length} cells -> ${prof.sheetW}x${prof.sheetH}`);
for (let i = 0; i < prof.cells.length; i++) {
  const cell = prof.cells[i];
  const r = prof.rect(i);
  ctx.save();
  ctx.translate(r.x, r.y);
  // (optional) faint cell guide — comment out for clean frames
  // ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.strokeRect(0,0,r.w,r.h);
  const pose = (A[cell.anim] || A.idle)(cell.phase, {});
  FP.Render.draw(ctx, {
    x: r.ax, y: r.ay, facing: 1, char: ryu, pose,
    airHeight: 0, flashWhite: 0, outlineGlow: null, noShadow: true,
  });
  ctx.restore();
}

fs.writeFileSync(path.join(ASSETS, "ryu.png"), canvas.toBuffer("image/png"));
// also write the resolved atlas json for reference / external tools
const json = { profile: "baked", cw: prof.cw, ch: prof.ch, cols: prof.cols, rows: prof.rows, footMargin: prof.footMargin, anims: prof.anims };
fs.writeFileSync(path.join(ASSETS, "ryu_atlas.json"), JSON.stringify(json, null, 2));
console.log("wrote assets/ryu.png and assets/ryu_atlas.json");
