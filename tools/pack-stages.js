'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./png.js');

const T = path.join(__dirname, '..', 'assets', 'tile sets');

function cropAndScale(fileRel, box, scale, alphaCut = 25) {
  const fullPath = path.join(T, fileRel);
  if (!fs.existsSync(fullPath)) {
    console.warn('  ! missing ' + fileRel);
    return null;
  }
  const img = P.decode(fs.readFileSync(fullPath));
  const cropped = P.crop(img, box[0], box[1], box[2], box[3]);
  const scaled = P.downscale(cropped, scale, alphaCut);
  return 'data:image/png;base64,' + P.encode(scaled).toString('base64');
}

function generateResourceIcons() {
  const icons = {};
  
  // 1. Wood icon: 16x16 logs
  const wood = P.blank(16, 16);
  // draw 3 mini logs
  const cDark = [0x50, 0x30, 0x18, 0xff];
  const cWood = [0x8b, 0x5a, 0x2b, 0xff];
  const cLight = [0xbe, 0x8a, 0x48, 0xff];
  const setPx = (img, x, y, c) => {
    if (x < 0 || x >= img.w || y < 0 || y >= img.h) return;
    const i = (y * img.w + x) * 4;
    img.data[i] = c[0]; img.data[i+1] = c[1]; img.data[i+2] = c[2]; img.data[i+3] = c[3];
  };
  for (let y = 3; y <= 6; y++) {
    for (let x = 2; x <= 13; x++) {
      const edge = (y === 3 || y === 6 || x === 2 || x === 13);
      setPx(wood, x, y, edge ? cDark : (y === 4 ? cLight : cWood));
    }
  }
  for (let y = 8; y <= 12; y++) {
    for (let x = 1; x <= 14; x++) {
      const edge = (y === 8 || y === 12 || x === 1 || x === 14);
      setPx(wood, x, y, edge ? cDark : (y === 9 ? cLight : cWood));
    }
  }
  // rope wrap
  for (let y = 3; y <= 12; y++) {
    setPx(wood, 7, y, [0xd1, 0xa9, 0x64, 0xff]);
    setPx(wood, 8, y, [0xb8, 0x86, 0x3b, 0xff]);
  }
  icons['pk.wood'] = 'data:image/png;base64,' + P.encode(wood).toString('base64');

  // 2. Scrap icon: 16x16 gear / metal nuts
  const scrap = P.blank(16, 16);
  const cMetalD = [0x3a, 0x44, 0x54, 0xff];
  const cMetalM = [0x78, 0x88, 0x9e, 0xff];
  const cMetalL = [0xc2, 0xd0, 0xe0, 0xff];
  const cx = 8, cy = 8;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const ang = Math.atan2(y - cy, x - cx);
      const tooth = Math.sin(ang * 6) > 0.3;
      const rOut = tooth ? 7 : 5.5;
      if (d <= rOut && d >= 2.2) {
        const edge = Math.abs(d - rOut) < 0.9 || Math.abs(d - 2.2) < 0.8;
        setPx(scrap, x, y, edge ? cMetalD : (y < cy ? cMetalL : cMetalM));
      }
    }
  }
  icons['pk.scrap'] = 'data:image/png;base64,' + P.encode(scrap).toString('base64');

  // 3. Stone icon: 16x16 cut stone block
  const stone = P.blank(16, 16);
  const cStoneD = [0x42, 0x47, 0x50, 0xff];
  const cStoneM = [0x73, 0x7b, 0x88, 0xff];
  const cStoneL = [0xa6, 0xb0, 0xbf, 0xff];
  for (let y = 2; y <= 13; y++) {
    for (let x = 2; x <= 13; x++) {
      const top = y === 2 || (x === 2 && y <= 8);
      const edge = y === 13 || x === 13;
      setPx(stone, x, y, top ? cStoneL : (edge ? cStoneD : cStoneM));
    }
  }
  // brick mortar line
  for (let x = 3; x <= 12; x++) setPx(stone, x, 8, cStoneD);
  for (let y = 3; y <= 7; y++) setPx(stone, 7, y, cStoneD);
  for (let y = 9; y <= 12; y++) setPx(stone, 10, y, cStoneD);
  icons['pk.stone'] = 'data:image/png;base64,' + P.encode(stone).toString('base64');

  return icons;
}

