/* Contact sheets of packed pieces, for checking them by eye: every image whose key starts with one of the given
   prefixes, read from the data bundles, laid out in index order on a grey ground at 2x, 10 per row; a thin tick of
   white every 5 cells in the top-left corner (1 tick = index 0-4 of the row's first half, 2 = 5-9).
     node tools/contact.js sh.h_corner sh.z_doors kit.fk5 ...   -> tools/out/contact/<prefix>.png */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const P = require('./png');
const DATA = path.join(__dirname, '..', 'data');
function images() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const f of fs.readdirSync(DATA)) if (/^(assets|bundle_(sheets|kits|dungeons|ui))\.js$/.test(f)) vm.runInContext(fs.readFileSync(path.join(DATA, f), 'utf8'), ctx);
  return ctx.window.CH_ASSETS.img;
}
function contact(list) {
  const cols = 10;
  const cell = Math.min(160, Math.max(40, ...list.map((im) => Math.max(im.w, im.h)))) + 6;
  const rows = Math.ceil(list.length / cols);
  const out = P.blank(cols * cell * 2, rows * cell * 2);
  for (let i = 0; i < out.data.length; i += 4) { out.data[i] = 70; out.data[i + 1] = 72; out.data[i + 2] = 80; out.data[i + 3] = 255; }
  list.forEach((im, i) => {
    const cx = (i % cols) * cell * 2, cy = ((i / cols) | 0) * cell * 2;
    for (let y = 2; y < cell * 2 - 2; y++) for (let x = 2; x < cell * 2 - 2; x++) { const o = ((cy + y) * out.w + cx + x) * 4; out.data[o] = (i % 2) ? 92 : 100; out.data[o + 1] = 94; out.data[o + 2] = 104; }
    const s = Math.min(2, (cell * 2 - 6) / Math.max(im.w, im.h));
    const w = Math.max(1, Math.round(im.w * s)), h = Math.max(1, Math.round(im.h * s));
    const ox = cx + Math.floor((cell * 2 - w) / 2), oy = cy + Math.floor((cell * 2 - h) / 2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const si = ((Math.min(im.h - 1, (y / s) | 0)) * im.w + Math.min(im.w - 1, (x / s) | 0)) * 4;
      if (im.data[si + 3]) im.data.copy(out.data, ((oy + y) * out.w + ox + x) * 4, si, si + 4);
    }
  });
  return out;
}
if (require.main === module) {
  const IMG = images();
  const dir = path.join(__dirname, 'out', 'contact');
  fs.mkdirSync(dir, { recursive: true });
  for (const pre of process.argv.slice(2)) {
    const keys = Object.keys(IMG).filter((k) => k.startsWith(pre + '.') && /\.\d+$/.test(k)).sort((a, b) => +a.split('.').pop() - +b.split('.').pop());
    if (!keys.length) { console.log('none: ' + pre); continue; }
    const list = keys.map((k) => P.decode(Buffer.from(IMG[k].split(',')[1], 'base64')));
    fs.writeFileSync(path.join(dir, pre + '.png'), P.encode(contact(list)));
    console.log(pre, keys.length, 'pieces');
  }
}
module.exports = { images, contact };
