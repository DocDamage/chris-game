# CHAOS.exe: the Diablo overhaul plan

This plan covers the nine requests from 2026-10-21:

1. Earlier suggestions: done. All of them are in the code now (`perks`, `combat`, `waves`, `foes`, `meta`, `extras`, `hudx`, `coop4`, `weapons2`).
2. Proper sprites for the three newer heroes.
3. Rebuild the UI with the *Mini Pocket Status* pack, using every asset in it.
4. Make the game play more like Diablo.
5. Atmosphere shaders (fire, blood, rain, thunder, day/night, snow, blizzard) and realistic water and blood puddles.
6. The vending machine pauses the game and opens a real shop menu.
7. Sidekicks: one starting sidekick per hero, plus secret sidekicks you unlock.
8. Hives and portals instead of waves (Diablo / Gauntlet spawning).
9. Diablo-style levels where you find your way to the exit.

Items 8 and 9 replace the wave loop that most systems hang off, so they are the core of this plan and most of the risk. Refactoring is approved where it is needed (§11). The rest is either self-contained (UI, shaders, vending, sidekicks, heroes) or builds on top of the new level structure (Diablo loot, town, map).

---

## 0. Decisions (settled 2026-10-21)

| # | Decision |
| --- | --- |
| D1 | **Archangel Commander** sidekick: the zip has been re-copied and is complete (§1b). |
| D2 | The three new heroes replace the placeholder kits: **Elven Enchantress** ← Intern Wrangler (summoner), **Neon Specter** ← Glass Gunslinger (glass cannon), **The Grinning Stranger** ← Site Foreman (becomes a fear/control kit). Unlock conditions and mastery carry over. |
| D3 | Waves are removed from the campaign and Endless (both become level-based). **Boss Rush** stays arena-based. "5-wave / marathon" run modes become short / long act counts. |
| D4 | "A little more Diablo", as recommended: gear with affixes, inventory, consumable belt, town hub, town portal, map, levels to explore. The level-up cards, chaos events, humour and twin-stick shooting stay. **No** click-to-move and no stat-point allocation. **The Diablo features are shaped to fit what the UI pack provides** (§3a). |
| D5 | All four UI colours are used: **Brown** = default and player 1, **Silver** = player 2, **Gold** = player 3 and boss/legendary screens, **White** = player 4 and Settings. |
| D6 | Refactors are approved wherever they make the work cleaner (§11). |

---

## 1. Asset inventory

### 1a. Heroes (`assets/heroes`)

| Folder | Hero | Animations found | Gaps / notes |
| --- | --- | --- | --- |
| `ELVEN_ENCHANTRESS_GUARDIAN_OF_THE_ENCHANTED_FOREST/ELVEN_…` (nested twice) | Elven Enchantress | Attack 13, Dash 11, Heavy_attack 17, Run 11, Skill 17 (south), Victory 17 (south), Walk 11, plus 3 unnamed `256256_SAKPIX_ELITE_ANIMATED_SERIES…` folders (11, 7 and 11 frames, E/S/W) | Unnamed folders, by frame count and direction set: 11 = **idle**, 7 = **hurt**, the `-f6da1716` 11 = **jump**. Confirm by eye during packing. Frames are 172×172, not 256. |
| `NEON_SPECTER/Idle/…` (everything sits under an `Idle` folder) | Neon Specter | attack 14, dash 11, death 17, energy_slash 16 (skill), hurt 9, Idle 11 (two east variants), jump 11, run 14, victory 13, Walk 12 | Complete. Only hero with a **death** animation, so use it. Idle has `east-5760b4a0` and `east-b058ad74`: one is the idle, the other an idle fidget. |
| `THE_GRINNING_STRANGER/THE_GRINNING_STRANGER_Animated_Horror_Character` | The Grinning Stranger | WALK 11, RUN 13, ATTACK 11, `Animate_the_exact…11-fra` (= **idle**, E/S/W), `Create_a_7-frame_hurt…` (= **hurt**), HORROR_STARE 40 (= **skill**, south) | **No dash, heavy, jump or victory.** Dash = run frames plus an afterimage effect. Heavy = attack played slower with a bigger effect. Jump = squash/stretch on idle. Victory = Horror Stare. |

`tools/hero-pack.js` only matches folders named `<Anim>_<n>_frames`. Extend it with an explicit per-hero folder map (exact folder names) and support for the nested root folders.

### 1b. Sidekicks (`assets/sidekicks`, all zipped, 128×128 frames)

| Zip | Belongs to | Animation highlights |
| --- | --- | --- |
| KAEL-09: Neon Blade Operative | Cyber Mercenary | tactical walk, dash boost, energy slash, plasma combo, hologram strike, hurt, death |
| VELKHAR: Lord of the Dead | Dreadbloom Knight | dark idle, necromancer walk, soul dash, bone spear, shadow bolt, hurt |
| INFERNA: Abyssal Valkyrie | Vexaria | idle, run, dash, attack, heavy attack, skill, hurt, death |
| Elowen: Guardian of the Moonlit Grove | Elven Enchantress | forest idle, moonlit walk, nature slash, crescent bloom, spirit summon, ground tremble, root eruption |
| Neon Viper | Neon Specter | breathing idle, cross punch, high kick, flying kick, jumping, getting up, death |
| **Archangel Commander** | The Grinning Stranger | hover idle, celestial drift (walk), celestial rush (dash), divine flight, Seraph Strike / Judgment Cleave / Wingblade Assault (3 attacks), **Divine Guard** (block), **Heavenly Counter**, **Heavenly Rebirth** (revive), Ascension of the Seraph (skill), flinch / stagger (hurt), "losing strength and descending" (death) |
| AUREX: Dragonblood Champion | secret | dragon idle, flame dash, hurt, death, 2 unnamed attacks |
| CORVUS: Harbinger of Pestilence | secret | plague idle, doctor walk, shadow dash, hurt, 3 unnamed attacks |
| Crimson Kitsune Empress | secret | scarlet moon slash, blossom dance, parry (mirror counter), run, jump, death |
| Crimson Oni | secret | crescent slash, execution strike, blood moon iaijutsu, sprint, jump |
| Crimson Shadow Monk | secret | jab, cross punch, high kick, hurricane kick, fireball, crouch; **east only** (mirror for west) |
| Frost Lich King Emperor | secret | hover idle, frozen drift, frost nova, frozen judgment, army of the dead, death |
| MALDRATH: The Fallen King | secret | dark idle, cursed walk (4 directions), shadow dash, hurt, death |
| MORWEN: Witch of the Eclipse | secret | arcane idle / hurt / death in 4 directions, several unnamed casts (498 frames, the biggest) |
| NIGHT RIDER: Urban Biker | secret | idle, run, dash, attack, heavy attack, hurt, jump |
| RAVEN: The Executioner | secret | idle, dash, attack, heavy attack, hurt, jump, death |
| RUNE GOLEM: Guardian of the Lost Shrine | secret | idle, run, dash, attack, heavy attack, jump, hurt |

### 1c. UI: *Super Asset Bundle #5 Mini Pocket Status 2.1* (1,244 PNG + 27 .aseprite)

Reference GIFs from the itch.io page, used as the spec for layout and motion. Save them to `assets/UI/_reference/` so they're available offline:

| What it shows | GIF |
| --- | --- |
| Book open/close | https://img.itch.zone/aW1hZ2UvMTY4MzQwNS8yMjg1Njk4Ni5naWY=/original/nGc0MA.gif |
| Page flip | https://img.itch.zone/aW1hZ2UvMTY4MzQwNS8yMjg1Njk4Ny5naWY=/original/mdla0x.gif |
| Side tabs | https://img.itch.zone/aW1hZ2UvMTY4MzQwNS8yMjg1Njk4OS5naWY=/original/6qZMEN.gif |
| Profile page | https://img.itch.zone/aW1hZ2UvMTY4MzQwNS8yMjg1Njk3OS5naWY=/original/ps3Urw.gif |
| Inventory page | https://img.itch.zone/aW1hZ2UvMTY4MzQwNS8yMjg1Njk4Mi5naWY=/original/uOcIbO.gif |
| Map | https://img.itch.zone/aW1hZ2UvMTY4MzQwNS8yMjg1Njk5MS5naWY=/original/Frc%2Fnf.gif |
| World map | https://img.itch.zone/aW1hZ2UvMTY4MzQwNS8yMjg1Njk5NC5naWY=/original/Fsa777.gif |
| Scroll open/close | https://img.itch.zone/aW1hZ2UvMTY4MzQwNS8yMjg1Njk5NS5naWY=/original/HEtLky.gif |
| Day & night widget | https://img.itch.zone/aW1hZ2UvMTY4MzQwNS8yMjg1Njk4NC5naWY=/original/E4rTXg.gif |
| Settings menu | https://img.itch.zone/aW1hZ2UvMTY4MzQwNS8yMjg1Njk2Ni5naWY=/original/7BBBWo.gif |
| Player HUD | https://img.itch.zone/aW1nLzIyODU0OTk4LmdpZg==/original/4BBhJL.gif |
| Dialogue | https://img.itch.zone/aW1nLzIyODU1MDIyLmdpZg==/original/FxuwO9.gif |
| Pause menu + mini dialogue | https://img.itch.zone/aW1nLzIyODU1MDgyLmdpZg==/original/laZPgr.gif |

---

## 2. Heroes: the three new characters

| Hero | Replaces kit | Role | Special (Q) | Passive |
| --- | --- | --- | --- | --- |
| **Elven Enchantress** | Intern Wrangler | Summoner / support | *Spirit Bloom* (Skill anim): forest spirits erupt and fight for 8 s | A wisp joins her every 8 kills (the old intern rule); healing +20% for nearby allies |
| **Neon Specter** | Glass Gunslinger | Glass-cannon blade dancer | *Energy Slash* (energy_slash anim): a dash-slash line that crits | Dead Eye kept as a passive: crit chance builds while not hit |
| **The Grinning Stranger** | Site Foreman | Control / fear | *Horror Stare* (40-frame anim): enemies in a cone are **feared** (they flee, take +25% damage) | Free barricades become "effigies" that taunt enemies; killing feared enemies spawns a brief shadow |

Work:
- `tools/hero-pack.js`: add the three entries with explicit folder maps (unnamed folders included), handle the nested roots, use the 172×172 source size, synthesise the missing Stranger animations (§1a).
- `js/meta.js` `NEW_HEROES`: change ids/names, keep unlock tests and mastery; the save migration (§11 R8) renames `Wrangler/Gunslinger/Foreman` keys in mastery, loadouts and history.
- `js/art.js`: register the strips; `CH.Kit.byHero` signature VFX colours (Enchantress green/moon, Specter neon cyan-magenta, Stranger sickly white/black).
- Hero select: the 8-direction `rotations/*.png` as a turntable; a **portrait crop** from `rotations/south.png` for each hero (all 6) goes into the HUD portrait frame (§3c).
- Neon Specter's **death** animation plays on game over; the other heroes keep the current treatment.

---

## 3. UI overhaul (Mini Pocket Status)

### 3a. How the pack works, and what that means for the Diablo plan

I checked every folder by eye (contact sheets of all sprites). These findings shape both the UI and the Diablo features in §4:

