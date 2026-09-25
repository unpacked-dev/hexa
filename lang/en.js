/* HEXA – Englische Texte (für alle, deren Browser nicht auf Deutsch steht).
   Gleiche Einträge wie lang/de.js. Fehlt hier etwas, zeigt die App den deutschen Text. */
(function (root) {
  'use strict';

  const texts = {
    name: 'English',
    locale: 'en-GB',

    common: {
      cancel: 'Cancel',
      close: 'Close',
      done: 'Done',
      save: 'Save',
      undo: 'Undo',
      undone: 'Undone',
      soon: 'Coming soon',
      dialog: 'Entry',
      and: 'and',
      toMenu: 'Main menu',
      points: { one: '{n} point', other: '{n} points' },
      diceRow: 'Dice {list}',
    },

    start: {
      claim: 'Six dice. Three rolls. One Countdown.',
      modes: 'Game mode',
      local: 'Local',
      localNew: 'One device, take turns',
      localOver: 'Game over · See the results',
      localResume: 'Continue · Round {r} of {total}',
      online: 'Online',
      onlineSoon: 'Online play is coming soon.',
      scores: 'High Scores',
      settings: 'Settings',
    },

    top: {
      home: 'Main menu',
      settings: 'Settings',
      overLong: 'Game over',
      overMid: 'Over',
      overShort: 'End',
      roundLong: 'Round {r} of {total}',
      roundMid: 'Round {r}/{total}',
      roundShort: '{r}/{total}',
    },

    tabs: {
      label: 'Sections',
      menu: 'Menu',
      menuTitle: 'Back to the main menu',
      dice: 'Dice',
      block: 'Scorecard',
      rules: 'Rules',
      openBlock: 'Open the scorecard alongside',
      openDice: 'Open the dice alongside',
      closeDuo: 'Close the side-by-side view',
    },

    views: {
      players: 'Players',
      dice: 'Dice',
      block: 'Scorecard',
      rules: 'Rules',
    },

    setup: {
      back: 'Main menu',
      title: 'Who’s playing?',
      lead: 'The youngest player goes first. Use the arrows to change the order.',
      placeholder: 'Name',
      newName: 'Name of the new player',
      add: 'Add',
      nameOf: 'Name of player {n}',
      up: 'Move {name} up',
      down: 'Move {name} down',
      remove: 'Remove {name}',
      howTitle: 'How to play with the app',
      how1: 'Enter everyone’s name above. Tap “Add a bot” for computer opponents.',
      how2: 'Choose whether you roll with the app or with your own dice.',
      how3: 'The app keeps the scorecard and does all the maths.',
      viaTitle: 'What are you rolling with?',
      viaNote: 'You’ll have the Dice tab either way.',
      viaNeed: 'Add at least one player first.',
      app: 'With the app',
      appSub: 'The app rolls for you',
      own: 'With your own dice',
      ownSub: 'You roll, the app keeps the scorecard',
      fallback: 'Player',
      addBot: 'Add a bot',
      botsFull: 'All bots are already playing',
      botTag: ', bot',
      viaBots: 'With bots, you roll with the app.',
    },

    dice: {
      free: 'Free rolling',
      over: 'Game over',
      turn: '{name}’s turn',
      entered: 'Scored for {name}.',
      allPlayed: 'All rounds have been played.',
      noPlayers: 'Without players, nothing gets scored.',
      threeRolls: '3 rolls',
      rollOf: 'Roll {n} of 3',
      die: 'Die {n}',
      dieValue: 'Die {n}: {v}',
      dieHeld: 'Die {n}: {v}, held',
      hintIdle: 'Tap Roll.',
      hintDone: 'This turn has been scored.',
      hintNoRolls: 'All three rolls used.',
      hintHold: 'Tap the dice you want to keep.',
      sum: 'Total <b>{n}</b>',
      roll: 'Roll',
      nextTurn: 'Next turn: {name}',
      newTurn: 'New turn',
      allSix: 'With all 6 dice',
      noMore: 'No rolls left',
      enterResult: 'Score your result',
      allHeld: 'All dice are held',
      tapToRelease: 'Tap one to release it',
      rollAgain: 'Roll again',
      left: { one: '{n} die', other: '{n} dice' },
      leftLast: { one: '{n} die, last roll', other: '{n} dice, last roll' },
      keys: 'Keyboard: <kbd>Space</kbd> rolls, <kbd>1</kbd> to <kbd>6</kbd> holds or releases a die, <kbd>M</kbd> turns all sound on or off.',
      entryLabel: 'Score your result',
      entryTitle: 'Score for {name}',
      noPoints: 'No open box scores any points. Cross one out with 0.',
      zeros: 'Cross out with 0 points ({n})',
    },

    cdStrip: {
      running: 'Countdown in progress',
      runningText: 'Stage {stage} of 6, {pts} so far.',
      resume: 'Continue',
      over: 'Countdown finished',
      waiting: '{pts} waiting to be scored.',
      none: 'No stage cleared.',
      enter: 'Score',
      finish: 'Finish',
      unlocked: 'Countdown unlocked',
      unlockedFirst: 'At least 4 of a kind on the first roll. Score your turn first, then it starts.',
      unlockedNow: 'At least 4 of a kind on the first roll. You can play the Countdown now.',
      play: 'Play Countdown',
    },

    end: {
      label: 'End of the game',
      title: 'All rounds played',
      noteDice: 'You can double-check everything on the scorecard first.',
      noteBlock: 'Check the scorecard once more. Then you’ll see the results.',
      button: 'End game',
    },

    block: {
      emptyTitle: 'No players yet',
      emptyText: 'Start a new game in the main menu and add who’s playing.',
      upper: 'Upper section',
      lower: 'Lower section',
      sumUpper: 'Upper total',
      sumLower: 'Lower total',
      bonus: 'Bonus',
      bonusReq: '70+ upper',
      bonusLeft: '{n} to go',
      countdown: 'Countdown',
      countdownReq: '10 per stage',
      total: 'Final score',
      cellEmpty: '{name}, {field}: empty',
      cellValue: '{name}, {field}: {pts}',
      editName: '{name}: rename or remove',
      botName: 'Remove bot {name}',
      hint: 'Tap a box to enter or change points. Tap a name to rename or remove that player.',
    },

    fields: {
      u1: { name: 'Ones', plural: 'ones' },
      u2: { name: 'Twos', plural: 'twos' },
      u3: { name: 'Threes', plural: 'threes' },
      u4: { name: 'Fours', plural: 'fours' },
      u5: { name: 'Fives', plural: 'fives' },
      u6: { name: 'Sixes', plural: 'sixes' },
      pasch5: { name: 'Five of a Kind', req: '5+ alike' },
      pasch6: { name: 'Six of a Kind', req: '6 alike' },
      paare: { name: 'Three Pairs', req: '3 pairs' },
      drillinge: { name: 'Two Triples', req: '2 triples' },
      kstrasse: { name: 'Small Straight', req: '5 in a row' },
      gstrasse: { name: 'Large Straight', req: '1 to 6' },
      tief: { name: 'Low Roll', req: 'only 1 to 3' },
      hoch: { name: 'High Roll', req: 'only 4 to 6' },
      chance: { name: 'Chance', req: 'dice total' },
    },

    quick: {
      for: 'for {name}',
      pts: { one: 'point', other: 'points' },
      zero: 'points, the box gets crossed out',
      enter: 'Score',
      strike: 'Cross out',
      entered: '{field}: {n} scored',
      struck: '{field}: crossed out',
      cleared: '{field}: entry deleted',
    },

    field: {
      howMany: 'How many {plural} do you have?',
      req: 'Requirement: {req}.',
      sum: 'Pick the dice total.',
      made: 'made it',
      strike: 'cross out',
      times: '{k} × {n}',
      matches: 'matches your current roll',
      clear: 'Delete entry',
    },

    cdSheet: {
      none: 'No Countdown scored yet.',
      one: 'So far {pts}.',
      many: 'So far {list} = {pts}.',
      question: 'How many stages did you clear?',
      stages: { one: '{n} stage', other: '{n} stages' },
      pop: 'Delete the last Countdown',
      added: 'Countdown: {pts} scored',
      popped: 'Last Countdown deleted',
    },

    askCd: {
      title: 'Countdown still open',
      text: 'You unlocked the Countdown but haven’t played it yet. If you carry on now, it’s lost.',
      play: 'Play Countdown',
      drop: 'Skip the Countdown',
    },

    cd: {
      title: 'Countdown',
      close: 'Close the Countdown',
      for: 'for {name}',
      intro: 'Count down from 6 to 1',
      pts: { one: '<b>{n}</b> point', other: '<b>{n}</b> points' },
      stages: 'Stages',
      stage: 'Stage {i}, a {n}: {st}',
      stOpen: 'open',
      stDone: 'cleared',
      stFail: 'missed',
      stNow: 'now',
      hit: 'Hit! 10 more points.',
      need: 'Stage {stage}: You need a {n}.',
      rollWith: 'You roll {dice}, with a {p}% chance of a hit.',
      diceWith: { one: '{n} die', other: '{n} dice' },
      miss: 'No {n} this time.',
      overText: 'The Countdown is over.',
      perfect: 'All six stages cleared!',
      perfectText: 'That only happens in about 0.4% of Countdowns.',
      roll: 'Roll',
      rollSub: { one: '{n} die, looking for a {n}', other: '{n} dice, looking for a {n}' },
      result: 'Countdown points',
      none: 'No stage cleared.',
      enterFor: 'Score for',
      enter: 'Score',
      skip: 'Don’t score',
      aside: 'Set aside',
      saved: 'Countdown: {pts} scored for {name}',
      ended: 'Countdown finished',
    },

    player: {
      label: 'Edit player',
      name: 'Name',
      remove: 'Remove from the game',
      alone: 'You can’t remove yourself when playing alone. To stop, tap Menu below and quit the game.',
      renamed: '{old} is now called {name}',
      removed: '{name} removed',
      askLabel: 'Remove player',
      askTitle: 'Remove {name}?',
      askText: '{name} already has entries ({what}, {pts}). Removing {name} deletes them.',
      fields: { one: '{n} box', other: '{n} boxes' },
      aCountdown: 'a Countdown',
      askOk: 'Remove and delete points',
      botText: '{name} is a bot and plays on its own. Its name can’t be changed.',
    },

    bot: {
      ready: '{name} is about to start …',
      think: '{name} is thinking …',
      roll: '{name} is rolling …',
      enter: '{name} is scoring …',
      button: '{name} is playing',
      buttonSub: 'Just a moment',
      hint: 'Bots play their own turn.',
      entered: '{name}: {field}, {pts}',
      struck: '{name} crosses out {field}',
      cell: '{name} is a bot and scores on its own.',
      cdPlays: '{name} is playing the countdown …',
      cdNeed: 'Stage {stage}: {name} needs a {n}.',
      cdRollWith: 'Rolling {dice}, {p}% chance to hit.',
    },

    pause: {
      label: 'Back to the main menu',
      title: 'Back to the main menu?',
      round: 'You’re in round {r} of {total}.',
      cdOpen: 'All rounds have been played, only the Countdown is still open.',
      pause: 'Pause',
      pauseSub: 'The game is saved. Tap “Local” in the menu to carry on.',
      abort: 'Quit game',
      abortSub: 'All points will be deleted. There’s no high score.',
      back: 'Back to the game',
      aborted: 'Game quit',
    },

    result: {
      label: 'Results',
      record: 'New record',
      soloAbove: 'That’s above the benchmark of about 300 points.',
      soloBelow: 'Benchmark for a solid game: about 300 points.',
      tie: 'It’s a tie',
      tieText: '{names} share the win with {n} points.',
      wins: '{name} wins',
      winsText: { one: 'With {n} point.', other: 'With {n} points.' },
      savedOne: 'The result is in the high scores. It’s only saved on this device.',
      savedMany: 'The results are in the high scores. They’re only saved on this device.',
      notSaved: 'This game isn’t in the high scores because the list was just cleared.',
      botsNot: 'Bots don’t go into the high scores.',
      again: 'Play again',
      started: 'New game started',
    },

    scores: {
      title: 'High Scores',
      local: 'Local',
      online: 'Online',
      note: 'The top ten results, saved only on this device.',
      clear: 'Clear list',
      emptyTitle: 'No high scores yet',
      emptyText: 'After your first complete game, the top ten results will show up here.',
      onlineTitle: 'Online high scores are coming soon',
      onlineText: 'Once you can play online, you’ll see the best players from everywhere here.',
      clearTitle: 'Clear the high scores?',
      clearText: 'All results saved on this device will be deleted.',
      clearOk: 'Clear high scores',
      cleared: 'High scores cleared',
    },

    settings: {
      title: 'Settings',
      design: 'Appearance',
      light: 'Light',
      dark: 'Dark',
      auto: 'Automatic',
      sky: 'Falling dice',
      sound: 'Sound',
      music: 'Music',
      fx: 'Game sounds',
      volume: '{name} volume',
      percent: '{n}%',
      keys: 'Press <kbd>M</kbd> to turn all sound on or off.',
      language: 'Language',
      soundOn: 'Sound on',
      soundOff: 'Sound off',
    },

    rules: {
      claim: ['Six dice.', 'Three rolls.', 'One Countdown.'],
      facts: 'For one or more players aged 8 and up. A game takes about 20 to 40 minutes.',
      sections: [
        {
          title: 'Quick overview',
          html: `
          <dl class="brief">
            <dt>Goal</dt><dd>Score as many points as possible in 15 rounds.</dd>
            <dt>Your turn</dt><dd>Up to 3 rolls. In between, set aside as many dice as you like – or roll them again.</dd>
            <dt>Scoring</dt><dd>Exactly one open box per turn. Requirement not met: 0 points.</dd>
            <dt>Bonus</dt><dd>At least 70 points in the upper section → 40 bonus points.</dd>
            <dt>Countdown</dt><dd>At least 4 of a kind on the first roll → after your turn, count down from 6 to 1, 10 points per stage cleared.</dd>
            <dt>Final score</dt><dd>Upper total + bonus + lower total + Countdown.</dd>
          </dl>`,
        },
        {
          title: 'What’s it all about?',
          html: `
          <p>In HEXA, you roll for the best combinations: of-a-kinds, straights, pairs and triples – or simply as many pips as possible. Over 15 rounds, you fill in your scorecard box by box. But watch out: you can use each box only once.</p>
          <p>Plan well and you’ll earn a big bonus in the upper section. And if you roll four of a kind on your very first roll, you also get to play the <b>Countdown</b>.</p>
          <p><b>Goal of the game:</b> Score as many points as possible in 15 rounds. Whoever has the most at the end wins.</p>`,
        },
        {
          title: 'What you need',
          html: `
          <h4>Components</h4>
          <ul>
            <li>6 dice</li>
            <li>1 scorecard pad</li>
            <li>1 pen</li>
          </ul>
          <h4>Setup</h4>
          <p>Every player gets their own column on the scorecard and writes their name at the top. Have the dice and pen ready. The youngest player goes first, then play continues clockwise.</p>`,
        },
        {
          title: 'How to play',
          html: `
          <p>The game lasts 15 rounds. In each round, every player takes exactly one turn.</p>
          <h4>Your turn</h4>
          <ol>
            <li><b>Roll:</b> Roll all 6 dice.</li>
            <li><b>Set aside and reroll:</b> Set aside as many dice as you like and roll the rest again. You may do this up to twice – so you have at most <b>3 rolls</b> per turn.
              <ul>
                <li>You may roll dice you set aside again on your next roll.</li>
                <li>You can stop at any time, even after your first roll.</li>
              </ul>
            </li>
            <li><b>Score:</b> Pick an open box on your scorecard and enter your points there. Then it’s the next player’s turn.</li>
          </ol>
          <h4>Scoring rules</h4>
          <ul>
            <li>Each turn, you fill in <b>exactly one</b> box.</li>
            <li>Each box is filled in <b>only once</b> per game.</li>
            <li>If your roll doesn’t meet the requirement of the box you pick, you enter <b>0 points</b> there. The box is crossed out.</li>
            <li>After 15 rounds, all boxes are filled and the game is over.</li>
          </ul>
          <div class="eg">
            <p><b>Example:</b> Lena rolls 2-3-3-5-5-6.</p>
            <span class="dice-row" data-dice="233556"></span>
            <p>She wants a straight, sets aside 2, 3, 5 and 6 and rolls the other two dice again. Out come a 1 and a 4 – now she has 1-2-3-4-5-6, a Large Straight!</p>
            <span class="dice-row" data-dice="123456"></span>
            <p>Lena stops and scores 40 points for the Large Straight. She could also count it as a Small Straight, but would only get 25 points there.</p>
          </div>`,
        },
        {
          title: 'The boxes',
          html: `
          <p>Your scorecard has 15 boxes: 6 in the upper and 9 in the lower section.</p>
          <h4>Upper section</h4>
          <p>Here you only add up the dice showing the matching number. There’s no requirement.</p>
          <div class="tbl-wrap">
            <table class="t">
              <thead><tr><th>Box</th><th>You get</th><th class="n">Maximum</th></tr></thead>
              <tbody>
                <tr><td>Ones</td><td>all ones added up</td><td class="n">6</td></tr>
                <tr><td>Twos</td><td>all twos added up</td><td class="n">12</td></tr>
                <tr><td>Threes</td><td>all threes added up</td><td class="n">18</td></tr>
                <tr><td>Fours</td><td>all fours added up</td><td class="n">24</td></tr>
                <tr><td>Fives</td><td>all fives added up</td><td class="n">30</td></tr>
                <tr><td>Sixes</td><td>all sixes added up</td><td class="n">36</td></tr>
              </tbody>
            </table>
          </div>
          <div class="eg">
            <p><b>Example:</b> You have 1-2-4-4-4-6 and score Fours: 4 + 4 + 4 = <b>12 points</b>.</p>
            <span class="dice-row" data-dice="124446"></span>
          </div>
          <p><b>Bonus:</b> If you have <b>at least 70 points</b> in the upper section in total, you get <b>40 bonus points</b> on top.</p>

          <h4>Lower section</h4>
          <p>Here you need certain combinations. If you make one, you get fixed points – only Chance counts the dice total.</p>
          <div class="fields">
            <div class="fitem"><span class="fn">Five of a Kind</span><span class="fp">40</span><span class="fr">at least 5 alike</span><span class="dice-row" data-dice="444442"></span></div>
            <div class="fitem"><span class="fn">Six of a Kind</span><span class="fp">75</span><span class="fr">6 alike</span><span class="dice-row" data-dice="555555"></span></div>
            <div class="fitem"><span class="fn">Three Pairs</span><span class="fp">30</span><span class="fr">3 pairs (2 alike each)</span><span class="dice-row" data-dice="224455"></span></div>
            <div class="fitem"><span class="fn">Two Triples</span><span class="fp">40</span><span class="fr">2 triples (3 alike each)</span><span class="dice-row" data-dice="333666"></span></div>
            <div class="fitem"><span class="fn">Small Straight</span><span class="fp">25</span><span class="fr">5 in a row: 1-2-3-4-5 or 2-3-4-5-6</span><span class="dice-row" data-dice="123345"></span></div>
            <div class="fitem"><span class="fn">Large Straight</span><span class="fp">40</span><span class="fr">1-2-3-4-5-6</span><span class="dice-row" data-dice="123456"></span></div>
            <div class="fitem"><span class="fn">Low Roll</span><span class="fp">25</span><span class="fr">every die shows 1, 2 or 3</span><span class="dice-row" data-dice="112333"></span></div>
            <div class="fitem"><span class="fn">High Roll</span><span class="fp">25</span><span class="fr">every die shows 4, 5 or 6</span><span class="dice-row" data-dice="444566"></span></div>
            <div class="fitem"><span class="fn">Chance</span><span class="fp">dice total</span><span class="fr">no requirement (26 in the example)</span><span class="dice-row" data-dice="234566"></span></div>
          </div>
          <h4>Good to know</h4>
          <ul>
            <li><b>Four of a kind</b> counts as two pairs for Three Pairs. So 4-4-4-4-2-2 is valid.</li>
            <li><b>Six of a kind</b> also counts as Five of a Kind, Three Pairs or Two Triples.</li>
            <li>A <b>Large Straight</b> also counts as a Small Straight.</li>
            <li>For Low Roll and High Roll, <b>not all three numbers</b> have to appear. So <span class="nowrap">1-1-1-1-1-1</span> is a Low Roll too.</li>
          </ul>`,
        },
        {
          title: 'Countdown (bonus game)',
          html: `
          <p>If you roll <b>at least 4 of a kind</b> on the <b>first roll</b> of a turn, you may play the Countdown after your turn.</p>
          <p>First finish your turn as usual and score your result. The matching dice don’t have to stay put – all that counts is that they were there on the first roll.</p>
          <h4>How it works</h4>
          <p>In the Countdown, you count down from 6 to 1. At each stage, you’re looking for a specific number. You always roll exactly as many dice as the number you’re looking for:</p>
          <div class="tbl-wrap">
            <table class="t">
              <thead><tr><th>Stage</th><th>Dice</th><th>You need</th></tr></thead>
              <tbody>
                <tr><td>1</td><td>6</td><td>a 6</td></tr>
                <tr><td>2</td><td>5</td><td>a 5</td></tr>
                <tr><td>3</td><td>4</td><td>a 4</td></tr>
                <tr><td>4</td><td>3</td><td>a 3</td></tr>
                <tr><td>5</td><td>2</td><td>a 2</td></tr>
                <tr><td>6</td><td>1</td><td>a 1</td></tr>
              </tbody>
            </table>
          </div>
          <p>You get <b>exactly one roll</b> per stage:</p>
          <ul>
            <li><b>The number shows up:</b> Set aside one die showing it. The stage is cleared, and you carry on with the remaining dice.</li>
            <li><b>The number doesn’t show up:</b> The Countdown is over.</li>
          </ul>
          <h4>Points</h4>
          <p>Each stage cleared is worth <b>10 points</b>, so 60 at most. Enter them in the “Countdown” row at the very bottom of the scorecard.</p>
          <ul>
            <li>If you play the Countdown several times during a game, the points are added up.</li>
            <li>Countdown points do <b>not</b> count towards the upper section bonus.</li>
          </ul>
          <div class="eg">
            <p><b>Example:</b> Your first roll is 4-4-4-4-2-6 – four fours! You finish your turn and score it. Then the Countdown starts:</p>
            <span class="dice-row" data-dice="444426"></span>
            <ul>
              <li><b>Stage 1:</b> You roll 6 dice. There’s a 6 – cleared!</li>
              <li><b>Stage 2:</b> You roll the remaining 5 dice. There’s a 5 – cleared!</li>
              <li><b>Stage 3:</b> You roll 4 dice. No 4 – the Countdown is over.</li>
            </ul>
            <p>You get 2 × 10 = <b>20 points</b>.</p>
          </div>`,
        },
        {
          title: 'End of the game and scoring',
          html: `
          <p>After 15 rounds, all boxes are filled and the game ends. Now everyone adds up:</p>
          <div class="tbl-wrap">
            <table class="t">
              <thead><tr><th>Row</th><th>How it’s calculated</th></tr></thead>
              <tbody>
                <tr><td>Upper total</td><td>all points from the upper section</td></tr>
                <tr><td>Bonus</td><td>40 points if the upper total is at least 70, otherwise 0</td></tr>
                <tr><td>Lower total</td><td>all points from the lower section</td></tr>
                <tr><td>Countdown</td><td>all Countdown points together</td></tr>
                <tr class="strong"><td>Final score</td><td>Upper total + bonus + lower total + Countdown</td></tr>
              </tbody>
            </table>
          </div>
          <p>The highest final score wins. If there’s a tie, you share the win.</p>
          <h4>Example: a completed scorecard</h4>
          <p>This is how the rows look on the scorecard. A 0 means the box was crossed out.</p>
          <div class="tbl-wrap">
            <table class="t">
              <tbody>
                <tr><td>Ones</td><td class="n">3</td></tr>
                <tr><td>Twos</td><td class="n">8</td></tr>
                <tr><td>Threes</td><td class="n">12</td></tr>
                <tr><td>Fours</td><td class="n">12</td></tr>
                <tr><td>Fives</td><td class="n">15</td></tr>
                <tr><td>Sixes</td><td class="n">24</td></tr>
                <tr class="strong"><td>Upper total</td><td class="n">74</td></tr>
                <tr class="strong"><td>Bonus</td><td class="n">40</td></tr>
                <tr><td>Five of a Kind</td><td class="n">40</td></tr>
                <tr><td>Six of a Kind</td><td class="n">0</td></tr>
                <tr><td>Three Pairs</td><td class="n">30</td></tr>
                <tr><td>Two Triples</td><td class="n">0</td></tr>
                <tr><td>Small Straight</td><td class="n">25</td></tr>
                <tr><td>Large Straight</td><td class="n">0</td></tr>
                <tr><td>Low Roll</td><td class="n">25</td></tr>
                <tr><td>High Roll</td><td class="n">25</td></tr>
                <tr><td>Chance</td><td class="n">23</td></tr>
                <tr class="strong"><td>Lower total</td><td class="n">168</td></tr>
                <tr class="strong"><td>Countdown</td><td class="n">10</td></tr>
                <tr class="strong total"><td>Final score</td><td class="n">292</td></tr>
              </tbody>
            </table>
          </div>
          <h4>Playing solo</h4>
          <p>HEXA works solo too: try to beat your own record. As a benchmark, a solid game ends up at around 300 points.</p>`,
        },
        {
          title: 'Tips',
          html: `
          <ul>
            <li><b>Plan for the bonus:</b> Exactly three of each number only gets you 63 points. So for the bonus, you need four or more of a kind in a few boxes.</li>
            <li><b>Chance to the rescue:</b> If a roll doesn’t really fit anywhere, score it as Chance instead of crossing out another box.</li>
            <li><b>Cross out wisely:</b> If you do have to cross something out, pick a box that rarely works anyway – Six of a Kind, for example.</li>
          </ul>`,
        },
        {
          title: 'Numbers for the curious',
          html: `
          <p>All values are rounded.</p>
          <h4>How often a box works out if you go for it in one turn</h4>
          <div class="bars">
            <div class="bar"><span>Small Straight</span><span class="track"><span class="fill" style="width:50%"></span></span><span class="pct">50%</span></div>
            <div class="bar"><span>Low Roll</span><span class="track"><span class="fill" style="width:45%"></span></span><span class="pct">45%</span></div>
            <div class="bar"><span>High Roll</span><span class="track"><span class="fill" style="width:45%"></span></span><span class="pct">45%</span></div>
            <div class="bar"><span>Three Pairs</span><span class="track"><span class="fill" style="width:29%"></span></span><span class="pct">29%</span></div>
            <div class="bar"><span>Large Straight</span><span class="track"><span class="fill" style="width:20%"></span></span><span class="pct">20%</span></div>
            <div class="bar"><span>Five of a Kind</span><span class="track"><span class="fill" style="width:16%"></span></span><span class="pct">16%</span></div>
            <div class="bar"><span>Two Triples</span><span class="track"><span class="fill" style="width:16%"></span></span><span class="pct">16%</span></div>
            <div class="bar"><span>Six of a Kind</span><span class="track"><span class="fill" style="width:2%"></span></span><span class="pct">2%</span></div>
          </div>
          <h4>How far you get in the Countdown</h4>
          <p>Chance of reaching at least this stage:</p>
          <div class="bars">
            <div class="bar"><span>Stage 1</span><span class="track"><span class="fill" style="width:67%"></span></span><span class="pct">67%</span></div>
            <div class="bar"><span>Stage 2</span><span class="track"><span class="fill" style="width:40%"></span></span><span class="pct">40%</span></div>
            <div class="bar"><span>Stage 3</span><span class="track"><span class="fill" style="width:21%"></span></span><span class="pct">21%</span></div>
            <div class="bar"><span>Stage 4</span><span class="track"><span class="fill" style="width:9%"></span></span><span class="pct">9%</span></div>
            <div class="bar"><span>Stage 5</span><span class="track"><span class="fill" style="width:2.7%"></span></span><span class="pct">2.7%</span></div>
            <div class="bar"><span>Stage 6</span><span class="track"><span class="fill" style="width:0.4%"></span></span><span class="pct">0.4%</span></div>
          </div>
          <h4>Anything else?</h4>
          <ul>
            <li>At least 4 of a kind on the first roll – and with it a Countdown – happens about once every 19 turns.</li>
            <li>A Countdown is worth about 14 points on average.</li>
            <li>With solid play, you get the upper section bonus in just under half of all games.</li>
            <li>A solid game ends up at around 300 points overall.</li>
          </ul>`,
        },
      ],
    },
  };

  if (typeof module === 'object' && module.exports) module.exports = texts;
  else (root.HexaLang = root.HexaLang || {}).en = texts;
})(typeof self !== 'undefined' ? self : this);
