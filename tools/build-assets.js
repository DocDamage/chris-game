#!/usr/bin/env node
/* CHAOS.exe asset bundler.
 *
 * Reads the raw packs in ./assets and writes a lean, self-contained bundle:
 *   data/assets.js        sprites, VFX, tiles (base64 PNG) + converted sound effects (base64 WAV)
 *   data/music/*.mp3      the handful of soundtrack tracks the game uses
 *
 * Why a bundle: browsers block fetch()/canvas readback for file:// URLs, so embedding the chosen
 * files as data: URIs lets the game run by double-clicking index.html, with no server. SFX are
 * down-mixed to mono 16-bit 22 kHz and trimmed, which shrinks the 1.1 GB library to a few MB.
 *
 * Usage:  node tools/build-assets.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const A = path.join(ROOT, 'assets');
const OUT = path.join(ROOT, 'data');

const P = require('./png');
const meta = { heroes: {} };
const img = {}; // key -> data URI
const sfx = {}; // key -> [data URI, ...]
const stats = { png: 0, pngBytes: 0, wav: 0, wavBytes: 0 };

const exists = (p) => fs.existsSync(p);
const b64png = (file) => {
  const b = fs.readFileSync(file);
  stats.png++;
  stats.pngBytes += b.length;
  return 'data:image/png;base64,' + b.toString('base64');
};
function addImg(key, rel) {
  const f = path.join(A, rel);
  if (!exists(f)) {
    console.warn('  ! missing image', rel);
    return false;
  }
  img[key] = b64png(f);
  return true;
}

/* ------------------------------------------------------------------ characters */
const P1 = 'enemies/Tiny RPG Character Asset Pack 01 v2.0 -Full 22 Characters';
const P2 = 'enemies/Tiny RPG Character Asset Pack 02 -Full 20 Characters';

/* [pack, folder name, slug] */
const CHARACTERS = [
  // enemies (the playable heroes come from assets/heroes, see below)
  [P1, 'Orc', 'Orc'],
  [P1, 'Skeleton Archer', 'SkeletonArcher'],
  [P1, 'Priest', 'Priest'],
  [P1, 'Lancer', 'Lancer'],
  [P1, 'Slime', 'Slime'],
  [P2, 'Ghostfire', 'Ghostfire'],
  [P2, 'Minotaur', 'Minotaur'],
  [P2, 'Hellhound', 'Hellhound'],
  [P2, 'Hellbat', 'Hellbat'],
  [P2, 'Flame Golem', 'FlameGolem'],
];

for (const [pack, name, slug] of CHARACTERS) {
  const dir = path.join(A, pack, 'Characters(100x100 split)', name, name);
  if (!exists(dir)) {
    console.warn('  ! missing character', name);
    continue;
  }
  for (const f of fs.readdirSync(dir)) {
    if (!/\.png$/i.test(f) || f.includes('(')) continue; // skip the "(With magic effects)" duplicates
    const anim = f.replace(/\.png$/i, '').slice(name.length + 1);
    if (!anim) continue; // the full sheet, not a strip
    img['chr.' + slug + '.' + anim] = b64png(path.join(dir, f));
  }
}

/* ------------------------------------------------------------------ playable heroes */
const { packHero, HEROES } = require('./hero-pack');
const HERO_SCALE = 0.27; // 176px source frames -> ~33px tall in the 480x270 world
for (const name of Object.keys(HEROES)) {
  const r = packHero(A, name, HERO_SCALE);
  meta.heroes[name] = { fw: r.fw, fh: r.fh, ax: r.ax, anims: {}, rotations: Object.keys(r.rotations || {}) };
  for (const [anim, st] of Object.entries(r.strips)) {
    img['hero.' + name + '.' + anim] = 'data:image/png;base64,' + st.png.toString('base64');
    meta.heroes[name].anims[anim] = st.n;
    stats.png++;
    stats.pngBytes += st.png.length;
  }
  if (r.rotations) {
    for (const [dir, png] of Object.entries(r.rotations)) {
      img['hero.' + name + '.rot_' + dir] = 'data:image/png;base64,' + png.toString('base64');
      stats.png++;
      stats.pngBytes += png.length;
    }
  }
}

