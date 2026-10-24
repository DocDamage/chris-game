/* CHAOS.exe - the prop catalogue and prop collision (PLAN.md section 15, requests 1, 9 and 12).
   Every piece sliced from the tileset sheets (tools/pack-sheets.js) was looked at and given a kind: crate, barrel,
   wall, fence, car, lamp, corpse ... The kind decides how big it is drawn (the sheets were drawn at different
   scales: a backpack was as big as a crate), whether it blocks and with what footprint (a box at its base: a fence
   blocks its whole length, a lamp post only its foot), whether it glows, and which set pieces may use it
   (js/setpieces.js builds camps, ruins, graveyards ... from kinds, so a scene is made of things that belong together).
   Flat things (decals, rugs, litter, bones, pipes on the floor) never block; everything standing up does. */
(function (CH) {
  'use strict';
  const U = CH.U;
  const S = CH.Sprites;
  const PR = (CH.Props = {});

  /* kind: s = draw scale of the sliced piece, box = [footprint width as a share of the drawn width, depth in px]
     (null = walk-through), flags: j jumpable, d destructible (res = what it drops), l light, hang = wall mounted,
     tree = choppable tree, fx = effect sprite drawn additively */
  const K = (s, box, o) => Object.assign({ s, box }, o || {});
  const KIND = {
    crate: K(0.6, [0.82, 9], { j: 1, d: 1, res: 'wood' }),
    case: K(0.58, [0.86, 8], { j: 1, d: 1, res: 'scrap' }),
    barrel: K(0.56, [0.72, 8], { j: 1, d: 1, res: 'scrap' }),
    toxbarrel: K(0.6, [0.72, 8], { j: 1, d: 1, res: 'scrap', boom: 1 }),
    sack: K(0.58, [0.62, 6], { j: 1, d: 1, res: 'wood' }),
    pot: K(0.48, [0.6, 5], { j: 1, d: 1, res: 'stone' }),
    item: K(0.42, null),
    pack: K(0.52, null),
    trash: K(0.62, [0.7, 8], { j: 1, d: 1, res: 'scrap' }),
    debris: K(0.6, null),
    bin: K(0.55, [0.74, 7], { j: 1, d: 1, res: 'scrap' }),
    dumpster: K(0.62, [0.92, 12], { j: 1, res: 'scrap' }),
    table: K(0.62, [0.9, 10], { j: 1, d: 1, res: 'wood' }),
    chair: K(0.56, [0.6, 6], { j: 1, d: 1, res: 'wood' }),
    bed: K(0.58, [0.92, 14], { j: 1, d: 1, res: 'wood' }),
    shelf: K(0.6, [0.92, 8], { d: 1, res: 'wood' }),
    sofa: K(0.6, [0.92, 10], { j: 1, d: 1, res: 'wood' }),
    rug: K(0.7, null),
    statue: K(0.6, [0.55, 10], { d: 1, res: 'stone' }),
    smallstatue: K(0.62, [0.6, 7], { j: 1, d: 1, res: 'stone' }),
    pillar: K(0.72, [0.62, 8], { res: 'stone' }),
    obelisk: K(0.75, [0.5, 7], { res: 'stone' }),
    wall: K(0.82, [0.96, 10], { res: 'stone' }),
    fence: K(0.78, [1, 6], { d: 1, res: 'scrap' }),
    wire: K(0.62, [0.92, 6], { j: 1, d: 1, res: 'scrap', hurt: 1 }),
    barricade: K(0.6, [0.95, 8], { j: 1, d: 1, res: 'scrap' }),
    sandbag: K(0.56, [0.95, 10], { j: 1, res: 'stone' }),
    spikes: K(0.6, [0.86, 8], { d: 1, res: 'wood' }),
    tires: K(0.56, [0.8, 8], { j: 1, res: 'scrap' }),
    car: K(1.12, [0.92, 0.42], { res: 'scrap', d: 1, hp: 120 }), // box depth below 1 = share of the drawn height
    carv: K(0.95, [0.86, 0.7], { res: 'scrap', d: 1, hp: 120 }),
    tree: K(1.05, [0.24, 6], { tree: 1 }),
    bigtree: K(0.78, [0.22, 7], { tree: 1 }),
    deadtree: K(1.05, [0.22, 6], { tree: 1 }),
    shrub: K(0.72, null, { sway: 1 }),
    stump: K(0.62, [0.62, 6], { j: 1, d: 1, res: 'wood' }),
    log: K(0.66, [0.84, 6], { j: 1, d: 1, res: 'wood' }),
    rock: K(0.72, [0.76, 8], { j: 1, d: 1, res: 'stone' }),
    boulder: K(0.82, [0.82, 12], { d: 1, res: 'stone', hp: 90 }),
    lavarock: K(0.78, [0.72, 10], { l: 1, res: 'stone' }),
    crystal: K(0.66, [0.6, 8], { l: 1, d: 1, res: 'stone' }),
    reactor: K(0.62, [0.8, 9], { l: 1, d: 1, res: 'scrap' }),
    growth: K(0.72, [0.6, 8], { d: 1, res: 'wood' }),
    mushroom: K(0.62, null, { sway: 1 }),
    pool: K(0.78, null),
    plaque: K(0.45, [0.6, 4], { j: 1, d: 1, res: 'scrap' }),
    sign: K(0.6, [0.36, 4], { d: 1, res: 'scrap' }),
    cone: K(0.58, [0.55, 5], { j: 1, d: 1, res: 'scrap' }),
    streetbit: K(0.62, [0.64, 6], { j: 1, d: 1, res: 'scrap' }),
    pole: K(0.9, [0.3, 4], { res: 'scrap' }),
    lamp: K(0.92, [0.3, 4], { l: 1, res: 'scrap' }),
    flood: K(0.62, [0.5, 6], { l: 1, d: 1, res: 'scrap' }),
    lantern: K(0.5, null, { l: 1 }),
    firebarrel: K(0.6, [0.7, 8], { l: 1, j: 1, res: 'scrap' }),
    brazier: K(0.66, [0.6, 7], { l: 1, res: 'stone' }),
    torch: K(0.78, [0.3, 4], { l: 1 }),
    candles: K(0.52, null, { l: 1 }),
    campfire: K(0.85, [0.62, 8], { l: 1, j: 1 }),
    altar: K(0.68, [0.86, 10], { j: 1, res: 'stone' }),
    grave: K(0.72, [0.7, 6], { j: 1, d: 1, res: 'stone' }),
    cauldron: K(0.6, [0.7, 8], { l: 1, j: 1, res: 'scrap' }),
    anvil: K(0.62, [0.8, 6], { j: 1, res: 'scrap' }),
    cage: K(0.62, [0.8, 8], { d: 1, res: 'scrap' }),
    banner: K(0.76, [0.3, 4], { d: 1, res: 'wood' }),
    signpost: K(0.7, [0.3, 4], { d: 1, res: 'wood' }),
    machine: K(0.58, [0.9, 10], { d: 1, res: 'scrap', hp: 70 }),
    trap: K(0.58, [0.8, 8], { j: 1 }),
    geyser: K(0.68, [0.55, 8], { l: 1, hurt: 1 }),
    firetrap: K(0.68, [0.92, 6], { l: 1, hurt: 1 }),
    spike: K(0.66, [0.5, 6], { res: 'stone' }),
    pipe: K(0.6, null),
    pipestand: K(0.62, [0.5, 6], { d: 1, res: 'scrap' }),
    hang: K(0.6, null, { hang: 1 }),
    window: K(0.62, null, { hang: 1 }),
    bones: K(0.62, null),
    corpse: K(0.7, null),
    skeleton: K(0.66, null),
    scrawl: K(0.7, null),
    decal: K(1, null),
    patch: K(0.8, null),
    ashes: K(0.8, null),
    plate: K(0.62, null),
    well: K(0.75, [0.82, 10], { res: 'stone' }),
    bench: K(0.62, [0.9, 6], { j: 1, d: 1, res: 'wood' }),
    pallet: K(0.6, null),
    rubble: K(0.68, [0.74, 8], { j: 1, d: 1, res: 'stone' }),
    door: K(0.75, null, { gate: 1 }),
    corner: K(1, null),
    flame: K(0.6, null, { l: 1, fx: 1 }),
    smoke: K(0.7, null, { fx: 1 }),
    skip: K(1, null, { skip: 1 }),
    // kinds the newer kits brought (PLAN.md 18, K2)
    crypt: K(1, [0.86, 0.4], { res: 'stone', hp: 140 }), // a mausoleum: its front half blocks
    hut: K(1, [0.9, 0.42], { res: 'wood' }),
    flower: K(0.6, null, { sway: 1 }),
    coffin: K(0.6, [0.7, 7], { j: 1, d: 1, res: 'wood' }),
    arch: K(1, null), // vine arches: walked through
    portal: K(1, [0.8, 0.3], { l: 1, res: 'stone' }),
    roof: K(1, null, { skip: 1 }), // cabin roofs are only used inside built cabins (js/setpieces.js)
    landmark: K(1, [0.3, 10], { res: 'wood' }), // the giant twisted tree: one per Dead Wood stage, not choppable
    cliff: K(1, [0.92, 0.45], { res: 'stone' }), // a glacier cliff block: its icicle face blocks
    stall: K(1, [0.9, 0.38], { res: 'wood' }), // market stalls and racks
    house: K(1, [0.9, 0.4], { res: 'wood' }), // a whole house (Frozen Kingdom 7)
    castle: K(1, [0.95, 0.35], { res: 'stone', hp: 200 }), // ice castle wall sections and towers
    bridge: K(1, null, { skip: 1 }), // bridges and stairs wait for the height work (K7)
    particle: K(1, null, { skip: 1 }), // snowflakes and footprints are drawn by code (js/atmos.js)
    throne: K(1, [0.8, 0.3], { res: 'stone' }), // Gothic thrones (Victorian 20): the cult house and boss halls
    // the packs of 2026-10-24 (PLAN.md 19, W2)
    face: K(1, null, { skip: 1 }), // wall faces: drawn on the walls by js/level.js, not props
    ground: K(1, null, { skip: 1 }), // floor tiles: js/level.js
    room: K(1, null), // a whole castle hall painted into the floor
    lava: K(1, null), // a lava inlay
    block: K(1, [0.86, 0.4], { res: 'stone' }), // a castle stone feature: plinths, steps, fountains, fireplaces
  };
  PR.KIND = KIND;

  /* what each piece is: sheet -> kind -> index list ('0-5,7') */
  const CAT = {
    z_survival: { case: '1,3,5,11,12,16,17,19,20,22,27,31', crate: '30', pack: '0,15,29', lantern: '24', item: '2,4,6-10,13,14,18,21,23,25,26,28,32-48' },
    z_supplies: { case: '17-20,36,38,39', crate: '22,23,34,35,37,42', item: '0-16,21,24-33,40,41' },
    z_cars: { car: '0-34' },
    z_signs: { plaque: '0-34' },
    z_fences: { fence: '0-17', wire: '18-22' },
    z_trees: { deadtree: '0-2,4-13', shrub: '3,14,15,20-27,38-43', stump: '16,18,19,35,36', log: '17,34,37', streetbit: '28-30', decal: '31-33' },
    z_lights: { machine: '0,1', flood: '2,3', crate: '4,6,11', barrel: '5', bin: '7', barricade: '8', lamp: '9,10' },
    z_growths: { growth: '0-4,6-15,18-20,22,23', pool: '5,16,17,21' },
    z_walls: { wall: '0-9', pillar: '7,8', door: '10,11' },
    z_trash: { trash: '0,1,6-20', debris: '2-5' },
    z_windows: { window: '0-26' },
    z_doors: { door: '0-9' },
    z_bodies: { skip: '0-6', corpse: '7,8,10-15,19,24,31,33', skeleton: '9,18,20-23,25', bones: '16,17,26-30,32,34,35' },
    z_blood: { decal: '0-17' },
    z_hazard: { plate: '0-29' },
    z_barricades: { sandbag: '0,19', barricade: '1-4,7-10,12-15,18,20-23', tires: '5,6', spikes: '11', barrel: '16', wire: '17' },
    z_burned: { decal: '0-41' },
    z_street: { sign: '0', pole: '1,2', lamp: '3,4', streetbit: '5-8,24-34', cone: '9-12', barricade: '13-15', shelf: '16', fence: '17-19', bench: '20', bin: '21,22,41', crate: '23', debris: '35-39', pallet: '40', trash: '42', tires: '43' },
    z_furniture: { table: '0,11-13', chair: '1,2', shelf: '3,7,9,10,14', sofa: '4,5', bed: '6', rug: '8' },
    w_loot: { case: '0-8,12-15,26,27', pack: '9-11,16-19,21,33', sack: '20', crate: '22,24', pot: '23', item: '25,28-32' },
    w_ruins: { wall: '0-5,7-12,14-16,18', rubble: '6,13,17,19' },
    w_signs: { sign: '0-7,9,15', pole: '8,19', barricade: '10,11,17', cone: '12,16', streetbit: '14,22', plaque: '13,18,20,21', barrel: '23' },
    w_lights: { lamp: '0-8,10-12', flood: '9,24,25', lantern: '13-23', firebarrel: '26-37,43', brazier: '38-42', item: '44-46,48', machine: '47,49' },
    w_broken: { wall: '0-11', rubble: '12-17' },
    w_trash: { bin: '0,1,6,7', trash: '2,14', crate: '3,4,12', dumpster: '5', tires: '8', debris: '9-11,13' },
    w_trees: { bigtree: '0-3', stump: '4', deadtree: '5', shrub: '6,7' },
    w_crystals: { crystal: '0-2,15,18', reactor: '3-14,16,17' },
    w_pipes: { pipe: '0-8,11,12', fence: '9,10' },
    w_gates: { door: '0-17' },
    w_hazard: { plate: '0-14' },
    w_burnt: { decal: '0-27' },
    w_scrap: { fence: '0-16' },
    w_barricades: { barricade: '0,1,8,10,13-15', sandbag: '2,16', spikes: '3,4,9,11', tires: '5-7', wire: '12' },
    w_toxic: { toxbarrel: '0-22', pipestand: '23-26', machine: '27,29,30', crate: '28,32,40', item: '31', pool: '33-38', barrel: '39' },
    w_rubble: { rubble: '0-17' },
    w_cars: { carv: '0-19' },
    w_fences: { fence: '0-8' },
    v_misc: { ashes: '38,39', bones: '0-6', barrel: '7,8,26', debris: '9-12,20,21,42,45-47,61-64', item: '13-16,22,23', sack: '17', crate: '18', case: '19', anvil: '24', machine: '25,43,44', torch: '27,28', lantern: '29,30', cauldron: '31', pot: '32-35', campfire: '36,37', rock: '40,60', spike: '41', cage: '48,49', signpost: '50,51', banner: '52,53', smallstatue: '54,55', grave: '56-59' },
    v_decor: { brazier: '0-2,6,9-11,22', lantern: '3,7,15,24,25', altar: '4,33', cauldron: '5,23', smallstatue: '8,13,31', campfire: '12', machine: '14', banner: '16,17,27', candles: '18-21,28,29,34', obelisk: '26,30', pot: '32', decal: '35' },
    v_env: { deadtree: '0', tree: '1,2', rock: '3,4,23-26', lavarock: '5-15', shrub: '16,29,31', patch: '17,18,30', skeleton: '20', mushroom: '19', smallstatue: '21', rubble: '22', stump: '27', log: '28', signpost: '32', fence: '33', barrel: '34', crate: '35', pot: '36,37', lamp: '38', brazier: '39', well: '40' },
    v_obsidian: { boulder: '0-35' },
    v_chains: { hang: '0-25' },
    v_embers: { flame: '0-10', smoke: '11-16', debris: '17-24' },
    v_geysers: { geyser: '0-20' },
    v_firetraps: { firetrap: '0-24' },
    v_gates: { door: '0-30' },
    v_rocks: { lavarock: '0-23' },
    v_pillars: { pillar: '0-8,27-35', obelisk: '9-26' },
    v_spikes: { plate: '0-3,10,11', spike: '4-9,12-29,32,35-37', rock: '30', item: '31,38,39', brazier: '33,34' },
    v_cracks: { decal: '0-40' },
    v_flows: { decal: '0-40' },
    v_pools: { decal: '0-40' },
    v_bridges: { decal: '0-40' },
    v_stairs: { door: '0-20' },
    h_furn: { bed: '0-2', shelf: '3,8,10,20', chair: '4,5,7,9', table: '6,11-19,21,22', smallstatue: '23' },
    h_jars: { item: '0-36,47', bones: '37-44', hang: '45,46', plaque: '48' },
    h_statues: { statue: '0-11', smallstatue: '12,13,16', rubble: '14,15', wall: '17' },
    h_decor: { machine: '0,1', hang: '2-6,8-12,14,17,20,23,24', barrel: '7', pot: '13', cage: '15', item: '16', debris: '18', crate: '19', table: '21', sack: '22' },
    h_psych: { scrawl: '0-22' },
    h_fx: { hang: '0-5,7-11', candles: '6,12,13', smallstatue: '14', smoke: '15-17', flame: '18-20', decal: '21,22' },
    h_traps: { trap: '0-23' },
    h_special: { decal: '0-19' },
    h_details: { decal: '0-38' },
    h_corner: { corner: '0-39' },
    h_doors: { door: '0-19' },
    h_barrels: { barrel: '0,1,3,6-8,14,26,27', crate: '2,4,5,9-12,21,24,25', trash: '13,19,22', sack: '15,17,18', case: '16,20', machine: '23,28' },
    h_occult: { candles: '0,6,7', item: '1-5,8,12,13,16,23,25,26', decal: '9-11', altar: '14,15,20,27', smallstatue: '17,18,21,24', hang: '19', crystal: '22', brazier: '28' },
    h_struct: { pillar: '0-2,11', wall: '3-10,12-15' },
  };
  PR.CAT = CAT;
  /* the newer packs cut by tools/pack-kits.js ('kit.<sheet>.<n>', already at game scale), PLAN.md 18 K1/K2.
     Family c = Creepy Forest. The ground swatches of cf1 / cf2 are floor tiles (js/level.js), not props. */
  const KCAT = {
    cf1: { boulder: '19', smallstatue: '20,21' },
    cf2: { shrub: '5' },
    cf3: { patch: '0-38' },
    cf4: { fence: '0-40' },
    cf5: { wall: '0-33,40,41', door: '34-39' },
    cf6: { roof: '0-27' },
    cf7: { door: '0-4,6,8,9', window: '5,7', debris: '10-25' },
    cf8: { deadtree: '0-6', stump: '7,8,10,15', log: '9,11,12,16', debris: '13,14,24,26', boulder: '17', rock: '18-23,25', mushroom: '27,29', shrub: '28' },
    cf9: { shrub: '0-2,22', arch: '3,5-7', bigtree: '4', stump: '8,10', mushroom: '9,12,13,21,23', growth: '11', debris: '14-17', rock: '18-20' },
    cf10: { grave: '0-9,13-18,29-31,75,77', statue: '10-12', crypt: '19-24', patch: '25-28', door: '32-34,71', altar: '35,36,78', coffin: '37-41', debris: '42', bones: '43-47', smallstatue: '48-51', pillar: '52,73,74', candles: '53-58', flower: '59-64', decal: '65-67', fence: '68-70,72', obelisk: '76' },
    cf11: { grave: '0-7,9-17,34-40', obelisk: '8', crypt: '18-24', altar: '25-27', coffin: '28-32', patch: '33', fence: '41', door: '42' },
    cf12: { decal: '0-13,16-22,24-31', candles: '14,15,32-34', item: '23,35-43' },
    cf13: { lantern: '0-9', torch: '10-16', lamp: '17-19', brazier: '20-25,39', campfire: '26,27', cauldron: '28', candles: '29-38' },
    cf14: { sign: '0-26', signpost: '27-31,33-39,43,46,49', lamp: '32', grave: '40,59,60', spikes: '41,44,47', fence: '42,57', bones: '45,48,61', hang: '50-54,56', banner: '55', pole: '58' },
    cf15: { bones: '0-3,10-36,45-53', skeleton: '4-9', spike: '37-39,43', pole: '40,41', fence: '42', candles: '44' },
    cf16: { hang: '0-11,17', cage: '12-16,42-46', item: '18-38', trap: '39-41', pole: '47-49', table: '50', fence: '51' },
    cf17: { well: '0-24,30-32,40-43', barrel: '25,26', pipestand: '27-29', plate: '33-37', pool: '38,39' },
    cf18: { barrel: '0,2,6,7,9', bench: '1,5,20', carv: '3,4', sign: '8', chair: '10,11', table: '12', pole: '13,19', hut: '14', crate: '15,17', fence: '16,22', signpost: '18', stump: '21,23', debris: '24' },
    cf19: { hang: '0-2,5', banner: '3,4,6', decal: '7', statue: '8,11', altar: '9,10,12,14,15', candles: '13,18,20', spike: '16,17', grave: '19' },
    cf20: { portal: '0,1,4', statue: '2', altar: '3,7,13', campfire: '5', door: '6,8,10', pillar: '9', torch: '11,12' },
    // family f = Frozen Kingdom (PLAN.md 18, K3)
    fk1: { patch: '4,12' },
    fk2: { patch: '0-27' },
    fk3: { pool: '0-17' },
    fk4: { cliff: '0-11', spike: '12-18' },
    fk5: { castle: '0-23', door: '24', banner: '25,26' },
    fk6: { roof: '0-2,8-16,19,20,22,23', hut: '3-7,17,18,21,31,32', pillar: '24,25', obelisk: '26-30', banner: '33' },
    fk7: { house: '0-5', hut: '6-22', fence: '23', lamp: '24', banner: '25', tree: '26,32-34', barrel: '27', crate: '28', carv: '29', log: '30', well: '31', brazier: '35', pillar: '36' },
    fk8: { bridge: '0-13,21-25', plate: '14-20' },
    fk9: { crystal: '0-24' },
    fk10: { deadtree: '0-3,16,20,21', tree: '4-15,17-19,22-24' },
    fk11: { fence: '0-18,29-71', door: '19-28' },
    fk12: { torch: '0-4,14-26', brazier: '5-13,27-31,35', lantern: '32-34' },
    fk13: { arch: '0,1,11,12', pillar: '2-5,9,10,14,15,35,36', wall: '6-8,13,32-34', rubble: '16-26,30,31,37-40', debris: '27-29' },
    fk14: { decal: '0-15', plate: '16-31' }, // round rune medallions as the biome's floor decals, square ones as plates
    fk15: { pillar: '0-29' },
    fk16: { stall: '0-10,15-17,19', cauldron: '11', brazier: '12', carv: '13,14', case: '18' },
    fk17: { hut: '0', campfire: '1', pole: '2', fence: '3,5', shelf: '4', table: '6,7', barrel: '8-13' },
    fk18: { particle: '0-23' },
    fk19: { statue: '0-6,18,20,21,24,29', obelisk: '7-9', crystal: '10,14,17', grave: '11,25', pillar: '12,13,28', well: '15,23', brazier: '16', portal: '19', lamp: '22', altar: '26', plate: '27', arch: '30' },
    // family g = Haunted Victorian City (PLAN.md 18, K4); sheets 3-8 also carry the title's lamp and carriage
    hv1: { patch: '7,9,17,29,31-39', plate: '40,41,44', boulder: '42,43' },
    hv2: { patch: '0-47' },
    hv3: { lamp: '0', carv: '1', wall: '2-11,16-18', pillar: '12-14,19-22,29,30', roof: '15,23-28,31' },
    hv4: { lamp: '0', carv: '1', roof: '2-26' },
    hv5: { carv: '0', door: '1-3,8-21', arch: '4-7,22,23' },
    hv6: { carv: '0', window: '1-45' },
    hv7: { lamp: '0,2-44', carv: '1' },
    hv8: { lamp: '0', carv: '1', fence: '2-25', door: '26-40' },
    hv9: { carv: '0-21' },
    hv10: { grave: '0-17,20,21,25', crypt: '18', rock: '19,26', patch: '22', item: '23', debris: '24,27' },
    hv11: { crypt: '0-5,11-16,25-28,30', grave: '6-10,17-24,37-39', door: '29,31,32', arch: '33', altar: '34,35', patch: '36', plate: '40', debris: '41-43,46,47', decal: '44,45', item: '48' },
    hv12: { statue: '0-7,9-13,16,20', grave: '8,17,18,21,24,32,33,36', pillar: '14,15,30', portal: '19', obelisk: '22,23,25,29', altar: '26-28,31', crypt: '34,35', patch: '37', rubble: '38', door: '39,40' },
    hv13: { stall: '0-8,52', table: '9-14,22,25,26,37', pole: '15,51', shelf: '16,36', crate: '17,20,23,30-33,40', signpost: '18,49', cage: '19,50', barrel: '21,24,35,39', sign: '27,28,47,48', banner: '29', sack: '34', cauldron: '38', case: '41', lantern: '42-44,46', lamp: '45' },
    hv14: { sofa: '0,3,17', chair: '1,2,9-12', shelf: '4-8,19,21,24,26,40', table: '13-16,18,20,23,33', machine: '22', bed: '25', pole: '27', crate: '28', case: '29,30,36', item: '31,32,43', cage: '34', debris: '35', bin: '37,48', lamp: '38,46,47', shrub: '39', hang: '41,42', stall: '44', sign: '45', bench: '49', plate: '50' },
    hv15: { pipe: '0-6,15-35', plate: '7-14,36-43', bridge: '44,45', well: '46' },
    hv16: { skip: '0,21,28', hang: '1-10,13,14', sign: '11,12,15-18', lamp: '19', signpost: '20,23-25', banner: '22,26,27' },
    hv17: { deadtree: '0-2', shrub: '3-26,31,33,37,38', mushroom: '27-29', debris: '30,39', stump: '32', grave: '34,40', rock: '35', growth: '36' },
    hv18: { candles: '0-2,5-7,9,15', lantern: '3', smallstatue: '4', altar: '11', item: '8,10,12-14,17-20', decal: '16' },
    hv19: { wall: '0-10,39-43', rubble: '11-38,87,88', pipe: '44-56,58,59', plate: '57', decal: '60-63,69', patch: '64-68', candles: '70-73', banner: '74,75', lantern: '76,77', grave: '78,92,94,95', hang: '79', fence: '80,81,97', signpost: '82,83,85', barrel: '84', crate: '86', shrub: '89,90', deadtree: '91,93', stump: '96' },
    hv20: { throne: '0-7', candles: '8,9,23', lantern: '10,35', smallstatue: '11,17', table: '12,13', statue: '14,31', grave: '15,21,22,30', cage: '16', crystal: '18,19', portal: '20,36', plate: '24', door: '25', obelisk: '26-28', hang: '29,34', banner: '32,33' },
    fk20: { barrel: '0,2,17', sack: '1', crate: '3,8', pole: '4,16', cauldron: '5', table: '6', bench: '7,9,10', well: '11,13', crystal: '12', signpost: '14', lamp: '15,18-20,33,34', brazier: '21', obelisk: '22', door: '23', smallstatue: '24,25', grave: '26', banner: '27,28,35', fence: '29,30', rock: '31', tree: '32' },
  };
  PR.KCAT = KCAT;
  const KFAM = { cf: 'c', fk: 'f', hv: 'g', da: 'a', gc: 'r' };
  const parse = (s) => {
    const out = [];
    for (const part of s.split(',')) {
      const [a, b] = part.split('-').map(Number);
      for (let i = a; i <= (b === undefined ? a : b); i++) out.push(i);
    }
    return out;
  };
  const kindOf = {}; // 'sh.z_cars.4' -> 'car'
  const byKind = {}; // kind -> family -> [key]
  const FAMILY = (id) => id[0]; // z zombie / urban, w wasteland, v volcanic + medieval, h horror crypt
  let built = false;
  function build() {
    if (built) return;
    built = true;
    const M = (CH.Assets.meta && CH.Assets.meta.sheets) || {};
    for (const id of Object.keys(CAT)) {
      const m = M[id];
      if (!m) continue;
      for (const kind of Object.keys(CAT[id])) for (const i of parse(CAT[id][kind])) {
        if (i >= m.n) continue;
        const key = 'sh.' + id + '.' + i;
        if (kindOf[key] && kind !== 'pillar') continue; // first label wins (z_walls lists its two pillars twice)
        kindOf[key] = kind;
        const f = FAMILY(id);
        ((byKind[kind] = byKind[kind] || {})[f] = byKind[kind][f] || []).push(key);
      }
    }
    // v_misc / v_env / v_decor hold plain medieval things (barrels, sacks, banners, wells) that fit any outdoor camp:
    // the 'm' family is that subset, without the lava pieces
    for (const id of ['v_misc', 'v_env', 'v_decor']) {
      const m = M[id];
      if (!m) continue;
      for (let i = 0; i < m.n; i++) {
        const key = 'sh.' + id + '.' + i;
        const k = kindOf[key];
        if (!k || k === 'lavarock' || (id === 'v_decor' && k !== 'banner' && k !== 'smallstatue')) continue;
        ((byKind[k] = byKind[k] || {}).m = byKind[k].m || []).push(key);
      }
    }
    const MK = (CH.Assets.meta && CH.Assets.meta.kits) || {};
    for (const id of Object.keys(KCAT)) {
      const m = MK[id];
      if (!m) continue;
      const f = KFAM[id.slice(0, 2)];
      for (const kind of Object.keys(KCAT[id])) for (const i of parse(KCAT[id][kind])) {
        if (i >= m.n) continue;
        const key = 'kit.' + id + '.' + i;
        if (kindOf[key]) continue;
        kindOf[key] = kind;
        ((byKind[kind] = byKind[kind] || {})[f] = byKind[kind][f] || []).push(key);
      }
    }
    // the packs that carry their own kinds (tools/pack-kits.js: the Dungeon Asset Pack, the Crimson Gothic Castle)
    for (const id of Object.keys(MK)) {
      const m = MK[id];
      if (!m || !m.kinds || KCAT[id]) continue;
      const f = KFAM[id.slice(0, 2)];
      m.kinds.forEach((kind, i) => {
        const key = 'kit.' + id + '.' + i;
        if (!kind || kindOf[key]) return;
        kindOf[key] = kind;
        ((byKind[kind] = byKind[kind] || {})[f] = byKind[kind][f] || []).push(key);
      });
    }
    // the set pieces cut whole (tools/pack-kits.js EXTRAS); only the portals join a pool
    const EX = { cf_giant_tree: 'landmark', cf_portal1: 'portal', cf_portal2: 'portal', cf_skull_gate: 'door', cf_crypt_arch: 'door', cf_cabin_door: 'door', fk_gatehouse: 'door', fk_portal: 'portal', fk_summon_circle: 'plate', fk_ice_gate: 'door', hv_eye_portal: 'door', hv_pentagram: 'decal', hv_skull_arch: 'door' };
    for (const k of Object.keys(EX)) if (CH.Assets.images['kit.' + k]) { const f = KFAM[k.slice(0, 2)]; kindOf['kit.' + k] = EX[k]; if (EX[k] === 'portal') ((byKind.portal = byKind.portal || {})[f] = byKind.portal[f] || []).push('kit.' + k); }
  }
  PR.kindOf = (key) => { build(); return kindOf[key] || null; };
  /* every piece of a kind in the given families ('zw', 'hm' ...) */
  PR.pool = (kind, fams) => {
    build();
    const b = byKind[kind];
    if (!b) return [];
    let out = [];
    for (const f of fams || 'zwvhm') if (b[f]) out = out.concat(b[f]);
    return out;
  };

  /* ------------------------------------------------------------------ sprites at catalogue scale */
  const scaled = {};
  PR.sprite = function (key, mul) {
    const kind = PR.kindOf(key);
    const k = KIND[kind] || KIND.decal;
    const s = Math.round((key.startsWith('kit.') ? 1 : k.s) * (mul || 1) * 100) / 100; // kit pieces are cut at game scale
    const id = key + '@' + s;
    if (scaled[id]) return scaled[id];
    const im = CH.Assets.images[key];
    if (!im) return null;
    const name = 'pc' + Object.keys(scaled).length;
    const c = document.createElement('canvas');
    c.width = im.width;
    c.height = im.height;
    c.getContext('2d', { willReadFrequently: true }).drawImage(im, 0, 0); // scaleFrame reads it back; fromFrames copies it for drawing
    const fr = s === 1 ? c : S.scaleFrame(c, s);
    S.fromFrames(name, [fr], { anchor: 'feet' });
    scaled[id] = name;
    return name;
  };
  PR.info = function (key) {
    const kind = PR.kindOf(key);
    return kind ? Object.assign({ kind }, KIND[kind]) : null;
  };

  /* ------------------------------------------------------------------ collision */
  /* A solid prop blocks with a box at its base (prop.box = {hw, hh}, centred on x + cx, y + cy) or, for older props,
     a circle (prop.cr). Bodies collide with their feet. A coarse grid keeps it cheap with hundreds of props. */
  const GS = 64;
  let gridFor = null, gridN = -1, grid = new Map();
  function rebuild(props) {
    grid = new Map();
    gridFor = props;
    gridN = props.length;
    for (const p of props) {
      if (!p.solid && !p.box) continue;
      const ex = p.box ? p.box.hw + 4 : (p.cr || 10) + 4, ey = p.box ? p.box.hh + 4 : (p.cr || 10) + 4;
      const px = p.x + (p.cx || 0), py = p.y + (p.cy || 0);
      for (let gy = Math.floor((py - ey) / GS); gy <= Math.floor((py + ey) / GS); gy++) for (let gx = Math.floor((px - ex) / GS); gx <= Math.floor((px + ex) / GS); gx++) {
        const k = gx + ',' + gy;
        let c = grid.get(k);
        if (!c) grid.set(k, (c = []));
        c.push(p);
      }
    }
  }
  PR.near = function (props, x, y, out) {
    if (props !== gridFor || props.length !== gridN) rebuild(props);
    out.length = 0;
    const gx = Math.floor(x / GS), gy = Math.floor(y / GS);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const c = grid.get(gx + ox + ',' + (gy + oy));
      if (c) for (const p of c) if (!out.includes(p)) out.push(p);
    }
    return out;
  };
  PR.invalidate = () => { gridN = -1; };
  const tmp = [];
  /* push a body out of solid props. foot = how far below e.y its feet are, r = feet radius;
     skip(prop) may exempt a prop (standing on it, flying over it). Returns the last prop touched. */
  PR.collide = function (e, foot, r, skip) {
    const props = e.g ? e.g.arena && e.g.arena.props : CH.G.arena && CH.G.arena.props;
    if (!props) return null;
    let hit = null;
    const fy = e.y + foot;
    for (const p of PR.near(props, e.x, fy, tmp)) {
      if (!p.solid || p.dead || (skip && skip(p))) continue;
      const px = p.x + (p.cx || 0), py = p.y + (p.cy || 0);
      const moved = p.box
        ? CH.World.pushBox(e, foot, r, px - p.box.hw, py - p.box.hh, px + p.box.hw, py + p.box.hh)
        : CH.World.pushCircle(e, foot, r, px, py, p.cr || 10);
      if (moved) hit = p;
    }
    return hit;
  };
  /* does a point (or a small circle) touch a prop's footprint? used by projectiles, jumps, set piece spacing */
  PR.touches = function (p, x, y, r) {
    const px = p.x + (p.cx || 0), py = p.y + (p.cy || 0);
    if (p.box) {
      const qx = U.clamp(x, px - p.box.hw, px + p.box.hw), qy = U.clamp(y, py - p.box.hh, py + p.box.hh);
      return (x - qx) * (x - qx) + (y - qy) * (y - qy) < (r || 0) * (r || 0) + 0.01;
    }
    const m = (p.cr || 10) + (r || 0);
    return (x - px) * (x - px) + (y - py) * (y - py) < m * m;
  };
  /* the box of a piece drawn with sprite `name` and catalogue kind `kind` */
  PR.boxFor = function (name, kind) {
    const k = KIND[kind];
    if (!k || !k.box) return null;
    const sp = S.get(name);
    const w = sp.w, h = sp.h;
    const hw = Math.max(3, (w * k.box[0]) / 2);
    const depth = k.box[1] < 1 ? h * k.box[1] : k.box[1];
    return { hw: Math.round(hw), hh: Math.max(3, Math.round(depth / 2)) };
  };
})(window.CH);
