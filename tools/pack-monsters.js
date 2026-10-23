'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./png');

const ROOT = path.resolve(__dirname, '..');
const A = path.join(ROOT, 'assets');

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const { vfxDir } = require('./vfxdirs');

function b64(pngBuf) {
  return 'data:image/png;base64,' + pngBuf.toString('base64');
}

/* The CraftPix top-down packs (plants, slimes, orcs, goblins, golems) are 4-direction sheets: one row per facing,
   0 = down, 1 = up, 2 = left, 3 = right. The game's side view is the right-facing row (flipped for left); the down
   and up rows are packed as '<anim>_d' / '<anim>_u' for vertical movement. Baked shadows are removed. */
const ROW = { side: 3, d: 0, u: 1 };
function dirStrips(file, cell, scale) {
  const sheet = P.unshadow(P.decode(fs.readFileSync(file)));
  const frames = Math.max(1, Math.floor(sheet.w / cell));
  const rows = Math.max(1, Math.floor(sheet.h / cell));
  const out = {};
  for (const [k, r] of Object.entries(ROW)) {
    const row = rows > r ? r : 0;
    out[k] = P.downscale(P.crop(sheet, 0, row * cell, frames * cell, cell), scale);
  }
  return out;
}
function putDirs(img, key, file, cell, scale) {
  const s = dirStrips(file, cell, scale);
  img[key] = b64(P.encode(s.side));
  img[key + '_d'] = b64(P.encode(s.d));
  img[key + '_u'] = b64(P.encode(s.u));
}

function packMonsters() {
  const img = {};
  const meta = { enemies: {}, bosses: {} };

  console.log('Packaging New Regular Enemies...');
  // cell scales are whole pixels per frame (46 / 64, 40 / 64): about 1.4x the old size, enemies were too small next to the heroes
  const TOPDOWN = {
    plant: { dir: ['predator-plants', 'Tiled_files'], file: (a) => 'Plant1_' + cap(a) + '_full.png', scale: 46 / 64, fw: 46 },
    slime: { dir: ['slime-mobs', 'Tiled_files'], file: (a) => 'Slime1_' + cap(a) + '_full.png', scale: 40 / 64, fw: 40 },
    orc: { dir: ['orcs', 'Tiled_files'], file: (a) => 'orc1_' + a + '_full.png', scale: 46 / 64, fw: 46 },
    goblin: { dir: ['goblins', 'PNG', 'Goblin1'], file: (a) => cap(a) + '/' + cap(a) + '0_full.png', scale: 40 / 64, fw: 40 },
  };
  for (const [type, t] of Object.entries(TOPDOWN)) {
    for (const an of ['idle', 'walk', 'attack', 'hurt', 'death']) {
      const f = path.join(A, 'enemies', ...t.dir, t.file(an));
      if (fs.existsSync(f)) putDirs(img, 'chr.' + type + '.' + an, f, 64, t.scale);
      else console.warn('  ! missing', f);
    }
    meta.enemies[type] = { fw: t.fw, fh: t.fw, dirs: true };
  }

  // 5. Spider (Giant Forest Spider): every strip has 56px frames; the sleep strip is the idle of a sleeping pack
  {
    const dir = path.join(A, 'enemies', 'giant-spiders', 'TheForest_GiantSpider_v2');
    for (const an of ['walk', 'attack', 'hurt', 'death', 'sleep']) {
      const fullPath = path.join(dir, 'BlackSpider_' + an + '.png');
      if (fs.existsSync(fullPath)) img['chr.spider.' + an] = b64(fs.readFileSync(fullPath));
    }
    const walkSheet = P.decode(fs.readFileSync(path.join(dir, 'BlackSpider_walk.png')));
    img['chr.spider.idle'] = b64(P.encode(P.crop(walkSheet, 0, 0, 56, 34)));
    meta.enemies.spider = { fw: 56, fh: 34 };
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
  const packs = [2, 3, 4, 6].map((n) => ({ name: 'p' + n, dir: vfxDir(A, n) || path.join(A, 'vfx', 'Pack ' + n, 'PNG') }));

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

module.exports = { packMonsters, dirStrips };

if (require.main === module) {
  const res = packMonsters();
  console.log('Total keys packed:', Object.keys(res.img).length);
  let totalSize = 0;
  for (const v of Object.values(res.img)) totalSize += v.length;
  console.log('Total base64 payload:', (totalSize / 1024 / 1024).toFixed(2), 'MB');
}

