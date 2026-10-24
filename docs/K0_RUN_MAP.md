# K0 (no more runs): what the game builds on runs today (survey 2026-10-24)

Paths under `js/` unless noted. Feeds milestone K0 of PLAN.md section 18.

## Run lifecycle
- `X.startRun(setup, config)` (waves.js:35) sets `X.pending`, calls `G.newRun` (game.js:170, `G.call('newRun')`).
  `newRunCore` (game.js:171-239) resets board, timers, score, coins (start coins from shelter and loot bonus, :188),
  resources, runLoot, chosenPath, kills, endless, won; `G.runIndex = stats.totalRuns`; `G.run = {recorded, base,
  counted, startedAt}`; **fresh `CH.Player` objects** (level 1, xp 0, weapons `['junk']`); then `startWave(1)`.
- `G.lastConfig` (game.js:78, 172-173): co-op config (`undefined` = last, `null` = solo).
- `newRun:before` (newest first): town (resets inTown, saved, pendingStage, wantTown), items (ground drops), run
  (`runSeed`, `garageKey`, `level`), perks (`X.reset`, `X.rs` run stats via meta.js:168), coop4 (`applyCoopScale`),
  waves (rebuilds `X.run` from `X.pending`, `W.reset()`: shop, orbs, shrine, revives, rush list, seeded `W.rng`;
  `X.onRunSetup`), atmos (dyn, prints, strikes, flash).
- `newRun` (oldest first): perks (`X.ownerHooks`: meta.js:641 heat, loadout, crafted consumables, training kit;
  items.js:311 belt reset), meta.js:635 (daily hero swap back, pets/sidekicks reset, training), meta.js:684 (spend
  crafted consumables), skills (`p.skills = {}`, `sp = 0`), hudx (log, tutorial), quests (parries; tier hp/dmg into
  `G.diff`, `tierName`).
- `X.run` (waves.js:22): `{mode, seed, challenge, heat}` plus `daily`, `hero`, `seedLabel`, `loadout`.
- End: death `G.killPlayer` (game.js:742) -> all dead -> `deathTimer` > 1.9 s -> `G.gameOver` (:1371, :1637);
  victory: final boss (bug / skull / daddy, tier 0, not endless) -> `G.won`, `victoryPending` -> `G.victory`
  (:1104, :1394). Both -> `G.finishRun(win)` (:1360) -> `Storage.recordRun` (storage.js:269: totals, highestWave,
  wins, deaths, highScore, `checkUnlocks` for heroes) and `M.endRun` (meta.js:766, wrap at :810: history, mastery XP,
  ghost, daily / seed board, challenge wins, achievements). Tier unlock on victory (quests.js:141).
- Restart: RETRY / PLAY AGAIN `G.newRun()` (ui.js:344, 347; pad ui.js:486); pause RESTART `abandon(); newRun()`
  (ui.js:323-328, loses mode, heat and seed); CONTINUE TO ENDLESS `G.continueEndless` (game.js:1418); `G.abandon`
  (:1435), Journal SAVE & QUIT (journal.js:387-403).

## Modes (`X.MODES`, waves.js:24)
- classic / short / marathon / rush: boss schedule (waves.js:77-108), banner (:112), rush queue (:117), rush boss list
  (:51), extra branch prompts (`extraSet`, :158), rush heal and free card (:219, :645), shrines (:330), miniboss
  plans (foes.js:30, :207), boss previews (:140).
- tutorial (hudx.js:219-290); training (meta.js:297, 318, 655, 717-747); `Run.usesLevels` (run.js:29-34) sends rush,
  tutorial and training to arenas; recording exclusions (meta.js:767, 811, 686; pets meta.js:401).
- daily (meta.js:598-620), custom seed (extras.js:264), challenges (meta.js:621, 700-713), heat (meta.js:266-305),
  Extras PLAY tab (extras.js:44-84, 259-268).