/* projectile / magic effect strips from the character packs */
for (const [key, rel] of [
  ['proj.arrow1', P1 + '/Arrow(Projectile)/Arrow01(32x32).png'],
  ['proj.arrow2', P1 + '/Arrow(Projectile)/Arrow02(32x32).png'],
  ['proj.arrow3', P1 + '/Arrow(Projectile)/Arrow03(32x32).png'],
  ['proj.cannonball', P2 + '/Projectile/Cannonball_Black Knight_B_Attack03(32x32).png'],
  ['proj.wizard1', P1 + '/Magic(Projectile)/Wizard_Attack01_Effect.png'],
  ['proj.wizard2', P1 + '/Magic(Projectile)/Wizard_Attack02_Effect.png'],
  ['proj.priest', P1 + '/Magic(Projectile)/Priest_Attack_effect.png'],
  ['proj.priestHeal', P1 + '/Magic(Projectile)/Priest_Heal_effect.png'],
  ['proj.ghostBeam', P2 + '/Projectile/Ghostfire_Beam.png'],
  ['proj.lavaSpike', P2 + '/Projectile/Lava Slime_Spike.png'],
]) addImg(key, rel);

/* ------------------------------------------------------------------ bosses (128px strips) */
const BO = 'bosses';
const WAR = BO + '/WarriorBoss/SpriteSheets/Swish-';
for (const a of ['Idle', 'Walk', 'SlashWeak', 'DoubleSlash', 'SlashBomb', 'SlashDash', 'SlashStorm', 'Combo', 'Death']) addImg('boss.war.' + a, WAR + a + '.png');
const SPI = BO + '/SpiderBoss/SpriteSheets/RockSpider-';
for (const a of ['Idle', 'Jump', 'Bite', 'CastAttack', 'Web', 'WebBall', 'Slash', 'Death']) addImg('boss.spi.' + a, SPI + a + '.png');
addImg('boss.spi.rockfall', BO + '/SpiderBoss/SpriteSheets/FX/RockSpider-RockFall-Sheet.png');
addImg('boss.spi.webball', BO + '/SpiderBoss/SpriteSheets/FX/RockSpider-WebBallProjectile.png');
addImg('boss.spi.rock', BO + '/SpiderBoss/SpriteSheets/FX/Sprite-Rock.png');
const WIN = BO + '/WingedBoss/SpriteSheets/';
for (const [k, f] of [
  ['Idle', 'Crawller-SheetIdle.png'], ['Flying', 'Crawller-SheetFlying.png'], ['ImpulseFly', 'Crawller-SheetImpulseFly.png'],
  ['StartDive', 'Dive/Crawller-SheetStartDive.png'], ['Dive', 'Dive/Crawller-SheetDive.png'], ['EndDive', 'Dive/Crawller-SheetEndDive.png'],
  ['GroundImpact', 'Crawller-SheetGroundImpact.png'], ['TeleIn', 'Teleport/Crawller-SheetTeleportIn.png'], ['TeleOut', 'Teleport/Crawller-SheetTeleportOut.png'],
  ['Projectile', 'Projectil/Crawller-SheetProjectile.png'], ['Explosion', 'Crawller-SheetExplosion.png'], ['Death', 'Crawller-SheetDeath.png'],
]) addImg('boss.win.' + k, WIN + f);
addImg('boss.win.projSmall', WIN + 'Projectil/Projectile.png');
addImg('boss.win.impactFx', WIN + 'GroundImpactEffect.png');

/* ---- Wild Frog (128px strips) ---- */
const FRG = BO + '/WildFrogBoss/SpriteSheets/';
for (const [k, f] of [
  ['Idle', 'WildFrog-Idle.png'], ['Impulse', 'ImpulseJump/WildFrog-Impulse.png'], ['Rising', 'WildFrog-Rising.png'], ['Falling', 'WildFrog-Falling.png'],
  ['Land', 'Land/WildFrog-Land.png'], ['Spikes', 'Land/WildFrog-Attack.png'], ['Lick', 'LickAttack/WildFrog-Lick.png'], ['LickAttack', 'LickAttack/WildFrog-LickAttack.png'],
  ['Spit', 'ProjectilAttack/WildFrog-ProjectileAttack.png'], ['Prefab', 'ProjectilAttack/WildFrog-ProjectilPrefab.png'], ['Death', 'Death/WildFrog-Death.png'],
]) addImg('boss.frg.' + k, FRG + f);

