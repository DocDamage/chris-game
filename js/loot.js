/* CHAOS.exe - monster drops. Every enemy and boss can leave behind trophies from the "mob drops" pack:
   367 collectable items, each with a name, a rarity and a theme. Enemies drop items that fit them (slimes drop
   goo, spiders drop silk and eggs, golems drop ore ...), bosses drop rare and epic ones.
   Picking an item up gives an immediate effect (heal / xp / wood / scrap / stone / coins, bigger for rarer items)
   and files it in the Trophy Codex (Storage.loot). In the safehouse the codex can be sold for scrap, and
   completing parts of it unlocks permanent bonuses. */
(function (CH) {
  'use strict';
  const U = CH.U;
  const Loot = (CH.Loot = {});

  /* themes: s slime/poison, p plant/fungus/wood, a bug/spider/egg, b beast part, v bird/wing/feather,
     f fire/lava, i ice/cold water, g gem/crystal, r rock/ore, m metal/tools, c coins/trinkets, x magic, u sea.
     rarity: c common, u uncommon, r rare, e epic. Format: name|themes|rarity (the first theme decides the effect). */
  const RAW = `
Magma Chunk|rf|u
Amethyst Crystal|gx|r
Violet Gem Cluster|gx|r
Dry Leaf|p|c
Bat Wing|vb|c
Jade Egg|ag|r
Star Fragment|gx|e
Topaz Crystal|g|r
Spotted Toadstool|ps|c
Glowcap Mushroom|px|u
Autumn Leaf|p|c
Rainbow Feathers|vc|u
Bug Husk|a|c
Spider Legs|a|c
Shell Plate|b|c
Leather Scrap|b|c
Spider Web|a|c
Emerald|g|r
Black Pearl|gu|r
Old Rope|m|c
Braided Cord|m|c
Wood Log|p|c
Scallop Shell|u|c
Peppermint Shell|u|u
Torn Note|c|c
Slime Cauldron|sx|r
Copper Wire|m|c
Bone Club|b|c
Old Scroll|x|u
Rolled Map|c|u
Bone Dust|b|c
Lockbox|c|u
Brass Compass|c|u
Hatchet Head|m|c
Clay Pot|c|c
Rusty Pliers|m|c
Silver Ring|c|u
Rusty Gear|m|c
Fossil Shell|r|u
Ore Chunk|r|c
Sharp Fang|b|c
Curved Horn|b|c
Frost Crystal|ig|r
Bat Wings|vb|c
Bone Shards|b|c
Black Husk|a|c
Poison Vial|s|u
Scorpion Tail|a|u
Moonstone Orb|gx|r
Wyvern Wing|vb|u
Lustrous Pearl|u|u
Wolf Pelt|b|c
Seed Pouch|p|c
Fire Ants|af|c
Gold Ore|rc|r
Dung Ball|s|c
Shrimp Tail|u|c
Sand Gold|c|u
Lava Rock|rf|c
Shadow Talon|bx|u
Prism Egg|ag|e
Raven Feathers|v|c
Opal Egg|ag|r
Mandrake Root|px|u
Void Pearl|gx|e
Spider Eggs|a|c
Gem Geode|gr|r
Horn Crescent|b|c
Glowcap Cluster|px|u
Icicle Spikes|i|u
Tin Tankard|mc|c
Snake Shed|b|c
Speckled Egg|a|c
Obsidian Bundle|r|c
Plain Egg|a|c
White Feather|v|c
Silver Ore|r|u
Twig|p|c
Twig Bundle|p|c
Amber Chunk|rc|u
Charred Log|pf|c
Horn Tip|b|c
Horn Splinter|b|c
Moss Patch|p|c
Pebbles|r|c
Mossy Rock|r|c
Lizard Frill|b|u
Ghoul Claw|bx|u
Antidote|s|u
Femur Bone|b|c
Ember Husk|f|u
Sabre Claws|b|u
Ivory Horn|b|u
Chaos Elixir|x|r
Ruby Shard|g|r
Beast Horn|b|c
Lucky Clover|p|r
Bone Fragments|b|c
Bear Pelt|b|u
Tanned Hide|b|c
Ram Horn|b|u
Beast Tusk|b|u
Antlers|b|u
Coin Pouch|c|u
Beast Skull|b|r
Fox Pelt|b|c
Red Coral|u|c
Spiral Conch|u|c
Starfish|u|c
Sea Kelp|u|c
Monster Jaw|b|r
Shark Tooth|b|u
Scale Cluster|u|u
Mana Jar|x|u
Scarab Beetle|a|u
Fairy Wings|vx|r
Giant Tick|a|c
Fat Larva|a|c
Cream Jar|c|c
Honeycomb|a|u
Herb Leaves|p|c
Venom Jar|s|u
Spore Cap|ps|u
Vine Curl|p|c
Nightbloom|px|u
Gnarled Root|p|c
Twisted Root|p|c
Dusk Berries|p|c
Blood Berries|p|c
Dry Hay|p|c
Elk Antlers|b|u
Ram Spiral|b|u
Bear Paw|b|u
Wolf Paw|b|c
Cat Paw|b|c
Fang Set|b|u
Cloth Roll|c|c
Yarn Ball|c|c
Parrot Feathers|vc|u
Frost Blossom|ip|r
Citrine Cluster|g|r
Iron Ingot|m|u
Malachite|rg|u
Tree Ring|p|c
Leather Armor|bm|u
Tattered Flag|c|c
Straw Roll|p|c
Iron Nail|m|c
Steel Nail|m|c
Brass Cog|m|c
Iron Cog|m|c
Mini Anvil|m|u
Rusty Knife|m|c
Hunting Knife|m|c
Dagger|m|u
Smith Hammer|m|u
Clay Jug|c|c
Old Lantern|mc|u
Pocket Clock|mc|u
Iron Chain|m|c
Food Basket|pc|c
Treasure Chest|c|r
Small Barrel|pc|c
Gravel|r|c
Old Papers|c|c
Mana Potion|x|u
Small Bone|b|c
Moss Ball|p|c
Dried Peel|p|c
Thorn Vine|p|u
Amethyst Shard|g|u
Broadleaf|p|c
Eyeball|bx|r
Burr Seed|p|c
Gripper Claw|b|u
Tonic Vial|x|c
Void Gem|gx|e
Green Branch|p|c
Raptor Talon|bv|u
Rune Tablet|x|r
Jelly Cap|su|u
Stone Heart|rx|r
Blue Feather|v|u
Tentacle|su|u
Silver Dust|gx|u
Black Horn|b|u
Living Flame|fx|r
Coal Lump|rf|c
Mossy Stone|r|c
Green Talon|bp|u
Tiny Skull|b|u
Molar|b|c
Slime Glob|s|c
Long Bone|b|c
Maple Leaf|p|c
Ice Feather|iv|u
Kraken Tentacle|su|r
Cosmic Pebble|gx|e
Spore Dust|ps|c
Rough Hide|b|c
Ghost Spider|ax|r
Wolf Fang|b|c
Charred Pellet|f|c
Nebula Egg|agx|e
Cobweb|a|c
Obsidian Block|r|u
Ruby|g|r
Ivory Tusk|b|u
Slime Clumps|s|c
Pearl Egg|a|u
Bat Wing Pair|vb|c
Spider Amber|a|r
Sand Star|u|c
Teal Coral|u|u
Wooden Fence|p|c
Macaw Feathers|vc|u
Imp Horn|bf|u
Rune Stone|x|u
River Stones|r|c
Fired Pot|c|c
Cotton Boll|p|c
Shadow Claw|bx|u
Glow Fungus|ps|u
Purple Coral|u|u
Pufferfish|u|u
Rope Coil|m|c
Oak Leaf|p|c
Iron Ore|r|c
Dragon Scales|bf|e
Poppy Seeds|p|c
Pearl|u|u
Wheat Bundle|p|c
Eggshell|a|c
Soot Pile|f|c
Flint Arrow|m|c
Bone Pile|b|c
Wooden Ring|c|c
Crow Feather|v|c
Cut Emerald|g|r
Copper Nuggets|r|c
Old Medallion|c|u
Obsidian Orb|rx|r
Nautilus Shell|u|u
Brass Ring|c|c
Grain Sack|c|c
Fish Scales|u|c
Heart Crystal|gx|e
Barley|p|c
Mud Claw|b|c
Rainbow Egg|ag|e
Amethyst Coral|u|u
Birch Log|p|c
Iron Bar|m|u
Tarantula|a|r
Forest Mushrooms|p|c
Goblin Ear|b|c
Russet Leaf|p|c
Raven Quill|v|c
Slime Orb|s|u
Bone Spike|b|c
Clay Brick|r|c
Magma Core|rf|r
Dead Branch|p|c
Yellow Blossom|p|c
Frost Quills|iv|u
Spore Bloom|ps|u
Spiral Cord|m|c
Snail Shell|a|c
Algae|p|c
Plank Bundle|p|c
Giant Tooth|b|u
Striped Shell|u|c
Quartz|g|u
Stone Arrowhead|r|c
Serpent Coil|b|u
Straw Bundle|p|c
Dark Husk|a|c
Rhino Beetle|a|u
Jade|g|u
Garnet|g|u
Jolly Flag|c|u
Black Pearl Orb|gu|r
Insect Amber|a|r
Cyclops Eye|bx|r
Leaf Blade|p|u
Cobblestones|r|c
Viper Skin|b|u
Dark Scale|b|c
Boar Hide|b|c
Egg Clutch|a|c
Spine Bones|b|c
Gecko|b|c
Turtle Shell|b|u
Bear Claw|b|u
Beetle Shell|a|c
Cat Claw|b|c
Goat Horn|b|c
Acid Vial|s|u
Ghost Bone|bx|r
Rib Cage|b|c
Fire Heart|fx|e
Ghost Jar|x|r
Brown Hide|b|c
Sabre Tooth|b|r
Bull Horn|b|u
Hoof|b|c
Wolf Trophy|b|r
Crossbones|b|c
Rib|b|c
Fur Pelt|b|c
Meat Bone|b|c
Pink Coral|u|c
Pink Conch|u|c
Sea Star|u|c
Seagrass|u|c
Jawbone|b|u
Teeth Pile|b|c
Rainbow Shell|u|r
Spirit Bottle|x|r
Dung Beetle|a|c
Silk Web|a|u
Hellhound Claws|bf|u
Maggot|a|c
Honey Jar|c|u
Comb|a|c
Herb Bunch|p|c
Firefly Jar|ax|r
Snail Shell Spiral|a|c
Stag Branch|b|u
Dino Egg|a|r
Aqua Crystals|gi|r
Old Key|mc|u
Treasure Map|c|r
Spellbook|x|r
Silver Coins|c|u
Cobra|b|r
Bull Ant|a|c
Opal Shell|u|r
Stone Chunk|r|c
Glow Potion|x|r
Frost Potion|ix|u
Moon Pearl|gx|r
Amber Gem|g|r
Cut Log|p|c
Pebble Set|r|c
Fly Wings|av|c
Egg Assortment|a|r
Purple Crystals|g|r
Eagle Talon|bv|u
Peacock Feather|vc|r
Charcoal|rf|c
Whelk Shell|u|c
Ancient Scroll|x|r
Grimoire|x|r
Gold Coins|c|r
Amber Fossil|a|r
Trilobite|a|u
Fire Egg|af|r
Black Ore|r|u
Chainmail|m|r
Gold Ring|c|r
Iron Hook|m|c
Wool Ball|p|c
Bone Flute|bx|u
Empty Bottle|c|c
Ash Heap|f|c
Wicker Basket|pc|c
`.trim().split('\n');

  Loot.RARITY = {
    c: { name: 'Common', color: '#c2c3c7', w: 62, value: 1, mul: 1 },
    u: { name: 'Uncommon', color: '#63c74d', w: 27, value: 3, mul: 2 },
    r: { name: 'Rare', color: '#3ccbe6', w: 9.5, value: 8, mul: 4 },
    e: { name: 'Epic', color: '#b55088', w: 1.5, value: 20, mul: 8 },
  };
  /* what picking an item up does, by its first theme */
  const EFFECT = { b: 'heal', a: 'heal', v: 'heal', g: 'xp', x: 'xp', p: 'wood', m: 'scrap', r: 'stone', s: 'coin', c: 'coin', u: 'coin', f: 'coin', i: 'coin' };
  Loot.THEMES = { s: 'Slime & Poison', p: 'Plants & Fungi', a: 'Bugs & Eggs', b: 'Beast Parts', v: 'Feathers & Wings', f: 'Fire & Lava', i: 'Frost', g: 'Gems', r: 'Rocks & Ore', m: 'Metal & Tools', c: 'Trinkets & Coins', x: 'Magic', u: 'Sea' };

  Loot.items = RAW.map((line, i) => {
    const p = line.split('|');
    const it = { id: i + 1, name: p[0], themes: p[1], rarity: p[2], sprite: 'loot.' + (i + 1) };
    it.effect = EFFECT[p[1][0]] || 'coin';
    it.value = Loot.RARITY[it.rarity].value;
    return it;
  });
  Loot.count = Loot.items.length;
  Loot.byId = (id) => Loot.items[id - 1] || null;

  /* ---- which enemy drops what ---- */
  const ENEMY_THEMES = {
    chicken: 'vb', potato: 'fx', trashcan: 'mb', office: 'bmc', toaster: 'fm', influencer: 'xc', cart: 'mc', pigeon: 'v', fridge: 'img', intern: 'mcs',
    plant: 'p', slime: 's', orc: 'bm', goblin: 'cmx', spider: 'a', golem: 'rg',
  };
  const BOSS_THEMES = {
    ceo: 'cx', chicken: 'vb', bug: 'as', frog: 'su', bd: 'gr', gol: 'gm', maw: 'bx', dragon: 'bf', beholder: 'xg', mage: 'xi', demon: 'fx', ooze: 's',
    treant: 'p', moss: 'rp', knight: 'bm', yeti: 'ib', daddy: 'bs', skull: 'bx', dunewyrm: 'bf', bloodwyrm: 'bx', voideye: 'xg', sporeeye: 'ps',
  };
  Loot.themesOf = (type, kind) => (kind ? BOSS_THEMES[kind] : ENEMY_THEMES[type]) || 'c';

  const pool = {}; // theme + rarity -> items
  for (const it of Loot.items) for (const t of it.themes) (pool[t + it.rarity] = pool[t + it.rarity] || []).push(it);

  /* roll one item for an enemy type (or boss kind). minRarity: 'r' for bosses, 'u' for elites */
  Loot.roll = function (type, o) {
    o = o || {};
    const th = Loot.themesOf(type, o.boss);
    const order = ['c', 'u', 'r', 'e'];
    const from = order.indexOf(o.min || 'c');
    const luck = o.luck || 1;
    const rar = U.weighted(order.slice(from), (r) => Loot.RARITY[r].w * (r === 'c' ? 1 : luck * (o.boss ? 3 : 1)));
    // items of the enemy's own themes at that rarity; any item of that rarity when it has none
    const own = [];
    for (const t of th) if (pool[t + rar]) for (const it of pool[t + rar]) if (!own.includes(it)) own.push(it);
    if (own.length) return U.pick(own);
    const all = Loot.items.filter((i) => i.rarity === rar);
    return U.pick(all);
  };

  /* ---- codex bonuses: permanent perks for how much of the codex is complete ---- */
  Loot.MILESTONES = [
    { at: 0.05, name: 'Scavenger', text: '+5 starting coins', stats: { startCoins: 5 } },
    { at: 0.15, name: 'Collector', text: '+3% damage', stats: { dmg: 0.03 } },
    { at: 0.3, name: 'Taxidermist', text: '+10 max HP', stats: { hp: 10 } },
    { at: 0.5, name: 'Curator', text: '+10% loot drop chance and +5% XP', stats: { lootChance: 0.1, xp: 0.05 } },
    { at: 0.75, name: 'Naturalist', text: '+5% damage and +5% speed', stats: { dmg: 0.05, speed: 0.05 } },
    { at: 1.0, name: 'Completionist', text: '+20 max HP and +10% coins', stats: { hp: 20, coinMult: 0.1 } },
  ];
  Loot.discovered = () => Object.keys(CH.Storage.data.seen).length;
  Loot.progress = () => Loot.discovered() / Loot.count;
  /* sum of the unlocked milestone stats */
  Loot.bonus = function () {
    const out = {};
    const f = Loot.progress();
    for (const m of Loot.MILESTONES) if (f >= m.at - 1e-9) for (const k in m.stats) out[k] = (out[k] || 0) + m.stats[k];
    return out;
  };

  /* ---- gameplay hooks ---- */
  /* chance that a dead enemy leaves an item */
  Loot.chance = function (e) {
    if (e.summoned) return 0.03;
    const base = e.isElite ? 0.55 : 0.09;
    const luck = CH.G.players.some((p) => p.buffs.luck > 0) ? 3 : 1;
    return Math.min(0.95, base * luck * (1 + (Loot.bonus().lootChance || 0)));
  };

  Loot.dropFor = function (g, e) {
    if (Math.random() >= Loot.chance(e)) return;
    const it = Loot.roll(e.type, { min: e.isElite ? 'u' : 'c', luck: 1 + Math.min(2, (g.wave || 1) * 0.06) });
    Loot.drop(g, it, e.x, e.y);
  };
  Loot.bossDrops = function (g, b) {
    const n = 2 + (b.tier > 0 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const it = Loot.roll(null, { boss: b.kind, min: i === 0 ? 'r' : 'u' });
      Loot.drop(g, it, b.x + U.rand(-26, 26), b.y + U.rand(-20, 20));
    }
  };
  Loot.drop = function (g, it, x, y) {
    const pk = g.dropPickup('loot', x, y, 1, { item: it.id, life: 40 });
    if (pk && it.rarity !== 'c') CH.FX.ring(x, y, 4, 12 + Loot.RARITY[it.rarity].mul * 2, Loot.RARITY[it.rarity].color, 0.35);
    return pk;
  };

  /* picked up by hero p: apply the effect and file it in the codex */
  Loot.collect = function (g, pk, p) {
    const it = Loot.byId(pk.item);
    if (!it) return;
    const R = Loot.RARITY[it.rarity];
    const FX = CH.FX;
    const S = CH.Storage;
    const first = !(S.loot[it.id] > 0) && !S.data.seen[it.id];
    S.addLoot(it.id, 1);
    g.runLoot = g.runLoot || {};
    g.runLoot[it.id] = (g.runLoot[it.id] || 0) + 1;
    g.lootCount = (g.lootCount || 0) + 1;
    if (first) g.newLoot = (g.newLoot || 0) + 1;
    const n = R.mul;
    let txt = '';
    switch (it.effect) {
      case 'heal':
        g.healPlayer(Math.round(2 + n * 2.5), p);
        txt = '+HP';
        break;
      case 'xp':
        CH.Upgrades.addXp(g, 1 + n * 2, p);
        txt = '+XP';
        break;
      case 'wood':
      case 'scrap':
      case 'stone':
        g.resources[it.effect] = (g.resources[it.effect] || 0) + n;
        S.addResource(it.effect, n);
        txt = '+' + n + ' ' + it.effect.toUpperCase();
        break;
      default:
        g.addCoins(n * 2);
        txt = '+' + n * 2 + '$';
    }
    CH.Audio.sfx(it.rarity === 'e' ? 'level_up' : it.rarity === 'r' ? 'pickup_power' : 'pickup_coin');
    FX.text(p.x, p.y - 20, (first ? 'NEW! ' : '') + it.name.toUpperCase(), R.color, it.rarity === 'c' ? 1 : 2);
    FX.text(p.x, p.y - 10, txt, '#ffffff', 1);
    FX.burst(pk.x, pk.y, { n: 4 + n, colors: [R.color, '#ffffff'], speed: 45, life: 0.35 });
    if (it.rarity === 'e') FX.ring(p.x, p.y, 6, 34, R.color, 0.5);
  };
})(window.CH);
