/* ============================================================
   camera.js — follows the midpoint of the two fighters and zooms
   so both stay framed. Smoothed for that "broadcast" feel.
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP, U = FP.U;

  class Camera {
    constructor(viewW, viewH, worldW) {
      this.vw = viewW; this.vh = viewH;
      this.worldW = worldW;
      this.x = worldW / 2; this.y = viewH / 2;
      this.zoom = 1; this.targetZoom = 1;
      this.tx = this.x; this.ty = this.y;
    }
    setWorld(w) { this.worldW = w; }

    follow(ax, ay, bx, by, groundY) {
      const midX = (ax + bx) / 2;
      const sep = Math.abs(ax - bx);
      // zoom: closer when fighters near, pulled out when far
      const z = U.clamp(U.map(sep, 180, 760, 1.32, 0.82), 0.8, 1.34);
      this.targetZoom = z;
      // keep a little above the ground centered
      const midY = groundY - 150;
      this.tx = midX;
      this.ty = midY;
    }

    step(dt) {
      const k = 1 - Math.pow(0.0009, dt);
      this.zoom = U.lerp(this.zoom, this.targetZoom, k);
      this.x = U.lerp(this.x, this.tx, k);
      this.y = U.lerp(this.y, this.ty, k);
      // clamp so we never show beyond world horizontally
      const halfW = (this.vw / this.zoom) / 2;
      this.x = U.clamp(this.x, halfW, this.worldW - halfW);
      const halfH = (this.vh / this.zoom) / 2;
      // keep vertical so ground stays visible
      this.y = U.clamp(this.y, halfH * 0.7, this.vh - halfH * 0.55);
    }

    apply(ctx, shake) {
      ctx.translate(this.vw / 2, this.vh / 2);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-this.x + (shake ? shake.x : 0), -this.y + (shake ? shake.y : 0));
    }
    // world->screen for HUD-anchored markers if needed
    toScreen(wx, wy) {
      return {
        x: (wx - this.x) * this.zoom + this.vw / 2,
        y: (wy - this.y) * this.zoom + this.vh / 2,
      };
    }
    snap() { this.zoom = this.targetZoom; this.x = this.tx; this.y = this.ty; }
  }

  FP.Camera = Camera;
})(window);
