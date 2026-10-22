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
| **B** | Interact (vending machines). In menus: back |
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
| `E` | Interact (vending machines: 25 coins) |
| `1`-`6`, wheel, `Tab` / `C` | Choose the main weapon |
| `Z` / `V` | Cycle the second weapon / swap the two weapons |
| `Esc` | Pause / resume |
| `F` | Build a barricade where you aim (2 wood + 1 scrap) |
| `Space` | Also jumps onto low props (crates, barricades) when one is in front of you |
| `M` / `F11` | Mute / fullscreen |

Keyboard keys can be rebound in **Settings**. Menus work with the keyboard (arrows + Enter), the mouse and a controller. A solo run follows whichever device you touched last, so you can switch between keyboard and controller mid-run.

## Co-op (2-4 players, same computer)

Pick **CO-OP** in the main menu. In the lobby each device joins by pressing its confirm button (**A** on a controller, **Enter** or the button for keyboard + mouse), picks a hero with the D-pad / **A** **D** and readies up. Any devices work: up to four controllers, or controllers plus one keyboard + mouse.

- **One screen or two, depending on distance.** While the heroes are close the whole party shares one screen. Walk far enough apart and a divider slides in, splitting the view into a left and a right half that each follow one hero (the one further left gets the left half); come back together and the halves merge again. Edge arrows point to a partner or a boss that is out of view.
- **Shared progress, personal builds.** XP, coins, score and combo are shared. Every level-up gives **each** player their own pick of 3 cards (they choose one after the other, each with their own controller), and boss tokens reward the whole party. Health, stamina, weapons, grenades and specials are per hero.
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
- **Progression:** XP gems -> level-up -> pick 1 of 3 cards (16 upgrades with max levels + weapon unlocks and
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

```
cd tests
npm install
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
