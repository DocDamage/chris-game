/* The kits added on 2026-10-23 (Creepy Forest, Frozen Kingdom, Haunted Victorian City) and the new NPCs, cut and
   packed (PLAN.md 18, K1), and the two packs of 2026-10-24 (Dungeon Asset Pack, Crimson Gothic Castle: PLAN.md 19, W1).
   docs/ASSET_PACKS.md catalogues every sheet; the rules below follow it.
     kit.<id>.<n>          a piece of sheet <id> (cf1..cf20, fk1..fk20, hv1..hv20, da1..da16, gc1..gc28), scaled for the
                           640x360 world; the newer packs also record each piece's prop kind (meta.kits[id].kinds)
     npc.<id>.<anim>.<d>   an NPC animation strip, d = e (facing east) or s (facing the camera)
   meta.kits[id] = { pack, sheet, name, n, roles: [role per piece], sizes: [[w, h] per piece], src: [[x, y, w, h]] }
   meta.npcs[id] = { fw, fh, anims: { anim: { e: frames, s: frames } } }
   Every sheet: slice into opaque blobs (tools/slice.js), drop the title banner and everything above its bottom edge,
   frames (wider or taller than 0.9 of the sheet), blobs inside another piece's box and the listed junk; apply the
   listed splits and merges; ground swatches are cropped inside their ragged border and resized to exactly 32 px;
   everything else is resized by its sheet's scale (area averaging, hard alpha: pack-walls.js resize).
   Usage: build-assets.js calls packKits(); `node tools/pack-kits.js` lists every sheet and writes contact sheets to
   tools/out/kits/ (one PNG per sheet, pieces in order, plus legend.json with each piece's index, role and size). */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./png');
const S = require('./slice');
const { resize } = require('./pack-walls');

const ROOT = path.resolve(__dirname, '..', 'assets');
const PACKS = {
  cf: { dir: 'tile sets/Creepy Forest/Creepy Forest Horror Megapack', name: 'Creepy Forest', band: 140 },
  fk: { dir: 'tile sets/Frozen Kingdom/Frozen Kingdom – Top-Down Pixel Art Asset Pack', name: 'Frozen Kingdom', band: 180 },
  hv: { dir: 'tile sets/Haunted Victorian City', name: 'Haunted Victorian City', band: 150 },
  // the packs of 2026-10-24: their files are listed (no numbered names); no title banners but on the first floor sheet
  da: { dir: 'tile sets/Dungeon Asset Pack', name: 'Dungeon Asset Pack', band: 0, files: ["Floor tiles!.png","wall tiles.png","special tiles.png","doors and arches.png","BLOOD AND GORE.png","Barrels, crates and sacks.png","Furniture and fixtures.png","Jars, pots and urns.png","Magical and occult.png","Pillars and columns.png","Traps and mechanism.png","Wall and floor details.png","lightning fx.png","miscellaneous props.png","skeletons and bones.png","statues and gargoyles.png"] },
  // the older packs' floor and wall sheets (PLAN.md 22): before, one 152 px crop of each floored its biome; now every
  // swatch is cut (floors) and every wall face (walls). Packed by tools/pack-lands.js into data/bundle_lands.js
  zs: { dir: 'tile sets/Zombie Apocalypse Survival Asset Pack', name: 'Zombie Apocalypse Survival', band: 0, lands: true, files: ['1. Cracked street tiles.png'] },
  wl: { dir: 'tile sets/WASTELAND SURVIVOR KIT Post-Apocalyptic', name: 'Wasteland Survivor Kit', band: 0, lands: true, files: ['1. Cracked contrete tiles.png', '2. Rusted metal floor tiles.png'] },
  vr: { dir: 'tile sets/Volcanic Ruins', name: 'Volcanic Ruins', band: 0, lands: true, files: ['1. Floor tiles.png', '2. wall tiles.png', '3. Lava tiles.png'] },
  ph: { dir: 'tile sets/Psychological Horror Dungeon', name: 'Psychological Horror Dungeon', band: 0, lands: true, files: ['Floor tiles and wall tiles.png', 'Wall tiles.png'] },
  gc: { dir: 'tile sets/Crimson Gothic Castle', name: 'Crimson Gothic Castle', band: 0, noBanner: true, files: ["Crimson Gothic Castle/Set 1 (1).png","Crimson Gothic Castle/Set 1 (2).png","Crimson Gothic Castle/Set 1 (3).png","Crimson Gothic Castle/Set 1 (4).png","Cimson Gothic Castle 2/Set 2 (4).png","Cimson Gothic Castle 2/Set 2 (5).png","Cimson Gothic Castle 2/Set 2 (6).png","Cimson Gothic Castle 2/Set 2 (7).png","Cimson Gothic Castle 2/Set 2 (8).png","Cimson Gothic Castle 2/Set 2 (9).png","Crimson Gothic Castle 3/Set 3 (1).png","Crimson Gothic Castle 3/Set 3 (2).png","Crimson Gothic Castle 3/Set 3 (3).png","Crimson Gothic Castle 3/Set 3 (4).png","Crimson Gothic Castle 3/Set 3 (5).png","Crimson Gothic Castle 3/Set 3 (6).png","Crimson Gothic Castle 4/set 4 (1).png","Crimson Gothic Castle 4/set 4 (2).png","Crimson Gothic Castle 4/set 4 (3).png","Crimson Gothic Castle 4/set 4 (4).png","Crimson Gothic Castle 4/set 4 (5).png","Crimson Gothic Castle 4/set 4 (6).png","Crimson Gothic Castle 5/Set 5 (1).png","Crimson Gothic Castle 5/Set 5 (2).png","Crimson Gothic Castle 5/Set 5 (3).png","Crimson Gothic Castle 5/Set 5 (4).png","Crimson Gothic Castle 5/Set 5 (5).png","Crimson Gothic Castle 5/Set 5 (6).png"] },
};
const box = (x0, x1, y0, y1) => [x0, y0, x1 - x0, y1 - y0]; // from "x0-x1 x y0-y1" in the catalogue

