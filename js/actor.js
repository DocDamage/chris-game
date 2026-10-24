/* CHAOS.exe - what heroes, monsters, bosses and sidekicks share (PLAN.md section 16, step 4).
   The four kinds are built differently (Player and Enemy are classes, Boss extends Enemy, sidekicks are plain objects)
   and animate, take status effects and die in their own ways; these are the pieces they had copied: the fading of a
   hit's flash and squash, knockback that dies away, the push a hit gives, the invulnerability blink. Each kind keeps its
   own numbers (Actor.KIND), exactly as they were, so this step changes nothing; evening them out would change the game. */
(function (CH) {
  'use strict';
  const U = CH.U;

  const Actor = (CH.Actor = {});

  /* per kind: how fast knockback dies away (x per second), the push a hit gives (px/s); monsters and bosses also fade
     their hit flash and squash (x per second). Bosses ignore knockback (Boss.knock does nothing). */
  Actor.KIND = {
    hero: { knockDecay: 9, hitPush: 150 },
    monster: { knockDecay: 7, flashFade: 6, squashFade: 7 },
    boss: { flashFade: 6, squashFade: 7 },
    sidekick: { knockDecay: 8, hitPush: 90 },
  };

  /* a monster's or boss's hit fading: the flash, the squash and the hurt pose (bosses never get a hurt pose) */
  const MON = Actor.KIND.monster;
  Actor.fadeHit = function (a, dt) {
    if (a.flash > 0) a.flash -= dt * MON.flashFade;
    if (a.squash > 0) a.squash -= dt * MON.squashFade;
    if (a.hurtT > 0) a.hurtT -= dt;
  };

  /* knockback dies away at `rate` per second (mul slows that down, e.g. low gravity) */
  Actor.decayKnock = function (a, dt, rate, mul) {
    const k = Math.max(0, 1 - rate * dt * (mul === undefined ? 1 : mul));
    a.kx *= k;
    a.ky *= k;
  };

  /* a hit from src pushes the actor straight away from it */
  Actor.pushFrom = function (a, src, force) {
    const ang = U.ang(src.x, src.y, a.x, a.y);
    a.kx += Math.cos(ang) * force;
    a.ky += Math.sin(ang) * force;
  };

  /* while invulnerable after a hit the sprite blinks, 10 times a second */
  Actor.blink = (a) => a.invuln > 0 && Math.floor(a.invuln * 20) % 2 === 0;
})(window.CH);
