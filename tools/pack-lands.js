/* The packs of 2026-10-24 (second drop, PLAN.md 21): Undead Land Objects, Seabed, Flying Islands, the Final Tower and
   Inside the Monster's Belly, cut for the 640x360 world into data/bundle_lands.js.
     kit.ul1.<n>   Undead Land Objects: every file of Objects_separately (three shadow variants of each object)
     kit.sb1.<n>   Seabed Objects.png (leviathan skeletons, krakens, tentacles, urchins, corals, anemones, rocks)
     kit.sb2.<n>   Seabed Animated_objects.png, each frame a piece (anemones, sea pens, weeds, corals)
     kit.sb3.<n>   Seabed spots.png: sand and shell spots, floor decals
     kit.fi1.<n>   Flying Islands Objects_separately (trees, bushes, plants, crystals, rocks, ruins, clouds, dragons)
     kit.fi2.<n>   Flying Islands Bridges.png (rope bridges and ladders)
     kit.fi3.<n>   Flying Islands details.png (tufts, pebbles, ferns)
     kit.fiG.<n>   Flying Islands ground: grass and stone swatches (32 px floor tiles) and island undersides (cliffs)
     kit.ft1.<n>   the Final Tower sheet (consoles, tanks, capsules, statues, rocks, crystals, pillars, floor and wall bits)
     kit.ftG.<n>   the Final Tower floor swatches, 32 px
     kit.ft_tower  the Final Tower itself (world map art, 3x), the entry of the last area
     kit.mb1.<n>   Inside the Monster's Belly sheet (flesh floors, walls, teeth, bones, eyes, pustules, membranes)
     kit.mbG.<n>   the Belly's floor swatches, 32 px
     anim.<name>.<f>  animated pieces: island statues, trees, floating rocks and flowers, clouds; the belly's heart,
                   cell monsters, tentacles, doors and the giant worm
   meta.lands = { sheets: { id: { pack, n, kinds, sizes, names } }, anims: { name: { n, fw, fh, kind, fps } } }
   Usage: `node tools/pack-lands.js` writes data/bundle_lands.js and contact sheets to tools/out/lands/. */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./png');
const S = require('./slice');
const { resize } = require('./pack-walls');

const ROOT = path.resolve(__dirname, '..', 'assets', 'tile sets');
const UL = path.join(ROOT, 'Undead Land Objects/_unpacked/PNG/Objects_separately');
const SB = path.join(ROOT, 'Seabed Top Down/_unpacked/PNG');
const FI = path.join(ROOT, 'flying islands/_unpacked/PNG');
const FT = path.join(ROOT, 'Final Tower/_unpacked');
const MB = path.join(ROOT, 'monsters belly/_unpacked/100');
const load = (f) => P.decode(fs.readFileSync(f));
const hard = (im) => { for (let i = 3; i < im.data.length; i += 4) im.data[i] = im.data[i] <= 60 ? 0 : 255; return im; };
const scaleTo = (im, s) => hard(resize(im, Math.max(2, Math.round(im.w * s)), Math.max(2, Math.round(im.h * s))));
/* nearest-neighbour upscale for the 16 px pixel-art packs (keeps their pixels crisp) */
function nearest(im, s) {
  const w = Math.max(1, Math.round(im.w * s)), h = Math.max(1, Math.round(im.h * s)), o = P.blank(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const si = (Math.min(im.h - 1, (y / s) | 0) * im.w + Math.min(im.w - 1, (x / s) | 0)) * 4; im.data.copy(o.data, (y * w + x) * 4, si, si + 4); }
  return o;
}
/* pixel-art scale: whole multiples go nearest, the rest are averaged */
const px = (im, s) => (Math.abs(s - Math.round(s)) < 0.01 ? nearest(im, Math.round(s)) : scaleTo(im, s));
const trim = (im) => { const b = P.bounds(im); return b ? P.crop(im, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1) : null; };
/* draw src over dst where src is opaque (png.blit copies every pixel) */
function over(dst, src, dx, dy) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const tx = x + dx, ty = y + dy, i = (y * src.w + x) * 4;
    if (tx >= 0 && ty >= 0 && tx < dst.w && ty < dst.h && src.data[i + 3] > 40) src.data.copy(dst.data, (ty * dst.w + tx) * 4, i, i + 4);
  }
}
/* a colour grade for ground cut from the bright packs, so it sits in the game's dusk: mul per channel, then a share of
   its own grey (desaturation) */
