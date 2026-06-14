/* ============================================================
   main.js — bootstrap: loader, audio unlock, fixed-timestep loop,
   pause / mute, and centralized input advancement.
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP;

  let game, ctx, canvas;
  let acc = 0, last = 0;
  const STEP = FP.DT;          // 1/60 s
  const MAX_FRAME = 0.25;      // avoid spiral-of-death

  function unlockAudio() {
    FP.Audio.init(); FP.Audio.resume();
  }

  function bindGlobalKeys() {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.code === "KeyM") { const m = FP.Audio.toggleMute(); }
      if (e.code === "Escape" || e.code === "KeyP") {
        if (game && game.screen === "fight" && game.match) {
          game.match.paused = !game.match.paused;
          if (game.match.paused) FP.Audio.stopMusic();
        }
      }
    });
    // audio unlock on first interaction
    ["keydown", "pointerdown", "touchstart"].forEach((ev) =>
      window.addEventListener(ev, function once() {
        unlockAudio();
        window.removeEventListener(ev, once);
      }, { once: false }));
  }

  function fixedStep() {
    // Pause handling for the fight: toggle via START is handled by Escape/P;
    // also allow START button to pause/unpause for gamepad-style play.
    if (game.screen === "fight" && game.match) {
      const p1 = FP.Input.p1, p2 = FP.Input.p2;
      if ((p1.pressed.start || p2.pressed.start)) {
        game.match.paused = !game.match.paused;
        if (game.match.paused) FP.Audio.stopMusic();
      }
    }
    game.fixedUpdate();
    // central input roll for the two human pads
    FP.Input.advance();
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) { fixedStep(); acc -= STEP; steps++; }
    game.render();
  }

  function runLoader(done) {
    const fill = document.querySelector(".loader-fill");
    const loader = document.getElementById("loader");
    let p = 0;
    const tick = () => {
      p += 0.03 + Math.random() * 0.06;
      if (fill) fill.style.width = Math.min(100, p * 100) + "%";
      if (p < 1) requestAnimationFrame(tick);
      else setTimeout(() => { if (loader) loader.classList.add("gone"); done(); }, 250);
    };
    tick();
  }

  function init() {
    canvas = document.getElementById("game");
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    game = FP.Game ? new FP.Game(canvas) : null;
    FP.game = game;
    bindGlobalKeys();

    const hint = document.getElementById("hint");
    runLoader(() => { if (hint) hint.style.display = "none"; });

    game.start();
    requestAnimationFrame(loop);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
