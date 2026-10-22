/* Sidekicks: every hero gets its main sidekick, all 17 are registered, run their AI and attacks, take damage,
   revive (Archangel rebirth), unlock + choose persist. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ sidekicks: true });
  const out = await page.evaluate(async () => {
    const G = CH.G, X = CH.X, S = CH.Storage, SK = CH.SK, r = {};
    const step = (n) => { for (let i = 0; i < n; i++) CH.stepFrame(1 / 30); };
    r.defs = SK.ORDER.length;
    r.sheets = SK.ORDER.filter((id) => CH.Sprites.has('sk.' + id)).length;
    r.mains = {};
    for (const h of CH.Balance.heroes) {
      S.settings.hero = h.id;
      X.startRun({}, null); G._scriptTesting = true; G.startWave(2);
      r.mains[h.id] = SK.list.length === 1 ? SK.list[0].id : 'none:' + SK.list.length;
    }
    // every sidekick fights: damage, kills, no exceptions
    r.fight = {};
    for (const id of SK.ORDER) {
      S.settings.hero = 'Mercenary';
      SK.unlock(id, true); SK.choose('Mercenary', id);
      X.startRun({}, null); G._scriptTesting = true; G.startWave(2);
      const p = G.player; p.hp = p.maxHp = 1e6;
      const s = SK.list[0];
      const hp0 = [];
      for (let i = 0; i < 6; i++) { const e = G.spawnEnemy('orc', p.x + 60 + i * 12, p.y + (i - 3) * 14, {}); e.hp = e.maxHp = 400; hp0.push(e); }
      step(240);
      const dealt = hp0.reduce((a, e) => a + (e.maxHp - Math.max(0, e.hp)), 0);
      r.fight[id] = { id: s && s.id, dealt: Math.round(dealt), kills: s ? s.kills : -1, hp: s ? Math.round(s.hp) : -1 };
      CH.stepFrame(1 / 30); // renders the sidekick
    }
    // damage + down + respawn
    S.settings.hero = 'Mercenary'; SK.choose('Mercenary', 'kael');
    X.startRun({}, null); G._scriptTesting = true; G.startWave(2);
    G.player.hp = G.player.maxHp = 1e6; const s = SK.list[0]; s.invuln = 0;
    SK.hurt(s, 50, null); r.hurt = s.hp < s.maxHp;
    s.invuln = 0; SK.hurt(s, 1e6, null); r.down = s.state === 'down';
    step(30 * 26); r.back = s.state !== 'down' && s.hp > 0;
    // Archangel rebirth
    SK.choose('Mercenary', 'archangel');
    X.startRun({}, null); G._scriptTesting = true; G.startWave(2);
    const p = G.player; const a = SK.list[0];
    p.hp = 1; G.killPlayer(p);
    r.rebirth = !p.dead && p.hp >= p.maxHp * 0.4 && a.reviveReady === false;
    // persisted choice
    S.save(); S.load();
    r.persist = S.data.sidekicks.pick.Mercenary === 'archangel' && S.data.sidekicks.unlocked.includes('aurex');
    r.locked = SK.isUnlocked('aurex');
    S.reset();
    r.afterReset = SK.isUnlocked('aurex') === false;
    return r;
  });
  console.log(JSON.stringify(out));
  const heroes = Object.keys(out.mains);
  const okMains = out.mains.Mercenary === 'kael' && out.mains.Dreadbloom === 'velkhar' && out.mains.Vexaria === 'inferna' && out.mains.Enchantress === 'elowen' && out.mains.Specter === 'viper' && out.mains.Stranger === 'archangel';
  const okFight = Object.values(out.fight).every((f) => f.dealt > 0);
  const ok = out.defs === 17 && out.sheets === 17 && okMains && okFight && out.hurt && out.down && out.back && out.rebirth && out.persist && out.locked && out.afterReset;
  console.log('errors', errs);
  console.log(ok && !errs.length ? 'ALL PASSED' : 'FAILED');
  await browser.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