function grade(im, mul, desat) {
  for (let i = 0; i < im.data.length; i += 4) {
    const l = (im.data[i] + im.data[i + 1] + im.data[i + 2]) / 3;
    for (let c = 0; c < 3; c++) im.data[i + c] = Math.max(0, Math.min(255, Math.round((im.data[i + c] * (1 - desat) + l * desat) * mul[c])));
  }
  return im;
}
const png64 = (im) => 'data:image/png;base64,' + P.encode(im).toString('base64');
/* colour shares of a piece's opaque pixels */
function colours(im) {
  let o = 0, bone = 0, pink = 0, purple = 0, blue = 0, green = 0, red = 0, dark = 0, orange = 0, white = 0;
  for (let i = 0; i < im.data.length; i += 4) {
    if (im.data[i + 3] < 120) continue;
    o++;
    const r = im.data[i], g = im.data[i + 1], b = im.data[i + 2], l = r + g + b;
    if (l > 540) white++;
    if (l > 420 && Math.abs(r - g) < 30 && Math.abs(g - b) < 40) bone++;
    if (r > 150 && g < 130 && b > 100) pink++;
    if (r > 80 && b > 90 && g < r - 15 && g < b - 15) purple++;
    if (b > r + 25 && b > g) blue++;
    if (g > r + 15 && g > b) green++;
    if (r > 150 && g < 90 && b < 100) red++;
    if (r > 200 && g > 110 && g < 190 && b < 90) orange++;
    if (l < 150) dark++;
  }
  const q = Math.max(1, o);
  return { bone: bone / q, pink: pink / q, purple: purple / q, blue: blue / q, green: green / q, red: red / q, dark: dark / q, orange: orange / q, white: white / q, fill: o / (im.w * im.h) };
}

const out = { img: {}, sheets: {}, anims: {} };
const sheet = (id, pack) => (out.sheets[id] = { pack, n: 0, kinds: [], sizes: [], names: [] });
function add(id, im, kind, name) {
  const s = out.sheets[id];
  if (!im || !P.bounds(im)) return;
  out.img['kit.' + id + '.' + s.n] = png64(im);
  s.kinds.push(kind);
  s.sizes.push([im.w, im.h]);
  s.names.push(name || '');
  s.n++;
}
/* the pieces of a sheet: blobs of opaque pixels (block 1: the 16 px packs keep gaps of a pixel or two) */
function blobs(img, o) {
  return S.components(img, Object.assign({ block: 1, gap: 1, minArea: 24 }, o || {})).filter((r) => r.w < img.w * 0.95 || r.h < img.h * 0.95);
}
/* an animation: frames cut on a grid, trimmed together to the union of their opaque pixels */
function anim(name, img, cells, s, kind, fps) {
  const crops = cells.map(([x, y, w, h]) => P.crop(img, x, y, w, h));
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (const c of crops) { const b = P.bounds(c); if (b) { x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); } }
  if (x1 < 0) return;
  const fr = crops.map((c) => px(P.crop(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1), s));
  fr.forEach((im, i) => { out.img['anim.' + name + '.' + i] = png64(im); });
  out.anims[name] = { n: fr.length, fw: fr[0].w, fh: fr[0].h, kind, fps: fps || 6 };
}
const grid = (x, y, fw, fh, n, dx, dy) => Array.from({ length: n }, (_, i) => [x + i * (dx === undefined ? fw : dx), y + i * (dy || 0), fw, fh]);

/* ---------------------------------------------------------------- Undead Land Objects: one piece per file */
function undead() {
  sheet('ul1', 'Undead Land Objects');
  const KIND = [
    [/^bone_monster(1|2)?_|^scolopendra_s/, 'carcass'], [/^scolopendra_tail|^bone_claws|^bone_monster_head|^bone_monster_paw|^bone_chest|^bone_arm/, 'bonepile'],
    [/^bone_pelvis/, 'bones'], [/^coffin/, 'coffin'], [/^excavated/, 'opengrave'], [/^grave/, 'grave'], [/^lich/, 'lich'],
    [/^monster_tree|^web_tree/, 'deadtree'], [/^mushroom1_1/, 'mushroom'], [/^mushroom/, 'mushroom'], [/^skull_chasm/, 'chasm'], [/^skull_pile/, 'bonepile'],
    [/^undead_plant/, 'shrub'], [/^web_rock/, 'rock'],
  ];
  for (const f of fs.readdirSync(UL).filter((x) => x.endsWith('.png')).sort()) {
    const nm = f.replace('.png', '');
    const k = (KIND.find(([re]) => re.test(nm)) || [0, 'debris'])[1];
    add('ul1', scaleTo(trim(load(path.join(UL, f))), 0.72), k, nm);
  }
}

