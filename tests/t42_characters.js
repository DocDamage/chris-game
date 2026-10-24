/* Characters in save slots (PLAN.md 18, K0a): no more runs. A fresh start keeps only the old save's settings; the
   character book creates a hero (name, hardcore) and plays them; their level, experience, skills, weapons and gold
   come back next time; characters are separate; deleting asks twice. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ viewport: { width: 1280, height: 720 } });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  // 1. a fresh start: the old save is left alone, only its settings come along
  let r = await page.evaluate(() => {
    localStorage.removeItem(CH.Storage.KEY3);
    localStorage.setItem('chaosexe.save.v1', JSON.stringify({ settings: { master: 0.3 }, stats: { totalKills: 99 }, unlocked: ['Mercenary', 'Vexaria'] }));
    CH.Storage.load();
    const St = CH.Storage;
    return { slots: St.slots().length, active: St.activeIndex(), master: St.settings.master, kills: St.stats.totalKills, unlocked: St.data.unlocked, old: localStorage.getItem('chaosexe.save.v1').includes('"totalKills":99') };
  });
  ok('a fresh start: no characters, the old settings kept, its progress not carried over', r.slots === 0 && r.active === -1 && r.master === 0.3 && r.kills === 0 && r.unlocked.join() === 'Mercenary', r);
  ok('the old save is left untouched', r.old, r);

  // 2. PLAY opens the character book; its last page makes a new character
  await page.evaluate(() => { window.__uikInstant = true; CH.UI.showMenu(); });
  await page.click('#btn-play');
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({ screen: CH.UI.active, title: document.getElementById('hs-title').textContent, button: document.getElementById('hs-pick') && document.getElementById('hs-pick').textContent }));
  ok('PLAY opens the character book on its new-character page', r.screen === 'heroes' && r.title === 'CHARACTERS' && r.button === 'CREATE', r);
  await page.click('#hs-pick');
  await page.waitForTimeout(300);
  await page.fill('#hs-name', 'Ashgrave');
  await page.check('#hs-hc');
  await page.click('#hs-pick');
  await page.waitForTimeout(500);
  r = await page.evaluate(() => { const s = CH.Storage.slot(); return { state: CH.G.state, slot: s && { name: s.name, hero: s.hero, hardcore: s.hardcore, level: s.char.level } }; });
  ok('CREATE makes a named hardcore character and starts playing', r.state === 'playing' && r.slot && r.slot.name === 'Ashgrave' && r.slot.hardcore === true && r.slot.level === 1, r);

  // 3. progress is kept: level, experience, skill points and tree, weapons and their levels, gold
  r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage, p = G.players[0];
    G._scriptTesting = true;
    p.level = 7; p.xp = 12; p.sp = 4; p.skills = { a1: 2 }; G.coins = 345;
    p.weapons.push('pizza'); p.ws.pizza = CH.Weapons.newState('pizza'); p.ws.pizza.level = 3;
    G.pause();
    St.load(); // as after closing the game
    G.newRun(null);
    const q = G.players[0];
    return { active: St.activeIndex(), level: q.level, xp: q.xp, sp: q.sp, skills: q.skills, gold: G.coins, pizza: q.ws.pizza && q.ws.pizza.level, weapon: q.weapon, full: q.hp === q.maxHp };
  });
  ok('pausing saves the character; loading brings back level, experience, skills, weapons and gold', r.active === 0 && r.level === 7 && r.xp === 12 && r.sp === 4 && r.skills.a1 === 2 && r.gold === 345 && r.pizza === 3 && r.full, r);
  ok('the hero still holds their own weapon', r.weapon === 'pulsefist', r);

  // 4. characters are separate; the book lists them; deleting asks twice
  r = await page.evaluate(() => {
    const St = CH.Storage, G = CH.G;
    St.createSlot({ hero: 'Mercenary', name: 'Bo' });
    G.newRun(null);
    const second = { level: G.players[0].level, gold: G.coins };
    St.useSlot(0);
    G.newRun(null);
    const first = { level: G.players[0].level, gold: G.coins };
    G.toMenu();
    return { second, first, names: St.slots().map((s) => s.name) };
  });
  ok('a second character starts fresh and the first keeps theirs', r.second.level === 1 && r.second.gold === 0 && r.first.level === 7 && r.first.gold === 345 && r.names.join() === 'Ashgrave,Bo', r);
  await page.evaluate(() => { window.__uikInstant = true; CH.UI.showMenu(); });
  await page.click('#btn-play');
  await page.waitForTimeout(300);
  await page.click('#hs-del');
  r = await page.evaluate(() => ({ n: CH.Storage.slots().length, label: document.getElementById('hs-del').textContent }));
  ok('DELETE asks first', r.n === 2 && r.label === 'SURE?', r);
  await page.click('#hs-del');
  r = await page.evaluate(() => ({ names: CH.Storage.slots().map((s) => s.name), saved: JSON.parse(localStorage.getItem(CH.Storage.KEY3)).slots.map((s) => s.name) }));
  ok('the second click deletes the character, in the save too', r.names.join() === 'Bo' && r.saved.join() === 'Bo', r);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
