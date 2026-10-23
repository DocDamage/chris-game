/* Which recordings from the Huge SFX Pack / soundtrack the game uses.
 *   SOUNDS: game sound name -> list of source specs (every spec becomes one random variant)
 *   LOOPS : seamless ambience loops (kept whole, no trimming)
 *   MUSIC : music key -> soundtrack file prefix
 * A spec is {d: folder under the SFX pack, re: filename pattern, n: max files taken, s: max seconds}.
 */
'use strict';

const MV = 'Metroidvania SFX/One_Shots/';
const m = (d, re, n, s) => ({ d, re, n: n || 99, s });

const SOUNDS = {
  /* ---- UI ---- */
  click: [m('Game/Ui/Button', /Button_\d+\.wav$/, 5, 0.5)],
  hover: [m('Game/Ui/Hover', /Hover_\d+\.wav$/, 6, 0.35)],
  back: [m('Game/Ui/Button', /Button_(6|7|8|9|10)\.wav$/, 3, 0.5)],
  confirm: [m('Game/Ui/Confirm', /Confirm_\d+\.wav$/, 6, 0.8), m(MV + 'UI', /confirm_clicky_short_digital/, 2, 0.6)],
  popup: [m('Game/Ui/PopUp', /PopUp_\d+\.wav$/, 6, 0.6)],
  whoosh: [m('Game/Ui/PopUp/Woosh (Bonus)', /\.wav$/, 3, 1.0)],
  nope: [m('Game/Ui/Error', /Error_\d+\.wav$/, 5, 0.6)],
  page: [m(MV + 'Item', /turning_page/, 3, 0.8)],
  book: [m(MV + 'Item', /open_heavy_book/, 3, 1.0)],
  bag: [m(MV + 'Item', /open_bag/, 3, 0.8)],
  scan: [m(MV + 'Effect', /hud_scan/, 3, 1.2)],
  vend: [m(MV + 'Objects', /interactive_object_switch/, 3, 0.6), m('Game/Doors and Switches', /Lever_\d/, 2, 0.8)],
  chest: [m(MV + 'Objects', /open_chest/, 3, 1.0)],
  door_open: [m('Game/Doors and Switches', /Door_Open_\d/, 3, 1.2)],
  door_close: [m('Game/Doors and Switches', /Door_Close_\d/, 3, 1.0)],
  door_auto: [m(MV + 'Doors', /automatic_open_\d?_?interactive/, 3, 1.2)],

  /* ---- player attacks ---- */
  shoot_junk: [m('Player/Movement/Equipment', /throw_\d/, 2, 0.6), m('Player/Combat/Attack_Hands', /Attack_\d/, 3, 0.5)],
  shoot_chicken: [m(MV + 'Creature', /bird_scream_chatter_fast_long/, 3, 0.5), m(MV + 'Creature', /chatter_bird_chatter_fast/, 2, 0.5)],
  squeak: [m(MV + 'Creature', /cat_noise_short_quick_high_pitch/, 3, 0.4), m(MV + 'Creature', /small_noise_short_quick_high_pitch/, 3, 0.4), m(MV + 'Creature', /short_noise_short_quick_high_pitch/, 3, 0.4)],
  shoot_pizza: [m('Player/Combat/Fire_Magic', /Fire_Cast_\d|Fireball_\d\.wav|Firebolt/, 6, 1.0)],
  swing: [m('Player/Combat/Sword', /Sword_\d/, 4, 0.7), m(MV + 'Weapon', /sword_swing_[12]|medium_swing_[12]|light_swing_[12]/, 6, 0.7)],
  swing_bread: [m(MV + 'Weapon', /wood_stick_swing|bat_swing|bat_quick_swing/, 6, 0.7)],
  crunch: [m(MV + 'Fight', /hit_cruch_enemy/, 3, 0.5), m(MV + 'Wood', /piece_\d?_?element_clicky_stick_short|cracky/, 3, 0.5)],
  shoot_chair: [m(MV + 'Weapon', /giant_swing_[12]|heavy_swing_[12]|giant_quick_swing/, 6, 0.9), m(MV + 'Wood', /moveable_pile/, 2, 0.8)],
  shoot_problem: [m(MV + 'Weapon', /laser_one_shot_gun_shot_[12]_gun_short_single\.wav|laser_one_shot_blast_gun_fire_[12]|laser_one_shot_gun_triple/, 6, 0.8)],
  arrow: [m(MV + 'Weapon', /arrow_launch_[12]_|arrow_launch_hard_[12]_|cross_bow_launch_[12]/, 6, 0.8)],
  /* the heroes' own weapons (js/heroatk.js) */
  sword_heavy: [m(MV + 'Weapon', /heavy_sword_swing|heavy_sword_slow_swing|giant_swing/, 6, 0.9)],
  sword_light: [m(MV + 'Weapon', /sword_swing_|long_swing_|axe_swing_/, 6, 0.7), m('Player/Combat/Sword', /Sword_\d/, 4, 0.7)],
  saber: [m(MV + 'Weapon', /ligh_saber|after_image_slash/, 6, 0.6)],
  knife: [m(MV + 'Weapon', /whip_swing|sharp_spike|light_swing_/, 6, 0.5)],
  punch: [m('Player/Combat/Attack_Hands', /Attack_\d/, 4, 0.5), m(MV + 'Weapon', /medium_quick_swing/, 3, 0.5)],
  bow_draw: [m(MV + 'Weapon', /bow_pulling_/, 3, 0.9)],
  pistol: [m('Player/Combat/Pistol', /Shoot_\d/, 2, 0.6), m(MV + 'Weapon', /gun_shot_quick_/, 3, 0.5)],
  hit_flesh: [m(MV + 'Fight', /fight_hit_enemy_|hit_cruch_enemy/, 6, 0.5), m('Player/Combat/Hit', /Hit_\d/, 4, 0.5)],
  hit_heavy: [m(MV + 'Fight', /hit_hard_enemy|hit_tough_enemy|hit_short_hard_thic/, 6, 0.6)],
  clang: [m(MV + 'Weapon', /parry_|sharp_scrap/, 6, 0.7)],
  empty: [m('Player/Combat/Pistol', /Dry_Fire_\d/, 2, 0.4)],
  reload: [m('Player/Combat/Pistol/Reload_Animation', /Mag_Insert|Gun_Cocking/, 4, 0.8)],
  parry: [m(MV + 'Weapon', /parry_[12]_|heavy_parry_[12]/, 4, 0.6)],

  /* ---- hits, hurt, deaths ---- */
  hit: [m('Player/Combat/Hit', /Hit_\d/, 4, 0.5), m(MV + 'Fight', /fight_hit_enemy_[12]_|fight_hit_short_hard_thic\.wav/, 3, 0.5)],
  crit: [m(MV + 'Fight', /hit_hard_enemy_[12]_|hit_tough_enemy_[12]_/, 4, 0.6)],
  hurt: [m(MV + 'Fight', /hit_tough_enemy_[12]_/, 2, 0.6), m(MV + 'Gore', /blood_wet_long|blood_wet_02/, 2, 0.8)],
  enemy_die: [m(MV + 'Gore', /fight_short_blood_wet\.wav|short_hard\.wav|blood_wet_02|hit_fight_short_hard/, 5, 0.7)],
  die_bone: [m(MV + 'Wood', /cracky_[12]_|piece_[12]_|moveable_pile_[12]/, 5, 0.8)],
  die_rock: [m(MV + 'Ceramics', /rock_shattering/, 3, 1.0), m(MV + 'Objects', /stone_pile_[12]/, 2, 1.0)],
  die_wet: [m(MV + 'Creature', /hatching_short_egg_wet|toung_chatter|egg_shell_shatter/, 4, 0.9)],
  die_bird: [m(MV + 'Creature', /bird_scream_reverb_chatter_fast_long|whistling_reverb_long|flying_high_pitch_short_whistling/, 4, 0.9)],
  die_beast: [m(MV + 'Creature', /die_slow_low_medium_growl|die_slow_low_long_growl|chuff_tiger_high_short_scared/, 4, 1.4)],
  dodge: [m('Player/Movement/Dodge', /Dodge_\d/, 3, 0.5), m(MV + 'Movements', /quick_dash_[12]_|medium_dash_[12]_|dodge_[12]_cloak/, 4, 0.6)],
  shield: [m(MV + 'Effect', /energy_shield_generate_[12]/, 2, 1.2)],
  shield_break: [m(MV + 'Effect', /energy_shield_break_[12]/, 2, 1.2)],

  /* ---- creatures ---- */
  cre_growl: [m(MV + 'Creature', /attacker_(1_|2_)?quick_growl|beast_(1_|2_)?quick_short_enemy_attack|beast_sound_quick|pig_roar_small/, 7, 0.8)],
  cre_roar: [m(MV + 'Creature', /low_roar_tiger|howling_medium_slow|scream_and_attack|attacker_long_/, 6, 1.6)],
  cre_bird: [m(MV + 'Creature', /whistling_long_bird|whistling_tremolo|bird_scream_chatter_fast_long_02|flying_high_pitch/, 5, 0.9)],
  cre_wet: [m(MV + 'Creature', /toung_chatter|hatching|small_scream_medium_samll|small_frog/, 5, 0.8)],
  cre_frog: [m(MV + 'Creature', /medium_frog_long_water_scream|small_frog|small_scream_long|small_scream_medium/, 5, 1.2)],
  cre_trumpet: [m(MV + 'Creature', /pulsated_trumpet|low_pulsated_trumpet/, 4, 2.0)],
  cre_hiss: [m(MV + 'Creature', /hiss_sound_hiss_short/, 3, 0.8)],
  cre_chitter: [m(MV + 'Creature', /chatter_bird_chatter_fast|hiss_sound|confused_action_short/, 4, 0.8)],

  /* ---- pickups & items ---- */
  pickup_coin: [m(MV + 'Item', /coin_[12]_metal_bright|item_one_shot_coin_metal_bright|gold_[12]_obtain/, 5, 0.6)],
  pickup_xp: [m('Player/Colectible', /Collectible_\d/, 4, 0.6), m(MV + 'Item', /gem_[12]_stone|item_one_shot_gem_stone/, 3, 0.6)],
  pickup_hp: [m('Player/Consumables', /Eat_\d|Drink_1/, 5, 0.8), m(MV + 'Item', /consuming_potion_[12]_|item_one_shot_potion_[12]_/, 3, 0.8)],
  pickup_power: [m(MV + 'Item', /crystal_[12]_itme|crystal_itme/, 3, 1.0), m(MV + 'Effect', /item_obtain_[12]_/, 2, 1.2)],
  token: [m(MV + 'Item', /coin_box_[12]_|gold_obtain_/, 4, 1.0), m(MV + 'Objects', /open_chest/, 2, 1.0)],
  buy: [m('Game/Shop', /Buy_1|Cash_\d/, 3, 1.0)],
  enchant: [m(MV + 'Effect', /equipment_enchant_[12]_/, 2, 1.4)],
  item_get: [m(MV + 'Effect', /item_obtain_[12]_/, 2, 1.4), m(MV + 'Item', /keys_[12]_/, 2, 0.8)],

  /* ---- world, effects ---- */
  explosion: [m('Player/Combat/Fire_Magic', /Fire_Explosion_\d|Fireblast_\d|Fireball_Hit_\d/, 7, 1.4), m(MV + 'Effect', /explode_[12]_impact/, 2, 1.2)],
  big_explosion: [m(MV + 'Effect', /vacuum_bomb_[12]_rise/, 2, 2.2), m(MV + 'Effect', /explode_impact_bass/, 1, 1.4)],
  fire_hit: [m('Player/Combat/Fire_Magic', /Fireball_Hit_\d/, 3, 0.9)],
  slam: [m(MV + 'Movements', /heavy_step_debris_(1_|2_|large|medium_[12])/, 6, 1.2)],
  rock: [m(MV + 'Ceramics', /rock_shattering/, 3, 1.0)],
  ice: [m(MV + 'Ice', /ice_one_shot_crack_[12]_|impact_one_shot_cube_[12]_/, 4, 1.0)],
  sizzle: [m(MV + 'Fire', /short_steam_[12]_|steam_element_[12]_|sparkling_[12]_/, 5, 1.0)],
  glass: [m(MV + 'Glass', /glass_one_shot_break_[12]_/, 2, 1.0)],
  shock: [m(MV + 'Electricity', /shock_[12]_/, 2, 1.2)],
  chain: [m(MV + 'Chains', /chain_element_metal/, 3, 0.7)],
  thunder: [m(MV + 'Effect', /thunder_short_[12]_|thunder_[12]_/, 4, 1.6)],
  spike: [m(MV + 'Objects', /spike_trap_[12]_/, 2, 0.8)],
  teleport: [m(MV + 'Effect', /teleport_[12]_rise/, 2, 1.3)],
  magic: [m(MV + 'Effect', /energy_rise_[12]_|energy_morph_sweep/, 3, 0.9)],
  flash: [m(MV + 'Effect', /energy_rise_1_|fast_travel_[12]_/, 3, 0.9)],
  glitch: [m(MV + 'Effect', /digital_atmosphere_[12]_|error_sound_[12]_digital/, 4, 1.0), m(MV + 'Movements', /hard_step_glitch_[12]_/, 2, 0.6)],
  warn: [m(MV + 'UI', /error_sound_[123]_short/, 3, 0.5)],
  boss_intro: [m(MV + 'Creature', /scream_and_attack_slow_attack_long_scream|low_roar_tiger_low_medium_scared_rise|howling_medium_slow/, 4, 3)],
  boss_defeated: [m(MV + 'Effect', /boss_defeated_[12]_/, 2, 3)],
  event: [m(MV + 'Effect', /new_area_found_[12]_/, 2, 2)],
  event_end: [m(MV + 'Effect', /sci_fi_one_shot_deactivated_[12]_/, 2, 1.4)],
  special: [m(MV + 'Effect', /fast_travel_[12]_|sci_fi_one_shot_activated_[12]_/, 4, 1.5)],
  levelup: [m(MV + 'Effect', /secret_found_[12]_hint/, 2, 1.6)],
  startup: [m(MV + 'Effect', /starting_up_[12]_/, 2, 1.5)],
  victory: [m('Game/Game_State/Win', /Win_\d/, 5, 3.5)],
  gameover: [m('Game/Game_State/Defeat', /Loose_\d/, 4, 3.5)],
  wings: [m(MV + 'Movements', /giant_wings_[12]_/, 2, 1.5)],
  jump: [m('Player/Movement/Jump', /Jump_\d/, 4, 0.6)],
  land: [m('Player/Movement/Jump', /Landing_\d/, 4, 0.6)],
  bush: [m('Game/Environment/Bushes', /Bush_Nature_\d+\.wav$/, 6, 0.8)],
  tree: [m('Game/Environment/Trees', /Tree_Interaction_\d/, 5, 1.0)],
  step_grass: [m('Player/Movement/Footsteps/Grass', /Grass_FS_\d/, 5, 0.3)],
  step_dirt: [m('Player/Movement/Footsteps/Dirt', /Dirt_FS_\d/, 5, 0.3)],
  step_sand: [m('Player/Movement/Footsteps/Sand', /Sand_Fs_\d/, 6, 0.3)],
  step_concrete: [m('Player/Movement/Footsteps/Concrete', /Concrete_FS_\d/, 6, 0.3)],
  step_wood: [m('Player/Movement/Footsteps/Wood', /Wood_Fs_\d/, 5, 0.3)],
  step_stone: [m(MV + 'Movements', /footstep_crack_[12]_|footstep_armed_in_boots_[12]_/, 4, 0.35)],
};

