/* CHAOS.exe - the character in the active save slot (PLAN.md 18, K0a). The game is one hero's adventure now: when play
   starts the slot's level, experience, skill points and tree, weapons and gold come back, and they are written back as
   they change (every 15 s of play, at each stage, on pause, on quitting, when the page is hidden or closed).
   With no active slot (the menu, most tests) nothing is restored or saved.
   Co-op (K0e): player 2-4 brings a saved character (p.slotRef: its level, skills, weapons and gear come along and its
   progress is written back with the host's saves; the gold is the host's) or plays a guest scaled to player 1. */
(function (CH) {
  'use strict';
  const G = CH.G;
  const Storage = CH.Storage;

  const C = (CH.Character = { every: 15 });

  /* what the slot keeps of a player */
  C.snapshot = (p) => {
    const ws = {};
    for (const w of p.weapons) if (p.ws && p.ws[w]) ws[w] = { level: p.ws[w].level || 1 };
    return { level: p.level, xp: p.xp, sp: p.sp || 0, skills: Object.assign({}, p.skills || {}), gold: Math.floor(G.coins || 0), weapons: p.weapons.slice(), weapon: p.weapon, weapon2: p.weapon2, ws, gadget: p.gadget,
      belt: (p.belt || []).map((s) => (s ? { id: s.id, n: s.n } : null)), body: Object.assign({}, p.body || {}), revive: p.revive || 0, bless: p.bless ? Object.assign({}, p.bless) : null };
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
    if (c.belt) p.belt = c.belt.map((s) => (s && CH.Items.CONSUMABLES[s.id] ? { id: s.id, n: s.n } : null));
    p.body = Object.assign({ vit: 0, gut: 0, heart: 0 }, c.body || {});
    p.revive = c.revive || 0;
    p.bless = c.bless ? Object.assign({}, c.bless) : null;
    CH.Upgrades.recalc(p);
    p.hp = p.maxHp;
  };

  let played = 0, since = 0;
  /* the slot is only written once its character is back on the player: newRun starts stage 1 inside its core, before
     the listener below restores the character, and a save there would overwrite it with a level-1 hero */
  C.loaded = false;
  /* write the first player's progress into the active slot */
  C.save = () => {
    // partners with their own character first (the host's save below writes them too)
    for (const p of G.players) if (p.slotRef && p.slotRef !== Storage.slot() && C.loaded) Storage.setSlotChar(p.slotRef, Object.assign(C.snapshot(p), { gold: p.slotRef.char.gold }), played);
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
  /* a partner: their own character (gear from their own slot), or a guest at the host's level */
  C.partner = function (p, def, host) {
    const ref = def && def.slot;
    if (ref && Storage.slots().includes(ref) && ref !== Storage.slot()) {
      p.slotRef = ref;
      const d = ref.data && ref.data.diablo;
      if (d) {
        d.equipped = d.equipped && typeof d.equipped === 'object' ? d.equipped : {};
        p.guestGear = d.equipped[ref.hero] || (d.equipped[ref.hero] = {});
      }
      C.apply(p, ref.char);
      return;
    }
    p.guest = true;
    p.level = Math.max(1, host.level || 1);
    p.sp = p.level - 1;
    p.skills = {};
    CH.Upgrades.recalc(p);
    p.hp = p.maxHp;
  };
  G.on('newRun', function () {
    played = 0;
    since = 0;
    const cfg = G.lastConfig;
    const c = Storage.charOf();
    if (c && G.players.length) C.apply(G.players[0], c);
    if (cfg && cfg.players) G.players.forEach((p, i) => { if (i > 0) C.partner(p, cfg.players[i], G.players[0]); });
    if (!c || !G.players.length) return;
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
