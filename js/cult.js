/* CHAOS.exe - the cult house and Lucifer (PLAN.md 18, K9). A Victorian house at the hideout's north-east, behind the
   purple eye door; inside, four cultists pray round a pentagram and Lucifer lounges on a throne.
     the cultists   give one dark task at a time, for the cult's favour:
                      FAST     clear an area's breaches without eating
                      IDOL     carry the idol to an area's exit without falling
                      DARK     kill a champion in the dark (night or a dark stage)
     Lucifer        trades favour for bargains, never fought:
                      a PACT (a strong boon that carries a curse: HELLFIRE, GREED, QUICKSILVER, THE EYE)
                      the CULT SIGIL (opens the sigil seals of js/secrets.js)
                      a REFORGE (an equipped item rerolled two levels up, for a lasting curse: FRAIL)
   Jesus, across the square, lifts the curses (js/clinic.js). The cult's state belongs to the character's world
   (world.cult = { favour, task, pacts: [{ id, cursed }], frail }). Voices: the game's own (PLAN.md 18.1). */
(function (CH) {
  'use strict';
  const G = CH.G;
  const U = CH.U;
  const FX = CH.FX;
  const Audio = CH.Audio;
  const Town = CH.Town;
  const Level = CH.Level;
  const TS = Level.TS;
  if (!Town) return;

  const K = (CH.Cult = {});
  const world = () => (CH.Areas && CH.Areas.world()) || null;
  /* the cult's book on this character (a stand-in without one: tests) */
  K.state = () => {
    const W = world();
    const host = W || G;
    if (!host.cult) host.cult = { favour: 0, task: null, pacts: [], frail: 0 };
    return host.cult;
  };
  const save = () => { if (CH.Character) CH.Character.save(); else CH.Storage.save(); };

  /* ------------------------------------------------------------------ pacts and curses */
  K.PACTS = {
    hellfire: { name: 'HELLFIRE', boon: '+35% damage', curse: '-25% health', on: (s) => (s.dmgMult *= 1.35), off: (s) => (s.hpMul *= 0.75) },
    greed: { name: 'GREED', boon: '+50% gold', curse: '-10% speed', on: (s) => (s.coinMult *= 1.5), off: (s) => (s.speedMult *= 0.9) },
    quick: { name: 'QUICKSILVER', boon: '+15% speed', curse: '-40% healing', on: (s) => (s.speedMult *= 1.15), off: (s) => (s.healMult *= 0.6) },
    eye: { name: 'THE EYE', boon: '+15% crit chance', curse: '-30% gold', on: (s) => (s.critChance += 0.15), off: (s) => (s.coinMult *= 0.7) },
  };
  CH.X.statHooks.push((p, s) => {
    const st = (world() || G).cult;
    if (!st) return;
    for (const q of st.pacts) { const d = K.PACTS[q.id]; if (!d) continue; d.on(s); if (q.cursed) d.off(s); }
    if (st.frail) s.hpMul *= Math.pow(0.9, st.frail);
  });
  K.cursed = () => { const st = K.state(); return st.pacts.some((q) => q.cursed) || st.frail > 0; };
  /* Jesus lifts them: the boons stay, the curses go */
  K.lift = () => {
    const st = K.state();
    const n = st.pacts.filter((q) => q.cursed).length + st.frail;
    for (const q of st.pacts) q.cursed = false;
    st.frail = 0;
    for (const p of G.players) CH.Upgrades.recalc(p);
    save();
    return n;
  };
  const recalc = () => { for (const p of G.players) CH.Upgrades.recalc(p); };

  /* ------------------------------------------------------------------ tasks */
  K.TASKS = {
    fast: { name: 'THE FAST', text: 'Clear the breaches of an area without eating a thing.' },
    idol: { name: 'THE IDOL', text: 'Carry this idol to the exit of an area without falling.' },
    dark: { name: 'THE DARK', text: 'Kill a champion in the dark.' },
  };
  const done = (ok, why) => {
    const st = K.state();
    st.task = null;
    if (ok) { st.favour++; G.ui.toast('THE CULT IS PLEASED: +1 FAVOUR (' + st.favour + ')'); Audio.sfx('levelup'); }
    else { G.ui.toast('THE CULT IS DISAPPOINTED: ' + why); Audio.sfx('nope'); }
    save();
  };
  G.on('startWave', function (ev) { // a task takes the next area entered
    const st = K.state(), L = G.level;
    if (!st.task || !L || L.isTown || L.stage !== ev.n) return;
    if (st.task.id !== 'dark' && !st.task.area) { st.task.area = ev.n; st.task.ok = true; G.ui.toast(K.TASKS[st.task.id].name + ': THIS AREA'); }
  });
  G.on('step', function () {
    const st = (world() || G).cult;
    const t = st && st.task;
    const L = G.level;
    if (!t || !t.area || !L || L.isTown || L.stage !== t.area || G.state !== 'playing') return;
    if (t.id === 'fast' && G.players.some((p) => p.hot)) return done(false, 'YOU ATE');
    if (t.id === 'fast' && L.opened) return done(true);
    if (t.id === 'idol' && G.players.some((p) => p.dead)) return done(false, 'THE IDOL FELL');
    if (t.id === 'idol' && G.waveState === 'clear') return done(true);
  });
  G.on('kill', function (e) {
    const st = (world() || G).cult;
    if (st && st.task && st.task.id === 'dark' && e.isElite && CH.Atmos && CH.Atmos.dark > 0.4) done(true);
  });
  /* the idol, over the carrier's head */
  CH.Hooks.world.push((ctx, cam) => {
    const st = (world() || G).cult;
    if (!st || !st.task || st.task.id !== 'idol' || !G.player || (G.level && G.level.isTown)) return;
    const p = G.player, x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y) - 40 + Math.sin((G.time || 0) * 3) * 1.5;
    ctx.fillStyle = '#b55088'; ctx.fillRect(x - 3, y - 6, 6, 8);
    ctx.fillStyle = '#fee761'; ctx.fillRect(x - 1, y - 4, 2, 2);
  });

  /* ------------------------------------------------------------------ the house in the hideout */
  const IM = () => CH.Assets.images;
  let facade = null;
  function facadeSprite() {
    if (facade) return facade;
    const im = IM();
    const door = im['kit.hv_eye_portal'], wall = im['kit.hv3.4'] || im['kit.hv3.2'], slate = im['kit.hv4.4'] || im['kit.hv4.2'], spire = im['kit.hv4.5'];
    if (!door || !wall || !slate) return null;
    const side = 2, cw = wall.width;
    const c = document.createElement('canvas');
    c.width = door.width + side * 2 * cw;
    c.height = Math.max(door.height, wall.height) + 60;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    for (let y = c.height - wall.height - slate.height + 10; y > -slate.height; y -= slate.height - 6) for (let x = 0; x < c.width; x += slate.width - 4) g.drawImage(slate, x, y);
    if (spire) g.drawImage(spire, Math.round(c.width / 2 - spire.width / 2), 0);
    for (let i = 0; i < side; i++) { g.drawImage(wall, i * cw, c.height - wall.height); g.drawImage(wall, c.width - (i + 1) * cw, c.height - wall.height); }
    g.drawImage(door, Math.round(c.width / 2 - door.width / 2), c.height - door.height);
    CH.Sprites.fromFrames('culthouse', [c], { anchor: 'feet' });
    facade = { name: 'culthouse', w: c.width, h: c.height };
    return facade;
  }
  const prevBuild = Town.build;
  Town.build = function () {
    const L = prevBuild.call(Town);
    if (!L.hideout) return L;
    const f = facadeSprite();
    if (!f) return L;
    const x = 46 * TS, y = 13 * TS;
    const box = { hw: Math.round(f.w * 0.46), hh: Math.round(f.h * 0.3) };
    // clear the spot, then the house: solid, its door a way in
    for (let i = L.props.length - 1; i >= 0; i--) { const p = L.props[i]; if (!p.npc && Math.abs(p.x - x) < box.hw + 18 && p.y > y - f.h + 10 && p.y < y + 26) L.props.splice(i, 1); }
    CH.Arenas.addProp(L.props, f.name, x, y, { solid: true, box, cy: -box.hh - 6, cat: 'house', jumpable: false, elevation: 40, destructible: false });
    L.props[L.props.length - 1].sp = true;
    L.cultDoor = { x, y: y + 4 };
    CH.Props.invalidate();
    return L;
  };

  /* ------------------------------------------------------------------ inside */
  const PEOPLE = [
    { id: 'lucifer', name: 'LUCIFER', x: 11, y: 4, art: 'lucifer', act: 'magic' },
    { id: 'cult1', name: 'BROTHER VEX', x: 7, y: 9, art: 'cult1', act: 'pray', idle: 'pray' },
    { id: 'cult2', name: 'SISTER MOTH', x: 15, y: 9, art: 'cult2', act: 'pray', idle: 'pray' },
    { id: 'cult3', name: 'BROTHER ASH', x: 8, y: 12, art: 'cult3', act: 'pray', idle: 'pray' },
    { id: 'cult4', name: 'SISTER WICK', x: 14, y: 12, art: 'cult4', act: 'pray', idle: 'pray' },
  ];
  K.build = function () {
    const L = new Level(23, 17, 'gaslight');
    L.isTown = true;
    L.interior = true;
    L.name = 'The Cult House';
    L.carveRect(2, 2, 19, 13);
    L.rooms = [{ x: 2, y: 2, w: 19, h: 13, cx: 11.5 * TS, cy: 8.5 * TS, deg: 0, id: 0, tag: 'town' }];
    L.entrance = { x: 11.5 * TS, y: 13 * TS };
    L.exit = { x: 11.5 * TS, y: 14.6 * TS, open: true, room: 0, town: true };
    L.waypoints = []; L.spawners = []; L.chests = []; L.shrines = []; L.packs = []; L.decals = [];
    L.npcs = PEOPLE.map((n) => Object.assign({ hue: 0, face: 0, sign: 1 }, n, { px: n.x * TS + 16, py: n.y * TS + 16 }));
    L.explored.fill(1);
    const D = CH.SetPieces.Dresser(L, 'gaslight');
    for (const n of L.npcs) D.reserve(n.px, n.py + 6, 22);
    D.reserve(L.exit.x, L.exit.y, 30);
    const k = (kind) => D.key(kind, 'g');
    if (IM()['kit.hv_pentagram']) D.put('kit.hv_pentagram', 11.5 * TS, 10.6 * TS, { force: true, a: 0.95 });
    D.put('kit.hv20.1', 11.5 * TS, 3.9 * TS, { force: true }); // the throne behind Lucifer
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; D.put(k('candles'), 11.5 * TS + Math.cos(a) * 70, 10.4 * TS + Math.sin(a) * 40); }
    for (const s of [-1, 1]) { D.put(D.key('banner', 'g'), 11.5 * TS + s * 70, 2.9 * TS, { force: true }); D.put('kit.hv20.8', 11.5 * TS + s * 40, 4.2 * TS); }
    for (const [x, kind] of [[3.2, 'shelf'], [5, 'shelf'], [18, 'shelf'], [19.8, 'machine']]) D.put(k(kind), x * TS, 3 * TS);
    for (const [x, y] of [[3.5, 8], [19.5, 8], [3.5, 12], [19.5, 12]]) D.put(k(D.pick(['table', 'chair', 'sofa', 'item'])), x * TS, y * TS);
    D.scatter('item', 11.5 * TS, 9 * TS, 160, 4);
    for (const n of L.npcs) { CH.Arenas.addProp(L.props, 'missing', n.px, n.py + 8, { solid: true, box: { hw: 8, hh: 5 }, cy: 0, kind: 'npc' }); const p = L.props[L.props.length - 1]; p.invisible = true; p.npc = n.id; }
    CH.Props.invalidate();
    return L;
  };
  K.enter = function () {
    const H = G.level;
    if (!H || !H.hideout) return;
    K.hideout = H;
    const L = K.build();
    G.level = L;
    G.arena = L;
    G.players.forEach((p, i) => { p.x = L.entrance.x + i * 20; p.y = L.entrance.y; p.vx = p.vy = 0; });
    G.snapCamera();
    G.screenFlash(0.5, '#b55088');
    Audio.sfx('door_open');
    if (CH.Atmos) { CH.Atmos.setMode('none'); CH.Atmos.dark = 0.55; }
    G.banner('THE CULT HOUSE', 'Mind the candles. And the man on the throne.', 2.4);
  };
  K.leave = function () {
    const H = K.hideout;
    if (!H) return;
    G.level = H;
    G.arena = H;
    G.players.forEach((p, i) => { p.x = H.cultDoor.x + i * 20; p.y = H.cultDoor.y + 34; p.vx = p.vy = 0; });
    G.snapCamera();
    Audio.sfx('door_close');
    if (CH.Atmos) { CH.Atmos.setMode('clear'); CH.Atmos.clock = 0.3; CH.Atmos.dark = 0; }
    K.hideout = null;
  };
  const prevUpdate = Town.update;
  Town.update = function (dt) {
    const L = G.level;
    if (L && L.interior) {
      L.fx = (L.fx || 0) + dt;
      for (const p of G.players) if (!p.dead && U.dist(p.x, p.y, L.exit.x, L.exit.y) < 26) { K.leave(); return; }
      return;
    }
    if (L && L.cultDoor) for (const p of G.players) if (!p.dead && U.dist(p.x, p.y + 12, L.cultDoor.x, L.cultDoor.y) < 22) { K.enter(); return; }
    return prevUpdate(dt);
  };
  /* the way out, drawn as a dim doorway */
  const prevBg = CH.Arenas.drawBg;
  CH.Arenas.drawBg = function (ctx, arena, cam) {
    prevBg(ctx, arena, cam);
    if (arena && arena.interior) {
      const x = Math.round(arena.exit.x - cam.x), y = Math.round(arena.exit.y - cam.y);
      ctx.fillStyle = 'rgba(181,80,136,0.25)';
      ctx.fillRect(x - 20, y - 8, 40, 14);
      CH.Font.draw(ctx, 'OUT', x, y - 2, '#b9b4c8', 1, true);
    }
  };
  /* the people inside use the clinic's drawing (their own art) */
  if (CH.Clinic && CH.Clinic.people) for (const n of PEOPLE) CH.Clinic.people.push(n);

  /* ------------------------------------------------------------------ talking */
  const D = () => CH.Dialogue;
  const color = (p) => (CH.UIK && CH.UIK.on ? G.players.indexOf(p) : 0);
  const say = (n, p, lines, choices) => { n.busyT = 2.4; D().say({ who: n.name, portrait: 'art:' + n.id, lines, choices, color: color(p) }); };
  K.cultist = function (n, p) {
    const st = K.state();
    if (st.task) {
      const t = K.TASKS[st.task.id];
      say(n, p, ['The task, ' + (p.name || 'initiate') + ': ' + t.text, st.task.area ? 'We watch area ' + st.task.area + '.' : 'Go out into the world. We will be watching.'], [
        { label: 'GIVE IT UP', fn: () => { st.task = null; save(); G.ui.toast('THE CULT SIGHS'); } },
        { label: 'LEAVE', fn: () => {} },
      ]);
      return;
    }
    const lines = [U.pick(['Shh. We are praying. To what? Unclear. Very spiritual though.', 'The Dark One likes you. That is not a compliment.', 'Bring us suffering. Or snacks. Mostly suffering.']), 'Favour: ' + st.favour + '.'];
    say(n, p, lines, Object.keys(K.TASKS).map((id) => ({ label: K.TASKS[id].name + ': ' + K.TASKS[id].text, fn: () => { st.task = { id }; save(); G.ui.toast('TASK TAKEN: ' + K.TASKS[id].name); } })).concat([{ label: 'LEAVE', fn: () => {} }]));
  };
  K.reforge = function (p) {
    const I = CH.Items;
    const e = I.equippedOf(p);
    const slots = Object.keys(e).filter((s) => e[s]);
    if (!slots.length) return false;
    const s = slots[Math.floor(Math.random() * slots.length)];
    const old = e[s];
    e[s] = I.roll((old.ilvl || 1) + 2, { slot: s, rarity: old.rarity });
    K.state().frail++;
    recalc();
    return e[s];
  };
  K.lucifer = function (n, p) {
    const st = K.state();
    const lines = [U.pick(['Sign here. And here. Initial there. The fine print is on fire, do not worry about it.', 'Oh, the guy across the square? We go way back. He is very judgmental.', 'Power, darling. It costs a little. Everything costs a little. Some things cost a lot.']), 'Your favour with my flock: ' + st.favour + '.'];
    const choices = [];
    const owned = new Set(st.pacts.map((q) => q.id));
    for (const id of Object.keys(K.PACTS)) {
      if (owned.has(id)) continue;
      const d = K.PACTS[id];
      choices.push({ label: 'PACT: ' + d.name + ' (' + d.boon + ', curse ' + d.curse + ') - 2 FAVOUR', fn: () => {
        if (st.favour < 2) { Audio.sfx('nope'); G.ui.toast('NOT ENOUGH FAVOUR'); return; }
        st.favour -= 2;
        st.pacts.push({ id, cursed: true });
        recalc();
        n.busyT = 3;
        FX.ring(p.x, p.y, 6, 70, '#e43b44', 0.8);
        G.ui.toast('PACT SEALED: ' + d.name);
        save();
      } });
    }
    if (CH.Secrets && !CH.Secrets.has('sigil')) choices.push({ label: 'THE CULT SIGIL - 3 FAVOUR', fn: () => {
      if (st.favour < 3) { Audio.sfx('nope'); G.ui.toast('NOT ENOUGH FAVOUR'); return; }
      st.favour -= 3;
      CH.Secrets.grant('sigil');
      save();
    } });
    choices.push({ label: 'REFORGE MY GEAR (curse: FRAIL) - 1 FAVOUR', fn: () => {
      if (st.favour < 1) { Audio.sfx('nope'); G.ui.toast('NOT ENOUGH FAVOUR'); return; }
      const it = K.reforge(p);
      if (!it) { Audio.sfx('nope'); G.ui.toast('NOTHING EQUIPPED TO REFORGE'); return; }
      st.favour -= 1;
      G.ui.toast('REFORGED: ' + CH.Items.nameOf(it).toUpperCase());
      save();
    } });
    choices.push({ label: 'LEAVE', fn: () => {} });
    say(n, p, lines, choices);
  };
  Town.talkTo = Object.assign(Town.talkTo || {}, { lucifer: K.lucifer, cult1: K.cultist, cult2: K.cultist, cult3: K.cultist, cult4: K.cultist });
})(window.CH);
