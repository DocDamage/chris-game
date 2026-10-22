/* CHAOS.exe - the Trophy Codex screen: every mob drop in the game, what has been found, what is in stock, and what
   can be sold for scrap. Completing parts of the codex unlocks permanent bonuses (see Loot.MILESTONES). */
(function (CH) {
  'use strict';
  const Loot = CH.Loot;
  const Storage = CH.Storage;
  const Audio = CH.Audio;
  const $ = (id) => document.getElementById(id);

  const Codex = (CH.Codex = { filter: 'all', sel: 1 });

  const FILTERS = [
    ['all', 'ALL'],
    ['stock', 'IN STOCK'],
    ['c', 'COMMON'],
    ['u', 'UNCOMMON'],
    ['r', 'RARE'],
    ['e', 'EPIC'],
  ];
  const EFFECT_TEXT = { heal: 'restores health', xp: 'grants XP', wood: 'adds wood', scrap: 'adds scrap', stone: 'adds stone', coin: 'adds coins' };

  const iconSrc = (id) => {
    const im = CH.Assets && CH.Assets.images && CH.Assets.images['loot.' + id];
    return im ? im.src : null;
  };
  const found = (id) => !!Storage.data.seen[id];
  const stock = (id) => Storage.loot[id] || 0;
  /* scrap an item sells for */
  const price = (it) => it.value;

  Codex.open = function () {
    Codex.render();
  };

  Codex.render = function () {
    const total = Loot.count;
    const got = Loot.discovered();
    const pct = Math.floor((got / total) * 100);
    $('codex-count').textContent = got + ' / ' + total + '  (' + pct + '%)';
    $('codex-bar').style.width = (got / total) * 100 + '%';

    // milestones
    const ms = $('codex-milestones');
    ms.innerHTML = '';
    for (const m of Loot.MILESTONES) {
      const on = got / total >= m.at - 1e-9;
      const d = document.createElement('div');
      d.className = 'ms' + (on ? ' on' : '');
      d.innerHTML = '<b>' + Math.round(m.at * 100) + '%</b> ' + m.name + ': ' + m.text;
      ms.appendChild(d);
    }

    // filters
    const fl = $('codex-filters');
    fl.innerHTML = '';
    for (const [id, label] of FILTERS) {
      const b = document.createElement('button');
      b.className = 'btn small' + (Codex.filter === id ? ' primary' : '');
      b.textContent = label;
      b.onclick = () => {
        Codex.filter = id;
        Audio.sfx('click');
        Codex.render();
      };
      fl.appendChild(b);
    }

    // grid
    const grid = $('codex-grid');
    grid.innerHTML = '';
    for (const it of Loot.items) {
      if (Codex.filter === 'stock' && !stock(it.id)) continue;
      if (['c', 'u', 'r', 'e'].includes(Codex.filter) && it.rarity !== Codex.filter) continue;
      const have = found(it.id);
      const b = document.createElement('button');
      b.className = 'codex-item r-' + it.rarity + (have ? '' : ' unknown') + (Codex.sel === it.id ? ' sel' : '');
      b.dataset.id = it.id;
      b.title = have ? it.name : '???';
      const src = iconSrc(it.id);
      b.innerHTML = (src ? '<img alt="" src="' + src + '">' : '<span class="fallback">' + it.name[0] + '</span>') + (stock(it.id) > 1 ? '<i>' + stock(it.id) + '</i>' : '');
      b.onfocus = () => {
        if (Codex.sel === it.id) return;
        Codex.sel = it.id;
        Codex.detail();
        for (const o of grid.children) o.classList.toggle('sel', +o.dataset.id === it.id);
      };
      b.onclick = () => {
        Codex.sel = it.id;
        Audio.sfx('click');
        Codex.detail();
        for (const o of grid.children) o.classList.toggle('sel', +o.dataset.id === it.id);
      };
      grid.appendChild(b);
    }
    Codex.detail();
  };

  Codex.detail = function () {
    const it = Loot.byId(Codex.sel);
    const box = $('codex-detail');
    if (!it) {
      box.textContent = '';
      return;
    }
    const have = found(it.id);
    const n = stock(it.id);
    const R = Loot.RARITY[it.rarity];
    const themes = it.themes.split('').map((t) => Loot.THEMES[t]).join(', ');
    box.innerHTML = have
      ? '<b style="color:' + R.color + '">' + it.name + '</b> <small>' + R.name + ' &middot; ' + themes + '</small><br>' + 'When picked up it ' + EFFECT_TEXT[it.effect] + '. In stock: <b>' + n + '</b>. Sells for <b>' + price(it) + '</b> scrap.'
      : '<b>???</b> <small>' + R.name + ' &middot; ' + themes + '</small><br>Not found yet. ' + (it.rarity === 'c' ? 'Common drop.' : 'Drops from ' + (it.themes.length > 1 ? 'several' : 'matching') + ' enemies and bosses.');
    $('codex-sell1').disabled = n < 1;
    $('codex-sellall').disabled = n < 2;
    $('codex-sell1').textContent = 'SELL 1 (+' + price(it) + ')';
    $('codex-sellall').textContent = 'SELL ALL BUT 1 (+' + price(it) * Math.max(0, n - 1) + ')';
    let dupes = 0;
    for (const x of Loot.items) dupes += Math.max(0, stock(x.id) - 1) * price(x);
    $('codex-selldupes').textContent = 'SELL ALL DUPLICATES (+' + dupes + ' SCRAP)';
    $('codex-selldupes').disabled = dupes < 1;
  };

  const sold = (scrap) => {
    if (scrap > 0) {
      Storage.addResource('scrap', scrap);
      Audio.sfx('buy');
      CH.UI.toast('+' + scrap + ' SCRAP');
    } else Audio.sfx('nope');
    Codex.render();
  };

  Codex.sell1 = function () {
    const it = Loot.byId(Codex.sel);
    if (!it) return;
    sold(Storage.sellLoot(it.id, 1) * price(it));
  };
  Codex.sellAllBut1 = function () {
    const it = Loot.byId(Codex.sel);
    if (!it) return;
    sold(Storage.sellLoot(it.id, Math.max(0, stock(it.id) - 1)) * price(it));
  };
  Codex.sellDupes = function () {
    let scrap = 0;
    for (const it of Loot.items) scrap += Storage.sellLoot(it.id, Math.max(0, stock(it.id) - 1)) * price(it);
    sold(scrap);
  };
})(window.CH);
