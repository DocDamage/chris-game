/* Wall autotile sets cut from the big pack sheets. Each biome gets a 176x80 sheet in the layout js/level.js expects
   (the Valley Ruin 11x5 grid of 16px cells): a framed wall panel from the pack, scaled to 48x48, is the 3x3 block at
   cells (0..2, 0..2) - corners, edges and front face come from the panel's own frame - and cells (5..7, 2) hold fill
   variants (flips of the centre) for the deep interior of thick walls.
     wall.dungeon  Psychological Horror Dungeon / Wall tiles      wall.office    the same, metal plate
     wall.glitch   the same, riveted plate                         wall.volcano   Volcanic Ruins / 2. wall tiles
     wall.zombie   Zombie Apocalypse / 2. Broken building walls    wall.wasteland Wasteland / 4. Scrap walls and panels */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./png');
const S = require('./slice');

const ROOT = path.resolve(__dirname, '..', 'assets', 'tile sets');
const SRC = {
  horror: 'Psychological Horror Dungeon/Wall tiles.png',
  volcano: 'Volcanic Ruins/2. wall tiles.png',
  zombie: 'Zombie Apocalypse Survival Asset Pack/2. Broken building walls.png',
  scrap: 'WASTELAND SURVIVOR KIT Post-Apocalyptic/4. Scrap wall and panels.png',
};
/* biome -> [sheet, row, col, optional crop fractions [x0, y0, x1, y1]] */
const PICK = {
  dungeon: ['horror', 1, 1],
  office: ['horror', 0, 3],
  glitch: ['horror', 2, 3],
  volcano: ['volcano', 1, 0],
  zombie: ['zombie', 2, 2, [0, 0.35, 1, 1], true],
  wasteland: ['scrap', 0, 3],
};

/* area-average resize to an exact size, alpha thresholded so pixel edges stay crisp */
function resize(img, w, h) {
  const out = P.blank(w, h);
  const sx = img.w / w, sy = img.h / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = Math.floor(y * sy); yy < Math.max(Math.floor(y * sy) + 1, Math.ceil((y + 1) * sy)); yy++) {
      for (let xx = Math.floor(x * sx); xx < Math.max(Math.floor(x * sx) + 1, Math.ceil((x + 1) * sx)); xx++) {
        const i = (Math.min(img.h - 1, yy) * img.w + Math.min(img.w - 1, xx)) * 4, al = img.data[i + 3] / 255;
        r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; a += al; n++;
      }
    }
    const o = (y * w + x) * 4;
    if (a / n > 0.5) { out.data[o] = Math.round(r / a); out.data[o + 1] = Math.round(g / a); out.data[o + 2] = Math.round(b / a); out.data[o + 3] = 255; }
  }
  return out;
}
const flip = (im, fx, fy) => { const o = P.blank(im.w, im.h); for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) im.data.copy(o.data, (y * im.w + x) * 4, ((fy ? im.h - 1 - y : y) * im.w + (fx ? im.w - 1 - x : x)) * 4, ((fy ? im.h - 1 - y : y) * im.w + (fx ? im.w - 1 - x : x)) * 4 + 4); return o; };

function packWalls() {
  const img = {};
  const sheets = {};
  for (const k of Object.keys(PICK)) {
    const [src, row, col, frac, outline] = PICK[k];
    if (!sheets[src]) {
      const f = path.join(ROOT, SRC[src]);
      if (!fs.existsSync(f)) continue;
      const d = P.decode(fs.readFileSync(f));
      sheets[src] = { d, comps: S.components(d, { ymin: Math.round(d.h * 0.16), gap: 2, minArea: 3000 }) };
    }
    const sh = sheets[src];
    if (!sh) continue;
    const r = sh.comps.find((c) => c.row === row && c.col === col);
    if (!r) continue;
    let piece = S.cut(sh.d, r);
    if (frac) piece = P.crop(piece, Math.round(piece.w * frac[0]), Math.round(piece.h * frac[1]), Math.round(piece.w * (frac[2] - frac[0])), Math.round(piece.h * (frac[3] - frac[1])));
    const nine = resize(piece, 48, 48);
    if (outline) for (let i = 0; i < 48; i++) for (const [x, y] of [[i, 0], [i, 47], [0, i], [47, i]]) { const o = (y * 48 + x) * 4; nine.data[o] = nine.data[o] * 0.4; nine.data[o + 1] = nine.data[o + 1] * 0.4; nine.data[o + 2] = nine.data[o + 2] * 0.4; nine.data[o + 3] = 255; }
    const sheet = P.blank(176, 80);
    P.blit(sheet, nine, 0, 0);
    const mid = P.crop(nine, 16, 16, 16, 16);
    P.blit(sheet, mid, 16, 16);
    [[80, 32, mid], [96, 32, flip(mid, 1, 0)], [112, 32, flip(mid, 0, 1)]].forEach(([x, y, m]) => P.blit(sheet, m, x, y));
    img['wall.' + k] = 'data:image/png;base64,' + P.encode(sheet).toString('base64');
  }
  return { img };
}
module.exports = { packWalls, resize };
