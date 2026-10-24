/* CHAOS.exe - the character's world (PLAN.md 18, K0b). No more runs: every stage is an area of one world that belongs
   to the character. The world seed makes each area the same on every visit; what you change there is kept (breaches
   closed, chests opened, secret rooms found, shrines used, waypoints lit, the boss killed, the path chosen at a fork);
   the monsters come back thinner when you return.
   A character who has been out before wakes in the hideout when loaded: its portal leads back to the area they were last
   in, the waypoint keeper to any area with a lit waypoint. A brand-new character starts in the first area.
   Saved in the slot as world = { seed, at, deepest, path, areas: { [stage]: { biome, visits, closed, chests, secrets,
   shrines, wps, cleared, boss } } } (js/storage.js checks it).
   With no character (tests, debug) none of this applies: play runs stage after stage as before.
   Act bosses unlock heroes for the whole account (the owner's choice, 18.1). */
(function (CH) {
  'use strict';
  const G = CH.G;
  const U = CH.U;
  const B = CH.Balance;
  const FX = CH.FX;
  const Storage = CH.Storage;
  const Level = CH.Level;

  const A = (CH.Areas = { thin: 0.4, loading: false });

  /* the act each boss stage ends (stage 3 ends act I ...) */
  A.ACT_BOSS = { 3: 1, 5: 2, 8: 3, 10: 4 };

  A.world = () => { const s = Storage.slot(); return s ? s.world : null; };
  A.state = (n) => { const W = A.world(); return W ? W.areas[n] || null : null; };
  /* where the hideout's portal leads: the area the character was last in */
  A.resume = () => { const W = A.world(); return W ? Math.max(1, W.at || 1) : 0; };

  const indexes = (list, test) => (list || []).reduce((out, o, i) => (test(o) ? out.concat(i) : out), []);
  /* the area being played, or the one left behind for the hideout */
  const current = () => (CH.Town && CH.Town.inTown ? CH.Town.saved && CH.Town.saved.L : G.level);

  /* write what changed in the current area into the world (js/character.js calls this before every save) */
  A.capture = function () {
    const W = A.world();
    if (!W) return;
    W.path = Object.assign({}, G.chosenPath || {});
    const L = current();
    if (!L || L.isTown || !L.areaReady) return;
    const a = W.areas[L.stage] || (W.areas[L.stage] = { visits: 1 });
    a.biome = L.biome;
    a.closed = indexes(L.spawners, (s) => s.dead);
    a.chests = indexes(L.chests, (c) => c.opened);
    a.secrets = indexes(L.secrets, (s) => s.found);
    a.shrines = indexes(L.shrines, (s) => s.used);
    a.wps = indexes(L.waypoints, (w) => w.active);
    a.cleared = !!(a.cleared || L.opened);
  };

  /* a freshly generated area gets back what the character did there; a return visit is thinner */
  A.restore = function (L, a, W) {
    const n = L.stage;
    for (const i of a.chests || []) if (L.chests[i]) L.chests[i].opened = true;
    for (const i of a.shrines || []) if (L.shrines[i]) L.shrines[i].used = true;
    for (const i of a.wps || []) if (L.waypoints[i]) L.waypoints[i].active = true;
    for (const i of a.secrets || []) {
      const s = L.secrets && L.secrets[i];
      if (!s) continue;
      s.found = true;
      if (L.cell(s.crack.x, s.crack.y) === Level.CRACKED) L.set(s.crack.x, s.crack.y, Level.FLOOR);
      L.reveal(s.cx, s.cy, 4);
    }
    // closed breaches stay closed: their hive is not there
    const shut = new Set(a.closed || []);
    L.spawners.forEach((def, i) => {
      if (!shut.has(i)) return;
      def.dead = true;
      if (def.enemy) { def.enemy.dead = true; def.enemy.isSpawner = true; }
    });
    if (shut.size) {
      L.hives = (L.hives || []).filter((e) => !e.hive.dead);
      for (let i = G.enemies.length - 1; i >= 0; i--) if (G.enemies[i].isSpawner && G.enemies[i].hive && G.enemies[i].hive.dead) G.enemies.splice(i, 1);
    }
    if (a.cleared || L.spawners.filter((s) => s.dead).length >= L.hivesNeeded) {
      L.opened = true;
      L.exit.open = true;
    }
    // the monsters come back, fewer of them
    if (a.visits > 0) {
      const rng = U.seeded((W.seed + n * 131 + a.visits * 7) >>> 0);
      const keep = L.packs.filter(() => rng() < A.thin);
      L.packs.length = 0;
      for (const pk of keep) L.packs.push(pk);
    }
  };

  /* ------------------------------------------------------------------ stage starts */
  G.on('newRun:before', function () {
    A.loading = !!A.world();
  });
  G.on('startWave:before', function (ev) {
    const W = A.world();
    if (!W) return;
    A.capture(); // the area being left
    G.runSeed = W.seed; // every area comes from the character's world
    G.runIndex = W.seed % 2520; // and so do its bosses
    if (W.path && G.chosenPath && !Object.keys(G.chosenPath).length) Object.assign(G.chosenPath, W.path);
    // a character who has been out before starts in the hideout
    if (A.loading) {
      A.loading = false;
      if (W.deepest >= 1 && CH.Town) {
        ev.stop = true;
        CH.Town.enter('load');
        return;
      }
    }
    // a boss already beaten: walk on to the next area
    const boss = G.isBossWave(ev.n);
    const st = W.areas[ev.n];
    if (boss && st && st.boss && ev.n < B.waves.campaign) ev.n++;
  });
  G.on('startWave', function (ev) {
    const W = A.world();
    if (!W) return;
    const n = ev.n;
    W.at = n;
    W.deepest = Math.max(W.deepest || 0, n);
    const L = G.level;
    if (!L || L.isTown || L.stage !== n || L.areaReady) return; // a boss arena, or the hideout
    const a = W.areas[n] || (W.areas[n] = { visits: 0 });
    A.restore(L, a, W);
    a.visits = (a.visits || 0) + 1;
    a.biome = L.biome;
    L.areaReady = true;
    if (a.visits > 1) G.banner('STAGE ' + n, L.name.toUpperCase() + '  -  ' + (L.opened ? 'Cleared. The monsters have crept back.' : 'You have been here before.'), 2.6);
  });
  G.on('newRun', function () {
    // the hideout's music and its afternoon, after newRun's own music call
    if (CH.Town && CH.Town.inTown && A.world()) CH.Audio.setMusic('shop');
  });

  /* ------------------------------------------------------------------ bosses and the heroes they unlock */
  G.on('kill', function (e) {
    if (!e.isBoss) return;
    const boss = G.isBossWave(G.wave);
    if (!boss || boss.kind !== e.kind || e.tier) return;
    const W = A.world();
    if (W) (W.areas[G.wave] || (W.areas[G.wave] = { visits: 1 })).boss = true;
    const act = A.ACT_BOSS[G.wave];
    const s = Storage.stats;
    if (act && act > (s.acts || 0)) {
      s.acts = act;
      const fresh = Storage.checkUnlocks();
      for (const h of fresh) {
        if (G.ui && G.ui.toast) G.ui.toast('NEW HERO: ' + h.name.split(',')[0].toUpperCase());
        if (FX && e.x !== undefined) FX.text(e.x, e.y - 40, 'NEW HERO', '#fee761', 2);
      }
      Storage.save();
    }
  });
})(window.CH);
