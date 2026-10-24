/* CHAOS.exe - power-up pickups, drawn from the "power ups" icon pack (650 item icons).
   Every power-up kind has a pool of icons that fit it (swords for RAGE, boots for HASTE, shields for SHIELD, potions for
   FOCUS / REGEN, books for SCHOLAR ...); the pickup on the floor shows the icon of what it will do. Food and healing
   potions are the health pickups. Every icon the kinds do not use is a "curio": treasure that chests, props and the odd
   enemy leave behind, worth coins.
   Timed buffs live in Balance.pickupsBuff (so the HUD chips pick them up); instant kinds act on pickup. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const Audio = CH.Audio;

  const PU = (CH.PowerUps = {});

  /* timed buffs first (name, colour, seconds, icon pool, spawn weight, what it does), then the instant kinds */
  const KINDS = {
    rage: { name: 'RAGE', color: '#e43b44', time: 12, w: 3, text: '+50% damage', icons: [18, 21, 40, 47, 102, 167, 261, 356, 360, 397, 501, 503] },
    haste: { name: 'HASTE', color: '#feae34', time: 12, w: 3, text: '+25% speed, faster fire and reload', icons: [265, 274, 222, 620, 295] },
    shield: { name: 'SHIELD', color: '#3ccbe6', time: 12, hp: 60, w: 3, text: 'absorbs 60 damage', icons: [5, 99, 100, 260, 176, 178, 225, 226, 498, 179, 97, 98] },
    midas: { name: 'MIDAS', color: '#fee761', time: 15, w: 2, text: 'double coins, +50% XP', icons: [1, 28, 55, 61, 62, 74, 254, 267, 412, 418, 601, 602, 630, 650] },
    focus: { name: 'FOCUS', color: '#8a5ad0', time: 12, w: 2.5, text: '+35% fire rate and faster reloads', icons: [11, 78, 142, 263, 384, 394, 592, 593, 594] },
    regen: { name: 'REGEN', color: '#63c74d', time: 10, w: 2.5, text: 'heals 3.5% of max HP per second', icons: [9, 76, 141, 196, 256, 389, 560, 595] },
    scholar: { name: 'SCHOLAR', color: '#68c2d3', time: 15, w: 2, text: 'double XP', icons: [4, 41, 68, 69, 71, 137, 180, 198, 262, 298, 387, 249] },
    luck: { name: 'LUCK', color: '#b5e855', time: 15, w: 1.6, text: '+20% crit chance, triple loot drops', icons: [306, 264, 157, 152, 103, 104, 155, 299] },
    timewarp: { name: 'TIME WARP', color: '#7fb2f0', time: 7, w: 1.6, text: 'enemies move at less than half speed', icons: [115, 276, 435, 533, 534, 632] },
    magnet: { name: 'MAGNET', instant: true, color: '#e43b44', w: 2, text: 'pulls in every pickup', icons: [296, 297] },
    bomb: { name: 'BOOM', instant: true, color: '#f77622', w: 1.5, text: 'a huge explosion around you', icons: [266, 282, 284, 281] },
    chest: { name: 'TREASURE', instant: true, color: '#fee761', w: 1.2, text: 'coins, loot and curios', icons: [46, 170, 171, 259, 310, 512, 513, 629] },
  };
  PU.KINDS = KINDS;
  PU.timed = Object.keys(KINDS).filter((k) => !KINDS[k].instant);

  /* healing pickups: food and red potions */
  PU.HEAL_ICONS = [10, 29, 33, 34, 35, 83, 84, 85, 86, 87, 88, 133, 134, 135, 136, 143, 212, 213, 214, 216, 217, 218, 393, 413, 414, 419, 611, 612, 613, 616, 617];

  /* everything not claimed above is a curio */
  const used = new Set(PU.HEAL_ICONS);
  for (const k of Object.keys(KINDS)) for (const i of KINDS[k].icons) used.add(i);
  PU.CURIO_ICONS = [];
  for (let i = 1; i <= 650; i++) if (!used.has(i)) PU.CURIO_ICONS.push(i);

  /* register the timed buffs with the balance table (the HUD, the player and the pickup code all read it) */
  for (const k of PU.timed) {
    const d = KINDS[k];
    B.pickupsBuff[k] = Object.assign(B.pickupsBuff[k] || {}, { name: d.name, time: d.time, color: d.color, hp: d.hp, icon: 'pu.' + d.icons[0] });
  }

  PU.roll = function () {
    const kinds = Object.keys(KINDS);
    const kind = U.weighted(kinds, (k) => KINDS[k].w);
    return { kind, icon: U.pick(KINDS[kind].icons) };
  };

  /* a hero picks up a power-up pickup (pk.pu = kind) */
  PU.collect = function (g, pk, p) {
    const kind = pk.pu || PU.roll().kind;
    const d = KINDS[kind];
    if (!d.instant) {
      CH.Upgrades.givePower(g, kind, p);
      if (kind === 'timewarp') g.warpT = Math.max(g.warpT || 0, d.time);
      return;
    }
    Audio.sfx(kind === 'chest' ? 'chest' : kind === 'bomb' ? 'big_explosion' : 'pickup_power');
    FX.text(p.x, p.y - 22, d.name + '!', d.color, 2);
    FX.ring(p.x, p.y, 4, 30, d.color, 0.4);
    if (kind === 'magnet') {
      g.vacuum = 4;
    } else if (kind === 'bomb') {
      g.explode(p.x, p.y, 95, 70 * (1 + g.tier() * 0.12), { owner: 'p', hitEnemies: true, colors: 'fire', knock: 280, clearProj: true });
      CH.Kit.impact('fire', p.x, p.y, 60);
      g.shake(6, 0.4);
    } else if (kind === 'chest') {
      for (let i = 0; i < 6; i++) g.dropPickup('coin', p.x + U.rand(-26, 26), p.y + U.rand(-26, 26), 1);
      for (let i = 0; i < 4; i++) PU.dropCurio(g, p.x + U.rand(-30, 30), p.y + U.rand(-30, 30));
      for (let i = 0; i < 2; i++) CH.Loot.drop(g, CH.Loot.roll(null, { min: 'u', boss: null }), p.x + U.rand(-30, 30), p.y + U.rand(-30, 30));
    }
  };

  /* a piece of treasure: collecting it gives coins */
  PU.dropCurio = function (g, x, y) {
    const icon = U.pick(PU.CURIO_ICONS);
    return g.dropPickup('curio', x, y, 1 + (icon % 4), { icon: 'pu.' + icon, life: 25 });
  };
  PU.collectCurio = function (g, pk, p) {
    const n = pk.value || 1;
    g.addCoins(n);
    g.curios = (g.curios || 0) + 1;
    CH.Audio.sfx('pickup_coin');
    g.coinText(p, n);
    FX.burst(pk.x, pk.y, { n: 3, colors: ['#fee761', '#ffffff'], speed: 40, life: 0.3 });
  };
})(window.CH);
