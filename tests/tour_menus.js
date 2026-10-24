/* Screenshots of every menu for a human to look at (not a test): main menu, the character book and its new-character
   page, pause, the Journal's tabs, the skill tree, the map, the vendor and a conversation.
     node tests/tour_menus.js [outDir]   (default out: tests/tour/) */
const path = require('path');
const fs = require('fs');
const { open } = require('./lib');
(async () => {
  const out = path.resolve(process.argv[2] || path.join(__dirname, 'tour'));
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, errs } = await open({ levels: true, manual: false });
  const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, name + '.png') }); };
  const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(250); };

  await page.evaluate(() => { const St = CH.Storage; localStorage.removeItem(St.KEY3); St.load(); St.createSlot({ hero: 'Mercenary', name: 'Tourist' }); St.save(); });
  await page.reload();
  await page.waitForFunction(() => window.CH && CH.G && CH.G.ui);
  await shot('m01_main');
  await page.click('#btn-play');
  await shot('m02_characters');
  // the new-character page: the last page of the book
  for (let i = 0; i < 4; i++) { await key('ArrowRight'); }
  await shot('m03_newchar');
  await key('Escape');
  await page.click('#btn-play').catch(() => {});
  await page.waitForTimeout(300);
  await shot('m03b_characters_again');
  await page.click('#hs-pick');
  for (let i = 0; i < 40 && !(await page.evaluate(() => CH.G.state === 'playing')); i++) await page.waitForTimeout(150);
  await page.waitForTimeout(1500);
  await shot('m04_play');
  await key('Escape');
  await shot('m05_pause');
  await key('Escape');
  await key('KeyJ');
  await shot('m06_journal');
  for (let t = 1; t < 6; t++) { await key('KeyE'); await shot('m07_journal_tab' + t); }
  await key('Escape');
  await key('KeyI');
  await shot('m08_inventory');
  await key('Escape');
  await key('KeyK');
  await shot('m09_skills');
  await key('Escape');
  await key('KeyN');
  await shot('m10_map');
  await key('Escape');
  // the hideout's vendor and a conversation
  await page.evaluate(() => { if (CH.Town && !CH.Town.inTown) CH.Town.enter('load'); });
  await page.waitForTimeout(800);
  await shot('m11_hideout');
  await page.evaluate(() => { const G = CH.G, n = G.level && G.level.npcs && G.level.npcs.find((q) => q.id === 'vendor'); if (n) { G.player.x = n.px; G.player.y = n.py + 24; G.interact(G.player); } });
  await shot('m12_talk');
  await page.evaluate(() => { const G = CH.G; G.machine = G.machine || { x: G.player.x, y: G.player.y, uses: 1, t: 0, town: true }; CH.Dialogue && CH.Dialogue.close && CH.Dialogue.close(); CH.Shop.openFor(G.player); });
  await shot('m13_shop');
  if (errs.length) console.log('console errors:', errs.slice(0, 8));
  await browser.close();
})();
