/* Every remaining sheet of the four tileset packs, sliced into single pieces (see slice.js) and packed as images
     sh.<id>.<n>      the piece, scaled by SCALE, trimmed
   meta.sheets[id] = { pack, name, role, biomes, n, sizes: [[w, h], ...] }
   Roles drive how js/sheets.js uses them:
     solid  blocking decor (crates, statues, furniture, wall ruins ...)     deco   small walk-through decor (trash, glass, signs)
     decal  painted on the floor (cracks, blood, bones, burn marks ...)     light  decor that glows (lamps, fire barrels, braziers)
     corner stone frames for the inside corners of rectangular rooms (mirrored per corner)
     gate   doors, gates, arches and stairs for the entrance and the exit   hazard decor of traps and geysers (solid, not destroyable)
   Usage: build-assets.js calls packSheets(); `node tools/pack-sheets.js` lists what each sheet gives. */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./png');
const S = require('./slice');
const { resize } = require('./pack-walls');

const ROOT = path.resolve(__dirname, '..', 'assets', 'tile sets');
const SCALE = 0.28;
const H = 'Psychological Horror Dungeon', V = 'Volcanic Ruins', W = 'WASTELAND SURVIVOR KIT Post-Apocalyptic', Z = 'Zombie Apocalypse Survival Asset Pack';
const CRYPT = ['dungeon', 'office', 'glitch'];

/* id, pack, file, role, biomes */
const SHEETS = [
  ['h_corner', H, 'Corner tiles!.png', 'corner', CRYPT],
  ['h_decor', H, 'Decor and details.png', 'deco', CRYPT],
  ['h_doors', H, 'Doors and Arches!.png', 'gate', CRYPT],
  ['h_furn', H, 'Furniture and fixtures.png', 'solid', CRYPT],
  ['h_jars', H, 'Jars, pots and items.png', 'solid', CRYPT],
  ['h_fx', H, 'Lightning and fx.png', 'light', CRYPT],
  ['h_psych', H, 'Psychological elements.png', 'deco', CRYPT],
  ['h_special', H, 'Special tiles.png', 'decal', CRYPT],
  ['h_statues', H, 'Statues and figures.png', 'solid', CRYPT],
  ['h_traps', H, 'Traps and mechanism.png', 'hazard', CRYPT],
  ['h_details', H, 'Wall and floor details.png', 'decal', CRYPT],
  ['v_chains', V, '11. Chains and hooks.png', 'deco', ['volcano']],
  ['v_gates', V, '12. Iron Gates and doors.png', 'gate', ['volcano']],
  ['v_decor', V, '13. Decorations.png', 'solid', ['volcano']],
  ['v_embers', V, '14. Embers and particles.png', 'light', ['volcano']],
  ['v_cracks', V, '15. Cracked floor details.png', 'decal', ['volcano']],
  ['v_geysers', V, '16. Lava geysers.png', 'hazard', ['volcano']],
  ['v_bridges', V, '17. Bridges and walkways.png', 'decal', ['volcano']],
  ['v_stairs', V, '18. Stairs and lifts.png', 'gate', ['volcano']],
  ['v_misc', V, '19. Miscellaneous.png', 'solid', ['volcano']],
  ['v_env', V, '20. Environment Details.png', 'deco', ['volcano']],
  ['v_flows', V, '4. Lava flows.png', 'decal', ['volcano']],
  ['v_pools', V, '5. Lava pools.png', 'decal', ['volcano']],
  ['v_obsidian', V, '6. Rock obsidian tiles.png', 'solid', ['volcano']],
  ['v_firetraps', V, '9. Fire Traps.png', 'hazard', ['volcano']],
  ['w_gates', W, '11. Industrial doors and gates.png', 'gate', ['wasteland']],
  ['w_ruins', W, '12. Ruined building parts.png', 'solid', ['wasteland']],
  ['w_pipes', W, '13. Pipes and wiring.png', 'deco', ['wasteland']],
  ['w_trash', W, '14. Trash and junk props.png', 'deco', ['wasteland']],
  ['w_trees', W, '15. Dead Trees and dry plants.png', 'solid', ['wasteland']],
  ['w_loot', W, '16. Loot and survival props.png', 'solid', ['wasteland']],
  ['w_signs', W, '17. Warning Signs and road props.png', 'solid', ['wasteland']],
  ['w_lights', W, '18. Light sources and fire barrels.png', 'light', ['wasteland']],
  ['w_crystals', W, '19. Toxic crystals and mutations.png', 'solid', ['wasteland']],
  ['w_hazard', W, '20. Special Hazard Tiles.png', 'decal', ['wasteland']],
  ['w_broken', W, '3. Broken wall tiles.png', 'solid', ['wasteland']],
  ['w_burnt', W, '7. Burnt ground tiles.png', 'decal', ['wasteland']],
  ['z_bodies', Z, '10. Zombie bodies and bones.png', 'decal', ['zombie']],
  ['z_survival', Z, '11. Survival props.png', 'solid', ['zombie']],
  ['z_supplies', Z, '12. Weapons and supplies.png', 'deco', ['zombie']],
  ['z_fences', Z, '13. Fences and wire.png', 'solid', ['zombie']],
  ['z_signs', Z, '14. Warning Signs.png', 'solid', ['zombie']],
  ['z_trees', Z, '16. Dead trees and plants.png', 'solid', ['zombie']],
  ['z_lights', Z, '18. Lights and emergency props.png', 'light', ['zombie']],
  ['z_growths', Z, '19. Toxic and infection growths.png', 'solid', ['zombie']],
  ['z_hazard', Z, '20. Special hazard tiles.png', 'decal', ['zombie']],
  ['z_doors', Z, '4. Doors and entrances.png', 'gate', ['zombie']],
  ['z_windows', Z, '5. Windows and broken glass.png', 'deco', ['zombie']],
  ['z_blood', Z, '6. Blood and infection tiles.png', 'decal', ['zombie']],
  ['z_trash', Z, '7. Trash and debris.png', 'deco', ['zombie']],
  ['z_cars', Z, '9. Abandoned cards.png', 'solid', ['zombie']],
  ['z_walls', Z, '2. Broken building walls.png', 'solid', ['zombie']],
];

function packSheets() {
  const img = {};
  const meta = {};
  for (const [id, pack, file, role, biomes] of SHEETS) {
    const f = path.join(ROOT, pack, file);
    if (!fs.existsSync(f)) continue;
    const d = P.decode(fs.readFileSync(f));
    const comps = S.components(d, { gap: 2, minArea: 2500 }).filter((r) => !(r.y + r.h < d.h * 0.2 && r.w > d.w * 0.35) && r.y > d.h * 0.1 && r.h >= 40 && r.w >= 40 && r.w < d.w * 0.9);
    const sizes = [];
    comps.forEach((r, i) => {
      const piece = S.cut(d, r);
      const w = Math.max(8, Math.round(piece.w * SCALE)), h = Math.max(8, Math.round(piece.h * SCALE));
      img['sh.' + id + '.' + i] = 'data:image/png;base64,' + P.encode(resize(piece, w, h)).toString('base64');
      sizes.push([w, h]);
    });
    meta[id] = { pack, name: file.replace(/\.png$/, ''), role, biomes, n: sizes.length, sizes };
  }
  return { img, meta };
}
module.exports = { packSheets, SHEETS };
if (require.main === module) { const r = packSheets(); for (const k of Object.keys(r.meta)) console.log(k, r.meta[k].role, r.meta[k].n, JSON.stringify(r.meta[k].sizes.slice(0, 4))); }
