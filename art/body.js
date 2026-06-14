/* Full-body cel-shaded original fighter in a fighting stance, drawn shape
   by shape and baked to a PNG asset. node art/body.js -> /tmp/body.png */
const { createCanvas } = require("@napi-rs/canvas");
const fs = require("fs");
const W = 460, H = 600;

const P = {
  skin: "#e6b48c", skinSh: "#bf855a", skinSh2: "#9c6743", skinHi: "#f6d4b0",
  hair: "#241a16", hairHi: "#4a352a",
  gi: "#f1ede3", giSh: "#cbc4b1", giSh2: "#a39a82",
  pant: "#eee9dd", pantSh: "#c7c0ad",
  band: "#c5362c", bandSh: "#8e211a",
  glove: "#7a1f18", gloveSh: "#561310",
  belt: "#222", line: "#241910", lineSoft: "#5a4334", white: "#f7f1e8", eye: "#3a2a1c",
};
function ink(ctx, w, c) { ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.lineWidth = w; ctx.strokeStyle = c || P.line; ctx.stroke(); }
function curve(ctx, pts, close = true) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
  const l = pts[pts.length - 1]; ctx.lineTo(l[0], l[1]); if (close) ctx.closePath();
}
// tapered, cel-shaded limb segment a->b
function limb(ctx, a, b, w1, w2, base, sh) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * w1, a[1] + ny * w1);
  ctx.lineTo(b[0] + nx * w2, b[1] + ny * w2);
  ctx.arc(b[0], b[1], w2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
  ctx.lineTo(a[0] - nx * w1, a[1] - ny * w1);
  ctx.arc(a[0], a[1], w1, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
  ctx.closePath();
  ctx.fillStyle = base; ctx.fill();
  // cel shadow on lower/back edge
  ctx.save(); ctx.clip();
  ctx.beginPath();
  ctx.moveTo(a[0] - nx * w1, a[1] - ny * w1);
  ctx.lineTo(b[0] - nx * w2, b[1] - ny * w2);
  ctx.lineTo(b[0] - nx * w2 * 0.1, b[1] - ny * w2 * 0.1);
  ctx.lineTo(a[0] - nx * w1 * 0.1, a[1] - ny * w1 * 0.1);
  ctx.closePath(); ctx.fillStyle = sh; ctx.fill();
  ctx.restore();
  // outline
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * w1, a[1] + ny * w1);
  ctx.lineTo(b[0] + nx * w2, b[1] + ny * w2);
  ctx.arc(b[0], b[1], w2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
  ctx.lineTo(a[0] - nx * w1, a[1] - ny * w1);
  ctx.arc(a[0], a[1], w1, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
  ctx.closePath(); ink(ctx, 3, P.line);
}
function fist(ctx, x, y, r, base, sh) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = base; ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.3, y + r * 0.3, r * 0.8, 0, Math.PI); ctx.fillStyle = sh; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ink(ctx, 3, P.line);
  // knuckle lines
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x - r * 0.5, y - r * 0.2 + i * r * 0.35); ctx.lineTo(x + r * 0.5, y - r * 0.2 + i * r * 0.35); ink(ctx, 1.5, P.gloveSh); }
}

