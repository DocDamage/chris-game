/* CHAOS.exe - the character's world (PLAN.md 18, K0b). No more runs: every stage is an area of one world that belongs
   to the character. The world seed makes each area the same on every visit; what you change there is kept (breaches
   closed, chests opened, secret rooms found, shrines used, waypoints lit, the boss killed, the path chosen at a fork);
   the monsters come back thinner when you return.
   A character who has been out before wakes in the hideout when loaded: its portal leads back to the area they were last
   in, the waypoint keeper to any area with a lit waypoint. A brand-new character starts in the first area.
   Saved in the slot as world = { seed, at, deepest, path, areas: { [stage]: { biome, visits, closed, chests, secrets,
   shrines, wps, cleared, boss } } } (js/storage.js checks it).
   With no character (tests, debug) none of this applies: play runs stage after stage as before.
   Act bosses unlock heroes for the whole account (the owner's choice, 18.1).
   Death (K0c): a character wakes in the hideout and half the gold they carried waits at the corpse; a hardcore character
   is deleted and gets the game over screen. */
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
    G.fallen = null;
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
  /* ------------------------------------------------------------------ death (K0c): wake in the hideout, gold at the corpse */
  A.corpseShare = 0.5; // the part of the carried gold left at the corpse
  /* js/game.js asks before its game over: a character wakes in the hideout instead (true); a hardcore one is gone */
  A.onDeath = function () {
    const s = Storage.slot(), W = A.world();
    if (!s || !W) return false;
    if (s.hardcore) {
      G.fallen = s.name || 'Your hero';
      Storage.deleteSlot(Storage.activeIndex());
      return false;
    }
    A.capture();
    const p = G.players.find((q) => q.x !== undefined) || G.player;
    const gold = Math.floor((G.coins || 0) * A.corpseShare);
    G.coins -= gold;
    W.corpse = gold > 0 && G.wave >= 1 ? { area: G.wave, x: Math.round(p.x), y: Math.round(p.y), gold } : null; // a new death leaves the old corpse's gold behind for good
    W.at = Math.max(1, G.wave || 1);
    for (const q of G.players) {
      q.dead = false;
      q.deathT = 0;
      q.reviveT = 0;
      q.hp = q.maxHp;
      q.invuln = 2;
      q.vx = q.vy = 0;
    }
    G.deathTimer = 0;
    G.bossDying = null;
    G.victoryPending = false;
    if (G.ui && G.ui.hideBossBar) G.ui.hideBossBar(false);
    if (CH.Town) {
      CH.Town.inTown = false;
      CH.Town.saved = null;
      CH.Town.pendingStage = 0;
      CH.Town.wantTown = false;
    }
    G.level = null;
    G.arena = null;
    if (CH.Town) CH.Town.enter('death');
    if (CH.Character) CH.Character.save();
    G.banner('YOU DIED', gold > 0 ? 'You wake in the hideout. ' + gold + ' gold lies where you fell.' : 'You wake in the hideout.', 3.4);
    return true;
  };
  /* the corpse waits in its area (and in a boss arena) until a hero walks over it */
  const corpseHere = () => {
    const W = A.world(), c = W && W.corpse;
    if (!c || c.area !== G.wave || (G.level && G.level.isTown) || !G.arena) return null;
    return c;
  };
  G.on('step', function () {
    const c = corpseHere();
    if (!c || G.state !== 'playing') return;
    for (const p of G.players) {
      if (p.dead || U.dist(p.x, p.y, c.x, c.y) > 24) continue;
      G.coins += c.gold;
      FX.text(c.x, c.y - 24, '+' + c.gold + ' GOLD RECOVERED', '#fee761', 2);
      FX.burst(c.x, c.y, { n: 22, colors: ['#fee761', '#feae34', '#ffffff'], speed: 120, life: 0.6 });
      CH.Audio.sfx('chest');
      A.world().corpse = null;
      if (G.runStat) G.runStat('corpses', 1);
      if (CH.Character) CH.Character.save();
      return;
    }
  });
  CH.Hooks.world.push((ctx, cam) => {
    const c = corpseHere();
    if (!c) return;
    const x = Math.round(c.x - cam.x), y = Math.round(c.y - cam.y);
    if (x < -40 || y < -40 || x > B.view.w + 40 || y > B.view.h + 40) return;
    const t = G.time || 0;
    // a cross over a little heap, gold glinting on it
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x, y + 3, 12, 4, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#5a4632'; ctx.fillRect(x - 9, y - 2, 18, 5);
    ctx.fillStyle = '#8a8a96'; ctx.fillRect(x - 1, y - 20, 3, 19); ctx.fillRect(x - 6, y - 15, 13, 3);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = (Math.floor(t * 4) + i) % 4 === 0 ? '#ffffff' : '#fee761'; ctx.fillRect(x - 7 + i * 4, y - 3 - (i % 2), 2, 2); }
    CH.Font.draw(ctx, 'YOUR CORPSE', x, y + 8, '#fee761', 1, true);
  });
})(window.CH);