| Finding | Consequence |
| --- | --- |
| The pack is designed for a **640×360** screen (its Settings menu says so, and the open book is about 485×310 px). The game renders at **480×270**, where the book doesn't fit. | **Refactor R1:** the game's render resolution goes to **640×360**. The UI then fits 1:1 and every pixel lines up, and heroes see more of the larger levels. HUD sprites stay at 1× on the game canvas; DOM menus scale by whole multiples of 640×360. |
| The **Pixel Book has exactly 5 side tabs** (right edge) and a bookmark ribbon. *Tab icons Style 1* holds exactly those 5 icons × 2 states (normal / selected): **Map, Equipment (shirt), Inventory (bag), Profile (card), Settings (gear)**. | The Journal has **5 tabs**, not 10. Extra screens become **pages inside a tab**, browsed with page flips and the pack's **page buttons** (`Buttons/1-2`: "◄ ② ►" with a page number). |
| *Tab icons Style 2* has 6 icons: quill, bag, shirt, red book with "!", floppy disk, gear. | These become the **quick pause menu** (§3c): Journal (quill), Inventory, Equipment, Codex (red book), Save & Quit (floppy), Settings. |
| *Equipments*: 6 slot types (**helm, chest, legs, boots, ring, gloves**) × 3 versions (empty outline, iron, leather). | Gear has **6 slots** matching those icons, not the 9 first planned. The empty outlines show empty slots; the iron and leather versions are the default icon when an item has no art of its own (§4). |
| *items*: 12 objects in small and large versions: log, plank, iron bar, gold, herb, feather, meat, steak, egg, fish, candy, book. | They cover **materials** (log = wood, plank = barricade kit, iron bar = scrap, gold = gold) and **consumables**: food heals over time (meat, steak, egg, fish, candy), herb cures status effects, **feather = town portal quill**, **book = tome** (identify / XP). Large versions are used in tooltips and the shop. |
| *Content/icons*: 6 portraits of the pack's own villager character, plus stat glyphs: heart, boot, coin, shield, **EXP**, and small marks (dot, minus, target, check, house, x, +, arrows). | Character page stats: **HP (heart), speed (boot), gold (coin), armour (shield), EXP**; damage and crit use the game's existing `ic_bonk` / `ic_crit`. The villager portraits are the **town NPCs** (vendor, stash keeper, smith, waypoint keeper, elder, sidekick trainer); the heroes get their own portraits. |
| *Progress bars*: red, blue and orange in 3 sizes, plus empty frames, segmented pips and markers. The colours are **the same in all 4 colour variants**; only the frames differ. | Red = **HP**, blue = **stamina** (the game's Diablo "mana"), orange = **XP**; segmented pips = grenade/potion charges; markers = boss phase notches. Rarity can't be shown by bar colour, so it uses text colour + light beams instead. |
| *Holders*: 18 nine-slice pieces, panels with folded corners, slot square (40) and circle (41). | Tooltips, item cards, shop rows, level-up cards. The slot square is the inventory cell, the circle is the minimap and cooldown frame. |
| *Highlighter*: 5 sizes (small slot, big slot, tab pointer, wide button, corners). | One selection cursor per element type; it follows mouse, keys and gamepad focus. Co-op: tinted per player. |
| *Signs*: 8 diamond road signs: !, house, check, $, +, x, castle, blank. | In-world signposts **and** map pins with one meaning each: ! = breach/hive, house = town/waypoint, check = cleared, $ = shop, + = shrine/healer, x = boss lair, castle = stage exit, blank = quest marker. |
| *Recycle Bin*: 6-frame lid animation. | **Salvage slot** in the Inventory tab (the pack's "PUT YOUR ITEMS HERE TO DISCARD!"): drop gear in to get materials. |
| *Pixel Map*: a scroll (open/close with and without a ribbon) + **hand-drawn map pieces** (compass, mountains, forest, lake, village, fence, roads, rivers, cliff paths, pins). | The pieces suit an **overworld map**, not an exact dungeon automap. So: the **world/act map** is built from these pieces on the ribboned scroll; the **stage automap** (explored rooms) is drawn in the same ink-on-parchment line style on the plain scroll; the HUD **minimap** is a circle Holder with the compass. |
| *Day & Night Cycle*: 15 states × 10 frames (dawn, day, noon, night, raining, lightning 1-5, rain + lightning 1-5); lightning states contain a **white flash frame**. | The HUD clock widget follows the real time of day and weather; the flash frame plays on the **same frame as the world lightning flash**. |
| *More Mini Pocket Assets*: Player HUD, Dialogue Box, Text Popup, Pause Menu, Mini Dialogue Box, Settings Menu (.aseprite + a sheet with baked labels such as PAUSE, OPTIONS, DISPLAY / AUDIO / VIDEO / CONTROLS). | Used as-is for the HUD layout, dialogue, popups, pause and Settings. The baked labels are used where the text matches; everything else uses the game's pixel font (`font.js`) in the pack's ink colour. |

### 3b. Pipeline
- New `tools/pack-ui.js`: export the 27 `.aseprite` files with the Aseprite CLI (`aseprite -b … --sheet … --data …json`, keeping tags); pack all PNGs (4 colours) into strips/atlases; write `data/ui.js` as **its own bundle** (§11 R7).
- `js/uikit.js` (new): `UIK.panel`, `UIK.bar`, `UIK.button`, `UIK.tabs`, `UIK.pageFlip`, `UIK.anim(strip, fps)`, `UIK.cursor` (Highlighter), `UIK.slot`, `UIK.tooltip`, plus the colour rule from D5. Menus stay in the DOM (pad navigation, rebinding and co-op menu ownership already work there) using `border-image` 9-slices and `image-rendering: pixelated`; the HUD draws the same sprites on the canvas.

### 3c. Screens

**The Journal** (Pixel Book; opens with its open animation, page flip between pages, tabs slide in with *Categories / Appear*, out with *Disappear*):

| Tab (Style 1 icon) | Pages (page buttons ◄ n ►) |
| --- | --- |
| **Map** | 1 Stage automap (fog of war, pins) · 2 World / act map · 3 Quests and stage objectives |
| **Equipment** | 1 Paper doll: hero portrait, 6 gear slots, 2 weapons, grenade, sidekick slot · 2 Stats (heart / boot / coin / shield / EXP icons + damage, crit) · 3 Build: level-up cards, evolutions, cursed cards |
| **Inventory** | 1 Bag grid + Recycle Bin + consumable belt · 2 Stash (town only) · 3 Materials (wood / scrap / stone / plank / herbs …) |
| **Profile** | 1 Hero & mastery · 2 Sidekicks roster · 3 Trophy Codex · 4 Achievements · 5 Lifetime stats & run history |
| **Settings** | Display · Audio · Video (shader options, §5) · Controls: the pack's 4-tab Settings layout |

Each co-op player opens **their own** Journal in their colour. In split screen it opens on that player's half; while merged, the opener owns the screen.

**Other screens:**

| Screen | Built from |
| --- | --- |
| Quick pause | *3 Pause Menu* + Style 2 icons (Journal, Inventory, Equipment, Codex, Save & Quit, Settings) |
| Main menu / hero select / co-op lobby | Gold book: one page per hero, flip to browse, turntable portrait, Highlighter cursor |
| HUD (canvas) | *0 Player HUD* layout: hero portrait in the portrait frame, red HP, blue stamina, orange XP, belt of 4 consumables with pips, Day & Night widget, circle minimap with compass and sign pins. Co-op: one compact HUD per player in their colour |
| Dialogue | *1 Dialogue Box* for NPCs (villager portraits), sidekick unlock scenes, act intros; *4 Mini Dialogue Box* for in-combat barks; *2 Text Popup* for pickups and warnings |
| Level-up cards, boss rewards, branch choice | Holder cards; Gold variant for legendary / boss rewards |
| Shop | §6 |

### 3d. Done when
- `tests/t13_ui.js` lists every file in `assets/UI/**` and fails if one is not referenced by the `data/ui.js` meta (this makes "use every asset" checkable).
- Every screen works on mouse, keyboard and gamepad, and with 1-4 players.

---

## 4. Diablo layer, fitted to the UI pack

Kept: twin-stick combat, level-up cards, chaos events, humour, weapons. Added:

1. **Gear in 6 slots**: Helm, Chest, Legs, Boots, Ring, Gloves (the pack's Equipments set). Rarities: Normal (white), Magic (blue, 1-2 affixes), Rare (yellow, 3-4), Legendary (orange, unique effect), Set (green, set bonus). Affixes feed the existing stat pipeline (`Upgrades.computeStats` / `X.statHooks`). Item art comes from the 650 power-up icons and 367 loot icons grouped by slot shape; otherwise the slot's iron/leather Equipments icon.
2. **Weapons stay the game's weapons** (slots I and II); gear can roll weapon-specific affixes ("+1 bounce for the Rubber Chicken").
3. **Loot feel**: drop explosions from elites, bosses and hives; coloured ground labels and light beams by rarity; hold `Alt` / `View` to show all labels; comparison tooltips on Holder cards.
4. **Inventory**: bag grid, equip and compare, salvage into the Recycle Bin for materials (feeds the existing safehouse economy), stash in town.
5. **Consumable belt** (the Diablo potion belt, using the pack's items): 4 slots with shared cooldown. Food heals over time (meat, steak, egg, fish, candy, stronger to weaker), herb cures status effects, **feather = town portal**, book = tome. Health globes / food drops stay.
6. **Town hub**: the safehouse becomes a walkable town between acts with **NPCs who use the pack's villager portraits**: vendor (the shop, §6), stash keeper, smith (crafting and weapon levels), sidekick trainer, elder (quests) and the waypoint. Safehouse stations and decorations sit in the town.
7. **Town portal + waypoints** on each stage (house sign).
8. **Elite packs**: the existing affix system as champion packs with a named Rare leader; a named unique monster per stage.
9. **Shrines and events** placed in rooms (+ sign).
10. **Quests per act** (Map tab, page 3), pinned on the maps.
11. **Difficulty tiers after a win**: Normal → Nightmare → Hell, with Heat stacked on top.

Saves: `inventory`, `stash`, `equipped`, `belt`, `act`, `waypoints`, `quests` (all through the Storage v2 sanitiser, §11 R8).

---

## 5. Atmosphere and shaders

A **WebGL2 post-process pass** (`js/postfx.js`, new; refactor R5). The finished 2D frame (640×360) is uploaded as a texture, shaded at native resolution (cheap, and the pixel look survives), then scaled up with nearest-neighbour filtering. If WebGL2 is not available, or Video → Effects is **Off**, the 2D path runs unchanged (this also covers `t7_fallback.js`).

| Effect | How |
| --- | --- |
| **Biome grading** | Per-biome colour grade (LUT strip): Caldera/fire = orange-red with heat haze, embers and ash; Crypt/blood = desaturated with crimson highlights; others keep their palette |
| **"World on fire"** | Heat-haze distortion near lava, fire hazards and burning props (distortion mask drawn by the renderer), rising embers, a flickering orange light map |
| **"Blood-drenched"** | Blood splatters that persist and pool (kill splatters merge into puddles that use the water shader in red), crimson low-HP vignette, blood-moon tint during Vexaria's special and at night in the Crypt; blood rain as a Crypt weather |
| **Day/night** | Stage clock (dawn → day → noon → dusk → night). At night a **light map**: hero light radius as in Diablo, torches, fireballs, lava, muzzle flashes, glowing pickups. Night: enemies +10% damage, +15% loot. Drives the Day & Night widget |
| **Rain storm** | The existing rain particles + a wet-surface sheen, splashes, ripples in puddles, darker grade |
| **Thunder and lightning** | Flash that lights the scene for 2 frames (sharp shadows from props), thunder delayed by distance, occasional telegraphed lightning strikes that hurt everyone. Widget plays its Lightning / Rain + Light states with the flash frame in sync |
| **Snow** | Snowflake layer, snow building up on the ground, footprints, cold grade |
| **Blizzard** | Wind-driven heavy snow, whiteout fog that shrinks visibility around each hero, −10% move speed, enemies seen as silhouettes until close |
| **Fog** | Low scrolling ground fog in the Crypt and at dawn |

**Water / blood / lava puddles: one shader, different colours.**
- Puddles are **shapes in the level data** placed by the generator (low spots, near pipes, dungeon corners, around corpses), drawn into a puddle mask.
- The shader reflects the scene (mirrored sample above each puddle), distorts it with two scrolling normal maps (ripples), darkens the edges (Fresnel), adds a specular highlight from the light map, and adds **rain ripples** while it rains.
- Uniform `tint`: water (blue-grey, high reflection), blood (`#7a0010`, low reflection, darker), toxic (green, slime), lava (glowing orange, no reflection, with heat haze).
- Gameplay: water leaves wet footprints and puts out burning; blood pools grow from kills; lava burns; frost freezes water into slippery ice.

Each act has a weather table (Backyard: sun/rain/thunderstorm; Caldera: ash fall/fire storm; Crypt: fog/blood rain; Frozen Pass: snow/blizzard). Chaos events can force weather.

Settings → **Video** tab: Effects Off / Low / High, a separate toggle for heat haze and distortion (motion-sensitive players); lightning flashes follow the existing *flashing effects* setting.

---

## 6. Vending machine shop menu

`G.interact` currently takes 25 coins and gives a random result. Replace it with:
- Interacting sets `G.state = 'shop'`, which pauses the simulation like `levelup`. In co-op everyone pauses and the player who opened it owns the menu (same pattern as level-up cards).
- **Look:** an opened Holder panel in the buyer's colour, item cells (slot squares) with the large item art in the detail panel (as on the pack's inventory page: picture, stats, price, short blurb), Highlighter cursor, coin counter with the coin icon, vendor quip in the Mini Dialogue Box, the **$ sign** above the machine in the world.
- **Categories:** Consumables (food, herbs, town portal feathers, grenade refill), Power-ups (pick a specific one), Gear (3 Magic/Rare items scaled to depth), Weapons (unowned), Services (reroll tokens, weapon level, heal), Gamble ("BZZT!", the old random roll, cheaper).
- **Sell tab** for gear and trophies, with buyback of the last 5.
- Stock is generated per machine and stage, with a "reroll stock" button. Prices scale with depth and difficulty (`B.shop` becomes a table).
- The town vendor NPC opens the same menu with a larger stock.

---

## 7. Sidekicks

A sidekick is a full-size AI companion (bigger and stronger than the existing pets, which stay).

- **Data:** `js/sidekicks.js` (new): `SK.DEFS[id] = { name, owner?, anims, role, stats, attacks[], unlock }`. Built on the shared actor base (§11 R9), so animation, status effects and collision are shared with heroes and enemies.
- **Assets:** `tools/pack-sidekicks.js` unzips (7-Zip, like `unpack-new-assets.js`) to `assets/sidekicks/_unpacked/…`, maps folders to `idle/walk/run/dash/attack/heavy/skill/hurt/death`, scales 128 → about 48 px, mirrors east-only sets (Shadow Monk) and writes `data/sidekicks.js` as its own bundle.
- **AI** (state machine like `enemies.js`): follow and leash to the owner, pick targets near the owner, attacks with cooldowns, dodge telegraphed hazards, revive a downed owner after 6 s (once per stage), barks in the Mini Dialogue Box.
- **Main sidekicks** (always unlocked, assigned by default):

| Hero | Sidekick | Role |
| --- | --- | --- |
| Cyber Mercenary | KAEL-09, Neon Blade Operative | melee skirmisher (energy slash, hologram strike) |
| Dreadbloom Knight | VELKHAR, Lord of the Dead | caster (bone spear, shadow bolt, raises a skeleton) |
| Vexaria | INFERNA, Abyssal Valkyrie | bruiser (heavy attack, dash) |
| Elven Enchantress | Elowen, Guardian of the Moonlit Grove | healer/support (spirit summon heals, root eruption roots enemies) |
| Neon Specter | Neon Viper | brawler (kicks knock enemies back) |
| The Grinning Stranger | Archangel Commander | guardian: **Divine Guard** blocks shots aimed at the Stranger, **Heavenly Counter** answers melee hits, **Heavenly Rebirth** is the revive. A light-and-dark pairing with the horror hero |

- **Secret sidekicks** (found or earned, then usable by any hero, chosen on the Profile → Sidekicks page):

| Sidekick | How to unlock |
| --- | --- |
| AUREX, Dragonblood Champion | Defeat a dragon boss (Ignis, Aurelis or Vorax) |
| CORVUS, Harbinger of Pestilence | Defeat Glorp the Toxic Ooze or Mycelia |
| Crimson Kitsune Empress | Challenge: 25 perfect parries in one run |
| Crimson Oni | Defeat Malkor the Pit Lord on Nightmare |
| Crimson Shadow Monk | Found: a hidden dojo room (secret area, §9) |
| Frost Lich King Emperor | Defeat Frostmaw on the Frozen Pass |
| MALDRATH, The Fallen King | Defeat the Skull King |
| MORWEN, Witch of the Eclipse | Defeat Nyx'ra the Void Eye at night |
| NIGHT RIDER, Urban Biker | Found: a locked garage in the Outbreak City (key from a named unique) |
| RAVEN, The Executioner | Kill 100 elites (lifetime) |
| RUNE GOLEM, Guardian of the Lost Shrine | Quest: restore the Lost Shrine (Act I event) |

- Unlock moment: Dialogue Box scene, then the sidekick joins; saved in `Storage.sidekicks`.
- Sidekicks level up during a run and have **one gear slot** (a ring).
- Co-op: each player brings one sidekick. Enemy count scales by +0.35 per sidekick. With 4 players, sidekicks use a lighter AI tick to stay inside the performance budget.

---

## 8. Hives and portals instead of waves

**Spawners** (`js/spawners.js`, new) are placed by the level generator (§9):

| Type | Biomes | Spawns |
| --- | --- | --- |
| **Glitch Portal** | Glitch, Corporate | wisps, influencers, accountants |
| **Hive / Nest** | Backyard, Valley | slimes, spiders, plants |
| **Grave / Ossuary** | Crypt, Outbreak | skeletons, zombies |
| **Hell Gate** | Caldera | hounds, golems, imps |
| **War Camp** | Scrapyard | orcs, goblins |
| **Frost Rift** | Frozen Pass | frost slimes, frost golems, aqua spiders |

- **Gauntlet rules:** each spawner has HP and **3 levels**. Damage lowers its level, and lower levels spawn weaker enemies more slowly. It only spawns while a hero is within ~1.5 screens, with a per-spawner alive cap. Each has a Progress Bar and a **! sign pin** on the maps.
- **Diablo rules:** each stage also has **pre-placed monster packs** that wait in rooms (sleep/aggro radius), elite packs and a named unique.
- **Objective:** *Close the Breaches*. Destroying every spawner (or N of M on big stages) breaks the seal on the exit. Each closed spawner gives a loot burst + XP.
- **Pacing:** the timed chaos events stay; a "threat clock" levels up breaches left open too long (stops turtling).
- **Bosses:** each act ends in a boss lair (**x sign**). The existing boss pools and rotating alternates become per-act pools.

**Everything that reads `G.wave` moves to `G.depth`** (stage index; refactor R2):

| System | Change |
| --- | --- |
| `balance.js` waves (`hpScale`, `dmgScale`, `aliveCap`, `spawnInterval`, `eliteChance`, `arenaForWave`, `bossWaves`) | → `B.depth.*`; spawn values move to spawner levels |
| `game.js` wave loop, banners, spawn queue | → the new run director: `startStage`, "BREACH CLOSED" / "STAGE CLEARED" |
| `waves.js` run modes, branch points, boss choice | → act/stage selection on the world map; branches become two exits with different destinations |
| `foes.js` wave modifiers, bounty board, mini-bosses | → stage modifiers, bounty per stage, mini-boss as the named unique |
| `meta.js` hero unlocks ("reach wave 4/8"), achievements, daily runs, history, ghost, mastery XP | → depth thresholds; `highestWave` saves migrate to `highestDepth` |
| Vending machine (one per wave) | → one per stage + the town vendor |
| Endless | → endless descent: generated stages forever, boss every 5th, biomes rotate |
| Tests: `t5_ui`, `t8_endless`, `t10_coop`, `t11_content`, `t12_drops`, `batch*.js` | rewritten for stages; bots learn to navigate (§9) |

---

## 9. Diablo-style levels

A run is made of **acts**, each act of **stages** you walk through.

| Act | Stages (tileset) | Boss pool |
| --- | --- | --- |
| I. The Broken Backyard | Backyard outskirts → Overgrown Valley (*Valley Ruin*) → Lost Shrine | Frog of War, Elderroot, Boulder Dash, Glorp, Sir Skullhorn, Valtrix |
| II. Corporate Hell | Office floors → Scrapyard (*Wasteland Survivor Kit*) → Outbreak City (*Zombie Apocalypse*) | CEO of Evil, Xal'atath, Graveljaw, Mycelia |
| III. The Deep | Psychological Crypt (*Psychological Horror Dungeon*) → Molten Caldera (*Volcanic Ruins*) → **Frozen Pass** (new: recoloured tiles + snow shader) | Gargoyle, Frostmaw, Skeleton Maw, Aurelis, Mecha Golem, Vorax, Ignis, Nyx'ra, Malkor |
| IV. The Glitch | Glitch Dimension stages | The Final Bug, Skull King, Daddy |

Short / long run modes = 2 / 4 acts.

**Generator** (`js/levelgen.js`, new, **seeded**, so daily runs stay identical for everyone):
- **Dungeon layout** (Crypt, Caldera, Office): BSP rooms + corridors, doors, dead ends with treasure.
- **Outdoor layout** (Backyard, Valley, Scrapyard, City, Frozen Pass): a large open map with cellular-automata blockers (cliffs, ruins, wreck walls) and paths between clearings.
- Each stage has an entrance, an **exit** (castle sign), a **waypoint** (house sign), 3-6 spawners, monster packs, 1-2 shrines, chests, puddles (§5), the existing props, and **secret rooms** (cracked walls you shoot open; where the Shadow Monk / Night Rider are found).
- Size: about 3-6× the current 2880×1620 arena.

**Engine work** (refactors R3/R4):
- **Tile collision with walls** (currently circles in an open arena) for players, enemies, sidekicks, projectiles and the camera.
- **Pathfinding:** a flow field from each hero on the tile grid, recomputed at most every 0.25 s and shared by all enemies.
- **Rendering:** floor pre-rendered in cached 256×256 chunks drawn by visibility; walls y-sorted with entities.
- **Fog of war + maps:** explored tiles revealed around each hero → HUD minimap and the Journal automap.
- **Co-op:** split screen still follows heroes; add "teleport to partner" at waypoints and edge arrows to the exit.
- **Bots** (`tests/batch*.js`) navigate by the flow field (nearest unexplored room → spawner → exit) so balance testing keeps working.

---

## 10. Cross-cutting

- **Performance budget:** 60 fps with 4 players + 4 sidekicks + 95 enemies on the largest stage at 640×360 with Effects High (extend `tests/perf.js`).
- **README:** controls (belt, map, Journal, town portal), feature list, test list.
- **Asset coverage tests** for UI, heroes and sidekicks (the "use every asset" rule).

---

## 11. Refactors (approved; most are done first, see §12)

| # | Refactor | Why |
| --- | --- | --- |
| **R1** | **Render resolution 480×270 → 640×360** (`B.view`, cameras in `views.js`, HUD layout, `font.js` sizes, menus' scale step) | Matches the UI pack's native size so it lines up pixel-for-pixel; more view range for explored levels. Sprite sizes stay the same |
| **R2** | **Run director** (`js/run.js`): moves the run flow (act → stage → town, `startStage`, clear/exit, boss lair, victory, endless descent) out of `game.js` (1,620 lines) and `waves.js`; `G.wave` → `G.depth` everywhere | Waves are what everything hangs off; one owner for the run flow keeps the migration contained |
| **R3** | **Level model** (`js/level.js`): tile grid + collision + chunks + spawners + puddles + fog of war. `arenas.js` becomes **biome definitions** (tiles, props, weather, music, enemy mix) used by `levelgen.js` | Open-arena data can't express walls, rooms or exits |
| **R4** | **One movement/collision function** (`World.move(entity, dx, dy)`) and **flow-field pathing** used by players, enemies, bosses, sidekicks and projectiles | Currently each moves itself against circle props; walls need one shared rule |
| **R5** | **Render pipeline in layers**: floor chunks → decals/puddle mask → entities (y-sorted with walls) → lights → weather → **PostFX (WebGL)** → HUD. Split `render.js` along those layers | Shaders, light map and puddles need separate inputs |
| **R6** | **UI consolidation**: `uikit.js` components; the **Journal** replaces the separate in-run screens (Extras, Codex, Safehouse UI, stats, pause); `ui.js`, `extras.js`, `codex.js`, `shelter.js` keep their logic but render through the Journal pages | Five tabs with pages replace many separate DOM screens and look consistent |
| **R7** | **Asset bundles + manifest**: split the ~29 MB `data/assets.js` into `core`, `ui`, `heroes`, `sidekicks`, `bosses`, `audio` bundles loaded via `<script>` tags with a manifest; each optional with the procedural fallback | Keeps `file://` working and startup quick as new art arrives |
| **R8** | **Storage v2** with step-by-step migrations (wave → depth, hero id renames, new inventory / sidekick / quest fields) and a migration test | Players' existing saves must survive |
| **R9** | **Shared actor base** (animation player, status effects, hit/hurt, knockback, collision) for heroes, sidekicks, enemies and bosses | Sidekicks would otherwise copy player and enemy code |
| **R10** | **Test harness for stages**: helpers to generate a seeded stage, teleport, close breaches and exit; bots with navigation | Most existing tests assume waves |

---

## 12. Refactor first? Yes: Phase 0

**Decision: do the structural refactors first, as a phase that changes no gameplay.** Reasons:

- **Almost every feature sits on them.** Levels and hives (8, 9) need the level model, shared movement and the run director (R2-R4). Shaders and puddles (5) need render layers (R5). Sidekicks (7) need the shared actor base (R9). Building the features on the old structure means building them twice.
- **Refactors are only safe to check while behaviour is unchanged.** Today the 13 test scripts, the bot win rates and the perf test describe the current game exactly. Once features land, a regression could come from either the refactor or the feature. After, nobody can tell.
- **The project is not under version control** (`F:\dev\Chris Game` is not a git repo), and patch scripts have corrupted files here before. A large refactor needs a way back.

**Not refactored first:**
- R6 (UI consolidation) needs the UI pack's components, so it is done with the UI work (M3).
- The actual wave → depth gameplay change belongs to the hives milestone (M8). Phase 0 only prepares the code for it.

### Phase 0 steps

Each step ends with the **gate**: every test script passes; `batch.js normal 10 human` and `batch_coop.js normal 5 human` win rates within ±5 points of the baseline; `perf.js` frame time within 5%; a save from before the step still loads.

| Step | Work | Notes |
| --- | --- | --- |
| P0.0 | **Safety net**: `git init`, `.gitignore` (`data/assets.js` and other generated bundles stay out, or go in via Git LFS), first commit. Run the full test suite and record the results; record baselines: screenshot set, bot win rates, perf numbers | Fix or write down anything already failing *before* refactoring, so old failures don't get blamed on the refactor |
| P0.1 | **R8 Storage v2**: versioned saves with step-by-step migrations and a migration test (old save → v2 → loads the same) | Only the framework and a version bump; new fields arrive with their features |
| P0.2 | **R7 Asset bundles + manifest**: split `data/assets.js` into `core` / `heroes` / `bosses` / `audio` (+ empty `ui` / `sidekicks` slots) | Same content, same game; `t7_fallback.js` covers missing bundles |
| P0.3 | **R9 Shared actor base**: hero, enemies and bosses share the animation player, status effects, hit/hurt and knockback | Largest behaviour risk in Phase 0; `t2_systems`, `t3_bosses`, `t9_vfx` are the check |
| P0.4 | **R4 `World.move` + flow-field pathing** against today's circle props and arena bounds | In an open arena the flow field gives the same chase behaviour, so the bot win rates catch differences |
| P0.5 | **R3 Level model**: today's arenas become `Level`s (an open grid with border walls, props as solid cells/circles, floor in cached chunks); `arenas.js` becomes biome definitions | Levels with walls only arrive in M7; the model is proven on today's arenas first |
| P0.6 | **R5 Render layers**: split `render.js` into floor chunks → decals → entities → lights → weather → post-FX (a pass-through for now) → HUD | Screenshot comparison against P0.0's set |
| P0.7 | **R2 Run director** (`run.js`): today's waves run as the "wave" stage type; `G.depth` is introduced (equal to the wave number for now); Boss Rush runs through it too | All wave tests keep passing unchanged |
| P0.8 | **R10 Test harness**: shared helpers (seeded level, teleport, start/clear stage), bots steer with the flow field | Helpers used by every later milestone |
| P0.9 | **R1 Resolution 640×360** | Last, because it is the only step that changes how the game looks; take the screenshot baselines again afterwards |

**Can run alongside Phase 0:** M1 (the asset pipeline tools). It only touches `tools/` and new bundle files, not game code.

---

## 13. Order of work after Phase 0 (milestones)

Each milestone leaves the game playable and its tests green.

| # | Milestone | Includes | Depends on |
| --- | --- | --- | --- |
| M1 | Asset pipelines: unzip sidekicks, pack the 3 heroes, pack the UI (+ .aseprite export), coverage tests | `tools/hero-pack.js`, `tools/pack-ui.js`, `tools/pack-sidekicks.js` | P0.2 (bundle format) |
| M2 | Three new heroes playable with real sprites and kits; hero portraits; save migration for the renamed heroes | `meta.js`, `art.js`, `player.js`, lobby | M1, P0.1, P0.3 |
| M3 | UI kit + HUD + quick pause + Settings; Journal with 5 tabs and page flips (**R6**) | `uikit.js`, `ui.js`, `hudx.js`, `style.css` | M1, P0.9 |
| M4 | Vending shop menu (`shop` state) | `shop.js`, `game.js` | M3 |
| M5 | Sidekicks: AI, main sidekicks, roster page | `sidekicks.js` | M1, M3, P0.3 |
| M6 | PostFX: grading, day/night + light map, rain, thunder, snow, blizzard, fog; Day & Night widget | `postfx.js`, `weather.js` | P0.6, M3 |
| M7 | **Levels**: generator (dungeon + outdoor), walls, chunks, fog of war, minimap/automap, secret rooms | `levelgen.js`, `level.js` | P0.4, P0.5 |
| M8 | **Hives + wave → depth**: spawners, every system moved to `G.depth`, acts, boss lairs, endless descent, bots navigate | `spawners.js`, `run.js`, `waves.js`, `foes.js`, `meta.js`, tests | M7, P0.7, P0.8 |
| M9 | Puddles (water / blood / toxic / lava), blood pooling, footprints | `postfx.js`, `levelgen.js` | M6, M7 |
| M10 | Diablo layer: 6-slot gear + affixes, inventory + Recycle Bin, consumable belt, town with NPCs, town portal, waypoints, quests, Nightmare/Hell | `items.js`, Journal pages, `shelter.js` | M3, M8 |
| M11 | Secret sidekick unlocks (bosses, challenges, secret rooms) + dialogue scenes; world map | `sidekicks.js`, `levelgen.js` | M5, M8 |
| M12 | Balance pass with the bots, performance pass, README | all | everything |

M7 + M8 are still the largest gameplay change, but after Phase 0 they build on a tested level model, movement system and run director instead of reworking them. M2-M6 don't depend on M7/M8 and can be done in any order once their inputs are ready.

---

## 14. Progress log and deviations (kept up to date while the work is done)

Everything below is committed to `DocDamage/chris-game` (code only; `assets/` and `data/` are generated or local).

**Done**

| Step | State | Notes |
| --- | --- | --- |
| P0.0 safety net | done | git, baseline logs in `.baseline/` |
| P0.1 Storage v2 | done | `t20_storage.js`; also fixed a regex bug that dropped saved loot |
| P0.2 bundles | done | `tools/split-bundles.js`: core, heroes, bosses, audio, ui, sidekicks |
| M1 pipelines | done | hero packs (6), sidekick packs (17), UI pack (1,244 PNG + 27 .aseprite), `t21_assets.js` |
| R1 640x360 | done | DOM menus keep the 480x270 grid (`B.ui`); canvas is 640x360 (`B.view`) |
| M2 heroes | done | `js/kits.js`, ids `Enchantress`, `Specter`, `Stranger`, save migration, Specter death animation |
| M3 UI | done (first pass) | `uikit.js`, pack-styled panels/buttons/HUD bars + portrait, the Journal (`journal.js`) |
| M4 shop | done | `shop.js`, `G.state = 'shop'`, categories, sell/buyback, reroll, `$` sign |
| M5 sidekicks | done | `sidekicks.js`, 17 companions, AI, revive, roster page |
| M6 PostFX | done | `atmos.js` (clock, weather, strikes, lights, puddles, Day & Night widget) + `postfx.js` (WebGL2 pass, Settings > Video) |
| M7 levels | done | `level.js`, `levelgen.js`: tile grid, walls, flow field, fog, chunked floor, minimap, secrets |
| M8 hives | done (first pass) | `spawners.js`, `run.js`: hives with 3 levels, packs, shrines, chests, waypoints, exit |
| M9 puddles | done | water / blood / toxic / lava, blood pools grow from kills, lava and goo hurt; footprints and the shader rework in §17 |
| M10 Diablo layer | done | `items.js`, `quests.js`, `dialogue.js`, `town.js`: gear, bag, belt, town, portal quill, waypoints, quests, tiers |
| M11 secret sidekicks + map | done | unlock conditions in `quests.js`, `mapscroll.js` (automap + act map), `menus.js` (pause row, hero select book) |
| M12 balance, perf, README | done (first pass) | `tests/batch_levels.js` + `navbot.js`; `tests/perf_levels.js`: about 3 ms per frame with 4 players, 4 sidekicks, 98 enemies |

**Deviations from the plan, and why**

- **Journal tabs.** The pack's book has six tabs (quill, bag, shirt, red book, floppy, gear: the *Style 2* icons), not
  the five of *Style 1*. So the Journal is: Journal / Inventory / Equipment / Codex / Save & Quit / Settings. The map is
  its own scroll (the Pixel Map), not a book tab.
- **R2-R5, R9 as full refactors were not done as a separate no-behaviour-change phase.** They were built where the
  features needed them: `G.wave` stays as the stage number (`G.depth` is an alias) instead of a rename across the code;
  walls use `Level.pushOut` after every move instead of a rewritten `World.move`; the floor is chunked inside
  `Level`; sidekicks have their own small state machine instead of a shared actor base. The old test suite stayed green
  throughout, which was the purpose of Phase 0.
- **Boss stages stay arena fights** (wave code), levels are the stages between them. Boss Rush, tutorial and the old wave
  loop are still available (`CH.Run.levels = false`; the tests that are about waves run that way).
- **Tests default to wave mode and no sidekicks** (`open()` in `tests/lib.js` takes `{ levels, sidekicks }`).

**Not done / deferred (honest list)**

- Snow footprints and slippery ice (the puddles, their reflections, burning lava and goo, and footprints out of blood, water and goo are in: section 17).
- Chaos events forcing a weather type; dedicated gear art beyond the pack's Equipments icons (the 650 power-up icons are used for power-ups, not gear).
- The pack's baked label sheet (PAUSE / OPTIONS ...) is exported but the screens use the game font in the pack's ink colour.
- Co-op: the Journal, shop and dialogue take the colour of the player who opened them for the shop and dialogue; the Journal itself always opens in Brown.
- Balance was tuned with bots only (they win about 85-100% of classic runs and take real damage); human playtesting will want a pass.

**Fixes after first playtest (2026-10-22)**

- The Extras & Modes page did nothing: its click handler sat on the old screen element while the Journal moves the panel. Now on the panel itself, closes the book before a run starts, and training / tutorial / rush stay arena modes. `t31_extras.js` clicks every launch button.
- Heroes and monsters now collide with walls and props at the feet (not the body centre) and props get hitboxes from their sprite width, so nobody hovers in front of rock or sinks into it. `t33_physics.js`.
- Jump has its own key (`B`, pad `B` when nothing is there to interact with); old saves that bound it to Space migrate.
- The puddle shader compares against a copy of the floor and leaves heroes and monsters alone.
- Esc works with a slider focused (it was swallowed), the Journal no longer focuses a slider first, pause and Journal reach with the pad (shoulders = tabs / cards, triggers = pages). `t32_pause.js` drives the pause menu with real mouse and keyboard.

**Real assets pass + campfires (2026-10-22, second playtest)**

- Level walls are autotiled from the Valley Ruin wall sheets (hedge for the backyard, snowy rock for the frozen pass, the same rock sheet tinted per biome for the rest): four 16px sub-tiles per cell pick edge, corner and front-face pieces from their own neighbours. Office, glitch and frozen floors use the pack textures too (dungeon slabs tinted, snow rock). The 43px ground textures are cropped to their opaque core so they tile without black seams.
- Chests are the pack's four chests (wood, steel, gold, blue relic by tier, with the opened frame); shrines are the occult altar; breach bodies are pack props (standing stone, altar, statue, hell pillars, barricade + war-camp fire, spikes) with the glow drawn on top.
- Idylwild's Chromatic Campfires are packed (`tools/pack-props.js`: `prop.camp.<colour>`, `prop.campsmoke.<colour>`) and placed by `js/fires.js` in every level (entrance, waypoints, ~1/3 of rooms), the town and the four corners of every boss/wave arena. Solid, jumpable, never destructible.
- Fires sway in the wind (flame and smoke drawn in 1px slices sheared by height; wind strength follows the weather; trees share the same wind), shed embers downwind, and are flickering lights that glow even by day. The shader marches rays from each pixel toward the six nearest fires through an occluder map of walls and solid props, so walls and rocks cast real shadows. `t34_fires_walls.js`.
- Still procedural (no matching asset in the packs): the exit pad ring, waypoint ring, puddles themselves (the shader makes them), and the wall tops of the dark biomes are one shared rock sheet tinted per biome rather than a dedicated art set per biome.

---

## 15. Third playtest (2026-10-23): twelve requests

| # | Request | What was found | Plan |
| --- | --- | --- | --- |
| 1 | Many assets have no collision | Sheet pieces with the `deco` role and several `obj.*` props are walk-through; the rest use one circle whatever their shape | Every upright piece is solid with a footprint box (its bottom band), only flat pieces (decals, rugs, small litter) stay walkable; NPCs, chests, shrines, hives and waypoints block too |
| 2 | Hero animations missing / too fast | Walking up or down shows a single static rotation frame with a bob; idle uses that frame too; the attack strip (11-15 frames) is squeezed into 0.22 s (50-70 fps), the dash into 0.24 s | Heroes always play walk / run / idle strips; every state plays at its own frame rate; attacks last as long as their animation and land on the impact frame |
| 3 | Some enemy animations broken | Giant spider: the walk strip is cut at 32 px but its frames are 56 px wide (half a spider every other frame), idle is one frame. Goblin: the attack is cut into 7 frames but has 5 (blank frames) | Fix the cuts; the spider's sleep strip becomes the sleeping-pack idle; the 4-direction packs (goblin, orc, plant, slime) use their side rows |
| 4 | Heroes and enemies float | Walk / run frames sit 1-2 px above the feet line, the rotation frames add a 2 px bob, and the four top-down packs have a grey shadow baked under the feet that the anchor stands on | Per-frame ground snap for small offsets (deliberate lifts such as jumps stay), no rotation bob, baked shadows removed in the packer |
| 5 | The hideout makes no sense | The town is four grey wall blocks, random bushes / rocks and props on a street texture | A walled camp with a plaza, a stall per NPC furnished with matching props, paths, fences, a gate with the portal |
| 6 | Enemies a little small | Tiny RPG enemies are drawn 1:1 (orc ~16 px next to a 33 px hero on 32 px tiles) | Baked up-scale (EPX 2x, then area down to ~1.45x) with radius, foot, shadow and height scaled to match |
| 7 | No more random upgrade cards: XP and a Diablo skill tree | Level-ups pause the game for 3 cards (upgrades, perks, weapons, evolutions) | Each level gives a skill point; `K` (pad: Back/View long press, or the HUD button) opens a three-branch tree per hero; the old card effects become nodes with ranks and tier gates; no pause on level-up |
| 8 | Main menu too busy | 11 stacked buttons, best score, difficulty chip and two rows of key hints | Five main buttons, a small icon row for the rest, inline hero switch, no key strip |
| 9 | Stages have no direction or cohesion | Props, decals and lights are scattered at random per room | Rooms get a role on the route from entrance to exit; hives sit in enemy camps / nests built from matching props; ruined buildings, graveyards, storage yards; a marked main path |
| 10 | Hero attacks do not feel right; swords need length | Every hero fires the Junk Launcher while its own sword animation plays | Each hero gets a signature attack that matches its art (Dreadbloom greatsword, Vexaria blood blade, Stranger knife, Mercenary pulse fist, Enchantress bow, Specter pistol); melee reach 56-72 px, wind-up / impact / recovery from the animation, a 3-hit combo with a heavy finisher, hit-stop and knockback |
| 11 | Swarms overlap into a mess | Separation uses the tiny collision radius (5-11 px) against 15-30 px wide sprites and pushes positions every frame | Separation by body width, soft steering instead of position shoving, surround slots around the target, facing hysteresis |
| 12 | Use more of the props, SFX and VFX, cohesively | Three of seven VFX packs no longer load (the folders were renamed to `Pack N`), several tileset sheets are never sliced | Fix the VFX paths, slice the unused sheets, label every piece by kind so set pieces can pick matching props, more SFX variety on hits, steps and camps |

Order: sprites and animation (2, 3, 4, 6), crowds (11), hero attacks (10), collision and the prop catalogue (1, 12), stages and the hideout (9, 5), skill tree (7), main menu (8), tests and docs.

### 15.1 Progress

| Step | State | Notes |
| --- | --- | --- |
| Art fixes (2, 3, 4, 6) | done | `tools/pack-monsters.js`, `tools/pack-extra.js`: baked shadows removed (`png.unshadow`), 4-direction rows (`walk_d` / `walk_u`), spider 56px frames + sleep strip, goblin attack 5 frames, top-down packs and golems packed bigger; `Sprites.sheet` bakes an EPX up-scale (`scale`) and a per-frame ground snap (`snap`, `fdy`); `Art.ESCALE` scales look / radius; heroes play their strips in every direction, attack / dash / hurt / jump on their own clocks |
| Crowds (11) | done | `E.separate`: grid, body-width personal space, steering velocity capped to the enemy's pace, heroes solid; smoothed facing with hysteresis; depth sort by feet with a stable tie-break |
| Hero weapons (10) | done | `js/heroatk.js`: six signature weapons (registered as real weapons, slot I), animation-timed attacks, three-hit combos, melee snap, slow-while-swinging, hit-stop, reach arc drawn at the blade's end; own SFX per weapon (`tools/sounds.js`: 104 names / 469 clips) |
| Collision + catalogue (1, 12) | done | `js/props.js`: every sliced piece labelled (kind, draw scale, box footprint, light, flags), grid collision for heroes / enemies / sidekicks / projectiles / jumps / flow field; 16 more sheets sliced (`tools/pack-sheets.js`), VFX packs found again (`tools/vfxdirs.js`) |
| Stages (9) | done | `js/setpieces.js`: route trail painted into the floor (`Level.paintTrail`), hero camp, enemy camps / nests around breaches with loitering packs, a scene per room by biome, open-ground clumps, wall-foot clutter, reachability pass |
| Hideout (5) | done | `js/hideout.js`: fixed layout (houses + stalls, plaza, yards, gate), solid NPC stand-ins drawn depth-sorted, Valley Ruin villager + giant tree packed |
| Skill tree (7) | done | `js/skills.js`: points per level, three trees x five tiers, `K` / pause menu / HUD chip, grid navigation, co-op per player; cards kept behind `CH.Skills.on = false` for `t13_perks` |
| Main menu (8) | done | five buttons + link row, hero name on the HERO button, no key strip |
| Tests + docs | done | `t35_playtest3.js`; `t5_ui`, `t6_audio`, `t10_coop`, `t13_perks`, `t33_physics` updated; README "Third playtest" |

**After the full suite run (2026-10-23)**

- Without the asset bundle the game crashed at boot (the Skills pause button had no anchor in the plain pause panel) and again in play (a loitering camp monster read `anims` of a placeholder sprite). Both guarded; `t7_fallback` passes.
- Level generation was over budget (450-590 ms for the first level of each biome): `PR.sprite` and `Sheets.sprite` read pixels back from GPU canvases. Their scratch canvases are now `willReadFrequently`; the first level takes 80-120 ms.
- Stale or flaky tests fixed: `t10_coop` (the hero's own weapon holds slot I and lands on its impact frame; a monster from the rumble check ate the mouse shots; the main menu has one button fewer above SETTINGS), `test_features` (rustle is measured from the feet), `test_new_features` (the car's scrap scatters past the 16 px base pickup range; level props under the test car).
- `t35_playtest3` (never in a suite run before) found real issues: boot read pixels back from about 5,400 GPU canvases (the sheet bake now reads the source images through one CPU scratch canvas, and `scaleFrame` records each frame's bottom row); walk frames floated because each animation's ground was its *lowest* frame (now the most common bottom row, snapping up to 2 source pixels both ways); two solid set pieces could leave a gap narrower than a hero's feet, trapping them (`D.free` now wants 12 px or no gap); goblin (13 px) and intern (16 px) were still small (goblin gets a 1.45x baked up-scale, intern 1.65x; the slime stays a blob). Test-side: spawn rule moves targets 80 px off a hero, ranged weapons release along the live mouse aim, the loiter check could start next to the camp, the hero trees have 9 skills by design.
- Screenshots of `t4` / `t5` / `t7` / `t8` are written next to the tests (they landed in the current directory and got committed from the repo root).

## 16. Refactor (2026-10-23, done)

| Step | State | Notes |
| --- | --- | --- |
| 1. Test harness | done | `tests/run.js` (parallel, ~3 min, `--retry`, `--seed`), seeded `Math.random` in `open()` (`CHAOS_SEED`), `__clear()` |
| 2a. Events instead of wrappers: `killEnemy`, `step` | done | `G.on` / `G.emit` / `G.hooks()` in `game.js`; the 21 observer wrappers (11 kill, 10 step) are listeners now, same order (script order). Suite 38/38 with seeds 2 and 3; seed 1 had t5_ui / t7_fallback time out while two extra Chromes ran, both pass alone. The replay comparison (2b) is the stronger check still to do |
| 2b. Replay check | done | `tests/replay.js`: seeded bot run fingerprinted every game second; `--root <checkout>` runs another copy, `--compare a b`. Wave mode drifted (from second 5, with four runs at once) because `js/audio.js` drew sound variants from `Math.random` while sound files decode asynchronously; audio now has its own generator (`rnd`), and four parallel runs match. The pre-refactor commit `08a7449` (a worktree with `data/` and `assets/` as junctions, and the same audio fix) and this one replay identically: seeds 1, 2 and 3, 90 to 300 game seconds, both modes. The wave trace is the strong one (wave 5, 98 kills by second 150); the level bot kills nothing in that time, so the level trace mostly covers movement |
| 2b'. Fallout of the audio fix | done | The seeded tests see a different random sequence now, which showed two seed-1 failures. `t35_playtest3`: a camp's loiterer stepped into a toxic puddle, the hit counted as the hero's (`hitEnemy` credits puddles to `G.player`) and woke the whole camp with the hero 480 px away, a real bug: loiterers now take no puddle damage (`js/atmos.js`). `t8_endless` (failing on seed 1 before the fix too): the god-mode bot needed more than 80 × 300 frames for the final boss (312 / 3,600 hp left); the budget is 160, and the loop ends at victory |
| 2c. More events | done | `G.call(name, ev, core)` in `game.js`: `name:before` listeners run newest first and one can take the call over (`ev.stop`: the older before-listeners, the core and the older after-listeners are skipped; `ev.core` runs the core later), then `name` listeners oldest first: exactly how the wrappers nested. 42 wrappers are listeners now: `newRun` 14 (7 before + 7 after), `startWave` 7 (the town, level stages and the path choice take it over), `damageEnemy` 7 (fear and shields change `ev.dmg`, a shield that swallows a hit takes over with 0), `hurtPlayer` 5 (an audit changes `ev.dmg`, training takes over with 0), `Player.update` 9 as `playerUpdate` (a root keeps `ev.x0`/`ev.y0`, a swing slows the core and restores `ev.sm` after it; it restored in a `finally` before, so a core that throws would now leave the slow on). Replays identical to the commit before 2c (seeds 1-3, 150 s); `t36_events` checks the order, the take-overs, shields, fear and training |
| 3a. One collision module | done | `js/world.js`: one resolver (`World.pushBox` for wall tiles and box props, `World.pushCircle` for round props; it was written twice, in `level.js` and `props.js`), the arena edge (`World.keepIn` for heroes, crawling, the blink, sidekicks and pickups, which each had their own copy; `World.bounceIn` for monsters), where each kind of body touches props and walls (`World.FEET`), the once-per-step wall pass (`World.settleWalls`, still called from `run.js` at the same point of the step) and the reach of a prop's top for jumping on, landing and walking off (`World.reach`, written three times in `player.js`). No numbers changed and walls are still settled once per step, not per move, so replays stay identical (seeds 1-3, 150 s); `t37_world` pins the rules down |
| 3b. Even out the rules | done | Chosen by the owner, four gameplay changes: **pickups** flung or dropped stop at level walls on the axis that hit and are pushed out of props (`World.stopAt`; the magnet still pulls over them, so nothing gets stuck behind a wall); **projectiles** meet level walls as they move: bouncing ones turn back on the axis that hit (`World.bounceShot`), the rest end there like at the arena edge (so a grenade goes off instead of vanishing), and tall solid props stop enemy shots (`World.shotHits`, the footprint test player shots used; low jumpable props are shot over); **one feet circle per body** against props and walls (`World.FEET`: heroes 10 / 5, sidekicks 10 / 7, monsters `min(12, foot*0.8)` / `min(r, 7)`, bosses 14 / `min(r, 12)`; `Level.pushOutFeet` no longer caps radii itself); **a crowd shove is rechecked** against the arena edge and props. `t37_world` covers each; bots before / after: levels 5/6 and 5/6 wins, arenas 2/8 and 3/8. The two stalls seen in those runs are older: a crate gap the flow field routes walkers through (the reconstructed stage stalls the same on the pre-3b code) and a kiting stalemate between a short-reach hero and slow office monsters (a pre-3b run stalled the same way) |
| 3c. Small props in the flow field | done | The field left out solid props under 9 px, so it sent walkers straight into crates and stools; the faster ones slid round, the slower ones stuck (two orcs never got past a pair of crates in 30 s, a slime took 6 s for 150 px) and the test bot, whose keys drop a small sideways part, pushed flat into one and shuttled for ten minutes. A small prop now blocks a tile only if a walker's feet (7 px) could not stand in its middle, so corridors with a stool off to one side stay open (`t25` finds nothing cut off in any biome). `t38_flow` rebuilds the stage it was found on (run seed 1144006020, office, stage 4); level bot 5/6 wins before and after, and the ten-minute stall is gone (slowest run 492 s, was 1,156 s).  |
| 3d. Special attacks run to the end | done | Found while checking 3c, fixed at the owner's choice: orcs, plants and spiders picked their special attack by `e.tele.kind`, which `strike` clears when the wind-up ends, so from the first action frame they ran their melee branch instead. The orc's rage charge never charged (beyond 140 px it wound up in place, over and over, and barely closed in) and plants and spiders never reset their spit / web cooldowns (5 spits in 7 s, 9 webs in 9 s). `beginAttack` keeps the kind in `e.atkKind` for the whole attack. `t39_attacks` checks the charge and the cooldowns (it fails all three on the old code); bots before / after: levels 5/6 and 6/6 wins, arenas 3/8 and 2/8 |
| 4. Shared actor base | done | `js/actor.js`. A survey of the four kinds (Player and Enemy are classes, Boss extends Enemy, sidekicks are plain objects) found animation, status effects and death genuinely different per kind, and bosses and monsters already sharing one damage core; what had been copied is shared now: `Actor.fadeHit` (a hit's flash x6, squash x7 and hurt pose fading, in monsters, bosses and the fear and camp-loiter updates), `Actor.decayKnock` (heroes 9, monsters 7 or 0.35 of that in low gravity, sidekicks 8 per second), `Actor.pushFrom` (the push a hit gives: heroes 150, sidekicks 90) and `Actor.blink` (the invulnerability blink), with each kind's numbers in `Actor.KIND`. Same arithmetic, so replays stay identical; `t40_actor` pins the rules down. Left as they are on purpose: four animation pickers, four death flows, the hero's fixed x0.62 slow, chill as a time stamp, the hero ignoring `o.kx` from boss hits, sidekicks' unread `hurtT` |

## 17. Puddles and tracks (2026-10-23)

| Step | State | Notes |
| --- | --- | --- |
| Puddle art | done | `js/atmos.js`: every puddle has its own wobbly outline (`seed`) and two cached pixel images, the ground layer and its patch of the shader mask (R kind, G distance down from the far edge or lava heat, B depth, A coverage x gloss). Water darkens the ground round its rim and catches light on the far rim; blood has spatter, a thick dark middle and a gloss, spreads as it lands and dries matte brown over a minute; goo eats the ground; lava has crust plates. Kill blood is rebuilt every 2 px of growth |
| Shader | done | `js/postfx.js`: a moving surface (two drifting ripple octaves, raindrop rings), the bed refracted through it, what stands behind a puddle mirrored about its far edge (the biome's sky or ceiling, `GRADE.sky`, where nothing does), a soft sun sheen and twinkling pixel sparkles; blood slow, thick and glossy; at night every light behind a puddle shows as a long streak in it; lava and goo glow after the light map instead of being darkened by it |
| The overlay bug | done | The shader told floor from characters by comparing the *final* frame with a floor copy, so the rain tint, god rays, wind tint and the screen vignette counted as characters and switched most puddle pixels off. `js/render.js` now has `Atmos.snap` take the floor (after animated tiles and the rain sheen) and the characters (before the full-screen overlays), per view |
| Tracks | done | Feet that leave blood, water or goo print it: 18 blood prints, 9 water (evaporate in 8 s), 12 goo; each print fainter than the last; shoes for heroes and sidekicks, paws for monsters, nothing for flyers or a hero in the air; fresh blood prints shine for 8 s and turn brown after 20. No randomness, so replays don't change |
| Tests | done | `t29_postfx`: 18 fading blood prints, none inside the puddle; monster paws, no flyer prints; water prints evaporate; the shader still shades a puddle under rain and the vignette |

## 18. The haunted world: no more runs, new packs, going back, height, secrets, the hideout's people, omens (2026-10-23, accepted)

The owner's requests of 2026-10-23, and the design they lead to. The three new tile packs and the NPCs are catalogued
sheet by sheet in `docs/ASSET_PACKS.md` (contents, slicer results, cut method, role, scale, special uses).

### 18.1 The requests

1. Rework the random chaos events into something meaningful.
2. Go back to earlier stages, because later stages give secrets and abilities that open things there (as in
   *Symphony of the Night*).
3. Replace the first stage's Valley Ruin art with **Creepy Forest**, using every sheet of the pack, properly cut.
4. Use **Haunted Victorian City** where it makes sense throughout the game.
5. Deeper level design: height (hills, stairs) and light platforming.
6. Secret areas with rare items, weapons and other secrets.
7. Roles for the new hideout NPCs: a **Nurse**, a **Doctor** and **Jesus Christ**.
8. Portals as a full-circle effect instead of the sideways ring.
9. A new building with the **cult NPCs** inside, who give something special for a task or quest; a Victorian house.
10. Kit-bash all the packs where it makes sense.
11. **Frozen Kingdom** for the snow stages.

Also in the NPC folder, not mentioned: **Lucifer** (160 px frames: hellfire, dark magic, flight).

**Decided with the owner (2026-10-23):**
- **No more runs: a game like Diablo.** One persistent character per save slot and a persistent world (18.3, K0).
- **Death**: wake in the hideout and drop some gold where you died; walk back to the corpse to get it back. An optional
  **hardcore** character is gone for good when it dies.
- **Returning to a cleared area** repopulates it with fewer monsters; closed breaches and killed bosses stay gone.
- **Characters**: Diablo-style save slots, each one hero.
- **Modes**: endless, boss rush, training and the tutorial are removed; the first area teaches the basics with hints.
- **Hideout roles** as proposed below; **Lucifer is a hideout figure**, not an enemy; **light platforming**.
- **Local co-op** offers all three ways when a second player joins: bring **their own saved hero** (it keeps its level,
  gear and progress), play a **temporary guest hero** scaled to the host's level (nothing saved), or stay **solo** (co-op
  off). The world and its progress belong to the host's save.
- **Existing saves**: start fresh; the old save is kept aside under its old key, unused.
- **Heroes** keep unlocking (some open at the start, the rest through the story: act bosses, quests), across all slots.
- **Relics, crafting, resources and pets** belong to each character, like gear; **achievements and the codex** stay
  account-wide.
- **Quitting inside an area**: the next load starts in the hideout; the area keeps what you changed and repopulates.

**Decided with the owner (2026-10-24), before unattended work on K0-K11:**
- Each milestone is pushed to main once the full suite passes.
- **Jesus and Lucifer** speak in the game's own irreverent, chaotic voice.
- **Heroes**: a new character can pick the Mercenary only; Dreadbloom unlocks by beating the Act I boss and Vexaria by
  beating Act II (account-wide).
- Choices this plan does not cover are made as the work goes and listed in 18.5.

### 18.2 What the packs give and lack (summary of `docs/ASSET_PACKS.md`)

- All 60 sheets are transparent, AI-made imitation pixel art with baked title banners, frames and stray letter
  fragments; ground swatches are not seamless; walls, doors, fences and cliffs face south only; nothing is animated;
  each sheet wants its own scale. One cutting tool with per-sheet rules handles all of it (K1).
- **Creepy Forest**: ~70 ground variants, paths, rotten fences, cabin walls / roofs / doors, dead trees, twisted roots,
  graveyards and crypts, ritual circles, lanterns, signs, bones, cages, wells, altars, two glowing portals, a skull gate.
  No cliffs or walls to bound rooms, no stairs or bridges.
- **Frozen Kingdom**: snow ground, icy paths, frozen water, **glacier cliffs**, ice castle walls and gatehouse, Nordic
  houses, **bridges (one with stairs)**, crystals, pines, rune plates, statues and two portals, a market and a camp,
  **snow footprints and flakes**. No cliff sides or ramps, no open water.
- **Haunted Victorian City**: cobbles and sidewalks, wall / roof / door / window modules for facades, lamps, iron fences,
  carriages, cemetery and mausoleums, statues, a market, furniture, sewer pipes with ladders, occult candles and a
  pentagram, ruined district debris, thrones, a skull portal arch. No complete houses (facades are assembled), no
  interiors, no stairs.
- **NPCs**: Nurse and Doctor (48 px, heal animations), Jesus (bless), four cult members (idle, walk, pray, attack),
  Lucifer (boss-sized).

### 18.3 Design

**No more runs (the owner's decision).** The game becomes one persistent adventure per character, like Diablo:
- **Save slots** (character select): the hero, level, experience, skill tree, gear, inventory, belt, stash, gold, the
  abilities found, quests, and the world's state. Saves go through Storage v2's migrations; the old run-based save data
  (unlocks, mastery, trophies) carries over where it has a meaning (heroes unlocked, codex).
- **The world**: acts made of areas. Each area is generated once per save from the save's seed and is the same on
  every visit. What you change there is kept (chests, broken walls, secrets, closed breaches, killed bosses); monsters
  come back thinner when you leave and return. Waypoints are discovered and travelled between, as now, but persist.
- **Acts**: Act I The Dead Wood (forest areas, its crypt, the boss), Act II the Gaslight District (streets, cemetery,
  sewers, the cathedral), Act III the Frozen Kingdom (glacier, frozen town, the ice castle), Act IV below (volcano,
  the hell breaches). Finishing the game opens Nightmare, then Hell, as the difficulty tiers do now.
- **Death**: you wake in the hideout; some gold lies where you died, as a corpse marker you can walk back to. Hardcore
  characters are deleted on death (a choice at character creation).
- **Gone**: run setup and scoring, heat, challenges, run modes (classic / short / marathon), endless, boss rush,
  training, the tutorial, the wave loop as the main game (boss arenas stay as boss areas). The first area teaches.

**Stages and biomes (requests 3, 4, 10, 11).**
- `backyard` becomes **The Dead Wood** (Creepy Forest): stage 1. Floors from sheets 1-3; rooms bounded by the existing
  rock-cliff wall autotile, darkened, behind rows of dead trees and twisted roots; cabins, a graveyard and a well per
  stage; the giant twisted tree as a landmark. Valley Ruin stays only for the walls it lends.
- A new biome **Gaslight District** (Haunted Victorian City): cobbled streets bounded by assembled house facades and iron
  fences, a cemetery quarter with mausoleums (crypt entrances), sewer grates and ladders, ruined blocks.
- `frozen` uses **Frozen Kingdom** throughout: glacier-cliff plateaus, frozen lakes, the ice castle as the boss approach.
- `dungeon` (the crypt) borrows the graveyard and mausoleum sets from both new packs.
- Kit-bashing: Volcanic Ruins stairs and bridges recoloured for forest and city height; Frozen glacier cliffs re-tinted
  as rock for the forest; Victorian furniture for cabin and cult interiors; candles and occult props shared by every
  dark biome. Every sheet of the three packs is used somewhere (a test checks that each sheet has placed pieces).

**Going back (request 2).** The run's map becomes a small world of linked stages. A stage is rebuilt from the run seed,
so it is the same stage when you return; what you changed there is kept (closed breaches, opened chests, broken walls,
found secrets). Waypoints and the hideout's portal take you to any stage you have visited. Abilities found later open
blocks placed in earlier stages, and the Journal's map marks each block with the ability it wants:

| Ability (found in) | Opens |
| --- | --- |
| **Grave Hook** / glide (Dead Wood depths) | ledges and gaps too wide to jump |
| **Bone Breaker** (Gaslight crypt) | boarded doors, cracked walls, rubble |
| **Frost Step** (Frozen Kingdom) | swamp and dark water freeze into paths; ice floes |
| **Lantern of Truth** (Jesus) | false walls and hidden doors show themselves |
| **Cult Sigil** (cult house task) | sealed sigil doors and ritual circles |

**Height and platforming (request 5).** Levels get a height per cell (0, 1, 2): plateaus with cliff faces (glacier
cliffs, rock cliffs, house walls), stairs and ramps to climb them, ledges you can drop from, and gaps of one or two tiles
you jump over (the jump exists). Falling into a pit costs a little health and puts you back at the edge. Monsters path
by height (stairs only); fights stay on one level per area so twin-stick play stays readable. Bridges (Frozen 8,
Volcanic 17) span gaps.

**Secrets (request 6).** Every stage has one to three: behind cracked walls (exists), false walls, boarded doors, under
open graves, sewer grates, wells and mausoleums (a small cellar), across frozen lakes, up ledges. They hold rare weapons,
relics, sidekick unlocks and lore pages for the Codex. Warning signs, skull stakes and cracked floor tiles hint at them;
the map shows a "?" once you have seen a hint.

**The hideout's people (request 7).**
- **Nurse**: potions and the consumable belt; a revive charge she refills (used, you get up where you fell instead of waking in the hideout).
- **Doctor**: permanent body upgrades from rare materials found in secrets (more health, a bigger belt, faster revive)
  and a "surgery" that resets the skill tree for a price.
- **Jesus**: blessings. Give up something (gold, a relic, a cult reward you no longer want) for a boon on the next
  stages; he lifts the curses the cult's gifts carry, and gives the **Lantern of Truth** for a pilgrimage quest.
- The six existing villagers keep their trades (vendor, stash, smith, sidekick trainer, elder, waypoint keeper).

**The cult house and Lucifer (request 9).** A Victorian house at the edge of the hideout (a sheet 3-6 facade, the purple
eye door), entered as a small interior room: cultists praying around the pentagram, candles, grimoires, and **Lucifer on
the throne**. The cultists give dark tasks ("clear an area without healing", "carry this idol through an area", "kill an
elite in the dark") for the cult's favour; **Lucifer trades**: bargains for power with a price (strong relics carrying a
curse, the **Cult Sigil**, a reroll of an item's affixes for a lasting drawback). Jesus, across the square, lifts the
curses: the two are a deliberate pair. Lucifer is not fought.

**Portals (request 8).** One front-facing circular vortex for every portal (town, stage exits, breaches, waypoints): a
glowing ring, spiral arms turning inward, sparks drawn into the centre, light and a little shader distortion, coloured
per use (cult purple, frost blue, hell red).

**Chaos events become omens (request 1).** No more random timer. A stage may carry one omen with a cause you can see and
end: a **blood moon** (night, stronger monsters, more loot) ended by breaking the moon altar; a **cult ritual** (a circle
summoning waves) ended by killing the chanting cultists; a **breach surge**; a **frost wind** (blizzard, slowing) ended at
the rune pillar; a **haunting** (ghosts through walls). Left alone an omen grows; ending it pays out. Some omens appear
only after cult tasks. The old events' best effects (low gravity, the floor is lava, explosive) become omen effects.

**Also.** Snow footprints (Frozen 18, using the puddle tracks system); slippery ice (frozen water, dark ice paths, ice
bridges); a stage card on entry (biome, omen, known secrets); boss arenas dressed from the new kits (a cathedral of
thrones, the ice castle's throne room); a balance pass after all this (bots win 2-3 of 8 arena runs but 5-6 of 6 level
runs today).

### 18.4 Milestones (each one or a few PRs, with tests and a bot comparison)

| # | What | Needs |
| --- | --- | --- |
| K0 | **No more runs**: save slots, character creation (hero, hardcore), persistent world state per area, acts and areas, death and the corpse, monster repopulation, removal of run modes and scoring, co-op joining (saved hero, guest hero or solo); Storage migration | |
| K0a | **Done.** Saves v3 (`chaosexe.save.v3`): the account (settings, stats, hero unlocks, achievements and their counters, codex, options) and up to 8 character slots (name, hero, hardcore, time played; level, xp, skill points and tree, weapons and their levels, gold, gadget; gear, bag, belt, stash, quests, tiers, waypoints, relics, crafting, resources, loot, pets, sidekicks). `Storage.data` keeps its old shape, composed from the account and the active slot; with no slot (tests, debug) a hidden guest holds the character part. The old `chaosexe.save.v1` is left untouched; only its settings come along. `js/character.js` puts the slot's character on the hero when play starts and writes it back every 15 s, at each stage, on pause, quit, game over and when the page is hidden. PLAY opens the gold book as the character book (PLAY / DELETE with a second click to confirm / BACK per character; the last page makes one: hero, name, hardcore); the HERO button is gone. `t42_characters`; PLAY-click tests use `play()` from tests/lib.js | |
| K0b | **Done.** `js/areas.js`: each character has a world (`slot.world`: seed, the area they are in, the deepest reached, the forks taken, and per area: visits, closed breaches, opened chests, found secret rooms, used shrines, lit waypoints, cleared, boss beaten). Areas are the existing stages 1-10, generated from the world seed, so the same on every visit; what changed is captured with every character save and put back when the area is entered again; a return visit keeps 40% of the monster packs. A character who has been out loads in the hideout, whose portal leads back to the last area (the waypoint keeper to any lit waypoint); a new character starts in area 1. A beaten boss's arena is walked past. Act bosses unlock heroes for the account (`stats.acts`: Dreadbloom I, Vexaria II, Specter III, Enchantress IV; Stranger still 10 bosses). Without a character play runs as before (tests). `t43_world` | K0a |
| K0c | **Done.** A character whose party falls wakes in the hideout, whole; half the gold they carried waits at a corpse (a cross with glinting gold, "YOUR CORPSE") in the area of death, also in a boss arena; walking over it gives it back. Saved in `world.corpse`. A hardcore character's slot is deleted and the game over screen reads R.I.P. NAME with no RETRY. Without a character: the old game over. `t44_death` | K0b |
| K0d | **Done.** Part 1: the run setups are gone (quick / marathon / boss rush modes, Heat pacts, starting loadouts, daily and custom-seed runs, challenges, the training room, run history, ghosts, leaderboards, the run summary, the Extras PLAY and HISTORY tabs; Extras keeps achievements, heroes, safehouse with the companion picker, trophy sets, bestiary, options). The tutorial wave became first-area hints for a new character, once per account; the mode achievements became world ones. Part 2: no path screens (a world's forks come from its seed: act II office or wasteland, act III dungeon, volcano or glitch), no endless descent, no RESTART (pause and Journal offer SAVE & QUIT), no score / combo HUD, best score or NEW BEST; the HUD reads STAGE n or HIDEOUT. The final boss's screen reads THE WORLD IS SAVED for a character, whose BACK TO THE HIDEOUT plays on (the portal leads to area 1 again); without a character it stays VICTORY with PLAY AGAIN. t8_endless removed; t5, t11, t12, t16, t32, t36, t43, test_new_features updated | K0b |
| K0e | **Done.** In the co-op lobby each player cycles through the saved characters nobody else took and a guest of every unlocked hero. Player 1 starts on the active character and hosts (the world, the gold and the bag are theirs). A partner's own character brings its level, skills, weapons and gear (Items.equippedOf reads its own slot) and its progress is written back with every host save (its own gold is left alone); a guest starts at player 1's level with the skill points to match and nothing is saved. Solo is PLAY. `t45_coop_join` | K0a |
| K1 | **Done.** `tools/pack-kits.js` cuts all 60 sheets by the rules of `docs/ASSET_PACKS.md` into 2,197 pieces (`kit.<sheet>.<n>`, meta.kits: role, size and source box per piece) plus 13 set pieces at their own scale (portals, the skull gate, the pentagram, the giant tree ...), and packs the nurse, doctor, Jesus, Lucifer and four cultists as animation strips facing east and the camera (`npc.<id>.<anim>.<e/s>`, meta.npcs), scaled to hero height (Jesus' figures are 26 px in both of his frame sizes, so both get x1.3). Ground swatches are tiles only when the square inside their border is fully painted (edge pieces, boulders and the skull statue keep their shapes): 113 opaque 32 px tiles. New bundles `kits` (9.4 MB) and `npcs` (1.1 MB); every other bundle is byte-identical. `node tools/pack-kits.js` writes contact sheets to `tools/out/kits/`. `t41_kits` checks it all. Roles are a first guess on a few sheets (hv19 mostly `decal`); K2-K4 refine them as they use the pieces | |
| K2 | **Done.** A new biome `deadwood` (The Dead Wood, act I) replaces the Valley Ruin for stages 1-3 of every world: the floor is the Creepy Forest ground swatches (`floor: kit` in js/level.js: two value-noise fields pick dirt, moss, roots, rust, stone and swamp patches, each a base tone with one tile in six an accent), the walls the rock cliff darkened, the trail cobbled. Every piece of the 20 sheets has a prop kind (js/props.js `KCAT`, family c, cut at game scale), and new scenes use them: cabins built into one picture from the log panels, a door and a shingle roof (with a rotten fence, woodpile, lantern and well), ritual circles (blood circle, candles, altar, hooded statues, banners, sometimes a portal), wells, gallows (cages, stocks, skull pikes); graveyards, groves (dead trees, roots, vine arches), camps and fields draw from the pack; the giant twisted tree stands in the biggest quiet room, warning signs mark the secret walls, the skull gate frames the exit and the crypt arch the entrance; music `library`, wind, fog and rain, a cold green grade. Wave and boss arenas of the newer biomes use older arenas (`Arenas.arenaOf`). `t46_deadwood` checks every sheet is used | K0, K1 |
| K3 | **Done.** Act III of every world (stages 7-9) is the Frozen Kingdom: its snow swatches for a floor (powder, frost, cracked ice, cobbles, crystals, dark ice; a cobbled road), every sheet catalogued (family f), and new scenes: frozen hamlets (houses, a market stall, lamps, bunting, a well, the iron-and-snow fence), winter camps (tent, fire, racks, tubs), crystal fields with rune plates, statue avenues with ice pillars, a stretch of the ice castle with its gatehouse; pines, glacier cliffs and ice spikes in the open, ruins, the ice gate at the exit and the ice portal beside it, ice pillars flanking the ends, the icy path pieces in the trail. Frozen water (Frozen 3) lies about as slippery ice (`L.ice`; the hero's acceleration drops to 14% on it); feet leave dents in the snow (a `snow` track in js/atmos.js) but not on the ice; the nearest snowflakes are the pack's own (Frozen 18). The bridges (Frozen 8, apart from their landings) wait for K7. `t49_frozen` | K1 |
| K4 | **Done.** Act II of every world (stages 4-6) is the Gaslight District (`gaslight`): cobbles, slab pavements and grates for a floor (kit.hv1 / hv2), the city walls darkened, every Haunted Victorian City sheet catalogued (family g; sheets 3-8 also give the title's lamp and carriage). New scenes: townhouses built into one picture from brick front modules, a door, windows and a slate roof with a dormer and a chimney (every stage has one, with an iron fence, lamps, a bench, a bin, a poster, a carriage), lamplit streets of carriages, the night market, fenced cemeteries with a mausoleum and statues, occult corners (the pentagram, candles, a throne, cult banners); ruins and graveyards draw from the pack; posters by the secret walls, grates along the trail, the skull arch at the exit and a Gothic throne with candelabras beside it. Its breaches are CULT RIFTs (portals); purple fires, rain and fog, a violet grade, the rain music. Buildings (cabins too) keep their whole footprint clear of every spot the stage needs and are the last thing the reachability pass removes. `t50_gaslight` | K1 |
| K5 | **Done.** `js/vortex.js`: every portal is one front-facing circle (a pool of light on the ground, a halo, a dark eye, four spiral arms turning inward, sparks drawn in, a bright rim) in its own colour: the town portal and the hideout's pad (blue), the open exit (gold), lit waypoints (green, small), portal breaches (their glow). `t47_portals` | |
| K6 | **Done.** `js/clinic.js`: three new people in the hideout with their own animated art (idle facing the camera, their heal / bless move while you talk to them; dialogue portraits from their frames). NURSE MERCY sells food for the belt and refills a revive charge (fall with one and the party gets up where it fell at half health). DR. SAWBONES sells body upgrades for gold and strange organs (one in every secret chest): VITALITY (+10% health, 5 ranks), IRON GUT (+25% healing, 3), SECOND HEART (two revive charges); SURGERY resets the skill tree. JESUS gives a three-area blessing for a tithe (+20% damage, +25% health, +30% gold or +10% crit), lifting curses waits for K9 and the Lantern for K8. The belt, body, revive charges and blessing are saved with the character. A small clinic (beds, a table of jars) and a shrine (cross stone, candles, a bench) dress their corners. `t48_clinic` | K1 |
| K7 | **Done.** Two new cells (js/level.js): PIT (a drop) and LEDGE (a plateau's rim); both block everything that walks, but shots and eyes cross a pit (`blocks()` / `los`). Up to two rooms a stage get a plateau (a rim with two tiles of stairs in its south side, a lighter top) and one gets a one-tile ring of pit round an island with a chest (tier + 2). A hero in the air crosses a pit and may jump down off a rim from its top, never up; one who lands in a pit loses 8% health and is put on the nearest edge. Walkers path round both. Every change is kept only if all a stage needs stays reachable. Drawn as a dark drop with its far face lit, the rim as rock, the stairs as worn steps. `t51_height` | K2-K4 |
| K8 | **Done.** `js/secrets.js`: the new biomes get secret rooms too, and a stage's secrets sit behind a cracked wall or a SEALED cell that only an ability from a later act opens (walk up with it; without it a hint, and the map shows a "?"). The abilities: GRAVE HOOK (act I boss; also longer jumps), BONE BREAKER (act II boss; boarded doors), FROST STEP (act III boss; black water), LANTERN OF TRUTH (Jesus, after the pilgrimage to the Frozen Kingdom; false walls that show nothing until you carry it), CULT SIGIL (Lucifer, K9; sigil doors). Abilities live in the character's world (`world.abilities`); an opened seal is a found secret, so the area keeps it open. The waypoint keeper lists every lit waypoint by name. `t52_secrets` | K0, K7 |
| K9 | **Done.** `js/cult.js`: a house with the purple eye door at the hideout's north-east leads into the cult house (a room of its own: a pentagram, candles, a throne, banners, furniture): four cultists with their own art pray round the pentagram and give one dark task at a time for favour (THE FAST: clear an area's breaches without eating; THE IDOL: reach an area's exit without falling; THE DARK: kill a champion in the dark); LUCIFER trades favour for PACTS (HELLFIRE, GREED, QUICKSILVER, THE EYE: a boon with a curse), the CULT SIGIL and a REFORGE (an equipped item rerolled two levels up, cursed FRAIL). Jesus lifts the curses and the boons stay. Saved in `world.cult`. `t53_cult` | K6, K8 |
| K10 | **Done.** `js/omens.js`: with a character the random chaos timer is off; a stage after the first may carry one omen (two in five, by the world seed) with a cause in a room half way along that glows and can be broken: BLOOD MOON (night; monsters hit 20% harder and take 15% less, drop more gold; the moon altar), THE RITUAL (a blood circle summons monsters; three chanting cultists), BREACH SURGE (breaches breed 1.8x; the surge crystal), FROST WIND (a blizzard, Frozen Kingdom only; the rune pillar), THE HAUNTING (ghosts through the walls; the cursed coffin), THE WARP (low gravity, exploding dead, big heads: the old chaos; the warp stone). Left alone an omen grows every minute (three times, stronger each time); breaking it pays gold, curios and gear, more when it grew, and it stays broken in that area (`world.omens`). An OMEN line sits under the stage on the HUD. Without a character the old chaos events run as before (arenas, tests). `t54_omens` | K9 |
| K11 | **First pass done.** `tests/batch_world.js` takes a new character through a world with the navigation bot (walking out of the hideout after act bosses and deaths). Before tuning: normal / human saved the world in 18 game minutes at level 24 with no deaths; normal / sloppy in 21 minutes, one death (the act III boss); chaotic / human in 21 minutes, one death (the act III boss); all three got the Grave Hook, Bone Breaker and Frost Step; act I and II boss stages took 40-50 s. Change: act bosses have 30% more health in a character's world (`G.bossHpMul`). After: normal / human 18 minutes, no deaths. The bot walks straight to breaches and exits and never explores, shops, crafts or does omens, so these numbers are a floor on pace, not a verdict on difficulty: the next step is a human playtest, then tune per act (monster health, champion share, omen strength) | all |

### 18.5 Choices made during unattended work

Each is a default the owner can change.

- **K11** Only the act bosses were tuned: without a human playtest the rest stays as it was (a world takes a rushing bot ~20 minutes; a player who explores, shops and goes back will take much longer).
- **K10** The old chaos events stay in the code for arenas and tests; in a character's world only THE WARP brings some of them back. Omens do not appear on the first stage of the world or in boss arenas.
- **K9** Prices: a pact 2 favour, the Sigil 3, a reforge 1; FRAIL is -10% health a stack. The cultists are BROTHER VEX, SISTER MOTH, BROTHER ASH and SISTER WICK. The cult house is a room entered from the hideout, not a building interior in the hideout's own map.
- **K8** Abilities come from act bosses rather than from hidden places in the stages; the map marks seals but not the ability letters.
- **K7** Height is "light": one level of plateau, no ramps or monsters on ledges; bridges (Frozen 8, Volcanic 17) are still unused; jumps are the existing ones (the Grave Hook of K8 makes them longer). Plateaus take the middle of a room with a margin of floor round them, so corridors never end at a rim.
- **K6** The names and prices: Nurse Mercy, Dr. Sawbones; food 30-80 gold, a revive charge 120 + 30 x level, Vitality 150 + 100 x rank and rank + 1 organs, Iron Gut 200 + 150 x rank and rank + 2 organs, Second Heart 600 and 4 organs, surgery 50 x level, a blessing 60 + 20 x level for three areas. A "bigger belt" became Second Heart (the belt has four slots in the HUD).
- **K4** Act II is always the Gaslight District in a world (the office / wasteland fork is gone from worlds). Its boss arena is the old Outbreak City arena. Townhouses are three modules wide.
- **K3** The world's act III fork is always the Frozen Kingdom now (the old volcano / crypt / glitch choice is gone from worlds; those biomes stay for arenas and K8 side areas). The act III boss arena is the old crypt arena.
- **K2** The act I boss arena is still the Valley Ruin backyard (a Dead Wood arena comes with the balance pass). The cabins are fronts and roofs only; going inside is K9 (interiors). Stage music is the existing library track.
- **K0e** A partner's gold is not used (the host's gold is shared, as in Diablo's shared town), and gear the partner equips from the shared bag moves into their own character. When the whole party falls, the host's rules apply (a hardcore partner is not deleted unless they host). Guests get unspent skill points equal to their level - 1.
- **K0d** The score is still counted inside (some achievements and the stats use it) but never shown. The hard / safe / secret stage paths only ever applied to arena waves, so they are gone with their prompt; the Outbreak City (zombie biome) is not reachable in a world until K2-K4 redo the biomes. After saving the world the portal leads to area 1; the next difficulty tier is chosen at the elder as before.
- **K0d** Hero mastery stays (per character) and still grows when play ends; crafted consumables are spent when a character sets out. The tutorial's barricade step was dropped (barricades cost materials now). Achievement ids of the removed modes were replaced, not kept.
- **K0c** The corpse holds half the carried gold (Diablo II style: dying again before reaching it leaves that gold for good). No experience is lost. A death wakes the character in the hideout with full health; the area is entered fresh (thinner) on return.
- **K0b** Areas are the existing ten stages (ids 1-10); the act structure and new biomes come with K2-K4. A return visit keeps 40% of the monster packs, whether or not the area was cleared. Leaving through the hideout drops the area's live state (monsters, ground items); only the lasting changes are kept. A beaten boss's arena is skipped on the way through (the area after it starts instead). Story hero unlocks: Dreadbloom (Act I boss), Vexaria (Act II), Specter (Act III), Enchantress (Act IV); the Grinning Stranger keeps "defeat 10 bosses".

## 19. The full world (owner's requests of 2026-10-24)

The owner, on the overnight work: the old biomes are meant to be levels of their own, not only arenas; two more packs
were added (**Dungeon Asset Pack**, 16 sheets, and **Crimson Gothic Castle**, 28 sheets) and every asset of both is to be
used; the parts left "unfinished by design" (boss arenas, height, entering buildings) are to be finished.

**Decided with the owner:** every biome on the main path, **five stages each**; **no Corporate Hell and no Glitch** in the
world (their code stays for arena tests). Nine biomes, 45 stages and four act bosses, 49 areas:

| Act | Areas | Boss |
| --- | --- | --- |
| I | The Dead Wood 1-5, The Catacombs (Dungeon Asset Pack) 6-10 | 11, in the Catacombs |
| II | The Gaslight District 12-16, The Outbreak City 17-21, The Psychological Crypt 22-26 | 27, in the Crypt |
| III | The Scrapyard Wasteland 28-32, The Frozen Kingdom 33-37 | 38, in the Frozen Kingdom |
| IV | The Molten Caldera 39-43, The Crimson Castle 44-48 | 49, the final boss in the Castle |

Difficulty follows a **depth** that climbs from 1 to 10 across the 49 areas (the old stage number's role), so the old
tuning holds at both ends.

| # | What | Needs |
| --- | --- | --- |
| W1 | **Done.** tools/pack-kits.js cuts `da1`-`da16` (Dungeon Asset Pack: files listed in PACKS.da, the pillars sheet black-keyed by a flood fill from its border) and `gc1`-`gc28` (Crimson Gothic Castle, five folders; scale 0.4 for the small Set 1 sheets, 0.27-0.3 for the rest). Every piece gets a prop kind (`meta.kits[id].kinds`): by row for the Dungeon Asset Pack (faces, doors, crates, sacks, pots, traps, lanterns, braziers, skeletons, bones ...), by shape and colour for the castle (`classify`: lava, brazier, shrub, rug, wall strip, pillar, room, plate, block); `node tools/pack-kits.js` also writes one contact sheet per kind (tools/out/kits/kind_*.png). 1,449 new pieces, 464 of them 32 px floor tiles, in a bundle of their own (`data/bundle_dungeons.js`, 7.6 MB). `t41_kits` checks them | |
| W2 | **Done.** Two dungeon biomes. **The Catacombs** (`catacombs`, family a): the Dungeon Asset Pack's flagstones (grey, mossy, brown, with rune patches) and its brick, banner and arch faces on every wall with floor south of it (`faces` in js/level.js); scenes: ossuaries, alchemists' dens, crypts, storerooms, torture rooms, shrines; doors of the pack at both ends; ossuary breaches, purple fires. **The Crimson Castle** (`castle`, family r): its floor tiles sorted by colour at load, the plain ones as each material's base and the framed plaques as accents, a few chosen per stage (`matsFor`); the castle's long wall strips sliced along its walls; scenes: halls (a whole hall of the pack painted into the floor, pillars, braziers), throne rooms (a Gothic throne, a red runner), armouries, gardens, lava halls; the Dungeon Asset Pack lends its small props (kit-bashing). Props of both packs join the pools from their recorded kinds. `t55_dungeons` checks every sheet of both packs is used | W1 |
| W3 | **Done.** `js/worldmap.js`: 49 areas (table above); `G.tier()` (js/game.js) gives the depth (1-10) to every place that scaled by the stage number (monster health and damage, how many at once, breaches, elites and variants, gold, gear and trophy levels, shop prices, sidekicks, power-ups), so area 49 is as hard as the old stage 10. In a world every area is a level: the four act bosses fight in **boss halls** (`WM.hall`: one great room of the act's last biome, columns along the walls, braziers, the middle open; the boss walks in a moment after the heroes; the far door opens when it falls), replacing the old arenas. The bosses, hero unlocks, abilities, quests' acts and secrets' seals follow the map; the banner names each area ("CATACOMBS III", "ACT I BOSS"); the waypoint keeper lists the deepest lit waypoint of each biome; worlds of the old ten-stage map start again (`world.map` 2). Corporate Hell and Glitch are no longer in a world. `t56_worldmap`; t36, t43, t49, t50, t52 moved to the new numbers | W2 |
| W4 | **Done.** `js/interiors.js`: Dead Wood cabins, Gaslight townhouses and Frozen Kingdom houses have a door (`p.enter`, `p.door` set in js/setpieces.js); walking into it builds a furnished room of its own from the world seed, the area and the building (furniture from that biome's pack, a chest, now and then 2-4 monsters waiting), with no weather indoors. The stage outside is held as it was and you come back out at the door; an opened chest is kept in the area (`areas[n].inside`). The castle has no free-standing buildings to enter (its halls are painted into the floor), so castle doors were not added. Lore pages and traders indoors were left out. Test: t57. | W3 |
| W5 | **Height, part 2**: two-tier plateaus, ramps, chasms crossed by bridges (Frozen 8, Volcanic 17, castle bridges) | W3 |
| W6 | Balance pass on the long world (tests/batch_world.js) | all |