function drawBody(ctx) {
  ctx.clearRect(0, 0, W, H);
  // joints (facing right; stance)
  const J = {
    pelvis: [225, 355], chest: [238, 250], neck: [246, 212], head: [252, 158],
    shF: [292, 252], elF: [350, 286], fistF: [372, 240],   // lead arm (guard forward)
    shB: [200, 256], elB: [176, 320], fistB: [232, 296],   // rear arm (cocked)
    hipF: [256, 360], knF: [300, 448], ftF: [348, 548],    // lead leg
    hipB: [196, 360], knB: [150, 446], ftB: [120, 540],    // rear leg
  };

  // shadow on ground
  ctx.save(); ctx.translate(235, 556); ctx.scale(1, 0.26);
  ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fill(); ctx.restore();

  // ===== back limbs (darker) =====
  limb(ctx, J.hipB, J.knB, 26, 18, P.skinSh, P.skinSh2);
  limb(ctx, J.knB, J.ftB, 18, 11, P.skinSh, P.skinSh2);
  // back foot
  ctx.save(); ctx.translate(J.ftB[0], J.ftB[1]); ctx.beginPath(); ctx.ellipse(-6, 4, 26, 11, 0, 0, Math.PI * 2); ctx.fillStyle = "#20242c"; ctx.fill(); ink(ctx, 3, P.line); ctx.restore();
  limb(ctx, J.shB, J.elB, 18, 14, P.skinSh, P.skinSh2);   // rear upper arm
  limb(ctx, J.elB, J.fistB, 14, 11, P.skin, P.skinSh);    // rear forearm
  fist(ctx, J.fistB[0], J.fistB[1], 16, P.gloveSh, "#3c0d0a");

  // ===== gi pants =====
  ctx.fillStyle = P.pant;
  curve(ctx, [[J.hipB[0] - 10, 348], [J.pelvis[0], 332], [J.hipF[0] + 12, 348], [J.knF[0] + 22, 452], [J.knF[0] - 16, 470], [J.pelvis[0] + 6, 410], [J.knB[0] + 18, 470], [J.knB[0] - 18, 452]]);
  ctx.fill();
  ctx.fillStyle = P.pantSh;
  curve(ctx, [[J.pelvis[0] + 6, 410], [J.knF[0] + 22, 452], [J.knF[0] - 16, 470], [J.pelvis[0] + 8, 414]]); ctx.fill();
  curve(ctx, [[J.hipB[0] - 10, 348], [J.pelvis[0], 332], [J.hipF[0] + 12, 348], [J.knF[0] + 22, 452], [J.knF[0] - 16, 470], [J.pelvis[0] + 6, 410], [J.knB[0] + 18, 470], [J.knB[0] - 18, 452]], true); ink(ctx, 3.2, P.line);
  // fold lines
  ctx.beginPath(); ctx.moveTo(J.pelvis[0] - 10, 360); ctx.quadraticCurveTo(J.knB[0] + 6, 410, J.knB[0] + 2, 452); ink(ctx, 2.4, P.giSh2);
  ctx.beginPath(); ctx.moveTo(J.pelvis[0] + 16, 360); ctx.quadraticCurveTo(J.knF[0] - 4, 410, J.knF[0] + 4, 452); ink(ctx, 2.4, P.giSh2);

  // ===== lead leg (front, over pants bottom) =====
  limb(ctx, J.knF, J.ftF, 19, 12, P.skin, P.skinSh);
  ctx.save(); ctx.translate(J.ftF[0], J.ftF[1]); ctx.beginPath(); ctx.ellipse(6, 4, 28, 12, 0, 0, Math.PI * 2); ctx.fillStyle = "#20242c"; ctx.fill(); ink(ctx, 3, P.line); ctx.restore();

  // ===== torso (bare, muscular) =====
  ctx.fillStyle = P.skin;
  curve(ctx, [[J.shB[0] - 6, 258], [238, 232], [J.shF[0] + 8, 258], [292, 320], [J.pelvis[0] + 18, 360], [J.pelvis[0] - 20, 360], [196, 320]]);
  ctx.fill();
  // ab/pec shadow
  ctx.fillStyle = P.skinSh;
  curve(ctx, [[252, 250], [292, 300], [J.pelvis[0] + 18, 358], [248, 340], [250, 280]]); ctx.fill();
  // muscle lines
  ctx.beginPath(); ctx.moveTo(244, 262); ctx.quadraticCurveTo(252, 300, 248, 352); ink(ctx, 2.6, "rgba(120,80,50,0.55)");
  ctx.beginPath(); ctx.moveTo(210, 270); ctx.quadraticCurveTo(238, 296, 252, 290); ink(ctx, 2.6, "rgba(120,80,50,0.5)");
  ctx.beginPath(); ctx.moveTo(290, 272); ctx.quadraticCurveTo(266, 298, 252, 292); ink(ctx, 2.6, "rgba(120,80,50,0.5)");
  for (let i = 0; i < 3; i++) { const y = 305 + i * 18; ctx.beginPath(); ctx.moveTo(228, y); ctx.lineTo(272, y); ink(ctx, 2, "rgba(120,80,50,0.4)"); }
  curve(ctx, [[J.shB[0] - 6, 258], [238, 232], [J.shF[0] + 8, 258], [292, 320], [J.pelvis[0] + 18, 360], [J.pelvis[0] - 20, 360], [196, 320]], true); ink(ctx, 3, P.line);

  // belt
  ctx.fillStyle = P.belt; ctx.save(); ctx.translate(J.pelvis[0], 356); ctx.rotate(0.05);
  ctx.fillRect(-46, -8, 92, 18); ctx.fillStyle = "#111"; ctx.fillRect(-8, -10, 18, 30); ctx.restore();
  ctx.fillStyle = P.band; ctx.save(); ctx.translate(J.pelvis[0] - 2, 372); ctx.fillRect(-7, 0, 16, 34); ctx.restore();

  // ===== open gi vest (over shoulders, hanging behind arms) =====
  ctx.fillStyle = P.gi;
  curve(ctx, [[J.shB[0] - 14, 250], [186, 300], [196, 360], [222, 348], [218, 300], [J.shB[0] - 2, 256]]); ctx.fill();
  ctx.fillStyle = P.giSh; curve(ctx, [[196, 360], [206, 320], [220, 300], [222, 348]]); ctx.fill();
  curve(ctx, [[J.shB[0] - 14, 250], [186, 300], [196, 360], [222, 348]], false); ink(ctx, 3, P.line);
  ctx.fillStyle = P.gi;
  curve(ctx, [[J.shF[0] + 12, 250], [300, 300], [292, 360], [266, 350], [276, 300], [J.shF[0], 256]]); ctx.fill();
  ctx.fillStyle = P.giSh; curve(ctx, [[292, 360], [284, 320], [274, 300], [266, 350]]); ctx.fill();
  curve(ctx, [[J.shF[0] + 12, 250], [300, 300], [292, 360], [266, 350]], false); ink(ctx, 3, P.line);
  // collar trim
  ctx.fillStyle = P.band;
  curve(ctx, [[J.shB[0] - 2, 256], [220, 300], [224, 348], [216, 348], [214, 300], [J.shB[0] - 8, 256]]); ctx.fill();
  curve(ctx, [[J.shF[0], 256], [276, 300], [270, 348], [278, 348], [282, 300], [J.shF[0] + 6, 256]]); ctx.fill();

  // ===== HEAD ===== (compact version of the portrait, angled right)
  drawHead(ctx, J.head[0], J.head[1]);

  // ===== front (lead) arm over torso =====
  limb(ctx, J.shF, J.elF, 19, 15, P.skin, P.skinSh);
  limb(ctx, J.elF, J.fistF, 15, 12, P.skin, P.skinSh);
  // wrist wrap
  ctx.save(); ctx.translate((J.elF[0] + J.fistF[0]) / 2, (J.elF[1] + J.fistF[1]) / 2); ctx.fillStyle = "#efe9dc"; ctx.fillRect(-10, -14, 12, 28); ink(ctx, 1.5, P.giSh2); ctx.restore();
  fist(ctx, J.fistF[0], J.fistF[1], 18, P.glove, P.gloveSh);
}

