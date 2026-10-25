# CHAOS.exe

A 2D top-down pixel-art arcade roguelite. Reality has crashed, a pile of fantasy monsters leaked into your
backyard and your office, and one of three heroes has to deal with it. Survive 10 waves, beat the bosses,
then keep going in Endless Mode.

Everything runs in the browser: no server, no account, no network.

## Run it

Double-click **`index.html`** (Chrome, Edge or Firefox on desktop). That's it.

The first click/keypress unlocks audio (browser autoplay rules); the soundtrack starts then.

## Controls

### Gamepad (any standard controller: Xbox, PlayStation, Switch Pro...)

| Input | Action |
|---|---|
| Left stick | Move (analog). Click it (**L3**) to toggle sprint |
| Right stick | Aim (a light aim assist can be turned off in Settings) |
| **RT** | Fire the **main** weapon |
| **LT** | Fire the **second** weapon (both triggers together fire both) |
| **RB** | Special ability |
| **LB** | Throw a grenade (3 charges that recharge; the type is chosen with D-pad down) |
| **A** | Dodge roll (jumps instead when a low prop is right in front of you) |
| **B** | Jump; when something usable is in reach (its prompt shows `[B]`): use it. In menus: back |
| **X** | Reload |
| **Y** | Swap the main and second weapon |
| D-pad left / right | Cycle the main weapon |
| D-pad up | Cycle the second weapon |
| D-pad down | Cycle the grenade type: Junk Grenade, Cheese Bomb, Frost Bomb |
| **R3** (click right stick) | Build a barricade (2 wood + 1 scrap) |
| **Start** | Pause / resume |

The D-pad / left stick and **A** / **B** / **Start** also drive every menu. Controllers vibrate when you get hurt and when you use a special (Settings: vibration, aim assist, stick deadzone).

### Keyboard + mouse

| Input | Action |
|---|---|
| `W A S D` | Move |
| `Shift` | Sprint (uses stamina) |
| `Space` | Dodge roll (brief invulnerability, ~1 s cooldown) |
| Left mouse | Fire the main weapon (hold to repeat) |
| Right mouse | Fire the second weapon |
| `G` | Throw a grenade (`X` cycles the type) |
| `Q` | Special ability |
| `R` | Reload (ammo weapons also auto-reload) |
| `E` | Interact: whatever shows a prompt (`[E] OPEN`, `PICK UP`, `ENTER`, `TALK`, `PRAY`, `READ`, `TRAVEL`) |
| `1`-`6`, wheel, `Tab` / `C` | Choose the main weapon |
| `Z` / `V` | Cycle the second weapon / swap the two weapons |
| `Esc` | Pause / resume |
| `F` | Build a barricade where you aim (2 wood + 1 scrap) |
| `B` | Jump (hop over low props and puddles, land on crates). `Space` still hops onto a low prop in front of you |
| `M` / `F11` | Mute / fullscreen |

Keyboard keys can be rebound in **Settings**. Menus work with the keyboard (arrows + Enter), the mouse and a controller. A solo run follows whichever device you touched last, so you can switch between keyboard and controller mid-run.

## Co-op (2-4 players, same computer)

Pick **CO-OP** in the main menu. In the lobby each device joins by pressing its confirm button (**A** on a controller, **Enter** or the button for keyboard + mouse), picks a hero with the D-pad / **A** **D** and readies up. Any devices work: up to four controllers, or controllers plus one keyboard + mouse.

- **One screen or two, depending on distance.** While the heroes are close the whole party shares one screen. Walk far enough apart and a divider slides in, splitting the view into a left and a right half that each follow one hero (the one further left gets the left half); come back together and the halves merge again. Edge arrows point to a partner or a boss that is out of view.
- **Shared progress, personal builds.** XP, coins, score and combo are shared. Every level-up gives **each** player their own skill point to spend in their own skill tree, and boss tokens reward the whole party. Health, stamina, weapons, grenades and specials are per hero.
- **Down, not out.** A hero at zero health is downed; their partner revives them by standing next to them for about 2 seconds (they come back at half health). Downed heroes also get back up when the next wave starts. The run ends when both heroes are down.
- **Tougher enemies.** Co-op adds more enemies, and enemies and bosses with more health and harder hits (numbers in `B.coop` in [`js/balance.js`](js/balance.js)).
- Pull a controller out and the game pauses until you reconnect it.

