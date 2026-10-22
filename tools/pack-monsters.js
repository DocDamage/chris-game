'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./png');

const ROOT = path.resolve(__dirname, '..');
const A = path.join(ROOT, 'assets');

function b64(pngBuf) {
  return 'data:image/png;base64,' + pngBuf.toString('base64');
}

function packMonsters() {
  const img = {};
  const meta = { enemies: {}, bosses: {} };

  console.log('Packaging New Regular Enemies...');
  // 1. Plant (Predator Plant)
  {
    const dir = path.join(A, 'enemies', 'predator-plants', 'Tiled_files');
    const anims = {
      idle: { file: 'Plant1_Idle_full.png', frames: 4 },
      walk: { file: 'Plant1_Walk_full.png', frames: 6 },
      attack: { file: 'Plant1_Attack_full.png', frames: 7 },
      hurt: { file: 'Plant1_Hurt_full.png', frames: 5 },
      death: { file: 'Plant1_Death_full.png', frames: 10 }
    };
    for (const [an, info] of Object.entries(anims)) {
      const fullPath = path.join(dir, info.file);
      if (fs.existsSync(fullPath)) {
        const sheet = P.decode(fs.readFileSync(fullPath));
        // Crop row 0 (y=0, h=64, w=info.frames * 64)
        const row0 = P.crop(sheet, 0, 0, info.frames * 64, 64);
        // Downscale 0.5x to 32px height
        const scaled = P.downscale(row0, 0.5);
        img['chr.plant.' + an] = b64(P.encode(scaled));
      }
    }
    meta.enemies.plant = { fw: 32, fh: 32 };
  }

  // 2. Slime (Acid Slime)
  {
    const dir = path.join(A, 'enemies', 'slime-mobs', 'Tiled_files');
    const anims = {
      idle: { file: 'Slime1_Idle_full.png', frames: 6 },
      walk: { file: 'Slime1_Walk_full.png', frames: 6 },
      attack: { file: 'Slime1_Attack_full.png', frames: 6 },
      hurt: { file: 'Slime1_Hurt_full.png', frames: 5 },
      death: { file: 'Slime1_Death_full.png', frames: 6 }
    };
    for (const [an, info] of Object.entries(anims)) {
      const fullPath = path.join(dir, info.file);
      if (fs.existsSync(fullPath)) {
        const sheet = P.decode(fs.readFileSync(fullPath));
        const row0 = P.crop(sheet, 0, 0, info.frames * 64, 64);
        const scaled = P.downscale(row0, 0.44); // ~28px
        img['chr.slime.' + an] = b64(P.encode(scaled));
      }
    }
    meta.enemies.slime = { fw: 28, fh: 28 };
  }

  // 3. Orc (Orc Marauder)
  {
    const dir = path.join(A, 'enemies', 'orcs', 'Tiled_files');
    const anims = {
      idle: { file: 'orc1_idle_full.png', frames: 4 },
      walk: { file: 'orc1_walk_full.png', frames: 6 },
      attack: { file: 'orc1_attack_full.png', frames: 6 },
      hurt: { file: 'orc1_hurt_full.png', frames: 5 },
      death: { file: 'orc1_death_full.png', frames: 8 }
    };
    for (const [an, info] of Object.entries(anims)) {
      const fullPath = path.join(dir, info.file);
      if (fs.existsSync(fullPath)) {
        const sheet = P.decode(fs.readFileSync(fullPath));
        const row0 = P.crop(sheet, 0, 0, info.frames * 64, 64);
        const scaled = P.downscale(row0, 0.5);
        img['chr.orc.' + an] = b64(P.encode(scaled));
      }
    }
    meta.enemies.orc = { fw: 32, fh: 32 };
  }

  // 4. Goblin (Goblin Skirmisher)
  {
    const dir = path.join(A, 'enemies', 'goblins', 'PNG', 'Goblin1');
    const anims = {
      idle: { dir: 'Idle', file: 'Idle0_full.png', frames: 4 },
      walk: { dir: 'Walk', file: 'Walk0_full.png', frames: 6 },
      attack: { dir: 'Attack', file: 'Attack0_full.png', frames: 7 },
      hurt: { dir: 'Hurt', file: 'Hurt0_full.png', frames: 4 },
      death: { dir: 'Death', file: 'Death0_full.png', frames: 8 }
    };
    for (const [an, info] of Object.entries(anims)) {
      const fullPath = path.join(dir, info.dir, info.file);
      if (fs.existsSync(fullPath)) {
        const sheet = P.decode(fs.readFileSync(fullPath));
        const row0 = P.crop(sheet, 0, 0, info.frames * 64, 64);
        const scaled = P.downscale(row0, 0.44); // ~28px
        img['chr.goblin.' + an] = b64(P.encode(scaled));
      }
    }
    meta.enemies.goblin = { fw: 28, fh: 28 };
  }

  // 5. Spider (Giant Forest Spider)
  {
    const dir = path.join(A, 'enemies', 'giant-spiders', 'TheForest_GiantSpider_v2');
    const anims = {
      walk: { file: 'BlackSpider_walk.png', fw: 32 },
      attack: { file: 'BlackSpider_attack.png', fw: 56 },
      hurt: { file: 'BlackSpider_hurt.png', fw: 56 },
      death: { file: 'BlackSpider_death.png', fw: 56 }
    };
    for (const [an, info] of Object.entries(anims)) {
      const fullPath = path.join(dir, info.file);
      if (fs.existsSync(fullPath)) {
        const sheet = P.decode(fs.readFileSync(fullPath));
        img['chr.spider.' + an] = b64(P.encode(sheet));
      }
    }
    // Idle uses frame 0 of walk
    const walkSheet = P.decode(fs.readFileSync(path.join(dir, 'BlackSpider_walk.png')));
    const idleFrame = P.crop(walkSheet, 0, 0, 32, 34);
    img['chr.spider.idle'] = b64(P.encode(idleFrame));
    meta.enemies.spider = { fw: 32, fh: 34 };
  }

  console.log('Packaging New Bosses...');
  // Boss 1: Dragon (Ignis the Pyroclast)
  {
    const dir = path.join(A, 'bosses', 'dragon-pack', 'Dragon_1');
    const anims = [
      'Idle', 'Walk', 'Attack_1', 'Attack_2', 'Flight', 'Rise', 'Landing', 'Special', 'Hurt', 'Dead'
    ];
    for (const a of anims) {
      const fullPath = path.join(dir, a + '.png');
      if (fs.existsSync(fullPath)) {
        const sheet = P.decode(fs.readFileSync(fullPath));
        const scaled = P.downscale(sheet, 0.5); // 256 -> 128px
        img['boss.dragon.' + a.toLowerCase()] = b64(P.encode(scaled));
      }
    }
    meta.bosses.dragon = { fw: 128, fh: 128 };
  }

  // Boss 2: Beholder (Xal'atath the Eye Tyrant)
  {
    const dir = path.join(A, 'bosses', 'beholder-monsters', 'Tiled_files');
    const anims = {
      idle: { file: 'Beholder1_Idle_full.png', frames: 6 },
      walk: { file: 'Beholder1_Walk_full.png', frames: 4 },
      attack: { file: 'Beholder1_Attack_full.png', frames: 6 },
      attack_fire: { file: 'Beholder1_Attack_fire.png', frames: 6 },
      hurt: { file: 'Beholder1_Hurt_full.png', frames: 3 },
      death: { file: 'Beholder1_Death_full.png', frames: 4 }
    };
    for (const [an, info] of Object.entries(anims)) {
      const fullPath = path.join(dir, info.file);
      if (fs.existsSync(fullPath)) {
        const sheet = P.decode(fs.readFileSync(fullPath));
        // Crop row 0 (y=0, h=64)
        const row0 = P.crop(sheet, 0, 0, info.frames * 128, 64);
        img['boss.beholder.' + an] = b64(P.encode(row0));
      }
    }
    meta.bosses.beholder = { fw: 128, fh: 64 };
  }

  // Boss 3: Mage (Valtrix the Archmage)
  {
    const dir = path.join(A, 'bosses', 'boss-monsters', '1 Mage');
    const anims = ['walk', 'run', 'attack1', 'attack2', 'attack3', 'attack4', 'hurt', 'death', 'sneer'];
    for (const a of anims) {
      const fullPath = path.join(dir, 'Mage_boss_' + a + '.png');
      if (fs.existsSync(fullPath)) {
        const sheet = P.decode(fs.readFileSync(fullPath));
        img['boss.mage.' + a] = b64(P.encode(sheet));
      }
    }
    // Projectiles
    if (fs.existsSync(path.join(dir, 'Attack1_IceBlock.png'))) {
      img['boss.mage.ice'] = b64(fs.readFileSync(path.join(dir, 'Attack1_IceBlock.png')));
    }
    if (fs.existsSync(path.join(dir, 'Attack2_3_FireBall.png'))) {
      img['boss.mage.fireball'] = b64(fs.readFileSync(path.join(dir, 'Attack2_3_FireBall.png')));
    }
    if (fs.existsSync(path.join(dir, 'Attack4_Ray.png'))) {
      img['boss.mage.ray'] = b64(fs.readFileSync(path.join(dir, 'Attack4_Ray.png')));
    }
    meta.bosses.mage = { fw: 64, fh: 64 };
  }

  // Boss 4: Demon (Malkor the Pit Lord)
  {
    const dir = path.join(A, 'bosses', 'boss-monsters', '2 Demon');
    const anims = ['walk', 'run', 'attack1', 'attack2', 'attack3', 'attack4', 'hurt', 'death', 'sneer'];
    for (const a of anims) {
      const fullPath = path.join(dir, 'Demon_Boss_' + a + '.png');
      if (fs.existsSync(fullPath)) {
        const sheet = P.decode(fs.readFileSync(fullPath));
        img['boss.demon.' + a] = b64(P.encode(sheet));
      }
    }
    meta.bosses.demon = { fw: 96, fh: 96 };
  }

  // Boss 5: Ooze (the Toxic Ooze)
  {
    const dir = path.join(A, 'bosses', 'boss-monsters', '3 Ooze');
    const anims = ['walk', 'run', 'attack1', 'attack2', 'attack3', 'attack4', 'hurt', 'death', 'sneer'];
    for (const a of anims) {
      const fullPath = path.join(dir, 'Ooze_boss_' + a + '.png');
      if (fs.existsSync(fullPath)) {
        const sheet = P.decode(fs.readFileSync(fullPath));
        img['boss.ooze.' + a] = b64(P.encode(sheet));
      }
    }
    const orb = path.join(dir, 'Attack3_orb_of_venom.png');
    if (fs.existsSync(orb)) img['boss.ooze.orb'] = b64(fs.readFileSync(orb));
    meta.bosses.ooze = { fw: 96, fh: 96 };
  }

  console.log('Packaging VFX Packs 2, 3, 4, 6...');
  const vfxDir = path.join(A, 'vfx');
  const packs = [
    { name: 'p2', dir: path.join(vfxDir, 'Pack2', 'Beat \'em Up Combat Effects – 2D Pixel Art VFX Pack 2', 'PNG') },
    { name: 'p3', dir: path.join(vfxDir, 'Pack3', 'Beat \'em Up Combat Effects – 2D Pixel Art VFX Pack 3', 'PNG') },
    { name: 'p4', dir: path.join(vfxDir, 'Pack4', 'Beat _em Up Combat Effects – 2D Pixel Art VFX Pack 4', 'PNG') },
    { name: 'p6', dir: path.join(vfxDir, 'Pack6', 'Beat \'em Up Combat Effects – 2D Pixel Art VFX Pack 6', 'PNG') },
  ];

  for (const pk of packs) {
    if (!fs.existsSync(pk.dir)) {
      console.warn('VFX dir missing:', pk.dir);
      continue;
    }
    for (let n = 1; n <= 40; n++) {
      for (let i = 1; i < 40; i++) {
        const f = path.join(pk.dir, 'Effect (' + n + ')' + i + '.png');
        if (!fs.existsSync(f)) break;
        const b = fs.readFileSync(f);
        img['vfx.' + pk.name + '.' + n + '.' + i] = b64(b);
      }
    }
  }

  console.log('Monsters and VFX packaged successfully!');
  return { img, meta };
}

module.exports = { packMonsters };

if (require.main === module) {
  const res = packMonsters();
  console.log('Total keys packed:', Object.keys(res.img).length);
  let totalSize = 0;
  for (const v of Object.values(res.img)) totalSize += v.length;
  console.log('Total base64 payload:', (totalSize / 1024 / 1024).toFixed(2), 'MB');
}

