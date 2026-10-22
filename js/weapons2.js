/* CHAOS.exe - six more weapons. */
(function (CH) {
  'use strict';
  const { Balance: B, Weapons: W, U, X, Audio, FX } = CH;
  X.wrap(CH.Upgrades, 'makeCards', function (orig, ...a) {
    const cards = orig(...a);
    for (const c of cards) if (c.kind === 'weapon' && !c.text && B.weapons[c.id]) c.text = B.weapons[c.id].blurb;
    return cards;
  });
  const add = (id, def, held) => {
    B.weapons[id] = def;
    if (!B.weaponOrder.includes(id)) B.weaponOrder.push(id);
    W.names[id] = def.name;
    W.HELD[id] = held;
  };
  const sfx = (n) => {
    try { Audio.sfx(n); } catch (e) { /* sound is optional */ }
  };

  add('stapler', { name: 'Stapler Minigun', dmg: 4, cd: 0.07, speed: 430, range: 230, ammo: 45, reload: 2.2, r: 2, spread: 0.12, blurb: 'Rapid staples. Jams never.' }, 'junk_launcher');
  add('leaf', { name: 'Leaf Blower', dmg: 1.6, cd: 0.09, speed: 240, range: 95, ammo: 0, reload: 0, r: 7, blurb: 'Pushes enemies away. Mostly.' }, 'chair_icon');
  add('keyboard', { name: 'Boomerang Keyboard', dmg: 15, cd: 0.6, speed: 280, range: 170, ammo: 0, reload: 0, r: 6, blurb: 'Throw it. It comes back. Typical.' }, 'problem_icon');
  add('roomba', { name: 'Roomba Turret', dmg: 8, cd: 1.1, speed: 0, range: 0, ammo: 3, reload: 4, r: 4, blurb: 'Deploys a tiny robot with a gun.' }, 'pizza_box');
  add('extinguisher', { name: 'Fire Extinguisher', dmg: 2.2, cd: 0.1, speed: 0, range: 85, ammo: 60, reload: 2.5, r: 4, blurb: 'A cone of cold. Slows and freezes.' }, 'baguette');
  add('replyall', { name: 'Reply-All', dmg: 6, cd: 0.7, speed: 190, range: 320, ammo: 10, reload: 2, r: 3, blurb: 'A homing swarm of emails.' }, 'problem_icon');

  const F = W.FIRE;
  F.stapler = (g, p, d, a) => {
    sfx('shoot_junk');
    const base = W.baseDamage(p, 'stapler');
    for (const ang of W.angles(p, a, 0.1)) {
      const sp = d.speed * p.stats.projSpeed;
      const m = W.muzzle(p, ang);
      g.spawnProjectile({ owner: 'p', kind: 'stapler', x: m.x, y: m.y, ang: ang + U.rand(-d.spread, d.spread), speed: sp, r: d.r, dmg: base, life: d.range / sp, sprite: 'junk0', face: true, knock: 20, trail: 'junk', shooter: p });
    }
  };

  F.leaf = (g, p, d, a) => {
    sfx('whoosh');
    const base = W.baseDamage(p, 'leaf');
    for (const ang of W.angles(p, a, 0.3)) {
      const sp = d.speed * p.stats.projSpeed;
      const m = W.muzzle(p, ang);
      g.spawnProjectile({
        owner: 'p', kind: 'leaf', x: m.x, y: m.y, ang: ang + U.rand(-0.25, 0.25), speed: sp, r: d.r, dmg: base, life: d.range / sp, sprite: 'junk' + Math.floor(Math.random() * 6), spin: 9,
        pierce: 99, hitCd: 0.25, knock: 160, trail: 'confetti', shooter: p,
        onHit(gg, pr, e) {
          W.hit(gg, pr, e, { knock: 170, stun: 0.05 });
          return 'pass';
        },
      });
    }
  };

  F.keyboard = (g, p, d, a) => {
    sfx('shoot_junk');
    const base = W.baseDamage(p, 'keyboard');
    for (const ang of W.angles(p, a, 0.3)) {
      const sp = d.speed * p.stats.projSpeed;
      const m = W.muzzle(p, ang);
      g.spawnProjectile({
        owner: 'p', kind: 'keyboard', x: m.x, y: m.y, ang, speed: sp, r: d.r, dmg: base, life: 3, sprite: 'prob_bomb', spin: 16, pierce: 99, hitCd: 0.4, knock: 90, trail: 'confetti', shooter: p,
        out: d.range / sp,
        onHit(gg, pr, e) {
          W.hit(gg, pr, e, { knock: 90 });
          return 'pass';
        },
        tick(gg, pr) {
          if (pr.age < pr.out) return;
          const dx = p.x - pr.x, dy = (p.y - 6) - pr.y;
          const L = Math.hypot(dx, dy) || 1;
          const sp2 = Math.max(sp, 200) * 1.15;
          pr.vx = (dx / L) * sp2;
          pr.vy = (dy / L) * sp2;
          if (L < 12) pr.life = 0;
        },
      });
    }
  };

  F.roomba = (g, p, d, a) => {
    sfx('click');
    const mine = X.turrets.filter((t) => t.roomba && t.owner === p);
    if (mine.length >= 3) mine[0].life = 0;
    const m = W.muzzle(p, a, 14);
    X.addTurret(m.x, m.y, { roomba: true, life: 14, rate: 0.35, range: 170, dmg: W.baseDamage(p, 'roomba'), owner: p, spr: 'prob_decoy' });
  };

  F.extinguisher = (g, p, d, a) => {
    sfx('whoosh');
    const base = W.baseDamage(p, 'extinguisher');
    const range = d.range * (p.stats.projSpeed || 1);
    for (const e of g.enemies) {
      if (e.dead || e.state === 'spawn' || e.hidden) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (Math.hypot(dx, dy) > range + e.r) continue;
      let da = Math.atan2(dy, dx) - a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > 0.42) continue;
      X.hitEnemy(e, base, p, 'ice');
      e.applySlow(0.3, 2.5);
      e.frost = (e.frost || 0) + 1;
      if (e.frost >= 8) {
        e.frost = 0;
        e.stun(1.2);
        if (FX && FX.text) FX.text(e.x, e.y - e.r - 6, 'FROZEN', '#8be9ff', 1);
      }
    }
    if (FX && FX.burst) {
      const m = W.muzzle(p, a, 12);
      FX.burst(m.x + Math.cos(a) * 30, m.y + Math.sin(a) * 30, { n: 5, colors: ['#ffffff', '#8be9ff', '#3ccbe6'], speed: 90, life: 0.35 });
    }
  };

  F.replyall = (g, p, d, a) => {
    sfx('shoot_junk');
    const base = W.baseDamage(p, 'replyall');
    const n = 5;
    for (let i = 0; i < n; i++) {
      const ang = a + (i - (n - 1) / 2) * 0.35;
      const sp = d.speed * p.stats.projSpeed;
      const m = W.muzzle(p, ang);
      g.spawnProjectile({ owner: 'p', kind: 'replyall', x: m.x, y: m.y, ang, speed: sp, r: d.r, dmg: base, life: d.range / sp + 0.5, sprite: 'prob_ball', spin: 6, homeE: 5, knock: 30, trail: 'confetti', shooter: p });
    }
  };

  for (const id of ['stapler', 'leaf', 'keyboard', 'roomba', 'extinguisher', 'replyall']) X.fireWrap(id);

  X.EVO.stapler = { up: 'speed', name: 'STAPLE STORM', text: 'Fires a spray of 3 staples per shot' };
  X.EVO.leaf = { up: 'ammo', name: 'HURRICANE BLOWER', text: 'Cone reaches 70% further and blows enemies across the room' };
  X.EVO.keyboard = { up: 'multi', name: 'MECHANICAL KEYBOARD', text: 'Throws three boomerang keyboards at once' };
  X.EVO.roomba = { up: 'magnet', name: 'ROOMBA SWARM', text: 'Deploys two turrets at once' };
  X.EVO.extinguisher = { up: 'crit', name: 'CRYO BLAST', text: 'Cone range +60% and freezes much faster' };
  X.EVO.replyall = { up: 'reality', name: 'REPLY-ALL-ALL', text: 'Swarm of 8 homing emails' };
  const E = X.evoFns;
  const ex = (p, n, fn) => {
    p.stats.extraProj += n;
    try { fn(); } finally { p.stats.extraProj -= n; }
  };
  E.stapler = (orig, g, p, d, a) => ex(p, 2, () => orig(g, p, d, a));
  E.keyboard = (orig, g, p, d, a) => ex(p, 2, () => orig(g, p, d, a));
  E.roomba = (orig, g, p, d, a) => {
    orig(g, p, d, a);
    orig(g, p, d, a + 0.6);
  };
  E.extinguisher = (orig, g, p, d, a) => {
    orig(g, p, Object.assign({}, d, { range: d.range * 1.6 }), a);
    for (const e of g.enemies) if (e.frost) e.frost += 2;
  };
  E.leaf = (orig, g, p, d, a) => orig(g, p, Object.assign({}, d, { range: d.range * 1.7 }), a);
  E.replyall = (orig, g, p, d, a) => orig(g, p, d, a) || [-0.5, 0, 0.5].forEach((o) => orig(g, p, d, a + o + 0.17));
})(window.CH);