/* ---------------------------------------------------------------- Seabed */
function seaKind(im, r) {
  const c = colours(im), big = Math.max(r.w, r.h);
  if (c.bone > 0.35 && big > 120) return 'leviathan';
  if (c.bone > 0.3) return 'bonepile';
  if (big > 150) return 'kraken';
  if ((c.pink > 0.18 || c.purple > 0.2) && r.h > r.w * 1.3 && big > 40) return 'tentacle';
  if (c.purple > 0.25 && r.w > 22 && c.fill < 0.55) return 'urchin';
  if (c.green > 0.3) return 'weed';
  if (c.blue > 0.3 && c.fill > 0.55) return 'rock';
  if (c.dark > 0.3 && c.fill > 0.5) return 'rock';
  if (big < 14) return 'debris';
  return 'coral';
}
function seabed() {
  sheet('sb1', 'Seabed');
  const ob = load(path.join(SB, 'Objects.png'));
  for (const r of blobs(ob, { gap: 2, minArea: 30 })) {
    const im = S.cut(ob, r);
    add('sb1', scaleTo(im, 0.62), seaKind(im, r), r.x + ',' + r.y);
  }
  // the animated sheet: each row holds runs of frames of one object (an anemone opening, a weed swaying); a run is
  // blobs side by side of about one size, cut on a common box standing on their bottom line
  const an = load(path.join(SB, 'Animated_objects.png'));
  const bl = blobs(an, { gap: 1, minArea: 60 }).filter((r) => colours(S.cut(an, r)).fill >= 0.08); // no bubble trails
  bl.sort((a, b) => (Math.abs((a.y + a.h) - (b.y + b.h)) < 6 ? a.x - b.x : (a.y + a.h) - (b.y + b.h)));
  const runs = [];
  for (const r of bl) {
    const run = runs[runs.length - 1], q = run && run[run.length - 1];
    const same = q && Math.abs((q.y + q.h) - (r.y + r.h)) < 6 && Math.abs(q.w - r.w) <= Math.max(4, q.w * 0.3) && Math.abs(q.h - r.h) <= Math.max(4, q.h * 0.3) && r.x - (q.x + q.w) < Math.max(24, q.w);
    if (same && run.length < 8) run.push(r); else runs.push([r]);
  }
  let na = 0;
  for (const run of runs) {
    const fw = Math.max(...run.map((r) => r.w)), fh = Math.max(...run.map((r) => r.h));
    const cells = run.map((r) => [Math.max(0, Math.round(r.x + r.w / 2 - fw / 2)), Math.max(0, r.y + r.h - fh), fw, fh]);
    const im = S.cut(an, run[0]), c = colours(im);
    const k = c.pink > 0.15 || c.red > 0.15 || c.blue > 0.2 || c.dark > 0.4 ? 'anemone' : seaKind(im, run[0]);
    anim('sb_' + na++, an, cells, 0.62, k, 5);
  }
  sheet('sb3', 'Seabed');
  const sp = load(path.join(SB, 'spots.png'));
  for (const r of blobs(sp, { gap: 1, minArea: 20 })) add('sb3', scaleTo(S.cut(sp, r), 0.8), 'patch', r.x + ',' + r.y);
}