/* ---- Skeleton Maw (128px strips + spell sheets) ---- */
const MAW = BO + '/SkeletonBoss/Sheets/';
for (const d of ['Idle', 'Floating', 'Teleport', 'SummonAttack', 'SummonStaff', 'HideStaff', 'HandAttack', 'ExplosionAttack', 'BoneAttack', 'Death']) addImg('boss.maw.' + d, MAW + d + '/Maw-All-' + d + '-Sheet.png');
for (const [k, f] of [
  ['bone1', 'BoneAttack/Spell/Bone1.png'], ['bone2', 'BoneAttack/Spell/Bone2.png'], ['ball1', 'SummonAttack/Spell/Ball1.png'], ['ball2', 'SummonAttack/Spell/Ball2.png'],
  ['blast', 'ExplosionAttack/Spell/Blast.png'], ['hands', 'HandAttack/Spell/handSpell-Sheet.png'], ['groundHands', 'HandAttack/Spell/HandGroundSpell-Sheet.png'], ['zombies', 'HandAttack/Spell/zombie-Sheet.png'],
]) addImg('boss.maw.spell.' + k, MAW + f);

/* ---- Mecha-stone Golem: a 10x10 grid of 100px frames; each row is one animation ---- */
const GOL = BO + '/MechaStoneGolemBoss/Mecha-stone Golem 0.1/';
{
  const sheet = P.decode(fs.readFileSync(path.join(A, GOL + 'PNG sheet/Character_sheet.png')));
  const rowStrip = (rows) => {
    // rows: [[rowIndex, frameCount], ...] concatenated into one strip
    const n = rows.reduce((a, r) => a + r[1], 0);
    const out = P.blank(n * 100, 100);
    let x = 0;
    for (const [r, c] of rows) {
      P.blit(out, P.crop(sheet, 0, r * 100, c * 100, 100), x, 0);
      x += c * 100;
    }
    return P.encode(out);
  };
  const ROWS = { Idle: [[0, 4]], Charge: [[1, 8]], Arm: [[2, 9]], Roll: [[3, 8]], Punch: [[4, 7]], Cast: [[5, 7]], Slam: [[6, 10]], Burrow: [[7, 10]], Death: [[7, 10], [8, 4]] };
  for (const k of Object.keys(ROWS)) {
    const png = rowStrip(ROWS[k]);
    img['boss.gol.' + k] = 'data:image/png;base64,' + png.toString('base64');
    stats.png++;
    stats.pngBytes += png.length;
  }
  addImg('boss.gol.armProj', GOL + 'weapon PNG/arm_projectile.png');
  addImg('boss.gol.armGlow', GOL + 'weapon PNG/arm_projectile_glowing.png');
  // the laser sheet is 5 frames stacked vertically: turn it into a horizontal strip
  const laser = P.decode(fs.readFileSync(path.join(A, GOL + 'weapon PNG/Laser_sheet.png')));
  const nl = Math.floor(laser.h / laser.w);
  const ls = P.blank(laser.w * nl, laser.w);
  for (let i = 0; i < nl; i++) P.blit(ls, P.crop(laser, 0, i * laser.w, laser.w, laser.w), i * laser.w, 0);
  const lpng = P.encode(ls);
  img['boss.gol.laser'] = 'data:image/png;base64,' + lpng.toString('base64');
  meta.laserFrame = laser.w;
}

