/* CHAOS.exe - hives and portals (PLAN.md section 8): Gauntlet-style spawners placed by the level generator.
   A spawner is a special enemy ('spawner': it never moves or attacks), so every weapon, explosion and AoE already hurts
   it. It has three levels: damage lowers its level, and a lower level spawns weaker monsters more slowly. It only spawns
   while a hero is nearby, with a per-hive cap, and a threat clock speeds up hives that are left open too long.
   Closing every breach (all but one on big stages) breaks the seal on the exit (see run.js). */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const G = CH.G;
  const X = CH.X;
  const E = CH.Enemies;
  const Audio = CH.Audio;
  const wrap = X.wrap;

  const Sp = (CH.Spawners = { list: [] });

  B.enemies.spawner = { name: 'Breach', hp: 240, speed: 0, dmg: 0, r: 15, xp: 40, coin: 0, score: 250, kbRes: 1 };
  E.look.spawner = { sprite: 'slime', foot: 6, h: 30, faceRight: true, anim: 'two', shadow: 26, fx: 'bone', atk: null, die: 'die_rock' };
  E.ids = E.ids || [];

  /* hive colours and the monsters each biome breeds, weakest first (level 1 uses the first entries) */
  const KIND = {
    hive: { c1: '#7a4a24', c2: '#d1a964', glow: '#feae34' },
    portal: { c1: '#3a1c6a', c2: '#b55088', glow: '#ff2bd6' },
    grave: { c1: '#3a3a44', c2: '#a6b0bf', glow: '#63c74d' },
    gate: { c1: '#4a1408', c2: '#ff5a1a', glow: '#feae34' },
    camp: { c1: '#5a3a22', c2: '#a8602c', glow: '#e43b44' },
    rift: { c1: '#2f4a6a', c2: '#9fd8ef', glow: '#3ccbe6' },
  };

  const players = () => G.players.filter((p) => !p.dead);
  const nearestDist = (e) => {
    let d = 1e9;
    for (const p of players()) d = Math.min(d, U.dist(p.x, p.y, e.x, e.y));
    return d;
  };

  /* make the spawner enemy for a generator hive spot */
  Sp.create = function (def, stage) {
    const hpBase = 240 * (1 + 0.16 * (stage - 1)) * (G.coop ? 1.5 : 1) * (G.diff ? G.diff.enemyHp : 1);
    const e = G.spawnEnemy('spawner', def.x, def.y, { spawnTime: 0.3 });
    e.x = def.x; // spawnEnemy pushes things away from heroes: a hive stays where the generator put it
    e.y = def.y;
    e.isSpawner = true;
    e.hive = def;
    e.maxHp = e.hp = Math.round(hpBase);
    e.def = Object.assign({}, B.enemies.spawner);
    e.scale = 1.4;
    e.kind = def.kind;
    e.spawnT = 2 + Math.random() * 2;
    e.stun = () => {};
    e.knock = () => {};
    e.applySlow = () => {};
    e.canTouch = () => false;
    e.touchDamage = () => 0;
    e.baseR = 11; // r is baseR * scale (about 15)
    def.enemy = e;
    return e;
  };
  Sp.level = (e) => Math.max(1, Math.ceil((e.hp / e.maxHp) * 3 - 1e-6));

  /* the spawner's "AI": count down and breed */
  E.AI.spawner = function (e, g, dt) {
    e.dvx = e.dvy = 0;
    e.state = 'idle';
    if (e.dead) return;
    const lv = Sp.level(e);
    if (lv !== e.lastLevel) {
      if (e.lastLevel && lv < e.lastLevel) {
        FX.burst(e.x, e.y, { n: 18, colors: [KIND[e.kind].glow, '#ffffff'], speed: 110, life: 0.5 });
        FX.text(e.x, e.y - 34, 'BREACH WEAKENED', KIND[e.kind].glow, 1);
        Audio.sfx('enemy_die_big');
        g.shake(3, 0.2);
      }
      e.lastLevel = lv;
    }
    e.pulse = (e.pulse || 0) + dt;
    if (nearestDist(e) > 600) return; // only breeds while a hero is within about a screen and a half
    const mine = g.enemies.filter((q) => q.hive === e.hive && !q.dead).length;
    const extra = Math.max(0, players().length - 1);
    const cap = 2 + lv * 2 + extra * 2;
    e.spawnT -= dt;
    if (e.spawnT > 0 || mine >= cap) return;
    const run = CH.Run;
    if (run && run.aliveCount() >= g.aliveCap()) { e.spawnT = 0.6; return; }
    const threat = (g.level && g.level.threat) || 0;
    const base = Math.max(1.1, 5.6 - lv * 1.15) * Math.pow(0.86, threat) / (1 + 0.22 * extra);
    e.spawnT = base * U.rand(0.8, 1.2);
    const mobs = (CH.LevelGen.MOBS[g.level ? g.level.biome : 'dungeon'] || CH.LevelGen.MOBS.dungeon);
    const type = mobs[Math.min(mobs.length - 1, Math.floor(Math.random() * (lv + 1.2)))];
    const p = g.level ? g.level.randomNear(e.x, e.y, 30, 62, 14) : null;
    const pos = p || { x: e.x + U.rand(-40, 40), y: e.y + U.rand(-40, 40) };
    const m = g.spawnEnemy(type, pos.x, pos.y, { elite: lv === 3 && Math.random() < 0.07 + 0.01 * Math.min(10, g.wave), variant: CH.Enemies.rollVariant(type, g.wave, g.arena ? g.arena.id : 'backyard'), spawnTime: 0.4 });
    m.hive = e.hive;
    FX.ring(pos.x, pos.y, 3, 18, KIND[e.kind].glow, 0.3);
    if (Math.random() < 0.5) Audio.sfx('scan');
  };

  /* a closed breach: loot burst, XP, the exit gets closer */
  wrap(G, 'killEnemy', function (orig, e) {
    const was = e.dead;
    orig.call(G, e);
    if (was || !e.isSpawner) return;
    e.hive.dead = true;
    const k = KIND[e.kind];
    FX.burst(e.x, e.y, { n: 36, colors: [k.glow, k.c2, '#ffffff'], speed: 160, life: 0.8 });
    FX.ring(e.x, e.y, 6, 120, k.glow, 0.7);
    G.shake(7, 0.5);
    Audio.sfx('boss_defeated');
    // the minions of a dead hive panic and die with it
    for (const q of G.enemies) if (q.hive === e.hive && !q.dead && !q.isSpawner && !q.isBoss) q.hp = Math.min(q.hp, 1);
    // loot burst: coins, a power-up and a trophy chance
    G.addCoins(Math.round(18 + 4 * G.wave), e.x, e.y);
    for (let i = 0; i < 5; i++) G.dropPickup('coin', e.x + U.rand(-24, 24), e.y + U.rand(-24, 24), 3, {});
    if (CH.PowerUps && CH.PowerUps.roll) G.dropPickup('curio', e.x, e.y, 2, { icon: 'pu.' + U.pick([259, 46, 170, 171]), life: 25 });
    CH.Upgrades.addXp(G, Math.round(B.xp.need(G.player.level) * 0.35), G.player);
    if (CH.Run) CH.Run.onBreachClosed(e.hive);
  });

  /* drawn instead of the regular enemy sprite */
  const baseDraw = E.draw;
  E.draw = function (ctx, e, cam) {
    if (!e.isSpawner) return baseDraw(ctx, e, cam);
    const x = Math.round(e.x - cam.x), y = Math.round(e.y - cam.y);
    if (x < -60 || y < -80 || x > B.view.w + 60 || y > B.view.h + 60) return;
    const k = KIND[e.kind] || KIND.hive;
    const t = e.pulse || 0;
    const lv = Sp.level(e);
    const flash = e.flash > 0 ? e.flash : 0;
    E.shadow(ctx, x, y + 8, 30);
    ctx.save();
    ctx.translate(x, y);
    const jig = lv < 3 ? Math.sin(t * 20) * 0.6 : 0;
    const col = (c) => (flash > 0.2 ? '#ffffff' : c);
    switch (e.kind) {
      case 'portal': {
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = i === 0 ? col(k.glow) : col(k.c2);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(0, -6, 15 - i * 3, 21 - i * 4, t * (1 + i * 0.6), 0, 6.283 * 0.8);
          ctx.stroke();
        }
        ctx.fillStyle = col(k.c1);
        ctx.beginPath();
        ctx.ellipse(0, -6, 7, 11, 0, 0, 6.283);
        ctx.fill();
        break;
      }
      case 'grave': {
        ctx.fillStyle = col(k.c1);
        ctx.fillRect(-12, -22, 24, 30);
        ctx.fillRect(-14, -26 + 3, 28, 6);
        ctx.fillStyle = col(k.c2);
        ctx.fillRect(-10, -20, 20, 26);
        ctx.fillStyle = col(k.c1);
        ctx.fillRect(-2, -17, 4, 14);
        ctx.fillRect(-6, -13, 12, 4);
        break;
      }
      case 'gate': {
        ctx.fillStyle = col(k.c1);
        ctx.fillRect(-16, -26, 8, 34);
        ctx.fillRect(8, -26, 8, 34);
        ctx.fillRect(-16, -30, 32, 8);
        ctx.fillStyle = col(k.glow);
        ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 5);
        ctx.fillRect(-8, -22, 16, 28);
        ctx.globalAlpha = 1;
        break;
      }
      case 'camp': {
        ctx.fillStyle = col(k.c1);
        ctx.beginPath();
        ctx.moveTo(-18, 8);
        ctx.lineTo(0, -26);
        ctx.lineTo(18, 8);
        ctx.fill();
        ctx.fillStyle = col(k.c2);
        ctx.beginPath();
        ctx.moveTo(-10, 8);
        ctx.lineTo(0, -12);
        ctx.lineTo(10, 8);
        ctx.fill();
        ctx.fillStyle = col(k.glow);
        ctx.fillRect(0, -34, 2, 10);
        ctx.fillRect(2, -34, 8 + Math.sin(t * 4) * 2, 5);
        break;
      }
      case 'rift': {
        for (let i = -2; i <= 2; i++) {
          ctx.fillStyle = col(i % 2 ? k.c1 : k.c2);
          ctx.beginPath();
          ctx.moveTo(i * 6 - 4, 8);
          ctx.lineTo(i * 6, -22 + Math.abs(i) * 6 + Math.sin(t * 3 + i) * 1.5);
          ctx.lineTo(i * 6 + 4, 8);
          ctx.fill();
        }
        break;
      }
      default: { // hive: a lumpy sac
        for (const [ox, oy, r] of [[-7, 0, 9], [7, 1, 8], [0, -9, 10], [0, 3, 11]]) {
          ctx.fillStyle = col(k.c1);
          ctx.beginPath();
          ctx.ellipse(ox + jig, oy - 4, r, r * 1.1, 0, 0, 6.283);
          ctx.fill();
          ctx.fillStyle = col(k.c2);
          ctx.beginPath();
          ctx.ellipse(ox + jig - 2, oy - 6, r * 0.45, r * 0.5, 0, 0, 6.283);
          ctx.fill();
        }
        break;
      }
    }
    // glow pips for the level (3 = fully open, 1 = nearly shut)
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < lv ? k.glow : '#2a2236';
      ctx.fillRect(-7 + i * 5, 12, 4, 3);
    }
    ctx.restore();
    // pack sign: the "!" road sign marks a breach; health bar underneath
    if (CH.UIK && CH.UIK.on) CH.UIK.draw(ctx, '0 - Sprites/Signs/1.png', x - 9, y - 54 + Math.sin(t * 3) * 1.2, { w: 18, h: 18 });
    const bw = 34;
    ctx.fillStyle = '#1b1226';
    ctx.fillRect(x - bw / 2 - 1, y - 36, bw + 2, 5);
    ctx.fillStyle = k.glow;
    ctx.fillRect(x - bw / 2, y - 35, Math.max(0, Math.round((e.hp / e.maxHp) * bw)), 3);
    ctx.fillStyle = '#1b1226';
    for (const q of [1, 2]) ctx.fillRect(x - bw / 2 + Math.round((bw * q) / 3), y - 35, 1, 3);
  };
  E.drawGround = ((orig) => function (ctx, e, cam) { if (e.isSpawner) return; return orig.call(E, ctx, e, cam); })(E.drawGround);
})(window.CH);