## What's in the game

- **Heroes (3, from the hero packs):** the **Cyber Mercenary** (balanced; Q = *Overdrive*: shockwave + haste + shield),
  the **Dreadbloom Knight** (tanky, hits hard; Q = *Thorn Nova*: huge blood-thorn explosion) and **Vexaria, Blood
  Moon Knight** (fast, crit-happy; Q = *Blood Moon*: drains every nearby enemy and heals you). Their animations drive
  movement, sprint (run), dodge roll (dash), attacks, hurt, the special skill and the victory screen. Dreadbloom
  unlocks at wave 4, Vexaria after beating a boss.
- **Run:** 10 waves with a boss on wave 3 (**The Frog of War**, **Elderroot the Ancient Treant**, **Boulder Dash**,
  **Valtrix the Archmage**, **Sir Skullhorn the Shield-Breaker** or **Glorp the Toxic Ooze**), wave 5 (**The CEO of Evil**,
  **Xal'atath the Eye Tyrant**, **Graveljaw the Moss Golem** or **Mycelia the Spore Eye**), wave 8 (**The Gargoyle
  Apocalypse**, **Frostmaw the Yeti King**, **The Skeleton Maw**, **Aurelis the Sandwyrm**, **Mecha-stone Golem**,
  **Vorax the Bloodwing**, **Ignis the Pyroclast**, **Nyx'ra the Void Eye** or **Malkor the Pit Lord**) and wave 10 (**The
  Final Bug**, **The Skull King** or **Daddy, the Abomination**). The alternates rotate run by run so every boss shows up.
  After waves 3 and 6 the run **branches**: the game freezes and you choose between two arenas (Scrapyard Wasteland or
  Corporate Hell, then Molten Caldera or Psychological Crypt). Winning unlocks Endless Mode (a boss every 5th wave,
  cycling through all 22 and getting tougher each lap; all seven arenas rotate).
- **Enemies (16 archetypes, state-machine AI with telegraphed attacks):** the ten below plus the Predator Plant (spits),
  Toxic Slime (leaves puddles, splits when it dies), Orc Brute, Goblin Skirmisher (throws spears), Giant Forest Spider
  (webs + leaps) and the **Clay Golem** (slow, armoured, ground slam); each arena favours some of them. The first ten are:
  Angry Orc (lunge), Rogue Wisp (erratic charge), Minotaur Janitor (ground slam), Skeleton Accountant (arrows +
  corporate insults), Speedy Hellhound (fire trail + dash), Influencer Priest (blinding flash), Rampaging Lancer
  (straight charge, struggles to turn), Suspicious Hellbat (orbit + dive), Flame Golem (fireball fans), Unpaid Intern
  Slime (swarms). Elite variants.
- **Mutations (16 more enemies, from the extra art of each pack):** from wave 2 enemies can spawn as tougher variants with
  their own sprite and behaviour: Spitter Bloom and Royal Orchid (faster / triple spit), Venom, Magma (explodes), Frost,
  Volt (fast) and Imp (splits into four) Slimes, Orc Warlord and Chieftain (charge more), Goblin Hunter and Warchief
  (faster / triple spears), Aqua Spider (slowing bite), Brown Recluse (tank), Purple Widow (leaps), and the Crystal
  (shard burst) and Abyssal (quake) Golems. Matching arenas favour their variants and later waves allow the strongest ones.
- **Two weapons at once:** your main weapon sits on the right trigger / left mouse button and a second one on the left trigger / right mouse button; a found weapon becomes the main one and pushes the old one to slot II. Grenades (Junk, Cheese, Frost) are a separate gadget on the left bumper / `G`.
- **Weapons (6):** Junk Launcher, Rubber Chicken Cannon (bounces), Explosive Pizza (AoE + cheese slow),
  Baguette of Doom (melee arc, bats shots back), Office Chair Artillery, Problem Generator (random outcomes).
- **Progression:** XP gems -> level-up -> a skill point for the skill tree (see *Skill tree* below; the old level-up cards are gone) (16 upgrades with max levels + weapon unlocks and
  weapon levels), coins, vending machines, temporary power-ups, boss tokens with special rewards.
