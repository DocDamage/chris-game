/* What a placed piece is to the game (PLAN.md 23): every piece dropped in the editor is recognised by its kind (or, for
   the owner's own pictures, its name) and given what goes with it, or, where it could be more than one thing, the
   editor asks (and can remember the answer for every piece of that kind).
     scenery      nothing more (a statue, a rug, a bush)
     breakable    smashed by a hit, drops wood, scrap or stone (crates, barrels, pots)
     light        glows (torches, lamps, braziers, candles, campfires)
     tree         sways, can be chopped down
     inside:<r>   ENTER goes into a room: a cabin, a townhouse, a frozen house or a sealed vault (doors, houses, huts)
     exit         the stage's way on (a door, a portal, a gate)
     chest        OPEN for loot; the piece is the chest
     shrine       PRAY for a blessing (an altar, a well)
     sign         READ its words (signposts, plaques, carved stones)
     waypoint     TRAVEL from it (a standing stone)
     breach       monsters come out of it until it is closed (a grave, a nest, a rift)
     shop         SHOP there (a stall, a machine)
     burns        hurts what stands in it, as lava does (fire traps, lava pools)
     poisons      hurts and slows, as toxic goo does (toxic pools, reactors)
   A role that the game acts on at a spot (going in, the exit, a chest, a shrine, a sign, a waypoint, a breach, a shop)
   has its spot: the yellow badge in front of the piece, dragged where a hero stands to use it. The game makes the
   chest, shrine, sign ... from the piece when the stage is played (js/stages.js, CH.Stages.events). */
