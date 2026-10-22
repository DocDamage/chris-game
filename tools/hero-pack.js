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
  /* The three newer packs have irregular folder names, so each animation is an exact folder:
     a string is the folder name, an object adds { side } for packs without an 'east' set. */
  Enchantress: {
    dir: 'ELVEN_ENCHANTRESS_GUARDIAN_OF_THE_ENCHANTED_FOREST',
    root: 'ELVEN_ENCHANTRESS_GUARDIAN_OF_THE_ENCHANTED_FOREST/animations', // nested twice
    rotations: 'ELVEN_ENCHANTRESS_GUARDIAN_OF_THE_ENCHANTED_FOREST/rotations',
    exact: true,
    anims: {
      idle: '256256_SAKPIX_ELITE_ANIMATED_SERIES._Use_the_exact',
      hurt: '256256_SAKPIX_ELITE_ANIMATED_SERIES._Use_the_exact-f3057d6a',
      jump: '256256_SAKPIX_ELITE_ANIMATED_SERIES._Use_the_exact-f6da1716',
      walk: 'Walk_11_frames', run: 'Run_11_frames', dash: 'Dash_11_frames',
      attack: 'Attack_13_frames', heavy: 'Heavy_attack_17_frames',
      skill: { dir: 'Skill_17_frames', side: 'south' }, victory: { dir: 'Victory_17_frames', side: 'south' },
    },
  },
  Specter: {
    dir: 'NEON_SPECTER',
    root: 'Idle/animations', // every animation sits under an 'Idle' folder
    rotations: 'Idle/rotations',
    exact: true,
    anims: {
      idle: { dir: 'Idle_11 frames', side: 'east-5760b4a0' }, // the other east set is a near-identical fidget
      walk: 'Walk_12_frames', run: 'run_14_frames', dash: 'dash_11_frames',
      attack: 'attack_14_frames', heavy: 'attack_14_frames', // no heavy: the game plays attack slower with a bigger effect
      skill: 'energy_slash_16_frames', hurt: 'hurt_9_frames', jump: 'jump_11_frames',
      victory: { dir: 'victory_13_frames', side: 'south' },
      death: { dir: 'death_17_frames', side: 'south' }, // the only hero with a death animation
    },
  },
  Stranger: {
    dir: 'THE_GRINNING_STRANGER',
    root: 'THE_GRINNING_STRANGER_Animated_Horror_Character/animations',
    rotations: 'THE_GRINNING_STRANGER_Animated_Horror_Character/rotations',
    exact: true,
    anims: {
      idle: 'Animate_the_exact_reference_character_in_an_11-fra',
      hurt: 'Create_a_7-frame_hurt_reaction_animation_for_the_e',
      walk: '02._WALK_11_frames', run: '03._RUN_13_frames', attack: '04._ATTACK_11_frames',
      skill: { dir: 'HORROR_STARE_40_FRAMES', side: 'south' },
    },
    // no dash, heavy, jump or victory in the pack: built from the frames above (see synthesize)
    synth: { dash: 'dash', heavy: 'heavy', jump: 'jump', victory: 'victory' },
  },
};

/* Frame helpers for animations the pack does not ship. Operate on decoded images of one size. */
function ghostTrail(frames) { // run frames with fading afterimages behind: reads as a dash
  return frames.map((im, i) => {
    const out = P.blank(im.w, im.h);
    for (const [dx, a] of [[-14, 0.25], [-8, 0.45], [0, 1]]) {
      const g = P.blank(im.w, im.h);
      P.blit(g, im, dx, 0);
      if (a < 1) for (let k = 3; k < g.data.length; k += 4) g.data[k] = Math.round(g.data[k] * a);
      for (let k = 0; k < g.data.length; k += 4) {
        if (g.data[k + 3] > 0 && (a === 1 ? g.data[k + 3] > 0 : out.data[k + 3] === 0)) g.data.copy(out.data, k, k, k + 4);
      }
    }
    return out;
  });
}
function squashStretch(im, n) { // one idle frame bounced: crouch, stretch up, land
  const prof = [[1.15, 0.8], [0.9, 1.15], [0.85, 1.25], [0.9, 1.15], [1.1, 0.85], [1, 1]].slice(0, n || 6);
  return prof.map(([sx, sy]) => {
    const w = Math.max(1, Math.round(im.w * sx)), h = Math.max(1, Math.round(im.h * sy));
    const out = P.blank(im.w, im.h);
    for (let y = 0; y < h; y++) {
      const oy = im.h - h + y; // anchored at the feet
      if (oy < 0 || oy >= im.h) continue;
      for (let x = 0; x < w; x++) {
        const ox = Math.floor((im.w - w) / 2) + x;
        if (ox < 0 || ox >= im.w) continue;
        const sxp = Math.min(im.w - 1, Math.floor((x / w) * im.w)), syp = Math.min(im.h - 1, Math.floor((y / h) * im.h));
        im.data.copy(out.data, (oy * im.w + ox) * 4, (syp * im.w + sxp) * 4, (syp * im.w + sxp) * 4 + 4);
      }
    }
    return out;
  });
}

function findAnimDir(root, prefix, exact) {
  if (exact) { // prefix is an exact folder name or { dir, side }
    const dn = typeof prefix === 'string' ? prefix : prefix.dir;
    const sub = fs.readdirSync(path.join(root, dn));
    const side = (typeof prefix === 'object' && prefix.side) || (sub.includes('east') ? 'east' : sub.includes('south') ? 'south' : sub[0]);
    return path.join(root, dn, side);
  }
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
  const root = path.join(assetsRoot, 'heroes', spec.dir, spec.root || 'animations');
  const raw = {}; // anim -> [img]
  let S = 0;
  for (const [anim, prefix] of Object.entries(spec.anims)) {
    const dir = findAnimDir(root, prefix, spec.exact);
    let files = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f)).sort();
    // very long animations are thinned out (every 2nd/3rd frame): the game only plays them for a fraction of a second
    const step = files.length > (maxFrames || 16) * 2 ? 3 : files.length > (maxFrames || 16) ? 2 : 1;
    files = files.filter((_, i) => i % step === 0);
    raw[anim] = files.map((f) => P.decode(fs.readFileSync(path.join(dir, f))));
    for (const im of raw[anim]) S = Math.max(S, im.w, im.h);
  }
  if (spec.synth) { // animations the pack lacks, built from what it has
    raw.dash = ghostTrail(raw.run);
    raw.heavy = raw.attack.concat([raw.attack[raw.attack.length - 1], raw.attack[raw.attack.length - 1]]);
    raw.jump = squashStretch(raw.idle[0], 6);
    raw.victory = raw.skill.filter((_, i) => i % 3 === 0); // Horror Stare doubles as the victory pose
    for (const a of ['dash', 'heavy', 'jump', 'victory']) for (const im of raw[a]) S = Math.max(S, im.w, im.h);
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
  const rotDir = path.join(assetsRoot, 'heroes', spec.dir, spec.rotations || 'rotations');
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
