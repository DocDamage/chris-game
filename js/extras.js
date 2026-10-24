/* CHAOS.exe - the EXTRAS screen: achievements, heroes and mastery, safehouse extras (buildings, relics, crafting, the
   companion), trophy sets, bestiary, options. The run setups and the run summary went with the runs (PLAN.md 18, K0d). */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const G = CH.G;
  const Storage = CH.Storage;
  const X = CH.X;
  const M = CH.Meta;
  const UI = CH.UI;
  const esc = M.esc;
  const md = M.data;

  const mk = (id, html) => {
    const el = document.createElement('div');
    el.className = 'screen dim';
    el.id = 'screen-' + id;
    el.innerHTML = html;
    document.getElementById('screen-menu') ? document.getElementById('screen-menu').parentNode.appendChild(el) : document.getElementById('screen-pause').parentNode.appendChild(el);
    UI.SCREENS.push(id);
    return el;
  };
  const extrasEl = mk('extras', '<div class="panel wide"><h2>EXTRAS</h2><div class="xt-tabs" id="xt-tabs"></div><div class="scroll xt-body" id="xt-body"></div><div class="row-btns"><button class="btn back" id="btn-xt-back">BACK</button></div></div>');

  const TABS = [
    ['ach', 'ACHIEVEMENTS'],
    ['hero', 'HEROES'],
    ['safe', 'SAFEHOUSE+'],
    ['sets', 'TROPHY SETS'],
    ['bestiary', 'BESTIARY'],
    ['opts', 'OPTIONS'],
  ];
  const S = (M.ui = { tab: 'ach' });
  const $ = (id) => document.getElementById(id);
  const btn = (act, v, label, cls, title) => `<button class="btn small ${cls || ''}" data-act="${act}" data-v="${esc(v === undefined ? '' : v)}"${title ? ` title="${esc(title)}"` : ''}>${label}</button>`;
  const costTxt = (c) => Object.keys(c).map((k) => c[k] + ' ' + k).join(', ');
  const res = () => Storage.resources;

  function achTab() {
    const m = md();
    let h = `<h3>ACHIEVEMENTS  ${M.achDone()}/${M.ACH.length}</h3><div class="grid2">`;
    for (const a of M.ACH) h += `<div class="xt-item${m.ach[a.id] ? ' done' : ''}"><b>${m.ach[a.id] ? '&#9733; ' : ''}${esc(a.name)}</b><div class="hint">${esc(a.desc)}</div></div>`;
    return h + '</div>';
  }
  function heroTab() {
    const m = md();
    let h = '<h3>HERO MASTERY</h3><div class="hint">Play a hero to earn mastery XP. L2 unlocks an upgraded special, L3 a coloured aura, L4 a better starting weapon, L5 +10% max HP.</div><div class="grid2">';
    for (const hr of B.heroes) {
      const lv = M.masteryLevel(hr.id);
      const next = M.masteryNext(hr.id);
      const un = Storage.isUnlocked ? Storage.isUnlocked('hero:' + hr.id) || Storage.isUnlocked(hr.id) : true;
      h += `<div class="xt-item"><b>${esc(hr.name)}</b> <span class="chip">MASTERY ${lv}</span><div class="hint">${esc(hr.blurb || '')}</div><div class="hint">XP ${m.mastery[hr.id] || 0}${next ? ' / ' + next : ' (max)'}${un ? '' : ' - LOCKED: ' + esc(hr.hint || '')}</div>`;
      if (lv >= 2) h += btn('alt', hr.id, 'ALT SPECIAL: ' + (m.alt[hr.id] ? 'ON' : 'OFF'), m.alt[hr.id] ? 'sel' : '');
      if (lv >= 3) h += ['', '#3ccbe6', '#fee761', '#e43b44', '#63c74d'].map((c, i) => btn('skin', hr.id + '|' + c, i ? '&#9679;' : 'NO AURA', (m.skin[hr.id] || '') === c ? 'sel' : '')).join('');
      h += '</div>';
    }
    return h + '</div>';
  }
  function safeTab() {
    let h = `<h3>RESOURCES</h3><div class="hint">Wood ${res().wood || 0} &middot; Scrap ${res().scrap || 0} &middot; Stone ${res().stone || 0}</div><h3>BUILDINGS</h3><div class="grid2">`;
    for (const d of M.SAFE) {
      const lv = M.safeLv(d.id);
      h += `<div class="xt-item"><b>${esc(d.name)}</b> <span class="chip">${lv}/${d.max}</span><div class="hint">${esc(d.desc[Math.min(lv, d.max - 1)])}</div>`;
      if (lv < d.max) h += btn(M.canPay(d.costs[lv]) ? 'buysafe' : 'noop', d.id, 'BUILD: ' + costTxt(d.costs[lv]), M.canPay(d.costs[lv]) ? 'primary' : '');
      h += '</div>';
    }
    h += '</div>';
    if (M.safeLv('vendor') >= 1) {
      h += `<h3>RELIC VENDOR  (equipped ${md().relicEq.length}/${M.relicSlots()})</h3><div class="grid2">`;
      for (const r of M.RELICS) {
        const own = md().relics[r.id];
        h += `<div class="xt-item"><b>${esc(r.name)}</b><div class="hint">${esc(r.desc)}</div>` + (own ? btn('relic', r.id, md().relicEq.includes(r.id) ? 'EQUIPPED' : 'EQUIP', md().relicEq.includes(r.id) ? 'sel' : '') : btn(M.canPay(r.cost) ? 'buyrelic' : 'noop', r.id, 'BUY: ' + costTxt(r.cost))) + '</div>';
      }
      h += '</div>';
    }
    if (M.safeLv('craft') >= 1) {
      h += '<h3>CRAFTING BENCH</h3><div class="hint">Armed consumables are spent the next time you set out.</div><div class="grid2">';
      for (const c of M.CRAFT) {
        const n = md().stock[c.id] || 0;
        h += `<div class="xt-item"><b>${esc(c.name)}</b> <span class="chip">x${n}</span><div class="hint">${esc(c.desc)}</div>${btn(M.canPay(c.cost) ? 'craft' : 'noop', c.id, 'CRAFT: ' + costTxt(c.cost))}${n ? btn('arm', c.id, md().armed[c.id] ? 'ARMED' : 'ARM', md().armed[c.id] ? 'sel' : '') : ''}</div>`;
      }
      h += '</div>';
    }
    h += '<h3>COMPANION</h3>';
    if (M.safeLv('kennel') < 1) h += '<div class="hint">Build the Pet Kennel to bring a companion.</div>';
    else {
      h += '<div class="row-btns">' + btn('pet', '', 'NONE', !md().pet ? 'sel' : '');
      for (const p of M.PETS) {
        const ok = M.petUnlocked(p.id);
        h += btn(ok ? 'pet' : 'noop', p.id, esc(p.name) + (ok ? '' : ' (' + Math.round(p.at * 100) + '% codex)'), md().pet === p.id ? 'sel' : '', p.desc);
      }
      h += '</div>';
    }
    return h;
  }
  function setsTab() {
    const done = M.setsDone();
    let h = `<h3>TROPHY SETS  ${done.length}/${M.setThemes().length}</h3><div class="hint">Collect every trophy of one family to earn a permanent bonus.</div><div class="grid2">`;
    for (const t of M.setThemes()) {
      const p = M.setProgress(t);
      const ok = p.total > 0 && p.have >= p.total;
      h += `<div class="xt-item${ok ? ' done' : ''}"><b>${esc(CH.Loot.THEMES[t])}</b> <span class="chip">${p.have}/${p.total}</span><div class="hint">${esc(M.SET_BONUS[t] ? M.SET_BONUS[t].text : '')}${ok ? ' (ACTIVE)' : ''}</div></div>`;
    }
    return h + '</div>';
  }
  function bestiaryTab() {
    const seen = (md().seen && md().seen.e) || {};
    const bs = (md().seen && md().seen.b) || {};
    let h = '<h3>ENEMIES</h3><div class="grid2">';
    for (const k of Object.keys(B.enemies)) {
      const e = B.enemies[k];
      const n = seen[k];
      h += n ? `<div class="xt-item"><b>${esc(e.name || k)}</b> <span class="chip">x${n}</span><div class="hint">HP ${e.hp} &middot; DMG ${e.dmg} &middot; SPD ${e.speed}${e.slamDmg ? ' &middot; slams for ' + e.slamDmg : ''}</div></div>` : '<div class="xt-item"><b>???</b><div class="hint">Defeat one to record it.</div></div>';
    }
    h += '</div><h3>BOSSES</h3><div class="grid2">';
    for (const k of Object.keys(B.bosses || {})) {
      const e = B.bosses[k];
      const n = bs[k];
      h += n ? `<div class="xt-item"><b>${esc(e.name || k)}</b> <span class="chip">x${n}</span><div class="hint">HP ${e.hp || '?'}${e.blurb ? ' - ' + esc(e.blurb) : ''}</div></div>` : '<div class="xt-item"><b>???</b><div class="hint">Defeat this boss to record it.</div></div>';
    }
    return h + '</div>';
  }
  const OPT_LABELS = [
    ['dmgNums', 'Damage numbers'],
    ['dpsMeter', 'DPS meter'],
    ['autoFire', 'Auto-fire'],
    ['autoAim', 'Auto-aim assist'],
    ['colorblind', 'Colourblind-friendly telegraphs'],
    ['hitStop', 'Hit-stop on big hits'],
    ['lowHp', 'Low-HP warning (heartbeat + vignette)'],
    ['offscreen', 'Off-screen attack arrows'],
    ['minimap', 'Minimap / radar'],
    ['eventOrbs', 'Chaos event orbs'],
    ['showDirector', 'Show spawn-director state'],
    ['tutorial', 'Contextual tutorial tips'],
  ];
  function optsTab() {
    const o = X.opts();
    let h = '<h3>FEEDBACK &amp; ACCESSIBILITY</h3><div class="toggles">';
    for (const [k, label] of OPT_LABELS) {
      const on = o[k] !== false && (o[k] || k === 'eventOrbs');
      h += btn('opt', k, esc(label) + ': ' + (on ? 'ON' : 'OFF'), 'toggle' + (on ? ' sel' : ''));
    }
    h += `</div><h3>GAME SPEED  ${o.gameSpeed}%</h3><input type="range" id="xt-speed" min="50" max="100" step="5" value="${o.gameSpeed}">`;
    return h;
  }
  const RENDER = { ach: achTab, hero: heroTab, safe: safeTab, sets: setsTab, bestiary: bestiaryTab, opts: optsTab };
  M.ui.render = () => {
    $('xt-tabs').innerHTML = TABS.map(([k, l]) => btn('tab', k, l, S.tab === k ? 'sel' : '')).join('');
    const body = $('xt-body');
    const st = body.scrollTop;
    body.innerHTML = (RENDER[S.tab] || achTab)();
    body.scrollTop = st;
    const sp = $('xt-speed');
    if (sp) sp.oninput = () => {
      X.opts().gameSpeed = +sp.value;
      X.save();
      body.querySelector('h3:nth-of-type(2)').textContent = 'GAME SPEED  ' + sp.value + '%';
    };
  };

  const ACTS = {
    tab: (v) => (S.tab = v),
    pet: (v) => ((md().pet = v || null), Storage.save()),
    alt: (v) => ((md().alt[v] = !md().alt[v]), Storage.save()),
    skin: (v) => {
      const [id, c] = v.split('|');
      md().skin[id] = c || null;
      Storage.save();
    },
    buysafe: (v) => M.buySafe(v),
    buyrelic: (v) => M.buyRelic(v),
    relic: (v) => M.toggleRelic(v),
    craft: (v) => M.craft(v),
    arm: (v) => ((md().armed[v] = !md().armed[v]), Storage.save()),
    opt: (v) => {
      const o = X.opts();
      const cur = o[v] !== false && (o[v] || v === 'eventOrbs');
      o[v] = !cur;
      X.save();
    },
    noop: () => {},
  };
  extrasEl.querySelector('.panel').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b || !ACTS[b.dataset.act]) return;
    CH.Audio.sfx('click');
    ACTS[b.dataset.act](b.dataset.v);
    if (UI.active === 'extras' || (CH.Journal && CH.Journal.open)) M.ui.render();
  });
  M.ui.open = (tab) => {
    if (tab) S.tab = tab;
    UI.backTo = 'main';
    M.ui.render();
    UI.show('extras');
  };
  $('btn-extras').addEventListener('click', () => {
    CH.Audio.sfx('click');
    M.ui.open();
  });
  $('btn-xt-back').addEventListener('click', () => {
    CH.Audio.sfx('back');
    UI.show('main');
  });

})(window.CH);
