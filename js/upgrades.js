/* CHAOS.exe - experience, level-ups and the upgrade pool.
   Player stats are always recomputed from scratch from (base + upgrade levels + passives), so an
   upgrade can never be applied twice by accident. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const Audio = CH.Audio;

  const pct = (v) => Math.round(v * 100) + '%';

  const UPGRADES = [
    { id: 'bonk', name: 'Bigger Bonk', icon: 'ic_bonk', max: 5, per: 0.15, text: (l) => `+${pct(0.15)} weapon damage`, total: (l) => `Total: +${pct(0.15 * l)} damage`, flavor: 'Hit harder. Think less.' },
    { id: 'speed', name: 'Speed Demon', icon: 'ic_speed', max: 4, text: () => '+8% movement speed', total: (l) => `Total: +${pct(0.08 * l)} speed`, flavor: 'Gotta go fast, legally distinct.' },
    { id: 'life', name: 'Extra Life Insurance', icon: 'ic_heart', max: 5, text: () => '+20 max health (and heal 20)', total: (l) => `Total: ${100 + 20 * l} max HP`, flavor: 'Read the fine print. Nobody has.' },
    { id: 'cardio', name: 'Cardio Is a Myth', icon: 'ic_stamina', max: 4, text: () => '+25% stamina regeneration', total: (l) => `Total: +${pct(0.25 * l)} regen`, flavor: 'Sitting is the new sprinting.' },
    { id: 'grease', name: 'Greased Floor', icon: 'ic_roll', max: 3, text: () => '+20% dodge roll distance', total: (l) => `Total: +${pct(0.2 * l)} distance`, flavor: 'Wheee. Oh no. Wheee.' },
    { id: 'ammo', name: 'Unstable Ammunition', icon: 'ic_shotspeed', max: 4, text: () => '+15% projectile speed', total: (l) => `Total: +${pct(0.15 * l)} speed`, flavor: 'Definitely not a fire hazard.' },
    { id: 'multi', name: 'More Problems', icon: 'ic_multi', max: 3, text: () => '+1 projectile per shot (wider swings for melee)', total: (l) => `Total: ${1 + l} projectiles`, flavor: 'Mo money, mo problems.' },
    { id: 'boom', name: 'Explosive Personality', icon: 'ic_boom', max: 4, text: () => '+15% explosion radius', total: (l) => `Total: +${pct(0.15 * l)} radius`, flavor: 'Never a dull moment at parties.' },
    { id: 'loot', name: 'Loot Goblin', icon: 'ic_coin', max: 4, text: () => '+25% coin drops', total: (l) => `Total: +${pct(0.25 * l)} coins`, flavor: 'Shiny. Mine. Shiny.' },
    { id: 'crit', name: 'Main Character Syndrome', icon: 'ic_crit', max: 5, text: () => '+7% critical hit chance', total: (l) => `Total: ${pct(B.player.critChance + 0.07 * l)} crit`, flavor: 'The plot revolves around you.' },
    { id: 'snack', name: 'Emergency Snacks', icon: 'ic_snack', max: 3, text: () => '+30% healing from all sources', total: (l) => `Total: +${pct(0.3 * l)} healing`, flavor: 'Calories do not count in chaos.' },
    { id: 'idiot', name: 'Professional Idiot', icon: 'ic_idiot', max: 3, text: () => '+25% damage while under 40% health', total: (l) => `Total: +${pct(0.25 * l)} at low HP`, flavor: 'Nothing to lose but your dignity.' },
    { id: 'skull', name: 'Thick Skull', icon: 'ic_skull', max: 4, text: () => '-8% damage taken', total: (l) => `Total: -${pct(0.08 * l)} damage taken`, flavor: 'Hollow, but sturdy.' },
    { id: 'refund', name: 'Refund Policy', icon: 'ic_refund', max: 3, text: () => 'Heal 8 HP when an elite enemy dies', total: (l) => `Total: ${8 * l} HP per elite`, flavor: 'All sales are final. Except yours.' },
    { id: 'reality', name: 'Reality Is Optional', icon: 'ic_reality', max: 3, text: () => 'Random beneficial effect more often', total: (l) => `Every ${Math.max(10, 28 - 6 * l)}s`, flavor: 'The universe owes you a favour.' },
    { id: 'magnet', name: 'Fridge Magnet Collection', icon: 'ic_magnet', max: 3, text: () => '+38 pickup magnet range', total: (l) => `Total: ${B.player.pickupRadius + B.player.magnetPerLevel * l} range`, flavor: 'Come to papa.' },
  ];

  const WEAPON_BLURB = {
    junk: 'Throws random junk, fast.',
    chicken: 'Bouncing rubber chickens. Squeaky.',
    pizza: 'Explodes on impact. Delicious.',
    baguette: 'Wide melee swing. Crunchy knockback.',
    chair: 'Heavy spinning artillery.',
    problem: 'Throws unpredictable problems.',
  };

  const Up = (CH.Upgrades = { list: UPGRADES, byId: {} });
  for (const u of UPGRADES) Up.byId[u.id] = u;
  Up.MAX_LEVELS = {};
  for (const u of UPGRADES) Up.MAX_LEVELS[u.id] = u.max;

  Up.newLevels = () => {
    const o = {};
    for (const u of UPGRADES) o[u.id] = 0;
    return o;
  };

  Up.recalc = function (p) {
    const L = p.upgrades;
    const P = p.passives;
    const s = p.stats;
    const hm = (p.hero && p.hero.mods) || { hp: 0, speed: 0, dmg: 0, crit: 0 };
    const sh = (CH.Storage && CH.Storage.shelter) || {};
    const shWb = sh.workbench || 0;
    const shBed = sh.bed || 0;
    const shSt = sh.storage || 0;
    const lb = (CH.Loot && CH.Loot.bonus()) || {}; // Trophy Codex milestones
    s.dmgMult = (1 + 0.15 * L.bonk + P.dmg + hm.dmg) * (1 + 0.05 * shWb) * (1 + (lb.dmg || 0));
    s.speedMult = 1 + 0.08 * L.speed + P.speed + hm.speed + (lb.speed || 0);
    s.maxHp = B.player.maxHp + 20 * L.life + P.hp + hm.hp + 15 * shBed + (lb.hp || 0);
    s.staminaRegen = B.player.staminaRegen * (1 + 0.25 * L.cardio) * (1 + 0.1 * shBed);
    s.dodgeDist = 1 + 0.2 * L.grease;
    s.projSpeed = 1 + 0.15 * L.ammo;
    s.extraProj = L.multi;
    s.explMult = 1 + 0.15 * L.boom;
    s.coinMult = (1 + 0.25 * L.loot) * (1 + 0.15 * shSt) * (1 + (lb.coinMult || 0));
    s.resMult = 1 + 0.25 * shSt;
    s.reloadMult = 1 + 0.1 * shWb; // workbench: faster reloads
    s.critChance = B.player.critChance + 0.07 * L.crit + hm.crit + (P.crit || 0) + (p.buffs && p.buffs.luck > 0 ? 0.2 : 0);
    s.healMult = 1 + 0.3 * L.snack;
    s.lowHpBonus = 0.25 * L.idiot;
    s.dmgReduction = (1 - 0.08 * L.skull) * (1 - (P.armor || 0));
    s.refundHeal = 8 * L.refund;
    s.realityEvery = L.reality > 0 ? Math.max(10, 28 - 6 * L.reality) : 0;
    s.magnet = B.player.pickupRadius + B.player.magnetPerLevel * L.magnet;
    const old = p.maxHp;
    p.maxHp = s.maxHp;
    if (old && p.maxHp > old) p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - old));
    p.hp = Math.min(p.hp, p.maxHp);
  };

  /* XP is shared by the whole party: everybody levels together and every level-up gives each player a pick.
     who = the player that collected the gem (their XP bonus applies) */
  Up.addXp = function (g, amount, who) {
    const c = who || g.player;
    if (c.buffs.midas > 0) amount *= 1.5;
    if (c.buffs.scholar > 0) amount *= 2;
    if (CH.Loot) amount *= 1 + (CH.Loot.bonus().xp || 0);
    if (g.coop) amount *= B.coop.xpMul; // twice the enemies, so each gem is worth less: the party levels at about the solo pace
    for (const p of g.players) p.xp += amount;
    const lead = g.players[0];
    let need = B.xp.need(lead.level);
    while (lead.xp >= need) {
      for (const p of g.players) {
        p.xp -= need;
        p.level++;
      }
      g.pendingLevels++;
      need = B.xp.need(lead.level);
    }
  };

  /* ---------- level-up card generation ---------- */
  Up.makeCards = function (g, who) {
    const p = who || g.player;
    const pool = [];
    for (const u of UPGRADES) {
      const lv = p.upgrades[u.id];
      if (lv >= u.max) continue;
      pool.push({ kind: 'upgrade', id: u.id, name: u.name, icon: u.icon, lv, max: u.max, text: u.text(lv + 1), total: u.total(lv + 1), flavor: u.flavor });
    }
    const unowned = B.weaponOrder.filter((w) => !p.weapons.includes(w));
    const weaponCards = unowned.map((w) => ({ kind: 'weapon', id: w, name: 'NEW: ' + B.weapons[w].name, icon: CH.Weapons.iconSprite(w), lv: 0, max: 0, text: WEAPON_BLURB[w], total: 'Becomes your main weapon, the old one moves to slot II', flavor: 'Free upgrade, no strings attached.' }));
    const wl = p.ws[p.weapon].level;
    const wup = wl < B.weaponMaxLevel ? { kind: 'weaponup', id: p.weapon, name: 'Practice Makes Passable', icon: CH.Weapons.iconSprite(p.weapon), lv: wl - 1, max: B.weaponMaxLevel - 1, text: `${B.weapons[p.weapon].name}: +${pct(B.weaponLevelDmg)} damage, faster attacks`, total: `Weapon level ${wl} -> ${wl + 1}`, flavor: 'Rehearsal is cheating, really.' } : null;

    const picks = [];
    U.shuffle(pool);
    // every third level offers a new weapon when one is available
    if (weaponCards.length && (p.level % 3 === 0 || Math.random() < 0.2)) picks.push(U.pick(weaponCards));
    if (wup && Math.random() < 0.3 && picks.length < 3) picks.push(wup);
    while (picks.length < 3 && pool.length) picks.push(pool.pop());
    // fallbacks guarantee we never show an empty choice (and never soft-lock)
    const fallbacks = [
      { kind: 'heal', id: 'heal', name: 'Free Snack', icon: 'ic_snack', lv: 0, max: 0, text: 'Restore 40% of your health', total: 'Delicious', flavor: 'You earned it. Probably.' },
      { kind: 'coins', id: 'coins', name: 'Found Money', icon: 'ic_coin', lv: 0, max: 0, text: 'Gain 60 coins', total: 'Spend at vending machines', flavor: 'Behind the couch cushion.' },
      { kind: 'weaponup', id: p.weapon, name: 'Practice Makes Passable', icon: CH.Weapons.iconSprite(p.weapon), lv: 0, max: 0, text: 'Sharpen your current weapon', total: '', flavor: '' },
    ];
    let fi = 0;
    while (picks.length < 3 && fi < 2) picks.push(fallbacks[fi++]);
    if (wup && picks.length < 3) picks.push(wup);
    return U.shuffle(picks).slice(0, 3);
  };

  Up.applyCard = function (g, card, who) {
    const p = who || g.player;
    switch (card.kind) {
      case 'upgrade':
        if (p.upgrades[card.id] < Up.MAX_LEVELS[card.id]) p.upgrades[card.id]++;
        Up.recalc(p);
        break;
      case 'weapon':
        Audio.sfx('item_get');
        p.addWeapon(card.id);
        break;
      case 'weaponup': {
        Audio.sfx('enchant');
        const ws = p.ws[card.id];
        if (ws && ws.level < B.weaponMaxLevel) ws.level++;
        break;
      }
      case 'heal':
        g.healPlayer(p.maxHp * 0.4, p);
        break;
      case 'coins':
        g.addCoins(60, p.x, p.y);
        break;
    }
    FX.text(p.x, p.y - 22, card.name.replace('NEW: ', ''), '#fee761', 1);
  };

  /* ---------- temporary power-ups ---------- */
  Up.givePower = function (g, kind, who) {
    const p = who || g.player;
    const b = B.pickupsBuff[kind];
    if (!b) return;
    p.buffs[kind] = b.time;
    if (kind === 'shield') p.shield = b.hp;
    Audio.sfx('pickup_power');
    FX.text(p.x, p.y - 22, b.name + '!', b.color, 2);
    FX.ring(p.x, p.y, 4, 30, b.color, 0.4);
    Up.recalc(p);
  };

  /* ---------- Reality Is Optional ---------- */
  Up.realityEffect = function (g, who) {
    const p = who || g.player;
    const options = [
      ['FREE HEALTH', () => g.healPlayer(p.maxHp * 0.2, p)],
      ['COIN SHOWER', () => { for (let i = 0; i < 8; i++) g.dropPickup('coin', p.x + U.rand(-40, 40), p.y + U.rand(-40, 40), 1); }],
      ['SUDDEN HASTE', () => (p.buffs.haste = 6)],
      ['SUDDEN RAGE', () => (p.buffs.rage = 6)],
      ['SURPRISE SHIELD', () => { p.buffs.shield = 8; p.shield = 40; }],
      ['XP RAIN', () => { for (let i = 0; i < 6; i++) g.dropPickup('xp', p.x + U.rand(-50, 50), p.y + U.rand(-50, 50), 2); }],
      ['REALITY SHOCKWAVE', () => g.explode(p.x, p.y, 70, 40, { owner: 'p', colors: 'glitch', knock: 200, clearProj: true })],
    ];
    const o = U.pick(options);
    o[1]();
    Audio.sfx('pickup_power');
    FX.text(p.x, p.y - 28, 'REALITY: ' + o[0], '#b55088', 1);
  };

  /* ---------- boss rewards ---------- */
  Up.bossReward = function (g, boss, who) {
    const p = who || g.player;
    const lines = [];
    const kind = boss.kind;
    const weaponUp = () => {
      const owned = p.weapons.filter((w) => p.ws[w].level < B.weaponMaxLevel);
      if (!owned.length) return null;
      const w = U.pick(owned);
      p.ws[w].level++;
      return B.weapons[w].name + ' upgraded to Lv ' + p.ws[w].level;
    };
    const passive = (name, o, text) => {
      for (const k of Object.keys(o)) p.passives[k] = (p.passives[k] || 0) + o[k];
      Up.recalc(p);
      p.hp = p.maxHp;
      return name + ': ' + text;
    };
    const REWARDS = {
      frog: () => [weaponUp()],
      ceo: () => [weaponUp()],
      gol: () => [weaponUp(), passive('STONE CORE', { dmg: 0.1 }, '+10% damage')],
      bd: () => [passive('BOULDER SKIN', { armor: 0.12, hp: 20 }, '-12% damage taken, +20 max HP')],
      chicken: () => [passive('GARGOYLE HEART', { dmg: 0.25, hp: 25, speed: 0.05 }, '+25% damage, +25 max HP, +5% speed')],
      maw: () => [passive('BONE CROWN', { dmg: 0.15, crit: 0.08 }, '+15% damage, +8% crit chance')],
      bug: () => [weaponUp()],
      dragon: () => [weaponUp(), passive('DRAGON SCALES', { armor: 0.1, dmg: 0.12 }, '-10% damage taken, +12% damage')],
      beholder: () => [passive('EYE OF THE TYRANT', { crit: 0.1, dmg: 0.1 }, '+10% crit chance, +10% damage')],
      mage: () => [weaponUp(), passive('ARCANE FOCUS', { speed: 0.06, dmg: 0.1 }, '+6% speed, +10% damage')],
      ooze: () => [weaponUp(), passive('OOZE CORE', { armor: 0.08, hp: 25 }, '-8% damage taken, +25 max HP')],
      treant: () => [weaponUp(), passive('HEARTWOOD', { hp: 40, armor: 0.05 }, '+40 max HP, -5% damage taken')],
      moss: () => [passive('MOSSY HIDE', { armor: 0.12, hp: 20 }, '-12% damage taken, +20 max HP')],
      knight: () => [weaponUp(), passive('SKULLHORN SHIELD', { dmg: 0.12, armor: 0.06 }, '+12% damage, -6% damage taken')],
      yeti: () => [passive('FROSTBITE FUR', { speed: 0.05, hp: 25, dmg: 0.08 }, '+5% speed, +25 max HP, +8% damage')],
      daddy: () => [weaponUp(), passive('DADDY ISSUES', { dmg: 0.2, hp: 20 }, '+20% damage, +20 max HP')],
      skull: () => [weaponUp(), passive('SKULL CROWN', { dmg: 0.15, crit: 0.08, hp: 25 }, '+15% damage, +8% crit chance, +25 max HP')],
      dunewyrm: () => [passive('DUNE SCALES', { speed: 0.08, dmg: 0.1 }, '+8% speed, +10% damage')],
      bloodwyrm: () => [weaponUp(), passive('BLOODWING TALON', { dmg: 0.18, crit: 0.05 }, '+18% damage, +5% crit chance')],
      sporeeye: () => [passive('SPORE LENS', { hp: 30, crit: 0.06 }, '+30 max HP, +6% crit chance')],
      voideye: () => [passive('VOID GAZE', { crit: 0.12, dmg: 0.08 }, '+12% crit chance, +8% damage')],
      demon: () => [passive('PIT LORD BRAND', { hp: 30, dmg: 0.15 }, '+30 max HP, +15% damage')],
    };
    for (const l of (REWARDS[kind] || REWARDS.ceo)()) if (l) lines.push(l);
    lines.push('+' + B.drops.bossCoins[kind] + ' bonus coins');
    if (boss.tier > 0) {
      const r = Math.random() < 0.5 ? weaponUp() : passive('BONUS PERK', { dmg: 0.1, hp: 15 }, '+10% damage, +15 max HP');
      if (r) lines.push(r);
    }
    return lines;
  };
})(window.CH);
