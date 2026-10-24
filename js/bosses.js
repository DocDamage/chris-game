/* CHAOS.exe - the three bosses. Attacks are generator scripts: `yield seconds` to wait,
   `yield dt => done` to run per-frame logic until it returns true. Every big attack is telegraphed
   and followed by a recovery window. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const Audio = CH.Audio;
  const Enemy = CH.Enemies.Enemy;

  const Bo = (CH.Bosses = {});

  const LOOK = {
    ceo: { sprite: 'boss_ceo', foot: 24, h: 60, shadow: 40, dmg: 12 },
    frog: { sprite: 'boss_frog', scale: 1.5, foot: 22, h: 64, shadow: 46, dmg: 10 },
    bd: { sprite: 'boss_bd', scale: 1.5, foot: 24, h: 80, shadow: 64, dmg: 14 },
    gol: { sprite: 'boss_gol', scale: 1.5, foot: 22, h: 74, shadow: 58, dmg: 13 },
    maw: { sprite: 'boss_maw', scale: 1, foot: 44, h: 112, shadow: 36, dmg: 11 },
    chicken: { sprite: 'boss_chicken', foot: 32, h: 82, shadow: 60, dmg: 14 },
    bug: { sprite: 'boss_bug', foot: 26, h: 70, shadow: 92, dmg: 11 },
    dragon: { sprite: 'boss_dragon', scale: 1.0, foot: 32, h: 96, shadow: 64, dmg: 14 },
    beholder: { sprite: 'boss_beholder', scale: 1.0, foot: 20, h: 56, shadow: 48, dmg: 12 },
    mage: { sprite: 'boss_mage', scale: 1.25, foot: 22, h: 62, shadow: 42, dmg: 11 },
    demon: { sprite: 'boss_demon', scale: 1.15, foot: 30, h: 88, shadow: 58, dmg: 15 },
    ooze: { sprite: 'boss_ooze', scale: 1.15, foot: 30, h: 80, shadow: 58, dmg: 13 },
  };

  /* per-kind extras for bosses defined in bosses_more.js: {voice, dist (how close it likes to get), enrage (turns angry below 40% hp)} */
  Bo.LOOK = LOOK;
  Bo.META = {};
  Bo.classes = {};

  class Boss extends Enemy {
    constructor(g, kind, x, y, o) {
      super(g, 'chicken', x, y, o);
      const b = B.bosses[kind];
      const L = LOOK[kind];
      o = o || {};
      this.type = 'boss_' + kind;
      this.kind = kind;
      this.isBoss = true;
      this.name = b.name;
      this.def = { kbRes: 1, xp: 0, coin: 0, score: 0, name: b.name }; // boss score is awarded in onBossDefeated
      // without the asset bundle the newer bosses stand in as the Golem's procedural sprite
      this.look = { sprite: CH.Sprites.exists(L.sprite) ? L.sprite : L.fallback || 'boss_gol', foot: L.foot, h: L.h, shadow: L.shadow, scale: L.scale || 1, flipBase: !!L.flipBase, hover: L.hover || 0 };
      this.h = L.h;
      const endless = o.endlessTier || 0;
      this.maxHp = this.hp = Math.round(b.hp * g.diff.boss * (g.coop ? B.coop.bossHp : 1) * (1 + endless * 0.5));
      this.baseR = b.r;
      this.scale = 1;
      this.speed = b.speed;
      this.dmg = g.edmg(L.dmg);
      this.hotMul = 1.7;
      this.mass = 50;
      this.bs = g.diff.bossSpeed;
      this.intro = 2.6;
      this.phase = 1;
      this.phaseT = 0;
      this.dying = false;
      this.deathT = 0;
      this.enraged = false;
      this.gen = null;
      this.wait = 0;
      this.until = null;
      this.last = '';
      this.hidden = false;
      this.z = 0; // jump height
      this.glitch = 0;
      this.state = 'spawn';
      this.contactCd = 1;
      this.tier = endless;
      this.voice = (Bo.META[kind] && Bo.META[kind].voice) || { frog: 'cre_frog', bd: 'cre_growl', ceo: 'cre_growl', chicken: 'cre_bird', gol: 'cre_trumpet', maw: 'cre_hiss', bug: 'cre_chitter', dragon: 'cre_roar', beholder: 'cre_hiss', mage: 'cre_trumpet', demon: 'cre_growl', ooze: 'cre_wet' }[kind];
      this.elem = CH.Kit.byBoss[kind]; // element of this boss's attack effects
      this.anim = null; // current scripted animation (null = idle/walk by state)
      this.animT = 0;
      this.animDur = 0; // >0 stretches the animation over this many seconds
      this.spin = 0; // >0 while rolling like a ball (Boulder Dash)
    }

    play(anim, dur) {
      this.anim = anim;
      this.animT = 0;
      this.animDur = dur || 0;
    }
    setState(s, t) {
      super.setState(s, t);
      this.anim = null;
    }

    get r() {
      return this.baseR * (this.g.mods.bigHead ? 1.1 : 1);
    }
    get immune() {
      return this.intro > 0 || this.phaseT > 0 || this.dying || this.hidden;
    }
    applySlow() {}
    stun() {}
    knock() {}
    canTouch() {
      return this.contactCd <= 0 && !this.immune && !this.dead && !this.hidden;
    }

    get speedMul() {
      return this.bs * (this.enraged ? 1.35 : 1);
    }

    /* ---------- main update ---------- */
    update(g, dt) {
      if (g.warpT > 0) dt *= 0.6; // TIME WARP
      this.age += dt;
      this.animT += dt;
      CH.Actor.fadeHit(this, dt);
      if (this.contactCd > 0) this.contactCd -= dt;
      if (this.tele) {
        this.tele.t -= dt;
        if (this.tele.t < -0.3) this.tele = null;
      }
      this.dvx = 0;
      this.dvy = 0;
      const tp = this.tp();
      this.tgt = { x: tp.x, y: tp.y, isPlayer: true, p: tp };
      if (this.dying) return this.updateDeath(g, dt);
      if (this.intro > 0) {
        if (!this.introFx) {
          this.introFx = true;
          CH.Kit.impact(this.elem, this.x, this.y, CH.Kit.bossR(this) * 1.5);
        }
        this.intro -= dt;
        if (this.intro <= 0) this.setState('chase');
        return;
      }
      if (this.phaseT > 0) {
        this.phaseT -= dt;
        if (Math.random() < 0.5) FX.burst(this.x, this.y, { n: 3, colors: 'glitch', speed: 120, life: 0.4 });
        if (this.phaseT <= 0) this.setState('chase');
        return;
      }
      this.checkPhase(g);
      if (!this.hot && !this.hidden) this.face = this.tp().x >= this.x ? 1 : -1;
      if (!g.allDead()) this.runScript(dt);
      this.integrate(g, dt);
      this.kx = this.ky = 0;
    }

    runScript(dt) {
      if (!this.gen) {
        this.gen = this.cycle();
        this.wait = 0;
        this.until = null;
      }
      if (this.until) {
        if (this.until(dt)) this.until = null;
        else return;
      }
      this.wait -= dt;
      if (this.wait > 0) return;
      const r = this.gen.next();
      if (r.done) {
        this.gen = null;
        return;
      }
      if (typeof r.value === 'number') this.wait = r.value / this.bs;
      else if (typeof r.value === 'function') this.until = r.value;
    }

    resetScript() {
      this.dmgTaken = this.baseDmgTaken || 1; // an interrupted guard must not stay up
      this.gen = null;
      this.until = null;
      this.wait = 0;
      this.tele = null;
      this.hot = false;
      this.hidden = false;
      this.z = 0;
    }

    /* ---------- helpers for scripts ---------- */
    /* a puff of speed streak behind a charging boss, about every 0.07 s */
    streak(dt, ang, R, elem) {
      this.fxT = (this.fxT || 0) - dt;
      if (this.fxT > 0) return;
      this.fxT = 0.07;
      CH.Kit.dash(elem || this.elem, this.x - Math.cos(ang) * this.r * 0.6, this.y + this.look.foot * 0.2, ang + Math.PI, R || this.r * 0.8);
    }
    /* charge-up glow for attacks that do not go through windup() */
    gather(k) {
      CH.Kit.cast(this.elem, this.x, CH.Kit.bossBody(this), CH.Kit.bossR(this) * (k || 0.9));
    }
    /* the player this boss is currently fighting: re-picked every attack, and whenever that player goes down */
    tp() {
      const g = this.g;
      let p = this.tpl;
      if (!p || p.dead) p = this.tpl = g.nearestPlayer(this.x, this.y) || g.players[0];
      return p;
    }
    angP() {
      return Math.atan2(this.tp().y - this.y, this.tp().x - this.x);
    }
    distP() {
      return Math.hypot(this.tp().x - this.x, this.tp().y - this.y);
    }
    *reposition(t, stop) {
      this.setState('chase');
      let el = 0;
      yield (dt) => {
        el += dt;
        if (this.distP() > (stop || 70)) CH.Enemies.moveToward(this, this.tp().x, this.tp().y, this.speedMul);
        return el >= t / this.bs;
      };
    }
    *windup(kind, T, extra, anim, animDur) {
      this.setState('attack');
      if (this.voice) Audio.sfx(this.voice);
      CH.Kit.bossWind(this);
      if (anim) this.play(anim, animDur);
      this.setTele(kind, T / this.bs, extra);
      Audio.sfx('warn');
      yield T;
      this.tele = null;
    }
    *recoverFor(t, anim, animDur) {
      this.setState('recover');
      if (anim) this.play(anim, animDur);
      yield t;
    }
    /* generic enemy projectile with any sprite: opts like {spin, scale, r, face, animFps, homing, slow} */
    shot(ang, speed, dmg, sprite, o) {
      if (!CH.Sprites.exists(sprite)) {
        // no asset bundle: fall back to the plain glowing bullets and drop the sprite-only options
        sprite = 'bullet_pink';
        o = Object.assign({}, o, { scale: 0.8, animFps: 0 });
      }
      return this.g.spawnProjectile(Object.assign({ owner: 'e', kind: 'bullet', x: this.x, y: this.y - 8, ang, speed: speed * Math.min(1.25, this.speedMul), r: 3, dmg, life: 6, sprite, color: '#ffffff', rot: 0, fx: this.elem }, o || {}));
    }
    bullet(ang, speed, dmg, sprite, color, fx) {
      this.g.spawnProjectile({ owner: 'e', kind: 'bullet', x: this.x, y: this.y - 4, ang, speed: speed * Math.min(1.25, this.speedMul), r: 3, dmg, life: 6, sprite: sprite || 'bullet_red', color: color || '#e43b44', rot: 0, fx: fx || this.elem });
    }
    summon(type, n, opts) {
      const g = this.g;
      const room = Math.max(0, 55 - g.enemies.length);
      n = Math.min(n, room);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * U.TAU + U.rand(0, 0.5);
        const d = U.rand(30, 55);
        const x = U.clamp(this.x + Math.cos(a) * d, 30, g.arena.w - 30);
        const y = U.clamp(this.y + Math.sin(a) * d, 30, g.arena.h - 30);
        g.spawnEnemy(type, x, y, Object.assign({ summoned: true, spawnTime: 0.45 }, opts || {}));
        CH.Kit.impact(this.kind === 'frog' ? 'toxic' : 'magic', x, y, 15);
      }
    }

    cycle() {
      // a boss goes for the nearest hero most of the time, but sometimes turns on the other one
      const g = this.g;
      this.tpl = g.coop && Math.random() < 0.4 ? g.randomAlivePlayer() : g.nearestPlayer(this.x, this.y) || g.players[0];
      const names = this.attackPool();
      let pick = U.weighted(names, (n) => (n.name === this.last ? n.w * 0.15 : n.w));
      this.last = pick.name;
      return this.run(pick.name);
    }
    *run(name) {
      yield* this.reposition(U.rand(0.5, 1.2) * (this.enraged || this.phase >= 3 ? 0.6 : 1), ({ bug: 110, maw: 150, gol: 120, bd: 80, frog: 70, dragon: 100, beholder: 110, mage: 120, demon: 80, ooze: 70 }[this.kind] || (Bo.META[this.kind] && Bo.META[this.kind].dist) || 60));
      yield* this['atk_' + name]();
    }

    /* ---------- phases / death ---------- */
    checkPhase(g) {
      const f = this.hp / this.maxHp;
      if (this.kind === 'ceo' && !this.enraged && f < 0.5) this.enterPhase(g, 2, 'CEO IS FURIOUS!', true);
      else if (this.kind === 'chicken' && !this.enraged && f < 0.3) this.enterPhase(g, 2, 'FEATHER FURY!', true);
      else if ((['frog', 'bd', 'gol', 'maw', 'dragon', 'beholder', 'mage', 'demon', 'ooze'].includes(this.kind) || (Bo.META[this.kind] && Bo.META[this.kind].enrage)) && !this.enraged && f < 0.4) this.enterPhase(g, 2, 'ENRAGED!', true);
      else if (this.kind === 'bug') {
        if (this.phase === 1 && f < 0.66) this.enterPhase(g, 2, 'PHASE 2: CORRUPTION', false);
        else if (this.phase === 2 && f < 0.33) this.enterPhase(g, 3, 'PHASE 3: FATAL ERROR', false);
      }
    }
    enterPhase(g, n, text, enrage) {
      this.phase = n;
      if (enrage) this.enraged = true;
      this.phaseT = 1.8;
      this.resetScript();
      this.setState('attack');
      g.clearEnemyProjectiles();
      g.clearHazards();
      g.shake(6, 0.5);
      Audio.sfx(this.kind === 'bug' ? 'glitch' : 'boss_intro');
      FX.ring(this.x, this.y, 10, 120, '#ffffff', 0.5);
      CH.Kit.impact(this.elem, this.x, this.y, 62);
      CH.Kit.impact('flash', this.x, this.y - 10, 40, { alpha: 0.8 });
      FX.text(this.x, this.y - 40, text, '#fee761', 2);
      g.banner(text, '', 1.8);
    }

    beginDeath(g) {
      if (this.dying) return;
      this.dying = true;
      this.deathT = this.kind === 'bug' ? 3.4 : 2.4;
      this.deathTotal = this.deathT;
      this.hp = 0;
      this.resetScript();
      this.setState('dead');
      this.tele = null;
      g.clearEnemyProjectiles();
      g.clearHazards();
      g.onBossDying(this);
      Audio.sfx('boss_intro');
    }
    updateDeath(g, dt) {
      this.deathT -= dt;
      this.glitch = 1;
      if (Math.random() < dt * 9) {
        const a = U.rand(0, U.TAU);
        const d = U.rand(0, this.baseR);
        g.explode(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d - 4, U.rand(14, 26), 0, { noShake: true, colors: this.kind === 'bug' ? 'glitch' : 'fire' });
        if (Math.random() < 0.5) CH.Kit.hit(this.elem, this.x + Math.cos(a) * d, this.y + Math.sin(a) * d - 8, 18, true);
        g.shake(3, 0.1);
      }
      if (this.deathT <= 0) {
        g.explode(this.x, this.y, 80, 0, { colors: this.kind === 'bug' ? 'glitch' : 'fire', big: true });
        CH.Kit.impact(this.elem, this.x, this.y, 70);
        CH.Kit.impact('flash', this.x, this.y - 8, 56);
        FX.burst(this.x, this.y, { n: 60, colors: 'confetti', speed: 200, life: 1.2, g: 120 });
        g.shake(9, 0.6);
        g.killEnemy(this);
      }
    }

    touchDamage() {
      return this.dmg * (this.hot ? this.hotMul : 1);
    }
  }

  /* ===================================================================
     THE CEO OF EVIL
     =================================================================== */
  class CEO extends Boss {
    attackPool() {
      return [
        { name: 'paperwork', w: 3 },
        { name: 'charge', w: 2.2 },
        { name: 'summon', w: this.g.enemies.length > 18 ? 0.4 : 1.4 },
        { name: 'restructure', w: 2.2 },
      ];
    }
    *atk_paperwork() {
      const g = this.g;
      yield* this.windup('excl', 0.55, undefined, 'slashweak', 1.0);
      const volleys = this.enraged ? 4 : 3;
      for (let v = 0; v < volleys; v++) {
        if (v > 0) this.play('slashweak', 0.7);
        const a = this.angP();
        Audio.sfx('hover');
        for (let k = -2; k <= 2; k++) {
          g.spawnProjectile({ owner: 'e', kind: 'paper', x: this.x, y: this.y - 8, ang: a + k * 0.24, speed: 115 * Math.min(1.3, this.speedMul), r: 3, dmg: g.edmg(6), life: 4, sprite: 'paper', spin: 9, color: '#ffffff', fx: 'phys' });
        }
        yield 0.6;
      }
      yield* this.recoverFor(0.9);
    }
    *atk_charge() {
      const g = this.g;
      this.setState('attack');
      this.play('slashdash', 2.1);
      this.gather(1);
      let el = 0;
      this.setTele('line', 0.9 / this.bs, { len: 280, ang: this.angP() });
      Audio.sfx('warn');
      yield (dt) => {
        el += dt;
        this.tele.ang = this.angP();
        this.face = Math.cos(this.tele.ang) >= 0 ? 1 : -1;
        return el >= 0.9 / this.bs;
      };
      const a = this.tele ? this.tele.ang : this.angP();
      this.tele = null;
      this.hot = true;
      el = 0;
      let crashed = false;
      Audio.sfx('dodge');
      yield (dt) => {
        el += dt;
        CH.Enemies.moveDir(this, a, 270 * this.speedMul);
        this.face = Math.cos(a) >= 0 ? 1 : -1;
        this.streak(dt, a, 20);
        if (Math.random() < 0.5) FX.dust(this.x, this.y + 18, 1);
        if (this.wallHit) crashed = true;
        return crashed || el > 1.0;
      };
      this.hot = false;
      if (crashed) {
        Audio.sfx('slam');
        g.shake(5, 0.25);
        FX.burst(this.x, this.y, { n: 18, colors: 'junk', speed: 140, life: 0.6 });
        CH.Kit.impact('earth', this.x, this.y + 4, 34);
        CH.Kit.hit('phys', this.x, this.y - 18, 20, true);
        FX.text(this.x, this.y - 32, 'OW! MY CASE!', '#ffffff', 1);
        yield* this.recoverFor(1.5); // dazed: big damage window
      } else yield* this.recoverFor(0.7);
    }
    *atk_summon() {
      yield* this.windup('ring', 0.7, { r: 60 }, 'slashstorm', 1.3);
      FX.speech(this, 'TEMP EMPLOYEES, ASSEMBLE!', 2.4);
      Audio.sfx('event');
      this.summon('intern', this.enraged ? 6 : 4);
      this.summon('office', this.enraged ? 2 : 1);
      yield* this.recoverFor(1.1);
    }
    *atk_restructure() {
      const g = this.g;
      FX.speech(this, 'RESTRUCTURING!', 1.8);
      this.setState('attack');
      this.play('slashbomb', 2.0);
      const n = this.enraged ? 6 : 4;
      const p = this.tp();
      for (let i = 0; i < n; i++) {
        let x;
        let y;
        if (i === 0) {
          x = p.x;
          y = p.y;
        } else {
          const a = U.rand(0, U.TAU);
          const d = U.rand(40, 120);
          x = U.clamp(p.x + Math.cos(a) * d, 40, g.arena.w - 40);
          y = U.clamp(p.y + Math.sin(a) * d, 40, g.arena.h - 40);
        }
        g.addWarn(x, y, 36, 1.15 / this.bs, (g2, z) => {
          g2.explode(z.x, z.y, 36, 0, { hurtPlayer: true, pdmg: g2.edmg(22), colors: 'fire', knock: 200, fx: 'bolt' });
          g2.shake(3, 0.15);
        });
        Audio.sfx('warn');
        yield 0.18;
      }
      yield 1.2;
      yield* this.recoverFor(1.1);
    }
  }

  /* ===================================================================
     THE CHICKEN APOCALYPSE
     =================================================================== */
  class ChickenBoss extends Boss {
    attackPool() {
      return [
        { name: 'charge', w: 3 },
        { name: 'summon', w: this.g.enemies.length > 18 ? 0.3 : 1.6 },
        { name: 'slam', w: 3 },
        { name: 'eggs', w: 1.6 },
      ];
    }
    *atk_charge() {
      const g = this.g;
      this.setState('attack');
      this.play('startdive', 0.95);
      this.gather(1);
      let el = 0;
      this.setTele('line', 0.95 / this.bs, { len: 600, ang: this.angP() });
      Audio.sfx('warn');
      yield (dt) => {
        el += dt;
        this.tele.ang = this.angP();
        this.face = Math.cos(this.tele.ang) >= 0 ? 1 : -1;
        return el >= 0.95 / this.bs;
      };
      const a = this.tele ? this.tele.ang : this.angP();
      this.tele = null;
      this.hot = true;
      el = 0;
      let crashed = false;
      Audio.sfx('wings');
      this.play('dive', 0);
      yield (dt) => {
        el += dt;
        CH.Enemies.moveDir(this, a, 310 * this.speedMul);
        this.face = Math.cos(a) >= 0 ? 1 : -1;
        this.streak(dt, a, 24);
        if (Math.random() < 0.7) FX.dust(this.x, this.y + 20, 2);
        if (this.wallHit) crashed = true;
        return crashed || el > 2.2;
      };
      this.hot = false;
      Audio.sfx('slam');
      g.shake(5, 0.25);
      FX.burst(this.x, this.y, { n: 14, colors: ['#ffffff', '#e8e4f0', '#e43b44'], speed: 150, life: 0.7, g: 80 });
      CH.Kit.impact('wind', this.x, this.y + 6, 40);
      yield* this.recoverFor(1.2, 'enddive', 0.8);
    }
    *atk_summon() {
      yield* this.windup('ring', 0.75, { r: 70 }, 'cast', 1.5);
      FX.speech(this, 'RISE, MY BATS!', 2);
      Audio.sfx('event');
      this.summon('pigeon', this.enraged ? 6 : 4);
      yield* this.recoverFor(0.9);
    }
    *atk_slam() {
      const g = this.g;
      const R = 72;
      this.setState('attack');
      this.play('impact', 1.7);
      Audio.sfx('wings');
      this.gather(1.1);
      CH.Kit.impact('wind', this.x, this.y + 6, 26, { alpha: 0.9 });
      const tx = this.tp().x;
      const ty = this.tp().y;
      g.addWarn(tx, ty, R, 1.0 / this.bs, (g2, z) => {
        g2.explode(z.x, z.y, R, 0, { hurtPlayer: true, pdmg: g2.edmg(22), colors: 'cheese', knock: 220, fx: 'wind' });
        FX.ring(z.x, z.y, 8, R + 14, '#ffffff', 0.4);
        g2.shake(7, 0.35);
        Audio.sfx('slam');
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
        this.z = Math.sin(k * Math.PI) * 46;
        return el >= T;
      };
      this.z = 0;
      yield* this.recoverFor(1.1);
    }
    *atk_eggs() {
      const g = this.g;
      yield* this.windup('excl', 0.5, undefined, 'impulse', 0.7);
      for (let i = 0; i < 5; i++) {
        const a = this.angP() + U.rand(-0.5, 0.5);
        Audio.sfx('hover');
        for (let k = -1; k <= 1; k++) this.bullet(a + k * 0.3, 105, g.edmg(7), 'bullet_pink', '#ff00aa', 'magic');
        yield 0.35;
      }
      yield* this.recoverFor(0.8);
    }
  }

  /* ===================================================================
     THE FINAL BUG
     =================================================================== */
  class BugBoss extends Boss {
    attackPool() {
      const list = [
        { name: 'ring', w: 3 },
        { name: 'aimed', w: 3 },
        { name: 'beam', w: this.phase >= 2 ? 2.4 : 1.6 },
        { name: 'blink', w: 1.5 },
      ];
      if (this.phase >= 2) {
        list.push({ name: 'corrupt', w: 2.2 });
        list.push({ name: 'spiral', w: 2.2 });
        list.push({ name: 'glitchadds', w: this.g.enemies.length > 14 ? 0.2 : 1.6 });
      }
      if (this.phase >= 3) list.push({ name: 'assault', w: 3 });
      return list;
    }
    get tm() {
      return this.phase >= 3 ? 0.75 : this.phase === 2 ? 0.9 : 1;
    }
    *atk_ring() {
      const g = this.g;
      yield* this.windup('excl', 0.6 * this.tm, undefined, 'cast', 2.4 * this.tm);
      const rings = this.phase >= 3 ? 4 : 3;
      for (let r = 0; r < rings; r++) {
        const n = 14;
        const off = r % 2 ? Math.PI / n : 0;
        Audio.sfx('glitch');
        for (let i = 0; i < n; i++) this.bullet(off + (i / n) * U.TAU, 88, g.edmg(7), 'bullet_glitch', '#00ffd0');
        CH.Kit.impact('glitch', this.x, this.y - 6, 26, { alpha: 0.8 });
        yield 0.55 * this.tm;
      }
      yield* this.recoverFor(0.9 * this.tm);
    }
    *atk_aimed() {
      const g = this.g;
      yield* this.windup('excl', 0.5 * this.tm, undefined, 'web', 2.3 * this.tm);
      for (let v = 0; v < 4; v++) {
        const a = this.angP();
        Audio.sfx('glitch');
        for (let k = -1; k <= 1; k++) this.bullet(a + k * 0.22, 135, g.edmg(7), 'bullet_pink', '#ff00aa');
        yield 0.42 * this.tm;
      }
      yield* this.recoverFor(0.8 * this.tm);
    }
    beamAt(ang, delay, w) {
      const g = this.g;
      const ox = this.x;
      const oy = this.y;
      CH.Kit.cast('tech', ox, oy, 16);
      g.addWarn(ox, oy, 0, delay, (g2) => {
        CH.Kit.beam('tech', ox, oy, ang, 900, w || 14);
        g2.addZone({ kind: 'beam', shape: 'line', x: ox, y: oy, ang, len: 900, w: w || 14, life: 0.35, dmgP: g2.edmg(18), once: true });
        g2.shake(4, 0.25);
        Audio.sfx('big_explosion');
      }, { shape: 'line', ang, len: 900, w: w || 14 });
    }
    *atk_beam() {
      yield* this.windup('ring', 0.4 * this.tm, { r: 40 }, 'bite', 2.7 * this.tm);
      this.beamAt(this.angP(), 1.15 * this.tm);
      Audio.sfx('warn');
      yield 1.5 * this.tm;
      yield* this.recoverFor(1.0 * this.tm);
    }
    *atk_blink() {
      const g = this.g;
      const p = this.tp();
      let x;
      let y;
      for (let i = 0; i < 20; i++) {
        x = U.rand(60, g.arena.w - 60);
        y = U.rand(60, g.arena.h - 60);
        if (Math.hypot(x - p.x, y - p.y) > 130) break;
      }
      this.setState('attack');
      this.play('jump', 0.45);
      g.addWarn(x, y, 26, 1.0 * this.tm, null);
      yield 0.4;
      Audio.sfx('teleport');
      FX.burst(this.x, this.y, { n: 25, colors: 'glitch', speed: 140, life: 0.5 });
      CH.Kit.impact('glitch', this.x, this.y - 6, 32);
      this.hidden = true;
      yield 0.6 * this.tm;
      this.x = x;
      this.y = y;
      this.hidden = false;
      Audio.sfx('glitch');
      FX.burst(x, y, { n: 25, colors: 'glitch', speed: 140, life: 0.5 });
      FX.ring(x, y, 5, 50, '#00ffd0', 0.35);
      CH.Kit.impact('glitch', x, y - 6, 34);
      for (let i = 0; i < 10; i++) this.bullet((i / 10) * U.TAU, 95, g.edmg(7), 'bullet_glitch', '#00ffd0');
      yield* this.recoverFor(0.7 * this.tm);
    }
    *atk_corrupt() {
      const g = this.g;
      yield* this.windup('excl', 0.5 * this.tm, undefined, 'cast', 1.7 * this.tm);
      const n = this.phase >= 3 ? 9 : 7;
      FX.speech(this, 'SEGFAULT', 1.6);
      for (let i = 0; i < n; i++) {
        const x = U.rand(50, g.arena.w - 50);
        const y = U.rand(50, g.arena.h - 50);
        g.addWarn(x, y, 24, 1.3 * this.tm, (g2, z) => {
          g2.addZone({ kind: 'corrupt', x: z.x, y: z.y, r: 24, life: 4, dmgP: g2.edmg(8), tick: 0.5 });
          FX.burst(z.x, z.y, { n: 10, colors: 'glitch', speed: 80, life: 0.4 });
          CH.Kit.impact('glitch', z.x, z.y, 22, { alpha: 0.85 });
        });
        yield 0.12;
      }
      yield 1.0;
      yield* this.recoverFor(0.9 * this.tm);
    }
    *atk_spiral() {
      const g = this.g;
      yield* this.windup('excl', 0.7 * this.tm, undefined, 'webball', 3.6 * this.tm);
      let a = this.angP();
      const total = this.phase >= 3 ? 50 : 38;
      for (let i = 0; i < total; i++) {
        a += 0.42;
        Audio.sfx('hover');
        this.bullet(a, 85, g.edmg(6), 'bullet_pink', '#ff00aa');
        this.bullet(a + Math.PI, 85, g.edmg(6), 'bullet_pink', '#ff00aa');
        yield 0.07 * this.tm;
      }
      yield* this.recoverFor(1.1 * this.tm);
    }
    *atk_glitchadds() {
      yield* this.windup('ring', 0.6, { r: 70 }, 'bite', 1.5);
      FX.speech(this, 'NULL POINTER!', 1.8);
      Audio.sfx('event');
      this.summon('potato', 2);
      this.summon('pigeon', 2);
      if (this.phase >= 3) this.summon('toaster', 2);
      yield* this.recoverFor(1.0);
    }
    *atk_assault() {
      const g = this.g;
      FX.speech(this, 'FINAL ASSAULT!', 2);
      yield* this.windup('ring', 0.8 * this.tm, { r: 60 }, 'slash', 4.8 * this.tm);
      const base = this.angP();
      for (let i = -1; i <= 1; i++) {
        this.beamAt(base + i * 0.5, 1.2 * this.tm, 12);
        Audio.sfx('warn');
        yield 0.2;
      }
      yield 1.3 * this.tm;
      for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 16; i++) this.bullet(r * 0.2 + (i / 16) * U.TAU, 95, g.edmg(7), 'bullet_glitch', '#00ffd0');
        Audio.sfx('glitch');
        yield 0.5 * this.tm;
      }
      yield* this.recoverFor(1.6); // long recovery after the big combo
    }
  }

  /* ===================================================================
     THE WILD FROG  (wave-3 miniboss)
     =================================================================== */
  class FrogBoss extends Boss {
    attackPool() {
      return [
        { name: 'leap', w: 3 },
        { name: 'tongue', w: 3 },
        { name: 'spit', w: 2.4 },
        { name: 'tadpoles', w: this.g.enemies.length > 10 ? 0.3 : 1.2 },
      ];
    }
    *atk_leap() {
      const g = this.g;
      const R = 48;
      this.setState('attack');
      this.play('jump', 0.55);
      Audio.sfx('jump');
      CH.Kit.cast('earth', this.x, this.y + 6, 18);
      yield 0.5;
      CH.Kit.impact('earth', this.x, this.y + 8, 24);
      const tx = this.tp().x;
      const ty = this.tp().y;
      g.addWarn(tx, ty, R, 0.85 / this.bs, (g2, z) => {
        g2.explode(z.x, z.y, R, 0, { hurtPlayer: true, pdmg: g2.edmg(16), colors: 'goo', knock: 200, fx: 'toxic' });
        FX.vfx('fx.frogSpikes', z.x, z.y + 6, { scale: 1.1, fps: 16 });
        Audio.sfx('land');
        Audio.sfx('spike');
        g2.shake(5, 0.3);
        Audio.sfx('slam');
      });
      const sx = this.x;
      const sy = this.y;
      let el = 0;
      const T = 0.85 / this.bs;
      this.play('rising', 0);
      yield (dt) => {
        el += dt;
        const k = Math.min(1, el / T);
        this.x = U.lerp(sx, tx, U.easeOut(k));
        this.y = U.lerp(sy, ty, U.easeOut(k));
        this.z = Math.sin(k * Math.PI) * 40;
        if (k > 0.5 && this.anim !== 'falling') this.play('falling', 0);
        return el >= T;
      };
      this.z = 0;
      yield* this.recoverFor(1.0, 'land', 0.7);
    }
    *atk_tongue() {
      const g = this.g;
      const a = this.angP();
      yield* this.windup('line', 0.75, { len: 135, ang: a }, 'lick', 1.5);
      this.face = Math.cos(a) >= 0 ? 1 : -1;
      const ox = this.x;
      const oy = this.y - 6;
      Audio.sfx('swing');
      g.addZone({ kind: 'beam', shape: 'line', x: ox, y: oy, ang: a, len: 135, w: 9, life: 0.25, dmgP: g.edmg(14), once: true });
      FX.vfx('fx.frogTongue', ox + Math.cos(a) * 66, oy + Math.sin(a) * 66, { scale: 2.0, rot: a, fps: 24 });
      CH.Kit.muzzle('toxic', ox, oy, a, 11, { force: true });
      CH.Kit.hit('toxic', ox + Math.cos(a) * 130, oy + Math.sin(a) * 130, 17, true);
      yield 0.8;
      yield* this.recoverFor(0.7);
    }
    *atk_spit() {
      const g = this.g;
      yield* this.windup('excl', 0.5, undefined, 'spit', 2.4);
      for (let v = 0; v < 3; v++) {
        const a = this.angP();
        Audio.sfx('hiss');
        for (let k = -1; k <= 1; k++) this.shot(a + k * 0.28, 95, g.edmg(8), 'fx.frogBall', { animFps: 12, scale: 0.7, face: true, color: '#63c74d' });
        yield 0.55;
      }
      yield* this.recoverFor(0.8);
    }
    *atk_tadpoles() {
      yield* this.windup('ring', 0.6, { r: 50 }, 'spit', 1.3);
      FX.speech(this, 'RIBBIT!', 1.6);
      Audio.sfx('growl');
      this.summon('intern', this.enraged ? 5 : 3);
      yield* this.recoverFor(1.0);
    }
  }

  /* ===================================================================
     BOULDER DASH  (wave-3 miniboss alternative)
     =================================================================== */
  class BoulderBoss extends Boss {
    attackPool() {
      return [
        { name: 'roll', w: 3 },
        { name: 'hands', w: 2.6 },
        { name: 'rocks', w: 2.4 },
        { name: 'stomp', w: 2.2 },
      ];
    }
    *atk_roll() {
      const g = this.g;
      this.setState('attack');
      this.play('windup', 0);
      this.gather(1.1);
      let el = 0;
      this.setTele('line', 0.9 / this.bs, { len: 330, ang: this.angP() });
      Audio.sfx('warn');
      yield (dt) => {
        el += dt;
        this.tele.ang = this.angP();
        return el >= 0.9 / this.bs;
      };
      let a = this.tele ? this.tele.ang : this.angP();
      this.tele = null;
      this.hot = true;
      this.play('curl', 0);
      this.spin = 1;
      Audio.sfx('growl');
      let bounces = 0;
      el = 0;
      yield (dt) => {
        el += dt;
        CH.Enemies.moveDir(this, a, 260 * this.speedMul);
        this.streak(dt, a, 26);
        if (Math.random() < 0.6) FX.dust(this.x, this.y + 18, 1);
        if (this.wallHit) {
          bounces++;
          // reflect off the wall we hit
          const m = B.arena.margin + this.r + 2;
          if (this.x <= m + 1 || this.x >= g.arena.w - m - 1) a = Math.PI - a;
          if (this.y <= m + 1 || this.y >= g.arena.h - m - 1) a = -a;
          g.shake(3, 0.12);
          Audio.sfx('slam');
          FX.burst(this.x, this.y, { n: 10, colors: 'junk', speed: 130, life: 0.5 });
          CH.Kit.impact('earth', this.x, this.y + 6, 32);
        }
        return bounces >= 3 || el > 2.4;
      };
      this.hot = false;
      this.spin = 0;
      FX.speech(this, 'DIZZY...', 1.4);
      yield* this.recoverFor(1.5); // dazed after the roll: free damage window
    }
    *atk_hands() {
      const g = this.g;
      this.setState('attack');
      this.play('handsup', 2.2);
      this.gather(1.1);
      FX.speech(this, 'HANDS UP!', 1.4);
      const p = this.tp();
      for (let i = 0; i < 6; i++) {
        let x;
        let y;
        if (i === 0) {
          x = p.x;
          y = p.y;
        } else {
          const a = U.rand(0, U.TAU);
          const d = U.rand(30, 110);
          x = U.clamp(p.x + Math.cos(a) * d, 40, g.arena.w - 40);
          y = U.clamp(p.y + Math.sin(a) * d, 40, g.arena.h - 40);
        }
        g.addWarn(x, y, 24, 1.05 / this.bs, (g2, z) => {
          g2.explode(z.x, z.y, 24, 0, { hurtPlayer: true, pdmg: g2.edmg(15), colors: 'crumb', knock: 160, noShake: true, fx: 'earth' });
          Audio.sfx('rock');
          if (CH.Sprites.has('fx.bdHands')) FX.debris('fx.bdHands', z.x, z.y + 8, U.rand(-8, 8), -95, { frame: U.randInt(0, 4), life: 0.55, g: 340, vr: 0 });
          FX.burst(z.x, z.y, { n: 8, colors: 'junk', speed: 90, life: 0.5 });
          Audio.sfx('slam');
        });
        Audio.sfx('warn');
        yield 0.2;
      }
      yield 1.2;
      yield* this.recoverFor(1.1);
    }
    *atk_rocks() {
      const g = this.g;
      yield* this.windup('excl', 0.6, undefined, 'punch', 1.8);
      for (let v = 0; v < 3; v++) {
        const a = this.angP();
        Audio.sfx('shoot_chair');
        for (let k = -1; k <= 1; k++) this.shot(a + k * 0.3, 120, g.edmg(9), 'fx.rock', { spin: 8, scale: 0.55, r: 5, color: '#8b5a2b' });
        yield 0.5;
      }
      yield* this.recoverFor(0.9);
    }
    *atk_stomp() {
      const g = this.g;
      const R = 74;
      this.setState('attack');
      this.play('handsup', 1.9);
      Audio.sfx('jump');
      this.gather(1.2);
      const tx = this.tp().x;
      const ty = this.tp().y;
      g.addWarn(tx, ty, R, 1.0 / this.bs, (g2, z) => {
        g2.explode(z.x, z.y, R, 0, { hurtPlayer: true, pdmg: g2.edmg(20), colors: 'crumb', knock: 240, fx: 'earth' });
        g2.shake(7, 0.35);
        Audio.sfx('slam');
        for (let i = 0; i < 8; i++) this.shot((i / 8) * U.TAU, 80, g2.edmg(6), 'fx.rock', { spin: 8, scale: 0.4, r: 4, color: '#8b5a2b' });
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
        this.z = Math.sin(k * Math.PI) * 44;
        return el >= T;
      };
      this.z = 0;
      yield* this.recoverFor(1.2);
    }
  }

  /* ===================================================================
     MECHA-STONE GOLEM  (late miniboss)
     =================================================================== */
  class GolemBoss extends Boss {
    attackPool() {
      return [
        { name: 'lasers', w: 3 },
        { name: 'arm', w: 2.4 },
        { name: 'slam', w: 2.6 },
        { name: 'burrow', w: 2.2 },
      ];
    }
    beamAt(ang, delay) {
      const g = this.g;
      const ox = this.x;
      const oy = this.y - 6;
      CH.Kit.cast('tech', ox, oy, 14);
      g.addWarn(ox, oy, 0, delay, (g2) => {
        CH.Kit.beam('tech', ox, oy, ang, 520, 12);
        g2.addZone({ kind: 'beam', shape: 'line', x: ox, y: oy, ang, len: 520, w: 12, life: 0.4, dmgP: g2.edmg(16), once: true });
        g2.shake(3, 0.2);
        Audio.sfx('thunder');
      }, { shape: 'line', ang, len: 520, w: 12 });
    }
    *atk_lasers() {
      const base = this.angP();
      yield* this.windup('ring', 0.5, { r: 40 }, 'cast', 2.4);
      Audio.sfx('warn');
      for (const o of [-0.38, 0, 0.38]) this.beamAt(base + o, 1.15 / this.bs);
      yield 1.7;
      yield* this.recoverFor(1.0);
    }
    *atk_arm() {
      const g = this.g;
      yield* this.windup('excl', 0.6, undefined, 'arm', 2.0);
      FX.speech(this, 'ROCKET ARM!', 1.5);
      Audio.sfx('fireball');
      const n = this.enraged ? 2 : 1;
      for (let i = 0; i < n; i++) {
        g.spawnProjectile({ owner: 'e', kind: 'bullet', x: this.x, y: this.y - 8, ang: this.angP() + (i ? 0.7 : 0), speed: 88, r: 7, dmg: g.edmg(14), life: 5, sprite: 'fx.golArm', face: true, scale: 0.55, homing: 1.5, color: '#3ccbe6', fx: 'tech', big: true });
      }
      yield 1.3;
      yield* this.recoverFor(0.9);
    }
    *atk_slam() {
      const g = this.g;
      const R = 80;
      this.setState('attack');
      this.play('slam', 1.8);
      Audio.sfx('jump');
      this.gather(1.2);
      const tx = this.tp().x;
      const ty = this.tp().y;
      g.addWarn(tx, ty, R, 1.0 / this.bs, (g2, z) => {
        g2.explode(z.x, z.y, R, 0, { hurtPlayer: true, pdmg: g2.edmg(20), colors: 'crumb', knock: 230, fx: 'earth' });
        g2.shake(7, 0.35);
        Audio.sfx('slam');
        for (let i = 0; i < 10; i++) this.shot((i / 10) * U.TAU, 85, g2.edmg(6), 'fx.rock', { spin: 8, scale: 0.4, r: 4, color: '#8b5a2b' });
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
        this.z = Math.sin(k * Math.PI) * 36;
        return el >= T;
      };
      this.z = 0;
      yield* this.recoverFor(1.2);
    }
    *atk_burrow() {
      const g = this.g;
      this.setState('attack');
      this.play('burrow', 1.0);
      Audio.sfx('warn');
      yield 0.9;
      this.hidden = true;
      FX.burst(this.x, this.y + 10, { n: 14, colors: 'junk', speed: 120, life: 0.5 });
      CH.Kit.impact('earth', this.x, this.y + 10, 30);
      Audio.sfx('rock');
      const p = this.tp();
      const tx = p.x;
      const ty = p.y;
      g.addWarn(tx, ty, 42, 1.3 / this.bs, (g2, z) => {
        this.x = z.x;
        this.y = z.y;
        this.hidden = false;
        g2.explode(z.x, z.y, 42, 0, { hurtPlayer: true, pdmg: g2.edmg(20), colors: 'crumb', knock: 220, fx: 'earth' });
        for (let i = 0; i < 6; i++) this.shot((i / 6) * U.TAU, 90, g2.edmg(6), 'fx.rock', { spin: 8, scale: 0.4, r: 4, color: '#8b5a2b' });
        g2.shake(6, 0.3);
        Audio.sfx('slam');
      });
      yield 1.35;
      this.hidden = false;
      yield* this.recoverFor(1.3);
    }
  }

  /* ===================================================================
     THE SKELETON MAW  (late miniboss)
     =================================================================== */
  class MawBoss extends Boss {
    attackPool() {
      return [
        { name: 'bones', w: 3 },
        { name: 'hands', w: 2.4 },
        { name: 'blast', w: 2.4 },
        { name: 'teleport', w: 2 },
        { name: 'summon', w: this.g.enemies.length > 14 ? 0.3 : 1.5 },
      ];
    }
    *atk_bones() {
      const g = this.g;
      yield* this.windup('excl', 0.55, undefined, 'bone', 2.6);
      for (let v = 0; v < 4; v++) {
        const a = this.angP();
        Audio.sfx('arrow');
        for (let k = -1; k <= 1; k++) this.shot(a + k * 0.26, 140, g.edmg(8), 'fx.mawBone1', { spin: 12, scale: 1.0, r: 4, color: '#e8e4f0' });
        yield 0.42;
      }
      yield* this.recoverFor(0.9);
    }
    *atk_hands() {
      const g = this.g;
      this.setState('attack');
      this.play('hand', 2.6);
      FX.speech(this, 'GIVE ME A HAND!', 1.6);
      const p = this.tp();
      for (let i = 0; i < 6; i++) {
        let x;
        let y;
        if (i === 0) {
          x = p.x;
          y = p.y;
        } else {
          const a = U.rand(0, U.TAU);
          const d = U.rand(30, 120);
          x = U.clamp(p.x + Math.cos(a) * d, 40, g.arena.w - 40);
          y = U.clamp(p.y + Math.sin(a) * d, 40, g.arena.h - 40);
        }
        g.addWarn(x, y, 22, 1.1 / this.bs, (g2, z) => {
          g2.explode(z.x, z.y, 22, 0, { hurtPlayer: true, pdmg: g2.edmg(15), colors: 'glitch', knock: 150, noShake: true, fx: 'magic' });
          FX.vfx('fx.mawHands', z.x, z.y - 6, { scale: 1.4, fps: 18 });
          Audio.sfx('growl');
        });
        Audio.sfx('warn');
        yield 0.22;
      }
      yield 1.3;
      yield* this.recoverFor(1.0);
    }
    *atk_blast() {
      const g = this.g;
      const R = 62;
      this.setState('attack');
      this.play('blast', 1.9);
      this.gather(1.3);
      FX.speech(this, 'KABOOM!', 1.4);
      const tx = this.tp().x;
      const ty = this.tp().y;
      g.addWarn(tx, ty, R, 1.25 / this.bs, (g2, z) => {
        g2.explode(z.x, z.y, R, 0, { hurtPlayer: true, pdmg: g2.edmg(22), colors: 'glitch', knock: 260, fx: 'magic' });
        CH.Kit.impact('bolt', z.x, z.y, R * 0.6, { alpha: 0.8 });
        FX.vfx('fx.mawBlast', z.x, z.y, { scale: R / 50, fps: 14 });
        g2.shake(6, 0.35);
        Audio.sfx('big_explosion');
      });
      Audio.sfx('warn');
      yield 2.0;
      yield* this.recoverFor(1.0);
    }
    *atk_teleport() {
      const g = this.g;
      const p = this.tp();
      let x;
      let y;
      for (let i = 0; i < 20; i++) {
        x = U.rand(70, g.arena.w - 70);
        y = U.rand(70, g.arena.h - 70);
        if (Math.hypot(x - p.x, y - p.y) > 140) break;
      }
      this.setState('attack');
      this.play('teleport', 1.7);
      Audio.sfx('teleport');
      g.addWarn(x, y, 26, 1.1 / this.bs, null);
      yield 0.6;
      this.hidden = true;
      FX.burst(this.x, this.y, { n: 20, colors: 'glitch', speed: 130, life: 0.5 });
      CH.Kit.impact('magic', this.x, this.y - 8, 30);
      yield 0.55 / this.bs;
      this.x = x;
      this.y = y;
      this.hidden = false;
      CH.Kit.impact('magic', x, y - 10, 34);
      for (let i = 0; i < 10; i++) this.shot((i / 10) * U.TAU, 95, g.edmg(7), 'fx.mawBall1', { scale: 1.2, r: 4, color: '#3b6fe0' });
      Audio.sfx('magic');
      yield 0.6;
      yield* this.recoverFor(0.8);
    }
    *atk_summon() {
      const g = this.g;
      yield* this.windup('ring', 0.7, { r: 70 }, 'summon', 2.8);
      FX.speech(this, 'ARISE, MY MINIONS!', 2);
      Audio.sfx('event');
      FX.vfx('fx.mawZombies', this.x - 30, this.y + 6, { scale: 1, fps: 8, alpha: 0.9 });
      FX.vfx('fx.mawZombies', this.x + 30, this.y + 6, { scale: 1, fps: 8, alpha: 0.9 });
      this.summon('office', this.enraged ? 3 : 2);
      this.summon('intern', this.enraged ? 4 : 3);
      yield* this.recoverFor(1.4);
    }
  }

  /* ===================================================================
     DRAGON BOSS - IGNIS THE PYROCLAST
     =================================================================== */
  class DragonBoss extends Boss {
    attackPool() {
      return [
        { name: 'breath', w: 3.2 },
        { name: 'flight', w: 2.6 },
        { name: 'claw', w: 2.8 },
        { name: 'inferno', w: 2.2 },
      ];
    }
    *atk_breath() {
      const g = this.g;
      this.setState('attack');
      yield* this.windup('ring', 0.6, { r: 52 }, 'attack2', 2.8);
      Audio.sfx('cre_roar');
      Audio.sfx('fireball');
      const baseAng = this.angP();
      const nShots = this.enraged ? 14 : 10;
      for (let i = 0; i < nShots; i++) {
        const sweep = Math.sin((i / nShots) * Math.PI) * 0.45 * (i % 2 === 0 ? 1 : -1);
        const a = baseAng + sweep;
        CH.Kit.muzzle('fire', this.x, this.y - 12, a, 14, { force: true });
        this.shot(a, 130 + U.rand(-20, 20), g.edmg(8), 'fx.mageFire', {
          scale: 0.8, r: 5, color: '#feae34', fx: 'fire'
        });
        if (i % 3 === 0) {
          g.addZone({ kind: 'lava', shape: 'circle', x: this.x + Math.cos(a) * (40 + i * 15), y: this.y + Math.sin(a) * (40 + i * 15), r: 16, life: 2.0, dmgP: g.edmg(6) });
        }
        yield 0.08;
      }
      yield* this.recoverFor(1.0);
    }
    *atk_flight() {
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
        const mx = tx + U.rand(-70, 70);
        const my = ty + U.rand(-70, 70);
        g.addWarn(mx, my, 40, 0.9 / this.bs, (g2, z) => {
          g2.explode(z.x, z.y, 40, 0, { hurtPlayer: true, pdmg: g2.edmg(18), colors: 'fire', knock: 180, fx: 'fire' });
          CH.Kit.impact('fire', z.x, z.y, 42);
          Audio.sfx('big_explosion');
        });
        Audio.sfx('warn');
        yield 0.35;
      }
      yield 0.5;
      // Slam landing
      this.play('landing', 0.8);
      this.x = tx;
      this.y = ty;
      this.z = 0;
      g.shake(7, 0.4);
      Audio.sfx('slam');
      CH.Kit.impact('fire', this.x, this.y, 70);
      g.hurtPlayers(g.edmg(18), this, { kx: 1 }, (q) => Math.hypot(q.x - this.x, q.y - this.y) < 65 + q.r);
      for (let i = 0; i < 8; i++) {
        this.shot((i / 8) * U.TAU, 90, g.edmg(6), 'fx.mageFire', { scale: 0.6, r: 4, color: '#feae34' });
      }
      yield 0.6;
      yield* this.recoverFor(1.2);
    }
    *atk_claw() {
      const g = this.g;
      yield* this.windup('excl', 0.45, undefined, 'attack1', 1.4);
      Audio.sfx('cre_roar');
      const a = this.angP();
      const sx = this.x;
      const sy = this.y;
      const tx = sx + Math.cos(a) * 90;
      const ty = sy + Math.sin(a) * 90;
      let el = 0;
      const T = 0.3 / this.bs;
      this.hot = true;
      yield (dt) => {
        el += dt;
        const k = Math.min(1, el / T);
        this.x = U.lerp(sx, tx, k);
        this.y = U.lerp(sy, ty, k);
        this.streak(dt, a, 30, 'fire');
        return el >= T;
      };
      this.hot = false;
      CH.Kit.slash('fire', this.x, this.y - 10, a, 45);
      Audio.sfx('slam');
      g.hurtPlayers(g.edmg(16), this, { kx: Math.cos(a) * 200, ky: Math.sin(a) * 200 }, (q) => Math.hypot(q.x - this.x, q.y - this.y) < 48 + q.r);
      yield* this.recoverFor(0.8);
    }
    *atk_inferno() {
      const g = this.g;
      this.setState('attack');
      this.play('special', 2.2);
      this.gather(1.4);
      FX.speech(this, 'ASHES TO ASHES!', 1.8);
      Audio.sfx('cre_roar');
      yield 0.6;
      const rings = this.enraged ? 3 : 2;
      for (let r = 0; r < rings; r++) {
        Audio.sfx('fireball');
        const offset = (r * Math.PI) / 8;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * U.TAU + offset;
          this.shot(a, 95, g.edmg(7), 'fx.mageFire', { scale: 0.75, r: 5, color: '#e43b44', fx: 'fire' });
        }
        yield 0.45;
      }
      yield* this.recoverFor(1.2);
    }
  }

  /* ===================================================================
     BEHOLDER BOSS - XAL'ATATH THE EYE TYRANT
     =================================================================== */
  class BeholderBoss extends Boss {
    attackPool() {
      return [
        { name: 'eye_beams', w: 3.2 },
        { name: 'madness_ring', w: 2.6 },
        { name: 'gaze', w: 2.8 },
        { name: 'blink', w: 2.0 },
      ];
    }
    beamAt(ang, delay) {
      const g = this.g;
      const ox = this.x;
      const oy = this.y - 4;
      CH.Kit.cast('magic', ox, oy, 16);
      g.addWarn(ox, oy, 0, delay, (g2) => {
        CH.Kit.beam('magic', ox, oy, ang, 480, 10);
        g2.addZone({ kind: 'beam', shape: 'line', x: ox, y: oy, ang, len: 480, w: 10, life: 0.35, dmgP: g2.edmg(14), once: true });
        g2.shake(2, 0.18);
        Audio.sfx('thunder');
      }, { shape: 'line', ang, len: 480, w: 10 });
    }
    *atk_eye_beams() {
      this.setState('attack');
      this.play('attack_fire', 2.0);
      yield* this.windup('ring', 0.5, { r: 42 }, 'attack_fire', 2.0);
      Audio.sfx('cre_hiss');
      const base = this.angP();
      for (const off of [-0.34, 0, 0.34]) {
        this.beamAt(base + off, 0.9 / this.bs);
      }
      yield 1.3;
      yield* this.recoverFor(0.9);
    }
    *atk_madness_ring() {
      const g = this.g;
      this.setState('attack');
      this.play('attack', 2.2);
      this.gather(1.2);
      Audio.sfx('magic');
      yield 0.5;
      const waves = this.enraged ? 2 : 1;
      for (let w = 0; w < waves; w++) {
        const n = 12;
        const off = (w * Math.PI) / n;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * U.TAU + off;
          this.shot(a, 85, g.edmg(6), 'fx.mawBall1', { scale: 1.1, r: 4, color: '#733e39', fx: 'magic' });
        }
        yield 0.5;
      }
      yield* this.recoverFor(0.9);
    }
    *atk_gaze() {
      const g = this.g;
      this.setState('attack');
      this.play('attack', 2.0);
      this.gather(1.3);
      FX.speech(this, 'I SEE ALL!', 1.6);
      Audio.sfx('warn');
      const p = this.tp();
      const tx = p.x;
      const ty = p.y;
      const R = 54;
      g.addWarn(tx, ty, R, 1.2 / this.bs, (g2, z) => {
        g2.explode(z.x, z.y, R, 0, { hurtPlayer: true, pdmg: g2.edmg(20), colors: 'glitch', knock: 220, fx: 'magic' });
        g2.addZone({ kind: 'corrupt', shape: 'circle', x: z.x, y: z.y, r: R * 0.8, life: 2.5, dmgP: g2.edmg(6), slow: 0.55 });
        CH.Kit.impact('magic', z.x, z.y, R * 0.7);
        Audio.sfx('big_explosion');
      });
      yield 1.6;
      yield* this.recoverFor(1.0);
    }
    *atk_blink() {
      const g = this.g;
      const p = this.tp();
      let nx = this.x;
      let ny = this.y;
      for (let i = 0; i < 15; i++) {
        const candX = U.rand(80, g.arena.w - 80);
        const candY = U.rand(80, g.arena.h - 80);
        if (Math.hypot(candX - p.x, candY - p.y) > 130) {
          nx = candX;
          ny = candY;
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
      CH.Kit.impact('magic', this.x, this.y, 30);
      yield 0.5 / this.bs;
      this.x = nx;
      this.y = ny;
      this.hidden = false;
      CH.Kit.impact('magic', nx, ny, 32);
      for (let i = 0; i < 8; i++) {
        this.shot((i / 8) * U.TAU, 90, g.edmg(6), 'fx.mawBall1', { scale: 0.9, r: 4, color: '#3b6fe0' });
      }
      yield 0.4;
      yield* this.recoverFor(0.8);
    }
  }

  /* ===================================================================
     MAGE BOSS - VALTRIX THE ARCHMAGE
     =================================================================== */
  class MageBoss extends Boss {
    attackPool() {
      return [
        { name: 'ice_barrage', w: 3.0 },
        { name: 'fire_spread', w: 2.8 },
        { name: 'arcane_ray', w: 2.5 },
        { name: 'blink_run', w: 2.0 },
      ];
    }
    *atk_ice_barrage() {
      const g = this.g;
      this.setState('attack');
      this.play('attack1', 2.2);
      yield* this.windup('excl', 0.5, undefined, 'attack1', 2.0);
      Audio.sfx('magic');
      const count = this.enraged ? 4 : 3;
      for (let i = 0; i < count; i++) {
        const a = this.angP() + U.rand(-0.15, 0.15);
        Audio.sfx('shoot_chair');
        this.shot(a, 135, g.edmg(9), 'fx.mageIce', {
          scale: 0.8, r: 6, color: '#3ccbe6', fx: 'ice', slow: { mul: 0.5, t: 2.0 }
        });
        CH.Kit.muzzle('ice', this.x, this.y - 8, a, 12, { force: true });
        yield 0.28;
      }
      yield* this.recoverFor(0.9);
    }
    *atk_fire_spread() {
      const g = this.g;
      this.setState('attack');
      this.play('attack2', 2.0);
      yield* this.windup('ring', 0.5, { r: 38 }, 'attack2', 1.8);
      Audio.sfx('fireball');
      const base = this.angP();
      for (const o of [-0.4, -0.2, 0, 0.2, 0.4]) {
        this.shot(base + o, 115, g.edmg(8), 'fx.mageFire', {
          scale: 0.75, r: 5, color: '#feae34', fx: 'fire'
        });
      }
      yield 0.8;
      yield* this.recoverFor(0.9);
    }
    *atk_arcane_ray() {
      const g = this.g;
      this.setState('attack');
      this.play('attack4', 2.4);
      yield* this.windup('ring', 0.6, { r: 45 }, 'attack4', 2.2);
      Audio.sfx('thunder');
      const a = this.angP();
      const ox = this.x;
      const oy = this.y - 8;
      CH.Kit.beam('tech', ox, oy, a, 460, 14);
      g.addZone({ kind: 'beam', shape: 'line', x: ox, y: oy, ang: a, len: 460, w: 14, life: 0.45, dmgP: g.edmg(16), once: true });
      g.shake(4, 0.25);
      yield 0.9;
      yield* this.recoverFor(1.1);
    }
    *atk_blink_run() {
      const g = this.g;
      this.setState('attack');
      this.play('run', 1.2);
      Audio.sfx('teleport');
      const p = this.tp();
      const awayAng = Math.atan2(this.y - p.y, this.x - p.x) + U.rand(-0.6, 0.6);
      const dist = 120;
      const tx = U.clamp(this.x + Math.cos(awayAng) * dist, 60, g.arena.w - 60);
      const ty = U.clamp(this.y + Math.sin(awayAng) * dist, 60, g.arena.h - 60);
      let el = 0;
      const T = 0.5 / this.bs;
      const sx = this.x;
      const sy = this.y;
      yield (dt) => {
        el += dt;
        const k = Math.min(1, el / T);
        this.x = U.lerp(sx, tx, k);
        this.y = U.lerp(sy, ty, k);
        this.streak(dt, awayAng, 20, 'tech');
        return el >= T;
      };
      g.addZone({ kind: 'beam', shape: 'circle', x: this.x, y: this.y, r: 28, life: 3.0, dmgP: g.edmg(8), slow: 0.6, color: '#3ccbe6' });
      yield 0.4;
      yield* this.recoverFor(0.7);
    }
  }

  /* ===================================================================
     DEMON BOSS - MALKOR THE PIT LORD
     =================================================================== */
  class DemonBoss extends Boss {
    attackPool() {
      return [
        { name: 'hellfire_cleave', w: 3.2 },
        { name: 'rampage', w: 2.8 },
        { name: 'eruption', w: 2.5 },
        { name: 'summon_imps', w: 2.0 },
      ];
    }
    *atk_hellfire_cleave() {
      const g = this.g;
      yield* this.windup('excl', 0.5, undefined, 'attack1', 1.8);
      Audio.sfx('slam');
      const a = this.angP();
      CH.Kit.slash('fire', this.x, this.y - 8, a, 46);
      g.shake(4, 0.25);
      for (let step = 1; step <= 5; step++) {
        const fx = this.x + Math.cos(a) * step * 32;
        const fy = this.y + Math.sin(a) * step * 32;
        g.addZone({ kind: 'lava', shape: 'circle', x: fx, y: fy, r: 18, life: 2.2, dmgP: g.edmg(9) });
        CH.Kit.impact('fire', fx, fy, 22);
      }
      g.hurtPlayers(g.edmg(18), this, { kx: Math.cos(a) * 180, ky: Math.sin(a) * 180 }, (q) => Math.hypot(q.x - this.x, q.y - this.y) < 50 + q.r);
      yield 0.6;
      yield* this.recoverFor(1.0);
    }
    *atk_rampage() {
      const g = this.g;
      this.setState('attack');
      this.play('run', 2.0);
      yield* this.windup('excl', 0.45, undefined, 'run', 2.0);
      Audio.sfx('cre_growl');
      const a = this.angP();
      const sx = this.x;
      const sy = this.y;
      const tx = sx + Math.cos(a) * 220;
      const ty = sy + Math.sin(a) * 220;
      let el = 0;
      const T = 0.7 / this.bs;
      this.hot = true;
      yield (dt) => {
        el += dt;
        const k = Math.min(1, el / T);
        this.x = U.lerp(sx, tx, k);
        this.y = U.lerp(sy, ty, k);
        this.streak(dt, a, 36, 'fire');
        return el >= T;
      };
      this.hot = false;
      Audio.sfx('slam');
      g.shake(5, 0.3);
      CH.Kit.impact('earth', this.x, this.y, 50);
      yield* this.recoverFor(1.1);
    }
    *atk_eruption() {
      const g = this.g;
      this.setState('attack');
      this.play('attack3', 2.4);
      this.gather(1.3);
      FX.speech(this, 'BURN IN THE PIT!', 1.8);
      Audio.sfx('cre_growl');
      yield 0.5;
      const p = this.tp();
      const nGeysers = this.enraged ? 5 : 4;
      for (let i = 0; i < nGeysers; i++) {
        const gx = p.x + U.rand(-60, 60);
        const gy = p.y + U.rand(-60, 60);
        g.addWarn(gx, gy, 34, 0.95 / this.bs, (g2, z) => {
          g2.explode(z.x, z.y, 34, 0, { hurtPlayer: true, pdmg: g2.edmg(16), colors: 'fire', knock: 160, fx: 'fire' });
          g2.addZone({ kind: 'lava', shape: 'circle', x: z.x, y: z.y, r: 24, life: 2.2, dmgP: g2.edmg(7) });
          CH.Kit.impact('fire', z.x, z.y, 36);
          Audio.sfx('big_explosion');
        });
        Audio.sfx('warn');
        yield 0.22;
      }
      yield 1.1;
      yield* this.recoverFor(1.1);
    }
    *atk_summon_imps() {
      const g = this.g;
      yield* this.windup('ring', 0.6, { r: 55 }, 'attack4', 2.2);
      FX.speech(this, 'HELLSPAWN, TO ME!', 1.8);
      Audio.sfx('cre_growl');
      Audio.sfx('event');
      CH.Kit.impact('fire', this.x - 28, this.y + 4, 28);
      CH.Kit.impact('fire', this.x + 28, this.y + 4, 28);
      this.summon('slime', this.enraged ? 3 : 2);
      this.summon('goblin', this.enraged ? 3 : 2);
      yield* this.recoverFor(1.3);
    }
  }

  /* ===================================================================
     GLORP THE TOXIC OOZE  (early miniboss, also in the endless rotation)
     =================================================================== */
  class OozeBoss extends Boss {
    attackPool() {
      return [
        { name: 'venom_orbs', w: 3 },
        { name: 'acid_pools', w: 2.6 },
        { name: 'belly_flop', w: 2.6 },
        { name: 'split', w: this.g.enemies.length > 12 ? 0.3 : 1.6 },
      ];
    }
    *atk_venom_orbs() {
      const g = this.g;
      yield* this.windup('excl', 0.55, undefined, 'attack1', 2.2);
      for (let v = 0; v < 3; v++) {
        const a = this.angP();
        Audio.sfx('cre_wet');
        for (let k = -2; k <= 2; k++) this.shot(a + k * 0.2, 105, g.edmg(8), 'fx.oozeOrb', { scale: 2.4, r: 5, color: '#63c74d', fx: 'toxic', slow: { mul: 0.6, t: 1.6 } });
        yield 0.55;
      }
      yield* this.recoverFor(0.9);
    }
    *atk_acid_pools() {
      const g = this.g;
      this.setState('attack');
      this.play('attack2', 2.6);
      this.gather(1.2);
      FX.speech(this, 'SPLORCH!', 1.4);
      const p = this.tp();
      const n = this.enraged ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const x = i === 0 ? p.x : U.clamp(p.x + U.rand(-100, 100), 40, g.arena.w - 40);
        const y = i === 0 ? p.y : U.clamp(p.y + U.rand(-100, 100), 40, g.arena.h - 40);
        g.addWarn(x, y, 26, 1.0 / this.bs, (g2, z) => {
          g2.explode(z.x, z.y, 26, 0, { hurtPlayer: true, pdmg: g2.edmg(13), colors: 'goo', knock: 140, noShake: true, fx: 'toxic' });
          g2.addZone({ kind: 'acid', x: z.x, y: z.y, r: 24, life: 4.5, dmgP: g2.edmg(6), tick: 0.5 });
          Audio.sfx('cre_wet');
        });
        Audio.sfx('warn');
        yield 0.2;
      }
      yield 1.2;
      yield* this.recoverFor(1.0);
    }
    *atk_belly_flop() {
      const g = this.g;
      const R = 66;
      this.setState('attack');
      this.play('attack3', 2.0);
      Audio.sfx('jump');
      this.gather(1.2);
      const p = this.tp();
      const tx = p.x;
      const ty = p.y;
      g.addWarn(tx, ty, R, 1.0 / this.bs, (g2, z) => {
        g2.explode(z.x, z.y, R, 0, { hurtPlayer: true, pdmg: g2.edmg(20), colors: 'goo', knock: 230, fx: 'toxic' });
        g2.shake(6, 0.3);
        Audio.sfx('slam');
        for (let i = 0; i < 8; i++) this.shot((i / 8) * U.TAU, 85, g2.edmg(6), 'fx.oozeOrb', { scale: 2.0, r: 4, color: '#63c74d', fx: 'toxic' });
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
        this.z = Math.sin(k * Math.PI) * 42;
        return el >= T;
      };
      this.z = 0;
      yield* this.recoverFor(1.2);
    }
    *atk_split() {
      yield* this.windup('ring', 0.7, { r: 55 }, 'attack4', 1.6);
      FX.speech(this, 'SPLIT UP!', 1.6);
      Audio.sfx('event');
      this.summon('slime', this.enraged ? 5 : 3, { hpMul: 0.6 });
      yield* this.recoverFor(1.0);
    }
  }

  Bo.Boss = Boss;

  Bo.create = function (g, kind, x, y, o) {
    const C = Bo.classes[kind] || {
      ceo: CEO, chicken: ChickenBoss, bug: BugBoss, frog: FrogBoss,
      bd: BoulderBoss, gol: GolemBoss, maw: MawBoss,
      dragon: DragonBoss, beholder: BeholderBoss, mage: MageBoss, demon: DemonBoss, ooze: OozeBoss
    }[kind];
    return new C(g, kind, x, y, o);
  };

  /* ---------- rendering ---------- */
  /* frame of the boss's animation sheet to show right now */
  function bossFrame(b) {
    const S = CH.Sprites;
    const n = b.look.sprite;
    if (b.dying) {
      const el = (b.deathTotal || 2.4) - b.deathT;
      return S.frameAt(n, 'death', Math.min(1, el / Math.max(0.5, (b.deathTotal || 2.4) - 0.7)));
    }
    if (b.hidden) return 0;
    if (b.anim) return b.animDur > 0 ? S.frameAt(n, b.anim, Math.min(0.999, b.animT / b.animDur)) : S.frame(n, b.anim, b.animT);
    if (b.state === 'chase' && (Math.abs(b.dvx) + Math.abs(b.dvy) > 4)) return S.frame(n, 'walk', b.age);
    return S.frame(n, 'idle', b.age);
  }

  Bo.draw = function (ctx, b, cam) {
    const g = b.g;
    const x = b.x - cam.x;
    const y = b.y - cam.y;
    const L = b.look;
    if (b.hidden) return;
    const art = CH.Art.on && CH.Sprites.has(L.sprite);
    const floaty = b.kind === 'bug' && !art;
    const hover = L.hover ? L.hover + Math.sin(b.age * 2.5) * 2 : floaty ? 8 + Math.sin(b.age * 2.5) * 3 : b.kind === 'chicken' ? 3 + Math.sin(b.age * 3) * 2 : 0;
    // shadow stays on the ground while the boss jumps / hovers
    CH.Enemies.shadow(ctx, x, y + L.foot, Math.round(L.shadow * (1 - Math.min(0.4, (b.z + hover) / 120))));
    let alpha = 1;
    if (b.intro > 0) alpha = 0.3 + 0.7 * (1 - b.intro / 2.6);
    const flash = b.immune && !b.hidden && b.phaseT > 0 ? 0.5 + 0.5 * Math.sin(b.age * 40) : b.flash;
    const o = {
      frame: art ? bossFrame(b) : b.state === 'attack' || b.state === 'dead' ? 1 : 0,
      flip: (b.face < 0) !== L.flipBase,
      flash: Math.max(0, flash),
      alpha,
      sx: (1 + Math.max(0, b.squash) * 0.06) * (art ? L.scale || 1 : 1),
      sy: (1 - Math.max(0, b.squash) * 0.06) * (art ? L.scale || 1 : 1),
      tint: b.enraged ? '#e43b44' : null,
      tintA: 0.2 + 0.12 * Math.sin(b.age * 8),
    };
    if (!art && b.kind === 'bug') o.flip = false;
    if (b.spin) {
      o.rot = b.age * 14 * (b.face >= 0 ? 1 : -1);
      o.pivot = 18; // spin about the middle of the body like a rolling ball
    }
    const sy = y + L.foot - b.z - hover + (!art && b.state === 'chase' ? -Math.abs(Math.sin(b.age * 6)) * 1.5 : 0);
    const glitchAmt = b.kind === 'bug' ? (b.phase >= 3 ? 5 : b.phase === 2 ? 3 : 1) : 0;
    if (b.kind === 'bug' && (b.phase >= 2 || b.dying) && Math.random() < (b.dying ? 0.9 : 0.25) && !CH.Storage.settings.reduced) {
      CH.Sprites.drawGlitched(ctx, L.sprite, x, sy, o, glitchAmt + (b.dying ? 6 : 0));
    } else if (b.dying && !art) {
      CH.Sprites.draw(ctx, L.sprite, x + U.rand(-2, 2), sy, o);
    } else {
      CH.Sprites.draw(ctx, L.sprite, x, sy, o);
    }
    if (b.tele && b.tele.kind === 'excl' && Math.floor(b.age * 16) % 2 === 0 && b.tele.t > 0) {
      const ty = sy - L.h - 6;
      ctx.fillStyle = '#1b1226';
      ctx.fillRect(Math.round(x - 3), Math.round(ty - 1), 6, 13);
      ctx.fillStyle = '#e43b44';
      ctx.fillRect(Math.round(x - 2), Math.round(ty), 4, 8);
      ctx.fillRect(Math.round(x - 2), Math.round(ty + 9), 4, 3);
    }
  };
})(window.CH);
