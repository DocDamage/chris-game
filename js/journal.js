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
    const first = host.querySelector('.btn, .card, .swatch, .codex-item');
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
  const MUSIC = { settings: 'shop', stats: 'garden', shelter: 'shop', codex: 'garden', extras: 'theme' };
  const REDIRECT = { settings: [5, 0], codex: [3, 0], stats: [0, 3], extras: [0, 2], shelter: [1, 2] };
  const prevShow = UI.show;
  UI.show = function (name) {
    if (REDIRECT[name] && UIK.on && !J.adopting) {
      const r = REDIRECT[name];
      if (G.state === 'menu' && MUSIC[name]) Audio.setMusic(MUSIC[name]); // the menu tracks of the screens the book replaced
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
    title: 'EXTRAS',
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
  /* Codex page 2: the sidekick roster. Unlocked sidekicks can be picked for the current hero; locked ones show how to find them. */
  J.addPage('codex', {
    title: 'SIDEKICKS',
    render(h) {
      const SK = CH.SK;
      const hero = heroOf(G.player);
      const cur = SK.chosen(hero.id);
      let html = '<div class="jp-sub">COMPANION OF ' + esc(hero.name.toUpperCase()) + '</div><div class="skr">';
      for (const id of SK.ORDER) {
        const d = SK.DEFS[id];
        const open = SK.isUnlocked(id);
        const im = CH.Assets.images['sk.' + id + '.rot_s'];
        html += '<button class="skr-card' + (id === cur ? ' sel' : '') + (open ? '' : ' locked') + '" data-id="' + id + '" title="' + esc(open ? d.role : d.unlock || '') + '">' +
          '<img src="' + (im ? im.src : '') + '" alt=""><b>' + (open ? esc(d.name) : '???') + '</b><small>' + esc(open ? d.role : d.unlock || 'Secret') + '</small></button>';
      }
      h.innerHTML = '<div class="jp spread" style="flex-direction:column;gap:0">' + html + '</div></div>';
      h.querySelectorAll('.skr-card').forEach((b) => {
        b.onclick = () => {
          if (SK.choose(hero.id, b.dataset.id)) {
            Audio.sfx('buy');
            h.querySelectorAll('.skr-card').forEach((c) => c.classList.toggle('sel', c === b));
            if (G.state !== 'menu' && G.player) CH.UI.toast('Takes effect next time you set out');
          } else Audio.sfx('nope');
        };
      });
    },
  });
  J.addPage('save', {
    title: 'SAVE & QUIT',
    render(h) {
      h.innerHTML =
        '<div class="jp spread"><div class="jp-col"><p>Your character saves as you play. Quit here and you wake in the hideout next time.</p>' +
        '<button class="btn primary" id="jb-resume">BACK TO THE GAME</button><button class="btn danger" id="jb-menu">SAVE &amp; QUIT</button></div></div>';
      const clickPause = (id) => () => {
        J.close(true);
        const b = $(id);
        UI.show('pause');
        b && b.click();
      };
      $('jb-resume').onclick = () => J.close();
      $('jb-menu').onclick = clickPause('btn-pause-menu');
      if (G.state === 'menu') {
        $('jb-resume').textContent = 'CLOSE';
        $('jb-menu').style.display = 'none';
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

  /* ---------------------------------------------------------------- gear pages (js/items.js) */
  const slotImg = (it, slot) => {
    const I = CH.Items;
    if (it) return UIK.url(I.artPath(it.slot, it.rarity === 'normal' || it.rarity === 'magic' ? 'leather' : 'iron'));
    return UIK.url(I.artPath(slot, 'empty'));
  };
  const frameUrl = () => UIK.cUrl(J.color, 'Content/Holders/40.png');
  const tipHtml = (it, p) => {
    const I = CH.Items;
    let h = I.describe(it).map((l) => `<div style="color:${l.c === '#ffffff' ? '#2a1a14' : l.c === '#b9b4c8' ? '#5a4a3a' : l.c === '#ffe14a' ? '#8a6a00' : l.c === '#6a9bff' ? '#2a4a9a' : l.c}">${esc(l.t)}</div>`).join('');
    const cmp = I.compare(it, p);
    if (cmp.length) h += '<div class="jp-dim" style="margin-top:calc(var(--p)*3)">vs. equipped:</div>' + cmp.map((c) => `<div style="color:${c.d > 0 ? '#2a7a2a' : '#9a2a2a'}">${c.d > 0 ? '+' : '-'}${esc(c.label)}</div>`).join('');
    return h;
  };

  J.addPage('inventory', {
    title: 'BAG',
    render(h) {
      const I = CH.Items;
      const p = G.player || { hero: heroOf(null), stats: {} };
      let sel = null;
      const draw = () => {
        const bag = I.bag();
        let cells = '';
        for (let i = 0; i < I.BAG_SIZE; i++) {
          const it = bag[i];
          cells += `<button class="ig-cell${it && it === sel ? ' sel' : ''}" data-i="${i}" style="background-image:url(${frameUrl()})">${it ? `<img src="${slotImg(it)}" alt="" style="filter:drop-shadow(0 0 calc(var(--p)*1.5) ${I.RARITY[it.rarity].color})">` : ''}</button>`;
        }
        const belt = G.player ? I.belt(G.player) : [];
        let bl = '';
        for (let i = 0; i < 4; i++) { const b = belt[i]; bl += `<span class="ig-belt" style="background-image:url(${frameUrl()})">${b ? `<img src="${UIK.url('0 - Sprites/items/' + I.CONSUMABLES[b.id].pack + '.png')}" alt=""><i>${b.n}</i>` : ''}</span>`; }
        const bin = UIK.cUrl('brown', '') || '';
        h.innerHTML =
          `<div class="jp spread"><div class="jp-col" style="flex:1.1"><div class="ig-grid">${cells}</div><div class="jp-dim">${bag.length} / ${I.BAG_SIZE} &nbsp; BELT:</div><div>${bl}</div></div>` +
          `<div class="jp-col"><div class="ig-tip">${sel ? tipHtml(sel, p) : '<span class="jp-dim">Select an item. Gold drops, magic items glow blue, rare yellow, legendary orange, sets green.</span>'}</div>` +
          `<div class="row-btns"><button class="btn small" id="ig-eq" ${sel ? '' : 'disabled'}>EQUIP</button><button class="btn small danger" id="ig-salv" ${sel ? '' : 'disabled'}>RECYCLE</button><img id="ig-bin" class="ig-bin" alt="" src="${UIK.url('0 - Sprites/Recycle Bin/1.png')}"></div></div></div>`;
        h.querySelectorAll('.ig-cell').forEach((b) => {
          b.onclick = () => { sel = bag[+b.dataset.i] || null; Audio.sfx('hover'); draw(); };
          b.ondblclick = () => { if (sel && G.player) { I.equip(G.player, sel); sel = null; draw(); } };
        });
        const eq = h.querySelector('#ig-eq'), sv = h.querySelector('#ig-salv');
        if (eq) eq.onclick = () => { if (sel && (G.player || true)) { const pl = G.player || { hero: heroOf(null), stats: {}, buffs: {} }; if (G.player) I.equip(pl, sel); else { /* menu: gear belongs to the chosen hero */ I.equip(G.players[0] || pl, sel); } sel = null; draw(); } };
        if (sv) sv.onclick = () => {
          if (!sel) return;
          const frames = [];
          for (let k = 1; k <= 6; k++) frames.push(UIK.url('0 - Sprites/Recycle Bin/' + k + '.png'));
          UIK.anim(h.querySelector('#ig-bin'), frames, 16, {});
          const got = I.salvage(sel);
          if (got && G.ui && G.ui.toast) G.ui.toast('RECYCLED: ' + Object.keys(got).filter((k) => got[k]).map((k) => got[k] + ' ' + k).join(', '));
          sel = null;
          setTimeout(draw, window.__uikInstant ? 0 : 450);
        };
      };
      draw();
    },
  });

  J.addPage('equipment', {
    title: 'PAPER DOLL',
    render(h) {
      const I = CH.Items;
      const p = G.player || G.players[0];
      const hero = heroOf(p);
      const eqd = p ? I.equippedOf(p) : I.equippedOf({ hero });
      const pos = { helm: [50, 2], chest: [14, 26], gloves: [86, 26], ring: [86, 54], legs: [14, 54], boots: [50, 80] };
      let slots = '';
      for (const sl of I.SLOTS) {
        const it = eqd[sl];
        slots += `<button class="pd-slot" data-slot="${sl}" title="${SLOT_T[sl]}" style="left:${pos[sl][0]}%;top:${pos[sl][1]}%;background-image:url(${frameUrl()})"><img src="${slotImg(it, sl)}" alt="" style="${it ? 'filter:drop-shadow(0 0 calc(var(--p)*1.5) ' + I.RARITY[it.rarity].color + ')' : 'opacity:.55'}"></button>`;
      }
      const w = p && p.weapons ? p.weapons : [];
      const wl = w.map((x) => esc((B.weapons[x.id || x] || {}).name || x.id || x)).join('<br>');
      const sk = CH.SK && CH.SK.list.find((s) => s.owner === p);
      const skid = CH.SK ? (sk ? sk.id : CH.SK.chosen(hero.id)) : null;
      const skim = skid ? CH.Assets.images['sk.' + skid + '.rot_s'] : null;
      h.innerHTML =
        `<div class="jp spread"><div class="jp-col" style="flex:1.2"><div class="pd"><img class="pd-hero" src="${portrait(hero.id)}" alt="">${slots}</div></div>` +
        `<div class="jp-col"><div class="jp-sub">WEAPONS</div><div>${wl || '<span class="jp-dim">none yet</span>'}</div><div class="jp-sub">COMPANION</div>` +
        `<div class="jp-row">${skim ? `<img class="ico" style="width:calc(var(--p)*30);height:calc(var(--p)*30)" src="${skim.src}" alt="">` : ''}<span>${skid ? esc(CH.SK.DEFS[skid].name) : ''}</span></div>` +
        `<div class="ig-tip" id="pd-tip"><span class="jp-dim">Click a slot to take the item off.</span></div></div></div>`;
      h.querySelectorAll('.pd-slot').forEach((b) => {
        b.onmouseenter = () => { const it = eqd[b.dataset.slot]; h.querySelector('#pd-tip').innerHTML = it ? tipHtml(it, p || { hero }) : '<span class="jp-dim">Empty ' + SLOT_T[b.dataset.slot] + ' slot.</span>'; };
        b.onclick = () => { if (p && I.unequip(p, b.dataset.slot)) { Audio.sfx('back'); J.refresh(); } else Audio.sfx('nope'); };
      });
    },
  });
  const SLOT_T = { helm: 'Helm', chest: 'Chest', legs: 'Legs', boots: 'Boots', ring: 'Ring', gloves: 'Gloves' };

  J.addPage('equipment', {
    title: 'STATS',
    render(h) {
      const p = G.player;
      const st = (p && p.stats) || null;
      const ic = (n) => UIK.cUrl(J.color, 'Content/icons/' + n + '.png');
      const row = (img, name, val) => `<div class="jp-row"><img class="ico" style="width:calc(var(--p)*14);height:calc(var(--p)*14);image-rendering:pixelated" src="${img}" alt=""><span>${name}</span><b>${val}</b></div>`;
      if (!st) { h.innerHTML = '<div class="jp spread"><div class="jp-col"><p class="jp-dim">Start a run to see your stats.</p></div></div>'; return; }
      const pc = (v) => Math.round(v * 100) + '%';
      h.innerHTML = '<div class="jp spread"><div class="jp-col">' +
        row(ic(7), 'Health', Math.ceil(p.hp) + ' / ' + p.maxHp) + row(ic(8), 'Speed', pc(st.speedMult)) + row(ic(9), 'Coins', U.fmtNum(G.coins)) + row(ic(10), 'Armour', pc(1 - st.dmgReduction)) + row(ic(11), 'Level', p.level) +
        '</div><div class="jp-col">' + row(CH.Sprites.icon('ic_bonk'), 'Damage', pc(st.dmgMult)) + row(CH.Sprites.icon('ic_crit'), 'Crit chance', pc(st.critChance)) + row(CH.Sprites.icon('ic_multi'), 'Fire rate', pc(st.fireRate || 1)) + row(CH.Sprites.icon('ic_reality'), 'Luck', pc(st.luck || 0)) + row(ic(17), 'Depth', G.wave) + '</div></div>';
    },
  });

  J.addPage('journal', {
    title: 'QUESTS',
    render(h) {
      const Q = CH.Quests;
      const act = Q.actOf(G.wave || 1);
      let html = '<div class="jp-sub">' + esc(Q.ACTS[act - 1]) + '</div>';
      for (const q of Q.LIST) {
        if (q.act > act && Q.state(q.id).st === 'active') continue;
        const s = Q.state(q.id);
        const done = s.st === 'done', claimed = s.st === 'claimed';
        html += `<div class="jq${claimed ? ' claimed' : ''}"><div><b>${esc(q.name)}</b> <span class="jp-dim">${s.n || 0}/${q.goal}</span><br><span class="jp-dim">${esc(q.desc)}</span></div>` +
          `${done ? `<button class="btn small primary" data-q="${q.id}">CLAIM ${q.coins}c</button>` : claimed ? '<span class="jp-dim">done</span>' : ''}</div>`;
      }
      // difficulty tier
      html += '<div class="jp-sub" style="margin-top:calc(var(--p)*4)">DIFFICULTY</div><div class="row-btns">';
      Q.TIERS.forEach((t, i) => { html += `<button class="btn small${Q.tier() === i ? ' sel' : ''}" data-t="${i}" ${i > Q.unlockedTier() ? 'disabled' : ''}>${t.name}</button>`; });
      html += '</div>';
      h.innerHTML = '<div class="jp spread" style="flex-direction:column;gap:calc(var(--p)*2)">' + html + '</div>';
      h.querySelectorAll('[data-q]').forEach((b) => { b.onclick = () => { if (Q.claim(b.dataset.q)) J.refresh(); }; });
      h.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => { if (Q.setTier(+b.dataset.t)) J.refresh(); }; });
    },
  });

  J.addPage('inventory', {
    title: 'STASH',
    render(h) {
      const I = CH.Items;
      const D = I.data();
      const town = CH.Town && CH.Town.inTown;
      const grid = (list, size, kind) => { let c = ''; for (let i = 0; i < size; i++) { const it = list[i]; c += `<button class="ig-cell" data-k="${kind}" data-i="${i}" style="background-image:url(${frameUrl()})">${it ? `<img src="${slotImg(it)}" alt="" title="${esc(it.name)}" style="filter:drop-shadow(0 0 calc(var(--p)*1.5) ${I.RARITY[it.rarity].color})">` : ''}</button>`; } return c; };
      const draw = () => {
        h.innerHTML = `<div class="jp spread"><div class="jp-col"><div class="jp-sub">BAG</div><div class="ig-grid" style="grid-template-columns:repeat(6,calc(var(--p)*22))">${grid(I.bag(), I.BAG_SIZE, 'bag')}</div></div><div class="jp-col"><div class="jp-sub">STASH ${town ? '' : '(town only)'}</div><div class="ig-grid" style="grid-template-columns:repeat(6,calc(var(--p)*22))">${grid(D.stash, 24, 'stash')}</div></div></div>`;
        h.querySelectorAll('.ig-cell').forEach((b) => { b.style.width = b.style.height = 'calc(var(--p)*22)'; b.onclick = () => {
          if (!town) { Audio.sfx('nope'); return; }
          const from = b.dataset.k === 'bag' ? I.bag() : D.stash, to = b.dataset.k === 'bag' ? D.stash : I.bag();
          const it = from[+b.dataset.i];
          if (!it || to.length >= (to === D.stash ? I.STASH_SIZE : I.BAG_SIZE)) { Audio.sfx('nope'); return; }
          from.splice(+b.dataset.i, 1); to.push(it); Storage.save(); Audio.sfx('hover'); draw();
        }; });
      };
      draw();
    },
  });
  /* page order: the bag first, the quests second, and the old loadout stub gives way to the paper doll */
  J.refresh = () => { if (J.open && !busy) renderPage(); };
  J.pages[1].unshift(J.pages[1].splice(J.pages[1].findIndex((p) => p.title === 'BAG'), 1)[0]);
  J.pages[1].splice(1, 0, J.pages[1].splice(J.pages[1].findIndex((p) => p.title === 'STASH'), 1)[0]);
  J.pages[2] = J.pages[2].filter((p) => p.title !== 'LOADOUT');
  J.pages[0].splice(1, 0, J.pages[0].pop());

  /* main-menu and pause-menu entry points */
  J.init = function () {
    if (!UIK.on || root) return;
    build();
  };
})(window.CH);
