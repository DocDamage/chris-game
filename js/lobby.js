/* CHAOS.exe - the local co-op lobby. Up to four slots; each device (keyboard + mouse, or one gamepad) claims a slot by
   pressing its confirm button, picks who it plays and readies up. When everyone is ready play starts with exactly
   those devices bound to those heroes.
   Who a player is (PLAN.md 18, K0e): one of the saved characters (it keeps its level, skills, weapons and gear, and its
   progress is saved with it), or a guest hero (nothing is saved; it starts at player 1's level with the skill points to
   match). Player 1 is the host: the world, the gold and the bag are theirs. Playing solo is PLAY on the main menu. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const Storage = CH.Storage;
  const Input = CH.Input;
  const BTN = Input.BTN;
  const $ = (id) => document.getElementById(id);

  const Lobby = (CH.Lobby = {
    slots: [null, null, null, null], // {src, hero, slot (a character's index, -1 = a guest), ready}
    countdown: 0,
  });

  const heroList = () => B.heroes.filter((h) => Storage.isUnlocked(h.id));
  const srcKey = (s) => (s.kind === 'pad' ? 'pad' + s.index : s.kind);

  Lobby.open = function (opener) {
    Lobby.slots = [null, null, null, null];
    Lobby.countdown = 0;
    const heroes = heroList();
    const d1 = heroes.find((h) => h.id === Storage.settings.hero) || heroes[0];
    const d2 = heroes.find((h) => h.id === Storage.settings.hero2) || heroes[0];
    Lobby.defaults = [d1, d2, heroes[2 % heroes.length], heroes[3 % heroes.length]];
    CH.G.menuCoop = true;
    if (opener) Lobby.join(opener);
    CH.UI.show('lobby');
    Lobby.refresh();
  };

  Lobby.close = function () {
    CH.G.menuCoop = false;
    Lobby.countdown = 0;
  };

  Lobby.slotOf = (src) => Lobby.slots.findIndex((s) => s && srcKey(s.src) === srcKey(src));
  /* what lobby slot i can pick: the saved characters nobody else took, then a guest of every unlocked hero */
  Lobby.entries = function (i) {
    const out = [];
    Storage.slots().forEach((c, k) => {
      if (!Lobby.slots.some((o, j) => o && j !== i && o.slot === k)) out.push({ slot: k, hero: c.hero });
    });
    for (const h of heroList()) out.push({ slot: -1, hero: h.id });
    return out;
  };

  Lobby.join = function (src) {
    if (Lobby.slotOf(src) >= 0) return false;
    const i = Lobby.slots.findIndex((s) => !s);
    if (i < 0) return false;
    // player 1 plays the active character when there is one; the others start as guests
    const act = Storage.activeIndex();
    const own = i === 0 && act >= 0 && !Lobby.slots.some((o) => o && o.slot === act);
    Lobby.slots[i] = own ? { src, hero: Storage.slot().hero, slot: act, ready: false } : { src, hero: Lobby.defaults[i].id, slot: -1, ready: false };
    CH.Audio.sfx('confirm');
    return true;
  };

  Lobby.leave = function (src) {
    const i = Lobby.slotOf(src);
    if (i < 0) return false;
    Lobby.slots[i] = null;
    Lobby.countdown = 0;
    CH.Audio.sfx('back');
    return true;
  };

  Lobby.cycleHero = function (src, dir) {
    const i = Lobby.slotOf(src);
    if (i < 0 || Lobby.slots[i].ready) return;
    const list = Lobby.entries(i);
    const s = Lobby.slots[i];
    let k = list.findIndex((e) => e.slot === s.slot && (e.slot >= 0 || e.hero === s.hero));
    k = (k + dir + list.length) % list.length;
    s.hero = list[k].hero;
    s.slot = list[k].slot;
    CH.Audio.sfx('hover');
  };

  Lobby.toggleReady = function (src) {
    const i = Lobby.slotOf(src);
    if (i < 0) return;
    const s = Lobby.slots[i];
    s.ready = !s.ready;
    CH.Audio.sfx(s.ready ? 'confirm' : 'back');
    Lobby.countdown = 0;
  };

  Lobby.joined = () => Lobby.slots.filter(Boolean);

  Lobby.tryStart = function () {
    const j = Lobby.joined();
    if (j.length < 2) {
      CH.UI.toast('NEED 2 PLAYERS: PRESS A ON A CONTROLLER OR JOIN WITH THE KEYBOARD');
      CH.Audio.sfx('nope');
      return false;
    }
    Lobby.start();
    return true;
  };

  Lobby.start = function () {
    const j = Lobby.joined();
    const refs = j.map((x) => (x.slot >= 0 ? Storage.slots()[x.slot] || null : null));
    Storage.useSlot(refs[0] ? j[0].slot : -1); // player 1's character hosts the world (or nobody's: an unsaved world)
    Storage.settings.hero = j[0].hero;
    Storage.settings.hero2 = j[1].hero;
    Storage.save();
    const config = { players: j.map((x, i) => ({ hero: x.hero, src: x.src, slot: refs[i] })) };
    Lobby.close();
    CH.G.newRun(config);
  };

  /* ---- device input ---- */
  Lobby.padInput = function (pad, dirs) {
    const src = { kind: 'pad', index: pad.index };
    const joined = Lobby.slotOf(src) >= 0;
    if (pad.pressed[BTN.A]) {
      if (!joined) Lobby.join(src);
      else Lobby.toggleReady(src);
    }
    if (pad.pressed[BTN.B]) {
      if (joined) {
        const s = Lobby.slots[Lobby.slotOf(src)];
        if (s.ready) Lobby.toggleReady(src);
        else Lobby.leave(src);
      } else if (!Lobby.joined().length) CH.UI.back();
    }
    if (pad.pressed[BTN.START]) Lobby.tryStart();
    if (joined) {
      for (const d of dirs) {
        if (d === 'left') Lobby.cycleHero(src, -1);
        if (d === 'right') Lobby.cycleHero(src, 1);
      }
    }
  };

  Lobby.keyInput = function (e) {
    const src = { kind: 'kbm' };
    const joined = Lobby.slotOf(src) >= 0;
    if (e.code === 'Enter' || e.code === 'Space') {
      if (!joined) Lobby.join(src);
      else Lobby.toggleReady(src);
      e.preventDefault();
    } else if (joined && (e.code === 'ArrowLeft' || e.code === 'KeyA')) Lobby.cycleHero(src, -1);
    else if (joined && (e.code === 'ArrowRight' || e.code === 'KeyD')) Lobby.cycleHero(src, 1);
    else if (joined && e.code === 'Backspace') Lobby.leave(src);
  };

  /* ---- DOM ---- */
  Lobby.refresh = function () {
    const pads = Input.connectedPads();
    Lobby.slots.forEach((s, i) => {
      const el = $('lslot-' + i);
      if (!el) return;
      el.classList.toggle('joined', !!s);
      el.classList.toggle('ready', !!(s && s.ready));
      const hero = s ? B.heroes.find((h) => h.id === s.hero) : Lobby.defaults ? Lobby.defaults[i] : B.heroes[0];
      const ch = s && s.slot >= 0 ? Storage.slots()[s.slot] : null;
      el.querySelector('.lhero').textContent = !s ? '' : ch ? ch.name.toUpperCase() + '  LV ' + ch.char.level : 'GUEST: ' + hero.name.split(',')[0].toUpperCase();
      el.querySelector('.lspecial').textContent = !s ? '' : ch ? hero.name + (ch.hardcore ? ' - hardcore' : '') + '. Progress is saved with this character.' : 'Nothing is saved. Starts at player 1\'s level.';
      el.querySelector('.ldev').textContent = s ? (s.src.kind === 'kbm' ? 'KEYBOARD + MOUSE' : 'CONTROLLER ' + (s.src.index + 1)) : '';
      el.querySelector('.lstate').textContent = !s ? (pads.length ? 'PRESS A TO JOIN' : 'WAITING FOR A DEVICE...') : s.ready ? 'READY!' : '< CHOOSE >   A = READY';
    });
    const n = Lobby.joined().length;
    const btn = $('btn-lobby-start');
    if (btn) btn.classList.toggle('off', n < 2);
    const kb = $('btn-lobby-kbm');
    if (kb) kb.classList.toggle('hidden', Lobby.slotOf({ kind: 'kbm' }) >= 0 || n >= 4);
    const hint = $('lobby-hint');
    if (hint) {
      const txt = n >= 2 ? (Lobby.countdown > 0 ? 'STARTING...' : n + ' players in. Ready up (up to 4 can join), or press START.') : pads.length ? 'Press A on a controller to join (2-4 players). The screen splits when you drift apart and merges when you meet up.' : 'No controller found. Plug one in and press A, or join with the keyboard + mouse. Every player needs their own device.';
      if (hint.__t !== txt) {
        hint.__t = txt;
        hint.textContent = txt;
      }
    }
  };

  Lobby.tick = function (dt) {
    if (CH.UI.active !== 'lobby') return;
    Lobby.refresh();
    const j = Lobby.joined();
    if (j.length >= 2 && j.every((s) => s.ready)) {
      Lobby.countdown = (Lobby.countdown || 0) + dt;
      if (Lobby.countdown > 0.9) Lobby.start();
    } else Lobby.countdown = 0;
    // idle portraits
    for (let i = 0; i < 4; i++) {
      const c = document.querySelector('#lslot-' + i + ' canvas');
      if (!c) continue;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.clearRect(0, 0, c.width, c.height);
      const s = Lobby.slots[i];
      const id = s ? s.hero : Lobby.defaults ? Lobby.defaults[i].id : 'Mercenary';
      const name = 'hero.' + id;
      if (CH.Art.on && CH.Sprites.has(name)) {
        const sp = CH.Sprites.get(name);
        const k = Math.max(1, Math.floor(Math.min(c.width / sp.w, c.height / sp.h)));
        CH.Sprites.draw(x, name, c.width / 2, c.height - 4, { frame: CH.Sprites.frame(name, s && s.ready ? 'victory' : 'idle', CH.G.wall), sx: k, sy: k });
      } else CH.Sprites.draw(x, 'player', c.width / 2, c.height - 6, { sx: 2, sy: 2 });
    }
  };
})(window.CH);
