/* HEXA – Tutorial „Spiel lernen“: eine geführte Runde mit Pip und festen Würfen.
   Pip ist das Sechseck aus dem Logo mit Gesicht, die Augen sind zwei Würfelaugen (englisch „pips“).
   Hier stehen Pip als SVG, die Schritte als Daten und die Schicht über der App: Alles ist abgedunkelt,
   nur das Ziel bleibt frei. Daneben steht eine Sprechblase, aus der Pip herausschaut und aufs Ziel zeigt.
   Spielstand, feste Würfe und was klickbar ist, regelt js/app.js über start(adapter), event() und allows().
   Die Schritte lassen sich auch in Node laden (tests/tutorial.test.js). */
(function (root) {
  'use strict';

  /* ---------- Pip ---------- */
  // Das Sechseck aus dem Logo, größer gezeichnet: Mitte bei 36/38, die Zeichnung reicht von 0/12 bis 72/64.
  // Jede Form gibt es zweimal: erst breit in Weiß (der Rand wie bei einem Aufkleber), dann in Pips Farbe.
  const HEX = 'M36 19.5 52.02 28.75v18.5L36 56.5 19.98 47.25v-18.5z';
  const SHOULDER = { r: [50.5, 41], l: [21.5, 41] };
  const ARM = 15;
  const VIEW = [0, 12, 72, 52];   // viewBox: Platz für Sechseck und Arme
  // Arme je Pose: Winkel in Grad, 0 = waagerecht nach außen, negativ = nach oben. bent: angewinkelt.
  // aim: Der rechte Arm zeigt aufs Ziel, der Winkel kommt beim Zeichnen dazu (aimPip).
  const POSES = {
    hello: { r: -58, l: 78, wave: true },
    point: { r: 0, l: 78, aim: true },
    wow: { r: 36, l: 36, eyes: 3.9, mouth: 'o', brows: 'up' },
    cheer: { r: -52, l: -52, eyes: 'happy', mouth: 'open', hop: true },
    shrug: { r: 'bent', l: 'bent', mouth: 'flat', brows: 'tilt' },
    face: {},
  };

  function arm(side, a, p, edge) {
    const [x, y] = SHOULDER[side];
    const k = side === 'r' ? 1 : -1;
    let d;
    let hx;
    let hy;
    let t = '';
    if (a === 'bent') {
      // Schulterzucken: Ellbogen nach unten, Hand nach oben
      d = `M${x} ${y}l${8.5 * k} 5 ${5 * k} -9.5`;
      hx = x + 13.5 * k;
      hy = y - 4.5;
    } else {
      d = `M${x} ${y}h${ARM * k}`;
      hx = x + ARM * k;
      hy = y;
      t = ` transform="rotate(${k * a} ${x} ${y})"`;
    }
    const line = `<path class="${edge ? 'pp-el' : 'pp-bl'}" d="${d}" stroke-width="${edge ? 9.5 : 4}"/>`;
    const hand = `<circle class="${edge ? 'pp-e' : 'pp-b'}" cx="${hx}" cy="${hy}" r="${edge ? 6 : 3.3}"/>`;
    const aim = side === 'r' && p.aim ? ' class="pp-aim"' : '';
    const inner = side === 'r' && p.wave ? `<g class="pp-wave">${line}${hand}</g>` : line + hand;
    return `<g${t}${aim}>${inner}</g>`;
  }

  // Pip als SVG-Text. pose: hello, point, wow, cheer, shrug oder face (nur der Kopf, für Symbole).
  // crop: eng um das Sechseck zugeschnitten, ohne Platz für die Arme.
  function pip(pose, cls, crop) {
    const p = POSES[pose] || POSES.point;
    const sides = ['r', 'l'].filter(s => p[s] !== undefined);
    const eyes = p.eyes === 'happy'
      ? '<path class="pp-fl" d="M27.3 37Q30.5 32.6 33.7 37M38.3 37Q41.5 32.6 44.7 37" stroke-width="2.4"/>'
      : `<circle class="pp-fd" cx="30.5" cy="35.5" r="${p.eyes || 3.3}"/><circle class="pp-fd" cx="41.5" cy="35.5" r="${p.eyes || 3.3}"/>`;
    const brows = {
      up: '<path class="pp-fl" d="M26.8 29.2Q30.5 26.6 34 28.6M38 28.6Q41.5 26.6 45.2 29.2" stroke-width="2"/>',
      tilt: '<path class="pp-fl" d="M27 30.8 33.6 29M38.4 29 45 30.8" stroke-width="2"/>',
    }[p.brows] || '';
    const mouth = {
      o: '<ellipse class="pp-fd" cx="36" cy="45.2" rx="2.5" ry="3"/>',
      open: '<path class="pp-fd" d="M30.6 42.4Q36 50.6 41.4 42.4Z"/>',
      flat: '<path class="pp-fl" d="M31.6 45.2Q34 43.4 36 44.6T40.4 44" stroke-width="2.2"/>',
    }[p.mouth] || '<path class="pp-fl" d="M31 43Q36 47.8 41 43" stroke-width="2.2"/>';
    return `<svg class="pip pp-${pose}${p.hop ? ' pp-hop' : ''}${cls ? ' ' + cls : ''}" viewBox="${crop ? '14.5 14 43 48' : VIEW.join(' ')}" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round">`
      + sides.map(s => arm(s, p[s], p, true)).join('') + `<path class="pp-e" d="${HEX}" stroke-width="9"/>`
      + sides.map(s => arm(s, p[s], p, false)).join('') + `<path class="pp-b" d="${HEX}" stroke-width="3"/>`
      + `<g class="pp-eyes">${eyes}</g>${brows}${mouth}</svg>`;
  }

  /* ---------- Schritte ---------- */
  // Jeder Schritt: text (Schlüssel in lang/*.js, Platzhalter aus vars), turn (Zug 1–4, 0 = Start, 5 = Ende),
  // pose, spot (Ziele, die frei bleiben: je Eintrag ein Loch um alle Treffer), tap (was man antippen darf),
  // mark (was blinkt), aim (worauf Pip zeigt, sonst aufs erste blinkende Ziel oder das erste Loch), place (Blase above, below oder center) und until, also was passieren muss:
  //   next    „Weiter“ in der Blase
  //   roll    würfeln, dice: die nächsten Augenzahlen für die Würfel, die neu fallen (von links nach rechts)
  //   hold    genau diese Würfel liegen lassen (hold: Plätze 0–5), antippen darf man nur die neuen
  //   pick    ein Feld unter „Eintragen“ antippen (key)
  //   enter   im Fenster „Eintragen“ tippen
  //   tab     den Tab wechseln (tab)
  //   zeros   „Mit 0 Punkten streichen“ aufklappen
  //   cdRoll  im Countdown würfeln (dice), cdSave: den Countdown eintragen
  //   end     die letzte Blase mit Knöpfen für danach
  const TURNS = 4;
  const D = '#view-dice ';
  const ROLL = D + '[data-act="roll"]';
  const TRAY = D + '.tray';
  const opt = k => D + `.opt[data-key="${k}"]`;
  const OK = '#sheet [data-do="ok"]';
  const SHEET = '#sheet .sheet';
  const TAB = t => `.tabbar .tab[data-tab="${t}"]`;
  const ROWS = (...k) => k.map(x => `#view-block .p-row[data-row="${x}"]`).join(', ');
  const CD_ROLL = '#cd [data-act="cd-roll"]';
  const CD_SAVE = '#cd [data-act="cd-save"]';
  const roll = (turn, text, dice) => ({ turn, text, until: 'roll', spot: [ROLL], tap: [ROLL], dice });
  const hold = (turn, text, list) => ({ turn, text, until: 'hold', spot: [TRAY], hold: list });
  const pick = (turn, text, key, extra) => Object.assign({ turn, text, until: 'pick', key, spot: [opt(key)], tap: [opt(key)], mark: [opt(key)] }, extra);
  const enter = (turn, text) => ({ turn, text, until: 'enter', spot: [SHEET], tap: [OK], mark: [OK] });
  const tab = (turn, text, t) => ({ turn, text, until: 'tab', tab: t, spot: [TAB(t)], tap: [TAB(t)] });
  const cdRoll = (text, dice) => ({ turn: 4, text, until: 'cdRoll', spot: ['#cd .cd-dice', CD_ROLL], tap: [CD_ROLL], dice, place: 'above' });

  const STEPS = [
    { turn: 0, text: 'tut.s.hello', pose: 'hello', until: 'next', place: 'center', go: 'tut.go' },

    // Zug 1: würfeln, halten, bis zu 3 Würfe, eintragen bei den Fünfern
    roll(1, 'tut.s.roll1', [5, 2, 5, 1, 5, 3]),
    hold(1, 'tut.s.hold1', [0, 2, 4]),
    roll(1, 'tut.s.roll1b', [5, 6, 2]),
    hold(1, 'tut.s.hold1b', [0, 1, 2, 4]),
    roll(1, 'tut.s.roll1c', [4, 1]),
    pick(1, 'tut.s.pick1', 'u5', { spot: [D + '.entry'] }),
    enter(1, 'tut.s.enter1'),

    // Oberer Block: nur die passenden Augen zählen, Bonus ab 70
    tab(1, 'tut.s.toBlock', 'block'),
    { turn: 1, text: 'tut.s.upper', until: 'next', spot: [ROWS('u1', 'u2', 'u3', 'u4', 'u5', 'u6')], aim: '#view-block .p-row[data-row="u5"] .p-w' },
    { turn: 1, text: 'tut.s.bonus', until: 'next', spot: [ROWS('sumUpper', 'bonus')] },
    tab(1, 'tut.s.toDice', 'dice'),

    // Zug 2: Große Straße, früher aufhören ist erlaubt
    roll(2, 'tut.s.roll2', [2, 3, 3, 5, 5, 6]),
    hold(2, 'tut.s.hold2', [0, 1, 3, 5]),
    roll(2, 'tut.s.roll2b', [1, 4]),
    { turn: 2, text: 'tut.s.straight', pose: 'cheer', until: 'next', spot: [TRAY] },
    pick(2, 'tut.s.pick2', 'gstrasse', { spot: [opt('gstrasse'), opt('kstrasse')] }),
    enter(2, 'tut.s.enter2'),

    // Unterer Block: alle 9 Felder auf einen Blick
    { turn: 2, text: 'tut.s.lower', until: 'next', place: 'center', wide: true, extra: 'lower' },

    // Zug 3: Der Höhenflug klappt nicht, die Chance rettet
    roll(3, 'tut.s.roll3', [4, 5, 6, 6, 2, 1]),
    hold(3, 'tut.s.hold3', [0, 1, 2, 3]),
    roll(3, 'tut.s.roll3b', [3, 5]),
    hold(3, 'tut.s.hold3b', [0, 1, 2, 3, 5]),
    roll(3, 'tut.s.roll3c', [2]),
    { turn: 3, text: 'tut.s.miss', pose: 'shrug', until: 'next', spot: [TRAY] },
    { turn: 3, text: 'tut.s.zeros', until: 'zeros', spot: [D + '.zeros summary'], tap: [D + '.zeros summary'] },
    { turn: 3, text: 'tut.s.strike', until: 'next', spot: [D + '.zeros'], mark: [D + '.zeros .opt[data-key="hoch"]'] },
    pick(3, 'tut.s.pick3', 'chance'),
    enter(3, 'tut.s.enter3'),

    // Zug 4: Countdown frei, erst den Zug zu Ende spielen, dann der Countdown
    roll(4, 'tut.s.roll4', [4, 4, 4, 4, 2, 6]),
    { turn: 4, text: 'tut.s.unlocked', pose: 'wow', until: 'next', spot: [D + '.cd-strip'] },
    hold(4, 'tut.s.hold4', [0, 1, 2, 3]),
    roll(4, 'tut.s.roll4b', [4, 1]),
    pick(4, 'tut.s.pick4', 'pasch5', { pose: 'cheer', spot: [opt('pasch5'), opt('u4')] }),
    enter(4, 'tut.s.enter4'),
    { turn: 4, text: 'tut.s.cd', until: 'next', spot: ['#cd .hexes'], open: 'cd' },
    cdRoll('tut.s.cd1', [2, 5, 6, 1, 3, 4]),
    cdRoll('tut.s.cd2', [3, 1, 5, 2, 6]),
    cdRoll('tut.s.cd3', [1, 6, 2, 3]),
    { turn: 4, text: 'tut.s.cdEnd', pose: 'shrug', until: 'cdSave', spot: ['#cd .cd-res', CD_SAVE], tap: [CD_SAVE], place: 'above' },

    // Ende: Rundgang durch den Block, dann geht es weiter
    tab(5, 'tut.s.toBlock2', 'block'),
    { turn: 5, text: 'tut.s.sumUpper', until: 'next', spot: [ROWS('sumUpper', 'bonus')] },
    { turn: 5, text: 'tut.s.sumLower', until: 'next', spot: [ROWS('sumLower'), ROWS('cd')] },
    { turn: 5, text: 'tut.s.total', pose: 'cheer', until: 'next', spot: [ROWS('total')] },
    { turn: 5, text: 'tut.s.done', pose: 'cheer', until: 'end', place: 'center' },
  ];

  /* ---------- Schicht über der App ---------- */
  const M = 12;          // Abstand zum Bildschirmrand
  const PAD = 6;         // Luft um ein Ziel
  const PW = 84;                        // Breite von Pip in der Blase, in Pixeln
  const U = PW / VIEW[2];               // Pixel pro Einheit der Zeichnung
  const PH = Math.round(VIEW[3] * U);   // Höhe
  const OUT = 40;                       // so weit schaut Pip aus der Blase heraus
  const GAP = OUT + 8;                  // Abstand zwischen Ziel und Blase
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

  let A = null;          // Anbindung an js/app.js, siehe start()
  let el = null;         // Teile der Schicht in index.html (#tut)
  let cur = -1;          // aktueller Schritt, -1: aus
  let showing = false;   // Die Blase zeigt den aktuellen Schritt. Vorher (etwa während die Würfel rollen) geht nichts.
  let since = 0;
  let raf = 0;
  let side = null;       // Blase unter (below), über (above) dem Ziel oder in der Mitte (center)
  let heldAtStart = [];
  let marks = [];
  let offs = [];
  let pose = null;
  let lastD = '';
  let lastPos = '';
  let cdAsked = false;

  function build() {
    const r = document.getElementById('tut');
    el = {
      root: r,
      shade: r.querySelector('.tut-shade'),
      ring: r.querySelector('.tut-ring'),
      bub: r.querySelector('.tut-bub'),
      pip: r.querySelector('.tut-pip'),
      st: r.querySelector('.tut-st'),
      tx: r.querySelector('.tut-tx'),
      x: r.querySelector('.tut-x'),
      skip: r.querySelector('[data-tut="skip"]'),
      next: r.querySelector('[data-tut="next"]'),
    };
    r.addEventListener('click', e => {
      if (!A) return;
      const b = e.target.closest('[data-tut]');
      if (!b) { if (e.target === el.shade) nudge(); return; }
      const what = b.dataset.tut;
      const s = STEPS[cur];
      if (what === 'next') { if (showing && s && s.until === 'next') go(cur + 1); }
      else A.end(what);
    });
  }

  // adapter (aus js/app.js): tr, held(), busy(), queue(vals), openCd(), vars(), lower(), step(s), end(how), online(), reduced()
  function start(adapter) {
    A = adapter;
    if (!el) build();
    el.root.hidden = false;
    side = null;
    pose = null;
    lastPos = '';
    const W = window.innerWidth;
    const H = window.innerHeight;
    lastD = `M0 0H${W}V${H}H0Z`;
    el.shade.setAttribute('d', lastD);
    el.ring.setAttribute('d', '');
    go(0);
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function stop() {
    if (!el) return;
    cancelAnimationFrame(raf);
    raf = 0;
    cur = -1;
    showing = false;
    setMarks([], []);
    el.bub.classList.add('off');
    el.root.hidden = true;
    A = null;
  }

  function go(n) {
    cur = n;
    showing = false;
    side = null;
    since = now();
    cdAsked = false;
    setMarks([], []);
    el.bub.classList.add('off');
    const s = STEPS[n];
    if (!s) { A.end('menu'); return; }
    if (s.dice) A.queue(s.dice);
    heldAtStart = A.held();
    A.step(s);
  }

  function tick() {
    raf = requestAnimationFrame(tick);
    const s = STEPS[cur];
    if (!s || !A) return;
    if (!showing) {
      if (!ready(s)) return;
      show(s);
    }
    layout(s);
  }

  // Erst weiter, wenn nichts mehr rollt oder aufgeht und jedes Ziel zu sehen ist
  function ready(s) {
    if (A.busy() || now() - since < 140) return false;
    const ok = (s.spot || []).every(sel => !!box(sel));
    // Der Countdown geht nach dem Eintragen von selbst auf. Falls nicht, hilft das Tutorial nach.
    if (!ok && s.open === 'cd' && !cdAsked && now() - since > 700) { cdAsked = true; A.openCd(); }
    return ok;
  }

  function show(s) {
    showing = true;
    const v = A.vars();
    el.st.textContent = s.turn === 0 ? A.tr('tut.title') : s.turn <= TURNS ? A.tr('tut.step', { n: s.turn, total: TURNS }) : '';
    el.st.hidden = !el.st.textContent;
    el.tx.innerHTML = A.tr(s.text, v);
    el.x.innerHTML = s.extra === 'lower' ? A.lower() : s.until === 'end' ? endHTML() : '';
    el.x.hidden = !el.x.innerHTML;
    el.x.scrollTop = 0;
    el.next.hidden = s.until !== 'next';
    el.next.textContent = A.tr(s.go || 'tut.next');
    el.skip.hidden = s.until === 'end';
    el.bub.classList.toggle('wide', !!s.wide);
    const want = s.pose || (s.place === 'center' ? 'hello' : 'point');
    if (want !== pose) { pose = want; el.pip.innerHTML = pip(want); }
    el.bub.classList.remove('off');
    if (!A.reduced()) {
      el.bub.classList.remove('pop');
      void el.bub.offsetWidth;
      el.bub.classList.add('pop');
    }
    layout(s);
    reveal(s);
    focusStep(s);
  }

  function endHTML() {
    const btn = (what, cls, key) => `<button type="button" class="btn ${cls}" data-tut="${what}">${A.tr(key)}</button>`;
    return `<div class="tut-end">${btn('local', 'btn-pen', 'tut.endLocal')}${A.online() ? btn('online', 'btn-line', 'tut.endOnline') : ''}${btn('again', 'btn-line', 'tut.endAgain')}${btn('menu', 'btn-quiet', 'common.toMenu')}</div>`;
  }

  // Fokus aufs Ziel, bei „Weiter“ auf den Knopf. Den Text der Blase sagt der Screenreader an (aria-live).
  function focusStep(s) {
    let t = null;
    if (s.until === 'next') t = el.next;
    else if (s.until === 'end') t = el.x.querySelector('button');
    else {
      const sel = taps(s)[0];
      t = sel ? document.querySelector(sel) : null;
    }
    if (t) { try { t.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
  }

  function nudge() {
    if (!A || A.reduced()) return;
    el.bub.classList.remove('nudge');
    void el.bub.offsetWidth;
    el.bub.classList.add('nudge');
  }

  // Rechteck um alle sichtbaren Treffer, mit etwas Luft. null, wenn nichts zu sehen ist.
  function box(sel) {
    let l = Infinity;
    let t = Infinity;
    let r = -Infinity;
    let b = -Infinity;
    document.querySelectorAll(sel).forEach(e => {
      const q = e.getBoundingClientRect();
      if (!q.width || !q.height) return;
      l = Math.min(l, q.left);
      t = Math.min(t, q.top);
      r = Math.max(r, q.right);
      b = Math.max(b, q.bottom);
    });
    return l === Infinity ? null : { l: l - PAD, t: t - PAD, r: r + PAD, b: b + PAD };
  }
  const union = list => list.reduce((u, h) => (u ? { l: Math.min(u.l, h.l), t: Math.min(u.t, h.t), r: Math.max(u.r, h.r), b: Math.max(u.b, h.b) } : Object.assign({}, h)), null);
  // Überlappen sich zwei Löcher an einer Seite, werden sie eins, sonst würde die Überlappung wieder dunkel.
  // Schräg nebeneinander berühren sich nur die abgerundeten Ecken, das stört nicht.
  const touch = (a, b) => {
    const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
    const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    return w > 0 && h > 0 && Math.max(w, h) > 2 * PAD + 2;
  };
  function holesOf(s) {
    const out = [];
    (s.spot || []).map(box).filter(Boolean).forEach(h => {
      let m = h;
      for (let i = out.length - 1; i >= 0; i--) {
        if (touch(out[i], m)) { m = union([out[i], m]); out.splice(i, 1); }
      }
      out.push(m);
    });
    return out;
  }
  const f1 = n => Math.round(n * 10) / 10;
  function roundRect(h) {
    const r = f1(Math.min(14, (h.r - h.l) / 2, (h.b - h.t) / 2));
    const [l, t, rr, b] = [h.l, h.t, h.r, h.b].map(f1);
    return `M${f1(l + r)} ${t}H${f1(rr - r)}A${r} ${r} 0 0 1 ${rr} ${f1(t + r)}V${f1(b - r)}A${r} ${r} 0 0 1 ${f1(rr - r)} ${b}`
      + `H${f1(l + r)}A${r} ${r} 0 0 1 ${l} ${f1(b - r)}V${f1(t + r)}A${r} ${r} 0 0 1 ${f1(l + r)} ${t}Z`;
  }

  // Was man antippen darf. Beim Halten nur die Würfel, die neu liegen bleiben sollen.
  function taps(s) {
    if (s.hold) return s.hold.filter(i => !heldAtStart[i]).map(i => D + `.die[data-i="${i}"]`);
    return s.tap || [];
  }

  // Blinkender Rahmen ums Ziel. Beim Halten: die Würfel, die noch fehlen. Die anderen freien Würfel werden blasser.
  function wantedMarks(s) {
    const on = [];
    const off = [];
    if (s.hold) {
      const held = A.held();
      document.querySelectorAll(D + '.die').forEach(d => {
        const i = Number(d.dataset.i);
        if (held[i]) return;
        (s.hold.indexOf(i) >= 0 ? on : off).push(d);
      });
    }
    (s.mark || []).forEach(sel => document.querySelectorAll(sel).forEach(e => on.push(e)));
    return { on, off };
  }
  function setMarks(on, off) {
    marks.forEach(e => { if (on.indexOf(e) < 0) e.classList.remove('tut-mark'); });
    offs.forEach(e => { if (off.indexOf(e) < 0) e.classList.remove('tut-off'); });
    on.forEach(e => e.classList.add('tut-mark'));
    off.forEach(e => e.classList.add('tut-off'));
    marks = on;
    offs = off;
  }

  function layout(s) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const holes = holesOf(s);
    const hp = holes.map(roundRect).join('');
    const d = `M0 0H${W}V${H}H0Z${hp}`;
    if (d !== lastD) {
      el.shade.setAttribute('d', d);
      el.ring.setAttribute('d', hp);
      lastD = d;
    }
    const m = wantedMarks(s);
    setMarks(m.on, m.off);
    placeBubble(s, holes, W, H);
  }

  // Worauf Pip zeigt: aim, sonst das erste blinkende Ziel, sonst die Mitte des ersten Lochs
  function aimOf(s, holes) {
    const e = (s.aim && document.querySelector(s.aim)) || marks[0];
    const q = e ? e.getBoundingClientRect() : null;
    if (q && q.width) return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
    const h = holes[0];
    return h ? { x: (h.l + h.r) / 2, y: (h.t + h.b) / 2 } : null;
  }

  // Blase unter oder über das Ziel, je nachdem, wo Platz ist. Pip sitzt an der Kante zum Ziel und zeigt hin.
  function placeBubble(s, holes, W, H) {
    const b = el.bub;
    const all = union(holes);
    let sd;
    if (!all || s.place === 'center') sd = 'center';
    else {
      const bh0 = b.offsetHeight;
      const fits = { below: all.b + GAP + bh0 <= H - M, above: all.t - GAP - bh0 >= M };
      if (s.place && fits[s.place]) sd = s.place;
      else if ((side === 'below' || side === 'above') && fits[side]) sd = side;
      else if (fits.below) sd = 'below';
      else if (fits.above) sd = 'above';
      else sd = H - all.b >= all.t ? 'below' : 'above';
    }
    b.classList.toggle('pip-top', sd !== 'above');
    b.classList.toggle('pip-bottom', sd === 'above');
    side = sd;
    const bw = b.offsetWidth;
    const bh = b.offsetHeight;
    let x;
    let y;
    if (sd === 'center') {
      x = (W - bw) / 2;
      y = (H - bh + OUT) / 2;
    } else {
      x = (all.l + all.r) / 2 - bw / 2;
      y = sd === 'below' ? all.b + GAP : all.t - GAP - bh;
    }
    x = clamp(x, M, W - M - bw);
    y = clamp(y, M + (sd === 'above' ? 0 : OUT), H - M - bh - (sd === 'above' ? OUT : 0));

    // Pip steht neben dem Ziel, so weit seitlich wie hoch, damit der Arm schräg hinzeigt
    const aim = sd === 'center' ? null : aimOf(s, holes);
    const top = sd === 'above' ? y + bh + OUT - PH : y - OUT;
    const sy = top + (SHOULDER.r[1] - VIEW[1]) * U;   // Höhe der Schulter
    const sx = SHOULDER.r[0] * U;                      // Schulter ab der linken Kante (nach rechts gedreht ab der rechten)
    let px = 14;
    let flip = false;
    if (aim) {
      const dx = clamp(Math.abs(aim.y - sy) * 0.85, 30, 160);
      px = aim.x - dx - sx - x;
      if (px < 8) px = aim.x + dx - (PW - sx) - x;
      px = clamp(px, 8, bw - PW - 8);
      flip = aim.x < x + px + PW / 2;
    }
    const key = [x, y, px, flip].map(n => (typeof n === 'number' ? Math.round(n) : n)).join('|');
    if (key !== lastPos) {
      lastPos = key;
      b.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      el.pip.style.left = Math.round(px) + 'px';
      el.pip.classList.toggle('flip', flip);
    }
    if (aim) {
      const ax = x + px + (flip ? PW - sx : sx);
      aimPip(clamp(Math.atan2(aim.y - sy, Math.abs(aim.x - ax)) * 180 / Math.PI, -80, 80));
    } else aimPip(0);
  }

  // Arm aufs Ziel drehen, die Augen schauen mit
  function aimPip(a) {
    const r = Math.round(a);
    el.pip.querySelectorAll('.pp-aim').forEach(g => {
      const t = `rotate(${r} 50.5 41)`;
      if (g.getAttribute('transform') !== t) g.setAttribute('transform', t);
    });
    const eyes = el.pip.querySelector('.pp-eyes');
    if (eyes) {
      const rad = r * Math.PI / 180;
      const t = pose === 'point' ? `translate(${f1(Math.cos(rad) * 1.3)} ${f1(Math.sin(rad) * 1.3)})` : '';
      if ((eyes.getAttribute('transform') || '') !== t) eyes.setAttribute('transform', t);
    }
  }

  // Ziel und Blase sollen beide zu sehen sein. Sonst wird die Seite gescrollt. Ziele in Fenstern stehen fest.
  function reveal(s) {
    if (s.place === 'center') return;
    if ((s.spot || []).some(sel => /^(#sheet|#cd|\.tabbar)\b/.test(sel))) {
      // Fenster scrollen selbst: Auf kleinen Bildschirmen kommt der Knopf so ins Bild.
      const sel = taps(s)[0] || s.spot[s.spot.length - 1];
      const t = /^(#sheet|#cd)\b/.test(sel) ? document.querySelector(sel) : null;
      if (t) { try { t.scrollIntoView({ block: 'nearest', behavior: A.reduced() ? 'auto' : 'smooth' }); } catch (e) { /* egal */ } }
      return;
    }
    const all = union(holesOf(s));
    if (!all) return;
    const H = window.innerHeight;
    const bar = document.querySelector('.tabbar');
    const q = bar && !bar.hidden ? bar.getBoundingClientRect() : null;
    const bottom = q && q.height ? q.top : H;   // Unten liegt die Leiste mit den Tabs über der Seite.
    const bh = el.bub.offsetHeight;
    const inView = all.t >= M && all.b <= bottom - M;
    if (inView && (all.b + GAP + bh <= H - M || all.t - GAP - bh >= M)) return;
    const lo = M + OUT;
    const hi = bottom - M;
    const tall = all.b - all.t;
    const dy = tall + GAP + bh <= hi - lo ? all.t - (lo + (hi - lo - tall - GAP - bh) / 2) : all.t - lo;
    try { window.scrollBy({ top: dy, behavior: A.reduced() ? 'auto' : 'smooth' }); } catch (e) { window.scrollBy(0, dy); }
  }

  /* ---------- Was js/app.js meldet ---------- */
  const sameHeld = (held, list) => held.every((h, i) => h === (list.indexOf(i) >= 0));

  // type: rolled, held, quick (key), entered, tab (tab), zeros, cdRolled, cdSaved
  function event(type, data) {
    const s = STEPS[cur];
    if (!A || !s || !showing) return;
    let ok = false;
    switch (s.until) {
      case 'roll': ok = type === 'rolled'; break;
      case 'hold': ok = type === 'held' && sameHeld(A.held(), s.hold); break;
      case 'pick': ok = type === 'quick' && data === s.key; break;
      case 'enter': ok = type === 'entered'; break;
      case 'tab': ok = type === 'tab' && data === s.tab; break;
      case 'zeros': ok = type === 'zeros'; break;
      case 'cdRoll': ok = type === 'cdRolled'; break;
      case 'cdSave': ok = type === 'cdSaved'; break;
      default: break;
    }
    if (ok) go(cur + 1);
  }

  // Darf dieser Klick (oder diese Taste) durch? Nur aufs Gezeigte und auf die Blase selbst.
  function allows(target) {
    if (cur < 0) return true;
    if (!target || !target.closest) return false;
    if (target.closest('#tut')) return true;
    const s = STEPS[cur];
    return !!s && showing && taps(s).some(sel => !!target.closest(sel));
  }

  const api = {
    STEPS,
    TURNS,
    POSES,
    pip,
    start,
    stop,
    event,
    allows,
    active: () => cur >= 0,
    index: () => cur,
    turn: () => (STEPS[cur] ? STEPS[cur].turn : 0),
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HexaTutorial = api;
})(typeof self !== 'undefined' ? self : this);
