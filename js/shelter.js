/* CHAOS.exe - Survivor Shelter & Safehouse Base Meta-Progression.
   Players spend gathered Wood, Scrap, and Stone to upgrade functional base stations
   and decorate their persistent safehouse. */
(function (CH) {
  'use strict';
  const U = CH.U;
  const S = CH.Sprites;
  const Storage = CH.Storage;
  const Audio = CH.Audio;

  const Shelter = (CH.Shelter = {});

  const STATIONS = [
    {
      id: 'workbench',
      name: 'Crafting Workbench',
      sprite: 'obj.sh_workbench',
      x: 140,
      y: 110,
      desc: '+5% Weapon Damage & +10% Reload Speed per level',
      costs: [
        { wood: 10, scrap: 8 },
        { wood: 25, scrap: 20 },
        { wood: 45, scrap: 40 },
        { wood: 80, scrap: 70 },
      ],
    },
    {
      id: 'bed',
      name: 'Survivor Cot / Bunk',
      sprite: 'obj.sh_bed',
      x: 60,
      y: 110,
      desc: '+15 Starting Max HP & +10% Stamina Recovery per level',
      costs: [
        { wood: 8, scrap: 6 },
        { wood: 20, scrap: 15 },
        { wood: 40, scrap: 30 },
        { wood: 70, scrap: 60 },
      ],
    },
    {
      id: 'storage',
      name: 'Supply Storage Crate',
      sprite: 'obj.sh_storage',
      x: 230,
      y: 110,
      desc: '+25% Resource Yield from Props & +15 Starting Coins per level',
      costs: [
        { wood: 12, stone: 8 },
        { wood: 28, stone: 20 },
        { wood: 50, stone: 40 },
        { wood: 90, stone: 70 },
      ],
    },
    {
      id: 'radio',
      name: 'Radio Transceiver',
      sprite: 'obj.sh_radio',
      x: 310,
      y: 110,
      desc: 'Starts runs with +1 Gadget Charge & calls in Supply Airdrops',
      costs: [
        { scrap: 10, stone: 8 },
        { scrap: 25, stone: 20 },
        { scrap: 50, stone: 40 },
        { scrap: 85, stone: 70 },
      ],
    },
    {
      id: 'barricades',
      name: 'Field Fortifications',
      sprite: 'obj.barricade1',
      x: 390,
      y: 110,
      desc: '+30 Barricade HP & deploy fortifications in combat via [F] key',
      costs: [
        { wood: 10, scrap: 10 },
        { wood: 22, scrap: 22 },
        { wood: 45, scrap: 45 },
        { wood: 75, scrap: 75 },
      ],
    },
  ];

  Shelter.STATIONS = STATIONS;

  /* cosmetic furniture for the safehouse room */
  const DECOR = [
    { id: 'lamp', name: 'Hanging Lamp', sprite: 'obj.sh_lamp', x: 100, y: 84, cost: { scrap: 10, stone: 4 } },
    { id: 'shelf', name: 'Wall Shelf', sprite: 'obj.sh_shelf', x: 190, y: 60, cost: { wood: 15, stone: 10 } },
    { id: 'table', name: 'Card Table', sprite: 'obj.sh_table', x: 270, y: 86, cost: { wood: 20, scrap: 8 } },
    { id: 'chair', name: 'Armchair', sprite: 'obj.sh_chair', x: 340, y: 92, cost: { wood: 12 } },
  ];
  Shelter.DECOR = DECOR;

  Shelter.init = function () {
    const listEl = document.getElementById('shelter-stations');
    if (!listEl) return;
    Shelter.render();
  };

  Shelter.render = function () {
    const resources = Storage.resources || { wood: 0, scrap: 0, stone: 0 };
    const shelter = Storage.shelter || {};

    const elW = document.getElementById('sh-wood');
    const elSc = document.getElementById('sh-scrap');
    const elSt = document.getElementById('sh-stone');
    if (elW) elW.textContent = resources.wood || 0;
    if (elSc) elSc.textContent = resources.scrap || 0;
    if (elSt) elSt.textContent = resources.stone || 0;

    const listEl = document.getElementById('shelter-stations');
    if (!listEl) return;
    listEl.innerHTML = '';

    for (const st of STATIONS) {
      const lvl = shelter[st.id] || 0;
      const maxLvl = st.costs.length;
      const isMax = lvl >= maxLvl;
      const nextCost = !isMax ? st.costs[lvl] : null;

      let costStr = '';
      let canAfford = true;
      if (nextCost) {
        const parts = [];
        for (const rk of Object.keys(nextCost)) {
          const req = nextCost[rk];
          const have = resources[rk] || 0;
          if (have < req) canAfford = false;
          const icon = rk === 'wood' ? '🪵' : rk === 'scrap' ? '⚙️' : '🪨';
          parts.push(`${icon} ${req}`);
        }
        costStr = parts.join('  ');
      }

      const card = document.createElement('div');
      card.className = 'station-card' + (isMax ? ' maxed' : '');
      card.innerHTML = `
        <div class="st-header">
          <div class="st-name">${st.name}</div>
          <div class="st-level">LVL ${lvl} / ${maxLvl}</div>
        </div>
        <div class="st-desc">${st.desc}</div>
        <div class="st-footer">
          <div class="st-cost">${isMax ? '<span class="max-badge">MAXED</span>' : costStr}</div>
          ${!isMax ? `<button class="btn primary btn-up-station" data-station="${st.id}" ${canAfford ? '' : 'disabled'}>UPGRADE</button>` : ''}
        </div>
      `;

      const btn = card.querySelector('.btn-up-station');
      if (btn) {
        btn.onclick = () => {
          if (!canAfford) {
            Audio.sfx('nope');
            return;
          }
          if (Storage.spendResources(nextCost)) {
            shelter[st.id] = (shelter[st.id] || 0) + 1;
            Storage.save();
            Audio.sfx('item_get');
            CH.FX.burst(CH.Balance.view.w / 2, CH.Balance.view.h / 2, { n: 16, colors: ['#fee761', '#3ccbe6', '#63c74d'], speed: 60, life: 0.5 });
            Shelter.render();
            Shelter.drawRoom();
          }
        };
      }
      listEl.appendChild(card);
    }

    // decorations
    const decorEl = document.getElementById('shelter-decor');
    if (decorEl) {
      decorEl.innerHTML = '';
      const owned = shelter.decor || (shelter.decor = {});
      for (const d of DECOR) {
        const have = !!owned[d.id];
        let afford = true;
        const parts = [];
        for (const rk of Object.keys(d.cost)) {
          if ((resources[rk] || 0) < d.cost[rk]) afford = false;
          parts.push((rk === 'wood' ? '🪵 ' : rk === 'scrap' ? '⚙️ ' : '🪨 ') + d.cost[rk]);
        }
        const card = document.createElement('div');
        card.className = 'decor-item' + (have ? ' owned' : '');
        card.innerHTML = '<div class="d-name">' + d.name + '</div><div class="d-cost">' + (have ? '<span class="max-badge">PLACED</span>' : parts.join('  ')) + '</div>';
        if (!have) {
          const b = document.createElement('button');
          b.className = 'btn small btn-buy-decor';
          b.textContent = 'BUY';
          b.dataset.decor = d.id;
          if (!afford) b.disabled = true;
          b.onclick = () => {
            if (Storage.spendResources(d.cost)) {
              owned[d.id] = true;
              Storage.save();
              Audio.sfx('item_get');
              Shelter.render();
            } else Audio.sfx('nope');
          };
          card.appendChild(b);
        }
        decorEl.appendChild(card);
      }
    }

    Shelter.drawRoom();
  };

  Shelter.drawRoom = function () {
    const cv = document.getElementById('shelter-canvas');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const w = cv.width;
    const h = cv.height;

    // Cozy interior room background
    ctx.fillStyle = '#1b1424';
    ctx.fillRect(0, 0, w, h);

    // Wooden / concrete floor boards
    ctx.fillStyle = '#2d2238';
    ctx.fillRect(0, 40, w, h - 40);
    ctx.strokeStyle = '#231a2c';
    ctx.lineWidth = 1;
    for (let y = 40; y < h; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Brick back wall
    ctx.fillStyle = '#16111e';
    ctx.fillRect(0, 0, w, 40);
    ctx.strokeStyle = '#110c17';
    for (let x = 0; x < w; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 40);
      ctx.stroke();
    }

    // Warm safehouse lantern glow
    const grad = ctx.createRadialGradient(w / 2, 70, 10, w / 2, 70, 180);
    grad.addColorStop(0, 'rgba(255, 200, 120, 0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Draw active safehouse furniture and stations
    const shelter = Storage.shelter || {};
    for (const st of STATIONS) {
      const lvl = shelter[st.id] || 0;
      if (lvl > 0 && S.has(st.sprite)) {
        S.draw(ctx, st.sprite, st.x, st.y, { sx: 1, sy: 1 });
        // Station level indicator
        CH.Font.draw(ctx, 'L' + lvl, st.x, st.y - 20, '#63c74d', 1, true);
      } else if (S.has(st.sprite)) {
        // Unbuilt outline
        ctx.globalAlpha = 0.35;
        S.draw(ctx, st.sprite, st.x, st.y, { sx: 1, sy: 1 });
        ctx.globalAlpha = 1;
        CH.Font.draw(ctx, 'L0', st.x, st.y - 20, '#888888', 1, true);
      }
    }

    // decorations the player has bought
    const owned = (Storage.shelter && Storage.shelter.decor) || {};
    for (const d of DECOR) {
      if (owned[d.id] && S.has(d.sprite)) S.draw(ctx, d.sprite, d.x, d.y, { sx: 1, sy: 1 });
    }

    // Draw Hero standing in shelter
    const heroId = Storage.settings.hero || 'Mercenary';
    const heroName = 'hero.' + heroId;
    if (S.has(heroName)) {
      CH.Enemies.shadow(ctx, w / 2, 98, 16);
      S.draw(ctx, heroName, w / 2, 98, { frame: S.frame(heroName, 'idle', performance.now() / 1000) });
    }
  };
})(window.CH);

