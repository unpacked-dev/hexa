/* HEXA – App: Spieler, Würfel, Spielblock, Countdown.
   Braucht js/rules.js (window.HexaRules) und js/sound.js (window.HexaSound). */
(() => {
  'use strict';

  const { UPPER, LOWER, FIELDS, F, NF, BONUS_MIN, BONUS_PTS, sum, countFaces, scoreFor } = window.HexaRules;
  const Sound = window.HexaSound;

  /* ---------- Einstellungen ---------- */
  const KEY = 'hexa-spiel-v1';
  const TABS = ['players', 'dice', 'block', 'rules'];
  const PAIR = ['dice', 'block'];
  const WIDE = '(min-width: 1100px)';
  const PIPS = { 0: [], 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  function svg(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  const ICON = {
    reset: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
    up: svg('<path d="M12 19V5"/><path d="m5.5 11.5 6.5-6.5 6.5 6.5"/>'),
    down: svg('<path d="M12 5v14"/><path d="m18.5 12.5-6.5 6.5-6.5-6.5"/>'),
    x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    chev: svg('<path d="m9 6 6 6-6 6"/>'),
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
  const freshState = () => ({ v: 1, tab: 'dice', duo: false, players: [], scores: {}, cds: {}, dice: freshDice(), cdGame: null, gameId: uid(), history: {}, skipHist: null });

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
        g.r.forEach(r => { if (isObj(r) && typeof r.s === 'number') out.push({ n: String(r.n || ''), s: r.s, t: g.t || 0 }); });
      }
    });
    return out.sort((a, b) => b.s - a.s || a.t - b.t).slice(0, 5);
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
  const duoOn = () => canDuo() && !!state.duo && PAIR.indexOf(state.tab) >= 0;
  let shownDuo = false;

  function render() {
    const duo = duoOn();
    shownDuo = duo;
    $('.app').classList.toggle('duo', duo);
    const shown = name => name === state.tab || (duo && PAIR.indexOf(name) >= 0);
    $$('.view').forEach(v => { v.hidden = !shown(v.dataset.view); });
    $$('.tab').forEach(t => {
      const on = shown(t.dataset.tab);
      t.classList.toggle('on', on);
      if (on) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
    renderTop();
    if (state.tab === 'players') renderPlayers();
    if (shown('dice')) renderDice();
    if (shown('block')) renderBlock();
  }

  function renderTop() {
    const el = $('#topStatus');
    // Drei Längen, je nach Platz in der Kopfzeile
    const fit = (l, m, s) => `<span class="st-l">${l}</span><span class="st-m">${m}</span><span class="st-s">${s}</span>`;
    const r = roundNo();
    if (!state.players.length) el.innerHTML = '';
    else if (isOver()) el.innerHTML = fit('Spiel beendet', 'Beendet', 'Ende');
    else el.innerHTML = fit('Runde ' + r + ' von ' + NF, 'Runde ' + r + '/' + NF, r + '/' + NF);
    $('#cdBadge').hidden = !cdPending();
    const db = $('#duoBtn');
    db.hidden = !canDuo();
    db.setAttribute('aria-pressed', duoOn() ? 'true' : 'false');
  }

  function renderPlayers() {
    const root = $('#view-players');
    const P = state.players;
    const started = anyScores();
    const canRestart = started || state.dice.rolls > 0 || !!state.cdGame;
    const rows = P.map((p, i) => `
      <li class="prow">
        <span class="pnum">${i + 1}</span>
        <input class="pname" type="text" value="${esc(p.name)}" data-pid="${p.id}" maxlength="20" autocomplete="off" spellcheck="false" enterkeyhint="done" aria-label="Name von Person ${i + 1}">
        ${started ? `<span class="ppts">${totals(p.id).total} Pkt.</span>` : ''}
        <span class="pacts">
          <button type="button" class="ibtn" data-act="up" data-pid="${p.id}" aria-label="${esc(p.name)} nach oben"${i === 0 ? ' disabled' : ''}>${ICON.up}</button>
          <button type="button" class="ibtn" data-act="down" data-pid="${p.id}" aria-label="${esc(p.name)} nach unten"${i === P.length - 1 ? ' disabled' : ''}>${ICON.down}</button>
          <button type="button" class="ibtn ibtn-x" data-act="remove" data-pid="${p.id}" aria-label="${esc(p.name)} entfernen">${ICON.x}</button>
        </span>
      </li>`).join('');

    const recs = records();
    const recHTML = recs.length
      ? `<ol class="rec">${recs.map((r, i) => `<li><span class="rn">${i + 1}.</span><span class="rname">${esc(r.n)}<small>${fmtDate(r.t)}</small></span><span class="rs">${r.s}</span></li>`).join('')}</ol>
         <button type="button" class="btn btn-quiet" data-act="clear-records">Bestenliste leeren</button>`
      : '<p class="muted">Nach dem ersten kompletten Spiel stehen hier die besten Ergebnisse.</p>';

    const listHTML = P.length
      ? `<ol class="plist">${rows}</ol>
         <div class="pbtns">
           <button type="button" class="btn btn-pen" data-act="tab" data-tab="dice">Zum Würfeln</button>
           <button type="button" class="btn btn-line" data-act="new-game"${canRestart ? '' : ' disabled'}>Neues Spiel</button>
         </div>`
      : `<div class="empty-box">
           <p><b>So spielst du mit der App</b></p>
           <ol>
             <li>Trag oben alle Namen ein.</li>
             <li>Würfle im Bereich Würfel. Tippe die Würfel an, die liegen bleiben sollen.</li>
             <li>Trag dein Ergebnis direkt unter den Würfeln ein oder im Block.</li>
           </ol>
         </div>`;

    root.innerHTML = `
      <h1 class="h-view">Wer spielt mit?</h1>
      <p class="lead">Die jüngste Person beginnt. Mit den Pfeilen änderst du die Reihenfolge.</p>
      <div class="add">
        <input id="newName" class="input" type="text" maxlength="20" placeholder="Name" autocomplete="off" spellcheck="false" enterkeyhint="done" aria-label="Name der neuen Person">
        <button type="button" class="btn btn-pen" data-act="add">Hinzufügen</button>
      </div>
      ${listHTML}
      <section class="records" aria-label="Bestenliste">
        <h2 class="h-sec">Bestenliste</h2>
        ${recHTML}
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

    let subHTML = sub ? `<div class="who-sub">${esc(sub)}</div>` : '';
    if (!hasP) subHTML = '<div class="who-sub">Ohne Spieler wird nichts eingetragen. <button type="button" class="link" data-act="tab" data-tab="players">Spieler hinzufügen</button></div>';
    else if (!cur) subHTML = '<div class="who-sub">Das Ergebnis steht im Block. <button type="button" class="link" data-act="tab" data-tab="block">Zum Ergebnis</button></div>';

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

    root.innerHTML = `
      <div class="turnbar"><div class="turn-who"><div class="who">${esc(who)}</div>${subHTML}</div>${meter}</div>
      <div class="tray">
        <div class="dice">${dice}</div>
        <div class="tray-foot"><span>${idle ? '' : 'Augensumme <b>' + sum(d.vals) + '</b>'}</span><span class="hint">${hint}</span></div>
      </div>
      <div class="controls">
        <button type="button" class="btn btn-pen btn-roll" data-act="roll" aria-keyshortcuts="Space"${rs.off ? ' disabled' : ''}><span class="rl">${esc(rs.label)}</span><small>${esc(rs.sub)}</small></button>
        <button type="button" class="btn btn-line btn-reset" data-act="reset" aria-label="Würfel zurücksetzen"${idle ? ' disabled' : ''}>${ICON.reset}<span>Zurücksetzen</span></button>
      </div>
      <p class="keys">Tastatur: <kbd>Leertaste</kbd> würfelt, <kbd>1</kbd> bis <kbd>6</kbd> hält oder löst einen Würfel, <kbd>M</kbd> schaltet den Ton an oder aus.</p>
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

  let padScroll = 0;
  function renderBlock() {
    const root = $('#view-block');
    const P = state.players;
    if (!P.length) {
      root.innerHTML = `
        <div class="empty-box">
          <p><b>Noch keine Spieler</b></p>
          <p>Trag zuerst ein, wer mitspielt. Dann bekommt jede Person hier ihre eigene Spalte.</p>
          <button type="button" class="btn btn-pen" data-act="tab" data-tab="players">Spieler hinzufügen</button>
        </div>`;
      return;
    }
    const cur = currentPlayer();
    const T = {};
    P.forEach(p => { T[p.id] = totals(p.id); });
    const best = Math.max.apply(null, P.map(p => T[p.id].total));
    const started = anyScores();
    const over = isOver();
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

    let endHTML = '';
    if (over) {
      const ranking = P.map(p => ({ p, s: T[p.id].total })).sort((a, b) => b.s - a.s);
      const top = ranking[0].s;
      const winners = ranking.filter(r => r.s === top).map(r => r.p.name);
      let place = 0;
      let last = null;
      const items = ranking.map((r, i) => {
        if (r.s !== last) { place = i + 1; last = r.s; }
        return `<li><span class="pl">${place}.</span><span class="pn">${esc(r.p.name)}</span><span class="ps">${r.s}</span></li>`;
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
      endHTML = `<section class="end" aria-label="Ergebnis"><h2>${esc(title)}</h2><p>${esc(note)}</p>${P.length > 1 ? `<ol class="rank">${items}</ol>` : ''}<button type="button" class="btn btn-pen" data-act="new-game">Neues Spiel starten</button></section>`;
    }

    root.innerHTML = `${endHTML}
      <div class="pad" style="--n:${P.length};--pcols:repeat(${P.length}, minmax(var(--cw), 1fr))">
        <div class="pad-top" aria-hidden="true"></div>
        <div class="pad-head">
          <div class="pad-corner"></div>
          <div class="pad-vp"><div class="pad-names">${P.map(p => `<div class="pad-name${turn(p)}" title="${esc(p.name)}">${esc(p.name)}</div>`).join('')}</div></div>
        </div>
        <div class="p-body"><div class="p-grid">${rows}</div></div>
      </div>
      <p class="pad-hint">Tippe auf ein Feld, um Punkte einzutragen oder zu ändern.</p>`;

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
    toast('Rückgängig gemacht');
  }

  /* ---------- Sheet ---------- */
  let sheetFns = {};
  let sheetGen = 0;
  let sheetReturn = null;

  // Ist ein Fenster offen, ist die Seite dahinter für Tastatur und Screenreader gesperrt.
  function updateInert() {
    const modal = !$('#sheet').hidden || !$('#cd').hidden;
    $('.app').inert = modal;
    $('.tabbar').inert = modal;
  }

  function openSheet(html, fns) {
    const wrap = $('#sheet');
    sheetGen++;
    sheetFns = fns || {};
    if (wrap.hidden) sheetReturn = document.activeElement;
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
  function addPlayer() {
    const inp = $('#newName');
    if (!inp) return;
    const name = inp.value.replace(/\s+/g, ' ').trim().slice(0, 20);
    if (!name) {
      inp.classList.remove('shake');
      void inp.offsetWidth;
      inp.classList.add('shake');
      inp.focus();
      return;
    }
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
    dropStrayRoll();
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

  function confirmNewGame() {
    openSheet(`
      <h3 class="s-title">Neues Spiel starten?</h3>
      <p class="s-note">Alle Punkte werden gelöscht und die Würfel zurückgesetzt. Die Spieler bleiben dabei.</p>
      <div class="s-acts">
        <button type="button" class="btn btn-danger" data-act="sheet-do" data-do="ok">Neues Spiel starten</button>
        <button type="button" class="btn btn-quiet" data-act="sheet-close">Abbrechen</button>
      </div>`, {
      ok: () => {
        const snap = snapshot();
        state.scores = {};
        state.cds = {};
        state.dice = freshDice();
        state.cdGame = null;
        state.gameId = uid();
        closeSheet();
        save();
        render();
        toast('Neues Spiel gestartet', snap);
      },
    });
  }

  function confirmClearRecords() {
    openSheet(`
      <h3 class="s-title">Bestenliste leeren?</h3>
      <p class="s-note">Alle gespeicherten Ergebnisse werden gelöscht.</p>
      <div class="s-acts">
        <button type="button" class="btn btn-danger" data-act="sheet-do" data-do="ok">Bestenliste leeren</button>
        <button type="button" class="btn btn-quiet" data-act="sheet-close">Abbrechen</button>
      </div>`, {
      ok: () => {
        const snap = snapshot();
        state.history = {};
        state.skipHist = state.gameId;
        closeSheet();
        save();
        render();
        toast('Bestenliste geleert', snap);
      },
    });
  }

  /* ---------- Hell / Dunkel ---------- */
  const THEME_KEY = 'hexa-theme';
  const THEME_COLOR = { light: '#EDEFF4', dark: '#0D1020' };
  const darkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function chosenTheme() {
    const t = document.documentElement.getAttribute('data-theme');
    return t === 'light' || t === 'dark' ? t : null;
  }
  const isDark = () => (chosenTheme() || (darkMQ && darkMQ.matches ? 'dark' : 'light')) === 'dark';

  function syncTheme() {
    const t = chosenTheme();
    $('#themeBtn').setAttribute('aria-checked', isDark() ? 'true' : 'false');
    $$('meta[name="theme-color"]').forEach(m => {
      const own = /dark/.test(m.getAttribute('media') || '') ? 'dark' : 'light';
      m.setAttribute('content', THEME_COLOR[t || own]);
    });
  }

  function syncSound() {
    $('#soundBtn').setAttribute('aria-pressed', Sound.isMuted() ? 'true' : 'false');
  }
  function toggleSound() {
    Sound.setMuted(!Sound.isMuted());
    syncSound();
  }

  function toggleTheme() {
    const next = isDark() ? 'light' : 'dark';
    const apply = () => {
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* Speicher gesperrt */ }
      syncTheme();
    };
    if (document.startViewTransition && !reduced()) {
      try { document.startViewTransition(apply); return; } catch (e) { /* ohne Überblendung */ }
    }
    apply();
  }

  function setTab(tab) {
    if (TABS.indexOf(tab) < 0) return;
    // Schon sichtbar (auch als eine Hälfte der Zwei-Spalten-Ansicht): nur nach oben scrollen.
    if (tab === state.tab || (duoOn() && PAIR.indexOf(tab) >= 0)) {
      if (state.tab !== tab) { state.tab = tab; save(); }
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
      case 'theme': toggleTheme(); break;
      case 'sound': toggleSound(); break;
      case 'roll': roll(); break;
      case 'reset': resetDice(); break;
      case 'hold': toggleHold(Number(t.dataset.i)); break;
      case 'quick': openQuick(t.dataset.key); break;
      case 'cell': openFieldSheet(t.dataset.pid, t.dataset.key); break;
      case 'cd-cell': openCdSheet(t.dataset.pid); break;
      case 'add': addPlayer(); break;
      case 'up': movePlayer(t.dataset.pid, -1); break;
      case 'down': movePlayer(t.dataset.pid, 1); break;
      case 'remove': removePlayer(t.dataset.pid); break;
      case 'new-game': confirmNewGame(); break;
      case 'clear-records': confirmClearRecords(); break;
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
      if (!e.repeat) toggleSound();
      return true;
    }
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
    if (e.key !== 'Enter' || !t) return;
    if (t.id === 'newName') { e.preventDefault(); addPlayer(); }
    else if (t.classList && t.classList.contains('pname')) { e.preventDefault(); t.blur(); }
  });

  // Verhindert, dass die Leertaste zusätzlich den fokussierten Knopf auslöst.
  document.addEventListener('keyup', e => {
    if (spaceTaken && isSpace(e)) { e.preventDefault(); spaceTaken = false; }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (!t || !t.classList || !t.classList.contains('pname')) return;
    const p = playerById(t.dataset.pid);
    if (!p) return;
    const v = t.value.replace(/\s+/g, ' ').trim().slice(0, 20);
    if (v) { p.name = v; save(); }
  });

  document.addEventListener('change', e => {
    const t = e.target;
    if (!t || !t.classList || !t.classList.contains('pname')) return;
    const p = playerById(t.dataset.pid);
    if (!p) return;
    const v = t.value.replace(/\s+/g, ' ').trim().slice(0, 20);
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
  syncSound();
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

  render();
})();
