/* CHAOS.exe - persistent settings, stats and unlocks (LocalStorage, fully defensive). */
(function (CH) {
  'use strict';
  const KEY = 'chaosexe.save.v1'; // storage key stays stable; the payload carries its own version
  const VERSION = 2;

  /* Step-by-step save migrations: MIGRATIONS[n] upgrades a version-n save to n+1.
     Each takes and returns a plain object and must tolerate missing fields. */
  const MIGRATIONS = {
    1(raw) {
      // v1 -> v2: the placeholder heroes became the Enchantress, Stranger and Specter (PLAN.md D2).
      // Later steps in this table: wave -> depth, inventory / sidekicks / quests.
      const R = { Wrangler: 'Enchantress', Foreman: 'Stranger', Gunslinger: 'Specter' };
      const fix = (id) => (typeof id === 'string' && R[id] ? R[id] : id);
      if (raw.settings && typeof raw.settings === 'object') {
        raw.settings.hero = fix(raw.settings.hero);
        raw.settings.hero2 = fix(raw.settings.hero2);
      }
      if (Array.isArray(raw.unlocked)) raw.unlocked = raw.unlocked.map(fix);
      const m = raw.meta;
      if (m && typeof m === 'object') {
        // per-hero tables inside the add-on data
        for (const t of ['mastery', 'alt', 'loadout', 'skin', 'maxedW', 'maxedU']) {
          const o = m[t];
          if (!o || typeof o !== 'object') continue;
          for (const old of Object.keys(R)) if (old in o) { o[R[old]] = o[old]; delete o[old]; }
        }
        if (Array.isArray(m.history)) for (const h of m.history) if (h && typeof h === 'object') h.hero = fix(h.hero);
      }
      return raw;
    },
  };

  function migrate(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    let v = Number.isInteger(raw.version) && raw.version >= 1 ? raw.version : 1;
    while (v < VERSION && MIGRATIONS[v]) {
      raw = MIGRATIONS[v](raw) || raw;
      v++;
      raw.version = v;
    }
    return raw;
  }

  const DEFAULT_KEYS = {
    up: 'KeyW',
    down: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    sprint: 'ShiftLeft',
    dodge: 'Space',
    jump: 'Space',
    reload: 'KeyR',
    interact: 'KeyE',
    special: 'KeyQ',
    gadget: 'KeyG',
    secondary: 'KeyZ',
    gadgetType: 'KeyX',
    swap: 'KeyV',
    fortify: 'KeyF',
  };

  const defaults = () => ({
    version: VERSION,
    settings: {
      master: 0.8,
      music: 0.5,
      sfx: 0.8,
      musicOn: true,
      sfxOn: true,
      muted: false,
      shake: true,
      flashing: true,
      reduced: false,
      difficulty: 'normal',
      hero: 'Mercenary',
      hero2: 'Mercenary',
      aimAssist: true,
      rumble: true,
      padDeadzone: 0.2,
      keys: Object.assign({}, DEFAULT_KEYS),
    },
    stats: { totalRuns: 0, totalKills: 0, bossesDefeated: 0, highestWave: 0, highScore: 0, totalPlayTime: 0, wins: 0, totalCoins: 0, deaths: 0, bestTime: 0 },
    resources: { wood: 0, scrap: 0, stone: 0 },
    shelter: { workbench: 0, bed: 0, storage: 0, radio: 0, barricades: 0, decor: {} },
    loot: {}, // mob-drop item id -> how many are in stock
    seen: {}, // mob-drop item id -> true once found (the Trophy Codex)
    unlocked: ['Mercenary'],
    meta: {}, // add-on progress (achievements, history, mastery, daily board...), owned by CH.Meta
  });

  const num = (v, d, lo, hi) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const bool = (v, d) => (typeof v === 'boolean' ? v : d);

  /* Never trust what comes out of storage: rebuild from defaults field by field. */
  function sanitize(raw) {
    const d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    raw = migrate(raw);
    const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    const o = d.settings;
    o.master = num(s.master, o.master, 0, 1);
    o.music = num(s.music, o.music, 0, 1);
    o.sfx = num(s.sfx, o.sfx, 0, 1);
    o.musicOn = bool(s.musicOn, o.musicOn);
    o.sfxOn = bool(s.sfxOn, o.sfxOn);
    o.muted = bool(s.muted, o.muted);
    o.shake = bool(s.shake, o.shake);
    o.flashing = bool(s.flashing, o.flashing);
    o.reduced = bool(s.reduced, o.reduced);
    if (typeof s.difficulty === 'string' && CH.Balance.difficulty[s.difficulty]) o.difficulty = s.difficulty;
    if (typeof s.hero === 'string' && CH.Balance.heroes.some((h) => h.id === s.hero)) o.hero = s.hero;
    if (typeof s.hero2 === 'string' && CH.Balance.heroes.some((h) => h.id === s.hero2)) o.hero2 = s.hero2;
    o.aimAssist = bool(s.aimAssist, o.aimAssist);
    o.rumble = bool(s.rumble, o.rumble);
    o.padDeadzone = num(s.padDeadzone, o.padDeadzone, 0.05, 0.5);
    if (s.keys && typeof s.keys === 'object') {
      for (const k of Object.keys(DEFAULT_KEYS)) {
        if (typeof s.keys[k] === 'string' && s.keys[k].length < 24) o.keys[k] = s.keys[k];
      }
    }
    const st = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
    for (const k of Object.keys(d.stats)) d.stats[k] = num(st[k], d.stats[k], 0, 1e12);

    const res = raw.resources && typeof raw.resources === 'object' ? raw.resources : {};
    for (const k of ['wood', 'scrap', 'stone']) d.resources[k] = num(res[k], 0, 0, 1e9);

    const sh = raw.shelter && typeof raw.shelter === 'object' ? raw.shelter : {};
    for (const k of ['workbench', 'bed', 'storage', 'radio', 'barricades']) d.shelter[k] = num(sh[k], 0, 0, 5);
    d.shelter.decor = {};
    if (sh.decor && typeof sh.decor === 'object') for (const k of ['chair', 'lamp', 'table', 'shelf']) if (sh.decor[k] === true) d.shelter.decor[k] = true;

    const idOk = (k) => /^[0-9]+$/.test(k) && +k >= 1 && +k <= 367;
    if (raw.loot && typeof raw.loot === 'object') for (const k of Object.keys(raw.loot)) if (idOk(k)) d.loot[k] = Math.floor(num(raw.loot[k], 0, 0, 99999));
    if (raw.seen && typeof raw.seen === 'object') for (const k of Object.keys(raw.seen)) if (idOk(k) && raw.seen[k] === true) d.seen[k] = true;
    for (const k of Object.keys(d.loot)) if (d.loot[k] > 0) d.seen[k] = true;

    if (Array.isArray(raw.unlocked)) {
      const ids = CH.Balance.heroes.map((h) => h.id);
      d.unlocked = Array.from(new Set(['Mercenary'].concat(raw.unlocked.filter((x) => typeof x === 'string' && ids.includes(x)))));
    }
    if (raw.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta)) {
      try {
        const txt = JSON.stringify(raw.meta);
        if (txt.length < 300000) d.meta = JSON.parse(txt);
      } catch (e) {
        d.meta = {};
      }
    }
    return d;
  }

  const Storage = (CH.Storage = {
    DEFAULT_KEYS,
    VERSION,
    migrate,
    sanitize,
    MIGRATIONS,
    data: defaults(),
    available: true,

    load() {
      let raw = null;
      try {
        const txt = window.localStorage.getItem(KEY);
        if (txt) raw = JSON.parse(txt);
      } catch (e) {
        Storage.available = false;
        raw = null;
      }
      Storage.data = sanitize(raw);
      return Storage.data;
    },

    save() {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(Storage.data));
        return true;
      } catch (e) {
        Storage.available = false;
        return false;
      }
    },

    reset() {
      Storage.data = defaults();
      Storage.save();
    },

    get settings() {
      return Storage.data.settings;
    },
    get stats() {
      return Storage.data.stats;
    },
    get resources() {
      return Storage.data.resources;
    },
    get shelter() {
      return Storage.data.shelter;
    },
    get loot() {
      return Storage.data.loot;
    },
    addLoot(id, n) {
      Storage.data.loot[id] = (Storage.data.loot[id] || 0) + Math.max(0, n || 1);
      Storage.data.seen[id] = true;
      Storage.save();
    },
    /* sell n of an item; returns how many were actually sold */
    sellLoot(id, n) {
      const have = Storage.data.loot[id] || 0;
      const k = Math.max(0, Math.min(have, n));
      Storage.data.loot[id] = have - k;
      Storage.save();
      return k;
    },
    addResource(type, amt) {
      if (!Storage.data.resources[type]) Storage.data.resources[type] = 0;
      Storage.data.resources[type] += Math.max(0, amt);
      Storage.save();
    },
    canAfford(costs) {
      for (const k of Object.keys(costs)) {
        if ((Storage.data.resources[k] || 0) < costs[k]) return false;
      }
      return true;
    },
    spendResources(costs) {
      if (!Storage.canAfford(costs)) return false;
      for (const k of Object.keys(costs)) {
        Storage.data.resources[k] -= costs[k];
      }
      Storage.save();
      return true;
    },

    /* Fold a run (or the part of it since the last record) into lifetime stats.
       kills/coins/bosses/playTime are deltas; first/win/death say which counters to bump.
       Returns {newBest, fresh: newly unlocked palettes}. */
    recordRun(run) {
      const s = Storage.data.stats;
      if (run.first) s.totalRuns++;
      s.totalKills += Math.max(0, run.kills || 0);
      s.totalCoins += Math.max(0, run.coins || 0);
      s.bossesDefeated += Math.max(0, run.bosses || 0);
      s.totalPlayTime += Math.max(0, run.playTime || 0);
      s.highestWave = Math.max(s.highestWave, run.wave || 0);
      if (run.win) s.wins++;
      if (run.death) s.deaths++;
      const newBest = run.score > s.highScore;
      if (newBest) s.highScore = Math.floor(run.score);
      const fresh = Storage.checkUnlocks();
      Storage.save();
      return { newBest, fresh };
    },

    checkUnlocks() {
      const fresh = [];
      for (const p of CH.Balance.heroes) {
        if (!Storage.data.unlocked.includes(p.id) && p.test(Storage.data.stats)) {
          Storage.data.unlocked.push(p.id);
          fresh.push(p);
        }
      }
      return fresh;
    },

    isUnlocked(id) {
      return Storage.data.unlocked.includes(id);
    },
  });
})(window.CH);