/* ---- Boulder Dash: assembled from the poses and parts on its single sprite sheet ---- */
{
  const sheetPath = path.join(A, BO + '/BoulderDashBoss/BoulderDash-Sheet.png');
  if (exists(sheetPath)) {
    const sheet = P.decode(fs.readFileSync(sheetPath));
    // pose rectangles [x, y, w, h] found by connected-component scan of the sheet
    const R = {
      idle0: [12, 0, 52, 54], idle1: [69, 2, 51, 54], idle2: [134, 0, 50, 53], idle3: [8, 116, 52, 54], idle4: [6, 176, 52, 54],
      windup: [14, 56, 72, 51], curl0: [113, 55, 34, 53], curl1: [170, 57, 38, 48], handsUp0: [243, 121, 34, 46], handsUp1: [165, 121, 50, 46], handsUp2: [77, 120, 59, 46],
      punch: [64, 171, 60, 57], hurt0: [3, 242, 57, 58], hurt1: [96, 253, 44, 48], hurt2: [174, 255, 34, 37], die0: [262, 264, 77, 38], die1: [347, 265, 37, 37], rubble0: [152, 284, 21, 17], rubble1: [239, 284, 21, 17],
    };
    const ANIMS = { idle: ['idle0', 'idle1', 'idle2', 'idle1'], windup: ['windup'], curl: ['curl0', 'curl1'], handsup: ['handsUp0', 'handsUp1', 'handsUp2'], punch: ['punch'], hurt: ['hurt0', 'hurt1', 'hurt2'], death: ['hurt0', 'hurt1', 'hurt2', 'die0', 'die1', 'rubble0', 'rubble1'] };
    const FW = 80;
    const FH = 64;
    for (const a of Object.keys(ANIMS)) {
      const strip = P.blank(FW * ANIMS[a].length, FH);
      ANIMS[a].forEach((name, i) => {
        const r = R[name];
        const piece = P.crop(sheet, r[0], r[1], r[2], r[3]);
        // bottom-centre aligned inside the frame
        P.blit(strip, piece, i * FW + Math.floor((FW - r[2]) / 2), FH - 2 - r[3]);
      });
      const png = P.encode(strip);
      img['boss.bd.' + a] = 'data:image/png;base64,' + png.toString('base64');
      stats.png++;
      stats.pngBytes += png.length;
    }
    meta.bd = { fw: FW, fh: FH, anims: Object.fromEntries(Object.entries(ANIMS).map(([k, v]) => [k, v.length])) };
    // the tall rock hands that burst out of the ground
    const HANDS = [[290, 96, 30, 28], [325, 96, 24, 28], [143, 121, 17, 28], [220, 121, 14, 28], [328, 129, 17, 28]];
    const hs = P.blank(32 * HANDS.length, 30);
    HANDS.forEach((r, i) => P.blit(hs, P.crop(sheet, r[0], r[1], r[2], r[3]), i * 32 + Math.floor((32 - r[2]) / 2), 30 - r[3]));
    const hp = P.encode(hs);
    img['boss.bd.hands'] = 'data:image/png;base64,' + hp.toString('base64');
  } else console.warn('  ! BoulderDash-Sheet.png missing (export the .aseprite first)');
}

/* ------------------------------------------------------------------ VFX frames */
const V = "vfx/Beat 'em Up Combat Effects – 2D Pixel Art VFX Pack";
const VP = { p1: V + '/PNG/', p5: V + ' 5/PNG/', p7: V + ' 7/PNG/' };
// every effect in the three packs (ids 1..40, frames numbered 1..n)
for (const pk of Object.keys(VP)) {
  for (let n = 1; n <= 40; n++) {
    for (let i = 1; i < 40; i++) {
      const rel = VP[pk] + 'Effect (' + n + ')' + i + '.png';
      if (!exists(path.join(A, rel))) break;
      img['vfx.' + pk + '.' + n + '.' + i] = b64png(path.join(A, rel));
    }
  }
}

/* ------------------------------------------------------------------ tiles / props */
const T = 'tile sets/Valley Ruin Asset Pack V0.3/';
for (const [key, rel] of [
  ['tile.grass', T + 'Tiles Maps/GrassTile.png'],
  ['tile.sand', T + 'Tiles Maps/SandTile.png'],
  ['tile.dirt', T + 'Tiles Maps/DirtTile.png'],
  ['tile.rock', T + 'Tiles Maps/RockWall.png'],
  ['tile.hedge', T + 'Tiles Maps/GrassWall.png'],
  ['tile.fence', T + 'Tiles Maps/fence.png'],
  ['tile.cliff', T + 'Tiles Maps/RockCliff.png'],
  ['tile.firewall', T + 'FireWall.png'],
  ['tile.flowers', T + 'FlowerAndGrass.png'],
  ['tile.dust', T + 'dust_particles_01.png'],
  ['obj.stone', T + 'Objects/stone and bush.png'],
  ['obj.items', T + 'Objects/Items.png'],
  ['obj.chests', T + 'Objects/ChestSheet.png'],
]) addImg(key, rel);