/* ---------------------------------------------------------------- Flying Islands */
function islands() {
  sheet('fi1', 'Flying Islands');
  const D = path.join(FI, 'Objects_separately');
  const KIND = [[/^Bush/, 'shrub'], [/^Cloud/, 'cloud'], [/^Crystael/, 'crystal'], [/^Dragon/, 'dragon'], [/^Plant1/, 'shrub'], [/^Plant/, 'flower'], [/^Rock/, 'boulder'], [/^Ruins/, 'ruin'], [/^Small_rock/, 'rock'], [/^Tree/, 'tree']];
  for (const f of fs.readdirSync(D).filter((x) => x.endsWith('.png')).sort()) {
    const nm = f.replace('.png', '');
    const k = (KIND.find(([re]) => re.test(nm)) || [0, 'rock'])[1];
    const im = trim(load(path.join(D, f)));
    add('fi1', scaleTo(im, k === 'dragon' ? 0.8 : k === 'cloud' ? 1 : 0.72), k, nm);
  }
  sheet('fi2', 'Flying Islands');
  const br = load(path.join(FI, 'Bridges.png'));
  for (const r of blobs(br, { gap: 1 })) add('fi2', px(S.cut(br, r), 1.4), r.w > r.h * 2.2 ? 'bridge' : 'ladder', r.x + ',' + r.y);
  sheet('fi3', 'Flying Islands');
  const de = load(path.join(FI, 'details.png'));
  for (const r of blobs(de, { gap: 1, minArea: 16 })) { const im = S.cut(de, r); const c = colours(im); add('fi3', px(im, 1.4), c.white > 0.3 || c.bone > 0.4 ? 'debris' : 'tuft', r.x + ',' + r.y); }
  // ground: the grass top and the white stone top of the big island (16 px tiles: 2x to 32 px), cut from inside
  // their rims; the islands' undersides (the hanging rock under the rim) as cliff strips
  sheet('fiG', 'Flying Islands');
  const gg = load(path.join(FI, 'Ground_grass_flying.png'));
  for (const [x, y] of [[16, 16], [80, 16], [16, 96], [80, 96]]) add('fiG', grade(nearest(P.crop(gg, x, y, 16, 16), 2), [0.58, 0.7, 0.68], 0.12), 'ground', 'top' + x + ',' + y);
  for (const [x, y, w, h] of [[0, 40, 64, 40], [0, 120, 64, 40], [144, 40, 48, 40], [96, 40, 48, 40]]) add('fiG', grade(nearest(P.crop(gg, x, y, w, h), 1.4), [0.74, 0.7, 0.82], 0.2), 'cliff', 'under' + x + ',' + y);
  // animations: statues, the tree, floating rocks and flowers, clouds
  const st = load(path.join(FI, 'Statue_animated.png'));
  anim('fi_statue', st, grid(0, 0, 144, 144, 6), 0.72, 'statue', 5);
  const st2 = load(path.join(FI, 'Statue_animated2.png'));
  anim('fi_obelisk', st2, grid(0, 0, 48, 110, 6, 48), 0.9, 'obelisk', 5);
  anim('fi_orb', st2, grid(0, 110, 48, 34, 6, 48), 0.9, 'item', 6);
  const tr = load(path.join(FI, 'Tree_animated.png'));
  anim('fi_tree', tr, grid(0, 0, 160, 160, 6), 0.72, 'tree', 4);
  const fr = load(path.join(FI, 'Flying_rocks.png'));
  for (let row = 0; row < 3; row++) anim('fi_rock' + row, fr, grid(0, row * 64, 64, 64, 6), 1, 'floater', 4);
  const ff = load(path.join(FI, 'Flying_flowers.png'));
  for (let row = 0; row < 2; row++) anim('fi_flower' + row, ff, grid(0, row * 64, 64, 64, 6), 1, 'floater', 4);
  for (const n of [1, 2]) {
    const ca = load(path.join(FI, 'Clouds_animated' + n + '.png'));
    anim('fi_cloud' + n + 'a', ca, grid(0, 0, 64, 48, 6), 1.4, 'cloud', 3);
    anim('fi_cloud' + n + 'b', ca, grid(0, 48, 48, 32, 8), 1.4, 'cloud', 3);
  }
  const wf = load(path.join(FI, 'Waterfalls.png'));
  anim('fi_falls', wf, [0, 1, 2, 3, 4, 5, 6].map((i) => [0, i * 176 + 8, 192, 140]).filter((c) => c[1] + c[3] <= wf.h), 1, 'falls', 6);
}