- **Chaos events** every 60-90 s: Low Gravity, Chicken Rain, Big Head Mode, Reverse Controls (with warning),
  Disco Inferno, Free Money, Tiny Enemies, The Floor Is Lava, Everything Is Explosive, Corporate Restructuring.
  They change real gameplay values (speed, hitboxes, knockback, hazards, spawns, scoring).
- **Bosses (22, each with its own attack kit, warnings and recovery windows):** Ignis the Pyroclast (dragon: flight,
  inferno, breath), Xal'atath (beholder: gaze, eye beams, madness ring, blink), Valtrix (mage: ice, fire, arcane ray,
  blink-run), Malkor (demon: hellfire cleave, rampage, eruption, imps), Glorp the Toxic Ooze (venom orbs, acid pools,
  belly flop, split), and the newest ten: **Elderroot** (treant: root snare, seed barrage, leaf cyclone, sprouts, bark
  slam), **Graveljaw** (moss golem: boulder toss, ground pound, rolling charge, quake line), **Sir Skullhorn** (shield
  bash, shield wall that soaks 75% of damage, mace whirl, leap slam), **Frostmaw** (yeti: snowballs, avalanche, stomp,
  charge; at half health he shatters into an **Ice Golem** with crystal spikes, shatter rings, glacier ray and frost
  nova), **Daddy** (arm cannon, overcharge blast, scream + summons, stampede), **The Skull King** (assembled from its
  layers: hand slams, chomp, eye beams, bone crown, risen minions, then bone rain and a grand slam in the later of its three
  phases), **Aurelis the Sandwyrm** and **Vorax the Bloodwing** (the other two dragons: sand breath / dust dive /
  sandstorm, and homing blood breath / crimson rain / rend / dread howl) and **Mycelia** and **Nyx'ra** (the other two
  Eye Tyrants: spore bursts, toxic gaze, acid blink, and void beams, singularity, frost rings, phase shift), plus the original seven: Frog of War (leap, tongue, spit, tadpoles),
  Boulder Dash (rolling charge, ground hands, rock punch, stomp), CEO of Evil (paperwork, briefcase charge, summons,
  telegraphed area strikes), Mecha-stone Golem (triple laser, homing rocket arm, slam, burrow), Gargoyle Apocalypse
  (dive charge, bat summons, ground slam), Skeleton Maw (bones, ground hands, blast, teleport, undead summons) and the
  Final Bug (3 phases: bullet rings, beams, rockfall, spirals, blinks, final assault, glitch visuals). Every boss
  drops 2 to 3 **rare trophies**, bonus coins and its own permanent reward.
- **Arenas (7):** The Broken Backyard, Corporate Hell, The Glitch Dimension, The Outbreak City (zombie apocalypse),
  Scrapyard Wasteland, The Molten Caldera and the Psychological Crypt. Each has its own tiles, props, music / ambience
  and weather (sun with god rays, wind with blowing leaves, rain + thunderstorms, glitch storms).
- **Props and resources:** trees, rocks, pillars, wrecks and furniture can be chopped, shot or blown up; they drop
  **wood, scrap and stone** (shown next to the coin counter). Resources are kept between runs: spend them on
  barricades during a fight (**F** / **R3**) and on the safehouse.
- **Trophies (mob drops, 367 items):** every enemy and boss can leave an item from the *mob drops* pack, themed to fit it
  (slimes drop goo and poison, spiders drop webs and eggs, golems drop ore and crystals, orcs drop tusks and hides ...;
  bosses always drop rare ones). Four rarities (Common, Uncommon, Rare, Epic, with a coloured glow). Picking one up gives
  an instant effect by type (heal, XP, wood, scrap, stone or coins, bigger for rarer items) and files it in the
  **Trophy Codex** (menu: TROPHY CODEX, or from the safehouse): the whole collection with silhouettes for what you have
  not found, stock counts, and **selling** for scrap. Completing 5%, 15%, 30%, 50%, 75% and 100% of the codex unlocks
  permanent bonuses (starting coins, damage, max HP, drop chance + XP, speed, coins).
