/* HEXA – Ton: Effekte und Lo-Fi-Musik
   Alle Klänge entstehen im Browser (Web Audio), es wird keine Datei geladen.
   Browser erlauben Ton erst nach dem ersten Tippen, deshalb startet alles dort. */
window.HexaSound = (() => {
  'use strict';

  const AC = window.AudioContext || window.webkitAudioContext;
  const KEY = 'hexa-sound';
  const MUSIC_VOL = 0.55;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === 'off'; } catch (e) { /* Speicher gesperrt */ }

  let ctx = null;
  let out = null;    // alles, hier wird stumm geschaltet
  let fx = null;     // Effekte
  let mus = null;    // Musik (Ein- und Ausblenden)
  let dry = null;    // Musik ohne Hall
  let wet = null;    // Musik in den Hall
  let noise = null;
  let unlocked = false;

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const quiet = p => { if (p && p.catch) p.catch(() => { /* egal */ }); };
  function chain(...nodes) {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  }

  function impulse(sec) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  function build() {
    if (ctx) return true;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { ctx = null; return false; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    comp.connect(ctx.destination);
    out = ctx.createGain();
    out.gain.value = muted ? 0 : 1;
    out.connect(comp);
    fx = ctx.createGain();
    fx.gain.value = 1;
    fx.connect(out);
    // Musik: warmer Tiefpass und leichtes Leiern wie bei einem alten Tonband
    mus = ctx.createGain();
    mus.gain.value = 0;
    const tape = ctx.createBiquadFilter();
    tape.type = 'lowpass';
    tape.frequency.value = 4500;
    tape.Q.value = 0.4;
    const wow = ctx.createDelay(0.05);
    wow.delayTime.value = 0.01;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.5;
    const depth = ctx.createGain();
    depth.gain.value = 0.0008;
    chain(lfo, depth);
    depth.connect(wow.delayTime);
    lfo.start();
    chain(mus, tape, wow, out);
    dry = ctx.createGain();
    dry.connect(mus);
    wet = ctx.createGain();
    const verb = ctx.createConvolver();
    verb.buffer = impulse(2.2);
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.32;
    chain(wet, verb, verbOut, mus);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const ch = noise.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    return true;
  }

  const ready = () => !!ctx && !muted;

  /* Bausteine */
  function env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function send(g, amount) {
    if (!amount) return;
    const s = ctx.createGain();
    s.gain.value = amount;
    chain(g, s, wet);
  }
  // Kurzes, gefiltertes Rauschen: Klacken, Hi-Hat, Bleistift, Knistern
  function hit(t, o) {
    const attack = o.attack || 0.001;
    const len = attack + o.decay + 0.02;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.value = o.freq;
    f.Q.value = o.q == null ? 1 : o.q;
    const g = ctx.createGain();
    env(g, t, o.gain, attack, o.decay);
    chain(src, f, g, o.dest || fx);
    send(g, o.wet);
    src.start(t, Math.random() * Math.max(0, 1 - len), len);
  }
  function tone(t, freq, o) {
    const attack = o.attack || 0.005;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(freq * o.slide, t + attack + o.decay);
    const g = ctx.createGain();
    env(g, t, o.gain, attack, o.decay);
    chain(osc, g, o.dest || fx);
    send(g, o.wet);
    osc.start(t);
    osc.stop(t + attack + o.decay + 0.05);
  }
  // Weicher, glockiger Ton für kleine Melodien
  function pluck(t, midi, gain, wetAmt) {
    const f = mtof(midi);
    tone(t, f, { gain, attack: 0.004, decay: 0.55, wet: wetAmt });
    tone(t, f * 2, { type: 'triangle', gain: gain * 0.22, attack: 0.003, decay: 0.18 });
    tone(t, f * 4, { gain: gain * 0.1, attack: 0.002, decay: 0.06 });
  }

  /* ---------- Effekte ---------- */
  // Würfel rollen: dichtes Klacken am Anfang, dann seltener und leiser, zum Schluss liegen bleiben
  function roll(n) {
    if (!ready()) return;
    const t0 = ctx.currentTime + 0.01;
    const dur = 0.58;
    hit(t0, { type: 'lowpass', freq: 700, q: 0.7, gain: 0.2, attack: 0.03, decay: dur });
    const count = 6 + Math.max(1, n) * 4;
    for (let k = 0; k < count; k++) {
      const t = t0 + dur * 0.9 * Math.pow(Math.random(), 1.3);
      const left = 1 - (t - t0) / dur;
      hit(t, { freq: rnd(1500, 4000), q: rnd(2.5, 6), gain: rnd(0.7, 1.5) * (0.35 + 0.65 * left), decay: rnd(0.016, 0.045) });
      if (Math.random() < 0.4) tone(t, rnd(800, 1600), { type: 'triangle', gain: 0.1 * (0.4 + left), attack: 0.001, decay: 0.035, slide: 0.8 });
    }
    hit(t0 + dur + 0.02, { freq: 2300, q: 4, gain: 0.45, decay: 0.03 });
    hit(t0 + dur + 0.07, { freq: 2800, q: 4, gain: 0.25, decay: 0.03 });
  }
  // Würfel zur Seite legen (tiefer) oder zurückholen (höher)
  function hold(on) {
    if (!ready()) return;
    const t = ctx.currentTime + 0.005;
    tone(t, on ? 540 : 760, { type: 'triangle', gain: 0.18, attack: 0.002, decay: 0.07, slide: on ? 0.72 : 1.25 });
    hit(t, { freq: on ? 1700 : 2500, q: 3, gain: 0.35, decay: 0.022 });
  }
  // Punkte eintragen: kleines Glockenspiel, je mehr Punkte, desto mehr Töne.
  // Streichen: Bleistiftstrich und ein dumpfer Ton.
  function score(v, delay) {
    if (!ready()) return;
    const t = ctx.currentTime + 0.01 + (delay || 0);
    if (v > 0) {
      const notes = v >= 40 ? [72, 76, 79, 84] : v >= 20 ? [74, 79, 83] : [76, 81];
      notes.forEach((m, i) => pluck(t + i * 0.07, m, 0.16, 0));
    } else {
      hit(t, { freq: 3400, q: 1.1, gain: 0.25, attack: 0.03, decay: 0.1 });
      hit(t + 0.11, { freq: 3900, q: 1.1, gain: 0.18, attack: 0.02, decay: 0.08 });
      tone(t + 0.03, 196, { type: 'triangle', gain: 0.2, attack: 0.006, decay: 0.24, slide: 0.72 });
    }
  }
  // Spielende oder perfekter Countdown
  function fanfare(delay) {
    if (!ready()) return;
    const t = ctx.currentTime + 0.02 + (delay || 0);
    [60, 64, 67, 72].forEach((m, i) => pluck(t + i * 0.1, m, 0.14, 0));
    [64, 67, 72, 76].forEach(m => pluck(t + 0.45, m, 0.08, 0));
  }
  // Countdown freigeschaltet
  function sparkle() {
    if (!ready()) return;
    const t = ctx.currentTime + 0.02;
    [84, 88, 91, 96].forEach((m, i) => pluck(t + i * 0.055, m, 0.08, 0));
    hit(t, { type: 'highpass', freq: 7000, q: 0.5, gain: 0.04, attack: 0.05, decay: 0.35 });
  }
  // Countdown getroffen: mit jeder Stufe ein Ton höher
  function cdHit(stage) {
    if (!ready()) return;
    const t = ctx.currentTime + 0.01;
    const m = [72, 74, 76, 79, 81, 84][Math.max(0, Math.min(5, stage - 1))];
    pluck(t, m, 0.15, 0);
    pluck(t + 0.08, m + 7, 0.11, 0);
  }
  // Countdown verpasst
  function cdMiss() {
    if (!ready()) return;
    const t = ctx.currentTime + 0.01;
    tone(t, mtof(67), { type: 'triangle', gain: 0.11, attack: 0.005, decay: 0.16 });
    tone(t + 0.17, mtof(62), { type: 'triangle', gain: 0.11, attack: 0.005, decay: 0.38, slide: 0.94 });
  }

  /* ---------- Lo-Fi-Musik ---------- */
  // Schleife aus 8 Takten mit weichen Jazz-Akkorden. Kleine Zufälle bei Schlagzeug,
  // Bass und Melodie sorgen dafür, dass es nicht nach Endlosschleife klingt.
  const Music = (() => {
    const BPM = 72;
    const BEAT = 60 / BPM;
    const STEP = BEAT / 4;
    const PROG = [
      [41, [57, 60, 64, 67]],  // Fmaj9
      [40, [55, 59, 62, 67]],  // Em7
      [38, [53, 57, 60, 64]],  // Dm9
      [36, [52, 55, 59, 62]],  // Cmaj9
      [41, [57, 60, 64, 67]],  // Fmaj9
      [40, [55, 59, 62, 67]],  // Em7
      [45, [55, 59, 60, 64]],  // Am9
      [43, [53, 57, 60, 64]],  // G13sus
    ];
    let on = false;
    let timer = 0;
    let next = 0;
    let step = 0;
    let hiss = null;

    // E-Piano: Sinus mit etwas Dreieck, heller Anschlag, langes Ausklingen
    function ep(t, m, vel, len) {
      const f = mtof(m);
      const peak = 0.11 * vel;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
      g.gain.exponentialRampToValueAtTime(peak * 0.45, t + 0.4);
      g.gain.exponentialRampToValueAtTime(peak * 0.22, t + len * 0.75);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      const a = ctx.createOscillator();
      a.frequency.value = f;
      const b = ctx.createOscillator();
      b.type = 'triangle';
      b.frequency.value = f;
      b.detune.value = rnd(-7, 7);
      const bg = ctx.createGain();
      bg.gain.value = 0.3;
      // zweiter Teilton: macht die Akkorde auch auf kleinen Lautsprechern hörbar
      const h = ctx.createOscillator();
      h.frequency.value = f * 2;
      const hg = ctx.createGain();
      hg.gain.setValueAtTime(0.35, t);
      hg.gain.exponentialRampToValueAtTime(0.08, t + 0.9);
      a.connect(g);
      chain(b, bg, g);
      chain(h, hg, g);
      h.start(t);
      h.stop(t + len + 0.05);
      g.connect(dry);
      send(g, 0.6);
      a.start(t);
      b.start(t);
      a.stop(t + len + 0.05);
      b.stop(t + len + 0.05);
      tone(t, f * 2, { gain: peak * 0.5, attack: 0.003, decay: 0.12, dest: dry });
    }
    function strum(t, notes, vel, len) {
      notes.forEach((m, i) => ep(t + i * 0.018 + rnd(0, 0.008), m, vel * rnd(0.8, 1.05), len));
    }
    // Bass: Dreieck durch einen Tiefpass, damit man ihn auch auf dem Handy hört
    function bass(t, m, len) {
      const f = mtof(m);
      const a = ctx.createOscillator();
      a.type = 'triangle';
      a.frequency.value = f;
      const b = ctx.createOscillator();
      b.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 480;
      lp.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.11, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      a.connect(lp);
      b.connect(lp);
      chain(lp, g, dry);
      a.start(t);
      b.start(t);
      a.stop(t + len + 0.05);
      b.stop(t + len + 0.05);
    }
    function kick(t, vel) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
      const g = ctx.createGain();
      env(g, t, 0.16 * vel, 0.004, 0.26);
      chain(o, g, dry);
      o.start(t);
      o.stop(t + 0.36);
      hit(t, { type: 'lowpass', freq: 1800, q: 0.7, gain: 0.12 * vel, decay: 0.015, dest: dry });
    }
    function snare(t, vel) {
      hit(t, { freq: 1800, q: 0.8, gain: 0.2 * vel, attack: 0.002, decay: 0.14, dest: dry, wet: 0.25 });
      tone(t, 190, { type: 'triangle', gain: 0.1 * vel, attack: 0.002, decay: 0.09, slide: 0.85, dest: dry });
    }
    function hat(t, vel, open) {
      hit(t, { type: 'highpass', freq: 6000, q: 0.7, gain: 0.08 * vel, decay: open ? 0.16 : 0.035, dest: dry });
    }
    function crackle(t) {
      hit(t, { type: 'highpass', freq: rnd(1500, 5000), q: 0.5, gain: rnd(0.01, 0.045), attack: 0.0005, decay: rnd(0.002, 0.006), dest: dry });
    }
    function bell(t, m, gain) {
      const f = mtof(m);
      tone(t, f, { gain, attack: 0.01, decay: 1.3, dest: dry, wet: 1.1 });
      tone(t, f * 2, { gain: gain * 0.15, attack: 0.005, decay: 0.35, dest: dry });
    }
    // Ab und zu ein paar Töne aus dem Akkord, in kleinen Schritten
    function phrase(t, notes) {
      const pool = [];
      notes.forEach(n => [12, 24].forEach(o => { if (n + o >= 69 && n + o <= 86) pool.push(n + o); }));
      if (!pool.length) return;
      const slots = [2, 4, 6, 8, 10, 12, 14].filter(() => Math.random() < 0.38).slice(0, 4);
      let prev = pool[Math.floor(Math.random() * pool.length)];
      slots.forEach(p => {
        const near = pool.filter(n => n !== prev && Math.abs(n - prev) <= 5);
        if (near.length) prev = near[Math.floor(Math.random() * near.length)];
        bell(t + p * STEP + (p % 4 === 2 ? STEP * 0.3 : 0), prev, rnd(0.045, 0.065));
      });
    }
    function play(s, t) {
      const bar = Math.floor(s / 16);
      const [root, notes] = PROG[bar % PROG.length];
      const pos = s % 16;
      const late = pos % 4 === 2 ? STEP * 0.3 : 0;   // Swing
      const loose = () => rnd(-0.006, 0.006);
      if (pos === 0) {
        strum(t, notes, rnd(0.85, 1), BEAT * 3.4);
        bass(t + 0.01, root, BEAT * 1.8);
      }
      if (pos === 10) {
        if (Math.random() < 0.4) strum(t + late, notes.slice(1), 0.5, BEAT * 1.4);
        if (Math.random() < 0.65) bass(t + late, root + (Math.random() < 0.3 ? 7 : 0), BEAT * 1.2);
      }
      if (pos === 0 || pos === 10 || (pos === 7 && Math.random() < 0.2)) kick(t + (pos === 10 ? late : 0) + loose(), pos === 0 ? 1 : 0.75);
      if (pos === 4 || pos === 12) snare(t + 0.018 + loose(), rnd(0.85, 1));
      if (pos % 2 === 0 && Math.random() > 0.1) hat(t + late + loose(), pos % 4 === 0 ? 0.9 : 0.55, pos === 14 && Math.random() < 0.2);
      if (Math.random() < 0.2) crackle(t + Math.random() * STEP);
      if (pos === 0 && bar % 2 === 1 && Math.random() < 0.6) phrase(t, notes);
    }
    function tick() {
      if (!on) return;
      while (next < ctx.currentTime + 0.3) {
        play(step, next);
        next += STEP;
        step++;
      }
    }
    function start() {
      if (on || !ctx || muted) return;
      on = true;
      step = 0;
      const t = ctx.currentTime;
      next = t + 0.2;
      mus.gain.cancelScheduledValues(t);
      mus.gain.setValueAtTime(0.0001, t);
      mus.gain.linearRampToValueAtTime(MUSIC_VOL, t + 3);
      // leises Plattenrauschen im Hintergrund
      hiss = ctx.createBufferSource();
      hiss.buffer = noise;
      hiss.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3200;
      bp.Q.value = 0.4;
      const hg = ctx.createGain();
      hg.gain.value = 0.012;
      chain(hiss, bp, hg, dry);
      hiss.start(t);
      tick();
      timer = setInterval(tick, 80);
    }
    function stop(fast) {
      if (!on) return;
      on = false;
      clearInterval(timer);
      const t = ctx.currentTime;
      const fade = fast ? 0.05 : 0.8;
      mus.gain.cancelScheduledValues(t);
      mus.gain.setValueAtTime(mus.gain.value, t);
      mus.gain.linearRampToValueAtTime(0, t + fade);
      if (hiss) {
        try { hiss.stop(t + fade + 0.05); } catch (e) { /* schon gestoppt */ }
        hiss = null;
      }
    }
    return { start, stop };
  })();

  /* ---------- Freischalten, Stummschalten, Hintergrund ---------- */
  function unlock() {
    if (!build()) return;
    if (ctx.state !== 'running' && document.visibilityState === 'visible') quiet(ctx.resume());
    if (!unlocked) {
      unlocked = true;
      // iOS: ein kurzer stiller Ton gibt die Ausgabe frei
      try {
        const s = ctx.createBufferSource();
        s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        s.connect(ctx.destination);
        s.start(0);
      } catch (e) { /* egal */ }
    }
    if (!muted) Music.start();
  }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch (e) { /* Speicher gesperrt */ }
    if (!ctx) {
      if (!muted) unlock();
      return;
    }
    const t = ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(muted ? 0 : 1, t + 0.08);
    if (muted) Music.stop();
    else {
      unlock();
      pluck(ctx.currentTime + 0.02, 79, 0.08, 0);
    }
  }

  ['pointerup', 'click', 'keydown'].forEach(type => document.addEventListener(type, unlock, true));
  // Im Hintergrund pausieren, das spart Akku
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.visibilityState === 'hidden') {
      Music.stop(true);
      quiet(ctx.suspend());
    } else if (unlocked) {
      quiet(ctx.resume());
      if (!muted) Music.start();
    }
  });

  return { setMuted, isMuted: () => muted, roll, hold, score, fanfare, sparkle, cdHit, cdMiss };
})();
