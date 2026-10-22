/* Every boss, one at a time, against a god-mode human-like bot: which attacks fire, do phases trigger, can it be killed? */
const { open } = require('./lib');
(async () => {
  const kinds = (process.argv[2] || 'frog,bd,gol,maw,ceo,chicken,dragon,beholder,mage,demon,ooze,treant,knight,moss,sporeeye,yeti,dunewyrm,bloodwyrm,voideye,daddy,skull,bug').split(',');
  const { browser, page, errs } = await open();
  let bad = 0;
  for (const kind of kinds) {
    await page.evaluate((kind) => {
      const G = CH.G; G.newRun(); G.queue.length = 0; G.enemies.length = 0;
      G.wave = { frog: 3, bd: 3, ceo: 5, maw: 8, gol: 8, chicken: 8, bug: 10, dragon: 8, beholder: 5, mage: 3, demon: 8, ooze: 3, treant: 3, knight: 3, moss: 5, sporeeye: 5, yeti: 8, dunewyrm: 8, bloodwyrm: 8, voideye: 8, daddy: 10, skull: 10 }[kind];
      const b = window.__bot; b.god = true; b.human = { reaction: 14, jitter: 0.09, mistake: 0.1 };
      window.__seen = { attacks: new Set(), phases: new Set(), states: new Set(), maxProj: 0, anims: new Set(), hiddenSeen: false };
      G.spawnBoss(kind, 0);
      G.waveState = 'combat';
      const p = CH.G.player; p.weapons = ['junk', 'pizza', 'chicken']; p.weapon = 'pizza';
      for (const w of p.weapons) p.ws[w] = p.ws[w] || CH.Weapons.newState(w);
      p.stats.dmgMult = 1.4; // roughly what a player has by then
    }, kind);
    let steps = 0, snap;
    while (steps < 60 * 60 * 6) {
      snap = await page.evaluate(() => {
        const G = CH.G, S = window.__seen;
        window.__bot.step(30);
        const boss = G.enemies.find((e) => e.isBoss);
        if (boss) { S.attacks.add(boss.last); S.phases.add(boss.phase); S.states.add(boss.state); if (boss.anim) S.anims.add(boss.anim); if (boss.hidden) S.hiddenSeen = true; }
        S.maxProj = Math.max(S.maxProj, G.projectiles.length);
        return { state: G.state, boss: boss ? Math.round(boss.hp) : null, bossKills: G.bossKills, t: G.time };
      });
      steps += 30;
      if (snap.state === 'gameover' || (!snap.boss && snap.bossKills > 0)) break;
    }
    const seen = await page.evaluate(() => ({ a: [...window.__seen.attacks].filter(Boolean), phases: [...window.__seen.phases], anims: [...window.__seen.anims], maxProj: window.__seen.maxProj, hidden: window.__seen.hiddenSeen }));
    const killed = snap.bossKills > 0;
    if (!killed) bad++;
    console.log((killed ? 'PASS' : 'FAIL'), kind.padEnd(8), 'fight', Math.round(steps / 60) + 's', 'attacks:', seen.a.join(','), '| phases', seen.phases.join('/'), '| anims', seen.anims.length, '| maxProj', seen.maxProj, seen.hidden ? '| hides' : '');
  }
  console.log('console errors:', errs.length ? errs.join('\n') : 'none', JSON.stringify(await page.evaluate(() => CH.errors)), bad ? 'FAILED ' + bad : 'ALL KILLED');
  await browser.close();
})();
