/* Menus of the UI pack: pause icon row, the character book (Gold book), map scroll, dialogue, Journal keys. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  const out = await page.evaluate(() => {
    const G = CH.G, X = CH.X, S = CH.Storage, UI = CH.UI, r = {};
    const step = (n) => { for (let i = 0; i < n; i++) CH.stepFrame(1 / 30); };
    const key = (code) => { const e = new KeyboardEvent('keydown', { code, key: code }); UI.onMenuKey(e); };
    // main menu: PLAY opens the character book (PLAN.md 18, K0a); with no characters it opens on the page that makes one
    r.menuBtns = !document.getElementById('btn-heroes') && !!document.getElementById('btn-journal');
    document.getElementById('btn-play').click();
    r.heroesOpen = CH.UI.active === 'heroes' && document.getElementById('hs-pick').textContent === 'CREATE';
    document.getElementById('hs-pick').click();
    r.heroPage = !!document.getElementById('hs-turn') && !!document.getElementById('hs-name');
    key('ArrowRight'); r.flipped = document.querySelector('#hs-host .jp-name') !== null;
    // unlock all heroes, browse to the Specter and pick it
    S.data.unlocked = CH.Balance.heroes.map((h) => h.id);
    const idx = CH.Balance.heroes.findIndex((h) => h.id === 'Specter');
    for (let i = 0; i < 8 && document.querySelector('#hs-host .jp-name').textContent.indexOf('Neon Specter') < 0; i++) key('ArrowRight');
    document.getElementById('hs-pick').click();
    r.picked = !!S.slot() && S.slot().hero === 'Specter' && S.settings.hero === 'Specter' && G.state === 'playing';
    // the rest runs without a character
    G.toMenu();
    S.useSlot(-1);
    S.settings.hero = 'Mercenary';
    // pause menu icon row
    X.startRun({}, null); G._scriptTesting = true; step(10);
    G.pause();
    r.pauseIcons = document.querySelectorAll('#screen-pause .pz-btn').length;
    r.paper = document.querySelector('#screen-pause .panel').classList.contains('paper');
    document.querySelectorAll('#screen-pause .pz-btn')[1].click();
    r.invFromPause = CH.Journal.open && CH.Journal.tab === 1;
    CH.Journal.close(); r.closedToPause = !CH.Journal.open && G.state === 'paused';
    // map scroll
    document.querySelectorAll('#screen-pause .pz-btn')[6].click();
    r.mapOpen = CH.MapScroll.open && CH.UI.active === 'map';
    r.mapCanvas = document.getElementById('ms-cv').width === 440;
    CH.MapScroll.flip(1); r.page2 = CH.MapScroll.page === 1; CH.MapScroll.flip(1);
    CH.MapScroll.close(); r.mapClosed = !CH.MapScroll.open && G.state === 'paused';
    G.resume(); step(2);
    // keys J / N / I in play
    UI.onGlobalKey('journal'); r.jKey = CH.Journal.open && G.state === 'paused';
    UI.onGlobalKey('journal'); r.jClose = !CH.Journal.open && G.state === 'playing';
    UI.onGlobalKey('map'); r.nKey = CH.MapScroll.open && G.state === 'paused';
    UI.onGlobalKey('map'); r.nClose = !CH.MapScroll.open && G.state === 'playing';
    // dialogue: say, advance, choices, bark, popup
    let chose = false;
    CH.Dialogue.say({ who: 'TEST', portrait: 'npc:1', lines: ['Hello there, hero.', 'Choose.'], choices: [{ label: 'OK', fn: () => { chose = true; } }] });
    r.dlgPause = G.state === 'dialog';
    CH.Dialogue.advance(); CH.Dialogue.advance(); CH.Dialogue.advance();
    document.querySelector('#dlg-choices .btn').click();
    r.dlgChose = chose && G.state === 'playing';
    CH.Dialogue.bark(G.player, 'Watch out!'); step(5); r.bark = CH.Dialogue.barks.length === 1;
    CH.Dialogue.popup('FOUND SOMETHING'); r.popup = document.querySelectorAll('.toast.popup').length === 1;
    // gold variant for reward screens exists and highlighter vars are set
    r.hl = getComputedStyle(document.getElementById('stage')).getPropertyValue('--hl-wide').indexOf('data:image') >= 0;
    return r;
  });
  console.log(JSON.stringify(out));
  const ok = Object.values(out).every((v) => v === true || v >= 7);
  console.log('errors', errs);
  console.log(ok && !errs.length ? 'ALL PASSED' : 'FAILED');
  await browser.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
