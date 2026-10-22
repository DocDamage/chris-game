/* Town: portal quill, entering, NPC dialogue, the stage is kept, waypoints, the Lost Shrine quest, unique + garage key. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  const out = await page.evaluate(() => {
    const G = CH.G, X = CH.X, S = CH.Storage, T = CH.Town, I = CH.Items, R = CH.Run, r = {};
    const step = (n) => { for (let i = 0; i < n; i++) { if (G.state === 'levelup') while (G.state === 'levelup') G.pickUpgrade(0); if (G.state === 'dialog') CH.Dialogue.skip(); CH.stepFrame(1 / 30); } };
    X.startRun({}, null); G._scriptTesting = true; for (const p of G.players) p.hp = p.maxHp = 1e7;
    step(40);
    const L = G.level; const p = G.player;
    const hives = L.hives.length, alive = G.enemies.length;
    // quill -> portal
    I.addConsumable(p, 'feather', 1); const bi = I.belt(p).findIndex((s) => s && s.id === 'feather');
    r.quill = I.useBelt(p, bi) && !!L.portal;
    r.noSecond = (() => { const was = p.beltCd; p.beltCd = 0; I.addConsumable(p, 'feather', 1); const i = I.belt(p).findIndex((s) => s && s.id === 'feather'); const ok = I.useBelt(p, i); p.beltCd = 0; return ok === false || L.portal; })();
    p.x = L.portal.x; p.y = L.portal.y; step(3);
    r.inTown = T.inTown && G.level.isTown && G.arena === G.level;
    r.npcs = G.level.npcs.length;
    r.noEnemies = G.enemies.length === 0;
    // talk to the elder
    const elder = G.level.npcs.find((n) => n.id === 'elder'); p.x = elder.px; p.y = elder.py + 10;
    G.interact(p); r.dialog = G.state === 'dialog' && CH.Dialogue.open;
    CH.Dialogue.skip(); step(2); r.dialogEnded = G.state === 'playing';
    // vendor opens the shop
    const v = G.level.npcs.find((n) => n.id === 'vendor'); p.x = v.px; p.y = v.py + 10; G.interact(p);
    r.vendorDialog = CH.Dialogue.open; CH.Dialogue.skip(); step(1);
    // leave through the pad: same stage back, enemies and hives preserved
    p.x = G.level.exit.x; p.y = G.level.exit.y; step(3);
    r.back = !T.inTown && G.level === L && G.wave === 1;
    r.kept = L.hives.length === hives && G.enemies.length >= alive && L.hives.every((h) => !h.dead);
    r.portalGone = !L.portal;
    // an active waypoint: interact opens the menu with TO TOWN
    const wp = L.waypoints[0]; wp.active = true; p.x = wp.x; p.y = wp.y; G.interact(p);
    r.wpMenu = CH.Dialogue.open; CH.Dialogue.skip(); step(1);
    // waypoint activation records the stage
    const wp2 = L.waypoints[1]; wp2.active = false; p.x = wp2.x; p.y = wp2.y; step(3);
    r.wpSaved = S.data.diablo.waypoints[1] === true;
    // boss stage clear -> next stage starts in town
    G.startWave(3); step(5); r.bossArena = !G.level;
    G.onBossDefeated({ kind: 'frog', tier: 0, x: 100, y: 100, name: 'x', isBoss: true });
    r.wantTown = T.wantTown === true;
    G.waveComplete(); G.waveT = 0.01; G.waveState = 'clear'; step(40);
    r.actTown = T.inTown && T.pendingStage === 4;
    p.x = G.level.exit.x; p.y = G.level.exit.y; step(3);
    r.nextStage = !T.inTown && G.wave === 4 && G.level && !G.level.isTown;
    // lost shrine in stage 2 when the quest is active; garage key from the zombie unique
    S.data.diablo.quests = {};
    G.startWave(2); step(5);
    r.lostShrine = !!G.level && G.level.shrines.some((s) => s.kind === 'lost');
    const origPath = G.pathArena; G.pathArena = () => 'zombie'; for (let k = 0; k < 6; k++) { G.runSeed = 1000 + k; G.startWave(6); step(2); if (G.level.secrets.some((s) => s.kind === 'garage')) break; } step(3); G.pathArena = origPath;
    const pk = G.level.packs.find((q) => q.unique); r.unique = !!pk && pk.unique === 'Chop-Shop Chuck';
    r.garage = G.level.secrets.some((s) => s.kind === 'garage');
    if (pk) { G.player.x = pk.x; G.player.y = pk.y; step(25); const u = G.enemies.find((e) => e.unique); r.uniqueSpawned = !!u; if (u) { u.hp = 1; G.damageEnemy(u, 999, { src: 'player', shooter: G.player }); r.key = G.garageKey === true; r.dropped = I.ground.length >= 1; } }
    return r;
  });
  console.log(JSON.stringify(out));
  const ok = out.quill && out.inTown && out.npcs === 6 && out.noEnemies && out.dialog && out.dialogEnded && out.vendorDialog && out.back && out.kept && out.portalGone &&
    out.wpMenu && out.wpSaved && out.bossArena && out.wantTown && out.actTown && out.nextStage && out.lostShrine && out.unique && out.garage && out.uniqueSpawned && out.key && out.dropped;
  console.log('errors', errs);
  console.log(ok && !errs.length ? 'ALL PASSED' : 'FAILED');
  await browser.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
