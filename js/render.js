/* ============================================================
   render.js — cel-shaded, illustrated fighter renderer.
   Driven by the skeleton solve, so the same animation system that
   moved the old capsule rig now drives fully shaded, outlined,
   costumed characters. One rig + per-character palette/style.
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP, U = FP.U;

  let WHITE = false;                 // hurt-flash silhouette pass
  const LINE = "#231711";            // ink outline

  function ink(ctx, w, c) { ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.lineWidth = w; ctx.strokeStyle = c || LINE; ctx.stroke(); }

  function capPath(ctx, a, b, r1, r2) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 0.0001;
    const nx = -dy / len, ny = dx / len;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * r1, a.y + ny * r1);
    ctx.lineTo(b.x + nx * r2, b.y + ny * r2);
    ctx.arc(b.x, b.y, r2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
    ctx.lineTo(a.x - nx * r1, a.y - ny * r1);
    ctx.arc(a.x, a.y, r1, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
    ctx.closePath();
    return { nx, ny };
  }

  // cel-shaded tapered limb a->b
  function limb(ctx, a, b, r1, r2, base, lw) {
    const { nx, ny } = capPath(ctx, a, b, r1, r2);
    if (WHITE) { ctx.fillStyle = "#fff"; ctx.fill(); return; }
    ctx.fillStyle = base; ctx.fill();
    // shadow band on the -normal (back/under) side
    ctx.save(); ctx.clip();
    ctx.beginPath();
    ctx.moveTo(a.x - nx * r1, a.y - ny * r1);
    ctx.lineTo(b.x - nx * r2, b.y - ny * r2);
    ctx.lineTo(b.x + nx * r2 * 0.12, b.y + ny * r2 * 0.12);
    ctx.lineTo(a.x + nx * r1 * 0.12, a.y + ny * r1 * 0.12);
    ctx.closePath();
    ctx.fillStyle = U.shade(base, -0.3); ctx.fill();
    // highlight sliver on +normal side
    ctx.beginPath();
    ctx.moveTo(a.x + nx * r1, a.y + ny * r1);
    ctx.lineTo(b.x + nx * r2, b.y + ny * r2);
    ctx.lineTo(b.x + nx * r2 * 0.6, b.y + ny * r2 * 0.6);
    ctx.lineTo(a.x + nx * r1 * 0.6, a.y + ny * r1 * 0.6);
    ctx.closePath();
    ctx.fillStyle = U.shade(base, 0.18); ctx.fill();
    ctx.restore();
    capPath(ctx, a, b, r1, r2); ink(ctx, lw || 3);
  }

  // smooth closed/open blob through pts (array of {x,y})
  function curve(ctx, pts, close) {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2); }
    const l = pts[pts.length - 1]; ctx.lineTo(l.x, l.y); if (close !== false) ctx.closePath();
  }
  const PT = (x, y) => ({ x, y });
  const mid = (a, b, t = 0.5) => ({ x: U.lerp(a.x, b.x, t), y: U.lerp(a.y, b.y, t) });

  function glove(ctx, h, r, base) {
    ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, U.TAU);
    if (WHITE) { ctx.fillStyle = "#fff"; ctx.fill(); return; }
    ctx.fillStyle = base; ctx.fill();
    ctx.beginPath(); ctx.arc(h.x + r * 0.3, h.y + r * 0.35, r * 0.85, 0, Math.PI);
    ctx.fillStyle = U.shade(base, -0.28); ctx.fill();
    ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, U.TAU); ink(ctx, 2.6);
  }

  function foot(ctx, ankle, dirx, bare, skin) {
    ctx.save(); ctx.translate(ankle.x, ankle.y);
    ctx.beginPath(); ctx.ellipse(dirx * 6, 3, 14, 7, 0, 0, U.TAU);
    if (WHITE) { ctx.fillStyle = "#fff"; ctx.fill(); ctx.restore(); return; }
    ctx.fillStyle = bare ? skin : "#23262e"; ctx.fill(); ink(ctx, 2.6);
    if (!bare) { ctx.beginPath(); ctx.moveTo(-12, 1); ctx.lineTo(dirx * 18, 1); ink(ctx, 2, "rgba(255,255,255,.18)"); }
    ctx.restore();
  }

  // -------- detailed head (scaled by headR), face points +x ----------
  function head(ctx, j, r, pal, style) {
    const c = j.head, neck = j.neck;
    const skin = pal.skin, sh = pal.skinSh, hair = pal.hair;
    // neck
    limb(ctx, neck, PT(c.x, c.y + r * 0.5), r * 0.34, r * 0.4, skin, 2.6);
    if (WHITE) { ctx.beginPath(); ctx.ellipse(c.x, c.y, r * 0.92, r, 0, 0, U.TAU); ctx.fillStyle = "#fff"; ctx.fill(); return; }

    // back hair
    if (style.ponytail || style.topknot || !style.bald) {
      ctx.fillStyle = hair;
      curve(ctx, [PT(c.x - r * 0.8, c.y - r * 0.1), PT(c.x - r * 0.8, c.y - r), PT(c.x, c.y - r * 1.25), PT(c.x + r * 0.85, c.y - r * 0.9), PT(c.x + r * 0.9, c.y + r * 0.1), PT(c.x + r * 0.6, c.y - r * 0.6), PT(c.x, c.y - r * 0.9), PT(c.x - r * 0.55, c.y - r * 0.6)]);
      ctx.fill();
    }
    if (style.ponytail) { ctx.fillStyle = hair; curve(ctx, [PT(c.x - r * 0.5, c.y - r * 0.4), PT(c.x - r * 2.0, c.y - r * 0.1), PT(c.x - r * 1.5, c.y + r * 1.3), PT(c.x - r * 0.9, c.y + r * 0.2), PT(c.x - r * 0.4, c.y - r * 0.1)]); ctx.fill(); }
    if (style.topknot) { ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(c.x - r * 0.05, c.y - r * 1.28, r * 0.34, 0, U.TAU); ctx.fill(); }

    // face base + cel shadow
    ctx.fillStyle = skin;
    curve(ctx, [PT(c.x - r * 0.72, c.y - r * 0.45), PT(c.x - r * 0.6, c.y - r * 0.95), PT(c.x + r * 0.15, c.y - r * 1.05), PT(c.x + r * 0.82, c.y - r * 0.85), PT(c.x + r * 0.92, c.y), PT(c.x + r * 0.66, c.y + r * 0.72), PT(c.x + r * 0.15, c.y + r * 1.04), PT(c.x - r * 0.42, c.y + r * 0.82), PT(c.x - r * 0.72, c.y + r * 0.16)]);
    ctx.fill();
    ctx.fillStyle = sh;
    curve(ctx, [PT(c.x + r * 0.18, c.y - r * 0.9), PT(c.x + r * 0.82, c.y - r * 0.6), PT(c.x + r * 0.92, c.y), PT(c.x + r * 0.66, c.y + r * 0.72), PT(c.x + r * 0.3, c.y + r * 0.4), PT(c.x + r * 0.4, c.y - r * 0.4)]);
    ctx.fill();
    // ear
    ctx.fillStyle = skin; curve(ctx, [PT(c.x - r * 0.72, c.y - r * 0.12), PT(c.x - r * 0.94, c.y + r * 0.04), PT(c.x - r * 0.86, c.y + r * 0.46), PT(c.x - r * 0.6, c.y + r * 0.38)]); ctx.fill(); ink(ctx, 1.8, pal.skinSh);

    if (style.mask) {
      // ninja mask over lower face
      ctx.fillStyle = pal.gi;
      curve(ctx, [PT(c.x - r * 0.72, c.y), PT(c.x + r * 0.9, c.y - r * 0.05), PT(c.x + r * 0.66, c.y + r * 0.72), PT(c.x + r * 0.15, c.y + r * 1.04), PT(c.x - r * 0.42, c.y + r * 0.82), PT(c.x - r * 0.72, c.y + r * 0.16)]);
      ctx.fill();
      ctx.fillStyle = pal.gi; ctx.fillRect(c.x - r * 0.8, c.y - r * 0.7, r * 1.7, r * 0.42);
      // eyes (slits)
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(c.x + r * 0.04, c.y - r * 0.18, r * 0.2, r * 0.12, 0, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(c.x + r * 0.6, c.y - r * 0.2, r * 0.18, r * 0.11, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(c.x + r * 0.1, c.y - r * 0.18, r * 0.08, 0, U.TAU); ctx.fill(); ctx.beginPath(); ctx.arc(c.x + r * 0.64, c.y - r * 0.2, r * 0.07, 0, U.TAU); ctx.fill();
    } else {
      // brows
      ctx.fillStyle = hair;
      curve(ctx, [PT(c.x - r * 0.5, c.y - r * 0.28), PT(c.x - r * 0.1, c.y - r * 0.42), PT(c.x + r * 0.16, c.y - r * 0.3), PT(c.x + r * 0.08, c.y - r * 0.16), PT(c.x - r * 0.12, c.y - r * 0.28), PT(c.x - r * 0.5, c.y - r * 0.12)]); ctx.fill();
      curve(ctx, [PT(c.x + r * 0.34, c.y - r * 0.3), PT(c.x + r * 0.7, c.y - r * 0.4), PT(c.x + r * 0.86, c.y - r * 0.26), PT(c.x + r * 0.78, c.y - r * 0.12), PT(c.x + r * 0.62, c.y - r * 0.24), PT(c.x + r * 0.34, c.y - r * 0.16)]); ctx.fill();
      // eyes
      const eye = (ex) => {
        ctx.fillStyle = "#f7f1e8"; ctx.beginPath(); ctx.ellipse(ex, c.y, r * 0.2, r * 0.14, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = "#3a2a1c"; ctx.beginPath(); ctx.arc(ex + r * 0.03, c.y, r * 0.1, 0, U.TAU); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex - r * 0.02, c.y - r * 0.04, r * 0.04, 0, U.TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(ex - r * 0.2, c.y - r * 0.08); ctx.quadraticCurveTo(ex, c.y - r * 0.2, ex + r * 0.2, c.y - r * 0.08); ink(ctx, 1.8, LINE);
      };
      eye(c.x - r * 0.16); eye(c.x + r * 0.56);
      // nose + mouth
      ctx.beginPath(); ctx.moveTo(c.x + r * 0.12, c.y + r * 0.05); ctx.quadraticCurveTo(c.x + r * 0.34, c.y + r * 0.3, c.x + r * 0.16, c.y + r * 0.4); ink(ctx, 1.8, pal.skinSh);
      ctx.beginPath(); ctx.moveTo(c.x - r * 0.12, c.y + r * 0.62); ctx.quadraticCurveTo(c.x + r * 0.18, c.y + r * 0.7, c.x + r * 0.46, c.y + r * 0.56); ink(ctx, 2, LINE);
      if (style.beard) {
        ctx.fillStyle = hair;
        curve(ctx, [PT(c.x - r * 0.5, c.y + r * 0.4), PT(c.x + r * 0.1, c.y + r * 1.3), PT(c.x + r * 0.7, c.y + r * 0.4), PT(c.x + r * 0.2, c.y + r * 0.8), PT(c.x - r * 0.3, c.y + r * 0.6)]); ctx.fill();
      }
    }

    // hair front spikes
    if (!style.bald && !style.mask) {
      ctx.fillStyle = hair;
      curve(ctx, [PT(c.x - r * 0.72, c.y - r * 0.5), PT(c.x - r * 0.6, c.y - r * 1.05), PT(c.x - r * 0.2, c.y - r * 0.8), PT(c.x + r * 0.1, c.y - r * 1.15), PT(c.x + r * 0.42, c.y - r * 0.82), PT(c.x + r * 0.82, c.y - r * 1.0), PT(c.x + r * 0.92, c.y - r * 0.5), PT(c.x + r * 0.6, c.y - r * 0.82), PT(c.x + r * 0.28, c.y - r * 0.62), PT(c.x, c.y - r * 0.9), PT(c.x - r * 0.3, c.y - r * 0.6), PT(c.x - r * 0.55, c.y - r * 0.85)]); ctx.fill();
    }
    if (style.mohawk) { ctx.fillStyle = hair; curve(ctx, [PT(c.x - r * 0.1, c.y - r * 0.9), PT(c.x + r * 0.05, c.y - r * 1.7), PT(c.x + r * 0.3, c.y - r * 0.9)]); ctx.fill(); }

    // headband + flowing tail
    if (style.headband || style.band) {
      const bc = pal.band || pal.trim;
      ctx.fillStyle = bc;
      curve(ctx, [PT(c.x - r * 0.78, c.y - r * 0.52), PT(c.x + r * 0.15, c.y - r * 0.72), PT(c.x + r * 0.92, c.y - r * 0.48), PT(c.x + r * 0.92, c.y - r * 0.68), PT(c.x + r * 0.15, c.y - r * 0.92), PT(c.x - r * 0.78, c.y - r * 0.72)]); ctx.fill();
      ctx.fillStyle = U.shade(bc, -0.25);
      curve(ctx, [PT(c.x - r * 0.78, c.y - r * 0.52), PT(c.x + r * 0.15, c.y - r * 0.62), PT(c.x + r * 0.92, c.y - r * 0.48), PT(c.x + r * 0.92, c.y - r * 0.56), PT(c.x + r * 0.15, c.y - r * 0.76), PT(c.x - r * 0.78, c.y - r * 0.62)]); ctx.fill();
      // tail (flies behind, -x)
      const fl = Math.sin(performance.now() / 140) * r * 0.2;
      ctx.fillStyle = bc;
      curve(ctx, [PT(c.x - r * 0.72, c.y - r * 0.6), PT(c.x - r * 1.5, c.y - r * 0.75 + fl), PT(c.x - r * 2.1, c.y - r * 0.35 + fl), PT(c.x - r * 1.7, c.y - r * 0.2 + fl), PT(c.x - r * 1.95, c.y + r * 0.2 - fl), PT(c.x - r * 1.3, c.y - r * 0.15), PT(c.x - r * 0.7, c.y - r * 0.3)]); ctx.fill(); ink(ctx, 1.8, U.shade(bc, -0.25));
    }
    // face outline
    curve(ctx, [PT(c.x - r * 0.72, c.y - r * 0.4), PT(c.x - r * 0.72, c.y + r * 0.16), PT(c.x - r * 0.42, c.y + r * 0.82), PT(c.x + r * 0.15, c.y + r * 1.04), PT(c.x + r * 0.66, c.y + r * 0.72), PT(c.x + r * 0.92, c.y)], false); ink(ctx, 2.6);
  }

  // -------- torso (gi / shirtless / dress) ----------
  function torso(ctx, j, rig, pal, style) {
    const chest = j.chest, pel = j.pelvis, sF = j.shF, sB = j.shB, bulk = rig.bulk;
    const top = 20 * bulk, waist = 13 * bulk;
    const pts = [
      PT(chest.x - top, chest.y - 2), PT(chest.x - top * 1.05, (chest.y + pel.y) / 2),
      PT(pel.x - waist, pel.y + 4), PT(pel.x, pel.y + 12), PT(pel.x + waist, pel.y + 4),
      PT(chest.x + top * 0.95, (chest.y + pel.y) / 2), PT(chest.x + top * 0.7, chest.y - 2), PT(chest.x, chest.y - 12),
    ];
    curve(ctx, pts);
    if (WHITE) { ctx.fillStyle = "#fff"; ctx.fill(); return; }
    const base = style.shirtless ? pal.skin : pal.gi;
    ctx.fillStyle = base; ctx.fill();
    // cel shadow (lower-right)
    ctx.save(); ctx.clip();
    ctx.fillStyle = U.shade(base, -0.26);
    curve(ctx, [PT(chest.x + 2, chest.y), PT(chest.x + top, (chest.y + pel.y) / 2), PT(pel.x + waist, pel.y + 4), PT(pel.x + 2, pel.y + 8), PT(chest.x + 4, chest.y + 20)]);
    ctx.fill();
    if (style.shirtless) {
      ctx.strokeStyle = U.hexA(pal.skinSh, 0.7); ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(chest.x, chest.y + 4); ctx.quadraticCurveTo(chest.x + 3, (chest.y + pel.y) / 2, pel.x, pel.y - 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(chest.x - top * 0.5, chest.y + 6); ctx.quadraticCurveTo(chest.x, chest.y + 16, chest.x + top * 0.45, chest.y + 6); ctx.stroke();
      for (let i = 0; i < 3; i++) { const y = U.lerp(chest.y + 18, pel.y - 4, i / 2); ctx.beginPath(); ctx.moveTo(pel.x - 9 * bulk, y); ctx.lineTo(pel.x + 9 * bulk, y); ctx.stroke(); }
    } else {
      // gi lapels
      ctx.fillStyle = U.shade(base, -0.12);
      curve(ctx, [PT(sB.x, sB.y - 2), PT(pel.x + 2, pel.y), PT(pel.x + 10, pel.y), PT(sB.x + 12, sB.y)]); ctx.fill();
      ctx.strokeStyle = pal.trim; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(sF.x - 2, sF.y - 4); ctx.lineTo(pel.x + 2, pel.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sB.x + 2, sB.y - 4); ctx.lineTo(pel.x + 2, pel.y); ctx.stroke();
    }
    ctx.restore();
    curve(ctx, pts); ink(ctx, 3);

    // belt
    if (!WHITE) {
      ctx.save(); ctx.translate(pel.x, pel.y + 3);
      ctx.fillStyle = pal.belt || "#222"; ctx.fillRect(-waist - 3, -5, (waist + 3) * 2, 10);
      ctx.fillStyle = U.shade(pal.belt || "#222", 0.1); ctx.fillRect(-5, -6, 10, 17);
      ink(ctx, 2); ctx.beginPath(); ctx.rect(-waist - 3, -5, (waist + 3) * 2, 10); ink(ctx, 1.6);
      ctx.restore();
    }
  }

  const R = {};

  R.draw = function (ctx, opts) {
    const ch = opts.char;
    const rig = FP.Skeleton.rig(ch.prop);
    const j = FP.Skeleton.solve(opts.pose, rig);
    const pal = ch.pal, style = ch.style || {};
    const facing = opts.facing >= 0 ? 1 : -1;
    const bulk = rig.bulk;
    const skin = pal.skin, cloth = style.shirtless ? pal.skin : pal.gi;
    const dk = (c) => U.shade(c, -0.26);
    const gloveCol = (style.gi || style.headband || style.ninja) ? (pal.band || pal.trim) : skin;
    const wA = 6.5 * bulk, wF = 5.4 * bulk, wT = 9 * bulk, wS = 7 * bulk;

    ctx.save();
    ctx.translate(opts.x, opts.y - 2);
    ctx.scale(facing, 1);

    // shadow
    if (!opts.noShadow) {
      const lift = opts.airHeight || 0;
      const sa = U.clamp(1 - lift / 320, 0.18, 0.8), sw = (44 + bulk * 16) * U.clamp(1 - lift / 600, 0.5, 1);
      ctx.save(); ctx.translate(0, 2 + lift); ctx.scale(1, 0.3);
      ctx.beginPath(); ctx.arc(facing * 3, 0, sw, 0, U.TAU); ctx.fillStyle = `rgba(0,0,0,${sa})`; ctx.fill(); ctx.restore();
    }
    if (opts.outlineGlow) { ctx.save(); ctx.shadowColor = opts.outlineGlow; ctx.shadowBlur = 24; }

    const paint = () => {
      // back leg
      limb(ctx, j.legB.hip, j.legB.knee, wT, wS, dk(style.shirtless || style.barefoot || style.dress ? skin : cloth));
      limb(ctx, j.legB.knee, j.legB.foot, wS, wS * 0.7, dk(skin));
      foot(ctx, j.legB.foot, -1, style.barefoot, dk(skin));
      // back arm
      limb(ctx, j.armB.sh, j.armB.elbow, wA, wF, dk(style.gi && !style.shirtless ? cloth : skin));
      limb(ctx, j.armB.elbow, j.armB.hand, wF, wF * 0.8, dk(skin));
      glove(ctx, j.armB.hand, 5.6 * bulk, dk(gloveCol));
      // torso
      torso(ctx, j, rig, pal, style);
      // front leg
      limb(ctx, j.legF.hip, j.legF.knee, wT, wS, style.shirtless || style.barefoot || style.dress ? skin : cloth);
      limb(ctx, j.legF.knee, j.legF.foot, wS, wS * 0.7, skin);
      foot(ctx, j.legF.foot, 1, style.barefoot, skin);
      // head
      head(ctx, j, rig.headR, pal, style);
      // front arm
      limb(ctx, j.armF.sh, j.armF.elbow, wA, wF, style.gi && !style.shirtless ? cloth : skin);
      limb(ctx, j.armF.elbow, j.armF.hand, wF, wF * 0.8, skin);
      glove(ctx, j.armF.hand, 5.8 * bulk, gloveCol);
    };

    paint();
    if (opts.flashWhite > 0.01) { WHITE = true; ctx.globalAlpha = U.clamp(opts.flashWhite, 0, 1); paint(); ctx.globalAlpha = 1; WHITE = false; }
    if (opts.outlineGlow) ctx.restore();
    ctx.restore();

    const l2w = (p) => ({ x: opts.x + p.x * facing, y: opts.y - 2 + p.y });
    return { head: l2w(j.head), chest: l2w(j.chest), handF: l2w(j.armF.hand), handB: l2w(j.armB.hand), footF: l2w(j.legF.foot) };
  };

  FP.Render = R;
})(window);