function buildStagePacks() {
  const out = {};
  console.log('Building 4 new stage asset packs & shelter props...');

  // --- WASTELAND ---
  const W_DIR = 'WASTELAND SURVIVOR KIT Post-Apocalyptic';
  out['tile.wl_ground'] = cropAndScale(path.join(W_DIR, '1. Cracked contrete tiles.png'), [44, 192, 152, 152], 0.28, 0);
  out['tile.wl_metal'] = cropAndScale(path.join(W_DIR, '2. Rusted metal floor tiles.png'), [44, 192, 152, 152], 0.28, 0);
  out['obj.car1'] = cropAndScale(path.join(W_DIR, '10. Abandoned cars.png'), [45, 232, 119, 252], 0.28);
  out['obj.car2'] = cropAndScale(path.join(W_DIR, '10. Abandoned cars.png'), [209, 232, 119, 252], 0.28);
  out['obj.car3'] = cropAndScale(path.join(W_DIR, '10. Abandoned cars.png'), [44, 542, 118, 270], 0.28);
  out['obj.carWreck'] = cropAndScale(path.join(W_DIR, '10. Abandoned cars.png'), [376, 232, 117, 252], 0.28);
  out['obj.barricade1'] = cropAndScale(path.join(W_DIR, '5. Barricades and defenses.png'), [92, 228, 272, 172], 0.25);
  out['obj.barricade2'] = cropAndScale(path.join(W_DIR, '5. Barricades and defenses.png'), [436, 224, 256, 176], 0.25);
  out['obj.chain_fence1'] = cropAndScale(path.join(W_DIR, '6. Chain link fences.png'), [80, 220, 260, 160], 0.28);
  out['obj.toxic_barrel'] = cropAndScale(path.join(W_DIR, '8. Toxic waste and barrels.png'), [44, 204, 140, 160], 0.28);
  out['obj.rubble'] = cropAndScale(path.join(W_DIR, '9. Rubble and debris.png'), [44, 204, 180, 150], 0.28);

  // --- ZOMBIE APOCALYPSE CITY & SAFEHOUSE ---
  const Z_DIR = 'Zombie Apocalypse Survival Asset Pack';
  out['tile.zombie_street'] = cropAndScale(path.join(Z_DIR, '1. Cracked street tiles.png'), [44, 192, 152, 152], 0.28, 0);
  out['tile.zombie_burned'] = cropAndScale(path.join(Z_DIR, '8. Burned Ground and fire marks.png'), [44, 192, 152, 152], 0.28, 0);
  out['obj.roadblock'] = cropAndScale(path.join(Z_DIR, '3. Barricades and blockades.png'), [80, 220, 260, 160], 0.26);
  out['obj.street_lamp'] = cropAndScale(path.join(Z_DIR, '15. Street props.png'), [80, 200, 120, 260], 0.28);

  // Safehouse Furniture
  out['obj.sh_bed'] = cropAndScale(path.join(Z_DIR, '17. Safehouse furniture.png'), [104, 244, 276, 176], 0.26);
  out['obj.sh_chair'] = cropAndScale(path.join(Z_DIR, '17. Safehouse furniture.png'), [480, 228, 136, 196], 0.26);
  out['obj.sh_lamp'] = cropAndScale(path.join(Z_DIR, '17. Safehouse furniture.png'), [708, 228, 136, 208], 0.26);
  out['obj.sh_storage'] = cropAndScale(path.join(Z_DIR, '17. Safehouse furniture.png'), [956, 220, 200, 236], 0.26);
  out['obj.sh_workbench'] = cropAndScale(path.join(Z_DIR, '17. Safehouse furniture.png'), [104, 476, 288, 188], 0.26);
  out['obj.sh_radio'] = cropAndScale(path.join(Z_DIR, '17. Safehouse furniture.png'), [452, 476, 180, 188], 0.26);
  out['obj.sh_table'] = cropAndScale(path.join(Z_DIR, '17. Safehouse furniture.png'), [764, 476, 360, 184], 0.26);
  out['obj.sh_shelf'] = cropAndScale(path.join(Z_DIR, '17. Safehouse furniture.png'), [756, 696, 180, 256], 0.26);

  // --- VOLCANIC RUINS ---
  const V_DIR = 'Volcanic Ruins';
  out['tile.volcano_floor'] = cropAndScale(path.join(V_DIR, '1. Floor tiles.png'), [44, 192, 152, 152], 0.28, 0);
  out['tile.volcano_lava'] = cropAndScale(path.join(V_DIR, '3. Lava tiles.png'), [44, 192, 152, 152], 0.28, 0);
  out['obj.volcano_pillar1'] = cropAndScale(path.join(V_DIR, '8. Volcanic pillars.png'), [124, 204, 100, 176], 0.35);
  out['obj.volcano_pillar2'] = cropAndScale(path.join(V_DIR, '8. Volcanic pillars.png'), [276, 204, 100, 176], 0.35);
  out['obj.volcano_rock'] = cropAndScale(path.join(V_DIR, '7. Rock Formations.png'), [80, 204, 180, 160], 0.32);
  out['obj.volcano_spikes'] = cropAndScale(path.join(V_DIR, '10. Spikes and harzards.png'), [80, 204, 160, 150], 0.32);

  // --- PSYCHOLOGICAL HORROR DUNGEON ---
  const D_DIR = 'Psychological Horror Dungeon';
  out['tile.dungeon_floor'] = cropAndScale(path.join(D_DIR, 'Floor tiles and wall tiles.png'), [44, 192, 152, 152], 0.28, 0);
  out['tile.dungeon_wall'] = cropAndScale(path.join(D_DIR, 'Wall tiles.png'), [44, 192, 152, 152], 0.28, 0);
  out['obj.dungeon_crate'] = cropAndScale(path.join(D_DIR, 'Barrels, crates and objects.png'), [80, 220, 140, 150], 0.32);
  out['obj.dungeon_barrel'] = cropAndScale(path.join(D_DIR, 'Barrels, crates and objects.png'), [240, 220, 130, 150], 0.32);
  out['obj.dungeon_column'] = cropAndScale(path.join(D_DIR, 'Structures and columns.png'), [80, 204, 130, 200], 0.32);
  out['obj.occult_altar'] = cropAndScale(path.join(D_DIR, 'Occult and horror elements.png'), [80, 220, 220, 170], 0.32);

  // Resource icons
  const icons = generateResourceIcons();
  Object.assign(out, icons);

  console.log(`Generated ${Object.keys(out).length} new stage & shelter assets.`);
  return out;
}

module.exports = { buildStagePacks };

if (require.main === module) {
  const packs = buildStagePacks();
  let totalBytes = 0;
  for (const k of Object.keys(packs)) {
    if (packs[k]) totalBytes += packs[k].length;
  }
  console.log(`Total base64 payload size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
}

