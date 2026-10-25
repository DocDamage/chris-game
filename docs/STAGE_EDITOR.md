# The stage editor

Build, dress and fix every stage of CHAOS.exe by hand. What you save is the stage the game plays.

## Opening it

- **Main menu:** STAGE EDITOR (under the menu links).
- **Straight in:** open `index.html?editor`.
- **From a play test:** F10 returns to the editor.

Pick a stage (areas 1–49, or the belly inside the Final Tower), then what to start from:

| Start from | What you get |
| --- | --- |
| Edit my stage | The hand-made stage you saved for that area |
| Restore unsaved work | Changes you never saved (the editor keeps them every few seconds) |
| The generated stage | The level the game makes, with all its props, to move and fix |
| Generated, cleared | Its rooms, floors and walls, with every prop, decal and puddle taken away |
| Blank stage | Nothing: you pick the look (biome), the size, and open floor or solid rock |

Change the seed to get another generated layout. "Delete my stage" makes the game generate that area again.

## The workspace

- **Drawer (left).** Every piece of every pack, about 7,600, including your own imports.
  - **Tabs:** All, Props, Floor, Walls, Animated, ★ Favourites, Recent, My imports.
  - **Pack and kind filters.**
  - **Search:**
    - words match the name, kind, pack and sheet;
    - `kind:barrel`, `pack:seabed`, `sheet:fk7` and `type:floor` narrow it;
    - `-dead` leaves out matches.
  - **Using it:**
    - Hover a card for a big preview with its animation playing.
    - Click to pick a piece; Ctrl/Shift+click picks several for the scatter brush.
    - Right-click marks a favourite; double-click picks and switches to Stamp.
    - Drag the drawer's edge to widen it.
- **Map (middle).** The stage drawn as the game draws it, with walls, floors, decals, lights and animations. Collision boxes show in red, markers as coloured badges.
- **Details (right).** What is picked and its settings. With nothing picked: the stage's name, look, size, and a check that every spot can be walked to. H hides the panel.
- **Status bar (bottom).** Mouse position, tile and cell type, zoom, piece counts, what's under the mouse.

## Tools

| Key | Tool | What it does |
| --- | --- | --- |
| V | Select | Click to pick, drag to move (snapped; hold Alt for free). Drag on empty floor to box-pick; Shift adds to the pick. |
| B | Stamp | Place the picked piece. Drag to lay a row (a fence, a line of shelves). Modes: As its kind, Standing, On the floor. |
| S | Scatter | Paint a mix of the picked pieces in a circle, spaced and flipped at random. Sparse, Normal or Dense. Right-drag thins them out. |
| E | Erase | Take away what is under the brush: Anything, Standing only, or Floor only. |
| T | Terrain | Paint Floor, Wall, Pit or Secret wall (a cracked wall heroes can break). Wall faces, corners, mounted torches and vault doors dress themselves. Shift+drag fills a rectangle; right-drag paints wall. |
| K | Floor tiles | Paint floor tiles with the picked piece (any floor swatch; big swatches tile across seamlessly), or clear them. |
| M | Markers | Entrance, Exit, Waypoint, Breach (a monster hive), Monster pack, Chest, Shrine, Lore stone. Right-click a marker to remove it. |
| Alt+click | Eyedropper | Picks the piece under the mouse in the drawer. |

## What a piece is to the game

Every piece you drop is recognised and given what goes with it. If the editor isn't sure, it asks.

| It is | In the game | Given by itself to |
| --- | --- | --- |
| Goes inside (a cabin, townhouse, frozen house or sealed vault) | ENTER: a room with a chest (opened once) | doors, houses, huts, cabins, crypts (the room fits the biome) |
| The stage exit | the way on, open once enough breaches are closed | (asked for portals, arches) |
| A chest | OPEN for loot; your piece is the chest | pictures named chest, treasure … |
| A shrine | PRAY for a blessing (healing, speed, blood, elite) | (asked for altars and wells) |
| A sign to read | READ: its title and words, written by you | signposts, plaques |
| A waypoint | TRAVEL from it | (asked for obelisks) |
| A breach | monsters come out until a hero closes it | (asked for graves, coffins, growths) |
| A shop | SHOP there | (asked for stalls, machines, anvils, cauldrons) |
| Burns / Poisons | hurts whoever stands on it, as lava or toxic goo does | fire traps, geysers, lava; (asked for spikes, traps, pools) |
| A light | glows | torches, lamps, lanterns, candles, braziers |
| Breakable | a hit smashes it; it drops wood, scrap or stone | crates, barrels, sacks, pots, bins |
| A tree | sways, can be chopped down | trees |
| Just scenery | nothing more | everything else |