- **Power-ups (from the *power ups* pack, 650 item icons):** the pickup on the floor shows what it does. Twelve kinds:
  **Rage** (swords, +50% damage), **Haste** (boots / wings), **Shield** (shields and armour), **Midas** (gold, double
  coins), **Focus** (+35% fire rate and reload), **Regen** (green potions heal over time), **Scholar** (books, double XP),
  **Luck** (clover: +20% crit and triple loot), **Time Warp** (hourglass: enemies at less than half speed), **Magnet**
  (pulls every pickup), **Boom** (bomb: a huge explosion) and **Treasure** (chest: coins, loot and curios). Health
  pickups are food and red potions. Every icon not used by a kind is a **curio**, treasure that chests, props, elites and
  bosses leave behind, worth coins. Active buffs show as icon chips next to your health bar.
- **Safehouse (menu: SAFEHOUSE & BASE):** a permanent base. Five stations, four levels each: **Workbench** (+5% damage,
  +10% reload speed per level), **Cot** (+15 max HP, +10% stamina recovery), **Storage crate** (+25% resources, +15%
  coins, +15 starting coins), **Radio** (+1 grenade charge, and supply airdrops with a heal, a power-up, coins and gems
  land near you during combat) and **Field fortifications** (+30 barricade HP). Four decorations (lamp, shelf, card
  table, armchair) furnish the room.
- **Scoring:** kills x difficulty x combo (up to x2) x low-HP bonus x event bonus, wave and boss bonuses,
  coins, survival time.
- **Attack VFX:** every attack has its own effects from the three VFX packs, chosen by element (fire, ice, earth, lightning,
  tech, magic, toxic, wind, light). Hero weapons get a muzzle flash, trail and impact, with each hero adding a signature
  colour (Mercenary cyan, Dreadbloom green, Vexaria magenta) plus a baguette slash arc, roll streaks, sprint dust and
  a big layered effect for each special. Each enemy has a wind-up glow, strike and charge trail (orc claw slash, wisp
  sparks, minotaur shockwave, hound flames, influencer flash, lancer dust...). Each boss attack has a charge-up,
  muzzle flashes, projectile trails, ground impacts, beams and summon portals in its own element. All of it lives in
  [`js/vfxkit.js`](js/vfxkit.js); "reduced effects" in Settings plays just the main layer of each.
- **Audio:** ~400 recorded sound effects (per-enemy creature voices, footsteps per surface, weapon, UI and pickup
  variants, boss voices) with no immediate repeats, six ambience loops, and all 20 soundtrack tracks: each arena,
  boss, chaos event, menu screen, the level-up screen, victory and game over has its own.
- **Settings & saves (LocalStorage, sanitised on load):** volumes, music/SFX toggles, mute, screen shake,
  flashing effects, reduced effects, 3 difficulties (Casual / Normal / Chaotic), key rebinding, hero choice.
- **Lifetime stats:** runs, kills, bosses, highest wave, high score, playtime.

All gameplay numbers live in [`js/balance.js`](js/balance.js).

### Expansion modules
- `perks.js` – weapon evolutions, reroll/banish/skip, rarities, cursed cards, synergies, special/grenade upgrades, hero passives.
- `weapons2.js` – six extra weapons. `combat.js` – perfect dodge, parry, combo buffs, elemental reactions, status effects, hit-stop, active reload.
- `waves.js` / `foes.js` – wave modifiers, mini-bosses, affixes, bounty board, spawn director, boss rush, shop, shrines, event orbs, short/Marathon modes.
- `meta.js` / `extras.js` – 3 extra heroes, mastery, Heat pacts, achievements, safehouse extras, pets, crafting, trophy sets, daily/seeded runs, challenges, training room, run summary/history, bestiary (menu: EXTRAS).
- `hudx.js` – damage-number toggle, DPS meter, off-screen arrows, low-HP warning, telegraph colours, minimap, wave preview, pause build list, auto-fire/aim, tutorial.
- `coop4.js` – 3-4 player co-op difficulty scaling (enemy count, health and XP scale with party size) and the downed-hero crawl: a downed hero can crawl slowly and fire weak shots until a teammate revives them. Up to four devices can join in the lobby; the screen splits into two groups when the party drifts apart. The "Chaos Fan Club" card locks in a favourite chaos event. Bosses have two orbiting parts that can be shot off for loot. Trophy-set bonuses are large (e.g. +12% damage, +30 max HP).

## Project layout