/* ---------------------------------------------------------------- the Final Tower */
function ftKind(im, r) {
  const c = colours(im), big = Math.max(r.w, r.h);
  if (r.w >= 15 && r.w <= 17 && r.h >= 15 && r.h <= 17 && c.fill > 0.97) return 'ground';
  if (c.fill > 0.92 && big >= 32) return 'plate';
  if (r.h > r.w * 2.2 && r.h > 40) return 'pillar';
  if (c.green > 0.2 && c.fill > 0.5 && r.w > 20) return 'reactor';
  if (c.blue > 0.25 || (c.white > 0.2 && r.w > 20)) return 'machine';
  if (c.orange > 0.08 || c.red > 0.15) return 'crystal';
  if (r.h > r.w * 1.4 && big > 30) return 'statue';
  if (big < 12) return 'debris';
  if (c.bone > 0.25) return 'bones';
  return r.y > 230 && r.y < 310 ? 'rock' : 'machine';
}
function tower() {
  const full = load(path.join(FT, 'finaltower_complete_fullcolor.png'));
  sheet('ft1', 'Final Tower');
  sheet('ftG', 'Final Tower');
  // the floor blocks at the top left and the patterned floors on the left: 16 px swatches, 2x
  for (let y = 32; y + 16 <= 112; y += 16) for (let x = 16; x + 16 <= 144; x += 16) add('ftG', nearest(P.crop(full, x, y, 16, 16), 2), 'ground', 'f' + x + ',' + y);
  for (const [x0, y0] of [[16, 176], [96, 176], [16, 224], [96, 224], [16, 272], [96, 272]]) add('ftG', nearest(P.crop(full, x0 + 8, y0 + 8, 16, 16), 2), 'ground', 'c' + x0 + ',' + y0);
  for (const r of blobs(full, { gap: 1, minArea: 30 })) {
    if (r.x < 150 && r.y < 300) continue; // the floor and autotile blocks, taken above
    const im = S.cut(full, r);
    // the wall and pit autotile blocks at the top and the stacked door frames at the bottom are tile sources (their
    // tiles and animations are cut above and in the tower's character sheets)
    const k = (r.y < 175 && r.x > 150 && r.w > 60) || (r.y >= 318 && r.x < 400 && r.h > 100) ? 'tiles' : r.w > 60 && r.h > 50 ? (r.h > r.w ? 'statue' : 'machine') : ftKind(im, r);
    add('ft1', px(im, k === 'plate' || k === 'pillar' && r.h > 90 ? 2 : 1.4), k, r.x + ',' + r.y);
  }
  // the tower: the world map art (16 px tiles) put together, its two spires behind the winged keep and its base, at
  // 3x: the last area's great landmark, its door at the foot
  const w1 = load(path.join(FT, 'RPGMaker_100/finaltower_worldmap_fullcolor.png'));
  const T = P.blank(80, 92);
  over(T, P.crop(w1, 0, 0, 16, 64), 22, 0);
  over(T, P.crop(w1, 16, 0, 16, 64), 42, 6);
  over(T, P.crop(w1, 32, 16, 80, 48), 0, 44);
  out.img['kit.ft_tower'] = png64(nearest(T, 3));
  out.sheets.ft_tower = { n: 1 };
  // the tower's animated character sheets (gates, lights): row 0 of each of the 8 characters, 3 frames
  for (const ch of ['A', 'B', 'C']) {
    const im = load(path.join(FT, 'RPGMaker_100/Full_color/towerchar' + ch + '.png'));
    for (let c = 0; c < 8; c++) {
      const cx = (c % 4) * 48, cy = ((c / 4) | 0) * 128;
      const cells = [0, 1, 2, 3].map((row) => [cx, cy + row * 32, 48, 32]);
      const frames = [];
      for (const [x, y, w, h] of cells) for (let f = 0; f < 3; f++) frames.push([x + f * 16, y, 16, h]);
      if (frames.some(([x, y, w, h]) => P.bounds(P.crop(im, x, y, w, h)))) anim('ft_' + ch + c, im, frames.filter(([x, y, w, h]) => P.bounds(P.crop(im, x, y, w, h))), 2, 'machine', 6);
    }
  }
}

