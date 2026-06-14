/* Verify the sprite path: load assets/ryu.png, inject it, render Ryu
   from the sheet (sprite) next to a procedural opponent. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const gameCanvas = createCanvas(1280, 720);
const gameCtx = gameCanvas.getContext("2d");
function fakeEl() { return { width: 1280, height: 720, style: {}, classList: { add() {}, remove() {}, contains() { return false; } }, getContext: () => gameCtx, addEventListener() {}, removeEventListener() {}, querySelectorAll() { return []; }, querySelector() { return fakeEl(); }, dataset: {} }; }
const document = { readyState: "complete", getElementById: (id) => (id === "game" ? { width: 1280, height: 720, getContext: () => gameCtx, addEventListener() {}, style: {} } : fakeEl()), querySelector: () => fakeEl(), querySelectorAll: () => [], addEventListener() {}, createElement: () => fakeEl() };
let _t = 0;
const s = { document, performance: { now: () => (_t += 16.67) }, requestAnimationFrame: () => 0, cancelAnimationFrame: () => 0, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, Math, Date, JSON, console, parseInt, parseFloat, isNaN, isFinite, Object, Array, Set, Map, Number, String, Boolean, addEventListener() {}, removeEventListener() {} };
s.window = s; s.globalThis = s; vm.createContext(s);
for (const n of ["utils", "input", "audio", "particles", "effects", "camera", "skeleton", "characters", "render", "sprites", "atlas_ryu", "stage", "projectile", "fighter", "ai", "hud", "match", "game", "main"])
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", n + ".js"), "utf8"), s, { filename: n + ".js" });
const FP = s.FP;

const OUT = path.join(__dirname, "..", "preview");
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const img = await loadImage(path.join(__dirname, "..", "assets", "ryu.png"));
  FP.Sprites.load("ryu", "assets/ryu.png");
  FP.Sprites.get("ryu").setImage(img);
  console.log("sprite ready:", FP.Sprites.ready("ryu"), "sheet", img.width + "x" + img.height);

  // ---- sprite frame sheet: draw selected animations straight from the atlas
  const prof = FP.AtlasRyu.profiles.baked;
  gameCtx.fillStyle = "#0e1426"; gameCtx.fillRect(0, 0, 1280, 720);
  gameCtx.fillStyle = "#19233d"; gameCtx.fillRect(0, 470, 1280, 250);
  const keys = ["idle", "walk", "crouch", "hp", "mk", "dp", "fireball", "super", "knockdown", "victory"];
  for (let i = 0; i < keys.length; i++) {
    const a = prof.anims[keys[i]];
    const mid = a.cells[Math.min(a.cells.length - 1, Math.ceil(a.cells.length / 2))];
    const r = prof.rect(mid);
    const x = 130 + (i % 5) * 255, y = 300 + ((i / 5) | 0) * 360;
    FP.Sprites.drawCell(gameCtx, "ryu", r, x, y, 1, 1, {});
    gameCtx.fillStyle = "#cdd"; gameCtx.font = "14px sans-serif"; gameCtx.textAlign = "center"; gameCtx.fillText(keys[i], x, y + 26);
  }
  gameCtx.fillStyle = "#fff"; gameCtx.font = "900 22px sans-serif"; gameCtx.textAlign = "left";
  gameCtx.fillText("RYU — rendered from assets/ryu.png (sprite atlas)", 28, 40);
  fs.writeFileSync(path.join(OUT, "10_ryu_sprites.png"), gameCanvas.toBuffer("image/png"));
  console.log("wrote 10_ryu_sprites.png");

  // ---- live match: Ryu (sprite) vs Liana (procedural)
  const G = FP.game;
  G.mode = "cpu"; G.sel.p1 = 0; G.sel.p2 = 2; G._enter("fight");
  G.next = null; G.fadeDir = 0; G.fade = 0;   // clear pending title transition
  for (let i = 0; i < 360; i++) { G.fixedUpdate(); FP.Input.advance(); G.next = null; G.fadeDir = 0; }
  G.fade = 0; gameCtx.clearRect(0, 0, 1280, 720); G.render();
  fs.writeFileSync(path.join(OUT, "11_fight_sprite.png"), gameCanvas.toBuffer("image/png"));
  console.log("wrote 11_fight_sprite.png");

  // ---- HUD showcase: super/EX bars, callouts, round stars, combo
  const M = G.match;
  M.fighters[0].meter = 100; M.fighters[0].ex = 72; M.fighters[0].comboHits = 5; M.fighters[0].comboTimer = 50;
  M.fighters[1].meter = 55; M.fighters[1].ex = 34;
  M.roundsWon = [1, 0]; M.timer = 76;
  M.hud.setCallout(0, "COUNTER!", "#ff5b5b");
  M.hud.setCallout(1, "TECHNICAL!", "#7bdc4a");
  for (let i = 0; i < 6; i++) M.hud.step(1 / 60, M.fighters);
  gameCtx.clearRect(0, 0, 1280, 720); G.render();
  fs.writeFileSync(path.join(OUT, "12_hud.png"), gameCanvas.toBuffer("image/png"));
  console.log("wrote 12_hud.png");
})();
