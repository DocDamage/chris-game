/* CHAOS.exe - kits of the three newer heroes (they replaced the placeholder kits of meta.js, see PLAN.md D2):
   Elven Enchantress (Spirit Bloom), Neon Specter (Energy Slash), The Grinning Stranger (Horror Stare + fear status). */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const G = CH.G;
  const Up = CH.Upgrades;
  const Audio = CH.Audio;
  const X = CH.X;
  const wrap = X.wrap;
  const Kits = (CH.Kits = {});

  const md = () => CH.Meta.data();
  const altOn = (p) => (p.perks && p.perks.kitplus > 0) || (CH.Meta.masteryLevel(p.hero.id) >= 2 && md().alt[p.hero.id]); // the Empowered Special skill, or the mastery alt

  /* ------------------------------------------------------------------ fear status (any enemy, not bosses)
     A feared enemy runs away from the nearest hero, cannot attack and takes +25% damage. */
  Kits.fear = (e, time) => {
    if (e.dead || e.isBoss || e.state === 'spawn') return false;
    e.fearT = Math.max(e.fearT || 0, time);
    e.tele = null;
    e.hot = false;
    return true;
  };
  wrap(CH.Enemies.Enemy.prototype, 'update', function (orig, g, dt) {
    if (!(this.fearT > 0) || this.dead || this.state === 'spawn' || this.state === 'stunned') return orig.call(this, g, dt);
    this.fearT -= dt;
    if (g.warpT > 0) dt *= 0.42;
    this.age += dt;
    if (this.flash > 0) this.flash -= dt * 6;
    if (this.squash > 0) this.squash -= dt * 7;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.atkCd > 0) this.atkCd -= dt;
    this.contactCd = Math.max(this.contactCd, 0.2); // no touch damage while fleeing
    const p = g.nearestPlayer(this.x, this.y) || g.player;
    const a = Math.atan2(this.y - p.y, this.x - p.x) + Math.sin(this.age * 6) * 0.5;
    const sp = (this.speed || 60) * 1.1;
    this.dvx = Math.cos(a) * sp;
    this.dvy = Math.sin(a) * sp;
    if (this.state !== 'chase') this.state = 'chase';
    this.integrate(g, dt);
    if (this.fearT <= 0) this.fearT = 0;
  });
  G.on('damageEnemy:before', function (ev) {
    if (ev.e && ev.e.fearT > 0) ev.dmg *= 1.25;
  });
  G.on('kill', function (e) {
    const wasFeared = e.fearT > 0; // the core does not change fear or the killer
    const killer = e.lastHitBy;
    if (wasFeared && killer && X.heroIs(killer, 'Stranger')) {
      // the Stranger's passive: a feared kill leaves a brief shadow that fights for him
      X.addTurret(e.x, e.y, { owner: killer, life: 4, rate: 0.3, dmg: 7 });
      FX.burst(e.x, e.y, { n: 8, colors: ['#222034', '#c2c3c7', '#ffffff'], speed: 60, life: 0.5 });
    }
  });

  /* ------------------------------------------------------------------ specials */
  wrap(CH.Player.prototype, 'castEffect', function (orig, g) {
    const p = this;
    const sp = p.hero.special;
    const dm = p.stats.dmgMult;
    if (sp === 'spiritbloom') {
      Audio.sfx('special');
      g.shake(4, 0.3);
      FX.ring(p.x, p.y, 6, 80, '#63c74d', 0.45);
      FX.ring(p.x, p.y, 4, 54, '#c2f7d0', 0.35);
      const n = altOn(p) ? 7 : 5;
      for (let i = 0; i < n; i++) X.addTurret(p.x + U.rand(-30, 30), p.y + U.rand(-24, 24), { owner: p, life: 8, rate: 0.36, dmg: 9 });
      for (const q of g.players) if (!q.dead && U.dist(q.x, q.y, p.x, p.y) < 170) g.healPlayer(q.maxHp * 0.18 / q.stats.healMult / g.diff.heal, q);
      FX.text(p.x, p.y - 30, 'SPIRIT BLOOM', '#63c74d', 1);
      return;
    }
    if (sp === 'energyslash') {
      Audio.sfx('special');
      g.shake(6, 0.3);
      const len = altOn(p) ? 190 : 150;
      const ax = Math.cos(p.aim), ay = Math.sin(p.aim);
      const x0 = p.x, y0 = p.y;
      let hits = 0;
      for (const e of g.enemies) {
        if (e.dead || e.state === 'spawn') continue;
        const t = U.clamp(((e.x - x0) * ax + (e.y - y0) * ay) / len, 0, 1);
        const d = U.dist(e.x, e.y, x0 + ax * len * t, y0 + ay * len * t);
        if (d < 26 + e.r) {
          hits++;
          G.damageEnemy(e, 55 * dm * 1.8, { elem: 'tech', crit: true, src: 'player', shooter: p });
        }
      }
      // blink to the end of the line (stop before the arena wall)
      const m = B.arena.margin + p.r;
      p.x = U.clamp(x0 + ax * len, m, g.arena.w - m);
      p.y = U.clamp(y0 + ay * len, m, g.arena.h - m);
      for (let i = 0; i <= 10; i++) FX.burst(x0 + ax * len * (i / 10), y0 + ay * len * (i / 10), { n: 3, colors: ['#29adff', '#ff77a8', '#ffffff'], speed: 40, life: 0.4 });
      FX.text(p.x, p.y - 30, hits ? 'SLASH x' + hits : 'ENERGY SLASH', '#ff77a8', 1);
      return;
    }
    if (sp === 'horrorstare') {
      Audio.sfx('special');
      g.shake(5, 0.4);
      const range = altOn(p) ? 230 : 190;
      const half = Math.PI / 3; // 120 degree cone
      let n = 0;
      for (const e of g.enemies) {
        if (e.dead || e.state === 'spawn') continue;
        const d = U.dist(e.x, e.y, p.x, p.y);
        if (d > range) continue;
        if (Math.abs(U.angDiff(p.aim, Math.atan2(e.y - p.y, e.x - p.x))) > half) continue;
        if (Kits.fear(e, 4.5)) n++;
        else if (e.isBoss && e.stun) e.stun(0.6); // bosses only flinch
      }
      // a sickly cone of light along the aim
      for (let i = 1; i <= 8; i++) {
        const r = (range * i) / 8;
        for (const s of [-1, 0, 1]) FX.burst(p.x + Math.cos(p.aim + s * half * 0.8) * r, p.y + Math.sin(p.aim + s * half * 0.8) * r, { n: 2, colors: ['#ffffff', '#c2c3c7', '#222034'], speed: 25, life: 0.5 });
      }
      FX.ring(p.x, p.y, 6, range * 0.6, '#c2c3c7', 0.5);
      FX.text(p.x, p.y - 30, n ? 'FEARED x' + n : 'HORROR STARE', '#ffffff', 1);
      return;
    }
    return orig.call(this, g);
  });

  /* ------------------------------------------------------------------ passives */
  X.statHooks.push((p, s) => {
    if (X.heroIs(p, 'Enchantress')) s.healMult *= 1.2;
    if (X.heroIs(p, 'Specter')) s.critChance += Math.min(0.3, Math.floor(p.noHitT || 0) * 0.03);
  });
  G.on('playerUpdate:before', function (ev) {
    const p = ev.p;
    if (X.heroIs(p, 'Specter')) {
      const before = Math.floor(p.noHitT || 0);
      p.noHitT = (p.noHitT || 0) + ev.dt;
      if (Math.floor(p.noHitT) !== before && before < 11) Up.recalc(p);
    }
  });
  X.chain('onHurt', (p) => {
    if (X.heroIs(p, 'Specter') && (p.noHitT || 0) > 0) {
      p.noHitT = 0;
      Up.recalc(p);
    }
  });
  /* Stranger: each free barricade is an effigy that taunts nearby enemies */
  wrap(CH.Player.prototype, 'deployBarricade', function (orig, g) {
    const r = orig.call(this, g);
    if (X.heroIs(this, 'Stranger')) {
      const q = this;
      g.addDecoy(q.x + Math.cos(q.aim) * 34, q.y + Math.sin(q.aim) * 34, 9);
    }
    return r;
  });

  /* enemy tint while feared (see render): a pale shiver */
  Kits.isFeared = (e) => e && e.fearT > 0;
})(window.CH);