/* ---------------------------------------------------------------- Inside the Monster's Belly */
function mbKind(im, r) {
  const c = colours(im), big = Math.max(r.w, r.h);
  if (c.fill > 0.95 && big >= 30) return 'plate';
  if (c.bone > 0.3 && r.h > r.w * 1.5) return 'spike';
  if (c.bone > 0.25) return 'bones';
  if (c.blue > 0.25) return 'vein';
  if (c.green > 0.25) return 'growth';
  if (r.h > r.w * 2.4 && r.h > 40) return 'pillar';
  if (big < 14) return 'debris';
  if (c.red > 0.2 || c.pink > 0.2) return 'pustule';
  return 'growth';
}
function belly() {
  const sh = load(path.join(MB, 'tf_insidebelly_fullsheet.png'));
  sheet('mbG', "Monster's Belly");
  // floors: the gut floor (top left), the pebbled flesh, the red and green flesh fields on the right
  for (const [x, y] of [[24, 24], [40, 24], [56, 24], [24, 72], [40, 72], [56, 72], [72, 72], [112, 72], [176, 48], [208, 48], [432, 24], [464, 24], [496, 24], [432, 120], [464, 120], [496, 120], [176, 112], [224, 112], [272, 112]]) {
    if (x + 16 > sh.w || y + 16 > sh.h) continue;
    const c = P.crop(sh, x, y, 16, 16);
    let full = true;
    for (let i = 3; i < c.data.length; i += 4) if (c.data[i] < 250) { full = false; break; }
    if (full) add('mbG', grade(nearest(c, 2), [0.78, 0.66, 0.68], 0.4), 'ground', x + ',' + y);
  }
  sheet('mb1', "Monster's Belly");
  for (const r of blobs(sh, { gap: 1, minArea: 30 })) {
    const im = S.cut(sh, r);
    const k = mbKind(im, r);
    add('mb1', px(im, k === 'plate' ? 2 : 1.4), k, r.x + ',' + r.y);
  }
  // the flesh wall, the teeth, the sphincter doors and the eye column are wall pieces (js/sky.js, js/walls.js)
  for (const i of [17, 37, 38, 39]) if (out.sheets.mb1.kinds[i]) out.sheets.mb1.kinds[i] = 'skip';
  // the autotile blocks (vein mats, pit and floor templates, the flesh fields) are where the ground swatches come from
  for (const i of [0, 1, 2, 3, 16, 31, 40, 41]) if (out.sheets.mb1.kinds[i]) out.sheets.mb1.kinds[i] = 'tiles';
  const hb = load(path.join(MB, 'heartbeat_1.png'));
  anim('mb_heart', hb, [0, 1, 2, 3].flatMap((row) => [0, 1, 2].map((c) => [c * 48, row * 64, 48, 64])), 1.6, 'heart', 8);
  const cm = load(path.join(MB, 'cellmonsters_1.png'));
  for (let row = 0; row < 4; row++) anim('mb_cell' + row, cm, [0, 1, 2, 1].map((c) => [c * 48, row * 48, 48, 48]), 1.4, 'cell', 5);
  for (const [nm, f] of [['mb_tent', '!tf_insidebelly_tentacle_1.png'], ['mb_door', '!tf_insidebelly_doors_1.png']]) {
    const im = load(path.join(MB, f));
    for (let c = 0; c < 8; c++) {
      const cx = (c % 4) * 48, cy = ((c / 4) | 0) * 128;
      // an object character: the four rows of its first column are its frames (opening, growing)
      const frames = [0, 1, 2, 3].map((row) => [cx, cy + row * 32, 16, 32]);
      const wide = [0, 1, 2, 3].map((row) => [cx, cy + row * 32, 48, 32]);
      const useWide = nm === 'mb_door' && c < 2; // the teeth doors span their three columns
      const cells = useWide ? wide : frames;
      if (cells.some(([x, y, w, h]) => P.bounds(P.crop(im, x, y, w, h)))) anim(nm + c, im, cells, 2, nm === 'mb_door' ? 'mawdoor' : 'tentacle', 4);
      if (!useWide) for (let col = 1; col < 3; col++) { const cl = [0, 1, 2, 3].map((row) => [cx + col * 16, cy + row * 32, 16, 32]); if (cl.some(([x, y, w, h]) => P.bounds(P.crop(im, x, y, w, h)))) anim(nm + c + '_' + col, im, cl, 2, nm === 'mb_door' ? 'pustule' : 'tentacle', 4); }
    }
  }
  const gw = load(path.join(MB, 'giantworm_1.png'));
  for (let col = 0; col < 4; col++) anim('mb_worm' + col, gw, [0, 1, 2, 3].map((row) => [col * 144, row * 48, 144, 48]), 2, 'worm', 4);
}

