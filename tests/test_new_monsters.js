/* Test suite for the newly added monsters:
   1. 5 Regular Enemies: plant, slime, orc, goblin, spider
   2. 4 New Bosses: dragon, beholder, mage, demon
   3. Expanded VFX pack integration (Packs 2, 3, 4, 6)
*/
const { open } = require('./lib');

(async () => {
  console.log('--- STARTING NEW MONSTERS & BOSSES TEST SUITE ---');
  const { browser, page, errs } = await open();
  let failed = 0;

  function assert(cond, name, details) {
    if (cond) {
      console.log('PASS:', name, details ? '(' + details + ')' : '');
    } else {
      console.error('FAIL:', name, details ? '(' + details + ')' : '');
      failed++;
    }
  }

  // 1. Test Regular Enemies
  const enemyTest = await page.evaluate(() => {
    const G = CH.G;
    G.newRun();
    G.queue.length = 0;
    G.enemies.length = 0;
    G.state = 'playing';
    G.waveState = 'combat';

    const types = ['plant', 'slime', 'orc', 'goblin', 'spider'];
    const spawned = {};
    for (const t of types) {
      const e = G.spawnEnemy(t, 200 + Math.random() * 50, 200 + Math.random() * 50);
      spawned[t] = {
        hasDef: !!e.def,
        hasLook: !!e.look,
        sprite: e.look ? e.look.sprite : null,
        hp: e.hp,
        speed: e.speed,
      };
    }

    // Step world for 60 frames to verify AI updates & projectile spawning
    const startEnemies = G.enemies.length;
    for (let i = 0; i < 60; i++) {
      for (const e of G.enemies) {
        if (!e.dead) e.update(G, 1 / 60);
      }
    }

    // Test slime splitting on death
    const slime = G.enemies.find((e) => e.type === 'slime');
    const slimeInitCount = G.enemies.filter((e) => e.type === 'slime').length;
    if (slime) {
      G.damageEnemy(slime, 999);
      G.killEnemy(slime);
    }
    const slimeAfterCount = G.enemies.filter((e) => e.type === 'slime' && !e.dead).length;

    // Test killing remaining enemies
    for (const e of [...G.enemies]) {
      if (!e.dead) {
        G.damageEnemy(e, 999);
        G.killEnemy(e);
      }
    }

    return {
      typesSpawned: spawned,
      startEnemies,
      slimeInitCount,
      slimeAfterCount,
      deadAll: G.enemies.every((e) => e.dead),
      kills: G.kills,
    };
  });

  for (const t of ['plant', 'slime', 'orc', 'goblin', 'spider']) {
    assert(enemyTest.typesSpawned[t] && enemyTest.typesSpawned[t].hasDef, `Enemy '${t}' Defined & Initialized`, `sprite=${enemyTest.typesSpawned[t].sprite}, hp=${enemyTest.typesSpawned[t].hp}`);
  }
  assert(enemyTest.slimeAfterCount >= 2, 'Slime Splits into Mini-Slimes on Death', `afterCount=${enemyTest.slimeAfterCount}`);
  assert(enemyTest.deadAll && enemyTest.kills >= 5, 'All New Enemies Slayable & Logged Kills', `kills=${enemyTest.kills}`);

  // 2. Test 4 New Bosses
  const newBosses = ['dragon', 'beholder', 'mage', 'demon', 'ooze'];
  for (const bossKind of newBosses) {
    const bRes = await page.evaluate((kind) => {
      const G = CH.G;
      G.newRun();
      G.queue.length = 0;
      G.enemies.length = 0;
      G.state = 'playing';
      G.waveState = 'combat';

      const b = G.spawnBoss(kind, 0);
      const initialHp = b.hp;
      const initialMaxHp = b.maxHp;
      const attacksSeen = new Set();
      const animsSeen = new Set();

      // Bot fights boss
      window.__bot.god = true;
      const p = G.player;
      p.weapons = ['junk', 'pizza', 'chicken'];
      p.weapon = 'pizza';
      for (const w of p.weapons) p.ws[w] = p.ws[w] || CH.Weapons.newState(w);
      p.stats.dmgMult = 6.0; // High damage to test phases & death

      let frames = 0;
      let phase2Triggered = false;
      while (frames < 60 * 60) {
        // Step game and bot
        window.__bot.step(20);
        frames += 20;

        if (b.last) attacksSeen.add(b.last);
        if (b.anim) animsSeen.add(b.anim);
        if (b.enraged || b.phase >= 2) phase2Triggered = true;

        if (b.dead || G.bossKills > 0) break;
      }

      return {
        kind,
        name: b.name,
        initialHp,
        initialMaxHp,
        attacks: [...attacksSeen].filter(Boolean),
        anims: [...animsSeen],
        phase2Triggered,
        bossKills: G.bossKills,
        score: G.score,
        coins: G.coins,
      };
    }, bossKind);

    assert(bRes.initialHp > 500, `Boss '${bossKind}' (${bRes.name}) Spawned with Health Pool`, `hp=${bRes.initialHp}`);
    assert(bRes.attacks.length >= 1, `Boss '${bossKind}' Executed Scripted Attacks`, `attacks=${bRes.attacks.join(', ')}`);
    assert(bRes.phase2Triggered, `Boss '${bossKind}' Entered Enraged Phase 2`);
    assert(bRes.bossKills >= 1, `Boss '${bossKind}' Defeated and Awards Victory`, `score=${bRes.score}, coins=${bRes.coins}`);
  }

  // 3. Test VFX Integration (Packs 2, 3, 4, 6)
  const vfxTest = await page.evaluate(() => {
    const S = CH.Sprites;
    const packs = ['p2', 'p3', 'p4', 'p6'];
    const registered = {};
    for (const pk of packs) {
      let count = 0;
      for (let i = 1; i <= 30; i++) {
        const key = `vfx.${pk}.${i}`;
        if (S.has(key)) count++;
      }
      registered[pk] = count;
    }

    // Trigger Kit elements
    CH.Kit.hit('fire', 100, 100, 15, true);
    CH.Kit.impact('fire', 100, 100, 30);
    CH.Kit.hit('ice', 100, 100, 15, true);
    CH.Kit.impact('ice', 100, 100, 30);
    CH.Kit.hit('bolt', 100, 100, 15, true);
    CH.Kit.impact('bolt', 100, 100, 30);
    CH.Kit.hit('magic', 100, 100, 15, true);
    CH.Kit.impact('magic', 100, 100, 30);

    return {
      registered,
      kitCount: CH.Kit.count,
    };
  });

  for (const [pk, cnt] of Object.entries(vfxTest.registered)) {
    assert(cnt > 0, `VFX Pack ${pk.toUpperCase()} Registered Animations`, `count=${cnt}`);
  }
  assert(vfxTest.kitCount > 0, 'VFX Kit Dispatched Enriched Layer Recipes', `count=${vfxTest.kitCount}`);

  const pageErrs = errs.filter(e => !e.includes('favicon.ico'));
  console.log('Browser errors:', pageErrs.length ? pageErrs.join('\n') : 'none');
  assert(pageErrs.length === 0, 'Zero Browser Console Errors');

  await browser.close();
  if (failed > 0) {
    console.error(`--- TEST SUITE FAILED with ${failed} errors ---`);
    process.exit(1);
  } else {
    console.log('--- ALL NEW MONSTERS & BOSSES TESTS PASSED ---');
    process.exit(0);
  }
})();
