/* Processes the user-supplied Ryu reference sheet into the runtime asset
   the game loads (assets/ryu.png): keys out the dark panel background to
   transparent so sliced frames don't carry black boxes. Dimensions are
   preserved so the atlas coordinates in js/atlas_ryu.js stay valid.

   Usage:  node test/process-sheet.js [sourceFile]
*/
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = process.argv[2] || findSheet();
function findSheet() {
  const dir = path.join(root, "assets");
  const f = fs.readdirSync(dir).find((n) => /\.png$/i.test(n) && n !== "ryu.png");
  return f ? path.join(dir, f) : path.join(dir, "ryu.png");
}

(async () => {
  const img = await loadImage(src);
  const W = img.width, H = img.height;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  let cleared = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 34 && (mx - mn) < 26) { d[i + 3] = 0; cleared++; }
    else if (lum < 52 && (mx - mn) < 16) d[i + 3] = Math.round((lum - 34) / 18 * 255);
  }
  ctx.putImageData(id, 0, 0);
  fs.writeFileSync(path.join(root, "assets", "ryu.png"), c.toBuffer("image/png"));
  console.log(`processed ${path.basename(src)} (${W}x${H}) -> assets/ryu.png  (${(cleared / (W * H) * 100).toFixed(0)}% keyed transparent)`);
})();
