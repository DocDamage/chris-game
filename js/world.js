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

  /* where each kind of body touches the world: [feet offset below e.y, feet radius], against props and against walls
     (Level.pushOutFeet caps wall radii at 7 px, bosses included) */
  const footOf = (e) => (e.look && e.look.foot) || 8;
  World.FEET = {
    props: {
      hero: (p) => [10, p.r],
      sidekick: (s) => [10, s.r],
      enemy: (e) => [Math.min(14, footOf(e) * 0.8), Math.min(e.r, 9)],
    },
    walls: {
      hero: (p) => [10, p.r || 8],
      sidekick: (s) => [10, s.r || 8],
      enemy: (e) => (e.isBoss ? [14, Math.min(e.r || 20, 20)] : [Math.min(10, footOf(e) * 0.8), e.r || 8]),
    },
  };
  /* push a body of that kind out of the arena's solid props (skip(prop) exempts one: standing on it, flying over it) */
  World.collideProps = function (e, kind, skip) {
    const f = World.FEET.props[kind](e);
    return CH.Props.collide(e, f[0], f[1], skip);
  };

  /* walls, once per step after everything has moved: heroes, monsters and sidekicks at their feet; projectiles that
     end the step inside rock break */
  World.settleWalls = function (L) {
    const G = CH.G, W = World.FEET.walls;
    for (const p of G.players) { const f = W.hero(p); L.pushOutFeet(p, f[1], f[0]); }
    for (const e of G.enemies) if (!e.dead) { const f = W.enemy(e); L.pushOutFeet(e, f[1], f[0]); }
    if (CH.SK) for (const s of CH.SK.list) { const f = W.sidekick(s); L.pushOutFeet(s, f[1], f[0]); }
    for (const pr of G.projectiles) {
      if (pr.dead) continue;
      if (L.solidAt(pr.x, pr.y)) {
        pr.dead = true;
        CH.FX.burst(pr.x, pr.y, { n: 3, colors: ['#c2c3c7', '#6a6a7a'], speed: 40, life: 0.2 });
      }
    }
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