```
index.html          page + all DOM screens
style.css           menus, HUD, overlays (everything scales with the window)
js/                 game code (classic scripts, no modules, so file:// works)
  util, balance, storage, assets, audio, input, font, sprites, art,
  particles, vfxkit, weapons, enemies, bosses, upgrades, events, arenas,
  loot, powerups, bosses_more, codex, player, game, views, render, ui, padnav, lobby, main
data/               GENERATED game assets (what the game actually loads)
  assets.js         sprites, VFX and tiles as base64 PNG; sound effects and ambience loops as base64 WAV
  music/*.mp3       all 20 soundtrack tracks
assets/             your original raw packs (NOT needed at runtime)
tools/              build-assets.js (assets/ -> data/), sounds.js (which recordings), hero-pack.js, png.js
tests/              browser-driven test scripts (see below)
```

### Assets

The game loads only `data/`. To rebuild it from the raw packs in `assets/`:

```
node tools/build-assets.js
```

It embeds the sprites as data URIs (so canvas readback and audio decoding work from `file://`), scales the
high-resolution hero animations down to game size and packs them into strips (`tools/hero-pack.js`, using the PNG
codec in `tools/png.js`), builds the Mecha Golem and Boulder Dash animations from their sheets, converts ~400 chosen
sound effects and 6 ambience loops from 24-bit stereo to compact mono 16-bit (1.1 GB library -> ~13 MB) and copies the
20 music tracks. `tools/pack-extra.js` packs the newest art: the four *boss-monster-game-sprites* bosses (frames cropped,
sub-sampled and scaled), Daddy (vertical strips), the Skull King (poses assembled from its 30-odd layers: floating hands,
jaw, blinking eyes, a break-up death), the extra dragons / eyes / golems, every enemy colour variant, and the 367 + 650
loot and power-up icons. (`tools/unpack-new-assets.js` extracts the zips with 7-Zip first.) Which recordings are used is listed in `tools/sounds.js`; sprite sheets and animation names are mapped
in `js/art.js`. (Boulder Dash only ships as an `.aseprite` file; the build reads `BoulderDash-Sheet.png`, a PNG
export of it that was written next to the original.)

If `data/assets.js` is missing the game still runs on its built-in procedural pixel art and synthesized
sound; if only the music files are missing it plays a synthesized soundtrack.

## Tests

The scripts drive the real game in headless Chrome (they use `playwright-core`; no browser download needed
if Chrome is installed):

The whole suite runs in parallel in about three minutes:

```
cd tests
npm install
node run.js                  # every test, 6 at a time; logs in tests/logs/, exit code 1 if any fail
node run.js --retry          # failures run once more on their own; passing then marks them FLAKY
node run.js t10_coop t35_playtest3 --seed 7   # some tests, with another random seed
```

Tests that use `open()` from `tests/lib.js` seed `Math.random` (seed 1 by default) and print the seed, so a failure
repeats with `CHAOS_SEED=<seed> node <test>.js`; `CHAOS_SEED=random` keeps real randomness. `__clear()` in the page
empties enemies, shots, pickups and zones between checks (`__clear({ props: { x, y, r } })` also clears props there).
Single tests:

```
node t5_ui.js        # menus, input, pause, settings persistence, level-up, death, restart, resize (37 checks)
node t2_systems.js   # every weapon (damage, no double hits) and every enemy's state cycle
node t3_bosses.js    # all 22 bosses: attacks, phases, kill
node t12_drops.js    # trophies, the Trophy Codex, power-up kinds and buffs, curios, enemy variants, golems, boss schedule (31 checks)
node test_new_monsters.js   # the five newer enemies, the five newer bosses and the extra VFX packs
node t11_content.js  # safehouse, resources, props, fortify / jump, branch screens, all seven arenas + weather, co-op with all of it (30 checks)
node t4_events.js    # all 10 chaos events start/apply/end cleanly
node t6_audio.js     # sample bank, loops, music per screen/arena/boss/event, mute, fades (23 checks)
node t7_fallback.js  # runs without the asset bundle / without music files
node t10_coop.js     # gamepad controls, menu navigation on a pad, the co-op lobby, split / merged screen, revive, shared XP, two-hero boss fight (56 checks)
node batch_coop.js normal 5 human   # balance: win rate of two human-like bots in co-op
node t9_vfx.js       # attack VFX: gallery images (v_*.png), every weapon/enemy/boss attack/hero skill plays effects
node t8_endless.js   # victory -> endless -> bosses/arenas -> death accounting
node batch.js normal 10 human    # balance: win rate of a human-like bot
```