## Run-only vs persistent
- Run-only: score, combo, `scoreMult` (game.js:307-320), heat score multiplier (meta.js:284), ghost (meta.js:749),
  `G.runSeed` (run.js:61; stage seed `runSeed + n * 7919`; atmos.js:60, 489), `W.rng`, `G.runIndex` boss rotation
  (game.js:349), **`G.coins`** (shop.js:93+, waves.js:278), player level / xp / weapons / upgrades / skills / perk
  cards (`CH.Skills.on`, skills.js:10, 172), belt, relic Second Wind "once per run" (meta.js:214), pets and
  sidekick respawns.
- Persistent (`Storage.data`, storage.js:63-94): `version`; `settings` (volumes, shake, flashing, reduced, fx, haze,
  difficulty, hero, hero2, aimAssist, rumble, padDeadzone, keys); `stats` (totalRuns, totalKills, bossesDefeated,
  highestWave, highScore, totalPlayTime, wins, totalCoins, deaths, bestTime); `resources`, `shelter`, `loot`, `seen`,
  `unlocked`; `diablo` (bag, stash, equipped per hero, tier, tierUnlocked, quests, counts, waypoints by stage number);
  `sidekicks` (unlocked, pick); `meta` (ach, cnt, mastery, maxedW, maxedU, loadout, petsOwn, relics, relicEq, stock,
  armed, shp, alt, skin, chal, seen, board, ghost, history, opts, pet, trainBest, tutDone, noHit). Gear is already
  persistent (items.js:168-178).
- Save: one localStorage key `chaosexe.save.v1` (storage.js:4), VERSION 2, `MIGRATIONS[n]` v -> v+1 (:9-43),
  `sanitize` rebuilds field by field and **drops unknown top-level fields** (:100-179). No mid-stage save.

## Stage flow
- Stage = wave: `G.wave` (alias `G.depth`, run.js:22), `B.waves.campaign = 10`, `arenaForWave` (balance.js:48, 61),
  boss stages 3 / 5 / 8 / 10 (game.js:348-362) as arenas.
- `Run.startLevel` (run.js:59-123): level, hives, shop machine (stage >= 2), Lost Shrine (stage 2), a unique.
- `onBreachClosed` (:127) opens the exit; `Run.complete` (:325) -> `G.waveComplete` -> 'clear' -> `updateWave`
  (game.js:590-600): branch prompt at 4 / 7 (`promptBranch` :417, `chosenPath` -> `pathArena` :409, secret path
  -> zombie waves.js:201) or the next wave.
- Waypoints: `diablo.waypoints[G.wave]` (town.js:256-263); travel regenerates from the current run seed (town.js:240).
- Town: `Town.enter` (town.js:72) snapshots `G.level` in memory, `leave` (:100); after a non-final boss `wantTown`
  (:161) -> next stage from town via `pendingStage` (:151-160); hideout = town layout (hideout.js:26).
- Acts = `ceil(stage / 3)` (quests.js:16). Levels are seeded; only cosmetic `Math.random` remains
  (setpieces.js:594-612).

## Death and co-op
- Co-op: downed heroes crawl (coop4.js:30), partner revive (game.js:789, slower per revive waves.js:231); Second Wind
  and Archangel Rebirth intercept death (meta.js:211, sidekicks.js:432); stages call `revivePlayers(0.4)`.
- Lobby (lobby.js:91-99) calls `G.newRun(config)`; heroes from unlocked ones into `settings.hero` / `hero2`; fresh
  Players, shared `G.coins`; gear keyed by hero id, so two players on the same hero share equipment.

## Menus and UI
- Main menu (index.html:72-95): PLAY -> `G.newRun(null)` (ui.js:275), CO-OP, HERO (menus.js:65-150), JOURNAL, MODES
  (Extras); BEST SCORE (ui.js:181).
- Journal: HERO page depth / runs / wins / mastery (journal.js:292-306), MODES & EXTRAS (:307), STATISTICS
  (`UI.fillStats`, ui.js:701), quest tier buttons (journal.js:532), "Takes effect next run" (:381).