function drawHead(ctx, cx, cy) {
  const r = 46;
  // back hair
  ctx.fillStyle = P.hair;
  curve(ctx, [[cx - 38, cy - 4], [cx - 36, cy - 44], [cx, cy - 60], [cx + 40, cy - 42], [cx + 44, cy + 6], [cx + 30, cy - 30], [cx, cy - 44], [cx - 28, cy - 30]]); ctx.fill();
  // face
  ctx.fillStyle = P.skin;
  curve(ctx, [[cx - 34, cy - 22], [cx - 28, cy - 44], [cx + 6, cy - 52], [cx + 38, cy - 40], [cx + 42, cy], [cx + 30, cy + 34], [cx + 6, cy + 52], [cx - 20, cy + 40], [cx - 34, cy + 8]]); ctx.fill();
  ctx.fillStyle = P.skinSh;
  curve(ctx, [[cx + 8, cy - 44], [cx + 38, cy - 30], [cx + 42, cy], [cx + 30, cy + 34], [cx + 14, cy + 20], [cx + 18, cy - 20]]); ctx.fill();
  // ear
  ctx.fillStyle = P.skin; curve(ctx, [[cx - 34, cy - 6], [cx - 44, cy + 2], [cx - 40, cy + 22], [cx - 28, cy + 18]]); ctx.fill(); ink(ctx, 2, P.lineSoft);
  // brows
  ctx.fillStyle = P.hair;
  curve(ctx, [[cx - 26, cy - 14], [cx - 8, cy - 22], [cx + 8, cy - 16], [cx + 4, cy - 8], [cx - 8, cy - 14], [cx - 26, cy - 6]]); ctx.fill();
  curve(ctx, [[cx + 16, cy - 16], [cx + 34, cy - 20], [cx + 42, cy - 12], [cx + 38, cy - 6], [cx + 30, cy - 12], [cx + 16, cy - 8]]); ctx.fill();
  // eyes
  const eye = (ex) => { ctx.fillStyle = P.white; ctx.beginPath(); ctx.ellipse(ex, cy, 9, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = P.eye; ctx.beginPath(); ctx.arc(ex + 1, cy, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex - 1, cy - 2, 1.6, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(ex - 9, cy - 4); ctx.quadraticCurveTo(ex, cy - 9, ex + 9, cy - 4); ink(ctx, 2.4, P.line); };
  eye(cx - 8); eye(cx + 26);
  // nose + mouth
  ctx.beginPath(); ctx.moveTo(cx + 6, cy + 2); ctx.quadraticCurveTo(cx + 16, cy + 14, cx + 8, cy + 18); ink(ctx, 2.4, P.lineSoft);
  ctx.beginPath(); ctx.moveTo(cx - 6, cy + 30); ctx.quadraticCurveTo(cx + 8, cy + 34, cx + 22, cy + 28); ink(ctx, 2.6, P.line);
  // headband
  ctx.fillStyle = P.band; curve(ctx, [[cx - 36, cy - 24], [cx + 6, cy - 34], [cx + 42, cy - 22], [cx + 42, cy - 32], [cx + 6, cy - 44], [cx - 36, cy - 34]]); ctx.fill();
  ctx.fillStyle = P.bandSh; curve(ctx, [[cx - 36, cy - 24], [cx + 6, cy - 30], [cx + 42, cy - 22], [cx + 42, cy - 26], [cx + 6, cy - 36], [cx - 36, cy - 28]]); ctx.fill();
  // band tail flying back
  ctx.fillStyle = P.band; curve(ctx, [[cx - 34, cy - 28], [cx - 60, cy - 36], [cx - 84, cy - 18], [cx - 70, cy - 10], [cx - 80, cy + 6], [cx - 56, cy - 6], [cx - 36, cy - 14]]); ctx.fill(); ink(ctx, 2, P.bandSh);
  // front hair spikes
  ctx.fillStyle = P.hair;
  curve(ctx, [[cx - 34, cy - 30], [cx - 28, cy - 50], [cx - 10, cy - 38], [cx + 4, cy - 54], [cx + 20, cy - 40], [cx + 38, cy - 50], [cx + 44, cy - 28], [cx + 30, cy - 40], [cx + 14, cy - 30], [cx, cy - 42], [cx - 14, cy - 30], [cx - 26, cy - 40]]); ctx.fill();
  // face outline
  curve(ctx, [[cx - 34, cy - 20], [cx - 34, cy + 8], [cx - 20, cy + 40], [cx + 6, cy + 52], [cx + 30, cy + 34], [cx + 42, cy]], false); ink(ctx, 3, P.line);
}

const c = createCanvas(W, H); const ctx = c.getContext("2d");
drawBody(ctx);
fs.writeFileSync("/tmp/body.png", c.toBuffer("image/png"));
console.log("wrote /tmp/body.png");