Set `CHROME_PATH` if Chrome is not in the default Windows location.

---

## The overhaul: levels, hives, town, gear

The game is no longer a wave arena. A run is a walk through generated **levels** (dungeons and open maps with walls,
fog of war and a minimap); boss stages stay arena fights.

- **Breaches (hives and portals):** every stage has 3-6 spawners (hive, glitch portal, ossuary, hell gate, war camp, frost
  rift). They only breed while you are near, have three levels (damage makes them weaker and slower) and speed up if left
  open too long. Close them all (all but one on big stages) to break the seal on the **exit**, then walk to it.
- **Sleeping packs, champions, a named unique per stage, shrines (blood / challenge / healing / speed), chests, secret rooms**
  behind cracked walls (shoot them), waypoints (house sign) and the exit (castle sign).
- **Gear:** six slots (helm, chest, legs, boots, ring, gloves), rarities Normal / Magic / Rare / Legendary / Set with
  affixes. Pick up drops by walking over them (hold `Alt` to show every label). Equip, compare and recycle in the Journal.
- **Consumable belt** (keys `7 8 9 0`, or the pad's View button): food heals over time, herbs cleanse, the **Portal Quill**
  opens a town portal.
- **Town:** reached by the quill, by a waypoint (`E` on an active one) and automatically after an act boss. Vendor, stash,
  smith, sidekick trainer, elder (quests) and the waypoint keeper.
- **Sidekicks:** every hero brings one companion (KAEL-09, VELKHAR, INFERNA, ELOWEN, NEON VIPER, ARCHANGEL COMMANDER). Eleven
  secret ones are unlocked by bosses, challenges, secret rooms and a quest; choose them in Journal > Codex > Sidekicks.
- **Heroes:** Elven Enchantress, Neon Specter and The Grinning Stranger replaced the three placeholder kits.
- **Atmosphere:** day and night, weather per biome (rain, thunderstorms with telegraphed lightning, snow, blizzard, ash, fog,
  blood rain), puddles of water / blood / toxic goo / lava that ripple, mirror what stands behind them and glint (kill
  blood spreads, then dries brown), footprints out of blood, water and goo, a WebGL shader pass (Settings > Video: Effects High / Low / Off,
  heat haze on / off). Night: enemies hit 10% harder and drops are 15% richer.
- **Difficulty tiers:** win a run to unlock Nightmare, then Hell (Journal > Journal > Quests).

### New keys

| Key | Action |
|---|---|
| `J` | Journal (Journal, Inventory, Equipment, Codex, Save & Quit, Settings) |
| `K` | Skill tree (pad: **Start**, then the Skills icon in the pause menu) |
| `I` | Journal, Inventory tab |
| `N` | Map scroll (stage automap and the four-act map) |
| `Q` / `E` | Journal and map: previous / next tab or page |
| `7 8 9 0` | Use belt slot 1-4 (pad: View button uses the first filled slot) |
| `Alt` | Show all item labels on the floor |
| `E` | Interact: chests, gear on the ground, exit and building doors, shrines, lore stones, waypoints, people, the vending machine |

### Tests

`tests/` now holds `t1` to `t35` (`t35_playtest3`: everything in *Third playtest* below) (`t34_fires_walls`: real tile walls, campfires, wind, shadows). New ones: `t20_storage` (save versions and migrations), `t21_assets` (every asset of the
UI pack, heroes and sidekicks is packed), `t22_newheroes`, `t23_shop`, `t24_sidekicks`, `t25_levelgen`, `t26_levels`,
`t27_items` (gear, quests, tiers, sidekick unlocks), `t28_town`, `t29_postfx`, `t30_menus`. The older tests run in wave mode
without sidekicks and with the shader off; `open({ levels, sidekicks, fx })` in `tests/lib.js` turns those on.
Balance: `node tests/batch_levels.js <casual|normal|chaotic> <runs> <perfect|human|sloppy> [classic|short|marathon]` runs a
bot that navigates the levels (`tests/navbot.js`). Rebuild the art bundles with `node tools/build-assets.js` (needs
Aseprite and 7-Zip for the UI and sidekick packs).

---

## Third playtest (2026-10-23)

- **The heroes fight with their own weapons.** Each hero's main weapon is the one in their art: Dreadbloom's
  **Thornblade** (greatsword, 72 px reach, wide cleaves), Vexaria's **Blood Moon Saber** (fast cuts, a three-cut flurry),
  the Stranger's **Grinning Shiv** (quick lunges, +60% on feared enemies), the Mercenary's **Pulse Gauntlet** (punches
  that throw a short pulse wave, a point-blank blast), the Enchantress's **Moonwood Bow** (piercing charged shots) and
  the Specter's **Neon Repeater** (draws once, then fires fast). Holding the button chains a three-hit combo whose last
  hit is the heavy animation. An attack lasts as long as its animation and lands on the impact frame; swings slow you,
  step you forward, snap onto the enemy in front, flinch and knock back, and the finisher bats shots back. The junk
  weapons sit in slot II (right mouse / LT). Every weapon has its own swing and hit sounds (flesh or armour).
- **Skill tree instead of level-up cards.** A level is a skill point; spend it with `K` (or Skills in the pause menu,
  the game waits). Three trees per hero, COMBAT, SURVIVAL and the hero's own (reach, swing width or piercing, heavy
  finisher, attack speed, the special, a capstone), five tiers opening at levels 1 / 4 / 8 / 12 / 18, some skills need
  another first. Weapon evolutions happen by themselves when a weapon tops out with the matching skill.