(function (CH) {
  const ED = CH.Editor, $ = ED.$;
  const R = (ED.ROLE = {
    scenery: { label: 'Just scenery', ic: '·', tip: 'nothing more' },
    breakable: { label: 'Breakable', ic: '✖', tip: 'a hit smashes it; it drops wood, scrap or stone' },
    light: { label: 'A light', ic: '☀', tip: 'it glows' },
    tree: { label: 'A tree', ic: '♣', tip: 'it sways, and can be chopped down' },
    'inside:cabin': { label: 'Goes inside: a cabin', ic: '⌂', spot: 1, tip: 'ENTER takes the heroes into a cabin with a chest' },
    'inside:house': { label: 'Goes inside: a townhouse', ic: '⌂', spot: 1, tip: 'ENTER takes the heroes into a townhouse with a chest' },
    'inside:hut': { label: 'Goes inside: a frozen house', ic: '⌂', spot: 1, tip: 'ENTER takes the heroes into a frozen house with a chest' },
    'inside:vault': { label: 'Goes inside: a sealed vault', ic: '⌂', spot: 1, tip: 'ENTER takes the heroes into a guarded treasure vault' },
    exit: { label: 'The stage exit', ic: '⇧', spot: 1, tip: 'the way on: it opens once enough breaches are closed' },
    chest: { label: 'A chest', ic: '▣', spot: 1, tip: 'OPEN for loot (this piece is the chest)' },
    shrine: { label: 'A shrine', ic: '✚', spot: 1, tip: 'PRAY for a blessing' },
    sign: { label: 'A sign to read', ic: '✎', spot: 1, tip: 'READ shows its words' },
    waypoint: { label: 'A waypoint', ic: '◆', spot: 1, tip: 'TRAVEL: a fast-travel stone' },
    breach: { label: 'A breach', ic: '✸', spot: 1, tip: 'monsters come out of it until a hero closes it' },
    shop: { label: 'A shop', ic: '$', spot: 1, tip: 'SHOP: buy and sell here' },
    burns: { label: 'Burns', ic: '♨', tip: 'hurts what stands on it, as lava does' },
    poisons: { label: 'Poisons', ic: '☣', tip: 'hurts and slows what stands on it, as toxic goo does' },
  });
  ED.roleColor = (role) => (role === 'exit' ? '#e43b44' : role === 'chest' ? '#fee761' : role === 'shrine' ? '#ff8fb8' : role === 'sign' ? '#c0a7ff' : role === 'waypoint' ? '#3ccbe6' : role === 'breach' ? '#d55fe0' : role === 'shop' ? '#68c2d3' : '#fee761');

  /* ------------------------------------------------------------------ recognising a piece */
  // a kind's role when it can only be one thing (sure), and the choices to ask when it could be more
  const SURE = {
    torch: 'light', lamp: 'light', lantern: 'light', candles: 'light', brazier: 'light', campfire: 'light', firebarrel: 'light', flame: 'light', flood: 'light',
    crate: 'breakable', case: 'breakable', barrel: 'breakable', toxbarrel: 'breakable', sack: 'breakable', pot: 'breakable', trash: 'breakable', bin: 'breakable',
    tree: 'tree', bigtree: 'tree', deadtree: 'tree',
    door: 'inside', mawdoor: 'inside', house: 'inside', hut: 'inside', crypt: 'inside', cabin: 'inside',
    sign: 'sign', signpost: 'sign', plaque: 'sign',
    firetrap: 'burns', geyser: 'burns', lava: 'burns',
  };
  const ASK = {
    portal: ['exit', 'scenery'], arch: ['exit', 'inside', 'scenery'], altar: ['shrine', 'scenery'], well: ['shrine', 'scenery'],
    grave: ['breach', 'scenery'], opengrave: ['breach', 'scenery'], coffin: ['breach', 'chest', 'scenery'], bonepile: ['breach', 'scenery'], growth: ['breach', 'poisons', 'scenery'],
    stall: ['shop', 'scenery'], machine: ['shop', 'scenery'], cauldron: ['shop', 'scenery'], anvil: ['shop', 'scenery'],
    obelisk: ['waypoint', 'sign', 'scenery'], carv: ['sign', 'scenery'], crystal: ['light', 'scenery'], reactor: ['poisons', 'light', 'scenery'],
    spikes: ['burns', 'scenery'], spike: ['burns', 'scenery'], trap: ['burns', 'scenery'], cage: ['scenery', 'breach'],
    pool: ['scenery', 'poisons', 'burns'], pond: ['scenery'], castle: ['scenery', 'inside'], landmark: ['scenery', 'inside', 'exit'],
    piece: null, // (a kind of its own: the owner's picture the editor could not name) every choice
  };
  // the owner's pictures by their names
  const WORDS = [
    [/chest|treasure|coffer|loot/i, 'chest'], [/door|gate|entrance|house|hut|cabin|shop_?front|tavern|inn\b|building|tent/i, 'inside'], [/portal|exit|stairs?_?down/i, 'exit'],
    [/torch|lamp|lantern|candle|brazier|fire|flame|glow/i, 'light'], [/crate|barrel|box|pot\b|jar|vase|sack/i, 'breakable'], [/tree|pine|oak|palm/i, 'tree'],
    [/sign|plaque|notice|tablet|gravestone/i, 'sign'], [/shrine|altar|statue_?of|idol/i, 'shrine'], [/waypoint|obelisk|monolith/i, 'waypoint'],
    [/nest|hive|rift|grave|spawner/i, 'breach'], [/stall|shop|merchant|vending|market/i, 'shop'], [/lava|fire_?trap|spike|trap/i, 'burns'], [/toxic|acid|poison|goo|slime_?pool/i, 'poisons'],
  ];
  const kindOf = (key) => ((CH.Props.meta(key) || {}).kind) || CH.Props.kindOf(key) || (key.startsWith('obj.') ? (Object.entries(CH.SetPieces.OBJ).find(([, ks]) => ks.includes(key)) || [])[0] : null) || 'piece';
  const nameOf = (key) => { const e = CH.EdCatalog.get(key); return (CH.Props.meta(key) || {}).name || (e ? e.name : key); };
  const inside = () => 'inside:' + ED.roomFor(ED.L.biome);
  const fix = (r) => (r === 'inside' ? inside() : r);
  /* { role, sure, choices } for a piece */
  ED.recognise = function (key, p) {
    const am = CH.Props.meta(key) || {};
    if (am.role) return { role: fix(am.role), sure: true, why: 'its own setting' };
    const kind = kindOf(key);
    const mem = memory()[kind === 'piece' ? key : kind];
    if (mem) return { role: fix(mem), sure: true, why: 'you chose it for ' + (kind === 'piece' ? 'this piece' : 'every ' + kind) };
    if (p && p.cat === 'hut') return { role: inside(), sure: true, why: 'a building' };
    if (SURE[kind]) return { role: fix(SURE[kind]), sure: true, why: 'a ' + kind };
    if (ASK[kind] !== undefined && kind !== 'piece') return { role: fix(ASK[kind][0]), sure: false, choices: ASK[kind].map(fix), kind };
    if (kind === 'piece' || (CH.Props.meta(key) && CH.Props.meta(key).name)) { // the owner's own picture: by its name, else ask
      const n = nameOf(key);
      for (const [re, r] of WORDS) if (re.test(n)) return { role: fix(r), sure: true, why: 'its name says so' };
      return { role: 'scenery', sure: false, choices: ['scenery', 'breakable', 'light', inside(), 'exit', 'chest', 'shrine', 'sign', 'waypoint', 'breach', 'shop', 'burns', 'poisons', 'tree'], kind };
    }
    return { role: 'scenery', sure: true, why: 'scenery' };
  };
  /* the answers kept: kind (or a piece of no kind) -> role */
  const MK = 'chaos.editor.roles';
  function memory() { try { return JSON.parse(localStorage.getItem(MK)) || {}; } catch (e) { return {}; } }
  ED.remember = function (k, role) { const m = memory(); if (role) m[k] = role.startsWith('inside:') ? 'inside' : role; else delete m[k]; try { localStorage.setItem(MK, JSON.stringify(m)); } catch (e) { /* (no store) */ } };
  ED.forget = () => { try { localStorage.removeItem(MK); } catch (e) { /* (no store) */ } };

  /* ------------------------------------------------------------------ a piece's role */
  ED.roleOf = (p) => p.role || (p.exitDoor ? 'exit' : p.enter ? 'inside:' + p.enter : p.ev || (p.glow && !p.fire ? 'light' : p.destructible ? 'breakable' : p.choppable ? 'tree' : 'scenery'));
  const GLOW = { torch: '#ffb347', lamp: '#ffe7a0', lantern: '#ffd27a', candles: '#ffcf70', brazier: '#ff9a3c', campfire: '#ff9a3c', firebarrel: '#ff8a3c', flame: '#ff8a3c', flood: '#e8f4ff', crystal: '#9fe8ff', reactor: '#7cff5a' };
  /* give a piece a role (no undo step: ED.setRole makes one) */
  ED.applyRole = function (p, role) {
    const L = ED.L, was = ED.roleOf(p);
    // what the old role brought goes
    if (was === 'exit' && L.exit) { /* (the exit stays where it is: a stage always has one) */ }
    delete p.enter; delete p.exitDoor; delete p.ev; delete p.evd;
    if (p.roleGlow) { delete p.glow; delete p.lr; delete p.roleGlow; }
    if (p.roleBreak) { p.destructible = false; delete p.roleBreak; }
    if (p.roleTree) { p.choppable = false; p.swayable = false; delete p.roleTree; }
    p.role = role;
    const def = R[role] || R.scenery;
    if (def.spot) p.door = p.door || ED.doorSpot(p); else delete p.door;
    const kind = p.cat || '';
    if (role.startsWith('inside:')) p.enter = role.slice(7);
    else if (role === 'exit') { p.exitDoor = true; if (!L.exit) L.exit = { open: false, room: -1 }; L.exit.x = p.door.x; L.exit.y = p.door.y; }
    else if (role === 'light') { if (!p.glow) { p.glow = GLOW[kind] || '#ffb347'; p.lr = Math.max(60, p.lr || 70); p.phase = Math.random(); p.roleGlow = true; } }
    else if (role === 'breakable') { if (!p.destructible) { p.destructible = true; p.maxHp = p.maxHp || 40; p.hp = p.maxHp; p.resourceType = p.resourceType || 'wood'; p.roleBreak = true; } if (!p.solid) { p.solid = true; p.box = p.box || ED.traceBox(p.sprite); } }
    else if (role === 'tree') { if (!p.choppable) { p.choppable = true; p.swayable = true; p.kind = 'tree'; p.roleTree = true; } }
    else if (role === 'chest') { p.ev = 'chest'; p.evd = { tier: Math.max(1, Math.round((L.stage || 1) / 4)) }; }
    else if (role === 'shrine') { p.ev = 'shrine'; p.evd = { kind: 'healing' }; }
    else if (role === 'sign') { p.ev = 'sign'; p.evd = { name: (nameOf(p.sheet || p.sprite) || 'A sign').replace(/^[a-z]+ /, '').replace(/\b\w/, (c) => c.toUpperCase()), lines: ['Write what it says here.'] }; }
    else if (role === 'waypoint') p.ev = 'waypoint';
    else if (role === 'breach') { const h = (CH.LevelGen.HIVES[L.biome] || CH.LevelGen.HIVES.dungeon); p.ev = 'breach'; p.evd = { kind: h.kind, name: h.name }; }
    else if (role === 'shop') p.ev = 'shop';
    else if (role === 'burns' || role === 'poisons') p.ev = role;
    if (role === 'scenery') delete p.role;
  };
  ED.setRole = function (props, role) {
    const L = ED.L;
    const keys = ['role', 'enter', 'exitDoor', 'ev', 'evd', 'door', 'glow', 'lr', 'phase', 'roleGlow', 'destructible', 'maxHp', 'hp', 'resourceType', 'roleBreak', 'choppable', 'swayable', 'kind', 'roleTree', 'solid', 'box'];
    const before = props.map((p) => Object.fromEntries(keys.map((k) => [k, ED.clone(p[k])])));
    const exit0 = ED.clone(L.exit);
    ED.act((R[role] || R.scenery).label.toLowerCase(), () => props.forEach((p) => ED.applyRole(p, role)), () => {
      props.forEach((p, i) => { for (const k of keys) { if (before[i][k] === undefined) delete p[k]; else p[k] = ED.clone(before[i][k]); } });
      L.exit = ED.clone(exit0);
    });
  };

  /* every piece of the stage given the role it surely has (a generated stage's doors, torches, crates ...), one step */
  ED.recogniseAll = function () {
    const L = ED.L, todo = [];
    for (const p of L.props) {
      if (p.invisible || p.fire || p.dead || ED.roleOf(p) !== 'scenery') continue;
      const g = ED.recognise(p.sheet || p.sprite, p);
      if (g.sure && g.role !== 'scenery') todo.push([p, g.role]);
    }
    if (!todo.length) { ED.toast('Every piece already is what it should be.'); return 0; }
    const keys = ['role', 'enter', 'exitDoor', 'ev', 'evd', 'door', 'glow', 'lr', 'phase', 'roleGlow', 'destructible', 'maxHp', 'hp', 'resourceType', 'roleBreak', 'choppable', 'swayable', 'kind', 'roleTree', 'solid', 'box'];
    const before = todo.map(([p]) => Object.fromEntries(keys.map((k) => [k, ED.clone(p[k])])));
    const exit0 = ED.clone(L.exit);
    ED.act('recognise ' + todo.length + ' pieces', () => todo.forEach(([p, r]) => ED.applyRole(p, r)), () => { todo.forEach(([p], i) => { for (const k of keys) { if (before[i][k] === undefined) delete p[k]; else p[k] = ED.clone(before[i][k]); } }); L.exit = ED.clone(exit0); });
    const by = {};
    for (const [, r] of todo) by[(R[r] || R.scenery).label.toLowerCase()] = (by[(R[r] || R.scenery).label.toLowerCase()] || 0) + 1;
    ED.toast('Recognised ' + todo.length + ': ' + Object.entries(by).map(([k, n]) => n + ' ' + k).join(', ') + '.', true, 6000);
    return todo.length;
  };

  /* ------------------------------------------------------------------ when a piece is placed */
  ED.eventMode = (() => { try { return localStorage.getItem('chaos.editor.doors') || 'always'; } catch (e) { return 'always'; } })(); // 'always' recognise and ask; 'ask' ask every time; 'never' leave pieces as scenery
  ED.setEventMode = (m) => { ED.eventMode = m; try { localStorage.setItem('chaos.editor.doors', m); } catch (e) { /* (no store) */ } };
  const pending = new Map(); // a question already asked for a kind: the pieces placed meanwhile wait for its answer
  ED.autoEvent = function (p) {
    if (ED.eventMode === 'never' || p.fire) return;
    const key = p.sheet || p.sprite;
    const g = ED.recognise(key, p);
    if (g.sure && ED.eventMode !== 'ask') {
      if (g.role !== 'scenery' && g.role !== ED.roleOf(p)) { ED.applyRole(p, g.role); note(p, g); }
      return;
    }
    if (g.sure && g.role === 'scenery') return;
    ask(p, key, g);
  };
  let noted = 0;
  function note(p, g) {
    const now = performance.now();
    if (now - noted < 1500) return; // (one note for a row of them)
    noted = now;
    ED.toast((R[g.role] || R.scenery).label + ': ' + (R[g.role] || {}).tip + ' (' + g.why + '). Change it in the details panel.', false, 3500);
  }
  function ask(p, key, g) {
    const k = g.kind === 'piece' || !g.kind ? key : g.kind;
    const q = pending.get(k);
    if (q) { q.props.push(p); return; }
    const props = [p];
    const all = g.choices && g.choices.length ? g.choices : Object.keys(R);
    const box = $('div', { class: 'ed-ask' });
    const remember = $('input', { type: 'checkbox', checked: true });
    const answer = (role) => {
      pending.delete(k);
      box.remove();
      if (remember.checked) ED.remember(k, role);
      const live = props.filter((x) => ED.L.props.includes(x));
      if (live.length && role !== 'scenery') ED.setRole(live, role);
    };
    const more = $('select', { onchange: (e) => e.target.value && answer(e.target.value) }, [$('option', { value: '', text: 'something else…' })].concat(Object.entries(R).filter(([r]) => !all.includes(r)).map(([r, d]) => $('option', { value: r, text: d.label }))));
    box.append(
      $('div', { class: 'q', text: 'What is this ' + nameOf(key) + '?' }),
      $('div', { class: 'btns' }, all.map((r, i) => $('button', { class: i === 0 ? 'primary' : '', title: (R[r] || {}).tip || '', text: (R[r] || R.scenery).ic + ' ' + (R[r] || R.scenery).label, onclick: () => answer(r) })).concat([more])),
      $('label', { class: 'k' }, [remember, ' the same for every ' + (g.kind && g.kind !== 'piece' ? g.kind : 'one of this piece')]),
    );
    pending.set(k, { props, box });
    ED.els.view.append(box);
  }
})(window.CH);