/* ---------------------------------------------------------------- the older packs' floor and wall sheets (PLAN.md 22)
   cut by tools/pack-kits.js's rules (zs1 street, wl1-2 concrete and metal, vr1 floor, vr2 walls, vr3 lava, ph1 crypt
   floors, ph2 crypt walls); labels, divider lines and dust specks dropped. Into meta.lands.kits, which the game merges
   into meta.kits (js/props.js) */
function oldKits() {
  const K = require('./pack-kits');
  out.kits = {};
  for (const id of ['zs1', 'wl1', 'wl2', 'vr1', 'vr2', 'vr3', 'ph1', 'ph2']) {
    const r = K.packSheet(id);
    if (!r) continue;
    const m = { pack: r.pack, sheet: r.sheet, name: r.name, n: 0, roles: [], sizes: [], src: [], kinds: [] };
    r.images.forEach((im, i) => {
      const [w, h] = r.sizes[i];
      if (Math.max(w, h) < 8 || (h <= 6 && w >= 18) || w > h * 8) return; // a label, a divider line, a speck
      out.img['kit.' + id + '.' + m.n] = png64(im);
      m.roles.push(r.roles[i]); m.sizes.push(r.sizes[i]); m.src.push(r.src[i]); m.kinds.push(r.kinds[i]);
      m.n++;
    });
    out.kits[id] = m;
  }
}

/* ---------------------------------------------------------------- the rest of the Seabed and the islands (PLAN.md 22)
   Seabed: Ground_sand's rock outcrops, pebbles and sand (sb4), the reef's seagrass (sb5), Details' pebbles (sb6), the
   bubbles (sb7, they rise in the drowned rooms). Islands: the ponds and lake shores of Water_coasts1-2 (six frames each,
   animated), the ripples of water_detilazation (animated), the grass edges and cliff of the additional tiles (fi4). */
function columns(img, sections, gapX) {
  // blobs grouped into columns (one frame per row): an animation per column
  const b = blobs(img, { gap: 2, minArea: 16 });
  const out = [];
  for (const [y0, y1] of sections) {
    const cols = [];
    for (const r of b.filter((q) => q.y >= y0 && q.y < y1).sort((a, c) => a.y - c.y)) {
      const cx = r.x + r.w / 2;
      const col = cols.find((q) => Math.abs(q.cx - cx) < (gapX || 30));
      if (col) col.list.push(r); else cols.push({ cx, list: [r] });
    }
    out.push(...cols.map((q) => q.list));
  }
  return out;
}
function seaExtra() {
  sheet('sb4', 'Seabed');
  const gs = load(path.join(SB, 'Ground_sand.png'));
  for (const r of blobs(gs, { gap: 1, minArea: 20 })) {
    const im = S.cut(gs, r), big = Math.max(r.w, r.h), c = colours(im);
    const k = r.x >= 350 && r.y >= 600 ? 'patch' : c.green > 0.25 ? 'tuft' : big >= 70 ? 'boulder' : big >= 24 ? 'rock' : 'debris';
    add('sb4', scaleTo(im, k === 'patch' ? 0.8 : 0.62), k, r.x + ',' + r.y);
  }
  sheet('sb5', 'Seabed');
  const rf = load(path.join(SB, '../Tiled_files/reef_elements.png'));
  for (const r of blobs(rf, { gap: 1, minArea: 10 })) add('sb5', scaleTo(S.cut(rf, r), 0.7), 'tuft', r.x + ',' + r.y);
  sheet('sb6', 'Seabed');
  const dt = load(path.join(SB, '../Tiled_files/Details.png'));
  for (const r of blobs(dt, { gap: 1, minArea: 6 })) add('sb6', scaleTo(S.cut(dt, r), 0.7), 'debris', r.x + ',' + r.y);
  sheet('sb7', 'Seabed');
  const bb = load(path.join(SB, '../Tiled_files/Bubbles.png'));
  for (const r of blobs(bb, { gap: 1, minArea: 9 })) add('sb7', scaleTo(S.cut(bb, r), 0.7), 'bubble', r.x + ',' + r.y);
}
function islandExtra() {
  for (const n of [1, 2]) {
    const wc = load(path.join(FI, 'Water_coasts' + n + '.png'));
    const parts = [[14, 14, 52, 52, 'pond'], [80, 15, 176, 66, 'lake'], [271, 15, 36, 33, 'pond'], [320, 16, 64, 32, 'pond'], [224, 61, 144, 20, 'shore']];
    parts.forEach(([x, y, w, h, k], i) => anim('fi_water' + n + '_' + i, wc, [0, 1, 2, 3, 4, 5].map((f) => [x - 1, y - 1 + f * 80, w + 2, h + 2]).filter((q) => q[1] + q[3] <= wc.h), 1.4, k, 4));
  }
  const wd = load(path.join(FI, 'water_detilazation.png'));
  columns(wd, [[0, 195], [195, 475], [475, 576]], 40).forEach((list, i) => {
    if (list.length < 2) return;
    const fw = Math.max(...list.map((r) => r.w)), fh = Math.max(...list.map((r) => r.h));
    anim('fi_ripple' + i, wd, list.map((r) => [Math.max(0, Math.round(r.x + r.w / 2 - fw / 2)), Math.max(0, Math.round(r.y + r.h / 2 - fh / 2)), fw, fh]), 1, 'ripple', 4);
  });
  sheet('fi4', 'Flying Islands');
  const ad = load(path.join(FI, 'Ground_grass_additional_tiles.png'));
  for (const r of blobs(ad, { gap: 1, minArea: 30 })) {
    const im = S.cut(ad, r), c = colours(im);
    add('fi4', grade(nearest(im, 1.4), [0.74, 0.76, 0.8], 0.15), r.y > 100 ? 'ladder' : r.h > 40 && r.w > 100 ? 'cliff' : c.green > 0.2 || c.blue > 0.2 ? 'tuft' : 'cliff', r.x + ',' + r.y);
  }
}