- **Animations.** Heroes play their walk / run strips in every direction (the static turn-around frames are only
  for hero select), the walk cycle follows ground speed, attacks and the dash play at their own pace, hurt lasts a
  fixed moment, the jump follows the real jump arc.
- **Enemies.** About 1.4x bigger (pixel-art up-scale), feet on the ground (baked shadows removed, frames that drifted
  1-2 px up are snapped down), the giant spider's frames are whole (they were cut in half) and it curls up asleep,
  the goblin attack has its real five frames, and the top-down packs (orcs, goblins, plants, slimes, golems) use their
  down / up rows when walking vertically. Swarms keep a body width apart, steer around each other and ring the hero
  instead of piling into one sprite; facing no longer flickers.
- **Props have collision.** Every sliced piece of the tileset packs was looked at and catalogued
  (`js/props.js`: crate, barrel, wall, fence, car, lamp, corpse ...). The kind sets its drawn size, whether it blocks
  and with what footprint (a box at its base: a fence blocks its length, a lamp only its post), whether it glows.
  Flat things (decals, litter, bones, rugs) stay walkable. Sixteen more sheets are sliced, and the three VFX packs whose
  folders had moved are found again.
- **Stages with direction** (`js/setpieces.js`). A worn trail runs from the entrance to the exit with lights along it
  and braziers at the exit. Breaches sit inside enemy camps (palisade ring with two gaps, a fire, supply piles, banners,
  cages, bones) whose monsters loiter until you come close. Other rooms are scenes built from matching pieces: ruined
  houses, storage yards, graveyards, groves, streets of wrecks, toxic dumps, shrines, crypts, wards, torture rooms,
  forges, lava fields. A last pass keeps everything you need reachable.
- **The hideout** (`js/hideout.js`) is a walled camp: a north street of ruined houses with the vendor's stall, the
  stash keeper's store room and the smithy, a plaza with the first hero's statue, the well and a campfire, the elder
  under the notice board, the trainer's fenced yard, the waypoint keeper's stone circle, the gate with the portal, a
  giant tree with a garden, a store yard and a small graveyard. The townspeople are the Valley Ruin villager and block.
- **Main menu.** Five buttons (PLAY, HERO, CO-OP, JOURNAL, SETTINGS) and a quiet row of links (How to play, Codex,
  Stats, Modes, Credits); the key strip is gone (keys are in How to play and Settings).

## Fourth playtest (2026-10-24)

- **An interact button for everything.** Walk up to a chest, an item on the ground, a door, a shrine, a lore stone, a
  waypoint or a person: it gets a ring and a prompt (`[E] OPEN  CHEST`, `[B]` on a pad) and the button uses it. Gear
  waits on the ground with its name on a plate until you pick it up (Alt shows every name); gold and food still fly to
  you. Chests rattle, fly open in a shaft of light and fountain their loot, gear included.
- **Exits are doors.** Nothing ends a stage by itself any more: kill a boss, gather the loot, then `ENTER` the far door.
  The final boss's door is `THE WAY HOME`.
