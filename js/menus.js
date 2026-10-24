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
    // the hero belongs to the character now (PLAY opens the character book); the label stays for callers
    Menus.heroLabel = () => {};
    const j = document.createElement('button');
    j.className = 'btn';
    j.id = 'btn-journal';
    j.textContent = 'JOURNAL';
    j.onclick = () => CH.Journal && CH.Journal.show(0, 0, 'main', UIK.colorFor(0));
    col.insertBefore(j, $('btn-settings'));
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

  /* PLAN.md 18, K0a: the gold book lists the characters (save slots) and makes new ones */
  const pages = () => (hs.mode === 'chars' ? Storage.slots().length + 1 : heroes().length);
  const render = () => (hs.mode === 'chars' ? renderChar() : renderHero());
  Menus.characters = () => Menus.open('chars');
  Menus.heroes = () => Menus.open('create');
  Menus.open = function (mode) {
    if (!UIK.on || !hs || hs.open) return false;
    hs.open = true;
    hs.mode = mode;
    $('hs-title').textContent = mode === 'chars' ? 'CHARACTERS' : 'NEW CHARACTER';
    hs.i = mode === 'chars' ? Math.max(0, Storage.activeIndex()) : Math.max(0, heroes().findIndex((h) => h.id === Storage.settings.hero));
    hs.busy = true;
    hs.host.style.visibility = 'hidden';
    UI.show('heroes');
    Audio.sfx('page');
    UIK.anim(hs.frame, goldFrames('Open & Close/Open', 8), 14, { onDone() { hs.frame.src = UIK.cUrl('gold', 'Pixel Book/Sprites/Static/1.png'); hs.busy = false; hs.host.style.visibility = 'visible'; render(); } });
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
    const n = pages();
    hs.i = (hs.i + d + n) % n;
    hs.busy = true;
    hs.host.style.visibility = 'hidden';
    clearInterval(hs.t);
    Audio.sfx('page');
    UIK.anim(hs.frame, goldFrames('Page Flip/' + (d > 0 ? 'Right' : 'Left'), 9), 22, { onDone() { hs.frame.src = UIK.cUrl('gold', 'Pixel Book/Sprites/Static/1.png'); hs.busy = false; hs.host.style.visibility = 'visible'; render(); } });
  }
  /* a hero's eight rotations in a slow spin */
  function turntable(heroId) {
    const dirs = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'];
    let k = 0;
    const img = $('hs-turn');
    if (!img) return;
    const tick = () => { const im = CH.Assets.images['hero.' + heroId + '.rot_' + dirs[k++ % 8]]; if (im) img.src = im.src; };
    tick();
    clearInterval(hs.t);
    hs.t = setInterval(tick, window.__uikInstant ? 100000 : 220);
  }
  const hm = (s) => (s >= 3600 ? Math.floor(s / 3600) + 'h ' : '') + Math.floor((s % 3600) / 60) + 'm';
  /* start playing the active character */
  function play() {
    clearInterval(hs.t);
    hs.open = false;
    hs.busy = false;
    Audio.sfx('confirm');
    G.newRun(null);
  }
  /* the Sanctuary theme (d3.css, PLAN.md 20): the hero stands on a lit dais at the left, the roster runs down the right,
     PLAY sits at the bottom, as in Diablo III's hero select; creating a hero lists the classes in the roster's place */
  const d3 = () => document.body.classList.contains('d3');
  const portraitOf = (id) => { const im = CH.Assets.images['hero.' + id + '.rot_s']; return im ? im.src : ''; };
  const where = (s) => {
    const W = s.world, WM = CH.WorldMap;
    if (!W || !W.deepest || !WM) return 'Not yet set out';
    const n = Math.max(1, Math.min(WM.LAST, W.at || W.deepest));
    return 'Act ' + ['I', 'II', 'III', 'IV'][WM.area(n).act - 1] + ' · ' + WM.label(n).replace(/\b(\w)(\w*)/g, (m, a, b) => a + b.toLowerCase());
  };
  function renderChar3() {
    const all = Storage.slots();
    const s = all[hs.i];
    const full = all.length >= Storage.MAX_SLOTS;
    const rows = all.map((q, i) => {
      const h = heroes().find((x) => x.id === q.hero) || heroes()[0];
      return `<button class="hs3-row${i === hs.i ? ' sel' : ''}" data-i="${i}"><img src="${portraitOf(h.id)}" alt=""><span><b>${esc(q.name)}</b><small>Level ${q.char.level} ${esc(h.name.split(',')[0])}${q.hardcore ? ' · Hardcore' : ''}</small></span></button>`;
    }).join('') + `<button class="hs3-row new${!s ? ' sel' : ''}" data-i="${all.length}"><span><b>+ Create new hero</b><small>${all.length} / ${Storage.MAX_SLOTS} heroes</small></span></button>`;
    const h = s ? heroes().find((x) => x.id === s.hero) || heroes()[0] : null;
    const stage = s
      ? `<div class="hs3-beam"></div><div class="hs3-dais"></div><img class="hs-turn" id="hs-turn" alt=""><div class="hs3-name jp-name">${esc(s.name)}</div><div class="hs3-class">Level ${s.char.level} ${esc(h.name)}${s.hardcore ? ' · <span class="hc">Hardcore</span>' : ''}</div><div class="hs3-blurb">${esc(where(s))}<br>Played ${hm(s.played)} · ${s.char.gold} gold</div>`
      : `<div class="hs3-beam"></div><div class="hs3-dais"></div><div class="hs3-name jp-name">A new hero</div><div class="hs3-blurb">${full ? 'Every place on the roster is taken. Delete a hero to make room.' : 'Choose a class, name them, and take them through the world. Hardcore heroes are gone for good when they fall.'}</div>`;
    hs.host.innerHTML =
      `<div class="hs3-wrap"><div class="hs3-stage">${stage}</div><div class="hs3-side hs3"><div class="hs3-head">Heroes</div>${rows}</div>` +
      `<div class="hs3-bar">${s ? '<button class="btn small" id="hs-del">DELETE</button>' : ''}<button class="btn primary" id="hs-pick" ${!s && full ? 'disabled' : ''}>${s ? 'PLAY' : 'CREATE'}</button><button class="btn small" id="hs-back">BACK</button></div></div>`;
    hs.host.querySelectorAll('.hs3-row').forEach((b) => { b.onclick = () => { const i = +b.dataset.i; if (i === hs.i) return; hs.i = i; Audio.sfx('hover'); render(); }; b.ondblclick = () => $('hs-pick').click(); });
    $('hs-pick').onclick = () => {
      if (!s) { if (full) return; Audio.sfx('page'); hs.mode = 'create'; $('hs-title').textContent = 'NEW CHARACTER'; hs.i = 0; render(); return; }
      Storage.useSlot(hs.i); play();
    };
    if (s) {
      let sure = false;
      $('hs-del').onclick = () => {
        if (!sure) { sure = true; $('hs-del').textContent = 'SURE?'; Audio.sfx('nope'); return; }
        Storage.deleteSlot(hs.i);
        Audio.sfx('back');
        hs.i = Math.min(hs.i, Storage.slots().length);
        render();
      };
      turntable(h.id);
    }
    $('hs-back').onclick = closeHeroes;
    const first = $('hs-pick');
    if (first && first.focus) first.focus({ preventScroll: true });
  }
  function renderHero3() {
    const h = heroes()[hs.i];
    const M = CH.Meta;
    const unlocked = Storage.isUnlocked(h.id);
    const lv = M && unlocked ? M.masteryLevel(h.id) : 0;
    const sk = CH.SK ? CH.SK.DEFS[CH.SK.chosen(h.id)] : null;
    const skim = sk ? CH.Assets.images['sk.' + CH.SK.chosen(h.id) + '.rot_s'] : null;
    const rows = heroes().map((q, i) => {
      const open = Storage.isUnlocked(q.id);
      return `<button class="hs3-row${i === hs.i ? ' sel' : ''}${open ? '' : ' locked'}" data-i="${i}"><img src="${portraitOf(q.id)}" alt=""><span><b>${open ? esc(q.name.split(',')[0]) : '???'}</b><small>${open ? esc(q.specialName || '') : 'Locked'}</small></span></button>`;
    }).join('');
    hs.host.innerHTML =
      `<div class="hs3-wrap"><div class="hs3-stage"><div class="hs3-beam"></div><div class="hs3-dais"></div><img class="hs-turn${unlocked ? '' : ' locked'}" id="hs-turn" alt="">` +
      `<div class="hs3-name jp-name">${unlocked ? esc(h.name) : '???'}</div><div class="hs3-class">${unlocked ? esc(h.specialName || '') + (lv ? ' · Mastery ' + lv + '/5' : '') : 'Locked'}</div>` +
      `<div class="hs3-blurb">${unlocked ? esc(h.blurb || '') : esc(h.hint || '')}</div>` +
      (sk && unlocked ? `<div class="hs3-companion">${skim ? `<img src="${skim.src}" alt="">` : ''}<span>Companion: ${esc(sk.name)}</span></div>` : '') +
      (unlocked ? `<div class="hs3-form"><input class="hs-name" id="hs-name" maxlength="16" placeholder="${esc(h.name.split(',')[0])}" autocomplete="off"><label class="hs-hc"><input type="checkbox" id="hs-hc"> Hardcore</label></div>` : '') +
      `</div><div class="hs3-side hs3"><div class="hs3-head">Choose a class</div>${rows}</div>` +
      `<div class="hs3-bar"><button class="btn primary" id="hs-pick" ${unlocked ? '' : 'disabled'}>CREATE</button><button class="btn small" id="hs-back">BACK</button></div></div>`;
    hs.host.querySelectorAll('.hs3-row').forEach((b) => { b.onclick = () => { const i = +b.dataset.i; if (i === hs.i) return; hs.i = i; Audio.sfx('hover'); render(); }; });
    $('hs-pick').onclick = () => {
      if (!unlocked) return;
      const slot = Storage.createSlot({ hero: h.id, name: ($('hs-name') && $('hs-name').value) || '', hardcore: !!($('hs-hc') && $('hs-hc').checked) });
      if (!slot) { Audio.sfx('nope'); return; }
      play();
    };
    $('hs-back').onclick = () => { Audio.sfx('back'); hs.mode = 'chars'; $('hs-title').textContent = 'CHARACTERS'; hs.i = Storage.slots().length; render(); };
    turntable(h.id);
    const first = $('hs-pick');
    if (first && first.focus) first.focus({ preventScroll: true });
  }

  /* a character's page, or the last page: a new character */
  function renderChar() {
    if (d3()) return renderChar3();
    const all = Storage.slots();
    const s = all[hs.i];
    if (!s) {
      const full = all.length >= Storage.MAX_SLOTS;
      hs.host.innerHTML =
        `<div class="jp spread"><div class="jp-col"><div class="jp-name">NEW CHARACTER</div><div class="jp-sub">${all.length} / ${Storage.MAX_SLOTS} characters</div></div>` +
        `<div class="jp-col"><p>${full ? 'Every page is written. Delete a character to make room.' : 'Choose a hero and take them through the world. Hardcore characters are gone for good when they fall.'}</p>` +
        `<div class="row-btns"><button class="btn primary" id="hs-pick" ${full ? 'disabled' : ''}>CREATE</button><button class="btn small" id="hs-back">BACK</button></div></div></div>`;
      $('hs-pick').onclick = () => { if (full) return; Audio.sfx('page'); hs.mode = 'create'; $('hs-title').textContent = 'NEW CHARACTER'; hs.i = 0; render(); };
      $('hs-back').onclick = closeHeroes;
      const first = $('hs-pick');
      if (first && first.focus) first.focus({ preventScroll: true });
      return;
    }
    const h = heroes().find((q) => q.id === s.hero) || heroes()[0];
    hs.host.innerHTML =
      `<div class="jp spread"><div class="jp-col"><img class="hs-turn" id="hs-turn" alt=""><div class="jp-name">${esc(s.name)}</div><div class="jp-sub">${hs.i + 1} / ${all.length}</div></div>` +
      `<div class="jp-col"><p>${esc(h.name)}</p><div class="jp-sub">LEVEL ${s.char.level}${s.hardcore ? ' &middot; HARDCORE' : ''}</div><p class="jp-dim">Played ${hm(s.played)} &middot; ${s.char.gold} gold</p>` +
      `<div class="row-btns"><button class="btn primary" id="hs-pick">PLAY</button><button class="btn small" id="hs-del">DELETE</button><button class="btn small" id="hs-back">BACK</button></div></div></div>`;
    $('hs-pick').onclick = () => { Storage.useSlot(hs.i); play(); };
    let sure = false;
    $('hs-del').onclick = () => {
      if (!sure) { sure = true; $('hs-del').textContent = 'SURE?'; Audio.sfx('nope'); return; }
      Storage.deleteSlot(hs.i);
      Audio.sfx('back');
      hs.i = Math.min(hs.i, Storage.slots().length);
      render();
    };
    $('hs-back').onclick = closeHeroes;
    turntable(h.id);
    const first = $('hs-pick');
    if (first && first.focus) first.focus({ preventScroll: true });
  }
  function renderHero() {
    if (d3()) return renderHero3();
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
      (unlocked ? `<div class="jp-row"><input class="hs-name" id="hs-name" maxlength="16" placeholder="${esc(h.name.split(',')[0])}" autocomplete="off"></div><label class="jp-row hs-hc"><input type="checkbox" id="hs-hc"> HARDCORE</label>` : '') +
      `<div class="row-btns"><button class="btn primary" id="hs-pick" ${unlocked ? '' : 'disabled'}>CREATE</button><button class="btn small" id="hs-back">BACK</button></div></div></div>`;
    $('hs-pick').onclick = () => {
      if (!unlocked) return;
      const slot = Storage.createSlot({ hero: h.id, name: ($('hs-name') && $('hs-name').value) || '', hardcore: !!($('hs-hc') && $('hs-hc').checked) });
      if (!slot) { Audio.sfx('nope'); return; }
      play();
    };
    $('hs-back').onclick = () => { Audio.sfx('back'); hs.mode = 'chars'; $('hs-title').textContent = 'CHARACTERS'; hs.i = Storage.slots().length; render(); };
    turntable(h.id);
    const first = $('hs-pick');
    if (first && first.focus) first.focus({ preventScroll: true });
  }
  const prevKey = UI.onMenuKey;
  UI.onMenuKey = function (e) {
    if (hs && hs.open && UI.active === 'heroes') {
      if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text') return prevKey(e);
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
