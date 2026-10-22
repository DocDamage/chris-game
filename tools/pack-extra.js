'use strict';
/* Packs the remaining art packs into the asset bundle:
   - boss-monster-game-sprites (Treant, Moss Golem, Skull Knight, Yeti / Ice Golem)
   - End Bosses (Daddy, the Skull King - assembled from its layers)
   - Dragon_2 / Dragon_3, Beholder2 / Beholder3, the three Golems
   - enemy variants (plants, slimes, orcs, goblins, spiders)
   - mob drops (367 loot icons) and power ups (650 item icons) */
const fs = require('fs');
const path = require('path');
const P = require('./png');

const ROOT = path.resolve(__dirname, '..');
const A = path.join(ROOT, 'assets');
const b64 = (buf) => 'data:image/png;base64,' + buf.toString('base64');
const rd = (f) => P.decode(fs.readFileSync(f));

/* alpha-over composite of src onto dst at (dx, dy) */
function over(dst, src, dx, dy, flip) {
  for (let y = 0; y < src.h; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= dst.h) continue;
    for (let x = 0; x < src.w; x++) {
      const tx = (flip ? dx + src.w - 1 - x : dx + x);
      if (tx < 0 || tx >= dst.w) continue;
      const o = (y * src.w + x) * 4;
      const a = src.data[o + 3] / 255;
      if (!a) continue;
      const q = (ty * dst.w + tx) * 4;
      const da = dst.data[q + 3] / 255;
      const oa = a + da * (1 - a);
      for (let c = 0; c < 3; c++) dst.data[q + c] = Math.round((src.data[o + c] * a + dst.data[q + c] * da * (1 - a)) / (oa || 1));
      dst.data[q + 3] = Math.round(oa * 255);
    }
  }
}

/* union bounds of many images */
function unionBounds(imgs) {
  let u = null;
  for (const im of imgs) {
    const b = P.bounds(im, 8);
    if (!b) continue;
    u = u ? { x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) } : b;
  }
  return u;
}

/* lay frames out in one horizontal strip */
function strip(frames) {
  const w = frames[0].w;
  const h = frames[0].h;
  const out = P.blank(w * frames.length, h);
  frames.forEach((f, i) => P.blit(out, f, i * w, 0));
  return out;
}

const subsample = (arr, max) => {
  if (arr.length <= max) return arr;
  const out = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor((i * arr.length) / max)]);
  return out;
};

