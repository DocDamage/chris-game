/* CHAOS.exe - the Diablo layer (PLAN.md section 4): gear in six slots (helm, chest, legs, boots, ring, gloves) with
   rarities and affixes, an inventory with a Recycle Bin, a consumable belt, ground drops with light beams and labels.
   Items are plain JSON ({ uid, slot, rarity, ilvl, aff: [[id, value]], uniq, set }) so they save and load cleanly.
   Affixes feed the existing stat pipeline through X.statHooks, so every system that reads p.stats sees them. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const G = CH.G;
  const X = CH.X;
  const Up = CH.Upgrades;
  const Audio = CH.Audio;
  const Storage = CH.Storage;
  const wrap = X.wrap;

  const Items = (CH.Items = { ground: [] });
  const SLOTS = (Items.SLOTS = ['helm', 'chest', 'legs', 'boots', 'ring', 'gloves']);
  const SLOT_NAME = (Items.SLOT_NAME = { helm: 'Helm', chest: 'Chest', legs: 'Legs', boots: 'Boots', ring: 'Ring', gloves: 'Gloves' });
  const RARITY = (Items.RARITY = {
    normal: { name: 'Normal', color: '#ffffff', aff: [0, 0], w: 52, sell: 4 },
    magic: { name: 'Magic', color: '#6a9bff', aff: [1, 2], w: 30, sell: 12 },
    rare: { name: 'Rare', color: '#ffe14a', aff: [3, 4], w: 12, sell: 34 },
    legendary: { name: 'Legendary', color: '#ff8a1e', aff: [2, 3], w: 2.2, sell: 120 },
    set: { name: 'Set', color: '#63c74d', aff: [2, 3], w: 1.6, sell: 90 },
  });
  Items.BAG_SIZE = 24;
  Items.STASH_SIZE = 48;

  /* the pack's Equipments art: iron and leather versions per slot (file numbers, see assets/UI/.../Equipments) */
  const ART = {
    iron: { helm: 7, chest: 8, legs: 9, boots: 12, ring: 11, gloves: 10 },
    leather: { helm: 13, chest: 14, legs: 15, boots: 18, ring: 17, gloves: 16 },
    empty: { helm: 1, chest: 2, legs: 3, boots: 6, ring: 5, gloves: 4 },
  };
  Items.artPath = (slot, kind) => '0 - Sprites/Equipments/' + ART[kind || 'iron'][slot] + '.png';

  /* ---------------------------------------------------------------- affixes
     range: [min, max] at item level 1, growing 14% per level. apply(stats, value) writes into p.stats. */
  const AFFIX = (Items.AFFIX = {
    hp: { prefix: 'Sturdy', suffix: 'of Vitality', label: (v) => '+' + v + ' max HP', range: [8, 14], apply: (s, v) => (s.maxHp += v), slots: { helm: 3, chest: 4, legs: 2, boots: 1, ring: 1, gloves: 1 } },
    dmg: { prefix: 'Brutal', suffix: 'of Bonking', label: (v) => '+' + v + '% damage', range: [3, 6], apply: (s, v) => (s.dmgMult *= 1 + v / 100), slots: { helm: 1, chest: 1, legs: 1, boots: 1, ring: 3, gloves: 4 } },
    crit: { prefix: 'Keen', suffix: 'of Precision', label: (v) => '+' + v + '% crit chance', range: [2, 4], apply: (s, v) => (s.critChance += v / 100), slots: { helm: 2, chest: 0, legs: 1, boots: 1, ring: 4, gloves: 3 } },
    speed: { prefix: 'Nimble', suffix: 'of Haste', label: (v) => '+' + v + '% move speed', range: [3, 5], apply: (s, v) => (s.speedMult += v / 100), slots: { helm: 0, chest: 0, legs: 3, boots: 5, ring: 1, gloves: 0 } },
    rate: { prefix: 'Twitchy', suffix: 'of Fury', label: (v) => '+' + v + '% fire rate', range: [3, 6], apply: (s, v) => (s.fireRate *= 1 + v / 100), slots: { helm: 0, chest: 0, legs: 0, boots: 1, ring: 2, gloves: 5 } },
    armor: { prefix: 'Stout', suffix: 'of Warding', label: (v) => v + '% less damage taken', range: [2, 4], apply: (s, v) => (s.dmgReduction *= 1 - v / 100), slots: { helm: 2, chest: 5, legs: 3, boots: 1, ring: 0, gloves: 1 } },
    heal: { prefix: 'Hearty', suffix: 'of Snacking', label: (v) => '+' + v + '% healing', range: [6, 10], apply: (s, v) => (s.healMult += v / 100), slots: { helm: 3, chest: 1, legs: 0, boots: 0, ring: 2, gloves: 0 } },
    luck: { prefix: 'Lucky', suffix: 'of Fortune', label: (v) => '+' + v + '% luck', range: [4, 7], apply: (s, v) => (s.luck += v / 100), slots: { helm: 2, chest: 0, legs: 0, boots: 1, ring: 4, gloves: 1 } },
    coin: { prefix: 'Greedy', suffix: 'of Plunder', label: (v) => '+' + v + '% coins', range: [6, 12], apply: (s, v) => (s.coinMult *= 1 + v / 100), slots: { helm: 1, chest: 0, legs: 1, boots: 2, ring: 3, gloves: 1 } },
    magnet: { prefix: 'Magnetic', suffix: 'of Attraction', label: (v) => '+' + v + ' pickup range', range: [10, 18], apply: (s, v) => (s.magnet += v), slots: { helm: 1, chest: 0, legs: 0, boots: 2, ring: 2, gloves: 2 } },
    reload: { prefix: 'Slick', suffix: 'of Reloading', label: (v) => '+' + v + '% reload speed', range: [4, 8], apply: (s, v) => (s.reloadMult += v / 100), slots: { helm: 0, chest: 0, legs: 0, boots: 0, ring: 1, gloves: 4 } },
    regen: { prefix: 'Mending', suffix: 'of Recovery', label: (v) => '+' + (v / 10).toFixed(1) + ' HP per second', range: [2, 4], apply: (s, v) => (s.regen = (s.regen || 0) + v / 10), slots: { helm: 1, chest: 3, legs: 1, boots: 0, ring: 1, gloves: 0 } },
  });
  const BASES = {
    helm: ['Bucket', 'Hood', 'Cap', 'Helm', 'Crown', 'Pot'],
    chest: ['Vest', 'Tunic', 'Plate', 'Robe', 'Hoodie', 'Apron'],
    legs: ['Pants', 'Greaves', 'Kilt', 'Shorts', 'Leggings', 'Chaps'],
    boots: ['Boots', 'Sandals', 'Sabatons', 'Clogs', 'Sneakers', 'Slippers'],
    ring: ['Ring', 'Band', 'Loop', 'Signet', 'Washer', 'Hoop'],
    gloves: ['Gloves', 'Gauntlets', 'Mitts', 'Wraps', 'Oven Mitts', 'Fists'],
  };
  const QUIRKS = ['Rusty', 'Mildly Cursed', 'Slightly Damp', 'Overpriced', 'Haunted', 'Secondhand', 'Artisanal', 'Unpaid', 'Gluten-Free', 'Suspicious'];

  /* ---------------------------------------------------------------- legendary and set items */
  const UNIQUES = (Items.UNIQUES = {
    snack_ring: { slot: 'ring', name: 'Ring of Eternal Snacking', icon: 'pu.10', aff: [['heal', 20], ['hp', 24]], fx: 'killheal', desc: 'Every kill heals 1 HP.' },
    overkill: { slot: 'gloves', name: 'Gauntlets of Overkill', icon: 'pu.18', aff: [['dmg', 14], ['crit', 8]], fx: 'critboom', desc: 'Critical hits explode.' },
    thorns: { slot: 'chest', name: 'Hedgehog Hoodie', icon: 'pu.99', aff: [['armor', 8], ['hp', 40]], fx: 'thorns', desc: 'Enemies that hurt you take damage back.' },
    greed: { slot: 'helm', name: 'Crown of Mild Greed', icon: 'pu.1', aff: [['coin', 40], ['luck', 14]], fx: 'greed', desc: 'Kills have a chance to spill extra coins.' },
    quicksilver: { slot: 'boots', name: 'Boots of Last Minute', icon: 'pu.265', aff: [['speed', 14], ['rate', 8]], fx: 'sprint', desc: 'Taking a hit grants 2 seconds of haste.' },
    magnetpants: { slot: 'legs', name: 'Pants of Gravity', icon: 'pu.296', aff: [['magnet', 60], ['armor', 6]], fx: 'none', desc: 'Everything on the floor wants to be yours.' },
    vamp: { slot: 'ring', name: 'Leech Loop', icon: 'pu.76', aff: [['dmg', 10], ['regen', 12]], fx: 'lifesteal', desc: 'Critical hits steal a little health.' },
    barrage: { slot: 'gloves', name: 'Mitts of the Barrage', icon: 'pu.11', aff: [['rate', 18], ['reload', 18]], fx: 'none', desc: 'Why reload when you can just shoot more?' },
  });
  const SETS = (Items.SETS = {
    gnome: { name: 'Garden Gnome Regalia', parts: { helm: 'Gnome Cap', chest: 'Gnome Jerkin', boots: 'Gnome Clogs' }, bonus: { 2: [['dmg', 10]], 3: [['proj', 1], ['hp', 30]] } },
    crypt: { name: "Crypt Keeper's Vestments", parts: { ring: 'Keeper Signet', gloves: 'Keeper Gauntlets', legs: 'Keeper Greaves' }, bonus: { 2: [['crit', 6]], 3: [['hp', 40], ['armor', 8]] } },
  });
  AFFIX.proj = { label: (v) => '+' + v + ' projectile', apply: (s, v) => (s.extraProj += v), range: [1, 1], slots: {} };

  /* ---------------------------------------------------------------- rolling */
  const lvlMul = (ilvl) => 1 + 0.14 * (Math.max(1, ilvl) - 1);
  const rollAffix = (id, ilvl, rng) => {
    const a = AFFIX[id];
    return [id, Math.max(1, Math.round((a.range[0] + (a.range[1] - a.range[0]) * rng()) * lvlMul(ilvl)))];
  };
  const uidn = () => Math.floor(Math.random() * 1e9).toString(36) + Date.now().toString(36).slice(-4);

  /* @param {{rarity?: string, slot?: string, luck?: number, boss?: boolean}} [o] */
  Items.roll = function (ilvl, o) {
    o = o || {};
    const rng = o.rng || Math.random;
    const luck = o.luck || 0;
    let rarity = o.rarity;
    if (!rarity) {
      const ws = Object.keys(RARITY).map((k) => [k, RARITY[k].w * (k === 'normal' ? Math.max(0.2, 1 - luck - (o.boss ? 0.8 : 0)) : 1 + luck * (k === 'magic' ? 1 : 3) + (o.boss ? (k === 'normal' ? 0 : 3) : 0))]);
      const tot = ws.reduce((a, w) => a + w[1], 0);
      let r = rng() * tot;
      rarity = 'normal';
      for (const w of ws) { r -= w[1]; if (r <= 0) { rarity = w[0]; break; } }
    }
    let slot = o.slot || SLOTS[Math.floor(rng() * SLOTS.length)];
    const it = { uid: uidn(), slot, rarity, ilvl: Math.max(1, ilvl | 0), aff: [], base: Math.floor(rng() * BASES[slot].length), quirk: Math.floor(rng() * QUIRKS.length) };
    if (rarity === 'legendary') {
      const ids = Object.keys(UNIQUES).filter((k) => !o.slot || UNIQUES[k].slot === o.slot);
      const id = ids[Math.floor(rng() * ids.length)];
      const u = UNIQUES[id];
      it.uniq = id;
      it.slot = slot = u.slot;
      it.aff = u.aff.map(([a, v]) => [a, Math.round(v * (0.9 + 0.1 * Math.min(2, lvlMul(ilvl))))]);
    } else if (rarity === 'set') {
      const sid = Object.keys(SETS)[Math.floor(rng() * Object.keys(SETS).length)];
      const parts = Object.keys(SETS[sid].parts);
      it.set = sid;
      it.slot = slot = parts[Math.floor(rng() * parts.length)];
      const pool = Object.keys(AFFIX).filter((k) => AFFIX[k].slots && AFFIX[k].slots[slot] > 0);
      for (let i = 0; i < 2; i++) { const id = pool.splice(Math.floor(rng() * pool.length), 1)[0]; it.aff.push(rollAffix(id, ilvl, rng)); }
    } else {
      const n = RARITY[rarity].aff[0] + Math.floor(rng() * (RARITY[rarity].aff[1] - RARITY[rarity].aff[0] + 1));
      const pool = [];
      for (const k of Object.keys(AFFIX)) { const w = (AFFIX[k].slots || {})[slot] || 0; for (let i = 0; i < w; i++) pool.push(k); }
      const used = new Set();
      for (let i = 0; i < n; i++) {
        let k, tries = 0;
        do { k = pool[Math.floor(rng() * pool.length)]; } while (used.has(k) && tries++ < 20);
        if (used.has(k)) continue;
        used.add(k);
        it.aff.push(rollAffix(k, ilvl, rng));
      }
    }
    it.name = Items.nameOf(it);
    return it;
  };

  Items.nameOf = (it) => {
    if (it.uniq && UNIQUES[it.uniq]) return UNIQUES[it.uniq].name;
    if (it.set && SETS[it.set]) return SETS[it.set].parts[it.slot] || SETS[it.set].name;
    const base = BASES[it.slot][it.base % BASES[it.slot].length];
    if (it.rarity === 'normal') return QUIRKS[it.quirk % QUIRKS.length] + ' ' + base;
    const pre = it.aff[0] && AFFIX[it.aff[0][0]] && AFFIX[it.aff[0][0]].prefix ? AFFIX[it.aff[0][0]].prefix + ' ' : '';
    const suf = it.aff[1] && AFFIX[it.aff[1][0]] && AFFIX[it.aff[1][0]].suffix ? ' ' + AFFIX[it.aff[1][0]].suffix : '';
    return pre + base + suf;
  };

  /* strict validation, used by the save sanitiser: unknown ids and wild numbers are dropped */
  Items.validate = (it) => {
    if (!it || typeof it !== 'object') return null;
    if (!SLOTS.includes(it.slot) || !RARITY[it.rarity]) return null;
    const out = { uid: String(it.uid || uidn()).slice(0, 24), slot: it.slot, rarity: it.rarity, ilvl: U.clamp(+it.ilvl | 0, 1, 99), aff: [], base: (+it.base | 0) & 15, quirk: (+it.quirk | 0) & 15 };
    for (const a of Array.isArray(it.aff) ? it.aff.slice(0, 6) : []) if (Array.isArray(a) && AFFIX[a[0]] && isFinite(a[1])) out.aff.push([a[0], U.clamp(Math.round(a[1]), 1, 999)]);
    if (it.uniq && UNIQUES[it.uniq]) out.uniq = it.uniq;
    if (it.set && SETS[it.set]) out.set = it.set;
    out.name = Items.nameOf(out);
    return out;
  };

  /* tooltip lines: [{ t, c }] */
  Items.describe = (it) => {
    const R = RARITY[it.rarity];
    const lines = [{ t: it.name || Items.nameOf(it), c: R.color }, { t: R.name + ' ' + SLOT_NAME[it.slot] + '  (item level ' + it.ilvl + ')', c: '#b9b4c8' }];
    for (const [id, v] of it.aff) lines.push({ t: AFFIX[id].label(v), c: '#6a9bff' });
    if (it.uniq) lines.push({ t: UNIQUES[it.uniq].desc, c: '#ff8a1e' });
    if (it.set) { const S = SETS[it.set]; lines.push({ t: S.name, c: '#63c74d' }); for (const k of Object.keys(S.bonus)) lines.push({ t: '(' + k + ') ' + S.bonus[k].map(([a, v]) => AFFIX[a].label(v)).join(', '), c: '#7a9a6a' }); }
    return lines;
  };
  Items.sellValue = (it) => Math.round(RARITY[it.rarity].sell * lvlMul(it.ilvl));

  /* ---------------------------------------------------------------- the player's gear and stats */
  const D = () => {
    const d = Storage.data;
    if (!d.diablo || typeof d.diablo !== 'object') d.diablo = { bag: [], stash: [], equipped: {}, belt: [], tier: 0 };
    return d.diablo;
  };
  Items.data = D;
  Items.equippedOf = (p) => {
    const e = D().equipped;
    const id = (p.hero && p.hero.id) || 'Mercenary';
    if (!e[id]) e[id] = {};
    return e[id];
  };
  const effects = (p) => { const out = []; const e = Items.equippedOf(p); for (const s of SLOTS) if (e[s] && e[s].uniq) out.push(UNIQUES[e[s].uniq].fx); return out; };
  Items.hasFx = (p, fx) => effects(p).includes(fx);

  X.statHooks.push((p, s) => {
    const e = Items.equippedOf(p);
    const sets = {};
    for (const slot of SLOTS) {
      const it = e[slot];
      if (!it) continue;
      for (const [id, v] of it.aff) if (AFFIX[id]) AFFIX[id].apply(s, v);
      if (it.set) sets[it.set] = (sets[it.set] || 0) + 1;
    }
    for (const sid of Object.keys(sets)) for (const k of Object.keys(SETS[sid].bonus)) if (sets[sid] >= +k) for (const [id, v] of SETS[sid].bonus[k]) AFFIX[id].apply(s, v);
    s.regen = s.regen || 0;
  });
  /* regeneration affixes tick here */
  wrap(CH.Player.prototype, 'update', function (orig, g, dt) {
    const r = orig.call(this, g, dt);
    if (!this.dead && this.stats && this.stats.regen > 0 && g.state === 'playing') {
      this._regenAcc = (this._regenAcc || 0) + this.stats.regen * dt;
      if (this._regenAcc >= 1) { const n = Math.floor(this._regenAcc); this._regenAcc -= n; this.hp = Math.min(this.maxHp, this.hp + n); }
    }
    // heal-over-time from food
    if (this.hot && !this.dead) {
      this.hot.t -= dt;
      this._hotAcc = (this._hotAcc || 0) + (this.hot.amt / this.hot.dur) * dt;
      if (this._hotAcc >= 1) { const n = Math.floor(this._hotAcc); this._hotAcc -= n; this.hp = Math.min(this.maxHp, this.hp + n); }
      if (this.hot.t <= 0) this.hot = null;
    }
    return r;
  });

  /* ---------------------------------------------------------------- bag / equip / salvage */
  const bag = () => D().bag;
  Items.bag = bag;
  Items.addToBag = (it) => {
    if (bag().length >= Items.BAG_SIZE) return false;
    bag().push(it);
    Storage.save();
    return true;
  };
  Items.equip = (p, it) => {
    const i = bag().indexOf(it);
    if (i < 0) return false;
    const e = Items.equippedOf(p);
    const old = e[it.slot];
    e[it.slot] = it;
    bag().splice(i, 1);
    if (old) bag().push(old);
    Up.recalc(p);
    Audio.sfx('buy');
    Storage.save();
    return true;
  };
  Items.unequip = (p, slot) => {
    const e = Items.equippedOf(p);
    const it = e[slot];
    if (!it || bag().length >= Items.BAG_SIZE) return false;
    delete e[slot];
    bag().push(it);
    Up.recalc(p);
    Storage.save();
    return true;
  };
  Items.salvage = (it) => {
    const i = bag().indexOf(it);
    if (i < 0) return null;
    bag().splice(i, 1);
    const k = { normal: [1, 0, 0], magic: [2, 1, 0], rare: [3, 0, 2], legendary: [6, 3, 3], set: [5, 2, 3] }[it.rarity];
    const lm = Math.max(1, Math.round(lvlMul(it.ilvl)));
    const got = { scrap: k[0] * lm, wood: k[1] * lm, stone: k[2] * lm };
    for (const r of Object.keys(got)) if (got[r]) Storage.addResource(r, got[r]);
    Audio.sfx('coin');
    Storage.save();
    return got;
  };
  Items.compare = (it, p) => {
    const cur = Items.equippedOf(p)[it.slot];
    const sum = (x) => { const o = {}; if (x) for (const [id, v] of x.aff) o[id] = (o[id] || 0) + v; return o; };
    const a = sum(it), b = sum(cur);
    const out = [];
    for (const id of new Set(Object.keys(a).concat(Object.keys(b)))) {
      const d = (a[id] || 0) - (b[id] || 0);
      if (d) out.push({ id, d, label: AFFIX[id].label(Math.abs(d)).replace(/^\+/, '') });
    }
    return out;
  };

  /* ---------------------------------------------------------------- consumable belt (food heals over time) */
  Items.CONSUMABLES = {
    meat: { name: 'Meat Scraps', pack: 7, desc: 'Heals 30% over 6 seconds.', use: (p) => hot(p, 0.3, 6) },
    steak: { name: 'Prime Steak', pack: 20, desc: 'Heals 60% over 8 seconds.', use: (p) => hot(p, 0.6, 8) },
    egg: { name: 'Golden Egg', pack: 15, desc: 'A 40 point shield and 10% healing.', use: (p) => { hot(p, 0.1, 3); p.buffs.shield = 10; p.shield = Math.max(p.shield || 0, 40); } },
    fish: { name: 'Glow Fish', pack: 16, desc: 'Refills stamina and heals 20% over 5 seconds.', use: (p) => { p.stamina = B.player.stamina; p.exhausted = false; hot(p, 0.2, 5); } },
    candy: { name: 'Sugar Rush', pack: 17, desc: 'Haste for 12 seconds.', use: (p) => { p.buffs.haste = Math.max(p.buffs.haste || 0, 12); Up.recalc(p); } },
    herb: { name: 'Healing Herb', pack: 23, desc: 'Cleanses status effects and heals 15%.', use: (p) => { X.cleanse && X.cleanse(p); hot(p, 0.15, 3); } },
    feather: { name: 'Portal Quill', pack: 13, desc: 'Opens a town portal. Walk in to go to town; walk in again to come back.', use: (p) => CH.Town && CH.Town.openPortal(p) },
    tome: { name: 'Tome of Knowledge', pack: 14, desc: 'A big chunk of experience.', use: (p) => Up.addXp(G, Math.round(B.xp.need(p.level) * 0.7), p) },
  };
  function hot(p, pct, dur) {
    p.hot = { amt: p.maxHp * pct * p.stats.healMult * G.diff.heal, dur, t: dur };
    FX.text(p.x, p.y - 22, 'RECOVERING', '#63c74d', 1);
  }
  Items.belt = (p) => (p.belt || (p.belt = [null, null, null, null]));
  Items.addConsumable = (p, id, n) => {
    const b = Items.belt(p);
    let slot = b.find((s) => s && s.id === id);
    if (!slot) {
      const i = b.findIndex((s) => !s);
      if (i < 0) return false;
      slot = b[i] = { id, n: 0 };
    }
    slot.n += n || 1;
    return true;
  };
  Items.useBelt = (p, i) => {
    const b = Items.belt(p);
    const s = b[i];
    if (!s || s.n <= 0 || p.dead || (p.beltCd || 0) > 0) return false;
    const c = Items.CONSUMABLES[s.id];
    if (!c) return false;
    c.use(p);
    s.n--;
    if (s.n <= 0) b[i] = null;
    p.beltCd = 1.2; // shared cooldown
    Audio.sfx('buy');
    return true;
  };
  wrap(CH.Player.prototype, 'update', function (orig, g, dt) {
    if (this.beltCd > 0) this.beltCd -= dt;
    return orig.call(this, g, dt);
  });
  /* each run starts with a couple of snacks on the belt */
  X.ownerHooks.push((g, p) => {
    p.belt = [null, null, null, null];
    p.hot = null;
    Items.addConsumable(p, 'meat', 2);
  });

  /* ---------------------------------------------------------------- ground drops */
  Items.drop = function (x, y, it) {
    const L = G.level;
    if (L && L.solidAt(x, y)) { const q = L.nearestOpen(x, y); x = q.x; y = q.y; }
    Items.ground.push({ x, y, it, age: 0, vx: U.rand(-40, 40), vy: U.rand(-60, -20), z: 12, vz: 90 });
    if (it.rarity !== 'normal') Audio.sfx(it.rarity === 'legendary' || it.rarity === 'set' ? 'levelup' : 'popup');
  };
  /* the chance an enemy drops gear, rarity weights get the killer's luck */
  Items.dropFrom = function (e, p) {
    if (!e || e.training) return;
    const luck = (p && p.stats && p.stats.luck) || 0;
    const night = G.level && G.level.night ? 0.15 : 0;
    let chance = 0.012 + luck * 0.01;
    let boss = false;
    if (e.isBoss) { chance = 1; boss = true; }
    else if (e.isSpawner) chance = 0.45 + night;
    else if (e.isElite || e.affix) chance = 0.2 + luck * 0.1 + night;
    if (Math.random() > chance + night * 0.05) return;
    const n = boss ? 2 + (Math.random() < 0.5 ? 1 : 0) : 1;
    for (let i = 0; i < n; i++) Items.drop(e.x + U.rand(-14, 14), e.y + U.rand(-10, 10), Items.roll(Math.max(1, G.wave), { luck, boss }));
  };
  wrap(G, 'killEnemy', function (orig, e) {
    const was = e.dead;
    orig.call(G, e);
    if (was) return;
    const p = e.lastHitBy && e.lastHitBy.hero ? e.lastHitBy : G.player;
    Items.dropFrom(e, p);
    for (const q of G.players) {
      if (q.dead) continue;
      if (Items.hasFx(q, 'killheal') && U.dist(q.x, q.y, e.x, e.y) < 240) q.hp = Math.min(q.maxHp, q.hp + 1);
      if (Items.hasFx(q, 'greed') && Math.random() < 0.2) G.addCoins(2 + Math.floor(G.wave / 2), e.x, e.y);
    }
  });
  wrap(G, 'damageEnemy', function (orig, e, dmg, o) {
    const r = orig.call(G, e, dmg, o);
    if (r > 0 && o && o.crit && o.shooter && o.shooter.hero) {
      const p = o.shooter;
      if (Items.hasFx(p, 'critboom') && !o._boom) G.explode(e.x, e.y, 28, Math.round(r * 0.5), { owner: 'p', colors: 'fire', noPlayerHurt: true, shooter: p, _boom: true, lite: true });
      if (Items.hasFx(p, 'lifesteal')) p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.round(r * 0.06)));
    }
    return r;
  });
  X.chain('onHurt', (p, dmg, src) => {
    if (Items.hasFx(p, 'thorns') && src && src.type !== undefined && !src.dead) X.hitEnemy(src, Math.max(4, dmg * 1.2), p, 'phys');
    if (Items.hasFx(p, 'sprint')) { p.buffs.haste = Math.max(p.buffs.haste || 0, 2); Up.recalc(p); }
  });

  Items.update = (dt) => {
    for (let i = Items.ground.length - 1; i >= 0; i--) {
      const g = Items.ground[i];
      g.age += dt;
      if (g.z > 0 || g.vz > 0) {
        g.x += g.vx * dt;
        g.y += g.vy * dt * 0.3;
        g.vz -= 260 * dt;
        g.z += g.vz * dt;
        if (g.z <= 0) { g.z = 0; g.vz = 0; g.vx = g.vy = 0; }
      }
      if (g.age < 0.5) continue;
      for (const p of G.players) {
        if (p.dead) continue;
        if (U.dist(p.x, p.y, g.x, g.y) < 20 + (p.stats ? p.stats.magnet * 0.1 : 0)) {
          if (Items.addToBag(g.it)) {
            Items.ground.splice(i, 1);
            FX.text(g.x, g.y - 16, g.it.name || Items.nameOf(g.it), RARITY[g.it.rarity].color, 1);
            Audio.sfx('pickup');
            if (G.ui && G.ui.toast && (g.it.rarity === 'legendary' || g.it.rarity === 'set')) G.ui.toast('FOUND: ' + g.it.name);
          } else if (!g.fullWarn || g.age - g.fullWarn > 3) { g.fullWarn = g.age; FX.text(p.x, p.y - 24, 'BAG FULL', '#e43b44', 1); }
          break;
        }
      }
    }
  };
  wrap(G, 'step', function (orig, dt) {
    orig.call(G, dt);
    if (G.state === 'playing') Items.update(dt);
  });
  const clear = () => { Items.ground.length = 0; };
  wrap(G, 'newRun', function (orig, c) { clear(); return orig.call(G, c); });
  const origStart = G.startWave;
  G.startWave = function (n) { clear(); return origStart.call(G, n); };

  /* beams and labels, drawn with the world */
  CH.Hooks.world.push((ctx, cam) => {
    if (!Items.ground.length || G.state === 'menu') return;
    const showAll = !!(CH.Input.raw && (CH.Input.raw.AltLeft || CH.Input.raw.AltRight));
    for (const g of Items.ground) {
      const x = Math.round(g.x - cam.x), y = Math.round(g.y - cam.y);
      if (x < -30 || y < -60 || x > B.view.w + 30 || y > B.view.h + 30) continue;
      const R = RARITY[g.it.rarity];
      CH.Enemies.shadow(ctx, x, y + 2, 12);
      if (g.it.rarity !== 'normal') {
        // light beam
        const a = 0.35 + 0.15 * Math.sin(g.age * 4);
        const grd = ctx.createLinearGradient(0, y - 60, 0, y);
        grd.addColorStop(0, 'rgba(255,255,255,0)');
        grd.addColorStop(1, R.color);
        ctx.globalAlpha = a;
        ctx.fillStyle = grd;
        ctx.fillRect(x - 3, y - 60, 6, 60);
        ctx.globalAlpha = 1;
      }
      // the item icon (pack equipment art)
      if (CH.UIK && CH.UIK.on) {
        const kind = g.it.rarity === 'normal' || g.it.rarity === 'magic' ? 'leather' : 'iron';
        CH.UIK.draw(ctx, Items.artPath(g.it.slot, kind), x - 8, y - 8 - g.z, { w: 16, h: 16 });
      } else { ctx.fillStyle = R.color; ctx.fillRect(x - 4, y - 4 - g.z, 8, 8); }
      if (showAll || (g.it.rarity !== 'normal' && g.it.rarity !== 'magic') || g.age < 2.2) CH.Font.draw(ctx, g.it.name || Items.nameOf(g.it), x, y - 16 - g.z, R.color, 1, true, 'center');
    }
  });

  /* gear for sale and for sale-back in the vending machine / vendor: wired in by shop.js when the Shop exists */
  Items.shopGear = (p) => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const it = Items.roll(Math.max(1, G.wave), { rarity: i === 0 ? 'rare' : Math.random() < 0.35 ? 'rare' : 'magic', luck: 0 });
      out.push({ id: 'gear_' + it.uid, name: it.name, desc: Items.describe(it).slice(1).map((l) => l.t).join('\n'), price: Math.round(Items.sellValue(it) * 3.2), gear: it, icon: { gear: it }, rar: it.rarity, use: (q) => { if (!Items.addToBag(it)) { Items.drop(q.x, q.y, it); } }, once: true });
    }
    return out;
  };
})(window.CH);
