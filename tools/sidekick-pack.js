/* Sidekick packing (M1): maps each pack's animation folders to roles and writes strips.
   Needs the zips unpacked first (tools/pack-sidekicks.js unpack; packSidekicks() does it itself).
   Preview: node tools/sidekick-pack.js preview <outDir> */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./png');
const { PACKS, OUT, unpack } = require('./pack-sidekicks');

/* role -> folder-name match: 'text' = substring (case-insensitive), '=text' = exact name.
   Roles with several entries use arrays (atk1, atk2 ... / skill1, skill2 ...). Unnamed hashed folders were
   identified by eye on contact sheets. */
const ROLES = {
  kael: { idle: 'Idle', walk: 'TACTICAL_WALK', dash: 'DASH_BOOST', atk: ['ENERGY_SLASH', 'PLASMA_COMBO'], heavy: 'HOLOGRAM_STRIKE', skill: ['EMP_BURST', 'OVERDRIVE'], hurt: '10._HURT', death: '11._DEATH', teleport: 'CYBER_TELEPORT' },
  velkhar: { idle: 'DARK_IDLE', walk: 'NECROMANCER_WALK', dash: 'SOUL_DASH', atk: ['BONE_SPEAR', 'SHADOW_BOLT'], heavy: 'SOUL_DRAIN', skill: ['RAISE_SKELETON', 'DEATH_NOVA', 'ARMY_OF_THE_DEAD'], hurt: '10._HURT', death: '128x128' },
  inferna: { idle: 'Idle_', walk: 'Walk_', run: 'Run_', dash: 'Dash_', atk: ['Attack_'], heavy: 'Heavy_Attack', skill: ['Skill_'], hurt: 'Hurt_', death: 'Death_', victory: 'Victory_' },
  elowen: { idle: 'Forest_Idle', walk: 'Moonlit_Walk', atk: ['Nature_Slash', 'Thorn_Bloom'], heavy: 'Crescent_Bloom', skill: ['Spirit_Summon', 'Roots_leaves', 'Elowen_stands_firm'], hurt: 'animation-fb6d1855', death: 'animation-08344744' },
  viper: { idle: 'Breathing_Idle', walk: 'Walking', run: 'Running', atk: ['Cross_Punch', 'High_Kick'], heavy: 'Flying_Kick', skill: ['Surprise_Uppercut'], jump: 'Jumping', hurt: 'Getting_Up', death: 'Falling_Back_Death' },
  archangel: { idle: 'Hover_Idle', walk: 'Celestial_Drift', run: 'Divine_Flight', dash: 'Celestial_Rush', atk: ['Attack_01', 'Attack_02', 'Attack_03'], heavy: 'Wings_of_Judgment', skill: ['Ascension_of_the_Seraph', 'Ultimate_Final_Judgment'], block: 'Divine_Guard', counter: 'Heavenly_Counter', revive: 'Heavenly_Rebirth', hurt: 'Angelic_Flinch', death: 'losing_strength' },
  aurex: { idle: 'DRAGON_IDLE', dash: 'FLAME_DASH', atk: ['DRAGON_SLASH', 'INFERNO_CLEAVE'], heavy: '=128x128_pixel_art_animation_AUREX_Dragonblood_Cham', skill: ['FIRE_WAVE', 'FLAME_BREATH', 'DRAGON_ROAR', '=128x128_pixel_art_animation_AUREX_Dragonblood_Cham-09bf6b1c'], hurt: '10._HURT', death: '11._DEATH' },
  corvus: { idle: 'PLAGUE_IDLE', walk: 'DOCTOR_WALK', dash: 'SHADOW_DASH', atk: ['POISON_FLASK', 'RAVEN_SWARM', '=128x128_pixel_art_animation_CORVUS_Harbinger_of_Pe'], heavy: 'PESTILENCE_WAVE', skill: ['BLACK_DEATH_RITUAL', '=128x128_pixel_art_animation_CORVUS_Harbinger_of_Pe-eae4d269'], hurt: '10._HURT', death: '=128x128_pixel_art_animation_CORVUS_Harbinger_of_Pe-28c97b06' },
  kitsune: { idle: 'Breathing_Idle', walk: 'Sexy_Walk', run: 'Crimson_Run', atk: ['Attack_01', 'Attack_02'], heavy: 'Ultimate_Attack', skill: ['Special_Skill_Foxfire', 'masterpiece_premium_transformation'], block: 'Parry_Fox_Mirror', jump: 'Jump_Animation', hurt: 'Rise_Animation', death: 'Death_Animation' },
  oni: { idle: 'Breathing_Idle', walk: 'Walking', run: 'Running', dash: 'DASH_Phantom', atk: ['ATTACK_01', 'ATTACK_02'], heavy: 'Ultimate_Attack', skill: ['BLOOD_MOON_IAIJUTSU'], block: 'DEMONIC_COUNTERSTANCE', jump: 'ASCENSION_JUMP', hurt: 'GETTING_UP', death: 'EPIC_DEATH' },
  monk: { idle: 'Breathing_Idle', walk: 'Walking', run: 'Running', atk: ['Lead_Jab', 'Cross_Punch', 'High_Kick'], heavy: 'Hurricane_Kick', skill: ['Fireball'], block: 'Crouching', jump: 'Jumping', hurt: 'Taking_Punch', death: 'Falling_Back_Death' },
  lich: { idle: 'Hover_Idle', walk: 'Frozen_Drift', atk: ['Royal_Cleave', 'Soul_Reaper_Strike'], heavy: 'Frozen_Judgment', skill: ['Frost_Nova', 'Army_of_the_Dead'], hurt: 'Soul_Stagger', death: 'Death_Animation' },
  maldrath: { idle: 'DARK_IDLE', walk: 'CURSED_WALK', dash: 'SHADOW_DASH', atk: ['GREATSWORD_SLASH', 'EXECUTION_STRIKE'], heavy: 'HEAVY_CLEAVE', skill: ['SOUL_NOVA', 'ABYSSAL_ROAR'], hurt: '10._HURT', death: '11._DEATH' },
  morwen: { idle: 'ARCANE_IDLE', atk: ['ARCANE_BLAST', '=128x128_pixel_art_animation_Arcane_Witch_Heroine_e'], heavy: 'MOON_RITUAL', skill: ['=128x128_pixel_art_animation_Arcane_Witch_Heroine_s', '=128x128_pixel_art_animation_Arcane_Witch_Heroine_c'], block: 'ARCANE_BARRIER', dash: 'TELEPORT', hurt: '10._HURT', death: '11._Death' },
  nightrider: { idle: 'Idle_', walk: 'Walk_', run: 'Run_', dash: 'Dash_', atk: ['Attack_'], heavy: 'Heavy_attack', jump: 'Jump', hurt: 'Hurt_' },
  raven: { idle: 'Idle_', walk: 'Walking', run: 'Running', dash: 'Dash', atk: ['Attack_'], heavy: 'Heavy_attack', jump: 'Jump', hurt: 'Hurt_' },
  runegolem: { idle: 'Idle_', walk: 'Walk_', run: 'Run_', dash: 'Dash_', atk: ['Attack_'], heavy: 'Heavy_attack', jump: 'Jump_', hurt: 'RUNE_GOLEM_hurt' },
};
/* when a pack lacks a role, play another instead (resolved at pack time into meta aliases) */
const FALLBACK = { walk: ['run', 'dash', 'idle'], run: ['walk', 'dash', 'idle'], dash: ['run', 'walk'], heavy: ['atk1'], skill1: ['heavy', 'atk1'], jump: ['idle'], hurt: ['idle'], death: ['hurt', 'idle'], block: ['idle'] };

