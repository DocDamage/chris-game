/* CHAOS.exe - game state and core systems: runs, waves, damage, drops, zones, scoring, level-ups. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const Audio = CH.Audio;
  const Storage = CH.Storage;

  const TIPS = {
    1: 'WASD to move  -  CLICK to attack  -  SPACE to dodge roll',
    2: 'Blue gems = XP, gold = coins. Press E at vending machines!',
    3: 'NEW: Minotaur Janitors slam the ground. Mind the red circle!',
    4: 'NEW: Speedy Hellhounds and Suspicious Hellbats',
    5: 'BOSS: THE CEO OF EVIL has a meeting with your face',
    6: 'NEW: Rampaging Lancers charge in straight lines',
    7: 'NEW: Influencer Priests and Flame Golems',
    8: 'BOSS: THE GARGOYLE APOCALYPSE',
    9: 'Everything is angry. Everything is fast. Good luck.',
    10: 'FINAL BOSS: THE FINAL BUG',
  };

  const SPAWN_TABLE = [
    { type: 'chicken', from: 1, w: (wv) => (wv < 6 ? 5 : 2.5) },
    { type: 'slime', from: 1, w: () => 2.8, group: 4 },
    { type: 'potato', from: 2, w: () => 3 },
    { type: 'intern', from: 2, w: () => 2.4, group: 5 },
    { type: 'plant', from: 2, w: () => 2.2 },
    { type: 'trashcan', from: 3, w: () => 1.6 },
    { type: 'office', from: 3, w: () => 2.4 },
    { type: 'goblin', from: 3, w: () => 2.4, group: 3 },
    { type: 'spider', from: 3, w: () => 2.2 },
    { type: 'toaster', from: 4, w: () => 2 },
    { type: 'pigeon', from: 4, w: () => 2.4 },
    { type: 'orc', from: 4, w: () => 1.8 },
    { type: 'golem', from: 5, w: () => 1.3 },
    { type: 'cart', from: 6, w: () => 1.6 },
    { type: 'influencer', from: 6, w: () => 1.5 },
    { type: 'fridge', from: 7, w: () => 1.0 },
  ];

  /* semantic music / ambience choices (see tools/sounds.js for the files behind each key) */
  const ARENA_MUSIC = { backyard: 'court', office: 'hall', glitch: 'secret' };
  const ARENA_AMB = { backyard: 'amb_backyard', office: 'amb_office', glitch: 'amb_glitch' };
  const BOSS_MUSIC = {
    frog: 'miniboss', bd: 'miniboss', ceo: 'miniboss', mage: 'miniboss', ooze: 'miniboss', treant: 'miniboss', knight: 'miniboss',
    chicken: 'dungeon', gol: 'dungeon', beholder: 'dungeon', moss: 'dungeon', sporeeye: 'dungeon',
    maw: 'superboss', dragon: 'superboss', demon: 'superboss', yeti: 'superboss', dunewyrm: 'superboss', bloodwyrm: 'superboss', voideye: 'superboss',
    bug: 'finalboss', daddy: 'finalboss', skull: 'finalboss'
  };
  const BOSS_VOICE = {
    frog: 'cre_frog', bd: 'rock', ceo: 'cre_roar', chicken: 'cre_roar',
    gol: 'cre_trumpet', maw: 'cre_trumpet', bug: 'cre_chitter',
    dragon: 'cre_roar', beholder: 'cre_hiss', mage: 'cre_trumpet', demon: 'cre_growl', ooze: 'cre_wet',
    treant: 'cre_growl', moss: 'rock', knight: 'cre_growl', yeti: 'cre_roar', daddy: 'cre_roar', skull: 'cre_hiss', dunewyrm: 'cre_roar', bloodwyrm: 'cre_roar', sporeeye: 'cre_wet', voideye: 'cre_hiss'
  };
  const SURFACE = { backyard: 'step_grass', office: 'step_concrete', glitch: 'step_stone' };

  const defaultMods = () => ({ enemySpeed: 1, enemyScale: 1, kbMul: 1, bigHead: false, reverse: false, lowGrav: false, explosiveDeaths: false, disco: false, discoBeat: 0, scoreMul: 1 });

  const G = (CH.G = {
    state: 'menu',
    canvas: null,
    ctx: null,
    ui: null,
    time: 0,
    wall: 0,
    cam: { x: 0, y: 0, shakeT: 0, shakeDur: 1, shakeMag: 0 },
    mouseWorld: { x: 0, y: 0 },
    mods: defaultMods(),
    diff: B.difficulty.normal,
    player: null, // player 1 (kept for code that only cares about 'the' player)
    players: [], // every hero in the run: 1 or 2
    coop: false,
    viewMode: 'single', // 'single' | 'merged' | 'split'
    splitT: 0, // 0 = shared screen .. 1 = fully split
    viewOrder: [0, 1], // which player is on the left / right when split
    lastConfig: null, // co-op setup, reused by RETRY / RESTART (null = single player)
    luQueue: [],
    luPlayer: null,
    enemies: [],
    projectiles: [],
    pickups: [],
    zones: [],
    decoys: [],
    timers: [],
    queue: [],
    arena: null,
    wave: 0,
    waveState: 'none',
    waveT: 0,
    spawnT: 0,
    event: null,
    eventTimer: 60,
    score: 0,
    coins: 0,
    kills: 0,
    bossKills: 0,
    wavesCleared: 0,
    combo: 0,
    comboT: 0,
    pendingLevels: 0,
    cards: null,
    pickLock: false,
    endless: false,
    won: false,
    run: null,
    vacuum: 0,
    flashT: 0,
    flashColor: '#ffffff',
    hurtFlash: 0,
    deathTimer: 0,
    machine: null,
    bossDying: null,
    rewardsLog: [],
  });

  /* ------------------------------------------------------------------ events
     Systems react to the core through named events instead of wrapping its functions: G.on('kill', fn) runs fn(e)
     after an enemy dies, G.on('step', fn) runs fn(dt) after every simulation step (playing or not). Listeners run in
     the order they were added, which is the script order in index.html. G.hooks() lists who listens where.
     Core calls that systems also step in front of (newRun, startWave) go through G.call with one event object:
       G.on('startWave:before', fn(ev))  runs newest first, before the core. Setting ev.stop takes the call over: the
                                         older ':before' listeners, the core and the older 'startWave' listeners are
                                         skipped (a town stage, a level instead of a wave, a choice to make first);
                                         ev.core(...) runs the core itself later if it needs to.
       G.on('startWave', fn(ev))         runs after the core, oldest first; ev.result is what the core returned.
     That is exactly how the wrappers these replaced nested: the newest wrapper was the outermost. */
  const listeners = {};
  let seq = 0;
  G.on = function (name, fn) {
    const at = ((new Error().stack || '').split('\n')[2] || '').replace(/^.*\/js\/([^:]+:\d+).*$/, '$1').trim();
    (listeners[name] = listeners[name] || []).push({ fn, at, seq: seq++ });
    return fn;
  };
  G.emit = function (name, a, b, c) {
    const l = listeners[name];
    if (l) for (let i = 0; i < l.length; i++) l[i].fn(a, b, c);
  };
  G.call = function (name, ev, core) {
    const pre = listeners[name + ':before'] || [], post = listeners[name] || [];
    ev.core = core;
    let cut = -1;
    for (let i = pre.length - 1; i >= 0; i--) {
      pre[i].fn(ev);
      if (ev.stop) { cut = pre[i].seq; break; }
    }
    if (!ev.stop) ev.result = core(ev);
    for (let i = 0; i < post.length; i++) if (post[i].seq > cut) post[i].fn(ev);
    return ev.result;
  };
  G.hooks = () => Object.fromEntries(Object.entries(listeners).map(([k, l]) => [k, l.map((x) => x.at)]));

  /* ------------------------------------------------------------------ setup */
  G.surfaceStep = () => SURFACE[(G.arena && G.arena.id) || 'backyard'] || 'step';

  G.init = function (canvas) {
    G.canvas = canvas;
    G.ctx = canvas.getContext('2d');
    G.ctx.imageSmoothingEnabled = false;
    G.arena = CH.Arenas.build('backyard');
    G.mods = defaultMods();
    G.diff = B.difficulty[Storage.settings.difficulty] || B.difficulty.normal;
    G.initDemo();
  };

  G.edmg = (base) => base * G.diff.enemyDmg * (G.coop ? B.coop.enemyDmg : 1) * (1 + B.waves.dmgScale * Math.max(0, Math.min(G.wave, 10) - 1));

  /* config: undefined = repeat the last setup, null = single player, {players:[{hero, src}, {hero, src}]} = co-op */
  G.newRun = (config) => G.call('newRun', { config }, (ev) => newRunCore(ev.config));
  function newRunCore(config) {
    if (config === undefined) config = G.lastConfig;
    G.lastConfig = config || null;
    G.diff = B.difficulty[Storage.settings.difficulty] || B.difficulty.normal;
    G.enemies.length = 0;
    G.projectiles.length = 0;
    G.pickups.length = 0;
    G.zones.length = 0;
    G.decoys.length = 0;
    G.timers.length = 0;
    G.queue.length = 0;
    FX.reset();
    G.mods = defaultMods();
    G.event = null;
    G.eventTimer = CH.Events.nextGap(G, true);
    G.time = 0;
    G.score = 0;
    G.coins = (CH.Storage && CH.Storage.shelter && CH.Storage.shelter.storage ? CH.Storage.shelter.storage * 15 : 0) + ((CH.Loot && CH.Loot.bonus().startCoins) || 0);
    G.coinsEarned = 0;
    G.airdropT = null;
    G.resources = { wood: 0, scrap: 0, stone: 0 };
    G.runLoot = {};
    G.lootCount = 0;
    G.newLoot = 0;
    G.curios = 0;
    G.warpT = 0;
    G.chosenPath = {};
    G.victoryPending = false;
    G.kills = 0;
    G.bossKills = 0;
    G.wavesCleared = 0;
    G.combo = 0;
    G.comboT = 0;
    G.pendingLevels = 0;
    G.cards = null;
    G.luQueue = [];
    G.luPlayer = null;
    G.pickLock = false;
    G.endless = false;
    G.won = false;
    G.vacuum = 0;
    G.flashT = 0;
    G.hurtFlash = 0;
    G.deathTimer = 0;
    G.machine = null;
    G.bossDying = null;
    G.rewardsLog = [];
    G.runIndex = Storage.stats.totalRuns; // decides which alternate bosses this run features
    G.run = { recorded: false, base: { kills: 0, coins: 0, bosses: 0, playTime: 0 }, counted: false, startedAt: performance.now() };
    const defs = config && config.players && config.players.length > 1 ? config.players.slice(0, 4) : [{ hero: Storage.settings.hero, src: { kind: 'auto' } }];
    G.players = defs.map((d, i) => new CH.Player(G, i, d.hero, d.src));
    G.player = G.players[0];
    G.coop = G.players.length > 1;
    G.wave = 0;
    G.arena = null;
    G.setArena(B.waves.arenaForWave(1));
    G.placePlayers();
    G.viewMode = 'single';
    G.splitT = 0;
    G.viewOrder = [0, 1];
    G.snapCamera();
    G.cam.shakeT = 0;
    G.state = 'playing';
    CH.Input.clear();
    Audio.unlock();
    G.startWave(1);
    G.playMusic();
    G.ui.onRunStart();
  }

  /* line the party up in the middle of the arena */
  G.placePlayers = function () {
    const n = G.players.length;
    G.players.forEach((p, i) => {
      p.x = G.arena.w / 2 + (n > 1 ? (i - (n - 1) / 2) * 32 : 0);
      p.y = G.arena.h / 2;
      p.vx = p.vy = p.kx = p.ky = 0;
    });
  };

  /* pick the soundtrack + ambience for what is happening right now */
  G.playMusic = function () {
    if (G.state === 'menu' || !G.arena) return;
    let track = ARENA_MUSIC[G.arena.id] || 'battle';
    let amb = ARENA_AMB[G.arena.id];
    const boss = G.enemies.find((e) => e.isBoss && !e.dead && !e.dying);
    if (boss) track = boss.tier > 0 && boss.kind !== 'bug' ? 'superboss' : BOSS_MUSIC[boss.kind] || 'miniboss';
    else if (G.event && G.event.active && G.event.def.music) {
      track = G.event.def.music;
      if (G.event.def.amb) amb = G.event.def.amb;
    }
    Audio.setMusic(track);
    Audio.setAmbience(amb);
  };

  G.setArena = function (id) {
    if (G.arena && G.arena.id === id) return false;
    G.arena = CH.Arenas.build(id);
    return true;
  };

  /* --------------------------------------------------------------- helpers */
  G.alivePlayers = () => G.players.filter((p) => !p.dead);
  G.allDead = () => G.players.length > 0 && G.players.every((p) => p.dead);
  G.nearestPlayer = (x, y, any) => {
    let best = null;
    let bd = Infinity;
    for (const p of G.players) {
      if (p.dead && !any) continue;
      const d = U.dist2(x, y, p.x, p.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  };
  G.randomAlivePlayer = () => {
    const l = G.alivePlayers();
    return l.length ? U.pick(l) : G.player;
  };
  /* the middle of the party, used to place bosses / machines / arenas */
  G.partyCenter = () => {
    const l = G.alivePlayers();
    const src = l.length ? l : G.players;
    let x = 0;
    let y = 0;
    for (const p of src) {
      x += p.x;
      y += p.y;
    }
    return { x: x / src.length, y: y / src.length };
  };
  G.soloConfig = () => null;
  G.after = (sec, fn) => G.timers.push({ t: sec, fn });
  G.banner = (text, sub, dur) => G.ui.banner(text, sub, dur);
  G.addScore = (n) => {
    G.score += n;
  };
  G.countZones = (kind) => {
    let n = 0;
    for (const z of G.zones) if (z.kind === kind) n++;
    return n;
  };
  G.bossAlive = () => G.enemies.some((e) => e.isBoss && !e.dead);
  G.aliveCap = () => Math.round(B.waves.aliveCap(Math.max(1, G.wave)) * (G.diff === B.difficulty.casual ? 0.8 : 1) * (G.coop ? B.coop.aliveCap : 1));
  G.remaining = () => G.queue.length + G.enemies.reduce((n, e) => n + (e.dead ? 0 : 1), 0);
  G.comboMult = () => 1 + Math.min(B.score.comboMax - 1, G.combo * B.score.comboStep);
  G.scoreMult = () => {
    let m = G.comboMult() * G.diff.score * G.mods.scoreMul;
    if (G.players.some((p) => !p.dead && p.hp / p.maxHp < 0.3)) m *= B.score.lowHpMult;
    if (CH.Events.active(G)) m *= B.score.eventMult;
    return m;
  };

  G.shake = (mag, dur) => {
    const s = Storage.settings;
    if (!s.shake) return;
    if (s.reduced) mag *= 0.5;
    if (mag >= G.cam.shakeMag * (G.cam.shakeT / G.cam.shakeDur) || G.cam.shakeT <= 0) {
      G.cam.shakeMag = mag;
      G.cam.shakeT = dur;
      G.cam.shakeDur = dur;
    }
  };
  G.screenFlash = (a, color) => {
    G.flashT = Storage.settings.flashing ? a : Math.min(a, 0.15);
    G.flashColor = color || '#ffffff';
  };

  /* ------------------------------------------------------------------ waves */
  /* Boss schedule. Campaign: wave 3 (Wild Frog or Boulder Dash), wave 5 (CEO of Evil), wave 8 (Gargoyle,
     Skeleton Maw or Mecha Golem), wave 10 (Final Bug). The alternates rotate run by run so every boss
     shows up. Endless: a boss every 5th wave, cycling through all seven, tougher each lap. */
  /* the wave-10 bosses: beating any of them wins the run */
  const FINAL_BOSSES = ['bug', 'skull', 'daddy'];
  const ENDLESS_BOSSES = ['frog', 'treant', 'bd', 'mage', 'knight', 'gol', 'moss', 'chicken', 'sporeeye', 'dragon', 'yeti', 'maw', 'dunewyrm', 'beholder', 'demon', 'bloodwyrm', 'ooze', 'voideye', 'ceo', 'daddy', 'skull', 'bug'];
  G.isBossWave = (w) => {
    const run = G.runIndex || 0;
    if (w <= B.waves.campaign && !G.endless) {
      if (w === 3) return { kind: ['frog', 'treant', 'bd', 'mage', 'knight', 'ooze'][run % 6], tier: 0 };
      if (w === 5) return { kind: ['ceo', 'beholder', 'moss', 'sporeeye'][run % 4], tier: 0 };
      if (w === 8) return { kind: ['chicken', 'yeti', 'maw', 'dunewyrm', 'gol', 'bloodwyrm', 'dragon', 'voideye', 'demon'][run % 9], tier: 0 };
      if (w === 10) return { kind: ['bug', 'skull', 'daddy'][run % 3], tier: 0 };
      return null;
    }
    if (w > 10 && w % 5 === 0) {
      const k = (w / 5 - 3) % ENDLESS_BOSSES.length;
      return { kind: ENDLESS_BOSSES[k], tier: Math.floor((w - 10) / 5) };
    }
    return null;
  };

  G.buildQueue = function (w) {
    const q = [];
    const boss = G.isBossWave(w);
    let count = Math.round((B.waves.baseCount + B.waves.perWave * (w - 1)) * G.diff.count * (G.coop ? B.coop.count : 1));
    if (w === 1) count = Math.round(6 * Math.max(0.8, G.diff.count) * (G.coop ? B.coop.count : 1));
    if (boss) count = Math.round(count * 0.45);
    const table = SPAWN_TABLE.filter((t) => t.from <= Math.min(w, 9) || (w > 10 && t.from <= 7));
    const elite = B.waves.eliteChance(w);
    const arenaId = G.arena ? G.arena.id : 'backyard';
    const biomeMul = (type) => {
      if (arenaId === 'backyard' && ['plant', 'spider', 'chicken'].includes(type)) return 1.6;
      if (arenaId === 'wasteland' && ['orc', 'goblin', 'cart', 'trashcan'].includes(type)) return 1.6;
      if (arenaId === 'volcano' && ['fridge', 'toaster', 'slime', 'orc', 'golem'].includes(type)) return 1.6;
      if (arenaId === 'dungeon' && ['spider', 'plant', 'office', 'influencer', 'golem'].includes(type)) return 1.6;
      if (arenaId === 'zombie' && ['intern', 'trashcan', 'slime', 'plant'].includes(type)) return 1.6;
      return 1.0;
    };
    let n = 0;
    let gid = 1;
    while (n < count) {
      const t = U.weighted(table, (x) => x.w(w) * biomeMul(x.type));
      if (t.group) {
        const size = Math.min(t.group + (w > 6 ? 2 : 0), count - n + 2);
        const gv = CH.Enemies.rollVariant(t.type, w, arenaId);
        for (let i = 0; i < size; i++) q.push({ type: t.type, group: gid, variant: gv });
        gid++;
        n += size;
      } else {
        q.push({ type: t.type, elite: Math.random() < elite, variant: CH.Enemies.rollVariant(t.type, w, arenaId) });
        n++;
      }
    }
    // shuffle in units so interns stay together
    const units = [];
    for (const e of q) {
      const last = units[units.length - 1];
      if (e.group && last && last[0].group === e.group) last.push(e);
      else units.push([e]);
    }
    U.shuffle(units);
    const out = [].concat(...units);
    if (boss) out.unshift({ boss: boss.kind, tier: boss.tier });
    return out;
  };

  G.pathArena = function (n) {
    if (n <= 3) return 'backyard';
    if (n <= 6) return (G.chosenPath && G.chosenPath[4]) || 'office';
    if (n <= 10) return (G.chosenPath && G.chosenPath[7]) || 'glitch';
    const pool = ['backyard', 'office', 'glitch', 'zombie', 'wasteland', 'volcano', 'dungeon'];
    return pool[(n - 11) % pool.length];
  };

  G.promptBranch = function (nextWave) {
    let options = [];
    if (nextWave === 4) {
      options = [
        {
          id: 'wasteland',
          name: 'SCRAPYARD WASTELAND',
          tag: 'Sector 2 - Path A',
          desc: 'High scrap yields, abandoned cars, chain link fences, and barricades.',
          resName: 'SCRAP METAL',
          hazard: 'RADIATION',
        },
        {
          id: 'office',
          name: 'CORPORATE HELL',
          tag: 'Sector 2 - Path B',
          desc: 'Abundant coins, dense cubicle mazes, and laser traps.',
          resName: 'COINS & TECH',
          hazard: 'LASERS',
        },
      ];
    } else if (nextWave === 7) {
      options = [
        {
          id: 'volcano',
          name: 'THE MOLTEN CALDERA',
          tag: 'Sector 3 - Path A',
          desc: 'Obsidian pillars, intense fire geysers, high danger, and +50% XP.',
          resName: 'STONE & XP',
          hazard: 'LAVA',
        },
        {
          id: 'dungeon',
          name: 'PSYCHOLOGICAL CRYPT',
          tag: 'Sector 3 - Path B',
          desc: 'Gothic stone arches, occult altars, crates, and abundant stone.',
          resName: 'STONE & GEMS',
          hazard: 'CURSE',
        },
      ];
    }
    // the run is frozen while the party chooses where to go next
    G.state = 'branch';
    CH.Input.clear();
    CH.UI.showBranch(options, (chosenId) => {
      G.chosenPath[nextWave] = chosenId;
      G.state = 'playing';
      CH.Input.clear();
      G.startWave(nextWave);
    });
  };

  G.startWave = (n) => G.call('startWave', { n }, (ev) => startWaveCore(ev.n));
  function startWaveCore(n) {
    G.wave = n;
    const changed = G.setArena(G.pathArena(n) || B.waves.arenaForWave(n));
    if (changed) {
      G.zones.length = 0;
      G.projectiles.length = 0;
      G.decoys.length = 0;
      G.placePlayers();
      G.snapCamera();
      G.screenFlash(0.8, '#ffffff');
      Audio.sfx(G.arena.id === 'glitch' ? 'door_auto' : 'door_open');
    }
    Audio.sfx('scan');
    G.playMusic();
    G.revivePlayers(0.4); // anyone who went down last wave is back on their feet
    G.queue = G.buildQueue(n);
    G.waveState = 'intro';
    G.waveT = B.waves.introTime;
    G.spawnT = 0;
    G.vacuum = 0;
    const boss = G.isBossWave(n);
    const campaign = !G.endless && n <= B.waves.campaign;
    const title = campaign ? `WAVE ${n}` : `WAVE ${n}  (ENDLESS)`;
    let sub = boss ? 'BOSS: ' + B.bosses[boss.kind].name : G.tipFor(n) || (n > 10 ? 'Endless mode: survive as long as you can!' : '');
    if (changed) sub = G.arena.name.toUpperCase() + (sub ? '  -  ' + sub : '');
    G.banner(title, sub, B.waves.introTime + 0.4);
    if (boss) {
      Audio.sfx('warn');
    }
    // one vending machine per (non-boss) wave from wave 2
    G.machine = null;
    if (n >= 2 && !boss) {
      const a = U.rand(0, U.TAU);
      const d = U.rand(90, 200);
      G.machine = { x: U.clamp(G.arena.w / 2 + Math.cos(a) * d * 1.4, 50, G.arena.w - 50), y: U.clamp(G.arena.h / 2 + Math.sin(a) * d * 0.9, 60, G.arena.h - 50), uses: 1, t: 0 };
    }
  }

  /* wave tips adapt to how you are playing: controller, keyboard, or co-op */
  G.tipFor = function (n) {
    const pad = G.players.some((p) => p.inp.src.kind === 'pad' || (p.inp.src.kind === 'auto' && CH.Input.lastUsed === 'pad' && CH.Input.firstPad()));
    if (n === 1 && G.coop) return 'CO-OP: stay close to share one screen, walk apart and it splits. Stand next to a downed buddy to revive them';
    if (n === 1 && pad) return 'L-STICK move  -  R-STICK aim  -  RT / LT fire your two weapons  -  A dodge roll';
    if (n === 2 && pad) return 'Blue gems = XP, gold = coins. Press B at vending machines! LB throws a grenade, RB is your special';
    if (n === 2 && G.coop) return 'XP and coins are shared. Everybody gets an upgrade pick at every level-up';
    return TIPS[n];
  };

  G.spawnPos = function () {
    const p = G.randomAlivePlayer();
    const m = B.arena.margin + 14;
    for (let i = 0; i < 40; i++) {
      const a = U.rand(0, U.TAU);
      const d = U.rand(B.waves.spawnSafeDist, B.waves.spawnSafeDist + 120);
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d;
      if (x > m && x < G.arena.w - m && y > m && y < G.arena.h - m && !G.players.some((q) => !q.dead && U.dist(x, y, q.x, q.y) < B.waves.spawnSafeDist * 0.7)) return { x, y };
    }
    // cornered near a wall: take the point in the arena farthest from the party
    let best = { x: m, y: m };
    let bd = -1;
    for (const c of [[m, m], [G.arena.w - m, m], [m, G.arena.h - m], [G.arena.w - m, G.arena.h - m]]) {
      const d = Math.min(...G.players.map((q) => U.dist2(c[0], c[1], q.x, q.y)));
      if (d > bd) {
        bd = d;
        best = { x: c[0], y: c[1] };
      }
    }
    return best;
  };

  G.spawnEnemy = function (type, x, y, o) {
    o = o || {};
    // never on top of a player
    const p = G.players.find((q) => U.dist(x, y, q.x, q.y) < 60);
    if (p) {
      const a = U.ang(p.x, p.y, x, y) || U.rand(0, U.TAU);
      x = p.x + Math.cos(a) * 80;
      y = p.y + Math.sin(a) * 80;
    }
    const m = B.arena.margin + 10;
    x = U.clamp(x, m, G.arena.w - m);
    y = U.clamp(y, m, G.arena.h - m);
    // boss kinds share names with regular enemies ('chicken'), so bosses are requested explicitly
    const e = o.boss ? CH.Bosses.create(G, type, x, y, o) : CH.Enemies.create(G, type, x, y, o);
    G.enemies.push(e);
    if (!FX.vfx('vfx.p7.12', x, y - 2, { scale: 0.55, fps: 22 })) FX.burst(x, y, { n: 6, colors: 'glitch', speed: 60, life: 0.4 });
    return e;
  };

  G.updateWave = function (dt) {
    switch (G.waveState) {
      case 'intro':
        G.waveT -= dt;
        if (G.waveT <= 0) {
          G.waveState = 'combat';
          const b = G.queue[0];
          if (b && b.boss) {
            G.queue.shift();
            G.spawnBoss(b.boss, b.tier);
          }
        }
        break;
      case 'combat': {
        G.spawnT -= dt;
        if (G.spawnT <= 0 && G.queue.length && G.enemies.length < G.aliveCap()) {
          const entry = G.queue.shift();
          let pos;
          if (entry.group) {
            if (!G.groupOrigin || G.groupOrigin.id !== entry.group) G.groupOrigin = Object.assign({ id: entry.group }, G.spawnPos());
            pos = { x: G.groupOrigin.x + U.rand(-22, 22), y: G.groupOrigin.y + U.rand(-22, 22) };
          } else pos = G.spawnPos();
          G.spawnEnemy(entry.type, pos.x, pos.y, { elite: entry.elite, variant: entry.variant });
          const quick = G.enemies.length < 4 ? 0.4 : 1;
          const gap = entry.group ? 0.12 : B.waves.spawnInterval(G.wave) * (G.wave === 1 ? 1.5 : 1) * quick * U.rand(0.8, 1.2);
          G.spawnT = gap;
        }
        if (!G.queue.length && G.enemies.length === 0 && !G.bossDying && !G.victoryPending) G.waveComplete();
        break;
      }
      case 'clear':
        G.waveT -= dt;
        if (G.waveT <= 0) {
          const nextWave = G.wave + 1;
          if ((nextWave === 4 || nextWave === 7) && !G.endless && CH.UI.showBranch && !G._scriptTesting && !G.players.some((p) => p.inp && p.inp.src && p.inp.src.kind === 'script')) {
            G.waveState = 'branch';
            G.promptBranch(nextWave);
          } else {
            G.startWave(nextWave);
          }
        }
        break;
    }
  };

  G.spawnBoss = function (kind, tier) {
    const p = G.partyCenter();
    // appear on the far side of the arena
    const x = p.x < G.arena.w / 2 ? G.arena.w - 110 : 110;
    const y = G.arena.h / 2 + U.rand(-60, 60);
    const b = G.spawnEnemy(kind, x, y, { endlessTier: tier, boss: true });
    G.ui.bossIntro(b);
    // a boss snack: the arena provides a little first aid before the fight starts
    for (const q of G.players) G.healPlayer(q.maxHp * 0.25 / q.stats.healMult / G.diff.heal, q);
    Audio.sfx('boss_intro');
    Audio.sfx(BOSS_VOICE[kind] || 'cre_roar');
    G.playMusic();
    G.shake(5, 0.6);
    return b;
  };

  G.waveComplete = function () {
    G.waveState = 'clear';
    G.waveT = B.waves.clearTime;
    G.wavesCleared = G.wave;
    G.vacuum = 4;
    G.addScore(B.score.wave * G.wave * G.diff.score);
    const heal = G.diff === B.difficulty.casual ? 0.3 : G.diff === B.difficulty.chaotic ? 0.12 : 0.2;
    for (const q of G.players) G.healPlayer(q.maxHp * heal / q.stats.healMult / G.diff.heal, q);
    G.banner('WAVE ' + G.wave + ' CLEARED!', '+' + Math.round(B.score.wave * G.wave * G.diff.score) + ' points', B.waves.clearTime);
    Audio.sfx('levelup');
    G.playMusic();
    G.zones.length = 0;
    G.decoys.length = 0;
    if (G.event && G.event.active && G.event.left > 0 && !G.event.def.keep) {
      /* events continue through the break; they will end on their own timer */
    }
  };

  /* ---------------------------------------------------------------- damage */
  G.spawnProjectile = (o) => CH.Weapons.spawn(G, o);

  G.damageEnemy = function (e, dmg, o) {
    o = o || {};
    if (e.dead || e.immune || e.state === 'spawn') return 0;
    dmg = Math.max(1, Math.round(dmg * (e.dmgTaken || 1)));
    e.hp -= dmg;
    e.flash = 1;
    e.squash = 1;
    if (!e.isBoss) e.hurtT = 0.28;
    Audio.sfx(o.crit ? 'crit' : 'hit');
    const hr = e.isBoss ? 20 : U.clamp(e.r * 1.2, 10, 14);
    CH.Kit.hit(o.elem || 'phys', e.x, e.y - 4, o.crit ? hr * 1.25 : hr, !!o.crit, { lite: o.lite });
    if (o.src === 'player') CH.Kit.heroHit(o.shooter || G.player, e.x, e.y - 4, !!o.crit);
    if (o.shooter) e.lastHitBy = o.shooter;
    const hh = (e.h || 16) * 0.5;
    FX.text(e.x, e.y - hh, dmg, o.crit ? '#fee761' : '#ffffff', o.crit ? 2 : 1);
    FX.burst(e.x, e.y, { n: o.crit ? 6 : 3, colors: o.crit ? ['#fee761', '#ffffff'] : ['#ffffff', '#e8e4f0'], speed: 70, life: 0.25 });
    if (o.kf && !e.isBoss && e.knock) e.knock(o.kx || 0, o.ky || 0, o.kf);
    if (o.stun && !e.isBoss && e.stun) e.stun(o.stun);
    if (e.hp <= 0) {
      e.hp = 0;
      if (e.isBoss) e.beginDeath(G);
      else G.killEnemy(e);
    }
    return dmg;
  };

  /* o.p = the player being hurt (defaults to player 1) */
  G.hurtPlayer = function (dmg, src, o) {
    o = o || {};
    const p = o.p || G.player;
    if (G.state !== 'playing' || !p.canBeHurt) return 0;
    dmg = Math.max(1, Math.round(dmg * p.stats.dmgReduction));
    if (p.buffs.shield > 0 && p.shield > 0) {
      const a = Math.min(p.shield, dmg);
      p.shield -= a;
      dmg -= a;
      Audio.sfx('shield');
      FX.ring(p.x, p.y, 8, 16, '#3ccbe6', 0.25);
      FX.text(p.x, p.y - 16, 'BLOCKED', '#3ccbe6', 1);
      if (p.shield <= 0) {
        p.buffs.shield = 0;
        Audio.sfx('shield_break');
      }
      if (dmg <= 0) {
        p.invuln = 0.3;
        return 0;
      }
    }
    p.hp = Math.max(0, p.hp - dmg);
    p.invuln = B.player.hitIframes;
    p.flash = 1;
    p.hurtAt = G.time; // the hurt strip plays for a fixed 0.32 s (Player.draw)
    if (src && src.x !== undefined) {
      const a = U.ang(src.x, src.y, p.x, p.y);
      p.kx += Math.cos(a) * 150;
      p.ky += Math.sin(a) * 150;
    }
    G.shake(4, 0.22);
    G.hurtFlash = G.coop ? 0.18 : 0.4;
    Audio.sfx('hurt');
    CH.Input.rumbleFor(p.inp, 0.7, 0.5, 200);
    FX.text(p.x, p.y - 14, '-' + dmg, '#e43b44', 2);
    FX.burst(p.x, p.y, { n: 8, colors: ['#e43b44', '#ffffff'], speed: 80, life: 0.35 });
    FX.vfx('vfx.p1.29', p.x, p.y - 4, { scale: 0.55, fps: 26 });
    CH.Kit.hit(CH.Kit.elemOf(src), p.x, p.y - 6, 13, false);
    if (o.slow) p.slowT = Math.max(p.slowT, o.slow.t);
    if (o.distract) {
      p.distractT = o.distract;
      G.screenFlash(0.55, '#ffffff');
    }
    G.combo = 0;
    if (p.hp <= 0) G.killPlayer(p);
    return dmg;
  };

  /* hurt every living player that satisfies test(p) */
  G.hurtPlayers = function (dmg, src, o, test) {
    let n = 0;
    for (const p of G.players) {
      if (p.dead || (test && !test(p))) continue;
      if (G.hurtPlayer(dmg, src, Object.assign({}, o, { p }))) n++;
    }
    return n;
  };

  G.healPlayer = function (raw, p) {
    p = p || G.player;
    if (p.dead) return 0;
    const amt = Math.round(raw * p.stats.healMult * G.diff.heal);
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amt);
    const got = Math.round(p.hp - before);
    if (got > 0) {
      FX.text(p.x, p.y - 16, '+' + got, '#63c74d', 1);
      FX.burst(p.x, p.y, { n: 6, colors: ['#63c74d', '#ffffff'], speed: 40, life: 0.5, up: 30 });
    }
    return got;
  };

  /* a player goes down. In co-op the partner can revive them; the run only ends when everyone is down. */
  G.killPlayer = function (p) {
    p = p || G.player;
    if (p.dead) return; // death triggers exactly once
    p.dead = true;
    p.hp = 0;
    p.deathT = 0;
    p.reviveT = 0;
    p.cast = null;
    p.rolling = false;
    CH.Input.rumbleFor(p.inp, 1, 1, 450);
    if (G.coop && !G.allDead()) {
      Audio.sfx('hurt');
      G.explode(p.x, p.y, 22, 0, { colors: ['#e43b44', '#ffffff', '#feae34'], big: false, noShake: true });
      G.shake(5, 0.3);
      FX.text(p.x, p.y - 26, p.name + ' DOWN!', '#e43b44', 2);
      G.ui.toast(p.name + ' IS DOWN - STAND NEXT TO THEM TO REVIVE');
      return;
    }
    G.deathTimer = 0;
    Audio.sfx('gameover');
    CH.Audio.setMusic(null);
    CH.Audio.setAmbience(null);
    G.explode(p.x, p.y, 30, 0, { colors: ['#e43b44', '#ffffff', '#feae34'], big: false });
    G.shake(7, 0.5);
    G.clearEnemyProjectiles();
  };

  G.revivePlayer = function (p, hpFrac, by) {
    if (!p.dead) return;
    p.dead = false;
    p.deathT = 0;
    p.reviveT = 0;
    p.hp = Math.max(1, Math.round(p.maxHp * (hpFrac || 0.5)));
    p.invuln = 2;
    p.flash = 0;
    p.vx = p.vy = 0;
    Audio.sfx('levelup');
    FX.vfx('vfx.p5.18', p.x, p.y - 6, { scale: 1, fps: 14, add: true });
    FX.vfx('vfx.p5.9', p.x, p.y, { scale: 1.2, fps: 20 });
    FX.text(p.x, p.y - 26, p.name + ' REVIVED!', '#63c74d', 2);
    CH.Input.rumbleFor(p.inp, 0.3, 0.6, 250);
  };
  G.revivePlayers = function (hpFrac) {
    for (const p of G.players) if (p.dead && !G.allDead()) G.revivePlayer(p, hpFrac);
  };

  /* standing next to a downed partner revives them (progress ring), pausing while enemies hurt the rescuer */
  G.updateRevive = function (dt) {
    if (!G.coop) return;
    for (const p of G.players) {
      if (!p.dead) continue;
      let helper = null;
      for (const q of G.players) if (!q.dead && U.dist(p.x, p.y, q.x, q.y) < B.coop.reviveRadius) helper = q;
      if (helper && !helper.cast) {
        p.reviveT += dt;
        if (Math.random() < dt * 18) FX.burst(p.x + U.rand(-8, 8), p.y - 6, { n: 1, colors: ['#63c74d', '#ffffff'], speed: 30, life: 0.5, up: 30 });
        if (p.reviveT >= B.coop.reviveTime) G.revivePlayer(p, B.coop.reviveHp, helper);
      } else p.reviveT = Math.max(0, p.reviveT - dt * 0.7);
    }
  };

  /* explosions normally use the fire/cheese/ice blast art. With o.fx (an element) the strike is drawn by the VFX kit instead */
  const FX_PIXELS = { earth: 'crumb', toxic: 'goo', magic: 'glitch', glitch: 'glitch', tech: 'ice', bolt: 'cheese', wind: ['#ffffff', '#e8e4f0', '#3ccbe6'], phys: 'junk', fire: 'fire', ice: 'ice', flash: 'cheese' };
  const FX_OF_COLORS = { fire: 'fire', cheese: 'fire', glitch: 'magic', crumb: 'earth', ice: 'ice', goo: 'toxic' };
  G.explode = function (x, y, r, dmg, o) {
    o = o || {};
    const elem = o.fx || FX_OF_COLORS[o.colors] || 'fire';
    if (o.fx && CH.Art.on) {
      CH.Kit.impact(o.fx, x, y, r * 0.85);
      FX.ring(x, y, r * 0.2, r, '#ffffff', 0.3);
      FX.burst(x, y, { n: Math.round(U.clamp(r * 0.3, 4, 14)), colors: FX_PIXELS[o.fx] || 'fire', speed: r * 2, life: 0.4 });
    } else FX.explosion(x, y, r, { colors: o.colors || 'fire', alpha: o.alpha, big: o.big });
    Audio.sfx(r >= 60 || o.big ? 'big_explosion' : 'explosion');
    if (!o.noShake) G.shake(U.clamp(r * 0.07, 1.5, 8), 0.2);
    const p = o.shooter || G.player;
    if ((o.owner === 'p' || o.hitEnemies) && dmg > 0) {
      for (let i = 0; i < G.enemies.length; i++) {
        const e = G.enemies[i];
        if (e.dead || e === o.exclude || e.state === 'spawn' || e.immune) continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (d > r + e.r) continue;
        const crit = o.crit && Math.random() < p.stats.critChance;
        const fall = 1 - 0.4 * Math.min(1, d / (r + e.r));
        const a = Math.atan2(e.y - y, e.x - x);
        G.damageEnemy(e, dmg * fall * (crit ? B.player.critMult : 1), { crit, kx: Math.cos(a), ky: Math.sin(a), kf: o.knock || 150, stun: o.knock > 200 ? 0.3 : 0, elem, lite: true, shooter: o.shooter });
      }
      // Damage nearby tree props from explosion
      if (G.arena && G.arena.props) {
        for (const prop of G.arena.props) {
          if (prop.kind !== 'tree' || prop.dead || prop.falling) continue;
          const d = Math.hypot(prop.x - x, prop.y - y);
          if (d < r + 16) {
            CH.Weapons.damageTree(G, prop, dmg * 0.8, o.shooter || G.player);
          }
        }
      }
    }
    if (o.hurtPlayer) G.hurtPlayers(o.pdmg !== undefined ? o.pdmg : dmg, { x, y, fx: elem }, {}, (q) => Math.hypot(q.x - x, q.y - y) < r + q.r);
    if (o.clearProj) G.clearEnemyProjectiles(x, y, r + 10);
  };

  G.clearEnemyProjectiles = function (x, y, r) {
    for (const pr of G.projectiles) {
      if (pr.owner !== 'e' || pr.dead) continue;
      if (x === undefined || Math.hypot(pr.x - x, pr.y - y) < r) {
        pr.dead = true;
        FX.burst(pr.x, pr.y, { n: 3, colors: [pr.color || '#ffffff'], speed: 40, life: 0.25 });
      }
    }
  };
  G.clearHazards = function () {
    G.zones.length = 0;
  };

  /* baguette: bat enemy shots back at them */
  G.deflectProjectiles = function (x, y, r, ang, arc, who) {
    const p = who || G.player;
    for (const pr of G.projectiles) {
      if (pr.owner !== 'e' || pr.dead) continue;
      const d = Math.hypot(pr.x - x, pr.y - y);
      if (d > r) continue;
      if (Math.abs(U.angDiff(ang, U.ang(x, y, pr.x, pr.y))) > arc / 2) continue;
      pr.owner = 'p';
      pr.vx = -pr.vx * 1.3;
      pr.vy = -pr.vy * 1.3;
      pr.speed *= 1.3;
      pr.dmg = 12 * p.stats.dmgMult;
      pr.shooter = p;
      pr.hits = new Set();
      pr.life = 1.5;
      pr.slow = null;
      pr.onHit = null;
      FX.burst(pr.x, pr.y, { n: 6, colors: ['#ffffff', '#fee761'], speed: 80, life: 0.3 });
      FX.text(pr.x, pr.y - 6, 'BONK!', '#fee761', 1);
      Audio.sfx('parry');
    }
  };

  G.addDecoy = function (x, y, life) {
    G.decoys.push({ x, y, life, t: 0 });
    FX.burst(x, y, { n: 10, colors: 'confetti', speed: 70, life: 0.5 });
  };

  /* ------------------------------------------------------------ kill + drops */
  /* an enemy dies once: the core effects, then the 'kill' listeners (blood, quests, perks, loot affixes ...) */
  G.killEnemy = function (e) {
    if (e.dead) return;
    killCore(e);
    G.emit('kill', e);
  };
  function killCore(e) {
    e.dead = true;
    e.state = 'dead';
    const p = e.lastHitBy && !e.lastHitBy.dead ? e.lastHitBy : G.alivePlayers()[0] || G.player; // the killer gets the perks
    G.kills++;
    G.combo++;
    G.comboT = B.score.comboWindow;
    const points = Math.round((e.def.score || 0) * G.scoreMult());
    G.addScore(points);
    Audio.sfx(e.isBoss ? 'enemy_die_big' : (e.look && e.look.die) || 'enemy_die');
    FX.burst(e.x, e.y, { n: 12, colors: 'goo', speed: 110, life: 0.5, g: 150 });
    if (!e.isBoss) {
      const sc = e.scale * G.mods.enemyScale;
      if (!FX.corpse(e.look.sprite, e.x, e.y + (e.look.fly ? 0 : 0), { flip: e.face < 0, scale: sc, gold: e.isElite ? '#fee761' : null, foot: e.look.foot - (e.look.fly ? e.look.fly : 0) })) FX.debris(e.look.sprite, e.x, e.y, U.rand(-70, 70), U.rand(-140, -60), { frame: 0, flash: 1, life: 0.6 });
      FX.vfx('vfx.p1.7', e.x, e.y, { scale: 0.5, fps: 20, alpha: 0.8 });
      if (e.isElite) FX.text(e.x, e.y - 22, '+' + points, '#fee761', 1);
    }
    if (!e.isBoss && !G.allDead()) {
      G.dropLoot(e, p);
      CH.Loot.dropFor(G, e);
      if (!e.summoned && Math.random() < (e.isElite ? 0.2 : 0.025)) CH.PowerUps.dropCurio(G, e.x + U.rand(-8, 8), e.y + U.rand(-8, 8));
    }
    if (e.type === 'slime' && !e.summoned && !e.isElite && !G.allDead() && G.enemies.length < G.aliveCap() - 2) {
      const kids = e.trait === 'split' ? 4 : 2;
      for (let k = 0; k < kids; k++) G.spawnEnemy('slime', e.x + (k - (kids - 1) / 2) * 12, e.y, { summoned: true, hpMul: 0.45 });
    }
    if (e.trait === 'boom' && !G.allDead()) {
      const bx = e.x;
      const by = e.y;
      G.after(0.05, () => G.explode(bx, by, 34, 18, { owner: 'p', hitEnemies: true, hurtPlayer: true, pdmg: G.edmg(9), colors: 'fire', knock: 140, noShake: true, fx: 'fire' }));
    }
    if (e.isElite && p.stats.refundHeal > 0) {
      G.healPlayer(p.stats.refundHeal, p);
      FX.text(p.x, p.y - 26, 'REFUND!', '#63c74d', 1);
    }
    if (G.mods.explosiveDeaths && !e.isBoss) {
      const x = e.x;
      const y = e.y;
      G.after(0.07, () => G.explode(x, y, 28, 22, { owner: 'p', hitEnemies: true, hurtPlayer: true, pdmg: G.edmg(8), colors: 'fire', knock: 130, noShake: true }));
    }
    if (e.isBoss) G.onBossDefeated(e);
  }

  G.dropLoot = function (e, who) {
    const d = e.def;
    const p = who || G.player;
    const half = e.summoned ? 0.5 : 1;
    // xp
    const xp = Math.max(1, Math.ceil(d.xp * half * (e.isElite ? 2 : 1)));
    const parts = xp <= 3 ? 1 : xp <= 8 ? 2 : 3;
    for (let i = 0; i < parts; i++) G.dropPickup('xp', e.x + U.rand(-5, 5), e.y + U.rand(-5, 5), Math.ceil(xp / parts));
    // coins
    if (!e.summoned) {
      let n = 0;
      if (Math.random() < d.coin) n = e.type === 'intern' ? U.randInt(2, 3) : 1;
      if (e.isElite) n += U.randInt(3, 5);
      n = Math.floor(n * p.stats.coinMult + Math.random());
      for (let i = 0; i < n; i++) G.dropPickup('coin', e.x + U.rand(-6, 6), e.y + U.rand(-6, 6), 1);
    }
    const heal = G.diff === B.difficulty.casual ? 1.6 : G.diff === B.difficulty.chaotic ? 0.8 : 1;
    if (Math.random() < (e.isElite ? B.drops.eliteHpChance : B.drops.hpChance) * heal) G.dropPickup('hp', e.x, e.y, B.drops.hpHeal);
    if (!e.summoned && Math.random() < (e.isElite ? 0.15 : B.drops.powerChance)) G.dropPickup('power', e.x, e.y, 1);
  };

  G.dropPickup = function (type, x, y, value, o) {
    o = o || {};
    if (G.pickups.length > 360 && (type === 'xp' || type === 'coin')) {
      // keep the entity count bounded: collect immediately instead
      G.collect({ type, value, x, y, silent: true });
      return null;
    }
    const a = U.rand(0, U.TAU);
    const sp = o.still ? 0 : U.rand(25, 70);
    let pu = null;
    let icon = o.icon || null;
    if (type === 'power') {
      const r = o.pu ? { kind: o.pu, icon: U.pick(CH.PowerUps.KINDS[o.pu].icons) } : CH.PowerUps.roll();
      pu = r.kind;
      icon = 'pu.' + r.icon;
    } else if (type === 'hp') icon = 'pu.' + U.pick(CH.PowerUps.HEAL_ICONS);
    else if (type === 'loot') icon = 'loot.' + o.item;
    const pk = {
      type,
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      value: value || 1,
      age: 0,
      life: o.life || ({ coin: B.drops.coinLife, xp: B.drops.xpLife, hp: B.drops.hpLife, power: B.drops.powerLife, token: 999 }[type] || 20),
      collected: false,
      phase: U.rand(0, 6),
      kind: o.kind,
      pu,
      icon,
      item: o.item,
      sprite: type === 'coin' ? 'coin' : type === 'xp' ? (value >= 4 ? 'gem_big' : 'gem') : type === 'hp' ? 'hp' : type === 'power' ? 'power' : (type === 'wood' || type === 'scrap' || type === 'stone') ? type : 'token',
    };
    pk.x = U.clamp(pk.x, B.arena.margin + 4, G.arena.w - B.arena.margin - 4);
    pk.y = U.clamp(pk.y, B.arena.margin + 4, G.arena.h - B.arena.margin - 4);
    G.pickups.push(pk);
    return pk;
  };

  G.addCoins = function (n, x, y) {
    G.coins += n;
    G.coinsEarned = (G.coinsEarned || 0) + n;
    G.addScore(n * B.score.coin * G.diff.score);
  };

  G.collect = function (pk, who) {
    if (pk.collected) return;
    pk.collected = true;
    const p = who || G.player;
    switch (pk.type) {
      case 'wood':
      case 'scrap':
      case 'stone': {
        const n = pk.value || 1;
        if (!G.resources) G.resources = { wood: 0, scrap: 0, stone: 0 };
        G.resources[pk.type] = (G.resources[pk.type] || 0) + n;
        CH.Storage.addResource(pk.type, n);
        if (!pk.silent) {
          Audio.sfx('pickup_coin');
          FX.text(p.x, p.y - 14, '+' + n + ' ' + pk.type.toUpperCase(), pk.type === 'wood' ? '#d1a964' : (pk.type === 'scrap' ? '#68c2d3' : '#a6b0bf'), 1);
          FX.burst(pk.x, pk.y, { n: 4, colors: pk.type === 'wood' ? ['#8b5a2b', '#d1a964'] : (pk.type === 'scrap' ? ['#78889e', '#c2d0e0'] : ['#737b88', '#a6b0bf']), speed: 35, life: 0.3 });
        }
        break;
      }
      case 'coin': {
        const n = pk.value * (p.buffs.midas > 0 ? 2 : 1);
        G.addCoins(n);
        if (!pk.silent) {
          Audio.sfx('pickup_coin');
          G.coinText(p, n);
          FX.vfx('vfx.p5.19', p.x, p.y - 6, { scale: 0.5, fps: 24 });
        }
        break;
      }
      case 'xp':
        CH.Upgrades.addXp(G, pk.value, p);
        if (!pk.silent) {
          Audio.sfx('pickup_xp');
          FX.burst(pk.x, pk.y, { n: 3, colors: ['#3ccbe6', '#ffffff'], speed: 40, life: 0.3 });
        }
        break;
      case 'loot':
        CH.Loot.collect(G, pk, p);
        break;
      case 'curio':
        CH.PowerUps.collectCurio(G, pk, p);
        break;
      case 'hp':
        G.healPlayer(pk.value, p);
        Audio.sfx('pickup_hp');
        FX.vfx('vfx.p5.23', p.x, p.y - 4, { scale: 0.8, fps: 18 });
        break;
      case 'power':
        CH.PowerUps.collect(G, pk, p);
        break;
      case 'token':
        G.collectToken(pk, p);
        break;
    }
  };

  /* batched "+N" coin text so heavy coin showers do not flood the screen */
  G.coinText = function (p, n) {
    G._coinAcc = (G._coinAcc || 0) + n;
    if (!G._coinTimer) {
      G._coinTimer = true;
      G.after(0.25, () => {
        FX.text(p.x, p.y - 18, '+' + G._coinAcc + '$', '#fee761', 1);
        G._coinAcc = 0;
        G._coinTimer = false;
      });
    }
  };

  /* --------------------------------------------------------------- bosses */
  G.onBossDying = function (b) {
    G.bossDying = b;
    for (const p of G.players) p.invuln = Math.max(p.invuln, b.deathT + 1);
    for (const e of G.enemies) {
      if (e !== b && !e.dead) {
        e.dead = true;
        FX.burst(e.x, e.y, { n: 8, colors: 'goo', speed: 90, life: 0.4 });
      }
    }
    G.queue.length = 0;
    CH.Audio.stopMusic();
    G.ui.hideBossBar(false);
  };

  G.onBossDefeated = function (b) {
    G.bossDying = null;
    G.bossKills++;
    const kind = b.kind;
    const isFinal = FINAL_BOSSES.includes(kind) && b.tier === 0 && !G.endless;
    G.addScore((kind === 'bug' && b.tier === 0 ? B.score.boss.bug : b.tier > 0 ? B.score.boss.endless : B.score.boss[kind]) * G.diff.score);
    G.ui.hideBossBar(true);
    // coin fountain + boss token
    const coins = B.drops.bossCoins[kind] * (1 + b.tier * 0.4);
    for (let i = 0; i < 14; i++) G.dropPickup('coin', b.x + U.rand(-24, 24), b.y + U.rand(-24, 24), Math.round(coins / 14));
    G.dropPickup('hp', b.x, b.y, 60);
    CH.Loot.bossDrops(G, b);
    for (let i = 0; i < 4; i++) CH.PowerUps.dropCurio(G, b.x + U.rand(-30, 30), b.y + U.rand(-24, 24));
    G.dropPickup('power', b.x + 20, b.y, 1);
    const pk = G.dropPickup('token', b.x, b.y - 4, 1, { kind, tier: b.tier });
    if (pk) {
      pk.vx = pk.vy = 0;
      pk.boss = b;
    }
    if (isFinal && !G.won) {
      G.won = true;
      G.victoryPending = true;
      G.after(1.6, () => G.victory());
    } else {
      G.playMusic();
      Audio.sfx('boss_defeated');
    }
  };

  G.collectToken = function (pk) {
    const b = pk.boss || { kind: pk.kind, tier: pk.tier || 0 };
    Audio.sfx('token');
    Audio.sfx('chest');
    // a boss token rewards the whole party
    let lines = [];
    G.players.forEach((q, i) => {
      const l = CH.Upgrades.bossReward(G, { kind: b.kind, tier: b.tier || 0 }, q);
      if (i === 0) lines = l;
    });
    for (const l of lines) G.rewardsLog.push(l);
    G.ui.banner('BOSS TOKEN!', lines.join('  -  '), 3.2);
    for (const q of G.players) FX.text(q.x, q.y - 30, 'BOSS TOKEN!', '#fee761', 2);
    G.shake(3, 0.2);
    G.ui.refreshWeapons();
  };

  G.onBossHit = () => {};

  /* ---------------------------------------------------------------- zones */
  G.addZone = function (o) {
    if (G.zones.length > 140) return null;
    const z = Object.assign({ shape: 'circle', r: 10, life: 1, tickT: 0, tick: 0.5, age: 0 }, o);
    z.T = z.life;
    G.zones.push(z);
    return z;
  };
  G.addWarn = function (x, y, r, delay, fn, o) {
    return G.addZone(Object.assign({ kind: 'warn', x, y, r, life: delay, fn }, o || {}));
  };

  function inZone(z, px, py, pr) {
    if (z.shape === 'line') {
      const ex = Math.cos(z.ang);
      const ey = Math.sin(z.ang);
      const dx = px - z.x;
      const dy = py - z.y;
      const t = U.clamp(dx * ex + dy * ey, 0, z.len);
      const cx = z.x + ex * t;
      const cy = z.y + ey * t;
      return Math.hypot(px - cx, py - cy) < z.w / 2 + pr;
    }
    return Math.hypot(px - z.x, py - z.y) < z.r + pr;
  }
  G.inZone = inZone;

  G.updateZones = function (dt) {
    for (let i = G.zones.length - 1; i >= 0; i--) {
      const z = G.zones[i];
      z.age += dt;
      z.life -= dt;
      switch (z.kind) {
        case 'warn':
          if (z.life <= 0) {
            G.zones.splice(i, 1);
            if (z.fn) z.fn(G, z);
          }
          continue;
        case 'toast':
        case 'acid':
        case 'field':
        case 'lava':
        case 'corrupt':
          z.tickT -= dt;
          if (z.tickT <= 0) {
            z.tickT = z.tick;
            G.hurtPlayers(z.dmgP, z, z.slow ? { slow: { mul: z.slow, t: 1.2 } } : {}, (q) => inZone(z, q.x, q.y, q.r * 0.6));
            if (z.dmgE) {
              for (const e of G.enemies) if (!e.dead && !e.isBoss && e.state !== 'spawn' && inZone(z, e.x, e.y, e.r * 0.5)) G.damageEnemy(e, z.dmgE, {});
            }
          }
          if (z.kind === 'lava' && z.age < dt * 1.5) Audio.sfx('sizzle');
          if (z.kind === 'lava' && Math.random() < dt * 8) FX.burst(z.x + U.rand(-z.r, z.r) * 0.8, z.y + U.rand(-z.r, z.r) * 0.6, { n: 1, colors: ['#feae34', '#f77622'], speed: 10, up: 30, life: 0.5 });
          break;
        case 'cheese':
          for (const e of G.enemies) if (!e.dead && inZone(z, e.x, e.y, 0)) e.zoneSlow = Math.min(e.zoneSlow, 1 - z.slowE);
          break;
        case 'beam':
          if (z.once) {
            z.once = false;
            G.hurtPlayers(z.dmgP, { x: z.x, y: z.y }, {}, (q) => inZone(z, q.x, q.y, q.r * 0.5));
          }
          break;
      }
      if (z.life <= 0) G.zones.splice(i, 1);
    }
  };

  /* --------------------------------------------------------------- pickups */
  G.updatePickups = function (dt) {
    const list = G.pickups;
    for (let i = list.length - 1; i >= 0; i--) {
      const pk = list[i];
      if (pk.collected) {
        list[i] = list[list.length - 1];
        list.pop();
        continue;
      }
      pk.age += dt;
      pk.life -= dt;
      if (pk.life <= 0) {
        list[i] = list[list.length - 1];
        list.pop();
        continue;
      }
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      const k = Math.max(0, 1 - 5 * dt);
      pk.vx *= k;
      pk.vy *= k;
      const p = G.nearestPlayer(pk.x, pk.y);
      if (!p) continue;
      const reach = p.stats.magnet;
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const d = Math.hypot(dx, dy);
      const pull = G.vacuum > 0 || pk.type === 'token' ? 9999 : reach;
      if (d < pull && pk.age > 0.2) {
        const sp = (G.vacuum > 0 ? 260 : 120) + Math.max(0, (pull - d)) * 2;
        const m = Math.min(sp * dt, d);
        pk.x += (dx / (d || 1)) * m;
        pk.y += (dy / (d || 1)) * m;
      }
      if (d < 9 && pk.age > 0.12) {
        G.collect(pk, p);
        list[i] = list[list.length - 1];
        list.pop();
      }
    }
  };

  /* ------------------------------------------------------- vending machine */
  /* is this hero standing at a vending machine (so that B / E mean "buy")? */
  G.canInteract = function (p) {
    const m = G.machine;
    return !!m && !p.dead && U.dist(p.x, p.y, m.x, m.y) <= 36;
  };

  G.interact = function (who) {
    const m = G.machine;
    const p = who || G.player;
    if (!m || p.dead) return;
    if (U.dist(p.x, p.y, m.x, m.y) > 36) return;
    if (m.uses <= 0) {
      FX.text(m.x, m.y - 34, 'OUT OF ORDER', '#e43b44', 1);
      Audio.sfx('nope');
      return;
    }
    if (G.coins < B.shop.cost) {
      FX.text(m.x, m.y - 34, 'NEED ' + B.shop.cost + ' COINS', '#e43b44', 1);
      Audio.sfx('nope');
      return;
    }
    G.coins -= B.shop.cost;
    m.uses--;
    Audio.sfx('buy');
    Audio.sfx('vend');
    G.shake(2, 0.15);
    FX.burst(m.x, m.y, { n: 14, colors: 'confetti', speed: 100, life: 0.6 });
    const unowned = B.weaponOrder.filter((w) => !p.weapons.includes(w));
    const opts = [
      ['heal', 3],
      ['power', 3],
      ['xp', 2],
      ['weapon', unowned.length ? 2 : 0],
    ];
    const r = U.weighted(opts, (o) => o[1])[0];
    if (r === 'heal') {
      FX.text(m.x, m.y - 34, 'BZZT. SNACKS!', '#63c74d', 1);
      G.healPlayer(p.maxHp * 0.35, p);
    } else if (r === 'power') {
      FX.text(m.x, m.y - 34, 'BZZT. SURPRISE!', '#b55088', 1);
      CH.Upgrades.givePower(G, U.pick(Object.keys(B.pickupsBuff)), p);
    } else if (r === 'xp') {
      FX.text(m.x, m.y - 34, 'BZZT. WISDOM!', '#3ccbe6', 1);
      CH.Upgrades.addXp(G, Math.round(B.xp.need(p.level) * 0.7), p);
    } else {
      const w = U.pick(unowned);
      p.addWeapon(w);
      FX.text(m.x, m.y - 34, 'BZZT. ' + B.weapons[w].name.toUpperCase() + '!', '#fee761', 1);
      G.ui.refreshWeapons();
    }
  };

  /* ------------------------------------------------------------- level up */
  G.openLevelUp = function () {
    G.state = 'levelup';
    G.pickLock = false;
    G.pendingLevels--;
    G.luQueue = G.players.slice();
    Audio.sfx('levelup');
    Audio.sfx('book');
    Audio.setMusic('library');
    for (const q of G.players) {
      FX.vfx('vfx.p5.18', q.x, q.y - 6, { scale: 0.9, fps: 14 });
      FX.vfx('vfx.p5.9', q.x, q.y, { scale: 1.1, fps: 20 });
    }
    CH.Input.clear();
    G.nextLevelUpPick();
  };

  /* show the next player's three cards */
  G.nextLevelUpPick = function () {
    G.luPlayer = G.luQueue.shift();
    G.pickLock = false;
    G.cards = CH.Upgrades.makeCards(G, G.luPlayer);
    G.ui.showLevelUp(G.cards, G.luPlayer.level - G.pendingLevels, G.luPlayer);
  };

  G.pickUpgrade = function (i) {
    if (G.state !== 'levelup' || G.pickLock || !G.cards || !G.cards[i]) return false;
    G.pickLock = true; // each level-up applies exactly one card per player
    const card = G.cards[i];
    const who = G.luPlayer || G.player;
    CH.Upgrades.applyCard(G, card, who);
    G.cards = null;
    Audio.sfx('buy');
    G.ui.refreshWeapons();
    if (G.luQueue.length) {
      G.nextLevelUpPick();
      return true;
    }
    G.ui.hideLevelUp();
    G.state = 'playing';
    if (G.pendingLevels <= 0) G.playMusic();
    for (const q of G.players) q.invuln = Math.max(q.invuln, 0.8); // brief grace after choosing
    CH.Input.clear();
    return true;
  };

  /* ---------------------------------------------------------- run end flow */
  G.runDelta = function () {
    const base = G.run.base;
    const playTime = G.time - base.playTime;
    return {
      kills: G.kills - base.kills,
      coins: (G.coinsEarned || 0) - base.coins,
      bosses: G.bossKills - base.bosses,
      playTime,
      wave: G.wave,
      score: G.score,
    };
  };

  G.finishRun = function (win) {
    if (!G.run) return { newBest: false, fresh: [] };
    const d = G.runDelta();
    const first = !G.run.counted;
    G.run.counted = true;
    const res = Storage.recordRun(Object.assign(d, { first, win: !!win && !G.run.winCounted, death: !win && !G.won }));
    if (win) G.run.winCounted = true;
    G.run.base = { kills: G.kills, coins: G.coinsEarned || 0, bosses: G.bossKills, playTime: G.time };
    return res;
  };

  G.gameOver = function () {
    if (G.state === 'gameover') return;
    G.state = 'gameover';
    G.addScore(G.time * B.score.perSecond * 0); // survival score is accrued live
    const prevBest = Storage.stats.highScore;
    const res = G.finishRun(false);
    CH.Audio.setMusic(G.wavesCleared <= 3 ? 'sad' : 'gameover');
    CH.Audio.setAmbience(null);
    G.ui.showGameOver({
      score: G.score,
      wave: G.wavesCleared,
      reached: G.wave,
      kills: G.kills,
      coins: G.coinsEarned || 0,
      time: G.time,
      best: Math.max(prevBest, Math.floor(G.score)),
      newBest: res.newBest,
      fresh: res.fresh,
      loot: G.lootCount || 0,
      newLoot: G.newLoot || 0,
    });
  };

  G.victory = function () {
    if (G.state === 'victory') return;
    G.state = 'victory';
    G.victoryPending = false;
    const prevBest = Storage.stats.highScore;
    G.addScore(B.score.wave * 10);
    const res = G.finishRun(true);
    CH.Audio.setMusic('victory');
    CH.Audio.setAmbience(null);
    G.ui.showVictory({
      score: G.score,
      kills: G.kills,
      coins: G.coinsEarned || 0,
      time: G.time,
      best: Math.max(prevBest, Math.floor(G.score)),
      newBest: res.newBest,
      fresh: res.fresh,
      rewards: G.rewardsLog.slice(),
      bosses: G.bossKills,
      loot: G.lootCount || 0,
      newLoot: G.newLoot || 0,
    });
  };

  G.continueEndless = function () {
    if (G.state !== 'victory') return;
    G.endless = true;
    G.state = 'playing';
    G.ui.hideAll();
    CH.Input.clear();
    G.playMusic();
    G.pendingLevels = G.pendingLevels || 0;
    // the arena is quiet right now: begin the next wave
    G.waveState = 'clear';
    G.waveT = 1.5;
    G.wavesCleared = G.wave;
    G.vacuum = 4;
    G.ui.onRunStart(true);
  };

  /* abandon: record what happened, then go back to the menu */
  G.abandon = function () {
    if (G.run && G.state !== 'gameover' && G.state !== 'victory' && G.time > 3) G.finishRun(false);
    G.toMenu();
  };

  G.toMenu = function () {
    G.state = 'menu';
    G.menuCoop = false;
    G.enemies.length = 0;
    G.projectiles.length = 0;
    G.pickups.length = 0;
    G.zones.length = 0;
    G.decoys.length = 0;
    G.timers.length = 0;
    G.queue.length = 0;
    FX.reset();
    G.event = null;
    G.mods = defaultMods();
    CH.Audio.setMusic('menu');
    CH.Audio.setAmbience(null);
    G.ui.showMenu();
  };

  G.pause = function (by) {
    if (G.state !== 'playing') return;
    G.pausedBy = by === undefined ? null : by;
    G.state = 'paused';
    CH.Input.clear();
    G.ui.showPause();
    Storage.save();
  };
  G.resume = function () {
    if (G.state !== 'paused') return;
    G.state = 'playing';
    CH.Input.clear();
    G.ui.hidePause();
  };

  /* Radio station (safehouse): every so often a supply crate is dropped near the party. The landing spot is marked
     first, then the crate lands with a heal, a power-up, coins and gems. Higher radio levels call them in sooner. */
  G.updateAirdrops = function (dt) {
    const lvl = (CH.Storage.shelter && CH.Storage.shelter.radio) || 0;
    if (lvl <= 0 || G.waveState !== 'combat' || G.bossAlive() || G.allDead()) return;
    if (G.airdropT === undefined || G.airdropT === null) G.airdropT = 70 - 8 * lvl;
    G.airdropT -= dt;
    if (G.airdropT > 0) return;
    G.airdropT = 70 - 8 * lvl + U.rand(0, 14);
    const p = G.randomAlivePlayer();
    const m = B.arena.margin + 30;
    const a = U.rand(0, U.TAU);
    const d = U.rand(60, 130);
    const x = U.clamp(p.x + Math.cos(a) * d, m, G.arena.w - m);
    const y = U.clamp(p.y + Math.sin(a) * d, m, G.arena.h - m);
    Audio.sfx('warn');
    G.ui.toast('SUPPLY AIRDROP INCOMING!');
    FX.text(x, y - 24, 'AIRDROP!', '#fee761', 2);
    G.addWarn(x, y, 16, 1.8, (g2, z) => {
      Audio.sfx('chest');
      g2.shake(2, 0.15);
      FX.ring(z.x, z.y, 4, 26, '#fee761', 0.4);
      FX.vfx('vfx.p5.18', z.x, z.y - 6, { scale: 0.9, fps: 14, add: true });
      FX.burst(z.x, z.y, { n: 16, colors: ['#fee761', '#ffffff', '#63c74d'], speed: 90, life: 0.6 });
      g2.dropPickup('hp', z.x - 10, z.y, 25);
      g2.dropPickup('power', z.x + 10, z.y, 1);
      for (let i = 0; i < 6; i++) g2.dropPickup('coin', z.x + U.rand(-14, 14), z.y + U.rand(-14, 14), 1);
      for (let i = 0; i < 3; i++) g2.dropPickup('xp', z.x + U.rand(-12, 12), z.y + U.rand(-12, 12), 4);
    }, { lava: true });
  };

  /* a controller was unplugged: if it belongs to a player, stop the action so nobody dies of surprise */
  G.onPadLost = function (index) {
    if (G.state !== 'playing') return;
    const who = G.players.find((p) => p.inp.src.kind === 'pad' && p.inp.src.index === index);
    if (!who && !G.players.some((p) => p.inp.src.kind === 'auto' && p.inp.kind === 'pad')) return;
    G.pause();
    G.ui.toast((who ? who.name + ': ' : '') + 'CONTROLLER DISCONNECTED - RECONNECT, THEN PRESS START');
  };

  /* --------------------------------------------------------------- update */
  G.update = function (dt) {
    G.wall += dt;
    if (G.state === 'menu') {
      G.updateDemo(dt);
      return;
    }
    if (G.state !== 'playing') {
      // still let visual-only things breathe so the screen is not frozen during overlays
      if (G.state === 'gameover') FX.update(dt);
      return;
    }
    CH.Input.pollPads();
    for (const q of G.players) CH.Input.updatePlayer(q.inp, dt);
    const n = Math.max(1, Math.ceil(dt / B.stepDt));
    const h = dt / n;
    for (let i = 0; i < n && G.state === 'playing'; i++) G.step(h);
  };

  /* one simulation step: the core, then the 'step' listeners (every system that ticks with the game) */
  G.step = function (dt) {
    stepCore(dt);
    G.emit('step', dt);
  };
  function stepCore(dt) {
    G.time += dt;

    for (let i = G.timers.length - 1; i >= 0; i--) {
      const t = G.timers[i];
      t.t -= dt;
      if (t.t <= 0) {
        G.timers.splice(i, 1);
        t.fn();
      }
    }

    for (const q of G.players) q.update(G, dt);
    G.updateRevive(dt);
    if (G.state !== 'playing') return;
    G.updateWave(dt);
    CH.Events.update(G, dt);

    const list = G.enemies;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const e = list[i];
      if (!e.dead) e.update(G, dt);
    }
    CH.Enemies.separate(G);

    // contact damage, against every living player
    for (const p of G.players) {
      if (p.dead) continue;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.dead || !e.canTouch()) continue;
        const rr = e.r + p.r;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (dx * dx + dy * dy < rr * rr) {
          if (p.z > 6 && !e.flying && !e.isBoss) continue;
          if (G.hurtPlayer(e.touchDamage(), e, { p, slow: e.trait === 'slow' ? { mul: 0.6, t: 1.6 } : null })) e.contactCd = 0.9;
        }
      }
    }

    CH.Weapons.update(G, dt);
    G.updateZones(dt);
    for (let i = G.decoys.length - 1; i >= 0; i--) {
      G.decoys[i].life -= dt;
      G.decoys[i].t += dt;
      if (G.decoys[i].life <= 0) G.decoys.splice(i, 1);
    }
    G.updatePickups(dt);
    FX.update(dt);

    // safehouse radio: supply airdrops
    G.updateAirdrops(dt);

    // Weather simulation
    if (CH.Weather && CH.Weather.update) CH.Weather.update(dt);

    // Props update (sway dampening, tree falling animation, tree felling loot)
    if (G.arena && G.arena.props) {
      for (const prop of G.arena.props) {
        if (prop.shake > 0) prop.shake = Math.max(0, prop.shake - dt * 4);
        if (prop.bend !== 0) prop.bend *= Math.pow(0.08, dt * 6);
        if (prop.falling) {
          prop.fallT += dt * 2.2;
          if (prop.fallT >= 1) {
            prop.falling = false;
            prop.dead = true;
            prop.solid = false;
            G.shake(3, 0.2);
            Audio.sfx('tree_fall');
            FX.burst(prop.x + prop.fallDir * 20, prop.y, { n: 12, colors: ['#6b4a2a', '#4a9b3a', '#d1a964'], speed: 65, life: 0.5 });
            const resMult = (G.player && G.player.stats && G.player.stats.resMult) || 1;
            const woodCount = Math.round(U.randInt(3, 5) * resMult);
            for (let i = 0; i < woodCount; i++) G.dropPickup('wood', prop.x + prop.fallDir * 10 + U.rand(-8, 8), prop.y + U.rand(-8, 8), 1);
            G.dropPickup('coin', prop.x + prop.fallDir * 14, prop.y, 2);
            if (Math.random() < 0.4) G.dropPickup('hp', prop.x + prop.fallDir * 24, prop.y, 15);
          }
        }
      }
    }

    // remove the dead
    let w = 0;
    for (let i = 0; i < list.length; i++) if (!list[i].dead) list[w++] = list[i];
    list.length = w;

    // timers / combo / score
    if (G.comboT > 0) {
      G.comboT -= dt;
      if (G.comboT <= 0) G.combo = 0;
    }
    if (G.vacuum > 0) G.vacuum -= dt;
    if (G.warpT > 0) G.warpT -= dt;
    if (G.waveState === 'combat' && !G.allDead()) G.addScore(dt * B.score.perSecond * G.diff.score);
    if (G.flashT > 0) G.flashT -= dt * 1.8;
    if (G.hurtFlash > 0) G.hurtFlash -= dt;
    if (G.machine) G.machine.t += dt;
    G.updateCamera(dt);

    if (G.allDead()) {
      G.deathTimer += dt;
      if (G.deathTimer > 1.9) G.gameOver();
    } else if (G.pendingLevels > 0 && !G.bossDying) {
      G.openLevelUp();
    }
  }

  /* ---------------------------------------------------------- menu backdrop */
  G.initDemo = function () {
    G.demo = [];
    const ids = CH.Enemies.ids;
    for (let i = 0; i < 12; i++) {
      const type = ids[i % ids.length];
      G.demo.push({ type, x: U.rand(60, G.arena.w - 60), y: U.rand(60, G.arena.h - 60), vx: U.rand(-30, 30), vy: U.rand(-20, 20), age: U.rand(0, 5), face: 1 });
    }
    G.demoCam = { x: 100, y: 80 };
  };
  G.updateDemo = function (dt) {
    const m = B.arena.margin + 10;
    for (const d of G.demo) {
      d.age += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < m || d.x > G.arena.w - m) d.vx = -d.vx;
      if (d.y < m || d.y > G.arena.h - m) d.vy = -d.vy;
      d.face = d.vx >= 0 ? 1 : -1;
    }
    const t = G.wall * 0.12;
    G.demoCam.x = (G.arena.w - B.view.w) * (0.5 + 0.5 * Math.sin(t));
    G.demoCam.y = (G.arena.h - B.view.h) * (0.5 + 0.5 * Math.cos(t * 0.7));
    FX.update(dt);
  };
})(window.CH);
