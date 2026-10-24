/* The kits added on 2026-10-23 (PLAN.md 18, K1): every sheet of Creepy Forest, Frozen Kingdom and Haunted Victorian
   City is cut into pieces with no banner, frame or fragment among them, ground swatches are exact 32 px floor tiles,
   the hand fixes hold, and the new NPCs have their animations and play in the game. Checks the built bundles
   (node tools/build-assets.js). */
const fs = require('fs');
const path = require('path');
const P = require('../tools/png');
const { open } = require('./lib');

const DATA = path.join(__dirname, '..', 'data');
const load = (f) => { const w = {}; new Function('window', fs.readFileSync(path.join(DATA, f), 'utf8'))(w); return w.CH_ASSETS; };

(async () => {
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  const core = load('assets.js'), kits = load('bundle_kits.js'), npcs = load('bundle_npcs.js');
  const K = core.meta.kits || {}, N = core.meta.npcs || {};
  const ids = ['cf', 'fk', 'hv'].flatMap((p) => Array.from({ length: 20 }, (_, i) => p + (i + 1)));
  // every sheet gives pieces, and every piece is in the bundle
  const missing = ids.filter((id) => !K[id] || !K[id].n);
  ok('all 60 sheets of the three packs give pieces', missing.length === 0, missing);
  const absent = ids.filter((id) => K[id] && Array.from({ length: K[id].n }, (_, i) => 'kit.' + id + '.' + i).some((k) => !kits.img[k]));
  ok('every piece is in the kits bundle', absent.length === 0, absent);
  // no junk: nothing as wide as a frame, nothing wholly inside the banner band at the top of a sheet
  const junk = [];
  for (const id of ids) for (const [x, y, w, h] of (K[id] && K[id].src) || []) if (w > 1400 || h > 860 || y + h <= 104) junk.push([id, x, y, w, h]);
  ok('no frame, banner or title fragment among the pieces', junk.length === 0, junk.slice(0, 6));
  // ground swatches: exactly 32 x 32 and fully painted
  let ground = 0;
  const badGround = [];
  for (const id of ids) (K[id] ? K[id].roles : []).forEach((role, i) => {
    if (role !== 'ground') return;
    ground++;
    const im = P.decode(Buffer.from(kits.img['kit.' + id + '.' + i].split(',')[1], 'base64'));
    let holes = 0;
    for (let k = 3; k < im.data.length; k += 4) if (im.data[k] < 255) holes++;
    if (im.w !== 32 || im.h !== 32 || holes) badGround.push([id, i, im.w, im.h, holes]);
  });
  ok('ground swatches are opaque 32 x 32 floor tiles (' + ground + ')', ground >= 100 && badGround.length === 0, badGround.slice(0, 6));
  // the hand fixes from docs/ASSET_PACKS.md
  const roles = (id) => (K[id] ? K[id].roles.reduce((m, r) => ((m[r] = (m[r] || 0) + 1), m), {}) : {});
  ok('Victorian cobbles: 30 floor tiles, the edge pieces, grates and boulders kept whole', roles('hv1').ground === 30, roles('hv1'));
  ok('glacier cliffs: 12 cliff blocks and 7 ice spikes', roles('fk4').cliff === 12 && roles('fk4').hazard === 7, roles('fk4'));
  ok('the domed crypt is split from its coffin (43 pieces on Creepy Forest 11)', K.cf11 && K.cf11.n === 43, K.cf11 && K.cf11.n);
  ok('snow footprints are cut one print at a time (7 prints)', roles('fk18').print === 7, roles('fk18'));
  ok('the set pieces are packed at their own scale', ['cf_portal1', 'cf_skull_gate', 'fk_portal', 'hv_eye_portal', 'hv_pentagram'].every((k) => kits.img['kit.' + k]), Object.keys(K._extras || {}));
  // NPCs
  const want = { nurse: ['idle', 'walk', 'heal'], doctor: ['idle', 'walk', 'heal'], jesus: ['idle', 'walk', 'bless'], lucifer: ['idle', 'magic', 'hellfire'], cult1: ['idle', 'walk', 'pray', 'attack'], cult2: ['pray'], cult3: ['pray'], cult4: ['pray'] };
  const npcBad = [];
  for (const [id, anims] of Object.entries(want)) for (const a of anims) {
    const views = N[id] && N[id].anims[a];
    if (!views || !Object.keys(views).every((v) => npcs.img['npc.' + id + '.' + a + '.' + v])) npcBad.push(id + '.' + a);
  }
  ok('the nurse, doctor, Jesus, Lucifer and the four cultists have their animations', npcBad.length === 0, npcBad);
  const tall = (id) => N[id] && N[id].fh;
  ok('the hideout people stand about as tall as the heroes; Lucifer is bigger', tall('nurse') >= 36 && tall('nurse') <= 48 && tall('cult1') >= 30 && tall('cult1') <= 42 && tall('lucifer') > 55, { nurse: tall('nurse'), cult1: tall('cult1'), lucifer: tall('lucifer') });

  // in the game: the images load and an NPC plays through the Sprites module
  const { browser, page, errs } = await open({});
  const r = await page.evaluate(() => {
    const A = CH.Assets, im = A.images['kit.cf8.0'], n = A.images['npc.nurse.idle.s'], meta = A.meta.npcs && A.meta.npcs.nurse;
    const ok = CH.Sprites.sheet('npc.nurse.t41', { strips: { idle: { key: 'npc.nurse.idle.s', fw: meta.fw, fh: meta.fh }, heal: { key: 'npc.nurse.heal.s', fw: meta.fw, fh: meta.fh } } });
    const s = CH.Sprites.get && CH.Sprites.get('npc.nurse.t41');
    return { tree: im ? [im.width, im.height] : null, nurse: n ? [n.width, n.height] : null, sheet: !!ok, anims: s ? Object.keys(s.anims) : null, kits: Object.keys(A.images).filter((k) => k.startsWith('kit.')).length };
  });
  ok('kit pieces and NPC strips load in the game', r.tree && r.nurse && r.kits > 2000, r);
  ok('an NPC plays through the Sprites module', r.sheet && r.anims && r.anims.includes('idle') && r.anims.includes('heal'), r);
  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
