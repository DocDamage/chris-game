# New asset packs (added 2026-10-23): catalogue and cutting notes

Catalogued sheet by sheet, with the project's slicer (`tools/slice.js`, `components(img, { gap: 1, minArea: 400 })`).
Boxes are `[x, y, w, h]` in source pixels. PLAN.md section 18 says where each part is used.

## Rules for every sheet of the three tile packs

- **Transparent backgrounds everywhere**. Faint specks (alpha 1-40) and soft edges: after downscaling, set alpha <= 40 to 0.
- **Title banners**: every sheet (except Frozen 8 and 11) has a title banner, and on many its letters or ornaments come
  out as separate small blobs. Drop the banner and every blob inside its box. Frozen Kingdom: drop any piece whose
  bottom edge (y + h) is <= 180 (do not use "y < 160": Frozen 6 has a tower at y 152). Creepy Forest: banner is the first
  piece (y < 140). Victorian: banner in the top ~150 px; sheets 1-8 also have a lamp and carriage icon there.
- **Frames**: Victorian 9 and 11-19 have a full-sheet frame component (drop pieces wider than 0.9 x sheet); on Victorian
  19 the title is fused into the frame. Victorian 9 also has a frame fragment `[4,700,708,236]` that passes the usual
  filters: exclude it by box.
- **Blobs inside another piece's box** (sparks, sigil centres): drop them.
- **Art grid**: AI-made imitation pixel art, 4-8 source px per art pixel on an uneven grid. Downscale by area averaging
  (`P.downscale`), never nearest-neighbour. Pieces have a dark outline; the collision box is the footprint only.
- **One scale does not fit**: use the per-sheet scales below (small props 0.15-0.2, trees and walls 0.25-0.3, enterable
  crypts, houses and portals 0.45-0.55).
- **Ground tiles are not seamless**: every swatch has a ragged or scalloped outline. Crop inside it (Creepy 12-17 px,
  Frozen 16-24 px, Victorian ~4 px keeping ~2 px of grout), resize to exactly 32 px, mix variants; or use them as patches.
- **Views**: walls, doors, fences and cliffs are front-facing only (south face). Side runs need mirroring, posts or trees.
- **Single frames**: no animation anywhere; flames, sparkle and drift are done in code.

## Creepy Forest Horror Megapack (`tile sets/Creepy Forest/Creepy Forest Horror Megapack/`, 20 sheets ~1536x1024)

