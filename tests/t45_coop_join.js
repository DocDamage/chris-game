/* Co-op joining (PLAN.md 18, K0e): in the lobby each player picks a saved character or a guest hero. Player 1's
   character hosts (the world and the gold are theirs); a partner's own character brings its level, skills, weapons and
   gear and its progress is saved back; a guest starts at player 1's level and nothing of it is saved. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  // two characters: the host (level 9, 500 gold) and a partner (level 4 with a skill, a second weapon, a helm)
  let r = await page.evaluate(() => {
    const St = CH.Storage;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Vexaria', name: 'Partner' });
    St.setChar({ level: 4, xp: 3, sp: 1, skills: { a1: 1 }, gold: 77, weapons: ['pulsefist', 'pizza'], ws: { pizza: { level: 2 } }, weapon: 'pulsefist' }, 0);
    const helm = CH.Items.roll(3, { slot: 'helm', rarity: 'magic' });
    St.data.diablo.equipped.Vexaria = { helm }; // the live data of the active character
    St.save();
    St.createSlot({ hero: 'Mercenary', name: 'Host' });
    St.setChar({ level: 9, xp: 0, sp: 0, skills: {}, gold: 500, weapons: ['pulsefist'], ws: {}, weapon: 'pulsefist' }, 0);
    return { names: St.slots().map((s) => s.name), active: St.activeIndex(), helm: !!(St.slots()[0].data.diablo.equipped.Vexaria || {}).helm };
  });
  ok('two characters, the host is active', r.names.join() === 'Partner,Host' && r.active === 1 && r.helm, r);

  // the lobby: player 1 plays the active character; player 2 starts as a guest and can pick the other character
  r = await page.evaluate(() => {
    const L = CH.Lobby;
    CH.UI.showMenu();
    L.open({ kind: 'kbm' });
    L.join({ kind: 'pad', index: 0 });
    const p1 = { slot: L.slots[0].slot, hero: L.slots[0].hero };
    const p2start = { slot: L.slots[1].slot };
    const entries = L.entries(1).map((e) => e.slot + ':' + e.hero);
    for (let i = 0; i < 12 && L.slots[1].slot !== 0; i++) L.cycleHero({ kind: 'pad', index: 0 }, 1);
    L.refresh();
    return { p1, p2start, entries, p2: L.slots[1].slot, label: document.querySelector('#lslot-1 .lhero').textContent, label1: document.querySelector('#lslot-0 .lhero').textContent };
  });
  ok('player 1 plays the active character, player 2 starts as a guest', r.p1.slot === 1 && r.p1.hero === 'Mercenary' && r.p2start.slot === -1, r);
  ok('player 2 can pick the other saved character (not the host) or a guest', r.entries[0] === '0:Vexaria' && !r.entries.includes('1:Mercenary') && r.entries.some((e) => e.startsWith('-1:')) && r.p2 === 0 && /PARTNER/.test(r.label) && /HOST/.test(r.label1), r);

  // start: each brings their own
  r = await page.evaluate(() => {
    const G = CH.G;
    CH.Lobby.start();
    G._scriptTesting = true;
    const [a, b] = G.players;
    return { state: G.state, n: G.players.length, active: CH.Storage.activeIndex(), host: { hero: a.hero.id, level: a.level }, gold: G.coins, partner: { hero: b.hero.id, level: b.level, skills: b.skills, pizza: b.ws.pizza && b.ws.pizza.level, guest: !!b.guest, helm: !!CH.Items.equippedOf(b).helm } };
  });
  ok('the host plays their character with their gold', r.state === 'playing' && r.n === 2 && r.active === 1 && r.host.hero === 'Mercenary' && r.host.level === 9 && r.gold === 500, r);
  ok('the partner brings level, skills, weapons and gear', r.partner.hero === 'Vexaria' && r.partner.level === 4 && r.partner.skills.a1 === 1 && r.partner.pizza === 2 && r.partner.helm && !r.partner.guest, r);

  // the partner's progress is saved with the host's saves; their own gold is untouched
  r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage;
    G.players[1].level = 5;
    G.coins = 650;
    CH.Character.save();
    const saved = JSON.parse(localStorage.getItem(St.KEY3)).slots;
    return { partner: saved[0].char.level, partnerGold: saved[0].char.gold, host: saved[1].char.gold };
  });
  ok('the partner\'s level is saved to their character, the gold stays the host\'s', r.partner === 5 && r.partnerGold === 77 && r.host === 650, r);

  // a guest: the host's level, nothing saved
  r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage, L = CH.Lobby;
    G.toMenu();
    L.open({ kind: 'kbm' });
    L.join({ kind: 'pad', index: 0 });
    L.slots[1].hero = 'Dreadbloom';
    L.slots[1].slot = -1;
    const before = St.slots().length;
    L.start();
    G._scriptTesting = true;
    const b = G.players[1];
    CH.Character.save();
    return { guest: !!b.guest, level: b.level, sp: b.sp, host: G.players[0].level, slots: St.slots().length === before, hero: b.hero.id };
  });
  ok('a guest starts at the host\'s level with matching skill points and is not saved', r.guest && r.level === r.host && r.sp === r.level - 1 && r.slots && r.hero === 'Dreadbloom', r);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
