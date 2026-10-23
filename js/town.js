/* CHAOS.exe - the town (PLAN.md section 4.6/4.7): a walkable hub with NPCs who use the pack's villager art and portraits,
   reached by a Portal Quill (belt item), by a waypoint (E on an active one) and automatically after an act boss.
   NPCs: vendor (the shop), stash keeper, smith (crafting + bulk recycling), sidekick trainer, elder (quests) and the
   waypoint keeper (travel to stages you have activated). Leaving the town returns to the stage you came from.
   The stage you left is kept exactly as it was (G.level, its enemies and drops). */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const G = CH.G;
  const X = CH.X;
  const UI = CH.UI;
  const UIK = CH.UIK;
  const Audio = CH.Audio;
  const Level = CH.Level;
  const TS = Level.TS;
  const wrap = X.wrap;

  const Town = (CH.Town = { inTown: false, saved: null, pendingStage: 0 });

  const NPCS = [
    { id: 'vendor', name: 'BZZT, THE VENDOR', x: 20, y: 11, hue: 0, face: 0, sign: 4 },
    { id: 'stash', name: 'STASHA, STASH KEEPER', x: 28, y: 9, hue: 90, face: 1, sign: 3 },
    { id: 'smith', name: 'HAMMER, THE SMITH', x: 36, y: 11, hue: 200, face: 2, sign: 5 },
    { id: 'trainer', name: 'FETCH, SIDEKICK TRAINER', x: 14, y: 20, hue: 300, face: 3, sign: 8 },
    { id: 'elder', name: 'THE ELDER', x: 28, y: 18, hue: 40, face: 0, sign: 1 },
    { id: 'waypoint', name: 'WAYPOINT KEEPER', x: 42, y: 20, hue: 150, face: 1, sign: 2 },
  ];

  Town.NPCS = NPCS;

  /* ------------------------------------------------------------------ the map */
  Town.build = function () {
    const L = new Level(56, 40, 'backyard');
    L.isTown = true;
    L.name = 'The Safehouse Town';
    L.tag = 'Prices are fixed. Haggling is not.';
    L.style = { floor: 'pattern', key: CH.Assets.images['tile.zombie_street'] ? 'tile.zombie_street' : 'tile.grass', wall: '#4a3a2a', top: '#8a6a40', edge: '#2a1e12' };
    L.carveRect(4, 4, 48, 32);
    // buildings along the north edge (solid blocks), a fountain in the middle, trees as solid props at the sides
    for (const [bx, by] of [[16, 4], [24, 4], [32, 4], [40, 4]]) for (let y = by; y < by + 4; y++) for (let x = bx; x < bx + 6; x++) L.cells[y * L.tw + x] = Level.WALL;
    for (let y = 4; y < 11; y++) for (let x = 4; x < 11; x++) L.cells[y * L.tw + x] = Level.WALL;
    L.rooms = [{ x: 4, y: 12, w: 48, h: 24, cx: 28 * TS, cy: 24 * TS, deg: 0, id: 0, tag: 'town' }];
    L.entrance = { x: 28 * TS + 16, y: 30 * TS };
    L.exit = { x: 28 * TS + 16, y: 33 * TS, open: true, room: 0, town: true };
    L.waypoints = [];
    L.npcs = NPCS.map((n) => Object.assign({}, n, { px: n.x * TS + 16, py: n.y * TS + 16 }));
    L.explored.fill(1);
    L.fogDirty = true;
    const names = ['obj.bush1', 'obj.bush2', 'obj.rocks1', 'obj.mossRocks1', 'obj.deadTree1'].filter((n) => CH.Sprites.has(n));
    if (names.length) for (let i = 0; i < 26; i++) {
      const p = L.randomNear(28 * TS, 24 * TS, 120, 700, 22);
      if (p && !L.npcs.some((n) => U.dist(p.x, p.y, n.px, n.py) < 60) && U.dist(p.x, p.y, L.entrance.x, L.entrance.y) > 90) CH.Arenas.addProp(L.props, U.pick(names), p.x, p.y, { solid: true, cr: 10 });
    }
    return L;
  };

  /* ------------------------------------------------------------------ entering and leaving */
  Town.openPortal = function (p) {
    const L = G.level;
    if (!L || L.isTown) return false;
    if (L.portal) { FX.text(p.x, p.y - 20, 'PORTAL ALREADY OPEN', '#b9b4c8', 1); return false; }
    const q = L.randomNear(p.x, p.y, 40, 60, 14) || { x: p.x + 40, y: p.y };
    L.portal = { x: q.x, y: q.y, t: 0, open: true };
    FX.ring(q.x, q.y, 6, 60, '#3ccbe6', 0.8);
    Audio.sfx('door_auto');
    G.ui.toast('TOWN PORTAL OPEN');
    return true;
  };

  Town.enter = function (from) {
    if (Town.inTown) return;
    const prev = G.level;
    Town.saved = prev ? { L: prev, enemies: G.enemies.slice(), pickups: G.pickups.slice(), wave: G.wave, machine: G.machine, pos: G.players.map((p) => ({ x: p.x, y: p.y })), ground: CH.Items ? CH.Items.ground.slice() : [], state: G.waveState } : null;
    const T = Town.build();
    Town.inTown = true;
    Town.from = from || 'portal';
    G.level = T;
    G.arena = T;
    G.enemies = [];
    G.pickups = [];
    G.projectiles.length = 0;
    G.zones.length = 0;
    G.decoys.length = 0;
    if (CH.Items) CH.Items.ground.length = 0;
    G.waveState = 'combat';
    G.machine = { x: T.npcs[0].px, y: T.npcs[0].py + 14, uses: 1, t: 0, town: true };
    G.players.forEach((p, i) => { const q = T.randomNear(T.entrance.x, T.entrance.y, 0, 30 * i, 14) || T.entrance; p.x = q.x; p.y = q.y; p.vx = p.vy = p.kx = p.ky = 0; });
    G.snapCamera();
    G.screenFlash(0.8, '#ffffff');
    Audio.sfx('door_open');
    Audio.setMusic('shop');
    if (CH.Atmos) { CH.Atmos.setMode('clear'); CH.Atmos.clock = 0.3; CH.Atmos.dark = 0; } // it is always a fine afternoon in town
    G.revivePlayers(1);
    for (const p of G.players) { p.hp = p.maxHp; }
    G.banner('THE SAFEHOUSE TOWN', 'Shop, stash, craft, train, travel. Walk back through the portal when you are ready.', 3);
  };

  Town.leave = function () {
    if (!Town.inTown) return;
    Town.inTown = false;
    const s = Town.saved;
    Town.saved = null;
    G.screenFlash(0.8, '#ffffff');
    Audio.sfx('door_open');
    if (Town.pendingStage) { // after an act boss: start the next stage
      const n = Town.pendingStage;
      Town.pendingStage = 0;
      G.level = null;
      G.arena = null;
      G.startWave(n);
      return;
    }
    if (s) {
      G.level = s.L;
      G.arena = s.L;
      G.enemies = s.enemies.filter((e) => !e.dead);
      G.pickups = s.pickups;
      G.wave = s.wave;
      G.machine = s.machine;
      G.waveState = s.state === 'town' ? 'combat' : s.state;
      if (CH.Items) { CH.Items.ground.length = 0; for (const g of s.ground) CH.Items.ground.push(g); }
      const P = s.L.portal;
      G.players.forEach((p, i) => { const q = s.L.randomNear(P ? P.x : s.pos[0].x, P ? P.y : s.pos[0].y, 24, 50, 14) || { x: s.pos[0].x, y: s.pos[0].y }; p.x = q.x; p.y = q.y; });
      if (s.L.portal) s.L.portal = null; // one trip per portal
      G.snapCamera();
      G.playMusic();
    }
  };

  /* ------------------------------------------------------------------ per frame */
  Town.update = function (dt) {
    const L = G.level;
    L.fx = (L.fx || 0) + dt;
    // the portal pad at the south edge leads back
    for (const p of G.players) if (!p.dead && U.dist(p.x, p.y, L.exit.x, L.exit.y) < 28) { Town.leave(); return; }
  };
  const R = CH.Run;
  wrap(R, 'update', function (orig, dt) {
    if (G.level && G.level.isTown) return Town.update(dt);
    const L = G.level;
    // the town portal in a stage
    if (L && L.portal) {
      L.portal.t += dt;
      for (const p of G.players) if (!p.dead && U.dist(p.x, p.y, L.portal.x, L.portal.y) < 24) { Town.enter('portal'); return; }
    }
    return orig.call(R, dt);
  });
  /* the exit pad of the stage after a boss: boss stages are arenas, the next level starts from the town */
  wrap(G, 'startWave', function (orig, n) {
    if (Town.inTown) { Town.pendingStage = n; return; } // already in town: leaving will start it
    if (Town.wantTown && R.usesLevels(n) && n > 1) {
      Town.wantTown = false;
      Town.pendingStage = n;
      Town.enter('act');
      return;
    }
    return orig.call(G, n);
  });
  wrap(G, 'onBossDefeated', function (orig, b) {
    const r = orig.call(G, b);
    if (!G.endless && !(['bug', 'skull', 'daddy'].includes(b.kind) && b.tier === 0)) Town.wantTown = true; // an act is done: the next stage begins in town
    return r;
  });
  wrap(G, 'newRun', function (orig, c) { Town.inTown = false; Town.saved = null; Town.pendingStage = 0; Town.wantTown = false; return orig.call(G, c); });
  const origToMenu = G.toMenu;
  G.toMenu = function () { Town.inTown = false; Town.saved = null; return origToMenu.apply(G, arguments); };

  /* ------------------------------------------------------------------ talking to people */
  const origNearest = R.nearestInteract;
  R.nearestInteract = function (p) {
    const L = G.level;
    if (L && L.isTown) {
      let best = null, bd = 44 * 44;
      for (const n of L.npcs) { const d = U.dist2(p.x, p.y, n.px, n.py); if (d < bd) { bd = d; best = { kind: 'npc', o: n }; } }
      if (G.machine) { const d = U.dist2(p.x, p.y, G.machine.x, G.machine.y); if (d < bd && false) best = { kind: 'machine', o: G.machine }; }
      return best;
    }
    const n = origNearest(p);
    if (L) for (const w of L.waypoints) if (w.active && U.dist(p.x, p.y, w.x, w.y) < 36 && (!n || true)) return { kind: 'waypoint', o: w };
    return n;
  };
  const origInteract = G.interact;
  G.interact = function (who) {
    const p = who || G.player;
    const L = G.level;
    if (L && p && !p.dead && G.state === 'playing') {
      const n = R.nearestInteract(p);
      if (n && n.kind === 'npc') return talk(n.o, p);
      if (n && n.kind === 'waypoint') return waypointMenu(n.o, p);
    }
    return origInteract(who);
  };

  const D = () => CH.Dialogue;
  const color = (p) => (UIK.on ? G.players.indexOf(p) : 0);

  function talk(n, p) {
    const say = (lines, choices) => D().say({ who: n.name, portrait: 'npc:' + n.face, lines, choices, color: color(p) });
    if (n.id === 'vendor') {
      say(['BZZT. Everything must go. Mostly because I do not know where it came from.'], [
        { label: 'SHOP', fn: () => { G.machine = G.machine || { x: n.px, y: n.py, uses: 1, t: 0, town: true }; CH.Shop.openFor(p); } },
        { label: 'LEAVE', fn: () => {} },
      ]);
    } else if (n.id === 'stash') {
      say(['Your stuff is safe with me. Mostly. Rats are a problem.'], [
        { label: 'OPEN STASH', fn: () => CH.Journal && CH.Journal.show(1, 1, 'main') },
        { label: 'LEAVE', fn: () => {} },
      ]);
    } else if (n.id === 'smith') {
      const Mt = CH.Meta;
      const has = (cost) => CH.Storage.canAfford(cost);
      say(['I can turn junk into snacks. And snacks into regret.'], [
        { label: 'RECYCLE NORMAL+MAGIC', fn: () => { const bag = CH.Items.bag().filter((it) => it.rarity === 'normal' || it.rarity === 'magic'); for (const it of bag) CH.Items.salvage(it); G.ui.toast('RECYCLED ' + bag.length + ' ITEMS'); } },
        { label: 'CRAFT SHIELD', fn: () => { if (Mt && Mt.craft && Mt.craft('shield')) G.ui.toast('SHIELD CRAFTED'); else Audio.sfx('nope'); } },
        { label: 'CRAFT MEDKIT', fn: () => { if (Mt && Mt.craft && Mt.craft('medkit')) G.ui.toast('MEDKIT CRAFTED'); else Audio.sfx('nope'); } },
        { label: 'LEAVE', fn: () => {} },
      ]);
    } else if (n.id === 'trainer') {
      say(['Good dog. Good sidekick. Good... whatever that one is. Pick your companion.'], [
        { label: 'SIDEKICKS', fn: () => CH.Journal && CH.Journal.show(3, 1, 'main') },
        { label: 'LEAVE', fn: () => {} },
      ]);
    } else if (n.id === 'elder') {
      const Q = CH.Quests;
      const ready = Q.LIST.filter((q) => Q.state(q.id).st === 'done');
      const act = Q.actOf(G.wave || 1);
      const open = Q.LIST.filter((q) => q.act <= act && Q.state(q.id).st === 'active');
      const lines = ['The breaches are spreading, hero.'];
      if (open.length) lines.push('Still to do: ' + open.slice(0, 3).map((q) => q.name).join(', ') + '.');
      if (ready.length) lines.push('You have finished ' + ready.length + ' task' + (ready.length > 1 ? 's' : '') + '. Well done.');
      say(lines, [
        ready.length ? { label: 'CLAIM REWARDS', fn: () => { for (const q of ready) Q.claim(q.id); G.ui.toast('REWARDS CLAIMED'); } } : { label: 'QUESTS', fn: () => CH.Journal && CH.Journal.show(0, 1, 'main') },
        { label: 'LEAVE', fn: () => {} },
      ]);
    } else if (n.id === 'waypoint') waypointTravel(n, p);
  }

  function waypointTravel(n, p) {
    const wps = CH.Storage.data.diablo.waypoints || {};
    const stages = Object.keys(wps).map(Number).sort((a, b) => a - b);
    const choices = stages.slice(-4).map((s) => ({ label: 'STAGE ' + s, fn: () => { Town.pendingStage = s; Town.leave(); } }));
    choices.push({ label: 'STAY', fn: () => {} });
    D().say({ who: n.name, portrait: 'npc:' + n.face, lines: [stages.length ? 'Where to? Only places you have been.' : 'Light a waypoint in the field first. Then I can send you back.'], choices: stages.length ? choices : [{ label: 'OK', fn: () => {} }], color: color(p) });
  }
  /* an activated waypoint in the field: go home, or (co-op) jump to a partner */
  function waypointMenu(w, p) {
    const choices = [{ label: 'TO TOWN', fn: () => Town.enter('waypoint') }];
    const mate = G.players.find((q) => q !== p && !q.dead && U.dist(q.x, q.y, p.x, p.y) > 160);
    if (mate) choices.push({ label: 'TO PARTNER', fn: () => { const q = G.level.randomNear(mate.x, mate.y, 20, 40, 14) || mate; p.x = q.x; p.y = q.y; G.snapCamera && G.snapCamera(); FX.ring(p.x, p.y, 5, 40, '#63c74d', 0.5); } });
    choices.push({ label: 'CLOSE', fn: () => {} });
    D().say({ who: 'WAYPOINT', portrait: null, lines: ['The waypoint hums.'], choices, color: color(p) });
  }
  /* waypoints remember their stage */
  const origProx = R.onWaypoint;
  R.onWaypoint = function (w) {
    const d = CH.Storage.data.diablo;
    d.waypoints = d.waypoints || {};
    d.waypoints[G.wave] = true;
    CH.Storage.save();
    if (origProx) origProx(w);
  };

  /* ------------------------------------------------------------------ drawing */
  const origDrawBg = CH.Arenas.drawBg;
  CH.Arenas.drawBg = function (ctx, arena, cam) {
    origDrawBg(ctx, arena, cam);
    if (arena.isTown) drawTown(ctx, arena, cam);
    else if (arena.portal) drawPortal(ctx, arena.portal, cam);
  };
  function drawPortal(ctx, p, cam) {
    const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
    ctx.save();
    ctx.translate(x, y);
    for (let i = 0; i < 3; i++) { ctx.strokeStyle = i ? '#9fd8ef' : '#3ccbe6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -8, 11 - i * 3, 18 - i * 4, p.t * (1 + i * 0.7), 0, 5.2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(60,203,230,0.35)';
    ctx.beginPath(); ctx.ellipse(0, -8, 7, 12, 0, 0, 6.283); ctx.fill();
    ctx.restore();
  }
  function drawTown(ctx, L, cam) {
    const t = L.fx || 0;
    // return pad
    drawPortal(ctx, { x: L.exit.x, y: L.exit.y, t }, cam);
    CH.Font.draw(ctx, 'PORTAL', Math.round(L.exit.x - cam.x), Math.round(L.exit.y - cam.y) + 8, '#9fd8ef', 1, true);
    if (!L.hideout) for (const n of L.npcs) Town.drawNpc(ctx, n, Math.round(n.px - cam.x), Math.round(n.py - cam.y), t);
  }
  /* a townsperson: the Valley Ruin villager (tinted per trade) with the pack's road sign over the head;
     in the hideout they are depth sorted with the props (js/hideout.js puts a solid stand-in prop under each) */
  Town.drawNpc = function (ctx, n, x, y, t) {
    t = t === undefined ? (G.level && G.level.fx) || 0 : t;
    {
      if (x < -40 || y < -60 || x > B.view.w + 40 || y > B.view.h + 40) return;
      if (CH.Sprites.has('npc.body')) {
        CH.Enemies.shadow(ctx, x, y + 12, 14);
        ctx.save();
        if (n.hue) ctx.filter = 'hue-rotate(' + n.hue + 'deg)';
        const talkTo = G.players.some((q) => !q.dead && U.dist(q.x, q.y, n.px, n.py) < 60);
        CH.Sprites.draw(ctx, 'npc.body', x, y + 13, { frame: Math.floor(t * (talkTo ? 6 : 3) + n.x) % 3, flip: G.player && G.player.x < n.px });
        ctx.restore();
        if (UIK.on) UIK.draw(ctx, '0 - Sprites/Signs/' + n.sign + '.png', x - 8, y - 44 + Math.sin(t * 3 + n.y) * 1.2, { w: 16, h: 16 });
        CH.Font.draw(ctx, n.name.split(',')[0], x, y + 20, '#fee761', 1, true);
        return;
      }
      CH.Enemies.shadow(ctx, x, y + 12, 18);
      if (UIK.on) {
        const im = UIK.c('brown', 'Content/icons/' + (n.face % 2 ? 2 : 1) + '.png');
        if (im) {
          ctx.save();
          ctx.filter = 'hue-rotate(' + n.hue + 'deg)';
          ctx.drawImage(im, x - 18, y - 28 + Math.sin(t * 2 + n.x) * 1, 36, 36);
          ctx.restore();
        }
        UIK.draw(ctx, '0 - Sprites/Signs/' + n.sign + '.png', x - 8, y - 48 + Math.sin(t * 3 + n.y) * 1.2, { w: 16, h: 16 });
      } else { ctx.fillStyle = '#d1c29a'; ctx.fillRect(x - 6, y - 20, 12, 28); }
      CH.Font.draw(ctx, n.name.split(',')[0], x, y + 20, '#fee761', 1, true);
    }
  };
  /* the vending machine sprite is replaced by the vendor NPC in town */
  const origRender = G.render;
})(window.CH);
