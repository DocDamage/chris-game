/* CHAOS.exe - turns the loaded asset images into game sprites: heroes, the ten enemy archetypes,
   the three bosses, VFX, pickups and arena props. Runs once after Assets.load(). If assets are not
   available every sprite keeps its procedural fallback from sprites.js. */
(function (CH) {
  'use strict';
  const S = CH.Sprites;

  const Art = (CH.Art = { on: false, obj: {} });


  /* gameplay archetype -> character art. idle/walk default to 'Idle'/'Walk'. */
  const ENEMY_ART = {
    chicken: { chr: 'Orc', attack: 'Attack01' },
    potato: { chr: 'Ghostfire', attack: 'Attack01', idle: 'Flying', walk: 'Flying' },
    trashcan: { chr: 'Minotaur', attack: 'Attack01' },
    office: { chr: 'SkeletonArcher', attack: 'Attack' },
    toaster: { chr: 'Hellhound', attack: 'Attack01' },
    influencer: { chr: 'Priest', attack: 'Attack' },
    cart: { chr: 'Lancer', attack: 'Attack01', walk: 'Walk01' },
    pigeon: { chr: 'Hellbat', attack: 'Attack01', idle: 'Flying', walk: 'Flying' },
    fridge: { chr: 'FlameGolem', attack: 'Attack01' },
    intern: { chr: 'Slime', attack: 'Attack01' },
  };

  /* sprite-sheet rectangles of the props in "stone and bush.png" (found by connected-component scan) */
  const OBJ = {
    tree1: [225, 2, 79, 90], tree2: [325, 3, 72, 91], tree3: [421, 8, 67, 86],
    treeAutumn1: [224, 98, 79, 90], treeAutumn2: [324, 99, 72, 91], treeAutumn3: [420, 104, 68, 86],
    treeDark1: [224, 194, 79, 90], treeDark2: [324, 195, 72, 91], treeDark3: [420, 200, 67, 86],
    deadTree1: [531, 21, 50, 72], deadTree2: [530, 113, 44, 78], deadTree3: [529, 223, 44, 63],
    standingStone: [166, 5, 52, 73], bigRocks: [168, 80, 48, 96],
    rocks1: [0, 50, 78, 29], rocks2: [114, 50, 44, 28], rockStack: [85, 49, 23, 30],
    mossRocks1: [0, 82, 78, 29], mossRocks2: [114, 82, 44, 28], mossStack: [85, 81, 23, 30],
    bush1: [0, 113, 47, 31], bush2: [48, 113, 47, 31], bush3: [96, 113, 47, 31],
    bush4: [0, 145, 47, 31], bush5: [48, 145, 47, 31], bush6: [96, 145, 47, 31],
    pillars: [1, 180, 110, 39], mossPillars: [1, 228, 110, 39],
    pillar1: [4, 180, 12, 39], pillar2: [22, 180, 12, 39], pillar3: [40, 180, 12, 39], pillar4: [58, 180, 12, 39], pillar5: [76, 180, 12, 39],
    jarBlue: [130, 191, 12, 48], jarClay: [146, 191, 12, 48],
    statue: [192, 245, 32, 26], chest: [160, 254, 16, 18], chestOpen: [128, 255, 16, 17],
    flowerPurple1: [115, 275, 9, 28], flowerPurple2: [131, 275, 9, 28], flowerBlue1: [83, 276, 9, 26], flowerBlue2: [100, 276, 9, 26],
    grassTuft: [96, 309, 63, 24],
  };
  Art.OBJ = OBJ;

  /* the playable heroes: pre-scaled strips built by tools/hero-pack.js (see Assets.meta.heroes) */
  function registerHero(id) {
    const m = CH.Assets.meta.heroes && CH.Assets.meta.heroes[id];
    if (!m) return false;
    const fps = { idle: 10, walk: 13, run: 15, dash: 12, attack: 14, heavy: 14, skill: 12, hurt: 14, jump: 12, victory: 10 };
    const loops = { idle: 1, walk: 1, run: 1, jump: 1, victory: 1 };
    const strips = {};
    for (const an of Object.keys(m.anims)) strips[an] = { key: 'hero.' + id + '.' + an, fps: fps[an] || 12, loop: !!loops[an], fw: m.fw, fh: m.fh };
    if (m.rotations) {
      for (const d of m.rotations) {
        strips['rot_' + d] = { key: 'hero.' + id + '.rot_' + d, fps: 1, loop: true, fw: m.fw, fh: m.fh };
      }
    }
    return S.sheet('hero.' + id, { fw: m.fw, fh: m.fh, feet: 'idle', crop: false, ax: m.ax, strips });
  }

  function registerEnemy(type, a) {
    const X = 'chr.' + a.chr + '.';
    return S.sheet(type, {
      fw: 100, fh: 100, feet: 'idle',
      strips: {
        idle: { key: X + (a.idle || 'Idle'), fps: 7 },
        walk: { key: X + (a.walk || 'Walk'), fps: 11 },
        attack: { key: X + a.attack, fps: 14, loop: false },
        hurt: { key: X + 'Hurt', fps: 14, loop: false },
        death: { key: X + 'Death', fps: 8, loop: false },
      },
    });
  }

  function registerBosses() {
    const b = (p, k) => 'boss.' + p + '.' + k;
    S.sheet('boss_ceo', {
      fw: 128, fh: 128, feet: 'idle', anchor: 'feet',
      strips: {
        idle: { key: b('war', 'Idle'), fps: 8 }, walk: { key: b('war', 'Walk'), fps: 10 },
        slashweak: { key: b('war', 'SlashWeak'), loop: false }, doubleslash: { key: b('war', 'DoubleSlash'), loop: false },
        slashbomb: { key: b('war', 'SlashBomb'), loop: false }, slashdash: { key: b('war', 'SlashDash'), loop: false },
        slashstorm: { key: b('war', 'SlashStorm'), loop: false }, combo: { key: b('war', 'Combo'), loop: false },
        death: { key: b('war', 'Death'), fps: 6, loop: false },
      },
    });
    S.sheet('boss_chicken', {
      fw: 128, fh: 128, feet: 'idle', anchor: 'feet',
      strips: {
        idle: { key: b('win', 'Idle'), fps: 8 }, walk: { key: b('win', 'Flying'), fps: 10 }, impulse: { key: b('win', 'ImpulseFly'), loop: false },
        startdive: { key: b('win', 'StartDive'), loop: false }, dive: { key: b('win', 'Dive'), fps: 16 }, enddive: { key: b('win', 'EndDive'), loop: false },
        impact: { key: b('win', 'GroundImpact'), loop: false }, telein: { key: b('win', 'TeleIn'), loop: false }, teleout: { key: b('win', 'TeleOut'), loop: false },
        cast: { key: b('win', 'Projectile'), loop: false }, explosion: { key: b('win', 'Explosion'), loop: false },
        death: { key: b('win', 'Death'), fps: 8, loop: false },
      },
    });
    S.sheet('boss_bug', {
      fw: 128, fh: 128, feet: 'idle', anchor: 'feet',
      strips: {
        idle: { key: b('spi', 'Idle'), fps: 8 }, walk: { key: b('spi', 'Idle'), fps: 12 }, jump: { key: b('spi', 'Jump'), loop: false },
        bite: { key: b('spi', 'Bite'), loop: false }, cast: { key: b('spi', 'CastAttack'), loop: false }, web: { key: b('spi', 'Web'), loop: false },
        webball: { key: b('spi', 'WebBall'), loop: false }, slash: { key: b('spi', 'Slash'), loop: false },
        death: { key: b('spi', 'Death'), fps: 8, loop: false },
      },
    });
  }

  /* the four additional bosses: Wild Frog, Boulder Dash, Mecha-stone Golem, Skeleton Maw */
  function registerMoreBosses() {
    const key = (p, k) => 'boss.' + p + '.' + k;
    const st = (p, o) => {
      const out = {};
      for (const a of Object.keys(o)) {
        const v = o[a];
        out[a] = typeof v === 'string' ? { key: key(p, v) } : Object.assign({ key: key(p, v.k) }, v);
        if (out[a].loop === undefined) out[a].loop = false;
      }
      return out;
    };
    // Wild Frog (128px frames)
    S.sheet('boss_frog', {
      fw: 128, fh: 128, feet: 'idle', anchor: 'feet',
      strips: Object.assign(st('frg', { jump: 'Impulse', rising: 'Rising', falling: 'Falling', land: 'Land', lick: 'LickAttack', spit: 'Spit', death: 'Death' }), {
        idle: { key: key('frg', 'Idle'), fps: 8, loop: true },
        walk: { key: key('frg', 'Idle'), fps: 12, loop: true },
      }),
    });
    S.sheet('fx.frogTongue', { fw: 128, fh: 128, crop: true, feet: 'play', anchor: 'center', strips: { play: { key: key('frg', 'Lick'), fps: 14, loop: false } } });
    S.sheet('fx.frogSpikes', { fw: 128, fh: 128, crop: true, feet: 'play', anchor: 'center', strips: { play: { key: key('frg', 'Spikes'), fps: 14, loop: false } } });
    S.sheet('fx.frogBall', { fw: 128, fh: 128, crop: true, feet: 'play', anchor: 'center', strips: { play: { key: key('frg', 'Prefab'), fps: 12, loop: true } } });

    // Skeleton Maw (128px frames)
    S.sheet('boss_maw', {
      fw: 128, fh: 128, feet: 'idle', anchor: 'feet',
      strips: Object.assign(st('maw', { teleport: 'Teleport', summon: 'SummonAttack', staff: 'SummonStaff', hide: 'HideStaff', hand: 'HandAttack', blast: 'ExplosionAttack', bone: 'BoneAttack', death: 'Death' }), {
        idle: { key: key('maw', 'Idle'), fps: 8, loop: true },
        walk: { key: key('maw', 'Floating'), fps: 10, loop: true },
      }),
    });
    const sp = (name, k, fw, fh, fps, loop) => S.sheet(name, { fw, fh, crop: true, feet: 'play', anchor: 'center', strips: { play: { key: 'boss.maw.spell.' + k, fps: fps || 14, loop: !!loop } } });
    sp('fx.mawBone1', 'bone1', 32, 32);
    sp('fx.mawBone2', 'bone2', 32, 32);
    sp('fx.mawBall1', 'ball1', 32, 32);
    sp('fx.mawBall2', 'ball2', 32, 32);
    sp('fx.mawBlast', 'blast', 128, 128);
    sp('fx.mawHands', 'hands', 32, 32, 16);
    sp('fx.mawGround', 'groundHands', 32, 32, 12);
    sp('fx.mawZombies', 'zombies', 32, 96, 10);

    // Mecha-stone Golem (100px frames)
    S.sheet('boss_gol', {
      fw: 100, fh: 100, feet: 'idle', anchor: 'feet',
      strips: Object.assign(st('gol', { charge: 'Charge', arm: 'Arm', roll: 'Roll', punch: 'Punch', cast: 'Cast', slam: 'Slam', burrow: 'Burrow', death: 'Death' }), {
        idle: { key: key('gol', 'Idle'), fps: 6, loop: true },
        walk: { key: key('gol', 'Idle'), fps: 9, loop: true },
      }),
    });
    S.crop('fx.golArm', 'boss.gol.armProj', 0, 0, 100, 100);
    S.crop('fx.rock', 'boss.spi.rock', 0, 0, 64, 64);
    const lf = CH.Assets.meta.laserFrame || 300;
    S.sheet('fx.golLaser', { fw: lf, fh: lf, crop: false, feet: 'play', anchor: 'center', strips: { play: { key: 'boss.gol.laser', fps: 14, loop: true } } });

    // Boulder Dash (poses assembled by the build tool)
    const bd = CH.Assets.meta.bd;
    if (bd) {
      const strips = {};
      for (const a of Object.keys(bd.anims)) strips[a] = { key: 'boss.bd.' + a, fps: a === 'idle' ? 6 : 10, loop: a === 'idle', fw: bd.fw, fh: bd.fh };
      S.sheet('boss_bd', { fw: bd.fw, fh: bd.fh, feet: 'idle', anchor: 'feet', crop: true, strips });
      S.sheet('fx.bdHands', { fw: 32, fh: 30, crop: false, feet: 'play', anchor: 'feet', strips: { play: { key: 'boss.bd.hands', fps: 1, loop: false } } });
    }
  }

  function registerVfx() {
    const img = (window.CH_ASSETS && window.CH_ASSETS.img) || {};
    const groups = {};
    for (const k of Object.keys(img)) {
      const m = /^(vfx\.p\d+\.\d+)\.\d+$/.exec(k);
      if (m) groups[m[1]] = true;
    }
    for (const g of Object.keys(groups)) S.fromFrames(g, CH.Assets.frames(g), { fps: 18 });
  }

  function registerStrips() {
    // single-row effect strips (projectiles, magic) -> frame lists, keyed by asset id
    const strip = (name, key, fw, fps, loop) => {
      S.sheet(name, { fw, fh: fw === 32 ? 32 : 100, crop: true, feet: 'play', anchor: 'center', strips: { play: { key, fps: fps || 14, loop: loop !== false } } });
    };
    strip('fx.arrow1', 'proj.arrow1', 32);
    strip('fx.arrow2', 'proj.arrow2', 32);
    strip('fx.cannonball', 'proj.cannonball', 32);
    strip('fx.wizard1', 'proj.wizard1', 100, 16, false);
    strip('fx.wizard2', 'proj.wizard2', 100, 16, false);
    strip('fx.priest', 'proj.priest', 100, 14, false);
    strip('fx.lavaSpike', 'proj.lavaSpike', 100, 14, false);
  }

  function registerItems() {
    // 16px cells in Items.png
    const cell = (name, cx, cy) => S.crop(name, 'obj.items', cx * 16, cy * 16, 16, 16);
    cell('pk.gem', 0, 0);
    cell('pk.gem_big', 1, 0);
    cell('pk.coin', 2, 0);
    cell('pk.hp', 8, 1);
    cell('pk.power', 4, 1);
    cell('pk.token', 6, 1);
    cell('pk.apple', 4, 0);
    cell('pk.potionBlue', 9, 1);
    cell('pk.key', 9, 2);
    // fence pieces from fence.png and flowers/grass from FlowerAndGrass.png (rects in image pixels)
    S.crop('obj.fenceH', 'tile.fence', 5, 32, 38, 14, 'feet');
    S.crop('obj.fenceH2', 'tile.fence', 5, 48, 38, 14, 'feet');
    const fl = {
      tuftTall1: [0, 0, 16, 31], tuftTall2: [16, 0, 16, 32], tuftTall3: [32, 0, 16, 30], tuft1: [48, 17, 16, 16], tuft2: [64, 17, 16, 16],
      sun1: [0, 32, 16, 32], sun2: [16, 35, 16, 32], sun3: [32, 33, 16, 32], sun4: [48, 33, 16, 32],
      lavender1: [64, 32, 16, 32], lavender2: [80, 38, 16, 28], pink1: [96, 41, 16, 25],
      hydrangeaP1: [64, 64, 16, 16], hydrangeaP2: [80, 64, 16, 16], hydrangeaB1: [64, 80, 16, 16], hydrangeaB2: [80, 80, 16, 16],
      leaf1: [0, 64, 16, 32], leaf2: [16, 64, 16, 32], violet: [32, 69, 16, 25], orange: [48, 80, 16, 16],
    };
    for (const k of Object.keys(fl)) S.crop('obj.fl_' + k, 'tile.flowers', fl[k][0], fl[k][1], fl[k][2], fl[k][3], 'feet');
    for (const k of Object.keys(OBJ)) {
      const r = OBJ[k];
      S.crop('obj.' + k, 'obj.stone', r[0], r[1], r[2], r[3], 'feet');
    }
  }

  function registerNewProps() {
    const props = [
      'obj.car1', 'obj.car2', 'obj.car3', 'obj.carWreck',
      'obj.barricade1', 'obj.barricade2', 'obj.chain_fence1', 'obj.toxic_barrel', 'obj.rubble',
      'obj.roadblock', 'obj.street_lamp',
      'obj.sh_bed', 'obj.sh_chair', 'obj.sh_lamp', 'obj.sh_storage', 'obj.sh_workbench', 'obj.sh_radio', 'obj.sh_table', 'obj.sh_shelf',
      'obj.volcano_pillar1', 'obj.volcano_pillar2', 'obj.volcano_rock', 'obj.volcano_spikes',
      'obj.dungeon_crate', 'obj.dungeon_barrel', 'obj.dungeon_column', 'obj.occult_altar',
      'pk.wood', 'pk.scrap', 'pk.stone'
    ];
    for (const p of props) {
      if (CH.Assets.images[p]) S.fromImage(p, p, p.startsWith('pk.') ? 'center' : 'feet');
    }
  }

  function registerNewMonsters() {
    const m = (CH.Assets && CH.Assets.meta) || {};
    const img = (CH.Assets && CH.Assets.images) || {};

    // 1. New Regular Enemies
    const enMeta = m.enemies || {};
    const stdEnemy = (type, fw, fh) => {
      if (!img['chr.' + type + '.idle']) return;
      S.sheet(type, {
        fw, fh, feet: 'idle', anchor: 'feet',
        strips: {
          idle: { key: 'chr.' + type + '.idle', fps: 7, loop: true },
          walk: { key: 'chr.' + type + '.walk', fps: 10, loop: true },
          attack: { key: 'chr.' + type + '.attack', fps: 12, loop: false },
          hurt: { key: 'chr.' + type + '.hurt', fps: 12, loop: false },
          death: { key: 'chr.' + type + '.death', fps: 8, loop: false },
        }
      });
    };
    stdEnemy('plant', (enMeta.plant && enMeta.plant.fw) || 32, (enMeta.plant && enMeta.plant.fh) || 32);
    stdEnemy('slime', (enMeta.slime && enMeta.slime.fw) || 28, (enMeta.slime && enMeta.slime.fh) || 28);
    stdEnemy('orc', (enMeta.orc && enMeta.orc.fw) || 32, (enMeta.orc && enMeta.orc.fh) || 32);
    stdEnemy('goblin', (enMeta.goblin && enMeta.goblin.fw) || 28, (enMeta.goblin && enMeta.goblin.fh) || 28);
    if (img['chr.spider.walk']) {
      S.sheet('spider', {
        fw: 32, fh: 34, feet: 'idle', anchor: 'feet',
        strips: {
          idle: { key: 'chr.spider.idle', fps: 6, loop: true, fw: 32, fh: 34 },
          walk: { key: 'chr.spider.walk', fps: 12, loop: true, fw: 32, fh: 34 },
          attack: { key: 'chr.spider.attack', fps: 12, loop: false, fw: 56, fh: 34 },
          hurt: { key: 'chr.spider.hurt', fps: 12, loop: false, fw: 56, fh: 34 },
          death: { key: 'chr.spider.death', fps: 8, loop: false, fw: 56, fh: 34 },
        }
      });
    }

    // 2. New Bosses
    // Dragon
    if (img['boss.dragon.idle']) {
      S.sheet('boss_dragon', {
        fw: 128, fh: 128, feet: 'idle', anchor: 'feet',
        strips: {
          idle: { key: 'boss.dragon.idle', fps: 8, loop: true },
          walk: { key: 'boss.dragon.walk', fps: 10, loop: true },
          attack1: { key: 'boss.dragon.attack_1', fps: 10, loop: false },
          attack2: { key: 'boss.dragon.attack_2', fps: 12, loop: false },
          flight: { key: 'boss.dragon.flight', fps: 12, loop: true },
          rise: { key: 'boss.dragon.rise', fps: 10, loop: false },
          landing: { key: 'boss.dragon.landing', fps: 10, loop: false },
          special: { key: 'boss.dragon.special', fps: 12, loop: false },
          hurt: { key: 'boss.dragon.hurt', fps: 10, loop: false },
          death: { key: 'boss.dragon.dead', fps: 8, loop: false },
        }
      });
    }

    // Beholder
    if (img['boss.beholder.idle']) {
      S.sheet('boss_beholder', {
        fw: 128, fh: 64, feet: 'idle', anchor: 'center',
        strips: {
          idle: { key: 'boss.beholder.idle', fps: 8, loop: true },
          walk: { key: 'boss.beholder.walk', fps: 8, loop: true },
          attack: { key: 'boss.beholder.attack', fps: 10, loop: false },
          attack_fire: { key: 'boss.beholder.attack_fire', fps: 12, loop: false },
          hurt: { key: 'boss.beholder.hurt', fps: 10, loop: false },
          death: { key: 'boss.beholder.death', fps: 8, loop: false },
        }
      });
    }

    // Mage
    if (img['boss.mage.walk']) {
      S.sheet('boss_mage', {
        fw: 64, fh: 64, feet: 'idle', anchor: 'feet',
        strips: {
          idle: { key: 'boss.mage.walk', fps: 6, loop: true },
          walk: { key: 'boss.mage.walk', fps: 8, loop: true },
          run: { key: 'boss.mage.run', fps: 10, loop: true },
          attack1: { key: 'boss.mage.attack1', fps: 10, loop: false },
          attack2: { key: 'boss.mage.attack2', fps: 10, loop: false },
          attack3: { key: 'boss.mage.attack3', fps: 10, loop: false },
          attack4: { key: 'boss.mage.attack4', fps: 10, loop: false },
          hurt: { key: 'boss.mage.hurt', fps: 10, loop: false },
          death: { key: 'boss.mage.death', fps: 8, loop: false },
        }
      });
      if (img['boss.mage.ice']) S.fromImage('fx.mageIce', 'boss.mage.ice', 'center');
      if (img['boss.mage.fireball']) S.fromImage('fx.mageFire', 'boss.mage.fireball', 'center');
      if (img['boss.mage.ray']) S.fromImage('fx.mageRay', 'boss.mage.ray', 'center');
    }

    // Demon
    if (img['boss.demon.walk']) {
      S.sheet('boss_demon', {
        fw: 96, fh: 96, feet: 'idle', anchor: 'feet',
        strips: {
          idle: { key: 'boss.demon.walk', fps: 6, loop: true },
          walk: { key: 'boss.demon.walk', fps: 8, loop: true },
          run: { key: 'boss.demon.run', fps: 10, loop: true },
          attack1: { key: 'boss.demon.attack1', fps: 10, loop: false },
          attack2: { key: 'boss.demon.attack2', fps: 10, loop: false },
          attack3: { key: 'boss.demon.attack3', fps: 10, loop: false },
          attack4: { key: 'boss.demon.attack4', fps: 10, loop: false },
          hurt: { key: 'boss.demon.hurt', fps: 10, loop: false },
          death: { key: 'boss.demon.death', fps: 8, loop: false },
        }
      });
    }
  }

  /* the Toxic Ooze boss (same sheet layout as the Mage and the Demon) */
  function registerOoze() {
    const img = (window.CH_ASSETS && window.CH_ASSETS.img) || {};
    if (!img['boss.ooze.walk']) return;
    S.sheet('boss_ooze', {
      fw: 96, fh: 96, feet: 'idle', anchor: 'feet',
      strips: {
        idle: { key: 'boss.ooze.walk', fps: 6, loop: true },
        walk: { key: 'boss.ooze.walk', fps: 8, loop: true },
        run: { key: 'boss.ooze.run', fps: 10, loop: true },
        attack1: { key: 'boss.ooze.attack1', fps: 10, loop: false },
        attack2: { key: 'boss.ooze.attack2', fps: 10, loop: false },
        attack3: { key: 'boss.ooze.attack3', fps: 10, loop: false },
        attack4: { key: 'boss.ooze.attack4', fps: 10, loop: false },
        sneer: { key: 'boss.ooze.sneer', fps: 8, loop: false },
        hurt: { key: 'boss.ooze.hurt', fps: 10, loop: false },
        death: { key: 'boss.ooze.death', fps: 8, loop: false },
      },
    });
    if (img['boss.ooze.orb']) S.fromImage('fx.oozeOrb', 'boss.ooze.orb', 'center');
  }

  /* ---- the rest of the packs: new bosses, enemy variants, golems, loot and power-up icons ---- */
  function registerExtra() {
    const m = (CH.Assets && CH.Assets.meta) || {};
    const img = (CH.Assets && CH.Assets.images) || {};
    const bm = m.bosses || {};
    const en = m.enemies || {};
    // sheet from a table {anim: [key suffix, fps, loop]}; only anims that exist in the bundle are added
    const sheet = (name, prefix, fw, fh, defs, anchor) => {
      const strips = {};
      for (const an of Object.keys(defs)) {
        const d = defs[an];
        if (img[prefix + '.' + d[0]]) strips[an] = { key: prefix + '.' + d[0], fps: d[1], loop: !!d[2] };
      }
      if (!Object.keys(strips).length) return false;
      return S.sheet(name, { fw, fh, feet: 'idle', anchor: anchor || 'feet', strips });
    };
    const BMS = { idle: ['idle', 6, 1], walk: ['walk', 9, 1], run: ['run', 12, 1], attack: ['attack', 10, 0], jump: ['jump', 10, 0], spec1: ['spec1', 10, 0], spec2: ['spec2', 10, 0], hurt: ['hurt', 10, 0], death: ['death', 8, 0], path: ['path', 12, 1] };
    for (const k of ['treant', 'moss', 'knight', 'yeti']) {
      const c = bm[k];
      if (c) sheet('boss_' + k, 'boss.' + k, c.fw, c.fh, BMS);
    }
    if (bm.yeti) sheet('boss_yeti2', 'boss.yeti', bm.yeti.fw, bm.yeti.fh, { idle: ['g_idle', 6, 1], walk: ['g_walk', 9, 1], run: ['g_walk', 12, 1], attack: ['g_attack', 10, 0], jump: ['g_attack', 10, 0], hurt: ['g_hurt', 10, 0], death: ['g_death', 8, 0] });
    if (bm.daddy) sheet('boss_daddy', 'boss.daddy', bm.daddy.fw, bm.daddy.fh, { idle: ['walk', 5, 1], walk: ['walk', 9, 1], shoot: ['shoot', 10, 0], charged: ['charged', 10, 0], charged2: ['charged2', 10, 0], scream: ['scream', 10, 0], death: ['scream', 6, 0] });
    if (bm.skull) sheet('boss_skull', 'boss.skull', bm.skull.fw, bm.skull.fh, { idle: ['idle', 6, 1], walk: ['walk', 8, 1], chomp: ['chomp', 12, 0], slam: ['slam', 10, 0], cast: ['cast', 10, 0], hurt: ['hurt', 10, 0], death: ['death', 8, 0] }, 'center');
    if (img['boss.skull.handf']) S.fromImage('fx.skullHand', 'boss.skull.handf', 'center');
    const DRAGON = { idle: ['idle', 8, 1], walk: ['walk', 10, 1], attack1: ['attack_1', 10, 0], attack2: ['attack_2', 12, 0], flight: ['flight', 12, 1], rise: ['rise', 10, 0], landing: ['landing', 10, 0], special: ['special', 12, 0], hurt: ['hurt', 10, 0], death: ['dead', 8, 0] };
    sheet('boss_dunewyrm', 'boss.dunewyrm', 128, 128, DRAGON);
    sheet('boss_bloodwyrm', 'boss.bloodwyrm', 128, 128, DRAGON);
    const EYE = { idle: ['idle', 8, 1], walk: ['walk', 8, 1], attack: ['attack', 10, 0], attack_fire: ['attack_fire', 12, 0], hurt: ['hurt', 10, 0], death: ['death', 8, 0] };
    sheet('boss_sporeeye', 'boss.sporeeye', 128, 64, EYE, 'center');
    sheet('boss_voideye', 'boss.voideye', 128, 64, EYE, 'center');

    // enemy variants: sprite 'plant_v1', 'slime_v3' ...
    const ENEMY = (t) => ({ idle: [t + '.idle', 7, 1], walk: [t + '.walk', 10, 1], attack: [t + '.attack', 12, 0], hurt: [t + '.hurt', 12, 0], death: [t + '.death', 8, 0] });
    const cells = { plant: 32, slime: 28, orc: 32, goblin: 28 };
    for (const t of Object.keys(cells)) {
      const n = (en[t] && en[t].variants) || 0;
      for (let v = 1; v <= n; v++) sheet(t + '_v' + v, 'chr', cells[t], cells[t], ENEMY(t + '.v' + v));
    }
    const nsp = (en.spider && en.spider.variants) || 0;
    for (let v = 1; v <= nsp; v++) {
      const k = 'chr.spider.v' + v + '.';
      if (!img[k + 'walk']) continue;
      S.sheet('spider_v' + v, {
        fw: 32, fh: 34, feet: 'idle', anchor: 'feet',
        strips: {
          idle: { key: k + 'idle', fps: 6, loop: true, fw: 32, fh: 34 },
          walk: { key: k + 'walk', fps: 12, loop: true, fw: 32, fh: 34 },
          attack: { key: k + 'attack', fps: 12, loop: false, fw: 56, fh: 34 },
          hurt: { key: k + 'hurt', fps: 12, loop: false, fw: 56, fh: 34 },
          death: { key: k + 'death', fps: 8, loop: false, fw: 56, fh: 34 },
        },
      });
    }
    // golems (80px frames): the clay golem and two variants
    sheet('golem', 'chr', 80, 80, ENEMY('golem'));
    for (let v = 1; v <= 2; v++) sheet('golem_v' + v, 'chr', 80, 80, ENEMY('golem.v' + v));

    // loot and power-up icons
    for (let i = 1; i <= 367; i++) if (img['loot.' + i]) S.fromImage('loot.' + i, 'loot.' + i, 'center');
    for (let i = 1; i <= 650; i++) if (img['pu.' + i]) S.fromImage('pu.' + i, 'pu.' + i, 'center');
  }

  Art.register = function () {
    if (!CH.Assets.ready) return false;
    const A = CH.Assets.images;
    let ok = 0;
    for (const h of CH.Balance.heroes) if (registerHero(h.id)) ok++;
    // only when their own pack is missing: the extra heroes reuse a base hero's animation set in their own colours
    const VARIANTS = { Enchantress: ['Mercenary', 'hue-rotate(150deg) saturate(1.2)'], Stranger: ['Dreadbloom', 'hue-rotate(-60deg) saturate(1.4) brightness(1.1)'], Specter: ['Vexaria', 'hue-rotate(200deg) brightness(1.15)'] };
    for (const id of Object.keys(VARIANTS)) if (!S.has('hero.' + id)) S.variant('hero.' + id, 'hero.' + VARIANTS[id][0], VARIANTS[id][1]);
    for (const t of Object.keys(ENEMY_ART)) if (registerEnemy(t, ENEMY_ART[t])) ok++;
    registerBosses();
    registerMoreBosses();
    registerNewMonsters();
    registerOoze();
    registerExtra();
    registerVfx();
    registerStrips();
    registerItems();
    registerNewProps();
    Art.on = ok >= 10;
    return Art.on;
  };

  Art.enemyArt = ENEMY_ART;
  Art.heroes = CH.Balance.heroes.map((h) => h.id);
})(window.CH);
