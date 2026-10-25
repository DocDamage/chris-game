/* The stage editor's catalogue (PLAN.md 23): every piece of every pack the game carries, as the drawer lists them.
   An entry: { key, pack, sheet, kind, type, name, anim, n }. type sorts the drawer's tabs:
     prop   stands on the floor (crates, trees, statues, houses)
     floor  lies flat (decals, rugs, inlays, floor swatches) or paints a tile
     wall   a wall's face, corner, door, window or something mounted on one
     anim   moves (a frame strip)
   The packs' own sources (the autotile blocks floors and walls are cut from, the snowflakes) are listed too, in their
   own pack, so nothing the owner gave is out of reach. */
(function (CH) {
  const CAT = (CH.EdCatalog = {});
  const FLOORK = { decal: 1, scrawl: 1, plate: 1, corpse: 1, bones: 1, skeleton: 1, debris: 1, pool: 1, rug: 1, pallet: 1, pipe: 1, roof: 1, bridge: 1, shore: 1, chasm: 1, vein: 1, room: 1, lava: 1, patch: 1, ashes: 1, ground: 1, tiles: 1, particle: 1, ripple: 1, pond: 1, lake: 1, inlay: 1 };
  const WALLK = { face: 1, corner: 1, door: 1, window: 1, hang: 1, plaque: 1, torch: 1, lantern: 1, mawdoor: 1, wall: 1, skip: 1, block: 1, castle: 1 };
  const SHEETPACK = { z: 'Zombie Apocalypse (sheets)', w: 'Wasteland Survivor (sheets)', v: 'Volcanic & Medieval (sheets)', h: 'Psychological Horror (sheets)' };
  const APACK = { fi: 'Flying Islands', mb: "Monster's Belly", ft: 'Final Tower', sb: 'Seabed', us: 'My Assets' };
  CAT.typeOf = (kind, anim) => (anim ? 'anim' : FLOORK[kind] ? 'floor' : WALLK[kind] ? 'wall' : 'prop');
  let list = null;
  CAT.all = function () {
    if (list) return list;
    const M = CH.Assets.meta || {}, IM = CH.Assets.images, PR = CH.Props, out = [], seen = new Set();
    PR.mergeKits && PR.mergeKits();
    const add = (key, pack, sheet, kind, i, extra) => {
      if (seen.has(key)) return;
      seen.add(key);
      const am = PR.meta(key) || {};
      const k = am.kind || kind || PR.kindOf(key) || '';
      const e = Object.assign({ key, pack: pack || 'Other', sheet: sheet || '', kind: k, i: i == null ? '' : i, name: (am.name || (k ? k + ' ' : '') + (sheet ? sheet + (i !== '' && i != null ? '.' + i : '') : key)).trim() }, extra || {});
      e.type = am.layer === 'floor' ? 'floor' : CAT.typeOf(k, e.anim);
      out.push(e);
    };
    for (const id of Object.keys(M.kits || {})) {
      const m = M.kits[id];
      if (!m || !m.n) continue;
      for (let i = 0; i < m.n; i++) { const key = 'kit.' + id + '.' + i; if (IM[key]) add(key, m.pack || id, id, PR.kindOf(key) || (m.kinds && m.kinds[i]) || m.roles && m.roles[i], i); }
    }
    for (const id of Object.keys(M.sheets || {})) {
      const m = M.sheets[id];
      for (let i = 0; i < m.n; i++) { const key = 'sh.' + id + '.' + i; if (IM[key]) add(key, SHEETPACK[id[0]] || 'Sheets', id, PR.kindOf(key), i); }
    }
    const LD = M.lands || {};
    for (const id of Object.keys(LD.sheets || {})) {
      const m = LD.sheets[id];
      if (!m.kinds) { if (IM['kit.' + id]) add('kit.' + id, m.pack || 'Final Tower', id, PR.kindOf('kit.' + id) || 'landmark', ''); continue; }
      for (let i = 0; i < m.n; i++) { const key = 'kit.' + id + '.' + i; if (IM[key]) add(key, m.pack, id, m.kinds[i], i); }
    }
    for (const name of Object.keys(LD.anims || {})) {
      const a = LD.anims[name], key = 'anim.' + name;
      if (!IM[key + '.0']) continue;
      add(key, APACK[name.slice(0, 2)] || 'Animations', name.slice(0, 2), a.kind, name.slice(3), { anim: true, n: a.n, fps: a.fps });
    }
    // the Valley Ruin's objects (sprites of their own)
    if (CH.SetPieces && CH.SetPieces.OBJ) for (const [kind, keys] of Object.entries(CH.SetPieces.OBJ)) for (const k of keys) if (CH.Sprites.has(k)) add(k, 'Valley Ruin', 'obj', kind, k.slice(4), { obj: true });
    // pieces cut whole (a giant tree, a portal, a gatehouse) and any other image of a pack not listed above
    for (const key of Object.keys(IM)) {
      if (seen.has(key) || !/^(kit|sh)\./.test(key) || /\.\d+$/.test(key) && seen.has(key)) continue;
      const parts = key.split('.');
      if (parts[0] === 'kit' && /^\d+$/.test(parts[parts.length - 1]) && M.kits && M.kits[parts[1]]) continue; // (a kit piece already listed)
      const id = parts[1];
      const pack = (M.kits && M.kits[id] && M.kits[id].pack) || (LD.sheets && LD.sheets[id] && LD.sheets[id].pack) || packOfPrefix(id);
      add(key, pack, id, PR.kindOf(key) || 'landmark', parts.slice(2).join('.'));
    }
    // campfires (js/fires.js): each colour, burning or smoking
    for (const key of Object.keys(IM)) { const m = /^prop\.camp(smoke)?\.([a-z]+)$/.exec(key); if (m) add('fire.' + m[2] + (m[1] ? '.smoke' : ''), 'Campfires', 'fire', 'campfire', m[2] + (m[1] ? ' smoke' : ''), { img: key }); }
    list = out;
    return out;
  };
  const PREFIX = { cf: 'Creepy Forest', fk: 'Frozen Kingdom', hv: 'Haunted Victorian City', da: 'Dungeon Asset Pack', gc: 'Crimson Gothic Castle', ul: 'Undead Land Objects', sb: 'Seabed', fi: 'Flying Islands', ft: 'Final Tower', mb: "Monster's Belly", zs: 'Zombie Apocalypse Survival', wl: 'Wasteland Survivor Kit', vr: 'Volcanic Ruins', ph: 'Psychological Horror Dungeon', us: 'My Assets' };
  function packOfPrefix(id) { return PREFIX[id.slice(0, 2)] || 'Other'; }
  CAT.reset = () => { list = null; };
  CAT.packs = () => [...new Set(CAT.all().map((e) => e.pack))].sort();
  CAT.kinds = () => [...new Set(CAT.all().map((e) => e.kind).filter(Boolean))].sort();
  CAT.get = (key) => CAT.all().find((e) => e.key === key) || null;

  /* the image a piece is drawn from (its first frame) */
  CAT.image = function (key) {
    const IM = CH.Assets.images;
    if (key.startsWith('fire.')) { const [, c, sm] = key.split('.'); return IM['prop.camp' + (sm ? 'smoke' : '') + '.' + c] || null; }
    if (IM[key]) return IM[key];
    if (IM[key + '.0']) return IM[key + '.0'];
    if (CH.Sprites.has(key)) return CH.Sprites.get(key).frames[0];
    return null;
  };
  /* its frames, for a live preview */
  CAT.frames = function (key) {
    const IM = CH.Assets.images, out = [];
    if (IM[key + '.0']) { for (let i = 0; IM[key + '.' + i]; i++) out.push(IM[key + '.' + i]); return out; }
    const im = CAT.image(key);
    return im ? [im] : [];
  };

  /* the search: words match the name, kind, pack or sheet; kind:x pack:x sheet:x type:x narrow; -word excludes */
  CAT.filter = function (entries, q) {
    const terms = (q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return entries;
    return entries.filter((e) => {
      const hay = (e.key + ' ' + e.name + ' ' + e.kind + ' ' + e.pack + ' ' + e.sheet + ' ' + e.type).toLowerCase();
      for (let t of terms) {
        const neg = t[0] === '-';
        if (neg) t = t.slice(1);
        if (!t) continue;
        let hit;
        const m = /^(kind|pack|sheet|type|key):(.*)$/.exec(t);
        if (m) hit = String(e[m[1]] || '').toLowerCase().includes(m[2]);
        else hit = hay.includes(t);
        if (hit === neg) return false;
      }
      return true;
    });
  };
})(window.CH);
