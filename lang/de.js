/* HEXA – Deutsche Texte (Hauptsprache).
   Alle Sprachen haben dieselben Einträge, ein Test prüft das (tests/lang.test.js).
   {name}, {n} usw. sind Platzhalter. Steht ein Text als { one, other } da, wählt die App je nach Anzahl {n}.
   Texte mit <b>, <kbd> oder in den Regeln sind HTML. */
(function (root) {
  'use strict';

  const texts = {
    name: 'Deutsch',
    locale: 'de-DE',

    common: {
      cancel: 'Abbrechen',
      close: 'Schließen',
      done: 'Fertig',
      save: 'Speichern',
      undo: 'Rückgängig',
      undone: 'Rückgängig gemacht',
      soon: 'Bald verfügbar',
      dialog: 'Eingabe',
      and: 'und',
      toMenu: 'Zum Hauptmenü',
      points: { one: '{n} Punkt', other: '{n} Punkte' },
      diceRow: 'Würfel {list}',
    },

    start: {
      claim: 'Sechs Würfel. Drei Würfe. Ein Countdown.',
      modes: 'Spielmodus',
      local: 'Lokal',
      localNew: 'Ein Gerät, reihum spielen',
      localOver: 'Spiel beendet · Ergebnis ansehen',
      localResume: 'Weiterspielen · Runde {r} von {total}',
      online: 'Online',
      onlineSoon: 'Online spielen kommt bald.',
      scores: 'Highscores',
      settings: 'Einstellungen',
    },

    top: {
      home: 'Zum Hauptmenü',
      settings: 'Einstellungen',
      overLong: 'Spiel beendet',
      overMid: 'Beendet',
      overShort: 'Ende',
      roundLong: 'Runde {r} von {total}',
      roundMid: 'Runde {r}/{total}',
      roundShort: '{r}/{total}',
    },

    tabs: {
      label: 'Bereiche',
      menu: 'Menü',
      menuTitle: 'Zurück ins Hauptmenü',
      dice: 'Würfel',
      block: 'Block',
      rules: 'Regeln',
      openBlock: 'Block daneben öffnen',
      openDice: 'Würfel daneben öffnen',
      closeDuo: 'Nebeneinander schließen',
    },

    views: {
      players: 'Spieler',
      dice: 'Würfel',
      block: 'Spielblock',
      rules: 'Regeln',
    },

    setup: {
      back: 'Hauptmenü',
      title: 'Wer spielt mit?',
      lead: 'Die jüngste Person beginnt. Mit den Pfeilen änderst du die Reihenfolge.',
      placeholder: 'Name',
      newName: 'Name der neuen Person',
      add: 'Hinzufügen',
      nameOf: 'Name von Person {n}',
      up: '{name} nach oben',
      down: '{name} nach unten',
      remove: '{name} entfernen',
      howTitle: 'So spielst du mit der App',
      how1: 'Trag oben alle Namen ein. Computergegner holst du dir mit „Bot hinzufügen“ dazu.',
      how2: 'Wähle, ob ihr mit der App oder mit euren eigenen Würfeln spielt.',
      how3: 'Die App führt den Spielblock und rechnet alles aus.',
      viaTitle: 'Womit würfelt ihr?',
      viaNote: 'Den Würfel-Tab habt ihr in beiden Fällen dabei.',
      viaNeed: 'Trag zuerst mindestens eine Person ein.',
      app: 'Mit der App',
      appSub: 'Die App würfelt für euch',
      own: 'Mit eigenen Würfeln',
      ownSub: 'Ihr würfelt selbst, die App führt den Block',
      fallback: 'Spieler',
      addBot: 'Bot hinzufügen',
      botsFull: 'Alle Bots sind schon dabei',
      botTag: ', Bot',
      viaBots: 'Mit Bots würfelt ihr mit der App.',
    },

    dice: {
      free: 'Freies Würfeln',
      over: 'Spiel beendet',
      turn: '{name} ist dran',
      entered: 'Eingetragen für {name}.',
      allPlayed: 'Alle Runden sind gespielt.',
      noPlayers: 'Ohne Spieler wird nichts eingetragen.',
      threeRolls: '3 Würfe',
      rollOf: 'Wurf {n} von 3',
      die: 'Würfel {n}',
      dieValue: 'Würfel {n}: {v}',
      dieHeld: 'Würfel {n}: {v}, bleibt liegen',
      hintIdle: 'Tippe auf Würfeln.',
      hintDone: 'Der Zug ist eingetragen.',
      hintNoRolls: 'Alle drei Würfe gemacht.',
      hintHold: 'Tippe an, was liegen bleibt.',
      sum: 'Augensumme <b>{n}</b>',
      roll: 'Würfeln',
      nextTurn: 'Nächster Zug: {name}',
      newTurn: 'Neuer Zug',
      allSix: 'Mit allen 6 Würfeln',
      noMore: 'Keine Würfe mehr',
      enterResult: 'Trag dein Ergebnis ein',
      allHeld: 'Alle Würfel liegen',
      tapToRelease: 'Tippe einen an, um ihn zu lösen',
      rollAgain: 'Nochmal würfeln',
      left: { one: '{n} Würfel', other: '{n} Würfel' },
      leftLast: { one: '{n} Würfel, letzter Wurf', other: '{n} Würfel, letzter Wurf' },
      keys: 'Tastatur: <kbd>Leertaste</kbd> würfelt, <kbd>1</kbd> bis <kbd>6</kbd> hält oder löst einen Würfel, <kbd>M</kbd> schaltet alle Töne an oder aus.',
      entryLabel: 'Ergebnis eintragen',
      entryTitle: 'Eintragen für {name}',
      noPoints: 'Kein freies Feld bringt Punkte. Streich eins mit 0.',
      zeros: 'Mit 0 Punkten streichen ({n})',
    },

    cdStrip: {
      running: 'Countdown läuft',
      runningText: 'Stufe {stage} von 6, bisher {pts}.',
      resume: 'Weiterspielen',
      over: 'Countdown beendet',
      waiting: '{pts} warten aufs Eintragen.',
      none: 'Keine Stufe geschafft.',
      enter: 'Eintragen',
      finish: 'Abschließen',
      unlocked: 'Countdown freigeschaltet',
      unlockedFirst: 'Mindestens 4 gleiche im ersten Wurf. Trag erst deinen Zug ein, dann geht es los.',
      unlockedNow: 'Mindestens 4 gleiche im ersten Wurf. Jetzt kannst du den Countdown spielen.',
      play: 'Countdown spielen',
    },

    end: {
      label: 'Spielende',
      title: 'Alle Runden gespielt',
      noteDice: 'Im Block könnt ihr vorher alles noch einmal prüfen.',
      noteBlock: 'Prüft den Block noch einmal. Danach seht ihr das Ergebnis.',
      button: 'Spiel beenden',
    },

    block: {
      emptyTitle: 'Noch keine Spieler',
      emptyText: 'Starte im Hauptmenü ein neues Spiel und trag ein, wer mitspielt.',
      upper: 'Oberer Block',
      lower: 'Unterer Block',
      sumUpper: 'Summe oben',
      sumLower: 'Summe unten',
      bonus: 'Bonus',
      bonusReq: 'ab 70 oben',
      bonusLeft: 'noch {n}',
      countdown: 'Countdown',
      countdownReq: '10 pro Stufe',
      total: 'Endstand',
      cellEmpty: '{name}, {field}: leer',
      cellValue: '{name}, {field}: {pts}',
      editName: '{name} umbenennen oder entfernen',
      botName: 'Bot {name} entfernen',
      hint: 'Tippe auf ein Feld, um Punkte einzutragen oder zu ändern. Über einen Namen kannst du die Person umbenennen oder entfernen.',
    },

    fields: {
      u1: { name: 'Einser', plural: 'Einsen' },
      u2: { name: 'Zweier', plural: 'Zweien' },
      u3: { name: 'Dreier', plural: 'Dreien' },
      u4: { name: 'Vierer', plural: 'Vieren' },
      u5: { name: 'Fünfer', plural: 'Fünfen' },
      u6: { name: 'Sechser', plural: 'Sechsen' },
      pasch5: { name: 'Fünferpasch', req: 'mind. 5 gleiche' },
      pasch6: { name: 'Sechserpasch', req: '6 gleiche' },
      paare: { name: 'Drei Paare', req: '3 Paare' },
      drillinge: { name: 'Zwei Drillinge', req: '2 Drillinge' },
      kstrasse: { name: 'Kleine Straße', req: '5 in Folge' },
      gstrasse: { name: 'Große Straße', req: '1 bis 6' },
      tief: { name: 'Tiefflug', req: 'nur 1 bis 3' },
      hoch: { name: 'Höhenflug', req: 'nur 4 bis 6' },
      chance: { name: 'Chance', req: 'Augensumme' },
    },

    quick: {
      for: 'für {name}',
      pts: { one: 'Punkt', other: 'Punkte' },
      zero: 'Punkte, das Feld wird gestrichen',
      enter: 'Eintragen',
      strike: 'Streichen',
      entered: '{field}: {n} eingetragen',
      struck: '{field}: gestrichen',
      cleared: '{field}: Eintrag gelöscht',
    },

    field: {
      howMany: 'Wie viele {plural} hast du?',
      req: 'Voraussetzung: {req}.',
      sum: 'Wähle die Augensumme.',
      made: 'geschafft',
      strike: 'streichen',
      times: '{k} × {n}',
      matches: 'passt zu deinem aktuellen Wurf',
      clear: 'Eintrag löschen',
    },

    cdSheet: {
      none: 'Noch kein Countdown eingetragen.',
      one: 'Bisher {pts}.',
      many: 'Bisher {list} = {pts}.',
      question: 'Wie viele Stufen hast du geschafft?',
      stages: { one: '{n} Stufe', other: '{n} Stufen' },
      pop: 'Letzten Countdown löschen',
      added: 'Countdown: {pts} eingetragen',
      popped: 'Letzter Countdown gelöscht',
    },

    askCd: {
      title: 'Countdown noch offen',
      text: 'Du hast den Countdown freigeschaltet, aber noch nicht zu Ende gespielt. Wenn du jetzt weitermachst, verfällt er.',
      play: 'Countdown spielen',
      drop: 'Countdown verfallen lassen',
    },

    cd: {
      title: 'Countdown',
      close: 'Countdown schließen',
      for: 'für {name}',
      intro: 'Von 6 bis 1 herunterzählen',
      pts: { one: '<b>{n}</b> Punkt', other: '<b>{n}</b> Punkte' },
      stages: 'Stufen',
      stage: 'Stufe {i}, eine {n}: {st}',
      stOpen: 'offen',
      stDone: 'geschafft',
      stFail: 'verpasst',
      stNow: 'jetzt',
      hit: 'Treffer! 10 Punkte dazu.',
      need: 'Stufe {stage}: Du brauchst eine {n}.',
      rollWith: 'Du würfelst mit {dice}, Trefferchance {p} %.',
      diceWith: { one: '{n} Würfel', other: '{n} Würfeln' },
      miss: 'Keine {n} dabei.',
      overText: 'Der Countdown ist vorbei.',
      perfect: 'Alle sechs Stufen geschafft!',
      perfectText: 'Das gelingt nur in etwa 0,4 % der Countdowns.',
      roll: 'Würfeln',
      rollSub: { one: '{n} Würfel, gesucht: eine {n}', other: '{n} Würfel, gesucht: eine {n}' },
      result: 'Punkte im Countdown',
      none: 'Keine Stufe geschafft.',
      enterFor: 'Eintragen für',
      enter: 'Eintragen',
      skip: 'Nicht eintragen',
      aside: 'Zur Seite gelegt',
      saved: 'Countdown: {pts} für {name} eingetragen',
      ended: 'Countdown beendet',
    },

    player: {
      label: 'Spieler bearbeiten',
      name: 'Name',
      remove: 'Aus dem Spiel entfernen',
      alone: 'Allein kannst du dich nicht entfernen. Zum Aufhören tippe unten auf Menü und brich das Spiel ab.',
      renamed: '{old} heißt jetzt {name}',
      removed: '{name} entfernt',
      askLabel: 'Spieler entfernen',
      askTitle: '{name} entfernen?',
      askText: 'Für {name} ist schon etwas eingetragen ({what}, {pts}). Beim Entfernen werden diese Einträge gelöscht.',
      fields: { one: '{n} Feld', other: '{n} Felder' },
      aCountdown: 'ein Countdown',
      askOk: 'Entfernen und Punkte löschen',
      botText: '{name} ist ein Bot und spielt von allein. Den Namen kann man nicht ändern.',
    },

    bot: {
      ready: '{name} legt gleich los …',
      think: '{name} überlegt …',
      roll: '{name} würfelt …',
      enter: '{name} trägt ein …',
      button: '{name} spielt',
      buttonSub: 'Einen Moment',
      hint: 'Bots spielen ihren Zug selbst.',
      entered: '{name}: {field}, {pts}',
      struck: '{name} streicht {field}',
      cell: '{name} ist ein Bot und trägt selbst ein.',
      cdPlays: '{name} spielt den Countdown …',
      cdNeed: 'Stufe {stage}: {name} braucht eine {n}.',
      cdRollWith: 'Gewürfelt wird mit {dice}, Trefferchance {p} %.',
    },

    pause: {
      label: 'Zurück ins Hauptmenü',
      title: 'Zurück ins Hauptmenü?',
      round: 'Ihr seid in Runde {r} von {total}.',
      cdOpen: 'Alle Runden sind gespielt, nur der Countdown ist noch offen.',
      pause: 'Pausieren',
      pauseSub: 'Das Spiel bleibt gespeichert. Im Menü geht es mit „Lokal“ weiter.',
      abort: 'Spiel abbrechen',
      abortSub: 'Alle Punkte werden gelöscht. Es gibt keinen Highscore.',
      back: 'Zurück zum Spiel',
      aborted: 'Spiel abgebrochen',
    },

    result: {
      label: 'Ergebnis',
      record: 'Neuer Rekord',
      soloAbove: 'Das liegt über dem Richtwert von rund 300 Punkten.',
      soloBelow: 'Richtwert für ein ordentliches Spiel: rund 300 Punkte.',
      tie: 'Gleichstand',
      tieText: '{names} teilen sich den Sieg mit {n} Punkten.',
      wins: '{name} gewinnt',
      winsText: { one: 'Mit {n} Punkt.', other: 'Mit {n} Punkten.' },
      savedOne: 'Das Ergebnis steht in den Highscores. Gespeichert wird nur auf diesem Gerät.',
      savedMany: 'Die Ergebnisse stehen in den Highscores. Gespeichert wird nur auf diesem Gerät.',
      notSaved: 'Dieses Spiel steht nicht in den Highscores, weil die Liste gerade geleert wurde.',
      botsNot: 'Bots kommen nicht in die Highscores.',
      again: 'Nochmal spielen',
      started: 'Neues Spiel gestartet',
    },

    scores: {
      title: 'Highscores',
      local: 'Lokal',
      online: 'Online',
      note: 'Die zehn besten Ergebnisse, nur auf diesem Gerät gespeichert.',
      clear: 'Liste leeren',
      emptyTitle: 'Noch keine Highscores',
      emptyText: 'Nach dem ersten kompletten Spiel stehen hier die zehn besten Ergebnisse.',
      onlineTitle: 'Online-Highscores kommen bald',
      onlineText: 'Sobald man online spielen kann, seht ihr hier die Besten von überall.',
      clearTitle: 'Highscores leeren?',
      clearText: 'Alle gespeicherten Ergebnisse auf diesem Gerät werden gelöscht.',
      clearOk: 'Highscores leeren',
      cleared: 'Highscores geleert',
    },

    settings: {
      title: 'Einstellungen',
      design: 'Design',
      light: 'Hell',
      dark: 'Dunkel',
      auto: 'Automatisch',
      sky: 'Fallende Würfel',
      sound: 'Töne',
      music: 'Musik',
      fx: 'Spielsounds',
      volume: 'Lautstärke {name}',
      percent: '{n} %',
      keys: 'Mit <kbd>M</kbd> schaltest du alle Töne an oder aus.',
      language: 'Sprache',
      soundOn: 'Töne an',
      soundOff: 'Töne aus',
    },

    rules: {
      claim: ['Sechs Würfel.', 'Drei Würfe.', 'Ein Countdown.'],
      facts: 'Für eine oder mehr Personen ab 8 Jahren. Eine Partie dauert etwa 20 bis 40 Minuten.',
      sections: [
        {
          title: 'Kurzübersicht',
          html: `
          <dl class="brief">
            <dt>Ziel</dt><dd>In 15 Runden möglichst viele Punkte sammeln.</dd>
            <dt>Dein Zug</dt><dd>Bis zu 3 Würfe. Dazwischen beliebig viele Würfel zur Seite legen – oder wieder mitwürfeln.</dd>
            <dt>Eintragen</dt><dd>Pro Zug genau ein freies Feld. Voraussetzung nicht erfüllt: 0 Punkte.</dd>
            <dt>Bonus</dt><dd>Oberer Block mindestens 70 Punkte → 40 Bonuspunkte.</dd>
            <dt>Countdown</dt><dd>Mindestens 4 gleiche im ersten Wurf → nach dem Zug von 6 bis 1 herunterzählen, 10 Punkte pro geschaffter Stufe.</dd>
            <dt>Endstand</dt><dd>Summe oben + Bonus + Summe unten + Countdown.</dd>
          </dl>`,
        },
        {
          title: 'Worum geht’s?',
          html: `
          <p>Bei HEXA würfelst du um die besten Kombinationen: Pasche, Straßen, Paare und Drillinge – oder einfach um möglichst viele Augen. In 15 Runden füllst du deinen Spielblock Feld für Feld. Doch Vorsicht: Jedes Feld darfst du nur ein einziges Mal belegen.</p>
          <p>Wer geschickt plant, holt sich im oberen Block einen dicken Bonus. Und wer schon im ersten Wurf vier gleiche Zahlen hat, darf zusätzlich den <b>Countdown</b> spielen.</p>
          <p><b>Ziel des Spiels:</b> Sammle in 15 Runden möglichst viele Punkte. Wer am Ende die meisten hat, gewinnt.</p>`,
        },
        {
          title: 'Material und Vorbereitung',
          html: `
          <h4>Spielmaterial</h4>
          <ul>
            <li>6 Würfel</li>
            <li>1 Spielblock</li>
            <li>1 Stift</li>
          </ul>
          <h4>Vorbereitung</h4>
          <p>Jede Person bekommt eine eigene Spalte auf dem Spielblock und schreibt ihren Namen darüber. Legt Würfel und Stift bereit. Die jüngste Person beginnt, danach geht es reihum im Uhrzeigersinn weiter.</p>`,
        },
        {
          title: 'Spielablauf',
          html: `
          <p>Das Spiel dauert 15 Runden. In jeder Runde ist jede Person genau einmal am Zug.</p>
          <h4>So läuft dein Zug</h4>
          <ol>
            <li><b>Würfeln:</b> Würfle mit allen 6 Würfeln.</li>
            <li><b>Zur Seite legen und nachwürfeln:</b> Lege beliebig viele Würfel zur Seite und würfle den Rest noch einmal. Das darfst du bis zu zweimal machen – du hast also höchstens <b>3 Würfe</b> pro Zug.
              <ul>
                <li>Zur Seite gelegte Würfel darfst du beim nächsten Wurf auch wieder mitwürfeln.</li>
                <li>Du kannst jederzeit früher aufhören, auch schon nach dem ersten Wurf.</li>
              </ul>
            </li>
            <li><b>Eintragen:</b> Wähle ein freies Feld auf deinem Block und trage dort deine Punkte ein. Danach ist die nächste Person dran.</li>
          </ol>
          <h4>Regeln zum Eintragen</h4>
          <ul>
            <li>In jedem Zug füllst du <b>genau ein</b> Feld aus.</li>
            <li>Jedes Feld wird im ganzen Spiel <b>nur einmal</b> ausgefüllt.</li>
            <li>Erfüllt dein Wurf die Voraussetzung des gewählten Feldes nicht, trägst du dort <b>0 Punkte</b> ein. Das Feld ist damit gestrichen.</li>
            <li>Nach 15 Runden sind alle Felder voll und das Spiel ist vorbei.</li>
          </ul>
          <div class="eg">
            <p><b>Beispiel:</b> Lena würfelt 2-3-3-5-5-6.</p>
            <span class="dice-row" data-dice="233556"></span>
            <p>Sie möchte eine Straße, legt 2, 3, 5 und 6 zur Seite und würfelt die übrigen zwei Würfel noch einmal. Es kommen eine 1 und eine 4 – jetzt hat sie 1-2-3-4-5-6, eine Große Straße!</p>
            <span class="dice-row" data-dice="123456"></span>
            <p>Lena hört auf und trägt bei der Großen Straße 40 Punkte ein. Sie dürfte die Straße auch als Kleine Straße werten, bekäme dort aber nur 25 Punkte.</p>
          </div>`,
        },
        {
          title: 'Die Felder',
          html: `
          <p>Dein Spielblock hat 15 Felder: 6 im oberen und 9 im unteren Block.</p>
          <h4>Oberer Block</h4>
          <p>Hier zählst du nur die Würfel mit der passenden Zahl zusammen. Eine Voraussetzung gibt es nicht.</p>
          <div class="tbl-wrap">
            <table class="t">
              <thead><tr><th>Feld</th><th>Du bekommst</th><th class="n">Maximal</th></tr></thead>
              <tbody>
                <tr><td>Einser</td><td>alle Einsen zusammengezählt</td><td class="n">6</td></tr>
                <tr><td>Zweier</td><td>alle Zweien zusammengezählt</td><td class="n">12</td></tr>
                <tr><td>Dreier</td><td>alle Dreien zusammengezählt</td><td class="n">18</td></tr>
                <tr><td>Vierer</td><td>alle Vieren zusammengezählt</td><td class="n">24</td></tr>
                <tr><td>Fünfer</td><td>alle Fünfen zusammengezählt</td><td class="n">30</td></tr>
                <tr><td>Sechser</td><td>alle Sechsen zusammengezählt</td><td class="n">36</td></tr>
              </tbody>
            </table>
          </div>
          <div class="eg">
            <p><b>Beispiel:</b> Du hast 1-2-4-4-4-6 und trägst bei den Vierern ein: 4 + 4 + 4 = <b>12 Punkte</b>.</p>
            <span class="dice-row" data-dice="124446"></span>
          </div>
          <p><b>Bonus:</b> Hast du im oberen Block insgesamt <b>mindestens 70 Punkte</b>, bekommst du <b>40 Bonuspunkte</b> obendrauf.</p>

          <h4>Unterer Block</h4>
          <p>Hier brauchst du bestimmte Kombinationen. Klappt es, gibt es feste Punkte – nur bei der Chance zählt die Augensumme.</p>
          <div class="fields">
            <div class="fitem"><span class="fn">Fünferpasch</span><span class="fp">40</span><span class="fr">mindestens 5 gleiche</span><span class="dice-row" data-dice="444442"></span></div>
            <div class="fitem"><span class="fn">Sechserpasch</span><span class="fp">75</span><span class="fr">6 gleiche</span><span class="dice-row" data-dice="555555"></span></div>
            <div class="fitem"><span class="fn">Drei Paare</span><span class="fp">30</span><span class="fr">3 Paare (je 2 gleiche)</span><span class="dice-row" data-dice="224455"></span></div>
            <div class="fitem"><span class="fn">Zwei Drillinge</span><span class="fp">40</span><span class="fr">2 Drillinge (je 3 gleiche)</span><span class="dice-row" data-dice="333666"></span></div>
            <div class="fitem"><span class="fn">Kleine Straße</span><span class="fp">25</span><span class="fr">5 in Folge: 1-2-3-4-5 oder 2-3-4-5-6</span><span class="dice-row" data-dice="123345"></span></div>
            <div class="fitem"><span class="fn">Große Straße</span><span class="fp">40</span><span class="fr">1-2-3-4-5-6</span><span class="dice-row" data-dice="123456"></span></div>
            <div class="fitem"><span class="fn">Tiefflug</span><span class="fp">25</span><span class="fr">jeder Würfel zeigt 1, 2 oder 3</span><span class="dice-row" data-dice="112333"></span></div>
            <div class="fitem"><span class="fn">Höhenflug</span><span class="fp">25</span><span class="fr">jeder Würfel zeigt 4, 5 oder 6</span><span class="dice-row" data-dice="444566"></span></div>
            <div class="fitem"><span class="fn">Chance</span><span class="fp">Augensumme</span><span class="fr">keine Voraussetzung (im Beispiel 26)</span><span class="dice-row" data-dice="234566"></span></div>
          </div>
          <h4>Gut zu wissen</h4>
          <ul>
            <li>Ein <b>Vierling</b> zählt bei den Drei Paaren als zwei Paare. 4-4-4-4-2-2 ist also gültig.</li>
            <li><b>Sechs gleiche</b> zählen auch als Fünferpasch, als Drei Paare oder als Zwei Drillinge.</li>
            <li>Eine <b>Große Straße</b> zählt auch als Kleine Straße.</li>
            <li>Beim Tiefflug und Höhenflug müssen <b>nicht alle drei Zahlen</b> vorkommen. <span class="nowrap">1-1-1-1-1-1</span> ist also auch ein Tiefflug.</li>
          </ul>`,
        },
        {
          title: 'Countdown (Bonusspiel)',
          html: `
          <p>Würfelst du im <b>ersten Wurf</b> eines Zuges <b>mindestens 4 gleiche Zahlen</b>, darfst du nach deinem Zug den Countdown spielen.</p>
          <p>Spiele zuerst deinen Zug ganz normal zu Ende und trage dein Ergebnis ein. Die gleichen Würfel müssen dafür nicht liegen bleiben – es zählt nur, dass sie im ersten Wurf da waren.</p>
          <h4>So geht’s</h4>
          <p>Beim Countdown zählst du von 6 bis 1 herunter. In jeder Stufe suchst du eine bestimmte Zahl. Dabei würfelst du immer mit genau so vielen Würfeln, wie die gesuchte Zahl anzeigt:</p>
          <div class="tbl-wrap">
            <table class="t">
              <thead><tr><th>Stufe</th><th>Würfel</th><th>Du brauchst</th></tr></thead>
              <tbody>
                <tr><td>1</td><td>6</td><td>eine 6</td></tr>
                <tr><td>2</td><td>5</td><td>eine 5</td></tr>
                <tr><td>3</td><td>4</td><td>eine 4</td></tr>
                <tr><td>4</td><td>3</td><td>eine 3</td></tr>
                <tr><td>5</td><td>2</td><td>eine 2</td></tr>
                <tr><td>6</td><td>1</td><td>eine 1</td></tr>
              </tbody>
            </table>
          </div>
          <p>Pro Stufe hast du <b>genau einen Wurf</b>:</p>
          <ul>
            <li><b>Die gesuchte Zahl ist dabei:</b> Lege einen Würfel mit dieser Zahl zur Seite. Die Stufe ist geschafft, und du machst mit den übrigen Würfeln weiter.</li>
            <li><b>Die gesuchte Zahl ist nicht dabei:</b> Der Countdown ist vorbei.</li>
          </ul>
          <h4>Punkte</h4>
          <p>Jede geschaffte Stufe bringt <b>10 Punkte</b>, insgesamt also höchstens 60. Trage sie in die Zeile „Countdown“ ganz unten auf dem Block ein.</p>
          <ul>
            <li>Spielst du im Laufe des Spiels mehrmals einen Countdown, werden die Punkte zusammengezählt.</li>
            <li>Countdown-Punkte zählen <b>nicht</b> für den Bonus im oberen Block.</li>
          </ul>
          <div class="eg">
            <p><b>Beispiel:</b> Dein erster Wurf ist 4-4-4-4-2-6 – vier Vieren! Du spielst deinen Zug zu Ende und trägst ein. Dann startet der Countdown:</p>
            <span class="dice-row" data-dice="444426"></span>
            <ul>
              <li><b>Stufe 1:</b> Du würfelst mit 6 Würfeln. Eine 6 ist dabei – geschafft!</li>
              <li><b>Stufe 2:</b> Du würfelst mit den übrigen 5 Würfeln. Eine 5 ist dabei – geschafft!</li>
              <li><b>Stufe 3:</b> Du würfelst mit 4 Würfeln. Keine 4 dabei – der Countdown ist vorbei.</li>
            </ul>
            <p>Du bekommst 2 × 10 = <b>20 Punkte</b>.</p>
          </div>`,
        },
        {
          title: 'Spielende und Wertung',
          html: `
          <p>Nach 15 Runden sind alle Felder ausgefüllt und das Spiel endet. Jetzt rechnet jede Person zusammen:</p>
          <div class="tbl-wrap">
            <table class="t">
              <thead><tr><th>Zeile</th><th>So wird gerechnet</th></tr></thead>
              <tbody>
                <tr><td>Summe oben</td><td>alle Punkte aus dem oberen Block</td></tr>
                <tr><td>Bonus</td><td>40 Punkte, wenn die Summe oben mindestens 70 ist, sonst 0</td></tr>
                <tr><td>Summe unten</td><td>alle Punkte aus dem unteren Block</td></tr>
                <tr><td>Countdown</td><td>alle Countdown-Punkte zusammen</td></tr>
                <tr class="strong"><td>Endstand</td><td>Summe oben + Bonus + Summe unten + Countdown</td></tr>
              </tbody>
            </table>
          </div>
          <p>Wer den höchsten Endstand hat, gewinnt. Bei Gleichstand teilt ihr euch den Sieg.</p>
          <h4>Beispiel: ein ausgefüllter Block</h4>
          <p>So stehen die Zeilen auf dem Spielblock. Eine 0 bedeutet: Das Feld wurde gestrichen.</p>
          <div class="tbl-wrap">
            <table class="t">
              <tbody>
                <tr><td>Einser</td><td class="n">3</td></tr>
                <tr><td>Zweier</td><td class="n">8</td></tr>
                <tr><td>Dreier</td><td class="n">12</td></tr>
                <tr><td>Vierer</td><td class="n">12</td></tr>
                <tr><td>Fünfer</td><td class="n">15</td></tr>
                <tr><td>Sechser</td><td class="n">24</td></tr>
                <tr class="strong"><td>Summe oben</td><td class="n">74</td></tr>
                <tr class="strong"><td>Bonus</td><td class="n">40</td></tr>
                <tr><td>Fünferpasch</td><td class="n">40</td></tr>
                <tr><td>Sechserpasch</td><td class="n">0</td></tr>
                <tr><td>Drei Paare</td><td class="n">30</td></tr>
                <tr><td>Zwei Drillinge</td><td class="n">0</td></tr>
                <tr><td>Kleine Straße</td><td class="n">25</td></tr>
                <tr><td>Große Straße</td><td class="n">0</td></tr>
                <tr><td>Tiefflug</td><td class="n">25</td></tr>
                <tr><td>Höhenflug</td><td class="n">25</td></tr>
                <tr><td>Chance</td><td class="n">23</td></tr>
                <tr class="strong"><td>Summe unten</td><td class="n">168</td></tr>
                <tr class="strong"><td>Countdown</td><td class="n">10</td></tr>
                <tr class="strong total"><td>Endstand</td><td class="n">292</td></tr>
              </tbody>
            </table>
          </div>
          <h4>Allein spielen</h4>
          <p>HEXA klappt auch solo: Versuche, deinen eigenen Rekord zu knacken. Als Richtwert: Ein ordentliches Spiel landet bei rund 300 Punkten.</p>`,
        },
        {
          title: 'Tipps',
          html: `
          <ul>
            <li><b>Plane den Bonus:</b> Hast du jede Zahl genau dreimal, kommst du nur auf 63 Punkte. Für den Bonus brauchst du also bei ein paar Feldern vier oder mehr gleiche.</li>
            <li><b>Die Chance als Rettung:</b> Passt ein Wurf nirgends richtig, trag ihn bei der Chance ein, statt ein anderes Feld zu streichen.</li>
            <li><b>Klug streichen:</b> Musst du doch einmal streichen, nimm am besten ein Feld, das sowieso selten klappt – zum Beispiel den Sechserpasch.</li>
          </ul>`,
        },
        {
          title: 'Zahlen für Neugierige',
          html: `
          <p>Alle Werte sind gerundet.</p>
          <h4>So oft klappt ein Feld ungefähr, wenn du in einem Zug gezielt darauf spielst</h4>
          <div class="bars">
            <div class="bar"><span>Kleine Straße</span><span class="track"><span class="fill" style="width:50%"></span></span><span class="pct">50 %</span></div>
            <div class="bar"><span>Tiefflug</span><span class="track"><span class="fill" style="width:45%"></span></span><span class="pct">45 %</span></div>
            <div class="bar"><span>Höhenflug</span><span class="track"><span class="fill" style="width:45%"></span></span><span class="pct">45 %</span></div>
            <div class="bar"><span>Drei Paare</span><span class="track"><span class="fill" style="width:29%"></span></span><span class="pct">29 %</span></div>
            <div class="bar"><span>Große Straße</span><span class="track"><span class="fill" style="width:20%"></span></span><span class="pct">20 %</span></div>
            <div class="bar"><span>Fünferpasch</span><span class="track"><span class="fill" style="width:16%"></span></span><span class="pct">16 %</span></div>
            <div class="bar"><span>Zwei Drillinge</span><span class="track"><span class="fill" style="width:16%"></span></span><span class="pct">16 %</span></div>
            <div class="bar"><span>Sechserpasch</span><span class="track"><span class="fill" style="width:2%"></span></span><span class="pct">2 %</span></div>
          </div>
          <h4>So weit kommt man beim Countdown</h4>
          <p>Chance, mindestens bis zu dieser Stufe zu kommen:</p>
          <div class="bars">
            <div class="bar"><span>Stufe 1</span><span class="track"><span class="fill" style="width:67%"></span></span><span class="pct">67 %</span></div>
            <div class="bar"><span>Stufe 2</span><span class="track"><span class="fill" style="width:40%"></span></span><span class="pct">40 %</span></div>
            <div class="bar"><span>Stufe 3</span><span class="track"><span class="fill" style="width:21%"></span></span><span class="pct">21 %</span></div>
            <div class="bar"><span>Stufe 4</span><span class="track"><span class="fill" style="width:9%"></span></span><span class="pct">9 %</span></div>
            <div class="bar"><span>Stufe 5</span><span class="track"><span class="fill" style="width:2.7%"></span></span><span class="pct">2,7 %</span></div>
            <div class="bar"><span>Stufe 6</span><span class="track"><span class="fill" style="width:0.4%"></span></span><span class="pct">0,4 %</span></div>
          </div>
          <h4>Und sonst?</h4>
          <ul>
            <li>Mindestens 4 gleiche im ersten Wurf – und damit einen Countdown – gibt es ungefähr in jedem 19. Zug.</li>
            <li>Ein Countdown bringt im Schnitt etwa 14 Punkte.</li>
            <li>Mit ordentlichem Spiel schafft man den Bonus im oberen Block in knapp der Hälfte der Partien.</li>
            <li>Ein ordentliches Spiel landet insgesamt bei rund 300 Punkten.</li>
          </ul>`,
        },
      ],
    },
  };

  if (typeof module === 'object' && module.exports) module.exports = texts;
  else (root.HexaLang = root.HexaLang || {}).de = texts;
})(typeof self !== 'undefined' ? self : this);
