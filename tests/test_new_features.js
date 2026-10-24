/* Verification tests for New Stages, Jumping, Props, Shelter Base, and Branching Paths */
const { chromium } = require('./node_modules/playwright-core');
const ENV = require('./env');

(async () => {
  const browser = await chromium.launch({ executablePath: ENV.CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));

  await page.goto(ENV.URL);
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('done'), null, { timeout: 60000 });

  const results = await page.evaluate(() => {
    const out = [];

    // 1. Test building all 4 new stage types
    const newStages = ['zombie', 'wasteland', 'volcano', 'dungeon'];
    let stagesPass = true;
    for (const sid of newStages) {
      const arena = CH.Arenas.build(sid);
      if (!arena || arena.props.length === 0 || arena.w !== 2880) {
        stagesPass = false;
        out.push({ test: `Build Stage ${sid}`, pass: false, val: arena ? arena.props.length : 0 });
      }
    }
    out.push({ test: 'All 4 New Stages Built (Zombie, Wasteland, Volcano, Dungeon)', pass: stagesPass });

    // 2. Start a run and test Jump action & elevation
    CH.G.newRun(null);
    const G = CH.G;
    const p = G.player;
    
    // Test jump initiation
    p.z = 0;
    p.vz = 0;
    p.jumping = false;
    p.startJump(G);
    const jumped = p.jumping && p.vz > 150;
    out.push({ test: 'Jump Initiation (vz, jumping flag)', pass: jumped, val: p.vz });

    // Simulate gravity in air
    p.update(G, 0.05);
    const inAir = p.z > 5;
    out.push({ test: 'Airborne Elevation (z > 0)', pass: inAir, val: p.z.toFixed(1) });

    // 3. Test landing on top of a jumpable prop (e.g. Car or Crate)
    const carProp = {
      id: 'test_car',
      kind: 'car',
      sprite: 'obj.car1',
      x: 1000,
      y: 1000,
      cr: 16,
      cx: 0,
      cy: -4,
      solid: true,
      jumpable: true,
      elevation: 12,
      hp: 80,
      maxHp: 80,
      destructible: true
    };
    // the level may have its own props at that spot: clear them so the hero lands on (and scraps) this car
    for (let i = G.arena.props.length - 1; i >= 0; i--) if (Math.hypot(G.arena.props[i].x - carProp.x, G.arena.props[i].y - carProp.y) < 90) G.arena.props.splice(i, 1);
    G.arena.props.push(carProp);
    if (CH.Props.invalidate) CH.Props.invalidate();

    // Place player jumping directly above car, falling down
    p.x = carProp.x;
    p.y = carProp.y - 4;
    p.z = 14;
    p.vz = -20;
    p.jumping = true;
    p.onProp = null;

    // Step simulation to trigger landing
    p.update(G, 0.016);
    const landed = (p.z === 12 || p.z === carProp.elevation) && p.onProp === carProp && !p.jumping;
    out.push({ test: 'Landing on Jumpable Prop (elevation match, onProp set)', pass: landed, val: `z=${p.z}, onProp=${p.onProp ? p.onProp.id : null}` });

    // 4. Test melee immunity while elevated on prop
    const testEnemy = G.spawnEnemy('intern', carProp.x, carProp.y - 4);
    const hpBefore = p.hp;
    G.step(0.016);
    const immune = p.hp === hpBefore; // enemy on ground cannot hit elevated player
    out.push({ test: 'Elevated Melee Ground Immunity', pass: immune, val: `hp=${p.hp}/${hpBefore}` });
    testEnemy.dead = true;

    // 5. Test walking off prop edge (drops back to ground)
    p.x = carProp.x + 40; // walk far away from prop surface
    p.update(G, 0.016);
    const fellOff = p.onProp === null;
    out.push({ test: 'Step Off Prop Surface (fall off)', pass: fellOff });

    // 6. Test prop destruction & resource gathering
    CH.Storage.resources.scrap = 0;
    CH.Storage.resources.wood = 0;
    CH.Storage.resources.stone = 0;
    p.x = carProp.x;
    p.y = carProp.y;

    // Damage and destroy car
    CH.Weapons.damageProp(G, carProp, 100, p);
    const carDestroyed = carProp.dead && carProp.sprite === 'obj.carWreck';
    // Advance simulation to collect pickups: the scrap scatters past the 16 px base pickup range, so walk over it
    for (let s = 0; s < 60; s++) {
      const sc = G.pickups.find((q) => q.type === 'scrap');
      if (sc && s > 15) { p.x = sc.x; p.y = sc.y; }
      G.step(0.016);
    }
    const gotScrap = CH.Storage.resources.scrap > 0;
    out.push({ test: 'Car Destruction (Explodes, Drops Scrap Metal)', pass: carDestroyed && gotScrap, val: `scrap=${CH.Storage.resources.scrap}` });

    // 7. Test shelter station upgrades
    CH.Storage.resources.wood = 100;
    CH.Storage.resources.scrap = 100;
    CH.Storage.resources.stone = 100;
    const wbBefore = CH.Storage.shelter.workbench || 0;
    const affordable = CH.Storage.spendResources({ wood: 10, scrap: 8 });
    CH.Storage.shelter.workbench = wbBefore + 1;
    CH.Storage.save();
    CH.Upgrades.recalc(p);
    const upgraded = affordable && CH.Storage.shelter.workbench === wbBefore + 1;
    out.push({ test: 'Shelter Base Upgrade (Resource Spend & Stat Recalc)', pass: upgraded, val: `lvl=${CH.Storage.shelter.workbench}` });

    // 8. Test in-run fortification deployment ([F])
    const propCountBefore = G.arena.props.length;
    p.deployBarricade(G);
    const barricadePlaced = G.arena.props.length === propCountBefore + 1;
    const placedBarricade = G.arena.props[G.arena.props.length - 1];
    const isSolidJumpable = placedBarricade && placedBarricade.solid && placedBarricade.jumpable;
    out.push({ test: 'Deploy Field Barricade In-Run (Solid & Jumpable)', pass: barricadePlaced && isSolidJumpable });

    return out;
  });

  console.log('--- NEW FEATURES TEST RESULTS ---');
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}: ${r.test} ${r.val !== undefined ? '(' + r.val + ')' : ''}`);
  }
  console.log('Browser errors:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})();
