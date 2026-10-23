/* CHAOS.exe - meta progression: run stats + summary, achievements, hero mastery, three new heroes, Heat pacts, starting
   loadouts, pets, relics, crafting, safehouse extras, trophy sets, daily runs + leaderboard, history, ghost, challenge
   runs, co-op team moves. UI for all of it lives in extras.js. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const G = CH.G;
  const Up = CH.Upgrades;
  const Storage = CH.Storage;
  const Audio = CH.Audio;
  const X = CH.X;
  const wrap = X.wrap;
  const M = (CH.Meta = {});

  const md = () => {
    const m = X.meta();
    for (const k of ['ach', 'cnt', 'mastery', 'maxedW', 'maxedU', 'loadout', 'petsOwn', 'relics', 'stock', 'armed', 'shp', 'alt', 'skin', 'chal', 'seen', 'board', 'ghost']) if (!m[k] || typeof m[k] !== 'object') m[k] = {};
    if (!Array.isArray(m.history)) m.history = [];
    if (!Array.isArray(m.relicEq)) m.relicEq = [];
    return m;
  };
  M.data = md;
  const heroName = (id) => (B.heroes.find((h) => h.id === id) || { name: id }).name;
  const wname = (id) => (B.weapons[id] && B.weapons[id].name) || id;
  const toast = (t) => G.ui && G.ui.toast && G.ui.toast(t);

  /* ------------------------------------------------------------------ new heroes */
  const NEW_HEROES = [
    { id: 'Enchantress', name: 'Elven Enchantress', hint: 'Win a run', test: (s) => s.wins >= 1, mods: { hp: -5, speed: 0.02, dmg: -0.05, crit: 0 }, special: 'spiritbloom', specialName: 'SPIRIT BLOOM', cooldown: 24, icon: 'ic_multi', blurb: 'Summoner and healer. Passive: a wisp joins you every 8 kills; healing +20%. Q: Spirit Bloom - forest spirits erupt and fight for 8s, and heal nearby allies.' },
    { id: 'Stranger', name: 'The Grinning Stranger', hint: 'Defeat 10 bosses in total', test: (s) => s.bossesDefeated >= 10, mods: { hp: 20, speed: -0.04, dmg: 0, crit: 0 }, special: 'horrorstare', specialName: 'HORROR STARE', cooldown: 26, icon: 'ic_weapon', blurb: 'Fear and control. Passive: barricades are free effigies that taunt enemies; feared kills leave a shadow. Q: Horror Stare - enemies in a cone flee and take +25% damage.' },
    { id: 'Specter', name: 'Neon Specter', hint: 'Reach wave 8', test: (s) => s.highestWave >= 8, mods: { hp: -35, speed: 0.05, dmg: 0.22, crit: 0.15 }, special: 'energyslash', specialName: 'ENERGY SLASH', cooldown: 18, icon: 'ic_crit', blurb: 'Glass-cannon blade dancer. Passive: crit chance builds while you are not hit. Q: Energy Slash - a dash-slash line that always crits.' },
  ];
  for (const h of NEW_HEROES) if (!B.heroes.some((x) => x.id === h.id)) B.heroes.push(h);
  if (CH.Kit && CH.Kit.byHero) Object.assign(CH.Kit.byHero, { Enchantress: 'toxic', Stranger: 'wind', Specter: 'glitch' });
  X.statHooks.push((p, s) => {
    if (p.deadeyeT > 0) {
      s.critChance += 0.5;
      s.fireRate *= 1.4;
    }
  });

  const ringProps = (g, p, n, r, hp) => {
    if (!g.arena || !g.arena.props) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * U.TAU;
      const bx = Math.round(p.x + Math.cos(a) * r);
      const by = Math.round(p.y + Math.sin(a) * r);
      g.arena.props.push({ id: 'prop_barricade_x' + g.arena.props.length, kind: 'barricade', sprite: CH.Sprites.has('obj.barricade1') ? 'obj.barricade1' : 'obj.roadblock', x: bx, y: by, hp, maxHp: hp, cr: 13, cx: 0, cy: -2, solid: true, jumpable: true, elevation: 10, destructible: true, resourceType: 'scrap', resourceAmt: 1, dead: false, shake: 0, bend: 0, rustle: 0 });
      FX.burst && FX.burst(bx, by, { n: 6, colors: ['#6b4a2a', '#d1a964', '#a6b0bf'], speed: 40, life: 0.3 });
    }
  };
  const intern = (p, life) => X.addTurret(p.x + U.rand(-26, 26), p.y + U.rand(-20, 20), { owner: p, life, rate: 0.38, dmg: 8 });

  const MASTERY_AT = [0, 120, 320, 700, 1300];
  M.masteryLevel = (id) => {
    const xp = md().mastery[id] || 0;
    let l = 1;
    for (let i = 0; i < MASTERY_AT.length; i++) if (xp >= MASTERY_AT[i]) l = i + 1;
    return l;
  };
  M.masteryNext = (id) => MASTERY_AT[M.masteryLevel(id)] || null;
  const altOn = (p) => M.masteryLevel(p.hero.id) >= 2 && md().alt[p.hero.id];

  wrap(CH.Player.prototype, 'castEffect', function (orig, g) {
    const p = this;
    const sp = p.hero.special;
    const dm = p.stats.dmgMult;
    if (sp === 'summon') {
      Audio.sfx('special');
      g.shake(4, 0.3);
      FX.ring(p.x, p.y, 6, 70, '#3ccbe6', 0.4);
      for (let i = 0; i < (altOn(p) ? 7 : 5); i++) intern(p, 16);
      FX.text(p.x, p.y - 30, 'INTERNS ASSEMBLE', '#3ccbe6', 1);
      return;
    }
    if (sp === 'fortify') {
      Audio.sfx('special');
      g.shake(5, 0.35);
      ringProps(g, p, altOn(p) ? 8 : 6, 54, 140);
      X.addTurret(p.x + 30, p.y - 20, { owner: p, life: 16, rate: 0.35, dmg: 10 });
      X.addTurret(p.x - 30, p.y - 20, { owner: p, life: 16, rate: 0.35, dmg: 10 });
      p.buffs.shield = 8;
      p.shield = 55;
      FX.text(p.x, p.y - 30, 'FORTIFIED', '#63c74d', 1);
      return;
    }
    if (sp === 'deadeye') {
      Audio.sfx('special');
      p.deadeyeT = altOn(p) ? 7 : 5;
      Up.recalc(p);
      X.slowMo && X.slowMo(1.1);
      FX.ring(p.x, p.y, 6, 60, '#fee761', 0.4);
      FX.text(p.x, p.y - 30, 'DEAD EYE', '#fee761', 1);
      return;
    }
    orig.call(this, g);
    if (!altOn(p)) return;
    if (sp === 'overdrive') {
      p.buffs.haste = (p.buffs.haste || 0) + 3;
      g.clearEnemyProjectiles(p.x, p.y, 110);
    } else if (sp === 'thornnova') g.after(0.25, () => g.explode(p.x, p.y, 70, 60 * dm, { owner: 'p', colors: 'fire', knock: 200, noPlayerHurt: true, shooter: p }));
    else if (sp === 'bloodmoon') g.healPlayer(10 / p.stats.healMult / g.diff.heal, p);
  });
  /* co-op team move: two specials close together trigger a combined super */
  wrap(CH.Player.prototype, 'special', function (orig, g) {
    const before = this.cast;
    const r = orig.call(this, g);
    if (this.cast && !before && g.coop) {
      this._spT = g.time;
      const q = g.players.find((o) => o !== this && !o.dead && o._spT && g.time - o._spT < 1.6 && U.dist(o.x, o.y, this.x, this.y) < 190);
      if (q) {
        const mx = (q.x + this.x) / 2;
        const my = (q.y + this.y) / 2;
        const dm = (this.stats.dmgMult + q.stats.dmgMult) / 2;
        g.after(0.5, () => {
          g.explode(mx, my, 150, 110 * dm, { owner: 'p', colors: 'fire', knock: 360, clearProj: true, big: true, noPlayerHurt: true, shooter: this });
          g.banner('TEAM SUPER!', 'Two specials, one big bang', 1.6);
          for (const o of [this, q]) {
            o.buffs.shield = 4;
            o.shield = 40;
          }
          g.runStat('teamSupers', 1);
        });
        this._spT = q._spT = 0;
      }
    }
    return r;
  });
  /* Stranger: barricades cost nothing */
  wrap(CH.Player.prototype, 'deployBarricade', function (orig, g) {
    const free = X.heroIs(this, 'Stranger');
    if (free) {
      Storage.resources.wood += 2;
      Storage.resources.scrap += 1;
    }
    const r = orig.call(this, g);
    return r;
  });
  G.on('playerUpdate:before', function (ev) {
    const p = ev.p;
    if (p.deadeyeT > 0) {
      p.deadeyeT -= ev.dt;
      if (p.deadeyeT <= 0) Up.recalc(p);
    }
  });

  /* ------------------------------------------------------------------ run stats */
  const rs0 = () => ({ dmgW: {}, dmg: 0, series: [], bucket: 0, c: {}, killedBy: null, deathsBy: {}, ghost: [], sampleT: 0, ghostT: 0 });
  X.rs = rs0();
  const pst = (p) => p.mstat || (p.mstat = { kills: 0, dmg: 0, revives: 0, deaths: 0, hurt: 0, lastBy: null });
  M.pstat = pst;
  G.runStat = (k, n) => {
    n = n === undefined ? 1 : n;
    X.rs.c[k] = (X.rs.c[k] || 0) + n;
    const m = md();
    m.cnt[k] = (m.cnt[k] || 0) + n;
  };
  M.rc = (k) => X.rs.c[k] || 0;
  const srcLabel = (src) => {
    if (!src) return 'a hazard';
    if (src.isBoss) return (B.bosses && B.bosses[src.kind] && B.bosses[src.kind].name) || 'a boss';
    if (src.type && B.enemies[src.type]) return B.enemies[src.type].name || src.type;
    if (typeof src === 'string') return src;
    return 'a hazard';
  };
  wrap(X, 'reset', function (orig) {
    X.rs = rs0();
    return orig.call(X);
  });

  G.on('damageEnemy', function (ev) {
    const e = ev.e, o = ev.o, r = ev.result;
    if (r > 0) {
      const sh = o && o.shooter;
      const label = sh && sh.weapon ? sh.weapon : 'other';
      X.rs.dmgW[label] = (X.rs.dmgW[label] || 0) + r;
      X.rs.dmg += r;
      X.rs.bucket += r;
      if (sh && sh.hero) pst(sh).dmg += r;
      if (e.isBoss) {
        e._dealt = true;
        if (label !== 'baguette') e._nonBag = true;
      }
      if (e.training) M.train.dealt += r;
    }
  });
  G.on('kill', function (e) {
    if (e.training) return;
    const p = e.lastHitBy;
    if (p && p.hero) {
      pst(p).kills++;
      if (X.heroIs(p, 'Enchantress') && ++p.wkills >= 8) {
        p.wkills = 0;
        intern(p, 14);
        FX.text(p.x, p.y - 26, 'NEW INTERN', '#3ccbe6', 1);
      }
    }
    G.runStat('kills', 1);
    if (e.affix) G.runStat('affixKills', 1);
    const sn = md().seen;
    if (!sn.e) sn.e = {};
    if (e.type && !e.isBoss) sn.e[e.type] = (sn.e[e.type] || 0) + 1;
  });
  X.chain('onHurt', (p, dmg, src) => {
    const s = pst(p);
    s.hurt += dmg || 0;
    s.lastBy = srcLabel(src);
  });
  wrap(G, 'killPlayer', function (orig, p) {
    p = p || G.player;
    if (!p || p.dead) return orig.call(G, p);
    if (M.relicOn('secondwind') && !p._sw) {
      p._sw = true;
      p.hp = Math.max(1, Math.round(p.maxHp * 0.4));
      p.invuln = 2;
      FX.text(p.x, p.y - 26, 'SECOND WIND!', '#fee761', 2);
      FX.ring(p.x, p.y, 6, 60, '#fee761', 0.5);
      Audio.sfx('levelup');
      return;
    }
    const s = pst(p);
    s.deaths++;
    const by = s.lastBy || 'a hazard';
    X.rs.killedBy = by;
    X.rs.deathsBy[by] = (X.rs.deathsBy[by] || 0) + 1;
    return orig.call(G, p);
  });
  wrap(G, 'revivePlayer', function (orig, p, frac, by) {
    const was = p && p.dead;
    const r = orig.call(G, p, frac, by);
    if (was && by && by.hero) {
      pst(by).revives++;
      G.runStat('revives', 1);
    }
    return r;
  });
  wrap(G, 'addScore', function (orig, n) {
    return orig.call(G, n * M.scoreMul());
  });

  /* one-second sampler: DPS graph, ghost, achievement ticks, maxed weapon / upgrade records */
  G.on('step', function (dt) {
    if (G.state !== 'playing' || !G.run) return;
    const rs = X.rs;
    rs.sampleT += dt;
    rs.ghostT += dt;
    if (rs.sampleT >= 1) {
      rs.sampleT -= 1;
      rs.series.push(Math.round(rs.bucket));
      rs.bucket = 0;
      if (rs.series.length > 1800) rs.series.shift();
      M.tick();
    }
    if (rs.ghostT >= 5) {
      rs.ghostT -= 5;
      rs.ghost.push(Math.round(G.score));
    }
    M.petsUpdate(dt);
    M.trainUpdate(dt);
    if (X.run.challenge === 'bighead') G.mods.bigHead = true;
  });

  /* ------------------------------------------------------------------ Heat pacts */
  M.PACTS = [
    { id: 'brawn', name: 'Beefy Foes', desc: 'Enemies have +25% HP per rank', heat: 1, max: 3 },
    { id: 'haste', name: 'Caffeinated Foes', desc: 'Enemies move +8% faster per rank', heat: 1, max: 3 },
    { id: 'hurt', name: 'Sharp Edges', desc: 'Enemies hit +20% harder per rank', heat: 1, max: 3 },
    { id: 'frail', name: 'Paper Skin', desc: 'You have -15% max HP per rank', heat: 1, max: 3 },
    { id: 'famine', name: 'Famine', desc: 'Healing is 30% weaker per rank', heat: 1, max: 2 },
    { id: 'horde', name: 'Overstaffed', desc: '+15% more enemies per rank', heat: 2, max: 3 },
    { id: 'titan', name: 'Boss Rage', desc: 'Bosses have +20% HP per rank', heat: 2, max: 3 },
    { id: 'stingy', name: 'No Take-Backs', desc: '-1 reroll and -1 banish per rank', heat: 1, max: 2 },
  ];
  const heatObj = () => (X.run && X.run.heat && !Array.isArray(X.run.heat) ? X.run.heat : {});
  const rank = (id) => heatObj()[id] || 0;
  M.heatTotal = (h) => {
    let t = 0;
    const o = h || heatObj();
    for (const d of M.PACTS) t += (o[d.id] || 0) * d.heat;
    return t;
  };
  M.scoreMul = () => (G.state === 'menu' || !X.run ? 1 : 1 + 0.1 * M.heatTotal());
  wrap(G, 'spawnEnemy', function (orig, type, x, y, o) {
    const e = orig.call(G, type, x, y, o);
    if (e && X.run.heat && !e.training) {
      const f = 1 + 0.25 * rank('brawn') + (e.isBoss ? 0.2 * rank('titan') : 0);
      if (f !== 1) {
        e.hp *= f;
        e.maxHp *= f;
      }
    }
    return e;
  });
  wrap(G, 'buildQueue', function (orig, w) {
    if (X.run.mode === 'training') return [];
    const q = orig.call(G, w);
    const r = rank('horde');
    if (r && q.length) {
      const extra = Math.round(q.length * 0.15 * r);
      for (let i = 0; i < extra; i++) q.push(Object.assign({}, U.pick(q)));
    }
    return q;
  });

  /* ------------------------------------------------------------------ relics (vendor) */
  M.RELICS = [
    { id: 'ironheart', name: 'Iron Heart', desc: '+20 max HP', cost: { scrap: 15, stone: 8 }, stat: (p, s) => (s.maxHp += 20) },
    { id: 'quickhands', name: 'Quick Hands', desc: '+8% fire rate', cost: { scrap: 18, wood: 8 }, stat: (p, s) => (s.fireRate *= 1.08) },
    { id: 'clover', name: 'Pocket Clover', desc: '+20% luck', cost: { scrap: 20, stone: 10 }, stat: (p, s) => (s.luck += 0.2) },
    { id: 'magnet', name: 'Fridge Magnet', desc: '+40 pickup range', cost: { wood: 10, scrap: 10 }, stat: (p, s) => (s.magnet += 40) },
    { id: 'taxman', name: 'Tax Haven', desc: '+15% coins', cost: { scrap: 25, wood: 15 }, stat: (p, s) => (s.coinMult *= 1.15) },
    { id: 'secondwind', name: 'Second Wind', desc: 'Once per run, survive a killing blow at 40% HP', cost: { scrap: 40, stone: 30, wood: 20 } },
  ];
  const RELIC_BY = {};
  for (const r of M.RELICS) RELIC_BY[r.id] = r;
  M.relicOn = (id) => md().relicEq.includes(id) && !!md().relics[id] && X.run.mode !== 'training';
  M.relicSlots = () => 1 + (M.safeLv('vendor') >= 1 ? 1 : 0);

  /* ------------------------------------------------------------------ crafting (pre-run consumables) */
  M.CRAFT = [
    { id: 'shield', name: 'Pocket Shield', desc: 'Start the run with a 50 point shield', cost: { wood: 6, scrap: 4 } },
    { id: 'nade', name: 'Spare Grenade', desc: 'Start with +1 grenade charge', cost: { scrap: 6, stone: 2 } },
    { id: 'reroll', name: 'Lucky Coin', desc: 'Start with +2 rerolls and +1 banish', cost: { stone: 4, scrap: 3 } },
    { id: 'medkit', name: 'Medkit', desc: 'Start with +25 max HP', cost: { wood: 4, scrap: 4 } },
  ];
  M.canPay = (cost) => Object.keys(cost).every((k) => (Storage.resources[k] || 0) >= cost[k]);
  M.pay = (cost) => {
    if (!M.canPay(cost)) return false;
    for (const k of Object.keys(cost)) Storage.resources[k] -= cost[k];
    Storage.save();
    return true;
  };
  M.craft = (id) => {
    const d = M.CRAFT.find((c) => c.id === id);
    if (!d || !M.safeLv('craft') || !M.pay(d.cost)) return false;
    md().stock[id] = (md().stock[id] || 0) + 1;
    md().armed[id] = true;
    Storage.save();
    return true;
  };

  /* ------------------------------------------------------------------ safehouse extras */
  M.SAFE = [
    { id: 'kennel', name: 'Pet Kennel', max: 3, desc: ['Lets one companion join your runs', 'Pets are 35% stronger', 'Pets are 70% stronger'], costs: [{ wood: 15, scrap: 10 }, { wood: 30, scrap: 25, stone: 10 }, { wood: 60, scrap: 50, stone: 30 }] },
    { id: 'planning', name: 'Planning Table', max: 3, desc: ['+1 reroll, banish and skip per run', '+2 of each', '+3 of each'], costs: [{ scrap: 12, stone: 8 }, { scrap: 30, stone: 20 }, { scrap: 60, stone: 40 }] },
    { id: 'vendor', name: 'Relic Vendor', max: 1, desc: ['Sells permanent relics, and a second relic slot'], costs: [{ wood: 20, stone: 20, scrap: 20 }] },
    { id: 'dummy', name: 'Training Dummy Room', max: 1, desc: ['A DPS test room with every weapon'], costs: [{ wood: 10, scrap: 10 }] },
    { id: 'craft', name: 'Crafting Bench', max: 1, desc: ['Craft one-run consumables from resources'], costs: [{ wood: 8, scrap: 8 }] },
  ];
  M.safeLv = (id) => md().shp[id] || 0;
  M.buySafe = (id) => {
    const d = M.SAFE.find((x) => x.id === id);
    const lv = M.safeLv(id);
    if (!d || lv >= d.max || !M.pay(d.costs[lv])) return false;
    md().shp[id] = lv + 1;
    Storage.save();
    return true;
  };
  M.buyRelic = (id) => {
    const r = RELIC_BY[id];
    if (!r || md().relics[id] || M.safeLv('vendor') < 1 || !M.pay(r.cost)) return false;
    md().relics[id] = 1;
    Storage.save();
    return true;
  };
  M.toggleRelic = (id) => {
    const m = md();
    if (!m.relics[id]) return false;
    const i = m.relicEq.indexOf(id);
    if (i >= 0) m.relicEq.splice(i, 1);
    else {
      m.relicEq.push(id);
      while (m.relicEq.length > M.relicSlots()) m.relicEq.shift();
    }
    Storage.save();
    return true;
  };
  M.rrBonus = () => {
    const l = M.safeLv('planning');
    return { reroll: l, banish: l, skip: l };
  };

  /* ------------------------------------------------------------------ pets */
  M.PETS = [
    { id: 'slime', name: 'Goo the Slime', at: 0.1, desc: 'Fetches coins to you', col: '#63c74d' },
    { id: 'wisp', name: 'Zap Wisp', at: 0.25, desc: 'Zaps the nearest enemy', col: '#3ccbe6' },
    { id: 'drone', name: 'Roomba Jr.', at: 0.45, desc: 'Vacuums every pickup and shoots', col: '#a6b0bf' },
    { id: 'ember', name: 'Ember Pup', at: 0.65, desc: 'Burns enemies that get close', col: '#feae34' },
  ];
  M.petUnlocked = (id) => {
    const d = M.PETS.find((x) => x.id === id);
    return !!d && (CH.Loot.progress() >= d.at || !!md().petsOwn[id]);
  };
  M.petPower = () => 1 + 0.35 * Math.max(0, M.safeLv('kennel') - 1);
  M.pets = [];
  M.petsReset = () => {
    M.pets = [];
    const id = md().pet;
    if (!id || M.safeLv('kennel') < 1 || !M.petUnlocked(id) || X.run.mode === 'tutorial') return;
    for (const p of G.players) M.pets.push({ id, owner: p, x: p.x, y: p.y, t: Math.random() * 6, zap: 1 });
  };
  M.petsUpdate = (dt) => {
    const pw = M.petPower();
    for (const pt of M.pets) {
      const o = pt.owner;
      if (o.dead) continue;
      pt.t += dt;
      const tx = o.x + Math.cos(pt.t * 1.6) * 22;
      const ty = o.y - 12 + Math.sin(pt.t * 2.1) * 8;
      const k = Math.min(1, dt * 5);
      pt.x += (tx - pt.x) * k;
      pt.y += (ty - pt.y) * k;
      if (pt.id === 'slime' || pt.id === 'drone') {
        const R = pt.id === 'drone' ? 110 * pw : 80 * pw;
        for (const pk of G.pickups) {
          if (pk.dead || (pt.id === 'slime' && pk.type !== 'coin')) continue;
          if (U.dist(pk.x, pk.y, pt.x, pt.y) < R) {
            const a = Math.atan2(o.y - pk.y, o.x - pk.x);
            pk.x += Math.cos(a) * 190 * dt;
            pk.y += Math.sin(a) * 190 * dt;
          }
        }
      }
      pt.zap -= dt;
      if (pt.zap > 0) continue;
      if (pt.id === 'wisp') {
        const e = X.nearestEnemy(pt.x, pt.y, 120 * pw);
        if (e) {
          pt.zap = 1.5 / pw;
          X.beam && X.beam(pt.x, pt.y, e.x, e.y, '#3ccbe6', 0.12);
          X.hitEnemy(e, 11 * pw * o.stats.dmgMult, o, 'elec');
        }
      } else if (pt.id === 'drone') {
        const e = X.nearestEnemy(pt.x, pt.y, 110);
        if (e) {
          pt.zap = 1.1 / pw;
          X.beam && X.beam(pt.x, pt.y, e.x, e.y, '#a6b0bf', 0.08);
          X.hitEnemy(e, 8 * pw * o.stats.dmgMult, o, 'junk');
        }
      } else if (pt.id === 'ember') {
        pt.zap = 0.5;
        for (const e of G.enemies) if (!e.dead && U.dist(e.x, e.y, pt.x, pt.y) < 38 * pw) X.hitEnemy(e, 4 * pw * o.stats.dmgMult, o, 'fire');
      }
    }
  };
  CH.Hooks.world.push((ctx, cam) => {
    if (G.state === 'menu' || !G.run) return;
    for (const p of G.players) {
      const sk = md().skin[p.hero.id];
      if (sk && M.masteryLevel(p.hero.id) >= 3 && !p.dead) {
        ctx.globalAlpha = 0.55;
        FX.circleOutline(ctx, Math.round(p.x - cam.x), Math.round(p.y - cam.y + 12), 11, sk);
        ctx.globalAlpha = 1;
      }
    }
    for (const pt of M.pets) {
      if (pt.owner.dead) continue;
      const d = M.PETS.find((x) => x.id === pt.id);
      const x = Math.round(pt.x - cam.x);
      const y = Math.round(pt.y - cam.y + Math.sin(pt.t * 6) * 1.5);
      ctx.fillStyle = '#1b1226';
      ctx.fillRect(x - 4, y - 4, 9, 8);
      ctx.fillStyle = d.col;
      ctx.fillRect(x - 3, y - 3, 7, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 2, y - 2, 2, 2);
      ctx.fillRect(x + 1, y - 2, 2, 2);
    }
  });

  /* ------------------------------------------------------------------ trophy sets */
  M.setThemes = () => Object.keys(CH.Loot.THEMES);
  M.setItems = (t) => CH.Loot.items.filter((it) => it.themes && it.themes[0] === t);
  M.setProgress = (t) => {
    const items = M.setItems(t);
    return { have: items.filter((it) => Storage.data.seen[it.id] || (Storage.data.loot && Storage.data.loot[it.id])).length, total: items.length };
  };
  const SET_BONUS = {
    s: { text: '+25% healing', stat: (s) => (s.healMult *= 1.25) },
    p: { text: '+30 max HP', stat: (s) => (s.maxHp += 30) },
    a: { text: '+8% crit chance', stat: (s) => (s.critChance += 0.08) },
    b: { text: '+12% damage', stat: (s) => (s.dmgMult *= 1.12) },
    v: { text: '+10% move speed', stat: (s) => (s.speedMult *= 1.1) },
    f: { text: '+20% explosion size', stat: (s) => (s.explMult *= 1.2) },
    i: { text: '+10% damage resistance', stat: (s) => (s.dmgReduction *= 0.9) },
    g: { text: '+25% coins', stat: (s) => (s.coinMult *= 1.25) },
    r: { text: '+35 pickup range', stat: (s) => (s.magnet += 35) },
    m: { text: '+10% fire rate', stat: (s) => (s.fireRate *= 1.1) },
    c: { text: '+12% luck', stat: (s) => (s.luck += 0.12) },
    x: { text: '+15% luck', stat: (s) => (s.luck += 0.15) },
    u: { text: '+12% reload speed', stat: (s) => (s.reloadMult *= 1.12) },
  };
  M.SET_BONUS = SET_BONUS;
  let setCache = { n: -1, list: [] };
  M.setsDone = () => {
    const n = CH.Loot.discovered();
    if (setCache.n !== n) {
      setCache = {
        n,
        list: M.setThemes().filter((t) => {
          const p = M.setProgress(t);
          return p.total > 0 && p.have >= p.total;
        }),
      };
    }
    return setCache.list;
  };

  X.statHooks.push((p, s) => {
    if (M.masteryLevel(p.hero.id) >= 5) s.hpMul *= 1.1;
    const fr = rank('frail');
    if (fr) s.hpMul *= 1 - 0.15 * fr;
    const fm = rank('famine');
    if (fm) s.healMult = Math.max(0.1, s.healMult * (1 - 0.3 * fm));
    if (p._medkit) s.maxHp += 25;
    if (X.run.mode !== 'training') {
      for (const id of md().relicEq) {
        const r = RELIC_BY[id];
        if (r && r.stat && md().relics[id]) r.stat(p, s);
      }
    }
    for (const t of M.setsDone()) if (SET_BONUS[t]) SET_BONUS[t].stat(s);
  });

  /* ------------------------------------------------------------------ achievements */
  const A = (id, name, desc, on, test) => ({ id, name, desc, on, test });
  const lifetime = (k) => md().cnt[k] || 0;
  M.ACH = [
    A('hundred', 'Warming Up', 'Defeat 100 enemies in one run', 'tick', () => G.kills >= 100),
    A('baguette', 'Only Baguette', 'Beat a boss using only the Baguette', 'boss', (b) => !b._nonBag && b._dealt),
    A('chaoswin', 'Chaos Champion', 'Win a run on Chaotic', 'run', (w) => w && Storage.settings.difficulty === 'chaotic'),
    A('env100', 'Hazard Pay', 'Kill 100 enemies with environmental hazards', 'tick', () => lifetime('envKills') >= 100),
    A('dodge50', 'Dancing Master', 'Land 50 perfect dodges', 'tick', () => lifetime('perfectDodges') >= 50),
    A('nohit', 'Untouchable', 'Defeat a boss without being hit', 'tick', () => lifetime('noHitBosses') >= 1),
    A('evolved', 'Evolution', 'Evolve a weapon', 'tick', () => G.players.some((p) => p.evo && Object.keys(p.evo).some((k) => p.evo[k]))),
    A('cursed3', 'Cursed Collector', 'Take 3 cursed cards in one run', 'tick', () => G.players.some((p) => X.perkList.filter((d) => d.cat === 'cursed' && X.perk(p, d.id) > 0).length >= 3)),
    A('rich', 'Fat Wallet', 'Earn 1000 coins in a single run', 'tick', () => (G.coinsEarned || 0) >= 1000),
    A('marathon', 'Marathoner', 'Win a Marathon run', 'run', (w) => w && X.run.mode === 'marathon'),
    A('quick', 'Quick Fix', 'Win a Quick Run', 'run', (w) => w && X.run.mode === 'short'),
    A('rush', 'Rush Hour', 'Win a Boss Rush', 'run', (w) => w && X.run.mode === 'rush'),
    A('bosses22', 'Boss Slayer', 'Defeat 22 bosses in total', 'tick', () => Storage.stats.bossesDefeated >= 22),
    A('pets3', 'Pet Lover', 'Unlock 3 pets', 'tick', () => M.PETS.filter((p) => M.petUnlocked(p.id)).length >= 3),
    A('combo', 'Combo King', 'Reach the top combo tier', 'tick', () => X.comboTier >= 3),
    A('elite25', 'Elite Hunter', 'Defeat 25 affixed elites', 'tick', () => lifetime('affixKills') >= 25),
    A('obj5', 'Contractor', 'Complete 5 wave objectives', 'tick', () => lifetime('objectives') >= 5),
    A('mini10', 'Giant Killer', 'Defeat 10 mini-bosses', 'tick', () => lifetime('miniBosses') >= 10),
    A('shop10', 'Shopaholic', 'Buy 10 shop items', 'tick', () => lifetime('shopBuys') >= 10),
    A('daily', 'Daily Driver', 'Finish a daily run', 'run', () => !!X.run.daily),
    A('heat5', 'Heat Seeker', 'Win with Heat 5 or more', 'run', (w) => w && M.heatTotal() >= 5),
    A('fullset', 'Completionist', 'Complete a trophy set', 'tick', () => M.setsDone().length >= 1),
    A('coopwin', 'Better Together', 'Win a run in co-op', 'run', (w) => w && G.coop),
    A('train', 'Dummy Basher', 'Reach 150 DPS in the training room', 'tick', () => (md().trainBest || 0) >= 150),
    A('mastery3', 'Specialist', 'Reach mastery level 3 with any hero', 'tick', () => B.heroes.some((h) => M.masteryLevel(h.id) >= 3)),
    A('challenge', 'Self-Imposed', 'Win a challenge run', 'run', (w) => w && !!X.run.challenge),
    A('teamplay', 'Team Player', 'Trigger a Team Super in co-op', 'tick', () => lifetime('teamSupers') >= 1),
  ];
  M.achDone = () => M.ACH.filter((a) => md().ach[a.id]).length;
  M.emit = (type, arg) => {
    const m = md();
    let any = false;
    for (const a of M.ACH) {
      if (m.ach[a.id] || a.on !== type) continue;
      let ok = false;
      try {
        ok = !!a.test(arg);
      } catch (e) {
        ok = false;
      }
      if (ok) {
        m.ach[a.id] = Date.now();
        any = true;
        Audio.sfx('levelup');
        toast('ACHIEVEMENT: ' + a.name.toUpperCase());
      }
    }
    if (any) Storage.save();
  };
  M.tick = () => {
    const m = md();
    for (const p of G.players) {
      for (const id of p.weapons || []) if (p.ws[id] && p.ws[id].level >= B.weaponMaxLevel) m.maxedW[id] = 1;
      for (const k of Object.keys(p.upgrades || {})) if (Up.MAX_LEVELS[k] && p.upgrades[k] >= Up.MAX_LEVELS[k]) m.maxedU[k] = 1;
    }
    M.emit('tick');
  };
  wrap(G, 'onBossDefeated', function (orig, b) {
    const r = orig.call(G, b);
    const sn = md().seen;
    if (!sn.b) sn.b = {};
    if (b && b.kind) sn.b[b.kind] = (sn.b[b.kind] || 0) + 1;
    M.emit('boss', b);
    return r;
  });

  /* ------------------------------------------------------------------ run setup: loadouts, heat, challenges, daily */
  M.dailyKey = (d) => {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  M.hash = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  M.dailySetup = (key) => {
    key = key || M.dailyKey();
    const seed = M.hash('chaos-' + key);
    const r = U.seeded(seed);
    const hero = B.heroes[Math.floor(r() * 3)].id;
    const pool = M.PACTS.slice();
    const heat = {};
    for (let i = 0; i < 2; i++) heat[pool.splice(Math.floor(r() * pool.length), 1)[0].id] = 1;
    const mode = ['classic', 'classic', 'short', 'marathon'][Math.floor(r() * 4)];
    return { mode, seed, daily: key, hero, heat };
  };
  M.CHALLENGES = [
    { id: 'oneweapon', name: 'One Weapon Only', desc: 'You cannot pick up any other weapon.' },
    { id: 'nododge', name: 'No Dodge', desc: 'The dodge roll is disabled.' },
    { id: 'bighead', name: 'Big Head Forever', desc: 'Permanent Big Head Mode.' },
    { id: 'events20', name: 'Chaos Every 20s', desc: 'A chaos event fires every 20 seconds.' },
  ];
  let swapped = null;
  X.onRunSetup = (run) => {
    swapped = null;
    if (run.hero && Storage.settings.hero !== run.hero) {
      swapped = Storage.settings.hero;
      Storage.settings.hero = run.hero;
    }
  };
  G.on('newRun', function () {
    if (swapped) Storage.settings.hero = swapped;
    swapped = null;
    M.petsReset();
    M.train = { dealt: 0, hist: [], dps: 0, t: 0, dummy: null };
  });
  X.ownerHooks.push((g, p) => {
    const m = md();
    const run = X.run;
    p.deadeyeT = 0;
    p.wkills = 0;
    p._sw = false;
    p._medkit = false;
    X.extraEnemySpeed = 1 + 0.08 * rank('haste');
    X.enemyDmgMul = 1 + 0.2 * rank('hurt');
    const tight = rank('stingy');
    if (tight && p.rr) {
      p.rr.reroll = Math.max(0, p.rr.reroll - tight);
      p.rr.banish = Math.max(0, p.rr.banish - tight);
    }
    if (run.mode === 'training') {
      for (const id of Object.keys(B.weapons)) if (!p.weapons.includes(id) && !B.weapons[id].sig) p.addWeapon(id); // not the other heroes' own weapons
      for (const id of p.weapons) if (p.ws[id]) p.ws[id].level = B.weaponMaxLevel;
      Up.recalc(p);
      p.hp = p.maxHp;
      return;
    }
    if (run.mode === 'tutorial') return;
    const lo = run.loadout || m.loadout;
    if (lo && lo.weapon && B.weapons[lo.weapon] && m.maxedW[lo.weapon] && !p.weapons.includes(lo.weapon)) {
      p.addWeapon(lo.weapon);
      if (p.ws[lo.weapon] && M.masteryLevel(p.hero.id) >= 4) p.ws[lo.weapon].level = 2;
    }
    if (lo && lo.upgrade && Up.byId[lo.upgrade] && m.maxedU[lo.upgrade]) p.upgrades[lo.upgrade] = Math.max(p.upgrades[lo.upgrade] || 0, 1);
    for (const c of M.CRAFT) {
      if (!m.armed[c.id] || !(m.stock[c.id] > 0)) continue;
      if (c.id === 'shield') {
        p.buffs.shield = 40;
        p.shield = 50;
      } else if (c.id === 'nade') p.nades = (p.nades || 0) + 1;
      else if (c.id === 'reroll' && p.rr) {
        p.rr.reroll += 2;
        p.rr.banish += 1;
      } else if (c.id === 'medkit') p._medkit = true;
    }
    Up.recalc(p);
    p.hp = p.maxHp;
  });
  /* consumables are spent once per run, after every player received them */
  G.on('newRun', function () {
    const m = md();
    if (X.run.mode !== 'training' && X.run.mode !== 'tutorial') {
      let used = false;
      for (const c of M.CRAFT) {
        if (m.armed[c.id] && m.stock[c.id] > 0) {
          m.stock[c.id]--;
          used = true;
          if (m.stock[c.id] <= 0) m.armed[c.id] = false;
        }
      }
      if (used) Storage.save();
    }
  });

  /* challenges */
  wrap(CH.Player.prototype, 'addWeapon', function (orig, id) {
    if (X.run && X.run.challenge === 'oneweapon' && this.weapons && this.weapons.length >= 1 && !this.weapons.includes(id)) return;
    return orig.call(this, id);
  });
  wrap(CH.Player.prototype, 'startRoll', function (orig, ...a) {
    if (X.run && X.run.challenge === 'nododge') return;
    return orig.apply(this, a);
  });
  if (CH.Events && CH.Events.nextGap) {
    wrap(CH.Events, 'nextGap', function (orig, ...a) {
      const r = orig.apply(CH.Events, a);
      return X.run && X.run.challenge === 'events20' && G.state !== 'menu' ? 20 : r;
    });
  }

  /* ------------------------------------------------------------------ training room */
  M.train = { dealt: 0, hist: [], dps: 0, t: 0, dummy: null };
  M.trainUpdate = (dt) => {
    if (X.run.mode !== 'training') return;
    const T = M.train;
    if (G.waveState === 'intro') G.waveT = Math.min(G.waveT, 0.05);
    if (G.waveState === 'combat' && (!T.dummy || T.dummy.dead || !G.enemies.includes(T.dummy))) {
      const c = G.partyCenter();
      const e = G.spawnEnemy('trashcan', c.x + 120, c.y, {});
      if (e) {
        e.hp = e.maxHp = 1e9;
        e.speed = 0;
        e.training = true;
        T.dummy = e;
      }
    }
    T.t += dt;
    if (T.t >= 0.5) {
      T.hist.push(T.dealt);
      T.dealt = 0;
      T.t -= 0.5;
      if (T.hist.length > 12) T.hist.shift();
      T.dps = Math.round(T.hist.reduce((a, b) => a + b, 0) / (T.hist.length * 0.5)) || 0;
      if (T.dps > (md().trainBest || 0)) md().trainBest = T.dps;
    }
  };
  wrap(G, 'waveComplete', function (orig) {
    if (X.run.mode === 'training') return;
    return orig.call(G);
  });
  G.on('hurtPlayer:before', function (ev) {
    if (X.run.mode === 'training') { ev.stop = true; ev.result = 0; } // nothing hurts in training
  });

  const ghostKey = () => (X.run.daily ? 'daily' : X.run.mode || 'classic') + '|' + (G.coop ? 'co' : 'solo');
  M.ghostKey = ghostKey;
  CH.Hooks.screen.push((ctx) => {
    if (G.state !== 'playing' || !G.run) return;
    if (X.run.mode === 'training') {
      CH.Font.draw(ctx, 'TRAINING ROOM  -  DPS ' + M.train.dps + '   BEST ' + (md().trainBest || 0), 240, 30, '#fee761', 1, true, 'center');
      CH.Font.draw(ctx, 'Pause to leave', 240, 39, '#b9b4c8', 1, true, 'center');
    }
    const gh = md().ghost[ghostKey()];
    if (gh && gh.series && gh.series.length && X.opts().showGhost !== false) {
      const i = Math.min(gh.series.length - 1, Math.floor(X.rs.ghost.length ? X.rs.ghost.length - 1 : 0));
      const diff = Math.round(G.score - gh.series[Math.max(0, i)]);
      CH.Font.draw(ctx, 'GHOST ' + (diff >= 0 ? '+' : '') + diff, 474, 14, diff >= 0 ? '#63c74d' : '#e43b44', 1, true, 'right');
    }
  });

  /* ------------------------------------------------------------------ ghost, history, board, mastery */
  M.endRun = (win) => {
    if (!G.run || G.time < 3 || X.run.mode === 'training' || X.run.mode === 'tutorial') return;
    if (G.run.metaDone) return;
    G.run.metaDone = true;
    const m = md();
    const rs = X.rs;
    const e = {
      t: Date.now(),
      hero: G.players.map((p) => heroName(p.hero.id)).join(' + '),
      mode: X.run.daily ? 'DAILY' : (X.MODES[X.run.mode] || { name: X.run.mode }).name || X.run.mode,
      diff: Storage.settings.difficulty,
      wave: G.wave,
      score: Math.floor(G.score),
      kills: G.kills,
      time: Math.round(G.time),
      win: !!win,
      heat: M.heatTotal(),
      challenge: X.run.challenge || '',
      by: win ? '' : rs.killedBy || '',
      coop: !!G.coop,
    };
    m.history.unshift(e);
    m.history.length = Math.min(m.history.length, 40);
    for (const p of G.players) {
      const gain = G.wave * 8 + G.bossKills * 30 + (win ? 120 : 0);
      const before = M.masteryLevel(p.hero.id);
      m.mastery[p.hero.id] = (m.mastery[p.hero.id] || 0) + gain;
      if (M.masteryLevel(p.hero.id) > before) toast(heroName(p.hero.id).toUpperCase() + ' MASTERY ' + M.masteryLevel(p.hero.id) + '!');
    }
    const k = ghostKey();
    if (!m.ghost[k] || e.score > m.ghost[k].score) m.ghost[k] = { score: e.score, series: rs.ghost.slice(0, 400) };
    const bk = X.run.daily ? 'd:' + X.run.daily : X.run.seedLabel ? 's:' + X.run.seedLabel : null;
    if (bk) {
      const list = m.board[bk] || (m.board[bk] = []);
      list.push({ score: e.score, hero: e.hero, wave: e.wave, win: e.win, t: e.t });
      list.sort((a, b) => b.score - a.score);
      list.length = Math.min(list.length, 5);
      const keys = Object.keys(m.board);
      if (keys.length > 40) delete m.board[keys.sort()[0]];
    }
    if (win && X.run.challenge) m.chal[X.run.challenge] = (m.chal[X.run.challenge] || 0) + 1;
    M.emit('run', win);
    Storage.save();
  };
  wrap(G, 'finishRun', function (orig, win) {
    if (X.run.mode === 'training' || X.run.mode === 'tutorial') return;
    const r = orig.call(G, win);
    try {
      M.endRun(win);
    } catch (e) {
      CH.errors.push(String((e && e.stack) || e));
    }
    return r;
  });

  /* ------------------------------------------------------------------ run summary */
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  M.esc = esc;
  M.dpsGraph = () => {
    const s = X.rs.series;
    const cv = document.createElement('canvas');
    cv.width = 360;
    cv.height = 80;
    const c = cv.getContext('2d');
    c.fillStyle = '#1b1226';
    c.fillRect(0, 0, 360, 80);
    if (s.length > 1) {
      const sm = s.map((_, i) => {
        let a = 0;
        let n = 0;
        for (let j = Math.max(0, i - 3); j <= i; j++) {
          a += s[j];
          n++;
        }
        return a / n;
      });
      const mx = Math.max(10, ...sm);
      c.strokeStyle = '#feae34';
      c.lineWidth = 2;
      c.beginPath();
      sm.forEach((v, i) => {
        const x = (i / (sm.length - 1)) * 352 + 4;
        const y = 74 - (v / mx) * 66;
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      });
      c.stroke();
      c.fillStyle = '#b9b4c8';
      c.font = '10px monospace';
      c.fillText('peak ' + Math.round(mx) + ' DPS', 6, 12);
    }
    return cv.toDataURL();
  };
  M.summaryHTML = () => {
    const rs = X.rs;
    const rows = Object.keys(rs.dmgW).sort((a, b) => rs.dmgW[b] - rs.dmgW[a]);
    const tot = Math.max(1, rs.dmg);
    let h = '<h3>DAMAGE BY WEAPON</h3>';
    if (!rows.length) h += '<div class="hint">No damage recorded.</div>';
    for (const k of rows.slice(0, 8)) {
      const pc = Math.round((rs.dmgW[k] / tot) * 100);
      h += `<div class="xt-bar"><span>${esc(k === 'other' ? 'Traps, turrets & more' : wname(k))}</span><i style="width:${Math.max(2, pc)}%"></i><b>${U.fmtNum(Math.round(rs.dmgW[k]))} (${pc}%)</b></div>`;
    }
    h += '<h3>DAMAGE OVER TIME</h3><img class="xt-graph" alt="DPS graph" src="' + M.dpsGraph() + '">';
    h += '<h3>RUN FACTS</h3><div class="hint">' + (rs.killedBy ? 'Killed by: <b>' + esc(rs.killedBy) + '</b><br>' : '') +
      'Perfect dodges: ' + M.rc('perfectDodges') + ' &middot; Environmental kills: ' + M.rc('envKills') + ' &middot; Objectives: ' + M.rc('objectives') + ' &middot; Mini-bosses: ' + M.rc('miniBosses') + ' &middot; No-hit bosses: ' + M.rc('noHitBosses') + '</div>';
    if (G.players.length > 1) {
      h += '<h3>CO-OP SCOREBOARD</h3><table class="xt-table"><tr><td></td><td>KILLS</td><td>DAMAGE</td><td>REVIVES</td><td>DEATHS</td></tr>';
      const best = (f) => Math.max(...G.players.map((p) => pst(p)[f]));
      G.players.forEach((p, i) => {
        const s = pst(p);
        const mk = (f) => (s[f] === best(f) && s[f] > 0 ? ' style="color:#fee761"' : '');
        h += `<tr><td>P${i + 1} ${esc(heroName(p.hero.id))}</td><td${mk('kills')}>${s.kills}</td><td${mk('dmg')}>${U.fmtNum(Math.round(s.dmg))}</td><td${mk('revives')}>${s.revives}</td><td${mk('deaths')}>${s.deaths}</td></tr>`;
      });
      h += '</table>';
      const worst = Object.keys(rs.deathsBy).sort((a, b) => rs.deathsBy[b] - rs.deathsBy[a])[0];
      if (worst) h += `<div class="hint">Most deaths to: <b>${esc(worst)}</b> (${rs.deathsBy[worst]})</div>`;
    }
    return h;
  };

  M.launch = (setup, config) => {
    const s = Object.assign({ mode: 'classic', seed: null, challenge: null, heat: {} }, setup);
    X.startRun(s, config === undefined ? null : config);
  };
  M.history = () => md().history;
  M.board = (key) => md().board[key] || [];
})(window.CH);
