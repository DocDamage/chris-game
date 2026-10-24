/* The cult house and Lucifer (PLAN.md 18, K9): a house with the purple eye door in the hideout leads into a room where
   cultists pray round a pentagram and Lucifer sits on a throne; cultists give dark tasks for favour, Lucifer trades
   favour for pacts (a boon and a curse), the Cult Sigil and a reforge; Jesus lifts the curses; all of it is saved with
   the character. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  await page.evaluate(() => {
    const G = CH.G, St = CH.Storage;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Heretic' });
    G._scriptTesting = true;
    G.newRun(null);
    G.level = null;
    CH.Town.enter('test');
    window.__talk = (id, label) => {
      const n = G.level.npcs.find((q) => q.id === id);
      CH.Town.talkTo[id](n, G.player);
      for (let i = 0; i < 6 && !document.querySelector('#dlg-choices .btn'); i++) CH.Dialogue.advance();
      const labels = Array.from(document.querySelectorAll('#dlg-choices .btn')).map((x) => x.textContent);
      const b = Array.from(document.querySelectorAll('#dlg-choices .btn')).find((x) => x.textContent.startsWith(label));
      if (b) b.click();
      for (let i = 0; i < 6 && G.state === 'dialog'; i++) { CH.Dialogue.advance(); const all = document.querySelectorAll('#dlg-choices .btn'); if (all.length) all[all.length - 1].click(); }
      return { clicked: !!b, labels };
    };
  });

  // 1. the house and the way in
  let r = await page.evaluate(() => {
    const G = CH.G, H = G.level, p = G.player;
    const door = H.cultDoor;
    p.x = door.x; p.y = door.y - 12 + 4; // standing in the doorway
    CH.stepFrame(1 / 30);
    G.interact(p); // the door opens with the button (PLAN.md 20)
    const L = G.level;
    const people = L.npcs ? L.npcs.map((n) => n.id) : [];
    const art = L.npcs ? L.npcs.every((n) => CH.Clinic.has(n)) : false;
    for (let i = 0; i < 3; i++) CH.stepFrame(1 / 30);
    G.render();
    return { door: !!door, inside: !!L.interior, people, art, pentagram: (L.decals || []).some((d) => d.key === 'kit.hv_pentagram') };
  });
  await page.screenshot({ path: __dirname + '/cult.png' });
  ok('the cult house stands in the hideout and its door leads in', r.door && r.inside, r);
  ok('inside: Lucifer and four cultists with their own art, round a pentagram', r.people.join() === 'lucifer,cult1,cult2,cult3,cult4' && r.art && r.pentagram, r);

  // 2. a task for favour; a pact; the sigil; a reforge
  r = await page.evaluate(() => {
    const G = CH.G, K = CH.Cult;
    const t = __talk('cult1', 'THE DARK');
    const task = K.state().task && K.state().task.id;
    // kill a champion in the dark
    CH.Atmos.dark = 0.8;
    const e = G.spawnEnemy('orc', G.player.x + 60, G.player.y, { elite: true });
    G.killEnemy(e);
    const favour = K.state().favour;
    K.state().favour = 10;
    const d0 = G.player.stats.dmgMult, hp0 = G.player.maxHp;
    __talk('lucifer', 'PACT: HELLFIRE');
    const pact = { d: G.player.stats.dmgMult / d0, hp: G.player.maxHp / hp0, cursed: K.cursed() };
    __talk('lucifer', 'THE CULT SIGIL');
    const sigil = CH.Secrets.has('sigil');
    const it = CH.Items.roll(3, { slot: 'helm', rarity: 'magic' });
    CH.Items.equippedOf(G.player).helm = it;
    __talk('lucifer', 'REFORGE');
    const re = CH.Items.equippedOf(G.player).helm;
    return { task, favour, pact, sigil, reforged: re !== it && re.ilvl === it.ilvl + 2, frail: K.state().frail, left: K.state().favour };
  });
  ok('a cultist gives a dark task; a champion killed in the dark earns favour', r.task === 'dark' && r.favour === 1, r);
  ok('Lucifer\'s pact: +35% damage, cursed with -25% health', Math.abs(r.pact.d - 1.35) < 0.02 && r.pact.hp < 0.8 && r.pact.cursed, r);
  ok('the Cult Sigil and a reforge (two levels up, cursed FRAIL)', r.sigil && r.reforged && r.frail === 1 && r.left === 10 - 2 - 3 - 1, r);

  // 3. back out; Jesus lifts the curses, the boons stay; saved
  r = await page.evaluate(() => {
    const G = CH.G, K = CH.Cult, L = G.level, p = G.player;
    p.x = L.exit.x; p.y = L.exit.y;
    CH.stepFrame(1 / 30);
    const out = !G.level.interior && !!G.level.hideout;
    const d0 = p.stats.dmgMult;
    __talk('jesus', 'LIFT MY CURSES');
    const lifted = !K.cursed() && p.stats.dmgMult === d0;
    CH.Character.save();
    const saved = JSON.parse(localStorage.getItem(CH.Storage.KEY3)).slots[0].world.cult;
    return { out, lifted, saved };
  });
  ok('the way out leads back to the hideout', r.out, r);
  ok('Jesus lifts the curses, the pact\'s boon stays', r.lifted, r);
  ok('the cult\'s book is saved with the character', r.saved && r.saved.pacts.length === 1 && r.saved.pacts[0].cursed === false && r.saved.favour === 4, r);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
