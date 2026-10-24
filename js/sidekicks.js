/* CHAOS.exe - sidekicks (PLAN.md section 7): full-size AI companions, bigger and stronger than the little pets.
   Every hero starts with one main sidekick; eleven secret ones are unlocked by bosses, challenges and secret rooms and
   can then be chosen by any hero (Journal > Codex > Sidekicks). Art: bundle 'sidekicks' (tools/sidekick-pack.js).
   The AI is a small state machine driven by data: follow and leash, pick a target near the owner, run an attack
   (animation, hit on a keyframe), dodge nothing fancy, revive the owner, level up with kills. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const G = CH.G;
  const X = CH.X;
  const Audio = CH.Audio;
  const Storage = CH.Storage;
  const wrap = X.wrap;

  const SK = (CH.SK = { list: [], DEFS: {}, ORDER: [], enabled: true }); // tests switch enabled off unless they are about sidekicks

  /* attack kinds: slash (arc melee), bolt (hit-scan), nova (area), dash (lunge), heal, stunnova, summon, shield */
  const mk = (id, d) => {
    SK.DEFS[id] = Object.assign({ id, hp: 150, dmg: 14, speed: 92, r: 8, aggro: 170, style: 'melee', range: 26, elem: 'phys', main: false, atk: [], heavy: null, skill: null }, d);
    SK.ORDER.push(id);
  };
  const slash = (anim, dmg, cd, extra) => Object.assign({ anim, kind: 'slash', dmg, cd, rng: 30 }, extra);
  const bolt = (anim, dmg, cd, extra) => Object.assign({ anim, kind: 'bolt', dmg, cd, rng: 150 }, extra);

  /* ---- main sidekicks: always unlocked, assigned by default ---- */
  mk('kael', { name: 'KAEL-09', title: 'Neon Blade Operative', owner: 'Mercenary', main: true, role: 'Melee skirmisher', hp: 140, dmg: 14, speed: 104, elem: 'tech',
    atk: [slash('atk1', 1, 0.8), slash('atk2', 1.2, 1.1, { combo: 2 })], heavy: { anim: 'heavy', kind: 'dash', dmg: 2.4, cd: 6 }, skill: { anim: 'skill1', kind: 'stunnova', dmg: 1.5, cd: 16, rad: 70, stun: 1.4 } });
  mk('velkhar', { name: 'VELKHAR', title: 'Lord of the Dead', owner: 'Dreadbloom', main: true, role: 'Caster', style: 'ranged', range: 150, hp: 120, dmg: 15, speed: 82, elem: 'magic',
    atk: [bolt('atk1', 1.1, 1.1), bolt('atk2', 0.8, 0.8)], heavy: { anim: 'heavy', kind: 'bolt', dmg: 2, cd: 7, rng: 170, heal: 0.25 }, skill: { anim: 'skill1', kind: 'summon', cd: 18, n: 2, life: 10 } });
  mk('inferna', { name: 'INFERNA', title: 'Abyssal Valkyrie', owner: 'Vexaria', main: true, role: 'Bruiser', hp: 190, dmg: 18, speed: 96, elem: 'fire',
    atk: [slash('atk1', 1, 0.9, { rng: 34 })], heavy: { anim: 'heavy', kind: 'dash', dmg: 2.6, cd: 7 }, skill: { anim: 'skill1', kind: 'nova', dmg: 1.8, cd: 15, rad: 72 } });
  mk('elowen', { name: 'ELOWEN', title: 'Guardian of the Moonlit Grove', owner: 'Enchantress', main: true, role: 'Healer', style: 'ranged', range: 120, hp: 130, dmg: 11, speed: 90, elem: 'toxic',
    atk: [slash('atk1', 1, 1, { rng: 32 }), bolt('atk2', 0.9, 1.2, { rng: 120 })], heavy: { anim: 'heavy', kind: 'nova', dmg: 1.4, cd: 8, rad: 60 }, skill: { anim: 'skill1', kind: 'heal', pct: 0.28, cd: 14, rad: 170 }, skill2: { anim: 'skill2', kind: 'stunnova', dmg: 0.8, cd: 20, rad: 80, stun: 1.8 } });
  mk('viper', { name: 'NEON VIPER', title: 'Cyberpunk Brawler', owner: 'Specter', main: true, role: 'Brawler', hp: 160, dmg: 13, speed: 108, elem: 'glitch',
    atk: [slash('atk1', 1, 0.6, { rng: 26 }), slash('atk2', 1.3, 0.9, { rng: 28, knock: 220 })], heavy: { anim: 'heavy', kind: 'dash', dmg: 2.2, cd: 6, knock: 320 }, skill: { anim: 'skill1', kind: 'slash', dmg: 2.4, cd: 12, rng: 34, stun: 1.2, knock: 380 } });
  mk('archangel', { name: 'ARCHANGEL COMMANDER', title: 'Celestial Warrior', owner: 'Stranger', main: true, role: 'Guardian', hp: 220, dmg: 16, speed: 98, elem: 'wind', guard: true, counter: true, rebirth: true,
    atk: [slash('atk1', 1, 0.9, { rng: 32 }), slash('atk2', 1.2, 1, { rng: 34 }), slash('atk3', 1.5, 1.3, { rng: 36 })], heavy: { anim: 'heavy', kind: 'nova', dmg: 2, cd: 8, rad: 70 }, skill: { anim: 'skill1', kind: 'shield', dmg: 1.2, cd: 20, rad: 80, shield: 45 } });

  /* ---- secret sidekicks ---- */
  mk('aurex', { name: 'AUREX', title: 'Dragonblood Champion', role: 'Fire bruiser', hp: 200, dmg: 20, elem: 'fire', unlock: 'Defeat a dragon boss (Ignis, Aurelis or Vorax)',
    atk: [slash('atk1', 1, 0.85), slash('atk2', 1.3, 1.1, { rng: 36 })], heavy: { anim: 'heavy', kind: 'nova', dmg: 2.2, cd: 8, rad: 74 }, skill: { anim: 'skill1', kind: 'nova', dmg: 1.6, cd: 14, rad: 84 } });
  mk('corvus', { name: 'CORVUS', title: 'Harbinger of Pestilence', role: 'Poison caster', style: 'ranged', range: 140, hp: 125, dmg: 13, elem: 'toxic', unlock: 'Defeat Glorp the Toxic Ooze or Mycelia',
    atk: [bolt('atk1', 1, 1), bolt('atk2', 1.1, 1.3)], heavy: { anim: 'heavy', kind: 'nova', dmg: 1.6, cd: 9, rad: 80 }, skill: { anim: 'skill1', kind: 'stunnova', dmg: 1, cd: 16, rad: 90, stun: 1.2 } });
  mk('kitsune', { name: 'CRIMSON KITSUNE EMPRESS', title: 'Fox Spirit Samurai', role: 'Duelist', speed: 112, hp: 140, dmg: 15, elem: 'fire', guard: true, unlock: 'Challenge: 25 perfect parries in one run',
    atk: [slash('atk1', 1, 0.6), slash('atk2', 1.3, 0.9)], heavy: { anim: 'heavy', kind: 'dash', dmg: 2.6, cd: 6 }, skill: { anim: 'skill1', kind: 'nova', dmg: 1.4, cd: 13, rad: 66 } });
  mk('oni', { name: 'CRIMSON ONI', title: 'Animated Samurai', role: 'Executioner', hp: 175, dmg: 19, elem: 'phys', unlock: 'Defeat Malkor the Pit Lord on Nightmare',
    atk: [slash('atk1', 1, 0.8), slash('atk2', 1.5, 1.2)], heavy: { anim: 'heavy', kind: 'dash', dmg: 3, cd: 8 }, skill: { anim: 'skill1', kind: 'slash', dmg: 3.2, cd: 14, rng: 40 } });
  mk('monk', { name: 'CRIMSON SHADOW MONK', title: 'Hidden Dojo Master', role: 'Brawler', speed: 112, hp: 150, dmg: 12, elem: 'fire', unlock: 'Found: a hidden dojo room (secret area)',
    atk: [slash('atk1', 0.8, 0.5, { rng: 24 }), slash('atk2', 1, 0.7, { rng: 26 }), slash('atk3', 1.3, 0.9, { rng: 28, knock: 200 })], heavy: { anim: 'heavy', kind: 'nova', dmg: 1.8, cd: 7, rad: 50, knock: 260 }, skill: { anim: 'skill1', kind: 'bolt', dmg: 2.2, cd: 10, rng: 160 } });
  mk('lich', { name: 'FROST LICH KING EMPEROR', title: 'Undead Frost Monarch', role: 'Frost caster', style: 'ranged', range: 140, hp: 160, dmg: 16, elem: 'ice', unlock: 'Defeat Frostmaw on the Frozen Pass',
    atk: [slash('atk1', 1, 1.1, { rng: 32 }), bolt('atk2', 1, 1.2)], heavy: { anim: 'heavy', kind: 'bolt', dmg: 2.4, cd: 8, rng: 170 }, skill: { anim: 'skill1', kind: 'stunnova', dmg: 1.4, cd: 15, rad: 100, stun: 1.8 } });
  mk('maldrath', { name: 'MALDRATH', title: 'The Fallen King', role: 'Greatsword bruiser', hp: 210, dmg: 21, speed: 88, elem: 'magic', unlock: 'Defeat the Skull King',
    atk: [slash('atk1', 1, 1, { rng: 36 }), slash('atk2', 1.4, 1.3, { rng: 38 })], heavy: { anim: 'heavy', kind: 'slash', dmg: 2.8, cd: 8, rng: 44 }, skill: { anim: 'skill1', kind: 'nova', dmg: 2, cd: 14, rad: 80 } });
  mk('morwen', { name: 'MORWEN', title: 'Witch of the Eclipse', role: 'Arcane caster', style: 'ranged', range: 150, hp: 120, dmg: 15, elem: 'magic', guard: true, unlock: "Defeat Nyx'ra the Void Eye at night",
    atk: [bolt('atk1', 1, 0.9), bolt('atk2', 1.2, 1.2)], heavy: { anim: 'heavy', kind: 'nova', dmg: 2, cd: 9, rad: 76 }, skill: { anim: 'skill1', kind: 'shield', dmg: 1.2, cd: 18, rad: 90, shield: 40 } });
  mk('nightrider', { name: 'NIGHT RIDER', title: 'Urban Biker', role: 'Skirmisher', speed: 118, hp: 150, dmg: 14, elem: 'tech', unlock: 'Found: a locked garage in the Outbreak City (key from a named unique)',
    atk: [slash('atk1', 1, 0.7)], heavy: { anim: 'heavy', kind: 'dash', dmg: 2.4, cd: 6 }, skill: { anim: 'heavy', kind: 'nova', dmg: 1.2, cd: 12, rad: 60 } });
  mk('raven', { name: 'RAVEN', title: 'The Executioner', role: 'Executioner', hp: 165, dmg: 19, elem: 'phys', unlock: 'Kill 100 elites (lifetime)',
    atk: [slash('atk1', 1, 0.85, { rng: 32 })], heavy: { anim: 'heavy', kind: 'slash', dmg: 3, cd: 8, rng: 42 }, skill: { anim: 'heavy', kind: 'dash', dmg: 3.2, cd: 12 } });
  mk('runegolem', { name: 'RUNE GOLEM', title: 'Guardian of the Lost Shrine', role: 'Tank', hp: 280, dmg: 15, speed: 80, r: 10, elem: 'earth', guard: true, unlock: 'Quest: restore the Lost Shrine (Act I event)',
    atk: [slash('atk1', 1, 1, { rng: 32, knock: 180 })], heavy: { anim: 'heavy', kind: 'nova', dmg: 2, cd: 8, rad: 66, knock: 280 }, skill: { anim: 'heavy', kind: 'shield', dmg: 0.8, cd: 20, rad: 80, shield: 60 } });

  SK.MAIN = SK.ORDER.filter((id) => SK.DEFS[id].main);
  SK.SECRET = SK.ORDER.filter((id) => !SK.DEFS[id].main);
  SK.mainFor = (heroId) => SK.MAIN.find((id) => SK.DEFS[id].owner === heroId) || SK.MAIN[0];

  /* ------------------------------------------------------------------ saved state: Storage.data.sidekicks */
  const sd = () => {
    const d = Storage.data;
    if (!d.sidekicks || typeof d.sidekicks !== 'object') d.sidekicks = { unlocked: [], pick: {} };
    return d.sidekicks;
  };
  SK.isUnlocked = (id) => !!SK.DEFS[id] && (SK.DEFS[id].main || sd().unlocked.includes(id));
  SK.unlock = (id, quiet) => {
    if (!SK.DEFS[id] || SK.isUnlocked(id)) return false;
    sd().unlocked.push(id);
    Storage.save();
    if (!quiet && G.ui && G.ui.toast) G.ui.toast('SIDEKICK UNLOCKED: ' + SK.DEFS[id].name);
    if (!quiet) Audio.sfx('levelup');
    return true;
  };
  SK.chosen = (heroId) => {
    const id = sd().pick[heroId];
    return id && SK.isUnlocked(id) ? id : SK.mainFor(heroId);
  };
  SK.choose = (heroId, id) => {
    if (!SK.isUnlocked(id)) return false;
    sd().pick[heroId] = id;
    Storage.save();
    return true;
  };

  /* ------------------------------------------------------------------ the actor */
  const meta = (id) => (CH.Assets.meta.sidekicks && CH.Assets.meta.sidekicks[id]) || null;
  const art = (s) => CH.Art.on && CH.Sprites.has('sk.' + s.id);

  SK.spawnFor = function (owner, id) {
    const d = SK.DEFS[id];
    if (!d) return null;
    const dep = Math.max(1, G.depth || G.wave || 1);
    const hp = Math.round(d.hp * (1 + 0.14 * (dep - 1)));
    const s = {
      id, d, owner, x: owner.x - 24, y: owner.y + 6, hp, maxHp: hp, level: 1, xp: 0, kills: 0, r: d.r, face: 1,
      state: 'move', anim: 'idle', at: 0, atk: null, cd: { a: 0.5, heavy: 2.5, skill: 4, skill2: 6, block: 0 }, ai: 0, tgt: null, hurtT: 0, invuln: 0, downT: 0,
      kx: 0, ky: 0, dash: null, alt: 0, reviveReady: true, bark: 0, t: Math.random() * 5,
    };
    SK.list.push(s);
    return s;
  };

  SK.reset = function () {
    SK.list.length = 0;
    if (!SK.enabled || (!G.run && !G.players.length)) return;
    for (const p of G.players) {
      if (!p.hero) continue;
      SK.spawnFor(p, SK.chosen(p.hero.id));
    }
  };
  wrap(CH.Meta, 'petsReset', function (orig) {
    const r = orig.apply(CH.Meta, arguments);
    SK.reset();
    return r;
  });

  const alive = (s) => s.state !== 'down';
  const dmgOf = (s, mul) => s.d.dmg * (mul || 1) * (1 + 0.08 * (s.level - 1)) * (1 + 0.1 * (Math.max(1, G.depth || G.wave || 1) - 1)) * (s.owner.stats ? s.owner.stats.dmgMult : 1);

  function nearestFor(s, range, from) {
    let best = null, bd = range * range;
    for (const e of G.enemies) {
      if (e.dead || e.hidden || e.state === 'spawn') continue;
      const dd = U.dist2(from.x, from.y, e.x, e.y);
      if (dd < bd) { bd = dd; best = e; }
    }
    return best;
  }

  function hit(s, e, dmg, o) {
    const was = e.dead;
    X.hitEnemy(e, dmg, s.owner, (o && o.elem) || s.d.elem);
    if (o && o.knock && e.knock && !e.isBoss) e.knock(Math.cos(U.ang(s.x, s.y, e.x, e.y)), Math.sin(U.ang(s.x, s.y, e.x, e.y)), o.knock);
    if (o && o.stun && e.stun && !e.isBoss) e.stun(o.stun);
    if (!was && e.dead) credit(s);
  }
  function credit(s) {
    s.kills++;
    s.xp++;
    if (s.xp >= 6 + 4 * s.level && s.level < 9) {
      s.xp = 0;
      s.level++;
      s.maxHp = Math.round(s.maxHp * 1.1);
      s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.25);
      FX.text(s.x, s.y - 30, s.d.name.split(' ')[0] + ' LV' + s.level, '#fee761', 1);
      FX.ring(s.x, s.y, 4, 30, '#fee761', 0.4);
    }
  }

  /* executes the effect of an attack on its keyframe */
  function strike(s, a, tgt) {
    const dm = dmgOf(s, a.dmg);
    const elem = s.d.elem;
    const ang = tgt ? U.ang(s.x, s.y, tgt.x, tgt.y) : s.face > 0 ? 0 : Math.PI;
    switch (a.kind) {
      case 'slash': {
        for (const e of G.enemies) {
          if (e.dead || e.state === 'spawn') continue;
          const d = U.dist(s.x, s.y, e.x, e.y);
          if (d > (a.rng || 30) + e.r) continue;
          if (Math.abs(U.angDiff(ang, U.ang(s.x, s.y, e.x, e.y))) > 1.2) continue;
          hit(s, e, dm, a);
        }
        FX.burst(s.x + Math.cos(ang) * 18, s.y + Math.sin(ang) * 18, { n: 5, colors: ['#ffffff', '#c2c3c7'], speed: 70, life: 0.25 });
        break;
      }
      case 'bolt': {
        if (!tgt || tgt.dead) break;
        X.beam && X.beam(s.x, s.y - 8, tgt.x, tgt.y, CH.Kit ? '#c2a3ff' : '#ffffff', 0.12);
        hit(s, tgt, dm, a);
        if (a.heal) G.healPlayer(s.owner.maxHp * a.heal * 0.4 / s.owner.stats.healMult / G.diff.heal, s.owner);
        break;
      }
      case 'nova':
      case 'stunnova': {
        const R = a.rad || 64;
        for (const e of G.enemies) if (!e.dead && e.state !== 'spawn' && U.dist(s.x, s.y, e.x, e.y) < R + e.r) hit(s, e, dm, a);
        FX.ring(s.x, s.y, 6, R, '#ffffff', 0.4);
        G.shake(2, 0.15);
        break;
      }
      case 'dash': {
        s.dash = { t: 0, dur: 0.22, x0: s.x, y0: s.y, x1: tgt ? tgt.x - Math.cos(ang) * 14 : s.x + Math.cos(ang) * 60, y1: tgt ? tgt.y - Math.sin(ang) * 14 : s.y + Math.sin(ang) * 60, a, dm };
        break;
      }
      case 'heal': {
        for (const p of G.players) if (!p.dead && U.dist(p.x, p.y, s.x, s.y) < (a.rad || 160)) G.healPlayer(p.maxHp * a.pct / p.stats.healMult / G.diff.heal, p);
        FX.ring(s.x, s.y, 6, a.rad || 160, '#63c74d', 0.5);
        FX.text(s.x, s.y - 30, 'SPIRIT SUMMON', '#63c74d', 1);
        break;
      }
      case 'summon': {
        for (let i = 0; i < (a.n || 2); i++) X.addTurret(s.x + U.rand(-24, 24), s.y + U.rand(-18, 18), { owner: s.owner, life: a.life || 10, rate: 0.5, dmg: Math.max(6, dm * 0.5) });
        FX.text(s.x, s.y - 30, 'RAISE!', '#c2a3ff', 1);
        break;
      }
      case 'shield': {
        for (const p of G.players) if (!p.dead && U.dist(p.x, p.y, s.x, s.y) < (a.rad || 80)) { p.buffs.shield = Math.max(p.buffs.shield || 0, 8); p.shield = Math.max(p.shield || 0, a.shield || 40); }
        for (const e of G.enemies) if (!e.dead && U.dist(s.x, s.y, e.x, e.y) < 60) hit(s, e, dm, a);
        FX.ring(s.x, s.y, 6, a.rad || 80, '#3ccbe6', 0.5);
        break;
      }
      default:
    }
  }

  /* start an attack: plays its animation, strikes on the keyframe */
  function begin(s, a, tgt, slot) {
    const n = (CH.Assets.meta.sidekicks && meta(s.id) && meta(s.id).anims[a.anim]) || 9;
    s.atk = { a, tgt, t: 0, dur: Math.max(0.35, n / 14), hitAt: 0, slot, done: false, left: a.combo || 1 };
    s.atk.hitAt = s.atk.dur * (a.kind === 'dash' ? 0.2 : 0.5);
    s.state = 'attack';
    s.anim = a.anim;
    s.at = 0;
    if (slot) s.cd[slot] = a.cd * (0.9 + Math.random() * 0.2);
    Audio.sfx(a.kind === 'bolt' ? 'magic' : 'swing');
  }

  /* ------------------------------------------------------------------ per-frame update */
  SK.update = function (dt) {
    for (const s of SK.list) {
      const o = s.owner;
      s.t += dt;
      s.at += dt;
      if (s.invuln > 0) s.invuln -= dt;
      if (s.hurtT > 0) s.hurtT -= dt;
      for (const k of Object.keys(s.cd)) if (s.cd[k] > 0) s.cd[k] -= dt;
      s.x += s.kx * dt;
      s.y += s.ky * dt;
      CH.Actor.decayKnock(s, dt, CH.Actor.KIND.sidekick.knockDecay);
      if (s.state === 'down') {
        s.downT -= dt;
        s.anim = 'death';
        if (s.downT <= 0 && !o.dead) {
          s.state = 'move';
          s.hp = Math.round(s.maxHp * 0.6);
          s.invuln = 1.5;
          FX.ring(s.x, s.y, 4, 26, '#fee761', 0.4);
        }
        continue;
      }
      if (o.dead) {
        // downed owner: stay close, and revive them after 6 seconds in co-op (see revive())
        followTo(s, o.x, o.y, dt, 20, 1.3);
        s.anim = s.moving ? 'walk' : 'idle';
        reviveChannel(s, o, dt);
        continue;
      }
      s.reviveT = 0;
      if (s.state === 'hurt') {
        if (s.at > 0.32) s.state = 'move';
        continue;
      }
      if (s.state === 'attack') {
        updateAttack(s, dt);
        continue;
      }
      if (s.dash) {
        s.state = 'move';
      }
      guard(s, dt);
      // target: the closest enemy near the owner
      s.ai -= dt;
      if (s.ai <= 0 || !s.tgt || s.tgt.dead) {
        s.ai = 0.25;
        s.tgt = nearestFor(s, s.d.aggro, o) || null;
      }
      const t = s.tgt;
      const dOwner = U.dist(s.x, s.y, o.x, o.y);
      if (t && dOwner < s.d.aggro + 90) {
        const dt2 = U.dist(s.x, s.y, t.x, t.y);
        const want = s.d.style === 'ranged' ? s.d.range * 0.75 : Math.max(8, (s.d.atk[0] ? s.d.atk[0].rng || 30 : 28) - 6);
        s.face = t.x >= s.x ? 1 : -1;
        if (dt2 > want + 6) followTo(s, t.x, t.y, dt, want, 1.15);
        else if (s.d.style === 'ranged' && dt2 < want * 0.5) followTo(s, s.x - (t.x - s.x), s.y - (t.y - s.y), dt, 0, 0.8);
        else { s.moving = false; s.anim = 'idle'; }
        // choose an attack
        if (dt2 <= (s.d.style === 'ranged' ? s.d.range : 70)) tryAttack(s, t, dt2);
      } else {
        // follow the owner at a comfortable distance, hurry when far behind
        const hurry = dOwner > 160 ? 1.7 : 1;
        if (dOwner > 440) {
          s.x = o.x - 20;
          s.y = o.y;
          FX.burst(s.x, s.y, { n: 8, colors: ['#ffffff', '#c2c3c7'], speed: 60, life: 0.3 });
        } else if (dOwner > 54) followTo(s, o.x, o.y, dt, 40, hurry);
        else { s.moving = false; }
        s.anim = s.moving ? (hurry > 1 ? 'run' : 'walk') : 'idle';
      }
      // a lunge in progress
      guardCounterTick(s, dt);
    }
    // dash movement resolved after the state machine
    for (const s of SK.list) if (s.dash) stepDash(s, dt);
    intake(dt);
  };

  function followTo(s, tx, ty, dt, stop, mul) {
    const dx = tx - s.x, dy = ty - s.y;
    const d = Math.hypot(dx, dy);
    if (d <= stop) { s.moving = false; return; }
    const sp = s.d.speed * (mul || 1);
    s.x += (dx / d) * sp * dt;
    s.y += (dy / d) * sp * dt;
    s.moving = true;
    if (Math.abs(dx) > 2) s.face = dx > 0 ? 1 : -1;
    s.anim = mul > 1.3 ? 'run' : 'walk';
    bounds(s);
  }
  function bounds(s) {
    CH.World.keepIn(s, s.r, G.arena);
    if (G.arena && G.arena.props) CH.World.collideProps(s, 'sidekick');
  }

  function tryAttack(s, t, dist) {
    const d = s.d;
    // skill first (long cooldown), then heavy, then the basic attacks
    if (d.skill2 && s.cd.skill2 <= 0 && dist < (d.skill2.rad || 90)) return begin(s, d.skill2, t, 'skill2');
    if (d.skill && s.cd.skill <= 0) {
      const k = d.skill.kind;
      const needsEnemies = k === 'nova' || k === 'stunnova' || k === 'shield' || k === 'slash';
      const close = G.enemies.filter((e) => !e.dead && U.dist(s.x, s.y, e.x, e.y) < (d.skill.rad || 70) + 10).length;
      if (k === 'heal') {
        const hurt = G.players.some((p) => !p.dead && p.hp < p.maxHp * 0.7 && U.dist(p.x, p.y, s.x, s.y) < (d.skill.rad || 160));
        if (hurt) return begin(s, d.skill, t, 'skill');
      } else if (k === 'summon' || k === 'bolt') return begin(s, d.skill, t, 'skill');
      else if (needsEnemies ? close >= 2 : dist < 80) return begin(s, d.skill, t, 'skill');
    }
    if (d.heavy && s.cd.heavy <= 0 && dist < (d.heavy.kind === 'dash' ? 120 : d.heavy.rng || d.heavy.rad || 90)) return begin(s, d.heavy, t, 'heavy');
    if (s.cd.a <= 0 && d.atk.length) {
      const a = d.atk[s.alt++ % d.atk.length];
      if (dist <= (a.rng || 30) + t.r + 6) begin(s, a, t, null), (s.cd.a = a.cd * (0.9 + Math.random() * 0.2));
    }
  }

  function updateAttack(s, dt) {
    const k = s.atk;
    k.t += dt;
    if (!k.done && k.t >= k.hitAt) {
      k.done = true;
      const tgt = k.tgt && !k.tgt.dead ? k.tgt : nearestFor(s, 120, s);
      if (tgt) s.face = tgt.x >= s.x ? 1 : -1;
      strike(s, k.a, tgt);
      if (k.left > 1) { k.left--; k.done = false; k.hitAt = k.t + k.dur * 0.25; }
    }
    if (k.t >= k.dur && !s.dash) {
      s.state = 'move';
      s.atk = null;
      s.at = 0;
    }
  }
  function stepDash(s, dt) {
    const d = s.dash;
    d.t += dt;
    const k = Math.min(1, d.t / d.dur);
    s.x = d.x0 + (d.x1 - d.x0) * k;
    s.y = d.y0 + (d.y1 - d.y0) * k;
    bounds(s);
    if (Math.random() < 0.6) FX.burst(s.x, s.y, { n: 1, colors: ['#ffffff', '#c2c3c7'], speed: 20, life: 0.2 });
    if (k >= 1) {
      s.dash = null;
      for (const e of G.enemies) if (!e.dead && e.state !== 'spawn' && U.dist(s.x, s.y, e.x, e.y) < 34 + e.r) hit(s, e, d.dm, d.a);
      FX.ring(s.x, s.y, 4, 30, '#ffffff', 0.25);
    }
  }

  /* ---- guardians: Divine Guard blocks shots aimed at the owner, Heavenly Counter answers melee hits ---- */
  function guard(s, dt) {
    if (!s.d.guard || s.cd.block > 0) return;
    const o = s.owner;
    if (U.dist(s.x, s.y, o.x, o.y) > 80) return;
    for (const pr of G.projectiles) {
      if (pr.owner !== 'e' || pr.dead) continue;
      if (U.dist(pr.x, pr.y, o.x, o.y) < 46 && U.dist(pr.x, pr.y, s.x, s.y) < 60) {
        pr.dead = true;
        s.cd.block = 0.9;
        s.blockT = 0.4;
        s.face = pr.x >= s.x ? 1 : -1;
        FX.ring(pr.x, pr.y, 3, 14, '#fee761', 0.25);
        FX.text(s.x, s.y - 26, 'BLOCKED', '#fee761', 1);
        Audio.sfx('shield');
        return;
      }
    }
  }
  function guardCounterTick(s, dt) {
    if (s.blockT > 0) {
      s.blockT -= dt;
      s.anim = 'block';
    }
  }
  G.on('hurtPlayer', function (ev) {
    const src = ev.src, r = ev.result;
    const p = (ev.o && ev.o.p) || G.player;
    if (r > 0 && src && src.x !== undefined) {
      for (const s of SK.list) {
        if (s.owner !== p || !s.d.counter || !alive(s) || s.cd.counter > 0) continue;
        const e = src.type !== undefined ? src : null;
        if (e && !e.dead && U.dist(e.x, e.y, s.x, s.y) < 90) {
          s.cd.counter = 4;
          hit(s, e, dmgOf(s, 2.2), { knock: 260, stun: 0.8 });
          FX.text(s.x, s.y - 26, 'COUNTER', '#fee761', 1);
          FX.ring(e.x, e.y, 4, 20, '#fee761', 0.3);
        }
      }
    }
  });

  /* ---- reviving the owner ---- */
  function reviveChannel(s, o, dt) {
    if (!G.coop || G.allDead()) return;
    if (U.dist(s.x, s.y, o.x, o.y) > 40) return;
    s.reviveT = (s.reviveT || 0) + dt;
    s.anim = 'skill1';
    if (s.reviveT >= 6) {
      s.reviveT = 0;
      G.revivePlayer(o, 0.4, o);
      FX.text(o.x, o.y - 26, s.d.name.split(' ')[0] + ' REVIVES YOU', '#fee761', 1);
    }
  }
  /* Heavenly Rebirth: an Archangel brings its owner straight back from a killing blow, once per stage */
  wrap(G, 'killPlayer', function (orig, p) {
    p = p || G.player;
    const s = p && SK.list.find((q) => q.owner === p && q.d.rebirth && alive(q) && q.reviveReady);
    if (s && !p.dead) {
      s.reviveReady = false;
      p.hp = Math.max(1, Math.round(p.maxHp * 0.5));
      p.invuln = 2.5;
      s.anim = 'revive';
      s.state = 'attack';
      s.atk = { a: { anim: 'revive', kind: 'shield', dmg: 1.5, cd: 0, rad: 90, shield: 50 }, tgt: null, t: 0, dur: 0.9, hitAt: 0.3, done: false, left: 1 };
      s.at = 0;
      FX.ring(p.x, p.y, 6, 70, '#fee761', 0.6);
      FX.text(p.x, p.y - 30, 'HEAVENLY REBIRTH', '#fee761', 2);
      Audio.sfx('levelup');
      return;
    }
    return orig.call(G, p);
  });
  /* once per stage / wave */
  G.on('startWave:before', function () {
    for (const s of SK.list) s.reviveReady = true;
  });

  /* ---- taking damage: enemy touch and enemy shots ---- */
  function hurtSK(s, dmg, src) {
    if (s.invuln > 0 || s.state === 'down') return;
    s.hp -= dmg;
    s.invuln = 0.5;
    s.hurtT = 0.3;
    FX.text(s.x, s.y - 20, '-' + Math.round(dmg), '#ff8fb8', 1);
    if (src && src.x !== undefined) CH.Actor.pushFrom(s, src, CH.Actor.KIND.sidekick.hitPush);
    if (s.hp <= 0) {
      s.state = 'down';
      s.downT = 25;
      s.atk = null;
      s.dash = null;
      FX.text(s.x, s.y - 26, s.d.name.split(' ')[0] + ' DOWN', '#e43b44', 2);
      Audio.sfx('hurt');
      return;
    }
    if (s.state !== 'attack') {
      s.state = 'hurt';
      s.anim = 'hurt';
      s.at = 0;
    }
  }
  SK.hurt = hurtSK;
  function intake(dt) {
    if (!SK.list.length) return;
    for (const s of SK.list) {
      if (s.state === 'down' || s.invuln > 0) continue;
      for (const e of G.enemies) {
        if (e.dead || !e.canTouch || !e.canTouch()) continue;
        if (U.dist(s.x, s.y, e.x, e.y) < e.r + s.r + 2) {
          hurtSK(s, e.touchDamage() * 0.55, e);
          e.contactCd = Math.max(e.contactCd, 0.8);
          break;
        }
      }
      for (const pr of G.projectiles) {
        if (pr.owner !== 'e' || pr.dead) continue;
        if (U.dist(pr.x, pr.y, s.x, s.y) < (pr.r || 4) + s.r) {
          hurtSK(s, (pr.dmg || 8) * 0.5, pr);
          pr.dead = true;
          break;
        }
      }
    }
  }

  /* enemies sometimes pick a sidekick over its owner: the closest one that is nearer than the hero */
  const E = CH.Enemies;
  const origTarget = E.target;
  E.target = function (g, e) {
    const base = origTarget(g, e);
    if (!SK.list.length || !base.isPlayer) return base;
    let best = null, bd = U.dist2(e.x, e.y, base.x, base.y) * 0.7;
    for (const s of SK.list) {
      if (s.state === 'down') continue;
      const dd = U.dist2(e.x, e.y, s.x, s.y);
      if (dd < bd && dd < 150 * 150) { bd = dd; best = s; }
    }
    return best ? { x: best.x, y: best.y, isPlayer: false, sk: best } : base;
  };

  G.on('step', function (dt) {
    if (SK.list.length && G.state === 'playing') SK.update(dt);
  });

  /* ------------------------------------------------------------------ drawing */
  SK.draw = function (ctx, s, cam) {
    const x = Math.round(s.x - cam.x);
    const y = Math.round(s.y - cam.y);
    const S = CH.Sprites;
    const name = 'sk.' + s.id;
    CH.Enemies.shadow(ctx, x, y + 12, 18);
    if (art(s)) {
      let anim = s.state === 'down' ? 'death' : s.state === 'hurt' ? 'hurt' : s.anim || 'idle';
      if (!S.get(name).anims[anim]) anim = 'idle';
      const strip = S.get(name).anims[anim];
      const loop = anim === 'idle' || anim === 'walk' || anim === 'run';
      const frame = loop ? S.frame(name, anim, s.t * (anim === 'idle' ? 1 : 1.2)) : S.frameAt(name, anim, Math.min(0.99, s.at / (s.atk ? s.atk.dur : s.state === 'down' ? 0.9 : 0.5)));
      const blink = s.state !== 'down' && CH.Actor.blink(s);
      S.draw(ctx, name, x, y + 13, { frame, flip: s.face < 0, alpha: s.state === 'down' ? 0.7 : blink ? 0.5 : 1 });
    } else {
      ctx.fillStyle = '#1b1226';
      ctx.fillRect(x - 5, y - 10, 11, 20);
      ctx.fillStyle = '#c2c3c7';
      ctx.fillRect(x - 4, y - 9, 9, 18);
    }
    // name + health, only when it matters (hurt, down or the owner is close)
    const show = s.hp < s.maxHp || s.state === 'down' || (s.owner && Math.hypot(s.owner.x - s.x, s.owner.y - s.y) < 70);
    if (show) {
      const bw = 26;
      ctx.fillStyle = '#1b1226';
      ctx.fillRect(x - bw / 2 - 1, y - 33, bw + 2, 5);
      ctx.fillStyle = s.state === 'down' ? '#5a5a6a' : '#e43b44';
      ctx.fillRect(x - bw / 2, y - 32, Math.max(0, Math.round((s.hp / s.maxHp) * bw)), 3);
      CH.Font.draw(ctx, s.state === 'down' ? 'DOWN' : s.d.name.split(' ')[0] + ' ' + s.level, x, y - 38, s.state === 'down' ? '#e43b44' : '#fee761', 1, true);
    }
  };
})(window.CH);
