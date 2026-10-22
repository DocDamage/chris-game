/* CHAOS.exe - the remaining menu pieces of the UI pack: the pause menu with the Style 2 tab icons (Journal, Inventory,
   Equipment, Codex, Save & Quit, Settings) and a Map button (Style 1 icon), the Highlighter cursor (focus frames for
   buttons and slots), the Gold-book hero select (one page per hero, a turntable of the hero's 8 rotations, flip to
   browse) and the Gold variant for boss / legendary reward screens. */
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

  const Menus = (CH.Menus = {});

  Menus.init = function () {
    if (!UIK.on) return;
    // the Highlighter sprites become focus frames: wide button, small slot, big slot
    const hl = (n) => UIK.url('0 - Sprites/Highlighter/' + n + '.png');
    const st = document.createElement('style');
    st.textContent =
      `#stage{--hl-wide:url(${hl(4)});--hl-small:url(${hl(1)});--hl-big:url(${hl(2)});--hl-tab:url(${hl(3)});--hl-corner:url(${hl(5)});}`;
    document.head.appendChild(st);
    // parchment frames for the pause and confirm panels, as in the pack's Pause Menu
    for (const id of ['screen-pause', 'screen-confirm']) { const p = $(id).querySelector('.panel'); if (p) p.classList.add('paper'); }
    pauseRow();
    mainMenuButtons();
    buildHeroSelect();
  };

  /* ---------------------------------------------------------------- pause menu: icon row */
  function pauseRow() {
    const panel = $('screen-pause').querySelector('.panel');
    const row = document.createElement('div');
    row.className = 'pz-row';
    const icon = (n, label, fn) => {
      const b = document.createElement('button');
      b.className = 'pz-btn';
      b.title = label;
      b.setAttribute('aria-label', label);
      b.innerHTML = `<img src="${UIK.url('0 - Sprites/Tab icons/Style 2/' + n + '.png')}" alt="">`;
      b.onclick = () => { Audio.sfx('click'); fn(); };
      row.appendChild(b);
    };
    const J = () => CH.Journal;
    icon(1, 'Journal', () => J().show(0, 0, 'pause', UIK.colorFor(0)));
    icon(2, 'Inventory', () => J().show(1, 0, 'pause', UIK.colorFor(0)));
    icon(3, 'Equipment', () => J().show(2, 0, 'pause', UIK.colorFor(0)));
    icon(4, 'Codex', () => J().show(3, 0, 'pause', UIK.colorFor(0)));
    icon(5, 'Save & Quit', () => J().show(4, 0, 'pause', UIK.colorFor(0)));
    icon(6, 'Settings', () => { UI.backTo = 'pause'; UI.show('settings'); });
    const m = document.createElement('button');
    m.className = 'pz-btn';
    m.title = 'Map';
    m.innerHTML = `<img src="${UIK.url('0 - Sprites/Tab icons/Style 1/1.png')}" alt="">`;
    m.onclick = () => { Audio.sfx('click'); CH.MapScroll && CH.MapScroll.show(0, 'pause', UIK.colorFor(0)); };
    row.appendChild(m);
    const h2 = panel.querySelector('h2');
    h2.insertAdjacentElement('afterend', row);
  }

  /* ---------------------------------------------------------------- main menu: hero select */
  function mainMenuButtons() {
    const col = $('screen-main').querySelector('.menu-col');
    const b = document.createElement('button');
    b.className = 'btn';
    b.id = 'btn-heroes';
    b.textContent = 'CHOOSE HERO';
    b.onclick = () => Menus.heroes();
    col.insertBefore(b, $('btn-coop'));
    const j = document.createElement('button');
    j.className = 'btn';
    j.id = 'btn-journal';
    j.textContent = 'JOURNAL';
    j.onclick = () => CH.Journal && CH.Journal.show(0, 0, 'main', UIK.colorFor(0));
    col.insertBefore(j, $('btn-howto'));
  }

  /* ---------------------------------------------------------------- Gold book: hero select */
  let hs = null;
  function buildHeroSelect() {
    const el = document.createElement('div');
    el.className = 'screen dim';
    el.id = 'screen-heroes';
    el.innerHTML = '<div class="jb c-gold" id="hs"><img class="jb-frame" id="hs-frame" alt="" draggable="false"><div class="jb-title" id="hs-title">HEROES</div><div class="jb-host" id="hs-host"></div></div><div class="jb-hint">&larr; &rarr; browse &nbsp; ENTER select &nbsp; ESC back</div>';
    $('screen-pause').parentNode.appendChild(el);
    UI.SCREENS.push('heroes');
    hs = { el, frame: $('hs-frame'), host: $('hs-host'), i: 0, open: false, busy: false, t: null };
  }
  const heroes = () => B.heroes;
  const goldFrames = (dir, n) => UIK.frames('gold', dir, n);

  Menus.heroes = function () {
    if (!UIK.on || !hs || hs.open) return false;
    hs.open = true;
    hs.i = Math.max(0, heroes().findIndex((h) => h.id === Storage.settings.hero));
    hs.busy = true;
    hs.host.style.visibility = 'hidden';
    UI.show('heroes');
    Audio.sfx('page');
    UIK.anim(hs.frame, goldFrames('Open & Close/Open', 8), 14, { onDone() { hs.frame.src = UIK.cUrl('gold', 'Pixel Book/Sprites/Static/1.png'); hs.busy = false; hs.host.style.visibility = 'visible'; renderHero(); } });
    return true;
  };
  function closeHeroes() {
    if (!hs.open || hs.busy) return;
    hs.busy = true;
    clearInterval(hs.t);
    hs.host.style.visibility = 'hidden';
    Audio.sfx('back');
    UIK.anim(hs.frame, goldFrames('Open & Close/Close', 8), 18, { onDone() { hs.open = false; hs.busy = false; UI.show('main'); } });
  }
  function flip(d) {
    if (!hs.open || hs.busy) return;
    const n = heroes().length;
    hs.i = (hs.i + d + n) % n;
    hs.busy = true;
    hs.host.style.visibility = 'hidden';
    clearInterval(hs.t);
    Audio.sfx('page');
    UIK.anim(hs.frame, goldFrames('Page Flip/' + (d > 0 ? 'Right' : 'Left'), 9), 22, { onDone() { hs.frame.src = UIK.cUrl('gold', 'Pixel Book/Sprites/Static/1.png'); hs.busy = false; hs.host.style.visibility = 'visible'; renderHero(); } });
  }
  function renderHero() {
    const h = heroes()[hs.i];
    const M = CH.Meta;
    const unlocked = Storage.isUnlocked(h.id);
    const lv = M && unlocked ? M.masteryLevel(h.id) : 0;
    const sk = CH.SK ? CH.SK.DEFS[CH.SK.chosen(h.id)] : null;
    const skim = sk ? CH.Assets.images['sk.' + CH.SK.chosen(h.id) + '.rot_s'] : null;
    hs.host.innerHTML =
      `<div class="jp spread"><div class="jp-col"><img class="hs-turn${unlocked ? '' : ' locked'}" id="hs-turn" alt=""><div class="jp-name">${unlocked ? esc(h.name) : '???'}</div><div class="jp-sub">${hs.i + 1} / ${heroes().length}</div></div>` +
      `<div class="jp-col"><p>${unlocked ? esc(h.blurb || '') : 'Locked: ' + esc(h.hint || '')}</p>` +
      (unlocked ? `<div class="jp-sub">${esc(h.specialName || '')}</div><p class="jp-dim">Mastery ${lv}/5</p>` : '') +
      (sk && unlocked ? `<div class="jp-row">${skim ? `<img class="ico" style="width:calc(var(--p)*28);height:calc(var(--p)*28)" src="${skim.src}" alt="">` : ''}<span>Companion: ${esc(sk.name)}</span></div>` : '') +
      `<div class="row-btns"><button class="btn primary" id="hs-pick" ${unlocked ? '' : 'disabled'}>${Storage.settings.hero === h.id ? 'SELECTED' : 'SELECT'}</button><button class="btn small" id="hs-back">BACK</button></div></div></div>`;
    $('hs-pick').onclick = () => { if (unlocked) { Storage.settings.hero = h.id; Storage.save(); Audio.sfx('buy'); closeHeroes(); } };
    $('hs-back').onclick = closeHeroes;
    // the turntable: the hero's eight rotations in a slow spin
    const dirs = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'];
    let k = 0;
    const img = $('hs-turn');
    const tick = () => { const im = CH.Assets.images['hero.' + h.id + '.rot_' + dirs[k++ % 8]]; if (im) img.src = im.src; };
    tick();
    clearInterval(hs.t);
    hs.t = setInterval(tick, window.__uikInstant ? 100000 : 220);
    const first = $('hs-pick');
    if (first && first.focus) first.focus({ preventScroll: true });
  }
  const prevKey = UI.onMenuKey;
  UI.onMenuKey = function (e) {
    if (hs && hs.open && UI.active === 'heroes') {
      if (e.code === 'ArrowLeft' || e.code === 'KeyQ') { flip(-1); e.preventDefault(); return; }
      if (e.code === 'ArrowRight' || e.code === 'KeyE') { flip(1); e.preventDefault(); return; }
    }
    return prevKey(e);
  };
  CH.Input.onMenuKey = UI.onMenuKey;
  const prevGlobal = UI.onGlobalKey;
  UI.onGlobalKey = function (a) {
    if (a === 'pause' && hs && hs.open) return closeHeroes();
    return prevGlobal(a);
  };
  CH.Input.onGlobal = UI.onGlobalKey;
  const prevBack = UI.back;
  UI.back = function () { if (hs && hs.open) return closeHeroes(); return prevBack(); };

  /* ---------------------------------------------------------------- Gold variant: boss and legendary reward screens */
  const prevLevelUp = UI.showLevelUp;
  UI.showLevelUp = function (cards) {
    const r = prevLevelUp.apply(UI, arguments);
    const legendary = (cards || []).some((c) => c && (c.rarity === 'legendary' || c.legendary));
    const scr = $('screen-levelup');
    if (scr) scr.querySelectorAll('.panel').forEach((p) => p.classList.toggle('c-gold', legendary || !!(G.bossDying) || G.isBossWave && !!G.enemies.find((e) => e.isBoss && !e.dead)));
    return r;
  };
})(window.CH);
