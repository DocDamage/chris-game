/* CHAOS.exe - how bodies meet the world, in one place (PLAN.md section 16, step 3).
   One resolver pushes a body's feet out of a box (a wall tile or a box prop) or a circle (a round prop); the arena
   edge keeps bodies in (heroes, sidekicks, pickups stop; monsters bounce their knockback back); one table says where
   each kind of body touches props and walls. Walls are still settled once per step, after everything has moved
   (World.settleWalls, called from js/run.js), as they were: moving that into every move would change the game.
   The numbers below differ by mover for historical reasons; they are kept exactly so this step changes nothing. */
(function (CH) {
  'use strict';
  const U = CH.U;
  const B = CH.Balance;

  const World = (CH.World = {});

  /* push a body's feet circle (e.x, e.y + foot, radius r) out of the box x0..x1 / y0..y1: along the shortest way
     out, or through the nearest side when the feet are inside it. Returns true when it moved the body. */
  World.pushBox = function (e, foot, r, x0, y0, x1, y1) {
    const fy = e.y + foot;
    const qx = U.clamp(e.x, x0, x1), qy = U.clamp(fy, y0, y1);
    const dx = e.x - qx, dy = fy - qy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return false;
    if (d2 < 0.0001) {
      const l = e.x - x0, rr = x1 - e.x, t = fy - y0, b = y1 - fy;
      const m = Math.min(l, rr, t, b);
      if (m === l) e.x = x0 - r;
      else if (m === rr) e.x = x1 + r;
      else if (m === t) e.y = y0 - r - foot;
      else e.y = y1 + r - foot;
    } else {
      const d = Math.sqrt(d2);
      e.x += (dx / d) * (r - d);
      e.y += (dy / d) * (r - d);
    }
    return true;
  };

  /* the same against a round footprint of radius cr centred on (cx, cy); a body exactly on the centre stays put */
  World.pushCircle = function (e, foot, r, cx, cy, cr) {
    const minD = cr + r;
    const dx = e.x - cx, dy = e.y + foot - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= minD * minD || d2 < 0.0001) return false;
    const d = Math.sqrt(d2);
    e.x += (dx / d) * (minD - d);
    e.y += (dy / d) * (minD - d);
    return true;
  };

  /* the arena edge: B.arena.margin + pad from every side of arena a (an open arena, or a level's bounds) */
  World.keepIn = function (e, pad, a) {
    const m = B.arena.margin + pad;
    e.x = U.clamp(e.x, m, a.w - m);
    e.y = U.clamp(e.y, m, a.h - m);
  };
  /* monsters hit the edge: they stop on it, flag wallHit (charges end there) and their knockback bounces back at 30% */
  World.bounceIn = function (e, a) {
    const mg = B.arena.margin + e.r;
    e.wallHit = false;
    if (e.x < mg) {
      e.x = mg;
      e.wallHit = true;
      if (e.kx < 0) e.kx = -e.kx * 0.3;
    } else if (e.x > a.w - mg) {
      e.x = a.w - mg;
      e.wallHit = true;
      if (e.kx > 0) e.kx = -e.kx * 0.3;
    }
    if (e.y < mg) {
      e.y = mg;
      e.wallHit = true;
      if (e.ky < 0) e.ky = -e.ky * 0.3;
    } else if (e.y > a.h - mg) {
      e.y = a.h - mg;
      e.wallHit = true;
      if (e.ky > 0) e.ky = -e.ky * 0.3;
    }
  };

  /* where each kind of body touches the world, the same against props and walls: [feet offset below e.y, feet
     radius]. Feet are at most 7 px in radius so everybody fits the gaps the level generator leaves; bosses (who fight
     in open arenas) stand on wider feet. */
  const footOf = (e) => (e.look && e.look.foot) || 8;
  World.FEET = {
    hero: (p) => [10, Math.min(p.r || 8, 7)],
    sidekick: (s) => [10, Math.min(s.r || 8, 7)],
    enemy: (e) => (e.isBoss ? [14, Math.min(e.r || 20, 12)] : [Math.min(12, footOf(e) * 0.8), Math.min(e.r || 8, 7)]),
    pickup: () => [0, 3],
  };
  /* push a body of that kind out of the arena's solid props (skip(prop) exempts one: standing on it, flying over it) */
  World.collideProps = function (e, kind, skip) {
    const f = World.FEET[kind](e);
    return CH.Props.collide(e, f[0], f[1], skip);
  };

  /* walls, once per step after everything has moved: heroes, monsters and sidekicks at their feet (projectiles meet
     walls as they move, in js/weapons.js) */
  /* height (PLAN.md 18, K7): a hero on a plateau's top may jump down off its rim; one who lands in a pit hurts and is
     put back on its edge by the push out of the wall tiles that follows */
  World.height = function (L, p, foot) {
    if (p.dead || p.z > 2) return;
    const tx = Math.floor(p.x / L.constructor.TS), ty = Math.floor((p.y + foot) / L.constructor.TS);
    const v = L.cell(tx, ty);
    if (L.cell(tx, ty) === CH.Level.FLOOR) p.top = L.top ? L.top[L.idx(tx, ty)] : 0;
    p.fallT = Math.max(0, (p.fallT || 0) - 1 / 60);
    if (v === CH.Level.PIT && !p.fallT) {
      p.fallT = 0.8;
      const dmg = Math.max(1, Math.round(p.maxHp * 0.08));
      p.hp = Math.max(1, p.hp - dmg);
      p.flash = 0.3;
      CH.FX.text(p.x, p.y - 24, 'FELL -' + dmg, '#e43b44', 1);
      CH.Audio.sfx('hurt');
      const q = L.nearestOpen(p.x, p.y + foot); // back on the nearest edge
      if (q) { p.x = q.x; p.y = q.y - foot; p.vx = p.vy = 0; }
    }
  };
  World.settleWalls = function (L) {
    const G = CH.G, F = World.FEET;
    for (const p of G.players) {
      const f = F.hero(p);
      World.height(L, p, f[0]);
      L.pushOutFeet(p, f[1], f[0]);
    }
    for (const e of G.enemies) if (!e.dead) { const f = F.enemy(e); L.pushOutFeet(e, f[1], f[0]); }
    if (CH.SK) for (const s of CH.SK.list) { const f = F.sidekick(s); L.pushOutFeet(s, f[1], f[0]); }
  };

  /* something flung or dropped (coins, gems, items) that moved from (x0, y0) this step stops at a level wall, on the
     axis that hit it, and is pushed out of solid props. A magnet's pull is not checked: it flies to the hero. */
  World.stopAt = function (b, x0, y0) {
    const L = CH.G.level;
    if (L && L.solidAt(b.x, b.y)) {
      if (!L.solidAt(b.x, y0)) { b.y = y0; b.vy = 0; }
      else if (!L.solidAt(x0, b.y)) { b.x = x0; b.vx = 0; }
      else { b.x = x0; b.y = y0; b.vx = b.vy = 0; }
    }
    const a = CH.G.arena;
    if (a && a.props) World.collideProps(b, 'pickup');
  };

  /* does a shot touch a prop's footprint? (box props a little below the shot, round ones a little above their base) */
  World.shotHits = function (prop, pr) {
    if (prop.box) return CH.Props.touches(prop, pr.x, pr.y + 6, pr.r);
    const minD = (prop.cr || 11) + pr.r;
    const dx = prop.x + (prop.cx || 0) - pr.x;
    const dy = prop.y + (prop.cy || -4) - pr.y;
    return dx * dx + dy * dy < minD * minD;
  };
  /* a shot that moved from (x0, y0) into a level wall: a bouncing one turns back on the axis that hit (both at a
     corner) and returns true; the rest are left in the wall for the caller to end */
  World.bounceShot = function (L, pr, x0, y0) {
    if (!(pr.wallBounce > 0)) return false;
    const hit = L.blocksAt ? (x, y) => L.blocksAt(x, y) : (x, y) => L.solidAt(x, y); // a level lets shots over its pits
    const sx = hit(pr.x, y0), sy = hit(x0, pr.y);
    if (sx || !sy) pr.vx = -pr.vx;
    if (sy || !sx) pr.vy = -pr.vy;
    pr.x = x0;
    pr.y = y0;
    pr.wallBounce--;
    return true;
  };

  /* is a point within reach of a prop's top? box props are tested at the feet (y + foot, within boxR), round ones from
     the centre (within the prop's radius + ringR). Jumping on, landing and walking off use different reaches. */
  World.reach = function (prop, x, y, foot, boxR, ringR) {
    if (prop.box) return CH.Props.touches(prop, x, y + foot, boxR);
    const dx = x - (prop.x + (prop.cx || 0)), dy = y - (prop.y + (prop.cy || 0));
    const R = (prop.cr || 10) + ringR;
    return dx * dx + dy * dy <= R * R;
  };
})(window.CH);
