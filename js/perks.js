/* CHAOS.exe - the build layer: card rarity + Luck, cursed cards, mechanic-changing perks, weapon evolutions,
   slot synergies, special / grenade paths, hero passives, and reroll / banish / skip on level-ups.
   Everything here wraps the base systems, so the original files stay readable. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const G = CH.G;
  const Up = CH.Upgrades;
  const W = CH.Weapons;
  const Audio = CH.Audio;

  const X = (CH.X = {});
  const wrap = (obj, name, fn) => {
    const orig = obj[name];
    obj[name] = function (...a) {
      return fn.call(this, orig, ...a);
    };
    return orig;
  };
  X.wrap = wrap;
  const has = (n) => CH.Sprites.has(n);
  X.icon = (n) => (has(n) ? n : 'ic_power');

  /* ---------- persistent add-on data (stored under Storage.data.meta) ---------- */
  X.meta = () => {
    const m = CH.Storage.data.meta;
    if (!m.opts) m.opts = {};
    return m;
  };
  const OPT_DEFAULTS = { dmgNums: true, dpsMeter: false, autoFire: false, autoAim: false, colorblind: false, gameSpeed: 100, minimap: true, hitStop: true, lowHp: true, offscreen: true, tutorial: true };
  X.opts = () => {
    const o = X.meta().opts;
    for (const k of Object.keys(OPT_DEFAULTS)) if (o[k] === undefined) o[k] = OPT_DEFAULTS[k];
    return o;
  };
  X.save = () => CH.Storage.save();
  X.statHooks = []; // fn(p) run after every stat recalculation
  X.ownerHooks = []; // fn(g, p) run once per player when a run starts
  X.perkList = [];

  /* ---------- new upgrade: Luck ---------- */
  const LUCK = { id: 'luck', name: 'Lucky Clover', icon: 'ic_reality', max: 4, text: () => '+25% luck: rarer, stronger cards', total: (l) => `Total: +${l * 25}% luck`, flavor: 'Found it behind the vending machine.' };
  Up.list.push(LUCK);
  Up.byId.luck = LUCK;
  Up.MAX_LEVELS.luck = LUCK.max;

  /* ---------- per-player run state ---------- */
  function ensure(p) {
    if (p._x) return p;
    p._x = true;
    p.perks = {};
    p.evo = {};
    p.banned = new Set();
    const mb = (CH.Meta && CH.Meta.rrBonus && CH.Meta.rrBonus()) || { reroll: 0, banish: 0, skip: 0 };
    p.rr = { reroll: 3 + mb.reroll, banish: 2 + mb.banish, skip: 2 + mb.skip };
    p.shots = 0;
    p.kills10 = 0;
    p.xkills = 0;
    p.thornCd = 0;
    p.critHealCd = 0;
    return p;
  }
  X.ensure = ensure;
  X.perk = (p, id) => (p && p.perks && p.perks[id]) || 0;
  X.anyPerk = (id) => G.players.some((q) => !q.dead && X.perk(q, id) > 0);
  X.heroIs = (p, id) => !!p && p.hero && p.hero.id === id;

  /* ---------- weapon elements, for slot synergies ---------- */
  const MELEE = { baguette: 1, leaf: 0 };
  const ELEM = { junk: 'junk', chicken: 'goo', pizza: 'fire', baguette: 'wind', chair: 'fire', problem: 'chaos', stapler: 'junk', leaf: 'wind', keyboard: 'elec', roomba: 'junk', extinguisher: 'ice', replyall: 'elec' };
  X.elemOf = (id) => ELEM[id] || 'junk';
  X.synergies = (p) => {
    const out = [];
    if (!p.weapon2) return out;
    const a = p.weapon;
    const b = p.weapon2;
    if (!!MELEE[a] !== !!MELEE[b]) out.push({ id: 'mix', name: 'MELEE + RANGED', text: '+10% damage' });
    if (X.elemOf(a) === X.elemOf(b)) out.push({ id: 'elem', name: 'TWIN ELEMENT (' + X.elemOf(a).toUpperCase() + ')', text: '+8% damage, +5% crit' });
    return out;
  };

  /* ---------- recalc wrapper ---------- */
  wrap(Up, 'recalc', function (orig, p) {
    ensure(p);
    const hpBefore = p.hp;
    const maxBefore = p.maxHp;
    orig(p);
    const s = p.stats;
    s.luck = (p.upgrades.luck || 0) * 0.25 + (p.buffs && p.buffs.luck > 0 ? 0.4 : 0);
    s.fireRate = 1;
    s.enemyDmgTakenMul = 1;
    for (const sy of X.synergies(p)) {
      if (sy.id === 'mix') s.dmgMult *= 1.1;
      if (sy.id === 'elem') {
        s.dmgMult *= 1.08;
        s.critChance += 0.05;
      }
    }
    if (X.perk(p, 'glass')) s.dmgMult *= 1.4;
    if (X.perk(p, 'frenzy')) s.fireRate *= 1.3;
    let hpMul = X.perk(p, 'frenzy') ? 0.7 : 1;
    s.hpMul = hpMul;
    for (const h of X.statHooks) h(p, s);
    hpMul = s.hpMul;
    const finalMax = Math.round(s.maxHp * hpMul);
    p.maxHp = finalMax;
    s.maxHp = finalMax;
    p.hp = maxBefore && finalMax > maxBefore ? Math.min(finalMax, hpBefore + (finalMax - maxBefore)) : Math.min(hpBefore, finalMax);
  });
  wrap(W, 'cooldown', function (orig, p, id) {
    return orig(p, id) / ((p.stats && p.stats.fireRate) || 1);
  });
  for (const n of ['addWeapon', 'selectWeapon', 'swapWeapons', 'cycleWeapon']) {
    wrap(CH.Player.prototype, n, function (orig, ...a) {
      const r = orig.apply(this, a);
      Up.recalc(this);
      return r;
    });
  }

  /* ---------- perk catalogue ---------- */
  const pc = (v) => Math.round(v * 100) + '%';
  function perk(o) {
    X.perkList.push(Object.assign({ max: 1, rarity: 'rare', cat: 'mech', req: () => true }, o));
  }
  X.addPerk = perk;
  perk({ id: 'firetrail', name: 'Flame Roll', icon: 'ic_roll', text: () => 'Your dodge roll leaves a trail of fire', flavor: 'Hot feet, cool head.' });
  perk({ id: 'tenth', name: 'Lucky Number Ten', icon: 'ic_crit', text: () => 'Every 10th shot is a guaranteed crit', flavor: 'The ninth is for practice.' });
  perk({ id: 'reloadmine', name: 'Booby-Trapped Mags', icon: 'ic_boom', text: () => 'Reloading drops a mine', flavor: 'Reload responsibly.' });
  perk({ id: 'turretbar', name: 'Armed Barricades', icon: 'ic_weapon', text: () => 'Your barricades shoot nearby enemies', flavor: 'Fences with opinions.' });
  perk({ id: 'chain', name: 'Static Cling', icon: 'ic_power', text: () => 'Kills during a combo of x1.5+ chain lightning', flavor: 'Combo meter, now with voltage.' });
  perk({ id: 'pull', name: 'Gravity Well', icon: 'ic_magnet', cat: 'special', rarity: 'legendary', text: () => 'Overdrive pulls enemies in first', flavor: 'Come here. Closer.', req: (p) => p.hero.special === 'overdrive' });
  perk({ id: 'thornfield', name: 'Bramble Aftermath', icon: 'ic_boom', cat: 'special', rarity: 'legendary', text: () => 'Thorn Nova leaves thorn fields behind', flavor: 'The garden remembers.', req: (p) => p.hero.special === 'thornnova' });
  perk({ id: 'bloodspread', name: 'Contagious Moon', icon: 'ic_heart', cat: 'special', rarity: 'legendary', text: () => 'Blood Moon spreads to enemies near those it hits', flavor: 'Sharing is caring.', req: (p) => p.hero.special === 'bloodmoon' });
  perk({ id: 'spcd', name: 'Overclocked Ult', icon: 'ic_speed', cat: 'special', max: 2, text: (l) => '-25% special ability cooldown', flavor: 'Q harder.' });
  perk({ id: 'cluster', name: 'Cluster Grenades', icon: 'ic_boom', cat: 'nade', text: () => 'Grenades burst into 5 bomblets', flavor: 'Buy one, get five.' });
  perk({ id: 'sticky', name: 'Sticky Grenades', icon: 'ic_magnet', cat: 'nade', text: () => 'Grenades stick to the nearest enemy', flavor: 'It likes you.' });
  perk({ id: 'nades', name: 'Grenade Bandolier', icon: 'ic_multi', cat: 'nade', rarity: 'common', max: 3, text: () => '+2 grenade charges', flavor: 'Pockets full of regret.' });
  perk({ id: 'chaosnade', name: 'Chaos Grenade', icon: 'ic_reality', cat: 'nade', rarity: 'legendary', text: () => 'Grenades trigger a chaos event when they land', flavor: 'What does this one do? Yes.' });
  perk({ id: 'glass', name: 'Glass Cannon', icon: 'ic_bonk', cat: 'cursed', rarity: 'cursed', text: () => '+40% damage, BUT no healing from pickups', flavor: 'Do not eat the snacks.' });
  perk({ id: 'greed', name: 'Double or Nothing', icon: 'ic_coin', cat: 'cursed', rarity: 'cursed', text: () => 'DOUBLE XP, BUT enemies move 20% faster', flavor: 'Wisdom is expensive.' });
  perk({ id: 'frenzy', name: 'Frenzy Pact', icon: 'ic_speed', cat: 'cursed', rarity: 'cursed', text: () => '+30% fire rate, BUT -30% max HP', flavor: 'Fast hands, thin skin.' });
  perk({ id: 'hex', name: 'Hex of Plenty', icon: 'ic_loot', cat: 'cursed', rarity: 'cursed', text: () => '+60% coins, BUT enemies hit 25% harder', flavor: 'Money talks. Loudly.' });
  perk({ id: 'favevent', name: 'Chaos Fan Club', icon: 'ic_reality', text: () => 'The first chaos event you choose is LOCKED IN as your favourite: it is offered in every orb pair and comes up more often', flavor: 'Same chaos, please.' });
  perk({ id: 'twin', name: 'Twin Turrets', icon: 'ic_weapon', cat: 'hero', hero: 'Mercenary', rarity: 'rare', text: () => 'Your auto-turret needs fewer kills and lasts longer', flavor: 'Mercenary exclusive.' });
  perk({ id: 'briar', name: 'Briar Armor', icon: 'ic_skull', cat: 'hero', hero: 'Dreadbloom', rarity: 'rare', text: () => 'Thorns hit twice as hard and knock enemies back', flavor: 'Dreadbloom exclusive.' });
  perk({ id: 'bloodlust', name: 'Bloodlust', icon: 'ic_heart', cat: 'hero', hero: 'Vexaria', rarity: 'rare', text: () => 'Crits heal three times as much', flavor: 'Vexaria exclusive.' });
  perk({ id: 'tether', name: 'Tether', icon: 'ic_magnet', cat: 'coop', rarity: 'rare', text: () => 'An energy beam between you and your partner damages enemies', flavor: 'Co-op only. Hold hands.', req: () => G.coop });
  perk({ id: 'share', name: 'Share the Snacks', icon: 'ic_snack', cat: 'coop', rarity: 'rare', text: () => 'Healing you receive also heals your partner by 40%', flavor: 'Co-op only. Caring is sharing.', req: () => G.coop });
  X.perkById = (id) => X.perkList.find((q) => q.id === id);
  for (const h of X.perkList) if (h.cat === 'hero') h.req = ((hid) => (p) => p.hero.id === hid)(h.hero);

  /* ---------- weapon evolutions ---------- */
  const EVO = {
    chicken: { up: 'multi', name: 'CHICKEN FLOCK', text: 'Fires a whole flock: 3 extra bouncing chickens per shot' },
    pizza: { up: 'boom', name: 'DEEP DISH NUKE', text: 'Pizzas detonate in a huge fiery blast' },
    baguette: { up: 'skull', name: 'FRENCH REVOLUTION', text: 'A full-circle spin that reflects every shot' },
    junk: { up: 'bonk', name: 'JUNK STORM', text: 'Every shot also launches a ring of 8 junk' },
    chair: { up: 'ammo', name: 'ROLLING THUNDER', text: 'Impacts trigger a ring of aftershocks' },
    problem: { up: 'reality', name: 'PROBLEM CHILD', text: 'Two extra problems per shot' },
  };
  X.EVO = EVO;
  const evoFns = {};
  X.evoFns = evoFns;
  X.evoName = (p, id) => (p.evo && p.evo[id] && EVO[id] ? EVO[id].name : B.weapons[id].name);
  X.evoReady = (p) =>
    Object.keys(EVO).filter((w) => p.weapons.includes(w) && p.ws[w].level >= B.weaponMaxLevel && !p.evo[w] && (p.upgrades[EVO[w].up] || 0) >= 1);

  X.fireWrap = function (id) {
    const orig = W.FIRE[id];
    if (!orig || orig._evo) return;
    const f = function (g, p, d, a) {
      if (p.evo && p.evo[id] && evoFns[id]) return evoFns[id](orig, g, p, d, a);
      return orig(g, p, d, a);
    };
    f._evo = true;
    W.FIRE[id] = f;
  };
  const newProjs = (g, n0) => g.projectiles.slice(n0).filter((q) => q.owner === 'p');
  X.newProjs = newProjs;
  const withExtra = (p, n, fn) => {
    p.stats.extraProj += n;
    try {
      fn();
    } finally {
      p.stats.extraProj -= n;
    }
  };
  evoFns.chicken = (orig, g, p, d, a) => withExtra(p, 3, () => orig(g, p, d, a));
  evoFns.problem = (orig, g, p, d, a) => withExtra(p, 2, () => orig(g, p, d, a));
  evoFns.junk = (orig, g, p, d, a) => {
    orig(g, p, d, a);
    const base = W.baseDamage(p, 'junk') * 0.6;
    for (let i = 0; i < 8; i++) {
      const ang = a + (i / 8) * U.TAU;
      const sp = d.speed * 0.8;
      g.spawnProjectile({ owner: 'p', kind: 'junk', x: p.x, y: p.y - 8, ang, speed: sp, r: d.r, dmg: base, life: 0.6, sprite: 'junk' + (i % 6), spin: 12, knock: 70, trail: 'junk', shooter: p });
    }
  };
  evoFns.pizza = (orig, g, p, d, a) => {
    const n0 = g.projectiles.length;
    orig(g, p, d, a);
    const nuke = (g2, pr) => {
      const R = d.radius * 2.3 * p.stats.explMult;
      g2.explode(pr.x, pr.y, R, pr.dmg * 2.6, { owner: 'p', colors: 'fire', knock: 320, crit: true, big: true, shooter: p });
      X.addZone({ kind: 'fire', x: pr.x, y: pr.y, r: R * 0.6, life: 4, dps: 14 * p.stats.dmgMult, owner: p });
      FX.text(pr.x, pr.y - 14, 'NUKE!', '#fee761', 1);
    };
    for (const pr of newProjs(g, n0)) {
      pr.onHit = (g2, q) => (nuke(g2, q), 'die');
      pr.onEnd = nuke;
    }
  };
  evoFns.chair = (orig, g, p, d, a) => {
    const n0 = g.projectiles.length;
    orig(g, p, d, a);
    const thunder = (g2, pr) => {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * U.TAU;
        g2.after(0.1 + i * 0.08, () => g2.explode(pr.x + Math.cos(ang) * 38, pr.y + Math.sin(ang) * 38, 18 * p.stats.explMult, pr.dmg * 0.5, { owner: 'p', colors: 'fire', knock: 120, shooter: p, noShake: true }));
      }
    };
    for (const pr of newProjs(g, n0)) {
      const oh = pr.onHit;
      const oe = pr.onEnd;
      pr.onHit = (g2, q, e) => {
        const r = oh(g2, q, e);
        thunder(g2, q);
        return r;
      };
      pr.onEnd = (g2, q) => {
        oe(g2, q);
        thunder(g2, q);
      };
    }
  };
  evoFns.baguette = (orig, g, p, d, a) => {
    const dd = Object.assign({}, d, { arc: U.TAU + 0.4, range: d.range * 1.3 });
    const keep = p.stats.dmgMult;
    p.stats.dmgMult *= 1.25;
    try {
      orig(g, p, dd, a);
    } finally {
      p.stats.dmgMult = keep;
    }
    FX.ring(p.x, p.y, 6, dd.range * 1.2, '#fee761', 0.3);
  };
  for (const id of Object.keys(EVO)) X.fireWrap(id);

  /* ---------- world effects owned by perks: fire trails, thorn fields, mines, turrets, beams ---------- */
  X.zones = [];
  X.mines = [];
  X.turrets = [];
  X.beams = [];
  X.stickies = [];
  X.addZone = (z) => {
    if (X.zones.length > 90) X.zones.shift();
    X.zones.push(Object.assign({ tickT: 0, t: 0, dps: 10, r: 14, life: 3, kind: 'fire' }, z));
  };
  X.beam = (x1, y1, x2, y2, color, life) => {
    if (X.beams.length < 60) X.beams.push({ x1, y1, x2, y2, color: color || '#3ccbe6', t: life || 0.18, T: life || 0.18 });
  };
  X.addTurret = (x, y, o) => X.turrets.push(Object.assign({ x, y, life: 12, t: 0.4, rate: 0.55, range: 150, dmg: 9, owner: G.player, spr: 'junk_launcher' }, o));
  X.addMine = (x, y, p, o) => {
    if (X.mines.length > 14) X.mines.shift();
    X.mines.push(Object.assign({ x, y, arm: 0.6, life: 30, owner: p, dmg: 42, r: 34 }, o));
  };
  X.reset = () => {
    X.zones.length = X.mines.length = X.turrets.length = X.beams.length = X.stickies.length = 0;
  };

  X.hitEnemy = (e, dmg, p, elem) => G.damageEnemy(e, dmg, { elem: elem || 'phys', lite: true, src: 'player', shooter: p });
  X.nearestEnemy = (x, y, range, skip) => {
    let best = null;
    let bd = range * range;
    for (const e of G.enemies) {
      if (e.dead || e.state === 'spawn' || e.hidden || e === skip) continue;
      const d = U.dist2(x, y, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  };

  function stepWorld(dt) {
    // fire trail from the dodge roll
    for (const p of G.players) {
      if (p.dead) continue;
      if (X.perk(p, 'firetrail') && p.rolling) {
        p._trailT = (p._trailT || 0) - dt;
        if (p._trailT <= 0) {
          p._trailT = 0.05;
          X.addZone({ kind: 'fire', x: p.x, y: p.y + 4, r: 13, life: 3, dps: 16 * p.stats.dmgMult, owner: p });
        }
      }
    }
    for (let i = X.zones.length - 1; i >= 0; i--) {
      const z = X.zones[i];
      z.t += dt;
      z.life -= dt;
      z.tickT -= dt;
      if (z.tickT <= 0) {
        z.tickT = 0.3;
        for (const e of G.enemies) {
          if (e.dead || e.state === 'spawn' || U.dist(e.x, e.y, z.x, z.y) > z.r + e.r) continue;
          X.hitEnemy(e, z.dps * 0.3, z.owner || G.player, z.kind === 'thorn' ? 'toxic' : 'fire');
          if (z.kind === 'thorn' && e.applySlow) e.applySlow(0.6, 0.6);
        }
      }
      if (z.life <= 0) X.zones.splice(i, 1);
    }
    for (let i = X.mines.length - 1; i >= 0; i--) {
      const m = X.mines[i];
      m.arm -= dt;
      m.life -= dt;
      let boom = false;
      if (m.arm <= 0) for (const e of G.enemies) if (!e.dead && e.state !== 'spawn' && U.dist(e.x, e.y, m.x, m.y) < 18 + e.r) boom = true;
      if (boom) {
        G.explode(m.x, m.y, m.r * ((m.owner && m.owner.stats && m.owner.stats.explMult) || 1), m.dmg * ((m.owner && m.owner.stats && m.owner.stats.dmgMult) || 1), { owner: 'p', colors: 'fire', knock: 160, shooter: m.owner, crit: true });
        X.mines.splice(i, 1);
      } else if (m.life <= 0) X.mines.splice(i, 1);
    }
    for (let i = X.turrets.length - 1; i >= 0; i--) {
      const t = X.turrets[i];
      t.life -= dt;
      t.t -= dt;
      if (t.t <= 0) {
        const tg = X.nearestEnemy(t.x, t.y, t.range);
        if (tg) {
          t.t = t.rate;
          const ang = U.ang(t.x, t.y, tg.x, tg.y);
          const o = t.owner || G.player;
          G.spawnProjectile({ owner: 'p', shooter: o, kind: 'junk', x: t.x, y: t.y - 6, ang, speed: 260, r: 3, dmg: t.dmg * ((o.stats && o.stats.dmgMult) || 1), life: 0.7, sprite: 'junk' + U.randInt(0, 5), spin: 12, knock: 40, trail: 'junk' });
          Audio.sfx('shoot_junk');
        } else t.t = 0.2;
      }
      if (t.life <= 0) {
        FX.burst(t.x, t.y, { n: 8, colors: ['#a6b0bf', '#fee761'], speed: 60, life: 0.4 });
        X.turrets.splice(i, 1);
      }
    }
    for (let i = X.stickies.length - 1; i >= 0; i--) {
      const s = X.stickies[i];
      s.t -= dt;
      if (s.e && !s.e.dead) {
        s.x = s.e.x;
        s.y = s.e.y;
      }
      if (s.t <= 0) {
        s.boom({ x: s.x, y: s.y });
        X.stickies.splice(i, 1);
      }
    }
    for (let i = X.beams.length - 1; i >= 0; i--) {
      X.beams[i].t -= dt;
      if (X.beams[i].t <= 0) X.beams.splice(i, 1);
    }
    // barricades shoot
    for (const p of G.players) {
      if (p.dead || !X.perk(p, 'turretbar') || !G.arena || !G.arena.props) continue;
      p._barT = (p._barT || 0) - dt;
      if (p._barT > 0) continue;
      p._barT = 0.9;
      for (const pr of G.arena.props) {
        if (pr.kind !== 'barricade' || pr.dead) continue;
        const tg = X.nearestEnemy(pr.x, pr.y, 140);
        if (!tg) continue;
        G.spawnProjectile({ owner: 'p', shooter: p, kind: 'junk', x: pr.x, y: pr.y - 10, ang: U.ang(pr.x, pr.y, tg.x, tg.y), speed: 250, r: 3, dmg: 9 * p.stats.dmgMult, life: 0.7, sprite: 'junk' + U.randInt(0, 5), spin: 10, knock: 40, trail: 'junk' });
      }
    }
    // tether beams: every pair of living heroes where at least one has the card
    if (G.coop) {
      const al = G.players.filter((q) => !q.dead);
      for (let i = 0; i < al.length; i++) {
        for (let j = i + 1; j < al.length; j++) {
          const a = al[i];
          const b = al[j];
          if (!X.perk(a, 'tether') && !X.perk(b, 'tether')) continue;
          X.beam(a.x, a.y - 6, b.x, b.y - 6, '#3ccbe6', 0.06);
          a._tetherT = (a._tetherT || 0) - dt / (al.length - 1);
          if (a._tetherT <= 0) {
            a._tetherT = 0.3;
            const l2 = U.dist2(a.x, a.y, b.x, b.y) || 1;
            for (const e of G.enemies) {
              if (e.dead || e.state === 'spawn') continue;
              const t = U.clamp(((e.x - a.x) * (b.x - a.x) + (e.y - a.y) * (b.y - a.y)) / l2, 0, 1);
              if (U.dist(e.x, e.y, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t) < e.r + 5) X.hitEnemy(e, 11 * a.stats.dmgMult, a, 'elec');
            }
          }
        }
      }
    }
    // enemies: speed multipliers from cursed cards and affixes
    const sp = X.enemySpeedMul();
    for (const e of G.enemies) e.speedX = (e.affixSpd || 1) * sp;
  }
  X.enemySpeedMul = () => (X.anyPerk('greed') ? 1.2 : 1) * (X.extraEnemySpeed || 1);
  X.extraEnemySpeed = 1;

  G.on('step', function (dt) {
    if (G.state === 'playing') {
      for (const p of G.players) ensure(p);
      stepWorld(dt);
    }
  });

  CH.Hooks.world.push((ctx, cam) => {
    const t = G.wall;
    for (const z of X.zones) {
      const x = z.x - cam.x;
      const y = z.y - cam.y;
      const a = Math.min(1, z.life) * 0.55;
      ctx.globalAlpha = a;
      ctx.fillStyle = z.kind === 'thorn' ? '#2e7d32' : '#e8651a';
      ctx.beginPath();
      ctx.ellipse(x, y, z.r, z.r * 0.6, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = z.kind === 'thorn' ? '#a22633' : '#fee761';
      ctx.beginPath();
      ctx.ellipse(x + Math.sin(t * 9 + z.x) * 2, y - 1, z.r * 0.5, z.r * 0.3, 0, 0, U.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const m of X.mines) {
      const x = m.x - cam.x;
      const y = m.y - cam.y;
      ctx.fillStyle = '#1b1226';
      ctx.fillRect(Math.round(x - 3), Math.round(y - 2), 6, 4);
      ctx.fillStyle = m.arm > 0 ? '#feae34' : Math.sin(t * 12) > 0 ? '#e43b44' : '#7a1a24';
      ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 2, 2);
    }
    for (const tu of X.turrets) {
      const x = tu.x - cam.x;
      const y = tu.y - cam.y;
      ctx.fillStyle = '#1b1226';
      ctx.fillRect(Math.round(x - 5), Math.round(y - 4), 10, 8);
      ctx.fillStyle = '#a6b0bf';
      ctx.fillRect(Math.round(x - 4), Math.round(y - 3), 8, 6);
      ctx.fillStyle = '#e43b44';
      ctx.fillRect(Math.round(x - 1), Math.round(y - 7), 3, 4);
    }
    for (const s of X.stickies) {
      ctx.fillStyle = Math.sin(t * 20) > 0 ? '#e43b44' : '#feae34';
      ctx.fillRect(Math.round(s.x - cam.x - 2), Math.round(s.y - cam.y - 8), 4, 4);
    }
    for (const b of X.beams) {
      ctx.globalAlpha = Math.max(0, b.t / b.T);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x1 - cam.x, b.y1 - cam.y);
      const mx = (b.x1 + b.x2) / 2 + U.rand(-3, 3) - cam.x;
      const my = (b.y1 + b.y2) / 2 + U.rand(-3, 3) - cam.y;
      ctx.lineTo(mx, my);
      ctx.lineTo(b.x2 - cam.x, b.y2 - cam.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  /* ---------- mechanic perk hooks ---------- */
  wrap(W, 'tryFire', function (orig, g, p, which) {
    ensure(p);
    const id = which || p.weapon;
    const ws = p.ws[id];
    const ready = ws && ws.cd <= 0 && ws.reload <= 0 && !(B.weapons[id].ammo > 0 && ws.ammo <= 0);
    const crit = ready && X.perk(p, 'tenth') && (p.shots + 1) % 10 === 0;
    const keep = p.stats.critChance;
    if (crit) {
      X.critNext = true;
      p.stats.critChance = 1;
    }
    let r;
    try {
      r = orig(g, p, which);
    } finally {
      X.critNext = false;
      p.stats.critChance = keep;
    }
    if (r) {
      p.shots++;
      if (crit) FX.text(p.x, p.y - 24, 'LUCKY 10!', '#fee761', 1);
      CH.X.onFired && CH.X.onFired(p, id);
    }
    return r;
  });
  wrap(W, 'spawn', function (orig, g, o) {
    const pr = orig(g, o);
    if (pr && X.critNext && pr.owner === 'p') pr.forceCrit = true;
    return pr;
  });
  wrap(W, 'startReload', function (orig, p, id) {
    const r = orig(p, id);
    if (r && X.perk(p, 'reloadmine')) X.addMine(p.x, p.y + 6, p);
    if (r && X.onReload) X.onReload(p, id);
    return r;
  });

  /* kills: chain lightning, hero turret */
  G.on('kill', function (e) {
    const p = e.lastHitBy && !e.lastHitBy.dead ? e.lastHitBy : null;
    if (!p) return;
    ensure(p);
    if (X.perk(p, 'chain') && G.comboMult() >= 1.5) {
      let from = e;
      const seen = new Set([e]);
      for (let i = 0; i < 3; i++) {
        let best = null;
        let bd = 95 * 95;
        for (const o of G.enemies) {
          if (o.dead || seen.has(o) || o.state === 'spawn') continue;
          const d = U.dist2(from.x, from.y, o.x, o.y);
          if (d < bd) {
            bd = d;
            best = o;
          }
        }
        if (!best) break;
        seen.add(best);
        X.beam(from.x, from.y - 6, best.x, best.y - 6, '#fee761');
        X.hitEnemy(best, 16 * p.stats.dmgMult, p, 'elec');
        from = best;
      }
    }
    if (X.heroIs(p, 'Mercenary')) {
      p.xkills++;
      const need = X.perk(p, 'twin') ? 7 : 12;
      if (p.xkills >= need) {
        p.xkills = 0;
        X.addTurret(p.x + U.rand(-14, 14), p.y + U.rand(6, 16), { owner: p, life: X.perk(p, 'twin') ? 18 : 12, rate: X.perk(p, 'twin') ? 0.4 : 0.55 });
        FX.text(p.x, p.y - 26, 'AUTO-TURRET!', '#3ccbe6', 1);
        Audio.sfx('item_get');
      }
    }
  });
  /* Vexaria: crits heal. Dreadbloom: being hit pricks nearby enemies. */
  wrap(G, 'damageEnemy', function (orig, e, dmg, o) {
    const r = orig.call(G, e, dmg, o);
    const p = o && o.shooter;
    if (r && o && o.crit && p && X.heroIs(p, 'Vexaria') && !p.dead) {
      if (G.time - (p._critHealT || -9) > 0.35) {
        p._critHealT = G.time;
        G.healPlayer((X.perk(p, 'bloodlust') ? 3 : 1) / p.stats.healMult / G.diff.heal, p);
      }
    }
    if (r && X.onDamage) X.onDamage(e, r, o);
    return r;
  });
  wrap(G, 'hurtPlayer', function (orig, dmg, src, o) {
    const p = (o && o.p) || G.player;
    const r = orig.call(G, dmg, src, o);
    if (r > 0 && p) {
      ensure(p);
      if (X.heroIs(p, 'Dreadbloom')) {
        const brr = X.perk(p, 'briar');
        for (const e of G.enemies) {
          if (e.dead || e.state === 'spawn' || U.dist(e.x, e.y, p.x, p.y) > 42 + e.r) continue;
          X.hitEnemy(e, (14 + r * 0.8) * p.stats.dmgMult * (brr ? 2 : 1), p, 'toxic');
          if (brr && e.knock && !e.isBoss) e.knock(Math.cos(U.ang(p.x, p.y, e.x, e.y)), Math.sin(U.ang(p.x, p.y, e.x, e.y)), 160);
        }
        FX.ring(p.x, p.y, 6, 42, '#2e7d32', 0.3);
      }
      if (X.onHurt) X.onHurt(p, r, src);
    }
    return r;
  });

  /* healing rules: Glass Cannon refuses pickup healing, Share the Snacks passes healing on */
  let inCollect = false;
  wrap(G, 'collect', function (orig, pk, who) {
    inCollect = true;
    try {
      return orig.call(G, pk, who);
    } finally {
      inCollect = false;
    }
  });
  let sharing = false;
  wrap(G, 'healPlayer', function (orig, raw, p) {
    p = p || G.player;
    if (inCollect && X.perk(p, 'glass')) {
      FX.text(p.x, p.y - 16, 'NO HEALING', '#b55088', 1);
      return 0;
    }
    const got = orig.call(G, raw, p);
    if (got > 0 && !sharing && G.coop) {
      for (const q of G.players) {
        if (q !== p && !q.dead && X.perk(p, 'share') + X.perk(q, 'share') > 0) {
          sharing = true;
          G.healPlayer(raw * 0.4 / q.stats.healMult / G.diff.heal, q);
          sharing = false;
        }
      }
    }
    return got;
  });
  wrap(G, 'edmg', function (orig, base) {
    return orig.call(G, base) * (X.anyPerk('hex') ? 1.25 : 1) * (X.enemyDmgMul || 1);
  });
  wrap(G, 'addCoins', function (orig, n, x, y) {
    const p = G.alivePlayers()[0];
    if (X.anyPerk('hex')) n = Math.round(n * 1.6);
    return orig.call(G, n, x, y);
  });
  wrap(Up, 'addXp', function (orig, g, amount, who) {
    return orig.call(Up, g, X.anyPerk('greed') ? amount * 2 : amount, who);
  });

  /* special ability paths */
  wrap(CH.Player.prototype, 'special', function (orig, g) {
    const before = this.specialCd;
    orig.call(this, g);
    const l = X.perk(this, 'spcd');
    if (before <= 0 && this.specialCd > 0 && l) this.specialCd *= 1 - 0.25 * l;
  });
  wrap(CH.Player.prototype, 'castEffect', function (orig, g) {
    const p = this;
    const R = p.hero.special === 'bloodmoon' ? 135 : p.hero.special === 'thornnova' ? B.player.specialRadius * 1.2 : 62;
    if (X.perk(p, 'pull') && p.hero.special === 'overdrive') {
      for (const e of g.enemies) {
        if (e.dead || e.isBoss || e.state === 'spawn') continue;
        const d = U.dist(e.x, e.y, p.x, p.y);
        if (d < 190 && e.knock) e.knock(Math.cos(U.ang(e.x, e.y, p.x, p.y)), Math.sin(U.ang(e.x, e.y, p.x, p.y)), Math.min(320, d * 2.6));
      }
      FX.ring(p.x, p.y, 190, 20, '#3ccbe6', 0.4);
    }
    const hitList = X.perk(p, 'bloodspread') && p.hero.special === 'bloodmoon' ? g.enemies.filter((e) => !e.dead && U.dist(e.x, e.y, p.x, p.y) < R + e.r).slice() : null;
    orig.call(this, g);
    if (X.perk(p, 'thornfield') && p.hero.special === 'thornnova') {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * U.TAU;
        X.addZone({ kind: 'thorn', x: p.x + Math.cos(a) * R * 0.7, y: p.y + Math.sin(a) * R * 0.55, r: 20, life: 6, dps: 26 * p.stats.dmgMult, owner: p });
      }
      X.addZone({ kind: 'thorn', x: p.x, y: p.y, r: 24, life: 6, dps: 26 * p.stats.dmgMult, owner: p });
    }
    if (hitList && hitList.length) {
      const hit = new Set(hitList);
      for (const e of g.enemies) {
        if (e.dead || hit.has(e) || e.state === 'spawn') continue;
        const src = hitList.find((h) => !h.dead && U.dist(h.x, h.y, e.x, e.y) < 65);
        if (!src) continue;
        X.beam(src.x, src.y - 6, e.x, e.y - 6, '#e43b44', 0.3);
        X.hitEnemy(e, 45 * p.stats.dmgMult, p, 'magic');
      }
    }
  });

  /* grenade perks */
  wrap(W, 'throwGadget', function (orig, g, p, kind) {
    ensure(p);
    const n0 = g.projectiles.length;
    orig(g, p, kind);
    const pr = g.projectiles.slice(n0).find((q) => q.kind === 'gadget_' + kind);
    if (!pr) return;
    const land = pr.onEnd;
    const dm = p.stats.dmgMult;
    if (X.perk(p, 'sticky')) {
      pr.onEnd = (g2, q) => {
        const e = X.nearestEnemy(q.x, q.y, 55);
        if (!e) return land(g2, q);
        X.stickies.push({ e, x: e.x, y: e.y, t: 1.3, boom: land });
        FX.text(e.x, e.y - 14, 'STUCK!', '#feae34', 1);
      };
    }
    if (X.perk(p, 'cluster')) {
      const prev = pr.onEnd;
      pr.onEnd = (g2, q) => {
        prev(g2, q);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * U.TAU + U.rand(0, 1);
          g2.spawnProjectile({ owner: 'p', shooter: p, kind: 'gadget_bomblet', x: q.x, y: q.y, ang: a, speed: 70, r: 2, noHit: true, life: 0.5, dmg: 0, sprite: 'prob_bomb', spin: 14, onEnd: (g3, b) => g3.explode(b.x, b.y, 22 * p.stats.explMult, 28 * dm, { owner: 'p', colors: 'fire', knock: 120, shooter: p, noShake: true }) });
        }
      };
    }
    if (X.perk(p, 'chaosnade')) {
      const prev = pr.onEnd;
      pr.onEnd = (g2, q) => {
        prev(g2, q);
        if (!g2.event && g2.waveState === 'combat' && !g2.bossAlive()) {
          CH.Events.start(g2);
          if (g2.event) g2.event.left = Math.min(g2.event.left, 9);
        } else FX.text(q.x, q.y - 12, 'FIZZLE', '#b55088', 1);
      };
    }
  });

  /* ---------- run init ---------- */
  G.on('newRun:before', function () {
    X.reset();
    X.extraEnemySpeed = 1;
    X.enemyDmgMul = 1;
  });
  G.on('newRun', function () {
    for (const p of G.players) {
      ensure(p);
      for (const h of X.ownerHooks) h(G, p);
      Up.recalc(p);
    }
  });
  wrap(G, 'toMenu', function (orig) {
    X.reset();
    return orig.call(G);
  });

  /* ---------- card generation ---------- */
  const RAR_NAME = { common: 'COMMON', rare: 'RARE', legendary: 'LEGENDARY', cursed: 'CURSED', evolve: 'EVOLUTION' };
  function rollRarity(p) {
    const luck = (p.stats && p.stats.luck) || 0;
    const w = [['common', 70], ['rare', 24 * (1 + luck)], ['legendary', 6 * (1 + luck * 2.5)]];
    return U.weighted(w, (x) => x[1])[0];
  }
  X.rollRarity = rollRarity;
  const keyOf = (c) => c.kind + ':' + c.id;

  function perkCard(p, def) {
    const lv = X.perk(p, def.id);
    return { kind: 'perk', id: def.id, name: def.name, icon: X.icon(def.icon), lv, max: def.max, text: def.text(lv + 1), total: def.cat === 'cursed' ? 'CURSED: the drawback is permanent' : def.cat.toUpperCase() + ' PERK', flavor: def.flavor, rarity: def.rarity, cat: def.cat };
  }
  function evoCard(p, w) {
    const e = EVO[w];
    return { kind: 'evolve', id: w, name: e.name, icon: W.iconSprite(w), lv: 0, max: 0, text: e.text, total: B.weapons[w].name + ' EVOLVES', flavor: 'Max level + ' + Up.byId[e.up].name + ' = this.', rarity: 'evolve' };
  }
  X.perkPool = (p) => X.perkList.filter((d) => X.perk(p, d.id) < d.max && !p.banned.has('perk:' + d.id) && d.req(p, G));

  wrap(Up, 'makeCards', function (orig, g, who) {
    const p = ensure(who || g.player);
    const seen = new Set();
    const base = [];
    for (let i = 0; i < 12 && base.length < 7; i++) {
      for (const c of orig(g, p)) {
        const k = keyOf(c);
        if (!seen.has(k) && !p.banned.has(k)) {
          seen.add(k);
          base.push(c);
        }
      }
    }
    for (const c of base) {
      if (c.kind === 'upgrade') {
        c.rarity = rollRarity(p);
        const bonus = c.rarity === 'rare' ? 1 : c.rarity === 'legendary' ? 2 : 0;
        c.bonus = Math.min(bonus, Math.max(0, c.max - c.lv - 1));
        if (!c.bonus) c.rarity = 'common';
        if (c.bonus) c.text = c.text + `  (+${c.bonus} bonus level${c.bonus > 1 ? 's' : ''})`;
      } else c.rarity = c.rarity || 'common';
    }
    const out = [];
    const evos = X.evoReady(p);
    if (evos.length) out.push(evoCard(p, evos[0]));
    const pool = U.shuffle(X.perkPool(p));
    // cursed cards are rarer than the rest and Luck makes strong perks show up more
    while (out.length < 3 && (pool.length || base.length)) {
      const wantPerk = pool.length && (Math.random() < 0.38 || !base.length);
      if (wantPerk) {
        const d = U.weighted(pool, (q) => (q.cat === 'cursed' ? 0.4 : 1));
        pool.splice(pool.indexOf(d), 1);
        out.push(perkCard(p, d));
      } else out.push(base.shift());
    }
    const fb = [
      { kind: 'heal', id: 'heal', name: 'Free Snack', icon: 'ic_snack', lv: 0, max: 0, text: 'Restore 40% of your health', total: 'Delicious', flavor: 'You earned it. Probably.', rarity: 'common' },
      { kind: 'coins', id: 'coins', name: 'Found Money', icon: 'ic_coin', lv: 0, max: 0, text: 'Gain 60 coins', total: 'Spend at vending machines', flavor: 'Behind the couch cushion.', rarity: 'common' },
      { kind: 'coins', id: 'coins2', name: 'More Found Money', icon: 'ic_coin', lv: 0, max: 0, text: 'Gain 60 coins', total: '', flavor: '', rarity: 'common' },
    ];
    let f = 0;
    while (out.length < 3 && f < fb.length) out.push(fb[f++]);
    return out.slice(0, 3);
  });

  wrap(Up, 'applyCard', function (orig, g, card, who) {
    const p = ensure(who || g.player);
    switch (card.kind) {
      case 'perk': {
        p.perks[card.id] = (p.perks[card.id] || 0) + 1;
        if (card.id === 'nades') {
          p.maxNades += 2;
          p.nades += 2;
        }
        Audio.sfx(card.cat === 'cursed' ? 'glitch' : 'enchant');
        FX.text(p.x, p.y - 22, card.name, card.cat === 'cursed' ? '#b55088' : '#fee761', 1);
        FX.ring(p.x, p.y, 4, 34, card.cat === 'cursed' ? '#b55088' : '#fee761', 0.4);
        Up.recalc(p);
        return;
      }
      case 'evolve': {
        p.evo[card.id] = true;
        Audio.sfx('levelup');
        Audio.sfx('enchant');
        g.shake(6, 0.4);
        g.screenFlash(0.5, '#fee761');
        FX.ring(p.x, p.y, 4, 60, '#fee761', 0.5);
        FX.text(p.x, p.y - 26, EVO[card.id].name + '!', '#fee761', 2);
        g.ui.toast('EVOLVED: ' + EVO[card.id].name);
        if (X.onEvolve) X.onEvolve(p, card.id);
        return;
      }
      case 'skip':
        p.rr.skip--;
        g.addCoins(30, p.x, p.y);
        FX.text(p.x, p.y - 22, 'SKIPPED +30', '#fee761', 1);
        return;
      case 'tokens':
        return;
    }
    orig.call(Up, g, card, p);
    if (card.kind === 'upgrade' && card.bonus) {
      p.upgrades[card.id] = Math.min(Up.MAX_LEVELS[card.id], p.upgrades[card.id] + card.bonus);
      Up.recalc(p);
      FX.text(p.x, p.y - 34, (card.rarity || '').toUpperCase() + '!', card.rarity === 'legendary' ? '#feae34' : '#3ccbe6', 1);
    }
  });

  /* ---------- reroll / banish / skip ---------- */
  X.banishMode = false;
  function luLevel() {
    return G.luPlayer.level - G.pendingLevels;
  }
  X.reroll = function () {
    const p = G.luPlayer;
    if (G.state !== 'levelup' || G.pickLock || !p || p.rr.reroll <= 0) return false;
    p.rr.reroll--;
    X.banishMode = false;
    G.cards = Up.makeCards(G, p);
    Audio.sfx('click');
    G.ui.showLevelUp(G.cards, luLevel(), p);
    return true;
  };
  X.toggleBanish = function () {
    const p = G.luPlayer;
    if (G.state !== 'levelup' || G.pickLock || !p || p.rr.banish <= 0) return false;
    X.banishMode = !X.banishMode;
    Audio.sfx('click');
    refreshBar();
    return true;
  };
  X.skip = function () {
    const p = G.luPlayer;
    if (G.state !== 'levelup' || G.pickLock || !p || p.rr.skip <= 0 || !G.cards) return false;
    X.banishMode = false;
    G.cards.push({ kind: 'skip', id: 'skip', name: 'Skip', icon: 'ic_coin', lv: 0, max: 0, text: '', total: '', flavor: '' });
    return G.pickUpgrade(G.cards.length - 1);
  };
  wrap(G, 'pickUpgrade', function (orig, i) {
    if (X.banishMode && G.state === 'levelup' && !G.pickLock && G.cards && G.cards[i] && G.luPlayer.rr.banish > 0) {
      const p = G.luPlayer;
      const c = G.cards[i];
      X.banishMode = false;
      if (c.kind === 'evolve') {
        G.ui.toast('EVOLUTIONS CANNOT BE BANISHED');
        refreshBar();
        return false;
      }
      p.banned.add(keyOf(c));
      p.rr.banish--;
      Audio.sfx('glitch');
      G.cards = Up.makeCards(G, p);
      G.ui.showLevelUp(G.cards, luLevel(), p);
      return true;
    }
    X.banishMode = false;
    return orig.call(G, i);
  });

  let bar = null;
  function ensureBar() {
    if (bar) return bar;
    const scr = document.getElementById('screen-levelup');
    bar = document.createElement('div');
    bar.id = 'lu-bar';
    bar.innerHTML = '<button class="btn small" id="lu-reroll"></button><button class="btn small" id="lu-banish"></button><button class="btn small" id="lu-skip"></button>';
    scr.insertBefore(bar, document.getElementById('levelup-hint'));
    bar.querySelector('#lu-reroll').addEventListener('click', () => X.reroll());
    bar.querySelector('#lu-banish').addEventListener('click', () => X.toggleBanish());
    bar.querySelector('#lu-skip').addEventListener('click', () => X.skip());
    return bar;
  }
  function refreshBar() {
    const p = G.luPlayer;
    if (!bar || !p) return;
    const set = (id, txt, n, on) => {
      const b = bar.querySelector(id);
      b.textContent = txt;
      b.disabled = n <= 0;
      b.classList.toggle('off', n <= 0);
      b.classList.toggle('sel', !!on);
    };
    set('#lu-reroll', `[R] REROLL x${p.rr.reroll}`, p.rr.reroll);
    set('#lu-banish', X.banishMode ? '[X] PICK A CARD TO BANISH' : `[X] BANISH x${p.rr.banish}`, p.rr.banish, X.banishMode);
    set('#lu-skip', `[S] SKIP +30c x${p.rr.skip}`, p.rr.skip);
  }
  wrap(CH.UI, 'showLevelUp', function (orig, cards, level, player) {
    ensureBar();
    orig.call(CH.UI, cards, level, player);
    const els = document.getElementById('cards').children;
    cards.forEach((c, i) => {
      const el = els[i];
      if (!el) return;
      const r = c.rarity || 'common';
      el.dataset.rarity = r;
      if (r !== 'common') {
        const tag = document.createElement('div');
        tag.className = 'crar';
        tag.textContent = RAR_NAME[r] || r.toUpperCase();
        el.insertBefore(tag, el.firstChild);
      }
    });
    refreshBar();
  });
  X.onKey = (e) => {
    if (e.code === 'KeyR') return X.reroll();
    if (e.code === 'KeyX') return X.toggleBanish();
    if (e.code === 'KeyS') return X.skip();
    return false;
  };
  CH.Perks = { onKey: X.onKey, X };

  /* ---------- build summary used by the pause screen ---------- */
  X.buildLines = (p) => {
    ensure(p);
    const lines = [];
    for (const u of Up.list) if (p.upgrades[u.id] > 0) lines.push(`${u.name} Lv${p.upgrades[u.id]}`);
    for (const d of X.perkList) if (X.perk(p, d.id) > 0) lines.push(`${d.name}${d.max > 1 ? ' Lv' + X.perk(p, d.id) : ''}${d.cat === 'cursed' ? ' (CURSED)' : ''}`);
    for (const w of p.weapons) if (p.evo[w]) lines.push(`${EVO[w].name} (EVOLVED)`);
    for (const s of X.synergies(p)) lines.push(`SYNERGY: ${s.name} ${s.text}`);
    return lines;
  };
})(window.CH);
