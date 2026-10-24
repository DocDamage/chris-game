/* CHAOS.exe - the vending machine shop menu (PLAN.md section 6).
   Standing at a machine and pressing interact pauses the game (G.state = 'shop') and opens a real menu: categories,
   an item grid with the pack's slot frames, a detail panel with large item art, buy / sell / buyback, stock reroll.
   In co-op everybody pauses and the player who opened it owns the menu, in their own colour.
   Stock is generated per machine (seeded by the run rng where there is one) and prices scale with depth. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const G = CH.G;
  const UI = CH.UI;
  const UIK = CH.UIK;
  const FX = CH.FX;
  const Audio = CH.Audio;
  const X = CH.X;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const Shop = (CH.Shop = { open: false, owner: null, cat: 'food', sel: 0, buyback: [], extraCats: [] });
  const depth = () => Math.max(1, G.tier() || 1);
  const rng = () => (CH.Waves && CH.Waves.rng ? CH.Waves.rng() : Math.random());
  const priceMul = () => (1 + 0.07 * (depth() - 1)) * ((G.diff && G.diff.shopMul) || 1);

  /* ------------------------------------------------------------------ catalogue */
  /* icon: {pack: n} = a pack item (large art), {spr: 'name'} = a game sprite icon, {pu: n} = a power-up icon */
  const P = (id) => G.players.filter((p) => !p.dead);
  const FOOD = [
    { id: 'meat', belt: 'meat', name: 'Meat Scraps', desc: 'Goes on your belt. Heals 30% of max HP over time.', price: 14, icon: { pack: 7 }, use: (p) => G.healPlayer((p.maxHp * 0.3) / p.stats.healMult / G.diff.heal, p) },
    { id: 'steak', belt: 'steak', name: 'Prime Steak', desc: 'Goes on your belt. Heals 60% of max HP over time.', price: 28, icon: { pack: 20 }, use: (p) => G.healPlayer((p.maxHp * 0.6) / p.stats.healMult / G.diff.heal, p) },
    { id: 'egg', belt: 'egg', name: 'Golden Egg', desc: 'Goes on your belt. A 40 point shield and a little healing.', price: 22, icon: { pack: 15 }, use: (p) => { G.healPlayer((p.maxHp * 0.1) / p.stats.healMult / G.diff.heal, p); p.buffs.shield = 10; p.shield = Math.max(p.shield || 0, 40); } },
    { id: 'fish', belt: 'fish', name: 'Glow Fish', desc: 'Goes on your belt. Refills stamina, heals 20%.', price: 20, icon: { pack: 16 }, use: (p) => { p.stamina = B.player.stamina; p.exhausted = false; G.healPlayer((p.maxHp * 0.2) / p.stats.healMult / G.diff.heal, p); } },
    { id: 'candy', belt: 'candy', name: 'Sugar Rush', desc: 'Goes on your belt. Haste for 12 seconds.', price: 18, icon: { pack: 17 }, use: (p) => { p.buffs.haste = Math.max(p.buffs.haste || 0, 12); CH.Upgrades.recalc(p); } },
    { id: 'feather', belt: 'feather', name: 'Portal Quill', desc: 'Goes on your belt. Opens a town portal: go shopping, then walk back through.', price: 30, icon: { pack: 13 }, repeat: true, use: () => {} },
    { id: 'herb', belt: 'herb', name: 'Healing Herb', desc: 'Goes on your belt. Cleanses status effects; heals 15%.', price: 12, icon: { pack: 23 }, use: (p) => { X.cleanse && X.cleanse(p); G.healPlayer((p.maxHp * 0.15) / p.stats.healMult / G.diff.heal, p); } },
    { id: 'nades', name: 'Grenade Crate', desc: '+3 grenades.', price: 24, icon: { spr: 'prob_bomb' }, use: (p) => { p.nades = (p.nades || 0) + 3; } },
  ];
  function powerItems() {
    const PU = CH.PowerUps;
    return PU.timed.map((k) => {
      const d = PU.KINDS[k];
      return { id: 'pw_' + k, name: d.name, desc: d.text, price: 26, icon: { pu: d.icons[0] }, use: (p) => CH.Upgrades.givePower(G, k, p) };
    });
  }
  const SERVICES = [
    { id: 'reroll', name: '+2 Rerolls', desc: 'Reroll tokens for level-up cards.', price: 20, icon: { spr: 'ic_multi' }, use: (p) => (p.rr.reroll += 2) },
    { id: 'banish', name: '+1 Banish', desc: 'Banish a card from the pool for good.', price: 25, icon: { spr: 'ic_skull' }, use: (p) => (p.rr.banish += 1) },
    { id: 'card', name: 'Upgrade Card', desc: 'A free level-up pick when you leave.', price: 60, icon: { spr: 'ic_power' }, use: () => { CH.Waves && (CH.Waves.cardOwed = (CH.Waves.cardOwed || 0) + 1); } },
    { id: 'heal', name: 'Full Repair', desc: 'Heals the whole party completely.', price: 70, icon: { spr: 'ic_heart' }, party: true, use: (p) => G.healPlayer(p.maxHp, p) },
    { id: 'xp', name: 'XP Tome', desc: 'A big chunk of experience.', price: 40, icon: { pack: 14 }, use: (p) => CH.Upgrades.addXp(G, Math.round(B.xp.need(p.level) * 0.8), p) },
  ];
  const GAMBLE = [{ id: 'gamble', name: 'BZZT! Mystery Slot', desc: 'The old way: a random result. Cheaper, riskier, funnier.', price: 12, icon: { spr: 'coin' }, repeat: true, use: gamble }];

  function gamble(p) {
    const unowned = B.weaponOrder.filter((w) => !p.weapons.includes(w));
    const r = U.weighted([['heal', 3], ['power', 3], ['xp', 2], ['weapon', unowned.length ? 2 : 0]], (o) => o[1])[0];
    const m = G.machine;
    if (r === 'heal') { FX.text(m.x, m.y - 34, 'BZZT. SNACKS!', '#63c74d', 1); G.healPlayer(p.maxHp * 0.35, p); }
    else if (r === 'power') { FX.text(m.x, m.y - 34, 'BZZT. SURPRISE!', '#b55088', 1); CH.Upgrades.givePower(G, U.pick(Object.keys(B.pickupsBuff)), p); }
    else if (r === 'xp') { FX.text(m.x, m.y - 34, 'BZZT. WISDOM!', '#3ccbe6', 1); CH.Upgrades.addXp(G, Math.round(B.xp.need(p.level) * 0.7), p); }
    else { const w = U.pick(unowned); p.addWeapon(w); FX.text(m.x, m.y - 34, 'BZZT. ' + B.weapons[w].name.toUpperCase() + '!', '#fee761', 1); G.ui.refreshWeapons(); }
  }

  Shop.CATS = [
    { id: 'food', name: 'FOOD' },
    { id: 'power', name: 'POWER-UPS' },
    { id: 'weapons', name: 'WEAPONS' },
    { id: 'services', name: 'SERVICES' },
    { id: 'gamble', name: 'GAMBLE' },
    { id: 'sell', name: 'SELL' },
  ];
  /* other modules (gear in M10) add categories and item makers here */
  Shop.sellers = []; // gear (items.js) adds what it can buy from you
  Shop.makers = {
    food: () => FOOD.map((i) => Object.assign({}, i)),
    power: () => U.shuffle(powerItems()).slice(0, 4),
    weapons: (p) => B.weaponOrder.filter((w) => !p.weapons.includes(w)).slice(0, 6).map((w) => ({ id: 'wp_' + w, name: B.weapons[w].name, desc: 'Add the ' + B.weapons[w].name + ' to your arsenal.', price: 55, icon: { spr: B.weapons[w].icon || 'ic_weapon' }, use: (q) => { q.addWeapon(w); G.ui.refreshWeapons(); }, once: true })),
    services: () => SERVICES.map((i) => Object.assign({}, i)),
    gamble: () => GAMBLE.map((i) => Object.assign({}, i)),
  };

  /* stock is per machine: a fresh set per stage, kept while you hop in and out */
  function stockOf(p) {
    const m = G.machine;
    if (!m.stock) {
      m.stock = { rolls: 0, cats: {}, sold: {} };
      for (const c of Object.keys(Shop.makers)) m.stock.cats[c] = Shop.makers[c](p);
    }
    return m.stock;
  }
  Shop.reroll = function () {
    const m = G.machine;
    const cost = Math.round(15 * priceMul() * (1 + m.stock.rolls));
    if (G.coins < cost) return fail('NEED ' + cost + ' COINS');
    G.coins -= cost;
    m.stock.rolls++;
    for (const c of ['power', 'weapons']) m.stock.cats[c] = Shop.makers[c](Shop.owner);
    m.stock.sold = {};
    Audio.sfx('buy');
    say(U.pick(['FRESH STOCK!', 'WE RESTOCKED. DO NOT ASK WHERE FROM.', 'SHUFFLED THE SHELVES.']));
    render();
  };

  const priceOf = (it) => Math.round(it.price * priceMul());
  const QUIPS = ['BZZT. WELCOME, VALUED CUSTOMER.', 'EXACT CHANGE IS FOR COWARDS.', 'ALL SALES FINAL. ALL SALES.', 'THE SNACKS ARE FRESH-ISH.', 'I ACCEPT COINS AND FEAR.', 'NOW 12% LESS HAUNTED.'];

  /* ------------------------------------------------------------------ open / close */
  Shop.openFor = function (p) {
    if (Shop.open || !G.machine) return;
    Shop.open = true;
    Shop.owner = p;
    Shop.cat = 'food';
    Shop.sel = 0;
    Shop.prevState = G.state;
    G.state = 'shop';
    stockOf(p);
    CH.Input.clear();
    Audio.sfx('vend');
    Audio.sfx('page');
    G.shake(2, 0.15);
    FX.burst(G.machine.x, G.machine.y, { n: 14, colors: 'confetti', speed: 100, life: 0.6 });
    const color = UIK && UIK.on ? UIK.colorFor(G.players.indexOf(p)) : 'brown';
    $('screen-vend').querySelector('.vend').className = 'vend panel c-' + color;
    say(U.pick(QUIPS));
    render();
    $('banner').classList.add('hidden');
    $('bossintro').classList.add('hidden');
    UI.show('vend');
  };
  Shop.close = function () {
    if (!Shop.open) return;
    Shop.open = false;
    Shop.owner = null;
    G.state = 'playing';
    UI.hideAll();
    CH.Input.clear();
    Audio.sfx('back');
    const W = CH.Waves;
    if (W && W.cardOwed > 0 && !W.shop) {
      W.cardOwed--;
      G.pendingLevels++;
      G.openLevelUp();
    }
  };

  /* the machine now opens a menu instead of rolling the dice */
  G.interact = function (who) {
    const m = G.machine;
    const p = who || G.player;
    if (!m || p.dead || G.state !== 'playing') return;
    if (U.dist(p.x, p.y, m.x, m.y) > 36) return;
    if (m.uses <= 0) {
      FX.text(m.x, m.y - 34, 'OUT OF ORDER', '#e43b44', 1);
      Audio.sfx('nope');
      return;
    }
    Shop.openFor(p);
  };

  /* ------------------------------------------------------------------ buying and selling */
  function fail(msg) {
    say(msg);
    Audio.sfx('nope');
  }
  function say(t) {
    const el = $('vend-quip');
    if (el) el.textContent = t;
  }
  Shop.items = () => {
    const p = Shop.owner;
    if (Shop.cat === 'sell') return sellItems();
    const m = G.machine;
    let list = (m.stock.cats[Shop.cat] || []).slice();
    if (Shop.cat === 'weapons') list = list.filter((it) => !p.weapons.includes(it.id.slice(3)));
    return list;
  };
  function sellItems() {
    const out = [];
    const loot = CH.Storage.loot;
    for (const k of Object.keys(loot)) {
      const n = loot[k];
      if (!n) continue;
      const it = CH.Loot.byId(+k);
      if (!it) continue;
      const v = CH.Loot.RARITY ? (CH.Loot.RARITY[it.rarity] || { value: 1 }).value : 1;
      out.push({ id: 'sell_' + k, name: it.name, desc: 'In stock: ' + n + '. Sells for ' + Math.max(1, v) * 2 + ' coins.', price: Math.max(1, v) * 2, icon: { loot: +k }, sell: true, lootId: +k, count: n });
    }
    for (const s of Shop.sellers) for (const q of s()) out.push(q);
    return out.concat(Shop.buyback.map((b, i) => Object.assign({}, b, { id: 'bb_' + i, name: 'Buy back: ' + b.name, desc: 'You sold this a moment ago.', price: b.price * 2, buyback: i, sell: false })));
  }

  Shop.buy = function (it) {
    const p = Shop.owner;
    if (!it) return false;
    if (it.gearSell) {
      const bag = CH.Items.bag();
      const i = bag.indexOf(it.gearSell);
      if (i < 0) return false;
      bag.splice(i, 1);
      G.coins += it.price;
      G.coinsEarned = (G.coinsEarned || 0) + it.price;
      Audio.sfx('coin');
      say('NICE STUFF. I WILL RESELL IT AT TRIPLE.');
      CH.Storage.save();
      render();
      return true;
    }
    if (it.sell) {
      const k = it.lootId;
      if (CH.Storage.sellLoot(k, 1) < 1) return false;
      G.coins += it.price;
      G.coinsEarned = (G.coinsEarned || 0) + it.price;
      Shop.buyback.unshift({ name: it.name, price: it.price, icon: it.icon, lootId: k });
      Shop.buyback.length = Math.min(Shop.buyback.length, 5);
      Audio.sfx('coin');
      say('PLEASURE DOING BUSINESS.');
      render();
      return true;
    }
    if (it.buyback !== undefined) {
      const b = Shop.buyback[it.buyback];
      if (!b || G.coins < it.price) return !!fail('NEED ' + it.price + ' COINS');
      G.coins -= it.price;
      CH.Storage.addLoot(b.lootId, 1);
      Shop.buyback.splice(it.buyback, 1);
      Audio.sfx('buy');
      render();
      return true;
    }
    const cost = priceOf(it);
    const sold = G.machine.stock.sold[it.id];
    if (sold && !it.repeat && !it.belt) return !!fail('SOLD OUT');
    if (G.coins < cost) return !!fail('NEED ' + cost + ' COINS');
    G.coins -= cost;
    if (!it.repeat && !it.belt) G.machine.stock.sold[it.id] = true;
    if (it.belt && CH.Items) {
      if (!CH.Items.addConsumable(p, it.belt, 1)) { G.coins += cost; delete G.machine.stock.sold[it.id]; return !!fail('BELT FULL'); }
    } else if (it.party) for (const q of P()) it.use(q);
    else it.use(p);
    Audio.sfx('buy');
    FX.text(p.x, p.y - 28, it.name.toUpperCase(), '#fee761', 1);
    say(U.pick(['BZZT. ENJOY.', 'CHARGED. NO REFUNDS.', 'THANK YOU, COME AGAIN.']));
    G.ui.refreshWeapons && G.ui.refreshWeapons();
    render();
    return true;
  };

  /* ------------------------------------------------------------------ the menu */
  const root = document.createElement('div');
  root.className = 'screen dim';
  root.id = 'screen-vend';
  root.innerHTML =
    '<div class="vend panel"><div class="vend-head"><h2>VENDING MACHINE</h2><div class="vend-coins"><img class="ico" id="vend-coin" alt=""><b id="vend-coins">0</b></div></div>' +
    '<div class="vend-quip" id="vend-quip"></div><div class="vend-tabs" id="vend-tabs"></div>' +
    '<div class="vend-main"><div class="vend-grid" id="vend-grid"></div><div class="vend-detail" id="vend-detail"></div></div>' +
    '<div class="row-btns"><button class="btn small" id="vend-reroll">REROLL STOCK</button><button class="btn primary" id="vend-leave">LEAVE</button></div></div>';
  $('screen-pause').parentNode.appendChild(root);
  UI.SCREENS.push('vend');
  $('vend-leave').addEventListener('click', () => Shop.close());
  $('vend-reroll').addEventListener('click', () => Shop.reroll());

  function iconUrl(ic, big) {
    if (!ic) return '';
    if (ic.pack) return UIK.on ? UIK.url('0 - Sprites/items/' + ic.pack + '.png') : '';
    if (ic.pu) return CH.Sprites.has('pu.' + ic.pu) ? CH.Sprites.icon('pu.' + ic.pu) : '';
    if (ic.gear) return CH.UIK.on ? CH.UIK.url(CH.Items.artPath(ic.gear.slot, ic.gear.rarity === 'normal' || ic.gear.rarity === 'magic' ? 'leather' : 'iron')) : '';
    if (ic.loot) return CH.Sprites.has('loot.' + ic.loot) ? CH.Sprites.icon('loot.' + ic.loot) : '';
    if (ic.spr) return CH.Sprites.has(ic.spr) ? CH.Sprites.icon(ic.spr) : '';
    return '';
  }

  function render() {
    if (!Shop.open) return;
    $('vend-coin').src = CH.Sprites.icon(CH.Sprites.has('pk.coin') ? 'pk.coin' : 'coin');
    $('vend-coins').textContent = Math.floor(G.coins);
    const tabs = $('vend-tabs');
    tabs.innerHTML = '';
    for (const c of Shop.CATS.concat(Shop.extraCats)) {
      const b = document.createElement('button');
      b.className = 'btn small' + (c.id === Shop.cat ? ' sel' : '');
      b.textContent = c.name;
      b.onclick = () => { Shop.cat = c.id; Shop.sel = 0; Audio.sfx('page'); render(); };
      tabs.appendChild(b);
    }
    const items = Shop.items();
    Shop.sel = U.clamp(Shop.sel, 0, Math.max(0, items.length - 1));
    const hadFocus = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('vend-cell');
    const grid = $('vend-grid');
    grid.innerHTML = '';
    if (!items.length) grid.innerHTML = '<div class="hint">' + (Shop.cat === 'sell' ? 'Nothing to sell. Collect trophies from the monsters.' : 'Sold out.') + '</div>';
    items.forEach((it, i) => {
      const b = document.createElement('button');
      const soldOut = !it.repeat && !it.sell && it.buyback === undefined && G.machine.stock.sold[it.id];
      b.className = 'vend-cell' + (i === Shop.sel ? ' sel' : '') + (soldOut ? ' sold' : '');
      b.innerHTML = `<img src="${iconUrl(it.icon)}" alt=""><span class="vp">${soldOut ? 'SOLD' : it.sell ? '+' + it.price : (it.buyback !== undefined ? it.price : priceOf(it))}</span>${it.count > 1 ? '<span class="vc">x' + it.count + '</span>' : ''}`;
      b.onclick = () => { Shop.sel = i; Audio.sfx('hover'); render(); };
      b.ondblclick = () => Shop.buy(it);
      grid.appendChild(b);
    });
    const it = items[Shop.sel];
    const d = $('vend-detail');
    if (!it) { d.innerHTML = ''; } else {
      const cost = it.sell ? it.price : it.buyback !== undefined ? it.price : priceOf(it);
      const soldOut = !it.repeat && !it.sell && it.buyback === undefined && G.machine.stock.sold[it.id];
      d.innerHTML = `<img class="vend-big" src="${iconUrl(it.icon, true)}" alt=""><div class="vend-name">${esc(it.name)}</div><div class="vend-desc">${esc(it.desc)}</div><div class="vend-price">${it.sell ? 'SELL FOR ' : 'PRICE '}<b>${cost}</b></div><button class="btn primary" id="vend-buy" ${soldOut || (!it.sell && G.coins < cost) ? 'disabled' : ''}>${it.sell ? 'SELL 1' : 'BUY'}</button>`;
      $('vend-buy').onclick = () => Shop.buy(it);
    }
    if (hadFocus) { const c = grid.querySelector('.vend-cell.sel'); if (c) c.focus({ preventScroll: true }); }
    $('vend-reroll').textContent = 'REROLL STOCK (' + Math.round(15 * priceMul() * (1 + G.machine.stock.rolls)) + ')';
    $('vend-reroll').style.display = Shop.cat === 'sell' ? 'none' : '';
  }

  /* keys: 1-6 categories, arrows move the cell, Enter / B buys, Esc leaves */
  const prevMenuKey = UI.onMenuKey;
  UI.onMenuKey = function (e) {
    if (Shop.open && UI.active === 'vend') {
      const items = Shop.items();
      if (e.code === 'ArrowRight' || e.code === 'ArrowDown') { Shop.sel = Math.min(items.length - 1, Shop.sel + (e.code === 'ArrowDown' ? 4 : 1)); render(); e.preventDefault(); return; }
      if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') { Shop.sel = Math.max(0, Shop.sel - (e.code === 'ArrowUp' ? 4 : 1)); render(); e.preventDefault(); return; }
      if (e.code === 'KeyQ' || e.code === 'KeyE') {
        const cats = Shop.CATS.concat(Shop.extraCats);
        const i = cats.findIndex((c) => c.id === Shop.cat);
        Shop.cat = cats[(i + (e.code === 'KeyE' ? 1 : cats.length - 1)) % cats.length].id;
        Shop.sel = 0;
        render();
        return;
      }
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE' && false) { Shop.buy(items[Shop.sel]); e.preventDefault(); return; }
      const m = /^Digit([1-9])$/.exec(e.code);
      if (m) { const c = Shop.CATS.concat(Shop.extraCats)[+m[1] - 1]; if (c) { Shop.cat = c.id; Shop.sel = 0; render(); } return; }
    }
    return prevMenuKey(e);
  };
  CH.Input.onMenuKey = UI.onMenuKey;
  const prevGlobal = UI.onGlobalKey;
  UI.onGlobalKey = function (a) {
    if (a === 'pause' && Shop.open) return Shop.close();
    return prevGlobal(a);
  };
  CH.Input.onGlobal = UI.onGlobalKey;
  const prevCancel = UI.cancel;
  UI.cancel = function () {
    if (Shop.open) return Shop.close();
    return prevCancel();
  };

  /* leaving a run must not leave the shop state behind */
  const origToMenu = G.toMenu;
  G.toMenu = function () {
    Shop.open = false;
    Shop.owner = null;
    Shop.buyback.length = 0;
    return origToMenu.apply(G, arguments);
  };
})(window.CH);