function animDir(id) {
  const find = (d, depth) => {
    if (depth > 3) return null;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      if (e.name === 'animations') return path.join(d, e.name);
      const r = find(path.join(d, e.name), depth + 1);
      if (r) return r;
    }
    return null;
  };
  return find(path.join(OUT, id), 0);
}

function matchDir(names, key) {
  const exact = key.startsWith('=');
  const k = (exact ? key.slice(1) : key).toLowerCase();
  const hits = names.filter((n) => (exact ? n.toLowerCase() === k : n.toLowerCase().includes(k)));
  // shortest name first: 'Attack_' must not pick a longer variant before the plain one
  return hits.sort((a, b) => a.length - b.length)[0];
}

function flipH(im) {
  const o = P.blank(im.w, im.h);
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) im.data.copy(o.data, (y * im.w + (im.w - 1 - x)) * 4, (y * im.w + x) * 4, (y * im.w + x) * 4 + 4);
  return o;
}

/* frames of one animation folder facing east: uses 'east', else mirrors 'west', else 'south' */
function readAnim(dir) {
  const subs = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const pick = (p) => subs.find((s) => s === p || s.startsWith(p + '-'));
  let side = pick('east');
  let flip = false;
  if (!side) { side = pick('west'); flip = !!side; }
  if (!side) side = pick('south') || subs[0];
  const sd = path.join(dir, side);
  const files = fs.readdirSync(sd).filter((f) => /\.png$/i.test(f)).sort();
  return files.map((f) => {
    const im = P.decode(fs.readFileSync(path.join(sd, f)));
    return flip ? flipH(im) : im;
  });
}

