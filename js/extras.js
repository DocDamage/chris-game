/* CHAOS.exe - EXTRAS & MODES screen (run modes, daily, challenges, Heat, loadouts, pets, history, achievements, heroes and
   mastery, safehouse extras, trophy sets, bestiary, options) plus the end-of-run summary screen. */
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
  const extrasEl = mk('extras', '<div class="panel wide"><h2>EXTRAS &amp; MODES</h2><div class="xt-tabs" id="xt-tabs"></div><div class="scroll xt-body" id="xt-body"></div><div class="row-btns"><button class="btn back" id="btn-xt-back">BACK</button></div></div>');
  const sumEl = mk('summary', '<div class="panel wide"><h2>RUN SUMMARY</h2><div class="scroll xt-body" id="sum-body"></div><div class="row-btns"><button class="btn primary" id="btn-sum-back">BACK</button></div></div>');

  const TABS = [
    ['play', 'PLAY'],
    ['hist', 'HISTORY'],
    ['ach', 'ACHIEVEMENTS'],
    ['hero', 'HEROES'],
    ['safe', 'SAFEHOUSE+'],
    ['sets', 'TROPHY SETS'],
    ['bestiary', 'BESTIARY'],
    ['opts', 'OPTIONS'],
  ];
  const S = (M.ui = { tab: 'play', mode: 'classic', challenge: '', heat: {}, seed: '' });
  const $ = (id) => document.getElementById(id);
  const btn = (act, v, label, cls, title) => `<button class="btn small ${cls || ''}" data-act="${act}" data-v="${esc(v === undefined ? '' : v)}"${title ? ` title="${esc(title)}"` : ''}>${label}</button>`;
  const costTxt = (c) => Object.keys(c).map((k) => c[k] + ' ' + k).join(', ');
  const res = () => Storage.resources;

  function playTab() {
    const m = md();
    let h = '<h3>RUN MODE</h3><div class="row-btns">';
    for (const k of Object.keys(X.MODES)) h += btn('mode', k, X.MODES[k].name, S.mode === k ? 'sel' : '', X.MODES[k].desc);
    h += `</div><div class="hint">${esc(X.MODES[S.mode].desc)}</div>`;
    h += '<h3>CHALLENGE</h3><div class="row-btns">' + btn('chal', '', 'NONE', !S.challenge ? 'sel' : '');
    for (const c of M.CHALLENGES) h += btn('chal', c.id, c.name, S.challenge === c.id ? 'sel' : '', c.desc);
    h += '</div>';
    const ch = M.CHALLENGES.find((c) => c.id === S.challenge);
    if (ch) h += `<div class="hint">${esc(ch.desc)}</div>`;
    const tot = M.heatTotal(S.heat);
    h += `<h3>HEAT  ${tot}  (score x${(1 + 0.1 * tot).toFixed(1)})</h3><div class="grid2">`;
    for (const p of M.PACTS) {
      const r = S.heat[p.id] || 0;
      h += `<div class="xt-item"><b>${esc(p.name)}</b> <span class="chip">${r}/${p.max}</span><div class="hint">${esc(p.desc)} (+${p.heat} heat)</div>${btn('heat-', p.id, '-')}${btn('heat+', p.id, '+')}</div>`;
    }
    h += '</div><h3>STARTING LOADOUT</h3>';
    const lo = m.loadout || {};
    const mw = Object.keys(m.maxedW);
    const mu = Object.keys(m.maxedU);
    h += '<div class="hint">Max out a weapon or upgrade in any run to start future runs with it.</div><div class="row-btns">' + btn('lw', '', 'DEFAULT WEAPON', !lo.weapon ? 'sel' : '');
    for (const id of mw) h += btn('lw', id, esc((B.weapons[id] || { name: id }).name), lo.weapon === id ? 'sel' : '');
    h += '</div><div class="row-btns">' + btn('lu', '', 'NO UPGRADE', !lo.upgrade ? 'sel' : '');
    for (const id of mu) h += btn('lu', id, esc((CH.Upgrades.byId[id] || { name: id }).name || id), lo.upgrade === id ? 'sel' : '');
    h += '</div>';
    h += '<h3>COMPANION</h3>';
    if (M.safeLv('kennel') < 1) h += '<div class="hint">Build the Pet Kennel in SAFEHOUSE+ to bring a companion.</div>';
    else {
      h += '<div class="row-btns">' + btn('pet', '', 'NONE', !m.pet ? 'sel' : '');
      for (const p of M.PETS) {
        const ok = M.petUnlocked(p.id);
        h += btn(ok ? 'pet' : 'noop', p.id, esc(p.name) + (ok ? '' : ' (' + Math.round(p.at * 100) + '% codex)'), m.pet === p.id ? 'sel' : '', p.desc);
      }
      h += '</div>';
    }
    const dk = M.dailyKey();
    const d = M.dailySetup(dk);
    h += `<h3>DAILY RUN  ${dk}</h3><div class="hint">Fixed seed, hero (${esc(B.heroes.find((x) => x.id === d.hero).name)}), mode (${esc(X.MODES[d.mode].name)}) and pacts (${M.PACTS.filter((p) => d.heat[p.id]).map((p) => esc(p.name)).join(', ')}).</div>`;
    h += '<div class="hint">Today: ' + (M.board('d:' + dk).map((e) => U.fmtNum(e.score)).join(' / ') || 'no scores yet') + '</div>';
    h += '<h3>CUSTOM SEED</h3><input id="xt-seed" class="xt-input" maxlength="24" placeholder="any text (blank = random)" value="' + esc(S.seed) + '">';
    h += '<div class="row-btns">' + btn('start', '', 'START RUN', 'primary') + btn('daily', '', 'PLAY TODAY\'S DAILY') + btn('tutorial', '', 'TUTORIAL WAVE') + (M.safeLv('dummy') ? btn('training', '', 'TRAINING ROOM') : '') + '</div>';
    return h;
  }
  function histTab() {
    const m = md();
    let h = '<h3>RECENT RUNS</h3>';
    if (!m.history.length) h += '<div class="hint">No runs recorded yet.</div>';
    else {
      h += '<table class="xt-table"><tr><td>WHEN</td><td>HERO</td><td>MODE</td><td>WAVE</td><td>SCORE</td><td>RESULT</td></tr>';
      for (const e of m.history.slice(0, 20)) {
        const dt = new Date(e.t);
        h += `<tr><td>${dt.getMonth() + 1}/${dt.getDate()}</td><td>${esc(e.hero)}</td><td>${esc(e.mode)}${e.heat ? ' H' + e.heat : ''}${e.challenge ? ' *' : ''}</td><td>${e.wave}</td><td>${U.fmtNum(e.score)}</td><td>${e.win ? '<span style="color:#63c74d">WIN</span>' : 'Lost' + (e.by ? ' to ' + esc(e.by) : '')}</td></tr>`;
      }
      h += '</table>';
    }
    h += '<h3>LEADERBOARDS</h3>';
    const keys = Object.keys(m.board).sort().reverse().slice(0, 8);
    if (!keys.length) h += '<div class="hint">Finish a daily or seeded run to post a score.</div>';
    for (const k of keys) h += `<div class="xt-item"><b>${esc(k.startsWith('d:') ? 'DAILY ' + k.slice(2) : 'SEED ' + k.slice(2))}</b> ${m.board[k].map((e, i) => `<div class="hint">#${i + 1} ${U.fmtNum(e.score)} - ${esc(e.hero)} wave ${e.wave}</div>`).join('')}</div>`;
    h += '<h3>BEST-RUN GHOSTS</h3>';
    const gk = Object.keys(m.ghost);
    h += gk.length ? '<div class="hint">' + gk.map((k) => `${esc(k.replace('|', ' / '))}: ${U.fmtNum(m.ghost[k].score)}`).join(' &middot; ') + '</div>' : '<div class="hint">None yet - your best run per mode is shown as a live GHOST +/- while you play.</div>';
    h += '<div class="hint">Wins with a challenge: ' + (M.CHALLENGES.map((c) => esc(c.name) + ' ' + (m.chal[c.id] || 0)).join(' &middot; ')) + '</div>';
    return h;
  }
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
      h += '<h3>CRAFTING BENCH</h3><div class="hint">Armed consumables are spent at the start of your next run.</div><div class="grid2">';
      for (const c of M.CRAFT) {
        const n = md().stock[c.id] || 0;
        h += `<div class="xt-item"><b>${esc(c.name)}</b> <span class="chip">x${n}</span><div class="hint">${esc(c.desc)}</div>${btn(M.canPay(c.cost) ? 'craft' : 'noop', c.id, 'CRAFT: ' + costTxt(c.cost))}${n ? btn('arm', c.id, md().armed[c.id] ? 'ARMED' : 'ARM', md().armed[c.id] ? 'sel' : '') : ''}</div>`;
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
    ['showGhost', 'Best-run ghost delta'],
    ['tutorial', 'Contextual tutorial tips'],
  ];
  function optsTab() {
    const o = X.opts();
    let h = '<h3>FEEDBACK &amp; ACCESSIBILITY</h3><div class="toggles">';
    for (const [k, label] of OPT_LABELS) {
      const on = o[k] !== false && (o[k] || ['eventOrbs', 'showGhost'].includes(k));
      h += btn('opt', k, esc(label) + ': ' + (on ? 'ON' : 'OFF'), 'toggle' + (on ? ' sel' : ''));
    }
    h += `</div><h3>GAME SPEED  ${o.gameSpeed}%</h3><input type="range" id="xt-speed" min="50" max="100" step="5" value="${o.gameSpeed}">`;
    return h;
  }
  const RENDER = { play: playTab, hist: histTab, ach: achTab, hero: heroTab, safe: safeTab, sets: setsTab, bestiary: bestiaryTab, opts: optsTab };
  M.ui.render = () => {
    $('xt-tabs').innerHTML = TABS.map(([k, l]) => btn('tab', k, l, S.tab === k ? 'sel' : '')).join('');
    const body = $('xt-body');
    const st = body.scrollTop;
    body.innerHTML = RENDER[S.tab]();
    body.scrollTop = st;
    const sd = $('xt-seed');
    if (sd) sd.oninput = () => (S.seed = sd.value);
    const sp = $('xt-speed');
    if (sp) sp.oninput = () => {
      X.opts().gameSpeed = +sp.value;
      X.save();
      body.querySelector('h3:nth-of-type(2)').textContent = 'GAME SPEED  ' + sp.value + '%';
    };
  };

  const start = (setup) => {
    UI.hideAll();
    M.launch(setup, null);
  };
  const ACTS = {
    tab: (v) => (S.tab = v),
    mode: (v) => (S.mode = v),
    chal: (v) => (S.challenge = v),
    'heat+': (v) => {
      const p = M.PACTS.find((x) => x.id === v);
      S.heat[v] = Math.min(p.max, (S.heat[v] || 0) + 1);
    },
    'heat-': (v) => {
      S.heat[v] = Math.max(0, (S.heat[v] || 0) - 1);
      if (!S.heat[v]) delete S.heat[v];
    },
    lw: (v) => ((md().loadout = Object.assign({}, md().loadout, { weapon: v || null })), Storage.save()),
    lu: (v) => ((md().loadout = Object.assign({}, md().loadout, { upgrade: v || null })), Storage.save()),
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
      const cur = o[v] !== false && (o[v] || ['eventOrbs', 'showGhost'].includes(v));
      o[v] = !cur;
      X.save();
    },
    noop: () => {},
    start: () => {
      const seedTxt = S.seed.trim();
      const setup = { mode: S.mode, challenge: S.challenge || null, heat: Object.assign({}, S.heat) };
      if (seedTxt) {
        setup.seed = M.hash(seedTxt);
        setup.seedLabel = seedTxt.toLowerCase();
      }
      start(setup);
    },
    daily: () => start(M.dailySetup()),
    tutorial: () => start({ mode: 'tutorial' }),
    training: () => start({ mode: 'training' }),
  };
  extrasEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b || !ACTS[b.dataset.act]) return;
    CH.Audio.sfx('click');
    ACTS[b.dataset.act](b.dataset.v);
    if (UI.active === 'extras') M.ui.render();
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

  /* ---- run summary, opened from the game-over / victory screens */
  M.ui.openSummary = (from) => {
    $('sum-body').innerHTML = M.summaryHTML();
    sumEl.dataset.from = from;
    UI.show('summary');
  };
  $('btn-sum-back').addEventListener('click', () => UI.show(sumEl.dataset.from || 'gameover'));
  for (const [scr, id] of [['gameover', 'btn-sum-go'], ['victory', 'btn-sum-vic']]) {
    const row = document.querySelector('#screen-' + scr + ' .row-btns');
    const b = document.createElement('button');
    b.className = 'btn';
    b.id = id;
    b.textContent = 'RUN SUMMARY';
    b.addEventListener('click', () => {
      CH.Audio.sfx('click');
      M.ui.openSummary(scr);
    });
    row.appendChild(b);
  }
})(window.CH);
