/* Asset coverage ("use every asset"): every file in assets/UI is in the ui bundle meta, every hero and sidekick
   has its strips, and every bundle merges into one CH_ASSETS. Pure node (no browser). */
const fs = require('fs');
const path = require('path');
const { loadAll } = require('../tools/split-bundles');
const { PACKS } = require('../tools/pack-sidekicks');
const { ROLES } = require('../tools/sidekick-pack');
const { HEROES } = require('../tools/hero-pack');

const A = loadAll();
let fails = 0;
const check = (name, ok, extra) => {
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + extra : ''));
};

/* UI: disk walk against meta.ui */
const uiRoot = path.resolve(__dirname, '..', 'assets', 'UI');
const bundle = fs.readdirSync(uiRoot).find((n) => /Mini Pocket Status/.test(n));
const walk = (d, out) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('_')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(path.relative(path.join(uiRoot, bundle), p).replace(/\\/g, '/'));
  }
  return out;
};
const disk = walk(path.join(uiRoot, bundle), []);
const pngs = disk.filter((f) => /\.png$/i.test(f));
const ases = disk.filter((f) => /\.aseprite$/i.test(f));
const ui = A.meta.ui || {};
const missingPng = pngs.filter((f) => !(ui.files || []).includes(f) || !A.img['ui.' + f]);
const missingAse = ases.filter((f) => !(ui.ase || {})[f]);
check('every UI png is packed (' + pngs.length + ')', missingPng.length === 0, missingPng.slice(0, 3).join(', '));
check('every UI .aseprite is exported (' + ases.length + ')', missingAse.length === 0, missingAse.slice(0, 3).join(', '));
check('menu documents have layer atlases', Object.values(ui.ase || {}).filter((a) => a.atlas && A.img[a.atlas]).length === 6);
check('all four colour variants present', ['1 - Brown', '2 - Gold', '3 - Silver', '4 - White'].every((c) => pngs.some((f) => f.startsWith(c + '/'))));

/* heroes */
const needHero = ['idle', 'walk', 'run', 'dash', 'attack', 'heavy', 'skill', 'hurt', 'jump', 'victory'];
for (const h of Object.keys(HEROES)) {
  const m = (A.meta.heroes || {})[h];
  const ok = m && needHero.every((a) => m.anims[a] > 0 && A.img['hero.' + h + '.' + a]);
  check('hero ' + h + ' has all animations', !!ok, ok ? '' : JSON.stringify(m && m.anims));
  check('hero ' + h + ' has 8 rotations', !!m && m.rotations.length === 8 && m.rotations.every((d) => A.img['hero.' + h + '.rot_' + d]));
}
check('Neon Specter has a death animation', ((A.meta.heroes || {}).Specter || { anims: {} }).anims.death > 0);

/* sidekicks */
for (const id of Object.keys(PACKS)) {
  const m = (A.meta.sidekicks || {})[id];
  const roles = m ? Object.keys(m.anims) : [];
  const ok = m && roles.includes('idle') && roles.includes('atk1') && roles.every((r) => A.img['sk.' + id + '.' + r]);
  check('sidekick ' + id + ' packed (' + roles.length + ' roles)', !!ok);
  // every mapped role of the role table made it into the strips
  const expected = Object.entries(ROLES[id]).flatMap(([r, v]) => (Array.isArray(v) ? v.map((_, i) => r + (i + 1)) : [r]));
  const lost = expected.filter((r) => !roles.includes(r));
  check('sidekick ' + id + ' lost no role', lost.length === 0, lost.join(','));
}

console.log(fails ? 'FAILED ' + fails : 'ALL PASSED');
process.exit(fails ? 1 : 0);