| # | Contents | Slicer: pieces, banner, problems | Cut | Role | Scale | Special uses |
|---|---|---|---|---|---|---|
| 1 Dead Forest ground | 35 squares (7x5): orange and grey dirt, cobble, moss, root-veined dirt, gravel; a skull-rock statue, 2 stone stacks | 37; banner [80,24,1384,136]; rows of different heights | blobs + inner crop ~16 px | ground (statue: solid) | ~134 px -> 32 | statue [1076,556,176,156] quest marker |
| 2 Mud & Swamp | 35 squares: mud, moss, grass, reeds, cattails, teal and dark swamp water, rocky and twig mud | 36 clean; banner [104,24,1316,112] | blobs + inner crop ~12 px | ground; water = pools | 0.25 | swamp water: pools, slow zones, Frost Walk targets |
| 3 Creepy Path | 13 fills; stone-bordered corners x6, straights x3, T, cross, 5 end caps; 8 debris tiles | 40 clean; banner [36,12,1456,120]; uneven sizes (not a real autotile set) | blobs | path | 0.22 | |
| 4 Rotten Fence | 44: posts, straights, L/T/+ corners, gates, broken and mossy pieces | 45; banner [236,16,1064,104]; broken pieces split (row 1 x1064-1188, row 4 x532-692) | blobs, gap 3 | solid; gates = gate | 0.25 | yards |
| 5 Cabin Wall Modules | 18 log panels (windows, boarded, holes, moss), 16 posts, doorway, plank and X-boarded doors, barred window | 43 clean; banner [188,20,1092,112] | blobs | wall; doors = gate | 0.27 (panel 176 -> 48) | cabin fronts; holed walls [644,360,164,168], [840,360,176,168] = secrets; doorway [28,900,136,148] |
| 6 Cabin Roof | 11 shingle panels, 2 gable caps, 6 ridge/eave beams, 9 edge bits | 29 clean; banner [176,16,1168,112] | blobs | roof | 0.27 | broken roof [496,420,252,224] |
| 7 Broken Doors & Windows | 5 big doors (X-boarded, barred), 5 windows (green glow, portcullis, boarded), 16 frames, planks | 27 clean; banner [176,8,1164,120] | blobs | gate / deco | 0.14 | boarded doors = breakable barrier; portcullis [372,472,296,260] = lock gate |
| 8 Dead Trees & Props | 7 dead trees, 2 hollow stumps, 2 logs, root, 4 stumps, log pile, 8 rocks, twigs, mushrooms, sapling | 31; banner [176,8,1164,116] | blobs | solid (trees, rocks) / deco | trees 0.28 (~2.8 heroes), rest 0.22 | rocks as stepping stones |
| 9 Twisted Roots | 3 flower bushes, 4 vine arches, giant twisted tree [956,156,368,460], root stumps, maw-root, mushroom clusters, twig crosses, rocks | 25 clean; banner [112,12,1332,116] | blobs | solid; arches = gate | 0.25 (giant tree 0.28) | vine arches [28,408,228,204], [316,408,208,212] as natural gates |
| 10 Graveyard Props | 79: tombstones, angels, 6 mausoleums, 7 graves, 3 crypt arches, sarcophagi, coffins, bone piles, hooded statues, 6 candle sets, flowers, wreaths, fences, 2 gates, pillars, runed obelisk | 80 clean; banner [252,4,964,100] | blobs | solid; candles = light; gate [16,888,224,128] | stones 0.2, mausoleums 0.3 | open graves (row 3) = secret holes; crypt arch [796,412,136,124] |
| 11 Tombstones & Crypts | 18 tombstones, 7 crypts (one domed), sarcophagi, coffins, graves, markers, iron fence, skull gate | 43; banner [196,4,1120,120]; **merge** [1348,512,144,324] = domed crypt + coffin: split at y 668 | blobs + 1 split | solid; crypts = gate | 0.2; enterable crypts 0.45-0.5 | crypt doors = dungeon entrances; skull gate [1272,856,240,144] |
| 12 Ritual Circles | 8 circles, 8 star sigils, 2 candle circles, 9 symbols, 7 sigils, candelabra, 11 ritual items | 48; banner [124,8,1268,116]; 3 fragments [96,432,20,20], [896,392,32,28], [1028,428,28,24]; thin semi-transparent lines | blobs, gap 3, lower minArea | decal; candles = light | circles 0.35, portal 0.5, items 0.2 | ritual circles, portal floors; candle circles [1128,336,148,192], [1316,324,180,220] |
| 13 Lanterns & Torches | 10 lanterns, 7 torch posts, 3 hanging-lantern posts, 6 braziers, 3 pot fires, 11 candles, fire trough | 41 clean; banner [180,8,1144,128] (dark text) | blobs | light | posts 0.25, candles 0.18 | brazier = checkpoint |
| 14 Warning Signs | ~28 text and icon signs, 12 hanging signs, totems, skull posts, 11 stakes, 12 tags, chain fence, rune stones | 64 clean; banner [196,4,1156,96]; text baked in; typo "WATCHERS NEARRY" [1368,280,148,144] (skip) | blobs | deco / solid | 0.22 | hints at secrets; red stakes [664,736,116,132] = hazard |
| 15 Bones & Skeletons | skull piles, 6 skeletons, 14 bones, 11 skulls and ribcages, skull pikes, hanging skeleton, gallows, bone fence, 9 heaps | 55 clean; banner [196,8,1108,112] | blobs | decal (bones) / solid | skeletons 0.17, bones 0.2 | gallows [888,628,144,168] quest spot |
| 16 Cages & Chains | 12 hanging cages, 12 chains, 10 shackles, 4 spiked traps, standing cages, gibbet, chain posts, stocks | 53 clean; banner [236,8,1016,108] | blobs | solid; spikes = hazard; chains = deco | 0.2 | cages for rescues [624,132,104,240]; stocks [1100,856,164,148] |
| 17 Wells & Water | 10 wells (incl. cursed skull well), 8 pools (water, slime), 4 fountains, 5 troughs, 2 tubs, 3 pumps, 2 channels, 4 grates, well lid, 4 shrine fountains, big torch fountain [1232,816,292,176] | 45 clean; banner [112,12,1292,100] | blobs | solid; slime pool = hazard; grates = decal | 0.25 (fountain 0.3) | wells (quests); grates and lid [180,836,140,144] = secret descents |
| 18 Furniture & Debris | benches, barrels, tub, carts, chair, stool, table, totems, small hut [508,592,188,184], fences, coal cart, signpost, stump, wheel | 29; banner [188,8,1228,116] + 3 letter blobs at y 44 | blobs, drop blobs in banner box | solid / deco | 0.2 | |
| 19 Horror Decorations | 3 hanging corpses, banners, hanging skull, sigil, throne, 2 altars, skeleton on a cross, candle tables, skull racks and pikes, candles, cross stone | 23; banner [240,8,1068,108] + letter blob [776,40,16,40] | as 18 | deco / solid; candles = light | 0.15, altars 0.2 | altars [660,492,256,228], [976,488,268,268] for quests |
| 20 Legendary Props | 2 glowing thrones/portals, ritual wheel, big altar, crystal shrine, fire pyre, giant skull gate, demon altar, 2 pillar gates, 2 staffs, skull pillar, rune slab | 17; banner [204,16,1156,104] + 2 spark blobs inside the pyre | blobs, drop nested blobs | gate / solid / light | 0.25 (~80 px set pieces) | portals [72,132,264,320], [56,468,288,288]; skull gate [656,476,336,280]; pillar gate [524,796,236,196] |

