/* Packs the three high-resolution hero animation sets into small strips.
   Frames of every animation are centred on a common canvas, cropped to one shared box, area-downscaled
   to game size and written as one horizontal strip per animation. */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./png');

const HEROES = {
  Mercenary: {
    dir: 'CYBERPUNK_MERCENARY_PREMIUM_256256_CHARACTER',
    anims: { idle: 'Idle', walk: 'Walk', run: 'Run', dash: 'Dash', attack: 'Light_attack', heavy: 'Heavy_attack', skill: 'Cyberskill', hurt: 'Hurt', jump: 'Jump', victory: 'victory' },
  },
  Dreadbloom: {
    dir: 'DREADBLOOM_KNIGHT_OF_THE_BLACK_THORN',
    anims: { idle: 'Idle', walk: 'Walking', run: 'Running', dash: 'Dash', attack: 'Attack', heavy: 'Heavy_attack', skill: 'Skill', hurt: 'Hurt', jump: 'Jump', victory: 'Victory' },
  },
  Vexaria: {
    dir: 'VEXARIA_THE_BLOOD_MOON_KNIGHT',
    anims: { idle: 'idle', walk: 'Walk', run: 'Run', dash: 'Dash', attack: 'Attack', heavy: 'Heavy_attack', skill: 'Dark_magic_skill', hurt: 'Hurt', jump: 'Jump', victory: 'Victory' },
  },
};

function findAnimDir(root, prefix) {
  const names = fs.readdirSync(root);
  const re = new RegExp('^' + prefix + '_\\d+_frames$', 'i');
  const n = names.find((x) => re.test(x));
  if (!n) throw new Error('missing animation ' + prefix + ' in ' + root);
  const sub = fs.readdirSync(path.join(root, n));
  const dir = sub.includes('east') ? 'east' : sub.includes('south') ? 'south' : sub[0];
  return path.join(root, n, dir);
}

/** @returns {{strips:{[anim:string]:{png:Buffer,n:number}}, fw:number, fh:number, ax:number}} */
function packHero(assetsRoot, name, scale, maxFrames) {
  const spec = HEROES[name];
  const root = path.join(assetsRoot, 'heroes', spec.dir, 'animations');
  const raw = {}; // anim -> [img]
  let S = 0;
  for (const [anim, prefix] of Object.entries(spec.anims)) {
    const dir = findAnimDir(root, prefix);
    let files = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f)).sort();
    // very long animations are thinned out (every 2nd/3rd frame): the game only plays them for a fraction of a second
    const step = files.length > (maxFrames || 16) * 2 ? 3 : files.length > (maxFrames || 16) ? 2 : 1;
    files = files.filter((_, i) => i % step === 0);
    raw[anim] = files.map((f) => P.decode(fs.readFileSync(path.join(dir, f))));
    for (const im of raw[anim]) S = Math.max(S, im.w, im.h);
  }
  // centre every frame on an S x S canvas and find the union box
  let ux0 = S, uy0 = S, ux1 = -1, uy1 = -1;
  const centred = {};
  for (const anim of Object.keys(raw)) {
    centred[anim] = raw[anim].map((im) => {
      const c = P.blank(S, S);
      P.blit(c, im, Math.floor((S - im.w) / 2), Math.floor((S - im.h) / 2));
      const b = P.bounds(c);
      if (b) {
        ux0 = Math.min(ux0, b.x0); uy0 = Math.min(uy0, b.y0); ux1 = Math.max(ux1, b.x1); uy1 = Math.max(uy1, b.y1);
      }
      return c;
    });
  }
  const bw = ux1 - ux0 + 1;
  const bh = uy1 - uy0 + 1;
  const fw = Math.max(1, Math.round(bw * scale));
  const fh = Math.max(1, Math.round(bh * scale));
  const strips = {};
  for (const anim of Object.keys(centred)) {
    const frames = centred[anim].map((c) => {
      const cropped = P.crop(c, ux0, uy0, bw, bh);
      const d = P.downscale(cropped, scale, 0.45);
      return d.w === fw && d.h === fh ? d : P.crop(d, 0, 0, fw, fh);
    });
    const strip = P.blank(fw * frames.length, fh);
    frames.forEach((fr, i) => P.blit(strip, fr, i * fw, 0));
    strips[anim] = { png: P.encode(strip), n: frames.length };
  }
  const rotDir = path.join(assetsRoot, 'heroes', spec.dir, 'rotations');
  const rotations = {};
  if (fs.existsSync(rotDir)) {
    const dirMap = {
      e: 'east.png',
      ne: 'north-east.png',
      n: 'north.png',
      nw: 'north-west.png',
      w: 'west.png',
      sw: 'south-west.png',
      s: 'south.png',
      se: 'south-east.png',
    };
    for (const [dkey, fname] of Object.entries(dirMap)) {
      const p = path.join(rotDir, fname);
      if (fs.existsSync(p)) {
        const im = P.decode(fs.readFileSync(p));
        const c = P.blank(S, S);
        P.blit(c, im, Math.floor((S - im.w) / 2), Math.floor((S - im.h) / 2));
        const cropped = P.crop(c, ux0, uy0, bw, bh);
        const d = P.downscale(cropped, scale, 0.45);
        const fr = d.w === fw && d.h === fh ? d : P.crop(d, 0, 0, fw, fh);
        rotations[dkey] = P.encode(fr);
      }
    }
  }
  return { strips, rotations, fw, fh, ax: Math.round(((S / 2) - ux0) * scale) };
}

module.exports = { packHero, HEROES };

if (require.main === module) {
  // preview: node tools/hero-pack.js <scale> <outDir>
  const scale = parseFloat(process.argv[2] || '0.27');
  const out = process.argv[3] || path.join(__dirname, '..', 'data', '_preview');
  fs.mkdirSync(out, { recursive: true });
  for (const name of Object.keys(HEROES)) {
    const r = packHero(path.resolve(__dirname, '..', 'assets'), name, scale);
    console.log(name, 'frame', r.fw + 'x' + r.fh, 'ax', r.ax, Object.entries(r.strips).map(([a, s]) => a + ':' + s.n + '/' + Math.round(s.png.length / 1024) + 'K').join(' '));
    for (const [a, s] of Object.entries(r.strips)) fs.writeFileSync(path.join(out, name + '_' + a + '.png'), s.png);
  }
}
