/* CHAOS.exe - the run director for level stages (PLAN.md R2, sections 8 and 9). A stage is a generated Level that you
   explore: close the breaches (spawners), then walk to the exit. Boss stages keep the old arena fights, so the wave
   code still owns those, and the 'clear' / next-stage hand-over (G.waveComplete, branch prompts) is shared.
   G.wave stays the stage number ("depth"; G.depth is an alias), so every system that scales by it keeps working.
   Turn levels off with CH.Run.levels = false (tests that are about the old wave loop do this). */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const G = CH.G;
  const X = CH.X;
  const UI = CH.UI;
  const Audio = CH.Audio;
  const LG = CH.LevelGen;
  const TS = CH.Level.TS;
  const wrap = X.wrap;

  const Run = (CH.Run = { levels: true });

  /* G.depth is the stage number: the same value as the old wave counter */
  Object.defineProperty(G, 'depth', { get: () => G.wave, set: (v) => { G.wave = v; }, configurable: true });
  G.level = null;

  const players = () => G.players.filter((p) => !p.dead);
  Run.aliveCount = () => G.enemies.reduce((n, e) => n + (e.dead || e.isSpawner ? 0 : 1), 0);

  /* levels are used for normal campaign / marathon / quick / endless stages that are not boss fights */
  Run.usesLevels = (n) => {
    if (!Run.levels) return false;
    const mode = X.run && X.run.mode;
    if (mode === 'rush' || mode === 'tutorial' || mode === 'training') return false; // arena modes
    return !G.isBossWave(n);
  };

  const biomeFor = (n) => {
    const id = G.pathArena(n) || B.waves.arenaForWave(n);
    return LG.MOBS[id] ? id : 'dungeon';
  };

  /* ------------------------------------------------------------------ starting a stage */
  wrap(G, 'startWave', function (orig, n) {
    if (!Run.usesLevels(n)) {
      if (G.level) { // leaving a level for a boss arena: the arena builder must not think it is already built
        G.level = null;
        G.arena = null;
        for (const s of G.enemies) s.dead = true;
        G.enemies.length = 0;
        G.pickups.length = 0;
      }
      return orig.call(G, n);
    }
    Run.startLevel(n);
  });

  Run.startLevel = function (n) {
    G.wave = n;
    if (G.runSeed === undefined || G.runSeed === null) G.runSeed = X.run && X.run.seed != null ? X.run.seed >>> 0 : (Math.random() * 2147483647) | 0;
    const biome = biomeFor(n);
    const rng = U.seeded((G.runSeed + n * 7919) >>> 0);
    const L = LG.generate(biome, n, rng);
    L.stage = n;
    L.threat = 0;
    L.threatT = 0;
    L.revealT = 0;
    L.opened = false;
    L.fx = 0;
    G.level = L;
    G.arena = L;
    G.enemies.length = 0;
    G.zones.length = 0;
    G.projectiles.length = 0;
    G.decoys.length = 0;
    G.pickups.length = 0;
    G.queue = [];
    G.groupOrigin = null;
    // heroes arrive at the entrance
    const players = G.players;
    players.forEach((p, i) => {
      const q = L.randomNear(L.entrance.x, L.entrance.y, 0, 34, 14) || L.entrance;
      p.x = i === 0 ? L.entrance.x : q.x;
      p.y = i === 0 ? L.entrance.y : q.y;
      p.vx = p.vy = p.kx = p.ky = 0;
    });
    G.snapCamera();
    L.reveal(L.entrance.x, L.entrance.y, 10);
    G.screenFlash(0.8, '#ffffff');
    Audio.sfx(biome === 'glitch' ? 'door_auto' : 'door_open');
    Audio.sfx('scan');
    G.playMusic();
    G.revivePlayers(0.4);
    G.waveState = 'combat';
    G.waveT = 0;
    G.spawnT = 0;
    G.vacuum = 0;
    // hives
    L.hives = L.spawners.map((def) => CH.Spawners.create(def, n));
    L.hivesNeeded = L.spawners.length >= 5 ? L.spawners.length - 1 : L.spawners.length;
    L.exit.open = false;
    // a vending machine in a mid-way room, from stage 2
    G.machine = null;
    if (n >= 2) {
      const mid = L.rooms.filter((r) => r.tag === 'waypoint')[0] || L.rooms[Math.floor(L.rooms.length / 2)];
      const p = L.randomNear(mid.cx, mid.cy, 60, 120, 20) || L.nearestOpen(mid.cx, mid.cy);
      G.machine = { x: p.x, y: p.y, uses: 1, t: 0 };
    }
    // the Lost Shrine of the act I quest, and a named unique monster per stage
    const Qs = CH.Quests;
    if (Qs && n === 2 && Qs.state('a1_lost').st === 'active') {
      const rm = L.rooms.filter((r) => r.tag !== 'start' && r.tag !== 'exit')[Math.floor(rng() * Math.max(1, L.rooms.length - 2))] || L.rooms[1];
      const sp = L.randomNear(rm.cx, rm.cy, 0, 60, 18) || L.nearestOpen(rm.cx, rm.cy);
      L.shrines.push({ x: sp.x, y: sp.y, used: false, id: 99, kind: 'lost' });
    }
    const UNI = ['Gordon the Gnome-Slayer', 'Big Dave', 'Mildred the Mild', 'Chop-Shop Chuck', 'Sir Reginald Fluffington', 'The Unpaid Intern', 'Lord Gluten', 'Karen of the Deep'];
    const lead = L.packs.filter((pk) => pk.leader)[0] || L.packs[Math.floor(rng() * L.packs.length)];
    if (lead) { lead.unique = UNI[Math.floor(rng() * UNI.length)]; lead.leader = true; if (L.biome === 'zombie') lead.unique = 'Chop-Shop Chuck'; }
    const sub = 'Close the breaches (' + L.hivesNeeded + ') and find the exit.';
    G.banner('STAGE ' + n, L.name.toUpperCase() + '  -  ' + sub, 3.2);
    Run.cache = {};
  };

  Run.hivesClosed = () => (G.level ? G.level.spawners.filter((s) => s.dead).length : 0);

  Run.onBreachClosed = function () {
    const L = G.level;
    if (!L) return;
    const closed = Run.hivesClosed();
    G.banner('BREACH CLOSED', closed + ' / ' + L.hivesNeeded, 1.6);
    if (closed >= L.hivesNeeded && !L.opened) {
      L.opened = true;
      L.exit.open = true;
      Audio.sfx('levelup');
      G.banner('THE SEAL IS BROKEN', 'Find the exit', 2.4);
      FX.ring(L.exit.x, L.exit.y, 8, 90, '#fee761', 0.9);
      G.addScore(300 * G.wave);
      // the last breach does not leave the party blind: show where the exit is
      L.reveal(L.exit.x, L.exit.y, 4);
    }
  };

  /* ------------------------------------------------------------------ the stage loop */
  wrap(G, 'updateWave', function (orig, dt) {
    if (G.level && (G.waveState === 'combat' || G.waveState === 'intro')) return Run.update(dt);
    return orig.call(G, dt);
  });

  Run.update = function (dt) {
    const L = G.level;
    // fog of war follows every living hero
    L.revealT -= dt;
    if (L.revealT <= 0) {
      L.revealT = 0.15;
      for (const p of players()) L.reveal(p.x, p.y, 8.5);
      for (const sk of CH.SK ? CH.SK.list : []) if (sk.state !== 'down') L.reveal(sk.x, sk.y, 6);
    }
    // sleeping packs wake when a hero comes close
    for (const pk of L.packs) {
      if (pk.woke) continue;
      for (const p of players()) {
        if (U.dist(p.x, p.y, pk.x, pk.y) < 330) {
          wake(pk);
          break;
        }
      }
    }
    // the threat clock: breaches left open too long breed faster (no turtling)
    if (!L.opened) {
      L.threatT += dt;
      if (L.threatT > 75 && L.threat < 4) {
        L.threatT = 0;
        L.threat++;
        G.banner('THE BREACHES GROW', 'Threat ' + L.threat, 1.8);
        Audio.sfx('warn');
      }
    }
    proximity(L, dt);
    crackWalls(L);
    // the exit
    if (L.exit.open) {
      for (const p of players()) {
        if (U.dist(p.x, p.y, L.exit.x, L.exit.y) < 34) {
          Run.complete();
          return;
        }
      }
    }
    L.fx += dt;
    // a wiped party is handled by the shared death logic; nothing else to do here
  };

  /* loiter: the monsters of a camp are spawned before a hero is close and wander about it (js/setpieces.js) */
  function wake(pk, loiter) {
    pk.woke = true;
    const L = G.level;
    const room = Run.aliveCount();
    const arenaId = L.biome;
    const n = Math.min(pk.n, Math.max(2, Math.round(G.aliveCap() * 1.25) - room));
    for (let i = 0; i < n; i++) {
      const p = L.randomNear(pk.x, pk.y, 8, 54, 14) || { x: pk.x, y: pk.y };
      const type = i % 4 === 3 ? pk.mixed : pk.type;
      const e = G.spawnEnemy(type, p.x, p.y, { elite: pk.elite && i === 0, variant: CH.Enemies.rollVariant(type, G.wave, arenaId), spawnTime: 0.25 + Math.random() * 0.2 });
      e.pack = pk;
      if (loiter && pk.camp) { e.loiter = { x: pk.camp.x, y: pk.camp.y, r: Math.max(40, pk.camp.r * 0.7) }; e.spawnSilent = true; }
      if (pk.leader && i === 0) { e.isElite = true; e.leader = true; }
      if (pk.unique && i === 0) { e.unique = pk.unique; e.isElite = true; e.maxHp = e.hp = Math.round(e.maxHp * 2.6); e.scale *= 1.25; }
    }
    FX.ring(pk.x, pk.y, 4, 30, '#e43b44', 0.35);
  }

  /* waypoints, chests, shrines: things you walk up to */
  function proximity(L, dt) {
    for (const p of players()) {
      for (const w of L.waypoints) {
        if (!w.active && U.dist(p.x, p.y, w.x, w.y) < 30) {
          w.active = true;
          G.ui.toast('WAYPOINT ACTIVATED');
          Audio.sfx('levelup');
          FX.ring(w.x, w.y, 4, 44, '#63c74d', 0.6);
          G.healPlayer(p.maxHp * 0.15 / p.stats.healMult / G.diff.heal, p);
          if (CH.Run.onWaypoint) CH.Run.onWaypoint(w);
        }
      }
      for (const s of L.shrines) {
        if (!s.used && U.dist(p.x, p.y, s.x, s.y) < 26) useShrine(L, s, p);
      }
    }
    // elite-shrine challenge: all summoned champions dead -> a big reward
    for (const s of L.shrines) {
      if (s.challenge && !s.paid && s.challenge.every((e) => e.dead)) {
        s.paid = true;
        G.addCoins(40 + 10 * G.wave, s.x, s.y);
        for (let i = 0; i < 4; i++) G.dropPickup('coin', s.x + U.rand(-20, 20), s.y + U.rand(-20, 20), 4, {});
        G.dropPickup('curio', s.x, s.y, 3, { icon: 'pu.' + U.pick([46, 170, 171, 259]), life: 30 });
        FX.text(s.x, s.y - 20, 'CHAMPIONS SLAIN', '#fee761', 2);
        if (s.onClear) s.onClear(s);
      }
    }
  }

  function useShrine(L, s, p) {
    s.used = true;
    Audio.sfx('levelup');
    FX.ring(s.x, s.y, 6, 70, '#b55088', 0.7);
    if (s.kind === 'blood') {
      for (const q of players()) q.hp = Math.max(1, q.hp - Math.round(q.maxHp * 0.3));
      if (CH.Waves) CH.Waves.cardOwed = (CH.Waves.cardOwed || 0) + 1;
      G.banner('BLOOD SHRINE', 'A free upgrade, paid in blood', 2);
    } else if (s.kind === 'elite') {
      s.challenge = [];
      for (let i = 0; i < 3; i++) {
        const q = L.randomNear(s.x, s.y, 50, 90, 14) || { x: s.x, y: s.y };
        const t = U.pick(LG.MOBS[L.biome] || LG.MOBS.dungeon);
        s.challenge.push(G.spawnEnemy(t, q.x, q.y, { elite: true, spawnTime: 0.3 }));
      }
      G.banner('CHALLENGE SHRINE', 'Slay the champions for treasure', 2);
    } else if (s.kind === 'lost') {
      s.challenge = [];
      for (let i = 0; i < 4; i++) {
        const q = L.randomNear(s.x, s.y, 50, 100, 14) || { x: s.x, y: s.y };
        s.challenge.push(G.spawnEnemy(U.pick(LG.MOBS[L.biome] || LG.MOBS.dungeon), q.x, q.y, { elite: true, spawnTime: 0.3 }));
      }
      s.onClear = () => { if (CH.Quests) CH.Quests.event('lost'); if (CH.Dialogue) CH.Dialogue.say({ who: 'THE LOST SHRINE', portrait: 'sk:runegolem', lines: ['The runes flicker, then blaze.', 'Something enormous, made of stone and patience, stands up and nods at you.'] }); };
      G.banner('THE LOST SHRINE', 'Guardians awaken. Defeat them to restore it.', 2.4);
    } else if (s.kind === 'healing') {
      for (const q of players()) G.healPlayer(q.maxHp * 0.5 / q.stats.healMult / G.diff.heal, q);
      G.banner('HEALING SHRINE', 'Restored', 1.6);
    } else {
      for (const q of players()) { q.buffs.haste = Math.max(q.buffs.haste || 0, 20); CH.Upgrades.recalc(q); }
      G.banner('SPEED SHRINE', 'Haste for 20 seconds', 1.6);
    }
  }

  /* shots and blasts chip cracked walls open (the secret rooms) */
  function crackWalls(L) {
    if (!L.secrets.length) return;
    for (const pr of G.projectiles) {
      if (pr.owner !== 'p' || pr.dead) continue;
      const tx = Math.floor(pr.x / TS), ty = Math.floor(pr.y / TS);
      if (L.cell(tx, ty) === CH.Level.CRACKED) {
        pr.dead = true;
        if (!canCrack(L, tx, ty)) continue;
        if (L.crack(tx, ty, pr.dmg || 10)) foundSecret(L, tx, ty);
        else FX.burst(pr.x, pr.y, { n: 5, colors: ['#8a7a6a', '#4a3a2a'], speed: 60, life: 0.3 });
      }
    }
  }
  /* the garage of the Outbreak City stays shut until a named unique has dropped the key */
  function canCrack(L, tx, ty) {
    const s = L.secrets.find((q) => q.crack.x === tx && q.crack.y === ty);
    if (s && s.kind === 'garage' && !G.garageKey) {
      if (!s.hinted || G.time - s.hinted > 3) { s.hinted = G.time; FX.text(tx * TS + 16, ty * TS - 4, 'LOCKED GARAGE', '#e43b44', 1); Audio.sfx('nope'); }
      return false;
    }
    return true;
  }
  function foundSecret(L, tx, ty) {
    const s = L.secrets.find((q) => q.crack.x === tx && q.crack.y === ty);
    FX.burst(tx * TS + 16, ty * TS + 16, { n: 20, colors: ['#8a7a6a', '#4a3a2a', '#ffffff'], speed: 120, life: 0.6 });
    Audio.sfx('rock');
    G.shake(4, 0.3);
    if (s && !s.found) {
      s.found = true;
      G.banner('SECRET FOUND', s.kind === 'dojo' ? 'A hidden dojo' : s.kind === 'garage' ? 'The garage is open' : 'A hidden stash', 2);
      L.reveal(s.cx, s.cy, 6);
      if (CH.Run.onSecret) CH.Run.onSecret(s);
    }
  }
  wrap(G, 'explode', function (orig, x, y, r, dmg, o) {
    const res = orig.call(G, x, y, r, dmg, o);
    const L = G.level;
    if (L && L.secrets.length && o && o.owner === 'p') {
      for (let ty = Math.floor((y - r) / TS); ty <= Math.floor((y + r) / TS); ty++) for (let tx = Math.floor((x - r) / TS); tx <= Math.floor((x + r) / TS); tx++) {
        if (L.cell(tx, ty) === CH.Level.CRACKED && canCrack(L, tx, ty) && L.crack(tx, ty, 30)) foundSecret(L, tx, ty);
      }
    }
    return res;
  });

  /* ------------------------------------------------------------------ finishing a stage */
  Run.wake = wake;

  Run.complete = function () {
    if (G.waveState === 'clear') return;
    const L = G.level;
    G.waveComplete(); // banner, score, heal, 'clear' state: the shared code takes it from here (next stage or branch prompt)
    // everyone on the party's feet again and out of the way of the next level
    for (const e of G.enemies) if (!e.dead && !e.isBoss) e.hp = 0, (e.dead = true);
    G.enemies = G.enemies.filter((e) => e.isBoss && !e.dead);
    if (L) FX.ring(L.exit.x, L.exit.y, 6, 120, '#fee761', 0.8);
  };

  /* ------------------------------------------------------------------ interaction: machine, chests */
  Run.nearestInteract = function (p) {
    const L = G.level;
    let best = null, bd = 38 * 38;
    const t = (x, y, kind, o) => { const d = U.dist2(p.x, p.y, x, y); if (d < bd) { bd = d; best = { kind, o }; } };
    if (G.machine) t(G.machine.x, G.machine.y, 'machine', G.machine);
    if (L) for (const c of L.chests) if (!c.opened) t(c.x, c.y, 'chest', c);
    return best;
  };
  const origCan = G.canInteract;
  G.canInteract = function (p) {
    if (!G.level) return origCan(p);
    return !p.dead && !!Run.nearestInteract(p);
  };
  const origInteract = G.interact;
  G.interact = function (who) {
    const p = who || G.player;
    if (!G.level) return origInteract(who);
    if (!p || p.dead || G.state !== 'playing') return;
    const n = Run.nearestInteract(p);
    if (!n) return;
    if (n.kind === 'machine') return origInteract(who);
    openChest(n.o, p);
  };
  function openChest(c, p) {
    c.opened = true;
    Audio.sfx('buy');
    Audio.sfx('vend');
    G.shake(3, 0.2);
    FX.burst(c.x, c.y, { n: 24, colors: ['#fee761', '#feae34', '#ffffff'], speed: 130, life: 0.7 });
    G.addCoins(Math.round(14 + 6 * c.tier), c.x, c.y);
    for (let i = 0; i < 2 + (c.secret ? 3 : 0); i++) G.dropPickup('coin', c.x + U.rand(-18, 18), c.y + U.rand(-18, 18), 3, {});
    G.dropPickup('curio', c.x, c.y, 2 + (c.tier > 3 ? 1 : 0), { icon: 'pu.' + U.pick(CH.PowerUps ? CH.PowerUps.CURIO_ICONS : [259]), life: 30 });
    if (Math.random() < 0.35 + (c.secret ? 0.5 : 0)) G.dropLoot && G.dropLoot({ x: c.x, y: c.y, type: 'chicken', isElite: true }, p);
    if (CH.Run.onChest) CH.Run.onChest(c, p);
    FX.text(c.x, c.y - 22, 'TREASURE!', '#fee761', 1);
  }

  /* ------------------------------------------------------------------ integration with the old world code */
  /* walls: push everything that moves back out of rock after every simulation step */
  wrap(G, 'step', function (orig, dt) {
    orig.call(G, dt);
    const L = G.level;
    if (!L || G.state === 'menu') return;
    // everybody collides with the walls at the feet, so nobody sinks into rock or hovers in front of it
    for (const p of G.players) L.pushOutFeet(p, p.r || 8, 10);
    for (const e of G.enemies) if (!e.dead) L.pushOutFeet(e, e.isBoss ? Math.min(e.r || 20, 20) : e.r || 8, e.isBoss ? 14 : Math.min(10, ((e.look && e.look.foot) || 8) * 0.8));
    if (CH.SK) for (const s of CH.SK.list) L.pushOutFeet(s, s.r || 8, 10);
    for (const pr of G.projectiles) {
      if (pr.dead) continue;
      if (L.solidAt(pr.x, pr.y)) {
        pr.dead = true;
        FX.burst(pr.x, pr.y, { n: 3, colors: ['#c2c3c7', '#6a6a7a'], speed: 40, life: 0.2 });
      }
    }
  });

  /* walking monsters go around walls: when they cannot see the hero they follow the flow field */
  const E = CH.Enemies;
  wrap(E.Enemy.prototype, 'integrate', function (orig, g, dt) {
    const L = g.level;
    if (L && !this.isSpawner && this.tgt && (this.dvx || this.dvy) && this.state !== 'attack') {
      const t = this.tgt;
      if (!L.los(this.x, this.y, t.x, t.y)) {
        const f = L.flowFor(t.x, t.y);
        const d = L.flowDir(f, this.x, this.y);
        if (d) {
          const sp = Math.hypot(this.dvx, this.dvy);
          this.dvx = d.x * sp;
          this.dvy = d.y * sp;
        }
      }
    }
    return orig.call(this, g, dt);
  });

  /* anything that spawns: stay on open floor */
  const origSpawnPos = G.spawnPos;
  G.spawnPos = function () {
    const L = G.level;
    if (!L) return origSpawnPos();
    const p = G.randomAlivePlayer();
    const q = L.randomNear(p.x, p.y, B.waves.spawnSafeDist, B.waves.spawnSafeDist + 160, 14);
    return q || L.nearestOpen(p.x + 120, p.y);
  };
  wrap(G, 'spawnEnemy', function (orig, type, x, y, o) {
    const L = G.level;
    if (L && !L.isOpen(x, y, 8)) {
      const q = L.nearestOpen(x, y);
      x = q.x;
      y = q.y;
    }
    return orig.call(G, type, x, y, o);
  });
  wrap(G, 'dropPickup', function (orig, type, x, y, value, o) {
    const L = G.level;
    if (L && L.solidAt(x, y)) {
      const q = L.nearestOpen(x, y);
      x = q.x;
      y = q.y;
    }
    return orig.call(G, type, x, y, value, o);
  });
  /* unique monsters: a name tag, and the garage key in the Outbreak City */
  wrap(G, 'killEnemy', function (orig, e) {
    const was = e.dead;
    orig.call(G, e);
    if (!was && e.unique && G.level && G.level.biome === 'zombie' && !G.garageKey) { G.garageKey = true; G.ui.toast('GARAGE KEY FOUND'); Audio.sfx('levelup'); }
  });
  CH.Hooks.world.push((ctx, cam) => {
    if (!G.level) return;
    for (const e of G.enemies) if (e.unique && !e.dead) CH.Font.draw(ctx, e.unique.toUpperCase(), Math.round(e.x - cam.x), Math.round(e.y - cam.y) - 34, '#ff8a1e', 1, true, 'center');
  });
  wrap(G, 'newRun', function (orig, config) {
    G.runSeed = null;
    G.garageKey = false;
    G.level = null;
    return orig.call(G, config);
  });
  const origToMenu = G.toMenu;
  G.toMenu = function () {
    G.level = null;
    return origToMenu.apply(G, arguments);
  };

  /* ------------------------------------------------------------------ drawing */
  const ground = (ctx, cam) => {
    const L = G.level;
    if (!L) return;
    const sx = (x) => Math.round(x - cam.x), sy = (y) => Math.round(y - cam.y);
    const seen = (o) => L.explored[L.idx(Math.floor(o.x / TS), Math.floor(o.y / TS))];
    const sign = (n, x, y, size, alpha) => { if (CH.UIK && CH.UIK.on) CH.UIK.draw(ctx, '0 - Sprites/Signs/' + n + '.png', x - size / 2, y - size / 2, { w: size, h: size, alpha }); };
    const onScreen = (o) => o.x > cam.x - 40 && o.x < cam.x + B.view.w + 40 && o.y > cam.y - 40 && o.y < cam.y + B.view.h + 40;
    const t = L.fx || 0;
    // exit: a stone pad with the castle sign, dim while sealed
    const ex = L.exit;
    if (onScreen(ex) && seen(ex)) {
      const x = sx(ex.x), y = sy(ex.y);
      ctx.fillStyle = ex.open ? 'rgba(254,231,97,0.22)' : 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(x, y + 6, 26, 14, 0, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = ex.open ? '#fee761' : '#6a5a3a';
      ctx.lineWidth = 2;
      ctx.globalAlpha = ex.open ? 0.6 + 0.3 * Math.sin(t * 4) : 0.8;
      ctx.beginPath();
      ctx.ellipse(x, y + 6, 22 + (ex.open ? Math.sin(t * 4) * 2 : 0), 11, 0, 0, U.TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const gh = ex.gate && CH.Sheets ? CH.Sheets.info[ex.gate] || (CH.Sheets.sprite(ex.gate), CH.Sheets.info[ex.gate]) : null;
      let top = 22;
      if (gh) { // the pack's door, gate or stairs frames the exit pad
        CH.Sprites.draw(ctx, CH.Sheets.sprite(ex.gate), x, y + 2, { alpha: ex.open ? 1 : 0.6 });
        top = gh.h + 6;
      } else { ctx.fillStyle = '#d1c29a'; ctx.fillRect(x - 11, y - 30, 22, 22); }
      sign(7, x, y - top + Math.sin(t * 3) * (ex.open ? 1.5 : 0), 26, ex.open ? 1 : 0.5);
      if (!ex.open) CH.Font.draw(ctx, 'SEALED', x, y - top - 14, '#b9b4c8', 1, true);
    }
    const en = L.entrance;
    if (en && en.gate && CH.Sheets && !L.isTown && onScreen(en)) CH.Sprites.draw(ctx, CH.Sheets.sprite(en.gate), sx(en.x), sy(en.y) - 30);
    for (const w of L.waypoints) {
      if (!onScreen(w) || !seen(w)) continue;
      const x = sx(w.x), y = sy(w.y);
      ctx.strokeStyle = w.active ? '#63c74d' : '#4a5a4a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 14, 7, 0, 0, U.TAU);
      ctx.stroke();
      sign(2, x, y - 10, 20, w.active ? 1 : 0.55);
    }
    for (const s of L.shrines) {
      if (!onScreen(s) || !seen(s)) continue;
      const x = sx(s.x), y = sy(s.y);
      if (CH.Sprites.has('obj.occult_altar')) CH.Sprites.draw(ctx, 'obj.occult_altar', x, y + 10, { alpha: s.used ? 0.55 : 1, tint: s.used ? '#000000' : '#ff2bd6', tintA: s.used ? 0.35 : 0.15 + 0.1 * Math.sin(t * 4) });
      if (!s.used) sign(5, x, y - 26 + Math.sin(t * 3) * 1.4, 18, 1);
    }
    for (const c of L.chests) {
      if (!onScreen(c) || !seen(c)) continue;
      const x = sx(c.x), y = sy(c.y);
      CH.Enemies.shadow(ctx, x, y + 8, 18);
      const chests = CH.Assets.images['obj.chests'];
      if (chests) { // the pack's chests: wood, steel, gold and the blue relic chest by tier; row 2 is the opened lid
        const col = c.secret ? 3 : c.tier >= 7 ? 3 : c.tier >= 5 ? 2 : c.tier >= 3 ? 1 : 0;
        ctx.drawImage(chests, col * 36, c.opened ? 32 : 0, 36, 32, x - 18, y - 23, 36, 32);
      }
    }
  };
  const origDrawBg = CH.Arenas.drawBg;
  CH.Arenas.drawBg = function (ctx, arena, cam) {
    origDrawBg(ctx, arena, cam);
    if (arena.isLevel) ground(ctx, cam);
  };

  /* fog over everything in the world, then the screen-space bits */
  CH.Hooks.world.push((ctx, cam) => {
    const L = G.level;
    if (!L || G.state === 'menu') return;
    L.drawFog(ctx, cam, B.view.w, B.view.h);
  });

  /* arrows at the screen edge: the exit once it is open, otherwise the nearest known breach */
  CH.Hooks.screen.push((ctx, cam, v) => {
    const L = G.level;
    if (!L || G.state !== 'playing') return;
    const target = L.exit.open ? L.exit : (L.spawners.filter((s) => !s.dead && L.explored[L.idx(Math.floor(s.x / TS), Math.floor(s.y / TS))])[0] || null);
    if (!target) return;
    const p = (v.players && v.players[0]) || G.player;
    const dx = target.x - p.x, dy = target.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 140) return;
    const a = Math.atan2(dy, dx);
    const cx = v.x + v.w / 2, cy = B.view.h / 2;
    const ex = cx + Math.cos(a) * Math.min(v.w / 2 - 16, (B.view.h / 2 - 16) / Math.abs(Math.sin(a) || 0.001) * Math.abs(Math.cos(a)));
    const ey = cy + Math.sin(a) * Math.min(B.view.h / 2 - 16, (v.w / 2 - 16) / Math.abs(Math.cos(a) || 0.001) * Math.abs(Math.sin(a)));
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.globalAlpha = 0.75 + 0.2 * Math.sin(G.wall * 5);
    ctx.fillStyle = L.exit.open ? '#fee761' : '#e43b44';
    ctx.strokeStyle = '#1b1226';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -6);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  });

  /* the minimap in the corner: a window on the explored map, in the hero's colour frame */
  Run.drawMinimap = function (ctx, v, cam) {
    const L = G.level;
    const size = 76;
    const mx = v.x + v.w - size - 8, my = 84;
    const p = (v.players && v.players[0]) || G.player;
    L.drawMini(ctx, mx, my, size, p.x, p.y, 1.4);
    ctx.strokeStyle = '#1b1226';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx - 1, my - 1, size + 2, size + 2);
    ctx.strokeStyle = '#d1c29a';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - 0.5, my - 0.5, size + 1, size + 1);
    CH.Font.draw(ctx, L.isTown ? 'TOWN' : 'STAGE ' + G.wave, mx + size / 2, my - 4, '#d1c29a', 1, true, 'center');
  };

  /* HUD text in level mode */
  wrap(UI, 'updateHUD', function (orig) {
    orig.call(UI);
    const L = G.level;
    if (!L) return;
    if (L.isTown) { const el = document.getElementById('wavetxt'); if (el) el.textContent = 'TOWN'; const en = document.getElementById('enemytxt'); if (en) en.textContent = 'SAFE'; return; }
    const set = (id, t) => { const el = document.getElementById(id); if (el && el.textContent !== t) el.textContent = t; };
    set('wavetxt', 'STAGE ' + G.wave + (G.endless ? ' ENDLESS' : ''));
    set('enemytxt', G.waveState === 'clear' ? 'CLEARED!' : L.exit.open ? 'FIND THE EXIT' : 'BREACHES ' + Run.hivesClosed() + '/' + L.hivesNeeded);
  });

  /* ------------------------------------------------------------------ helpers for tests and bots */
  Run.closeAllBreaches = function () {
    const L = G.level;
    for (const e of L.hives) if (!e.dead) G.damageEnemy(e, 1e9, { src: 'player', shooter: G.player });
  };
  Run.teleport = (x, y) => { for (const p of G.players) { p.x = x; p.y = y; } };
})(window.CH);