**Missing for a full stage**: cliffs, rock walls or hedges to bound rooms; stairs, ramps, bridges; seamless or autotile
ground; interior floors. Kit-bash: Valley Ruin `RockCliff` / `RockWall` / hedge, darkened, lined with dead trees (8),
twisted roots (9) and fences (4); Volcanic Ruins `17. Bridges and walkways` and `18. Stairs and lifts` recoloured;
Frozen Kingdom glacier cliffs re-tinted; Victorian furniture for cabin interiors.

## Frozen Kingdom (`tile sets/Frozen Kingdom/Frozen Kingdom – Top-Down Pixel Art Asset Pack/`, 1672x941 or 1536x1024)

| # | Contents | Slicer: pieces, banner, problems | Cut | Role | Scale | Special uses |
|---|---|---|---|---|---|---|
| 1 Snow ground | 18 framed swatches (~208 px): plain snow, cracked, paired pits, frosted edge, 4 snow-capped stepping stones, cobbles, pebble snow, slabs, frost, rocks, cracked ice sheet, puddle, 3 ice holes, crystal chunks and spikes | 38: banner [160,8,1356,160] + 19 blobs inside | blobs, crop ~18 px in | ground (holes = hazard) | 0.18 for 32 | stepping stones; slippery ice [1400,448]; ice holes [868,700] |
| 2 Icy path | 28: plain squares, stone-bordered runs, 2 crossroads, T, 2 corners, crystal-cornered ice, 7 dark cracked-ice | 29 clean; banner [160,4,1368,172]; 124-196 px | blobs | path | normalise to 32/64 | straight, +, T, L (mirror the rest); dark ice = slippery |
| 3 Frozen water | 18 rimmed slabs of dark cracked ice (9 square, 9 tall), snowball/crystal rims | 20: banner [44,8,1584,160] + ornament [768,40,28,28] | blobs, crop inside for a fill | frozen water (slippery) | 0.33-0.38 | ice floes, slick patches; no open water |
| 4 Glacier cliff | 12 snow-top blocks with a south icicle face (8 straight, 4 L-corners), 7 ice-spike clusters | 20 clean; banner [88,12,1512,164] | blobs | cliff; spikes = hazard | 0.33 (spikes 0.25) | plateaus and ledges (south face only, no ramps) |
| 5 Ice castle walls | 8 crenellated sections, 6 round towers, 7 L-corners, 2 ends, twin-window block, gatehouse with portcullis [932,732,348,228], 2 banners | 45: banner [112,12,1288,144] + 16 blobs; 27 clean | blobs | wall; gatehouse = gate | 0.28 | castle exterior, boss approach |
| 6 Roofs | 3 flat ice roofs, 9 modular L/T pieces, 7 gabled houses, 3 X-roofs, double-X, chimneys, 5 spires, 3 conical towers, banner | 50: banner [24,16,1488,140] + 15 blobs; 34 clean | blobs | roof / solid | 0.3 | |
| 7 Nordic houses | 6 houses (lit windows), 8 cabins and shopfronts, 9 huts (incl. a yurt), 14 props (fence, lamp, pole, barrel, crate, coal cart, logs, well, fire bowl, pines, chimney) | 58: banner [20,12,1500,148] + 20 blobs; 37 clean | blobs | solid (fire bowl, lamp = light) | houses 0.55, props 0.3 | frozen town; painted-on doors |
| 8 Icy bridges | 14 vertical bridges (stone, with stairs [512,172], slatted [40,420], ice deck [512,420], wood, narrow), 7 landings, 5 horizontal arched bridges | 26 clean, no banner | blobs | path deck / solid posts | 0.45 | stairs; gapped slats and landings for platforming; ice deck = slippery |
| 9 Crystals | 25 clusters on snow bases | 44: banner [16,4,1504,152] + 18 blobs | blobs | solid / deco | 0.25 | glow in code |
| 10 Trees | 7 bare frosted trees, 18 snowy pines | 41: banner [24,8,1488,140] + 15 blobs | blobs | solid | 0.34 (pine ~80 px) | tree lines = soft walls |
| 11 Fences & gates | ~50 fence runs, 10 arch gates (last [1380,392] closed door), posts, T/+/L joints | 72 clean, no banner | blobs | low wall; arches = gate | 0.4 | locked gate |
| 12 Torches | 9 torch stands, 9 braziers and candle pillars, 9 rune torch pillars, 5 square braziers, 3 hanging lanterns, fire bowl (blue flames) | 57: banner [16,16,1504,124] + 20 blobs | blobs | light | 0.22 | flicker in code |
| 13 Ruins | 4 broken arches, 6 pillars, 4 broken walls, ~27 stubs and rubble | 56: banner [24,16,1488,124] + 13 blobs; last rubble split [1376,696,44,52] + [1428,700,48,32]: merge | blobs + 1 merge | solid; arches = gate | 0.36 | secret-passage dressing |
| 14 Runes | 16 round rune medallions, 16 square rune ice plates | 46: banner [24,16,1488,124] + 13 blobs | blobs | decal + light | 0.4-0.47 | teleport pads, switches, checkpoints, portal floor |
| 15 Ice pillars | 10 tall, 10 medium, 10 short/broken | 44: banner [20,16,1496,128] + 13 blobs | blobs | solid | 0.28 | |
| 16 Market stalls | 6 canopy stalls, fish/potion stalls, tables, gem cauldron, forge, cart, covered wagon, tent stall, meat rack, gem chest, counter | 42: brackets [20,16,100,136], [1460,16,56,136] + 20 letter blobs | blobs | solid (forge = light) | 0.4 | frozen town shops |
| 17 Winter camp | tent, campfire, drying rack, weapon rack, shelves, fence rack, crate tables, tubs | 33: banner [24,16,1496,148] + 18 blobs | blobs | solid; campfire = light | 0.4 | NPC camp |
| 18 Particles & footprints | snowflakes, dot scatters, flake groups, 2 footprint trails, snow ring, broken ring, puffs | 88 fragments: hand boxes only | hand boxes (below) | decal / particle | flakes 0.1-0.15, prints 0.1 | snow footprints, blizzard flakes |
| 19 Statues | knights, mage, angel, obelisks, crystal shrine, cross, pedestals, frozen fountain, blue-fire pedestal, floating crystal, 3 shrines, portal arch [748,628,196,160], lantern pillar, frozen pool, robed statue, gravestone, altar, summoning circle [712,828,200,160], throne golem, ruined arch with steps [1308,824] | 52: banner [32,20,1480,108] + 20 blobs | blobs | solid; portal = gate + light; circle = decal | 0.3 (portal 0.36) | portals, boss altar, steps |
| 20 Arctic deco | barrels, sack, ice crate, racks, cauldron, benches, wells, crystal nest, signpost, crystal lamps, brazier, obelisk, glowing ice gate [752,360,140,144], idols, runestone, banners, fences, rock pile, pine, lantern posts, bunting | 56: banner [36,24,1600,116] + 19 blobs | blobs | solid / deco; lamps = light; ice gate = gate | 0.28 (gate 0.4) | town clutter, second portal |

