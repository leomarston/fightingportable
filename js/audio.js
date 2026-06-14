/* ============================================================
   audio.js — procedural sound. Everything is synthesized with the
   WebAudio API so the game ships with zero binary assets.
   ============================================================ */
(function (global) {
  "use strict";
  const FP = global.FP;

  class Audio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.enabled = true;
      this._music = null;
      this.muted = false;
    }
    init() {
      if (this.ctx) return;
      try {
        const AC = global.AudioContext || global.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.32;
        this.musicGain.connect(this.master);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.85;
        this.sfxGain.connect(this.master);
      } catch (e) { this.enabled = false; }
    }
    resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); }
    get t() { return this.ctx ? this.ctx.currentTime : 0; }

    _env(node, gainTo, dur, peak = 1, attack = 0.005, dest) {
      const g = this.ctx.createGain();
      const t = this.t;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      node.connect(g);
      g.connect(dest || this.sfxGain);
      return g;
    }

    tone(freq, dur, type = "sine", peak = 0.6, slideTo = null, dest) {
      if (!this.enabled || !this.ctx || this.muted) return;
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, this.t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), this.t + dur);
      this._env(o, null, dur, peak, 0.004, dest);
      o.start();
      o.stop(this.t + dur + 0.02);
    }

    noise(dur, peak = 0.5, filterFreq = 1800, type = "lowpass", dest) {
      if (!this.enabled || !this.ctx || this.muted) return;
      const n = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = type; f.frequency.value = filterFreq;
      src.connect(f);
      this._env(f, null, dur, peak, 0.002, dest);
      src.start();
    }

    // ---- game sound vocabulary -------------------------------
    hit(power = 1) {
      this.noise(0.09 + power * 0.05, 0.6 + power * 0.25, 900 + power * 600, "lowpass");
      this.tone(120 - power * 20, 0.12 + power * 0.06, "triangle", 0.5 + power * 0.2, 50);
      this.tone(420 + power * 120, 0.05, "square", 0.18);
    }
    block() { this.noise(0.08, 0.4, 2600, "bandpass"); this.tone(300, 0.06, "square", 0.2, 180); }
    whiff() { this.noise(0.12, 0.18, 1200, "bandpass"); }
    jump() { this.tone(280, 0.18, "sine", 0.35, 540); }
    land() { this.noise(0.1, 0.4, 500); this.tone(90, 0.12, "sine", 0.4, 50); }
    dash() { this.noise(0.16, 0.3, 1600, "bandpass"); }
    fireball() {
      this.tone(180, 0.4, "sawtooth", 0.4, 520);
      this.noise(0.4, 0.3, 1400, "bandpass");
      this.tone(640, 0.35, "sine", 0.2, 240);
    }
    super() {
      this.tone(110, 0.7, "sawtooth", 0.5, 880);
      this.noise(0.7, 0.4, 2200, "bandpass");
      for (let i = 0; i < 4; i++) setTimeout(() => this.tone(440 + i * 110, 0.2, "square", 0.2), i * 70);
    }
    ko() {
      this.tone(80, 1.2, "sawtooth", 0.6, 40);
      this.noise(0.9, 0.6, 700);
      setTimeout(() => { this.tone(523, 0.5, "square", 0.3); this.tone(659, 0.5, "square", 0.25); }, 120);
    }
    bell() { this.tone(880, 0.5, "sine", 0.4); this.tone(1320, 0.6, "sine", 0.25); }
    select() { this.tone(660, 0.08, "square", 0.3, 880); }
    confirm() { this.tone(523, 0.1, "square", 0.3); setTimeout(() => this.tone(784, 0.16, "square", 0.3), 70); }
    counter() { this.tone(740, 0.1, "square", 0.3); this.tone(988, 0.18, "sine", 0.25); }

    // ---- announcer (formant-ish bleeps, "arcade" feel) -------
    announce(word) {
      if (!this.enabled || !this.ctx || this.muted) return;
      const map = {
        round: [196, 0.5], fight: [330, 0.45], ko: [110, 0.8],
        winner: [294, 0.7], perfect: [392, 0.6], "you win": [350, 0.6],
        "you lose": [160, 0.7],
      };
      const v = map[word] || [220, 0.5];
      this.tone(v[0], v[1], "sawtooth", 0.4, v[0] * 1.4);
      this.tone(v[0] * 2, v[1] * 0.7, "square", 0.15);
    }

    // ---- background music: simple layered arpeggio + bass -----
    startMusic(tempo = 132) {
      if (!this.enabled || !this.ctx || this._music) return;
      const beat = 60 / tempo;
      const scale = [0, 3, 5, 7, 10]; // minor pentatonic
      const root = 110;
      let step = 0;
      const bass = [0, 0, -5, -5, -7, -7, -3, -3];
      const tick = () => {
        if (!this._music) return;
        const o = step % 16;
        // bass
        if (o % 2 === 0) {
          const semi = bass[(step / 2 | 0) % bass.length];
          this.tone(root * Math.pow(2, semi / 12) / 2, beat * 1.7, "triangle", 0.32, null, this.musicGain);
        }
        // arp
        const n = scale[(step * 3) % scale.length] + (o >= 8 ? 12 : 0);
        this.tone(root * 2 * Math.pow(2, n / 12), beat * 0.8, "square", 0.12, null, this.musicGain);
        // hat
        if (o % 2 === 1) this.noise(0.04, 0.06, 6000, "highpass", this.musicGain);
        // kick
        if (o % 4 === 0) this.tone(60, 0.16, "sine", 0.4, 38, this.musicGain);
        step++;
      };
      this._music = setInterval(tick, beat * 250); // 8th notes
    }
    stopMusic() { if (this._music) { clearInterval(this._music); this._music = null; } }
    setMusicVol(v) { if (this.musicGain) this.musicGain.gain.value = v; }
    toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.9; return this.muted; }
  }

  FP.Audio = new Audio();
})(window);