/* seamless ambience loops (kept whole, converted to mono 16 kHz) */
const LOOPS = {
  amb_backyard: { d: 'Game/Environment/Ambiences', re: /Grassland_Ambience_Loop/ },
  amb_office: { d: 'Game/Environment/Ambiences', re: /Room_Ambience_Loop_1/ },
  amb_glitch: { d: 'Metroidvania SFX/Loops', re: /dungeon_hollow_dark_pad_bell_grave/, sr: 11025 },
  amb_rain: { d: 'Game/Environment/Ambiences', re: /Rain_Loop/, sr: 11025 },
  amb_fire: { d: 'Game/Environment/Human', re: /Campfire_Loop/ },
  amb_hum: { d: 'Metroidvania SFX/Loops', re: /huming_lab_huge_white_noise/, sr: 8000, maxSec: 30 },
};

/* all 20 soundtrack tracks */
const MUSIC = {
  theme: '1. MAIN THEME',
  menu: '2. MAIN MENU',
  court: '3. CASTLE COURTYARD',
  market: '4. MARKETPLACE',
  hall: '5. HAUNTED HALLWAY',
  rain: '6. RAINY NIGHT',
  library: '7. FORBIDDEN LIBRARY',
  garden: '8. SECRET GARDEN',
  funny: '9. FUNNY NPC THEME',
  shop: '10. SHOP THEME',
  battle: '11. BATTLE THEME',
  miniboss: '12. MINI BOSS',
  secret: '13. SECRET AREA',
  dungeon: '14. FINAL DUNGEON',
  finalboss: '15. FINAL BOSS',
  sad: '16. SAD MEMORY',
  victory: '17. TRUE ENDING',
  gameover: '18. BAD ENDING',
  credits: '19. CREDITS THEME',
  superboss: '20. SECRET SUPER BOSS',
};

module.exports = { SOUNDS, LOOPS, MUSIC };
