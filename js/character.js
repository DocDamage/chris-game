/* CHAOS.exe - the character in the active save slot (PLAN.md 18, K0a). The game is one hero's adventure now: when play
   starts the slot's level, experience, skill points and tree, weapons and gold come back, and they are written back as
   they change (every 15 s of play, at each stage, on pause, on quitting, when the page is hidden or closed).
   With no active slot (the menu, most tests) nothing is restored or saved. */
(function (CH) {
  'use strict';
  const G = CH.G;
  const Storage = CH.Storage;

  const C = (CH.Character = { every: 15 });

  /* what the slot keeps of a player */
  C.snapshot = (p) => {
    const ws = {};
    for (const w of p.weapons) if (p.ws && p.ws[w]) ws[w] = { level: p.ws[w].level || 1 };
    return { level: p.level, xp: p.xp, sp: p.sp || 0, skills: Object.assign({}, p.skills || {}), gold: Math.floor(G.coins || 0), weapons: p.weapons.slice(), weapon: p.weapon, weapon2: p.weapon2, ws, gadget: p.gadget };
  };

  /* bring a slot's progress back onto a fresh player (after the newRun listeners gave the hero its own weapon) */
  C.apply = (p, c) => {
    p.level = c.level;
    p.xp = c.xp;
    p.sp = c.sp;
    p.skills = Object.assign({}, c.skills);
    const known = (w) => CH.Balance.weapons[w] !== undefined;
    const weapons = c.weapons.filter(known);
    if (weapons.length) {
      for (const w of p.weapons) if (!weapons.includes(w)) weapons.push(w); // anything the hero is given anew
      p.weapons = weapons;
      for (const w of weapons) {
        p.ws[w] = p.ws[w] || CH.Weapons.newState(w);
        if (c.ws[w]) p.ws[w].level = c.ws[w].level;
      }
      if (c.weapon && weapons.includes(c.weapon)) p.weapon = c.weapon;
      p.weapon2 = c.weapon2 && weapons.includes(c.weapon2) ? c.weapon2 : p.weapon2;
    }
    if (c.gadget) p.gadget = c.gadget;
    CH.Upgrades.recalc(p);
    p.hp = p.maxHp;
  };

  let played = 0, since = 0;
  /* the slot is only written once its character is back on the player: newRun starts stage 1 inside its core, before
     the listener below restores the character, and a save there would overwrite it with a level-1 hero */
  C.loaded = false;
  /* write the first player's progress into the active slot */
  C.save = () => {
    if (!Storage.slot() || !G.players.length || !C.loaded) return Storage.save();
    if (CH.Areas) CH.Areas.capture(); // what changed in the area (js/areas.js)
    const ok = Storage.setChar(C.snapshot(G.players[0]), played);
    played = 0;
    since = 0;
    return ok;
  };

  G.on('newRun:before', function () {
    C.loaded = false;
  });
  G.on('newRun', function () {
    played = 0;
    since = 0;
    const c = Storage.charOf();
    if (!c || !G.players.length) return;
    C.apply(G.players[0], c);
    G.coins = c.gold;
    C.loaded = true;
  });
  G.on('step', function (dt) {
    if (!Storage.slot() || G.state !== 'playing') return;
    played += dt;
    since += dt;
    if (since >= C.every) C.save();
  });
  G.on('startWave', function () {
    if (Storage.slot()) C.save();
  });

  /* quitting, pausing and the end of play call this (js/game.js); so does leaving the page */
  C.saveIfPlaying = () => { if (Storage.slot() && G.players.length && C.loaded && G.state !== 'menu') C.save(); };
  const leave = () => C.saveIfPlaying();
  window.addEventListener('beforeunload', leave);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leave(); });
})(window.CH);
