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

- Snow footprints, slippery ice and wet footprints (the puddles themselves, reflections, burning lava and goo are in).
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

## 16. Refactor (2026-10-23, in progress)

| Step | State | Notes |
| --- | --- | --- |
| 1. Test harness | done | `tests/run.js` (parallel, ~3 min, `--retry`, `--seed`), seeded `Math.random` in `open()` (`CHAOS_SEED`), `__clear()` |
| 2a. Events instead of wrappers: `killEnemy`, `step` | done | `G.on` / `G.emit` / `G.hooks()` in `game.js`; the 21 observer wrappers (11 kill, 10 step) are listeners now, same order (script order). Suite 38/38 with seeds 2 and 3; seed 1 had t5_ui / t7_fallback time out while two extra Chromes ran, both pass alone. The replay comparison (2b) is the stronger check still to do |
| 2b. Replay check | done | `tests/replay.js`: seeded bot run fingerprinted every game second; `--root <checkout>` runs another copy, `--compare a b`. Wave mode drifted (from second 5, with four runs at once) because `js/audio.js` drew sound variants from `Math.random` while sound files decode asynchronously; audio now has its own generator (`rnd`), and four parallel runs match. The pre-refactor commit `08a7449` (a worktree with `data/` and `assets/` as junctions, and the same audio fix) and this one replay identically: seeds 1, 2 and 3, 90 to 300 game seconds, both modes. The wave trace is the strong one (wave 5, 98 kills by second 150); the level bot kills nothing in that time, so the level trace mostly covers movement |
| 2b'. Fallout of the audio fix | done | The seeded tests see a different random sequence now, which showed two seed-1 failures. `t35_playtest3`: a camp's loiterer stepped into a toxic puddle, the hit counted as the hero's (`hitEnemy` credits puddles to `G.player`) and woke the whole camp with the hero 480 px away, a real bug: loiterers now take no puddle damage (`js/atmos.js`). `t8_endless` (failing on seed 1 before the fix too): the god-mode bot needed more than 80 × 300 frames for the final boss (312 / 3,600 hp left); the budget is 160, and the loop ends at victory |
| 2c. More events | done | `G.call(name, ev, core)` in `game.js`: `name:before` listeners run newest first and one can take the call over (`ev.stop`: the older before-listeners, the core and the older after-listeners are skipped; `ev.core` runs the core later), then `name` listeners oldest first: exactly how the wrappers nested. 42 wrappers are listeners now: `newRun` 14 (7 before + 7 after), `startWave` 7 (the town, level stages and the path choice take it over), `damageEnemy` 7 (fear and shields change `ev.dmg`, a shield that swallows a hit takes over with 0), `hurtPlayer` 5 (an audit changes `ev.dmg`, training takes over with 0), `Player.update` 9 as `playerUpdate` (a root keeps `ev.x0`/`ev.y0`, a swing slows the core and restores `ev.sm` after it; it restored in a `finally` before, so a core that throws would now leave the slow on). Replays identical to the commit before 2c (seeds 1-3, 150 s); `t36_events` checks the order, the take-overs, shields, fear and training |
| 3. One movement / collision function | todo | |
| 4. Shared actor base | todo | |

## 17. Puddles and tracks (2026-10-23)

| Step | State | Notes |
| --- | --- | --- |
| Puddle art | done | `js/atmos.js`: every puddle has its own wobbly outline (`seed`) and two cached pixel images, the ground layer and its patch of the shader mask (R kind, G distance down from the far edge or lava heat, B depth, A coverage x gloss). Water darkens the ground round its rim and catches light on the far rim; blood has spatter, a thick dark middle and a gloss, spreads as it lands and dries matte brown over a minute; goo eats the ground; lava has crust plates. Kill blood is rebuilt every 2 px of growth |
| Shader | done | `js/postfx.js`: a moving surface (two drifting ripple octaves, raindrop rings), the bed refracted through it, what stands behind a puddle mirrored about its far edge (the biome's sky or ceiling, `GRADE.sky`, where nothing does), a soft sun sheen and twinkling pixel sparkles; blood slow, thick and glossy; at night every light behind a puddle shows as a long streak in it; lava and goo glow after the light map instead of being darkened by it |
| The overlay bug | done | The shader told floor from characters by comparing the *final* frame with a floor copy, so the rain tint, god rays, wind tint and the screen vignette counted as characters and switched most puddle pixels off. `js/render.js` now has `Atmos.snap` take the floor (after animated tiles and the rain sheen) and the characters (before the full-screen overlays), per view |
| Tracks | done | Feet that leave blood, water or goo print it: 18 blood prints, 9 water (evaporate in 8 s), 12 goo; each print fainter than the last; shoes for heroes and sidekicks, paws for monsters, nothing for flyers or a hero in the air; fresh blood prints shine for 8 s and turn brown after 20. No randomness, so replays don't change |
| Tests | done | `t29_postfx`: 18 fading blood prints, none inside the puddle; monster paws, no flyer prints; water prints evaporate; the shader still shades a puddle under rain and the vignette |