/* role: a role for every piece, or (r, sheet) => role from the piece's source box r = {x, y, w, h}.
   scale: source -> world; ground: crop this far inside each swatch and resize it to 32 x 32 (pieces too small or too
   long to be a swatch keep the sheet's scale and role `alt`). Options: gap, minArea, drop (boxes of junk), split
   ([box, y] -> two pieces), merge ([box, box] -> one), hand (only these boxes, no slicing), band (banner line). */
const big = (min, a, b) => (r) => (Math.max(r.w, r.h) >= min ? a : b);
const SHEETS = {
  // ---------------------------------------------------------------- Creepy Forest
  cf1: { role: 'ground', ground: 16, alt: 'solid', scale: 0.2 },
  cf2: { role: 'ground', ground: 12, alt: 'deco', scale: 0.25 },
  cf3: { role: 'path', scale: 0.22 },
  cf4: { role: (r) => (r.w > r.h * 1.4 || r.h < 120 ? 'solid' : 'gate'), scale: 0.25, gap: 3 },
  cf5: { role: (r) => (r.w < 160 && r.h > 140 ? 'gate' : 'wall'), scale: 0.27 },
  cf6: { role: 'roof', scale: 0.27 },
  cf7: { role: big(200, 'gate', 'deco'), scale: 0.14 },
  cf8: { role: big(240, 'solid', 'deco'), scale: 0.28 },
  cf9: { role: big(160, 'solid', 'deco'), scale: 0.25 },
  cf10: { role: (r) => (r.h < 60 ? 'deco' : 'solid'), scale: 0.2 },
  cf11: { role: 'solid', scale: 0.2, split: [[[1348, 512, 144, 324], 668]] },
  cf12: { role: 'decal', scale: 0.35, gap: 3, minArea: 150 },
  cf13: { role: 'light', scale: 0.22 },
  cf14: { role: (r) => (r.h > 140 ? 'solid' : 'deco'), scale: 0.22, drop: [[1368, 280, 148, 144]] }, // "WATCHERS NEARRY"
  cf15: { role: big(140, 'solid', 'decal'), scale: 0.2 },
  cf16: { role: 'solid', scale: 0.2 },
  cf17: { role: 'solid', scale: 0.25 },
  cf18: { role: 'solid', scale: 0.2 },
  cf19: { role: 'deco', scale: 0.18 },
  cf20: { role: 'gate', scale: 0.25 },
  // ---------------------------------------------------------------- Frozen Kingdom
  fk1: { role: 'ground', ground: 18, alt: 'deco', scale: 0.18 },
  fk2: { role: 'path', ground: 10, alt: 'path', scale: 0.25 },
  fk3: { role: 'water', ground: 20, alt: 'water', scale: 0.33 },
  fk4: { role: (r) => (r.w >= r.h * 0.95 ? 'cliff' : 'hazard'), scale: 0.33 }, // blocks are square, spikes tall
  fk5: { role: (r) => (r.w > 300 && r.h > 200 ? 'gate' : 'wall'), scale: 0.28 },
  fk6: { role: 'roof', scale: 0.3 },
  fk7: { role: big(200, 'solid', 'deco'), scale: 0.4 },
  fk8: { role: 'path', scale: 0.45 },
  fk9: { role: big(150, 'solid', 'deco'), scale: 0.25 },
  fk10: { role: 'solid', scale: 0.34 },
  fk11: { role: (r) => (r.h > r.w ? 'gate' : 'solid'), scale: 0.4 },
  fk12: { role: 'light', scale: 0.22 },
  fk13: { role: big(150, 'solid', 'deco'), scale: 0.36, merge: [[[1376, 696, 44, 52], [1428, 700, 48, 32]]] },
  fk14: { role: 'decal', scale: 0.42 },
  fk15: { role: 'solid', scale: 0.28 },
  fk16: { role: 'solid', scale: 0.4, drop: [[20, 16, 100, 136], [1460, 16, 56, 136]] },
  fk17: { role: 'solid', scale: 0.4 },
  fk18: {
    role: (r) => (r.h > 100 && r.w < 140 && r.y > 690 ? 'print' : 'particle'), scale: 0.12,
    hand: [
      box(96, 372, 192, 392), box(456, 712, 184, 392), box(348, 552, 448, 636), // flake scatters
      box(812, 924, 204, 356), box(984, 1160, 200, 392), [1216, 176, 228, 228], [80, 440, 196, 200], // flakes
      box(664, 752, 452, 640), [820, 484, 88, 88], box(992, 1072, 456, 640), box(1188, 1412, 464, 640), // flake groups
      [816, 676, 156, 152], box(816, 972, 856, 984), // rings
      [1132, 708, 84, 100], [1308, 724, 72, 68], [1264, 808, 72, 112], [1124, 884, 72, 84], [1352, 892, 68, 76], // puffs
      [96, 732, 82, 188], [178, 732, 82, 188], [220, 872, 116, 112], // trail 1: the touching pair cut in two, the third
      [428, 744, 74, 176], [502, 744, 74, 176], [596, 880, 112, 108], // trail 2
    ],
  },
  fk19: { role: 'solid', scale: 0.3 },
  fk20: { role: big(120, 'solid', 'deco'), scale: 0.28 },
  // ---------------------------------------------------------------- Haunted Victorian City
  hv1: { role: 'ground', ground: 12, alt: 'decal', scale: 0.27 },
  hv2: { role: 'path', ground: 12, alt: 'path', scale: 0.24 },
  hv3: { role: 'wall', scale: 0.28 },
  hv4: { role: 'roof', scale: 0.28 },
  hv5: { role: 'gate', scale: 0.28 },
  hv6: { role: 'deco', scale: 0.2 },
  hv7: { role: 'light', scale: 0.28 },
  hv8: { role: (r) => (r.h > r.w ? 'gate' : 'solid'), scale: 0.28 },
  hv9: { role: 'solid', scale: 0.38, drop: [[4, 700, 708, 236], [760, 924, 416, 12]] },
  hv10: { role: 'solid', scale: 0.18 },
  hv11: { role: big(200, 'gate', 'solid'), scale: 0.3, minArea: 120, drop: [[4, 4, 1664, 32], [4, 908, 196, 28], [224, 928, 72, 8], [1636, 872, 32, 64]] },
  hv12: { role: 'solid', scale: 0.3 },
  hv13: { role: 'solid', scale: 0.3 },
  hv14: { role: 'solid', scale: 0.24 },
  hv15: { role: big(100, 'deco', 'decal'), scale: 0.27, drop: [[8, 904, 48, 32]] },
  hv16: { role: (r) => (r.h > 200 ? 'solid' : 'deco'), scale: 0.2 },
  hv17: { role: big(200, 'solid', 'deco'), scale: 0.33 },
  hv18: { role: (r) => (r.w > 250 ? 'decal' : 'light'), scale: 0.22 },
  hv19: { role: (r) => (r.w > 200 && r.h > 120 ? 'solid' : 'decal'), scale: 0.28, minArea: 120 },
  hv20: { role: 'solid', scale: 0.28 },
  // ---------------------------------------------------------------- Dungeon Asset Pack (PLAN.md 19, W1): 1536x1024
  // sheets (skeletons 1254 square); kind: a prop kind per piece (js/props.js), from the row (source y) or the colour
  zs1: { role: 'ground', ground: 8, alt: 'decal', scale: 0.27, kind: 'plate' },
  wl1: { role: 'ground', ground: 8, alt: 'decal', scale: 0.27, kind: 'plate' },
  wl2: { role: 'ground', ground: 8, alt: 'decal', scale: 0.27, kind: 'plate' },
  vr1: { role: 'ground', ground: 8, alt: 'decal', scale: 0.27, kind: 'plate' },
  vr2: { role: 'wall', scale: 0.25, kind: (r) => (r.y > 600 ? 'block' : r.x > 1060 ? 'corner' : 'face') }, // wall faces, their corner turns, the junction blocks
  vr3: { role: 'ground', ground: 8, alt: 'decal', scale: 0.27, kind: 'lava' },
  ph1: { role: 'ground', ground: 8, alt: 'decal', scale: 0.27, kind: 'plate' },
  ph2: { role: 'wall', scale: 0.2, kind: 'face' },
  da1: { role: 'ground', ground: 8, alt: 'decal', scale: 0.27, kind: 'plate' },
  da2: { role: 'wall', scale: 0.27, noBanner: true, kind: (r) => (r.y > 430 && r.y < 610 ? 'door' : 'face') },
  da3: { role: 'solid', scale: 0.27, noBanner: true, kind: (r, c) => (r.y < 250 ? 'face' : r.y < 520 ? 'door' : r.y < 720 ? (c.orange > 0.06 ? 'brazier' : c.purple > 0.15 ? 'crystal' : 'trap') : c.fill < 0.6 ? 'decal' : 'pool') },
  da4: { role: 'gate', scale: 0.27, noBanner: true, kind: 'door' },
  da5: { role: 'decal', scale: 0.3, noBanner: true, kind: 'decal' },
  da6: { role: 'solid', scale: 0.22, noBanner: true, kind: (r) => (r.y > 760 ? 'pot' : r.y > 540 ? 'sack' : 'crate') },
  da7: { role: 'solid', scale: 0.24, noBanner: true, kind: (r, c) => (c.orange > 0.02 && r.w < 160 ? 'candles' : r.h > r.w * 1.3 ? 'shelf' : 'table') },
  da8: { role: 'solid', scale: 0.18, noBanner: true, kind: 'pot' },
  da9: { role: 'solid', scale: 0.22, noBanner: true, kind: (r, c) => (c.orange > 0.03 ? 'candles' : c.purple > 0.12 && c.fill < 0.45 ? 'decal' : r.w > 260 ? 'altar' : c.purple > 0.25 ? 'crystal' : 'item') },
  da10: { role: 'solid', scale: 0.27, noBanner: true, key: true, kind: 'pillar' },
  da11: { role: 'hazard', scale: 0.24, noBanner: true, kind: 'trap' },
  da12: { role: 'decal', scale: 0.24, noBanner: true, kind: (r, c) => (c.orange > 0.06 || c.blue > 0.2 ? 'torch' : c.fill < 0.55 && (c.red > 0.2 || c.green > 0.2 || c.purple > 0.2 || c.dark > 0.5) ? 'decal' : r.h > r.w * 1.6 ? 'hang' : r.y > 1040 ? 'bones' : 'debris') },
  da13: { role: 'light', scale: 0.22, noBanner: true, kind: (r) => (r.y < 320 ? 'lantern' : r.y > 720 ? 'crystal' : 'brazier') },
  da14: { role: 'solid', scale: 0.22, noBanner: true, kind: (r, c) => (c.orange > 0.04 ? 'candles' : r.h > r.w * 1.8 ? 'hang' : r.w > 300 ? 'table' : r.h > 260 ? 'cage' : 'bones') },
  da15: { role: 'decal', scale: 0.2, noBanner: true, kind: (r) => (r.y < 330 ? 'skeleton' : 'bones') },
  da16: { role: 'solid', scale: 0.3, noBanner: true, kind: 'statue' },
};
/* ---------------------------------------------------------------- Crimson Gothic Castle (PLAN.md 19, W1): 28 sheets of
   top-down castle modules (whole halls, stairs, carpets, lava, braziers, pillars, floor and wall pieces); the kind is
   read from each piece's shape and colour (classify below) */
