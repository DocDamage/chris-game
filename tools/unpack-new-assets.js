'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..', 'assets');

const tasks = [
  // Bosses
  { file: path.join(root, 'bosses', 'boss-monsters-pixel-art.zip'), out: path.join(root, 'bosses', 'boss-monsters') },
  { file: path.join(root, 'bosses', 'beholder-monsters-top-down-pixel-art-sprites.zip'), out: path.join(root, 'bosses', 'beholder-monsters') },
  { file: path.join(root, 'bosses', 'dragon-pixel-art-character-sprite-sheets-pack.zip'), out: path.join(root, 'bosses', 'dragon-pack') },
  { file: path.join(root, 'bosses', 'golem-pixel-art-top-down-sprite-pack.zip'), out: path.join(root, 'bosses', 'golem-pack') },
  { file: path.join(root, 'bosses', 'End Bosses', 'Daddy.zip'), out: path.join(root, 'bosses', 'End Bosses', 'Daddy') },
  { file: path.join(root, 'bosses', 'End Bosses', 'Skull.zip'), out: path.join(root, 'bosses', 'End Bosses', 'Skull') },
  { file: path.join(root, 'bosses', 'boss-monster-game-sprites.zip'), out: path.join(root, 'bosses', 'boss-monster-game-sprites') },

  // Enemies
  { file: path.join(root, 'enemies', 'free-predator-plant-mobs-pixel-art-pack.zip'), out: path.join(root, 'enemies', 'predator-plants') },
  { file: path.join(root, 'enemies', 'free-slime-mobs-pixel-art-top-down-sprite-pack.zip'), out: path.join(root, 'enemies', 'slime-mobs') },
  { file: path.join(root, 'enemies', 'Free-Top-Down-Orc-Game-Character-Pixel-Art.zip'), out: path.join(root, 'enemies', 'orcs') },
  { file: path.join(root, 'enemies', 'goblin-pixel-art-character-sprite-pack.zip'), out: path.join(root, 'enemies', 'goblins') },
  { file: path.join(root, 'enemies', 'pixel-art-slime-enemies-top-down-sprite-pack.zip'), out: path.join(root, 'enemies', 'slime-enemies') },
  { file: path.join(root, 'enemies', 'TheForest_GiantSpider_v2.zip'), out: path.join(root, 'enemies', 'giant-spiders') },

  // Loot and power-up icons
  { file: path.join(root, 'mob drops', 'mob drops complete.zip'), out: path.join(root, 'mob drops', 'png') },
  { file: path.join(root, 'power ups', 'powerups complete.zip'), out: path.join(root, 'power ups', 'png') },
];

for (const t of tasks) {
  if (!fs.existsSync(t.file)) continue;
  if (!fs.existsSync(t.out)) fs.mkdirSync(t.out, { recursive: true });
  // Skip if already extracted
  if (fs.readdirSync(t.out).length > 0) continue;
  console.log(`Extracting ${path.basename(t.file)} -> ${path.basename(t.out)}...`);
  try {
    execSync(`7z x "${t.file}" -o"${t.out}" -y`, { stdio: 'inherit' });
  } catch (e) {
    console.error(`Error extracting ${t.file}:`, e.message);
  }
}

const vfxDir = path.join(root, 'vfx');
for (const f of fs.readdirSync(vfxDir)) {
  if (f.endsWith('.zip') || f.endsWith('.rar')) {
    const match = f.match(/Pack\s*(\d+)/i);
    const packName = match ? 'Pack' + match[1] : 'PackExtra';
    const outDir = path.join(vfxDir, packName);
    console.log(`Extracting ${f} -> ${packName}...`);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    try {
      execSync(`7z x "${path.join(vfxDir, f)}" -o"${outDir}" -y`, { stdio: 'inherit' });
    } catch (e) {
      console.error(`Error extracting ${f}:`, e.message);
    }
  }
}

console.log('All archives extracted successfully!');