Sheet 18 hand boxes: scatters 96-372 x 192-392, 456-712 x 184-392, 348-552 x 448-636; medium flakes 812-924 x 204-356,
984-1160 x 200-392; large flakes [1216,176,228,228], [80,440,196,200]; flake groups 664-752 x 452-640, [820,484,88,88],
992-1072 x 456-640, 1188-1412 x 464-640; snow ring [816,676,156,152]; broken ring 816-972 x 856-984; puffs
[1132,708,84,100], [1308,724,72,68], [1264,808,72,112], [1124,884,72,84], [1352,892,68,76]. Footprints: two trails
(96-340 x 700-990, 424-712 x 700-992), each three boot prints heading up-right (two touching + one offset), ~80-120 px
long, navy outline with a light sunken fill; cut single prints by hand (trail 1: merged pair [96,732,164,188], third
[220,872,116,112]; trail 2: [428,744,148,176], [596,880,112,108]) and rotate per heading.

**Missing**: seamless terrain transitions, cliff side and back faces, ramps, open water and shores, interiors, separate
door sprites, breakable ice walls, animation, wall tops for east/west/north room sides.

## Haunted Victorian City (`tile sets/Haunted Victorian City/`, mostly 1672x941)

| # | Contents | Slicer: pieces, problems | Cut | Role | Scale | Special uses |
|---|---|---|---|---|---|---|
| 1 Cobblestone Street | 30 cobble tiles, 10 edge pieces, 2 grates, 2 rune boulders, barred cellar hatch | 48 = 45 + 3 title pieces | blobs | ground; grates/hatch decal/gate; boulders solid/light | crop ~4 px, resize to 32 | sewer grate, cellar hatch = secret entrances |
| 2 Cracked Sidewalk | 27 slabs (3 are 188 wide), curb strip pairs, kerb strips, holed tiles | 51 = 48 + 3 title | blobs | path; curbs = raised edges | resize to 32 | holed tiles = pits |
| 3 Victorian Wall Modules | 10 brick segments (3 with cellar windows), 7 pillars (one with a door), 2 broken walls, 2 gable ends, 6 cap strips | 33 = 30 + 3 | blobs | wall | 0.28 (segment ~48x45) | facades; caps as top-down ledges |
| 4 Victorian Roof Modules | 2 slate fields, 7 gables/ridges, spire with red finial, 6 lit dormers, 6 chimneys, 5 eaves | 28 = 25 + 3 | blobs | roof | 0.28 | |
| 5 Gothic Doors & Entrances | 3 arched doors, 4 empty arches; 7 tall portals (purple eye [520,412,196,276], red sigil doors); 7 chapel/crypt doors, 2 lintels | 26 = 23 + 3 | blobs | gate | 0.28 (small 0.34) | **cult house entrance**; arches = passages |
| 6 Broken Windows & Frames | 45 windows of every kind | 48 = 45 + 3 | blobs | deco on walls | 0.2 | |
| 7 Street Lamps & Gas Lanterns | 33 lamps, 7 candelabra lamps, gallows lantern, 2 tall lamps | 46 = 43 + 3 | blobs | light | 0.28 | hub and city lighting |
| 8 Iron Fences & Gates | 24 fence segments, 15 gates with pillars | 42 = 39 + 3 | blobs | solid; gates = gate | 0.28 | cemetery and estate walls |
| 9 Carriages & Wagons | 28 carriages, carts, wagons, cage wagon, wrecks | 32: frame + title + frame fragments [4,700,708,236], [760,924,416,12] (exclude) | blobs | solid | 0.38 | street blockers; cage wagon |
| 10 Cemetery Props | 18 headstones and crosses, rocks, mausoleum, slab, fallen cross, **open grave**, shovel, dirt pile | 29 = 28 + title | blobs | solid; grave = decal | 0.18 (mausoleum 0.4) | open grave = secret drop |
| 11 Mausoleums & Crypt Modules | 18 mausoleums and crypt buildings, barred crypt gate, mossy arch, headstones, sarcophagi, grave frame, slabs | 54: frame strips [4,4,1664,32], [4,908,196,28], [224,928,72,8], [1636,872,32,64] + title; small pieces < 40 px need a lower minimum | blobs | gate / solid | buildings 0.5, graves 0.18 | **mausoleum entrances to crypt levels** |
| 12 Gothic Statues & Monuments | angel, gargoyle, reaper statues, skull pillar, shrines, obelisks, tombs, **stone ring**, mossy arch | 43: frame + title | blobs | solid | 0.28-0.32 | boss arenas; stone ring = portal |
| 13 Haunted Market | 9 awning stalls, 9 tables, crates, sacks, cauldron, chests, crystal-ball table, lanterns, boards, signs | 57: frame, title, letter fragments [592,64,16,40], [1068,64,12,40] | blobs | solid; lanterns = light | 0.3 | **hub market** |
| 14 Furniture & Urban Props | sofas, wardrobes, bookshelves, chairs, tables, bed, fireplace, clock, gramophone, chest, safe; post box, bench, news stand, notice board, sewer grate | 57: frame, title, 4 letter fragments | blobs | solid; grate decal; lamps light | 0.24 | **cult house interior**, hub benches |
| 15 Sewer Pipes | pipes, grates, slime pipes, big drain, **2 ladders**, basin | 51: frame, bit [8,904,48,32], title, fragment [944,64,16,48] | blobs | deco; grates decal/gate; slime = hazard | 0.27 | sewer levels; ladders connect levels |
| 16 Posters & Signs | 10 posters, notice boards, SHOP/INN/PUB/WC signs, banners, 4-banner rack [1080,568,504,332] | 33: frame, slivers, title, fragments; skip garbled "AFICS" sign | blobs + hand boxes | deco / solid | posters 0.18, posts 0.28 | hub signage |
| 17 Dead Trees & Vegetation | 3 dead trees, ~25 bushes, tufts, mushrooms, roots, stump, cross, mounds | 47: frame, title, fragments; double grass clump [800,580,168,112] | blobs | solid / deco | 0.33 | graveyard and park filler |
| 18 Candles & Occult | candelabras, candles, purple lantern shrine, tablet, skulls, grimoires, font, potion, **pentagram** [76,660,292,224] (near-black: tint or glow it) | 28: frame, title, 5 fragments | blobs | light / decal / deco | candles 0.2, pentagram 0.33 | **cult ritual room** |
| 19 Ruined City Debris | ruined walls, ~24 rubble piles, ruined doorways, pipes, webs, **5 cracked floor tiles**, blood, candles, purple cult banners, red cloak, fences, signposts | 103: title fused into frame; keep thin candles and pipes (w < 40) | blobs, lower minimum width | solid / decal / light | 0.28, floor tiles 0.4 -> 32 | ruined district; cracked floors = secrets; cult banners |
| 20 Legendary Gothic | **8 thrones**, candelabras, skull pedestal, lecterns, gargoyle, tomb, moon, orb, crystal, **gold ring frame**, **pentagram altar disk**, crypt gate, spires, stained glass, hooded statue, banners, chandelier, **skull portal arch** [1316,812,196,196] | 38 = 37 + title | blobs | solid / light / gate | thrones 0.28, arch 0.4 | boss arenas, cult sanctum, portals |

