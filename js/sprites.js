/* ============================================================
   sprites.js — sprite-sheet pipeline.

   Loads a PNG atlas (e.g. assets/ryu.png) and draws named frames /
   animations from it. Designed so a real, hand-drawn sheet can be
   dropped in and used in place of the procedural renderer. If the
   image is missing or a frame is undefined, callers fall back to
   the procedural fighter so the game always runs.
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP;

  class SpriteSheet {
    constructor(src) {
      this.src = src; this.ready = false; this.error = false; this.img = null;
      this.w = 0; this.h = 0;
      if (typeof Image === "undefined") { this.error = true; return; } // headless / node
      try {
        const im = new Image();
        this.img = im;
        im.onload = () => { this.ready = true; this.w = im.naturalWidth || im.width; this.h = im.naturalHeight || im.height; };
        im.onerror = () => { this.error = true; };
        im.src = src;
      } catch (e) { this.error = true; }
    }
    // used by the headless baker / preview to inject a decoded image
    setImage(img) { this.img = img; this.w = img.width; this.h = img.height; this.ready = true; this.error = false; }
  }

  const Sprites = {
    sheets: {},
    debug: false,            // toggles the atlas calibration overlay
    load(id, src) { const s = new SpriteSheet(src); this.sheets[id] = s; return s; },
    get(id) { return this.sheets[id]; },
    ready(id) { const s = this.sheets[id]; return s && s.ready && !s.error; },

    /* Draw a single atlas cell, anchored at the fighter's feet (x,y).
       facing flips horizontally. Returns true if drawn. */
    drawCell(ctx, sheetId, rect, x, y, scale, facing, opts) {
      const s = this.sheets[sheetId];
      if (!s || !s.ready || !s.img) return false;
      const o = opts || {};
      const ax = rect.ax != null ? rect.ax : rect.w / 2;
      const ay = rect.ay != null ? rect.ay : rect.h;     // default: feet at bottom
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(facing * scale, scale);
      if (o.alpha != null) ctx.globalAlpha = o.alpha;
      if (o.additive) ctx.globalCompositeOperation = "lighter";
      try {
        ctx.drawImage(s.img, rect.x, rect.y, rect.w, rect.h, -ax, -ay, rect.w, rect.h);
      } catch (e) { ctx.restore(); return false; }
      // white hurt-flash silhouette via a tinted re-draw is not possible per-pixel
      // on a flat blit, so we approximate with an additive white wash.
      if (o.flash > 0.01) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = o.flash * 0.8;
        ctx.fillStyle = "#fff";
        // mask the wash to the sprite using source-atop within this saved layer
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillRect(-ax, -ay, rect.w, rect.h);
      }
      ctx.restore();
      return true;
    }
  };

  FP.SpriteSheet = SpriteSheet;
  FP.Sprites = Sprites;
})(window);
