/* CHAOS.exe - the world map (PLAN.md 19, W3). A character's world is nine biomes of five stages each, in four acts, each
   act ending in a boss hall built from its last biome: 49 areas.
     Act I    The Dead Wood 1-5, The Catacombs 6-10                                   boss 11 (a hall of the Catacombs)
     Act II   The Gaslight District 12-16, The Outbreak City 17-21, The Crypt 22-26   boss 27 (a hall of the Crypt)
     Act III  The Scrapyard Wasteland 28-32, The Frozen Kingdom 33-37                 boss 38 (a hall of the Frozen Kingdom)
     Act IV   The Molten Caldera 39-43, The Crimson Castle 44-48                      boss 49 (the castle's throne hall)
   Difficulty follows a depth from 1 to 10 across the 49 areas (G.tier(), js/game.js), the old stage number's role, so
   monsters, gold and gear grow as they did over the old ten stages. Without a character (tests) the old ten stages run. */
(function (CH) {
  'use strict';
  const G = CH.G;
  const Level = CH.Level;
  const TS = Level.TS;

  const ACTS = [
    { name: 'I. The Dead Wood', biomes: ['deadwood', 'catacombs'] },
    { name: 'II. The Gaslight District', biomes: ['gaslight', 'zombie', 'dungeon'] },
    { name: 'III. The Frozen North', biomes: ['wasteland', 'frozen'] },
    { name: 'IV. The Crimson Castle', biomes: ['volcano', 'castle'] },
  ];
  const PER = 5;
  const WM = (CH.WorldMap = { ACTS, PER, areas: [null] });
  for (let a = 0; a < ACTS.length; a++) {
    for (const biome of ACTS[a].biomes) for (let i = 1; i <= PER; i++) WM.areas.push({ n: WM.areas.length, biome, act: a + 1, boss: false, step: i });
    const last = ACTS[a].biomes[ACTS[a].biomes.length - 1];
    WM.areas.push({ n: WM.areas.length, biome: last, act: a + 1, boss: true, step: 0 });
  }
  WM.LAST = WM.areas.length - 1; // 49
  WM.BOSSES = WM.areas.filter((x) => x && x.boss).map((x) => x.n); // 11, 27, 38, 49
  for (const x of WM.areas) if (x) x.depth = 1 + (9 * (x.n - 1)) / (WM.LAST - 1);

  WM.on = () => !!(CH.Areas && CH.Areas.world());
  WM.area = (n) => WM.areas[Math.max(1, Math.min(WM.LAST, n | 0))];
  WM.depth = (n) => WM.area(n).depth;
  WM.first = (biome) => (WM.areas.find((x) => x && x.biome === biome && !x.boss) || {}).n;
  WM.bossOf = (act) => WM.BOSSES[act - 1];
  WM.label = (n) => {
    const x = WM.area(n);
    const t = CH.Arenas.THEMES[x.biome];
    return x.boss ? 'ACT ' + ['I', 'II', 'III', 'IV'][x.act - 1] + ' BOSS' : (t ? t.name.replace(/^The /, '') : x.biome).toUpperCase() + ' ' + ['I', 'II', 'III', 'IV', 'V'][x.step - 1];
  };

  /* ------------------------------------------------------------------ boss halls */
  /* one great room of the act's biome: pillars along the walls, braziers, the biome's own dressing at the edges; the
     boss waits at the far end, the way on opens when it falls */
  WM.hall = function (biome, n) {
    const L = new Level(46, 30, biome);
    L.carveRect(2, 2, 42, 26);
    L.rooms = [{ x: 2, y: 2, w: 42, h: 26, cx: 23 * TS, cy: 15 * TS, deg: 1, id: 0, tag: 'hall' }];
    L.entrance = { x: 23 * TS + 16, y: 25 * TS };
    L.exit = { x: 23 * TS + 16, y: 3.5 * TS, open: false, room: 0 };
    L.waypoints = [{ x: 20 * TS, y: 25 * TS, id: 0, active: true }];
    L.spawners = []; L.packs = []; L.chests = []; L.shrines = []; L.secrets = []; L.puddles = [];
    L.layout = 'hall';
    L.bossHall = true;
    L.revealStart = () => L.explored.fill(1);
    L.explored.fill(1);
    if (CH.SetPieces && CH.SetPieces.on) CH.SetPieces.dress(L, biome);
    return L;
  };
  /* the boss walks in a moment after the heroes; the hall's way on opens when it falls */
  G.on('startWave', function (ev) {
    const L = G.level;
    if (!L || !L.bossHall || L.stage !== ev.n) return;
    const b = G.isBossWave(ev.n);
    if (!b) return;
    L.hives = [];
    L.hivesNeeded = 0;
    G.after(1.4, () => { if (G.level === L && !G.enemies.some((e) => e.isBoss && !e.dead)) { const e = G.spawnBoss(b.kind, b.tier); if (e) e.hallBoss = true; } });
  });
  G.on('kill', function (e) {
    const L = G.level;
    if (!e.isBoss || !L || !L.bossHall || L.opened) return;
    L.opened = true;
    L.exit.open = true;
    G.banner('THE WAY ON IS OPEN', 'Find the far door', 2.2);
  });
})(window.CH);
