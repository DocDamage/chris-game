/* CHAOS.exe - DOM menus, HUD, settings, notifications. Gameplay stays on the canvas; this file only
   touches the DOM when a value actually changes. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const Storage = CH.Storage;
  const Audio = CH.Audio;
  const Input = CH.Input;
  const G = CH.G;

  const $ = (id) => document.getElementById(id);
  const UI = (CH.UI = { active: null, confirmReturn: null, backTo: 'main' });

  let stage;
  const cache = new WeakMap();
  /* write a DOM property only when it changed */
  function setText(el, v) {
    if (el.__t !== v) {
      el.__t = v;
      el.textContent = v;
    }
  }
  function setW(el, pct) {
    pct = Math.max(0, Math.min(100, pct));
    const k = pct.toFixed(1);
    if (el.__w !== k) {
      el.__w = k;
      el.style.width = k + '%';
    }
  }
  function setH(el, pct) {
    pct = Math.max(0, Math.min(100, pct));
    const k = pct.toFixed(1);
    if (el.__h !== k) {
      el.__h = k;
      el.style.height = k + '%';
    }
  }
  function toggleCls(el, cls, on) {
    const k = '__c' + cls;
    if (el[k] !== on) {
      el[k] = on;
      el.classList.toggle(cls, on);
    }
  }

  const SCREENS = ['main', 'lobby', 'howto', 'settings', 'stats', 'credits', 'pause', 'confirm', 'levelup', 'gameover', 'victory', 'shelter', 'branch', 'codex'];
  UI.SCREENS = SCREENS; // add-on modules push their own screens here
  const SFX_CLICK = () => Audio.sfx('click');
  const heroIcon = (id) => (CH.Art.on && CH.Sprites.has('hero.' + id) ? CH.Sprites.icon('hero.' + id, 0) : CH.Sprites.icon('player', 0));

  const KEY_NAMES = { Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Escape: 'ESC', Enter: 'ENTER', Tab: 'TAB', Backquote: '`', Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'" };
  const keyLabel = (code) => KEY_NAMES[code] || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'NUM ');

  const ACTIONS = [
    ['up', 'Move up'],
    ['down', 'Move down'],
    ['left', 'Move left'],
    ['right', 'Move right'],
    ['sprint', 'Sprint'],
    ['jump', 'Jump'],
    ['dodge', 'Dodge roll'],
    ['reload', 'Reload'],
    ['interact', 'Interact'],
    ['special', 'Special ability'],
    ['gadget', 'Grenade'],
    ['secondary', 'Cycle 2nd weapon'],
    ['gadgetType', 'Cycle grenade type'],
    ['swap', 'Swap weapons'],
    ['fortify', 'Deploy barricade'],
  ];

  const SNARK = [
    'Your ancestors are mildly disappointed.',
    "It was a pigeon. It's always a pigeon.",
    'Have you tried not dying?',
    'A refrigerator outplayed you.',
    'Per my last email: you lost.',
    'Reality has been patched without you.',
    'That chicken has a family, you know.',
    'Skill issue (but make it chaotic).',
    'The Intern will not be getting paid for this either.',
  ];

  /* ------------------------------------------------------------------ init */
  UI.init = function () {
    stage = $('stage');
    UI.resize();
    window.addEventListener('resize', UI.resize);
    document.addEventListener('fullscreenchange', UI.resize);

    $('ico-heart').src = CH.Sprites.icon('ic_heart');
    $('ico-bolt').src = CH.Sprites.icon('ic_stamina');
    $('ico-coin').src = CH.Sprites.icon(CH.Sprites.has('pk.coin') ? 'pk.coin' : 'coin');
    for (const k of ['wood', 'scrap', 'stone']) $('ico-' + k).src = CH.Sprites.icon(CH.Sprites.has('pk.' + k) ? 'pk.' + k : 'coin');
    $('ico-loot').src = CH.Sprites.icon(CH.Sprites.has('pu.259') ? 'pu.259' : 'coin');
    UI.buildHud();
    UI.drawAbilityIcon();

    UI.wireButtons();
    UI.buildSettings();
    UI.applyAccessibility();
    UI.renderControlsStrip();
    Input.onGlobal = UI.onGlobalKey;
    Input.onMenuKey = UI.onMenuKey;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && G.state === 'playing') G.pause();
    });
    window.addEventListener('blur', () => {
      if (G.state === 'playing') G.pause();
    });
    UI.showMenu();
  };

  UI.resize = function () {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const s = Math.max(0.5, Math.min(w / B.ui.w, h / B.ui.h));
    stage.style.width = Math.floor(B.ui.w * s) + 'px';
    stage.style.height = Math.floor(B.ui.h * s) + 'px';
    stage.style.setProperty('--u', s + 'px');
  };

  UI.toggleFullscreen = function () {
    const el = document.documentElement;
    try {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen().catch(() => UI.toast('FULLSCREEN BLOCKED'));
        else UI.toast('FULLSCREEN NOT SUPPORTED');
      } else if (document.exitFullscreen) document.exitFullscreen();
    } catch (e) {
      UI.toast('FULLSCREEN NOT SUPPORTED');
    }
  };

  UI.applyAccessibility = function () {
    const s = Storage.settings;
    document.body.classList.toggle('reduced', s.reduced);
    document.body.classList.toggle('noflash', !s.flashing);
  };

  /* --------------------------------------------------------- screen control */
  /* menu soundtrack: each screen has its own track while no run is active */
  const MENU_MUSIC = { main: 'menu', howto: 'theme', settings: 'shop', stats: 'garden', credits: 'credits', shelter: 'shop' };
  UI.show = function (name) {
    if (G.state === 'menu' && MENU_MUSIC[name]) {
      if (name !== 'main' && UI.active !== name) Audio.sfx('page');
      Audio.setMusic(MENU_MUSIC[name]);
    }
    for (const n of SCREENS) $('screen-' + n).classList.toggle('show', n === name);
    UI.active = name;
    // focus the first actionable control for keyboard users
    setTimeout(() => {
      if (UI.active !== name) return;
      const root = $('screen-' + name);
      const first = root.querySelector('.card, .btn.primary, .btn');
      if (first) first.focus({ preventScroll: true });
    }, 30);
  };
  UI.hideAll = function () {
    for (const n of SCREENS) $('screen-' + n).classList.remove('show');
    UI.active = null;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  };

  function setPlaying(on) {
    stage.classList.toggle('playing', on);
  }

  UI.showMenu = function () {
    $('hud').classList.add('hidden');
    $('banner').classList.add('hidden');
    $('bossintro').classList.add('hidden');
    $('toasts').textContent = '';
    setPlaying(false);
    UI.refreshMenuMeta();
    UI.show('main');
  };

  UI.refreshMenuMeta = function () {
    setText($('menu-best'), 'BEST ' + U.fmtNum(Storage.stats.highScore));
    if (CH.Menus && CH.Menus.heroLabel) CH.Menus.heroLabel();
    setText($('menu-diff'), B.difficulty[Storage.settings.difficulty].name.toUpperCase());
    UI.renderControlsStrip();
  };

  const PAD = (txt, cls) => `<kbd class="pad ${cls || ''}">${txt}</kbd>`;
  UI.renderControlsStrip = function () {
    const k = Storage.settings.keys;
    const L = (a) => `<kbd>${keyLabel(k[a])}</kbd>`;
    const kb = `${L('up')}${L('left')}${L('down')}${L('right')} move &nbsp; ${L('sprint')} sprint &nbsp; ${L('dodge')} dodge &nbsp; <kbd>MOUSE</kbd> aim + fire (<kbd>R-CLICK</kbd> 2nd weapon) &nbsp; ${L('gadget')} grenade &nbsp; ${L('special')} special &nbsp; ${L('interact')} interact &nbsp; <kbd>F</kbd> barricade &nbsp; <kbd>ESC</kbd> pause`;
    const pad = `${PAD('L-STICK', 't')} move &nbsp; ${PAD('R-STICK', 't')} aim &nbsp; ${PAD('RT', 't')} ${PAD('LT', 't')} weapons &nbsp; ${PAD('A', 'a')} dodge &nbsp; ${PAD('B', 'b')} interact &nbsp; ${PAD('X', 'x')} reload &nbsp; ${PAD('Y', 'y')} swap &nbsp; ${PAD('LB', 't')} grenade &nbsp; ${PAD('RB', 't')} special &nbsp; ${PAD('D-PAD', 't')} cycle &nbsp; ${PAD('R3', 't')} barricade`;
    $('controls-strip').innerHTML = kb + '<br>' + pad;
  };

  /* each player's special-ability slot shows their hero's icon */
  UI.drawAbilityIcon = function () {
    G.players.concat(G.players.length ? [] : [{ hero: B.heroes.find((x) => x.id === Storage.settings.hero) || B.heroes[0] }]).forEach((pl, i) => {
      const h = UI.huds[i];
      if (!h) return;
      const c = h.abilityIcon;
      const ac = c.getContext('2d');
      ac.imageSmoothingEnabled = false;
      ac.clearRect(0, 0, c.width, c.height);
      CH.Sprites.draw(ac, pl.hero.icon, 10, 10, { sx: 1.8, sy: 1.8 });
      h.ability.title = pl.hero.specialName;
    });
  };

  UI.onRunStart = function (isContinue) {
    stage.classList.toggle('coop', G.coop);
    stage.classList.toggle('many', G.coop && G.players.length > 2);
    UI.huds.forEach((h, i) => {
      const on = i === 0 || (G.coop && i < G.players.length);
      h.panel.classList.toggle('hidden', !on);
      h.bottom.classList.toggle('hidden', !on);
      h.pow.classList.toggle('hidden', !on);
    });
    UI.drawAbilityIcon();
    UI.hideAll();
    $('hud').classList.remove('hidden');
    $('toasts').textContent = '';
    setPlaying(true);
    UI.refreshWeapons();
    if (!isContinue) {
      $('boss-panel').classList.add('hidden');
      $('event-panel').classList.add('hidden');
      $('bossintro').classList.add('hidden');
      for (const h of UI.huds) {
        h.pow.textContent = '';
        h.chips = {};
        h.gad = null;
      }
      UI.boss = null;
      lastHp = 1;
    }
  };

  UI.showPause = function () {
    setPlaying(false);
    UI.show('pause');
  };
  UI.hidePause = function () {
    UI.hideAll();
    setPlaying(true);
  };

  UI.confirm = function (title, msg, onYes, yesLabel) {
    UI.confirmReturn = UI.active;
    $('confirm-title').textContent = title;
    $('confirm-msg').textContent = msg;
    $('confirm-yes').textContent = yesLabel || 'YES';
    UI._confirmYes = onYes;
    UI.show('confirm');
    setTimeout(() => $('confirm-no').focus(), 40);
  };
  UI.cancelConfirm = function () {
    UI.show(UI.confirmReturn || 'main');
  };

  /* ------------------------------------------------------------- wiring */
  UI.wireButtons = function () {
    const click = (id, fn) => {
      $(id).addEventListener('click', () => {
        SFX_CLICK();
        fn();
      });
    };
    for (const b of document.querySelectorAll('.btn, .card')) {
      b.addEventListener('mouseenter', () => Audio.sfx('hover'));
    }
    $('btn-play').addEventListener('click', () => Audio.sfx('confirm'));
    $('btn-retry').addEventListener('click', () => Audio.sfx('confirm'));
    click('btn-play', () => { if (!(CH.Menus && CH.Menus.characters && CH.Menus.characters())) G.newRun(null); });
    $('btn-coop').addEventListener('click', () => Audio.sfx('confirm'));
    click('btn-coop', () => {
      UI.backTo = 'main';
      // whoever clicked (mouse) or pressed (pad) is player 1
      CH.Lobby.open(Input.lastUsed === 'pad' && Input.firstPad() ? { kind: 'pad', index: Input.firstPad().index } : { kind: 'kbm' });
    });
    click('btn-lobby-kbm', () => CH.Lobby.join({ kind: 'kbm' }));
    click('btn-lobby-start', () => CH.Lobby.tryStart());
    click('btn-lobby-back', () => UI.back());
    click('btn-howto', () => {
      UI.fillHowTo();
      UI.backTo = 'main';
      UI.show('howto');
    });
    click('btn-shelter', () => {
      CH.Shelter.init();
      UI.backTo = 'main';
      UI.show('shelter');
    });
    click('btn-codex', () => {
      CH.Codex.open();
      UI.backTo = 'main';
      UI.show('codex');
    });
    click('btn-shelter-codex', () => {
      CH.Codex.open();
      UI.backTo = 'main';
      UI.show('codex');
    });
    click('codex-sell1', () => CH.Codex.sell1());
    click('codex-sellall', () => CH.Codex.sellAllBut1());
    click('codex-selldupes', () => CH.Codex.sellDupes());
    click('btn-settings', () => {
      UI.backTo = 'main';
      UI.refreshSettings();
      UI.show('settings');
    });
    click('btn-stats', () => {
      UI.fillStats();
      UI.backTo = 'main';
      UI.show('stats');
    });
    click('btn-credits', () => {
      UI.backTo = 'main';
      UI.show('credits');
    });
    for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', () => UI.back());
    click('btn-resume', () => G.resume());
    click('btn-restart', () =>
      UI.confirm('RESTART RUN?', 'Your current run will be abandoned and a new one will start.', () => {
        G.abandon();
        G.newRun();
      }, 'RESTART')
    );
    click('btn-pause-settings', () => {
      UI.backTo = 'pause';
      UI.refreshSettings();
      UI.show('settings');
    });
    click('btn-pause-menu', () =>
      UI.confirm('ABANDON RUN?', 'Your current run will be lost. Lifetime stats are kept.', () => G.abandon(), 'ABANDON')
    );
    click('confirm-yes', () => {
      const fn = UI._confirmYes;
      UI._confirmYes = null;
      if (fn) fn();
    });
    click('confirm-no', () => UI.cancelConfirm());
    click('btn-retry', () => G.newRun());
    click('btn-go-menu', () => G.toMenu());
    click('btn-endless', () => G.continueEndless());
    click('btn-again', () => G.newRun());
    click('btn-vic-menu', () => G.toMenu());
    click('btn-resetsave', () =>
      UI.confirm('RESET SAVE DATA?', 'This erases settings, stats, high score and unlocks.', () => {
        Storage.reset();
        Input.rebuild();
        UI.applyAccessibility();
        Audio.applySettings();
        UI.refreshSettings();
        UI.fillStats();
        UI.refreshMenuMeta();
        UI.show('stats');
      }, 'ERASE')
    );
  };

  UI.back = function () {
    Audio.sfx('back');
    if (UI.active === 'lobby') CH.Lobby.close();
    if (UI.active === 'settings') {
      Storage.save();
      UI.refreshMenuMeta();
    }
    if (UI.backTo === 'pause') UI.show('pause');
    else UI.show('main');
  };

  /* ---------------------------------------------------- keyboard handling */
  UI.onGlobalKey = function (a) {
    if (a === 'mute') {
      const m = Audio.toggleMute();
      UI.toast(m ? 'SOUND OFF' : 'SOUND ON');
      UI.refreshSettings();
    } else if (a === 'fullscreen') {
      UI.toggleFullscreen();
    } else if (a === 'pause') {
      if (G.state === 'playing') G.pause();
      else if (G.state === 'paused') {
        if (UI.active === 'confirm') UI.cancelConfirm();
        else if (UI.active === 'settings') UI.back();
        else G.resume();
      } else if (G.state === 'menu') {
        if (UI.active === 'confirm') UI.cancelConfirm();
        else if (UI.active && UI.active !== 'main') UI.back();
      } else if (UI.active === 'confirm') UI.cancelConfirm();
    }
  };

  const ARROWS = { ArrowDown: 'down', ArrowUp: 'up', ArrowLeft: 'left', ArrowRight: 'right' };
  UI.onMenuKey = function (e) {
    if (UI.active === 'lobby') {
      CH.Lobby.keyInput(e);
      return;
    }
    if (G.state === 'branch' && UI._branchPick) {
      const bm = /^(Digit|Numpad)([1-2])$/.exec(e.code);
      if (bm) {
        UI._branchPick(parseInt(bm[2], 10) - 1);
        return;
      }
    }
    if (G.state === 'levelup') {
      if (CH.Perks && CH.Perks.onKey(e)) return;
      const m = /^(Digit|Numpad)([1-3])$/.exec(e.code);
      if (m) {
        G.pickUpgrade(parseInt(m[2], 10) - 1);
        return;
      }
    }
    if (ARROWS[e.code]) {
      if (UI.active === 'settings' && e.target && e.target.type === 'range') return; // let sliders use arrows
      if (UI.navigate(ARROWS[e.code])) e.preventDefault();
    }
  };

  /* move the focus (keyboard arrows and the D-pad / left stick share this). Sliders take left / right. */
  UI.navigate = function (dir) {
    const root = UI.active && $('screen-' + UI.active);
    if (!root) return false;
    const f = document.activeElement;
    if (f && f.type === 'range' && root.contains(f) && (dir === 'left' || dir === 'right')) {
      const step = parseInt(f.step, 10) || 5;
      f.value = Math.max(+f.min, Math.min(+f.max, +f.value + (dir === 'right' ? step : -step)));
      f.dispatchEvent(new Event('input', { bubbles: true }));
      f.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    // the Trophy Codex is a grid of buttons: up / down move by a whole row
    if (f && f.classList && f.classList.contains('codex-item') && (dir === 'up' || dir === 'down')) {
      const grid = Array.from(root.querySelectorAll('.codex-item'));
      const gi = grid.indexOf(f);
      let cols = grid.findIndex((b) => b.offsetTop !== grid[0].offsetTop);
      if (cols < 1) cols = grid.length;
      const ni = gi + (dir === 'down' ? cols : -cols);
      if (grid[ni]) {
        grid[ni].focus();
        grid[ni].scrollIntoView({ block: 'nearest' });
        Audio.sfx('hover');
        return true;
      }
    }
    const items = Array.from(root.querySelectorAll('.card, .btn, .swatch, .codex-item, .vend-cell, .pz-btn, .ig-cell, .pd-slot, .skr-card, .sk-node')).filter((b) => b.offsetParent !== null && !b.disabled);
    if (!items.length) return false;
    // read-only screens (how to play, credits, stats) have nothing to focus but BACK: up / down scrolls them instead
    const sc = root.querySelector('.scroll');
    if (sc && items.length <= 3 && (dir === 'up' || dir === 'down') && sc.scrollHeight > sc.clientHeight + 4) {
      sc.scrollTop += dir === 'down' ? 70 : -70;
      return true;
    }
    let i = items.indexOf(document.activeElement);
    const fwd = dir === 'down' || dir === 'right';
    // in rows of cards left/right is the natural axis; everywhere else up/down
    i = i < 0 ? 0 : (i + (fwd ? 1 : -1) + items.length) % items.length;
    items[i].focus();
    Audio.sfx('hover');
    return true;
  };
  /* A button / confirm */
  UI.activate = function () {
    const root = UI.active && $('screen-' + UI.active);
    if (!root) return;
    const f = document.activeElement;
    if (f && f !== document.body && root.contains(f) && f.click) f.click();
    else {
      const first = root.querySelector('.btn.primary, .card, .btn');
      if (first) first.click();
    }
  };
  /* B button / back */
  UI.cancel = function () {
    if (G.state === 'levelup' || G.state === 'branch') return;
    UI.onGlobalKey('pause');
  };
  /* START button: the obvious next step of whatever screen is showing */
  UI.startKey = function () {
    if (G.state === 'menu') {
      if (UI.active === 'main') $('btn-play').click();
    } else if (G.state === 'paused') {
      if (UI.active === 'pause') G.resume();
    } else if (G.state === 'gameover') $('btn-retry').click();
    else if (G.state === 'victory') $('btn-endless').click();
    else if (G.state === 'levelup' || G.state === 'branch') UI.activate();
  };

  /* ------------------------------------------------------------ settings */
  const TOGGLES = [
    ['musicOn', 'MUSIC'],
    ['sfxOn', 'SFX'],
    ['muted', 'MUTE ALL'],
    ['shake', 'SCREEN SHAKE'],
    ['flashing', 'FLASHING EFFECTS'],
    ['reduced', 'REDUCED EFFECTS'],
    ['aimAssist', 'AIM ASSIST'],
    ['rumble', 'VIBRATION'],
  ];
  const DIFF_DESC = {
    casual: 'Fewer enemies, weaker hits, more healing, easier bosses. Score x0.75.',
    normal: 'The intended experience.',
    chaotic: 'More enemies, harder hits, less healing, frequent chaos events, angrier bosses. Score x1.5.',
  };

  UI.buildSettings = function () {
    const s = Storage.settings;
    for (const k of ['master', 'music', 'sfx']) {
      const el = $('set-' + k);
      el.addEventListener('input', () => {
        s[k] = parseInt(el.value, 10) / 100;
        setText($('v-' + k), el.value + '%');
        Audio.applySettings();
      });
      el.addEventListener('change', () => {
        Storage.save();
        Audio.sfx('click');
      });
    }
    for (const [key, label] of TOGGLES) {
      const el = $('set-' + key);
      el.addEventListener('click', () => {
        s[key] = !s[key];
        Storage.save();
        Audio.applySettings();
        UI.applyAccessibility();
        UI.refreshSettings();
        Audio.sfx('click');
      });
    }
    const dz = $('set-deadzone');
    dz.addEventListener('input', () => {
      s.padDeadzone = parseInt(dz.value, 10) / 100;
      setText($('v-deadzone'), dz.value + '%');
    });
    dz.addEventListener('change', () => {
      Storage.save();
      Audio.sfx('click');
    });
    // difficulty
    const db = $('diff-buttons');
    db.textContent = '';
    for (const id of Object.keys(B.difficulty)) {
      const b = document.createElement('button');
      b.className = 'btn toggle';
      b.dataset.diff = id;
      b.textContent = B.difficulty[id].name.toUpperCase();
      b.addEventListener('click', () => {
        s.difficulty = id;
        Storage.save();
        G.diff = B.difficulty[id]; // applies to enemies spawned from now on, even mid-run
        UI.refreshSettings();
        Audio.sfx('click');
      });
      db.appendChild(b);
    }
    // heroes: one picker per player (player 2 is used in co-op)
    UI.heroPickers = [
      { box: 'swatches', key: 'hero', desc: 'swatch-desc' },
      { box: 'swatches2', key: 'hero2', desc: 'swatch-desc2' },
    ];
    for (const hp of UI.heroPickers) {
      const sw = $(hp.box);
      sw.textContent = '';
      for (const p of B.heroes) {
        const b = document.createElement('button');
        b.className = 'swatch';
        b.dataset.pal = p.id;
        b.title = p.name;
        const im = document.createElement('img');
        im.alt = p.name;
        im.src = heroIcon(p.id);
        b.appendChild(im);
        b.addEventListener('click', () => {
          if (!Storage.isUnlocked(p.id)) {
            setText($(hp.desc), 'LOCKED: ' + p.hint);
            Audio.sfx('nope');
            return;
          }
          s[hp.key] = p.id;
          Storage.save();
          UI.refreshSettings();
          if (hp.key === 'hero') UI.drawAbilityIcon();
          Audio.sfx('click');
        });
        b.addEventListener('mouseenter', () => UI.describeSwatch(p, hp.desc));
        b.addEventListener('focus', () => UI.describeSwatch(p, hp.desc));
        sw.appendChild(b);
      }
    }
    $('btn-resetkeys').addEventListener('click', () => {
      s.keys = Object.assign({}, Storage.DEFAULT_KEYS);
      Storage.save();
      Input.rebuild();
      UI.refreshSettings();
      UI.renderControlsStrip();
      Audio.sfx('click');
    });
  };

  UI.describeSwatch = function (p, descId) {
    setText($(descId || 'swatch-desc'), Storage.isUnlocked(p.id) ? p.name.toUpperCase() + ' - ' + p.blurb : 'LOCKED: ' + p.hint);
  };

  UI.refreshSettings = function () {
    const s = Storage.settings;
    for (const k of ['master', 'music', 'sfx']) {
      $('set-' + k).value = Math.round(s[k] * 100);
      setText($('v-' + k), Math.round(s[k] * 100) + '%');
    }
    for (const [key, label] of TOGGLES) {
      const el = $('set-' + key);
      const on = key === 'muted' ? s.muted : s[key];
      el.textContent = label + ': ' + (on ? 'ON' : 'OFF');
      // for "mute all" ON is the dangerous state
      el.classList.toggle('off', key === 'muted' ? !on : !on);
    }
    for (const b of $('diff-buttons').children) b.classList.toggle('sel', b.dataset.diff === s.difficulty);
    setText($('diff-desc'), DIFF_DESC[s.difficulty]);
    $('set-deadzone').value = Math.round(s.padDeadzone * 100);
    setText($('v-deadzone'), Math.round(s.padDeadzone * 100) + '%');
    for (const hp of UI.heroPickers) {
      for (const b of $(hp.box).children) {
        const id = b.dataset.pal;
        b.classList.toggle('sel', id === s[hp.key]);
        b.classList.toggle('locked', !Storage.isUnlocked(id));
      }
      const cur = B.heroes.find((p) => p.id === s[hp.key]);
      setText($(hp.desc), cur ? 'SELECTED: ' + cur.name.toUpperCase() + ' - ' + cur.blurb : '');
    }
    // key rebinding
    const rb = $('rebind');
    rb.textContent = '';
    for (const [act, label] of ACTIONS) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.innerHTML = `<span>${label}</span><span>${keyLabel(s.keys[act])}</span>`;
      b.addEventListener('click', () => {
        Audio.sfx('click');
        b.classList.add('listening');
        b.lastChild.textContent = 'PRESS KEY...';
        Input.capture = (code) => {
          if (code === 'Escape') {
            UI.refreshSettings();
            return;
          }
          // swap with whatever action already uses that key
          for (const other of Object.keys(s.keys)) {
            if (other !== act && s.keys[other] === code) s.keys[other] = s.keys[act];
          }
          s.keys[act] = code;
          Storage.save();
          Input.rebuild();
          UI.refreshSettings();
          UI.renderControlsStrip();
        };
      });
      rb.appendChild(b);
    }
  };

  UI.fillHowTo = function () {
    const k = Storage.settings.keys;
    const rows = [
      [`${keyLabel(k.up)} ${keyLabel(k.left)} ${keyLabel(k.down)} ${keyLabel(k.right)}`, 'Move'],
      [keyLabel(k.sprint), 'Sprint (uses stamina)'],
      [keyLabel(k.dodge), 'Dodge roll (brief invulnerability)'],
      ['LEFT MOUSE', 'Fire the main weapon (hold to repeat)'],
      ['RIGHT MOUSE', 'Fire the second weapon'],
      [keyLabel(k.gadget), 'Throw a grenade (3 charges, they recharge)'],
      [keyLabel(k.special), 'Special: your hero\'s signature move'],
      [`${keyLabel(k.secondary)} / ${keyLabel(k.gadgetType)} / ${keyLabel(k.swap)}`, 'Cycle 2nd weapon / grenade type / swap weapons'],
      [keyLabel(k.reload), 'Reload (ammo weapons reload automatically)'],
      [keyLabel(k.interact), 'Interact (vending machines)'],
      ['1-6 / WHEEL / TAB', 'Choose the main weapon'],
      ['F', 'Build a barricade where you aim (2 wood + 1 scrap)'],
      ['ESC / M / F11', 'Pause / mute / fullscreen'],
    ];
    $('howto-keys').innerHTML = rows.map((r) => `<tr><td><kbd>${r[0]}</kbd></td><td>${r[1]}</td></tr>`).join('');
    const pad = [
      [PAD('L-STICK', 't'), 'Move (click it to toggle sprint)'],
      [PAD('R-STICK', 't'), 'Aim (aim assist can be turned off)'],
      [PAD('RT', 't'), 'Fire the main weapon'],
      [PAD('LT', 't'), 'Fire the second weapon'],
      [PAD('RB', 't'), 'Special ability'],
      [PAD('LB', 't'), 'Throw a grenade'],
      [PAD('A', 'a'), 'Dodge roll'],
      [PAD('B', 'b'), 'Interact (vending machines, menus: back)'],
      [PAD('X', 'x'), 'Reload'],
      [PAD('Y', 'y'), 'Swap the two weapons'],
      [PAD('D-PAD', 't') + ' L/R', 'Cycle the main weapon'],
      [PAD('D-PAD', 't') + ' UP / DOWN', 'Cycle the 2nd weapon / grenade type'],
      [PAD('R3', 't'), 'Build a barricade (2 wood + 1 scrap)'],
      [PAD('START', 't'), 'Pause'],
    ];
    $('howto-pad').innerHTML = pad.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
  };

  UI.fillStats = function () {
    const s = Storage.stats;
    const rows = [
      ['Total runs', U.fmtNum(s.totalRuns)],
      ['Runs won', U.fmtNum(s.wins)],
      ['Enemies defeated', U.fmtNum(s.totalKills)],
      ['Bosses defeated', U.fmtNum(s.bossesDefeated)],
      ['Trophy Codex', CH.Loot ? CH.Loot.discovered() + ' / ' + CH.Loot.count : '-'],
      ['Highest wave', U.fmtNum(s.highestWave)],
      ['Highest score', U.fmtNum(s.highScore)],
      ['Coins collected', U.fmtNum(s.totalCoins)],
      ['Total playtime', U.fmtTime(s.totalPlayTime)],
    ];
    $('statlist').innerHTML = rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
    $('unlocklist').innerHTML = B.heroes
      .map((p) => {
        const un = Storage.isUnlocked(p.id);
        return `<div class="unlock ${un ? '' : 'locked'}"><div class="sw"><img alt="" src="${heroIcon(p.id)}"></div><div>${p.name}<small>${un ? 'UNLOCKED' : p.hint}</small></div></div>`;
      })
      .join('');
  };

  /* --------------------------------------------------------- notifications */
  let bannerT1 = 0;
  let bannerT2 = 0;
  UI.banner = function (title, sub, dur) {
    const el = $('banner');
    clearTimeout(bannerT1);
    clearTimeout(bannerT2);
    setText($('banner-title'), title);
    const subEl = $('banner-sub');
    setText(subEl, sub || '');
    subEl.style.display = sub ? 'inline-block' : 'none';
    el.classList.remove('hidden', 'show', 'out');
    void el.offsetWidth; // restart animation
    el.classList.add('show');
    Audio.sfx('whoosh');
    dur = dur || 2.5;
    bannerT1 = setTimeout(() => {
      el.classList.remove('show');
      el.classList.add('out');
    }, Math.max(200, dur * 1000 - 350));
    bannerT2 = setTimeout(() => el.classList.add('hidden'), dur * 1000);
  };

  UI.toast = function (text) {
    const box = $('toasts');
    while (box.children.length > 3) box.removeChild(box.firstChild);
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = text;
    box.appendChild(d);
    setTimeout(() => d.remove(), 2700);
  };

  UI.eventStart = function (def) {
    UI.eventDur = def.duration;
  };

  UI.flashStamina = function (idx) {
    const el = (UI.huds[idx || 0] || UI.huds[0]).stbar;
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  };

  UI.bossIntro = function (boss) {
    UI.boss = boss;
    const el = $('bossintro');
    setText($('bossintro-name'), boss.name);
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(UI._bi);
    UI._bi = setTimeout(() => el.classList.add('hidden'), 2700);
    setText($('bossname'), boss.name);
    $('boss-panel').classList.remove('hidden');
    $('bosstrail').style.width = '100%';
    $('bossfill').style.width = '100%';
  };
  UI.hideBossBar = function () {
    $('boss-panel').classList.add('hidden');
    UI.boss = null;
  };

  /* ------------------------------------------------------------ level up */
  /* player = whose turn it is to choose (every player picks once per level) */
  UI.showLevelUp = function (cards, level, player) {
    setPlaying(false);
    player = player || G.player;
    const pad = player.inp.kind === 'pad';
    const sub = $('levelup-sub');
    const tag = G.coop ? `<span class="ptagl" style="background:${player.color}">${player.name}</span>` : '';
    const more = G.pendingLevels > 0 ? ` (${G.pendingLevels} more waiting)` : '';
    sub.innerHTML = `${tag}Level ${player.level} - choose one upgrade${more}`;
    setText($('levelup-hint'), pad ? 'D-PAD / STICK to choose, A to confirm' : 'Click a card or press 1 / 2 / 3');
    const box = $('cards');
    box.textContent = '';
    cards.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'card';
      let pips = '';
      if (c.max > 0) {
        for (let k = 0; k < c.max; k++) pips += `<span class="pip ${k < c.lv ? 'on' : k === c.lv ? 'next' : ''}"></span>`;
      }
      b.innerHTML = `<span class="num">${i + 1}</span><div class="cicon"><img alt="" src="${CH.Sprites.icon(c.icon)}"></div><div class="cname">${c.name}</div><div class="pips">${pips}</div><div class="ctext">${c.text}</div><div class="ctotal">${c.total || ''}</div><div class="cflavor">${c.flavor || ''}</div>`;
      b.addEventListener('click', () => {
        SFX_CLICK();
        G.pickUpgrade(i);
      });
      b.addEventListener('mouseenter', () => Audio.sfx('hover'));
      box.appendChild(b);
    });
    UI.show('levelup');
    const c0 = box.querySelector('.card'); // the first card has the focus at once, so a pad can act on the very first frame
    if (c0) c0.focus({ preventScroll: true });
  };
  UI.hideLevelUp = function () {
    UI.hideAll();
    setPlaying(true);
  };

  UI.showBranch = function (options, onSelect) {
    setPlaying(false);
    const container = $('branch-cards');
    container.innerHTML = '';
    options.forEach((opt, idx) => {
      const card = document.createElement('div');
      card.className = 'biome-card';
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="biome-title">${opt.name}</div>
        <div class="biome-tag">${opt.tag}</div>
        <div class="biome-desc">${opt.desc}</div>
        <div style="display:flex;gap:8px;margin-top:6px;">
          <span class="biome-badge badge-resource">+${opt.resName}</span>
          <span class="biome-badge badge-hazard">${opt.hazard}</span>
        </div>
        <button class="btn primary" style="margin-top:12px;">DEPLOY</button>
      `;
      const select = () => {
        if (UI.active !== 'branch') return;
        Audio.sfx('item_get');
        UI.hideAll();
        setPlaying(true);
        onSelect(opt.id);
      };
      card.onclick = select;
      card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') select(); };
      card.__select = select;
      container.appendChild(card);
    });
    UI._branchPick = (i) => {
      const c = container.children[i];
      if (c && c.__select) c.__select();
    };
    UI.show('branch');
    setTimeout(() => {
      const first = container.querySelector('.biome-card .btn');
      if (first) first.focus();
    }, 40);
  };

  /* ---------------------------------------------------------- end screens */
  function rowsHTML(rows) {
    return rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
  }
  function freshText(fresh) {
    return fresh && fresh.length ? 'NEW HERO UNLOCKED: ' + fresh.map((p) => p.name.toUpperCase()).join(', ') : '';
  }

  /* the rarest trophies of the run, as a row of icons */
  UI.lootRowHTML = function () {
    const ids = Object.keys(G.runLoot || {}).map(Number);
    if (!ids.length || !CH.Loot) return '';
    const order = { e: 0, r: 1, u: 2, c: 3 };
    ids.sort((a, b) => order[CH.Loot.byId(a).rarity] - order[CH.Loot.byId(b).rarity]);
    const imgs = [];
    for (const id of ids.slice(0, 14)) {
      const im = CH.Assets.images && CH.Assets.images['loot.' + id];
      if (im) imgs.push('<img alt="" title="' + CH.Loot.byId(id).name + '" src="' + im.src + '">');
    }
    return imgs.length ? '<div class="loot-row">' + imgs.join('') + '</div>' : '';
  };

  UI.showGameOver = function (d) {
    setPlaying(false);
    $('hud').classList.add('hidden');
    // a hardcore character is gone for good (js/areas.js): their name, no RETRY
    setText($('go-title'), G.fallen ? 'R.I.P. ' + G.fallen.toUpperCase() : 'GAME OVER');
    $('btn-retry').style.display = G.fallen ? 'none' : '';
    setText($('go-snark'), G.fallen ? 'Hardcore means hardcore. Their page in the book is torn out.' : U.pick(SNARK));
    $('go-stats').innerHTML = rowsHTML([
      ['Final score', U.fmtNum(d.score)],
      ['Waves survived', d.wave],
      ['Enemies defeated', U.fmtNum(d.kills)],
      ['Coins earned', U.fmtNum(d.coins)],
      ['Trophies found', U.fmtNum(d.loot || 0) + (d.newLoot ? '  (' + d.newLoot + ' new)' : '')],
      ['Time survived', U.fmtTime(d.time)],
      ['Best score', U.fmtNum(d.best)],
    ]) + UI.lootRowHTML();
    $('go-newbest').classList.toggle('hidden', !d.newBest);
    const f = freshText(d.fresh);
    setText($('go-unlock'), f);
    $('go-unlock').classList.toggle('hidden', !f);
    UI.show('gameover');
  };

  UI.showVictory = function (d) {
    setPlaying(false);
    $('hud').classList.add('hidden');
    $('banner').classList.add('hidden');
    $('vic-stats').innerHTML = rowsHTML([
      ['Final score', U.fmtNum(d.score)],
      ['Enemies defeated', U.fmtNum(d.kills)],
      ['Bosses defeated', d.bosses],
      ['Coins earned', U.fmtNum(d.coins)],
      ['Trophies found', U.fmtNum(d.loot || 0) + (d.newLoot ? '  (' + d.newLoot + ' new)' : '')],
      ['Time taken', U.fmtTime(d.time)],
      ['Best score', U.fmtNum(d.best)],
    ]) + UI.lootRowHTML();
    $('vic-newbest').classList.toggle('hidden', !d.newBest);
    const f = freshText(d.fresh);
    setText($('vic-unlock'), f);
    $('vic-unlock').classList.toggle('hidden', !f);
    $('vic-rewards').innerHTML = d.rewards.length ? '<div>REWARDS EARNED</div>' + d.rewards.map((r) => `<div>${r}</div>`).join('') : '';
    const cf = $('confetti');
    cf.textContent = '';
    if (!Storage.settings.reduced) {
      const cols = ['#e43b44', '#feae34', '#fee761', '#63c74d', '#3ccbe6', '#b55088', '#ffffff'];
      for (let i = 0; i < 44; i++) {
        const el = document.createElement('i');
        el.style.left = Math.random() * 100 + '%';
        el.style.background = cols[i % cols.length];
        el.style.animationDuration = 2.5 + Math.random() * 3 + 's';
        el.style.animationDelay = -Math.random() * 4 + 's';
        cf.appendChild(el);
      }
    }
    UI.show('victory');
  };

  /* ------------------------------------------------------------------ HUD */
  /* One HUD block per player: hp + stamina, the six weapon slots (primary / secondary marked), the grenade and the
     special. Player 2's block is a clone of player 1's, so the markup lives in one place. */
  UI.huds = [];
  UI.buildHud = function () {
    const hud = $('hud');
    const clone = (id, n) => {
      const el = $(id).cloneNode(true);
      el.id = id + '-' + n;
      for (const c of el.querySelectorAll('[id]')) c.id += '-' + n;
      return el;
    };
    for (const n of [2, 3, 4]) {
      const hp = clone('hp-panel', n);
      hp.classList.replace('p1', 'p' + n);
      hp.querySelector('.ptag').textContent = 'P' + n;
      const bt = clone('bottom', n);
      bt.classList.replace('p1', 'p' + n);
      const pw = clone('powerups', n);
      hud.appendChild(hp);
      hud.appendChild(bt);
      hud.appendChild(pw);
    }
    UI.huds = [0, 1, 2, 3].map((i) => {
      const q = (id) => $(id + (i ? '-' + (i + 1) : ''));
      return {
        idx: i,
        panel: q('hp-panel'),
        hpfill: q('hpfill'),
        hptrail: q('hptrail'),
        hptxt: q('hptxt'),
        port: q('hudport'),
        stbar: q('stbar'),
        stfill: q('stfill'),
        sttxt: q('sttxt'),
        bottom: q('bottom'),
        ability: q('abilityslot'),
        abilityIcon: q('abilityicon'),
        abilityCd: q('abilitycd'),
        abilityKey: q('abilitykey'),
        gadget: q('gadgetslot'),
        gadgetIcon: q('gadgeticon'),
        gadgetKey: q('gadgetkey'),
        gadgetCount: q('gadgetcount'),
        gadgetCd: q('gadgetcd'),
        weapons: q('weaponslots'),
        pow: q('powerups'),
        chips: {},
        slots: [],
        gad: null,
      };
    });
    UI.gadgetIcons = { frag: CH.Sprites.icon('prob_bomb'), cheese: CH.Sprites.icon('pizza'), frost: CH.Sprites.icon('prob_ice') };
    UI.buildWeaponSlots();
  };

  UI.buildWeaponSlots = function () {
    for (const h of UI.huds) {
      const box = h.weapons;
      box.textContent = '';
      box.classList.add('weaponslots');
      h.slots = [];
      // the hero's own weapon (heroatk.js) leads the bar; its id is read from the player every frame
      {
        const d = document.createElement('div');
        d.className = 'slot sig locked';
        d.innerHTML = '<img alt=""><span class="key">I</span><span class="role"></span><span class="ammo"></span><div class="cd"></div>';
        box.appendChild(d);
        h.slots.push({ id: null, sig: true, el: d, img: d.querySelector('img'), key: d.querySelector('.key'), role: d.querySelector('.role'), ammo: d.querySelector('.ammo'), cd: d.querySelector('.cd') });
      }
      B.weaponOrder.forEach((id, i) => {
        const d = document.createElement('div');
        d.className = 'slot locked';
        d.title = B.weapons[id].name;
        d.innerHTML = `<img alt="" src="${CH.Sprites.icon(CH.Weapons.iconSprite(id))}"><span class="key">${i + 1}</span><span class="role"></span><span class="ammo"></span><div class="cd"></div>`;
        box.appendChild(d);
        h.slots.push({ id, el: d, key: d.querySelector('.key'), role: d.querySelector('.role'), ammo: d.querySelector('.ammo'), cd: d.querySelector('.cd') });
      });
    }
    UI.slots = UI.huds[0].slots; // player 1's slots (kept for older callers)
  };

  UI.refreshWeapons = function () {
    G.players.forEach((p, i) => {
      const h = UI.huds[i];
      if (h) for (const s of h.slots) if (!s.sig) toggleCls(s.el, 'locked', !p.weapons.includes(s.id));
    });
  };

  let lastHp = 1;
  UI.chips = {};

  /* per-frame DOM work that is not part of the HUD: heroes celebrating on the victory screen */
  UI.tick = function (dt) {
    if (CH.Lobby) CH.Lobby.tick(dt || 1 / 60);
    if (G.state !== 'victory' || UI.active !== 'victory') return;
    const c = $('vic-hero');
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, c.width, c.height);
    const ids = G.players.length ? G.players.map((p) => p.hero.id) : [Storage.settings.hero];
    ids.forEach((id, i) => {
      const name = 'hero.' + id;
      const cx = c.width * (ids.length === 1 ? 0.5 : (i + 0.5) / ids.length);
      if (CH.Art.on && CH.Sprites.has(name)) {
        const s = CH.Sprites.get(name);
        const k = ids.length > 1 ? 1 : Math.max(1, Math.floor(Math.min(c.width / s.w, c.height / s.h, 2)));
        CH.Sprites.draw(x, name, cx, c.height - 4, { frame: CH.Sprites.frame(name, 'victory', G.wall + i * 0.4), sx: k, sy: k });
      } else CH.Sprites.draw(x, 'player', cx, c.height - 6, { sx: 2, sy: 2 });
    });
  };

  const ROLE = { pad: ['RT', 'LT'], kbm: ['LMB', 'RMB'] };

  UI.updatePlayerHud = function (h, p) {
    const pad = p.inp.kind === 'pad';
    const hpf = (p.hp / p.maxHp) * 100;
    setW(h.hpfill, hpf);
    setW(h.hptrail, hpf);
    setText(h.hptxt, p.dead ? 'DOWN' : Math.ceil(p.hp) + '/' + p.maxHp);
    toggleCls(h.hpfill.parentNode, 'low', !p.dead && p.hp / p.maxHp < 0.3);
    setW(h.stfill, (p.stamina / B.player.stamina) * 100);
    setText(h.sttxt, p.exhausted ? 'EXHAUSTED' : '');
    toggleCls(h.stbar, 'tired', p.exhausted);
    toggleCls(h.panel, 'dead', p.dead);
    // portrait in the pack's slot frame: the hero's south-facing rotation
    if (h.port && h._heroId !== p.hero.id) {
      h._heroId = p.hero.id;
      const im = CH.UIK && CH.UIK.on && CH.Assets.images['hero.' + p.hero.id + '.rot_s'];
      h.port.classList.toggle('hidden', !im);
      h.panel.classList.toggle('hasport', !!im);
      if (im) h.port.firstChild.src = im.src;
    }

    // power-up chips
    for (const k of Object.keys(B.pickupsBuff)) {
      const t = p.buffs[k];
      let chip = h.chips[k];
      if (t > 0) {
        if (!chip) {
          chip = h.chips[k] = document.createElement('div');
          chip.className = 'chip';
          chip.style.background = B.pickupsBuff[k].color;
          const ic = B.pickupsBuff[k].icon;
          if (ic && CH.Sprites.has(ic)) {
            const im = document.createElement('img');
            im.className = 'chip-ic';
            im.alt = '';
            im.src = CH.Sprites.icon(ic);
            chip.appendChild(im);
            chip.appendChild(document.createElement('span'));
          }
          h.pow.appendChild(chip);
        }
        setText(chip.lastChild && chip.lastChild.tagName === 'SPAN' ? chip.lastChild : chip, B.pickupsBuff[k].name + ' ' + Math.ceil(t) + 's' + (k === 'shield' ? ' ' + Math.ceil(p.shield) : ''));
      } else if (chip) {
        chip.remove();
        h.chips[k] = null;
      }
    }

    // weapon slots: the main weapon (RT / left mouse) and the second weapon (LT / right mouse) are marked
    const roles = ROLE[pad ? 'pad' : 'kbm'];
    for (const s of h.slots) {
      if (s.sig) { // follow the player's hero
        const sd = CH.HeroAtk && CH.HeroAtk.sigOf(p);
        const sid = sd ? sd.id : null;
        if (s.id !== sid) {
          s.id = sid;
          if (sid) { s.img.src = CH.Sprites.icon(CH.Weapons.iconSprite(sid)); s.el.title = B.weapons[sid].name; }
        }
        if (!sid) { toggleCls(s.el, 'locked', true); continue; }
      }
      const owned = p.weapons.includes(s.id);
      toggleCls(s.key, 'hidden', pad);
      toggleCls(s.el, 'locked', !owned);
      if (!owned) continue;
      const ws = p.ws[s.id];
      const d = B.weapons[s.id];
      const prim = p.weapon === s.id;
      const sec = p.weapon2 === s.id;
      toggleCls(s.el, 'active', prim);
      toggleCls(s.el, 'active2', sec && !prim);
      setText(s.role, prim ? roles[0] : sec ? roles[1] : '');
      let cdPct = 0;
      let reloading = false;
      if (ws.reload > 0) {
        reloading = true;
        cdPct = (ws.reload / d.reload) * 100;
      } else if (ws.cd > 0) cdPct = Math.min(100, (ws.cd / CH.Weapons.cooldown(p, s.id)) * 100);
      toggleCls(s.el, 'reload', reloading);
      setH(s.cd, cdPct);
      setText(s.ammo, d.ammo ? (reloading ? 'RLD' : ws.ammo + '/' + d.ammo) : ws.level > 1 ? 'L' + ws.level : '');
    }

    // grenade
    if (h.gad !== p.gadget) {
      h.gad = p.gadget;
      h.gadgetIcon.src = UI.gadgetIcons[p.gadget];
      h.gadget.title = CH.Weapons.gadgetNames[p.gadget];
    }
    setText(h.gadgetCount, 'x' + p.nades);
    setText(h.gadgetKey, pad ? 'LB' : keyLabel(Storage.settings.keys.gadget));
    toggleCls(h.gadget, 'locked', p.nades <= 0);
    setH(h.gadgetCd, p.nades < p.maxNades ? (p.nadeT / B.player.nadeRecharge) * 100 : 0);

    // special ability
    setText(h.abilityKey, pad ? 'RB' : keyLabel(Storage.settings.keys.special));
    const sc = p.specialCd;
    setH(h.abilityCd, (sc / (p.hero.cooldown || B.player.specialCooldown)) * 100);
    toggleCls(h.ability, 'locked', sc > 0);
  };

  UI.updateHUD = function () {
    const p = G.player;
    if (!p || $('hud').classList.contains('hidden')) return;
    const need = B.xp.need(p.level);
    setW($('xpfill'), (p.xp / need) * 100);
    setText($('lvltxt'), 'LV ' + p.level);

    G.players.forEach((pl, i) => {
      const h = UI.huds[i];
      if (!h) return;
      // in co-op each player's panels sit on the side of the screen their view is on (3-4 players: even slots left, odd right)
      const right = G.coop && (G.players.length > 2 ? i % 2 === 1 : G.viewOrder[0] !== i);
      toggleCls(h.panel, 'side-r', right);
      toggleCls(h.bottom, 'side-r', right);
      toggleCls(h.pow, 'side-r', right);
      for (const el of [h.panel, h.bottom, h.pow]) toggleCls(el, 'row2', i >= 2);
      toggleCls(h.pow, 'low', G.players.length > 2 && i < 2);
      UI.updatePlayerHud(h, pl);
    });
    UI.chips = UI.huds[0].chips;

    const camp = !G.endless && G.wave <= B.waves.campaign;
    setText($('wavetxt'), camp ? `WAVE ${G.wave}/${B.waves.campaign}` : `WAVE ${G.wave} ENDLESS`);
    setText($('enemytxt'), G.waveState === 'intro' ? 'GET READY...' : G.waveState === 'clear' ? 'CLEARED!' : 'ENEMIES ' + G.remaining());
    setText($('scoretxt'), 'SCORE ' + U.fmtNum(G.score));
    const cm = G.scoreMult();
    setText($('combotxt'), (G.combo > 1 ? G.combo + ' COMBO  ' : '') + 'x' + cm.toFixed(1));
    toggleCls($('combotxt'), 'hot', cm >= 1.5);
    setText($('cointxt'), U.fmtNum(G.coins));
    // the stockpile the barricade (F / R3) is paid from; the green number is what this run has added
    const res = Storage.resources;
    for (const k of ['wood', 'scrap', 'stone']) setText($('res-' + k), (res[k] || 0) + (G.resources && G.resources[k] ? ' +' + G.resources[k] : ''));
    setText($('res-loot'), G.lootCount || 0);

    // boss bar
    const bp = $('boss-panel');
    let boss = null;
    for (const e of G.enemies) if (e.isBoss && !e.dead) boss = e;
    if (boss) {
      if (bp.classList.contains('hidden') && !boss.dying) bp.classList.remove('hidden');
      const f = (boss.hp / boss.maxHp) * 100;
      setW($('bossfill'), f);
      setW($('bosstrail'), f);
      setText($('bosstxt'), Math.ceil(boss.hp) + ' / ' + boss.maxHp);
      toggleCls(bp, 'immune', !!boss.immune);
      if (boss.kind === 'bug' || boss.kind === 'skull') setText($('bossname'), boss.name + (boss.phase > 1 ? '  [PHASE ' + boss.phase + ']' : ''));
    }

    // event bar
    const ev = G.event;
    const ep = $('event-panel');
    if (ev) {
      ep.classList.remove('hidden');
      if (!ev.active) {
        setText($('eventname'), '!! INCOMING: ' + ev.def.name + ' !!');
        setText($('eventtxt'), Math.ceil(ev.warn) + 's');
        setW($('eventfill'), 100);
        toggleCls(ep, 'warn', true);
      } else {
        setText($('eventname'), ev.def.name);
        setText($('eventtxt'), Math.ceil(ev.left) + 's');
        setW($('eventfill'), (ev.left / ev.def.duration) * 100);
        toggleCls(ep, 'warn', false);
      }
    } else if (!ep.classList.contains('hidden')) ep.classList.add('hidden');
  };
})(window.CH);
