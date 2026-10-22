/* CHAOS.exe - the local co-op lobby. Two slots; each device (keyboard + mouse, or one gamepad) claims a slot by
   pressing its confirm button, picks a hero and readies up. When both heroes are ready the run starts with exactly
   those devices bound to those heroes. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const Storage = CH.Storage;
  const Input = CH.Input;
  const BTN = Input.BTN;
  const $ = (id) => document.getElementById(id);

  const Lobby = (CH.Lobby = {
    slots: [null, null, null, null], // {src, hero, ready}
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

  Lobby.join = function (src) {
    if (Lobby.slotOf(src) >= 0) return false;
    const i = Lobby.slots.findIndex((s) => !s);
    if (i < 0) return false;
    Lobby.slots[i] = { src, hero: Lobby.defaults[i].id, ready: false };
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
    const list = heroList();
    const s = Lobby.slots[i];
    let k = list.findIndex((h) => h.id === s.hero);
    k = (k + dir + list.length) % list.length;
    s.hero = list[k].id;
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
    Storage.settings.hero = j[0].hero;
    Storage.settings.hero2 = j[1].hero;
    Storage.save();
    const config = { players: j.map((x) => ({ hero: x.hero, src: x.src })) };
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
      el.querySelector('.lhero').textContent = s ? hero.name.toUpperCase() : '';
      el.querySelector('.lspecial').textContent = s ? hero.blurb : '';
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
