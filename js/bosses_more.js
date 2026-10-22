/* CHAOS.exe - ten more bosses, from the remaining art packs. Same machinery as bosses.js (generator attack
   scripts, telegraphs, recovery windows); they register themselves with Bo.classes / Bo.LOOK / Bo.META.
     Elderroot the Ancient Treant, Graveljaw the Moss Golem, Sir Skullhorn the Shield-Breaker,
     Frostmaw the Yeti King (becomes an Ice Golem), Daddy the Abomination, The Skull King,
     Aurelis the Sandwyrm, Vorax the Bloodwing, Mycelia the Spore Eye, Nyx'ra the Void Eye. */
(function (CH) {
  'use strict';
  const U = CH.U;
  const FX = CH.FX;
  const Audio = CH.Audio;
  const Bo = CH.Bosses;
  const Boss = Bo.Boss;

  /* ---------------------------------------------------------------- shared attack helpers */
  Object.assign(Boss.prototype, {
    /* n shots evenly around the boss */
    ring(n, speed, dmg, sprite, o, off) {
      for (let i = 0; i < n; i++) this.shot((i / n) * U.TAU + (off || 0), speed, dmg, sprite, o);
    },
    /* n shots in an arc around angle a */
    fan(a, n, spread, speed, dmg, sprite, o) {
      for (let k = 0; k < n; k++) this.shot(a + (k - (n - 1) / 2) * spread, speed, dmg, sprite, o);
    },
    /* a warned blast somewhere: explosion (and an optional lingering field) when the warning ends */
    blast(x, y, R, dmg, T, o) {
      o = o || {};
      const g = this.g;
      g.addWarn(x, y, R, T / this.bs, (g2, z) => {
        g2.explode(z.x, z.y, R, 0, { hurtPlayer: true, pdmg: g2.edmg(dmg), colors: o.colors || 'fire', knock: o.knock || 170, fx: o.fx || this.elem, noShake: !!o.quiet });
        if (o.field) g2.addZone(Object.assign({ kind: 'field', x: z.x, y: z.y, r: R * 0.85, life: 3, dmgP: g2.edmg(o.field.dmg || 5), tick: 0.5 }, o.field));
        if (o.after) o.after(z);
        if (!o.quiet) Audio.sfx(o.sfx || 'big_explosion');
      });
      Audio.sfx('warn');
    },
    /* blasts scattered around the hero (the first one right on them) */
    *barrage(n, spread, R, dmg, T, gap, o) {
      const p = this.tp();
      for (let i = 0; i < n; i++) {
        const x = i === 0 ? p.x : U.clamp(p.x + U.rand(-spread, spread), 40, this.g.arena.w - 40);
        const y = i === 0 ? p.y : U.clamp(p.y + U.rand(-spread, spread), 40, this.g.arena.h - 40);
        this.blast(x, y, R, dmg, T, o);
        yield gap;
      }
    },
    /* a warned straight beam from (x, y) */
    beamAt(ang, delay, w, dmg, elem, len) {
      const g = this.g;
      const ox = this.x;
      const oy = this.y - 4;
      const L = len || 480;
      CH.Kit.cast(elem || this.elem, ox, oy, 16);
      g.addWarn(ox, oy, 0, delay, (g2) => {
        CH.Kit.beam(elem || this.elem, ox, oy, ang, L, w);
        g2.addZone({ kind: 'beam', shape: 'line', x: ox, y: oy, ang, len: L, w, life: 0.35, dmgP: g2.edmg(dmg), once: true });
        g2.shake(2, 0.18);
        Audio.sfx('thunder');
      }, { shape: 'line', ang, len: L, w });
    },
    /* telegraphed straight charge at the hero. Returns true when it ended against a wall. */
    *rush(o) {
      const g = this.g;
      this.setState('attack');
      this.play(o.anim, o.animDur || 1.6);
      this.gather(1);
      let el = 0;
      const T = (o.T || 0.9) / this.bs;
      this.setTele('line', T, { len: o.len || 300, ang: this.angP() });
      Audio.sfx('warn');
      yield (dt) => {
        el += dt;
        this.tele.ang = this.angP();
        this.face = Math.cos(this.tele.ang) >= 0 ? 1 : -1;
        return el >= T;
      };
      const a = this.tele ? this.tele.ang : this.angP();
      this.tele = null;
      this.hot = true;
      if (o.spin) this.spin = 1;
      el = 0;
      let crashed = false;
      Audio.sfx(o.sfx || 'dodge');
      yield (dt) => {
        el += dt;
        CH.Enemies.moveDir(this, a, (o.speed || 260) * this.speedMul);
        this.face = Math.cos(a) >= 0 ? 1 : -1;
        this.streak(dt, a, 22, o.elem);
        if (Math.random() < 0.5) FX.dust(this.x, this.y + 14, 1);
        if (this.wallHit) crashed = true;
        return crashed || el > (o.time || 1.0);
      };
      this.hot = false;
      this.spin = 0;
      if (crashed) {
        Audio.sfx('slam');
        g.shake(5, 0.25);
        CH.Kit.impact('earth', this.x, this.y + 4, 34);
        if (o.crashText) FX.text(this.x, this.y - 32, o.crashText, '#ffffff', 1);
      }
      return crashed;
    },
    /* a leap onto the hero with a warned landing */
    *leapSlam(R, dmg, anim, o) {
      o = o || {};
      const g = this.g;
      this.setState('attack');
      this.play(anim || 'jump', 1.8);
      Audio.sfx('jump');
      this.gather(1.2);
      const p = this.tp();
      const tx = p.x;
      const ty = p.y;
      g.addWarn(tx, ty, R, 1.0 / this.bs, (g2, z) => {
        g2.explode(z.x, z.y, R, 0, { hurtPlayer: true, pdmg: g2.edmg(dmg), colors: o.colors || 'fire', knock: 230, fx: this.elem });
        g2.shake(6, 0.3);
        Audio.sfx('slam');
        if (o.ring) this.ring(o.ring.n, o.ring.speed || 90, g2.edmg(o.ring.dmg || 6), o.ring.sprite, o.ring.o);
        if (o.field) g2.addZone(Object.assign({ kind: 'field', x: z.x, y: z.y, r: R * 0.8, life: 3, dmgP: g2.edmg(5), tick: 0.5 }, o.field));
      });
      Audio.sfx('warn');
      const sx = this.x;
      const sy = this.y;
      let el = 0;
      const T = 1.0 / this.bs;
      yield (dt) => {
        el += dt;
        const k = Math.min(1, el / T);
        this.x = U.lerp(sx, tx, U.easeOut(k));
        this.y = U.lerp(sy, ty, U.easeOut(k));
        this.z = Math.sin(k * Math.PI) * (o.h || 44);
        return el >= T;
      };
      this.z = 0;
    },
    /* every boss reaches a hero standing near it differently; this is the common "step forward and hit" */
    *lunge(dist, T, dmg, R, elem) {
      const g = this.g;
      const a = this.angP();
      const sx = this.x;
      const sy = this.y;
      const tx = sx + Math.cos(a) * dist;
      const ty = sy + Math.sin(a) * dist;
      let el = 0;
      const TT = T / this.bs;
      this.hot = true;
      yield (dt) => {
        el += dt;
        const k = Math.min(1, el / TT);
        this.x = U.lerp(sx, tx, k);
        this.y = U.lerp(sy, ty, k);
        this.streak(dt, a, 28, elem);
        return el >= TT;
      };
      this.hot = false;
      CH.Kit.slash(elem || this.elem, this.x, this.y - 10, a, 42);
      Audio.sfx('slam');
      g.hurtPlayers(g.edmg(dmg), this, { kx: Math.cos(a) * 200, ky: Math.sin(a) * 200 }, (q) => Math.hypot(q.x - this.x, q.y - this.y) < R + q.r);
    },
  });

  /* register a boss kind */
  function reg(kind, cls, look, meta) {
    Bo.classes[kind] = cls;
    Bo.LOOK[kind] = look;
    Bo.META[kind] = meta || {};
  }

  /* ===================================================================
     ELDERROOT THE ANCIENT TREANT  (early boss)
     =================================================================== */
  class TreantBoss extends Boss {
    attackPool() {
      return [
        { name: 'root_snare', w: 3 },
        { name: 'seed_barrage', w: 2.8 },
        { name: 'leaf_cyclone', w: 2.2 },
        { name: 'sprouts', w: this.g.enemies.length > 14 ? 0.3 : 1.5 },
        { name: 'bark_slam', w: 2.2 },
      ];
    }
    *atk_root_snare() {
      this.setState('attack');
      this.play('spec2', 2.6);
      this.gather(1.2);
      FX.speech(this, 'THE ROOTS REMEMBER!', 1.6);
      yield 0.4;
      yield* this.barrage(this.enraged ? 6 : 4, 85, 26, 13, 1.0, 0.22, { colors: 'goo', fx: 'earth', field: { color: '#4a7a35', color2: '#8bc34a', slow: 0.5, dmg: 4 }, sfx: 'slam', knock: 120 });
      yield 1.1;
      yield* this.recoverFor(1.0);
    }
    *atk_seed_barrage() {
      const g = this.g;
      yield* this.windup('excl', 0.55, undefined, 'attack', 2.0);
      for (let v = 0; v < 3; v++) {
        Audio.sfx('cre_wet');
        this.fan(this.angP(), this.enraged ? 7 : 5, 0.22, 100, g.edmg(8), 'vfx.p5.23', { animFps: 16, scale: 0.75, r: 4, color: '#8bc34a', fx: 'earth' });
        yield 0.55;
      }
      yield* this.recoverFor(0.9);
    }
    *atk_leaf_cyclone() {
      const g = this.g;
      this.setState('attack');
      this.play('spec1', 3.2);
      this.gather(1.3);
      FX.speech(this, 'LEAF STORM!', 1.4);
      Audio.sfx('wind');
      yield 0.5;
      const waves = this.enraged ? 6 : 4;
      for (let w = 0; w < waves; w++) {
        this.ring(10, 80 + w * 6, g.edmg(6), 'vfx.p5.23', { animFps: 16, scale: 0.6, r: 3, color: '#a8d06a', fx: 'earth' }, w * 0.31);
        yield 0.38;
      }
      yield* this.recoverFor(1.0);
    }
    *atk_sprouts() {
      yield* this.windup('ring', 0.7, { r: 60 }, 'attack', 1.8);
      FX.speech(this, 'ARISE, CHILDREN!', 1.8);
      Audio.sfx('event');
      this.summon('plant', this.enraged ? 3 : 2, { variant: 1 });
      this.summon('plant', 1, { variant: 2 });
      yield* this.recoverFor(1.2);
    }
    *atk_bark_slam() {
      yield* this.leapSlam(64, 20, 'jump', { colors: 'goo', ring: { n: 8, speed: 85, sprite: 'vfx.p5.23', o: { animFps: 16, scale: 0.6, r: 3, color: '#8bc34a', fx: 'earth' } } });
      yield* this.recoverFor(1.2);
    }
  }
  reg('treant', TreantBoss, { sprite: 'boss_treant', scale: 1.15, foot: 24, h: 82, shadow: 50, dmg: 11 }, { voice: 'cre_growl', dist: 80, enrage: true });

  /* ===================================================================
     GRAVELJAW THE MOSS GOLEM
     =================================================================== */
  class MossBoss extends Boss {
    attackPool() {
      return [
        { name: 'boulder_toss', w: 3 },
        { name: 'ground_pound', w: 2.6 },
        { name: 'rolling_charge', w: 2.4 },
        { name: 'quake', w: 2.4 },
      ];
    }
    *atk_boulder_toss() {
      const g = this.g;
      yield* this.windup('excl', 0.55, undefined, 'spec1', 2.0);
      for (let v = 0; v < (this.enraged ? 4 : 3); v++) {
        Audio.sfx('rock');
        this.fan(this.angP(), 5, 0.24, 110, g.edmg(9), 'fx.rock', { scale: 0.7, r: 5, color: '#8a8a8a', fx: 'earth', spin: 6 });
        yield 0.5;
      }
      yield* this.recoverFor(1.0);
    }
    *atk_ground_pound() {
      const g = this.g;
      this.setState('attack');
      this.play('attack', 2.0);
      this.gather(1.2);
      FX.speech(this, 'GRAVEL AND GRIT!', 1.4);
      const R = 60;
      g.addWarn(this.x, this.y + 6, R, 0.95 / this.bs, (g2, z) => {
        g2.explode(z.x, z.y, R, 0, { hurtPlayer: true, pdmg: g2.edmg(18), colors: 'junk', knock: 240, fx: 'earth' });
        g2.shake(7, 0.35);
        Audio.sfx('slam');
        this.ring(this.enraged ? 14 : 10, 95, g2.edmg(7), 'fx.rock', { scale: 0.5, r: 4, color: '#8a8a8a', fx: 'earth' });
      });
      Audio.sfx('warn');
      yield 1.5;
      yield* this.recoverFor(1.1);
    }
    *atk_rolling_charge() {
      const crashed = yield* this.rush({ anim: 'spec2', animDur: 1.9, T: 0.95, len: 340, speed: 300, time: 1.25, elem: 'earth', spin: true, crashText: 'OOF!' });
      if (crashed) yield* this.recoverFor(1.6);
      else yield* this.recoverFor(0.8);
    }
    *atk_quake() {
      const g = this.g;
      this.setState('attack');
      this.play('jump', 2.2);
      this.gather(1.3);
      FX.speech(this, 'QUAKE!', 1.2);
      yield 0.5;
      const a = this.angP();
      const n = this.enraged ? 9 : 7;
      for (let i = 1; i <= n; i++) {
        const x = U.clamp(this.x + Math.cos(a) * i * 34, 36, g.arena.w - 36);
        const y = U.clamp(this.y + Math.sin(a) * i * 34, 36, g.arena.h - 36);
        this.blast(x, y, 26, 14, 0.8, { colors: 'junk', fx: 'earth', quiet: i % 2 === 0, knock: 130 });
        yield 0.13;
      }
      yield 1.0;
      yield* this.recoverFor(1.0);
    }
  }
  reg('moss', MossBoss, { sprite: 'boss_moss', scale: 1.1, foot: 26, h: 78, shadow: 64, dmg: 14 }, { voice: 'cre_growl', dist: 80, enrage: true });

  /* ===================================================================
     SIR SKULLHORN THE SHIELD-BREAKER
     =================================================================== */
  class KnightBoss extends Boss {
    attackPool() {
      return [
        { name: 'shield_bash', w: 3 },
        { name: 'shield_wall', w: 2.2 },
        { name: 'mace_whirl', w: 2.6 },
        { name: 'leap_slam', w: 2.4 },
      ];
    }
    *atk_shield_bash() {
      const crashed = yield* this.rush({ anim: 'run', animDur: 1.6, T: 0.8, len: 280, speed: 310, time: 0.95, elem: 'phys', crashText: 'MY HORN!' });
      yield* this.recoverFor(crashed ? 1.6 : 0.8);
    }
    *atk_shield_wall() {
      const g = this.g;
      this.setState('attack');
      this.play('spec1', 3.4);
      Audio.sfx('shield');
      FX.speech(this, 'HOLD THE LINE!', 1.6);
      this.dmgTaken = 0.25; // the shield soaks most of the damage
      CH.Kit.cast('phys', this.x, CH.Kit.bossBody(this), 20);
      yield 0.7;
      for (let v = 0; v < 3; v++) {
        Audio.sfx('slam');
        const a = this.angP();
        this.fan(a, this.enraged ? 7 : 5, 0.2, 120, g.edmg(8), 'fx.mawBone1', { scale: 1.0, r: 4, color: '#e8e4f0', fx: 'phys', spin: 10 });
        yield 0.6;
      }
      this.dmgTaken = 1;
      yield* this.recoverFor(1.0);
    }
    *atk_mace_whirl() {
      const g = this.g;
      this.setState('attack');
      this.play('spec2', 3.6);
      this.gather(1.2);
      FX.speech(this, 'SPIN TO WIN!', 1.4);
      Audio.sfx('whoosh');
      yield 0.5;
      const turns = this.enraged ? 18 : 13;
      for (let i = 0; i < turns; i++) {
        const a = i * 0.7;
        this.shot(a, 95, g.edmg(7), 'fx.mawBall2', { scale: 1.1, r: 4, color: '#c2c3c7', fx: 'phys' });
        this.shot(a + Math.PI, 95, g.edmg(7), 'fx.mawBall2', { scale: 1.1, r: 4, color: '#c2c3c7', fx: 'phys' });
        yield 0.1;
      }
      yield* this.recoverFor(1.1);
    }
    *atk_leap_slam() {
      yield* this.leapSlam(58, 20, 'jump', { colors: 'junk', ring: { n: 8, speed: 95, sprite: 'fx.mawBone1', o: { scale: 0.9, r: 3, color: '#e8e4f0', fx: 'phys', spin: 8 } } });
      yield* this.recoverFor(1.2);
    }
  }
  reg('knight', KnightBoss, { sprite: 'boss_knight', scale: 1.15, foot: 22, h: 78, shadow: 44, dmg: 12 }, { voice: 'cre_growl', dist: 70, enrage: true });

  /* ===================================================================
     FROSTMAW THE YETI KING  (turns into an Ice Golem at half health)
     =================================================================== */
  class YetiBoss extends Boss {
    constructor(g, kind, x, y, o) {
      super(g, kind, x, y, o);
      this.form = 1;
    }
    checkPhase(g) {
      if (this.form === 1 && this.hp / this.maxHp < 0.5) {
        this.form = 2;
        this.enterPhase(g, 2, 'THE YETI SHATTERS!', true);
        if (CH.Sprites.has('boss_yeti2')) this.look.sprite = 'boss_yeti2';
        this.baseDmgTaken = this.dmgTaken = 0.85;
        CH.Kit.impact('ice', this.x, this.y - 6, 60);
      }
    }
    attackPool() {
      const crowd = this.g.enemies.length > 14;
      if (this.form === 2) {
        return [
          { name: 'crystal_spikes', w: 3 },
          { name: 'shatter', w: 2.6 },
          { name: 'glacier_ray', w: 2.4 },
          { name: 'frost_nova', w: 2.2 },
        ];
      }
      return [
        { name: 'snowball_barrage', w: 3 },
        { name: 'avalanche', w: 2.6 },
        { name: 'yeti_stomp', w: 2.4 },
        { name: 'frost_charge', w: crowd ? 1 : 2 },
      ];
    }
    *atk_snowball_barrage() {
      const g = this.g;
      yield* this.windup('excl', 0.55, undefined, 'attack', 2.0);
      for (let v = 0; v < 3; v++) {
        Audio.sfx('shoot_chair');
        this.fan(this.angP(), 5, 0.22, 120, g.edmg(9), 'fx.mageIce', { scale: 0.8, r: 5, color: '#cfeaff', fx: 'ice', slow: { mul: 0.55, t: 1.6 } });
        yield 0.5;
      }
      yield* this.recoverFor(0.9);
    }
    *atk_avalanche() {
      this.setState('attack');
      this.play('jump', 2.4);
      this.gather(1.3);
      FX.speech(this, 'AVALANCHE!', 1.4);
      yield 0.4;
      yield* this.barrage(this.enraged ? 7 : 5, 95, 28, 14, 1.0, 0.2, { colors: 'confetti', fx: 'ice', field: { color: '#9fd8ef', color2: '#e8f6ff', slow: 0.55, dmg: 4 }, quiet: false, sfx: 'slam' });
      yield 1.1;
      yield* this.recoverFor(1.0);
    }
    *atk_yeti_stomp() {
      const g = this.g;
      this.setState('attack');
      this.play('attack', 1.9);
      this.gather(1.2);
      const R = 58;
      g.addWarn(this.x, this.y + 6, R, 0.9 / this.bs, (g2, z) => {
        g2.explode(z.x, z.y, R, 0, { hurtPlayer: true, pdmg: g2.edmg(18), colors: 'confetti', knock: 240, fx: 'ice' });
        g2.addZone({ kind: 'field', x: z.x, y: z.y, r: R * 0.9, life: 3, dmgP: g2.edmg(5), tick: 0.5, color: '#9fd8ef', color2: '#e8f6ff', slow: 0.5 });
        g2.shake(6, 0.3);
        Audio.sfx('slam');
      });
      Audio.sfx('warn');
      yield 1.4;
      yield* this.recoverFor(1.1);
    }
    *atk_frost_charge() {
      const crashed = yield* this.rush({ anim: 'run', animDur: 1.6, T: 0.9, len: 300, speed: 290, time: 1.1, elem: 'ice', crashText: 'BRRR!' });
      yield* this.recoverFor(crashed ? 1.5 : 0.8);
    }
    *atk_crystal_spikes() {
      const g = this.g;
      this.setState('attack');
      this.play('attack', 2.0);
      this.gather(1.3);
      FX.speech(this, 'SHARDS OF WINTER!', 1.6);
      yield 0.4;
      const base = this.angP();
      const lines = this.enraged ? 5 : 3;
      for (let i = 0; i < lines; i++) {
        const a = base + (i - (lines - 1) / 2) * 0.5;
        for (let s = 1; s <= 6; s++) this.blast(this.x + Math.cos(a) * s * 36, this.y + Math.sin(a) * s * 36, 18, 12, 0.6 + s * 0.09, { colors: 'confetti', fx: 'ice', quiet: s % 2 === 1, knock: 100 });
      }
      yield 1.8;
      yield* this.recoverFor(1.0);
    }
    *atk_shatter() {
      const g = this.g;
      yield* this.windup('ring', 0.7, { r: 52 }, 'attack', 2.0);
      Audio.sfx('crit');
      for (let w = 0; w < (this.enraged ? 3 : 2); w++) {
        this.ring(14, 95, g.edmg(7), 'fx.mageIce', { scale: 0.7, r: 4, color: '#9fd8ef', fx: 'ice', slow: { mul: 0.6, t: 1.2 } }, w * 0.22);
        yield 0.5;
      }
      yield* this.recoverFor(1.0);
    }
    *atk_glacier_ray() {
      yield* this.windup('ring', 0.6, { r: 44 }, 'attack', 1.8);
      const a = this.angP();
      for (const off of this.enraged ? [-0.3, 0, 0.3] : [0]) this.beamAt(a + off, 0.8 / this.bs, 14, 17, 'ice', 440);
      yield 1.3;
      yield* this.recoverFor(1.1);
    }
    *atk_frost_nova() {
      const g = this.g;
      this.setState('attack');
      this.play('attack', 1.9);
      this.gather(1.3);
      for (let k = 1; k <= 3; k++) {
        g.addWarn(this.x, this.y, 30 + k * 28, (0.7 + k * 0.3) / this.bs, (g2, z) => {
          g2.explode(z.x, z.y, z.r, 0, { hurtPlayer: true, pdmg: g2.edmg(11), colors: 'confetti', knock: 150, fx: 'ice', noShake: true });
          Audio.sfx('crit');
        });
      }
      Audio.sfx('warn');
      yield 1.9;
      yield* this.recoverFor(1.0);
    }
  }
  reg('yeti', YetiBoss, { sprite: 'boss_yeti', scale: 1.1, foot: 24, h: 80, shadow: 52, dmg: 13 }, { voice: 'cre_roar', dist: 80 });

  /* ===================================================================
     DADDY, THE ABOMINATION  (final-wave boss)
     =================================================================== */
  class DaddyBoss extends Boss {
    attackPool() {
      return [
        { name: 'arm_cannon', w: 3 },
        { name: 'overcharge', w: 2.6 },
        { name: 'scream', w: 2.2 },
        { name: 'stampede', w: 2.4 },
      ];
    }
    *atk_arm_cannon() {
      const g = this.g;
      yield* this.windup('excl', 0.5, undefined, 'shoot', 1.5);
      for (let v = 0; v < (this.enraged ? 5 : 4); v++) {
        Audio.sfx('shoot_chair');
        CH.Kit.muzzle(this.elem, this.x, this.y - 10, this.angP(), 14, { force: true });
        this.fan(this.angP(), v % 2 ? 4 : 3, 0.26, 135, g.edmg(9), 'fx.mawBall1', { scale: 1.2, r: 4, color: '#3b6fe0', fx: this.elem });
        yield 0.42;
      }
      yield* this.recoverFor(0.9);
    }
    *atk_overcharge() {
      const g = this.g;
      this.setState('attack');
      this.play(this.enraged ? 'charged2' : 'charged', 2.2);
      this.gather(1.5);
      FX.speech(this, 'DADDY IS ANGRY!', 1.6);
      const p = this.tp();
      const R = 70;
      g.addWarn(p.x, p.y, R, 1.3 / this.bs, (g2, z) => {
        g2.explode(z.x, z.y, R, 0, { hurtPlayer: true, pdmg: g2.edmg(24), colors: 'fire', knock: 260, fx: 'bolt' });
        CH.Kit.impact('bolt', z.x, z.y, R * 0.7);
        g2.shake(7, 0.4);
        Audio.sfx('big_explosion');
        this.ring(10, 100, g2.edmg(7), 'fx.mawBall1', { scale: 1.0, r: 4, color: '#feae34', fx: 'bolt' }, 0);
      });
      Audio.sfx('warn');
      yield 2.1;
      yield* this.recoverFor(1.1);
    }
    *atk_scream() {
      const g = this.g;
      yield* this.windup('ring', 0.7, { r: 70 }, 'scream', 3.0);
      FX.speech(this, 'RAAAAAARGH!', 1.6);
      Audio.sfx('cre_roar');
      g.shake(5, 0.6);
      for (let w = 0; w < 3; w++) {
        this.ring(12, 85 + w * 12, g.edmg(6), 'fx.mawBall1', { scale: 0.9, r: 3, color: '#c2c3c7', fx: 'phys' }, w * 0.26);
        yield 0.5;
      }
      this.summon('intern', this.enraged ? 4 : 3);
      this.summon('trashcan', 1);
      yield* this.recoverFor(1.0);
    }
    *atk_stampede() {
      const crashed = yield* this.rush({ anim: 'walk', animDur: 1.5, T: 0.9, len: 320, speed: 285, time: 1.15, elem: 'phys', crashText: 'DADDY SMASH!' });
      yield* this.recoverFor(crashed ? 1.6 : 0.8);
    }
  }
  reg('daddy', DaddyBoss, { sprite: 'boss_daddy', scale: 1.2, foot: 24, h: 84, shadow: 54, dmg: 15, flipBase: true }, { voice: 'cre_roar', dist: 85, enrage: true });

  /* ===================================================================
     THE SKULL KING  (final boss alternative, three phases)
     =================================================================== */
  class SkullBoss extends Boss {
    checkPhase(g) {
      const f = this.hp / this.maxHp;
      if (this.phase === 1 && f < 0.66) this.enterPhase(g, 2, 'THE CROWN BURNS', false);
      else if (this.phase === 2 && f < 0.33) {
        this.enterPhase(g, 3, 'ALL HANDS ON DECK', true);
      }
    }
    attackPool() {
      const crowd = this.g.enemies.length > 14;
      const pool = [
        { name: 'hand_slam', w: 3 },
        { name: 'chomp', w: 2.4 },
        { name: 'eye_beams', w: 2.6 },
        { name: 'bone_crown', w: 2.4 },
        { name: 'rise', w: crowd ? 0.3 : 1.4 },
      ];
      if (this.phase >= 2) pool.push({ name: 'bone_rain', w: 2.6 });
      if (this.phase >= 3) pool.push({ name: 'grand_slam', w: 2.6 });
      return pool;
    }
    *atk_hand_slam() {
      const g = this.g;
      this.setState('attack');
      this.play('slam', 2.0);
      this.gather(1.3);
      FX.speech(this, 'COME HERE!', 1.3);
      const p = this.tp();
      for (const side of [-1, 1]) {
        const x = U.clamp(p.x + side * 34, 40, g.arena.w - 40);
        this.blast(x, p.y, 30, 16, 1.0, { colors: 'glitch', fx: 'magic', after: (z) => CH.Kit.impact('magic', z.x, z.y - 6, 26) });
      }
      this.blast(p.x, p.y, 26, 18, 1.15, { colors: 'glitch', fx: 'magic' });
      yield 1.7;
      yield* this.recoverFor(1.0);
    }
    *atk_chomp() {
      const g = this.g;
      yield* this.windup('excl', 0.5, undefined, 'chomp', 1.8);
      Audio.sfx('slam');
      const a = this.angP();
      CH.Kit.slash('magic', this.x, this.y - 8, a, 44);
      g.shake(4, 0.2);
      this.fan(a, 7, 0.18, 130, g.edmg(8), 'fx.mawBone1', { scale: 1.0, r: 4, color: '#e8e4f0', fx: 'magic', spin: 10 });
      g.hurtPlayers(g.edmg(17), this, { kx: Math.cos(a) * 200, ky: Math.sin(a) * 200 }, (q) => Math.hypot(q.x - this.x, q.y - this.y) < 46 + q.r && Math.abs(U.angDiff(a, U.ang(this.x, this.y, q.x, q.y))) < 0.9);
      yield 0.5;
      yield* this.recoverFor(1.0);
    }
    *atk_eye_beams() {
      yield* this.windup('ring', 0.5, { r: 42 }, 'cast', 2.0);
      const base = this.angP();
      const offs = this.phase >= 3 ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.3, 0, 0.3];
      for (const o of offs) this.beamAt(base + o, 0.9 / this.bs, 10, 14, 'magic');
      yield 1.4;
      yield* this.recoverFor(0.9);
    }
    *atk_bone_crown() {
      const g = this.g;
      this.setState('attack');
      this.play('cast', 2.4);
      this.gather(1.3);
      FX.speech(this, 'BOW TO THE CROWN!', 1.6);
      yield 0.5;
      const waves = 2 + this.phase;
      for (let w = 0; w < waves; w++) {
        this.ring(12, 88, g.edmg(6), 'fx.mawBone1', { scale: 0.9, r: 3, color: '#e8e4f0', fx: 'magic', spin: 9 }, w * 0.26);
        Audio.sfx('arrow');
        yield 0.42;
      }
      yield* this.recoverFor(1.0);
    }
    *atk_rise() {
      yield* this.windup('ring', 0.7, { r: 70 }, 'cast', 2.4);
      FX.speech(this, 'ARISE!', 1.6);
      Audio.sfx('event');
      FX.vfx('fx.mawZombies', this.x - 30, this.y + 6, { scale: 1, fps: 8, alpha: 0.9 });
      FX.vfx('fx.mawZombies', this.x + 30, this.y + 6, { scale: 1, fps: 8, alpha: 0.9 });
      this.summon('office', this.phase >= 3 ? 3 : 2);
      this.summon('intern', this.phase >= 3 ? 4 : 3);
      yield* this.recoverFor(1.3);
    }
    *atk_bone_rain() {
      this.setState('attack');
      this.play('cast', 2.6);
      this.gather(1.2);
      FX.speech(this, 'A SHOWER OF BONES!', 1.6);
      yield 0.4;
      yield* this.barrage(this.phase >= 3 ? 9 : 7, 110, 22, 12, 0.9, 0.16, { colors: 'glitch', fx: 'magic', quiet: false });
      yield 1.0;
      yield* this.recoverFor(1.0);
    }
    *atk_grand_slam() {
      const g = this.g;
      this.setState('attack');
      this.play('slam', 2.4);
      this.gather(1.5);
      FX.speech(this, 'ALL HANDS!', 1.4);
      const p = this.tp();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * U.TAU;
        this.blast(p.x + Math.cos(a) * 70, p.y + Math.sin(a) * 70, 24, 14, 1.1 + i * 0.07, { colors: 'glitch', fx: 'magic', quiet: i % 2 === 1 });
      }
      this.blast(p.x, p.y, 34, 20, 1.5, { colors: 'glitch', fx: 'magic' });
      yield 2.1;
      yield* this.recoverFor(1.0);
    }
  }
  reg('skull', SkullBoss, { sprite: 'boss_skull', scale: 1.0, foot: 34, h: 76, shadow: 56, dmg: 14, hover: 6 }, { voice: 'cre_hiss', dist: 110 });

  /* ===================================================================
     the two extra dragons: same skeleton as Ignis, their own breath
     =================================================================== */
  /* AURELIS THE SANDWYRM */
  class SandWyrm extends Boss {
    attackPool() {
      return [
        { name: 'sand_breath', w: 3.2 },
        { name: 'dust_dive', w: 2.6 },
        { name: 'tail_claw', w: 2.6 },
        { name: 'sandstorm', w: 2.2 },
      ];
    }
    *atk_sand_breath() {
      const g = this.g;
      yield* this.windup('ring', 0.6, { r: 52 }, 'attack2', 2.8);
      Audio.sfx('cre_roar');
      const base = this.angP();
      const n = this.enraged ? 14 : 10;
      for (let i = 0; i < n; i++) {
        const a = base + Math.sin((i / n) * Math.PI) * 0.45 * (i % 2 === 0 ? 1 : -1);
        CH.Kit.muzzle('wind', this.x, this.y - 12, a, 14, { force: true });
        this.shot(a, 130 + U.rand(-20, 20), g.edmg(8), 'fx.rock', { scale: 0.45, r: 4, color: '#e0c28a', fx: 'wind', spin: 7 });
        yield 0.08;
      }
      yield* this.recoverFor(1.0);
    }
    *atk_dust_dive() {
      const g = this.g;
      this.setState('attack');
      this.play('rise', 0.8);
      Audio.sfx('jump');
      this.gather(1.2);
      let el = 0;
      const riseT = 0.6 / this.bs;
      yield (dt) => {
        el += dt;
        this.z = Math.min(48, (el / riseT) * 48);
        return el >= riseT;
      };
      this.play('flight', 2.2);
      const tx = this.tp().x;
      const ty = this.tp().y;
      for (let i = 0; i < 5; i++) {
        this.blast(tx + U.rand(-70, 70), ty + U.rand(-70, 70), 38, 17, 0.9, { colors: 'junk', fx: 'wind', field: { color: '#c9a46a', color2: '#ecd9a8', slow: 0.6, dmg: 3 } });
        yield 0.35;
      }
      yield 0.5;
      this.play('landing', 0.8);
      this.x = tx;
      this.y = ty;
      this.z = 0;
      g.shake(7, 0.4);
      Audio.sfx('slam');
      CH.Kit.impact('wind', this.x, this.y, 64);
      g.hurtPlayers(g.edmg(18), this, { kx: 1 }, (q) => Math.hypot(q.x - this.x, q.y - this.y) < 62 + q.r);
      this.ring(8, 90, g.edmg(6), 'fx.rock', { scale: 0.4, r: 4, color: '#e0c28a', fx: 'wind' });
      yield 0.6;
      yield* this.recoverFor(1.2);
    }
    *atk_tail_claw() {
      yield* this.windup('excl', 0.45, undefined, 'attack1', 1.4);
      Audio.sfx('cre_roar');
      yield* this.lunge(90, 0.3, 16, 48, 'wind');
      yield* this.recoverFor(0.8);
    }
    *atk_sandstorm() {
      const g = this.g;
      this.setState('attack');
      this.play('special', 2.2);
      this.gather(1.4);
      FX.speech(this, 'THE DUNES RISE!', 1.8);
      Audio.sfx('cre_roar');
      yield 0.6;
      for (let r = 0; r < (this.enraged ? 4 : 3); r++) {
        Audio.sfx('wind');
        this.ring(10, 90, g.edmg(7), 'fx.rock', { scale: 0.42, r: 4, color: '#e0c28a', fx: 'wind', spin: 6 }, r * 0.31);
        yield 0.45;
      }
      yield* this.recoverFor(1.2);
    }
  }
  reg('dunewyrm', SandWyrm, { sprite: 'boss_dunewyrm', scale: 1.0, foot: 32, h: 96, shadow: 64, dmg: 14 }, { voice: 'cre_roar', dist: 100, enrage: true });

  /* VORAX THE BLOODWING */
  class BloodWyrm extends Boss {
    attackPool() {
      return [
        { name: 'blood_breath', w: 3.2 },
        { name: 'crimson_rain', w: 2.6 },
        { name: 'rend', w: 2.6 },
        { name: 'dread_howl', w: 2.2 },
      ];
    }
    *atk_blood_breath() {
      const g = this.g;
      yield* this.windup('ring', 0.6, { r: 52 }, 'attack2', 2.8);
      Audio.sfx('cre_roar');
      const base = this.angP();
      const n = this.enraged ? 12 : 8;
      for (let i = 0; i < n; i++) {
        const a = base + Math.sin((i / n) * Math.PI) * 0.35 * (i % 2 === 0 ? 1 : -1);
        CH.Kit.muzzle('magic', this.x, this.y - 12, a, 14, { force: true });
        this.shot(a, 120, g.edmg(8), 'fx.mawBall2', { scale: 1.2, r: 4, color: '#c2305b', fx: 'magic', homing: 0.8 });
        yield 0.12;
      }
      yield* this.recoverFor(1.0);
    }
    *atk_crimson_rain() {
      const g = this.g;
      this.setState('attack');
      this.play('rise', 0.8);
      Audio.sfx('jump');
      this.gather(1.2);
      let el = 0;
      const riseT = 0.6 / this.bs;
      yield (dt) => {
        el += dt;
        this.z = Math.min(48, (el / riseT) * 48);
        return el >= riseT;
      };
      this.play('flight', 2.4);
      yield* this.barrage(this.enraged ? 8 : 6, 90, 34, 16, 0.9, 0.3, { colors: 'fire', fx: 'magic' });
      yield 0.5;
      this.play('landing', 0.8);
      this.z = 0;
      g.shake(5, 0.3);
      Audio.sfx('slam');
      yield* this.recoverFor(1.2);
    }
    *atk_rend() {
      yield* this.windup('excl', 0.45, undefined, 'attack1', 1.4);
      Audio.sfx('cre_roar');
      yield* this.lunge(100, 0.28, 18, 52, 'magic');
      yield* this.lunge(70, 0.22, 14, 46, 'magic');
      yield* this.recoverFor(0.9);
    }
    *atk_dread_howl() {
      const g = this.g;
      this.setState('attack');
      this.play('special', 2.2);
      this.gather(1.4);
      FX.speech(this, 'BOW OR BLEED!', 1.8);
      Audio.sfx('cre_roar');
      yield 0.6;
      for (let r = 0; r < (this.enraged ? 3 : 2); r++) {
        this.ring(10, 92, g.edmg(7), 'fx.mawBall2', { scale: 1.0, r: 4, color: '#c2305b', fx: 'magic', homing: 0.4 }, r * 0.4);
        yield 0.5;
      }
      this.summon('goblin', this.enraged ? 3 : 2);
      yield* this.recoverFor(1.2);
    }
  }
  reg('bloodwyrm', BloodWyrm, { sprite: 'boss_bloodwyrm', scale: 1.0, foot: 32, h: 96, shadow: 64, dmg: 15 }, { voice: 'cre_roar', dist: 100, enrage: true });

  /* ===================================================================
     the two extra Eye Tyrants
     =================================================================== */
  /* MYCELIA THE SPORE EYE: poison clouds and spore bursts */
  class SporeEye extends Boss {
    attackPool() {
      return [
        { name: 'spore_burst', w: 3.0 },
        { name: 'toxic_gaze', w: 2.8 },
        { name: 'mycelium', w: 2.2 },
        { name: 'blink', w: 2.0 },
      ];
    }
    *atk_spore_burst() {
      const g = this.g;
      this.setState('attack');
      this.play('attack', 2.0);
      this.gather(1.2);
      Audio.sfx('cre_wet');
      yield 0.5;
      for (let w = 0; w < (this.enraged ? 3 : 2); w++) {
        this.ring(12, 80, g.edmg(6), 'vfx.p5.23', { animFps: 16, scale: 0.75, r: 4, color: '#8bc34a', fx: 'toxic' }, w * 0.26);
        yield 0.5;
      }
      yield* this.recoverFor(0.9);
    }
    *atk_toxic_gaze() {
      const g = this.g;
      this.setState('attack');
      this.play('attack_fire', 2.0);
      this.gather(1.3);
      FX.speech(this, 'BREATHE IN...', 1.6);
      yield 0.3;
      yield* this.barrage(this.enraged ? 4 : 3, 70, 40, 16, 1.2, 0.25, { colors: 'goo', fx: 'toxic', field: { kind: 'acid', color: '#2e7d32', dmg: 5, life: 4 }, sfx: 'cre_wet' });
      yield 1.3;
      yield* this.recoverFor(1.0);
    }
    *atk_mycelium() {
      yield* this.windup('ring', 0.6, { r: 45 }, 'attack', 1.8);
      Audio.sfx('cre_hiss');
      const base = this.angP();
      for (const off of [-0.4, 0, 0.4]) this.beamAt(base + off, 0.9 / this.bs, 10, 13, 'toxic');
      yield 1.3;
      yield* this.recoverFor(0.9);
    }
    *atk_blink() {
      const g = this.g;
      const p = this.tp();
      let nx = this.x;
      let ny = this.y;
      for (let i = 0; i < 15; i++) {
        const cx = U.rand(80, g.arena.w - 80);
        const cy = U.rand(80, g.arena.h - 80);
        if (Math.hypot(cx - p.x, cy - p.y) > 130) {
          nx = cx;
          ny = cy;
          break;
        }
      }
      this.setState('attack');
      this.play('attack', 1.5);
      Audio.sfx('teleport');
      g.addWarn(nx, ny, 30, 0.8 / this.bs, null);
      yield 0.4;
      this.hidden = true;
      FX.burst(this.x, this.y, { n: 16, colors: 'goo', speed: 110, life: 0.4 });
      yield 0.5 / this.bs;
      this.x = nx;
      this.y = ny;
      this.hidden = false;
      CH.Kit.impact('toxic', nx, ny, 32);
      g.addZone({ kind: 'acid', x: nx, y: ny, r: 26, life: 4, dmgP: g.edmg(5), tick: 0.5 });
      this.ring(8, 90, g.edmg(6), 'vfx.p5.23', { animFps: 16, scale: 0.65, r: 4, color: '#8bc34a', fx: 'toxic' });
      yield 0.4;
      yield* this.recoverFor(0.8);
    }
  }
  reg('sporeeye', SporeEye, { sprite: 'boss_sporeeye', scale: 1.0, foot: 20, h: 56, shadow: 48, dmg: 12 }, { voice: 'cre_wet', dist: 110, enrage: true });

  /* NYX'RA THE VOID EYE: frost beams and a collapsing void */
  class VoidEye extends Boss {
    attackPool() {
      return [
        { name: 'void_beams', w: 3.0 },
        { name: 'singularity', w: 2.6 },
        { name: 'frost_ring', w: 2.8 },
        { name: 'phase_shift', w: 2.0 },
      ];
    }
    *atk_void_beams() {
      yield* this.windup('ring', 0.5, { r: 42 }, 'attack_fire', 2.0);
      Audio.sfx('cre_hiss');
      const base = this.angP();
      for (const off of this.enraged ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.34, 0, 0.34]) this.beamAt(base + off, 0.9 / this.bs, 10, 14, 'magic');
      yield 1.3;
      yield* this.recoverFor(0.9);
    }
    *atk_singularity() {
      const g = this.g;
      this.setState('attack');
      this.play('attack', 2.4);
      this.gather(1.4);
      FX.speech(this, 'COLLAPSE!', 1.4);
      const p = this.tp();
      const R = 62;
      g.addWarn(p.x, p.y, R, 1.3 / this.bs, (g2, z) => {
        g2.explode(z.x, z.y, R, 0, { hurtPlayer: true, pdmg: g2.edmg(20), colors: 'glitch', knock: -140, fx: 'magic' });
        g2.addZone({ kind: 'field', x: z.x, y: z.y, r: R * 0.8, life: 3, dmgP: g2.edmg(6), tick: 0.5, color: '#5a2d82', color2: '#b55088', slow: 0.55 });
        Audio.sfx('big_explosion');
      });
      Audio.sfx('warn');
      yield 1.9;
      yield* this.recoverFor(1.0);
    }
    *atk_frost_ring() {
      const g = this.g;
      this.setState('attack');
      this.play('attack', 2.2);
      this.gather(1.2);
      Audio.sfx('magic');
      yield 0.5;
      for (let w = 0; w < (this.enraged ? 3 : 2); w++) {
        this.ring(14, 88, g.edmg(6), 'fx.mageIce', { scale: 0.7, r: 4, color: '#9fd8ef', fx: 'ice', slow: { mul: 0.6, t: 1.4 } }, w * 0.22);
        yield 0.5;
      }
      yield* this.recoverFor(0.9);
    }
    *atk_phase_shift() {
      const g = this.g;
      const p = this.tp();
      let nx = this.x;
      let ny = this.y;
      for (let i = 0; i < 15; i++) {
        const cx = U.rand(80, g.arena.w - 80);
        const cy = U.rand(80, g.arena.h - 80);
        if (Math.hypot(cx - p.x, cy - p.y) > 130) {
          nx = cx;
          ny = cy;
          break;
        }
      }
      this.setState('attack');
      this.play('attack', 1.5);
      Audio.sfx('teleport');
      g.addWarn(nx, ny, 30, 0.8 / this.bs, null);
      yield 0.4;
      this.hidden = true;
      FX.burst(this.x, this.y, { n: 16, colors: 'glitch', speed: 110, life: 0.4 });
      yield 0.5 / this.bs;
      this.x = nx;
      this.y = ny;
      this.hidden = false;
      CH.Kit.impact('magic', nx, ny, 32);
      this.ring(10, 92, g.edmg(6), 'fx.mawBall1', { scale: 1.0, r: 4, color: '#8a5ad0', fx: 'magic' });
      yield 0.4;
      yield* this.recoverFor(0.8);
    }
  }
  reg('voideye', VoidEye, { sprite: 'boss_voideye', scale: 1.0, foot: 20, h: 56, shadow: 48, dmg: 13 }, { voice: 'cre_hiss', dist: 110, enrage: true });

  Bo.extra = ['treant', 'moss', 'knight', 'yeti', 'daddy', 'skull', 'dunewyrm', 'bloodwyrm', 'sporeeye', 'voideye'];
})(window.CH);