function packExtra() {
  const img = {};
  const meta = { enemies: {}, bosses: {} };
  const put = (key, im) => {
    img[key] = b64(P.encode(im));
  };

  /* ---------------------------------------------------------------- boss-monster-game-sprites */
  const BMS = path.join(A, 'bosses', 'boss-monster-game-sprites');
  /* anim name -> file prefix. boss4 has a second form ("specialty": the Ice Golem) with its own set */
  const bmsSets = {
    treant: { dir: 'boss_1', maxH: 128, anims: { idle: '0_boss_idle', walk: '0_boss_walk', run: '0_boss_run', attack: '0_boss_attack', jump: '0_boss_jump', spec1: '0_boss_specialty_1', spec2: '0_boss_specialty_2', hurt: '0_boss_hurt', death: '0_boss_die' }, path: '0_path_path' },
    moss: { dir: 'boss_2', maxH: 128, anims: { idle: '0_boss_idle', walk: '0_boss_walk', run: '0_boss_run', attack: '0_boss_attack', jump: '0_boss_jump', spec1: '0_boss_specialty', spec2: '0_boss_specialty_2', hurt: '0_boss_hurt', death: '0_boss_die' } },
    knight: { dir: 'boss_3', maxH: 128, anims: { idle: '0_boss_idle', walk: '0_boss_walk', run: '0_boss_run', attack: '0_boss_attack', jump: '0_boss_jump', spec1: '0_boss_specialty', spec2: '0_boss_specialty_2', hurt: '0_boss_hurt', death: '0_boss_die' }, path: '0_path_path' },
    yeti: {
      dir: 'boss_4', maxH: 128,
      anims: { idle: '0_boss_idle', walk: '0_boss_walk', run: '0_boss_run', attack: '0_boss_attack', jump: '0_boss_jump', spec1: '0_boss_specialty', hurt: '0_boss_hurt', death: '0_boss_die', g_idle: '0_specialty_idle', g_walk: '0_specialty_walk', g_attack: '0_specialty_attack', g_hurt: '0_specialty_hurt', g_death: '0_specialty_die' },
      path: '0_path_path',
    },
  };
  for (const kind of Object.keys(bmsSets)) {
    const set = bmsSets[kind];
    const dir = path.join(BMS, set.dir, 'PNG');
    const files = fs.readdirSync(dir);
    const frames = {};
    for (const an of Object.keys(set.anims)) {
      const pre = set.anims[an] + '_';
      const list = files.filter((f) => f.startsWith(pre) && /^\d+\.png$/.test(f.slice(pre.length))).sort();
      if (!list.length) continue;
      frames[an] = subsample(list, 8).map((f) => rd(path.join(dir, f)));
    }
    if (set.path) {
      const list = files.filter((f) => f.startsWith(set.path + '_')).sort();
      if (list.length) frames.path = subsample(list, 8).map((f) => rd(path.join(dir, f)));
    }
    const all = [];
    for (const an of Object.keys(frames)) if (an !== 'path') all.push(...frames[an]);
    const u = unionBounds(all);
    const pad = 4;
    const cw = u.x1 - u.x0 + 1 + pad * 2;
    const ch = u.y1 - u.y0 + 1 + pad * 2;
    const f = Math.min(0.5, set.maxH / ch);
    for (const an of Object.keys(frames)) {
      const cropped = frames[an].map((im) => (an === 'path' ? P.downscale(P.crop(im, u.x0 - pad, u.y0 - pad, cw, ch), f) : P.downscale(P.crop(im, u.x0 - pad, u.y0 - pad, cw, ch), f)));
      put('boss.' + kind + '.' + an, strip(cropped));
    }
    meta.bosses[kind] = { fw: Math.round(cw * f), fh: Math.round(ch * f), frames: Object.fromEntries(Object.keys(frames).map((an) => [an, frames[an].length])) };
    console.log('  bms', kind, 'cell', meta.bosses[kind].fw + 'x' + meta.bosses[kind].fh, 'scale', f.toFixed(3));
  }

  /* ---------------------------------------------------------------- Daddy (vertical strips) */
  {
    const D = path.join(A, 'bosses', 'End Bosses', 'Daddy', 'Daddy');
    const defs = { walk: ['Walk.png', 180, 9], shoot: ['Shoot.png', 176, 8], charged: ['Charged.png', 176, 8], charged2: ['Charhedv2.png', 176, 8], scream: ['Scream.png', 176, 24] };
    const frames = {};
    for (const an of Object.keys(defs)) {
      const [file, fh, n] = defs[an];
      const sheet = rd(path.join(D, file));
      const list = [];
      for (let i = 0; i < n; i++) list.push(P.crop(sheet, 0, i * fh, sheet.w, fh));
      frames[an] = an === 'scream' ? subsample(list, 12) : list;
    }
    const CW = 176;
    const CH_ = 180;
    const placed = {};
    for (const an of Object.keys(frames)) {
      placed[an] = frames[an].map((fr) => {
        const c = P.blank(CW, CH_);
        P.blit(c, fr, Math.floor((CW - fr.w) / 2), CH_ - fr.h);
        return c;
      });
    }
    const u = unionBounds([].concat(...Object.values(placed)));
    const pad = 2;
    const cw = u.x1 - u.x0 + 1 + pad * 2;
    const chh = u.y1 - u.y0 + 1 + pad * 2;
    const f = 0.62;
    for (const an of Object.keys(placed)) put('boss.daddy.' + an, strip(placed[an].map((im) => P.downscale(P.crop(im, u.x0 - pad, u.y0 - pad, cw, chh), f))));
    // the idle pose is the first walk frame; the pack has no hurt/death strips, so those reuse scream / charged frames
    meta.bosses.daddy = { fw: Math.round(cw * f), fh: Math.round(chh * f) };
    console.log('  daddy cell', meta.bosses.daddy.fw + 'x' + meta.bosses.daddy.fh);
  }

  /* ---------------------------------------------------------------- Skull King (assembled from its layers) */
  {
    const K = path.join(A, 'bosses', 'End Bosses', 'Skull');
    const L = (n) => rd(path.join(K, n + '.png'));
    const lay = {};
    for (const f of fs.readdirSync(K)) if (f.endsWith('.png')) lay[f.slice(0, -4)] = L(f.slice(0, -4));
    const fr = (img, i, w) => P.crop(img, i * w, 0, w, img.h);
    const CW = 240;
    const CH_ = 150;
    const HX = 72;
    const HY = 30;
    const BEHIND = ['hornll', 'hornrr', 'hornl', 'hornr', 'hornm'];
    const JAW = ['jaw', 'goldtoothl', 'goldtoothr'];
    const FACE = ['earingl', 'earingr', 'noseringl', 'noseringr', 'nosechainl', 'nosechainr', 'facering', 'faceringholders', 'faceringholders2', 'beads', 'gems', 'symbol', 'thintiara', 'shinytiara', 'warriorcrown', 'crown', 'eyegemsl', 'eyegemsr'];
    // per-layer drift directions for the death break-up
    const DRIFT = { hornll: [-1, -0.8], hornrr: [1, -0.8], hornl: [-0.6, -1], hornr: [0.6, -1], hornm: [0, -1.2], crown: [0, -1.4], warriorcrown: [0.2, -1.5], shinytiara: [-0.2, -1.3], thintiara: [0, -1.1], jaw: [0, 1.4], goldtoothl: [-0.3, 1.5], goldtoothr: [0.3, 1.5], skull: [0, 0.3], skullsection: [0, 0.2], beads: [0, 0.8], gems: [0.5, 0.6], symbol: [0, -0.3], facering: [0, 0.7], earingl: [-1.3, 0.4], earingr: [1.3, 0.4], noseringl: [-0.5, 0.6], noseringr: [0.5, 0.6], nosechainl: [-0.4, 1], nosechainr: [0.4, 1], faceringholders: [0, 0.6], faceringholders2: [0, 0.6], eyegemsl: [-0.7, 0.2], eyegemsr: [0.7, 0.2] };
    const handBack = lay.hand_back;
    const handFront = lay.hand_front;
    /* o: {dy, jaw (px), eye 0..8, blink 0..7 | -1, angry 0..2 | -1, handL:{x,y}, handR:{x,y}, drift 0..1, inner (use skullsection), flash} */
    function pose(o) {
      const c = P.blank(CW, CH_);
      const dr = o.drift || 0;
      const place = (name, extraY, extraX, over_) => {
        const im = over_ || lay[name];
        let dx = HX + (extraX || 0);
        let dy = HY + (o.dy || 0) + (extraY || 0);
        if (dr) {
          const d = DRIFT[name] || [0, 0.5];
          dx += d[0] * dr * 55;
          dy += d[1] * dr * 40 + dr * dr * 50;
        }
        over(c, im, Math.round(dx), Math.round(dy));
      };
      const hand = (h, flip, back) => {
        if (!h) return;
        const im = back ? handBack : handFront;
        let x = h.x;
        let y = h.y;
        if (dr) {
          x += (flip ? 1 : -1) * dr * 70;
          y += dr * dr * 70;
        }
        over(c, im, Math.round(x), Math.round(y), flip);
      };
      hand(o.handL, false, true);
      hand(o.handR, true, true);
      for (const n of BEHIND) place(n);
      place(o.inner ? 'skullsection' : 'skull');
      const eyeI = o.eye || 0;
      if (o.angry >= 0 && o.angry !== undefined) {
        place('swoleneye_l', 0, 0, fr(lay.swoleneye_l, o.angry, 96));
        place('swoleneye_r', 0, 0, fr(lay.swoleneye_r, o.angry, 96));
      } else {
        place('eye_l', 0, 0, fr(lay.eye_l, eyeI, 96));
        place('eye_r', 0, 0, fr(lay.eye_r, eyeI, 96));
        if (o.blink >= 0 && o.blink !== undefined) {
          place('eyelid_l', 0, 0, fr(lay.eyelid_l, o.blink, 96));
          place('eyelid_r', 0, 0, fr(lay.eyelid_r, o.blink, 96));
        }
      }
      for (const n of JAW) place(n, o.jaw || 0);
      for (const n of FACE) place(n);
      hand(o.handL, false, false);
      hand(o.handR, true, false);
      return c;
    }
    const LX = 6; // resting hand positions
    const RX = CW - 57 - 6;
    const HYH = 62;
    const hands = (dx, dy, sp) => ({ handL: { x: LX + (sp || 0) + dx, y: HYH + dy }, handR: { x: RX - (sp || 0) - dx, y: HYH + dy } });
    const anims = {};
    const N = (n, fn) => {
      const out = [];
      for (let i = 0; i < n; i++) out.push(pose(fn(i, i / (n - 1 || 1))));
      return out;
    };
    anims.idle = N(8, (i, t) => Object.assign({ dy: Math.round(Math.sin((i / 8) * Math.PI * 2) * 2), eye: i % 9, blink: i === 6 ? 3 : i === 7 ? 6 : -1, angry: -1 }, hands(0, Math.round(Math.cos((i / 8) * Math.PI * 2) * 3))));
    anims.walk = N(8, (i) => Object.assign({ dy: Math.round(Math.sin((i / 8) * Math.PI * 2) * 4), eye: (i + 3) % 9, angry: -1, blink: -1 }, hands(Math.round(Math.sin((i / 8) * Math.PI * 2) * 3), Math.round(Math.cos((i / 8) * Math.PI * 2) * 5))));
    anims.chomp = N(8, (i, t) => {
      const k = Math.sin(t * Math.PI);
      return Object.assign({ dy: Math.round(-k * 4), jaw: Math.round(k * 16), angry: k > 0.3 ? 1 : -1, eye: 4, blink: -1 }, hands(Math.round(-k * 6), Math.round(k * 4)));
    });
    anims.slam = N(10, (i, t) => {
      const up = t < 0.5 ? t / 0.5 : 1;
      const down = t < 0.5 ? 0 : (t - 0.5) / 0.5;
      const hy = -Math.round(up * 38) + Math.round(down * 98);
      return Object.assign({ dy: Math.round(down * 6), angry: t > 0.3 ? 0 : -1, eye: 2, blink: -1 }, hands(Math.round(up * 6), hy, 0));
    });
    anims.cast = N(8, (i, t) => {
      const k = Math.sin(t * Math.PI);
      return Object.assign({ dy: Math.round(-k * 5 + (i % 2)), angry: 2, eye: 0, blink: -1 }, hands(Math.round(-k * 10), Math.round(-k * 22), Math.round(-k * 12)));
    });
    anims.hurt = N(4, (i) => Object.assign({ dy: i % 2 ? 4 : -2, inner: i === 1, angry: i === 1 ? 2 : -1, eye: 6, blink: -1, jaw: i === 1 ? 8 : 0 }, hands(i % 2 ? 6 : -4, 6)));
    anims.death = N(12, (i, t) => Object.assign({ dy: Math.round(t * 6), drift: t < 0.15 ? 0 : (t - 0.15) / 0.85, angry: t < 0.6 ? 2 : -1, eye: 8, blink: -1, inner: t > 0.2, jaw: Math.round(t * 18) }, hands(0, Math.round(t * 20), 0)));
    const all = [].concat(...Object.values(anims));
    const u = unionBounds(all);
    const pad = 2;
    const cw = u.x1 - u.x0 + 1 + pad * 2;
    const chh = u.y1 - u.y0 + 1 + pad * 2;
    for (const an of Object.keys(anims)) put('boss.skull.' + an, strip(anims[an].map((im) => P.crop(im, u.x0 - pad, u.y0 - pad, cw, chh))));
    meta.bosses.skull = { fw: cw, fh: chh };
    // the hands alone, for slams and projectiles
    put('boss.skull.handf', handFront);
    put('boss.skull.handb', handBack);
    console.log('  skull cell', cw + 'x' + chh);
  }

  /* ---------------------------------------------------------------- Dragon_2 / Dragon_3, Beholder2 / Beholder3 */
  for (const [kind, folder] of [['dunewyrm', 'Dragon_2'], ['bloodwyrm', 'Dragon_3']]) {
    const dir = path.join(A, 'bosses', 'dragon-pack', folder);
    for (const a of ['Idle', 'Walk', 'Attack_1', 'Attack_2', 'Flight', 'Rise', 'Landing', 'Special', 'Hurt', 'Dead']) {
      const f = path.join(dir, a + '.png');
      if (fs.existsSync(f)) put('boss.' + kind + '.' + a.toLowerCase(), P.downscale(rd(f), 0.5));
    }
    meta.bosses[kind] = { fw: 128, fh: 128 };
  }
  for (const [kind, n] of [['sporeeye', 2], ['voideye', 3]]) {
    const dir = path.join(A, 'bosses', 'beholder-monsters', 'Tiled_files');
    const defs = { idle: 'Idle_full', walk: 'Walk_full', attack: 'Attack_full', attack_fire: 'Attack_fire', hurt: 'Hurt_full', death: 'Death_full' };
    for (const an of Object.keys(defs)) {
      const f = path.join(dir, 'Beholder' + n + '_' + defs[an] + '.png');
      if (!fs.existsSync(f)) continue;
      const sheet = rd(f);
      const frames = Math.max(1, Math.floor(sheet.w / 128));
      put('boss.' + kind + '.' + an, P.crop(sheet, 0, 0, frames * 128, 64));
    }
    meta.bosses[kind] = { fw: 128, fh: 64 };
  }

  /* ---------------------------------------------------------------- enemy variants */
  const rowStrip = (file, cell, scale) => {
    const sheet = rd(file);
    const frames = Math.max(1, Math.floor(sheet.w / cell));
    return P.downscale(P.crop(sheet, 0, 0, frames * cell, cell), scale);
  };
  const ENE = path.join(A, 'enemies');
  const variants = {}; // type -> [{an: file}]
  const AN = ['idle', 'walk', 'attack', 'hurt', 'death'];
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  // plants 2, 3
  variants.plant = [2, 3].map((n) => Object.fromEntries(AN.map((a) => [a, path.join(ENE, 'predator-plants', 'Tiled_files', 'Plant' + n + '_' + cap(a) + '_full.png')])));
  // slimes: pack "slime-mobs" 2, 3 then pack "slime-enemies" 1, 2, 3
  variants.slime = [['slime-mobs', 2], ['slime-mobs', 3], ['slime-enemies', 1], ['slime-enemies', 2], ['slime-enemies', 3]].map(([pk, n]) => Object.fromEntries(AN.map((a) => [a, path.join(ENE, pk, 'Tiled_files', 'Slime' + n + '_' + cap(a) + '_full.png')])));
  // orcs 2, 3
  variants.orc = [2, 3].map((n) => Object.fromEntries(AN.map((a) => [a, path.join(ENE, 'orcs', 'Tiled_files', 'orc' + n + '_' + a + '_full.png')])));
  // goblins 2, 3
  variants.goblin = [2, 3].map((n) => Object.fromEntries(AN.map((a) => [a, path.join(ENE, 'goblins', 'PNG', 'Goblin' + n, cap(a), cap(a) + '_full.png')])));
  const cellOf = { plant: [64, 0.5], slime: [64, 0.44], orc: [64, 0.5], goblin: [64, 0.44] };
  for (const type of Object.keys(variants)) {
    variants[type].forEach((set, i) => {
      for (const a of AN) {
        if (!fs.existsSync(set[a])) {
          console.warn('  ! missing', set[a]);
          continue;
        }
        put('chr.' + type + '.v' + (i + 1) + '.' + a, rowStrip(set[a], cellOf[type][0], cellOf[type][1]));
      }
    });
    meta.enemies[type] = { variants: variants[type].length };
  }
  // spiders: aqua, brown, purple
  {
    const dir = path.join(ENE, 'giant-spiders', 'TheForest_GiantSpider_v2');
    ['Aqua', 'Brown', 'Purple'].forEach((col, i) => {
      const k = 'chr.spider.v' + (i + 1) + '.';
      const walk = fs.existsSync(path.join(dir, col + 'Spider_walk.png')) ? col + 'Spider_walk.png' : col + 'Spider-walk.png';
      const sheet = rd(path.join(dir, walk));
      put(k + 'walk', sheet);
      put(k + 'idle', P.crop(sheet, 0, 0, 32, 34));
      for (const a of ['attack', 'hurt', 'death']) put(k + a, rd(path.join(dir, col + 'Spider_' + a + '.png')));
    });
    meta.enemies.spider = { variants: 3 };
  }

  /* ---------------------------------------------------------------- golems (regular enemy, three kinds) */
  {
    const dir = path.join(A, 'bosses', 'golem-pack', 'Tiled_files');
    const defs = { idle: 'Idle', walk: 'Walk', attack: 'Attack', hurt: 'Hurt', death: 'Death' };
    for (let n = 1; n <= 3; n++) {
      for (const an of Object.keys(defs)) {
        const f = path.join(dir, 'Golem' + n + '_' + defs[an] + '_full.png');
        if (!fs.existsSync(f)) continue;
        put('chr.golem' + (n > 1 ? '.v' + (n - 1) : '') + '.' + an, rowStrip(f, 128, 0.625));
      }
    }
    meta.enemies.golem = { fw: 80, fh: 80, variants: 2 };
  }

  /* ---------------------------------------------------------------- mob drops and power ups: one small image per item */
  const iconDir = (dir, prefix, key, count) => {
    let n = 0;
    for (let i = 1; i <= count; i++) {
      const f = path.join(dir, prefix + ' (' + i + ').png');
      if (!fs.existsSync(f)) continue;
      img[key + '.' + i] = b64(fs.readFileSync(f));
      n++;
    }
    return n;
  };
  const nLoot = iconDir(path.join(A, 'mob drops', 'png'), 'mob drop', 'loot', 367);
  const nPu = iconDir(path.join(A, 'power ups', 'png'), 'powerup', 'pu', 650);
  meta.loot = nLoot;
  meta.powerups = nPu;
  console.log('  loot icons', nLoot, 'power-up icons', nPu);
  return { img, meta };
}

module.exports = { packExtra };

if (require.main === module) {
  const r = packExtra();
  let t = 0;
  for (const v of Object.values(r.img)) t += v.length;
  console.log('keys', Object.keys(r.img).length, (t / 1048576).toFixed(2) + ' MB');
}
