/* Hand-illustrated, cel-shaded original fighter portrait, drawn shape by
   shape and baked to a real PNG asset. Original character ("The Wanderer"
   shoto archetype) — not based on any existing game's character.
   node art/illustrate.js  ->  /tmp/portrait.png  (preview while iterating) */
const { createCanvas } = require("@napi-rs/canvas");
const fs = require("fs");

const W = 540, H = 680;

// ---------- palette ----------
const P = {
  skin: "#e6b48c", skinSh: "#c0875e", skinSh2: "#9c6743", skinHi: "#f6d4b0",
  hair: "#241a16", hairSh: "#140d0a", hairHi: "#4a352a",
  gi: "#f3efe6", giSh: "#cdc6b4", giSh2: "#a59d86", giHi: "#ffffff",
  band: "#c5362c", bandSh: "#8e211a", bandHi: "#e8675a",
  belt: "#2a2a2a",
  line: "#2a1d16", lineSoft: "#5a4334",
  eye: "#3a2a1c", white: "#f7f1e8",
};

function poly(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
// smooth curve through points
function curve(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    ctx.quadraticCurveTo(p0[0], p0[1], mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
  if (close) ctx.closePath();
}
function ink(ctx, w = 3, c = P.line) { ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.lineWidth = w; ctx.strokeStyle = c; ctx.stroke(); }

function drawPortrait(ctx) {
  ctx.clearRect(0, 0, W, H);

  // ===== background glow =====
  const bg = ctx.createRadialGradient(W / 2, 250, 40, W / 2, 300, 420);
  bg.addColorStop(0, "rgba(60,40,90,0.0)"); bg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  const cx = 270;

  // ============ TORSO / GI (drawn first, behind head) ============
  // shoulders + chest mass
  ctx.fillStyle = P.skin;
  curve(ctx, [[120, 470], [150, 410], [cx, 388], [392, 410], [430, 470], [440, 680], [100, 680]]);
  ctx.fill();
  // chest cel shadow
  ctx.fillStyle = P.skinSh;
  curve(ctx, [[300, 430], [360, 450], [400, 520], [380, 680], [300, 680], [300, 520]]);
  ctx.fill();
  // pecs separation
  ctx.fillStyle = "rgba(0,0,0,0.10)";
  curve(ctx, [[cx, 470], [cx + 6, 540], [cx, 600]], false); ink(ctx, 6, "rgba(40,20,10,0.18)");
  // collarbones
  ctx.beginPath(); ctx.moveTo(200, 455); ctx.quadraticCurveTo(cx, 470, 348, 455); ink(ctx, 3, P.lineSoft);
  // pec shade lines
  ctx.beginPath(); ctx.moveTo(196, 470); ctx.quadraticCurveTo(232, 520, cx - 6, 520); ink(ctx, 4, "rgba(120,80,50,0.5)");
  ctx.beginPath(); ctx.moveTo(348, 472); ctx.quadraticCurveTo(308, 522, cx + 6, 522); ink(ctx, 4, "rgba(120,80,50,0.5)");

  // open gi jacket — left flap
  ctx.fillStyle = P.gi;
  curve(ctx, [[120, 470], [96, 560], [104, 680], [250, 680], [230, 560], [196, 470]]);
  ctx.fill();
  ctx.fillStyle = P.giSh;  // inner shadow fold
  curve(ctx, [[196, 470], [214, 560], [240, 680], [250, 680], [230, 560], [200, 480]]);
  ctx.fill();
  // right flap
  ctx.fillStyle = P.gi;
  curve(ctx, [[430, 470], [452, 560], [444, 680], [300, 680], [322, 560], [352, 470]]);
  ctx.fill();
  ctx.fillStyle = P.giSh;
  curve(ctx, [[352, 470], [330, 560], [306, 680], [300, 680], [322, 560], [348, 480]]);
  ctx.fill();
  // gi fold lines
  ctx.beginPath(); ctx.moveTo(150, 540); ctx.quadraticCurveTo(160, 610, 150, 680); ink(ctx, 3, P.giSh2);
  ctx.beginPath(); ctx.moveTo(420, 540); ctx.quadraticCurveTo(410, 610, 420, 680); ink(ctx, 3, P.giSh2);
  // collar trim
  ctx.fillStyle = P.band;
  poly(ctx, [[196, 470], [214, 478], [250, 680], [228, 680]]); ctx.fill();
  poly(ctx, [[352, 470], [334, 478], [300, 680], [322, 680]]); ctx.fill();
  // jacket outlines
  curve(ctx, [[120, 470], [96, 560], [104, 680]], false); ink(ctx, 3.5);
  curve(ctx, [[196, 470], [222, 570], [248, 680]], false); ink(ctx, 3.5);
  curve(ctx, [[430, 470], [452, 560], [444, 680]], false); ink(ctx, 3.5);
  curve(ctx, [[352, 470], [328, 570], [302, 680]], false); ink(ctx, 3.5);

  // neck
  ctx.fillStyle = P.skin;
  poly(ctx, [[232, 360], [308, 360], [322, 430], [218, 430]]); ctx.fill();
  ctx.fillStyle = P.skinSh; // neck shadow under jaw
  curve(ctx, [[232, 366], [cx, 404], [308, 366], [300, 400], [240, 400]]); ctx.fill();
  ctx.beginPath(); ctx.moveTo(232, 360); ctx.lineTo(218, 430); ink(ctx, 3);
  ctx.beginPath(); ctx.moveTo(308, 360); ctx.lineTo(322, 430); ink(ctx, 3);

  // ============ HEAD ============
  // hair back mass
  ctx.fillStyle = P.hair;
  curve(ctx, [[168, 196], [176, 120], [cx, 92], [372, 122], [378, 210], [360, 250], [352, 150], [cx, 130], [192, 152], [186, 250]]);
  ctx.fill();

  // face base
  ctx.fillStyle = P.skin;
  curve(ctx, [[190, 196], [196, 150], [cx, 132], [350, 152], [352, 210], [338, 268], [306, 330], [cx, 348], [234, 330], [202, 268], [188, 210]]);
  ctx.fill();
  // face cel shadow (right side + under hair)
  ctx.fillStyle = P.skinSh;
  curve(ctx, [[300, 150], [350, 168], [352, 210], [336, 270], [306, 330], [286, 300], [300, 220]]);
  ctx.fill();
  ctx.fillStyle = "rgba(160,110,70,0.5)"; // forehead shade under band
  curve(ctx, [[196, 188], [cx, 196], [350, 188], [344, 210], [196, 210]]); ctx.fill();
  // ears
  ctx.fillStyle = P.skin;
  curve(ctx, [[190, 214], [176, 222], [180, 252], [196, 250]]); ctx.fill(); ink(ctx, 2.5, P.lineSoft);
  curve(ctx, [[350, 214], [364, 222], [360, 252], [344, 250]]); ctx.fill(); ink(ctx, 2.5, P.lineSoft);

  // eyebrows (thick, intense, angled)
  ctx.fillStyle = P.hair;
  curve(ctx, [[206, 232], [236, 222], [262, 230], [258, 240], [234, 234], [208, 242]]); ctx.fill();
  curve(ctx, [[334, 232], [304, 220], [280, 230], [284, 240], [306, 232], [332, 242]]); ctx.fill();

  // eyes
  const eye = (ex, dir) => {
    ctx.fillStyle = P.white;
    curve(ctx, [[ex - 22, 256], [ex - 4, 248], [ex + 18, 252], [ex + 14, 266], [ex - 8, 268], [ex - 22, 262]]); ctx.fill();
    // iris
    ctx.fillStyle = P.eye;
    ctx.beginPath(); ctx.ellipse(ex - 2 + dir * 2, 258, 8, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a120c"; ctx.beginPath(); ctx.arc(ex - 2 + dir * 2, 259, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex - 5 + dir * 2, 254, 2.2, 0, Math.PI * 2); ctx.fill();
    // upper lid line
    ctx.beginPath(); ctx.moveTo(ex - 22, 256); ctx.quadraticCurveTo(ex - 2, 246, ex + 18, 252); ink(ctx, 3.2, P.line);
    // lower lash
    ctx.beginPath(); ctx.moveTo(ex - 20, 263); ctx.quadraticCurveTo(ex - 4, 269, ex + 14, 266); ink(ctx, 1.6, P.lineSoft);
  };
  eye(228, 1); eye(312, -1);

  // nose
  ctx.beginPath(); ctx.moveTo(cx - 4, 262); ctx.quadraticCurveTo(cx + 2, 290, cx + 12, 296);
  ctx.quadraticCurveTo(cx + 2, 304, cx - 8, 298); ink(ctx, 3, P.lineSoft);
  ctx.fillStyle = "rgba(150,100,64,0.45)";
  curve(ctx, [[cx - 8, 286], [cx + 12, 296], [cx + 2, 304], [cx - 10, 300]]); ctx.fill();

  // mouth (serious)
  ctx.beginPath(); ctx.moveTo(244, 314); ctx.quadraticCurveTo(cx, 322, 296, 314); ink(ctx, 3.4, P.line);
  ctx.beginPath(); ctx.moveTo(250, 322); ctx.quadraticCurveTo(cx, 326, 290, 322); ink(ctx, 2, "rgba(150,90,60,0.5)");

  // scar over right brow (distinct, original)
  ctx.beginPath(); ctx.moveTo(330, 214); ctx.lineTo(322, 246); ink(ctx, 2.4, "rgba(150,90,60,0.7)");

  // jaw / cheek shade
  ctx.beginPath(); ctx.moveTo(236, 300); ctx.quadraticCurveTo(252, 332, cx, 344); ink(ctx, 2.4, "rgba(150,100,64,0.4)");

  // ============ HEADBAND ============
  ctx.fillStyle = P.band;
  curve(ctx, [[184, 206], [cx, 188], [356, 206], [356, 186], [cx, 168], [184, 186]]); ctx.fill();
  ctx.fillStyle = P.bandSh;
  curve(ctx, [[184, 206], [cx, 192], [356, 206], [356, 198], [cx, 184], [184, 198]]); ctx.fill();
  ctx.fillStyle = P.bandHi;
  curve(ctx, [[196, 190], [cx, 176], [344, 190], [344, 184], [cx, 172], [196, 184]]); ctx.fill();
  // knot + flowing tails (left)
  ctx.fillStyle = P.band;
  curve(ctx, [[184, 196], [150, 188], [120, 210], [96, 196], [128, 222], [108, 250], [150, 226], [180, 232], [186, 210]]);
  ctx.fill();
  ctx.fillStyle = P.bandSh;
  curve(ctx, [[150, 226], [120, 244], [108, 250], [132, 230], [150, 222]]); ctx.fill();
  curve(ctx, [[184, 196], [150, 188], [120, 210], [96, 196], [128, 222], [108, 250], [150, 226], [180, 232], [186, 210]], true); ink(ctx, 2.5, P.bandSh);

  // ============ HAIR front (spikes over band edges) ============
  ctx.fillStyle = P.hair;
  curve(ctx, [[186, 188], [196, 150], [222, 168], [236, 140], [258, 168], [cx, 138], [288, 168], [312, 142], [328, 170], [350, 152], [356, 190], [340, 176], [318, 196], [300, 172], [cx, 192], [240, 172], [222, 196], [200, 176]]);
  ctx.fill();
  // hair highlight strands
  ctx.strokeStyle = P.hairHi; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(222, 150); ctx.quadraticCurveTo(236, 134, 252, 152); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(286, 150); ctx.quadraticCurveTo(300, 132, 316, 150); ctx.stroke();
  // hair outline
  curve(ctx, [[168, 250], [176, 120], [cx, 92], [372, 122], [378, 210]], false); ink(ctx, 3.5);

  // ============ face outline pass ============
  curve(ctx, [[190, 200], [202, 268], [234, 330], [cx, 348], [306, 330], [338, 268], [350, 200]], false); ink(ctx, 3.2, P.line);

  // ===== signature mark (original logo) bottom corner =====
  ctx.fillStyle = "rgba(255,255,255,0.0)";
}

const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");
drawPortrait(ctx);
fs.writeFileSync("/tmp/portrait.png", canvas.toBuffer("image/png"));
console.log("wrote /tmp/portrait.png");