function packLands() {
  oldKits();
  seaExtra();
  islandExtra();
  undead();
  seabed();
  islands();
  tower();
  belly();
  return { img: out.img, meta: { sheets: out.sheets, anims: out.anims, kits: out.kits } };
}
module.exports = { packLands };

if (require.main === module) {
  const t0 = Date.now();
  const r = packLands();
  const { contact } = require('./contact');
  const dir = path.join(__dirname, 'out', 'lands');
  fs.mkdirSync(dir, { recursive: true });
  const legend = {};
  for (const [id, s] of Object.entries(r.meta.sheets)) {
    if (!s.kinds) continue;
    const list = Array.from({ length: s.n }, (_, i) => P.decode(Buffer.from(r.img['kit.' + id + '.' + i].split(',')[1], 'base64')));
    if (list.length) fs.writeFileSync(path.join(dir, id + '.png'), P.encode(contact(list)));
    const by = {};
    s.kinds.forEach((k) => (by[k] = (by[k] || 0) + 1));
    legend[id] = s.kinds.map((k, i) => [i, k, s.sizes[i], s.names[i]]);
    console.log(id.padEnd(5), String(s.n).padStart(4), JSON.stringify(by));
  }
  const an = Object.keys(r.meta.anims);
  const first = an.map((n) => P.decode(Buffer.from(r.img['anim.' + n + '.0'].split(',')[1], 'base64')));
  fs.writeFileSync(path.join(dir, 'anims.png'), P.encode(contact(first)));
  fs.writeFileSync(path.join(dir, 'anims.txt'), an.map((n, i) => i + ' ' + n + ' ' + JSON.stringify(r.meta.anims[n])).join('\n'));
  fs.writeFileSync(path.join(dir, 'legend.json'), JSON.stringify(legend));
  const tw = P.decode(Buffer.from(r.img['kit.ft_tower'].split(',')[1], 'base64'));
  fs.writeFileSync(path.join(dir, 'tower.png'), P.encode(tw));
  console.log('anims', an.length, ' tower', tw.w + 'x' + tw.h);
  // the bundle: merged into window.CH_ASSETS like the others, under meta.lands
  const js = '/* GENERATED by tools/pack-lands.js - do not edit. Bundle: lands */\n' +
    'window.CH_ASSETS=window.CH_ASSETS||{img:{},sfx:{},loops:{},music:{},meta:{}};(function(a,W){for(var k in a){W[k]=W[k]||{};for(var i in a[k])W[k][i]=a[k][i];}})(' +
    JSON.stringify({ img: r.img, meta: { lands: r.meta } }) + ',window.CH_ASSETS);\n';
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'bundle_lands.js'), js);
  console.log('images', Object.keys(r.img).length, (js.length / 1048576).toFixed(2) + ' MB, ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
}
