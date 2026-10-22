'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const base = path.join(__dirname, '..', 'assets', 'tile sets');
const packs = [
  'Psychological Horror Dungeon',
  'Volcanic Ruins',
  'WASTELAND SURVIVOR KIT Post-Apocalyptic',
  'Zombie Apocalypse Survival Asset Pack'
];

for (const pack of packs) {
  const dir = path.join(base, pack);
  if (!fs.existsSync(dir)) continue;
  const zips = fs.readdirSync(dir).filter(f => f.endsWith('.zip'));
  console.log(`Unpacking ${pack} (${zips.length} zips)...`);
  for (const zip of zips) {
    const zipPath = path.join(dir, zip);
    try {
      // Use tar -xf to extract into dir
      execSync(`tar -xf "${zipPath}" -C "${dir}"`);
    } catch (e) {
      console.error(`Failed to extract ${zip}:`, e.message);
    }
  }
}
console.log('Done unpacking!');