/* ------------------------------------------------------------------ 4 new stage packs + shelter props */
const { buildStagePacks } = require('./pack-stages.js');
const stageAssets = buildStagePacks();
for (const [k, v] of Object.entries(stageAssets)) {
  if (v) {
    img[k] = v;
    stats.png++;
  }
}

/* ------------------------------------------------------------------ new monsters, bosses & VFX */
const { packMonsters } = require('./pack-monsters.js');
const monsterPack = packMonsters();
Object.assign(img, monsterPack.img);
Object.assign(meta, monsterPack.meta);
stats.png += Object.keys(monsterPack.img).length;

const { packExtra } = require('./pack-extra.js');
const extraPack = packExtra();
Object.assign(img, extraPack.img);
for (const grp of ['enemies', 'bosses']) for (const k of Object.keys(extraPack.meta[grp])) meta[grp][k] = Object.assign(meta[grp][k] || {}, extraPack.meta[grp][k]);
meta.loot = extraPack.meta.loot;
meta.powerups = extraPack.meta.powerups;
stats.png += Object.keys(extraPack.img).length;

/* ------------------------------------------------------------------ sound effects */
/** read a PCM/float WAV into mono Float32 samples */
function readWav(file) {
  const b = fs.readFileSync(file);
  let o = 12;
  let fmt = null;
  let data = null;
  while (o + 8 <= b.length) {
    const id = b.toString('ascii', o, o + 4);
    const sz = b.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = { tag: b.readUInt16LE(o + 8), ch: b.readUInt16LE(o + 10), sr: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    else if (id === 'data') {
      data = b.subarray(o + 8, Math.min(b.length, o + 8 + sz));
      break;
    }
    o += 8 + sz + (sz & 1);
  }
  if (!fmt || !data) throw new Error('bad wav ' + file);
  const bps = fmt.bits / 8;
  const frames = Math.floor(data.length / (bps * fmt.ch));
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < fmt.ch; c++) {
      const p = (i * fmt.ch + c) * bps;
      let v;
      if (fmt.tag === 3 && fmt.bits === 32) v = data.readFloatLE(p);
      else if (fmt.bits === 16) v = data.readInt16LE(p) / 32768;
      else if (fmt.bits === 24) v = data.readIntLE(p, 3) / 8388608;
      else if (fmt.bits === 32) v = data.readInt32LE(p) / 2147483648;
      else if (fmt.bits === 8) v = (data[p] - 128) / 128;
      else throw new Error('unsupported bit depth ' + fmt.bits);
      acc += v;
    }
    out[i] = acc / fmt.ch;
  }
  return { samples: out, sr: fmt.sr };
}

/* opts: {sr, loop, peak}. One-shots are trimmed, tail-faded and normalised; loops are kept whole. */
function convertWav(file, maxSec, opts) {
  opts = opts || {};
  const targetSr = opts.sr || 22050;
  const { samples, sr } = readWav(file);
  let s0 = 0;
  let s1 = samples.length;
  if (!opts.loop) {
    const thr = 0.004;
    while (s0 < s1 && Math.abs(samples[s0]) < thr) s0++;
    while (s1 > s0 && Math.abs(samples[s1 - 1]) < thr) s1--;
    s0 = Math.max(0, s0 - Math.floor(sr * 0.003));
    s1 = Math.min(samples.length, s1 + Math.floor(sr * 0.02));
  }
  const maxN = Math.floor(sr * maxSec);
  if (s1 - s0 > maxN) s1 = s0 + maxN;
  const n = Math.max(1, Math.floor(((s1 - s0) * targetSr) / sr));
  const out = new Float32Array(n);
  const ratio = sr / targetSr;
  for (let i = 0; i < n; i++) {
    const a = s0 + i * ratio;
    const b = Math.min(s1, a + ratio);
    let sum = 0;
    let cnt = 0;
    for (let k = Math.floor(a); k < Math.max(Math.floor(a) + 1, Math.ceil(b)); k++) {
      sum += samples[Math.min(samples.length - 1, k)];
      cnt++;
    }
    out[i] = sum / Math.max(1, cnt);
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const gain = peak > 0 ? (opts.peak || 0.7) / peak : 1;
  const fade = opts.loop ? 0 : Math.min(Math.floor(targetSr * 0.04), Math.floor(n * 0.15));
  for (let i = 0; i < n; i++) {
    let g = gain;
    if (fade && i >= n - fade) g *= (n - i) / fade;
    out[i] *= g;
  }
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(targetSr, 24);
  buf.writeUInt32LE(targetSr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(out[i] * 32767))), 44 + i * 2);
  return buf;
}

