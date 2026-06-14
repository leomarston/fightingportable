/* Render real PNG frames of the game using @napi-rs/canvas so the
   procedural graphics can be visually verified. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createCanvas } = require("@napi-rs/canvas");

const OUT = path.join(__dirname, "..", "preview");
fs.mkdirSync(OUT, { recursive: true });

// ---- real canvas for the game, fake everything else ----
const gameCanvas = createCanvas(1280, 720);
const gameCtx = gameCanvas.getContext("2d");

function fakeEl() {
  return { width: 1280, height: 720, style: {}, classList: { add() {}, remove() {}, contains() { return false; } },
    getContext: () => gameCtx, addEventListener() {}, removeEventListener() {},
    querySelectorAll() { return []; }, querySelector() { return fakeEl(); }, dataset: {} };
}
const document = {
  readyState: "complete",
  getElementById: (id) => (id === "game" ? { width: 1280, height: 720, getContext: () => gameCtx, addEventListener() {}, style: {} } : fakeEl()),
  querySelector: () => fakeEl(), querySelectorAll: () => [], addEventListener() {}, createElement: () => fakeEl(),
};
let _t = 0;
const s = {
  document, performance: { now: () => (_t += 16.67) },
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => 0,
  setTimeout: (f) => { return 0; }, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  Math, Date, JSON, console, parseInt, parseFloat, isNaN, isFinite,
  Object, Array, Set, Map, Number, String, Boolean,
  addEventListener() {}, removeEventListener() {},
};
s.window = s; s.globalThis = s; vm.createContext(s);
for (const n of ["utils", "input", "audio", "particles", "effects", "camera", "skeleton", "characters", "render", "stage", "projectile", "fighter", "ai", "hud", "match", "game", "main"])
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", n + ".js"), "utf8"), s, { filename: n + ".js" });

const FP = s.FP;
const G = FP.game;
function save(name) { fs.writeFileSync(path.join(OUT, name), gameCanvas.toBuffer("image/png")); console.log("wrote", name); }
function clear() { gameCtx.clearRect(0, 0, 1280, 720); }

// 1. TITLE
G.fade = 0; G.screen = "title"; for (let i = 0; i < 30; i++) G.fixedUpdate();
G.fade = 0; clear(); G.render(); save("01_title.png");

// 2. SELECT
G.mode = "versus"; G._enter("select"); G.sel.p1 = 0; G.sel.p2 = 2; G.fade = 0;
for (let i = 0; i < 20; i++) { G.fixedUpdate(); }
G.fade = 0; clear(); G.render(); save("02_select.png");

// 3. VS
G._enter("vs"); G._vsT = 1.2; G.fade = 0; clear(); G.render(); save("03_vs.png");

// 4. FIGHT (run a CPU match into action)
G.mode = "cpu"; G.sel.p1 = 0; G.sel.p2 = 2; G._enter("fight");
for (let i = 0; i < 520; i++) { G.fixedUpdate(); FP.Input.advance(); }
G.fade = 0; clear(); G.render(); save("04_fight.png");

// keep stepping for a different action frame + try to catch effects
for (let i = 0; i < 240; i++) { G.fixedUpdate(); FP.Input.advance(); }
G.fade = 0; clear(); G.render(); save("05_fight2.png");

// 6. POSE SHEET — each character idle, drawn big on a dark bg
function poseSheet(file, anim, phase) {
  clear();
  gameCtx.fillStyle = "#10131f"; gameCtx.fillRect(0, 0, 1280, 720);
  // floor line
  gameCtx.fillStyle = "#1c2233"; gameCtx.fillRect(0, 560, 1280, 160);
  const A = FP.Skeleton.A;
  for (let i = 0; i < FP.ROSTER.length; i++) {
    const ch = FP.ROSTER[i];
    const x = 140 + i * 250, y = 560;
    const pose = (A[anim] || A.idle)(phase, {});
    FP.Render.draw(gameCtx, { x, y, facing: 1, char: ch, pose, airHeight: 0, flashWhite: 0, outlineGlow: null });
    gameCtx.fillStyle = "#fff"; gameCtx.font = "900 20px sans-serif"; gameCtx.textAlign = "center";
    gameCtx.fillText(ch.name, x, 612);
    gameCtx.fillStyle = "#9aa"; gameCtx.font = "italic 13px sans-serif";
    gameCtx.fillText(ch.title, x, 632);
  }
  save(file);
}
poseSheet("06_idle.png", "idle", 0.25);

// 7. ACTION SHEET — Ryu across several poses
function actionSheet(file, charIdx) {
  clear();
  gameCtx.fillStyle = "#0e1426"; gameCtx.fillRect(0, 0, 1280, 720);
  gameCtx.fillStyle = "#19233d"; gameCtx.fillRect(0, 560, 1280, 160);
  const A = FP.Skeleton.A, ch = FP.ROSTER[charIdx];
  const anims = [["idle", 0.2], ["walkF", 0.3], ["crouch", 1], ["jump", 0.5], ["hp", 0.5], ["mk", 0.5], ["fireball", 0.6], ["dp", 0.5], ["super", 0.62], ["hurtHigh", 0]];
  for (let i = 0; i < anims.length; i++) {
    const x = 130 + (i % 5) * 255, y = 320 + Math.floor(i / 5) * 360;
    const pose = (A[anims[i][0]] || A.idle)(anims[i][1], {});
    FP.Render.draw(gameCtx, { x, y, facing: 1, char: ch, pose, airHeight: anims[i][0] === "jump" ? 120 : 0, flashWhite: anims[i][0] === "hurtHigh" ? 0.6 : 0, outlineGlow: anims[i][0] === "super" ? "#7fe3ff" : null });
    gameCtx.fillStyle = "#cdd"; gameCtx.font = "13px sans-serif"; gameCtx.textAlign = "center";
    gameCtx.fillText(anims[i][0], x, y + 26);
  }
  gameCtx.fillStyle = "#fff"; gameCtx.font = "900 24px sans-serif"; gameCtx.textAlign = "left";
  gameCtx.fillText(ch.name + " — animation poses", 30, 40);
  save(file);
}
actionSheet("07_actions_ryu.png", 0);
actionSheet("08_actions_goro.png", 3);

console.log("done");