**Missing**: seamless or autotile ground, complete houses (assemble facades from wall + window + door + roof modules;
front view only), interior floors and top-down interior walls, stairs, bridges, water.

## NPCs (`NPCs/`)

| Character | Frames | Animations (directions) | Figure | Use |
|---|---|---|---|---|
| Retro Nurse | 48x48 | idle, walk, run (4); heal with pink light (8); jab, pick up, push/pull, taking hit, death (4) | ~44 px | hideout healer |
| Doctor | 48x48 | idle, walk, run (4); heal (8); cross punch, pick up, push/pull, taking hit, death (4) | ~44 px | hideout surgeon |
| Jesus Christ | idle 32x32, rest 48x48 | idle, walk, sprint, jump, punch (4-6); bless (4); taking hit, death (4) | ~25 px idle | hideout blessings |
| Lucifer | 160x160 | idle, walk, fly, punch, jump, throw (4-8); dark magic, hellfire, pick up, taking hit, death (8) | 131x78 with wings | cult patron, boss |
| Cult members 1-4 | 64x64 strips of 9 | idle, walk, pray, attack (one side view) | ~60 px | cult house, cult enemies |

Licences: Animated Cult NPCs by MutterPixel Studio (commercial use allowed, no reselling or redistribution of the raw
files, no NFT/AI training; credit appreciated). Scale the NPCs to the heroes (~33 px): nurse and doctor ~0.75, cult
~0.55, Jesus' idle ~1.3 and his 48 px animations ~0.75, Lucifer ~0.6 (a boss).
