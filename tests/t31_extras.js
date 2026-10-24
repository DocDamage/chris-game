/* Extras inside the Journal (PLAN.md 18, K0d: the run setups and their launch buttons went with the runs): every tab
   renders, none of them starts anything, and the hero, options, safehouse and companion buttons respond. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  const out = await page.evaluate(() => {
    const G = CH.G, X = CH.X, S = CH.Storage, J = CH.Journal, M = CH.Meta, r = {};
    const openExtras = (tab) => { if (J.open) J.close(true); J.show(0, 2, 'main'); const b = document.querySelector('#xt-tabs [data-v="' + (tab || 'ach') + '"]'); if (b) b.click(); };
    const click = (act, v) => { const el = document.querySelector('#xt-body [data-act="' + act + '"]' + (v !== undefined ? '[data-v="' + v + '"]' : '')); if (!el) return false; el.click(); return true; };
    const tabs = ['ach', 'hero', 'safe', 'sets', 'bestiary', 'opts'];
    r.tabs = {};
    openExtras('ach');
    r.tabList = Array.from(document.querySelectorAll('#xt-tabs [data-act=tab]')).map((b) => b.dataset.v).join(',');
    for (const t of tabs) { document.querySelector('#xt-tabs [data-v="' + t + '"]').click(); r.tabs[t] = document.getElementById('xt-body').textContent.length > 40; }
    r.noLaunch = ['start', 'daily', 'tutorial', 'training', 'mode', 'chal', 'heat+'].every((a) => !document.querySelector('[data-act="' + a + '"]')) && G.state === 'menu';
    // hero tab toggles, options toggle, safehouse buttons, the companion row
    openExtras('hero'); S.data.meta.mastery = { Mercenary: 400 }; M.ui.render();
    r.altBtn = click('alt', 'Mercenary');
    openExtras('opts'); const before = JSON.stringify(X.opts()); r.optToggle = click('opt', 'dpsMeter') && JSON.stringify(X.opts()) !== before;
    openExtras('safe'); r.safeBtns = document.querySelectorAll('#xt-body [data-act]').length >= 1;
    r.companion = /COMPANION/.test(document.getElementById('xt-body').textContent);
    J.close(true);
    r.menuLink = document.getElementById('btn-extras').textContent;
    return r;
  });
  console.log(JSON.stringify(out));
  const ok = Object.values(out.tabs).every(Boolean) && out.tabList === 'ach,hero,safe,sets,bestiary,opts' && out.noLaunch && out.altBtn && out.optToggle && out.safeBtns && out.companion && out.menuLink === 'EXTRAS';
  console.log('errors', errs);
  console.log(ok && !errs.length ? 'ALL PASSED' : 'FAILED');
  await browser.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
