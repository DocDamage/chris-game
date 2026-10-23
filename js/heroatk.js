/* CHAOS.exe - the heroes' own attacks (PLAN.md section 15, request 10). Every hero fights with the weapon its art
   carries: Dreadbloom's greatsword, Vexaria's blood saber, the Stranger's knife, the Mercenary's pulse gauntlet, the
   Enchantress's bow and the Specter's pistol. It is the main weapon (slot I); the junk weapons go to the second slot.
   An attack is its animation, not a timer: wind-up, the impact frame where the hit lands, recovery. Holding the button
   chains a three-hit combo whose last hit is the heavy animation (longer reach, more damage). Melee swings slow the hero,
   step forward, snap onto the nearest enemy in front, flinch and knock back what they hit and chop props; the heavy hit
   bats shots back. The ranged kits draw once and then keep firing from the aim pose. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const G = CH.G;
  const W = CH.Weapons;
  const Audio = CH.Audio;
  const X = CH.X;
  const Kit = CH.Kit;
  const S = CH.Sprites;
  const wrap = X.wrap;
  const HA = (CH.HeroAtk = {});

  /* hit: when the attack lands (fraction of its length, read off the strip's impact frame); frames: the slice of the
     strip it plays; reach / arc: melee range from the hero (px) and the swing's width (radians). The third hit of a
     combo uses `heavy` on top of the base values. */
  /* sounds: the swing of each weapon, and what a hit sounds like on flesh or on armour / stone */
  const SWING = { Dreadbloom: 'sword_heavy', Vexaria: 'saber', Stranger: 'knife', Mercenary: 'punch' };
  const ARMOURED = { golem: 1, fridge: 1, trashcan: 1, cart: 1 };
  const SIG = {
    Dreadbloom: {
      id: 'thornblade', name: 'Thornblade', icon: 'pu.360', kind: 'melee', elem: 'fire', dmg: 30, reach: 72, arc: 2.5, dur: 0.56, hit: 0.38, knock: 240, flinch: 0.22, step: 70,
      heavy: { anim: 'heavy', mult: 2.1, reach: 82, arc: 3.4, dur: 0.82, hit: 0.5, knock: 320, ring: 52 },
      blurb: 'Greatsword. Wide, heavy cleaves; every third swing is a blood-thorn ground strike.',
    },
    Vexaria: {
      id: 'moonsaber', name: 'Blood Moon Saber', icon: 'pu.47', kind: 'melee', elem: 'magic', dmg: 20, reach: 64, arc: 2.1, dur: 0.4, hit: 0.4, knock: 150, flinch: 0.16, step: 60,
      heavy: { anim: 'heavy', mult: 1.25, reach: 76, arc: 2.8, dur: 0.72, hits: [0.36, 0.52, 0.74], knock: 220, ring: 44 },
      blurb: 'Fast saber cuts; the third is a flurry that ends in a blood burst.',
    },
    Stranger: {
      id: 'grinshiv', name: 'Grinning Shiv', icon: 'pu.463', kind: 'melee', elem: 'phys', dmg: 17, reach: 56, arc: 1.8, dur: 0.36, hit: 0.62, knock: 110, flinch: 0.14, step: 90, backstab: 1.6,
      heavy: { anim: 'heavy', mult: 2.2, reach: 66, arc: 2.0, dur: 0.56, hit: 0.55, knock: 200, step: 150 },
      blurb: 'A knife. Quick lunges, +60% against feared enemies; the third hit is a long lunge.',
    },
    Mercenary: {
      id: 'pulsefist', name: 'Pulse Gauntlet', icon: 'pu.98', kind: 'pulse', elem: 'tech', dmg: 15, reach: 50, arc: 1.7, dur: 0.42, hit: 0.5, knock: 170, flinch: 0.16, step: 50,
      wave: { dmg: 12, speed: 300, range: 135 },
      heavy: { anim: 'heavy', mult: 1.8, reach: 60, arc: 2.2, dur: 0.66, hit: 0.64, knock: 300, cone: { range: 120, arc: 1.1 } },
      blurb: 'Energy punches that throw a short pulse wave; the third hit is a point-blank blast.',
    },
    Enchantress: {
      id: 'moonbow', name: 'Moonwood Bow', icon: 'pu.100', kind: 'bow', elem: 'wind', dmg: 22, dur: 0.62, hit: 0.78, speed: 380, range: 360, pierce: 1, again: [3, 12],
      heavy: { anim: 'heavy', mult: 2.3, dur: 0.6, hit: 0.78, pierce: 5, scale: 1.4 },
      blurb: 'A bow. The first draw is slow, then arrows fly from the aim; every third is a piercing charged shot.',
    },
    Specter: {
      id: 'neonpistol', name: 'Neon Repeater', icon: 'pu.96', kind: 'gun', elem: 'bolt', dmg: 9, dur: 0.44, hit: 0.7, speed: 430, range: 320, again: [9, 13], rate: 0.17,
      heavy: { anim: 'attack', mult: 1, dur: 0.3, hit: 0.5, spread: 3 },
      blurb: 'A pistol. Draws once, then fires fast while you hold; every sixth shot is a three-bolt burst.',
    },
  };
  HA.SIG = SIG;
  HA.byWeapon = {};
  for (const hero of Object.keys(SIG)) {
    const d = SIG[hero];
    d.hero = hero;
    HA.byWeapon[d.id] = d;
    // a real weapon entry, so levels, damage scaling, the HUD and the Journal treat it like the others
    B.weapons[d.id] = { name: d.name, dmg: d.dmg, cd: d.rate || d.dur, ammo: 0, reload: 0, range: d.reach || d.range, sig: hero };
    W.names[d.id] = d.name;
  }
  HA.isSig = (id) => !!HA.byWeapon[id];
  HA.sigOf = (p) => SIG[p.hero && p.hero.id];

  /* the junk weapon icons are the held sprites; signature weapons show their item icon */
  const iconOf = W.iconSprite;
  W.iconSprite = (id) => (HA.byWeapon[id] ? HA.byWeapon[id].icon : iconOf(id));

  /* every hero starts with their own weapon in slot I and the Junk Launcher in slot II */
  X.ownerHooks.unshift((g, p) => {
    const d = HA.sigOf(p);
    if (!d) return;
    if (!p.weapons.includes(d.id)) p.weapons.unshift(d.id);
    p.ws[d.id] = p.ws[d.id] || W.newState(d.id);
    if (p.weapon !== d.id) {
      if (p.weapon && p.weapon !== d.id) p.weapon2 = p.weapon;
      p.weapon = d.id;
    }
    p.combo = 0;
    p.atk = null;
  });
  /* a weapon found later goes to slot II, so the hero's own weapon stays in hand */
  wrap(CH.Player.prototype, 'addWeapon', function (orig, id) {
    const d = HA.sigOf(this);
    if (!d || this.weapon !== d.id || HA.isSig(id)) return orig.call(this, id);
    if (!this.weapons.includes(id)) {
      this.weapons.push(id);
      this.ws[id] = this.ws[id] || W.newState(id);
    }
    this.weapon2 = id;
  });

  /* ------------------------------------------------------------------ starting an attack */
  const atkSpeed = (p, id) => {
    const lvl = (p.ws[id] && p.ws[id].level) || 1;
    return (p.buffs.haste > 0 ? 1.25 : 1) * (p.buffs.focus > 0 ? 1.3 : 1) * ((p.stats && p.stats.fireRate) || 1) * (1 + (lvl - 1) * 0.05) * ((p.stats && p.stats.atkSpeed) || 1);
  };
  /* the nearest enemy in front of the aim, for the melee snap (a light auto-target, as in Diablo) */
  function snapTarget(g, p, ang, reach) {
    let best = null, bs = 1e9;
    for (const e of g.enemies) {
      if (e.dead || e.state === 'spawn' || e.hidden) continue;
      const d = U.dist(p.x, p.y - 4, e.x, e.y);
      if (d > reach + e.r + 22) continue;
      const da = Math.abs(U.angDiff(ang, U.ang(p.x, p.y - 4, e.x, e.y)));
      if (da > 1.05) continue;
      const sc = d + da * 40;
      if (sc < bs) { bs = sc; best = e; }
    }
    return best;
  }

  function start(g, p, id) {
    const d = HA.byWeapon[id];
    const ws = p.ws[id];
    const sheet = S.has('hero.' + p.hero.id) ? S.get('hero.' + p.hero.id) : null;
    const chain = p.atkEnd !== undefined && g.time - p.atkEnd < 0.45;
    p.combo = chain ? (p.combo || 0) + 1 : 1;
    let heavy = false;
    if (d.kind === 'gun') heavy = p.combo % 6 === 0;
    else heavy = p.combo % 3 === 0;
    const h = heavy ? d.heavy : null;
    const sp = atkSpeed(p, id);
    // ranged kits that are already drawn skip the draw frames
    const drawn = chain && d.again && !heavy;
    let dur = (h ? h.dur : drawn ? d.rate || d.dur * 0.68 : d.dur) / sp;
    const anim = h ? h.anim : 'attack';
    const a = sheet && sheet.anims[anim];
    const n = a ? a.n : 1;
    const from = drawn ? Math.min(n - 1, d.again[0]) : 0;
    const to = drawn ? Math.min(n - 1, d.again[1]) : n - 1;
    const hits = h && h.hits ? h.hits.slice() : [h ? h.hit : drawn ? 0.5 : d.hit];
    let ang = p.aim;
    if (d.kind === 'melee' || d.kind === 'pulse') {
      const t = snapTarget(g, p, ang, ((h && h.reach) || d.reach) * stat(p, 'reachMul', 1));
      if (t) ang = U.ang(p.x, p.y - 4, t.x, t.y);
    }
    p.atk = { id, d, h, heavy, t: 0, dur, hits, done: 0, ang, anim, from, to, combo: p.combo, struck: false };
    ws.cd = dur;
    p.heldWeapon = id;
    p.fireT = 0;
    if (d.kind === 'melee' || d.kind === 'pulse') {
      Audio.sfx(heavy && d.hero === 'Dreadbloom' ? 'sword_heavy' : heavy && d.hero !== 'Mercenary' ? 'sword_light' : SWING[d.hero] || 'swing');
      // a step into the swing
      const st = (h && h.step) || d.step || 50;
      p.kx += Math.cos(ang) * st;
      p.ky += Math.sin(ang) * st;
    } else if (!drawn) Audio.sfx(d.kind === 'bow' ? 'bow_draw' : 'reload');
    return true;
  }

  wrap(W, 'tryFire', function (orig, g, p, which) {
    const id = which || p.weapon;
    if (!HA.isSig(id)) {
      const r = orig.call(W, g, p, which);
      if (r) p.quick = { t: 0, dur: 0.24 }; // a junk weapon: a short throw pose instead of the whole sword swing
      return r;
    }
    const ws = p.ws[id];
    if (!ws || ws.cd > 0 || p.cast || p.rolling) return false;
    if (p.atk && p.atk.t < p.atk.dur) return false;
    W.shooter = p;
    return start(g, p, id);
  });

  /* ------------------------------------------------------------------ the hit */
  const stat = (p, k, def) => (p.stats && p.stats[k] !== undefined ? p.stats[k] : def);
  HA.reach = (p, A) => ((A.h && A.h.reach) || A.d.reach) * stat(p, 'reachMul', 1);
  HA.arc = (p, A) => ((A.h && A.h.arc) || A.d.arc) * stat(p, 'arcMul', 1);
  /* damage of a signature hit: weapon base x Honed x heavy finisher x Momentum (each hit of a chain adds a little) */
  HA.dmg = (p, A) => W.baseDamage(p, A.id) * stat(p, 'sigDmg', 1) * ((A.h && A.h.mult) || 1) * (A.heavy ? stat(p, 'heavyMul', 1) : 1) * (1 + stat(p, 'comboStep', 0) * Math.min(5, (A.combo || 1) - 1));
  function meleeHit(g, p, A) {
    const d = A.d, h = A.h || {};
    const reach = HA.reach(p, A);
    const arc = HA.arc(p, A);
    const t = snapTarget(g, p, A.ang, reach);
    if (t && !A.struck) A.ang = U.ang(p.x, p.y - 4, t.x, t.y);
    const ang = A.ang;
    const base = HA.dmg(p, A);
    const cx = p.x, cy = p.y - 4;
    let n = 0;
    for (const e of g.enemies) {
      if (e.dead || e.state === 'spawn' || e.hidden) continue;
      const dd = U.dist(cx, cy, e.x, e.y);
      if (dd > reach + e.r) continue;
      const ea = U.ang(cx, cy, e.x, e.y);
      if (Math.abs(U.angDiff(ang, ea)) > arc / 2 + (e.r / Math.max(8, dd)) * 0.9) continue;
      const crit = Math.random() < p.stats.critChance;
      let dmg = base * (crit ? B.player.critMult : 1) * (g.mods.bigHead ? 1.3 : 1);
      if (d.backstab && e.fearT > 0) dmg *= d.backstab;
      g.damageEnemy(e, dmg, { crit, kx: Math.cos(ea), ky: Math.sin(ea), kf: h.knock || d.knock, stun: d.flinch, src: 'player', elem: d.elem, shooter: p });
      if (n < 2) Audio.sfx(ARMOURED[e.type] || e.isBoss ? 'clang' : A.heavy || crit ? 'hit_heavy' : 'hit_flesh');
      n++;
    }
    // chop trees and break props in the arc
    if (g.arena && g.arena.props) for (const prop of g.arena.props) {
      if (prop.dead || prop.falling || (!prop.choppable && !prop.destructible && prop.kind !== 'tree')) continue;
      const dd = U.dist(cx, cy, prop.x, prop.y);
      if (dd > reach + (prop.cr || 10)) continue;
      if (Math.abs(U.angDiff(ang, U.ang(cx, cy, prop.x, prop.y))) > arc / 2 + 0.4) continue;
      W.damageProp(g, prop, base * 1.3, p);
      n++;
    }
    if (A.heavy) {
      g.deflectProjectiles(cx, cy, reach + 6, ang, arc, p);
      if (h.ring) { // the heavy hit shakes the ground around the blade's end
        const rx = cx + Math.cos(ang) * reach * 0.6, ry = cy + Math.sin(ang) * reach * 0.6;
        Kit.impact(d.elem, rx, ry + 4, h.ring * 0.6);
        g.shake(4, 0.2);
        for (const e of g.enemies) if (!e.dead && e.state !== 'spawn' && U.dist(rx, ry, e.x, e.y) < h.ring + e.r) e.stun && !e.isBoss && e.stun(0.3);
      }
    }
    Kit.slash(d.elem, cx + Math.cos(ang) * 6, cy + Math.sin(ang) * 6, ang, reach * 0.62, { alpha: 0.9, flip: A.combo % 2 === 0 });
    if (n) {
      if (A.heavy) Audio.sfx('slam');
      g.shake(A.heavy ? 3.5 : 2, 0.1);
      X.hitStop(A.heavy ? 0.07 : 0.04);
    }
    return n;
  }

  function pulseHit(g, p, A) {
    meleeHit(g, p, A);
    const d = A.d;
    if (A.heavy && A.h.cone) { // point-blank blast: everything in a cone ahead
      const c = A.h.cone, base = HA.dmg(p, A) * 0.8;
      for (const e of g.enemies) {
        if (e.dead || e.state === 'spawn') continue;
        const dd = U.dist(p.x, p.y - 4, e.x, e.y);
        if (dd > c.range + e.r || Math.abs(U.angDiff(A.ang, U.ang(p.x, p.y - 4, e.x, e.y))) > c.arc) continue;
        g.damageEnemy(e, base, { kx: Math.cos(A.ang), ky: Math.sin(A.ang), kf: 260, src: 'player', elem: 'tech', shooter: p, lite: true });
      }
      Kit.beam('tech', p.x, p.y - 6, A.ang, c.range, 18, { alpha: 0.8 });
      Audio.sfx('shock');
      return;
    }
    // a short pulse wave flies on from the fist
    const w = d.wave, sp = w.speed * ((p.stats && p.stats.projSpeed) || 1);
    g.spawnProjectile({ owner: 'p', kind: 'pulse', x: p.x + Math.cos(A.ang) * 12, y: p.y - 6 + Math.sin(A.ang) * 12, ang: A.ang, speed: sp, r: 6, dmg: HA.dmg(p, A) * (w.dmg / d.dmg), life: (w.range * stat(p, 'reachMul', 1)) / sp, sprite: 'fx.pulsewave', face: true, pierce: 2, knock: 80, shooter: p });
    Audio.sfx('magic');
  }

  function rangedHit(g, p, A) {
    const d = A.d, h = A.h || {};
    const base = HA.dmg(p, A);
    const rm = stat(p, 'reachMul', 1);
    const sp = d.speed * ((p.stats && p.stats.projSpeed) || 1) * Math.sqrt(rm);
    const n = (h.spread || 1) + ((p.stats && p.stats.extraProj) || 0);
    const mx = p.x + Math.cos(A.ang) * 12, my = p.y - 8 + Math.sin(A.ang) * 12;
    for (let i = 0; i < n; i++) {
      const a = p.aim + (i - (n - 1) / 2) * 0.13 + (d.kind === 'gun' ? U.rand(-0.03, 0.03) : 0);
      const crit = Math.random() < p.stats.critChance;
      const bow = d.kind === 'bow';
      g.spawnProjectile({
        owner: 'p', kind: bow ? 'arrow' : 'neon', x: mx, y: my, ang: a, speed: sp, r: bow ? 3 : 2.5, dmg: base * (crit ? B.player.critMult : 1), crit,
        life: (d.range * rm) / sp, sprite: bow ? 'fx.arrow1' : 'fx.neonbolt', animFps: 0, scale: bow ? h.scale || 1 : 1, face: true,
        pierce: (h.pierce !== undefined ? h.pierce : d.pierce || 0) + stat(p, 'pierceAdd', 0), knock: bow ? 70 : 35, trail: bow ? 'ice' : null, shooter: p,
      });
    }
    Kit.muzzle(d.elem, mx, my, A.ang, A.heavy ? 9 : 6, { force: true });
    Audio.sfx(d.kind === 'bow' ? 'arrow' : 'pistol');
    if (A.heavy) g.shake(2, 0.08);
  }

  function land(g, p, A) {
    const k = A.d.kind;
    if (k === 'melee') meleeHit(g, p, A);
    else if (k === 'pulse') pulseHit(g, p, A);
    else rangedHit(g, p, A);
    A.struck = true;
    p.shots = (p.shots || 0) + 1;
  }

  /* per frame: advance the attack, land its hits, slow the hero while swinging */
  const SLOW = { melee: [0.32, 0.65], pulse: [0.4, 0.7], bow: [0.55, 0.75], gun: [0.8, 0.9] };
  wrap(CH.Player.prototype, 'update', function (orig, g, dt) {
    const p = this;
    const A = p.atk;
    if (p.quick) { p.quick.t += dt; if (p.quick.t >= p.quick.dur) p.quick = null; }
    if (!A || p.dead) return orig.call(this, g, dt);
    if (p.rolling || p.cast) { p.atk = null; p.atkEnd = g.time; return orig.call(this, g, dt); }
    const sm = p.stats.speedMult;
    const sl = SLOW[A.d.kind] || [1, 1];
    p.stats.speedMult = sm * (A.done < A.hits.length ? sl[0] : sl[1]);
    try { orig.call(this, g, dt); } finally { p.stats.speedMult = sm; }
    if (p.atk !== A) return;
    A.t += dt;
    while (A.done < A.hits.length && A.t >= A.hits[A.done] * A.dur) {
      A.done++;
      land(g, p, A);
    }
    p.face = Math.cos(A.ang) >= 0 ? 1 : -1;
    if (A.d.kind !== 'melee' && A.d.kind !== 'pulse') A.ang = p.aim; // ranged attacks follow the aim
    if (A.t >= A.dur) {
      p.atk = null;
      p.atkEnd = g.time;
    }
  });

  /* ------------------------------------------------------------------ drawing */
  /* the frame of the hero's sheet for the current attack (null when not attacking) */
  HA.frame = function (p) {
    const A = p.atk;
    if (!A) return null;
    const name = 'hero.' + p.hero.id;
    if (!S.has(name)) return null;
    const a = S.get(name).anims[A.anim] || S.get(name).anims.attack;
    if (!a) return null;
    const k = U.clamp(A.t / A.dur, 0, 0.999);
    const i = Math.min(A.to, A.from + Math.floor(k * (A.to - A.from + 1)));
    return { frame: a.s + i, flip: Math.cos(A.ang) < 0 };
  };
  /* a bright arc at the blade's reach while the swing is live: shows how far the sword goes */
  HA.drawArc = function (ctx, p, cam) {
    const A = p.atk;
    if (!A || (A.d.kind !== 'melee' && A.d.kind !== 'pulse')) return;
    const reach = HA.reach(p, A), arc = HA.arc(p, A);
    const hit0 = A.hits[0] * A.dur;
    const k = (A.t - hit0 * 0.7) / Math.max(0.05, A.dur * 0.35);
    if (k < 0 || k > 1) return;
    const x = p.x - cam.x, y = p.y - 4 - cam.y;
    const dir = A.combo % 2 === 0 ? -1 : 1;
    const a0 = A.ang - (arc / 2) * dir, a1 = A.ang + (arc / 2) * dir;
    const head = Math.min(1, k * 1.6);
    const cols = A.heavy ? ['#ffffff', '#ffd6d6', '#e43b44'] : ['#ffffff', '#fff3d6', HA.color(p)];
    ctx.globalAlpha = 1 - k * 0.8;
    for (let band = 0; band < 3; band++) {
      ctx.fillStyle = cols[band];
      const rad = reach - 3 - band * 4;
      const steps = Math.ceil(arc * rad * 0.6);
      for (let i = 0; i <= steps * head; i++) {
        const t = i / steps;
        if (t < k * 0.6 && band > 0) continue; // the tail fades first
        const aa = a0 + (a1 - a0) * t;
        const sz = band === 0 ? 2 : 1;
        ctx.fillRect(Math.round(x + Math.cos(aa) * rad), Math.round(y + Math.sin(aa) * rad * 0.8), sz, sz);
      }
    }
    ctx.globalAlpha = 1;
  };
  const COLORS = { Dreadbloom: '#e43b44', Vexaria: '#ff4f7a', Stranger: '#c2c3c7', Mercenary: '#3ccbe6', Enchantress: '#63c74d', Specter: '#29adff' };
  HA.color = (p) => COLORS[p.hero && p.hero.id] || '#fee761';
  wrap(W, 'drawSwing', function (orig, ctx, p, cam) {
    HA.drawArc(ctx, p, cam);
    return orig.call(W, ctx, p, cam);
  });

  wrap(CH.Art, 'register', function (orig) {
    const r = orig.call(CH.Art);
    HA.init();
    return r;
  });

  /* projectile art the packs do not have: a neon bolt and the gauntlet's pulse wave */
  HA.init = function () {
    if (!S.has('fx.neonbolt')) {
      const c = document.createElement('canvas');
      c.width = 11;
      c.height = 3;
      const x = c.getContext('2d');
      x.fillStyle = '#ff77a8'; x.fillRect(0, 1, 4, 1);
      x.fillStyle = '#29adff'; x.fillRect(3, 0, 6, 3);
      x.fillStyle = '#ffffff'; x.fillRect(5, 1, 6, 1);
      S.fromFrames('fx.neonbolt', [c], {});
    }
    if (!S.has('fx.pulsewave')) {
      const c = document.createElement('canvas');
      c.width = 8;
      c.height = 14;
      const x = c.getContext('2d');
      for (let i = 0; i < 14; i++) {
        const o = Math.round(Math.abs(i - 6.5) * 0.55);
        x.fillStyle = i % 3 ? '#3ccbe6' : '#ffffff';
        x.fillRect(4 - o, i, 2, 1);
        x.fillStyle = 'rgba(60,203,230,0.5)';
        x.fillRect(2 - o, i, 2, 1);
      }
      S.fromFrames('fx.pulsewave', [c], {});
    }
  };
})(window.CH);