- **Your own pictures** are recognised by their names (`old_chest.png`, `tavern_door.png`, `torch_strip4.png` …). A picture with no telling name is asked about.
- **When it asks**, a card shows the likely choices first, "Just scenery" and "something else…". "The same for every grave" (ticked by default) remembers your answer.
- **Event spots:** a role used at a spot (going inside, exit, chest, shrine, sign, waypoint, breach, shop) puts a coloured badge in front of the piece. That badge is where a hero stands to use it: drag it. Deleting the badge makes the piece scenery again.
- **Changing a role:** pick the piece. "What it is" in the details panel changes the role and its settings (chest tier, the blessing, the sign's words, the breach kind). "Do this for every …" sets the role for that whole kind.
- **The stage panel** has three related controls:
  - **Pieces placed** sets the behaviour: recognised and asked when unsure (the default), always asked, or left as scenery.
  - **Recognise every piece** gives the pieces already on a stage their roles, as one undo step.
  - **Forget my answers** clears what you told it.

## Collision, animation, light

Pick a piece to see its settings in the details panel:

- **Solid or walk-through.** Collision presets:
  - **None**
  - **Traced from art:** the piece's foot, read from its picture
  - **Full**
  - **Bottom half**
  - **Trunk:** a narrow base, for trees and lamp posts
- **Box size and offset** as numbers. Or press **✎ Drag it on the map** and pull the orange handles (Ctrl+drag the middle one to move the box).
- **Can jump it, breakable** (with hit points), **sways**.
- **Size:** the piece is redrawn at that scale, and its box scales with it.
- **Animation:** frames per second.
- **Light:** glows, with its colour and reach.
- **Put it on the floor / Stand it up:** switches a piece between lying flat (under everything, walked over) and standing (sorted with the heroes).
- **Use as this piece's default:** keeps these settings for every later placing of that piece, by you and by the game's own generator. They are saved in `data/asset_meta.js`.

Pick several to flip them, make them solid or walk-through, trace their collision, or line them up (same row, same column, spread evenly).

## Bringing in new art

Drop pictures (png, jpg, webp or gif) or a .zip on the drawer, or press **＋ Bring in pictures…**. The editor works out each picture:

- **One thing:** one piece.
- **A sheet:** cut into its pieces where the empty gaps fall.
- **A sheet of look-alike cells:** an animation, one per row. Four (or eight) rows are its facings: down, left, right, up. Each facing becomes its own piece.
  - **Name tags**, as in Doc's Doodads: `[f8]`, `%(8)`, `_strip8` or `8f` give the frames per row; `[d4]` gives the facings.
- **RPG Maker character sheets:** a `$name.png` is one character; others hold eight. Each character's four facings become walking animations.
- **No see-through parts:** a floor swatch, or 32 px floor tiles if you choose.
- **Kind** comes from the file name (barrel, tree, torch, rug, door …). That decides whether the piece stands or lies flat. A standing piece gets its collision traced from its art. Lights (torches, lamps, candles, crystals) glow.

Every guess can be changed in the preview before it comes in, and afterwards in the details panel. The art scale setting handles hi-res art. Your pictures are saved into the game (`data/bundle_user.js`) and listed under **My imports**.

## Saving and playing

- **Ctrl+S / Save** writes the stage into `data/stages.js`. The first time, the browser asks you to pick the game's folder (the one with `index.html`) and allow changes. From then on, the game plays your stage for that area.
  - The previous version of every file the editor writes is kept in `data/editor_backups/` (the newest 30).
  - Where the browser cannot write files, the file is downloaded instead, with a note saying where it goes.
- **F5 / ▶ Play** plays the stage as it is now, saved or not. F10 comes back.
- The orange dot on Save means there are unsaved changes.

## All keys

| Keys | Does |
| --- | --- |
| V B S E T K M | the tools |
| Ctrl+Z / Ctrl+Y | undo / redo (300 steps; hover the buttons to see which) |
| Ctrl+C / Ctrl+V / Ctrl+Shift+V / Ctrl+D | copy, paste at the mouse, paste in place, duplicate |
| Ctrl+A | pick every piece |
| Del | delete what is picked |
| Arrows | nudge 1 px (Shift 16, Ctrl one tile); move the view when nothing is picked |
| X | flip what is picked |
| [ ] | brush size |
| Space+drag, middle-drag, right-drag (Select) | move the view |
| Wheel / + − | zoom at the mouse |
| Home | the whole stage |
| G / C / H | grid, collision boxes, details panel |
| Ctrl+F | search the drawer |
| Ctrl+O | open another stage |
| Ctrl+S | save |
| F5 | play test |
| F10 | back from a play test |
| ? | this list in the editor |
