/* CHAOS.exe - the skill tree (PLAN.md section 15, request 7). Levelling no longer stops the game for three random
   cards: every level is a skill point, spent in a Diablo-style tree whenever you like (K, or Skills in the pause
   menu; the game waits while the tree is open). Three trees per hero:
     COMBAT    damage, crits, projectiles, the weapon level of every weapon, grenades, the special's cooldown
     SURVIVAL  health, armour, stamina, the roll, healing, barricades, loot and luck
     <HERO>    the hero's own weapon (reach, arc, heavy finisher, attack speed, piercing) and special, and a capstone
   Each tree has five tiers that open at hero levels 1, 4, 8, 12 and 18; some skills need another one first. Skills
   reuse the effects the cards had (Upgrades / perks), so every number stays in balance.js / upgrades.js / perks.js.
   Weapon evolutions now happen by themselves when a weapon reaches its top level with the matching skill.
   CH.Skills.on = false restores the old card level-ups (kept for the older card tests). */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const G = CH.G;
  const UI = CH.UI;
  const Up = CH.Upgrades;
  const X = CH.X;
  const Audio = CH.Audio;
  const wrap = X.wrap;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SK = (CH.Skills = { on: true, open: false, who: null });
  SK.TIER_LV = [1, 4, 8, 12, 18];
  /* every skill shows a power-up icon of what it does (swords for damage, boots for speed, a clover for luck ...) */
  const ICON = {"bonk":18,"crit":155,"multi":40,"ammo":11,"tenth":157,"chain":142,"boom":266,"flurry":47,"idiot":356,"reloadmine":282,"spcd":115,"cluster":284,"sticky":281,"life":10,"speed":265,"skull":5,"cardio":274,"grease":222,"snack":29,"firetrail":620,"nades":266,"refund":1,"turretbar":99,"magnet":296,"loot":28,"luck":306,"reality":435,"arc":47,"heavy":397,"swift":295,"vigil":9,"combo":503,"legend":501,"kitplus":68};

  /* node: id, name, icon, max ranks, tier (0-4), effect: up (an upgrade id) | perk (a perk id) | stat (handled in
     statHook) | weapon (+1 level to every weapon per rank); req: [node id, rank needed] */
  const N = (id, name, icon, max, tier, eff, text, req) => ({ id, name, icon, max, tier, eff, text, req: req || null });
  const COMBAT = [
    N('bonk', 'Bigger Bonk', 'ic_bonk', 5, 0, { up: 'bonk' }, (r) => '+' + 15 * r + '% damage with every weapon'),
    N('crit', 'Main Character', 'ic_crit', 5, 0, { up: 'crit' }, (r) => '+' + 7 * r + '% critical hit chance'),
    N('mastery', 'Weapon Mastery', 'pu.360', 5, 1, { weapon: 1 }, (r) => 'Every weapon +' + r + ' level' + (r > 1 ? 's' : '') + ' (more damage, faster attacks)'),
    N('multi', 'More Problems', 'ic_multi', 3, 1, { up: 'multi' }, (r) => '+' + r + ' projectile' + (r > 1 ? 's' : '') + ' per shot', ['bonk', 1]),
    N('ammo', 'Unstable Ammo', 'ic_shotspeed', 4, 1, { up: 'ammo' }, (r) => '+' + 15 * r + '% projectile speed'),
    N('tenth', 'Lucky Number Ten', 'ic_crit', 1, 2, { perk: 'tenth' }, () => 'Every 10th attack is a guaranteed crit', ['crit', 2]),
    N('chain', 'Static Cling', 'ic_power', 1, 2, { perk: 'chain' }, () => 'Kills during a x1.5+ combo chain lightning'),
    N('boom', 'Explosive Personality', 'ic_boom', 4, 2, { up: 'boom' }, (r) => '+' + 15 * r + '% explosion radius'),
    N('flurry', 'Flurry', 'pu.47', 5, 3, { stat: 'flurry' }, (r) => '+' + 6 * r + '% attack speed', ['mastery', 2]),
    N('idiot', 'Professional Idiot', 'ic_idiot', 3, 3, { up: 'idiot' }, (r) => '+' + 25 * r + '% damage below 40% health'),
    N('reloadmine', 'Booby-Trapped Mags', 'ic_boom', 1, 3, { perk: 'reloadmine' }, () => 'Reloading drops a mine'),
    N('spcd', 'Overclocked Special', 'ic_speed', 2, 4, { perk: 'spcd' }, (r) => '-' + 25 * r + '% special ability cooldown'),
    N('cluster', 'Cluster Grenades', 'ic_boom', 1, 4, { perk: 'cluster' }, () => 'Grenades burst into 5 bomblets', ['boom', 2]),
    N('sticky', 'Sticky Grenades', 'ic_magnet', 1, 4, { perk: 'sticky' }, () => 'Grenades stick to the nearest enemy'),
  ];
  const SURVIVAL = [
    N('life', 'Extra Life Insurance', 'ic_heart', 5, 0, { up: 'life' }, (r) => '+' + 20 * r + ' max health'),
    N('speed', 'Speed Demon', 'ic_speed', 4, 0, { up: 'speed' }, (r) => '+' + 8 * r + '% movement speed'),
    N('skull', 'Thick Skull', 'ic_skull', 4, 1, { up: 'skull' }, (r) => '-' + 8 * r + '% damage taken', ['life', 1]),
    N('cardio', 'Cardio Is a Myth', 'ic_stamina', 4, 1, { up: 'cardio' }, (r) => '+' + 25 * r + '% stamina regeneration'),
    N('grease', 'Greased Floor', 'ic_roll', 3, 1, { up: 'grease' }, (r) => '+' + 20 * r + '% dodge roll distance'),
    N('snack', 'Emergency Snacks', 'ic_snack', 3, 2, { up: 'snack' }, (r) => '+' + 30 * r + '% healing from everything'),
    N('firetrail', 'Flame Roll', 'ic_roll', 1, 2, { perk: 'firetrail' }, () => 'Your dodge roll leaves a trail of fire', ['grease', 1]),
    N('nades', 'Grenade Bandolier', 'ic_multi', 3, 2, { perk: 'nades' }, (r) => '+' + 2 * r + ' grenade charges'),
    N('refund', 'Refund Policy', 'ic_refund', 3, 3, { up: 'refund' }, (r) => 'Heal ' + 8 * r + ' HP when an elite dies', ['skull', 2]),
    N('turretbar', 'Armed Barricades', 'ic_weapon', 1, 3, { perk: 'turretbar' }, () => 'Your barricades shoot nearby enemies'),
    N('magnet', 'Fridge Magnets', 'ic_magnet', 3, 3, { up: 'magnet' }, (r) => '+' + 38 * r + ' pickup range'),
    N('loot', 'Loot Goblin', 'ic_coin', 4, 4, { up: 'loot' }, (r) => '+' + 25 * r + '% coins'),
    N('luck', 'Lucky Clover', 'ic_reality', 4, 4, { up: 'luck' }, (r) => '+' + 25 * r + '% luck: rarer drops'),
    N('reality', 'Reality Is Optional', 'ic_reality', 3, 4, { up: 'reality' }, (r) => 'A random good effect every ' + Math.max(10, 28 - 6 * r) + 's'),
  ];
  /* the hero tree: the own weapon first (reach / arc for blades, range / piercing for bows and guns) */
  function heroTree(hero) {
    const sig = CH.HeroAtk && CH.HeroAtk.SIG[hero];
    const melee = !sig || sig.kind === 'melee' || sig.kind === 'pulse';
    const wn = sig ? sig.name : 'Weapon';
    const HP = { Mercenary: 'twin', Dreadbloom: 'briar', Vexaria: 'bloodlust' };
    const SPP = { Mercenary: 'pull', Dreadbloom: 'thornfield', Vexaria: 'bloodspread' };
    const pk = (id) => X.perkList.find((d) => d.id === id);
    const out = [
      N('honed', 'Honed ' + wn.split(' ').pop(), sig ? sig.icon : 'ic_bonk', 5, 0, { stat: 'honed' }, (r) => '+' + 10 * r + '% damage with the ' + wn),
      melee ? N('reach', 'Long Reach', 'pu.360', 3, 0, { stat: 'reach' }, (r) => '+' + 12 * r + '% sword reach')
        : N('reach', 'Eagle Eye', 'pu.100', 3, 0, { stat: 'reach' }, (r) => '+' + 15 * r + '% range and arrow speed'),
      melee ? N('arc', 'Wide Sweep', 'pu.47', 3, 1, { stat: 'arc' }, (r) => '+' + 15 * r + '% swing width', ['reach', 1])
        : N('arc', 'Piercing Shots', 'pu.96', 3, 1, { stat: 'arc' }, (r) => 'Shots pass through ' + r + ' more enem' + (r > 1 ? 'ies' : 'y'), ['reach', 1]),
      N('heavy', 'Heavy Finisher', 'ic_boom', 3, 1, { stat: 'heavy' }, (r) => 'The combo finisher hits ' + 20 * r + '% harder'),
      N('swift', 'Swift Hands', 'ic_speed', 3, 2, { stat: 'swift' }, (r) => '+' + 8 * r + '% attack speed with the ' + wn, ['honed', 2]),
    ];
    if (HP[hero] && pk(HP[hero])) { const d = pk(HP[hero]); out.push(N(d.id, d.name, d.icon, 1, 2, { perk: d.id }, () => d.text(1))); }
    else out.push(N('vigil', 'Vigil', 'ic_heart', 3, 2, { stat: 'vigil' }, (r) => 'Regenerate ' + r + ' HP every 2 seconds'));
    if (SPP[hero] && pk(SPP[hero])) { const d = pk(SPP[hero]); out.push(N(d.id, d.name, d.icon, 1, 3, { perk: d.id }, () => d.text(1), ['swift', 1])); }
    else out.push(N('kitplus', 'Empowered Special', 'ic_power', 1, 3, { perk: 'kitplus' }, () => 'Your special is bigger: more spirits, a longer slash, a wider stare', ['swift', 1]));
    out.push(N('combo', 'Momentum', 'ic_multi', 3, 3, { stat: 'combo' }, (r) => 'Each hit of a combo +' + 5 * r + '% damage'));
    out.push(N('legend', 'Legend', 'ic_crit', 1, 4, { stat: 'legend' }, () => '+15% damage, +10% crit, +30 max health', ['heavy', 2]));
    return out;
  }
  SK.trees = function (p) {
    const hid = (p && p.hero && p.hero.id) || CH.Storage.settings.hero;
    const hn = ((B.heroes.find((h) => h.id === hid) || {}).name || hid).split(',')[0].toUpperCase();
    return [{ id: 'combat', name: 'COMBAT', nodes: COMBAT }, { id: 'survival', name: 'SURVIVAL', nodes: SURVIVAL }, { id: 'hero', name: hn, nodes: heroTree(hid) }];
  };
  const nodeOf = (p, id) => { for (const t of SK.trees(p)) for (const n of t.nodes) if (n.id === id) return n; return null; };

  /* ------------------------------------------------------------------ per-player state */
  const st = (p) => {
    if (!p.skills) { p.skills = {}; p.sp = p.sp || 0; }
    return p.skills;
  };
  SK.rank = (p, id) => (p && p.skills && p.skills[id]) || 0;
  SK.spent = (p) => Object.values(st(p)).reduce((a, b) => a + b, 0);
  SK.canLearn = function (p, n) {
    if (!n || SK.rank(p, n.id) >= n.max) return 'MAXED';
    if ((p.sp || 0) <= 0) return 'NO POINTS';
    if (p.level < SK.TIER_LV[n.tier]) return 'NEEDS LEVEL ' + SK.TIER_LV[n.tier];
    if (n.req && SK.rank(p, n.req[0]) < n.req[1]) { const r = nodeOf(p, n.req[0]); return 'NEEDS ' + (r ? r.name.toUpperCase() : n.req[0]) + ' ' + n.req[1]; }
    return '';
  };
  SK.learn = function (p, id) {
    const n = nodeOf(p, id);
    const why = SK.canLearn(p, n);
    if (why) { Audio.sfx('nope'); return false; }
    st(p)[id] = SK.rank(p, id) + 1;
    p.sp--;
    apply(p, n);
    Audio.sfx(SK.rank(p, id) === n.max ? 'enchant' : 'buy');
    FX.text(p.x, p.y - 24, n.name.toUpperCase() + ' ' + SK.rank(p, id), '#fee761', 1);
    FX.ring(p.x, p.y, 4, 30, '#fee761', 0.35);
    return true;
  };
  function apply(p, n) {
    const r = SK.rank(p, n.id);
    const e = n.eff;
    if (e.up) { p.upgrades[e.up] = Math.max(p.upgrades[e.up] || 0, r); }
    if (e.perk) {
      p.perks = p.perks || {};
      const before = p.perks[e.perk] || 0;
      p.perks[e.perk] = r;
      if (e.perk === 'nades' && r > before) { p.maxNades += 2; p.nades += 2; }
    }
    if (e.weapon) for (const w of p.weapons) if (p.ws[w]) p.ws[w].level = Math.min(B.weaponMaxLevel, Math.max(p.ws[w].level, 1 + r));
    Up.recalc(p);
    evolve(p);
    if (G.ui && G.ui.refreshWeapons) G.ui.refreshWeapons();
  }
  /* weapons learnt later get the mastery levels too */
  wrap(CH.Player.prototype, 'addWeapon', function (orig, id) {
    const r = orig.call(this, id);
    const m = SK.rank(this, 'mastery');
    if (m && this.ws[id]) this.ws[id].level = Math.min(B.weaponMaxLevel, Math.max(this.ws[id].level, 1 + m));
    if (this.skills) evolve(this);
    return r;
  });
  /* a weapon at its top level with the matching skill evolves by itself */
  function evolve(p) {
    if (!SK.on || !X.evoReady || !p.evo) return;
    for (const w of X.evoReady(p)) Up.applyCard(G, { kind: 'evolve', id: w, name: X.EVO[w].name }, p);
  }

  /* skill stats (added on top of the upgrade / perk stats every recalculation) */
  X.statHooks.push((p, s) => {
    const r = (id) => SK.rank(p, id);
    s.atkSpeed = (1 + 0.06 * r('flurry')) * (1 + 0.08 * r('swift'));
    s.sigDmg = 1 + 0.1 * r('honed');
    s.reachMul = 1 + (CH.HeroAtk && CH.HeroAtk.sigOf(p) && /bow|gun/.test(CH.HeroAtk.sigOf(p).kind) ? 0.15 : 0.12) * r('reach');
    s.arcMul = 1 + 0.15 * r('arc');
    s.pierceAdd = r('arc');
    s.heavyMul = 1 + 0.2 * r('heavy');
    s.comboStep = 0.05 * r('combo');
    s.vigil = r('vigil');
    if (r('legend')) { s.dmgMult *= 1.15; s.critChance += 0.1; s.maxHp += 30; }
  });
  /* Vigil: a slow regeneration */
  wrap(CH.Player.prototype, 'update', function (orig, g, dt) {
    if (this.stats && this.stats.vigil && !this.dead) {
      this.vigilT = (this.vigilT || 0) + dt;
      if (this.vigilT >= 2) { this.vigilT = 0; this.hp = Math.min(this.maxHp, this.hp + this.stats.vigil); }
    }
    return orig.call(this, g, dt);
  });

  /* ------------------------------------------------------------------ levelling: points instead of cards */
  wrap(G, 'openLevelUp', function (orig) {
    if (!SK.on) return orig.call(G);
    G.pendingLevels--;
    for (const p of G.players) {
      st(p);
      p.sp = (p.sp || 0) + 1;
      FX.vfx('vfx.p5.18', p.x, p.y - 6, { scale: 0.9, fps: 14 });
      FX.ring(p.x, p.y, 4, 40, '#fee761', 0.45);
      FX.text(p.x, p.y - 30, 'LEVEL ' + (p.level - G.pendingLevels), '#fee761', 2);
    }
    Audio.sfx('levelup');
    const p = G.player;
    if (G.ui && G.ui.toast) G.ui.toast('LEVEL UP: +1 SKILL POINT  (' + (CH.Input.lastUsed === 'pad' ? 'START > SKILLS' : 'K') + ')');
    return undefined;
  });
  G.on('newRun', function () {
    for (const p of G.players) { p.skills = {}; p.sp = 0; }
  });

  /* ------------------------------------------------------------------ the screen */
  let el = null, cur = null;
  SK.init = function () {
    if (el) return;
    el = document.createElement('div');
    el.className = 'screen dim';
    el.id = 'screen-skills';
    el.innerHTML = '<div class="panel wide paper sk-panel"><div class="sk-head"><canvas class="sk-port" width="40" height="40"></canvas><div class="sk-title"><h2>SKILLS</h2><div class="sk-sub" id="sk-sub"></div></div><div class="sk-pts" id="sk-pts"></div><div class="sk-who" id="sk-who"></div></div>' +
      '<div class="sk-trees" id="sk-trees"></div><div class="sk-info" id="sk-info"></div>' +
      '<div class="row-btns"><button class="btn back" id="sk-close">CLOSE</button></div><div class="hint center sk-hint">Arrows / stick to move, ENTER / A to learn, ESC / B to close</div></div>';
    $('screen-pause').parentNode.appendChild(el);
    UI.SCREENS.push('skills');
    $('sk-close').onclick = () => SK.close();
  };
  SK.show = function (who) {
    SK.init();
    if (!G.player) return false;
    if (G.state === 'playing') { G.state = 'paused'; SK.resume = true; } else SK.resume = false;
    SK.open = true;
    SK.who = who || G.player;
    st(SK.who);
    CH.Input.clear();
    Audio.sfx('book');
    render();
    UI.show('skills');
    setTimeout(() => { const f = el.querySelector('.sk-node.ready') || el.querySelector('.sk-node'); if (f && SK.open) f.focus({ preventScroll: true }); }, 40);
    return true;
  };
  SK.close = function () {
    if (!SK.open) return;
    SK.open = false;
    Audio.sfx('back');
    if (SK.resume) { UI.hideAll(); G.state = 'playing'; CH.Input.clear(); G.ui.hidePause && G.ui.hidePause(); }
    else UI.show('pause');
  };
  const iconUrl = (n, id) => {
    if (id && ICON[id] && CH.Sprites.has('pu.' + ICON[id]) && !(id === 'honed')) n = 'pu.' + ICON[id];
    else if (!n.startsWith('pu.') && id && /twin|briar|bloodlust|pull|thornfield|bloodspread/.test(id)) n = 'pu.' + ({ twin: 99, briar: 176, bloodlust: 76, pull: 296, thornfield: 167, bloodspread: 141 })[id];
    const name = n.startsWith('pu.') ? n : X.icon(n);
    try { return CH.Sprites.icon(name); } catch (e) { return ''; }
  };
  function render() {
    const p = SK.who;
    $('sk-sub').textContent = (p.hero.name || p.hero.id).toUpperCase() + '  LEVEL ' + p.level;
    $('sk-pts').innerHTML = '<b>' + (p.sp || 0) + '</b> POINT' + ((p.sp || 0) === 1 ? '' : 'S');
    $('sk-who').textContent = G.players.length > 1 ? 'P' + (G.players.indexOf(p) + 1) + '  (Q / E: other player)' : '';
    const port = el.querySelector('.sk-port').getContext('2d');
    port.imageSmoothingEnabled = false;
    port.clearRect(0, 0, 40, 40);
    CH.Player.drawShowcase(port, p.hero.id, 20, 38, 1, 'idle', G.wall || 0);
    const host = $('sk-trees');
    host.textContent = '';
    for (const t of SK.trees(p)) {
      const col = document.createElement('div');
      col.className = 'sk-tree';
      const spent = t.nodes.reduce((a, n) => a + SK.rank(p, n.id), 0);
      col.innerHTML = '<div class="sk-tname">' + esc(t.name) + ' <span>' + spent + '</span></div>';
      for (let tier = 0; tier < 5; tier++) {
        const row = document.createElement('div');
        row.className = 'sk-row' + (p.level < SK.TIER_LV[tier] ? ' lockedrow' : '');
        row.innerHTML = '<span class="sk-lv">' + SK.TIER_LV[tier] + '</span>';
        for (const n of t.nodes.filter((q) => q.tier === tier)) {
          const b = document.createElement('button');
          const r = SK.rank(p, n.id);
          const why = SK.canLearn(p, n);
          b.className = 'sk-node' + (r >= n.max ? ' maxed' : r > 0 ? ' some' : '') + (why && why !== 'NO POINTS' && why !== 'MAXED' ? ' locked' : '') + (!why ? ' ready' : '');
          b.dataset.id = n.id;
          let pips = '';
          for (let i = 0; i < n.max; i++) pips += '<i class="' + (i < r ? 'on' : '') + '"></i>';
          b.innerHTML = '<img alt="" src="' + iconUrl(n.icon, n.id) + '"><span class="sk-n">' + esc(n.name) + '</span><span class="sk-pips">' + pips + '</span>';
          b.onclick = () => { if (SK.learn(p, n.id)) { const id = n.id; render(); const nb = host.querySelector('[data-id="' + id + '"]'); if (nb) nb.focus(); } };
          b.onfocus = b.onmouseenter = () => info(p, n);
          row.appendChild(b);
        }
        col.appendChild(row);
      }
      host.appendChild(col);
    }
    if (!cur) info(p, SK.trees(p)[0].nodes[0]);
  }
  function info(p, n) {
    cur = n;
    const r = SK.rank(p, n.id);
    const why = SK.canLearn(p, n);
    const now = r ? n.text(r) : 'Not learnt';
    const next = r < n.max ? n.text(r + 1) : '';
    $('sk-info').innerHTML = '<b>' + esc(n.name.toUpperCase()) + '</b> <span class="sk-rank">RANK ' + r + ' / ' + n.max + '</span><br>' +
      '<span class="sk-now">' + esc(now) + '</span>' + (next ? '<br><span class="sk-next">NEXT: ' + esc(next) + '</span>' : '') +
      (why && why !== 'MAXED' ? '<br><span class="sk-why">' + esc(why) + '</span>' : '');
  }
  SK.render = () => { if (SK.open) render(); };

  /* keys: K toggles, Esc / B closes, Q / E switch players in co-op */
  const prevGlobal = UI.onGlobalKey;
  UI.onGlobalKey = function (a) {
    if (a === 'skills') {
      if (SK.open) return SK.close();
      if (G.state === 'playing' || (G.state === 'paused' && UI.active === 'pause')) return SK.show(G.player);
      return;
    }
    if (a === 'pause' && SK.open) return SK.close();
    return prevGlobal(a);
  };
  CH.Input.onGlobal = UI.onGlobalKey;
  const prevMenu = UI.onMenuKey;
  UI.onMenuKey = function (e) {
    if (SK.open && UI.active === 'skills' && (e.code === 'KeyQ' || e.code === 'KeyE') && G.players.length > 1) {
      const i = G.players.indexOf(SK.who);
      SK.who = G.players[(i + (e.code === 'KeyE' ? 1 : G.players.length - 1)) % G.players.length];
      cur = null;
      render();
      return;
    }
    return prevMenu(e);
  };
  CH.Input.onMenuKey = UI.onMenuKey;
  const prevNav = UI.navigate;
  UI.navigate = function (dir) {
    if (!(SK.open && UI.active === 'skills')) return prevNav(dir);
    const nodes = Array.from(el.querySelectorAll('.sk-node'));
    const f = document.activeElement;
    let i = nodes.indexOf(f);
    if (i < 0) { (el.querySelector('.sk-node.ready') || nodes[0]).focus(); Audio.sfx('hover'); return true; }
    const r0 = f.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    let best = null, bs = 1e9;
    for (const b of nodes) {
      if (b === f) continue;
      const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const dx = x - cx, dy = y - cy;
      const ok = dir === 'up' ? dy < -4 : dir === 'down' ? dy > 4 : dir === 'left' ? dx < -4 : dx > 4;
      if (!ok) continue;
      const along = dir === 'up' || dir === 'down' ? Math.abs(dy) : Math.abs(dx), across = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
      const s = along + across * 2.5;
      if (s < bs) { bs = s; best = b; }
    }
    if (!best && (dir === 'down')) best = $('sk-close');
    if (best) { best.focus(); Audio.sfx('hover'); }
    return true;
  };
  const prevCancel = UI.cancel;
  UI.cancel = function () { if (SK.open) return SK.close(); return prevCancel(); };

  /* the pause menu gets a Skills button (and the HUD shows unspent points) */
  SK.addPauseButton = function () {
    const row = document.querySelector('#screen-pause .pz-row');
    const panel = document.querySelector('#screen-pause .panel');
    if (!panel || $('btn-skills')) return;
    const b = document.createElement('button');
    b.className = row ? 'pz-btn' : 'btn';
    b.id = 'btn-skills';
    b.title = 'Skills (K)';
    b.setAttribute('aria-label', 'Skills');
    b.innerHTML = row ? '<img src="' + iconUrl('pu.41') + '" alt="">' : 'SKILLS';
    b.classList.add('sk-pause');
    b.onclick = () => { Audio.sfx('click'); SK.show(G.player); };
    if (row) row.appendChild(b); // after the Journal / Map icons, so they keep their places
    else { const first = panel.querySelector('.btn'); if (first && first.parentNode) first.parentNode.insertBefore(b, first); else panel.appendChild(b); } // the plain pause panel (no pack UI)
  };
  wrap(UI, 'updateHUD', function (orig) {
    const r = orig.apply(UI, arguments);
    let chip = $('sk-chip');
    const p = G.player;
    const n = SK.on && p ? p.sp || 0 : 0;
    if (!chip && n > 0) {
      chip = document.createElement('div');
      chip.id = 'sk-chip';
      chip.onclick = () => SK.show(G.player);
      $('hud').appendChild(chip);
    }
    if (chip) {
      chip.style.display = n > 0 ? '' : 'none';
      const t = n + ' SKILL POINT' + (n > 1 ? 'S' : '') + '  [' + (CH.Input.lastUsed === 'pad' ? 'START' : 'K') + ']';
      if (chip.textContent !== t) chip.textContent = t;
    }
    return r;
  });
})(window.CH);