GC_FILES().forEach((f, i) => { SHEETS['gc' + (i + 1)] = { role: 'solid', ground: 6, alt: 'solid', scale: /Set 1 \([123]\)/.test(f) ? 0.4 : /Set 1/.test(f) ? 0.3 : 0.27, kind: classify, minArea: 300 }; });
function GC_FILES() { return ["Crimson Gothic Castle/Set 1 (1).png","Crimson Gothic Castle/Set 1 (2).png","Crimson Gothic Castle/Set 1 (3).png","Crimson Gothic Castle/Set 1 (4).png","Cimson Gothic Castle 2/Set 2 (4).png","Cimson Gothic Castle 2/Set 2 (5).png","Cimson Gothic Castle 2/Set 2 (6).png","Cimson Gothic Castle 2/Set 2 (7).png","Cimson Gothic Castle 2/Set 2 (8).png","Cimson Gothic Castle 2/Set 2 (9).png","Crimson Gothic Castle 3/Set 3 (1).png","Crimson Gothic Castle 3/Set 3 (2).png","Crimson Gothic Castle 3/Set 3 (3).png","Crimson Gothic Castle 3/Set 3 (4).png","Crimson Gothic Castle 3/Set 3 (5).png","Crimson Gothic Castle 3/Set 3 (6).png","Crimson Gothic Castle 4/set 4 (1).png","Crimson Gothic Castle 4/set 4 (2).png","Crimson Gothic Castle 4/set 4 (3).png","Crimson Gothic Castle 4/set 4 (4).png","Crimson Gothic Castle 4/set 4 (5).png","Crimson Gothic Castle 4/set 4 (6).png","Crimson Gothic Castle 5/Set 5 (1).png","Crimson Gothic Castle 5/Set 5 (2).png","Crimson Gothic Castle 5/Set 5 (3).png","Crimson Gothic Castle 5/Set 5 (4).png","Crimson Gothic Castle 5/Set 5 (5).png","Crimson Gothic Castle 5/Set 5 (6).png"]; }
/* a castle piece's kind: fire -> brazier, lava -> lava, plants -> shrub, red runners -> rug, whole halls -> room (a floor
   set piece), tall narrow -> pillar, long strips -> wall, framed squares -> plate (a floor inlay), the rest -> block */
