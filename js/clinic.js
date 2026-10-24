/* CHAOS.exe - the hideout's three new people (PLAN.md 18, K6), drawn with their own animated art (npc.<id>.<anim>.<e|s>,
   tools/pack-kits.js) and standing among the other traders:
     NURSE MERCY    sells food and potions for the belt, and refills a revive charge: when the party falls with a charge,
                    it gets up where it fell (at half health) instead of waking in the hideout (js/areas.js)
     DR. SAWBONES   body upgrades paid with gold and strange organs (found in secret rooms): VITALITY (+10% health a rank),
                    IRON GUT (+25% healing a rank), SECOND HEART (the nurse's charge holds two); and SURGERY, which takes
                    the skill tree apart and gives every point back
     JESUS          blessings: a tithe of gold for a boon that lasts the next three areas (more damage, more health, more
                    gold, sharper crits); he lifts curses once the cult starts handing them out (K9) and has a pilgrimage
                    for the Lantern of Truth (K8)
   Their state is the character's (js/character.js: belt, body, revive, bless). Voices: the game's own (PLAN.md 18.1). */
(function (CH) {
  'use strict';
  const G = CH.G;
  const U = CH.U;
  const FX = CH.FX;
  const X = CH.X;
  const Audio = CH.Audio;
  const Town = CH.Town;
  const Storage = CH.Storage;
  if (!Town) return;

  const C = (CH.Clinic = {});
  const PEOPLE = [
    { id: 'nurse', name: 'NURSE MERCY', x: 17, y: 20, art: 'nurse', act: 'heal' },
    { id: 'doctor', name: 'DR. SAWBONES', x: 21, y: 20, art: 'doctor', act: 'heal' },
    { id: 'jesus', name: 'JESUS', x: 38, y: 19, art: 'jesus', act: 'bless' },
  ];
  for (const n of PEOPLE) if (!Town.NPCS.some((q) => q.id === n.id)) Town.NPCS.push(Object.assign({ hue: 0, face: 0, sign: 1 }, n));

  /* ------------------------------------------------------------------ the character's part */
  const hero = () => G.players[0];
  C.body = (p) => (p.body || (p.body = { vit: 0, gut: 0, heart: 0 }));
  C.maxRevive = (p) => 1 + (C.body(p).heart || 0);
  X.statHooks.push((p, s) => {
    const b = p.body;
    if (b) {
      s.hpMul *= 1 + 0.1 * (b.vit || 0);
      s.healMult *= 1 + 0.25 * (b.gut || 0);
    }
    const bl = p.bless && p.bless.left > 0 ? p.bless.id : null;
    if (bl === 'wrath') s.dmgMult *= 1.2;
    if (bl === 'grace') s.hpMul *= 1.25;
    if (bl === 'plenty') s.coinMult *= 1.3;
    if (bl === 'eye') s.critChance += 0.1;
  });
  /* a blessing counts the areas it lasts */
  G.on('startWave', function (ev) {
    const L = G.level;
    if (!L || L.isTown || L.stage !== ev.n) return;
    for (const p of G.players) if (p.bless && p.bless.left > 0) {
      p.bless.left--;
      if (p.bless.left <= 0) { p.bless = null; if (G.ui && G.ui.toast) G.ui.toast('THE BLESSING FADES'); }
      CH.Upgrades.recalc(p);
    }
  });
  /* strange organs: one in every secret room's chest (the doctor wants them) */
  const R = CH.Run;
  const prevChest = R.onChest;
  R.onChest = function (c, p) {
    if (prevChest) prevChest(c, p);
    if (c.secret) {
      Storage.addResource('organ', 1);
      FX.text(c.x, c.y - 34, 'A STRANGE ORGAN', '#e43b44', 2);
    }
  };

  /* ------------------------------------------------------------------ art */
  const strip = (n, anim, dir) => CH.Assets.images['npc.' + n.art + '.' + anim + '.' + dir] || CH.Assets.images['npc.' + n.art + '.' + anim + '.e'];
  const info = (n) => (CH.Assets.meta && CH.Assets.meta.npcs && CH.Assets.meta.npcs[n.art]) || null;
  C.has = (n) => !!(n.art && info(n) && strip(n, 'idle', 's'));
  /* a frame of the person: idle facing the camera, the trade's own move (heal / bless) while someone talks to them */
  C.draw = function (ctx, n, x, y, t) {
    const m = info(n);
    const busy = n.busyT > 0;
    const anim = busy ? n.act : 'idle';
    const im = strip(n, anim, 's') || strip(n, 'idle', 's');
    if (!im) return false;
    const fw = m.fw, fh = m.fh, frames = Math.max(1, Math.round(im.width / fw));
    const f = Math.floor(t * (busy ? 9 : 5) + n.x) % frames;
    CH.Enemies.shadow(ctx, x, y + 12, 14);
    ctx.drawImage(im, f * fw, 0, fw, fh, Math.round(x - fw / 2), Math.round(y + 14 - fh), fw, fh);
    if (n.id === 'jesus') { // a faint halo
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 2);
      ctx.strokeStyle = '#fee761';
      ctx.beginPath();
      ctx.ellipse(x, y + 14 - fh + 6, 7, 2.5, 0, 0, 6.283);
      ctx.stroke();
      ctx.restore();
    }
    CH.Font.draw(ctx, n.name, x, y + 20, '#fee761', 1, true);
    return true;
  };
  const prevDraw = Town.drawNpc;
  Town.drawNpc = function (ctx, n, x, y, t) {
    t = t === undefined ? (G.level && G.level.fx) || 0 : t;
    if (C.has(n) && x > -40 && y > -60 && x < CH.Balance.view.w + 40 && y < CH.Balance.view.h + 40) { C.draw(ctx, n, x, y, t); return; }
    return prevDraw(ctx, n, x, y, t);
  };
  G.on('step', function (dt) {
    const L = G.level;
    if (L && L.npcs) for (const n of L.npcs) if (n.busyT > 0) n.busyT -= dt;
  });
  /* their portrait for the dialogue box: the first idle frame, enlarged */
  const portraits = {};
  C.portrait = function (id) {
    if (portraits[id] !== undefined) return portraits[id];
    const n = PEOPLE.find((q) => q.id === id);
    const m = n && info(n), im = n && strip(n, 'idle', 's');
    if (!im) return (portraits[id] = '');
    const c = document.createElement('canvas');
    c.width = m.fw * 2; c.height = m.fh * 2;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(im, 0, 0, m.fw, m.fh, 0, 0, m.fw * 2, m.fh * 2);
    return (portraits[id] = c.toDataURL());
  };
  const D = () => CH.Dialogue;
  const prevUrl = D().portraitUrl;
  D().portraitUrl = (key) => (key && key.indexOf('art:') === 0 ? C.portrait(key.slice(4)) : prevUrl(key));

  /* ------------------------------------------------------------------ talking */
  const gold = () => Math.floor(G.coins || 0);
  const pay = (n) => { if (gold() < n) { Audio.sfx('nope'); G.ui.toast('NOT ENOUGH GOLD (' + n + ')'); return false; } G.coins -= n; Audio.sfx('buy'); return true; };
  const color = (p) => (CH.UIK && CH.UIK.on ? G.players.indexOf(p) : 0);
  const say = (n, p, lines, choices) => { n.busyT = 2.4; D().say({ who: n.name, portrait: 'art:' + n.id, lines, choices, color: color(p) }); };
  const save = () => { if (CH.Character) CH.Character.save(); else Storage.save(); };

  /* the nurse: food and potions, the revive charge */
  const FOOD = [['meat', 30], ['steak', 80], ['herb', 45], ['fish', 60]];
  C.nurse = function (n, p) {
    const h = hero();
    const lvl = h ? h.level : 1;
    const charge = 120 + 30 * lvl;
    const have = h ? h.revive || 0 : 0, max = h ? C.maxRevive(h) : 1;
    const lines = [U.pick(['Hold still. This will hurt you more than it hurts me.', 'Another one? Sit. Bleed quietly.', 'I patch them up, they run back into the woods. Job security.']), 'Revive charges: ' + have + ' / ' + max + '. Fall with one and you get back up where you dropped.'];
    const buy = (id, cost) => ({ label: Items().CONSUMABLES[id].name.toUpperCase() + ' (' + cost + ')', fn: () => { if (pay(cost)) { Items().addConsumable(p, id, 1); save(); } C.nurse(n, p); } });
    say(n, p, lines, FOOD.map(([id, c]) => buy(id, c)).concat([
      have < max ? { label: 'REFILL REVIVE (' + charge + ')', fn: () => { if (pay(charge)) { h.revive = Math.min(max, (h.revive || 0) + 1); FX.text(h.x, h.y - 30, 'REVIVE CHARGED', '#63c74d', 2); save(); } } } : { label: 'CHARGE IS FULL', fn: () => {} },
      { label: 'LEAVE', fn: () => {} },
    ]));
  };
  const Items = () => CH.Items;

  /* the doctor: the body, and surgery on the skill tree */
  C.UPGRADES = [
    { id: 'vit', name: 'VITALITY', max: 5, gold: (r) => 150 + 100 * r, organs: (r) => r + 1, desc: '+10% health' },
    { id: 'gut', name: 'IRON GUT', max: 3, gold: (r) => 200 + 150 * r, organs: (r) => r + 2, desc: '+25% healing' },
    { id: 'heart', name: 'SECOND HEART', max: 1, gold: () => 600, organs: () => 4, desc: 'the nurse\'s charge holds two' },
  ];
  C.doctor = function (n, p) {
    const h = hero();
    const b = C.body(h);
    const organs = (Storage.resources && Storage.resources.organ) || 0;
    const spent = CH.Skills && CH.Skills.spent ? CH.Skills.spent(h) : 0;
    const surgery = 50 * h.level;
    const choices = C.UPGRADES.map((u) => {
      const r = b[u.id] || 0;
      if (r >= u.max) return { label: u.name + ' (DONE)', fn: () => {} };
      return { label: u.name + ' ' + (r + 1) + ': ' + u.gold(r) + 'g + ' + u.organs(r) + ' ORGANS', fn: () => {
        if (organs < u.organs(r)) { Audio.sfx('nope'); G.ui.toast('BRING ME ' + u.organs(r) + ' STRANGE ORGANS'); return; }
        if (!pay(u.gold(r))) return;
        Storage.resources.organ -= u.organs(r);
        b[u.id] = r + 1;
        CH.Upgrades.recalc(h);
        n.busyT = 3;
        FX.text(h.x, h.y - 30, u.name + ' ' + (r + 1), '#63c74d', 2);
        save();
      } };
    });
    choices.push(spent > 0 ? { label: 'SURGERY: RESET SKILLS (' + surgery + ')', fn: () => {
      if (!pay(surgery)) return;
      h.sp = (h.sp || 0) + spent;
      h.skills = {};
      CH.Upgrades.recalc(h);
      G.ui.toast('SKILL POINTS RETURNED: ' + spent);
      save();
    } } : { label: 'NO SURGERY NEEDED', fn: () => {} });
    choices.push({ label: 'LEAVE', fn: () => {} });
    say(n, p, [U.pick(['Strange organs. From the secret places. Bring me those and I will make you... more.', 'I have a degree. It is written on a tombstone, but it counts.', 'Hold this. No, the other kidney.']), 'Organs in your pack: ' + organs + '.'], choices);
  };

  /* Jesus: a tithe for a blessing that lasts three areas */
  C.BLESS = [
    { id: 'wrath', name: 'RIGHTEOUS WRATH', desc: '+20% damage' },
    { id: 'grace', name: 'GRACE', desc: '+25% health' },
    { id: 'plenty', name: 'LOAVES AND FISHES', desc: '+30% gold' },
    { id: 'eye', name: 'ALL-SEEING', desc: '+10% crit chance' },
  ];
  C.jesus = function (n, p) {
    const h = hero();
    const tithe = 60 + 20 * h.level;
    const cur = h.bless && h.bless.left > 0 ? C.BLESS.find((b) => b.id === h.bless.id) : null;
    const lines = [U.pick(['Peace be with you. Wipe your boots, I just did a miracle on this floor.', 'I came back once. You keep coming back every five minutes. Show-off.', 'Blessed are the meek. You, however, are carrying a rocket launcher.']),
      cur ? 'You carry ' + cur.name + ' for ' + h.bless.left + ' more area' + (h.bless.left > 1 ? 's' : '') + '.' : 'A tithe of ' + tithe + ' gold and I will walk with you for three areas.'];
    const choices = cur ? [] : C.BLESS.map((b) => ({ label: b.name + ': ' + b.desc, fn: () => {
      if (!pay(tithe)) return;
      for (const q of G.players) { q.bless = { id: b.id, left: 3 }; CH.Upgrades.recalc(q); }
      n.busyT = 3;
      FX.ring(h.x, h.y, 6, 60, '#fee761', 0.7);
      FX.text(h.x, h.y - 30, b.name, '#fee761', 2);
      save();
    } }));
    choices.push({ label: 'LIFT MY CURSES', fn: () => say(n, p, ['Nothing cursed on you. Yet. Stay away from the house with the purple door.'], [{ label: 'OK', fn: () => {} }]) });
    choices.push({ label: 'LEAVE', fn: () => {} });
    say(n, p, lines, choices);
  };
  Town.talkTo = Object.assign(Town.talkTo || {}, { nurse: C.nurse, doctor: C.doctor, jesus: C.jesus });

  /* ------------------------------------------------------------------ their corners of the hideout */
  const prevBuild = Town.build;
  Town.build = function () {
    const L = prevBuild.call(Town);
    if (!L.hideout || !CH.SetPieces) return L;
    const Dr = CH.SetPieces.Dresser(L, 'backyard');
    for (const n of L.npcs) Dr.reserve(n.px, n.py + 6, 24);
    const at = (id) => L.npcs.find((q) => q.id === id);
    const nu = at('nurse'), dr = at('doctor'), je = at('jesus');
    if (nu && dr) { // the clinic: two beds, a table of jars, a lantern
      Dr.put(Dr.key('bed', 'h'), nu.px - 40, nu.py - 18);
      Dr.put(Dr.key('bed', 'h'), dr.px + 40, dr.py - 18);
      Dr.put(Dr.key('table', 'h'), (nu.px + dr.px) / 2, nu.py - 30);
      Dr.near(Dr.key('item', 'h'), (nu.px + dr.px) / 2, nu.py - 40, 8);
      Dr.put(Dr.key('lantern', 'c') || Dr.key('lantern'), nu.px - 60, nu.py + 10);
    }
    if (je) { // a little shrine: a cross stone, candles, a bench for the weary
      Dr.put('kit.cf19.19', je.px + 34, je.py - 12, { force: true });
      for (const dx of [-30, -18, 22]) Dr.put(Dr.key('candles', 'c') || Dr.key('candles'), je.px + dx, je.py + 18);
      Dr.put(Dr.key('bench', 'c') || Dr.key('bench'), je.px - 40, je.py - 16, { force: true });
      Dr.put(Dr.key('flower', 'c') || Dr.key('flower'), je.px + 50, je.py + 20);
      Dr.near(Dr.key('lantern', 'c') || Dr.key('lantern'), je.px - 54, je.py + 8, 12);
    }
    // they block like the others
    for (const n of [nu, dr, je]) if (n && !L.props.some((p) => p.npc === n.id)) {
      CH.Arenas.addProp(L.props, 'missing', n.px, n.py + 8, { solid: true, box: { hw: 8, hh: 5 }, cy: 0, kind: 'npc' });
      const p = L.props[L.props.length - 1];
      p.invisible = true;
      p.npc = n.id;
    }
    CH.Props.invalidate();
    return L;
  };
})(window.CH);