const { SOUNDS, LOOPS, MUSIC } = require('./sounds');
const SFXD = path.join(A, 'sfx/Huge SFX Pack');

for (const name of Object.keys(SOUNDS)) {
  const variants = [];
  for (const spec of SOUNDS[name]) {
    const d = path.join(SFXD, spec.d);
    if (!exists(d)) {
      console.warn('  ! missing sfx folder', spec.d);
      continue;
    }
    const files = fs.readdirSync(d).filter((f) => /\.wav$/i.test(f) && spec.re.test(f)).sort();
    if (!files.length) {
      console.warn('  ! no sfx match for', name, spec.d, String(spec.re));
      continue;
    }
    for (const f of files.slice(0, spec.n)) {
      const buf = convertWav(path.join(d, f), spec.s || 1.0);
      stats.wav++;
      stats.wavBytes += buf.length;
      variants.push('data:audio/wav;base64,' + buf.toString('base64'));
    }
  }
  if (variants.length) sfx[name] = variants;
}

const loops = {};
for (const name of Object.keys(LOOPS)) {
  const L = LOOPS[name];
  const d = path.join(SFXD, L.d);
  const f = exists(d) && fs.readdirSync(d).find((x) => /\.wav$/i.test(x) && L.re.test(x));
  if (!f) {
    console.warn('  ! missing loop', name);
    continue;
  }
  const buf = convertWav(path.join(d, f), L.maxSec || 45, { sr: L.sr || 16000, loop: true, peak: 0.8 });
  stats.wavBytes += buf.length;
  loops[name] = 'data:audio/wav;base64,' + buf.toString('base64');
}

/* ------------------------------------------------------------------ music */
const SD = path.join(A, 'soundtrack');
const sdir = exists(SD) ? fs.readdirSync(SD).map((d) => path.join(SD, d)).find((d) => fs.statSync(d).isDirectory()) : null;
const music = {};
fs.mkdirSync(path.join(OUT, 'music'), { recursive: true });
if (sdir) {
  for (const key of Object.keys(MUSIC)) {
    const f = fs.readdirSync(sdir).find((n) => n.startsWith(MUSIC[key]) && /\.mp3$/i.test(n));
    if (!f) {
      console.warn('  ! missing track', MUSIC[key]);
      continue;
    }
    fs.copyFileSync(path.join(sdir, f), path.join(OUT, 'music', key + '.mp3'));
    music[key] = 'data/music/' + key + '.mp3';
  }
}

/* ------------------------------------------------------------------ write bundle */
fs.mkdirSync(OUT, { recursive: true });
const { splitBundles } = require('./split-bundles');
// the sidekick and UI packs are built by their own tools
const sidekickPack = require('./sidekick-pack').packSidekicks();
meta.sidekicks = sidekickPack.meta;
const uiPack = require('./pack-ui').packUI();
meta.ui = uiPack.meta;
const sizes = splitBundles({ img: Object.assign({}, img, sidekickPack.img, uiPack.img), sfx, loops, music, meta });
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
console.log('images :', Object.keys(img).length, '(' + mb(stats.pngBytes) + ' raw)');
console.log('sounds :', Object.keys(sfx).length, 'names /', stats.wav, 'clips,', Object.keys(loops).length, 'loops (' + mb(stats.wavBytes) + ' raw)');
console.log('music  :', Object.keys(music).length, 'tracks');
console.log('bundles:', Object.keys(sizes).map((n) => n + ' ' + mb(sizes[n])).join(', '));