const MAX_FRAMES = 14;
/** @returns {{strips:{[role:string]:{png:Buffer,n:number}}, fw:number, fh:number, ax:number, alias:{[role:string]:string}, rotations:{[d:string]:Buffer}}} */
function packSidekick(id, scale) {
  const root = animDir(id);
  const names = fs.readdirSync(root);
  const raw = {};
  const want = [];
  for (const [role, v] of Object.entries(ROLES[id])) {
    if (Array.isArray(v)) v.forEach((k, i) => want.push([role + (i + 1), k]));
    else want.push([role, v]);
  }
  for (const [role, key] of want) {
    const n = matchDir(names, key);
    if (!n) {
      console.warn('  ! ' + id + ': no folder for ' + role + ' (' + key + ')');
      continue;
    }
    let frames = readAnim(path.join(root, n));
    if (frames.length > MAX_FRAMES) {
      const step = frames.length > MAX_FRAMES * 2 ? 3 : 2;
      frames = frames.filter((_, i) => i % step === 0);
    }
    raw[role] = frames;
  }
  let S = 0;
  for (const fr of Object.values(raw)) for (const im of fr) S = Math.max(S, im.w, im.h);
  let ux0 = S, uy0 = S, ux1 = -1, uy1 = -1;
  const centred = {};
  const centre = (im) => {
    const c = P.blank(S, S);
    P.blit(c, im, Math.floor((S - im.w) / 2), Math.floor((S - im.h) / 2));
    return c;
  };
  for (const [role, fr] of Object.entries(raw)) {
    centred[role] = fr.map((im) => {
      const c = centre(im);
      // effect-heavy roles do not size the box, so the body keeps its scale (big effects may clip a little)
      const b = P.bounds(c);
      if (b && !/^(skill|heavy|death|revive)/.test(role)) {
        ux0 = Math.min(ux0, b.x0); uy0 = Math.min(uy0, b.y0); ux1 = Math.max(ux1, b.x1); uy1 = Math.max(uy1, b.y1);
      }
      return c;
    });
  }
  const padx = Math.round(S * 0.18), pady = Math.round(S * 0.08); // room for sword swings and wings
  ux0 = Math.max(0, ux0 - padx); ux1 = Math.min(S - 1, ux1 + padx); uy0 = Math.max(0, uy0 - pady); uy1 = Math.min(S - 1, uy1 + pady);
  const bw = ux1 - ux0 + 1, bh = uy1 - uy0 + 1;
  const fw = Math.max(1, Math.round(bw * scale)), fh = Math.max(1, Math.round(bh * scale));
  const cropFrame = (c) => {
    const d = P.downscale(P.crop(c, ux0, uy0, bw, bh), scale, 0.45);
    return d.w === fw && d.h === fh ? d : P.crop(d, 0, 0, fw, fh);
  };
  const strips = {};
  for (const [role, fr] of Object.entries(centred)) {
    const frames = fr.map(cropFrame);
    const strip = P.blank(fw * frames.length, fh);
    frames.forEach((f, i) => P.blit(strip, f, i * fw, 0));
    strips[role] = { png: P.encode(strip), n: frames.length };
  }
  const alias = {};
  const have = (r) => !!strips[r];
  for (const role of ['walk', 'run', 'dash', 'heavy', 'skill1', 'jump', 'hurt', 'death', 'block']) {
    if (have(role)) continue;
    const f = (FALLBACK[role] || []).find(have);
    if (f) alias[role] = f;
  }
  const rotations = {};
  const south = path.join(path.dirname(root), 'rotations', 'south.png');
  if (fs.existsSync(south)) rotations.s = P.encode(cropFrame(centre(P.decode(fs.readFileSync(south)))));
  return { strips, fw, fh, ax: Math.round((S / 2 - ux0) * scale), alias, rotations };
}

const SK_SCALE = 0.4; // 128px source -> ~40-50px body in the 640x360 world

/** @returns {{img:{[key:string]:string}, meta:{[id:string]:object}}} for build-assets (bundle 'sidekicks') */
function packSidekicks() {
  unpack();
  const img = {};
  const meta = {};
  for (const id of Object.keys(PACKS)) {
    const r = packSidekick(id, SK_SCALE);
    meta[id] = { fw: r.fw, fh: r.fh, ax: r.ax, anims: {}, alias: r.alias };
    for (const [role, st] of Object.entries(r.strips)) {
      img['sk.' + id + '.' + role] = 'data:image/png;base64,' + st.png.toString('base64');
      meta[id].anims[role] = st.n;
    }
    for (const [d, png] of Object.entries(r.rotations)) img['sk.' + id + '.rot_' + d] = 'data:image/png;base64,' + png.toString('base64');
  }
  return { img, meta };
}

module.exports = { ROLES, packSidekick, packSidekicks };

if (require.main === module && process.argv[2] === 'preview') {
  const out = process.argv[3];
  fs.mkdirSync(out, { recursive: true });
  for (const id of Object.keys(PACKS)) {
    const r = packSidekick(id, SK_SCALE);
    console.log(id.padEnd(10), r.fw + 'x' + r.fh, Object.entries(r.strips).map(([a, s]) => a + ':' + s.n).join(' '), Object.keys(r.alias).length ? 'alias ' + JSON.stringify(r.alias) : '');
    for (const [a, s] of Object.entries(r.strips)) fs.writeFileSync(path.join(out, id + '_' + a + '.png'), s.png);
  }
}
