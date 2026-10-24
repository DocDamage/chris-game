/* CHAOS.exe - the six weapons, projectile simulation and held-weapon rendering. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const Audio = CH.Audio;

  const W = (CH.Weapons = {});

  const JUNK = ['junk0', 'junk1', 'junk2', 'junk3', 'junk4', 'junk5'];
  const HELD = { junk: 'junk_launcher', chicken: 'chicken_cannon', pizza: 'pizza_box', baguette: 'baguette', chair: 'chair_icon', problem: 'problem_icon' };
  W.iconSprite = (id) => HELD[id];
  W.names = {};
  for (const id of B.weaponOrder) W.names[id] = B.weapons[id].name;

  W.newState = (id) => ({ cd: 0, ammo: B.weapons[id].ammo, reload: 0, level: 1 });

  W.cooldown = (p, id) => {
    const lvl = p.ws[id].level;
    let cd = B.weapons[id].cd * Math.max(0.4, 1 - (lvl - 1) * B.weaponLevelCd);
    if (p.buffs.haste > 0) cd /= 1.3;
    if (p.buffs.focus > 0) cd /= 1.35;
    return cd;
  };

  W.baseDamage = (p, id) => {
    const lvl = p.ws[id].level;
    let d = B.weapons[id].dmg * p.stats.dmgMult * (1 + (lvl - 1) * B.weaponLevelDmg);
    if (p.buffs.rage > 0) d *= 1.5;
    if (p.hp / p.maxHp < B.player.lowHpThreshold) d *= 1 + p.stats.lowHpBonus;
    return d;
  };

  W.startReload = (p, id) => {
    const d = B.weapons[id];
    const ws = p.ws[id];
    if (!d.ammo || ws.reload > 0 || ws.ammo >= d.ammo) return false;
    ws.reload = d.reload / ((p.stats && p.stats.reloadMult) || 1);
    Audio.sfx('reload');
    return true;
  };

  W.updateStates = (p, dt) => {
    for (const id of p.weapons) {
      const ws = p.ws[id];
      if (ws.cd > 0) ws.cd -= dt;
      if (ws.reload > 0) {
        ws.reload -= dt * (p.buffs.haste > 0 ? 1.3 : 1) * (p.buffs.focus > 0 ? 1.35 : 1);
        if (ws.reload <= 0) {
          ws.reload = 0;
          ws.ammo = B.weapons[id].ammo;
        }
      }
    }
  };

  /* ---------- firing ---------- */
  function angles(p, base, step) {
    const n = 1 + p.stats.extraProj;
    const out = [];
    for (let i = 0; i < n; i++) out.push(base + (i - (n - 1) / 2) * step);
    return out;
  }
  const mz = (p, a, d) => ({ x: p.x + Math.cos(a) * (d || 9), y: p.y - 8 + Math.sin(a) * (d || 9) });

  /* fire one of the player's weapons (primary by default; the secondary slot passes its own id) */
  W.tryFire = function (g, p, which) {
    const id = which || p.weapon;
    const d = B.weapons[id];
    const ws = p.ws[id];
    if (!ws || ws.reload > 0 || ws.cd > 0) return false;
    W.shooter = p;
    p.heldWeapon = id;
    if (d.ammo > 0 && ws.ammo <= 0) {
      W.startReload(p, id);
      return false;
    }
    ws.cd = W.cooldown(p, id);
    if (d.ammo > 0) {
      ws.ammo--;
      if (ws.ammo <= 0) W.startReload(p, id);
    }
    const a = p.aim + (p.distractT > 0 ? U.rand(-0.22, 0.22) : 0);
    FIRE[id](g, p, d, a);
    if (id !== 'baguette') {
      const mx = p.x + Math.cos(a) * 11;
      const my = p.y - 8 + Math.sin(a) * 11;
      Kit.muzzle(Kit.byWeapon[id], mx, my, a, 7, { force: true });
      Kit.heroMuzzle(p, mx, my, a);
    }
    p.kick = id === 'baguette' ? 0 : 3;
    p.fireT = 0.22;
    if (id === 'chair' || id === 'pizza') CH.Input.rumbleFor(p.inp, 0.15, 0.35, 70);
    return true;
  };

  const Kit = CH.Kit;
  const FIRE = {
    junk(g, p, d, a) {
      Audio.sfx('shoot_junk');
      const base = W.baseDamage(p, 'junk');
      for (const ang of angles(p, a, 0.17)) {
        const sp = d.speed * p.stats.projSpeed;
        const m = mz(p, ang);
        const aa = ang + U.rand(-d.spread, d.spread);
        g.spawnProjectile({ owner: 'p', kind: 'junk', x: m.x, y: m.y, ang: aa, speed: sp, r: d.r, dmg: base, life: d.range / sp, sprite: U.pick(JUNK), spin: U.rand(-14, 14), knock: 70, trail: 'junk' });
      }
    },

    chicken(g, p, d, a) {
      Audio.sfx('shoot_chicken');
      const base = W.baseDamage(p, 'chicken');
      for (const ang of angles(p, a, 0.2)) {
        const sp = d.speed * p.stats.projSpeed;
        const m = mz(p, ang);
        g.spawnProjectile({
          owner: 'p', kind: 'chicken', x: m.x, y: m.y, ang, speed: sp, r: d.r, dmg: base, life: d.range / sp + 0.6, sprite: 'chicken_proj', spin: 10, face: true,
          bounces: d.bounces, wallBounce: 2, knock: 40, trail: 'goo',
          onHit(g, pr, e) {
            const kb = Math.random() < d.knockChance;
            W.hit(g, pr, e, { knock: kb ? d.knock : 30, stun: kb ? 0.2 : 0 });
            Audio.sfx('squeak');
            if (pr.bounces > 0) {
              let best = null;
              let bd = d.bounceRange * d.bounceRange;
              for (const o of g.enemies) {
                if (o.dead || o === e || pr.hits.has(o) || o.state === 'spawn') continue;
                const dd = U.dist2(pr.x, pr.y, o.x, o.y);
                if (dd < bd) {
                  bd = dd;
                  best = o;
                }
              }
              if (best) {
                const na = U.ang(pr.x, pr.y, best.x, best.y);
                pr.vx = Math.cos(na) * pr.speed;
                pr.vy = Math.sin(na) * pr.speed;
                pr.bounces--;
                pr.life = Math.max(pr.life, 1.2);
                return 'pass';
              }
            }
            return 'die';
          },
        });
      }
    },

    pizza(g, p, d, a) {
      Audio.sfx('shoot_pizza');
      const base = W.baseDamage(p, 'pizza');
      const boom = (g, pr) => {
        const R = d.radius * p.stats.explMult;
        g.explode(pr.x, pr.y, R, pr.dmg, { owner: 'p', colors: 'cheese', knock: 120, crit: true, shooter: p });
        g.addZone({ kind: 'cheese', x: pr.x, y: pr.y, r: R * 0.75, life: d.cheeseTime, slowE: d.cheeseSlow });
      };
      for (const ang of angles(p, a, 0.2)) {
        const sp = d.speed * p.stats.projSpeed;
        const m = mz(p, ang);
        g.spawnProjectile({ owner: 'p', kind: 'pizza', x: m.x, y: m.y, ang, speed: sp, r: d.r, dmg: base, life: d.range / sp, sprite: 'pizza', spin: 9, trail: 'cheese', onHit: (g, pr) => (boom(g, pr), 'die'), onEnd: boom });
      }
    },

    baguette(g, p, d, a) {
      Audio.sfx('swing_bread');
      const arc = d.arc + p.stats.extraProj * 0.45;
      const range = d.range + p.stats.extraProj * 5;
      p.swing = { t: 0, dur: d.swing, ang: a, arc, range, dir: p.swingDir ? -1 : 1 };
      Kit.slash('wind', p.x, p.y - 8, a, range * 0.6);
      Kit.slash(Kit.heroElem(p), p.x, p.y - 8, a, range * 0.5, { alpha: 0.7, flip: p.swingDir });
      p.swingDir = !p.swingDir;
      const base = W.baseDamage(p, 'baguette');
      let hitAny = false;
      for (const e of g.enemies) {
        if (e.dead || e.state === 'spawn') continue;
        const dd = Math.hypot(e.x - p.x, e.y - p.y);
        if (dd > range + e.r) continue;
        const ea = U.ang(p.x, p.y, e.x, e.y);
        if (Math.abs(U.angDiff(a, ea)) > arc / 2 + (e.r / Math.max(8, dd)) * 0.9) continue;
        const crit = Math.random() < p.stats.critChance;
        let dmg = base * (crit ? B.player.critMult : 1) * (g.mods.bigHead ? 1.4 : 1);
        g.damageEnemy(e, dmg, { crit, kx: Math.cos(ea), ky: Math.sin(ea), kf: d.knock, stun: 0.3, src: 'player', elem: 'wind', shooter: p });
        FX.burst(e.x, e.y, { n: 8, colors: 'crumb', speed: 90, life: 0.4, angle: ea, spread: 0.9, drag: 3 });
        hitAny = true;
      }
      // Chop trees and break props with baguette melee
      if (g.arena && g.arena.props) {
        for (const prop of g.arena.props) {
          if (prop.dead || prop.falling || (!prop.choppable && !prop.destructible && prop.kind !== 'tree')) continue;
          const dd = Math.hypot(prop.x - p.x, prop.y - p.y);
          if (dd > range + (prop.cr || 10) + 6) continue;
          const ea = U.ang(p.x, p.y, prop.x, prop.y);
          if (Math.abs(U.angDiff(a, ea)) > arc / 2 + 0.5) continue;
          W.damageProp(g, prop, base * 1.5, p);
          hitAny = true;
        }
      }
      if (hitAny) {
        Audio.sfx('crunch');
        g.shake(2.5, 0.12);
      }
      g.deflectProjectiles(p.x, p.y, range + 6, a, arc, p);
    },

    chair(g, p, d, a) {
      Audio.sfx('shoot_chair');
      const base = W.baseDamage(p, 'chair');
      const boom = (g, pr, e) => {
        const R = d.radius * p.stats.explMult;
        g.explode(pr.x, pr.y, R, pr.dmg * d.splash, { owner: 'p', colors: 'fire', knock: 140, exclude: e, crit: true, shooter: p });
      };
      for (const ang of angles(p, a, 0.22)) {
        const sp = d.speed * p.stats.projSpeed;
        const m = mz(p, ang);
        g.spawnProjectile({
          owner: 'p', kind: 'chair', x: m.x, y: m.y, ang, speed: sp, r: d.r, dmg: base, life: d.range / sp, sprite: 'chair', spin: 16, knock: d.knock, trail: 'junk',
          onHit(g, pr, e) {
            W.hit(g, pr, e, { knock: d.knock, stun: 0.4 });
            boom(g, pr, e);
            return 'die';
          },
          onEnd: boom,
        });
      }
    },

    problem(g, p, d, a) {
      Audio.sfx('shoot_problem');
      const base = W.baseDamage(p, 'problem');
      for (const ang of angles(p, a, 0.2)) {
        const sp = d.speed * p.stats.projSpeed;
        const m = mz(p, ang);
        const kind = U.weighted(PROBLEMS, (x) => x.w).id;
        problemShot(g, p, d, kind, m, ang, sp, base);
      }
    },
  };

  W.FIRE = FIRE;
  W.HELD = HELD;
  W.angles = angles;
  W.muzzle = mz;
  W.kaboom = kaboom;
  W.iceBurst = iceBurst;

  const PROBLEMS = [
    { id: 'decoy', w: 12 },
    { id: 'boom', w: 25 },
    { id: 'bounce', w: 20 },
    { id: 'slow', w: 20 },
    { id: 'direct', w: 18 },
    { id: 'mega', w: 5 },
  ];

  function problemShot(g, p, d, kind, m, ang, sp, base) {
    const R = (r) => r * p.stats.explMult;
    const common = { owner: 'p', x: m.x, y: m.y, ang, speed: sp, r: d.r, dmg: base, spin: 8, kind: 'problem_' + kind };
    switch (kind) {
      case 'decoy': {
        const dist = Math.min(d.range, Math.max(50, p.aimDist || 100));
        g.spawnProjectile(Object.assign(common, { sprite: 'prob_decoy', life: dist / sp, noHit: true, onEnd: (g, pr) => g.addDecoy(pr.x, pr.y, 3.5), trail: 'confetti' }));
        break;
      }
      case 'boom':
        g.spawnProjectile(Object.assign(common, { sprite: 'prob_bomb', life: d.range / sp, onHit: (g, pr) => (kaboom(g, pr, R(32), pr.dmg * 1.5), 'die'), onEnd: (g, pr) => kaboom(g, pr, R(32), pr.dmg * 1.5), trail: 'fire' }));
        break;
      case 'bounce':
        g.spawnProjectile(
          Object.assign(common, {
            sprite: 'prob_ball', life: 2.4, wallBounce: 4, pierce: 99, hitCd: 0.35, speed: sp * 1.15, knock: 90, trail: 'confetti',
            onHit(g, pr, e) {
              W.hit(g, pr, e, { knock: 90 });
              pr.hitT.set(e, 0.35);
              return 'pass';
            },
          })
        );
        break;
      case 'slow':
        g.spawnProjectile(
          Object.assign(common, {
            sprite: 'prob_ice', life: d.range / sp, trail: 'ice',
            onHit(g, pr, e) {
              W.hit(g, pr, e, { knock: 40 });
              iceBurst(g, pr, R(36));
              return 'die';
            },
            onEnd: (g, pr) => iceBurst(g, pr, R(30)),
          })
        );
        break;
      case 'mega':
        g.spawnProjectile(Object.assign(common, { sprite: 'prob_mega', speed: sp * 0.8, life: d.range / (sp * 0.8), r: 6, spin: 5, trail: 'fire', onHit: (g, pr) => (kaboom(g, pr, R(78), pr.dmg * 8, true), 'die'), onEnd: (g, pr) => kaboom(g, pr, R(78), pr.dmg * 8, true) }));
        break;
      default:
        g.spawnProjectile(Object.assign(common, { sprite: 'prob_ball', life: d.range / sp, dmg: base * 1.4, knock: 80, trail: 'confetti', onHit: (g, pr, e) => (W.hit(g, pr, e, { knock: 80 }), 'die') }));
    }
  }

  function kaboom(g, pr, r, dmg, big) {
    g.explode(pr.x, pr.y, r, dmg, { owner: 'p', colors: 'fire', knock: big ? 260 : 150, crit: true, big, shooter: pr.shooter });
    if (big) {
      g.shake(7, 0.4);
      FX.text(pr.x, pr.y - 14, 'PROBLEM SOLVED', '#fee761', 1);
    }
  }
  function iceBurst(g, pr, r) {
    FX.burst(pr.x, pr.y, { n: 14, colors: 'ice', speed: 90, life: 0.5 });
    Kit.impact('ice', pr.x, pr.y, r * 0.8);
    Audio.sfx('ice');
    FX.ring(pr.x, pr.y, 4, r, '#3ccbe6', 0.3);
    for (const e of g.enemies) {
      if (e.dead || e.state === 'spawn') continue;
      if (U.dist(pr.x, pr.y, e.x, e.y) < r + e.r) e.applySlow(0.5, 3);
    }
  }

  /* ---------- gadgets: left bumper / G ---------- */
  W.gadgets = ['frag', 'cheese', 'frost'];
  W.gadgetNames = { frag: 'JUNK GRENADE', cheese: 'CHEESE BOMB', frost: 'FROST BOMB' };
  /* lobbed along the aim line, lands after a short flight and goes off. Charges are managed by the player. */
  W.throwGadget = function (g, p, kind) {
    const d = Math.max(36, Math.min(150, p.aimDist || 90));
    const sp = 190;
    const a = p.aim;
    const dm = p.stats.dmgMult;
    const R = (r) => r * p.stats.explMult;
    Audio.sfx('swing');
    const common = { owner: 'p', shooter: p, x: p.x + Math.cos(a) * 8, y: p.y - 8 + Math.sin(a) * 8, ang: a, speed: sp, r: 3, spin: 12, noHit: true, life: d / sp, dmg: 0, kind: 'gadget_' + kind };
    const land = {
      frag: (g2, pr) => g2.explode(pr.x, pr.y, R(40), 70 * dm, { owner: 'p', colors: 'fire', knock: 220, crit: true, shooter: p }),
      cheese: (g2, pr) => {
        g2.explode(pr.x, pr.y, R(30), 26 * dm, { owner: 'p', colors: 'cheese', knock: 80, shooter: p });
        g2.addZone({ kind: 'cheese', x: pr.x, y: pr.y, r: R(42), life: 5, slowE: 0.6 });
      },
      frost: (g2, pr) => {
        iceBurst(g2, pr, R(48));
        for (const e of g2.enemies) {
          if (e.dead || e.state === 'spawn') continue;
          if (U.dist(pr.x, pr.y, e.x, e.y) < R(48) + e.r) g2.damageEnemy(e, 24 * dm, { elem: 'ice', lite: true, shooter: p, src: 'player' });
        }
      },
    }[kind];
    g.spawnProjectile(Object.assign(common, { sprite: kind === 'frost' ? 'prob_ice' : kind === 'cheese' ? 'pizza' : 'prob_bomb', trail: kind === 'frost' ? 'ice' : kind === 'cheese' ? 'cheese' : 'fire', onEnd: land }));
  };

  /* ---------- hit helpers ---------- */
  W.hit = function (g, pr, e, opts) {
    opts = opts || {};
    const p = pr.shooter || g.player;
    const crit = pr.forceCrit || Math.random() < p.stats.critChance;
    let dmg = pr.dmg * (opts.mul || 1) * (crit ? B.player.critMult : 1);
    if (g.mods.bigHead) dmg *= 1.4;
    const a = Math.atan2(pr.vy, pr.vx);
    g.damageEnemy(e, dmg, { crit, kx: Math.cos(a), ky: Math.sin(a), kf: opts.knock !== undefined ? opts.knock : pr.knock || 50, stun: opts.stun || 0, src: 'player', elem: Kit.projElem(pr), shooter: p });
    pr.hits.add(e);
  };

  W.damageProp = function (g, prop, dmg, player) {
    if (!prop || prop.dead || prop.falling) return;
    if (!prop.choppable && !prop.destructible && prop.kind !== 'tree') return;

    prop.hp -= (dmg || 25);
    prop.shake = 0.35;
    const dir = player ? (player.x < prop.x ? 1 : -1) : (Math.random() < 0.5 ? 1 : -1);
    prop.bend += dir * 0.22;

    const resMult = (player && player.stats && player.stats.resMult) || 1;

    // Tree felling
    if (prop.kind === 'tree') {
      Audio.sfx('tree_hit');
      FX.burst(prop.x, prop.y - 24, {
        n: 8,
        colors: ['#8b5a2b', '#6b4a2a', '#5fb347', '#4a9b3a'],
        speed: 65,
        life: 0.4
      });
      if (prop.hp <= 0) {
        prop.falling = true;
        prop.fallT = 0;
        prop.fallDir = dir;
        prop.solid = false;
        Audio.sfx('tree_fall');
        FX.text(prop.x, prop.y - 38, 'TIMBER!', '#fee761', 1.2);
      }
      return;
    }

    // Car destruction
    if (prop.kind === 'car') {
      Audio.sfx('crunch');
      FX.burst(prop.x, prop.y - 12, { n: 6, colors: ['#ff8fb8', '#fee761', '#5a6988'], speed: 50, life: 0.3 });
      if (prop.hp <= 0) {
        prop.dead = true;
        prop.solid = false;
        Audio.sfx('explode');
        g.shake(4, 0.25);
        g.explode(prop.x, prop.y - 8, 48, 60, { friendly: true, owner: 'p', colors: 'fire', knock: 160 });
        prop.sprite = 'obj.carWreck';
        FX.text(prop.x, prop.y - 32, 'BOOM! CAR SCRAPPED', '#ff8fb8', 1.2);
        const scrapCount = Math.round(U.randInt(4, 7) * resMult);
        for (let i = 0; i < scrapCount; i++) g.dropPickup('scrap', prop.x + U.rand(-18, 18), prop.y + U.rand(-18, 18), 1);
        for (let i = 0; i < 4; i++) g.dropPickup('coin', prop.x + U.rand(-16, 16), prop.y + U.rand(-16, 16), 1);
      }
      return;
    }

    // Other destructibles (barricades, rocks, crates, barrels)
    Audio.sfx(prop.kind === 'rock' ? 'wall_hit' : 'crunch');
    const colors = prop.kind === 'rock' ? ['#5a6988', '#8a9bb8', '#3a4454'] : ['#8b5a2b', '#d1a964', '#5a6988'];
    FX.burst(prop.x, prop.y - 10, { n: 6, colors, speed: 45, life: 0.3 });

    if (prop.hp <= 0) {
      prop.dead = true;
      prop.solid = false;
      Audio.sfx('tree_fall');
      g.shake(2, 0.15);
      FX.burst(prop.x, prop.y - 8, { n: 12, colors, speed: 60, life: 0.4 });
      const rType = prop.resourceType || (prop.kind === 'rock' ? 'stone' : (prop.kind === 'barricade' ? 'scrap' : 'wood'));
      const rAmt = Math.round((prop.resourceAmt || U.randInt(2, 4)) * resMult);
      for (let i = 0; i < rAmt; i++) g.dropPickup(rType, prop.x + U.rand(-14, 14), prop.y + U.rand(-14, 14), 1);
      if (Math.random() < 0.5) g.dropPickup('coin', prop.x + U.rand(-12, 12), prop.y + U.rand(-12, 12), 1);
      if (Math.random() < 0.2) g.dropPickup('hp', prop.x, prop.y, 15);
      if (Math.random() < 0.22) CH.PowerUps.dropCurio(g, prop.x + U.rand(-10, 10), prop.y + U.rand(-10, 10));
      if (Math.random() < 0.07) CH.Loot.drop(g, CH.Loot.roll(prop.kind === 'rock' ? 'golem' : null, { min: 'c' }), prop.x, prop.y);
      FX.text(prop.x, prop.y - 24, '+' + rAmt + ' ' + rType.toUpperCase(), rType === 'wood' ? '#d1a964' : (rType === 'scrap' ? '#68c2d3' : '#a6b0bf'), 1);
    }
  };
  W.damageTree = W.damageProp;

  /* ---------- projectile simulation ---------- */
  W.spawn = function (g, o) {
    if (g.projectiles.length > 320) return null;
    const pr = Object.assign(
      { vx: Math.cos(o.ang) * o.speed, vy: Math.sin(o.ang) * o.speed, rot: o.ang, spin: 0, pierce: 0, hits: new Set(), hitT: new Map(), age: 0, dead: false, life: 1, r: 3, dmg: 1, knock: 50, bounces: 0, wallBounce: 0 },
      o
    );
    if (pr.owner === 'p' && !pr.shooter) pr.shooter = W.shooter || g.player;
    g.projectiles.push(pr);
    if (pr.owner === 'e' && pr.fx && pr.muzzle !== false) Kit.muzzle(pr.fx, pr.x, pr.y, pr.ang, pr.big ? 11 : 8);
    return pr;
  };

  const nearProps = [];
  function killProj(g, pr) {
    if (pr.dead) return;
    pr.dead = true;
  }

  W.update = function (g, dt) {
    const arena = g.arena;
    const m = B.arena.margin;
    const list = g.projectiles;
    for (let i = 0; i < list.length; i++) {
      const pr = list[i];
      if (pr.dead) continue;
      pr.age += dt;
      pr.life -= dt;
      if (pr.homing && g.player) {
        const hp = g.nearestPlayer(pr.x, pr.y) || g.player;
        const a = U.turnToward(Math.atan2(pr.vy, pr.vx), U.ang(pr.x, pr.y, hp.x, hp.y), pr.homing * dt);
        pr.vx = Math.cos(a) * pr.speed;
        pr.vy = Math.sin(a) * pr.speed;
      }
      if (pr.owner === 'p' && pr.homeE) {
        let tgt = null;
        let td = 190 * 190;
        for (const e of g.enemies) {
          if (e.dead || e.state === 'spawn' || e.hidden || pr.hits.has(e)) continue;
          const dd = U.dist2(pr.x, pr.y, e.x, e.y);
          if (dd < td) {
            td = dd;
            tgt = e;
          }
        }
        if (tgt) {
          const na = U.turnToward(Math.atan2(pr.vy, pr.vx), U.ang(pr.x, pr.y, tgt.x, tgt.y), pr.homeE * dt);
          pr.vx = Math.cos(na) * pr.speed;
          pr.vy = Math.sin(na) * pr.speed;
        }
      }
      if (pr.tick) pr.tick(g, pr, dt);
      const x0 = pr.x, y0 = pr.y;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.face) pr.rot = Math.atan2(pr.vy, pr.vx);
      else pr.rot += pr.spin * dt;
      if (pr.hitT.size) {
        for (const [e, t] of pr.hitT) {
          if (t - dt <= 0) pr.hitT.delete(e);
          else pr.hitT.set(e, t - dt);
        }
      }
      // trails
      if (pr.trail && Math.random() < (CH.Storage.settings.reduced ? 0.1 : 0.45)) trail(pr);
      // element trail: sparse, and only while the screen is not already full of shots
      if ((pr.owner === 'p' ? pr.trail : pr.fx) && list.length < 70) {
        pr.fxT = (pr.fxT || 0) - dt;
        if (pr.fxT <= 0) {
          pr.fxT = pr.owner === 'p' ? 0.09 : 0.14;
          Kit.trail(Kit.projElem(pr), pr.x, pr.y, pr.owner === 'p' ? 6 : 5, { alpha: 0.8 });
        }
      }

      // arena walls
      if (pr.x < m || pr.x > arena.w - m || pr.y < m || pr.y > arena.h - m) {
        if (pr.wallBounce > 0) {
          if (pr.x < m || pr.x > arena.w - m) pr.vx = -pr.vx;
          if (pr.y < m || pr.y > arena.h - m) pr.vy = -pr.vy;
          pr.x = U.clamp(pr.x, m, arena.w - m);
          pr.y = U.clamp(pr.y, m, arena.h - m);
          pr.wallBounce--;
          if (pr.kind === 'chicken') Audio.sfx('squeak');
        } else {
          pr.life = 0;
        }
      }
      // level walls, the same way: a bouncing shot bounces, the rest end against the rock
      if (g.level && pr.life > 0 && g.level.solidAt(pr.x, pr.y)) {
        if (CH.World.bounceShot(g.level, pr, x0, y0)) {
          if (pr.kind === 'chicken') Audio.sfx('squeak');
        } else {
          FX.burst(pr.x, pr.y, { n: 3, colors: ['#c2c3c7', '#6a6a7a'], speed: 40, life: 0.2 });
          pr.life = 0;
        }
      }
      if (pr.life <= 0) {
        if (pr.onEnd) pr.onEnd(g, pr);
        else if (pr.owner === 'e') {
          FX.burst(pr.x, pr.y, { n: 3, colors: [pr.color || '#ffffff'], speed: 30, life: 0.25 });
          if (pr.fx && list.length < 70) Kit.hit(pr.fx, pr.x, pr.y, 7, false, { alpha: 0.8 });
        }
        killProj(g, pr);
        continue;
      }
      if (pr.noHit) continue;

      if (pr.owner === 'p') {
        // Projectile vs tree & destructible prop collision
        if (g.arena && g.arena.props) {
          for (const prop of g.arena.props) {
            if (prop.dead || !prop.solid || (!prop.choppable && !prop.destructible && prop.kind !== 'tree')) continue;
            if (CH.World.shotHits(prop, pr)) {
              W.damageProp(g, prop, pr.dmg * 1.2, pr.shooter || g.player);
              let res = 'die';
              if (pr.onHit) res = pr.onHit(g, pr, { x: prop.x, y: prop.y - 4, r: prop.cr });
              if (res !== 'pass') {
                killProj(g, pr);
                break;
              }
            }
          }
          if (pr.dead) continue;
        }

        for (let j = 0; j < g.enemies.length; j++) {
          const e = g.enemies[j];
          if (e.dead || e.state === 'spawn' || e.hidden || pr.hits.has(e) || pr.hitT.has(e)) continue;
          const rr = pr.r + e.r;
          const dx = e.x - pr.x;
          const dy = e.y - pr.y;
          if (dx * dx + dy * dy > rr * rr) continue;
          let res = 'die';
          if (pr.onHit) res = pr.onHit(g, pr, e);
          else W.hit(g, pr, e);
          if (res !== 'pass') {
            if (pr.pierce > 0) pr.pierce--;
            else {
              killProj(g, pr);
              break;
            }
          }
        }
      } else {
        // tall solid props stop enemy shots (low, jumpable ones are shot over)
        if (g.arena && g.arena.props) {
          for (const prop of CH.Props.near(g.arena.props, pr.x, pr.y, nearProps)) {
            if (prop.dead || !prop.solid || prop.jumpable || !CH.World.shotHits(prop, pr)) continue;
            FX.burst(pr.x, pr.y, { n: 3, colors: [pr.color || '#ffffff'], speed: 30, life: 0.25 });
            killProj(g, pr);
            break;
          }
          if (pr.dead) continue;
        }
        // enemy projectile vs every living player
        for (let k = 0; k < g.players.length; k++) {
          const p = g.players[k];
          if (p.dead) continue;
          const rr = pr.r + p.r;
          const dx = p.x - pr.x;
          const dy = p.y - pr.y;
          if (dx * dx + dy * dy < rr * rr) {
            if (p.rolling || p.invuln > 0) continue; // dodged: projectile sails through
            g.hurtPlayer(pr.dmg, pr, { slow: pr.slow, p });
            FX.burst(pr.x, pr.y, { n: 5, colors: [pr.color || '#ffffff'], speed: 60, life: 0.3 });
            killProj(g, pr);
            break;
          }
        }
      }
    }
    // compact
    let w = 0;
    for (let i = 0; i < list.length; i++) if (!list[i].dead) list[w++] = list[i];
    list.length = w;
  };

  function trail(pr) {
    switch (pr.trail) {
      case 'junk':
        FX.burst(pr.x, pr.y, { n: 1, colors: 'junk', speed: 10, life: 0.25, size: 1 });
        break;
      case 'goo':
        FX.burst(pr.x, pr.y, { n: 1, colors: ['#fee761', '#ffffff'], speed: 12, life: 0.25 });
        break;
      case 'cheese':
        FX.burst(pr.x, pr.y, { n: 1, colors: 'cheese', speed: 14, life: 0.3, size: 2 });
        break;
      case 'fire':
        FX.burst(pr.x, pr.y, { n: 1, colors: 'fire', speed: 16, life: 0.3 });
        break;
      case 'ice':
        FX.burst(pr.x, pr.y, { n: 1, colors: 'ice', speed: 14, life: 0.3 });
        break;
      case 'confetti':
        FX.burst(pr.x, pr.y, { n: 1, colors: 'confetti', speed: 14, life: 0.35 });
        break;
    }
  }

  W.draw = function (ctx, g, cam) {
    for (const pr of g.projectiles) {
      const x = pr.x - cam.x;
      const y = pr.y - cam.y;
      if (x < -20 || y < -20 || x > B.view.w + 20 || y > B.view.h + 20) continue;
      if (pr.owner === 'e') {
        // soft marker so enemy shots always read against busy floors
        ctx.globalAlpha = 0.35;
        FX.circleFill(ctx, x, y, pr.r + 2, '#1b1226');
        ctx.globalAlpha = 1;
      }
      const o = { rot: pr.rot, flip: false };
      if (pr.animFps) {
        const n = CH.Sprites.get(pr.sprite).frames.length;
        const from = Math.min(pr.animFrom || 0, n - 1);
        o.frame = from + (Math.floor(pr.age * pr.animFps) % (n - from));
      }
      if (pr.scale) {
        o.sx = pr.scale;
        o.sy = pr.scale;
      }
      if (pr.sprite.startsWith('vfx.')) ctx.globalCompositeOperation = 'lighter';
      CH.Sprites.draw(ctx, pr.sprite, x, y, o);
      ctx.globalCompositeOperation = 'source-over';
    }
  };

  /* ---------- held weapon + melee arc ---------- */
  W.drawHeld = function (ctx, p, cam) {
    const id = p.heldWeapon || p.weapon;
    // the hero sprites already carry their own gear: only the baguette swing is drawn on top
    if (CH.Art.on && id !== 'baguette') return;
    const spr = HELD[id];
    const x = p.x - cam.x;
    const y = p.y - cam.y - 8;
    let a = p.aim;
    let off = 7 - p.kick;
    let sy = Math.cos(a) < 0 ? -1 : 1;
    if (id === 'baguette') {
      if (p.swing) {
        const s = p.swing;
        const k = U.clamp(s.t / s.dur, 0, 1);
        a = s.ang + (k - 0.5) * s.arc * s.dir;
        off = 8;
      } else {
        a = p.aim + 0.9;
        off = 6;
      }
      sy = 1;
    }
    const dx = Math.cos(a) * off;
    const dy = Math.sin(a) * off;
    CH.Sprites.draw(ctx, spr, x + dx, y + dy, { rot: a, sy: id === 'baguette' ? 1 : sy });
  };

  W.drawSwing = function (ctx, p, cam) {
    const s = p.swing;
    if (!s) return;
    const k = U.clamp(s.t / s.dur, 0, 1);
    const x = p.x - cam.x;
    const y = p.y - cam.y - 8;
    const cols = ['#ffffff', '#fee761', '#f4d38a'];
    const aEnd = s.ang + (k - 0.5) * s.arc * s.dir;
    const aStart = s.ang - 0.5 * s.arc * s.dir;
    const steps = Math.ceil(s.arc * s.range * 0.5);
    ctx.globalAlpha = 1 - k * 0.7;
    for (let band = 0; band < 3; band++) {
      ctx.fillStyle = cols[band];
      const rad = s.range - 2 - band * 3;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const aa = aStart + (aEnd - aStart) * t;
        // fade the tail
        if (t < 0.25 && band > 0) continue;
        ctx.fillRect(Math.round(x + Math.cos(aa) * rad), Math.round(y + Math.sin(aa) * rad), 1 + (band === 0 ? 1 : 0), 1 + (band === 0 ? 1 : 0));
      }
    }
    ctx.globalAlpha = 1;
  };
})(window.CH);