- Game-over and victory screens (index.html:331-361, ui.js:887-939), RUN SUMMARY (extras.js:299-316), HUD "WAVE n/10"
  (ui.js:1175), "STAGE n" (run.js:576), map scroll STAGE and acts (mapscroll.js:86, 126-145).

## Tests
41 of 46 suites call `newRun` / `startRun`. Mode / run / score specific: t17_meta, t18_hudx, t8_endless,
t1_campaign, t16_waves, t31_extras, t20_storage (version 2 + migration), t5_ui, t12_drops, t35_playtest3, t38_flow,
batch.js, batch_levels.js, replay.js. Most suites run with `Run.levels = false` (tests/lib.js:40); 13 use levels.

## What K0 must change (by group)
- **Save**: storage VERSION 3 with slots (hero, hardcore, level, xp, skills, gear, bag, belt, gold, quests, waypoints,
  world state, seed); keep `settings`, `unlocked`, account-wide codex (`loot`, `seen`); move `diablo.*` and per-hero
  gear into the slot; `sanitize` learns the new fields; migrate global gear and stats. Files: storage.js, items.js:168,
  quests.js:44, town.js:258, sidekicks.js:71, player.js and skills.js (persist Player state).
- **World**: save seed + area id instead of `G.runSeed` and stage number; per-area state (chests, cracks, spawners,
  bosses, waypoints) in run.js / town.js / levelgen.js; repopulate thinner in `Run.startLevel`; replace act / stage
  tables (quests.js:16, game.js:348 / 409, balance.js:61, waves.js:77-108, mapscroll.js).
- **Flow**: load slot / enter world instead of `newRun` / `startRun` / `lastConfig`; remove branch prompts
  (game.js:417, waves.js:126-200), `continueEndless`, victory as an end (completion opens the next tier); town as the
  hub; re-home the newRun listeners into "load hero" / "enter area" events.
- **Death**: `gameOver` (game.js:1637-1639) -> wake in the hideout, gold corpse marker, hardcore deletes the slot; keep
  co-op downed / revive.
- **Modes**: remove `X.MODES` (rush, short, marathon), endless, tutorial (hudx.js:219-290), training
  (meta.js:715-747), daily, seeds, challenges, heat (meta.js:265-305, 597-713), Extras PLAY tab.
- **Scoring**: remove `addScore` / combo / `scoreMult`, highScore, ghost / board / history (meta.js:749-809), score
  HUD (ui.js:1178), menu best, result screens.
- **UI**: character select and creation (replaces PLAY and the HERO book); CO-OP picks how player 2 joins; pause
  RESTART and abandon become Save & Quit; Journal HERO and STATISTICS pages; HUD "WAVE n/10".
- **Tests**: rewrite t17, t18, t8, t1, t16, t31, t20, t38, batch and replay; a `startRun` replacement in tests/lib.js
  for the rest.

## Stays
Level generation and dressing, hideout NPCs and dialogue, the skill tree, items and affixes, quests and tiers, sidekick
unlocks, codex and trophies, the waypoint UI, co-op crawl and revive, boss arenas as boss areas, events (until K10),
settings and keybinds, the `G.call` events.

## Open questions for the owner
- Existing saves: global gear, stats and mastery into a first slot, or archived? Hero unlocks still earned
  (`stats.highestWave`, wins; balance.js:176, meta.js:31-33), or all heroes open at creation?
- Account-wide systems (relics, safehouse upgrades, crafting, pets, achievements, resources): per account, per slot, or
  cut?
- Gold: one persistent gold for `G.coins`; start-coin bonuses?
- The card level-up path (`Skills.on = false`) and the wave loop (`Run.levels = false`) survive only for tests.
- Difficulty: global setting or per slot?
- Quitting inside an area: save the area snapshot, or restart it from its entrance?