- **Monsters step out of front-facing portals** in the colours of their biome.
- **Puddles belong to the ground.** They stay on open floor, apart from each other and from everything that stands, take
  their colour from the ground under them and stop at walls; kill blood never lands in water.
- **Collision** for tall bushes, giant mushrooms, standing lanterns, candelabras and heaps of supplies.
- **Stages.** The ground is one piece (no more quilt of swatches), stains are sized like stains, enemy camps are
  stockades with tents, a fire and a gate, and every stage has a landmark (The Bone Throne, The Fountain Square, The
  Pile-Up, The Ward, The Reactor, The Ice Shrine, The Forge of Ash, The Hall of Kings, the giant tree) with a lore stone
  to READ for a little experience.
- **Menus in the manner of Diablo III** (`d3.css`): dark leather and bronze, gold serif titles, red buttons, rarity
  glows; the heroes screen with the hero on a lit dais and the roster beside it; the inventory and paper doll on one
  sheet with floating tooltips.
- `node tests/tour.js` and `node tests/tour_menus.js` write screenshots of the world and the menus to `tests/tour/`.

## The second drop (2026-10-24, evening)

- **Walls from the Dungeon Asset Pack everywhere.** Every walled stage is built from the pack's wall pieces in all
  directions: stone faces with corner pieces at the ends of each run, stone rims where you look down on a wall, and
  darkness beyond in the dungeons. The walls carry banners, shields, grates, arches and broken stretches, and each
  biome mounts its own pieces on them: doors and windows in the city and the Gaslight District, warning signs and pipes
  in the Outbreak City and the wasteland, chains and cages in the dungeons and the castle, gates in the Caldera.
- **Every piece of every stage pack shows.** Each biome's five stages split its packs between them, so every crate,
  grave, statue, sign and stain turns up somewhere. `node tests/audit_assets.js` counts what the world really shows.
- **Undead Land Objects and the Seabed** dress the Dead Wood, the Catacombs, the Gaslight District and the Crypt:
  boneyards of dug-up graves and beast carcasses, drowned rooms with a leviathan's bones, coral, swaying weeds and
  opening anemones.
- **The Sky Road and the Final Tower.** The last area is a road of flying islands and plank bridges over a dusk void,
  with dragons in the sky. The Final Tower stands on the last island; when its breaches are closed its maw opens.
  Inside is the Belly, a hall of living flesh with a beating heart, where the final boss waits.
- `node tests/mapshot.js <area> [room]` writes a top-down picture of a stage's room to `tests/tour/`.

## Rooms with a purpose (2026-10-24, night)

- **Stages are composed the way Diablo composes them.** Every room has one purpose (an ossuary, an alchemist's den, a
  storeroom, a torture room, a drowned crypt ...) and its props say so: a centrepiece at the back with its flankers and
  candles, the back wall's row, the side walls, a pile in each corner, lights by the doorways, the middle left open to
  fight in. Things of a kind keep together; the open land between rooms holds groves of one thing.
- **Every piece of every pack is used** (`node tests/audit_assets.js`), each in a room that fits it. The older biomes'
  floors and walls now use their whole sheets.
- **The Dead Wood has a forest beyond its clearings, the Gaslight District rooftops, the Frozen Kingdom glacier walls.**
  Mounted torches and lanterns light the walls.
- **Sealed vaults** behind doors in the dungeons' walls hold a treasure room and its guards.
- **The tower fights on:** when the final boss falls, the tower's two hearts wake; stop them both to open the way home.
- **Props never shut a doorway.** After a stage is dressed, anything that would send monsters (or you) the long way
  round, or box you into a corner, is moved (`node tests/detour_scan.js` checks every area).

## The stage editor (2026-10-24, night)

- **Make the stages yourself.** STAGE EDITOR on the main menu (or `index.html?editor`):
  - a drawer of every piece of every pack;
  - stamp, scatter, erase, terrain painting (walls dress themselves), height (tiers with their rims, stairs, ramps, bridges), floor tiles and markers (entrance, exit, breaches, packs, chests, shrines);
  - collision you can see and drag;
  - undo, and a play test (F5, F10 to come back).
  Saved stages are what the game plays. See [docs/STAGE_EDITOR.md](docs/STAGE_EDITOR.md).
- **Drop in new art.** Pictures or a zip are cut, animated, faced (RPG Maker sheets too) and given collision by themselves.
