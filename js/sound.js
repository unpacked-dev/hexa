/* HEXA – Ton: Effekte und Lo-Fi-Musik
   Alle Klänge entstehen im Browser (Web Audio), es wird keine Datei geladen.
   Browser erlauben Ton erst nach dem ersten Tippen, deshalb startet alles dort. */
window.HexaSound = (() => {
  'use strict';

  const AC = window.AudioContext || window.webkitAudioContext;
  const KEY = 'hexa-sound';
  const MUSIC_VOL = 0.55;
  const clamp01 = v => Math.max(0, Math.min(1, Number(v) || 0));

  // Musik und Spielsounds lassen sich getrennt an- und ausschalten und leiser stellen.
  const prefs = { music: true, fx: true, musicVol: 1, fxVol: 1 };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === 'off') {
      // alte Einstellung: alles stumm
      prefs.music = false;
      prefs.fx = false;
    } else if (raw && raw !== 'on') {
      const p = JSON.parse(raw);
      if (typeof p.music === 'boolean') prefs.music = p.music;
      if (typeof p.fx === 'boolean') prefs.fx = p.fx;
      if (p.musicVol != null) prefs.musicVol = clamp01(p.musicVol);
      if (p.fxVol != null) prefs.fxVol = clamp01(p.fxVol);
    }
  } catch (e) { /* Speicher gesperrt oder Eintrag kaputt */ }

  // Der Regler wirkt quadratisch, so fühlt er sich über den ganzen Weg gleichmäßig an.
  const level = v => v * v;
  const musicWanted = () => prefs.music && prefs.musicVol > 0;
  const fxLevel = () => (prefs.fx ? level(prefs.fxVol) : 0);
  const musicLevel = () => MUSIC_VOL * level(prefs.musicVol);

  let ctx = null;
  let out = null;    // Summe aller Töne
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
  // Jeder Ton besteht aus kleinen Knoten (Oszillator, Filter, Lautstärke). Ist er verklungen,
  // werden sie wieder abgehängt. Safari räumt verbundene Knoten sonst nicht auf: Sie sammeln sich
  // an (etwa 2.000 pro Minute Musik), und nach einer halben Stunde kommt das Audio nicht mehr hinterher.
  // Töne der Musik merkt sich die App, bis sie verklungen sind. So lassen sich schon geplante Töne
  // beim Ausschalten oder Sperren absagen, statt dass sie später noch nachklingen.
  // extra: weitere Klangquellen desselben Tons, die gleichzeitig enden
  const planned = new Set();
  function release(src, nodes, music, extra) {
    if (music) {
      planned.add(src);
      (extra || []).forEach(x => { planned.add(x); x.onended = () => planned.delete(x); });
    }
    src.onended = () => {
      planned.delete(src);
      nodes.forEach(n => { if (n) { try { n.disconnect(); } catch (e) { /* schon getrennt */ } } });
    };
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
    out.gain.value = 1;
    out.connect(comp);
    fx = ctx.createGain();
    fx.gain.value = fxLevel();
    fx.connect(out);
    room = impulse(2.2);
    musicBus();
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const ch = noise.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    return true;
  }

  // Musik: warmer Tiefpass und leichtes Leiern wie bei einem alten Tonband, dazu Hall.
  // Läuft die Musik lange, wird dieser Weg ab und zu frisch aufgebaut und der alte leise abgebaut.
  let room = null;       // Nachhall, einmal berechnet
  let busNodes = [];
  function musicBus() {
    const old = { mus, nodes: busNodes };
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
    verb.buffer = room;
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.32;
    chain(wet, verb, verbOut, mus);
    busNodes = [mus, tape, wow, lfo, depth, dry, wet, verb, verbOut];
    return old;
  }

  const ready = () => !!ctx && prefs.fx && prefs.fxVol > 0;

  /* Bausteine */
  function env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  // Anteil in den Hall. Gibt den Knoten zurück, damit er mit dem Ton wieder abgehängt wird.
  function send(g, amount) {
    if (!amount) return null;
    const s = ctx.createGain();
    s.gain.value = amount;
    chain(g, s, wet);
    return s;
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
    release(src, [src, f, g, send(g, o.wet)], o.dest === dry);
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
    release(osc, [osc, g, send(g, o.wet)], o.dest === dry);
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
    const AHEAD = 0.5;          // so viele Sekunden im Voraus wird geplant
    const FRESH = 20 * 60;      // nach 20 Minuten Musik wird ihr Weg frisch aufgebaut
    let on = false;
    let timer = 0;
    let next = 0;
    let step = 0;
    let hiss = null;
    let since = 0;              // seit wann der aktuelle Musik-Weg spielt

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
      release(a, [a, b, bg, h, hg, g, send(g, 0.6)], true, [b, h]);
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
      release(a, [a, b, lp, g], true, [b]);
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
      release(o, [o, g], true);
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
      const now = ctx.currentTime;
      // Hing die Seite kurz, werden die verpassten Töne nicht alle auf einmal nachgeholt.
      if (next < now) next = now + 0.05;
      while (next < now + AHEAD) {
        if (step % 16 === 0 && next - since > FRESH) refresh(next);
        play(step, next);
        next += STEP;
        step++;
      }
    }
    // Leises Plattenrauschen im Hintergrund
    function startHiss(t) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3200;
      bp.Q.value = 0.4;
      const hg = ctx.createGain();
      hg.gain.value = 0.012;
      chain(src, bp, hg, dry);
      release(src, [src, bp, hg]);
      src.start(t);
      return src;
    }
    // Zu Beginn eines Takts einen frischen Musik-Weg aufbauen und überblenden.
    // Der alte klingt aus und wird danach komplett abgehängt.
    function refresh(t) {
      const level = musicLevel();
      const old = musicBus();
      since = t;
      mus.gain.setValueAtTime(0.0001, t);
      mus.gain.linearRampToValueAtTime(Math.max(level, 0.0001), t + 2);
      const g = old.mus.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(level, t);
      g.linearRampToValueAtTime(0, t + 3);
      if (hiss) { try { hiss.stop(t + 3); } catch (e) { /* schon gestoppt */ } }
      hiss = startHiss(t);
      setTimeout(() => {
        old.nodes.forEach(n => {
          try { if (n.stop) n.stop(); } catch (e) { /* schon gestoppt */ }
          try { n.disconnect(); } catch (e) { /* schon getrennt */ }
        });
      }, (t - ctx.currentTime + 4) * 1000);
    }
    function start(fade) {
      if (on || !ctx || !musicWanted()) return;
      on = true;
      step = 0;
      const t = ctx.currentTime;
      next = t + 0.2;
      mus.gain.cancelScheduledValues(t);
      mus.gain.setValueAtTime(0.0001, t);
      mus.gain.linearRampToValueAtTime(musicLevel(), t + (fade || 3));
      hiss = startHiss(t);
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
      // Schon geplante Töne absagen, klingende nach dem Ausblenden beenden
      planned.forEach(src => { try { src.stop(t + fade + 0.02); } catch (e) { /* noch nicht gestartet */ } });
      if (hiss) {
        try { hiss.stop(t + fade + 0.05); } catch (e) { /* schon gestoppt */ }
        hiss = null;
      }
    }
    // Lautstärke ändern, während die Musik läuft
    function volume() {
      if (!on) return;
      const t = ctx.currentTime;
      mus.gain.cancelScheduledValues(t);
      mus.gain.setValueAtTime(mus.gain.value, t);
      mus.gain.linearRampToValueAtTime(musicLevel(), t + 0.15);
    }
    return { start, stop, volume, playing: () => on };
  })();

  /* ---------- Freischalten, Einstellungen, Hintergrund ---------- */
  function unlock() {
    if (!build()) return;
    if (document.visibilityState === 'visible') wake();
    if (!unlocked) {
      unlocked = true;
      // iOS: ein kurzer stiller Ton gibt die Ausgabe frei
      try {
        const s = ctx.createBufferSource();
        s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        s.connect(ctx.destination);
        release(s, [s]);
        s.start(0);
      } catch (e) { /* egal */ }
    }
    if (musicWanted()) Music.start();
  }

  // Neue Einstellungen übernehmen: Spielsounds sofort, Musik mit kurzem Ein- oder Ausblenden
  function set(next) {
    Object.keys(next).forEach(k => {
      if (k === 'music' || k === 'fx') prefs[k] = !!next[k];
      else if (k === 'musicVol' || k === 'fxVol') prefs[k] = clamp01(next[k]);
    });
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* Speicher gesperrt */ }
    if (!ctx) return;
    const t = ctx.currentTime;
    fx.gain.cancelScheduledValues(t);
    fx.gain.setValueAtTime(fx.gain.value, t);
    fx.gain.linearRampToValueAtTime(fxLevel(), t + 0.08);
    if (!musicWanted()) Music.stop();
    else if (Music.playing()) Music.volume();
    else if (unlocked) Music.start(1.2);
  }

  // Taste M: alle Töne aus – oder wieder so an, wie sie vorher waren
  let before = null;
  function toggleAll() {
    if (prefs.music || prefs.fx) {
      before = { music: prefs.music, fx: prefs.fx };
      set({ music: false, fx: false });
    } else {
      set(before || { music: true, fx: true });
    }
    return prefs.music || prefs.fx;
  }

  // Kurzer Klang, damit man die Spielsounds nach dem Einstellen hört
  function preview() {
    setTimeout(() => score(20), 90);
  }

  ['pointerup', 'click', 'keydown'].forEach(type => document.addEventListener(type, unlock, true));
  // Im Hintergrund pausieren, das spart Akku. Erst kurz ausblenden, dann anhalten:
  // Sofort angehalten bricht der Klang mitten im Ton ab, und auf dem iPhone ist ein fremder Ton zu hören.
  let sleepTimer = 0;
  function sleep() {
    if (!ctx) return;
    Music.stop(true);
    const t = ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(0, t + 0.06);
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => { if (document.visibilityState === 'hidden') quiet(ctx.suspend()); }, 150);
  }
  // Wieder da: weiterlaufen lassen und den Ton kurz einblenden
  function wake() {
    clearTimeout(sleepTimer);
    if (ctx.state !== 'running') quiet(ctx.resume());
    if (out.gain.value > 0.999) return;
    const t = ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(1, t + 0.08);
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.visibilityState === 'hidden') sleep();
    else if (unlocked) {
      wake();
      if (musicWanted()) Music.start();
    }
  });
  window.addEventListener('pagehide', sleep);

  return { get: () => Object.assign({}, prefs), set, toggleAll, preview, roll, hold, score, fanfare, sparkle, cdHit, cdMiss };
})();
