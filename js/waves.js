/* CHAOS.exe - run structure: run modes (5-wave, marathon, boss rush), boss choice at branches, extra branch points,
   the between-wave shop, risk/reward shrines, event orbs, new events, boss modifiers/parts/no-hit trophies. */
(function (CH) {
  'use strict';
  const { Balance: B, U, X, FX, Audio, G, Events: Ev, Enemies: E } = CH;
  const wrap = X.wrap;
  const sfx = (n) => {
    try { Audio.sfx(n); } catch (e) { /* optional */ }
  };
  const alive = () => G.players.filter((p) => !p.dead);
  const bossName = (k) => (B.bosses[k] && B.bosses[k].name) || k;

  const P3 = ['frog', 'treant', 'bd', 'mage', 'knight', 'ooze'];
  const P5 = ['ceo', 'beholder', 'moss', 'sporeeye'];
  const P8 = ['chicken', 'yeti', 'maw', 'dunewyrm', 'gol', 'bloodwyrm', 'dragon', 'voideye', 'demon'];
  const PF = ['bug', 'skull', 'daddy'];
  const ALLB = ['frog', 'treant', 'bd', 'mage', 'knight', 'gol', 'moss', 'chicken', 'sporeeye', 'dragon', 'yeti', 'maw', 'dunewyrm', 'beholder', 'demon', 'bloodwyrm', 'ooze', 'voideye', 'ceo'];
  const PATH_IDX = { wasteland: 0, office: 1, volcano: 0, dungeon: 1 };

  /* ---------------------------------------------------------------- run setup */
  const W = (X.W = { rush: [], pathMod: {}, shop: null, orbs: null, shrine: null, revives: 0, bossHit: false, cardOwed: 0 });
  X.run = { mode: 'classic', seed: null, challenge: null, heat: [] };
  X.pending = null;
  X.MODES = {
    classic: { name: 'CAMPAIGN', desc: '10 waves, 4 bosses, then Endless.', len: 10 },
    short: { name: 'QUICK RUN', desc: '5 waves, 2 bosses. Perfect for a short session.', len: 5 },
    marathon: { name: 'MARATHON', desc: '15 waves and 6 bosses before the final.', len: 15 },
    rush: { name: 'BOSS RUSH', desc: '8 bosses back to back. Heal a little between fights.', len: 8 },
  };
  /* base seed: the daily seed when set, otherwise the run counter (keeps the alternate-boss rotation) */
  const base = () => (X.run.seed != null ? X.run.seed >>> 0 : G.runIndex || 0);
  W.rng = Math.random;
  const pick = (list, off) => list[(base() + off) % list.length];

  X.startRun = (setup, config) => {
    X.pending = setup || {};
    G.newRun(config === undefined ? null : config);
  };

  W.reset = () => {
    W.rng = X.run.seed != null ? U.seeded(X.run.seed) : Math.random;
    W.pathMod = {};
    W.shop = null;
    W.orbs = null;
    W.fav = null;
    W.shrine = null;
    W.revives = 0;
    W.bossHit = false;
    W.cardOwed = 0;
    W.rush = [];
    if (X.run.mode === 'rush') {
      const list = ALLB.slice();
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(W.rng() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      W.rush = list.slice(0, 7).concat([PF[(X.run.seed != null ? X.run.seed >>> 0 : Storage_totalRuns()) % PF.length]]);
    }
  };
  function Storage_totalRuns() {
    return (CH.Storage.stats && CH.Storage.stats.totalRuns) || 0;
  }

  wrap(G, 'newRun', function (orig, config) {
    let setup = X.pending;
    X.pending = null;
    if (!setup) setup = config === undefined && (G.state === 'gameover' || G.state === 'victory') ? Object.assign({}, X.run) : {};
    X.run = Object.assign({ mode: 'classic', seed: null, challenge: null, heat: [] }, setup);
    W.reset();
    if (X.onRunSetup) X.onRunSetup(X.run);
    return orig.call(G, config);
  });
  X.recalc = () => G.players.forEach((p) => CH.Upgrades.recalc(p));

  /* ------------------------------------------------------------ boss schedule */
  const offFor = (key, idx) => (idx !== undefined ? idx : PATH_IDX[G.chosenPath && G.chosenPath[key]] || 0);
  const mk = (kind) => ({ kind, tier: 0 });
  wrap(G, 'isBossWave', function (orig, w, idx) {
    const mode = X.run.mode;
    if (mode === 'rush') {
      if (G.endless) return orig.call(G, w);
      return w <= W.rush.length ? mk(W.rush[w - 1]) : null;
    }
    if (G.endless) return orig.call(G, w);
    if (mode === 'short') {
      if (w === 3) return mk(pick(P3, 0));
      if (w === 5) return mk(pick(PF, offFor(4, idx)));
      return null;
    }
    if (mode === 'marathon') {
      if (w === 3) return mk(pick(P3, 0));
      if (w === 5) return mk(pick(P5, offFor(4, idx)));
      if (w === 8) return mk(pick(P8, offFor(7, idx)));
      if (w === 10) return mk(pick(ALLB, 3));
      if (w === 12) return mk(pick(ALLB, 7));
      if (w === 15) return mk(pick(PF, 0));
      return null;
    }
    if (X.run.seed != null) {
      if (w === 3) return mk(pick(P3, 0));
      if (w === 5) return mk(pick(P5, offFor(4, idx)));
      if (w === 8) return mk(pick(P8, offFor(7, idx)));
      if (w === 10) return mk(pick(PF, 0));
    }
    if ((w === 5 && (idx !== undefined || (G.chosenPath && G.chosenPath[4]))) || (w === 8 && (idx !== undefined || (G.chosenPath && G.chosenPath[7])))) {
      return mk(w === 5 ? pick(P5, offFor(4, idx)) : pick(P8, offFor(7, idx)));
    }
    return orig.call(G, w);
  });

  /* the wave banner says ENDLESS past wave 10, which is wrong for Marathon's regular waves */
  wrap(G, 'banner', function (orig, text, sub, dur) {
    if (typeof text === 'string' && X.run.mode === 'marathon' && !G.endless) text = text.replace('  (ENDLESS)', '');
    return orig.call(G, text, sub, dur);
  });

  /* rush waves are the boss plus a few adds */
  wrap(G, 'buildQueue', function (orig, w) {
    const q = orig.call(G, w);
    if (X.run.mode === 'rush' && !G.endless) {
      const adds = 2 + Math.floor(w / 3);
      return q.slice(0, 1 + adds);
    }
    return q;
  });

  /* ---------------------------------------------------------- branch screens */
  const canPrompt = () => !G.endless && !!CH.UI.showBranch && !G._scriptTesting && !G.players.some((p) => p.inp && p.inp.src && p.inp.src.kind === 'script');
  W.canPrompt = canPrompt;

  /* show the boss behind each path option */
  wrap(G, 'promptBranch', function (orig, nextWave) {
    W.branchFor = nextWave;
    try {
      return orig.call(G, nextWave);
    } finally {
      W.branchFor = null;
    }
  });
  wrap(CH.UI, 'showBranch', function (orig, options, cb) {
    if (W.branchFor && X.run.mode !== 'rush') {
      const bw = W.branchFor + 1;
      options.forEach((o, i) => {
        const b = G.isBossWave(bw, i);
        if (b && !o._boss) {
          o._boss = true;
          o.desc += `<br><b style="color:#e43b44">BOSS AHEAD (wave ${bw}): ${bossName(b.kind)}</b>`;
        }
      });
    }
    return orig.call(CH.UI, options, cb);
  });

  const EXTRA_OPTIONS = {
    hard: { id: 'hard', name: 'HARD PATH', tag: 'Risk', desc: 'An elite-heavy wave. Double coins and a rare drop when you clear it.', resName: 'DOUBLE REWARDS', hazard: 'ELITES' },
    safe: { id: 'safe', name: 'SAFE PATH', tag: 'Rest', desc: 'Heal 40% and browse the shop before the next wave.', resName: 'HEAL + SHOP', hazard: 'CALM' },
    secret: { id: 'secret', name: 'SECRET ARENA', tag: 'Hidden', desc: 'A strange zombie arena with a golden goblin and bonus curios.', resName: 'CURIOS', hazard: 'UNKNOWN' },
  };
  const extraSet = () => (X.run.mode === 'marathon' ? [2, 6, 9, 12] : X.run.mode === 'classic' ? [2, 6, 9] : X.run.mode === 'short' ? [2] : []);

  wrap(G, 'startWave', function (orig, n) {
    if (n > 1 && extraSet().includes(n) && canPrompt() && !G.isBossWave(n)) {
      const opts = [EXTRA_OPTIONS.hard, EXTRA_OPTIONS.safe];
      if (W.rng() < 0.4) opts.push(EXTRA_OPTIONS.secret);
      G.waveState = 'branch';
      G.state = 'branch';
      CH.Input.clear();
      W.branchFor = null;
      CH.UI.showBranch(opts.map((o) => Object.assign({}, o)), (id) => {
        W.pathMod[n] = id;
        G.state = 'playing';
        CH.Input.clear();
        begin(orig, n);
      });
      return;
    }
    begin(orig, n);
  });
  function begin(orig, n) {
    orig.call(G, n);
    W.bossHit = false;
    const pm = W.pathMod[n];
    W.hard = pm === 'hard' && n > 1;
    if (pm === 'safe') {
      for (const p of alive()) G.healPlayer((p.maxHp * 0.4) / p.stats.healMult / G.diff.heal, p);
      if (canPrompt()) W.openShop();
    }
    if (pm === 'secret') {
      G.after(1.5, () => {
        for (let i = 0; i < 2; i++) CH.PowerUps.dropCurio(G, G.arena.w / 2 + U.rand(-60, 60), G.arena.h / 2 + U.rand(-40, 40));
      });
    }
    if (X.onWaveStart) X.onWaveStart(n);
    setupShrine(n);
  }
  wrap(G, 'pathArena', function (orig, n) {
    return W.pathMod && W.pathMod[n] === 'secret' ? 'zombie' : orig.call(G, n);
  });

  /* ------------------------------------------------------------- wave bonuses */
  wrap(G, 'waveComplete', function (orig) {
    orig.call(G);
    W.orbs = null;
    W.revives = 0;
    if (W.hard) {
      W.hard = false;
      const c = 20 + G.wave * 6;
      G.addCoins(c);
      G.addScore(150 * G.wave * G.diff.score);
      const p = G.partyCenter();
      CH.PowerUps.dropCurio(G, p.x + 10, p.y);
      FX.text(p.x, p.y - 30, 'HARD PATH BONUS +' + c, '#fee761', 2);
    }
    if (X.run.mode === 'rush' && G.wave < W.rush.length) {
      for (const p of alive()) G.healPlayer((p.maxHp * 0.3) / p.stats.healMult / G.diff.heal, p);
    }
    if (X.onWaveComplete) X.onWaveComplete(G.wave);
  });

  /* -------------------------------------------------------------- co-op revive tension */
  wrap(G, 'revivePlayer', function (orig, p, f, by) {
    const was = p.dead;
    orig.call(G, p, f, by);
    if (was && !p.dead && by) W.revives++;
  });
  wrap(G, 'updateRevive', function (orig, dt) {
    const bt = B.coop.reviveTime;
    B.coop.reviveTime = bt * (1 + 0.25 * W.revives);
    try {
      return orig.call(G, dt);
    } finally {
      B.coop.reviveTime = bt;
    }
  });

  /* ------------------------------------------------------------------- SHOP */
  const shopEl = document.createElement('div');
  shopEl.className = 'screen dim';
  shopEl.id = 'screen-shop';
  shopEl.innerHTML = '<div class="panel"><h2>PIT-STOP SHOP</h2><div class="center snark" id="shop-sub"></div><div class="shop-items" id="shop-items"></div><div class="row-btns"><button class="btn back" id="btn-shop-leave">LEAVE SHOP</button></div></div>';
  (document.getElementById('screen-branch') || document.body).parentNode.appendChild(shopEl);
  CH.UI.SCREENS.push('shop');

  const ITEMS = [
    { id: 'heal', name: 'FIRST AID', desc: 'Heal the whole party 60%.', cost: 30, buy: () => alive().forEach((p) => G.healPlayer((p.maxHp * 0.6) / p.stats.healMult / G.diff.heal, p)) },
    { id: 'power', name: 'POWER-UP', desc: 'A random timed power for everyone.', cost: 25, buy: () => alive().forEach((p) => CH.Upgrades.givePower(G, U.pick(Object.keys(B.pickupsBuff)), p)) },
    { id: 'reroll', name: '+2 REROLLS', desc: 'Reroll tokens for level-up cards.', cost: 20, buy: () => G.players.forEach((p) => (p.rr.reroll += 2)) },
    { id: 'banish', name: '+1 BANISH', desc: 'Banish a card from the pool for good.', cost: 25, buy: () => G.players.forEach((p) => (p.rr.banish += 1)) },
    { id: 'card', name: 'UPGRADE CARD', desc: 'A free level-up pick.', cost: 60, buy: () => (W.cardOwed += 1) },
    { id: 'nade', name: '+2 GRENADES', desc: 'Restock your grenade belt.', cost: 30, buy: () => G.players.forEach((p) => (p.nades = (p.nades || 0) + 2)) },
    { id: 'antidote', name: 'ANTIDOTE', desc: 'Cleanses poison, webs and slows. Heals 25%.', cost: 15, buy: () => alive().forEach((p) => { X.cleanse && X.cleanse(p); G.healPlayer((p.maxHp * 0.25) / p.stats.healMult / G.diff.heal, p); }) },
    { id: 'xp', name: 'XP TOME', desc: 'A big chunk of experience.', cost: 35, buy: () => alive().forEach((p) => CH.Upgrades.addXp(G, Math.round(B.xp.need(p.level) * 0.8), p)) },
  ];
  W.ITEMS = ITEMS;

  function renderShop() {
    const box = document.getElementById('shop-items');
    box.innerHTML = '';
    document.getElementById('shop-sub').textContent = 'COINS: ' + Math.floor(G.coins) + '   (click or press 1-3)';
    W.shop.items.forEach((it, i) => {
      const b = document.createElement('button');
      b.className = 'btn shop-item';
      const sold = W.shop.sold.has(it.id);
      b.disabled = sold || G.coins < it.cost;
      b.innerHTML = `<b>${i + 1}. ${it.name}</b><br><small>${it.desc}</small><br>${sold ? 'SOLD' : it.cost + ' COINS'}`;
      b.onclick = () => buy(i);
      box.appendChild(b);
    });
  }
  function buy(i) {
    const it = W.shop && W.shop.items[i];
    if (!it || W.shop.sold.has(it.id) || G.coins < it.cost) return false;
    G.coins -= it.cost;
    W.shop.sold.add(it.id);
    it.buy();
    sfx('buy');
    G.ui.refreshWeapons && G.ui.refreshWeapons();
    renderShop();
    return true;
  }
  W.buy = buy;
  W.openShop = function () {
    if (W.shop) return;
    const pool = U.shuffle(ITEMS.slice());
    const w = Math.max(1, G.wave);
    const items = pool.slice(0, 3).map((it) => Object.assign({}, it, { cost: Math.round(it.cost * (1 + 0.06 * w)) }));
    W.shop = { items, sold: new Set(), prevState: G.state };
    G.state = 'branch';
    CH.Input.clear();
    renderShop();
    CH.UI.show('shop');
    sfx('page');
  };
  W.closeShop = function () {
    if (!W.shop) return;
    W.shop = null;
    CH.UI.hideLevelUp();
    G.state = 'playing';
    CH.Input.clear();
    if (W.cardOwed > 0) {
      W.cardOwed--;
      G.pendingLevels++;
      G.openLevelUp();
    }
  };
  document.getElementById('btn-shop-leave').addEventListener('click', W.closeShop);
  document.addEventListener('keydown', (e) => {
    if (!W.shop || CH.UI.active !== 'shop') return;
    if (e.key >= '1' && e.key <= '3') buy(+e.key - 1);
    else if (e.key === 'Escape') W.closeShop();
  });

  /* free cards owed (shrines, rush) are opened as soon as the game is running again */
  wrap(G, 'step', function (orig, dt) {
    orig.call(G, dt);
    if (W.cardOwed > 0 && G.state === 'playing' && !W.shop && G.waveState !== 'branch') {
      W.cardOwed--;
      G.pendingLevels++;
      G.openLevelUp();
    }
  });

  /* ----------------------------------------------------------------- SHRINES */
  function setupShrine(n) {
    W.shrine = null;
    if (n < 3 || G.isBossWave(n) || X.run.mode === 'rush' || W.rng() > 0.4) return;
    const kind = W.rng() < 0.5 ? 'blood' : 'elite';
    W.shrine = { kind, x: U.rand(200, G.arena.w - 200), y: U.rand(200, G.arena.h - 200), used: false, guards: null, t: 0 };
  }
  wrap(G, 'updateWave', function (orig, dt) {
    const s = W.shrine;
    if (s && G.waveState === 'combat') {
      s.t += dt;
      if (!s.used) {
        for (const p of alive()) {
          if (U.dist(p.x, p.y, s.x, s.y) < 22) {
            if (s.kind === 'blood') {
              if (p.hp > p.maxHp * 0.3) {
                p.hp = Math.max(1, p.hp - p.maxHp * 0.25);
                s.used = true;
                W.cardOwed++;
                FX.text(s.x, s.y - 20, 'BLOOD PACT!', '#e43b44', 2);
                FX.burst(s.x, s.y, { n: 20, colors: ['#e43b44', '#ffffff'], speed: 90, life: 0.6 });
                sfx('crit');
              }
            } else {
              s.used = true;
              s.guards = [];
              for (let i = 0; i < 3; i++) {
                const a = (i / 3) * U.TAU;
                const e = G.spawnEnemy(U.pick(['orc', 'trashcan', 'toaster', 'office']), s.x + Math.cos(a) * 50, s.y + Math.sin(a) * 40, { elite: true });
                if (e) {
                  e.shrineGuard = true;
                  s.guards.push(e);
                }
              }
              G.banner('SHRINE CHALLENGE', 'Defeat the guardians for a reward!', 2);
              sfx('warn');
            }
            break;
          }
        }
      } else if (s.guards && !s.done && s.guards.every((e) => e.dead)) {
        s.done = true;
        for (let i = 0; i < 3; i++) CH.PowerUps.dropCurio(G, s.x + U.rand(-20, 20), s.y + U.rand(-20, 20));
        G.dropPickup('power', s.x, s.y, 1);
        G.addCoins(25);
        FX.text(s.x, s.y - 20, 'SHRINE CLEARED!', '#fee761', 2);
        sfx('levelup');
      }
    }
    return orig.call(G, dt);
  });

  /* -------------------------------------------------------------- EVENT ORBS */
  const GOOD = [];
  const regGood = (def) => {
    def.good = true;
    Ev.register(def);
    GOOD.push(def);
  };
  regGood({ id: 'goldrush', name: 'GOLD RUSH', desc: 'Every kill sprays extra coins. Grab them!', duration: 14, music: 'shop', start(g) { g.mods.coinRush = true; }, end(g) { g.mods.coinRush = false; } });
  regGood({
    id: 'powerhour', name: 'POWER HOUR', desc: 'Everyone shoots 25% faster and hits 20% harder.', duration: 14, music: 'battle',
    start() { W.powerHour = true; X.recalc && X.recalc(); }, end() { W.powerHour = false; X.recalc && X.recalc(); },
  });
  regGood({
    id: 'medic', name: 'FIELD MEDIC', desc: 'A gentle heal over time. Breathe.', duration: 12, music: 'garden',
    start(g, ev) { ev.t = 0; },
    tick(g, dt, ev) {
      ev.t -= dt;
      if (ev.t <= 0) {
        ev.t = 1;
        for (const p of alive()) G.healPlayer((p.maxHp * 0.03) / p.stats.healMult / G.diff.heal, p);
      }
    },
    end() {},
  });
  X.statHooks.push((p, s) => {
    if (W.powerHour) {
      s.fireRate *= 1.25;
      s.dmgMult *= 1.2;
    }
  });
  const reg = (def) => {
    def.legendary = true;
    def.minWave = 4;
    Ev.register(def);
  };
  reg({
    id: 'everychicken', name: 'EVERYONE IS A CHICKEN', desc: 'Chickens pour out of the walls! They are weak, fast and very generous.', duration: 16, music: 'rain', sfx: 'squeak',
    start(g, ev) { ev.t = 0; },
    tick(g, dt, ev) {
      ev.t -= dt;
      if (ev.t <= 0 && g.enemies.length < g.aliveCap() + 6) {
        ev.t = 0.35;
        const pos = g.spawnPos();
        const e = g.spawnEnemy('chicken', pos.x, pos.y, { summoned: true, hpMul: 0.5 });
        if (e) {
          e.speedX = (e.speedX || 1) * 1.35;
          e.chickenEvent = true;
        }
      }
    },
    end() {},
  });
  reg({
    id: 'bullethell', name: 'BULLET HELL HOUR', desc: 'The sky rains explosives. Score is doubled. Dodge!', duration: 16, music: 'superboss', sfx: 'thunder',
    start(g, ev) { ev.t = 0; g.mods.scoreMul = (g.mods.scoreMul || 1) * 2; },
    tick(g, dt, ev) {
      ev.t -= dt;
      if (ev.t > 0) return;
      ev.t = 0.28;
      const p = g.randomAlivePlayer();
      const x = U.clamp(p.x + U.rand(-140, 140), 24, g.arena.w - 24);
      const y = U.clamp(p.y + U.rand(-110, 110), 24, g.arena.h - 24);
      g.addWarn(x, y, 14, 0.8, (g2, z) => {
        FX.burst(z.x, z.y, { n: 8, colors: ['#feae34', '#e43b44'], speed: 80, life: 0.4 });
        g2.explode(z.x, z.y, 14, 18, { owner: 'p', hitEnemies: true, hurtPlayer: true, pdmg: g2.edmg(9), colors: 'fire', knock: 90, noShake: true });
      });
    },
    end(g) { g.mods.scoreMul = (g.mods.scoreMul || 2) / 2; },
  });
  reg({
    id: 'gravflip', name: 'GRAVITY FLIP', desc: 'Knockback flips between pushing and pulling every few seconds!', duration: 18, music: 'garden', sfx: 'wings',
    start(g, ev) { ev.t = 0; ev.s = 1; g.mods.lowGrav = true; },
    tick(g, dt, ev) {
      ev.t -= dt;
      if (ev.t <= 0) {
        ev.t = 5;
        ev.s = -ev.s;
        g.mods.kbMul = 3.2 * ev.s;
        g.banner(ev.s > 0 ? 'PUSH!' : 'PULL!', '', 1);
      }
    },
    end(g) { g.mods.lowGrav = false; g.mods.kbMul = 1; },
  });
  const isLegend = (d) => !!d.legendary;
  /* default pick weights: legendary events are rare; good events pair with the existing bad ones */
  function chooseEvent(g) {
    const ok = (d) => (d.minWave || 0) <= g.wave;
    const bads = Ev.list.filter((d) => ok(d) && !d.good && !isLegend(d));
    if (W.fav && X.anyPerk('favevent') && ok(W.fav) && W.rng() < 0.6) return W.fav;
    if (g.wave >= 4 && W.rng() < 0.08) return U.pick(Ev.list.filter((d) => isLegend(d) && ok(d)));
    if (W.rng() < 0.3) return U.pick(GOOD);
    return U.pick(bads);
  }
  W.chooseEvent = chooseEvent;
  W.orbPair = (g) => {
    const a = chooseEvent(g);
    let b = a.good ? U.pick(Ev.list.filter((d) => !d.good && !isLegend(d) && (d.minWave || 0) <= g.wave)) : U.pick(GOOD);
    if (W.rng() < 0.25) {
      const bads = Ev.list.filter((d) => d !== a && !d.good && !isLegend(d) && (d.minWave || 0) <= g.wave);
      if (bads.length) b = U.pick(bads);
    }
    if (W.fav && X.anyPerk('favevent') && (W.fav.minWave || 0) <= g.wave) {
      const other = a === W.fav ? b : a;
      return W.rng() < 0.5 ? [W.fav, other] : [other, W.fav];
    }
    return [a, b];
  };
  wrap(Ev, 'start', function (orig, g, def) {
    if (def) return orig.call(Ev, g, def);
    if (W.orbs) return;
    if (X.opts().eventOrbs !== false && canPrompt() && g.waveState === 'combat') {
      const c = g.partyCenter();
      const [a, b] = W.orbPair(g);
      W.orbs = { t: 0, list: [a, b].map((d, i) => ({ def: d, x: U.clamp(c.x + (i ? 70 : -70), 40, g.arena.w - 40), y: U.clamp(c.y - 50, 40, g.arena.h - 40), r: 13 })) };
      g.banner('CHAOS INCOMING', 'Shoot or touch an orb to pick the next event', 2.4);
      sfx('event');
      return;
    }
    return orig.call(Ev, g, chooseEvent(g));
  });
  wrap(G, 'step', function (orig, dt) {
    orig.call(G, dt);
    const o = W.orbs;
    if (!o || G.state !== 'playing') return;
    o.t += dt;
    let chosen = null;
    for (const orb of o.list) {
      for (const p of alive()) if (U.dist(p.x, p.y, orb.x, orb.y) < orb.r + p.r) chosen = orb;
      for (const pr of G.projectiles) if (pr.owner === 'p' && !pr.dead && U.dist(pr.x, pr.y, orb.x, orb.y) < orb.r + (pr.r || 3)) chosen = orb;
    }
    if (!chosen && o.t > 10) chosen = U.pick(o.list);
    if (chosen) {
      W.orbs = null;
      if (!W.fav && X.anyPerk('favevent')) {
        W.fav = chosen.def;
        G.ui.toast('FAVOURITE LOCKED IN: ' + chosen.def.name);
      }
      FX.burst(chosen.x, chosen.y, { n: 20, colors: chosen.def.good ? ['#63c74d', '#ffffff'] : ['#e43b44', '#feae34'], speed: 100, life: 0.6 });
      Ev.start(G, chosen.def);
    }
  });

  /* gold rush + chicken event drops */
  wrap(G, 'killEnemy', function (orig, e) {
    const was = e.dead;
    orig.call(G, e);
    if (was || e.isBoss) return;
    if (G.mods.coinRush) for (let i = 0; i < 2; i++) G.dropPickup('coin', e.x + U.rand(-6, 6), e.y + U.rand(-6, 6), 1);
    if (e.chickenEvent) G.dropPickup('coin', e.x, e.y, 1);
  });

  /* ------------------------------------------------- boss: modifiers, parts, trophies */
  const PARTS = { skull: ['LEFT HAND', 'RIGHT HAND'], gol: ['ROCKET ARM', 'SHOULDER CANNON'], dragon: ['LEFT WING', 'TAIL'], bug: ['ANTENNA', 'WING'], ceo: ['BRIEFCASE', 'TIE'], daddy: ['CLAW', 'HORN'], knight: ['SHIELD', 'HELM'], frog: ['TONGUE', 'LEG'], treant: ['BRANCH', 'ROOT'] };
  const partNames = (k) => PARTS[k] || ['ARMOUR PLATE', 'WEAK SPOT'];
  const AFFIXES = ['FAST', 'SPLITTING', 'SUMMONER', 'SHIELD PHASES'];
  wrap(G, 'spawnBoss', function (orig, kind, tier) {
    const b = orig.call(G, kind, tier);
    if (!b) return b;
    b.partsLeft = 2;
    b.partNames = partNames(kind);
    b.parts = [0, 1].map(() => ({ hp: b.maxHp * 0.09, max: b.maxHp * 0.09, r: 7, x: b.x, y: b.y, dead: false }));
    W.bossHit = false;
    W.bossT = 0;
    if (tier > 0) {
      b.affixes = AFFIXES.slice(0, Math.min(4, tier + 1));
      if (b.affixes.includes('FAST')) b.bs = (b.bs || 1) * 1.18;
      b.affT = 0;
      G.after(0.5, () => G.banner('LAP ' + (tier + 1) + ' AFFIXES', b.affixes.join(' + '), 3));
    }
    return b;
  });
  /* two separately shootable parts orbit the boss; shooting one off drops loot and weakens the boss.
     Melee-only players are covered by fallback thresholds at 50% and 25% health. */
  const breakPart = (e, idx) => {
    const part = e.parts[idx];
    if (!part || part.dead) return;
    part.dead = true;
    const name = e.partNames[idx];
    e.partsLeft--;
    e.bs = (e.bs || 1) * 0.9;
    if (e.stun) e.stun(0.9);
    G.banner(name + ' SHOT OFF!', 'The boss is weakened - extra loot!', 1.8);
    FX.burst(part.x, part.y, { n: 26, colors: ['#feae34', '#e43b44', '#ffffff'], speed: 130, life: 0.7 });
    FX.ring && FX.ring(part.x, part.y, 10, 60, '#feae34', 0.4);
    sfx('crit');
    G.shake(6, 0.4);
    for (let i = 0; i < 6; i++) G.dropPickup('coin', part.x + U.rand(-20, 20), part.y + U.rand(-20, 20), 3);
    CH.PowerUps.dropCurio(G, part.x, part.y + 12);
    e.partsBroken = (e.partsBroken || 0) + 1;
    G.runStat && G.runStat('bossParts', 1);
  };
  wrap(G, 'damageEnemy', function (orig, e, dmg, o) {
    const r = orig.call(G, e, dmg, o);
    if (e.isBoss && e.partsLeft > 0 && !e.dead) {
      const frac = e.hp / e.maxHp;
      if (e.parts && e.parts[0] && !e.parts[0].dead && frac <= 0.5) breakPart(e, 0);
      if (e.parts && e.parts[1] && !e.parts[1].dead && frac <= 0.25) breakPart(e, 1);
      if (e.affixes && e.affixes.includes('SPLITTING') && !e.split && frac < 0.5) {
        e.split = true;
        for (let i = 0; i < 4; i++) G.spawnEnemy('slime', e.x + U.rand(-30, 30), e.y + U.rand(-20, 20), { summoned: true, hpMul: 0.5 });
        G.banner('THE BOSS SPLITS!', '', 1.2);
      }
    }
    return r;
  });
  wrap(G, 'updateWave', function (orig, dt) {
    for (const b of G.enemies) {
      if (!b.isBoss || b.dead || !b.parts) continue;
      b.partT = (b.partT || 0) + dt;
      b.parts.forEach((p, i) => {
        if (p.dead) return;
        const a = i * Math.PI + b.partT * 0.7;
        const d = (b.r || 14) + 9;
        p.x = b.x + Math.cos(a) * d;
        p.y = b.y + Math.sin(a) * d * 0.8;
        for (const pr of G.projectiles) {
          if (pr.owner !== 'p' || pr.dead) continue;
          pr.partsHit = pr.partsHit || new Set();
          if (pr.partsHit.has(p) || U.dist(pr.x, pr.y, p.x, p.y) > p.r + (pr.r || 3)) continue;
          pr.partsHit.add(p);
          p.hp -= pr.dmg || 5;
          FX.burst(p.x, p.y, { n: 4, colors: ['#feae34', '#ffffff'], speed: 60, life: 0.3 });
          if (p.hp <= 0) {
            breakPart(b, i);
            break;
          }
        }
      });
    }
    return orig.call(G, dt);
  });
  wrap(G, 'updateWave', function (orig, dt) {
    for (const b of G.enemies) {
      if (!b.isBoss || b.dead || !b.affixes) continue;
      b.affT += dt;
      if (b.affixes.includes('SUMMONER') && b.affT > 12) {
        b.affT = 0;
        for (let i = 0; i < 3; i++) G.spawnEnemy(U.pick(['chicken', 'potato', 'intern']), b.x + U.rand(-40, 40), b.y + U.rand(-30, 30), { summoned: true, hpMul: 0.7 });
      }
      if (b.affixes.includes('SHIELD PHASES')) {
        b.shT = (b.shT || 0) + dt;
        if (b.shT > 15 && !b.immune) {
          b.immune = true;
          b.shT = 0;
          FX.ring && FX.ring(b.x, b.y, 14, 50, '#3ccbe6', 0.5);
        } else if (b.immune && b.shT > 2.4) {
          b.immune = false;
          b.shT = 0;
        }
      }
    }
    return orig.call(G, dt);
  });
  X.chain('onHurt', () => {
    if (G.bossAlive()) W.bossHit = true;
  });
  wrap(G, 'onBossDefeated', function (orig, b) {
    const clean = !W.bossHit && b.tier === 0 && G.state === 'playing';
    orig.call(G, b);
    if (clean) {
      const m = X.meta();
      m.noHit = m.noHit || {};
      const first = !m.noHit[b.kind];
      m.noHit[b.kind] = true;
      G.addScore(1000 * G.diff.score);
      G.ui.toast('NO-HIT TROPHY: ' + bossName(b.kind) + '  +1000' + (first ? '  (NEW!)' : ''));
      FX.text(b.x, b.y - 30, 'FLAWLESS!', '#fee761', 2);
      G.runStat && G.runStat('noHitBosses', 1);
      X.save();
    }
    if (X.run.mode === 'rush' && G.wave < W.rush.length) W.cardOwed++;
  });

  /* ------------------------------------------------------------ drawing hooks */
  CH.Hooks.world.push((ctx, cam) => {
    if (G.state === 'menu') return;
    const tx = (x) => Math.round(x - cam.x);
    const ty = (y) => Math.round(y - cam.y);
    const s = W.shrine;
    for (const b of G.enemies) {
      if (!b.isBoss || b.dead || !b.parts) continue;
      b.parts.forEach((p, i) => {
        if (p.dead) return;
        ctx.fillStyle = '#feae34';
        ctx.strokeStyle = '#1b1226';
        ctx.beginPath();
        ctx.arc(tx(p.x), ty(p.y), p.r, 0, U.TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e43b44';
        ctx.fillRect(tx(p.x) - 7, ty(p.y) - p.r - 4, 14 * Math.max(0, p.hp / p.max), 2);
        CH.Font.draw(ctx, b.partNames[i], tx(p.x), ty(p.y) - p.r - 11, '#ffffff', 1, true, 'center');
      });
    }
    if (s && !(s.done || (s.used && s.kind === 'blood'))) {
      const pulse = 1 + Math.sin(G.time * 4) * 0.12;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = s.kind === 'blood' ? '#e43b44' : '#b55088';
      ctx.beginPath();
      ctx.arc(tx(s.x), ty(s.y), 9 * pulse, 0, U.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      CH.Font.draw(ctx, s.kind === 'blood' ? 'BLOOD SHRINE' : 'ELITE SHRINE', tx(s.x), ty(s.y) - 18, '#ffffff', 1, true, 'center');
      if (!s.used) CH.Font.draw(ctx, s.kind === 'blood' ? '-25% HP = FREE CARD' : 'TOUCH TO CHALLENGE', tx(s.x), ty(s.y) - 11, '#feae34', 1, true, 'center');
    }
    if (W.orbs) {
      for (const orb of W.orbs.list) {
        const good = orb.def.good;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = good ? '#63c74d' : orb.def.legendary ? '#feae34' : '#e43b44';
        ctx.beginPath();
        ctx.arc(tx(orb.x), ty(orb.y) + Math.sin(G.time * 3 + orb.x) * 2, orb.r, 0, U.TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        CH.Font.draw(ctx, (orb.def === W.fav ? '[FAV] ' : '') + (good ? '+ ' : orb.def.legendary ? '* ' : '- ') + orb.def.name, tx(orb.x), ty(orb.y) - 22, '#ffffff', 1, true, 'center');
      }
    }
    for (const b of G.enemies) {
      if (!b.isBoss || b.dead || !b.affixes) continue;
      CH.Font.draw(ctx, b.affixes.join(' + '), tx(b.x), ty(b.y) - (b.h || 30) - 14, '#e43b44', 1, true, 'center');
    }
  });
})(window.CH);
