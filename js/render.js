/* ============================================================
   render.js — draws a fighter from a solved skeleton.
   Limbs are tapered, gradient-shaded capsules; torso & head are
   built shapes; costume pieces are layered from the palette/style.
   No bitmaps — every pixel is generated each frame.
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP, U = FP.U;

  // tapered rounded segment from a->b with end radii r1->r2
  function capsule(ctx, ax, ay, bx, by, r1, r2) {
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 0.0001;
    const nx = -dy / len, ny = dx / len; // perpendicular
    ctx.beginPath();
    ctx.moveTo(ax + nx * r1, ay + ny * r1);
    ctx.lineTo(bx + nx * r2, by + ny * r2);
    ctx.arc(bx, by, r2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
    ctx.lineTo(ax - nx * r1, ay - ny * r1);
    ctx.arc(ax, ay, r1, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
    ctx.closePath();
  }

  function limb(ctx, a, b, r1, r2, fill, hi, sh) {
    capsule(ctx, a.x, a.y, b.x, b.y, r1, r2);
    if (WHITE) { ctx.fillStyle = "#ffffff"; ctx.fill(); return; }
    const g = ctx.createLinearGradient(a.x - r1, a.y, a.x + r1, a.y + 4);
    g.addColorStop(0, hi); g.addColorStop(0.45, fill); g.addColorStop(1, sh);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "rgba(0,0,0,.32)"; ctx.stroke();
  }

  function blob(ctx, pts, fill, hi, sh, close = true) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i], pv = pts[i - 1];
      const mx = (pv.x + p.x) / 2, my = (pv.y + p.y) / 2;
      ctx.quadraticCurveTo(pv.x, pv.y, mx, my);
    }
    if (close) ctx.closePath();
  }

  // when >0, body fills paint flat white (hurt flash silhouette pass)
  let WHITE = false;

  const R = {};

  /* Draw a fighter.
     opts: {x,y} foot/ground anchor (world), facing (+1/-1), char, pose(angles),
            airborne, flashWhite (0..1 hurt flash), auraColor, auraAmt,
            outlineGlow (color or null) */
  R.draw = function (ctx, opts) {
    const ch = opts.char;
    const rg = FP.Skeleton.rig(ch.prop);
    const j = FP.Skeleton.solve(opts.pose, rg);
    const pal = ch.pal, style = ch.style || {};
    const facing = opts.facing >= 0 ? 1 : -1;
    const bulk = rg.bulk;

    ctx.save();
    ctx.translate(opts.x, opts.y - 2);
    ctx.scale(facing, 1);

    // ----- drop shadow on ground -----
    if (!opts.noShadow) {
      const lift = opts.airHeight || 0;
      const sa = U.clamp(1 - lift / 320, 0.2, 0.85);
      const sw = (46 + bulk * 18) * U.clamp(1 - lift / 600, 0.5, 1);
      ctx.save();
      ctx.translate(0, 2 + lift); // shadow stays on ground
      ctx.scale(1, 0.32);
      ctx.beginPath(); ctx.arc(facing * 4, 0, sw, 0, U.TAU);
      ctx.fillStyle = `rgba(0,0,0,${sa})`; ctx.fill();
      ctx.restore();
    }

    // optional outline glow (super/charged)
    if (opts.outlineGlow) {
      ctx.save();
      ctx.shadowColor = opts.outlineGlow; ctx.shadowBlur = 26;
      ctx.strokeStyle = opts.outlineGlow; ctx.globalAlpha = 0.6;
      // cheap: re-trace torso later picks glow; we set shadow on subsequent fills
    }

    const skin = pal.skin, skinHi = U.shade(pal.skin, 0.22), skinSh = pal.skinSh;
    const cloth = pal.gi, clothHi = U.shade(pal.gi, 0.22), clothSh = pal.giSh;
    // back limbs are tinted darker for depth
    const dk = (c) => U.shade(c, -0.28);

    // paint the whole figure back-to-front; reused for the white flash pass
    const paintBody = () => {
      drawLeg(ctx, j.legB, rg, dk(skin), dk(skinHi), dk(skinSh), dk(cloth), dk(clothHi), dk(clothSh), style, bulk, true);
      drawArm(ctx, j.armB, rg, dk(skin), dk(skinHi), dk(skinSh), dk(cloth), dk(clothHi), dk(clothSh), style, bulk, true, pal);
      if (style.sword) drawSword(ctx, j, pal, "back");
      drawTorso(ctx, j, rg, pal, style, bulk);
      drawLeg(ctx, j.legF, rg, skin, skinHi, skinSh, cloth, clothHi, clothSh, style, bulk, false);
      drawHead(ctx, j, rg, pal, style, facing, bulk);
      drawArm(ctx, j.armF, rg, skin, skinHi, skinSh, cloth, clothHi, clothSh, style, bulk, false, pal);
    };

    paintBody();

    // ----- hurt flash: redraw the silhouette in flat white over the body
    if (opts.flashWhite > 0.01) {
      WHITE = true;
      ctx.globalAlpha = U.clamp(opts.flashWhite, 0, 1);
      paintBody();
      ctx.globalAlpha = 1;
      WHITE = false;
    }
    if (opts.outlineGlow) ctx.restore();

    ctx.restore();

    // return key world anchors (for hitspark placement etc.) in world space
    return {
      head: localToWorld(j.head, opts, facing),
      chest: localToWorld(j.chest, opts, facing),
      handF: localToWorld(j.armF.hand, opts, facing),
      handB: localToWorld(j.armB.hand, opts, facing),
      footF: localToWorld(j.legF.foot, opts, facing),
    };
  };

  function localToWorld(p, opts, facing) {
    return { x: opts.x + p.x * facing, y: opts.y - 2 + p.y };
  }

  function drawLeg(ctx, leg, rg, skin, skinHi, skinSh, cloth, clothHi, clothSh, style, bulk, back) {
    const wT = 9 * bulk, wK = 7 * bulk, wA = 5.5 * bulk;
    // thigh (under shorts/gi) — use cloth for upper, skin for lower if barefoot/dress
    const pantHi = style.dress ? clothHi : clothHi, pant = style.dress ? cloth : cloth, pantSh = clothSh;
    limb(ctx, leg.hip, leg.knee, wT, wK, pant, pantHi, pantSh);
    // shin — skin (barefoot/shirtless) else cloth
    const shinCol = (style.barefoot || style.shirtless || style.dress) ? skin : skin;
    limb(ctx, leg.knee, leg.foot, wK, wA, shinCol, skinHi, skinSh);
    // foot
    ctx.save();
    const ang = Math.atan2(leg.foot.y - leg.knee.y, leg.foot.x - leg.knee.x);
    ctx.translate(leg.foot.x, leg.foot.y);
    ctx.rotate(0);
    ctx.beginPath();
    ctx.ellipse(4, 1, 13 * bulk * 0.9, 6 * bulk, 0, 0, U.TAU);
    ctx.fillStyle = WHITE ? "#ffffff" : (style.barefoot ? skin : "#20242c");
    ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.stroke();
    ctx.restore();
  }

  function drawArm(ctx, arm, rg, skin, skinHi, skinSh, cloth, clothHi, clothSh, style, bulk, back, pal) {
    const wU = 6.5 * bulk, wE = 5.2 * bulk, wH = 4.4 * bulk;
    // upper arm: sleeve if gi, bare if shirtless
    if (style.gi && !style.shirtless) {
      limb(ctx, arm.sh, arm.elbow, wU + 1.5, wE, cloth, clothHi, clothSh);
    } else {
      limb(ctx, arm.sh, arm.elbow, wU, wE, skin, skinHi, skinSh);
    }
    // forearm (skin, with wristband)
    limb(ctx, arm.elbow, arm.hand, wE, wH, skin, skinHi, skinSh);
    // wristband
    if (pal && (style.headband || style.ninja || style.gi)) {
      const t = 0.78;
      const wx = U.lerp(arm.elbow.x, arm.hand.x, t), wy = U.lerp(arm.elbow.y, arm.hand.y, t);
      ctx.save(); ctx.translate(wx, wy);
      ctx.rotate(Math.atan2(arm.hand.y - arm.elbow.y, arm.hand.x - arm.elbow.x));
      ctx.fillStyle = pal.band || pal.trim;
      ctx.fillRect(-4, -wH - 1, 9, wH * 2 + 2);
      ctx.restore();
    }
    // fist
    ctx.beginPath();
    ctx.arc(arm.hand.x, arm.hand.y, 5.6 * bulk, 0, U.TAU);
    if (WHITE) { ctx.fillStyle = "#ffffff"; ctx.fill(); return; }
    const g = ctx.createRadialGradient(arm.hand.x - 2, arm.hand.y - 2, 1, arm.hand.x, arm.hand.y, 7 * bulk);
    g.addColorStop(0, skinHi); g.addColorStop(1, skinSh);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.stroke();
  }

  function drawTorso(ctx, j, rg, pal, style, bulk) {
    const sF = j.shF, sB = j.shB, pel = j.pelvis, chest = j.chest;
    const cloth = pal.gi, clothHi = U.shade(pal.gi, 0.2), clothSh = pal.giSh;
    const skin = pal.skin, skinHi = U.shade(pal.skin, 0.2), skinSh = pal.skinSh;
    const w = (style.shirtless ? 1.0 : 1.0);

    // torso silhouette: shoulders -> waist
    const topW = (style.shirtless ? 22 : 20) * bulk;
    const waistW = 13 * bulk;
    const lsh = { x: chest.x - topW, y: chest.y - 2 };
    const rsh = { x: chest.x + topW * 0.7, y: chest.y - 2 };
    const lw = { x: pel.x - waistW, y: pel.y + 4 };
    const rw = { x: pel.x + waistW, y: pel.y + 4 };

    ctx.beginPath();
    ctx.moveTo(lsh.x, lsh.y);
    ctx.quadraticCurveTo(chest.x - topW * 1.1, (chest.y + pel.y) / 2, lw.x, lw.y);
    ctx.quadraticCurveTo(pel.x, pel.y + 12, rw.x, rw.y);
    ctx.quadraticCurveTo(chest.x + topW * 1.0, (chest.y + pel.y) / 2, rsh.x, rsh.y);
    ctx.quadraticCurveTo(chest.x, chest.y - 12, lsh.x, lsh.y);
    ctx.closePath();
    if (WHITE) { ctx.fillStyle = "#ffffff"; ctx.fill(); return; }
    const tg = ctx.createLinearGradient(chest.x - topW, chest.y, chest.x + topW, pel.y);
    if (style.shirtless) { tg.addColorStop(0, skinHi); tg.addColorStop(0.5, skin); tg.addColorStop(1, skinSh); }
    else { tg.addColorStop(0, clothHi); tg.addColorStop(0.5, cloth); tg.addColorStop(1, clothSh); }
    ctx.fillStyle = tg; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "rgba(0,0,0,.3)"; ctx.stroke();

    // muscle / gi detailing
    ctx.save();
    if (style.shirtless) {
      // pecs + abs lines
      ctx.strokeStyle = U.hexA(pal.skinSh, 0.6); ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(chest.x, chest.y + 4); ctx.lineTo(pel.x, pel.y - 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(chest.x - topW * 0.5, chest.y + 6);
      ctx.quadraticCurveTo(chest.x, chest.y + 14, chest.x + topW * 0.4, chest.y + 6);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const yy = U.lerp(chest.y + 14, pel.y - 4, i / 2);
        ctx.beginPath();
        ctx.moveTo(pel.x - 8 * bulk, yy); ctx.lineTo(pel.x + 8 * bulk, yy); ctx.stroke();
      }
    } else {
      // gi lapel V
      ctx.strokeStyle = U.hexA(pal.giSh, 0.9); ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(chest.x - topW * 0.5, chest.y - 2);
      ctx.lineTo(pel.x + 2, pel.y - 2);
      ctx.lineTo(chest.x + topW * 0.4, chest.y - 2);
      ctx.stroke();
      // trim collar
      ctx.strokeStyle = pal.trim; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(j.shF.x - 4, j.shF.y - 4);
      ctx.lineTo(pel.x + 3, pel.y);
      ctx.stroke();
    }
    ctx.restore();

    // belt
    ctx.fillStyle = pal.belt;
    ctx.save();
    ctx.translate(pel.x, pel.y + 3);
    ctx.fillRect(-waistW - 2, -5, (waistW + 2) * 2, 9);
    // knot
    ctx.fillStyle = U.shade(pal.belt, 0.15);
    ctx.fillRect(-4, -6, 9, 16);
    ctx.restore();
  }

  function drawHead(ctx, j, rg, pal, style, facing, bulk) {
    const h = j.head, neck = j.neck, r = rg.headR;
    const skin = pal.skin, skinHi = U.shade(pal.skin, 0.25), skinSh = pal.skinSh;

    // neck
    limb(ctx, neck, { x: h.x, y: h.y + r * 0.4 }, 5.5 * bulk, 6 * bulk, skin, skinHi, skinSh);
    if (WHITE) { ctx.beginPath(); ctx.ellipse(h.x, h.y, r * 0.92, r, 0, 0, U.TAU); ctx.fillStyle = "#ffffff"; ctx.fill(); return; }

    // back hair (behind head)
    if (style.ponytail || style.topknot) {
      ctx.beginPath();
      ctx.ellipse(h.x - r * 0.8, h.y - r * 0.2, r * 0.7, r * 1.1, -0.3, 0, U.TAU);
      ctx.fillStyle = pal.hair; ctx.fill();
      if (style.ponytail) {
        ctx.beginPath();
        ctx.moveTo(h.x - r * 0.6, h.y - r * 0.3);
        ctx.quadraticCurveTo(h.x - r * 2.4, h.y + r * 0.2, h.x - r * 1.4, h.y + r * 1.6);
        ctx.quadraticCurveTo(h.x - r * 0.9, h.y + r * 0.4, h.x - r * 0.4, h.y);
        ctx.fillStyle = pal.hair; ctx.fill();
      }
      if (style.topknot) {
        ctx.beginPath(); ctx.arc(h.x - r * 0.1, h.y - r * 1.15, r * 0.36, 0, U.TAU);
        ctx.fillStyle = pal.hair; ctx.fill();
      }
    }

    // head base
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, r * 0.92, r, 0, 0, U.TAU);
    const hg = ctx.createRadialGradient(h.x + r * 0.3, h.y - r * 0.3, r * 0.2, h.x, h.y, r);
    hg.addColorStop(0, skinHi); hg.addColorStop(0.7, skin); hg.addColorStop(1, skinSh);
    ctx.fillStyle = hg; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = "rgba(0,0,0,.3)"; ctx.stroke();

    // face features (facing +x)
    const fx = h.x + r * 0.34, ey = h.y - r * 0.12;
    if (style.mask) {
      // ninja mask: cover lower face, eyes slit
      ctx.fillStyle = pal.gi;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y + r * 0.18, r * 0.95, r * 0.9, 0, -0.2, Math.PI + 0.2);
      ctx.fill();
      // forehead wrap
      ctx.fillRect(h.x - r, h.y - r * 0.9, r * 2, r * 0.5);
      // eyes
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.ellipse(fx, ey, 3.2, 2.0, -0.2, 0, U.TAU); ctx.fill();
      ctx.fillStyle = pal.accent;
      ctx.beginPath(); ctx.arc(fx + 1, ey, 1.4, 0, U.TAU); ctx.fill();
    } else {
      // hair cap on top
      ctx.beginPath();
      ctx.ellipse(h.x - r * 0.1, h.y - r * 0.42, r * 0.95, r * 0.62, 0, Math.PI, U.TAU);
      ctx.fillStyle = pal.hair; ctx.fill();
      // front fringe
      ctx.beginPath();
      ctx.moveTo(h.x - r * 0.9, h.y - r * 0.35);
      ctx.quadraticCurveTo(h.x + r * 0.4, h.y - r * 0.9, h.x + r * 0.92, h.y - r * 0.1);
      ctx.quadraticCurveTo(h.x + r * 0.5, h.y - r * 0.4, h.x, h.y - r * 0.45);
      ctx.fillStyle = pal.hair; ctx.fill();
      // brow + eye
      ctx.strokeStyle = "rgba(20,12,8,.8)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(fx - 3, ey - 4); ctx.lineTo(fx + 5, ey - 3); ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.ellipse(fx + 1, ey, 2.8, 2.2, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = "#241a14";
      ctx.beginPath(); ctx.arc(fx + 2, ey, 1.3, 0, U.TAU); ctx.fill();
      // nose + mouth hint
      ctx.strokeStyle = U.hexA(pal.skinSh, 0.8); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(h.x + r * 0.85, h.y + r * 0.05); ctx.lineTo(h.x + r * 0.7, h.y + r * 0.22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(h.x + r * 0.4, h.y + r * 0.45); ctx.lineTo(h.x + r * 0.72, h.y + r * 0.42); ctx.stroke();
      // beard (goro)
      if (style.beard) {
        ctx.fillStyle = pal.hair;
        ctx.beginPath();
        ctx.moveTo(h.x - r * 0.6, h.y + r * 0.2);
        ctx.quadraticCurveTo(h.x + r * 0.2, h.y + r * 1.5, h.x + r * 0.9, h.y + r * 0.2);
        ctx.quadraticCurveTo(h.x + r * 0.2, h.y + r * 0.7, h.x - r * 0.6, h.y + r * 0.2);
        ctx.fill();
      }
      if (style.mohawk) {
        ctx.fillStyle = pal.hair;
        ctx.beginPath();
        ctx.moveTo(h.x - r * 0.1, h.y - r * 0.7);
        ctx.quadraticCurveTo(h.x, h.y - r * 1.7, h.x + r * 0.2, h.y - r * 0.7);
        ctx.fill();
      }
    }

    // headband with fluttering tails
    if (style.headband) {
      ctx.fillStyle = pal.band;
      ctx.fillRect(h.x - r, h.y - r * 0.62, r * 2, r * 0.42);
      // tails (behind, on back side -x)
      const t = (performance.now() / 1000);
      const flut = Math.sin(t * 8) * 4;
      ctx.beginPath();
      ctx.moveTo(h.x - r * 0.9, h.y - r * 0.5);
      ctx.quadraticCurveTo(h.x - r * 2.0, h.y - r * 0.2 + flut, h.x - r * 2.6, h.y + r * 0.4 - flut);
      ctx.lineTo(h.x - r * 2.3, h.y + r * 0.7 - flut);
      ctx.quadraticCurveTo(h.x - r * 1.6, h.y + 2, h.x - r * 0.8, h.y - r * 0.2);
      ctx.fillStyle = pal.band; ctx.fill();
    }
  }

  function drawSword(ctx, j, pal, where) {
    // katana slung across the back: from lower-back up over shoulder
    const a = { x: j.pelvis.x - 16, y: j.pelvis.y + 6 };
    const b = { x: j.shB.x - 4, y: j.shB.y - 30 };
    ctx.save();
    // saya (sheath)
    ctx.lineCap = "round";
    ctx.strokeStyle = "#15171c"; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    // handle wrap
    ctx.strokeStyle = pal.trim; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + 4, b.y - 16); ctx.stroke();
    // tsuba (guard)
    ctx.fillStyle = "#c9a13a";
    ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, U.TAU); ctx.fill();
    ctx.restore();
  }

  FP.Render = R;
})(window);
