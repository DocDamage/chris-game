'use strict';
const fs = require('fs');
const path = require('path');
const { decode } = require('./png');

function scan(dirPath, maxDepth = 4, curDepth = 0) {
  const dir = path.isAbsolute(dirPath) ? dirPath : path.join(__dirname, '..', dirPath);
  if (curDepth > maxDepth || !fs.existsSync(dir)) return [];
  let res = [];
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith('.')) continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      res = res.concat(scan(full, maxDepth, curDepth + 1));
    } else if (f.endsWith('.png') && !f.includes('DS_Store')) {
      try {
        const buf = fs.readFileSync(full);
        const png = decode(buf);
        res.push({ path: path.relative(path.join(__dirname, '..'), full), name: f, w: png.width, h: png.height, size: stat.size });
      } catch (e) {
        // Not a standard PNG or corrupt
      }
    }
  }
  return res;
}

console.log('=== BOSS MONSTERS ===');
const bossMon = scan('assets/bosses/boss-monsters');
console.log(bossMon.map(x => `${x.path} (${x.w}x${x.h})`).join('\n'));

console.log('\n=== DRAGON PACK ===');
const dragon = scan('assets/bosses/dragon-pack');
console.log(dragon.map(x => `${x.path} (${x.w}x${x.h})`).slice(0, 15).join('\n'));

console.log('\n=== DADDY & SKULL (END BOSSES) ===');
const endBosses = scan('assets/bosses/End Bosses');
console.log(endBosses.map(x => `${x.path} (${x.w}x${x.h})`).join('\n'));

console.log('\n=== GOLEM PACK ===');
const golem = scan('assets/bosses/golem-pack');
console.log(golem.map(x => `${x.path} (${x.w}x${x.h})`).slice(0, 15).join('\n'));

console.log('\n=== BEHOLDER MONSTERS ===');
const beholder = scan('assets/bosses/beholder-monsters');
console.log(beholder.map(x => `${x.path} (${x.w}x${x.h})`).slice(0, 15).join('\n'));

console.log('\n=== PREDATOR PLANTS ===');
const plants = scan('assets/enemies/predator-plants');
console.log(plants.map(x => `${x.path} (${x.w}x${x.h})`).slice(0, 15).join('\n'));

console.log('\n=== SLIME MOBS ===');
const slimes = scan('assets/enemies/slime-mobs');
console.log(slimes.map(x => `${x.path} (${x.w}x${x.h})`).slice(0, 15).join('\n'));

console.log('\n=== ORCS ===');
const orcs = scan('assets/enemies/orcs');
console.log(orcs.map(x => `${x.path} (${x.w}x${x.h})`).slice(0, 15).join('\n'));

console.log('\n=== GOBLINS ===');
const goblins = scan('assets/enemies/goblins');
console.log(goblins.map(x => `${x.path} (${x.w}x${x.h})`).slice(0, 15).join('\n'));

console.log('\n=== GIANT SPIDERS ===');
const spiders = scan('assets/enemies/giant-spiders');
console.log(spiders.map(x => `${x.path} (${x.w}x${x.h})`).slice(0, 15).join('\n'));

console.log('\n=== VFX PACKS 2, 3, 4, 6 ===');
for (const p of ['Pack2', 'Pack3', 'Pack4', 'Pack6']) {
  const vfx = scan(`assets/vfx/${p}`);
  console.log(`${p}: ${vfx.length} PNGs`);
  if (vfx.length > 0) {
    console.log('Sample:', vfx.slice(0, 5).map(x => `${x.name} (${x.w}x${x.h})`).join(', '));
  }
}
