/* CHAOS.exe - the one place every tunable number lives. */
window.CH = window.CH || {};
(function (CH) {
  'use strict';

  CH.Balance = {
    view: { w: 640, h: 360 }, // logical render buffer (matches the Mini Pocket UI pack's native size)
    ui: { w: 480, h: 270 }, // size of one DOM-menu pixel: --u = screen / 480, so menus keep their layout
    arena: { w: 2880, h: 1620, margin: 24 },
    maxDt: 0.1, // clamp after tab switches
    stepDt: 1 / 60, // max simulation substep

    player: {
      maxHp: 100,
      speed: 118,
      sprintMult: 1.38,
      accel: 2000,
      stamina: 100,
      staminaRegen: 26,
      staminaRegenDelay: 0.7,
      sprintCost: 30,
      dodgeCost: 20,
      dodgeCooldown: 1.0,
      dodgeDuration: 0.24,
      dodgeSpeed: 230,
      dodgeIframesExtra: 0.08,
      exhaustResume: 25,
      hitIframes: 0.7,
      radius: 5,
      critChance: 0.05,
      critMult: 2,
      specialCooldown: 25,
      specialRadius: 95,
      specialDamage: 90,
      nadeRecharge: 8,
      pickupRadius: 16,
      magnetPerLevel: 38,
      lowHpThreshold: 0.4,
    },

    difficulty: {
      casual: { name: 'Casual', count: 0.7, enemyDmg: 0.6, enemyHp: 0.85, heal: 1.5, eventInterval: 1.25, boss: 0.8, bossSpeed: 0.9, score: 0.75 },
      normal: { name: 'Normal', count: 1, enemyDmg: 1, enemyHp: 1, heal: 1, eventInterval: 1, boss: 1, bossSpeed: 1, score: 1 },
      chaotic: { name: 'Chaotic', count: 1.3, enemyDmg: 1.2, enemyHp: 1.12, heal: 0.9, eventInterval: 0.6, boss: 1.15, bossSpeed: 1.1, score: 1.5 },
    },

    waves: {
      campaign: 10,
      introTime: 3.2,
      clearTime: 3.4,
      baseCount: 8,
      perWave: 3.6,
      hpScale: 0.08, // per wave
      endlessHpScale: 0.1,
      dmgScale: 0.05,
      aliveCap: (w) => Math.min(95, 24 + w * 5),
      spawnInterval: (w) => Math.max(0.3, 1.15 - w * 0.07),
      bossWaves: { 5: 'ceo', 8: 'chicken', 10: 'bug' },
      eliteChance: (w) => (w < 4 ? 0 : Math.min(0.12, 0.03 + w * 0.008)),
      spawnSafeDist: 170,
      arenaForWave: (w) => (w <= 3 ? 'backyard' : w <= 6 ? 'office' : w <= 10 ? 'glitch' : ['backyard', 'office', 'glitch'][(w - 11) % 3]),
    },

    xp: { need: (lvl) => 12 + lvl * 8 + Math.floor(lvl * lvl * 0.35), orbMul: 1 },

    drops: {
      hpChance: 0.05,
      powerChance: 0.012,
      hpHeal: 18,
      coinLife: 22,
      xpLife: 40,
      hpLife: 18,
      powerLife: 16,
      eliteHpChance: 0.3,
      bossCoins: { ceo: 150, chicken: 220, bug: 500, frog: 80, bd: 140, gol: 200, maw: 260, dragon: 350, beholder: 280, mage: 220, demon: 300, ooze: 240, treant: 160, moss: 230, knight: 200, yeti: 270, daddy: 320, skull: 480, dunewyrm: 300, bloodwyrm: 340, sporeeye: 240, voideye: 280 },
    },

    score: {
      comboWindow: 2.2,
      comboStep: 0.04,
      comboMax: 2.0,
      lowHpMult: 1.25, // kills while under 30% hp
      eventMult: 1.25,
      coin: 5,
      wave: 100,
      boss: { ceo: 2500, chicken: 4000, bug: 10000, endless: 3000, frog: 1500, bd: 2500, gol: 3500, maw: 4500, dragon: 5000, beholder: 4200, mage: 3500, demon: 4600, ooze: 4000, treant: 3000, moss: 3800, knight: 3600, yeti: 4400, daddy: 5200, skull: 9000, dunewyrm: 4800, bloodwyrm: 5400, sporeeye: 3800, voideye: 4400 },
      perSecond: 2,
      eventSurvived: 150,
    },

    pickupsBuff: {
      rage: { name: 'RAGE', time: 12, color: '#e43b44' },
      haste: { name: 'HASTE', time: 12, color: '#feae34' },
      shield: { name: 'SHIELD', time: 12, color: '#3ccbe6', hp: 60 },
      midas: { name: 'MIDAS', time: 15, color: '#fee761' },
    },

    events: { minGap: 60, maxGap: 90, firstGapMin: 40, firstGapMax: 55 },

    shop: { cost: 25, perWave: 1 },

    weapons: {
      junk: { name: 'Junk Launcher', dmg: 12, cd: 0.22, speed: 300, range: 270, ammo: 0, reload: 0, r: 3, spread: 0.07 },
      chicken: { name: 'Rubber Chicken Cannon', dmg: 7, cd: 0.42, speed: 250, range: 300, ammo: 12, reload: 1.4, r: 4, bounces: 3, bounceRange: 130, knockChance: 0.22, knock: 150 },
      pizza: { name: 'Explosive Pizza', dmg: 30, cd: 0.85, speed: 230, range: 300, ammo: 6, reload: 1.7, r: 4, radius: 38, cheeseTime: 2.6, cheeseSlow: 0.45 },
      baguette: { name: 'Baguette of Doom', dmg: 42, cd: 0.55, ammo: 0, reload: 0, range: 40, arc: 2.0, swing: 0.22, knock: 230 },
      chair: { name: 'Office Chair Artillery', dmg: 55, cd: 1.1, speed: 160, range: 330, ammo: 4, reload: 2.0, r: 6, radius: 26, splash: 0.45, knock: 260 },
      problem: { name: 'Problem Generator', dmg: 14, cd: 0.4, speed: 210, range: 280, ammo: 0, reload: 0, r: 4 },
    },
    /* two-player co-op: more of everything to fight, and a way back from being downed */
    coop: { count: 2.1, enemyHp: 1.5, enemyDmg: 1.05, xpMul: 0.5, bossHp: 2.4, aliveCap: 1.7, reviveRadius: 24, reviveTime: 2.2, reviveHp: 0.5 },

    weaponOrder: ['junk', 'chicken', 'pizza', 'baguette', 'chair', 'problem'],
    weaponLevelDmg: 0.2, // per weapon level above 1
    weaponLevelCd: 0.08,
    weaponMaxLevel: 6,

    enemies: {
      chicken: { name: 'Angry Orc', hp: 18, speed: 58, dmg: 7, r: 6, xp: 2, coin: 0.25, score: 10, kbRes: 0 },
      potato: { name: 'Rogue Wisp', hp: 15, speed: 48, dmg: 7, r: 6, xp: 2, coin: 0.25, score: 12, kbRes: 0, chargeSpeed: 145, chargeTime: 0.55 },
      trashcan: { name: 'Minotaur Janitor', hp: 85, speed: 30, dmg: 10, r: 9, xp: 6, coin: 0.5, score: 40, kbRes: 0.6, slamDmg: 16, slamRadius: 34 },
      office: { name: 'Skeleton Accountant', hp: 24, speed: 38, dmg: 4, r: 6, xp: 3, coin: 0.4, score: 20, kbRes: 0.1, shotDmg: 7, shotSpeed: 90, shotCd: 2.2 },
      toaster: { name: 'Speedy Hellhound', hp: 22, speed: 82, dmg: 6, r: 6, xp: 3, coin: 0.35, score: 22, kbRes: 0, hazardDmg: 4 },
      influencer: { name: 'Influencer Priest', hp: 34, speed: 35, dmg: 4, r: 6, xp: 5, coin: 0.5, score: 35, kbRes: 0.1, flashDmg: 5, flashRange: 135 },
      cart: { name: 'Rampaging Lancer', hp: 52, speed: 36, dmg: 6, r: 8, xp: 5, coin: 0.4, score: 35, kbRes: 0.4, chargeSpeed: 155, chargeDmg: 15 },
      pigeon: { name: 'Suspicious Hellbat', hp: 12, speed: 72, dmg: 6, r: 5, xp: 2, coin: 0.3, score: 15, kbRes: 0, diveSpeed: 180, diveDmg: 9 },
      fridge: { name: 'Flame Golem', hp: 150, speed: 20, dmg: 12, r: 11, xp: 12, coin: 0.8, score: 80, kbRes: 0.85, shotDmg: 8, shotSpeed: 75 },
      intern: { name: 'Unpaid Intern Slime', hp: 9, speed: 48, dmg: 3, r: 5, xp: 1, coin: 0.45, score: 6, kbRes: 0 },
      plant: { name: 'Predator Plant', hp: 38, speed: 22, dmg: 7, r: 7, xp: 4, coin: 0.35, score: 25, kbRes: 0.8, spitDmg: 8, spitSpeed: 105, spitCd: 2.4 },
      slime: { name: 'Toxic Slime', hp: 16, speed: 42, dmg: 4, r: 6, xp: 2, coin: 0.3, score: 12, kbRes: 0, puddleDmg: 3 },
      orc: { name: 'Orc Berserker', hp: 58, speed: 38, dmg: 9, r: 8, xp: 5, coin: 0.5, score: 38, kbRes: 0.5, cleaveDmg: 13 },
      goblin: { name: 'Goblin Skirmisher', hp: 20, speed: 64, dmg: 5, r: 6, xp: 3, coin: 0.3, score: 18, kbRes: 0.1, spearDmg: 6, spearSpeed: 120 },
      spider: { name: 'Giant Forest Spider', hp: 28, speed: 70, dmg: 6, r: 7, xp: 4, coin: 0.4, score: 26, kbRes: 0.2, webDmg: 4, leapDmg: 10 },
      golem: { name: 'Clay Golem', hp: 110, speed: 26, dmg: 10, r: 10, xp: 8, coin: 0.6, score: 60, kbRes: 0.85, slamDmg: 15 },
    },

    eliteHp: 2.4,
    eliteDmg: 1.3,
    eliteScale: 1.25,

    bosses: {
      ceo: { name: 'THE CEO OF EVIL', hp: 1250, r: 17, speed: 38, score: 2500 },
      chicken: { name: 'THE GARGOYLE APOCALYPSE', hp: 1900, r: 22, speed: 42, score: 4000 },
      bug: { name: 'THE FINAL BUG', hp: 3600, r: 26, speed: 35, score: 10000 },
      frog: { name: 'THE FROG OF WAR', hp: 750, r: 17, speed: 40, score: 1500 },
      bd: { name: 'BOULDER DASH', hp: 1050, r: 21, speed: 36, score: 2500 },
      gol: { name: 'MECHA-STONE GOLEM', hp: 1500, r: 19, speed: 32, score: 3500 },
      maw: { name: 'THE SKELETON MAW', hp: 1650, r: 18, speed: 34, score: 4500 },
      dragon: { name: 'IGNIS THE PYROCLAST', hp: 2200, r: 24, speed: 38, score: 5000 },
      beholder: { name: 'XAL\'ATATH THE EYE TYRANT', hp: 1750, r: 20, speed: 34, score: 4200 },
      mage: { name: 'VALTRIX THE ARCHMAGE', hp: 1400, r: 16, speed: 42, score: 3500 },
      demon: { name: 'MALKOR THE PIT LORD', hp: 1950, r: 22, speed: 35, score: 4600 },
      ooze: { name: 'GLORP THE TOXIC OOZE', hp: 1800, r: 21, speed: 32, score: 4000 },
      treant: { name: 'ELDERROOT THE ANCIENT TREANT', hp: 1300, r: 20, speed: 26, score: 3000 },
      knight: { name: 'SIR SKULLHORN THE SHIELD-BREAKER', hp: 1450, r: 17, speed: 36, score: 3600 },
      moss: { name: 'GRAVELJAW THE MOSS GOLEM', hp: 1800, r: 24, speed: 24, score: 3800 },
      sporeeye: { name: 'MYCELIA THE SPORE EYE', hp: 1700, r: 18, speed: 30, score: 3800 },
      yeti: { name: 'FROSTMAW THE YETI KING', hp: 2100, r: 20, speed: 30, score: 4400 },
      dunewyrm: { name: 'AURELIS THE SANDWYRM', hp: 2200, r: 22, speed: 34, score: 4800 },
      bloodwyrm: { name: 'VORAX THE BLOODWING', hp: 2400, r: 22, speed: 34, score: 5400 },
      voideye: { name: "NYX'RA THE VOID EYE", hp: 2000, r: 18, speed: 32, score: 4400 },
      daddy: { name: 'DADDY, THE ABOMINATION', hp: 3200, r: 22, speed: 28, score: 5200 },
      skull: { name: 'THE SKULL KING', hp: 3800, r: 22, speed: 30, score: 9000 },
    },

    // The three playable heroes. Each has small stat tweaks and its own Q ability.
    // Heroes beyond the first are unlocked through lifetime stats (no purchases).
    heroes: [
      {
        id: 'Mercenary', name: 'Cyber Mercenary', hint: 'Always unlocked', test: () => true,
        mods: { hp: 0, speed: 0, dmg: 0, crit: 0 },
        special: 'overdrive', specialName: 'OVERDRIVE', cooldown: 22, icon: 'ic_speed',
        blurb: 'Balanced. Q: Overdrive - a shockwave, then 7s of haste and a shield.',
      },
      {
        id: 'Dreadbloom', name: 'Dreadbloom Knight', hint: 'Reach wave 4', test: (s) => s.highestWave >= 4,
        mods: { hp: 30, speed: -0.06, dmg: 0.12, crit: 0 },
        special: 'thornnova', specialName: 'THORN NOVA', cooldown: 26, icon: 'ic_boom',
        blurb: 'Tanky and heavy-hitting. Q: Thorn Nova - a huge blood-thorn explosion.',
      },
      {
        id: 'Vexaria', name: 'Vexaria, Blood Moon Knight', hint: 'Defeat a boss', test: (s) => s.bossesDefeated >= 1,
        mods: { hp: -10, speed: 0.08, dmg: 0, crit: 0.1 },
        special: 'bloodmoon', specialName: 'BLOOD MOON', cooldown: 28, icon: 'ic_heart',
        blurb: 'Fast and crit-happy. Q: Blood Moon - drains every nearby enemy and heals you.',
      },
    ],
  };
})(window.CH);
