/* ============================================================
   characters.js — roster data. Each fighter is an original
   design inspired by a classic archetype: proportions feed the
   shared rig, palette drives the renderer, and movelists define
   normals, specials and a super.
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP;

  // Motion notation (numpad): 236=QCF, 214=QCB, 623=DP (F,D,DF)
  const ROSTER = [
    {
      id: "ryu", name: "RYU", title: "The Wanderer",
      desc: "All-round disciplined striker. Spirit bolts and the rising dragon punch.",
      // proportions
      prop: { scale: 1.0, bulk: 1.0, armLen: 1.0, legLen: 1.0, headR: 1.0, shoulderW: 1.05, hipW: 1.0 },
      // palette
      pal: {
        skin: "#e7b48a", skinSh: "#b9835c",
        hair: "#1c1812", gi: "#f2efe6", giSh: "#c9c4b3",
        trim: "#d23b2e", accent: "#3fb6ff", energy: "#36c0ff", energy2: "#0a3b8a",
        belt: "#1c1c1c", band: "#d23b2e",
      },
      style: { headband: true, gi: true, barefoot: true },
      stats: { walkF: 250, walkB: 200, dashF: 620, jump: 1180, weight: 1.0, hp: 1000 },
      energyName: "SPIRIT", auraColor: "#36c0ff",
      moves: {
        specials: [
          { name: "Spirit Bolt", motion: [2, 3, 6], btns: ["lp", "mp", "hp"], anim: "fireball", kind: "projectile",
            startup: 10, active: 4, recovery: 22, dmg: 95, meter: 14, proj: { speed: 560, color: "#5ad0ff", color2: "#0a3b8a", r: 22, life: 1.6, dmg: 95, hits: 1 } },
          { name: "Dragon Fist", motion: [6, 2, 3], btns: ["lp", "mp", "hp"], anim: "dp", kind: "uppercut",
            startup: 5, active: 14, recovery: 26, dmg: 130, meter: 18, rise: 720, knockUp: true, invuln: 6 },
          { name: "Blade Kick", motion: [2, 1, 4], btns: ["lk", "mk", "hk"], anim: "spinKick", kind: "advance",
            startup: 9, active: 10, recovery: 20, dmg: 100, meter: 14, adv: 360 },
        ],
        super: { name: "TRUE SPIRIT CANNON", motion: [2, 3, 6], double: true, btns: ["lp", "mp", "hp"], anim: "super", kind: "beam",
          startup: 8, active: 30, recovery: 30, dmg: 360, color: "#7fe3ff", color2: "#0c2f7a" },
      },
    },
    {
      id: "kenji", name: "KENJI", title: "The Ronin",
      desc: "Patient swordsman with long pokes and a vacuum slash.",
      prop: { scale: 1.04, bulk: 0.98, armLen: 1.08, legLen: 1.04, headR: 0.98, shoulderW: 1.0, hipW: 0.98 },
      pal: {
        skin: "#d8a87e", skinSh: "#9f714c", hair: "#0f0d0c",
        gi: "#3b4a5a", giSh: "#222b36", trim: "#7d2b2b", accent: "#9fd8ff",
        energy: "#bfe3ff", energy2: "#244a78", belt: "#10141a", band: "#7d2b2b",
      },
      style: { topknot: true, gi: true, sword: true },
      stats: { walkF: 235, walkB: 195, dashF: 600, jump: 1150, weight: 1.05, hp: 1000 },
      energyName: "KI", auraColor: "#bfe3ff",
      moves: {
        specials: [
          { name: "Crescent Slash", motion: [2, 3, 6], btns: ["lp", "mp", "hp"], anim: "fireball", kind: "projectile",
            startup: 12, active: 4, recovery: 24, dmg: 90, meter: 14, proj: { speed: 520, color: "#cdeaff", color2: "#244a78", r: 26, life: 1.4, dmg: 90, hits: 1, slash: true } },
          { name: "Iai Rise", motion: [6, 2, 3], btns: ["lp", "mp", "hp"], anim: "dp", kind: "uppercut",
            startup: 6, active: 12, recovery: 28, dmg: 125, meter: 18, rise: 700, knockUp: true, invuln: 5 },
          { name: "Step Cut", motion: [2, 1, 4], btns: ["lk", "mk", "hk"], anim: "spinKick", kind: "advance",
            startup: 10, active: 10, recovery: 22, dmg: 105, meter: 14, adv: 380 },
        ],
        super: { name: "MOONFALL CLEAVE", motion: [2, 3, 6], double: true, btns: ["lp", "mp", "hp"], anim: "super", kind: "beam",
          startup: 10, active: 28, recovery: 32, dmg: 350, color: "#dff0ff", color2: "#2a4f86" },
      },
    },
    {
      id: "liana", name: "LIANA", title: "The Phoenix",
      desc: "Agile rushdown. Fire claws and a blazing rising spiral.",
      prop: { scale: 0.93, bulk: 0.86, armLen: 0.98, legLen: 1.06, headR: 1.02, shoulderW: 0.9, hipW: 1.04 },
      pal: {
        skin: "#eebd96", skinSh: "#c1855b", hair: "#2a1410",
        gi: "#c8302a", giSh: "#8c1c1a", trim: "#ffcf3a", accent: "#ff9b3d",
        energy: "#ff8a2a", energy2: "#7a1404", belt: "#ffcf3a", band: "#ffcf3a",
      },
      style: { ponytail: true, dress: true, barefoot: false },
      stats: { walkF: 280, walkB: 225, dashF: 690, jump: 1130, weight: 0.9, hp: 950 },
      energyName: "BLAZE", auraColor: "#ff8a2a",
      moves: {
        specials: [
          { name: "Flame Dart", motion: [2, 3, 6], btns: ["lp", "mp", "hp"], anim: "fireball", kind: "projectile",
            startup: 9, active: 4, recovery: 20, dmg: 80, meter: 13, proj: { speed: 600, color: "#ff9b3d", color2: "#7a1404", r: 18, life: 1.3, dmg: 80, hits: 1, fire: true } },
          { name: "Phoenix Rise", motion: [6, 2, 3], btns: ["lp", "mp", "hp"], anim: "dp", kind: "uppercut",
            startup: 4, active: 14, recovery: 24, dmg: 120, meter: 18, rise: 760, knockUp: true, invuln: 6, fire: true },
          { name: "Talon Spin", motion: [2, 1, 4], btns: ["lk", "mk", "hk"], anim: "spinKick", kind: "advance",
            startup: 7, active: 12, recovery: 18, dmg: 95, meter: 14, adv: 420, multi: 2 },
        ],
        super: { name: "REBIRTH INFERNO", motion: [2, 3, 6], double: true, btns: ["lp", "mp", "hp"], anim: "super", kind: "beam",
          startup: 6, active: 32, recovery: 28, dmg: 340, color: "#ffb046", color2: "#7a1404", fire: true },
      },
    },
    {
      id: "goro", name: "GORO", title: "The Beast",
      desc: "Monstrous grappler. Slow but devastating with command throws.",
      prop: { scale: 1.22, bulk: 1.5, armLen: 1.06, legLen: 0.9, headR: 1.04, shoulderW: 1.35, hipW: 1.25 },
      pal: {
        skin: "#caa06f", skinSh: "#8c6238", hair: "#2a1a0c",
        gi: "#6e4a22", giSh: "#4a2f12", trim: "#caa36a", accent: "#ffb24a",
        energy: "#ffae3a", energy2: "#5a2a06", belt: "#3a2410", band: "#7a4a1c",
      },
      style: { bald: false, beard: true, shirtless: true, mohawk: true },
      stats: { walkF: 190, walkB: 150, dashF: 470, jump: 980, weight: 1.5, hp: 1150 },
      energyName: "RAGE", auraColor: "#ffae3a",
      moves: {
        specials: [
          { name: "Quake Stomp", motion: [2, 3, 6], btns: ["lp", "mp", "hp"], anim: "fireball", kind: "shock",
            startup: 14, active: 6, recovery: 26, dmg: 90, meter: 13, shockwave: true },
          { name: "Beast Lift", motion: [6, 2, 3], btns: ["lp", "mp", "hp"], anim: "dp", kind: "command_grab",
            startup: 5, active: 6, recovery: 30, dmg: 150, meter: 18, grab: true, range: 86 },
          { name: "Charging Tusk", motion: [2, 1, 4], btns: ["lk", "mk", "hk"], anim: "spinKick", kind: "advance",
            startup: 11, active: 12, recovery: 24, dmg: 120, meter: 14, adv: 500, armor: true },
        ],
        super: { name: "TITAN SLAM", motion: [2, 3, 6], double: true, btns: ["lp", "mp", "hp"], anim: "super", kind: "grab_super",
          startup: 8, active: 10, recovery: 34, dmg: 400, color: "#ffc864", color2: "#5a2a06", grab: true, range: 120 },
      },
    },
    {
      id: "azuma", name: "AZUMA", title: "The Ninja",
      desc: "Tricky mix-up specialist. Shuriken, teleports and rolling cyclone.",
      prop: { scale: 0.98, bulk: 0.92, armLen: 1.02, legLen: 1.04, headR: 0.96, shoulderW: 0.98, hipW: 0.96 },
      pal: {
        skin: "#d6a87e", skinSh: "#9c714b", hair: "#0a0a0e",
        gi: "#23304a", giSh: "#141b2c", trim: "#8a93b0", accent: "#9b6bff",
        energy: "#a86bff", energy2: "#2a0d5e", belt: "#101521", band: "#8a93b0",
      },
      style: { ninja: true, mask: true, gi: true },
      stats: { walkF: 265, walkB: 215, dashF: 660, jump: 1200, weight: 0.95, hp: 970 },
      energyName: "VOID", auraColor: "#a86bff",
      moves: {
        specials: [
          { name: "Shadow Shuriken", motion: [2, 3, 6], btns: ["lp", "mp", "hp"], anim: "fireball", kind: "projectile",
            startup: 8, active: 4, recovery: 18, dmg: 70, meter: 12, proj: { speed: 680, color: "#b78bff", color2: "#2a0d5e", r: 14, life: 1.2, dmg: 70, hits: 1, spin: true } },
          { name: "Void Ascend", motion: [6, 2, 3], btns: ["lp", "mp", "hp"], anim: "dp", kind: "uppercut",
            startup: 4, active: 12, recovery: 26, dmg: 115, meter: 18, rise: 780, knockUp: true, invuln: 6 },
          { name: "Cyclone Roll", motion: [2, 1, 4], btns: ["lk", "mk", "hk"], anim: "spinKick", kind: "advance",
            startup: 6, active: 14, recovery: 18, dmg: 90, meter: 14, adv: 440, multi: 3 },
        ],
        super: { name: "THOUSAND SHADOWS", motion: [2, 3, 6], double: true, btns: ["lp", "mp", "hp"], anim: "super", kind: "rush_super",
          startup: 6, active: 40, recovery: 26, dmg: 330, color: "#c79bff", color2: "#2a0d5e" },
      },
    },
  ];

  // Shared normal-attack frame data (startup/active/recovery in frames @60fps)
  // dmg, hitstun, blockstun, knockback, hit height, meter gain
  const NORMALS = {
    lp: { anim: "lp", startup: 3, active: 3, recovery: 6, dmg: 35, hitstun: 12, blockstun: 8, kb: 90, push: 60, level: "high", meter: 5, reach: 1, hitstop: 4 },
    mp: { anim: "mp", startup: 6, active: 4, recovery: 12, dmg: 62, hitstun: 16, blockstun: 11, kb: 150, push: 100, level: "high", meter: 7, reach: 1.15, hitstop: 6 },
    hp: { anim: "hp", startup: 9, active: 5, recovery: 18, dmg: 95, hitstun: 20, blockstun: 14, kb: 240, push: 150, level: "high", meter: 9, knockdown: false, hitstop: 9, launch: false },
    lk: { anim: "lk", startup: 4, active: 3, recovery: 8, dmg: 40, hitstun: 12, blockstun: 9, kb: 100, push: 70, level: "high", meter: 5, reach: 1.1, hitstop: 4 },
    mk: { anim: "mk", startup: 7, active: 4, recovery: 13, dmg: 66, hitstun: 16, blockstun: 11, kb: 170, push: 110, level: "high", meter: 7, reach: 1.25, hitstop: 6 },
    hk: { anim: "hk", startup: 10, active: 5, recovery: 20, dmg: 100, hitstun: 22, blockstun: 15, kb: 320, push: 120, level: "high", meter: 9, knockdown: true, hitstop: 10 },
    // crouch variants
    clp: { anim: "crouchPunch", crouch: true, startup: 3, active: 3, recovery: 7, dmg: 32, hitstun: 11, blockstun: 8, kb: 70, push: 50, level: "high", meter: 4, reach: 1, hitstop: 4 },
    clk: { anim: "crouchKick", crouch: true, low: true, startup: 4, active: 3, recovery: 8, dmg: 34, hitstun: 11, blockstun: 8, kb: 70, push: 50, level: "low", meter: 4, reach: 1, hitstop: 4 },
    chk: { anim: "crouchKick", crouch: true, low: true, sweep: true, startup: 8, active: 4, recovery: 22, dmg: 80, hitstun: 0, blockstun: 14, kb: 260, push: 60, level: "low", meter: 8, knockdown: true, hitstop: 8, reach: 1.4 },
    // jumping
    jp: { anim: "jumpPunch", air: true, startup: 5, active: 8, recovery: 4, dmg: 55, hitstun: 16, blockstun: 12, kb: 120, push: 60, level: "overhead", meter: 6, hitstop: 6 },
    jk: { anim: "jumpKick", air: true, startup: 5, active: 10, recovery: 4, dmg: 60, hitstun: 16, blockstun: 12, kb: 130, push: 60, level: "overhead", meter: 6, hitstop: 6 },
  };

  FP.ROSTER = ROSTER;
  FP.NORMALS = NORMALS;
  FP.charById = (id) => ROSTER.find((c) => c.id === id) || ROSTER[0];
})(window);