function classify(r, c) {
  const big2 = Math.max(r.w, r.h), asp = r.w / r.h;
  if (c.lava > 0.3 && c.fill > 0.8) return 'lava';
  if (c.orange > 0.05 && big2 < 300) return 'brazier';
  if (c.green > 0.35) return 'shrub';
  if (c.red > 0.3 && (asp > 2 || asp < 0.5)) return 'rug';
  if (asp > 2.4 && r.h < 130) return 'wall'; // long strips first: some are as long as a hall
  if (asp < 0.42 && r.w < 130) return 'pillar';
  if (big2 > 380) return 'room';
  if (asp < 0.45) return 'pillar';
  if (asp > 2.4) return 'wall';
  if (asp > 0.7 && asp < 1.4 && c.fill > 0.85) return 'plate';
  return 'block';
}

/* set pieces that want a bigger scale than their sheet (enterable crypts, portals, landmarks), packed again as
   kit.<name>; boxes from docs/ASSET_PACKS.md */
const EXTRAS = {
  cf_giant_tree: ['cf9', [956, 156, 368, 460], 0.3, 'solid'],
  cf_portal1: ['cf20', [72, 132, 264, 320], 0.3, 'gate'],
  cf_portal2: ['cf20', [56, 468, 288, 288], 0.3, 'gate'],
  cf_skull_gate: ['cf20', [656, 476, 336, 280], 0.3, 'gate'],
  cf_crypt_arch: ['cf10', [796, 412, 136, 124], 0.4, 'gate'],
  cf_cabin_door: ['cf5', [28, 900, 136, 148], 0.27, 'gate'],
  fk_gatehouse: ['fk5', [932, 732, 348, 228], 0.3, 'gate'],
  fk_portal: ['fk19', [748, 628, 196, 160], 0.36, 'gate'],
  fk_summon_circle: ['fk19', [712, 828, 200, 160], 0.4, 'decal'],
  fk_ice_gate: ['fk20', [752, 360, 140, 144], 0.4, 'gate'],
  hv_eye_portal: ['hv5', [520, 412, 196, 276], 0.3, 'gate'],
  hv_pentagram: ['hv18', [76, 660, 292, 224], 0.33, 'decal'],
  hv_skull_arch: ['hv20', [1316, 812, 196, 196], 0.4, 'gate'],
};

