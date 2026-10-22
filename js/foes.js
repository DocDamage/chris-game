/* CHAOS.exe - enemy layer: wave modifiers/objectives, mini-bosses, elite affixes, enemy synergies, bounty board and
   the adaptive spawn director. Wraps the base wave loop; nothing here edits the original enemy definitions. */
(function (CH) {
  'use strict';
  const { Balance: B, U, X, FX, Audio, G, Enemies: E } = CH;
  const wrap = X.wrap;
  const W = X.W;
  const sfx = (n) => {
    try { Audio.sfx(n); } catch (e) { /* optional */ }
  };
  const alive = () => G.players.filter((p) => !p.dead);
  const typeName = (t) => (B.enemies[t] && B.enemies[t].name) || t;
  const F = (X.F = { mod: null, mini: null, bounty: null, gold: null, esc: null, shrink: null, combatT: 0, miniPlan: false, goldPlan: false, dir: { k: 1, ease: 0, surge: 0, lastHurt: 0, label: '' } });

  /* ------------------------------------------------------------ wave modifiers */
  const MODS = {
    defend: { name: 'DEFEND THE VENDING MACHINE', desc: 'Enemies want the machine! Keep them off it.' },
    golden: { name: 'GOLDEN GOBLIN', desc: 'Kill the golden goblin before it escapes for a big payout.' },
    shrink: { name: 'SHRINKING FLOOR', desc: 'Survive 45 seconds. The safe zone is shrinking!' },
    elites: { name: 'ONLY ELITES', desc: 'Fewer enemies, but every one is an elite. +50% coins.' },
    escort: { name: 'ESCORT THE INTERN', desc: 'Keep the intern alive until the wave ends.' },
  };
  X.WAVE_MODS = MODS;

  function startMod(n) {
    F.mod = null;
    F.gold = null;
    F.esc = null;
    F.shrink = null;
    if (n < 2 || G.isBossWave(n) || X.run.mode === 'rush' || n === 1) return;
    const forced = X.run.forceMod;
    if (!forced && W.rng() > 0.45) return;
    const pool = Object.keys(MODS).filter((k) => (k !== 'defend' || G.machine) && (k !== 'shrink' || n >= 3));
    const id = forced && pool.includes(forced) ? forced : pool[Math.floor(W.rng() * pool.length)];
    F.mod = { id, t: 0, done: false, failed: false };
    const c = G.partyCenter();
    if (id === 'elites') {
      G.queue = G.queue.filter((e, i) => e.boss || i % 2 === 0);
      for (const e of G.queue) if (!e.boss) e.elite = true;
    } else if (id === 'defend') {
      G.machine.hp = G.machine.maxHp = 260;
    } else if (id === 'escort') {
      F.esc = { x: c.x - 24, y: c.y + 12, hp: 120, max: 120 };
    } else if (id === 'shrink') {
      F.shrink = { t: 0, dur: 45 };
    }
    G.ui.toast('WAVE MODIFIER: ' + MODS[id].name);
  }
  X.startMod = startMod;

  const filler = () => ({ type: U.pick(['chicken', 'potato', 'intern']), variant: undefined });
  function modTick(dt) {
    const m = F.mod;
    if (!m || m.done || G.waveState !== 'combat') return;
    m.t += dt;
    const empty = !G.queue.length && G.enemies.length < 3;
    if (m.id === 'shrink') {
      const s = F.shrink;
      s.t += dt;
      const r = U.lerp(Math.min(G.arena.w, G.arena.h) / 2 - 30, 190, Math.min(1, s.t / s.dur));
      s.r = r;
      s.tick = (s.tick || 0) - dt;
      if (s.tick <= 0) {
        s.tick = 0.5;
        for (const p of alive()) if (U.dist(p.x, p.y, G.arena.w / 2, G.arena.h / 2) > r) G.hurtPlayer(G.edmg(5), null, { p });
      }
      if (empty && s.t < s.dur) G.queue.push(filler(), filler());
      if (s.t >= s.dur) finish(true, 30);
    } else if (m.id === 'golden') {
      if (!F.gold && !m.spawned && m.t > 2.5) {
        m.spawned = true;
        const pos = G.spawnPos();
        const e = G.spawnEnemy('goblin', pos.x, pos.y, { hpMul: 5 });
        if (e) {
          e.golden = true;
          e.goldT = 26;
          F.gold = e;
          G.ui.toast('A GOLDEN GOBLIN APPEARS! Catch it!');
        }
      }
      const e = F.gold;
      if (e && !e.dead) {
        e.goldT -= dt;
        e.speedX = 0;
        e.contactCd = 1;
        const p = G.nearestPlayer(e.x, e.y);
        if (p) {
          const a = U.ang(p.x, p.y, e.x, e.y);
          const sp = U.dist(p.x, p.y, e.x, e.y) < 170 ? 62 : 24;
          e.x = U.clamp(e.x + Math.cos(a) * sp * dt, 24, G.arena.w - 24);
          e.y = U.clamp(e.y + Math.sin(a) * sp * dt, 24, G.arena.h - 24);
        }
        if (e.goldT <= 0) {
          G.enemies.splice(G.enemies.indexOf(e), 1);
          e.dead = true;
          F.gold = null;
          G.ui.toast('THE GOLDEN GOBLIN ESCAPED!');
          finish(false, 0);
        }
      } else if (e && e.dead) {
        F.gold = null;
        finish(true, 0);
      }
    } else if (m.id === 'defend') {
      const mc = G.machine;
      if (!mc) return finish(false, 0);
      let n = 0;
      for (const e of G.enemies) if (!e.dead && !e.isBoss && U.dist(e.x, e.y, mc.x, mc.y) < 22 + e.r) n++;
      mc.hp -= Math.min(n, 4) * 7 * dt;
      if (mc.hp <= 0) {
        FX.burst(mc.x, mc.y, { n: 24, colors: ['#e43b44', '#feae34', '#ffffff'], speed: 120, life: 0.7 });
        G.machine = null;
        G.ui.toast('THE VENDING MACHINE WAS DESTROYED!');
        finish(false, 0);
      }
    } else if (m.id === 'escort') {
      const s = F.esc;
      if (!s) return;
      const c = G.partyCenter();
      const d = U.dist(s.x, s.y, c.x, c.y);
      if (d > 34) {
        const a = U.ang(s.x, s.y, c.x, c.y);
        s.x += Math.cos(a) * 62 * dt;
        s.y += Math.sin(a) * 62 * dt;
      }
      let n = 0;
      for (const e of G.enemies) if (!e.dead && !e.isBoss && U.dist(e.x, e.y, s.x, s.y) < 14 + e.r) n++;
      s.hp -= Math.min(n, 3) * 9 * dt;
      if (s.hp <= 0) {
        FX.burst(s.x, s.y, { n: 16, colors: ['#e43b44', '#ffffff'], speed: 90, life: 0.5 });
        F.esc = null;
        G.ui.toast('THE INTERN DIDN\'T MAKE IT. HR WILL BE UPSET.');
        finish(false, 0);
      }
    }
  }
  function finish(ok, coins) {
    const m = F.mod;
    if (!m || m.done) return;
    m.done = true;
    m.failed = !ok;
    if (ok) {
      const c = G.partyCenter();
      if (coins) G.addCoins(coins);
      if (m.id === 'golden') {
        G.addCoins(40);
        G.dropPickup('power', c.x, c.y - 10, 1);
        CH.PowerUps.dropCurio(G, c.x + 10, c.y);
      }
      FX.text(c.x, c.y - 30, 'OBJECTIVE COMPLETE!', '#fee761', 2);
      sfx('levelup');
      G.runStat && G.runStat('objectives', 1);
    }
  }
  /* a unit target for enemies: the defended machine and the escorted intern */
  wrap(E, 'target', function (orig, g, e) {
    let best = null;
    let bd = 200 * 200;
    for (const t of [F.mod && F.mod.id === 'defend' && !F.mod.done && g.machine ? g.machine : null, F.esc]) {
      if (!t) continue;
      const dd = U.dist2(e.x, e.y, t.x, t.y);
      if (dd < bd) {
        bd = dd;
        best = t;
      }
    }
    const aud = alive().find((p) => p.auditT > 0);
    if (aud && !e.isBoss) return { x: aud.x, y: aud.y, isPlayer: true, p: aud };
    if (best && !e.isBoss) return { x: best.x, y: best.y, isPlayer: false };
    return orig.call(E, g, e);
  });
  wrap(G, 'waveComplete', function (orig) {
    const m = F.mod;
    if (m && !m.done) {
      if (m.id === 'defend' && G.machine) {
        G.machine.uses = Math.max(G.machine.uses, 2);
        finish(true, 35);
      } else if (m.id === 'escort' && F.esc) finish(true, 30);
      else if (m.id === 'elites') finish(true, 0);
    }
    if (m && m.id === 'elites' && !m.failed) {
      const c = G.partyCenter();
      G.addCoins(Math.round(8 + G.wave * 2));
      FX.text(c.x, c.y - 30, 'ELITE BONUS', '#fee761', 1);
    }
    F.esc = null;
    F.shrink = null;
    orig.call(G);
    F.mod = null;
  });

  /* ------------------------------------------------------------------ bounty */
  function startBounty(n) {
    F.bounty = null;
    if (n < 2 || G.isBossWave(n)) return;
    const types = Array.from(new Set(G.queue.filter((e) => !e.boss && e.type).map((e) => e.type)));
    if (!types.length) return;
    const type = types[Math.floor(W.rng() * types.length)];
    F.bounty = { type, pay: 3 + Math.floor(n / 4), got: 0 };
  }

  /* --------------------------------------------------------------- mini-bosses */
  const FIRST = ['Gary', 'Brenda', 'Dave', 'Karen', 'Sir Reginald', 'Big Steve', 'Mx. Chaos', 'Doug', 'Priya', 'Lord Kevin'];
  const LAST = ['the Unpaid', 'the Overdue', 'Reply-All', 'the Unstoppable', 'the Microwaved', 'from Accounting', 'the Merger', 'the Intern Whisperer'];
  function planMini(n) {
    F.mini = null;
    F.miniPlan = n >= 3 && !G.isBossWave(n) && X.run.mode !== 'rush' && W.rng() < 0.35;
  }
  function spawnMini() {
    F.miniPlan = false;
    const types = ['orc', 'trashcan', 'toaster', 'fridge', 'golem', 'office'].filter((t) => B.enemies[t]);
    const type = U.pick(types);
    const pos = G.spawnPos();
    const e = G.spawnEnemy(type, pos.x, pos.y, { elite: true, hpMul: 4.5 });
    if (!e) return;
    e.mini = true;
    e.mname = U.pick(FIRST) + ' ' + U.pick(LAST);
    e.scale = (e.scale || 1) * 1.3;
    e.shieldHp = e.maxHp * 0.25;
    F.mini = e;
    G.ui.toast('MINI-BOSS: ' + e.mname.toUpperCase());
    sfx('warn');
  }

  /* ------------------------------------------------------------- elite affixes */
  const AFF = {
    vampiric: { name: 'VAMPIRIC', color: '#e43b44' },
    shielded: { name: 'SHIELDED', color: '#3ccbe6' },
    teleporting: { name: 'TELEPORTING', color: '#b55088' },
    splitting: { name: 'SPLITTING', color: '#63c74d' },
    explosive: { name: 'EXPLOSIVE', color: '#feae34' },
  };
  X.AFFIXES = AFF;
  wrap(G, 'spawnEnemy', function (orig, type, x, y, o) {
    const e = orig.call(G, type, x, y, o);
    o = o || {};
    if (e && !e.isBoss && e.isElite && !o.summoned && !e.mini && G.wave >= 2 && W.rng() < 0.7) {
      e.affix = U.pick(Object.keys(AFF));
      if (e.affix === 'shielded') e.shieldHp = e.maxHp * 0.5;
      if (e.affix === 'teleporting') e.tpT = U.rand(2.5, 4);
    }
    return e;
  });
  /* shields soak damage first */
  wrap(G, 'damageEnemy', function (orig, e, dmg, o) {
    if (e.shieldHp > 0 && !e.dead && e.state !== 'spawn') {
      const a = Math.min(e.shieldHp, dmg);
      e.shieldHp -= a;
      dmg -= a;
      FX.burst(e.x, e.y - 4, { n: 3, colors: ['#3ccbe6', '#ffffff'], speed: 60, life: 0.25 });
      if (e.shieldHp <= 0) FX.text(e.x, e.y - 18, 'SHIELD BROKEN', '#3ccbe6', 1);
      if (dmg <= 0) {
        e.flash = 1;
        return 0;
      }
    }
    return orig.call(G, e, dmg, o);
  });
  X.chain('onHurt', (p, dmg, src) => {
    F.dir.lastHurt = G.time;
    if (src && src.affix === 'vampiric' && src.hp > 0) {
      src.hp = Math.min(src.maxHp, src.hp + dmg * 2);
      FX.text(src.x, src.y - 14, 'DRAIN', '#e43b44', 1);
    }
    if (p && p.hp / p.maxHp < 0.25) F.dir.ease = 12;
  });
  /* enemy damage on an audited player is 25% higher */
  wrap(G, 'hurtPlayer', function (orig, dmg, src, o) {
    const p = (o && o.p) || G.player;
    if (p && p.auditT > 0) dmg *= 1.25;
    return orig.call(G, dmg, src, o);
  });

  wrap(G, 'killEnemy', function (orig, e) {
    const was = e.dead;
    const x = e.x;
    const y = e.y;
    orig.call(G, e);
    if (was || e.isBoss) return;
    if (e.affix === 'splitting' && !G.allDead()) {
      for (let i = 0; i < 2; i++) G.spawnEnemy(e.type, x + (i ? 8 : -8), y, { summoned: true, hpMul: 0.4 });
    }
    if (e.affix === 'explosive' && !G.allDead()) G.after(0.05, () => G.explode(x, y, 36, 20, { owner: 'p', hitEnemies: true, hurtPlayer: true, pdmg: G.edmg(11), colors: 'fire', knock: 150, noShake: true }));
    if (e.mini) {
      const c = e.lastHitBy || G.player;
      G.dropPickup('power', x, y, 1);
      for (let i = 0; i < 2; i++) CH.PowerUps.dropCurio(G, x + U.rand(-14, 14), y + U.rand(-10, 10));
      for (let i = 0; i < 5; i++) G.dropPickup('coin', x + U.rand(-12, 12), y + U.rand(-12, 12), 3);
      FX.text(x, y - 24, 'MINI-BOSS DOWN!', '#fee761', 2);
      G.addScore(500 * G.diff.score);
      G.runStat && G.runStat('miniBosses', 1);
      if (F.mini === e) F.mini = null;
      void c;
    }
    if (e.golden) {
      FX.text(x, y - 24, 'GOLDEN KILL!', '#fee761', 2);
    }
    if (F.bounty && e.type === F.bounty.type) {
      G.addCoins(F.bounty.pay);
      F.bounty.got++;
      FX.text(x, y - 16, 'BOUNTY +' + F.bounty.pay, '#fee761', 1);
    }
    /* goblin shamans revive the recently dead */
    if (!e.summoned && !e.revived && e.type !== 'goblin') {
      const sh = G.enemies.find((q) => !q.dead && q.type === 'goblin' && !q.golden && (q.revCd || 0) <= 0 && U.dist(q.x, q.y, x, y) < 90);
      if (sh && Math.random() < 0.4) {
        sh.revCd = 7;
        FX.ring && FX.ring(x, y, 4, 22, '#63c74d', 0.5);
        G.after(1.6, () => {
          if (G.state !== 'playing' || G.enemies.length >= G.aliveCap() + 4) return;
          const ne = G.spawnEnemy(e.type, x, y, { summoned: true, hpMul: 0.6 });
          if (ne) {
            ne.revived = true;
            FX.text(x, y - 14, 'REVIVED!', '#63c74d', 1);
          }
        });
      }
    }
  });

  /* ---------------------------------------------------------------- synergies */
  function synergies(dt) {
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (e.revCd > 0) e.revCd -= dt;
      if (e.affix === 'teleporting' && e.state !== 'spawn') {
        e.tpT -= dt;
        if (e.tpT <= 0) {
          e.tpT = U.rand(3, 5);
          const p = G.nearestPlayer(e.x, e.y);
          if (p) {
            FX.burst(e.x, e.y, { n: 8, colors: ['#b55088', '#ffffff'], speed: 60, life: 0.3 });
            const a = U.rand(0, U.TAU);
            e.x = U.clamp(p.x + Math.cos(a) * U.rand(55, 90), 20, G.arena.w - 20);
            e.y = U.clamp(p.y + Math.sin(a) * U.rand(40, 70), 20, G.arena.h - 20);
            FX.burst(e.x, e.y, { n: 8, colors: ['#b55088', '#ffffff'], speed: 60, life: 0.3 });
          }
        }
      }
      if (e.type === 'influencer') {
        e.buffT = (e.buffT || 0) - dt;
        if (e.buffT <= 0) {
          e.buffT = 4;
          FX.ring && FX.ring(e.x, e.y, 6, 84, '#b55088', 0.5);
          for (const q of G.enemies) {
            if (q.dead || q.isBoss || q === e || U.dist(q.x, q.y, e.x, e.y) > 84) continue;
            if (!q.buffed) {
              q.buffed = true;
              q.speedX = (q.speedX || 1) * 1.3;
            }
            q.buffUntil = G.time + 4.5;
          }
        }
      }
      if (e.buffed && G.time > e.buffUntil) {
        e.buffed = false;
        e.speedX = (e.speedX || 1) / 1.3;
      }
      if (e.type === 'office' && e.state !== 'spawn') {
        e.auditCd = (e.auditCd || U.rand(2, 5)) - dt;
        if (e.auditCd <= 0) {
          e.auditCd = 9;
          const p = G.nearestPlayer(e.x, e.y);
          if (p && !(p.auditT > 0) && U.dist(p.x, p.y, e.x, e.y) < 160) {
            p.auditT = 5;
            FX.text(p.x, p.y - 28, 'AUDITED! (+25% DMG TAKEN)', '#feae34', 1);
            sfx('warn');
          }
        }
      }
    }
    for (const p of G.players) if (p.auditT > 0) p.auditT -= dt;
  }

  /* --------------------------------------------------------- spawn director */
  function directorK(dt) {
    const D = F.dir;
    const chaotic = G.diff === B.difficulty.chaotic;
    if (D.ease > 0) D.ease -= dt;
    if (D.surge > 0) D.surge -= dt;
    else if (chaotic && Math.random() < dt * 0.05) D.surge = 4;
    const ps = alive();
    const hp = ps.length ? ps.reduce((a, p) => a + p.hp / p.maxHp, 0) / ps.length : 1;
    let k = 1;
    D.label = '';
    if (D.ease > 0 || hp < 0.3) {
      k = chaotic ? 0.8 : 0.55;
      D.label = 'EASING OFF';
    } else if (hp > 0.8 && G.time - D.lastHurt > 6) {
      k = chaotic ? 1.5 : 1.25;
      D.label = 'PUSHING';
    }
    if (D.surge > 0) {
      k = 1.9;
      D.label = 'SURGE!';
    }
    D.k = k;
    return k;
  }

  wrap(G, 'startWave', function (orig, n) {
    orig.call(G, n);
    F.combatT = 0;
    F.dir.ease = 0;
    startMod(n);
    startBounty(n);
    planMini(n);
  });

  wrap(G, 'updateWave', function (orig, dt) {
    if (G.waveState === 'combat') {
      F.combatT += dt;
      if (F.miniPlan && (F.combatT > 9 || (!G.queue.length && G.enemies.length <= 2))) spawnMini();
      modTick(dt);
      synergies(dt);
      return orig.call(G, dt * (G.queue.length ? directorK(dt) : 1));
    }
    return orig.call(G, dt);
  });

  /* ----------------------------------------------------------------- drawing */
  const lines = () => {
    const out = [];
    const m = F.mod;
    if (m && !m.done) {
      let extra = '';
      if (m.id === 'shrink' && F.shrink) extra = ' ' + Math.max(0, Math.ceil(F.shrink.dur - F.shrink.t)) + 's';
      if (m.id === 'golden' && F.gold) extra = ' ' + Math.max(0, Math.ceil(F.gold.goldT)) + 's';
      if (m.id === 'defend' && G.machine) extra = ' ' + Math.max(0, Math.round((G.machine.hp / G.machine.maxHp) * 100)) + '%';
      if (m.id === 'escort' && F.esc) extra = ' ' + Math.max(0, Math.round((F.esc.hp / F.esc.max) * 100)) + '%';
      out.push([MODS[m.id].name + extra, '#feae34']);
    }
    if (F.bounty) out.push(['BOUNTY: ' + typeName(F.bounty.type).toUpperCase() + ' +' + F.bounty.pay + 'c', '#fee761']);
    if (F.dir.label && X.opts().showDirector) out.push(['DIRECTOR: ' + F.dir.label, '#8b9bb4']);
    return out;
  };
  X.objectiveLines = lines;

  CH.Hooks.world.push((ctx, cam) => {
    if (G.state === 'menu' || !G.arena) return;
    const tx = (x) => Math.round(x - cam.x);
    const ty = (y) => Math.round(y - cam.y);
    const s = F.shrink;
    if (s && s.r) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(tx(-20), ty(-20), G.arena.w + 40, G.arena.h + 40);
      ctx.arc(tx(G.arena.w / 2), ty(G.arena.h / 2), s.r, 0, U.TAU, true);
      ctx.fillStyle = 'rgba(228,59,68,0.28)';
      ctx.fill('evenodd');
      ctx.strokeStyle = '#e43b44';
      ctx.beginPath();
      ctx.arc(tx(G.arena.w / 2), ty(G.arena.h / 2), s.r, 0, U.TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (G.machine && G.machine.maxHp && F.mod && F.mod.id === 'defend') {
      const w = 26;
      ctx.fillStyle = '#1a1c2c';
      ctx.fillRect(tx(G.machine.x) - w / 2, ty(G.machine.y) - 30, w, 3);
      ctx.fillStyle = '#63c74d';
      ctx.fillRect(tx(G.machine.x) - w / 2, ty(G.machine.y) - 30, Math.max(0, w * (G.machine.hp / G.machine.maxHp)), 3);
    }
    const esc = F.esc;
    if (esc) {
      ctx.fillStyle = '#feae34';
      ctx.fillRect(tx(esc.x) - 4, ty(esc.y) - 10, 8, 12);
      ctx.fillStyle = '#ead4aa';
      ctx.fillRect(tx(esc.x) - 3, ty(esc.y) - 14, 6, 5);
      ctx.fillStyle = '#1a1c2c';
      ctx.fillRect(tx(esc.x) - 10, ty(esc.y) - 19, 20, 3);
      ctx.fillStyle = '#63c74d';
      ctx.fillRect(tx(esc.x) - 10, ty(esc.y) - 19, 20 * (esc.hp / esc.max), 3);
      CH.Font.draw(ctx, 'INTERN', tx(esc.x), ty(esc.y) - 26, '#ffffff', 1, true, 'center');
    }
    for (const e of G.enemies) {
      if (e.dead || e.isBoss || e.hidden) continue;
      const top = ty(e.y) - (e.h || 16) - 6;
      if (e.golden) {
        ctx.globalAlpha = 0.6 + Math.sin(G.time * 8) * 0.3;
        ctx.strokeStyle = '#fee761';
        ctx.beginPath();
        ctx.arc(tx(e.x), ty(e.y), e.r + 4, 0, U.TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
        CH.Font.draw(ctx, 'GOLDEN', tx(e.x), top - 6, '#fee761', 1, true, 'center');
      }
      if (e.mini) {
        const w = 40;
        ctx.fillStyle = '#1a1c2c';
        ctx.fillRect(tx(e.x) - w / 2, top - 2, w, 4);
        ctx.fillStyle = '#e43b44';
        ctx.fillRect(tx(e.x) - w / 2, top - 2, w * Math.max(0, e.hp / e.maxHp), 4);
        if (e.shieldHp > 0) {
          ctx.fillStyle = '#3ccbe6';
          ctx.fillRect(tx(e.x) - w / 2, top - 5, w * Math.min(1, e.shieldHp / (e.maxHp * 0.25)), 2);
        }
        CH.Font.draw(ctx, e.mname, tx(e.x), top - 12, '#fee761', 1, true, 'center');
      } else if (e.affix) {
        const a = AFF[e.affix];
        CH.Font.draw(ctx, a.name, tx(e.x), top - 2, a.color, 1, true, 'center');
        if (e.shieldHp > 0) {
          ctx.strokeStyle = '#3ccbe6';
          ctx.beginPath();
          ctx.arc(tx(e.x), ty(e.y) - 2, e.r + 3, 0, U.TAU);
          ctx.stroke();
        }
      }
      if (F.bounty && e.type === F.bounty.type) CH.Font.draw(ctx, '$', tx(e.x), top + 6, '#fee761', 1, true, 'center');
    }
  });
  CH.Hooks.screen.push((ctx) => {
    if (G.state !== 'playing' && G.state !== 'paused') return;
    let y = 30;
    for (const [t, c] of lines()) {
      CH.Font.draw(ctx, t, 240, y, c, 1, true, 'center');
      y += 9;
    }
  });
  wrap(X, 'reset', function (orig) {
    F.mod = F.mini = F.bounty = F.gold = F.esc = F.shrink = null;
    F.dir.ease = F.dir.surge = 0;
    return orig.call(X);
  });
})(window.CH);
