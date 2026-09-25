/* HEXA – App: Startbildschirm, Spieler, Würfel, Spielblock, Countdown, Highscores.
   Braucht js/rules.js (window.HexaRules) und js/sound.js (window.HexaSound). */
(() => {
  'use strict';

  const { UPPER, LOWER, FIELDS, F, NF, BONUS_MIN, BONUS_PTS, sum, countFaces, scoreFor } = window.HexaRules;
  const Sound = window.HexaSound;

  /* ---------- Einstellungen ---------- */
  const KEY = 'hexa-spiel-v1';
  const TABS = ['dice', 'block', 'rules'];
  const PAIR = ['dice', 'block'];
  const WIDE = '(min-width: 1100px)';
  const PIPS = { 0: [], 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  // Icons teils aus Lucide (ISC-Lizenz, teils Feather/MIT), siehe THIRD-PARTY-NOTICES.md.
  function svg(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  const ICON = {
    reset: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
    up: svg('<path d="M12 19V5"/><path d="m5.5 11.5 6.5-6.5 6.5 6.5"/>'),
    down: svg('<path d="M12 5v14"/><path d="m18.5 12.5-6.5 6.5-6.5-6.5"/>'),
    x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    chev: svg('<path d="m9 6 6 6-6 6"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
    moon: svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
    auto: svg('<circle cx="12" cy="12" r="10"/><path d="M12 18a6 6 0 0 0 0-12v12z"/>'),
    music: svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
    volume: svg('<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>'),
    dices: svg('<rect width="12" height="12" x="2" y="10" rx="2" ry="2"/><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"/><path d="M6 18h.01"/><path d="M10 14h.01"/><path d="M15 6h.01"/><path d="M18 9h.01"/>'),
    language: svg('<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>'),
    back: svg('<path d="m15 18-6-6 6-6"/>'),
    phone: svg('<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>'),
    pause: svg('<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>'),
    trophy: svg('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'),
    globe: svg('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'),
  };

  /* ---------- Helfer ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const odds = k => Math.round((1 - Math.pow(5 / 6, k)) * 100);
  const nameList = a => (a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1]);
  const fmtDate = t => {
    try { return new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
    catch (e) { return ''; }
  };
  function vibrate(p) {
    try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* nicht verfügbar */ }
  }

  // Fairer Würfelwurf: Werte ab 252 werden verworfen, damit jede Zahl gleich oft kommt.
  function d6() {
    try {
      const a = new Uint8Array(1);
      do { crypto.getRandomValues(a); } while (a[0] >= 252);
      return (a[0] % 6) + 1;
    } catch (e) {
      return 1 + Math.floor(Math.random() * 6);
    }
  }

  /* ---------- Zustand (localStorage) ---------- */
  const freshDice = () => ({ vals: null, held: [false, false, false, false, false, false], rolls: 0, owner: null, ownerFilled: 0, cd: null });
  // started: Das Spiel läuft (sonst sieht man die Spieler-Auswahl). via: App-Würfel ('app') oder eigene Würfel ('own').
  const freshState = () => ({ v: 1, tab: 'dice', duo: false, started: false, via: 'app', players: [], scores: {}, cds: {}, dice: freshDice(), cdGame: null, gameId: uid(), history: {}, skipHist: null });

  function normalize(raw) {
    const s = freshState();
    if (!isObj(raw)) return s;
    if (TABS.includes(raw.tab)) s.tab = raw.tab;
    if (typeof raw.duo === 'boolean') s.duo = raw.duo;
    if (Array.isArray(raw.players)) {
      s.players = raw.players
        .filter(p => isObj(p) && typeof p.id === 'string')
        .map(p => ({ id: p.id, name: String(p.name || 'Spieler').slice(0, 20) }));
    }
    // Ältere Spielstände kennen „started“ noch nicht: Wer Spieler hat, war mitten im Spiel.
    s.started = s.players.length > 0 && (typeof raw.started === 'boolean' ? raw.started : true);
    if (raw.via === 'own') s.via = 'own';
    if (isObj(raw.scores)) s.scores = raw.scores;
    if (isObj(raw.cds)) s.cds = raw.cds;
    if (isObj(raw.history)) s.history = raw.history;
    if (typeof raw.gameId === 'string') s.gameId = raw.gameId;
    if (typeof raw.skipHist === 'string') s.skipHist = raw.skipHist;
    if (isObj(raw.dice)) {
      const d = Object.assign(freshDice(), raw.dice);
      const ok = Array.isArray(d.vals) && d.vals.length === 6 && d.vals.every(v => Number.isInteger(v) && v >= 1 && v <= 6);
      d.rolls = Math.max(0, Math.min(3, d.rolls | 0));
      if (!ok || !d.rolls) { d.vals = null; d.rolls = 0; }
      d.held = Array.isArray(d.held) && d.held.length === 6 ? d.held.map(Boolean) : [false, false, false, false, false, false];
      d.owner = typeof d.owner === 'string' ? d.owner : null;
      d.ownerFilled = d.ownerFilled | 0;
      d.cd = isObj(d.cd) ? { owner: typeof d.cd.owner === 'string' ? d.cd.owner : null, played: !!d.cd.played } : null;
      s.dice = d;
    }
    const g = raw.cdGame;
    if (isObj(g) && ['play', 'over', 'perfect'].includes(g.status)) {
      s.cdGame = {
        owner: typeof g.owner === 'string' ? g.owner : null,
        stage: Math.max(0, Math.min(6, g.stage | 0)),
        pts: g.pts | 0,
        last: Array.isArray(g.last) ? g.last : null,
        hit: typeof g.hit === 'number' ? g.hit : -1,
        status: g.status,
        got: Array.isArray(g.got) ? g.got : [],
      };
    }
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? normalize(JSON.parse(raw)) : freshState();
    } catch (e) {
      return freshState();
    }
  }
  function save() {
    syncHistory();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* Speicher voll oder gesperrt */ }
  }

  let state = load();
  let atStart = true;   // Beim Öffnen kommt zuerst der Startbildschirm.

  /* ---------- Spiel-Logik ---------- */
  const playerById = id => state.players.find(p => p.id === id) || null;
  const scoreOf = (pid, key) => {
    const s = state.scores[pid];
    const v = isObj(s) ? s[key] : undefined;
    return typeof v === 'number' ? v : null;
  };
  const filled = pid => FIELDS.reduce((n, f) => n + (scoreOf(pid, f.key) === null ? 0 : 1), 0);
  const cdList = pid => (Array.isArray(state.cds[pid]) ? state.cds[pid].filter(x => typeof x === 'number') : []);

  function setScore(pid, key, v) {
    if (!isObj(state.scores[pid])) state.scores[pid] = {};
    state.scores[pid][key] = v;
  }
  function clearScore(pid, key) {
    if (isObj(state.scores[pid])) delete state.scores[pid][key];
  }

  function totals(pid) {
    let upper = 0;
    let lower = 0;
    let upperCount = 0;
    UPPER.forEach(f => { const v = scoreOf(pid, f.key); if (v !== null) { upper += v; upperCount++; } });
    LOWER.forEach(f => { const v = scoreOf(pid, f.key); if (v !== null) lower += v; });
    const bonus = upper >= BONUS_MIN ? BONUS_PTS : 0;
    const list = cdList(pid);
    const cd = sum(list);
    return { upper, lower, bonus, cd, list, upperCount, total: upper + bonus + lower + cd };
  }
  function currentPlayer() {
    let best = null;
    let min = Infinity;
    state.players.forEach(p => { const n = filled(p.id); if (n < min) { min = n; best = p; } });
    return min < NF ? best : null;
  }
  const roundNo = () => (state.players.length ? Math.min(NF, Math.min.apply(null, state.players.map(p => filled(p.id))) + 1) : 0);
  const isOver = () => state.players.length > 0 && state.players.every(p => filled(p.id) >= NF);
  const anyScores = () => state.players.some(p => filled(p.id) > 0 || cdList(p.id).length > 0);

  function turnDone() {
    const d = state.dice;
    if (!d.rolls || !d.owner) return false;
    const p = playerById(d.owner);
    return !!p && filled(p.id) > d.ownerFilled;
  }
  const cdPending = () => !!(state.dice.cd && !state.dice.cd.played);
  // Alle Felder voll und kein Countdown mehr offen: Jetzt kann das Spiel beendet werden.
  const gameDone = () => isOver() && !cdPending();
  // Ist im Spiel schon etwas passiert? Sonst geht nichts verloren, wenn man es verlässt.
  const gameTouched = () => anyScores() || state.dice.rolls > 0 || !!state.cdGame;
  const viaTab = () => (state.via === 'own' ? 'block' : 'dice');

  // Ein Wurf gehört immer zu jemandem, der gerade mitspielt. Ein Wurf aus dem
  // freien Würfeln oder von einer entfernten Person wird verworfen, damit das
  // nächste Spiel mit frischen Würfeln beginnt.
  function dropStrayRoll() {
    const d = state.dice;
    if (!d.rolls && !d.cd && !state.cdGame) return false;
    const stray = state.players.length ? !(d.owner && playerById(d.owner)) : !!d.owner;
    if (!stray) return false;
    state.dice = freshDice();
    state.cdGame = null;
    return true;
  }

  function syncHistory() {
    if (state.skipHist === state.gameId) return;
    if (isOver()) {
      const prev = state.history[state.gameId];
      state.history[state.gameId] = {
        t: isObj(prev) && prev.t ? prev.t : Date.now(),
        r: state.players.map(p => ({ n: p.name, s: totals(p.id).total })),
      };
    } else if (state.history[state.gameId]) {
      delete state.history[state.gameId];
    }
  }
  function records() {
    const out = [];
    Object.keys(state.history).forEach(k => {
      const g = state.history[k];
      if (isObj(g) && Array.isArray(g.r)) {
        g.r.forEach(r => { if (isObj(r) && typeof r.s === 'number') out.push({ n: String(r.n || ''), s: r.s, t: g.t || 0, g: k }); });
      }
    });
    return out.sort((a, b) => b.s - a.s || a.t - b.t).slice(0, 10);
  }

  /* ---------- Darstellung ---------- */
  function faceHTML(v) {
    const on = PIPS[v] || [];
    let h = '<span class="face">';
    for (let k = 0; k < 9; k++) h += on.indexOf(k) >= 0 ? '<i class="on"></i>' : '<i></i>';
    return h + '</span>';
  }
  function setFace(el, v) {
    const on = PIPS[v] || [];
    $$('.face i', el).forEach((pip, k) => pip.classList.toggle('on', on.indexOf(k) >= 0));
  }
  const miniDie = v => '<span class="mdie">' + faceHTML(v) + '</span>';

  // Würfel und Block nebeneinander: nur, wenn der Bildschirm breit genug ist
  // und die Ansicht eingeschaltet wurde.
  const wideMQ = window.matchMedia ? window.matchMedia(WIDE) : null;
  const canDuo = () => !!(wideMQ && wideMQ.matches);
  const duoOn = () => canDuo() && !!state.duo && state.started && PAIR.indexOf(state.tab) >= 0;
  let shownDuo = false;

  // Startbildschirm, Spieler-Auswahl oder laufendes Spiel mit Leiste unten
  function syncFrame() {
    $('#start').hidden = !atStart;
    $('.app').hidden = atStart;
    $('.tabbar').hidden = atStart || !state.started;
  }

  function render() {
    const setup = !state.started;
    const duo = duoOn();
    shownDuo = duo;
    syncFrame();
    $('.app').classList.toggle('duo', duo);
    const shown = name => (setup ? name === 'players' : name === state.tab || (duo && PAIR.indexOf(name) >= 0));
    $$('.view').forEach(v => { v.hidden = !shown(v.dataset.view); });
    $$('.tab').forEach(t => {
      const on = shown(t.dataset.tab);
      t.classList.toggle('on', on);
      if (on) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
    renderTop();
    if (setup) renderPlayers();
    if (shown('dice')) renderDice();
    if (shown('block')) renderBlock();
  }

  function renderTop() {
    const el = $('#topStatus');
    // Drei Längen, je nach Platz in der Kopfzeile
    const fit = (l, m, s) => `<span class="st-l">${l}</span><span class="st-m">${m}</span><span class="st-s">${s}</span>`;
    const r = roundNo();
    if (!state.players.length || !state.started) el.innerHTML = '';
    else if (isOver()) el.innerHTML = fit('Spiel beendet', 'Beendet', 'Ende');
    else el.innerHTML = fit('Runde ' + r + ' von ' + NF, 'Runde ' + r + '/' + NF, r + '/' + NF);
    $('#cdBadge').hidden = !cdPending();
    // Breite Bildschirme: Im aktiven Tab (Würfel oder Block) holt ein Knopf die andere Ansicht dazu.
    const wide = canDuo();
    const duo = duoOn();
    $$('.tab-split').forEach(b => {
      const show = wide && b.dataset.for === state.tab;
      b.hidden = !show;
      if (!show) return;
      const label = duo ? 'Nebeneinander schließen' : (b.dataset.for === 'dice' ? 'Block' : 'Würfel') + ' daneben öffnen';
      b.setAttribute('aria-pressed', duo ? 'true' : 'false');
      b.setAttribute('aria-label', label);
      b.title = label;
    });
  }

  // Spieler-Auswahl vor dem Spiel: Namen, Reihenfolge und womit gewürfelt wird
  function renderPlayers() {
    const root = $('#view-players');
    const P = state.players;
    const rows = P.map((p, i) => `
      <li class="prow">
        <span class="pnum">${i + 1}</span>
        <input class="pname" type="text" value="${esc(p.name)}" data-pid="${p.id}" maxlength="20" autocomplete="off" spellcheck="false" enterkeyhint="done" aria-label="Name von Person ${i + 1}">
        <span class="pacts">
          <button type="button" class="ibtn" data-act="up" data-pid="${p.id}" aria-label="${esc(p.name)} nach oben"${i === 0 ? ' disabled' : ''}>${ICON.up}</button>
          <button type="button" class="ibtn" data-act="down" data-pid="${p.id}" aria-label="${esc(p.name)} nach unten"${i === P.length - 1 ? ' disabled' : ''}>${ICON.down}</button>
          <button type="button" class="ibtn ibtn-x" data-act="remove" data-pid="${p.id}" aria-label="${esc(p.name)} entfernen">${ICON.x}</button>
        </span>
      </li>`).join('');

    const listHTML = P.length
      ? `<ol class="plist">${rows}</ol>`
      : `<div class="empty-box">
           <p><b>So spielst du mit der App</b></p>
           <ol>
             <li>Trag oben alle Namen ein.</li>
             <li>Wähle, ob ihr mit der App oder mit euren eigenen Würfeln spielt.</li>
             <li>Die App führt den Spielblock und rechnet alles aus.</li>
           </ol>
         </div>`;

    const off = P.length ? '' : ' disabled';
    root.innerHTML = `
      <button type="button" class="back" data-act="home">${ICON.back}<span>Hauptmenü</span></button>
      <h1 class="h-view" tabindex="-1">Wer spielt mit?</h1>
      <p class="lead">Die jüngste Person beginnt. Mit den Pfeilen änderst du die Reihenfolge.</p>
      <div class="add">
        <input id="newName" class="input" type="text" maxlength="20" placeholder="Name" autocomplete="off" spellcheck="false" enterkeyhint="done" aria-label="Name der neuen Person">
        <button type="button" class="btn btn-pen" data-act="add">Hinzufügen</button>
      </div>
      ${listHTML}
      <section class="via" aria-labelledby="via-h">
        <h2 class="h-sec" id="via-h">Womit würfelt ihr?</h2>
        <p class="via-note" id="via-note">${P.length ? 'Den Würfel-Tab habt ihr in beiden Fällen dabei.' : 'Trag zuerst mindestens eine Person ein.'}</p>
        <div class="choices">
          <button type="button" class="choice" data-act="start-game" data-via="app" aria-describedby="via-note"${off}>
            <span class="choice-ic">${ICON.phone}</span>
            <span class="choice-tx"><span class="choice-t">Mit der App</span><span class="choice-s">Die App würfelt für euch</span></span>
            ${ICON.chev}
          </button>
          <button type="button" class="choice" data-act="start-game" data-via="own" aria-describedby="via-note"${off}>
            <span class="choice-ic">${ICON.dices}</span>
            <span class="choice-tx"><span class="choice-t">Mit eigenen Würfeln</span><span class="choice-s">Ihr würfelt selbst, die App führt den Block</span></span>
            ${ICON.chev}
          </button>
        </div>
      </section>`;
  }

  function rollState() {
    const d = state.dice;
    if (turnDone()) {
      const cp = currentPlayer();
      return { label: 'Würfeln', sub: cp ? 'Nächster Zug: ' + cp.name : 'Neuer Zug', off: false };
    }
    if (!d.vals || !d.rolls) return { label: 'Würfeln', sub: 'Mit allen 6 Würfeln', off: false };
    if (d.rolls >= 3) {
      return { label: 'Keine Würfe mehr', sub: d.owner && playerById(d.owner) ? 'Trag dein Ergebnis ein' : 'Setz die Würfel zurück', off: true };
    }
    const free = d.held.filter(h => !h).length;
    if (!free) return { label: 'Alle Würfel liegen', sub: 'Tippe einen an, um ihn zu lösen', off: true };
    return { label: 'Nochmal würfeln', sub: free + ' Würfel' + (d.rolls === 2 ? ', letzter Wurf' : ''), off: false };
  }

  function renderDice() {
    const root = $('#view-dice');
    const d = state.dice;
    const done = turnDone();
    const owner = d.owner ? playerById(d.owner) : null;
    const cur = currentPlayer();
    const hasP = state.players.length > 0;
    const idle = !d.vals || !d.rolls;
    const vals = idle ? [1, 2, 3, 4, 5, 6] : d.vals;
    const canHold = !idle && d.rolls < 3 && !done;

    let who = '';
    let sub = '';
    if (!hasP) who = 'Freies Würfeln';
    else if (!cur) who = 'Spiel beendet';
    else if (done) { who = cur.name + ' ist dran'; sub = 'Eingetragen für ' + (owner ? owner.name : '') + '.'; }
    else if (!idle && owner) who = owner.name + ' ist dran';
    else who = cur.name + ' ist dran';

    // Im Nebeneinander steht der Kasten zum Spielende nur über dem Block.
    const endHTML = gameDone() && !duoOn() ? endCard('Im Block könnt ihr vorher alles noch einmal prüfen.') : '';
    if (!cur && !endHTML) sub = 'Alle Runden sind gespielt.';
    let subHTML = sub ? `<div class="who-sub">${esc(sub)}</div>` : '';
    if (!hasP) subHTML = '<div class="who-sub">Ohne Spieler wird nichts eingetragen.</div>';

    const fresh = idle || done;
    const meter = `<div class="meter"><span class="meter-l">${fresh ? '3 Würfe' : 'Wurf ' + d.rolls + ' von 3'}</span><span class="meter-b" aria-hidden="true">${[0, 1, 2].map(i => `<i${!fresh && i < d.rolls ? ' class="on"' : ''}></i>`).join('')}</span></div>`;

    const dice = vals.map((v, i) => {
      const held = !idle && !done && d.held[i];
      const cls = 'die' + (idle ? ' idle' : '') + (done ? ' dim' : '') + (held ? ' held' : '');
      const label = idle ? 'Würfel ' + (i + 1) : 'Würfel ' + (i + 1) + ': ' + v + (held ? ', bleibt liegen' : '');
      return `<button type="button" class="${cls}" data-act="hold" data-i="${i}" style="--k:${i}" aria-label="${label}" aria-pressed="${held ? 'true' : 'false'}" aria-keyshortcuts="${i + 1}"${canHold ? '' : ' disabled'}>${faceHTML(v)}</button>`;
    }).join('');

    let hint;
    if (idle) hint = 'Tippe auf Würfeln.';
    else if (done) hint = 'Der Zug ist eingetragen.';
    else if (d.rolls >= 3) hint = 'Alle drei Würfe gemacht.';
    else hint = 'Tippe an, was liegen bleibt.';

    const rs = rollState();

    let cdHTML = '';
    if (cdPending()) {
      const g = state.cdGame;
      const cdOwner = d.cd.owner ? playerById(d.cd.owner) : null;
      let title;
      let text;
      let btn;
      if (g && g.status === 'play') {
        title = 'Countdown läuft';
        text = 'Stufe ' + (g.stage + 1) + ' von 6, bisher ' + g.pts + ' Punkte.';
        btn = 'Weiterspielen';
      } else if (g) {
        title = 'Countdown beendet';
        text = g.pts ? g.pts + ' Punkte warten aufs Eintragen.' : 'Keine Stufe geschafft.';
        btn = g.pts ? 'Eintragen' : 'Abschließen';
      } else {
        title = 'Countdown freigeschaltet';
        text = cdOwner && !done
          ? 'Mindestens 4 gleiche im ersten Wurf. Trag erst deinen Zug ein, dann geht es los.'
          : 'Mindestens 4 gleiche im ersten Wurf. Jetzt kannst du den Countdown spielen.';
        btn = 'Countdown spielen';
      }
      cdHTML = `<div class="cd-strip"><div class="tx"><strong>${title}</strong><p>${text}</p></div><button type="button" class="btn btn-ink" data-act="cd-open">${btn}</button></div>`;
    }

    let entryHTML = '';
    if (owner && !idle && !done) {
      const opts = FIELDS.filter(f => scoreOf(owner.id, f.key) === null).map(f => ({ f, p: scoreFor(f.key, d.vals) }));
      const good = opts.filter(o => o.p > 0);
      const zero = opts.filter(o => o.p === 0);
      const btn = o => `<button type="button" class="opt${o.f.type === 'fixed' && o.p > 0 ? ' hit' : ''}" data-act="quick" data-key="${o.f.key}"><span>${o.f.name}</span><b>${o.p}</b></button>`;
      entryHTML = `<section class="entry" aria-label="Ergebnis eintragen">
          <h2>Eintragen für ${esc(owner.name)}</h2>
          ${good.length ? `<div class="opts">${good.map(btn).join('')}</div>` : '<p class="muted">Kein freies Feld bringt Punkte. Streich eins mit 0.</p>'}
          ${zero.length ? `<details class="zeros"${good.length ? '' : ' open'}><summary>${ICON.chev}Mit 0 Punkten streichen (${zero.length})</summary><div class="opts">${zero.map(btn).join('')}</div></details>` : ''}
        </section>`;
    }

    root.innerHTML = `${endHTML}
      <div class="turnbar"><div class="turn-who"><div class="who">${esc(who)}</div>${subHTML}</div>${meter}</div>
      <div class="tray">
        <div class="dice">${dice}</div>
        <div class="tray-foot"><span>${idle ? '' : 'Augensumme <b>' + sum(d.vals) + '</b>'}</span><span class="hint">${hint}</span></div>
      </div>
      <div class="controls">
        <button type="button" class="btn btn-pen btn-roll" data-act="roll" aria-keyshortcuts="Space"${rs.off ? ' disabled' : ''}><span class="rl">${esc(rs.label)}</span><small>${esc(rs.sub)}</small></button>
        <button type="button" class="btn btn-line btn-reset" data-act="reset" aria-label="Würfel zurücksetzen"${idle ? ' disabled' : ''}>${ICON.reset}<span>Zurücksetzen</span></button>
      </div>
      <p class="keys">Tastatur: <kbd>Leertaste</kbd> würfelt, <kbd>1</kbd> bis <kbd>6</kbd> hält oder löst einen Würfel, <kbd>M</kbd> schaltet alle Töne an oder aus.</p>
      ${cdHTML}
      ${entryHTML}`;
  }

  function patchRoll() {
    const b = $('#view-dice [data-act="roll"]');
    if (!b) return;
    const rs = rollState();
    $('.rl', b).textContent = rs.label;
    $('small', b).textContent = rs.sub;
    b.disabled = rs.off;
  }

  // Kasten über Würfeln und Block, sobald alle Runden gespielt sind
  function endCard(note) {
    return `<section class="end" aria-label="Spielende">
        <h2>Alle Runden gespielt</h2>
        <p>${esc(note)}</p>
        <button type="button" class="btn btn-pen" data-act="end-game">${ICON.trophy}<span>Spiel beenden</span></button>
      </section>`;
  }

  let padScroll = 0;
  function renderBlock() {
    const root = $('#view-block');
    const P = state.players;
    if (!P.length) {
      root.innerHTML = `
        <div class="empty-box">
          <p><b>Noch keine Spieler</b></p>
          <p>Starte im Hauptmenü ein neues Spiel und trag ein, wer mitspielt.</p>
          <button type="button" class="btn btn-pen" data-act="menu">Zum Hauptmenü</button>
        </div>`;
      return;
    }
    const cur = currentPlayer();
    const T = {};
    P.forEach(p => { T[p.id] = totals(p.id); });
    const best = Math.max.apply(null, P.map(p => T[p.id].total));
    const started = anyScores();
    const turn = p => (cur && cur.id === p.id ? ' is-turn' : '');

    const lab = (name, sub, icon) => `<div class="p-lab">${icon || ''}<span class="p-lt"><span class="p-nm">${name}</span>${sub ? `<span class="p-rq">${sub}</span>` : ''}</span></div>`;
    const cell = (p, f) => {
      const v = scoreOf(p.id, f.key);
      const cls = 'p-cell' + turn(p) + (v === null ? ' empty' : v === 0 ? ' zero' : '');
      const inner = v === null ? '<span class="p-dot"></span>' : `<span class="p-w">${v}</span>`;
      const label = esc(p.name) + ', ' + f.name + ': ' + (v === null ? 'leer' : v + ' Punkte');
      return `<button type="button" class="${cls}" data-act="cell" data-pid="${p.id}" data-key="${f.key}" aria-label="${label}">${inner}</button>`;
    };
    const val = (p, html, extra) => `<div class="p-val${turn(p)}${extra ? ' ' + extra : ''}">${html}</div>`;

    let rows = '<div class="p-sec"><span>Oberer Block</span></div>';
    UPPER.forEach(f => { rows += `<div class="p-row">${lab(f.name, '', miniDie(f.n))}${P.map(p => cell(p, f)).join('')}</div>`; });
    rows += `<div class="p-row sum">${lab('Summe oben')}${P.map(p => val(p, T[p.id].upper)).join('')}</div>`;
    rows += `<div class="p-row sum">${lab('Bonus', 'ab 70 oben')}${P.map(p => {
      const t = T[p.id];
      if (t.bonus) return val(p, '<span class="mk">+' + BONUS_PTS + '</span>');
      if (t.upperCount < UPPER.length) return val(p, '<span class="p-note">noch ' + (BONUS_MIN - t.upper) + '</span>');
      return val(p, '0', 'muted');
    }).join('')}</div>`;
    rows += '<div class="p-sec"><span>Unterer Block</span></div>';
    LOWER.forEach(f => { rows += `<div class="p-row">${lab(f.name, f.req)}${P.map(p => cell(p, f)).join('')}</div>`; });
    rows += `<div class="p-row sum">${lab('Summe unten')}${P.map(p => val(p, T[p.id].lower)).join('')}</div>`;
    rows += `<div class="p-row">${lab('Countdown', '10 pro Stufe')}${P.map(p => {
      const t = T[p.id];
      const has = t.list.length > 0;
      return `<button type="button" class="p-cell${turn(p)}${has ? '' : ' empty'}" data-act="cd-cell" data-pid="${p.id}" aria-label="${esc(p.name)}, Countdown: ${t.cd} Punkte">${has ? `<span class="p-w">${t.cd}</span>` : '<span class="p-dot"></span>'}</button>`;
    }).join('')}</div>`;
    rows += `<div class="p-row total">${lab('Endstand')}${P.map(p => val(p, T[p.id].total, started && best > 0 && T[p.id].total === best ? 'is-lead' : '')).join('')}</div>`;

    const endHTML = gameDone() ? endCard('Prüft den Block noch einmal. Danach seht ihr das Ergebnis.') : '';

    root.innerHTML = `${endHTML}
      <div class="pad" style="--n:${P.length};--pcols:repeat(${P.length}, minmax(var(--cw), 1fr))">
        <div class="pad-top" aria-hidden="true"></div>
        <div class="pad-head">
          <div class="pad-corner"></div>
          <div class="pad-vp"><div class="pad-names">${P.map(p => `<button type="button" class="pad-name${turn(p)}" data-act="player" data-pid="${p.id}" title="${esc(p.name)}" aria-label="${esc(p.name)} umbenennen oder entfernen">${esc(p.name)}</button>`).join('')}</div></div>
        </div>
        <div class="p-body"><div class="p-grid">${rows}</div></div>
      </div>
      <p class="pad-hint">Tippe auf ein Feld, um Punkte einzutragen oder zu ändern. Über einen Namen kannst du die Person umbenennen oder entfernen.</p>`;

    const body = $('.p-body', root);
    const track = $('.pad-names', root);
    const sync = () => {
      padScroll = body.scrollLeft;
      track.style.transform = 'translateX(' + (-body.scrollLeft) + 'px)';
    };
    body.addEventListener('scroll', sync, { passive: true });
    body.scrollLeft = padScroll;
    sync();
  }

  let cdPick = null;
  function renderCountdown() {
    const g = state.cdGame;
    const box = $('#cd .cd-in');
    if (!g) { hideCountdown(); return; }
    const owner = g.owner ? playerById(g.owner) : null;
    const target = Math.max(1, 6 - g.stage);
    const hexes = [6, 5, 4, 3, 2, 1].map((n, i) => {
      let c = 'hx';
      let st = 'offen';
      if (i < g.stage) { c += ' done'; st = 'geschafft'; }
      else if (i === g.stage && g.status === 'over') { c += ' fail'; st = 'verpasst'; }
      else if (i === g.stage && g.status === 'play') { c += ' now'; st = 'jetzt'; }
      return `<div class="${c}" role="listitem" aria-label="Stufe ${i + 1}, eine ${n}: ${st}"><span aria-hidden="true">${n}</span></div>`;
    }).join('');

    const wuerfel = k => k + (k === 1 ? ' Würfel' : ' Würfeln');
    let msg;
    if (g.status === 'play') {
      const lead = g.last && g.hit >= 0 ? '<strong>Treffer! 10 Punkte dazu.</strong>' : `<strong>Stufe ${g.stage + 1}: Du brauchst eine ${target}.</strong>`;
      const more = g.last && g.hit >= 0
        ? `Stufe ${g.stage + 1}: Du brauchst eine ${target}. Du würfelst mit ${wuerfel(target)}, Trefferchance ${odds(target)} %.`
        : `Du würfelst mit ${wuerfel(target)}, Trefferchance ${odds(target)} %.`;
      msg = lead + '<span>' + more + '</span>';
    } else if (g.status === 'over') {
      msg = `<strong>Keine ${6 - g.stage} dabei.</strong><span>Der Countdown ist vorbei.</span>`;
    } else {
      msg = '<strong>Alle sechs Stufen geschafft!</strong><span>Das gelingt nur in etwa 0,4 % der Countdowns.</span>';
    }

    const shown = g.last ? g.last.length : target;
    const per = shown >= 5 || shown === 3 ? 3 : shown === 1 ? 1 : 2;
    const dice = g.last
      ? g.last.map((v, i) => `<div class="die ${i === g.hit ? 'hit' : 'miss'}" style="--k:${i}">${faceHTML(v)}</div>`).join('')
      : Array.from({ length: target }, (_, i) => `<div class="die blank" style="--k:${i}">${faceHTML(0)}</div>`).join('');

    let foot;
    if (g.status === 'play') {
      foot = `<button type="button" class="btn btn-marker btn-roll" data-act="cd-roll"><span class="rl">Würfeln</span><small>${target} Würfel, gesucht: eine ${target}</small></button>`;
    } else {
      const P = state.players;
      foot = `<div class="cd-res"><div class="cd-big">${g.pts}</div><p>${g.pts ? 'Punkte im Countdown' : 'Keine Stufe geschafft.'}</p></div>`;
      if (g.pts > 0 && P.length) {
        foot += `<p class="cd-for">Eintragen für</p>
          <div class="picks" role="radiogroup" aria-label="Eintragen für">${P.map(p => `<button type="button" class="pick${cdPick === p.id ? ' sel' : ''}" role="radio" aria-checked="${cdPick === p.id ? 'true' : 'false'}" data-act="cd-pick" data-pid="${p.id}">${esc(p.name)}</button>`).join('')}</div>
          <button type="button" class="btn btn-marker" data-act="cd-save"${cdPick ? '' : ' disabled'}>Eintragen</button>
          <button type="button" class="btn btn-quiet-light" data-act="cd-discard">Nicht eintragen</button>`;
      } else {
        foot += '<button type="button" class="btn btn-marker" data-act="cd-discard">Fertig</button>';
      }
    }

    box.innerHTML = `
      <div class="cd-head"><h2 class="cd-title">Countdown</h2><button type="button" class="cd-x" data-act="cd-close" aria-label="Countdown schließen">${ICON.x}</button></div>
      <div class="cd-sub"><span>${owner ? 'für ' + esc(owner.name) : 'Von 6 bis 1 herunterzählen'}</span><span><b>${g.pts}</b> Punkte</span></div>
      <div class="hexes" role="list" aria-label="Stufen">${hexes}</div>
      <div class="cd-msg" aria-live="polite">${msg}</div>
      <div class="cd-stage">
        <div class="cd-dice" style="--per:${per}">${dice}</div>
        <div class="cd-got" aria-label="Zur Seite gelegt">${g.got.map(v => miniDie(v)).join('')}</div>
      </div>
      <div class="cd-foot">${foot}</div>`;
  }

  /* ---------- Rückmeldungen ---------- */
  let toastTimer = 0;
  let undoSnap = null;
  const snapshot = () => JSON.stringify(state);

  function toast(msg, snap) {
    const el = $('#toast');
    $('.t-msg', el).textContent = msg;
    undoSnap = snap || null;
    $('.t-undo', el).hidden = !undoSnap;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.classList.remove('show'); undoSnap = null; }, undoSnap ? 5000 : 2200);
  }

  function undo() {
    if (!undoSnap) return;
    const tab = state.tab;
    const duo = state.duo;
    try { state = normalize(JSON.parse(undoSnap)); } catch (e) { return; }
    state.tab = tab;
    state.duo = duo;
    undoSnap = null;
    closeSheet(true);
    hideCountdown();
    save();
    render();
    if (atStart) renderStart();
    toast('Rückgängig gemacht');
  }

  /* ---------- Sheet ---------- */
  let sheetFns = {};
  let sheetGen = 0;
  let sheetReturn = null;

  // Ist ein Fenster offen, ist die Seite dahinter für Tastatur und Screenreader gesperrt.
  function updateInert() {
    const modal = !$('#sheet').hidden || !$('#cd').hidden;
    $('#start').inert = modal;
    $('.app').inert = modal;
    $('.tabbar').inert = modal;
  }

  function openSheet(html, fns, label) {
    const wrap = $('#sheet');
    sheetGen++;
    sheetFns = fns || {};
    if (wrap.hidden) sheetReturn = document.activeElement;
    $('.sheet', wrap).setAttribute('aria-label', label || 'Eingabe');
    $('.sheet-body', wrap).innerHTML = html;
    wrap.classList.remove('closing');
    wrap.hidden = false;
    document.body.classList.add('lock');
    updateInert();
    const sh = $('.sheet', wrap);
    sh.scrollTop = 0;
    try { sh.focus({ preventScroll: true }); } catch (e) { sh.focus(); }
  }

  function closeSheet(instant) {
    const wrap = $('#sheet');
    if (wrap.hidden) return;
    sheetFns = {};
    const gen = sheetGen;
    const finish = () => {
      if (gen !== sheetGen || wrap.hidden) return;
      wrap.hidden = true;
      wrap.classList.remove('closing');
      updateInert();
      if ($('#cd').hidden) document.body.classList.remove('lock');
      const back = sheetReturn;
      sheetReturn = null;
      if (back && document.contains(back) && typeof back.focus === 'function') {
        try { back.focus({ preventScroll: true }); } catch (e) { /* egal */ }
      }
    };
    if (instant || reduced()) finish();
    else {
      wrap.classList.add('closing');
      setTimeout(finish, 170);
    }
  }

  /* ---------- Würfeln ---------- */
  let rolling = false;

  function flicker(els, done) {
    if (!els.length || reduced()) { done(); return; }
    rolling = true;
    els.forEach(el => {
      el.classList.remove('rolling');
      void el.offsetWidth;
      el.classList.add('rolling');
    });
    const t0 = Date.now();
    const iv = setInterval(() => {
      els.forEach(el => setFace(el, d6()));
      if (Date.now() - t0 >= 620) {
        clearInterval(iv);
        rolling = false;
        done();
      }
    }, 70);
  }

  function roll() {
    if (rolling) return;
    if (turnDone()) {
      if (cdPending()) { askCountdown(); return; }
      state.dice = freshDice();
      state.cdGame = null;
    }
    const d = state.dice;
    if (d.rolls >= 3) return;
    const first = !d.vals || !d.rolls;
    if (!first && d.held.every(Boolean)) return;
    if (first) {
      const cp = currentPlayer();
      d.held = [false, false, false, false, false, false];
      d.owner = cp ? cp.id : null;
      d.ownerFilled = cp ? filled(cp.id) : 0;
      d.cd = null;
    }
    const next = (d.vals || [1, 2, 3, 4, 5, 6]).slice();
    const idx = [];
    for (let i = 0; i < 6; i++) {
      if (first || !d.held[i]) { next[i] = d6(); idx.push(i); }
    }
    d.vals = next;
    d.rolls = first ? 1 : d.rolls + 1;
    if (first && Math.max.apply(null, countFaces(next)) >= 4) d.cd = { owner: d.owner, played: false };
    save();

    const els = idx.map(i => $('#view-dice .die[data-i="' + i + '"]')).filter(Boolean);
    els.forEach(el => el.classList.remove('idle', 'dim', 'held'));
    const btn = $('#view-dice [data-act="roll"]');
    if (btn) btn.disabled = true;
    vibrate(10);
    Sound.roll(idx.length);
    flicker(els, () => {
      renderDice();
      renderTop();
      if (first && d.cd) {
        vibrate([12, 60, 12]);
        Sound.sparkle();
      }
    });
  }

  function toggleHold(i) {
    const d = state.dice;
    if (rolling || !d.vals || !d.rolls || d.rolls >= 3 || turnDone()) return;
    d.held[i] = !d.held[i];
    save();
    const el = $('#view-dice .die[data-i="' + i + '"]');
    if (el) {
      el.classList.toggle('held', d.held[i]);
      el.setAttribute('aria-pressed', d.held[i] ? 'true' : 'false');
      el.setAttribute('aria-label', 'Würfel ' + (i + 1) + ': ' + d.vals[i] + (d.held[i] ? ', bleibt liegen' : ''));
    }
    patchRoll();
    vibrate(6);
    Sound.hold(d.held[i]);
  }

  function askCountdown() {
    openSheet(`
      <h3 class="s-title">Countdown noch offen</h3>
      <p class="s-note">Du hast den Countdown freigeschaltet, aber noch nicht zu Ende gespielt. Wenn du jetzt weitermachst, verfällt er.</p>
      <div class="s-acts">
        <button type="button" class="btn btn-marker" data-act="sheet-do" data-do="play">Countdown spielen</button>
        <button type="button" class="btn btn-line" data-act="sheet-do" data-do="drop">Countdown verfallen lassen</button>
        <button type="button" class="btn btn-quiet" data-act="sheet-close">Abbrechen</button>
      </div>`, {
      play: () => { closeSheet(true); startCountdown(); },
      drop: () => {
        closeSheet();
        state.dice = freshDice();
        state.cdGame = null;
        save();
        render();
      },
    });
  }

  function resetDice() {
    if (rolling) return;
    if (cdPending()) { askCountdown(); return; }
    state.dice = freshDice();
    save();
    render();
  }

  function showResultIfOver() {
    if (!isOver() || (state.tab !== 'block' && !duoOn())) return;
    try { window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { /* egal */ }
  }

  function autoCountdown() {
    setTimeout(() => {
      if (cdPending() && turnDone() && $('#cd').hidden && $('#sheet').hidden) startCountdown();
    }, 450);
  }

  /* ---------- Eintragen ---------- */
  function openQuick(key) {
    const d = state.dice;
    const owner = d.owner ? playerById(d.owner) : null;
    const f = F[key];
    if (!f || !owner || !d.vals || !d.rolls || turnDone() || scoreOf(owner.id, key) !== null) return;
    const pts = scoreFor(key, d.vals);
    openSheet(`
      <h3 class="s-title">${f.name}</h3>
      <p class="s-who">für ${esc(owner.name)}</p>
      <div class="bigpts${pts ? '' : ' zero'}"><span class="hand">${pts}</span><span>${pts === 1 ? 'Punkt' : pts ? 'Punkte' : 'Punkte, das Feld wird gestrichen'}</span></div>
      <div class="s-acts split">
        <button type="button" class="btn btn-line" data-act="sheet-close">Abbrechen</button>
        <button type="button" class="btn ${pts ? 'btn-pen' : 'btn-danger'}" data-act="sheet-do" data-do="ok">${pts ? 'Eintragen' : 'Streichen'}</button>
      </div>`, {
      ok: () => {
        const snap = snapshot();
        const wasOver = isOver();
        setScore(owner.id, key, pts);
        closeSheet();
        save();
        render();
        Sound.score(pts);
        if (!wasOver && isOver()) Sound.fanfare(0.35);
        toast(pts ? f.name + ': ' + pts + ' eingetragen' : f.name + ': gestrichen', snap);
        if (cdPending()) autoCountdown();
      },
    });
  }

  function openFieldSheet(pid, key) {
    const p = playerById(pid);
    const f = F[key];
    if (!p || !f) return;
    const cur = scoreOf(pid, key);
    const d = state.dice;
    const match = d.vals && d.rolls && !turnDone() && d.owner === pid ? scoreFor(key, d.vals) : null;
    const choice = (v, small) => {
      const c = 'ch' + (cur === v ? ' cur' : '') + (match === v ? ' match' : '');
      return `<button type="button" class="${c}" data-act="sheet-do" data-do="pick" data-v="${v}"><b>${v}</b>${small ? `<small>${small}</small>` : ''}</button>`;
    };
    let grid = '';
    let cls = '';
    let note = '';
    if (f.type === 'upper') {
      for (let k = 0; k <= 6; k++) grid += choice(k * f.n, k + ' × ' + f.n);
      note = 'Wie viele ' + f.plural + ' hast du?';
    } else if (f.type === 'fixed') {
      cls = ' two';
      grid = choice(f.pts, 'geschafft') + choice(0, 'streichen');
      note = 'Voraussetzung: ' + f.req + '.';
    } else {
      cls = ' sums';
      for (let v = 6; v <= 36; v++) grid += choice(v, '');
      note = 'Wähle die Augensumme.';
    }
    openSheet(`
      <h3 class="s-title">${f.name}</h3>
      <p class="s-who">für ${esc(p.name)}</p>
      <p class="s-note">${note}</p>
      <div class="chs${cls}">${grid}</div>
      ${match !== null ? '<p class="s-legend"><i></i>passt zu deinem aktuellen Wurf</p>' : ''}
      <div class="s-acts">
        ${cur !== null ? '<button type="button" class="btn btn-line" data-act="sheet-do" data-do="clear">Eintrag löschen</button>' : ''}
        <button type="button" class="btn btn-quiet" data-act="sheet-close">Abbrechen</button>
      </div>`, {
      pick: v => {
        const n = Number(v);
        const snap = snapshot();
        const wasOver = isOver();
        setScore(pid, key, n);
        closeSheet();
        save();
        render();
        Sound.score(n);
        if (!wasOver && isOver()) Sound.fanfare(0.35);
        toast(n === 0 && f.type === 'fixed' ? f.name + ': gestrichen' : f.name + ': ' + n + ' eingetragen', snap);
        if (cdPending()) autoCountdown();
        else showResultIfOver();
      },
      clear: () => {
        const snap = snapshot();
        clearScore(pid, key);
        closeSheet();
        save();
        render();
        toast(f.name + ': Eintrag gelöscht', snap);
      },
    });
  }

  function openCdSheet(pid) {
    const p = playerById(pid);
    if (!p) return;
    const list = cdList(pid);
    let so;
    if (!list.length) so = 'Noch kein Countdown eingetragen.';
    else if (list.length === 1) so = 'Bisher ' + list[0] + ' Punkte.';
    else so = 'Bisher ' + list.join(' + ') + ' = ' + sum(list) + ' Punkte.';
    let grid = '';
    for (let k = 1; k <= 6; k++) {
      grid += `<button type="button" class="ch" data-act="sheet-do" data-do="add" data-v="${k * 10}"><b>+${k * 10}</b><small>${k} ${k === 1 ? 'Stufe' : 'Stufen'}</small></button>`;
    }
    openSheet(`
      <h3 class="s-title">Countdown</h3>
      <p class="s-who">für ${esc(p.name)}</p>
      <p class="s-note">${so} Wie viele Stufen hast du geschafft?</p>
      <div class="chs">${grid}</div>
      <div class="s-acts">
        ${list.length ? '<button type="button" class="btn btn-line" data-act="sheet-do" data-do="pop">Letzten Countdown löschen</button>' : ''}
        <button type="button" class="btn btn-quiet" data-act="sheet-close">Abbrechen</button>
      </div>`, {
      add: v => {
        const n = Number(v);
        const snap = snapshot();
        state.cds[pid] = cdList(pid).concat(n);
        closeSheet();
        save();
        render();
        toast('Countdown: ' + n + ' Punkte eingetragen', snap);
        showResultIfOver();
      },
      pop: () => {
        const snap = snapshot();
        state.cds[pid] = cdList(pid).slice(0, -1);
        closeSheet();
        save();
        render();
        toast('Letzter Countdown gelöscht', snap);
      },
    });
  }

  /* ---------- Countdown ---------- */
  function startCountdown() {
    if (!state.cdGame) {
      const o = state.dice.cd && state.dice.cd.owner && playerById(state.dice.cd.owner) ? state.dice.cd.owner : null;
      state.cdGame = { owner: o, stage: 0, pts: 0, last: null, hit: -1, status: 'play', got: [] };
      save();
    }
    const g = state.cdGame;
    cdPick = g.owner && playerById(g.owner) ? g.owner : (state.players.length === 1 ? state.players[0].id : null);
    const el = $('#cd');
    el.hidden = false;
    document.body.classList.add('lock');
    updateInert();
    renderCountdown();
    try { el.focus({ preventScroll: true }); } catch (e) { /* egal */ }
  }

  function hideCountdown() {
    const el = $('#cd');
    if (el.hidden) return;
    el.hidden = true;
    if ($('#sheet').hidden) document.body.classList.remove('lock');
    updateInert();
  }

  function closeCountdown() {
    hideCountdown();
    render();
  }

  function cdRoll() {
    const g = state.cdGame;
    if (!g || g.status !== 'play' || rolling) return;
    const n = 6 - g.stage;
    const vals = Array.from({ length: n }, () => d6());
    const hit = vals.indexOf(n);
    g.last = vals;
    g.hit = hit;
    if (hit >= 0) {
      g.pts += 10;
      g.got.push(n);
      g.stage += 1;
      if (g.stage >= 6) g.status = 'perfect';
    } else {
      g.status = 'over';
    }
    save();

    const box = $('#cd .cd-dice');
    const btn = $('#cd [data-act="cd-roll"]');
    if (btn) btn.disabled = true;
    if (box) {
      box.style.setProperty('--per', n >= 5 || n === 3 ? 3 : n === 1 ? 1 : 2);
      box.innerHTML = vals.map((_, i) => `<div class="die" style="--k:${i}">${faceHTML(d6())}</div>`).join('');
    }
    vibrate(10);
    Sound.roll(n);
    flicker(box ? $$('.die', box) : [], () => {
      renderCountdown();
      renderTop();
      if (hit >= 0) vibrate([8, 40, 8]);
      if (g.status === 'perfect') Sound.fanfare();
      else if (hit >= 0) Sound.cdHit(g.stage);
      else Sound.cdMiss();
    });
  }

  function cdSave(discard) {
    const g = state.cdGame;
    if (!g || g.status === 'play') return;
    const pid = !discard && g.pts > 0 && cdPick && playerById(cdPick) ? cdPick : null;
    const snap = snapshot();
    if (pid) state.cds[pid] = cdList(pid).concat(g.pts);
    if (state.dice.cd) state.dice.cd.played = true;
    state.cdGame = null;
    save();
    closeCountdown();
    if (pid) Sound.score(g.pts);
    if (pid) toast('Countdown: ' + g.pts + ' Punkte für ' + playerById(pid).name + ' eingetragen', snap);
    else toast('Countdown beendet');
  }

  /* ---------- Spieler ---------- */
  const cleanName = v => String(v).replace(/\s+/g, ' ').trim().slice(0, 20);
  function shake(inp) {
    inp.classList.remove('shake');
    void inp.offsetWidth;
    inp.classList.add('shake');
    inp.focus();
  }

  function addPlayer() {
    const inp = $('#newName');
    if (!inp) return;
    const name = cleanName(inp.value);
    if (!name) { shake(inp); return; }
    state.players.push({ id: uid(), name });
    dropStrayRoll();
    save();
    renderPlayers();
    renderTop();
    const n = $('#newName');
    if (n) n.focus();
  }

  function removePlayer(pid) {
    const p = playerById(pid);
    if (!p) return;
    const snap = snapshot();
    state.players = state.players.filter(x => x.id !== pid);
    delete state.scores[pid];
    delete state.cds[pid];
    if (!state.players.length) state.started = false;
    dropStrayRoll();
    closeSheet();
    save();
    render();
    toast(p.name + ' entfernt', snap);
  }

  function movePlayer(pid, dir) {
    const arr = state.players;
    const i = arr.findIndex(p => p.id === pid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
    save();
    renderPlayers();
    const btn = $('#view-players [data-act="' + (dir < 0 ? 'up' : 'down') + '"][data-pid="' + pid + '"]');
    if (btn && !btn.disabled) {
      try { btn.focus({ preventScroll: true }); } catch (e) { /* egal */ }
    }
  }

  // Im Spiel: Namen im Block antippen, um die Person umzubenennen oder zu entfernen
  function openPlayerSheet(pid) {
    const p = playerById(pid);
    if (!p) return;
    const alone = state.players.length < 2;
    openSheet(`
      <h3 class="s-title">${esc(p.name)}</h3>
      <label class="s-lab" for="renameInp">Name</label>
      <input id="renameInp" class="input" type="text" maxlength="20" value="${esc(p.name)}" autocomplete="off" spellcheck="false" enterkeyhint="done">
      <div class="s-acts">
        <button type="button" class="btn btn-pen" data-act="sheet-do" data-do="save">Speichern</button>
        ${alone ? '' : `<button type="button" class="btn btn-line btn-warn" data-act="sheet-do" data-do="remove">Aus dem Spiel entfernen</button>`}
        <button type="button" class="btn btn-quiet" data-act="sheet-close">Abbrechen</button>
      </div>
      ${alone ? '<p class="s-fine">Allein kannst du dich nicht entfernen. Zum Aufhören tippe unten auf Menü und brich das Spiel ab.</p>' : ''}`, {
      save: () => renamePlayer(pid),
      remove: () => askRemove(pid),
    }, 'Spieler bearbeiten');
  }

  function renamePlayer(pid) {
    const p = playerById(pid);
    const inp = $('#renameInp');
    if (!p || !inp) return;
    const name = cleanName(inp.value);
    if (!name) { shake(inp); return; }
    closeSheet();
    if (name === p.name) return;
    const snap = snapshot();
    const old = p.name;
    p.name = name;
    save();
    render();
    toast(old + ' heißt jetzt ' + name, snap);
  }

  // Stehen schon Punkte im Block, wird vorher nachgefragt.
  function askRemove(pid) {
    const p = playerById(pid);
    if (!p || state.players.length < 2) return;
    const n = filled(pid);
    if (!n && !cdList(pid).length) { removePlayer(pid); return; }
    const what = n ? n + (n === 1 ? ' Feld' : ' Felder') : 'ein Countdown';
    openSheet(`
      <h3 class="s-title">${esc(p.name)} entfernen?</h3>
      <p class="s-note">Für ${esc(p.name)} ist schon etwas eingetragen (${what}, ${totals(pid).total} Punkte). Beim Entfernen werden diese Einträge gelöscht.</p>
      <div class="s-acts">
        <button type="button" class="btn btn-danger" data-act="sheet-do" data-do="ok">Entfernen und Punkte löschen</button>
        <button type="button" class="btn btn-quiet" data-act="sheet-do" data-do="back">Abbrechen</button>
      </div>`, {
      ok: () => removePlayer(pid),
      back: () => openPlayerSheet(pid),
    }, 'Spieler entfernen');
  }

  /* ---------- Spiel starten, pausieren, beenden ---------- */
  // Punkte, Würfel und Countdown zurücksetzen. Die Spieler bleiben dabei.
  function clearGame() {
    state.scores = {};
    state.cds = {};
    state.dice = freshDice();
    state.cdGame = null;
    state.gameId = uid();
  }

  function focusView() {
    const el = state.started ? $('.tab.on') : $('#view-players .h-view');
    if (el) { try { el.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
  }

  // Mit App-Würfeln geht es zum Würfeln, mit eigenen Würfeln direkt in den Block.
  function startGame(via) {
    if (!state.players.length) return;
    state.via = via === 'own' ? 'own' : 'app';
    state.started = true;
    state.tab = viaTab();
    state.dice = freshDice();
    state.cdGame = null;
    save();
    render();
    try { window.scrollTo(0, 0); } catch (e) { /* egal */ }
    focusView();
  }

  // „Menü“ unten in der Leiste und das Logo oben
  function openMenu() {
    if (!state.started) { showStart(); return; }
    // Noch nichts gewürfelt oder eingetragen: Beim nächsten Mal geht es wieder zur Spieler-Auswahl.
    if (!gameTouched()) { state.started = false; save(); showStart(); return; }
    if (gameDone()) { openResult(); return; }
    openPause();
  }

  function openPause() {
    const over = isOver();   // Alle Felder voll, nur der Countdown ist noch offen
    const choice = (act, cls, icon, title, sub) => `
          <button type="button" class="choice${cls}" data-act="sheet-do" data-do="${act}">
            <span class="choice-ic">${ICON[icon]}</span>
            <span class="choice-tx"><span class="choice-t">${title}</span><span class="choice-s">${sub}</span></span>
          </button>`;
    openSheet(`
      <h3 class="s-title">Zurück ins Hauptmenü?</h3>
      <p class="s-note">${over ? 'Alle Runden sind gespielt, nur der Countdown ist noch offen.' : 'Ihr seid in Runde ' + roundNo() + ' von ' + NF + '.'}</p>
      <div class="choices">
        ${choice('pause', '', 'pause', 'Pausieren', 'Das Spiel bleibt gespeichert. Im Menü geht es mit „Lokal“ weiter.')}
        ${over ? '' : choice('abort', ' choice-danger', 'x', 'Spiel abbrechen', 'Alle Punkte werden gelöscht. Es gibt keinen Highscore.')}
      </div>
      <div class="s-acts"><button type="button" class="btn btn-quiet" data-act="sheet-close">Zurück zum Spiel</button></div>`, {
      pause: () => showStart(),
      abort: () => {
        const snap = snapshot();
        clearGame();
        state.started = false;
        save();
        showStart();
        toast('Spiel abgebrochen', snap);
      },
    }, 'Zurück ins Hauptmenü');
  }

  // Ergebnis am Ende: Platzierung aller Personen. Die Punkte stehen dann schon in den Highscores.
  function openResult() {
    const P = state.players;
    if (!P.length || !isOver()) return;
    syncHistory();
    const ranking = P.map(p => ({ p, s: totals(p.id).total })).sort((a, b) => b.s - a.s);
    const top = ranking[0].s;
    const winners = ranking.filter(r => r.s === top).map(r => r.p.name);
    // Neuer Rekord: Das beste Ergebnis aller Zeiten stammt aus diesem Spiel (und es gab schon frühere).
    const recs = records();
    const record = recs.length && recs[0].g === state.gameId && Object.keys(state.history).length > 1 ? recs[0].s : null;
    const recChip = '<span class="chip chip-rec">Neuer Rekord</span>';
    let place = 0;
    let last = null;
    const items = ranking.map((r, i) => {
      if (r.s !== last) { place = i + 1; last = r.s; }
      return `<li${place === 1 ? ' class="win"' : ''}><span class="pl">${place}.</span><span class="pn">${esc(r.p.name)}${r.s === record ? recChip : ''}</span><span class="ps">${r.s}</span></li>`;
    }).join('');
    let title;
    let note;
    if (P.length === 1) {
      title = top + ' Punkte';
      note = top >= 300 ? 'Das liegt über dem Richtwert von rund 300 Punkten.' : 'Richtwert für ein ordentliches Spiel: rund 300 Punkte.';
    } else if (winners.length > 1) {
      title = 'Gleichstand';
      note = nameList(winners) + ' teilen sich den Sieg mit ' + top + ' Punkten.';
    } else {
      title = winners[0] + ' gewinnt';
      note = 'Mit ' + top + ' Punkten.';
    }
    const saved = state.skipHist === state.gameId
      ? 'Dieses Spiel steht nicht in den Highscores, weil die Liste gerade geleert wurde.'
      : (P.length === 1 ? 'Das Ergebnis steht' : 'Die Ergebnisse stehen') + ' in den Highscores. Gespeichert wird nur auf diesem Gerät.';
    openSheet(`
      <div class="res-top"><span class="res-ic">${ICON.trophy}</span>${P.length === 1 && record !== null ? recChip : ''}</div>
      <h3 class="s-title">${esc(title)}</h3>
      <p class="s-note">${esc(note)}</p>
      ${P.length > 1 ? `<ol class="rank">${items}</ol>` : ''}
      <p class="saved">${ICON.phone}<span>${saved}</span></p>
      <div class="s-acts">
        <button type="button" class="btn btn-pen" data-act="sheet-do" data-do="menu">Zum Hauptmenü</button>
        <button type="button" class="btn btn-line" data-act="sheet-do" data-do="again">Nochmal spielen</button>
        <button type="button" class="btn btn-quiet" data-act="sheet-close">Schließen</button>
      </div>`, {
      menu: () => endGame(false),
      again: () => endGame(true),
    }, 'Ergebnis');
  }

  // Spiel abschließen. „Nochmal spielen“ startet gleich ein neues mit denselben Personen.
  function endGame(again) {
    if (!isOver()) return;
    syncHistory();
    const snap = snapshot();
    clearGame();
    state.started = !!again;
    if (again) state.tab = viaTab();
    save();
    if (!again) { showStart(); return; }
    closeSheet();
    render();
    try { window.scrollTo(0, 0); } catch (e) { /* egal */ }
    toast('Neues Spiel gestartet', snap);
  }

  /* ---------- Highscores ---------- */
  function openHighscores(tab) {
    const on = tab === 'online' ? 'online' : 'local';
    const recs = records();
    const local = recs.length
      ? `<ol class="rec">${recs.map((r, i) => `<li><span class="rn">${i + 1}.</span><span class="rname">${esc(r.n)}<small>${fmtDate(r.t)}</small></span><span class="rs">${r.s}</span></li>`).join('')}</ol>
         <p class="saved">${ICON.phone}<span>Die zehn besten Ergebnisse, nur auf diesem Gerät gespeichert.</span></p>
         <button type="button" class="btn btn-quiet hs-clear" data-act="sheet-do" data-do="clear">Liste leeren</button>`
      : `<div class="hs-empty"><span class="hs-ic">${ICON.trophy}</span><p><b>Noch keine Highscores</b></p><p>Nach dem ersten kompletten Spiel stehen hier die zehn besten Ergebnisse.</p></div>`;
    const online = `<div class="hs-empty"><span class="hs-ic">${ICON.globe}</span><p><b>Online-Highscores kommen bald</b></p><p>Sobald man online spielen kann, seht ihr hier die Besten von überall.</p><span class="chip">Bald verfügbar</span></div>`;
    const tabBtn = (id, label) => `<button type="button" class="seg-b" role="tab" id="hs-t-${id}" aria-controls="hs-p-${id}" aria-selected="${on === id}" tabindex="${on === id ? 0 : -1}" data-act="hs-tab" data-v="${id}">${label}</button>`;
    openSheet(`
      <h3 class="s-title">Highscores</h3>
      <div class="seg seg-tabs" role="tablist" aria-label="Highscores">${tabBtn('local', 'Lokal')}${tabBtn('online', 'Online')}</div>
      <div class="hs-panel" role="tabpanel" id="hs-p-local" aria-labelledby="hs-t-local"${on === 'local' ? '' : ' hidden'}>${local}</div>
      <div class="hs-panel" role="tabpanel" id="hs-p-online" aria-labelledby="hs-t-online"${on === 'online' ? '' : ' hidden'}>${online}</div>
      <div class="s-acts"><button type="button" class="btn btn-pen" data-act="sheet-close">Fertig</button></div>`, {
      clear: confirmClearRecords,
    }, 'Highscores');
  }

  function setHsTab(tab, focus) {
    $$('#sheet [role="tab"]').forEach(b => {
      const on = b.dataset.v === tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    $$('#sheet .hs-panel').forEach(p => { p.hidden = p.id !== 'hs-p-' + tab; });
  }

  function confirmClearRecords() {
    openSheet(`
      <h3 class="s-title">Highscores leeren?</h3>
      <p class="s-note">Alle gespeicherten Ergebnisse auf diesem Gerät werden gelöscht.</p>
      <div class="s-acts">
        <button type="button" class="btn btn-danger" data-act="sheet-do" data-do="ok">Highscores leeren</button>
        <button type="button" class="btn btn-quiet" data-act="sheet-do" data-do="back">Abbrechen</button>
      </div>`, {
      ok: () => {
        const snap = snapshot();
        state.history = {};
        state.skipHist = state.gameId;
        save();
        openHighscores('local');
        toast('Highscores geleert', snap);
      },
      back: () => openHighscores('local'),
    }, 'Highscores leeren');
  }

  /* ---------- Design: hell, dunkel oder automatisch ---------- */
  const THEME_KEY = 'hexa-theme';
  const THEME_COLOR = { light: '#EDEFF4', dark: '#0D1020' };
  const START_COLOR = { light: '#232C7A', dark: '#1E2672' };   // Farbe des Spieltischs auf dem Startbildschirm
  const THEMES = [['light', 'Hell', 'sun'], ['dark', 'Dunkel', 'moon'], ['auto', 'Automatisch', 'auto']];
  const darkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function chosenTheme() {
    const t = document.documentElement.getAttribute('data-theme');
    return t === 'light' || t === 'dark' ? t : null;
  }
  // „Automatisch“ folgt der Einstellung des Geräts.
  let themeChoice = chosenTheme() || 'auto';
  try {
    const t = localStorage.getItem(THEME_KEY);
    themeChoice = t === 'light' || t === 'dark' ? t : 'auto';
  } catch (e) { /* Speicher gesperrt */ }

  function syncTheme() {
    const t = chosenTheme();
    const colors = atStart ? START_COLOR : THEME_COLOR;
    $$('meta[name="theme-color"]').forEach(m => {
      const own = /dark/.test(m.getAttribute('media') || '') ? 'dark' : 'light';
      m.setAttribute('content', colors[t || own]);
    });
    syncSettings();
  }

  function setTheme(mode) {
    if (mode !== 'light' && mode !== 'dark') mode = 'auto';
    const apply = () => {
      themeChoice = mode;
      if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', mode);
      try {
        if (mode === 'auto') localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, mode);
      } catch (e) { /* Speicher gesperrt */ }
      syncTheme();
    };
    if (document.startViewTransition && !reduced()) {
      try { document.startViewTransition(apply); return; } catch (e) { /* ohne Überblendung */ }
    }
    apply();
  }

  /* ---------- Fallende Würfel im Hintergrund ---------- */
  const SKY_KEY = 'hexa-sky';
  let skyOn = true;
  try { skyOn = localStorage.getItem(SKY_KEY) !== 'off'; } catch (e) { /* Speicher gesperrt */ }
  const rand = (a, b) => a + Math.random() * (b - a);

  // Jeder Würfel bekommt Platz, Tiefe, Drehung und Tempo. Nahe Würfel sind größer,
  // deutlicher und schneller, ferne kleiner, blasser und langsamer. Die Bewegung macht CSS.
  function fillSky(box, felt) {
    const n = Math.round(Math.min(felt ? 26 : 14, Math.max(felt ? 12 : 8, window.innerWidth / (felt ? 38 : 95))));
    if (box.childElementCount === n) return;
    const dice = [];
    for (let i = 0; i < n; i++) {
      const z = felt ? rand(0.35, 1.1) : rand(0.55, 1);
      const dur = felt ? rand(16, 24) * (1.45 - z * 0.5) : rand(32, 50);
      const r0 = rand(-180, 180);
      const turn = rand(90, 240) * (Math.random() < 0.5 ? -1 : 1);
      const style = [
        '--x:' + ((i + rand(0.1, 0.9)) / n * 100).toFixed(1) + '%',
        '--z:' + z.toFixed(2),
        '--dur:' + dur.toFixed(1) + 's',
        '--delay:' + (-rand(0, dur)).toFixed(1) + 's',
        '--r0:' + r0.toFixed(0) + 'deg',
        '--r1:' + (r0 + turn).toFixed(0) + 'deg',
        '--dx:' + rand(-6, 6).toFixed(1) + 'vw',
        '--y:' + rand(-5, 95).toFixed(0) + 'vh',
        '--o:' + (felt ? 0.14 + z * 0.3 : rand(0.1, 0.17)).toFixed(2),
        '--b:' + (felt && z < 0.6 ? 1.2 : 0) + 'px',
      ].join(';');
      const face = faceHTML(1 + Math.floor(Math.random() * 6));
      dice.push({ z, html: `<div class="fall" style="${style}">${felt ? `<div class="die">${face}</div>` : `<span class="mdie">${face}</span>`}</div>` });
    }
    // Nahe Würfel liegen vorne
    box.innerHTML = dice.sort((a, b) => a.z - b.z).map(d => d.html).join('');
  }

  function syncSky() {
    $('#startSky').hidden = !skyOn;
    $('#appSky').hidden = !skyOn || atStart;
    if (!skyOn) return;
    fillSky($('#startSky'), true);
    fillSky($('#appSky'), false);
  }

  function setSky(on) {
    skyOn = !!on;
    try { localStorage.setItem(SKY_KEY, skyOn ? 'on' : 'off'); } catch (e) { /* Speicher gesperrt */ }
    syncSky();
    syncSettings();
  }

  /* ---------- Einstellungen ---------- */
  const pct = v => Math.round(v * 100);

  function openSettings() {
    const s = Sound.get();
    const row = (ch, label, icon, on, vol) => `
        <div class="set-row">
          <div class="set-line">
            <span class="set-ic">${ICON[icon]}</span>
            <span class="set-lab" id="lab-${ch}">${label}</span>
            <button type="button" class="sw" id="sw-${ch}" role="switch" aria-checked="${on}" aria-labelledby="lab-${ch}" data-act="set-sound" data-ch="${ch}"><i></i></button>
          </div>
          <div class="set-vol">
            <input type="range" class="vol" id="vol-${ch}" data-ch="${ch}" min="0" max="100" step="5" value="${pct(vol)}" style="--v:${pct(vol)}%" aria-label="Lautstärke ${label}"${on ? '' : ' disabled'}>
            <output class="vol-n" id="out-${ch}" for="vol-${ch}">${pct(vol)} %</output>
          </div>
        </div>`;
    openSheet(`
      <h3 class="s-title">Einstellungen</h3>
      <section class="set-grp" aria-labelledby="set-h-design">
        <h4 class="set-h" id="set-h-design">Design</h4>
        <div class="seg" role="group" aria-labelledby="set-h-design">
          ${THEMES.map(([v, label, icon]) => `<button type="button" class="seg-b" data-act="set-theme" data-v="${v}" aria-pressed="${themeChoice === v}">${ICON[icon]}<span>${label}</span></button>`).join('')}
        </div>
        <div class="set-card">
          <div class="set-line">
            <span class="set-ic">${ICON.dices}</span>
            <span class="set-lab" id="lab-sky">Fallende Würfel</span>
            <button type="button" class="sw" id="sw-sky" role="switch" aria-checked="${skyOn}" aria-labelledby="lab-sky" data-act="set-sky"><i></i></button>
          </div>
        </div>
      </section>
      <section class="set-grp" aria-labelledby="set-h-sound">
        <h4 class="set-h" id="set-h-sound">Töne</h4>
        <div class="set-card">
          ${row('music', 'Musik', 'music', s.music, s.musicVol)}
          ${row('fx', 'Spielsounds', 'volume', s.fx, s.fxVol)}
        </div>
        <p class="keys">Mit <kbd>M</kbd> schaltest du alle Töne an oder aus.</p>
      </section>
      <section class="set-grp" aria-labelledby="set-h-lang">
        <h4 class="set-h" id="set-h-lang">Sprache</h4>
        <div class="set-card">
          <button type="button" class="set-line set-soon" data-act="soon" data-what="lang" aria-disabled="true">
            <span class="set-ic">${ICON.language}</span>
            <span class="set-lab">Deutsch</span>
            <span class="chip">Bald verfügbar</span>
          </button>
        </div>
      </section>
      <div class="s-acts"><button type="button" class="btn btn-pen" data-act="sheet-close">Fertig</button></div>`, null, 'Einstellungen');
  }

  // Offenes Einstellungsfenster auf den neuen Stand bringen, ohne es neu aufzubauen
  function syncSettings() {
    const box = $('#sheet');
    if (box.hidden || !$('.seg', box)) return;
    $$('.seg-b', box).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === themeChoice ? 'true' : 'false'));
    $('#sw-sky', box).setAttribute('aria-checked', skyOn ? 'true' : 'false');
    const s = Sound.get();
    [['music', s.music, s.musicVol], ['fx', s.fx, s.fxVol]].forEach(([ch, on, vol]) => {
      $('#sw-' + ch, box).setAttribute('aria-checked', on ? 'true' : 'false');
      const r = $('#vol-' + ch, box);
      r.disabled = !on;
      if (document.activeElement !== r) r.value = pct(vol);
      r.style.setProperty('--v', r.value + '%');
      $('#out-' + ch, box).textContent = r.value + ' %';
    });
  }

  function toggleChannel(ch) {
    const s = Sound.get();
    const on = !s[ch];
    const next = { [ch]: on };
    // Beim Einschalten nicht auf Lautstärke 0 hängen bleiben
    if (on && !s[ch + 'Vol']) next[ch + 'Vol'] = 0.6;
    Sound.set(next);
    if (ch === 'fx' && on) Sound.preview();
    syncSettings();
  }

  function toggleAllSound() {
    const on = Sound.toggleAll();
    if (on) Sound.preview();
    syncSettings();
    toast(on ? 'Töne an' : 'Töne aus');
  }

  const SOON = { online: 'Online spielen kommt bald.', lang: 'Weitere Sprachen kommen bald.' };

  /* ---------- Startbildschirm ---------- */
  function renderStart() {
    const sub = $('#localSub');
    if (!state.started) sub.textContent = 'Ein Gerät, reihum spielen';
    else if (isOver()) sub.textContent = 'Spiel beendet · Ergebnis ansehen';
    else sub.textContent = 'Weiterspielen · Runde ' + roundNo() + ' von ' + NF;
  }

  // Sechs Würfel mit 1 bis 6, die beim Erscheinen einmal kurz rollen
  function rollStartDice() {
    const box = $('#startDice');
    if (!box.firstChild) box.innerHTML = [1, 2, 3, 4, 5, 6].map((v, i) => `<div class="die" style="--k:${i * 3}">${faceHTML(v)}</div>`).join('');
    $$('.die', box).forEach(el => {
      el.classList.remove('rolling');
      void el.offsetWidth;
      el.classList.add('rolling');
    });
  }

  function showStart() {
    closeSheet(true);
    hideCountdown();
    atStart = true;
    renderStart();
    syncFrame();
    syncSky();
    rollStartDice();
    syncTheme();
    const b = $('#start [data-act="local"]');
    try { b.focus({ preventScroll: true }); } catch (e) { /* egal */ }
  }

  // Läuft ein Spiel, geht es direkt weiter. Sonst kommt zuerst die Spieler-Auswahl.
  function enterLocal() {
    atStart = false;
    syncSky();
    render();
    syncTheme();
    try { window.scrollTo(0, 0); } catch (e) { /* egal */ }
    focusView();
    // Beendetes Spiel, das noch nicht abgeschlossen wurde: gleich das Ergebnis zeigen
    if (state.started && gameDone()) openResult();
  }

  function setTab(tab) {
    if (TABS.indexOf(tab) < 0) return;
    // Schon sichtbar (auch als eine Hälfte der Zwei-Spalten-Ansicht): nur nach oben scrollen.
    if (tab === state.tab || (duoOn() && PAIR.indexOf(tab) >= 0)) {
      if (state.tab !== tab) { state.tab = tab; save(); renderTop(); }
      const behavior = reduced() ? 'auto' : 'smooth';
      try { window.scrollTo({ top: 0, behavior }); } catch (e) { /* egal */ }
      if (tab === 'dice' && duoOn()) {
        try { $('#view-dice').scrollTo({ top: 0, behavior }); } catch (e) { /* egal */ }
      }
      return;
    }
    state.tab = tab;
    save();
    render();
    try { window.scrollTo(0, 0); } catch (e) { /* egal */ }
  }

  function toggleDuo() {
    if (!canDuo()) return;
    if (duoOn()) {
      state.duo = false;
    } else {
      state.duo = true;
      if (PAIR.indexOf(state.tab) < 0) state.tab = 'dice';
    }
    save();
    render();
    try { window.scrollTo(0, 0); } catch (e) { /* egal */ }
  }

  /* ---------- Ereignisse ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    switch (t.dataset.act) {
      case 'tab': setTab(t.dataset.tab); break;
      case 'duo': toggleDuo(); break;
      case 'local': enterLocal(); break;
      case 'home': showStart(); break;
      case 'menu': openMenu(); break;
      case 'scores': openHighscores(); break;
      case 'hs-tab': setHsTab(t.dataset.v); break;
      case 'settings': openSettings(); break;
      case 'set-theme': setTheme(t.dataset.v); break;
      case 'set-sound': toggleChannel(t.dataset.ch); break;
      case 'set-sky': setSky(!skyOn); break;
      case 'soon': toast(SOON[t.dataset.what] || 'Kommt bald.'); break;
      case 'roll': roll(); break;
      case 'reset': resetDice(); break;
      case 'hold': toggleHold(Number(t.dataset.i)); break;
      case 'quick': openQuick(t.dataset.key); break;
      case 'cell': openFieldSheet(t.dataset.pid, t.dataset.key); break;
      case 'cd-cell': openCdSheet(t.dataset.pid); break;
      case 'add': addPlayer(); break;
      case 'start-game': startGame(t.dataset.via); break;
      case 'player': openPlayerSheet(t.dataset.pid); break;
      case 'end-game': openResult(); break;
      case 'up': movePlayer(t.dataset.pid, -1); break;
      case 'down': movePlayer(t.dataset.pid, 1); break;
      case 'remove': removePlayer(t.dataset.pid); break;
      case 'cd-open': startCountdown(); break;
      case 'cd-roll': cdRoll(); break;
      case 'cd-pick': cdPick = t.dataset.pid; renderCountdown(); break;
      case 'cd-save': cdSave(false); break;
      case 'cd-discard': cdSave(true); break;
      case 'cd-close': closeCountdown(); break;
      case 'sheet-close': closeSheet(); break;
      case 'sheet-do': {
        const fn = sheetFns[t.dataset.do];
        if (typeof fn === 'function') fn(t.dataset.v);
        break;
      }
      case 'undo': undo(); break;
      default: break;
    }
  });

  // Leertaste würfelt (auch im Countdown), 1 bis 6 hält oder löst einen Würfel.
  // Gilt, solange die Würfel zu sehen sind und kein Fenster offen ist.
  let spaceTaken = false;
  const isSpace = e => e.key === ' ' || e.key === 'Spacebar';
  function shortcut(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return false;
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      if (!e.repeat) toggleAllSound();
      return true;
    }
    if (atStart) return false;
    if (!$('#cd').hidden) {
      const g = state.cdGame;
      if (!isSpace(e) || !g || g.status !== 'play') return false;
      e.preventDefault();
      spaceTaken = true;
      if (!e.repeat) cdRoll();
      return true;
    }
    if (!$('#sheet').hidden || $('#view-dice').hidden) return false;
    if (isSpace(e)) {
      e.preventDefault();
      spaceTaken = true;
      const b = $('#view-dice [data-act="roll"]');
      if (!e.repeat && b && !b.disabled) roll();
      return true;
    }
    if (e.key.length === 1 && e.key >= '1' && e.key <= '6') {
      const i = Number(e.key) - 1;
      const el = $('#view-dice .die[data-i="' + i + '"]');
      if (!el || el.disabled) return false;
      e.preventDefault();
      if (!e.repeat) toggleHold(i);
      return true;
    }
    return false;
  }

  document.addEventListener('keydown', e => {
    const t = e.target;
    if (e.key === 'Escape') {
      if (!$('#sheet').hidden) { closeSheet(); e.preventDefault(); }
      else if (!$('#cd').hidden) { closeCountdown(); e.preventDefault(); }
      return;
    }
    if (shortcut(e)) return;
    // Pfeiltasten wechseln zwischen den Tabs der Highscores
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && t && t.getAttribute && t.getAttribute('role') === 'tab') {
      e.preventDefault();
      setHsTab(t.dataset.v === 'local' ? 'online' : 'local', true);
      return;
    }
    if (e.key !== 'Enter' || !t) return;
    if (t.id === 'newName') { e.preventDefault(); addPlayer(); }
    else if (t.id === 'renameInp') { e.preventDefault(); if (sheetFns.save) sheetFns.save(); }
    else if (t.classList && t.classList.contains('pname')) { e.preventDefault(); t.blur(); }
  });

  // Verhindert, dass die Leertaste zusätzlich den fokussierten Knopf auslöst.
  document.addEventListener('keyup', e => {
    if (spaceTaken && isSpace(e)) { e.preventDefault(); spaceTaken = false; }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (t && t.classList && t.classList.contains('vol')) {
      Sound.set({ [t.dataset.ch + 'Vol']: Number(t.value) / 100 });
      syncSettings();
      return;
    }
    if (!t || !t.classList || !t.classList.contains('pname')) return;
    const p = playerById(t.dataset.pid);
    if (!p) return;
    const v = cleanName(t.value);
    if (v) { p.name = v; save(); }
  });

  document.addEventListener('change', e => {
    const t = e.target;
    // Nach dem Loslassen des Reglers hört man die neue Lautstärke der Spielsounds.
    if (t && t.classList && t.classList.contains('vol')) {
      if (t.dataset.ch === 'fx') Sound.preview();
      return;
    }
    if (!t || !t.classList || !t.classList.contains('pname')) return;
    const p = playerById(t.dataset.pid);
    if (!p) return;
    const v = cleanName(t.value);
    if (v) p.name = v;
    t.value = p.name;
    save();
    renderTop();
  });

  /* ---------- Start ---------- */
  $$('[data-dice]').forEach(el => {
    const digits = el.dataset.dice.split('').map(Number);
    el.innerHTML = digits.map(v => miniDie(v)).join('');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Würfel ' + digits.join('-'));
  });

  /* ---------- Bildschirm wach halten ---------- */
  // Solange die Seite offen ist und in den letzten 10 Minuten jemand getippt hat,
  // geht der Bildschirm nicht aus. Erlaubt der Browser das nicht, passiert einfach nichts.
  const AWAKE_MS = 10 * 60 * 1000;
  let wakeLock = null;
  let wakeBusy = false;
  let idleTimer = 0;

  function stayAwake() {
    if (wakeLock || wakeBusy || !navigator.wakeLock || document.visibilityState !== 'visible') return;
    wakeBusy = true;
    navigator.wakeLock.request('screen').then(lock => {
      wakeBusy = false;
      wakeLock = lock;
      lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
    }).catch(() => { wakeBusy = false; });
  }
  function letSleep() {
    const lock = wakeLock;
    wakeLock = null;
    if (lock) lock.release().catch(() => { /* schon frei */ });
  }
  // Jede Berührung verlängert die Zeit. Angefragt wird bei Klick oder Taste,
  // weil manche Browser das nur direkt nach einer Nutzeraktion erlauben.
  function activity(e) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(letSleep, AWAKE_MS);
    if (!e || e.type !== 'pointerdown') stayAwake();
  }
  document.addEventListener('pointerdown', activity, { capture: true, passive: true });
  document.addEventListener('click', activity, true);
  document.addEventListener('keydown', activity, true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') activity(); });

  if (dropStrayRoll()) save();
  syncTheme();
  if (darkMQ) {
    if (darkMQ.addEventListener) darkMQ.addEventListener('change', syncTheme);
    else if (darkMQ.addListener) darkMQ.addListener(syncTheme);
  }
  activity();

  // Fenster schmaler oder breiter gezogen: Ansicht nur neu aufbauen, wenn sie wechselt.
  if (wideMQ) {
    const onWidth = () => { if (duoOn() !== shownDuo) render(); else renderTop(); };
    if (wideMQ.addEventListener) wideMQ.addEventListener('change', onWidth);
    else if (wideMQ.addListener) wideMQ.addListener(onWidth);
  }

  // Breiteres oder schmaleres Fenster: Anzahl der fallenden Würfel anpassen
  let skyTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(skyTimer);
    skyTimer = setTimeout(() => { if (skyOn) syncSky(); }, 300);
  });

  render();
  renderStart();
  syncSky();
  rollStartDice();
})();