/* ------------------------------------------------------------------ helpers */
const sheetFile = (pack, n) => {
  const d = path.join(ROOT, PACKS[pack].dir);
  if (PACKS[pack].files) { const f = path.join(d, PACKS[pack].files[n - 1] || ''); return fs.existsSync(f) && PACKS[pack].files[n - 1] ? f : null; }
  const f = fs.readdirSync(d).find((x) => x.startsWith(n + '. ') && x.endsWith('.png'));
  return f ? path.join(d, f) : null;
};
const inside = (a, b, pad) => a.x >= b.x - pad && a.y >= b.y - pad && a.x + a.w <= b.x + b.w + pad && a.y + a.h <= b.y + b.h + pad;
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const R = (b) => ({ x: b[0], y: b[1], w: b[2], h: b[3] });
/* shrink a box to the opaque pixels inside it */
function tighten(img, r) {
  let x0 = r.x + r.w, y0 = r.y + r.h, x1 = -1, y1 = -1;
  for (let y = Math.max(0, r.y); y < Math.min(img.h, r.y + r.h); y++) for (let x = Math.max(0, r.x); x < Math.min(img.w, r.x + r.w); x++) {
    if (img.data[(y * img.w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
/* the pieces of one sheet, in reading order, junk removed */
function piecesOf(id, img) {
  const sp = SHEETS[id];
  if (sp.hand) return sp.hand.map((b) => tighten(img, R(b))).filter(Boolean);
  let c = S.components(img, { gap: sp.gap || 1, minArea: sp.minArea || 400 }).map((q) => ({ x: q.x, y: q.y, w: q.w, h: q.h }));
  // frames
  c = c.filter((q) => q.w < img.w * 0.9 && q.h < img.h * 0.9);
  // the title banner: the widest piece near the top; everything above its bottom edge goes with it
  const top = sp.noBanner || PACKS[id.slice(0, 2)].noBanner ? null : c.filter((q) => q.y < img.h * 0.2 && q.w > img.w * 0.35).sort((a, b) => b.w - a.w)[0];
  const band = Math.max(sp.band || 0, top ? top.y + top.h : PACKS[id.slice(0, 2)].band);
  c = c.filter((q) => q !== top && q.y + q.h > band + 2);
  // junk by box, splits, merges
  for (const d of sp.drop || []) c = c.filter((q) => !overlaps(q, R(d)) || q.w * q.h > R(d).w * R(d).h * 4);
  for (const [b, at] of sp.split || []) {
    const i = c.findIndex((q) => overlaps(q, R(b)));
    if (i < 0) continue;
    const q = c[i];
    const a = tighten(img, { x: q.x, y: q.y, w: q.w, h: at - q.y }), z = tighten(img, { x: q.x, y: at, w: q.w, h: q.y + q.h - at });
    c.splice(i, 1, ...[a, z].filter(Boolean));
  }
  for (const [b1, b2] of sp.merge || []) {
    const i = c.findIndex((q) => overlaps(q, R(b1))), j = c.findIndex((q) => overlaps(q, R(b2)));
    if (i < 0 || j < 0 || i === j) continue;
    const a = c[i], z = c[j];
    const u = { x: Math.min(a.x, z.x), y: Math.min(a.y, z.y) };
    u.w = Math.max(a.x + a.w, z.x + z.w) - u.x;
    u.h = Math.max(a.y + a.h, z.y + z.h) - u.y;
    c = c.filter((_, k) => k !== i && k !== j).concat([u]);
  }
  // blobs inside another piece's box (sparks, sigil centres)
  c = c.filter((q) => !c.some((o) => o !== q && o.w * o.h > q.w * q.h && inside(q, o, 2)));
  // reading order: rows of similar y, then x
  c.sort((a, b) => (Math.abs(a.y - b.y) < 40 ? a.x - b.x : a.y - b.y));
  return c;
}
/* a sheet painted on an opaque black ground (Dungeon Asset Pack: pillars): the near-black pixels joined to the border
   become transparent (a flood fill, so the dark outlines inside a piece stay) */
function keyBlack(img) {
  const { w, h, data } = img, seen = new Uint8Array(w * h), st = [];
  const dark = (i) => data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2] < 40;
  for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
  while (st.length) {
    const i = st.pop();
    if (seen[i] || !dark(i)) continue;
    seen[i] = 1;
    data[i * 4 + 3] = 0;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) st.push(i - 1);
    if (x < w - 1) st.push(i + 1);
    if (y > 0) st.push(i - w);
    if (y < h - 1) st.push(i + w);
  }
  return img;
}
/* colour shares of a piece (opaque pixels): bright orange fire, lava, red, green, blue, purple, near-black; fill share */
function colours(img, r) {
  let n = 0, o = 0, orange = 0, lava = 0, red = 0, green = 0, blue = 0, purple = 0, dark = 0;
  for (let y = r.y; y < r.y + r.h; y += 2) for (let x = r.x; x < r.x + r.w; x += 2) {
    const i = (y * img.w + x) * 4, a = img.data[i + 3];
    n++;
    if (a < 120) continue;
    o++;
    const R2 = img.data[i], G2 = img.data[i + 1], B2 = img.data[i + 2];
    if (R2 > 200 && G2 > 110 && B2 < 90) lava++;
    if (R2 > 220 && G2 > 140 && B2 < 120) orange++;
    else if (R2 > 130 && G2 < 70 && B2 < 70) red++;
    if (G2 > R2 + 18 && G2 > B2 + 18) green++;
    if (B2 > R2 + 30 && B2 > G2 + 10) blue++;
    if (R2 > 80 && B2 > 100 && G2 < R2 - 20 && G2 < B2 - 20) purple++;
    if (R2 + G2 + B2 < 70) dark++;
  }
  const q = Math.max(1, o);
  return { orange: orange / q, lava: lava / q, red: red / q, green: green / q, blue: blue / q, purple: purple / q, dark: dark / q, fill: o / Math.max(1, n) };
}
/* hard alpha after scaling: faint and soft edge pixels go */
function hardAlpha(im) {
  for (let i = 3; i < im.data.length; i += 4) im.data[i] = im.data[i] <= 40 ? 0 : 255;
  return im;
}
/* a ground swatch: big, roughly square, and the square cropped inside its border fully painted (an edge piece with a
   corner missing, a boulder or a statue on a square is not a floor) */
function isSwatch(img, r, inset) {
  if (Math.min(r.w, r.h) < 90 || Math.max(r.w, r.h) / Math.min(r.w, r.h) > 1.7) return false;
  const w = r.w - inset * 2, h = r.h - inset * 2, sq = Math.min(w, h), x0 = r.x + inset + Math.floor((w - sq) / 2), y0 = r.y + inset + Math.floor((h - sq) / 2);
  let on = 0;
  for (let y = y0; y < y0 + sq; y++) for (let x = x0; x < x0 + sq; x++) if (img.data[(y * img.w + x) * 4 + 3] > 200) on++;
  return on >= sq * sq * 0.97;
}
/* a ground swatch: crop inside its ragged border, then the middle square, resized to 32 x 32 (fully opaque) */
function swatch(img, r, inset) {
  const x = r.x + inset, y = r.y + inset, w = r.w - inset * 2, h = r.h - inset * 2, s = Math.min(w, h);
  const sq = P.crop(img, x + Math.floor((w - s) / 2), y + Math.floor((h - s) / 2), s, s);
  const out = resize(sq, 32, 32);
  for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255; // a floor has no holes
  // fill any pixel the average left empty with its left neighbour (outline specks inside the crop)
  return out;
}
const png64 = (im) => 'data:image/png;base64,' + P.encode(im).toString('base64');

/* ------------------------------------------------------------------ tiles and props */
function packSheet(id) {
  const sp = SHEETS[id];
  const f = sheetFile(id.slice(0, 2), +id.slice(2));
  if (!f) return null;
  let img = P.decode(fs.readFileSync(f));
  if (sp.key) img = keyBlack(img);
  const pieces = piecesOf(id, img);
  const out = { pack: PACKS[id.slice(0, 2)].name, sheet: +id.slice(2), name: path.basename(f, '.png').replace(/^\d+\. /, ''), n: 0, roles: [], sizes: [], src: [], images: [], kinds: sp.kind ? [] : null };
  for (const r of pieces) {
    let role = typeof sp.role === 'function' ? sp.role(r) : sp.role;
    let im, kind = null;
    if (sp.ground && isSwatch(img, r, sp.ground)) { im = swatch(img, r, sp.ground); kind = 'ground'; }
    else {
      if (sp.kind) kind = typeof sp.kind === 'function' ? sp.kind(r, colours(img, r)) : sp.kind;
      if (sp.ground) role = sp.alt || role;
      const w = Math.max(4, Math.round(r.w * sp.scale)), h = Math.max(4, Math.round(r.h * sp.scale));
      im = hardAlpha(resize(S.cut(img, r), w, h));
    }
    if (!P.bounds(im)) continue; // nothing left after scaling
    out.images.push(im);
    if (out.kinds) {
      out.kinds.push(kind);
      role = kind === 'ground' ? 'ground' : ['decal', 'room', 'rug', 'plate', 'lava', 'pool', 'bones', 'skeleton', 'debris'].includes(kind) ? 'decal' : ['brazier', 'lantern', 'torch', 'candles', 'crystal'].includes(kind) ? 'light' : kind === 'door' ? 'gate' : kind === 'face' || kind === 'wall' ? 'wall' : 'solid';
    }
    out.roles.push(role);
    out.sizes.push([im.w, im.h]);
    out.src.push([r.x, r.y, r.w, r.h]);
  }
  out.n = out.images.length;
  return out;
}

/* ------------------------------------------------------------------ NPCs */
/* id: folder, scale per source frame size (the figures should stand about as tall as the heroes, ~33 px), and which
   animation folders to keep (name -> folder prefix) */
const NPCS = {
  nurse: { dir: 'Retro_Nurse_Sprite/Idle/animations', scale: { 48: 0.75 }, anims: { idle: 'Breathing_Idle', walk: 'Walk', run: 'Running', heal: 'Heal_Animation', hurt: 'Taking_Punch', death: 'Death', pick: 'Picking_Up' } },
  doctor: { dir: 'Doctor_Sprite/Idle/animations', scale: { 48: 0.75 }, anims: { idle: 'Breathing_Idle', walk: 'Walk', run: 'Running', heal: 'Heal_Animations', hurt: 'Taking_Punch', death: 'Falls_to_his_knees', pick: 'Picking_Up' } },
  jesus: { dir: 'Jesus_Christ/Idle/animations', scale: { 32: 1.3, 48: 1.3 }, anims: { idle: 'Breathing_Idle', walk: 'Walking', run: 'full_sprinting', bless: 'Bless', jump: 'Jumping', hurt: 'Taking_Hit', death: 'Death' } },
  lucifer: { dir: 'Lucifer/animations', scale: { 160: 0.55 }, anims: { idle: 'Breathing_Idle', walk: 'Walking', fly: 'Fly', magic: 'Dark_Magic', hellfire: 'Hellfire', throw: 'Throw', pick: 'Picking_Up_Item', hurt: 'Taking_Punch', death: 'Death' } },
};
const CULT = [1, 2, 3, 4];
const CULT_ANIMS = ['idle', 'walk', 'pray', 'attack'];
const CULT_SCALE = 0.55;

function flipH(im) {
  const o = P.blank(im.w, im.h);
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) im.data.copy(o.data, (y * im.w + (im.w - 1 - x)) * 4, (y * im.w + x) * 4, (y * im.w + x) * 4 + 4);
  return o;
}
/* frames of one animation folder for one view: e = east (or west mirrored), s = south */
function framesOf(dir, view) {
  const subs = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  let side = view === 'e' ? subs.find((s) => s === 'east') : subs.find((s) => s === 'south');
  let flip = false;
  if (!side && view === 'e') { side = subs.find((s) => s === 'west'); flip = !!side; }
  if (!side) side = view === 'e' ? subs.find((s) => s.includes('east')) : subs.find((s) => s.includes('south'));
  if (!side) return null;
  const sd = path.join(dir, side);
  return fs.readdirSync(sd).filter((f) => /\.png$/i.test(f)).sort().map((f) => {
    const im = P.decode(fs.readFileSync(path.join(sd, f)));
    return flip ? flipH(im) : im;
  });
}
/* scale every frame by its source size, centre them on one canvas, crop to the union and lay out strips */
function packFrames(groups, scaleOf) {
  const scaled = {};
  let S2 = 0;
  for (const [k, fr] of Object.entries(groups)) {
    scaled[k] = fr.map((im) => P.downscale(im, scaleOf(im), 0.45));
    for (const im of scaled[k]) S2 = Math.max(S2, im.w, im.h);
  }
  let ux0 = S2, uy0 = S2, ux1 = -1, uy1 = -1;
  const centred = {};
  for (const [k, fr] of Object.entries(scaled)) {
    centred[k] = fr.map((im) => {
      const c = P.blank(S2, S2);
      // bottoms aligned: the feet stay on one line whatever the source frame size
      P.blit(c, im, Math.floor((S2 - im.w) / 2), S2 - im.h);
      const b = P.bounds(c);
      if (b) { ux0 = Math.min(ux0, b.x0); uy0 = Math.min(uy0, b.y0); ux1 = Math.max(ux1, b.x1); uy1 = Math.max(uy1, b.y1); }
      return c;
    });
  }
  const fw = ux1 - ux0 + 1, fh = uy1 - uy0 + 1;
  const strips = {};
  for (const [k, fr] of Object.entries(centred)) {
    const strip = P.blank(fw * fr.length, fh);
    fr.forEach((c, i) => P.blit(strip, hardAlpha(P.crop(c, ux0, uy0, fw, fh)), i * fw, 0));
    strips[k] = { im: strip, n: fr.length };
  }
  return { strips, fw, fh };
}
function packNpcs() {
  const img = {}, meta = {};
  for (const [id, d] of Object.entries(NPCS)) {
    const root = path.join(ROOT, 'NPCs', d.dir);
    if (!fs.existsSync(root)) continue;
    const names = fs.readdirSync(root);
    const groups = {};
    for (const [anim, pre] of Object.entries(d.anims)) {
      const n = names.filter((x) => x.startsWith(pre)).sort((a, b) => a.length - b.length)[0];
      if (!n) { console.warn('  ! npc ' + id + ': no folder for ' + anim); continue; }
      for (const view of ['e', 's']) {
        const fr = framesOf(path.join(root, n), view);
        if (fr && fr.length) groups[anim + '.' + view] = fr;
      }
    }
    const r = packFrames(groups, (im) => d.scale[im.w] || d.scale[Object.keys(d.scale)[0]]);
    meta[id] = { fw: r.fw, fh: r.fh, anims: {} };
    for (const [k, st] of Object.entries(r.strips)) {
      img['npc.' + id + '.' + k] = png64(st.im);
      const [anim, view] = k.split('.');
      (meta[id].anims[anim] = meta[id].anims[anim] || {})[view] = st.n;
    }
  }
  // the cult: four members, side-view strips of 9 frames of 64 px
  for (const m of CULT) {
    const groups = {};
    for (const a of CULT_ANIMS) {
      const f = path.join(ROOT, 'NPCs', 'Animated Cult NPCs', 'Cult_member_' + m + '_' + a + '_strip9.png');
      if (!fs.existsSync(f)) continue;
      const sheet = P.decode(fs.readFileSync(f));
      groups[a + '.e'] = Array.from({ length: 9 }, (_, i) => P.crop(sheet, i * 64, 0, 64, 64));
    }
    if (!Object.keys(groups).length) continue;
    const r = packFrames(groups, () => CULT_SCALE);
    const id = 'cult' + m;
    meta[id] = { fw: r.fw, fh: r.fh, anims: {} };
    for (const [k, st] of Object.entries(r.strips)) {
      img['npc.' + id + '.' + k] = png64(st.im);
      meta[id].anims[k.split('.')[0]] = { e: st.n };
    }
  }
  return { img, meta };
}

/* ------------------------------------------------------------------ everything */
function packKits() {
  const img = {}, meta = {};
  const cache = {};
  for (const id of Object.keys(SHEETS)) {
    if (PACKS[id.slice(0, 2)].lands) continue; // packed into bundle_lands by tools/pack-lands.js
    const r = packSheet(id);
    if (!r) { console.warn('  ! kit sheet missing: ' + id); continue; }
    r.images.forEach((im, i) => { img['kit.' + id + '.' + i] = png64(im); });
    meta[id] = { pack: r.pack, sheet: r.sheet, name: r.name, n: r.n, roles: r.roles, sizes: r.sizes, src: r.src };
    if (r.kinds) meta[id].kinds = r.kinds;
    cache[id] = r;
  }
  const extras = {};
  for (const [name, [id, b, scale, role]] of Object.entries(EXTRAS)) {
    const f = sheetFile(id.slice(0, 2), +id.slice(2));
    if (!f) continue;
    const src = P.decode(fs.readFileSync(f));
    const r = tighten(src, R(b));
    if (!r) continue;
    const im = hardAlpha(resize(S.cut(src, r), Math.round(r.w * scale), Math.round(r.h * scale)));
    img['kit.' + name] = png64(im);
    extras[name] = { sheet: id, role, size: [im.w, im.h] };
  }
  meta._extras = extras;
  const npc = packNpcs();
  Object.assign(img, npc.img);
  return { img, meta, npcs: npc.meta, cache };
}

/* a contact sheet of one sheet's pieces on a grey ground, in order, 2x, one cell per piece */
function contact(r) {
  const cell = Math.max(48, ...r.sizes.map(([w, h]) => Math.max(w, h))) + 6, cols = Math.max(1, Math.min(12, Math.ceil(Math.sqrt(r.n * 1.6))));
  const rows = Math.ceil(r.n / cols);
  const out = P.blank(cols * cell * 2, rows * cell * 2);
  for (let i = 0; i < out.data.length; i += 4) { out.data[i] = 70; out.data[i + 1] = 72; out.data[i + 2] = 80; out.data[i + 3] = 255; }
  r.images.forEach((im, i) => {
    const big2 = P.blank(im.w * 2, im.h * 2);
    for (let y = 0; y < big2.h; y++) for (let x = 0; x < big2.w; x++) im.data.copy(big2.data, (y * big2.w + x) * 4, (((y / 2) | 0) * im.w + ((x / 2) | 0)) * 4, (((y / 2) | 0) * im.w + ((x / 2) | 0)) * 4 + 4);
    const cx = (i % cols) * cell * 2, cy = ((i / cols) | 0) * cell * 2;
    // a lighter tile marks the cell
    for (let y = 2; y < cell * 2 - 2; y++) for (let x = 2; x < cell * 2 - 2; x++) { const o = ((cy + y) * out.w + cx + x) * 4; out.data[o] = 92; out.data[o + 1] = 94; out.data[o + 2] = 104; }
    const ox = cx + Math.floor((cell * 2 - big2.w) / 2), oy = cy + Math.floor((cell * 2 - big2.h) / 2);
    for (let y = 0; y < big2.h; y++) for (let x = 0; x < big2.w; x++) { const i = (y * big2.w + x) * 4; if (big2.data[i + 3]) big2.data.copy(out.data, ((oy + y) * out.w + ox + x) * 4, i, i + 4); }
  });
  return out;
}

module.exports = { packKits, packNpcs, packSheet, SHEETS, EXTRAS, NPCS, PACKS, piecesOf, sheetFile };

const KINDS = {};
if (require.main === module) {
  const t0 = Date.now();
  const r = packKits();
  const dir = path.join(__dirname, 'out', 'kits');
  fs.mkdirSync(dir, { recursive: true });
  const legend = {};
  for (const [id, s] of Object.entries(r.cache)) {
    fs.writeFileSync(path.join(dir, id + '.png'), P.encode(contact(s)));
    const roles = {};
    s.roles.forEach((x) => (roles[x] = (roles[x] || 0) + 1));
    legend[id] = s.roles.map((x, i) => [i, x, s.sizes[i]].concat(s.kinds ? [s.kinds[i]] : []));
    console.log(id.padEnd(5), String(s.n).padStart(3), 'pieces', JSON.stringify(roles), '-', s.name);
    if (s.kinds) { // one contact sheet per kind, to check the classifier by eye
      const by = {};
      s.kinds.forEach((k, i) => (by[k] = by[k] || []).push(i));
      for (const [k, idx] of Object.entries(by)) (KINDS[k] = KINDS[k] || []).push(...idx.map((i) => [id, i, s]));
    }
  }
  fs.writeFileSync(path.join(dir, 'legend.json'), JSON.stringify(legend));
  for (const [k, list] of Object.entries(KINDS)) {
    for (const pack of ['da', 'gc']) {
      const l = list.filter(([id]) => id.startsWith(pack));
      if (!l.length) continue;
      const s = { n: l.length, images: l.map(([, i, q]) => q.images[i]), sizes: l.map(([, i, q]) => q.sizes[i]) };
      fs.writeFileSync(path.join(dir, 'kind_' + pack + '_' + k + '.png'), P.encode(contact(s)));
      console.log('  kind', pack, k.padEnd(10), l.length);
    }
  }
  // the NPC strips, 3x, for a look
  for (const [k, url] of Object.entries(r.img)) {
    if (!k.startsWith('npc.')) continue;
    const im = P.decode(Buffer.from(url.split(',')[1], 'base64'));
    const big3 = P.blank(im.w * 3, im.h * 3);
    for (let y = 0; y < big3.h; y++) for (let x = 0; x < big3.w; x++) im.data.copy(big3.data, (y * big3.w + x) * 4, (((y / 3) | 0) * im.w + ((x / 3) | 0)) * 4, (((y / 3) | 0) * im.w + ((x / 3) | 0)) * 4 + 4);
    fs.writeFileSync(path.join(dir, k.split('.').join('_') + '.png'), P.encode(big3));
  }
  console.log('extras:', Object.keys(r.meta._extras).length, ' npcs:', Object.entries(r.npcs).map(([k, v]) => k + ' ' + v.fw + 'x' + v.fh + ' ' + Object.keys(v.anims).join('/')).join(', '));
  const bytes = Object.values(r.img).reduce((n, s) => n + s.length, 0);
  console.log('images', Object.keys(r.img).length, (bytes / 1048576).toFixed(2), 'MB of data URLs,', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
}
