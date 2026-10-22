/* CHAOS.exe - the Journal: one Pixel Book with six tabs replaces the separate Settings / Codex / Stats / Safehouse /
   Extras screens (PLAN.md R6). The book frames, tab strip and page flips come from the Mini Pocket Status pack.
   Existing screens keep their logic: a page can "adopt" a screen's panel into the book and hand it back when the
   page is left. Anything that used to show one of those screens is redirected here (see the UI.show wrapper).
   Tabs (pack Tab icons Style 2): 1 quill Journal, 2 bag Inventory, 3 shirt Equipment, 4 red book Codex,
   5 floppy Save & Quit, 6 gear Settings. The map is a separate scroll (js/mapscroll.js). */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const G = CH.G;
  const UI = CH.UI;
  const UIK = CH.UIK;
  const Audio = CH.Audio;
  const Storage = CH.Storage;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const J = (CH.Journal = { open: false, tab: 0, page: 0, color: 'brown', pages: [[], [], [], [], [], []], from: null });

  const TABS = [
    { id: 'journal', name: 'JOURNAL' },
    { id: 'inventory', name: 'INVENTORY' },
    { id: 'equipment', name: 'EQUIPMENT' },
    { id: 'codex', name: 'CODEX' },
    { id: 'save', name: 'SAVE & QUIT' },
    { id: 'settings', name: 'SETTINGS' },
  ];
  J.TABS = TABS;
  /* register a page: J.addPage('journal', { title, render(host, J) -> optional cleanup fn }) */
  J.addPage = (tabId, page) => {
    const i = TABS.findIndex((t) => t.id === tabId);
    if (i >= 0) J.pages[i].push(page);
  };

  /* geometry in pack pixels inside the 768x640 book frame (measured from the sprites) */
  const GEO = { spread: { x: 158, y: 176, w: 460, h: 276 }, tabX: 628, tabY: [220, 257, 295, 334, 373, 412], tabW: 36, tabH: 34 };

  let root, book, frame, host, pager, tabsEl, titleEl, busy = false, cleanup = null, flipT = null;

  function build() {
    const el = document.createElement('div');
    el.className = 'screen dim';
    el.id = 'screen-journal';
    el.innerHTML =
      '<div class="jb c-brown" id="jb">' +
      '<img class="jb-frame" id="jb-frame" alt="" draggable="false">' +
      '<div class="jb-title" id="jb-title"></div>' +
      '<div class="jb-host" id="jb-host"></div>' +
      '<div class="jb-tabs" id="jb-tabs"></div>' +
      '<div class="jb-pager" id="jb-pager"></div>' +
      '</div>' +
      '<div class="jb-hint">Q / E tabs &nbsp; &larr; &rarr; pages &nbsp; ESC close</div>';
    $('screen-pause').parentNode.appendChild(el);
    UI.SCREENS.push('journal');
    root = el;
    book = $('jb');
    frame = $('jb-frame');
    host = $('jb-host');
    pager = $('jb-pager');
    tabsEl = $('jb-tabs');
    titleEl = $('jb-title');
    TABS.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'jb-tab';
      b.title = t.name;
      b.setAttribute('aria-label', t.name);
      b.style.top = 'calc(var(--p) * ' + (GEO.tabY[i] - GEO.tabH / 2) + ')';
      b.addEventListener('click', () => J.go(i, 0));
      tabsEl.appendChild(b);
    });
  }

  const F = (dir, n) => UIK.frames(J.color, dir, n);
  // frame 1 of the tab strip has no tab pulled out, so tab i is frame i + 2
  const tabFrame = (i) => UIK.cUrl(J.color, 'Pixel Book/Sprites/Categories/Tabs/With icons/' + (i + 2) + '.png');
  const staticFrame = () => UIK.cUrl(J.color, 'Pixel Book/Sprites/Static/1.png');

  function setContentVisible(on) {
    host.style.visibility = on ? 'visible' : 'hidden';
    pager.style.visibility = on ? 'visible' : 'hidden';
    titleEl.style.visibility = on ? 'visible' : 'hidden';
    tabsEl.style.visibility = on ? 'visible' : 'hidden';
  }

  /* ------------------------------------------------------------------ open / close */
  J.show = function (tab, page, from, color) {
    if (!UIK.on || !root) return false;
    if (J.open) {
      J.go(tab === undefined ? J.tab : tab, page || 0);
      return true;
    }
    J.open = true;
    J.from = from || UI.active || null;
    J.color = color || 'brown';
    book.className = 'jb c-' + J.color;
    J.tab = tab === undefined ? 0 : tab;
    J.page = page || 0;
    UI.show('journal');
    Audio.sfx('page');
    busy = true;
    setContentVisible(false);
    const open = F('Open & Close/Open', 8);
    UIK.anim(frame, open, 14, {
      onDone() {
        UIK.anim(frame, F('Categories/Appear/with icons', 11), 18, {
          onDone() {
            busy = false;
            renderPage();
          },
        });
      },
    });
    return true;
  };

  J.close = function (silent) {
    if (!J.open) return;
    leavePage();
    busy = true;
    setContentVisible(false);
    const done = () => {
      J.open = false;
      busy = false;
      const back = J.from;
      J.from = null;
      Storage.save();
      if (G.state === 'paused' && J.resumeOnClose) {
        J.resumeOnClose = false;
        UI.hideAll();
        G.resume();
      } else if (back && back !== 'journal' && root.parentNode.querySelector('#screen-' + back)) UI.show(back);
      else UI.show(G.state === 'paused' ? 'pause' : 'main');
    };
    if (silent) return done();
    Audio.sfx('back');
    UIK.anim(frame, F('Categories/Disappear/with icons', 11), 24, {
      onDone() {
        UIK.anim(frame, F('Open & Close/Close', 8), 18, { onDone: done });
      },
    });
  };

  /* ------------------------------------------------------------------ pages */
  function leavePage() {
    if (cleanup) {
      try { cleanup(); } catch (e) { /* page cleanup must never block navigation */ }
      cleanup = null;
    }
    host.textContent = '';
  }

  /* move an existing screen's panel into the page, and give it back when the page is left */
  J.adopt = function (screenId) {
    const scr = $('screen-' + screenId);
    const panel = scr && scr.querySelector('.panel');
    if (!panel) return null;
    const holder = scr;
    panel.classList.add('adopted');
    host.appendChild(panel);
    return () => {
      panel.classList.remove('adopted');
      holder.appendChild(panel);
    };
  };

  function renderPage() {
    leavePage();
    const list = J.pages[J.tab];
    J.page = U.clamp(J.page, 0, Math.max(0, list.length - 1));
    const pg = list[J.page];
    frame.src = tabFrame(J.tab);
    setContentVisible(true);
    titleEl.textContent = TABS[J.tab].name + (pg && pg.title ? ' - ' + pg.title : '');
    if (pg) cleanup = pg.render(host, J) || null;
    // pager: pack page-button sprite (arrows + number plaque) when there is more than one page
    pager.innerHTML = '';
    if (list.length > 1) {
      pager.innerHTML =
        `<button class="jb-pg l" aria-label="previous page"></button><img class="jb-pgimg" alt="" src="${UIK.cUrl(J.color, 'Content/Buttons/1.png')}"><span class="jb-pgnum">${J.page + 1}</span><button class="jb-pg r" aria-label="next page"></button>`;
      pager.querySelector('.l').onclick = () => J.go(J.tab, J.page - 1);
      pager.querySelector('.r').onclick = () => J.go(J.tab, J.page + 1);
    }
    tabsEl.querySelectorAll('.jb-tab').forEach((b, i) => b.classList.toggle('on', i === J.tab));
    const first = host.querySelector('.btn, .card, .swatch, .codex-item, input');
    if (first && first.focus) first.focus({ preventScroll: true });
  }

  /* go to tab i, page p with a page flip */
  J.go = function (i, p) {
    if (!J.open || busy) return;
    i = (i + TABS.length) % TABS.length;
    const list = J.pages[i];
    if (p < 0) {
      if (i === J.tab || true) { // before the first page: previous tab's last page
        const pi = (i - 1 + TABS.length) % TABS.length;
        if (i === J.tab) return J.go(pi, J.pages[pi].length - 1);
      }
      p = 0;
    }
    if (p >= list.length) {
      if (i === J.tab) return J.go(i + 1, 0);
      p = 0;
    }
    if (i === J.tab && p === J.page && host.firstChild) return;
    const forward = i > J.tab || (i === J.tab && p > J.page);
    busy = true;
    leavePage();
    setContentVisible(false);
    Audio.sfx('page');
    J.tab = i;
    J.page = p;
    UIK.anim(frame, F('Page Flip/' + (forward ? 'Right' : 'Left'), 9), 22, {
      onDone() {
        busy = false;
        renderPage();
      },
    });
  };

  /* keys: Q / E tabs, arrows pages (inside the page, up/down still move focus) */
  const prevMenuKey = UI.onMenuKey;
  UI.onMenuKey = function (e) {
    if (UI.active === 'journal') {
      if (e.code === 'KeyQ') { J.go(J.tab - 1, 0); return; }
      if (e.code === 'KeyE') { J.go(J.tab + 1, 0); return; }
      const t = e.target;
      const typing = t && (t.type === 'range' || t.type === 'text' || t.tagName === 'SELECT');
      if (!typing && (e.code === 'ArrowLeft' || e.code === 'PageUp')) { J.go(J.tab, J.page - 1); e.preventDefault(); return; }
      if (!typing && (e.code === 'ArrowRight' || e.code === 'PageDown')) { J.go(J.tab, J.page + 1); e.preventDefault(); return; }
    }
    return prevMenuKey(e);
  };
  Input_hook();
  function Input_hook() {
    CH.Input.onMenuKey = UI.onMenuKey;
  }

  /* ESC / B closes the book instead of falling through to the pause logic */
  const prevGlobal = UI.onGlobalKey;
  UI.onGlobalKey = function (a) {
    if (a === 'pause' && J.open) {
      if (!busy) J.close();
      return;
    }
    if (a === 'journal' || a === 'inventory') {
      if (J.open) return J.close();
      if (G.state === 'playing') {
        J.resumeOnClose = true;
        G.pause();
        J.show(a === 'inventory' ? 1 : 0, 0, 'pause', UIK.colorFor(0));
      } else if (G.state === 'menu' && (!UI.active || UI.active === 'main')) J.show(0, 0, 'main');
      return;
    }
    return prevGlobal(a);
  };
  CH.Input.onGlobal = UI.onGlobalKey;

  /* ------------------------------------------------------------------ redirect the old screens */
  const REDIRECT = { settings: [5, 0], codex: [3, 0], stats: [0, 3], extras: [0, 2], shelter: [1, 2] };
  const prevShow = UI.show;
  UI.show = function (name) {
    if (REDIRECT[name] && UIK.on && !J.adopting) {
      const r = REDIRECT[name];
      const from = UI.active && UI.active !== 'journal' ? UI.active : J.from;
      if (J.open) J.go(r[0], r[1]);
      else {
        if (UI.backTo !== 'pause') UI.backTo = UI.backTo || null;
        J.show(r[0], r[1], from, name === 'settings' ? 'white' : 'brown');
      }
      return;
    }
    return prevShow(name);
  };
  const prevBack = UI.back;
  UI.back = function () {
    if (J.open) {
      if (!busy) J.close();
      return;
    }
    return prevBack();
  };

  /* ------------------------------------------------------------------ built-in pages */
  const heroOf = (p) => (p && p.hero) || B.heroes.find((h) => h.id === Storage.settings.hero) || B.heroes[0];
  const portrait = (id) => {
    const im = UIK.on && CH.Assets.images['hero.' + id + '.rot_s'];
    return im ? im.src : '';
  };

  J.addPage('journal', {
    title: 'HERO',
    render(h) {
      const hero = heroOf(G.player);
      const M = CH.Meta;
      const lv = M ? M.masteryLevel(hero.id) : 1;
      const next = M ? M.masteryNext(hero.id) : null;
      const xp = M ? M.data().mastery[hero.id] || 0 : 0;
      h.innerHTML =
        `<div class="jp spread"><div class="jp-col"><img class="jp-port" src="${portrait(hero.id)}" alt=""><div class="jp-name">${esc(hero.name)}</div>` +
        `<div class="jp-sub">${esc(hero.specialName || '')}</div></div>` +
        `<div class="jp-col"><p>${esc(hero.blurb || '')}</p><p class="jp-dim">Mastery ${lv}/5 &nbsp; ${xp}${next ? ' / ' + next : ''} xp</p>` +
        `<p class="jp-dim">Highest depth ${Storage.stats.highestWave} &nbsp; Runs ${Storage.stats.totalRuns} &nbsp; Wins ${Storage.stats.wins}</p></div></div>`;
    },
  });
  J.addPage('journal', {
    title: 'MODES & EXTRAS',
    render() {
      CH.Meta.ui.render();
      return J.adopt('extras');
    },
  });
  J.addPage('journal', {
    title: 'STATISTICS',
    render() {
      UI.fillStats();
      return J.adopt('stats');
    },
  });
  J.addPage('inventory', {
    title: 'MATERIALS',
    render(h) {
      const r = Storage.resources;
      const loot = Object.keys(Storage.loot).reduce((a, k) => a + (Storage.loot[k] || 0), 0);
      const row = (name, ico, n) => `<div class="jp-row"><img class="ico" src="${ico}" alt=""><span>${name}</span><b>${n}</b></div>`;
      const ic = (k) => CH.Sprites.icon(CH.Sprites.has('pk.' + k) ? 'pk.' + k : 'coin');
      h.innerHTML = `<div class="jp spread"><div class="jp-col">${row('Wood', ic('wood'), r.wood)}${row('Scrap', ic('scrap'), r.scrap)}${row('Stone', ic('stone'), r.stone)}</div><div class="jp-col">${row('Trophies in stock', CH.Sprites.icon(CH.Sprites.has('pu.259') ? 'pu.259' : 'coin'), loot)}<p class="jp-dim">Spend materials at the safehouse workbench; sell trophies in the Codex.</p></div></div>`;
    },
  });
  J.addPage('inventory', {
    title: 'SAFEHOUSE',
    render() {
      CH.Shelter.init();
      return J.adopt('shelter');
    },
  });
  J.addPage('equipment', {
    title: 'LOADOUT',
    render(h) {
      const p = G.player;
      const hero = heroOf(p);
      const w = p && p.weapons ? p.weapons : [];
      let list = '';
      for (const slot of w) {
        const def = B.weapons[slot.id || slot] || {};
        list += `<div class="jp-row"><span>${esc(def.name || slot.id || slot)}</span><b>${slot.level ? 'Lv ' + slot.level : ''}</b></div>`;
      }
      h.innerHTML = `<div class="jp spread"><div class="jp-col"><img class="jp-port" src="${portrait(hero.id)}" alt=""><div class="jp-name">${esc(hero.name)}</div></div><div class="jp-col"><div class="jp-sub">WEAPONS</div>${list || '<p class="jp-dim">Start a run to see your weapons.</p>'}</div></div>`;
    },
  });
  J.addPage('codex', {
    title: 'TROPHY CODEX',
    render() {
      CH.Codex.open();
      return J.adopt('codex');
    },
  });
  J.addPage('save', {
    title: 'SAVE & QUIT',
    render(h) {
      h.innerHTML =
        '<div class="jp spread"><div class="jp-col"><p>Your progress saves automatically. Leave a run here or carry on.</p>' +
        '<button class="btn primary" id="jb-resume">BACK TO THE GAME</button><button class="btn" id="jb-restart">RESTART RUN</button><button class="btn danger" id="jb-menu">RETURN TO MAIN MENU</button></div></div>';
      const clickPause = (id) => () => {
        J.close(true);
        const b = $(id);
        UI.show('pause');
        b && b.click();
      };
      $('jb-resume').onclick = () => J.close();
      $('jb-restart').onclick = clickPause('btn-restart');
      $('jb-menu').onclick = clickPause('btn-pause-menu');
      if (G.state === 'menu') {
        $('jb-resume').textContent = 'CLOSE';
        $('jb-restart').style.display = $('jb-menu').style.display = 'none';
      }
    },
  });
  J.addPage('settings', {
    title: 'OPTIONS',
    render() {
      UI.refreshSettings();
      return J.adopt('settings');
    },
  });

  /* main-menu and pause-menu entry points */
  J.init = function () {
    if (!UIK.on || root) return;
    build();
  };
})(window.CH);
