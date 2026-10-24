/* CHAOS.exe - the ten regular enemies: a shared Enemy class plus a small state-machine AI per type.
   States: spawn -> idle -> chase -> attack -> recover -> (stunned) -> dead. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const Audio = CH.Audio;

  const E = (CH.Enemies = {});

  E.ids = ['chicken', 'potato', 'trashcan', 'office', 'toaster', 'influencer', 'cart', 'pigeon', 'fridge', 'intern', 'plant', 'slime', 'orc', 'goblin', 'spider', 'golem'];

  /* rendering config: sprite name, centre->ground offset (foot), shadow width, hover height for flyers.
     With the asset pack every sprite is an animation sheet (idle/walk/attack/hurt/death); the old
     procedural sprites remain as a fallback (anim 'two' / 'walk3' / 'flap' / 'tele'). */
  E.look = {
    chicken: { sprite: 'chicken', foot: 8, h: 22, faceRight: true, anim: 'two', shadow: 12, fx: 'goo', atk: 'cre_growl', die: 'enemy_die' },
    potato: { sprite: 'potato', foot: 8, h: 26, fly: 9, faceRight: true, anim: 'flap', shadow: 10, fx: 'fire', atk: 'cre_bird', die: 'die_bird' },
    trashcan: { sprite: 'trashcan', foot: 12, h: 34, faceRight: true, anim: 'tele', shadow: 20, fx: 'goo', atk: 'cre_roar', die: 'die_beast' },
    office: { sprite: 'office', foot: 8, h: 22, faceRight: true, anim: 'walk3', shadow: 12, fx: 'bone', atk: null, die: 'die_bone' },
    toaster: { sprite: 'toaster', foot: 8, h: 22, faceRight: true, anim: 'two', shadow: 18, fx: 'goo', atk: 'cre_growl', die: 'die_beast' },
    influencer: { sprite: 'influencer', foot: 8, h: 24, faceRight: true, anim: 'walk3', shadow: 12, fx: 'goo', atk: 'magic', die: 'enemy_die' },
    cart: { sprite: 'cart', foot: 10, h: 32, faceRight: true, anim: 'two', shadow: 24, fx: 'goo', atk: 'chain', die: 'enemy_die' },
    pigeon: { sprite: 'pigeon', foot: 8, h: 22, fly: 10, faceRight: true, anim: 'flap', shadow: 12, fx: 'fire', atk: 'cre_hiss', die: 'die_bird' },
    fridge: { sprite: 'fridge', foot: 14, h: 36, faceRight: true, anim: 'tele', shadow: 22, fx: 'fire', atk: 'cre_trumpet', die: 'die_rock' },
    intern: { sprite: 'intern', foot: 7, h: 16, faceRight: true, anim: 'walk3', shadow: 12, fx: 'goo', atk: 'cre_wet', die: 'die_wet' },
    plant: { sprite: 'plant', foot: 10, h: 28, faceRight: true, anim: 'walk3', shadow: 16, fx: 'toxic', atk: 'cre_wet', die: 'enemy_die' },
    slime: { sprite: 'slime', foot: 6, h: 22, faceRight: true, anim: 'walk3', shadow: 14, fx: 'toxic', atk: 'cre_wet', die: 'die_wet' },
    orc: { sprite: 'orc', foot: 10, h: 32, faceRight: true, anim: 'walk3', shadow: 18, fx: 'bone', atk: 'cre_growl', die: 'die_beast' },
    goblin: { sprite: 'goblin', foot: 8, h: 24, faceRight: true, anim: 'walk3', shadow: 12, fx: 'goo', atk: 'cre_growl', die: 'enemy_die' },
    spider: { sprite: 'spider', foot: 10, h: 26, faceRight: true, anim: 'walk3', shadow: 18, fx: 'toxic', atk: 'cre_hiss', die: 'die_beast' },
    golem: { sprite: 'golem', foot: 14, h: 36, faceRight: true, anim: 'walk3', shadow: 22, fx: 'earth', atk: 'cre_trumpet', die: 'die_rock' },
  };

  /* mutations of the regular enemies, from the extra art of each pack. Entry 0 is the plain enemy.
     hp / dmg / speed / scale multiply the stats; trait is an extra behaviour (see the AI and G.killEnemy / contact code):
       slow (touch slows), boom (explodes when killed), split (bursts into slimes), rapid (shoots more often),
       triple (shoots three), rage (charges more often), leap (pounces more often), shards (slam throws crystals), quake (bigger slam) */
  E.VARIANTS = {
    plant: [
      { name: 'Spitter Bloom', hp: 1.15, dmg: 1.1, trait: 'rapid' },
      { name: 'Royal Orchid', hp: 1.45, dmg: 1.2, trait: 'triple', scale: 1.1 },
    ],
    slime: [
      { name: 'Venom Slime', hp: 1.1, dmg: 1.1, trait: 'slow' },
      { name: 'Magma Slime', hp: 1.3, dmg: 1.2, trait: 'boom' },
      { name: 'Frost Slime', hp: 1.2, dmg: 1.0, trait: 'slow', speed: 0.9 },
      { name: 'Volt Slime', hp: 0.9, dmg: 1.1, speed: 1.35 },
      { name: 'Imp Slime', hp: 1.4, dmg: 1.2, trait: 'split' },
    ],
    orc: [
      { name: 'Orc Warlord', hp: 1.4, dmg: 1.15, scale: 1.08, trait: 'rage' },
      { name: 'Orc Chieftain', hp: 1.9, dmg: 1.3, scale: 1.16, trait: 'rage' },
    ],
    goblin: [
      { name: 'Goblin Hunter', hp: 1.2, dmg: 1.1, trait: 'rapid' },
      { name: 'Goblin Warchief', hp: 1.6, dmg: 1.25, trait: 'triple', scale: 1.1 },
    ],
    spider: [
      { name: 'Aqua Spider', hp: 1.2, dmg: 1.1, trait: 'slow' },
      { name: 'Brown Recluse', hp: 1.5, dmg: 1.15, speed: 0.92 },
      { name: 'Purple Widow', hp: 1.3, dmg: 1.25, speed: 1.12, trait: 'leap' },
    ],
    golem: [
      { name: 'Crystal Golem', hp: 1.2, dmg: 1.1, trait: 'shards' },
      { name: 'Abyssal Golem', hp: 1.6, dmg: 1.3, trait: 'quake', scale: 1.1 },
    ],
  };
  /* which variant (0 = plain) a freshly queued enemy gets; later waves and matching arenas mutate more */
  const BIOME_VARIANT = { volcano: { slime: 2, orc: 1, golem: 2 }, dungeon: { spider: 3, plant: 2, golem: 2 }, wasteland: { orc: 2, goblin: 2 }, backyard: { plant: 1, spider: 2 }, deadwood: { plant: 1, spider: 2, slime: 1 }, gaslight: { spider: 3, slime: 1 }, catacombs: { spider: 3, golem: 2, plant: 2 }, castle: { golem: 1 }, zombie: { slime: 1 } };
  E.rollVariant = function (type, wave, arenaId) {
    const list = E.VARIANTS[type];
    if (!list || wave < 2) return 0;
    if (Math.random() > Math.min(0.55, 0.1 + wave * 0.05)) return 0;
    const fav = BIOME_VARIANT[arenaId] && BIOME_VARIANT[arenaId][type];
    if (fav && Math.random() < 0.5) return fav;
    const top = wave >= 6 ? list.length : Math.max(1, Math.ceil(list.length / 2));
    return 1 + Math.floor(Math.random() * top);
  };

  const INSULTS = [
    'PER MY LAST EMAIL', 'SYNERGY!', "LET'S CIRCLE BACK", 'THIS IS NOT IN SCOPE', 'ANY BANDWIDTH?', 'LOW HANGING FRUIT',
    'COULD HAVE BEEN AN EMAIL', 'YOU ARE ON MUTE', 'NEW PHONE WHO DIS', 'GREAT LEADERSHIP SKILLS', 'I WILL ESCALATE', 'TAKE IT OFFLINE', 'YOUR KPIS ARE BAD',
  ];
  const INTERN_LINES = ['FOR EXPOSURE!', 'UNPAID!', 'I HAVE A DEGREE', 'IS THIS PAID?', 'COFFEE RUN!'];

  /* ---------------------------------------------------------------- */
  let uidSeq = 0;
  class Enemy {
    constructor(g, type, x, y, o) {
      o = o || {};
      this.uid = ++uidSeq;
      this.svx = 0; // smoothed movement (facing and sprite row follow this, not the raw AI velocity)
      this.svy = 0;
      this.vdir = ''; // '' side view, '_d' / '_u' facing down / up (4-direction packs)
      this.sepx = 0; // crowd steering (E.separate)
      this.sepy = 0;
      const b = B.enemies[type];
      this.g = g;
      this.type = type;
      this.def = b;
      this.look = E.look[type];
      const vt = E.VARIANTS[type] && o.variant ? E.VARIANTS[type][o.variant - 1] : null;
      this.variant = vt ? o.variant : 0;
      this.trait = vt ? vt.trait || '' : '';
      if (vt && CH.Sprites.has(type + '_v' + this.variant)) this.look = Object.assign({}, E.look[type], { sprite: type + '_v' + this.variant });
      this.x = x;
      this.y = y;
      this.isElite = !!o.elite;
      this.isBoss = false;
      const w = g.wave;
      const hpScale = 1 + (w <= 10 ? B.waves.hpScale * (w - 1) : B.waves.hpScale * 9 + B.waves.endlessHpScale * (w - 10));
      this.maxHp = this.hp = Math.max(1, Math.round(b.hp * hpScale * g.diff.enemyHp * (g.coop ? B.coop.enemyHp : 1) * (this.isElite ? B.eliteHp : 1) * (o.hpMul || 1) * (vt ? vt.hp || 1 : 1)));
      this.dmg = g.edmg(b.dmg) * (this.isElite ? B.eliteDmg : 1) * (vt ? vt.dmg || 1 : 1);
      this.baseR = b.r;
      this.scale = (this.isElite ? B.eliteScale : 1) * (vt ? vt.scale || 1 : 1);
      this.speed = b.speed * U.rand(0.93, 1.07) * (vt ? vt.speed || 1 : 1);
      this.vname = vt ? vt.name : null;
      this.state = 'spawn';
      this.t = o.spawnTime !== undefined ? o.spawnTime : 0.5;
      this.age = U.rand(0, 3);
      this.dvx = 0;
      this.dvy = 0;
      this.kx = 0;
      this.ky = 0;
      this.flash = 0;
      this.squash = 0;
      this.stunT = 0;
      this.slowT = 0;
      this.slowMul = 1;
      this.zoneSlow = 1;
      this.contactCd = 0.4;
      this.atkCd = U.rand(0.5, 1.5);
      this.hot = false; // true while dashing/charging: contact hurts more
      this.hotMul = 1.4;
      this.sub = '';
      this.tele = null;
      this.face = 1;
      this.phase = U.rand(0, U.TAU);
      this.dead = false;
      this.summoned = !!o.summoned;
      this.wallHit = false;
      this.h = this.look.h;
      this.hd = 0; // heading (cart)
      this.hurtT = 0;
      this.atkClock = 0;
      this.atkTotal = 0.5;
      this.shotCd = U.rand(1, 2.2);
      this.insultT = U.rand(3, 9);
      this.orb = U.rand(0, U.TAU);
      this.orbDir = Math.random() < 0.5 ? 1 : -1;
      this.orbR = U.rand(85, 125);
      this.tgt = { x, y, isPlayer: true };
      this.mass = 1 + b.r / 8;
      if (type === 'potato') this.chargeCd = U.rand(2, 4);
      if (type === 'toaster') {
        this.hazT = 0;
        this.chargeCd = U.rand(4, 6);
      }
      if (type === 'pigeon') this.diveCd = U.rand(1.5, 3);
      if (type === 'influencer') this.flashCd = U.rand(2, 4);
      if (type === 'cart') this.atkCd = U.rand(1, 2.5);
      if (type === 'trashcan') this.hotMul = 1;
      if (type === 'cart') this.hotMul = b.chargeDmg / b.dmg;
      if (type === 'pigeon') this.hotMul = b.diveDmg / b.dmg;
      if (type === 'plant') this.spitCd = U.rand(1.2, 2.4) * (this.trait === 'rapid' ? 0.6 : 1);
      if (type === 'slime') {
        this.puddleCd = 0.35;
        this.hopT = U.rand(0, 0.4);
      }
      if (type === 'orc') {
        this.rageCd = U.rand(3, 5);
        this.hotMul = 1.4;
      }
      if (type === 'goblin') {
        this.spearCd = U.rand(1.2, 2.2) * (this.trait === 'rapid' ? 0.6 : 1);
        this.strafeDir = Math.random() < 0.5 ? 1 : -1;
      }
      if (type === 'spider') {
        this.webCd = U.rand(2, 4);
        this.pounceCd = U.rand(1.5, 3) * (this.trait === 'leap' ? 0.55 : 1);
      }
      if (type === 'golem') this.slamCd = U.rand(1.5, 3);
    }

    get r() {
      const m = this.g.mods;
      return this.baseR * this.scale * m.enemyScale * (m.bigHead ? 1.2 : 1);
    }

    setState(s, t) {
      this.state = s;
      this.t = t || 0;
      this.sub = '';
      if (s === 'attack') this.atkClock = 0;
      if (s !== 'attack') {
        this.hot = false;
      }
    }

    setTele(kind, T, extra) {
      this.tele = Object.assign({ kind, t: T, T }, extra || {});
    }

    applySlow(mul, time) {
      this.slowMul = Math.min(this.slowMul, mul);
      this.slowT = Math.max(this.slowT, time);
    }

    stun(time) {
      if (this.dead || this.state === 'spawn') return;
      this.tele = null;
      this.hot = false;
      this.state = 'stunned';
      this.stunT = Math.max(this.stunT, time);
    }

    knock(dx, dy, force) {
      const res = 1 - this.def.kbRes;
      const k = force * res * this.g.mods.kbMul;
      this.kx += dx * k;
      this.ky += dy * k;
    }

    update(g, dt) {
      if (g.warpT > 0) dt *= 0.42; // TIME WARP
      this.age += dt;
      CH.Actor.fadeHit(this, dt);
      if (this.contactCd > 0) this.contactCd -= dt;
      if (this.atkCd > 0) this.atkCd -= dt;
      if (this.state === 'attack' || (this.state === 'recover' && this.atkClock < this.atkTotal)) this.atkClock += dt;
      if (this.slowT > 0) {
        this.slowT -= dt;
        if (this.slowT <= 0) this.slowMul = 1;
      }
      if (this.tele) {
        this.tele.t -= dt;
        if (this.tele.t < -0.3) this.tele = null;
      }
      this.dvx = 0;
      this.dvy = 0;
      if (this.state === 'spawn') {
        this.t -= dt;
        if (this.t <= 0) this.setState('idle', U.rand(0.2, 0.5));
      } else if (this.state === 'stunned') {
        this.stunT -= dt;
        if (this.stunT <= 0) this.setState('chase');
      } else {
        this.tgt = E.target(g, this);
        AI[this.type](this, g, dt);
      }
      this.integrate(g, dt);
    }

    integrate(g, dt) {
      const m = g.mods;
      const sm = this.slowMul * this.zoneSlow * m.enemySpeed * (this.speedX || 1);
      // crowd steering is a velocity, capped to the enemy's own pace, so a swarm flows around itself instead of vibrating
      const sl = Math.hypot(this.sepx, this.sepy), cap = Math.max(30, (this.speed || 40) * 0.9);
      if (sl > cap) { this.sepx *= cap / sl; this.sepy *= cap / sl; }
      const mx = this.dvx * sm + this.sepx, my = this.dvy * sm + this.sepy;
      this.x += (mx + this.kx) * dt;
      this.y += (my + this.ky) * dt;
      const sk = Math.min(1, dt * 7);
      this.svx += (this.dvx * sm - this.svx) * sk;
      this.svy += (this.dvy * sm - this.svy) * sk;
      // the walk cycle follows how fast the body really moves (a slowed golem does not paddle in place)
      this.walkT = (this.walkT || 0) + dt * U.clamp(Math.hypot(this.svx, this.svy) / Math.max(20, this.def ? this.def.speed : 50), 0.45, 1.6);
      this.sepx = 0;
      this.sepy = 0;
      CH.Actor.decayKnock(this, dt, CH.Actor.KIND.monster.knockDecay, m.lowGrav ? 0.35 : 1);
      this.zoneSlow = 1;
      CH.World.bounceIn(this, g.arena);
      // Prop collisions (at the feet, not the body centre; flyers pass over)
      if (g.arena && g.arena.props && !(this.look && this.look.fly)) CH.World.collideProps(this, 'enemy');
      // facing with hysteresis: a sideways nudge from the crowd does not flip the sprite back and forth
      const ax = Math.abs(this.svx), ay = Math.abs(this.svy);
      if (ax > 12 && Math.sign(this.svx) !== this.face) this.face = this.svx > 0 ? 1 : -1;
      else if (ax < 6 && ay < 6 && this.tgt && Math.abs(this.tgt.x - this.x) > 8) this.face = this.tgt.x > this.x ? 1 : -1;
      // 4-direction packs: the down / up row while moving mostly vertically (with a dead zone between)
      if (ax + ay > 10) {
        if (ay > ax * 1.5) this.vdir = this.svy > 0 ? '_d' : '_u';
        else if (ax > ay * 0.9) this.vdir = '';
      } else if (this.state === 'attack' && this.tgt) {
        const dx = this.tgt.x - this.x, dy = this.tgt.y - this.y;
        this.vdir = Math.abs(dy) > Math.abs(dx) * 1.5 ? (dy > 0 ? '_d' : '_u') : '';
      }
    }

    touchDamage() {
      return this.dmg * (this.hot ? this.hotMul : 1);
    }

    canTouch() {
      return this.contactCd <= 0 && this.state !== 'spawn' && this.state !== 'dead' && !this.dead;
    }
  }
  E.Enemy = Enemy;

  /* decoys steal attention; otherwise the player is the target */
  E.target = function (g, e) {
    let best = null;
    let bd = 170 * 170;
    for (const d of g.decoys) {
      const dd = U.dist2(e.x, e.y, d.x, d.y);
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    if (best) return { x: best.x, y: best.y, isPlayer: false };
    const p = g.nearestPlayer(e.x, e.y) || g.player;
    return { x: p.x, y: p.y, isPlayer: true, p };
  };

  E.create = function (g, type, x, y, o) {
    return new Enemy(g, type, x, y, o);
  };

  /* Crowds. Each enemy keeps a personal space about its sprite's body width (the collision radius is much smaller
     than the art, which is what made swarms pile into one blob). Overlap turns into a steering velocity that
     integrate() applies (capped to the enemy's pace); only a deep overlap is corrected in position, half each way.
     Neighbours are found through a coarse grid, so big swarms stay cheap. */
  const GRID = 40;
  const grid = new Map();
  E.space = function (e) {
    if (e._space === undefined) {
      const L = e.look, S = CH.Sprites;
      const body = L && CH.Art.on && S.has(L.sprite) ? S.get(L.sprite).body : null;
      e._space = body ? Math.max(e.baseR, Math.min(body.w * 0.38, 22)) : e.baseR;
    }
    const m = e.g.mods;
    return e._space * e.scale * m.enemyScale;
  };
  E.separate = function (g) {
    const list = g.enemies;
    grid.clear();
    for (const e of list) {
      if (e.dead) continue;
      const k = Math.floor(e.x / GRID) + ',' + Math.floor(e.y / GRID);
      let c = grid.get(k);
      if (!c) grid.set(k, (c = []));
      c.push(e);
    }
    for (const a of list) {
      if (a.dead || a.isBoss) continue;
      const ax = a.x, ay = a.y;
      const gx = Math.floor(a.x / GRID), gy = Math.floor(a.y / GRID);
      const ra = E.space(a);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const c = grid.get(gx + ox + ',' + (gy + oy));
        if (!c) continue;
        for (const b of c) {
          if (b === a || b.dead) continue;
          const min = ra + E.space(b);
          let dx = a.x - b.x, dy = (a.y - b.y) * 1.35; // a flatter ellipse: bodies overlap less side by side than in depth
          let d2 = dx * dx + dy * dy;
          if (d2 >= min * min) continue;
          let d = Math.sqrt(d2);
          if (d < 0.01) { // exactly stacked: split by id so both do not pick the same way
            const ang = (a.uid * 2.39996) % U.TAU;
            dx = Math.cos(ang); dy = Math.sin(ang); d = 1; d2 = 1;
          }
          const nx = dx / d, ny = dy / d;
          const over = (min - d) / min; // 0..1
          const heavy = b.isBoss ? 3 : b.mass / (a.mass + b.mass) * 2;
          a.sepx += nx * over * 140 * heavy;
          a.sepy += ny * over * 140 * heavy / 1.35;
          if (over > 0.55) { // deep overlap: fix part of it right away
            const fix = (min - d) * 0.25 * heavy;
            a.x += nx * fix;
            a.y += (ny * fix) / 1.35;
          }
        }
      }
      // heroes are solid too: a swarm rings the hero at arm's length instead of piling onto the sprite
      for (const p of g.players) {
        if (p.dead || (p.z || 0) > 6) continue;
        const min = ra + 8;
        const dx = a.x - p.x, dy = (a.y - p.y) * 1.35;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.01;
        const nx = d > 0.01 ? dx / d : Math.cos(a.uid), ny = d > 0.01 ? dy / d : Math.sin(a.uid);
        const push = min - d;
        a.x += nx * push * 0.5;
        a.y += (ny * push * 0.5) / 1.35;
        a.sepx += nx * 60;
        a.sepy += ny * 60;
      }
      // a shove happens after collision ran: keep the monster inside the arena and out of props again (walls are
      // settled after the step)
      if (a.x !== ax || a.y !== ay) {
        CH.World.keepIn(a, a.r, g.arena);
        if (g.arena && g.arena.props && !(a.look && a.look.fly)) CH.World.collideProps(a, 'enemy');
      }
    }
  };

  /* ---------------------------------------------------------------- AI */
  function moveToward(e, tx, ty, mul) {
    const a = Math.atan2(ty - e.y, tx - e.x);
    e.dvx = Math.cos(a) * e.speed * (mul === undefined ? 1 : mul);
    e.dvy = Math.sin(a) * e.speed * (mul === undefined ? 1 : mul);
  }
  function moveDir(e, ang, speed) {
    e.dvx = Math.cos(ang) * speed;
    e.dvy = Math.sin(ang) * speed;
  }
  const angTo = (e) => Math.atan2(e.tgt.y - e.y, e.tgt.x - e.x);
  const distTo = (e) => Math.hypot(e.tgt.x - e.x, e.tgt.y - e.y);
  const pdist = (e, g) => {
    const p = g.nearestPlayer(e.x, e.y) || g.player;
    return Math.hypot(p.x - e.x, p.y - e.y);
  };

  E.moveToward = moveToward;
  E.moveDir = moveDir;

  /* shared windup -> action -> recover helper. wind/act callbacks keep each AI short. */
  function strike(e, dt, o) {
    // o: {wind, act, recover, onWind(e), onAct(e), tick(e,dt)}
    if (e.sub === 'wind') {
      e.t -= dt;
      if (o.windTick) o.windTick(e, dt);
      if (e.t <= 0) {
        e.sub = 'act';
        e.t = o.act;
        e.tele = null;
        if (o.onAct) o.onAct(e);
        CH.Kit.enemyAct(e);
      }
    } else if (e.sub === 'act') {
      e.t -= dt;
      if (o.actTick) o.actTick(e, dt);
      CH.Kit.enemyTick(e, dt, e.hd !== undefined && e.type === 'cart' ? e.hd : e.lockAng);
      if (e.t <= 0) {
        e.hot = false;
        e.setState('recover', o.recover);
        if (o.onDone) o.onDone(e);
      }
    }
  }
  /* e.atkKind keeps which attack this is for its whole length: the telegraph (e.tele) is cleared when the wind-up ends */
  function beginAttack(e, wind, teleKind, extra, act) {
    e.setState('attack', wind);
    e.atkWind = wind;
    e.atkKind = teleKind;
    if (e.look && e.look.atk && !e.isBoss) Audio.sfx(e.look.atk);
    if (!e.isBoss) CH.Kit.enemyWind(e);
    e.atkTotal = wind + Math.max(act || 0.3, 0.35);
    e.sub = 'wind';
    e.setTele(teleKind, wind, extra);
  }
  function recover(e, dt) {
    e.t -= dt;
    if (e.t <= 0) e.setState('chase');
  }
  function idleToChase(e, dt) {
    e.t -= dt;
    if (e.t <= 0) e.setState('chase');
  }

  const AI = {
    chicken(e, g, dt) {
      switch (e.state) {
        case 'idle':
          return idleToChase(e, dt);
        case 'chase':
          moveToward(e, e.tgt.x, e.tgt.y, 1);
          if (e.tgt.isPlayer && distTo(e) < 26 && e.atkCd <= 0) {
            e.lockAng = angTo(e);
            beginAttack(e, 0.28, 'shake', null, 0.2);
          }
          break;
        case 'attack':
          strike(e, dt, {
            act: 0.2,
            recover: 0.55,
            onAct: (e) => {
              e.hot = true;
            },
            actTick: (e) => moveDir(e, e.lockAng, 250),
            onDone: (e) => (e.atkCd = 0.8),
          });
          break;
        case 'recover':
          recover(e, dt);
          break;
      }
    },

    potato(e, g, dt) {
      switch (e.state) {
        case 'idle':
          return idleToChase(e, dt);
        case 'chase': {
          e.chargeCd -= dt;
          const a = angTo(e) + Math.sin(e.age * 3.5 + e.phase) * 0.9;
          moveDir(e, a, e.speed);
          if (e.chargeCd <= 0 && e.tgt.isPlayer && distTo(e) < 210) beginAttack(e, 0.45, 'excl', null, e.def.chargeTime);
          break;
        }
        case 'attack':
          if (e.sub === 'wind') e.lockAng = angTo(e);
          strike(e, dt, {
            act: e.def.chargeTime,
            recover: 0.55,
            onAct: (e) => (e.hot = true),
            actTick: (e) => moveDir(e, e.lockAng, e.def.chargeSpeed),
            onDone: (e) => (e.chargeCd = U.rand(3, 5)),
          });
          break;
        case 'recover':
          recover(e, dt);
          break;
      }
    },

    trashcan(e, g, dt) {
      switch (e.state) {
        case 'idle':
          return idleToChase(e, dt);
        case 'chase':
          moveToward(e, e.tgt.x, e.tgt.y, 1);
          if (e.tgt.isPlayer && distTo(e) < e.def.slamRadius * 0.85 + e.r && e.atkCd <= 0) beginAttack(e, 0.7, 'circle', { r: e.def.slamRadius }, 0.4);
          break;
        case 'attack':
          strike(e, dt, {
            act: 0.12,
            recover: 1.0,
            onAct: (e) => {
              const R = e.def.slamRadius;
              Audio.sfx('slam');
              g.shake(3, 0.18);
              FX.ring(e.x, e.y + 6, 4, R, '#e8d4a8', 0.3);
              FX.dust(e.x, e.y + 8, 8);
              g.hurtPlayers(g.edmg(e.def.slamDmg) * (e.isElite ? B.eliteDmg : 1), e, { kx: 1 }, (q) => Math.hypot(q.x - e.x, q.y - e.y) < R + q.r);
            },
            onDone: (e) => (e.atkCd = 1.2),
          });
          break;
        case 'recover':
          recover(e, dt);
          break;
      }
    },

    office(e, g, dt) {
      const d = distTo(e);
      e.shotCd -= dt;
      e.insultT -= dt;
      if (e.insultT <= 0) {
        e.insultT = U.rand(6, 11);
        if (pdist(e, g) < 260 && e.state !== 'spawn') FX.speech(e, U.pick(INSULTS), 2.2);
      }
      switch (e.state) {
        case 'idle':
          return idleToChase(e, dt);
        case 'chase': {
          const a = angTo(e);
          if (d > 135) moveDir(e, a, e.speed);
          else if (d < 85) moveDir(e, a + Math.PI, e.speed * 0.9);
          else moveDir(e, a + Math.PI / 2 * e.orbDir, e.speed * 0.45);
          if (e.shotCd <= 0 && e.tgt.isPlayer && d < 270) beginAttack(e, 0.38, 'excl', null, 0.4);
          break;
        }
        case 'attack':
          strike(e, dt, {
            act: 0.05,
            recover: 0.45,
            onAct: (e) => {
              const a = angTo(e);
              const arrow = CH.Art.on && CH.Sprites.has('fx.arrow1');
              g.spawnProjectile({ owner: 'e', kind: 'paper', x: e.x, y: e.y - 4, ang: a, speed: e.def.shotSpeed, r: 3, dmg: g.edmg(e.def.shotDmg), life: 3, sprite: arrow ? 'fx.arrow1' : 'paper', spin: arrow ? 0 : 9, face: arrow, color: '#ffffff', fx: 'phys', muzzle: false });
              Audio.sfx(arrow ? 'arrow' : 'hover');
            },
            onDone: (e) => (e.shotCd = e.def.shotCd * U.rand(0.8, 1.25)),
          });
          break;
        case 'recover':
          recover(e, dt);
          break;
      }
    },

    toaster(e, g, dt) {
      switch (e.state) {
        case 'idle':
          return idleToChase(e, dt);
        case 'chase': {
          e.chargeCd -= dt;
          e.hazT -= dt;
          const a = angTo(e) + Math.sin(e.age * 4 + e.phase) * 0.55;
          moveDir(e, a, e.speed);
          if (e.hazT <= 0) {
            e.hazT = 0.55;
            if (g.countZones('toast') < 45) g.addZone({ kind: 'toast', x: e.x, y: e.y + 4, r: 9, life: 3.2, dmgP: g.edmg(e.def.hazardDmg), tick: 0.5 });
          }
          if (e.chargeCd <= 0 && e.tgt.isPlayer && distTo(e) < 200) beginAttack(e, 0.4, 'excl', null, 0.45);
          break;
        }
        case 'attack':
          if (e.sub === 'wind') e.lockAng = angTo(e);
          strike(e, dt, {
            act: 0.45,
            recover: 0.5,
            onAct: (e) => (e.hot = true),
            actTick: (e, dt) => {
              moveDir(e, e.lockAng, 270);
              e.hazT -= dt;
              if (e.hazT <= 0) {
                e.hazT = 0.12;
                if (g.countZones('toast') < 45) g.addZone({ kind: 'toast', x: e.x, y: e.y + 4, r: 8, life: 2.5, dmgP: g.edmg(e.def.hazardDmg), tick: 0.5 });
              }
            },
            onDone: (e) => (e.chargeCd = U.rand(4, 7)),
          });
          break;
        case 'recover':
          recover(e, dt);
          break;
      }
    },

    influencer(e, g, dt) {
      const d = distTo(e);
      e.flashCd -= dt;
      switch (e.state) {
        case 'idle':
          return idleToChase(e, dt);
        case 'chase': {
          const a = angTo(e);
          if (d > 112) moveDir(e, a, e.speed);
          else if (d < 80) moveDir(e, a + Math.PI, e.speed);
          else moveDir(e, a + Math.PI / 2 * e.orbDir, e.speed * 0.5);
          if (e.flashCd <= 0 && e.tgt.isPlayer && d < e.def.flashRange - 10) beginAttack(e, 0.75, 'ring', { r: e.def.flashRange }, 0.4);
          break;
        }
        case 'attack':
          strike(e, dt, {
            act: 0.1,
            recover: 0.8,
            onAct: (e) => {
              Audio.sfx('flash');
              FX.ring(e.x, e.y - 4, 4, e.def.flashRange, '#ffffff', 0.25);
              FX.burst(e.x, e.y - 6, { n: 16, colors: ['#ffffff', '#fee761', '#ff8fb8'], speed: 120, life: 0.4 });
              for (const q of g.players) {
                if (q.dead || Math.hypot(q.x - e.x, q.y - e.y) >= e.def.flashRange) continue;
                g.hurtPlayer(g.edmg(e.def.flashDmg), e, { distract: 1.4, p: q });
                FX.text(q.x, q.y - 18, '+10K FOLLOWERS', '#ff8fb8', 1);
              }
            },
            onDone: (e) => (e.flashCd = 4.5 + U.rand(0, 1.5)),
          });
          break;
        case 'recover':
          recover(e, dt);
          break;
      }
    },

    cart(e, g, dt) {
      switch (e.state) {
        case 'idle':
          e.hd = angTo(e);
          return idleToChase(e, dt);
        case 'chase': {
          e.hd = U.turnToward(e.hd, angTo(e), 1.4 * dt);
          moveDir(e, e.hd, e.speed);
          const aligned = Math.abs(U.angDiff(e.hd, angTo(e))) < 0.6;
          if (e.tgt.isPlayer && e.atkCd <= 0 && aligned && distTo(e) < 200 && distTo(e) > 50) beginAttack(e, 0.75, 'line', { len: 170 }, 1.1);
          break;
        }
        case 'attack':
          if (e.sub === 'wind') {
            e.hd = angTo(e);
            e.tele.ang = e.hd;
          }
          strike(e, dt, {
            act: 1.1,
            recover: 0.9,
            onAct: (e) => (e.hot = true),
            actTick: (e, dt) => {
              e.hd = U.turnToward(e.hd, angTo(e), 0.5 * dt);
              moveDir(e, e.hd, e.def.chargeSpeed);
              if (e.wallHit) {
                // crash into the wall: struggles, stunned
                Audio.sfx('slam');
                g.shake(2, 0.12);
                FX.burst(e.x, e.y, { n: 10, colors: 'junk', speed: 100, life: 0.5 });
                CH.Kit.impact('earth', e.x, e.y + 2, 24);
                CH.Kit.hit('phys', e.x, e.y - 8, 16, true);
                e.hot = false;
                e.stun(1.2);
              }
            },
            onDone: (e) => (e.atkCd = 2.2),
          });
          break;
        case 'recover':
          e.t -= dt;
          e.hd = U.turnToward(e.hd, angTo(e), 1.0 * dt);
          if (e.t <= 0) e.setState('chase');
          break;
      }
    },

    pigeon(e, g, dt) {
      switch (e.state) {
        case 'idle':
          return idleToChase(e, dt);
        case 'chase': {
          e.diveCd -= dt;
          e.orb += e.orbDir * 1.1 * dt;
          const tx = e.tgt.x + Math.cos(e.orb) * e.orbR;
          const ty = e.tgt.y + Math.sin(e.orb) * e.orbR;
          const d = Math.hypot(tx - e.x, ty - e.y);
          if (d > 4) moveToward(e, tx, ty, Math.min(1.3, d / 40 + 0.3));
          e.face = e.tgt.x >= e.x ? 1 : -1;
          if (e.diveCd <= 0 && e.tgt.isPlayer) beginAttack(e, 0.4, 'excl', null, 0.55);
          break;
        }
        case 'attack':
          if (e.sub === 'wind') e.lockAng = angTo(e);
          strike(e, dt, {
            act: 0.55,
            recover: 0.7,
            onAct: (e) => {
              e.hot = true;
            },
            actTick: (e) => moveDir(e, e.lockAng, e.def.diveSpeed),
            onDone: (e) => {
              e.diveCd = U.rand(2.5, 4);
              e.orb = Math.atan2(e.y - e.tgt.y, e.x - e.tgt.x);
            },
          });
          break;
        case 'recover':
          moveDir(e, e.lockAng + Math.PI * 0.8, e.speed * 0.6);
          recover(e, dt);
          break;
      }
    },

    fridge(e, g, dt) {
      const d = distTo(e);
      e.shotCd -= dt;
      switch (e.state) {
        case 'idle':
          return idleToChase(e, dt);
        case 'chase':
          if (d > 150) moveToward(e, e.tgt.x, e.tgt.y, 1);
          else if (d < 90) moveToward(e, e.tgt.x, e.tgt.y, -0.5);
          if (e.shotCd <= 0 && e.tgt.isPlayer && d < 240) beginAttack(e, 0.8, 'excl', null, 0.4);
          break;
        case 'attack':
          strike(e, dt, {
            act: 0.08,
            recover: 1.1,
            onAct: (e) => {
              const a = angTo(e);
              Audio.sfx('fireball');
              for (let i = -1; i <= 1; i++) {
                const fire = CH.Art.on && CH.Sprites.has('vfx.p5.16');
                g.spawnProjectile({ owner: 'e', kind: 'ice', x: e.x, y: e.y - 4, ang: a + i * 0.26, speed: e.def.shotSpeed, r: 3, dmg: g.edmg(e.def.shotDmg) * (e.isElite ? B.eliteDmg : 1), life: 3.2, sprite: fire ? 'vfx.p5.16' : 'ice_shard', animFps: fire ? 16 : 0, animFrom: 2, scale: 0.7, color: fire ? '#feae34' : '#3ccbe6', slow: { mul: 0.55, t: 1.6 }, face: true, fx: 'fire', muzzle: false });
              }
              FX.burst(e.x, e.y - 4, { n: 8, colors: 'fire', speed: 70, life: 0.4, angle: a, spread: 0.5 });
            },
            onDone: (e) => (e.shotCd = 3 + U.rand(0, 0.8)),
          });
          break;
        case 'recover':
          recover(e, dt);
          break;
      }
    },

    intern(e, g, dt) {
      e.insultT -= dt;
      if (e.insultT <= 0) {
        e.insultT = U.rand(9, 18);
        if (pdist(e, g) < 220 && Math.random() < 0.5) FX.speech(e, U.pick(INTERN_LINES), 1.6);
      }
      switch (e.state) {
        case 'idle':
          return idleToChase(e, dt);
        case 'chase': {
          const a = angTo(e) + Math.sin(e.age * 5 + e.phase) * 0.35;
          moveDir(e, a, e.speed);
          break;
        }
        default:
          e.setState('chase');
      }
    },

    plant(e, g, dt) {
      const d = distTo(e);
      e.spitCd = (e.spitCd || 0) - dt;
      switch (e.state) {
        case 'idle':
          return idleToChase(e, dt);
        case 'chase':
          if (d > 40) moveToward(e, e.tgt.x, e.tgt.y, 1);
          else moveToward(e, e.tgt.x, e.tgt.y, 0.3);
          if (e.tgt.isPlayer && d <= 36 && e.atkCd <= 0) {
            e.lockAng = angTo(e);
            beginAttack(e, 0.32, 'shake', null, 0.22);
          } else if (e.tgt.isPlayer && e.spitCd <= 0 && d >= 50 && d < 220) {
            e.lockAng = angTo(e);
            beginAttack(e, 0.4, 'excl', null, 0.25);
          }
          break;
        case 'attack':
          if (e.atkKind === 'excl') {
            // Spore spit attack
            strike(e, dt, {
              act: 0.1,
              recover: 0.7,
              onAct: (e) => {
                const a = e.lockAng || angTo(e);
                Audio.sfx('cre_wet');
                for (const off of e.trait === 'triple' ? [-0.24, 0, 0.24] : [0]) {
                  g.spawnProjectile({
                    owner: 'e', kind: 'ice', x: e.x, y: e.y - 6, ang: a + off, speed: e.def.spitSpeed || 105,
                    r: 4, dmg: g.edmg(e.def.spitDmg || 8) * (e.isElite ? B.eliteDmg : 1) * (e.variant ? 1.1 : 1), life: 2.2,
                    sprite: 'vfx.p5.23', animFps: 16, scale: 0.65, color: '#68c142',
                    slow: { mul: 0.6, t: 1.5 }, face: true, fx: 'toxic', muzzle: false
                  });
                }
                FX.burst(e.x, e.y - 4, { n: 6, colors: ['#68c142', '#32661d'], speed: 60, life: 0.3 });
              },
              onDone: (e) => (e.spitCd = U.rand(2.2, 3.2) * (e.trait === 'rapid' ? 0.6 : 1)),
            });
          } else {
            // Melee bite attack
            strike(e, dt, {
              act: 0.18,
              recover: 0.5,
              onAct: (e) => {
                e.hot = true;
                Audio.sfx('cre_wet');
                CH.Kit.slash('toxic', e.x, e.y - 4, e.lockAng || 0, 24);
                g.hurtPlayers(g.edmg(e.def.dmg * 1.3) * (e.isElite ? B.eliteDmg : 1), e, { kx: 1 }, (q) => Math.hypot(q.x - e.x, q.y - e.y) < 32 + q.r);
              },
              actTick: (e) => moveDir(e, e.lockAng, 80),
              onDone: (e) => (e.atkCd = U.rand(1.0, 1.6)),
            });
          }
          break;
        case 'recover':
          recover(e, dt);
          break;
      }
    },

    slime(e, g, dt) {
      e.hopT = (e.hopT || 0) + dt;
      e.puddleCd = (e.puddleCd || 0) - dt;
      const d = distTo(e);
      switch (e.state) {
        case 'idle':
          return idleToChase(e, dt);
        case 'chase': {
          const hop = Math.sin(e.hopT * 10);
          const spd = hop > 0.1 ? 1.4 : 0.3;
          moveToward(e, e.tgt.x, e.tgt.y, spd);
          if (e.puddleCd <= 0 && hop > 0.5) {
            e.puddleCd = 0.45;
            g.addZone({ kind: 'toxic', shape: 'circle', x: e.x, y: e.y + 4, r: 12, life: 1.8, dmgP: g.edmg(e.def.puddleDmg || 3), slow: e.trait === 'slow' ? 0.5 : 0.65, color: e.variant === 1 ? '#8a5ad0' : e.variant === 2 ? '#f77622' : e.variant === 3 ? '#9fd8ef' : e.variant === 5 ? '#e43b44' : '#38b764' });
          }
          if (e.tgt.isPlayer && d < 32 && e.atkCd <= 0) {
            e.lockAng = angTo(e);
            beginAttack(e, 0.22, 'shake', null, 0.2);
          }
          break;
        }
        case 'attack':
          strike(e, dt, {
            act: 0.2,
            recover: 0.4,
            onAct: (e) => {
              e.hot = true;
              Audio.sfx('cre_wet');
              CH.Kit.impact('toxic', e.x, e.y + 2, 18);
            },
            actTick: (e) => moveDir(e, e.lockAng, 150),
            onDone: (e) => (e.atkCd = U.rand(0.8, 1.4)),
          });
          break;
        case 'recover':
          recover(e, dt);
          break;
      }
    },

    orc(e, g, dt) {
      const d = distTo(e);
      e.rageCd = (e.rageCd || 0) - dt;
      switch (e.state) {
        case 'idle':
          return idleToChase(e, dt);
        case 'chase':
          moveToward(e, e.tgt.x, e.tgt.y, 1);
          if (e.tgt.isPlayer && d < 36 && e.atkCd <= 0) {
            e.lockAng = angTo(e);
            beginAttack(e, 0.42, 'circle', { r: 38 }, 0.22);
          } else if (e.tgt.isPlayer && d > 140 && e.rageCd <= 0) {
            e.lockAng = angTo(e);
            beginAttack(e, 0.45, 'excl', null, 0.65);
          }
          break;
        case 'attack':
          if (e.atkKind === 'excl') {
            strike(e, dt, {
              act: 0.65,
              recover: 0.6,
              onAct: (e) => {
                e.hot = true;
                Audio.sfx('cre_growl');
              },
              actTick: (e) => moveDir(e, e.lockAng, 165),
              onDone: (e) => (e.rageCd = U.rand(4, 6) * (e.trait === 'rage' ? 0.6 : 1)),
            });
          } else {
            strike(e, dt, {
              act: 0.16,
              recover: 0.75,
              onAct: (e) => {
                Audio.sfx('slam');
                CH.Kit.slash('phys', e.x, e.y - 6, e.lockAng || 0, 36);
                g.shake(2, 0.15);
                g.hurtPlayers(g.edmg(e.def.cleaveDmg || 13) * (e.isElite ? B.eliteDmg : 1), e, { kx: 1 }, (q) => Math.hypot(q.x - e.x, q.y - e.y) < 38 + q.r);
              },
              onDone: (e) => (e.atkCd = U.rand(1.2, 1.8)),
            });
          }
          break;
        case 'recover':
          recover(e, dt);
          break;
      }
    },

    goblin(e, g, dt) {
      const d = distTo(e);
      e.spearCd = (e.spearCd || 0) - dt;
      switch (e.state) {
        case 'idle':
          return idleToChase(e, dt);
        case 'chase': {
          if (d < 70) {
            moveToward(e, e.tgt.x, e.tgt.y, -1);
          } else if (d > 160) {
            moveToward(e, e.tgt.x, e.tgt.y, 1);
          } else {
            const a = angTo(e) + (Math.PI / 2) * (e.strafeDir || 1);
            moveDir(e, a, e.speed);
            if (Math.random() < 0.02) e.strafeDir = -(e.strafeDir || 1);
          }
          if (e.tgt.isPlayer && e.spearCd <= 0 && d >= 60 && d < 220) {
            e.lockAng = angTo(e);
            beginAttack(e, 0.32, 'excl', null, 0.18);
          }
          break;
        }
        case 'attack':
          strike(e, dt, {
            act: 0.1,
            recover: 0.6,
            onAct: (e) => {
              const a = e.lockAng || angTo(e);
              Audio.sfx('shoot_junk');
              for (const off of e.trait === 'triple' ? [-0.22, 0, 0.22] : [0]) {
                g.spawnProjectile({
                  owner: 'e', kind: 'bullet', x: e.x, y: e.y - 4, ang: a + off, speed: e.def.spearSpeed || 120,
                  r: 3, dmg: g.edmg(e.def.spearDmg || 6) * (e.isElite ? B.eliteDmg : 1) * (e.variant ? 1.1 : 1), life: 2.2,
                  sprite: 'fx.arrow1', animFps: 0, scale: 0.65, color: '#e8d4a8', face: true, fx: 'phys'
                });
              }
              FX.burst(e.x, e.y - 4, { n: 4, colors: ['#fee761', '#e8d4a8'], speed: 50, life: 0.25 });
            },
            onDone: (e) => (e.spearCd = U.rand(1.8, 2.8) * (e.trait === 'rapid' ? 0.6 : 1)),
          });
          break;
        case 'recover':
          recover(e, dt);
          break;
      }
    },

    golem(e, g, dt) {
      const d = distTo(e);
      e.slamCd = (e.slamCd || 0) - dt;
      switch (e.state) {
        case 'idle':
          return idleToChase(e, dt);
        case 'chase':
          moveToward(e, e.tgt.x, e.tgt.y, 1);
          if (e.tgt.isPlayer && d < 46 && e.slamCd <= 0) {
            e.lockAng = angTo(e);
            beginAttack(e, 0.6, 'circle', { r: e.trait === 'quake' ? 56 : 46 }, 0.3);
          }
          break;
        case 'attack': {
          const R = e.trait === 'quake' ? 56 : 46;
          strike(e, dt, {
            act: 0.25,
            recover: 0.9,
            onAct: (e) => {
              Audio.sfx('slam');
              g.shake(e.trait === 'quake' ? 5 : 3, 0.25);
              CH.Kit.impact('earth', e.x, e.y + 2, R * 0.6);
              g.hurtPlayers(g.edmg(e.def.slamDmg || 15) * (e.isElite ? B.eliteDmg : 1) * (e.variant ? 1.15 : 1), e, { kx: 1 }, (q) => Math.hypot(q.x - e.x, q.y - e.y) < R + q.r);
              if (e.trait === 'shards') {
                for (let i = 0; i < 8; i++) {
                  g.spawnProjectile({ owner: 'e', kind: 'bullet', x: e.x, y: e.y - 6, ang: (i / 8) * U.TAU, speed: 95, r: 3, dmg: g.edmg(6), life: 1.6, sprite: 'fx.mageIce', animFps: 0, scale: 0.5, color: '#c58bf0', fx: 'ice' });
                }
              }
            },
            onDone: (e) => (e.slamCd = U.rand(1.6, 2.6)),
          });
          break;
        }
        case 'recover':
          recover(e, dt);
          break;
      }
    },

    spider(e, g, dt) {
      const d = distTo(e);
      e.webCd = (e.webCd || 0) - dt;
      e.pounceCd = (e.pounceCd || 0) - dt;
      switch (e.state) {
        case 'idle':
          return idleToChase(e, dt);
        case 'chase':
          moveToward(e, e.tgt.x, e.tgt.y, 1);
          if (e.tgt.isPlayer && d < 28 && e.atkCd <= 0) {
            e.lockAng = angTo(e);
            beginAttack(e, 0.22, 'shake', null, 0.18);
          } else if (e.tgt.isPlayer && e.pounceCd <= 0 && d >= 45 && d <= 125) {
            e.lockAng = angTo(e);
            beginAttack(e, 0.3, 'shake', null, 0.26);
          } else if (e.tgt.isPlayer && e.webCd <= 0 && d >= 70 && d < 190) {
            e.lockAng = angTo(e);
            beginAttack(e, 0.35, 'excl', null, 0.2);
          }
          break;
        case 'attack':
          if (e.atkKind === 'excl') {
            strike(e, dt, {
              act: 0.1,
              recover: 0.55,
              onAct: (e) => {
                const a = e.lockAng || angTo(e);
                Audio.sfx('cre_hiss');
                g.spawnProjectile({
                  owner: 'e', kind: 'ice', x: e.x, y: e.y - 4, ang: a, speed: 115,
                  r: 5, dmg: g.edmg(e.def.webDmg || 4) * (e.isElite ? B.eliteDmg : 1), life: 2.2,
                  sprite: 'vfx.p5.23', animFps: 14, scale: 0.7, color: '#e0e0e0',
                  slow: { mul: 0.45, t: 2.5 }, fx: 'toxic'
                });
              },
              onDone: (e) => (e.webCd = U.rand(3.2, 5.0)),
            });
          } else {
            const isLeap = e.pounceCd <= 0;
            strike(e, dt, {
              act: isLeap ? 0.26 : 0.18,
              recover: 0.45,
              onAct: (e) => {
                e.hot = true;
                Audio.sfx('cre_hiss');
                CH.Kit.slash('toxic', e.x, e.y - 4, e.lockAng || 0, isLeap ? 28 : 20);
              },
              actTick: (e) => moveDir(e, e.lockAng, isLeap ? 210 : 80),
              onDone: (e) => {
                if (isLeap) e.pounceCd = U.rand(2.2, 4.0) * (e.trait === 'leap' ? 0.55 : 1);
                else e.atkCd = U.rand(0.7, 1.2);
              },
            });
          }
          break;
        case 'recover':
          recover(e, dt);
          break;
      }
    },
  };
  E.AI = AI;

  /* ---------------------------------------------------------------- rendering */
  /* a contact shadow: a stepped ellipse, darker at the core, so a body clearly stands on the ground */
  function shadow(ctx, x, y, w) {
    w = Math.max(8, w + 6);
    const h = Math.max(3, Math.round(w * 0.3));
    const cx = Math.round(x), cy = Math.round(y);
    for (let layer = 0; layer < 2; layer++) {
      const k = layer ? 0.62 : 1;
      ctx.fillStyle = layer ? 'rgba(10,5,20,0.28)' : 'rgba(10,5,20,0.3)';
      const rh = Math.max(1, Math.round((h / 2) * k));
      for (let j = -rh; j <= rh; j++) {
        const half = Math.round((w / 2) * k * Math.sqrt(1 - (j * j) / ((rh + 0.5) * (rh + 0.5))));
        ctx.fillRect(cx - half, cy + j, half * 2, 1);
      }
    }
  }
  E.shadow = shadow;

  /* index of the frame to show for an enemy right now */
  E.frameFor = function (e) {
    const L = e.look;
    const S = CH.Sprites;
    const moving = Math.abs(e.svx) + Math.abs(e.svy) > 8 || Math.abs(e.dvx) + Math.abs(e.dvy) > 8;
    if (CH.Art.on && S.has(L.sprite)) {
      const n = L.sprite;
      const an = S.get(n).anims;
      const dir = (base) => (e.vdir && an[base + e.vdir] ? base + e.vdir : base);
      e.drawRow = '';
      const use = (base) => { const k = dir(base); if (k !== base) e.drawRow = e.vdir; return k; };
      if (e.state === 'stunned') return S.frameAt(n, use('hurt'), 0.99);
      if (e.hurtT > 0) return S.frameAt(n, use('hurt'), 1 - e.hurtT / 0.28);
      if (e.state === 'attack' || (e.state === 'recover' && e.atkClock < e.atkTotal)) {
        // anticipation frames play during the wind-up, the strike frames during the action
        const wind = e.atkWind || 0.3;
        const k = e.atkClock < wind ? 0.4 * (e.atkClock / wind) : 0.4 + 0.6 * Math.min(1, (e.atkClock - wind) / Math.max(0.05, e.atkTotal - wind));
        return S.frameAt(n, use('attack'), k);
      }
      if (e.asleep && an.sleep) return S.frameAt(n, 'sleep', 0.99);
      return moving ? S.frame(n, use('walk'), e.walkT || e.age) : S.frame(n, use('idle'), e.age);
    }
    switch (L.anim) {
      case 'walk3':
        return moving ? 1 + (Math.floor(e.age * 7) % 2) : 0;
      case 'flap':
        return Math.floor(e.age * 10) % 2;
      case 'two':
        return moving ? Math.floor(e.age * 8) % 2 : 0;
      case 'tele':
        return e.tele && e.tele.t > 0 ? 1 : 0;
    }
    return 0;
  };

  /* ground-level warnings (drawn under entities) */
  E.drawGround = function (ctx, e, cam) {
    const t = e.tele;
    if (!t || t.t < 0) return;
    const x = e.x - cam.x;
    const y = e.y - cam.y;
    const prog = 1 - t.t / t.T;
    if (t.kind === 'circle') {
      ctx.globalAlpha = 0.18 + prog * 0.25;
      FX.circleFill(ctx, x, y + 4, t.r * (0.4 + 0.6 * prog), '#e43b44');
      ctx.globalAlpha = 1;
      FX.circleOutline(ctx, x, y + 4, t.r, Math.floor(e.age * 14) % 2 ? '#ffffff' : '#e43b44');
    } else if (t.kind === 'line') {
      const a = t.ang !== undefined ? t.ang : e.hd;
      ctx.fillStyle = Math.floor(e.age * 16) % 2 ? '#ffffff' : '#e43b44';
      for (let d = 10; d < t.len; d += 4) ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 2, 2);
    } else if (t.kind === 'ring') {
      ctx.globalAlpha = 0.5;
      FX.circleOutline(ctx, x, y - 4, t.r * prog, '#ff8fb8');
      ctx.globalAlpha = 0.25;
      FX.circleOutline(ctx, x, y - 4, t.r, '#ffffff');
      ctx.globalAlpha = 1;
    }
  };

  E.draw = function (ctx, e, cam) {
    const L = e.look;
    const x = e.x - cam.x;
    const y = e.y - cam.y;
    if (x < -60 || y < -70 || x > B.view.w + 60 || y > B.view.h + 70) return;
    const g = e.g;
    const sc = e.scale * g.mods.enemyScale;
    const art = CH.Art.on && CH.Sprites.has(L.sprite);
    const spawnK = e.state === 'spawn' ? 1 - e.t / 0.5 : 1;
    const hover = L.fly ? L.fly + Math.sin(e.age * 5 + e.phase) * 1.5 + (g.mods.lowGrav ? Math.sin(e.age * 2) * 3 : 0) : 0;
    let bob = 0;
    if (!L.fly && Math.abs(e.dvx) + Math.abs(e.dvy) > 8 && !art) bob = -Math.abs(Math.sin(e.age * 9)) * 1.2;
    const gy = L.foot * sc;
    shadow(ctx, x, y + gy, Math.round(L.shadow * sc * (L.fly ? 0.75 : 1)));
    let dx = 0;
    let dy = 0;
    if (e.tele && e.tele.kind === 'shake' && e.tele.t > 0) {
      dx = Math.round(U.rand(-1, 1));
      dy = Math.round(U.rand(-1, 1));
    }
    const sq = Math.max(0, e.squash);
    const frame = E.frameFor(e);
    const flip = art ? (e.drawRow ? false : e.face < 0) : L.faceRight ? e.face < 0 : false;
    const flash = e.state === 'stunned' ? 0.35 + 0.35 * Math.sin(e.age * 30) : e.flash;
    const big = g.mods.bigHead;
    const opts = {
      frame,
      flip,
      sx: sc * (1 + sq * 0.2) * (art && big ? 1.3 : 1),
      sy: sc * (1 - sq * 0.2) * (art && big ? 1.3 : 1),
      flash: Math.max(0, flash),
      alpha: spawnK < 1 ? 0.3 + spawnK * 0.7 : 1,
      gold: e.isElite ? (Math.floor(e.age * 6) % 2 ? '#fee761' : '#feae34') : null,
      bigHead: !art && big ? 1.6 : 0,
    };
    if (e.slowT > 0) {
      opts.tint = '#3ccbe6';
      opts.tintA = 0.4;
    } else if (e.hot) {
      opts.tint = '#e43b44';
      opts.tintA = 0.25;
    }
    CH.Sprites.draw(ctx, L.sprite, x + dx, y + gy - hover + bob + dy, opts);
    if (e.state === 'spawn') {
      // glitchy materialise effect
      ctx.globalAlpha = 0.6 * (1 - spawnK);
      ctx.fillStyle = '#00ffd0';
      const hh = Math.round(L.h * sc);
      for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(x - 6 + U.rand(-4, 4)), Math.round(y - hh / 2 + i * (hh / 4)), 12, 1);
      ctx.globalAlpha = 1;
    }
    const top = y + gy - L.h * sc - hover;
    // exclamation telegraph
    if (e.tele && e.tele.kind === 'excl' && e.tele.t > 0 && Math.floor(e.age * 16) % 2 === 0) {
      const ty = top - 8;
      ctx.fillStyle = '#1b1226';
      ctx.fillRect(Math.round(x - 2), Math.round(ty - 1), 4, 9);
      ctx.fillStyle = '#e43b44';
      ctx.fillRect(Math.round(x - 1), Math.round(ty), 2, 5);
      ctx.fillRect(Math.round(x - 1), Math.round(ty + 6), 2, 2);
    }
    // crown + hp bar for elites and big units
    if (e.isElite) {
      ctx.fillStyle = '#fee761';
      const cy = Math.round(top - 3);
      ctx.fillRect(Math.round(x - 3), cy, 7, 3);
      ctx.fillRect(Math.round(x - 3), cy - 2, 1, 2);
      ctx.fillRect(Math.round(x), cy - 3, 1, 3);
      ctx.fillRect(Math.round(x + 3), cy - 2, 1, 2);
    }
    if ((e.isElite || e.maxHp >= 60) && e.hp < e.maxHp) {
      const w = 16;
      const by = Math.round(top - (e.isElite ? 8 : 3));
      ctx.fillStyle = '#1b1226';
      ctx.fillRect(Math.round(x - w / 2 - 1), by - 1, w + 2, 4);
      ctx.fillStyle = '#a22633';
      ctx.fillRect(Math.round(x - w / 2), by, w, 2);
      ctx.fillStyle = e.isElite ? '#fee761' : '#e43b44';
      ctx.fillRect(Math.round(x - w / 2), by, Math.max(1, Math.round((w * e.hp) / e.maxHp)), 2);
    }
  };
})(window.CH);
