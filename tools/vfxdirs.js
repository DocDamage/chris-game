/* Finds the PNG folder of each of the seven "Beat 'em Up Combat Effects" VFX packs, whatever the folders around it
   are called (the packs have been moved from their zip names into "Pack 1" ... "Pack 7"). A pack's folder is the
   first PNG folder holding "Effect (1)1.png" under assets/vfx/Pack <n>, or the old zip-named folder. */
'use strict';
const fs = require('fs');
const path = require('path');

function findPng(root, depth) {
  if (!fs.existsSync(root) || depth < 0) return null;
  if (fs.existsSync(path.join(root, 'PNG', 'Effect (1)1.png'))) return path.join(root, 'PNG');
  const subs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  for (const s of subs) {
    const r = findPng(path.join(root, s), depth - 1);
    if (r) return r;
  }
  return null;
}

/** @returns {string|null} absolute PNG folder of VFX pack n (1-7) */
function vfxDir(assetsRoot, n) {
  const V = path.join(assetsRoot, 'vfx');
  const own = path.join(V, 'Pack ' + n);
  // the pack's own folder first, preferring the sub-folder that names this pack
  if (fs.existsSync(own)) {
    const named = fs.readdirSync(own).find((s) => new RegExp('Pack ' + n + '$').test(s));
    const r = (named && findPng(path.join(own, named), 1)) || findPng(own, 2);
    if (r) return r;
  }
  const zipName = "Beat 'em Up Combat Effects – 2D Pixel Art VFX Pack" + (n === 1 ? '' : ' ' + n);
  return findPng(path.join(V, zipName), 1) || findPng(path.join(V, zipName.replace("'", '_')), 1);
}

module.exports = { vfxDir };
if (require.main === module) for (let n = 1; n <= 7; n++) console.log(n, vfxDir(path.resolve(__dirname, '..', 'assets'), n));
