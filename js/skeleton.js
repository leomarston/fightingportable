/* ============================================================
   skeleton.js — procedural skeletal animation.

   A single humanoid rig is posed with forward kinematics from a
   set of joint ANGLES (degrees, 0 = forward/+x, 90 = down, -90 = up).
   Every animation is a function(p, ctx) -> pose that we interpolate,
   so all five fighters share one rig and differ only by proportions,
   palette and a few style flags.  This is how we get fully animated
   characters without a single bitmap sprite.
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP, U = FP.U;

  const D2R = Math.PI / 180;
  function dir(deg) { return { x: Math.cos(deg * D2R), y: Math.sin(deg * D2R) }; }

  // ---- pose = bag of named angles + pelvis offset --------------
  const KEYS = ["spine", "head", "shA", "fA", "shB", "fB", "thF", "snF", "thB", "snB"];
  function pose(o) {
    return Object.assign({
      spine: -88, head: -88,
      // arms rest in a proper guard: upper arms angle down-forward,
      // forearms come back up so the fists sit near the face/chest.
      shA: 58, fA: -66, shB: 68, fB: -58,
      thF: 74, snF: 92, thB: 104, snB: 86,
      px: 0, py: 0, crouch: 0, lean: 0,
    }, o);
  }
  function poseLerp(a, b, t) {
    const o = {};
    for (const k of KEYS) o[k] = U.lerp(a[k], b[k], t); // angles small range -> plain lerp fine
    o.px = U.lerp(a.px || 0, b.px || 0, t);
    o.py = U.lerp(a.py || 0, b.py || 0, t);
    o.crouch = U.lerp(a.crouch || 0, b.crouch || 0, t);
    o.lean = U.lerp(a.lean || 0, b.lean || 0, t);
    return o;
  }
  // keyframe sampler: stops = [{p, pose}], p ascending 0..1
  function kf(p, stops) {
    if (p <= stops[0].p) return stops[0].pose;
    for (let i = 1; i < stops.length; i++) {
      if (p <= stops[i].p) {
        const a = stops[i - 1], b = stops[i];
        const t = U.smooth(U.inv(a.p, b.p, p));
        return poseLerp(a.pose, b.pose, t);
      }
    }
    return stops[stops.length - 1].pose;
  }

  // ---- rig proportions (base units ~ a 210px tall fighter) -----
  function rig(p) {
    p = p || {};
    const s = p.scale || 1;
    return {
      scale: s,
      bulk: p.bulk || 1,
      spineLen: (62) * s,
      neckLen: (14) * s,
      headR: (17 * (p.headR || 1)) * s,
      shoulderW: (15 * (p.shoulderW || 1)) * s,
      hipW: (12 * (p.hipW || 1)) * s,
      upperArm: (30 * (p.armLen || 1)) * s,
      foreArm: (30 * (p.armLen || 1)) * s,
      thigh: (36 * (p.legLen || 1)) * s,
      shin: (38 * (p.legLen || 1)) * s,
      handR: (6 * (p.bulk || 1)) * s,
      footLen: (20) * s,
    };
  }

  /* Solve a pose into joint coordinates in LOCAL space.
     Local origin = pelvis ground anchor (feet planted near y≈ +foot).
     +x = forward (toward opponent), -y = up.  Render flips x by facing. */
  function solve(ps, r) {
    const px = ps.px, crouch = ps.crouch || 0;
    // pelvis raised off the ground by leg length; crouch lowers it.
    const legSpan = (r.thigh + r.shin) * 0.82;
    const pelvis = { x: px, y: ps.py - legSpan + crouch };

    const sp = dir(ps.spine + ps.lean);
    const chest = { x: pelvis.x + sp.x * r.spineLen, y: pelvis.y + sp.y * r.spineLen };
    const nk = dir(ps.head + ps.lean);
    const neck = { x: chest.x + nk.x * r.neckLen, y: chest.y + nk.y * r.neckLen };
    const head = { x: neck.x + nk.x * r.headR * 1.05, y: neck.y + nk.y * r.headR * 1.05 };

    // shoulders sit a touch below/around the chest, separated front/back
    const along = dir(ps.spine + ps.lean + 90); // perpendicular "down the back"
    const shF = { x: chest.x + r.shoulderW * 0.35, y: chest.y + 4 * r.scale };
    const shB = { x: chest.x - r.shoulderW * 0.5, y: chest.y + 6 * r.scale };

    const arm = (sh, shAng, foreAng) => {
      const u = dir(shAng + ps.lean);
      const elbow = { x: sh.x + u.x * r.upperArm, y: sh.y + u.y * r.upperArm };
      const f = dir(foreAng + ps.lean);
      const hand = { x: elbow.x + f.x * r.foreArm, y: elbow.y + f.y * r.foreArm };
      return { sh, elbow, hand };
    };
    const armF = arm(shF, ps.shA, ps.fA);
    const armB = arm(shB, ps.shB, ps.fB);

    const hipF = { x: pelvis.x + r.hipW * 0.4, y: pelvis.y + 2 * r.scale };
    const hipB = { x: pelvis.x - r.hipW * 0.5, y: pelvis.y + 2 * r.scale };
    const leg = (hip, thAng, snAng) => {
      const u = dir(thAng);
      const knee = { x: hip.x + u.x * r.thigh, y: hip.y + u.y * r.thigh };
      const s = dir(snAng);
      const foot = { x: knee.x + s.x * r.shin, y: knee.y + s.y * r.shin };
      return { hip, knee, foot };
    };
    const legF = leg(hipF, ps.thF, ps.snF);
    const legB = leg(hipB, ps.thB, ps.snB);

    return { pelvis, chest, neck, head, shF, shB, armF, armB, legF, legB,
             facingAng: ps.lean };
  }

  // ============================================================
  //  ANIMATION LIBRARY  (p in 0..1; ctx = {move, t, flags})
  // ============================================================
  const A = {};

  A.idle = (p, c) => {
    const br = Math.sin(p * U.TAU);          // breathing
    const sway = Math.sin(p * U.TAU * 0.5);
    return pose({
      spine: -88 + br * 1.2, head: -86 + br,
      shA: 58 + br * 2, fA: -64 + br * 3,
      shB: 68 + br * 2, fB: -56 + br * 3,
      thF: 72, snF: 93, thB: 106, snB: 84,
      py: br * 1.5, px: sway * 1.5,
    });
  };

  A.walkF = (p) => {
    const w = p * U.TAU;
    const s = Math.sin(w), s2 = Math.sin(w * 2);
    return pose({
      spine: -90, head: -88,
      shA: 58 + s * 6, fA: -62 + s * 5,
      shB: 68 - s * 6, fB: -56 - s * 5,
      thF: 72 + s * 26, snF: 95 + Math.max(0, s) * 18,
      thB: 104 - s * 26, snB: 86 - Math.max(0, -s) * 18,
      py: -Math.abs(s2) * 3,
    });
  };
  A.walkB = (p) => {
    const w = p * U.TAU;
    const s = Math.sin(w), s2 = Math.sin(w * 2);
    return pose({
      spine: -86, head: -85, lean: 2,
      shA: 56 - s * 5, fA: -66 - s * 4,
      shB: 66 + s * 5, fB: -58 + s * 4,
      thF: 74 - s * 22, snF: 95 + Math.max(0, -s) * 16,
      thB: 104 + s * 22, snB: 86 - Math.max(0, s) * 16,
      py: -Math.abs(s2) * 2.5,
    });
  };

  A.crouch = (p) => pose({
    crouch: 40, spine: -78, head: -80, lean: 6,
    shA: 52, fA: -56, shB: 62, fB: -52,
    thF: 40, snF: 128, thB: 138, snB: 52,
    py: 0,
  });

  A.dash = (p) => kf(p, [
    { p: 0, pose: pose({ spine: -84, lean: 8, thF: 60, snF: 110, thB: 120, snB: 70, shA: -40, shB: -70, fA: -70, fB: -50 }) },
    { p: 0.5, pose: pose({ spine: -78, lean: 16, py: -8, thF: 40, snF: 60, thB: 150, snB: 120, shA: -30, shB: -100, fA: -60, fB: -120 }) },
    { p: 1, pose: pose({ spine: -84, lean: 8, thF: 70, snF: 100, thB: 110, snB: 80, shA: -45, shB: -65, fA: -78, fB: -60 }) },
  ]);

  A.jump = (p) => {
    // p: 0 launch -> 0.5 apex -> 1 land
    const tuck = U.pulse(U.clamp(p * 1.05, 0, 1));
    return pose({
      spine: -86, head: -86, lean: 4,
      shA: -40 - tuck * 50, fA: -70 - tuck * 40,
      shB: -60 - tuck * 40, fB: -70 - tuck * 50,
      thF: 70 + tuck * 50, snF: 120 + tuck * 40,
      thB: 100 + tuck * 30, snB: 80 + tuck * 40,
      py: 0,
    });
  };

  A.block = (p) => pose({
    spine: -84, head: -84, lean: -5,
    // forearms raised vertically in front, covering the body
    shA: 30, fA: -104, shB: 42, fB: -110,
    thF: 70, snF: 98, thB: 108, snB: 84,
  });
  A.blockLow = (p) => pose({
    crouch: 38, spine: -76, head: -80, lean: -3,
    shA: 26, fA: -98, shB: 40, fB: -106,
    thF: 42, snF: 126, thB: 136, snB: 54,
  });

  // ---- strikes (keyframed startup / active / recovery) --------
  A.lp = (p) => kf(p, [
    { p: 0, pose: pose({}) },
    { p: 0.35, pose: pose({ shB: 4, fB: 2, lean: 3, shA: 50 }) },         // jab out (forearm forward)
    { p: 0.55, pose: pose({ shB: 6, fB: 6, lean: 4, shA: 50 }) },
    { p: 1, pose: pose({}) },
  ]);
  A.mp = (p) => kf(p, [
    { p: 0, pose: pose({}) },
    { p: 0.3, pose: pose({ shA: 80, fA: -120, lean: -4 }) },              // chamber
    { p: 0.48, pose: pose({ shA: 4, fA: 2, lean: 8, spine: -84 }) },      // straight
    { p: 0.7, pose: pose({ shA: 6, fA: 6, lean: 7 }) },
    { p: 1, pose: pose({}) },
  ]);
  A.hp = (p) => kf(p, [
    { p: 0, pose: pose({}) },
    { p: 0.28, pose: pose({ shB: 96, fB: -150, lean: -10, spine: -96 }) }, // big chamber
    { p: 0.5, pose: pose({ shB: 8, fB: 16, lean: 14, spine: -80, thF: 64 }) }, // straight cross
    { p: 0.74, pose: pose({ shB: 10, fB: 14, lean: 12 }) },
    { p: 1, pose: pose({}) },
  ]);
  A.lk = (p) => kf(p, [
    { p: 0, pose: pose({ thF: 72 }) },
    { p: 0.34, pose: pose({ thF: 28, snF: 18, lean: 4 }) },               // quick snap kick
    { p: 0.55, pose: pose({ thF: 30, snF: 20 }) },
    { p: 1, pose: pose({}) },
  ]);
  A.mk = (p) => kf(p, [
    { p: 0, pose: pose({ thF: 72 }) },
    { p: 0.32, pose: pose({ thF: 50, snF: 120, lean: -4 }) },
    { p: 0.5, pose: pose({ thF: 10, snF: 0, lean: 6, spine: -84 }) },     // round kick
    { p: 0.72, pose: pose({ thF: 12, snF: 4 }) },
    { p: 1, pose: pose({}) },
  ]);
  A.hk = (p) => kf(p, [
    { p: 0, pose: pose({ thF: 72, thB: 104 }) },
    { p: 0.3, pose: pose({ thB: 130, snB: 150, lean: -8, spine: -94 }) }, // chamber
    { p: 0.5, pose: pose({ thB: -10, snB: -16, lean: 10, spine: -78, thF: 80 }) }, // high roundhouse w/ back leg
    { p: 0.74, pose: pose({ thB: -6, snB: -12, lean: 8 }) },
    { p: 1, pose: pose({}) },
  ]);
  A.crouchPunch = (p) => kf(p, [
    { p: 0, pose: A.crouch(0) },
    { p: 0.35, pose: pose({ crouch: 40, spine: -78, shB: -4, fB: 2, lean: 6, thF: 40, snF: 128, thB: 138, snB: 52 }) },
    { p: 1, pose: A.crouch(0) },
  ]);
  A.crouchKick = (p) => kf(p, [
    { p: 0, pose: A.crouch(0) },
    { p: 0.32, pose: pose({ crouch: 46, spine: -74, thF: 4, snF: 6, lean: 8, thB: 140, snB: 50 }) }, // sweep
    { p: 0.6, pose: pose({ crouch: 46, spine: -74, thF: 8, snF: 8 }) },
    { p: 1, pose: A.crouch(0) },
  ]);
  A.jumpPunch = (p) => pose({
    spine: -86, lean: 8, shB: 20, fB: 30, shA: -40, fA: -60,
    thF: 80, snF: 130, thB: 100, snB: 80,
  });
  A.jumpKick = (p) => pose({
    spine: -84, lean: 10, thF: 8, snF: 14, thB: 110, snB: 130,
    shA: -50, fA: -80, shB: -60, fB: -70,
  });

  // ---- specials -----------------------------------------------
  A.fireball = (p) => kf(p, [
    { p: 0, pose: pose({ spine: -84, lean: -6, shA: -80, fA: -140, shB: -90, fB: -150, thF: 64, thB: 120 }) },
    { p: 0.32, pose: pose({ spine: -82, lean: -10, shA: -100, fA: -160, shB: -100, fB: -160, crouch: 14, thF: 56, thB: 130 }) }, // gather
    { p: 0.55, pose: pose({ spine: -84, lean: 14, shA: -10, fA: -2, shB: -16, fB: -6, thF: 70, thB: 108 }) },  // thrust palms
    { p: 0.8, pose: pose({ spine: -84, lean: 10, shA: -12, fA: -4, shB: -18, fB: -8 }) },
    { p: 1, pose: pose({}) },
  ]);
  A.dp = (p) => kf(p, [
    { p: 0, pose: pose({ crouch: 18, spine: -80, lean: 6, shB: -50, fB: -60 }) },
    { p: 0.26, pose: pose({ crouch: 30, spine: -76, lean: 4, shB: -60, fB: -70, thF: 50, snF: 80 }) }, // crouch load
    { p: 0.46, pose: pose({ py: -70, spine: -94, lean: 6, shB: -110, fB: -140, thF: 60, snF: 30, thB: 90, snB: 150 }) }, // rising uppercut
    { p: 0.7, pose: pose({ py: -40, spine: -92, shB: -120, fB: -150 }) },
    { p: 1, pose: pose({ py: 0 }) },
  ]);
  A.spinKick = (p) => kf(p, [
    { p: 0, pose: pose({ thB: 120, snB: 130, lean: -6 }) },
    { p: 0.3, pose: pose({ thB: 0, snB: -10, lean: 8, spine: -82, py: -16, thF: 90 }) },
    { p: 0.6, pose: pose({ thF: 0, snF: -12, lean: 10, py: -10, thB: 100 }) },
    { p: 1, pose: pose({}) },
  ]);
  A.super = (p) => kf(p, [
    { p: 0, pose: pose({ crouch: 26, spine: -78, lean: -8, shA: -120, fA: -170, shB: -120, fB: -170 }) },
    { p: 0.4, pose: pose({ crouch: 30, spine: -76, lean: -12, shA: -130, fA: -175, shB: -130, fB: -175 }) }, // charge
    { p: 0.62, pose: pose({ spine: -84, lean: 18, shA: -8, fA: 0, shB: -12, fB: -4, thF: 72 }) },            // unleash
    { p: 1, pose: pose({ spine: -84, lean: 12, shA: -10, fA: -2 }) },
  ]);

  // ---- reactions ----------------------------------------------
  A.hurtHigh = (p) => kf(p, [
    { p: 0, pose: pose({ spine: -78, head: -70, lean: -14, shA: -30, fA: -50, shB: -40, fB: -60, thF: 70 }) },
    { p: 0.5, pose: pose({ spine: -82, head: -78, lean: -8 }) },
    { p: 1, pose: pose({}) },
  ]);
  A.hurtLow = (p) => kf(p, [
    { p: 0, pose: pose({ crouch: 24, spine: -74, head: -66, lean: -16, shA: -20, fA: -40, thF: 50, snF: 120 }) },
    { p: 1, pose: A.crouch(0) },
  ]);
  A.knockdown = (p) => kf(p, [
    { p: 0, pose: pose({ spine: -70, lean: -30, py: -10, shA: -10, fA: 10, shB: -20, fB: 0, thF: 40, snF: 30, thB: 60, snB: 40 }) },
    { p: 0.45, pose: pose({ spine: -10, lean: -80, py: 40, crouch: 60, shA: 30, fA: 60, shB: 20, fB: 50, thF: 10, snF: -10, thB: 20, snB: -20 }) }, // flat on back
    { p: 1, pose: pose({ spine: -6, lean: -84, py: 46, crouch: 64, shA: 40, fA: 70, shB: 30, fB: 60, thF: 6, snF: -6, thB: 14, snB: -14 }) },
  ]);
  A.getup = (p) => kf(p, [
    { p: 0, pose: A.knockdown(1) },
    { p: 0.5, pose: pose({ crouch: 44, spine: -70, lean: 4, thF: 40, snF: 120, thB: 130, snB: 60 }) },
    { p: 1, pose: A.idle(0) },
  ]);
  A.throw = (p) => kf(p, [
    { p: 0, pose: pose({ shA: -30, fA: -10, shB: -40, fB: -20, lean: 6 }) },
    { p: 0.4, pose: pose({ shA: -10, fA: 10, shB: -16, fB: 0, lean: 10, spine: -84 }) },
    { p: 1, pose: pose({}) },
  ]);
  A.thrown = (p) => A.knockdown(p);
  A.victory = (p) => {
    const br = Math.sin(p * U.TAU);
    return pose({
      spine: -90, head: -90, lean: 0,
      shA: -120 + br * 4, fA: -150, shB: -40, fB: -90,
      thF: 80, snF: 92, thB: 100, snB: 88, py: br * 2,
    });
  };
  A.intro = (p) => kf(p, [
    { p: 0, pose: pose({ shA: -30, fA: -20, shB: -36, fB: -26, lean: -4, spine: -84 }) },
    { p: 0.5, pose: pose({ shA: -90, fA: -40, shB: -50, fB: -100, lean: 6, spine: -88 }) },
    { p: 1, pose: A.idle(0) },
  ]);

  FP.Skeleton = { rig, solve, pose, poseLerp, A, dir };
})(window);
