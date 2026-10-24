/* The hideout's new people (PLAN.md 18, K6): Nurse Mercy (food and the revive charge), Dr. Sawbones (body upgrades for
   organs, surgery on the skill tree) and Jesus (a tithe for a three-area blessing), drawn with their own art; what they
   give belongs to the character and is saved with it. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  await page.evaluate(() => {
    const G = CH.G, St = CH.Storage;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Patient' });
    G._scriptTesting = true;
    G.newRun(null);
    G.level = null;
    CH.Town.enter('test');
    G.coins = 5000;
    St.resources.organ = 10;
    /* talk to someone and pick the choice whose label starts with `label` */
    window.__talk = (id, label) => {
      const n = G.level.npcs.find((q) => q.id === id);
      CH.Town.talkTo[id](n, G.player);
      for (let i = 0; i < 6 && !document.querySelector('#dlg-choices .btn'); i++) CH.Dialogue.advance();
      const b = Array.from(document.querySelectorAll('#dlg-choices .btn')).find((x) => x.textContent.startsWith(label));
      const labels = Array.from(document.querySelectorAll('#dlg-choices .btn')).map((x) => x.textContent);
      if (b) b.click();
      else { const last = document.querySelectorAll('#dlg-choices .btn'); if (last.length) last[last.length - 1].click(); }
      for (let i = 0; i < 6 && G.state === 'dialog'; i++) { CH.Dialogue.advance(); const all = document.querySelectorAll('#dlg-choices .btn'); if (all.length) all[all.length - 1].click(); } // close what follows with its last choice (LEAVE / OK)
      return { clicked: !!b, labels };
    };
  });

  // 1. they stand in the hideout with their own art
  let r = await page.evaluate(() => {
    const G = CH.G, L = G.level;
    const ids = ['nurse', 'doctor', 'jesus'];
    const ppl = ids.map((id) => L.npcs.find((q) => q.id === id));
    const n = ppl[2];
    G.player.x = n.px; G.player.y = n.py + 50; G.snapCamera();
    CH.stepFrame(1 / 30); G.render();
    return { here: ppl.map(Boolean), art: ppl.map((q) => q && CH.Clinic.has(q)), blocks: ids.map((id) => L.props.some((p) => p.npc === id)), portrait: CH.Clinic.portrait('jesus').length };
  });
  await page.screenshot({ path: __dirname + '/clinic.png' });
  ok('the nurse, the doctor and Jesus are in the hideout with their own art', r.here.every(Boolean) && r.art.every(Boolean) && r.blocks.every(Boolean) && r.portrait > 100, r);

  // 2. the nurse: food for the belt, a revive charge that gets the party up where it fell
  r = await page.evaluate(() => {
    const G = CH.G, p = G.player;
    const meat0 = (p.belt.find((s) => s && s.id === 'meat') || { n: 0 }).n;
    const a = __talk('nurse', 'MEAT SCRAPS');
    const meat1 = (p.belt.find((s) => s && s.id === 'meat') || { n: 0 }).n;
    const b = __talk('nurse', 'REFILL REVIVE');
    const charged = p.revive;
    CH.Town.leave(); // into stage 1
    const at = { x: p.x, y: p.y };
    p.invuln = 0; p.hp = 1; G.killPlayer(p);
    for (let i = 0; i < 90 && G.allDead(); i++) CH.stepFrame(1 / 30);
    return { a, b, meat0, meat1, charged, alive: !p.dead, town: !!G.level.isTown, left: p.revive, moved: Math.hypot(p.x - at.x, p.y - at.y) };
  });
  ok('the nurse sells food for the belt', r.meat1 === r.meat0 + 1, r);
  ok('the revive charge gets the hero up where they fell, not in the hideout', r.charged === 1 && r.alive && !r.town && r.left === 0 && r.moved < 40, r);

  // 3. the doctor: vitality for organs and gold; surgery gives the skill points back
  r = await page.evaluate(() => {
    const G = CH.G, p = G.player;
    G.level = null; CH.Town.inTown = false; CH.Town.enter('test');
    const hp0 = p.maxHp;
    __talk('doctor', 'VITALITY');
    const hp1 = p.maxHp;
    p.level = 6; p.sp = 1; p.skills = { a1: 2, a2: 1 };
    const spent = CH.Skills.spent(p);
    __talk('doctor', 'SURGERY');
    return { hp0, hp1, vit: p.body.vit, organs: CH.Storage.resources.organ, spent, sp: p.sp, skills: Object.keys(p.skills).length };
  });
  ok('the doctor\'s vitality adds 10% health for organs', r.vit === 1 && r.hp1 >= Math.round(r.hp0 * 1.09) && r.organs === 9, r);
  ok('surgery takes the tree apart and returns every point', r.spent > 0 && r.sp === 1 + r.spent && r.skills === 0, r);

  // 4. Jesus: a tithe for a blessing that lasts three areas
  r = await page.evaluate(() => {
    const G = CH.G, p = G.player;
    const d0 = p.stats.dmgMult;
    __talk('jesus', 'RIGHTEOUS WRATH');
    const after = { bless: p.bless && p.bless.id, left: p.bless && p.bless.left, d1: p.stats.dmgMult };
    CH.Town.leave(); // area 1
    G.startWave(2);
    G.startWave(3 + 1); // the boss arena does not count; area 4 is the third area
    return { d0, after, now: p.bless, d2: p.stats.dmgMult };
  });
  ok('Jesus blesses for a tithe: +20% damage', r.after.bless === 'wrath' && r.after.left === 3 && r.after.d1 > r.d0 * 1.19, r);
  ok('the blessing fades after three areas', r.now === null && Math.abs(r.d2 - r.d0) < 0.01, r);

  // 5. it is all the character's: saved and loaded
  r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage, p = G.player;
    p.revive = 1;
    CH.Character.save();
    G.toMenu();
    St.load();
    G.newRun(null);
    const q = G.player;
    return { vit: q.body.vit, revive: q.revive, meat: (q.belt.find((s) => s && s.id === 'meat') || { n: 0 }).n };
  });
  ok('the body, the revive charge and the belt are saved with the character', r.vit === 1 && r.revive === 1 && r.meat >= 1, r);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
