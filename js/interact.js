/* CHAOS.exe - one interaction system (PLAN.md 20, requests 4 and 8). Everything a hero can use with the interact
   button (E, pad B) is a target: chests, gear on the ground, the stage's exit door, shrines, lit waypoints, the vending
   machine, the hideout's people, building doors, the way out of a room and the cult's purple door. The nearest one
   within its reach is the hero's focus: it gets a ring at its feet and a prompt above it ("[E] OPEN  CHEST"); the
   button uses it. A target with no action (a sealed exit) still shows why.
     a target: { x, y, r (reach), verb, name, color, top (px above the ground for the prompt), act(p) or null } */
(function (CH) {
  'use strict';
  const G = CH.G;
  const U = CH.U;
  const B = CH.Balance;
  const Font = CH.Font;
  const Audio = CH.Audio;

  const IX = (CH.Interact = { sources: [] });
  const legacy = G.interact; // machine, chests, people and waypoints as the older modules chained them (kept for anything unlisted)

  /* ------------------------------------------------------------------ what can be used */
  const seen = (L, x, y) => !L.explored || L.explored[L.idx(Math.floor(x / 32), Math.floor(y / 32))];
  IX.sources.push(function (p, add) {
    const L = G.level;
    if (!L) return;
    const R = CH.Run;
    if (L.isTown) {
      for (const n of L.npcs || []) add({ x: n.px, y: n.py, r: 44, verb: 'TALK', name: String(n.name || 'STRANGER').toUpperCase(), color: '#fee761', top: 40, act: (q) => CH.Town.talk(n, q) });
      if (L.cultDoor) add({ x: L.cultDoor.x, y: L.cultDoor.y - 8, r: 30, verb: 'ENTER', name: 'THE PURPLE DOOR', color: '#d58cff', top: 46, act: () => CH.Cult.enter() });
    }
    for (const c of L.chests || []) if (!c.opened && seen(L, c.x, c.y)) add({ x: c.x, y: c.y, r: 38, verb: 'OPEN', name: c.secret ? 'HIDDEN CHEST' : 'CHEST', color: '#fee761', top: 28, act: (q) => R.openChest(c, q) });
    for (const s of L.shrines || []) if (!s.used) add({ x: s.x, y: s.y, r: 34, verb: 'PRAY', name: R.shrineName(s), color: '#e9a0ff', top: 40, act: (q) => R.useShrine(s, q) });
    if (!L.isTown) for (const w of L.waypoints || []) if (w.active && CH.Town) add({ x: w.x, y: w.y, r: 36, verb: 'TRAVEL', name: 'WAYPOINT', color: '#9be08a', top: 34, act: (q) => CH.Town.waypointMenu(w, q) });
    if (G.machine && !L.isTown) add({ x: G.machine.x, y: G.machine.y, r: 36, verb: 'SHOP', name: G.machine.hidden ? 'SHOP' : 'VENDING MACHINE', color: '#68c2d3', top: 44, act: (q) => CH.Shop.useMachine(q) });
    // the exit door
    const ex = L.exit;
    if (ex && !L.isTown && !L.interior && seen(L, ex.x, ex.y)) {
      const WM = CH.WorldMap, world = WM && WM.on();
      const home = L.bossHall && world && L.stage >= WM.LAST;
      const next = world && !home ? WM.label(Math.min(WM.LAST, (L.stage || G.wave) + 1)) : home ? 'THE WAY HOME' : 'THE WAY ON';
      if (ex.tower && CH.Sky) { // the sky road ends at the Final Tower's maw
        if (ex.open) add({ x: ex.x, y: ex.y, r: 46, verb: 'ENTER', name: 'THE FINAL TOWER', color: '#ff6b7a', top: 60, act: () => CH.Sky.enterTower() });
        else add({ x: ex.x, y: ex.y, r: 46, verb: 'SEALED', name: 'CLOSE THE BREACHES', color: '#b9b4c8', top: 60, act: null });
      } else if (ex.open) add({ x: ex.x, y: ex.y, r: 40, verb: 'ENTER', name: next, color: '#fee761', top: 46, act: () => IX.leaveStage(home) });
      else if (!ex.tower) add({ x: ex.x, y: ex.y, r: 40, verb: 'SEALED', name: L.bossHall ? 'THE BOSS STILL LIVES' : 'CLOSE THE BREACHES', color: '#b9b4c8', top: 46, act: null });
    }
    // the landmark's lore stone (js/setpieces.js)
    for (const s of L.lore || []) add({ x: s.x, y: s.y, r: 34, verb: 'READ', name: s.name, color: '#e8c170', top: 30, act: (q) => IX.read(s, q) });
    // the sealed vaults behind doors in the dungeons' walls (js/walls.js, js/interiors.js)
    if (!L.interior && !L.isTown && CH.Walls && CH.Walls.plan && !L._wplan) CH.Walls.plan(L);
    for (const v of L.vaults || []) if (!L.interior && seen(L, v.x, v.y)) add({ x: v.x, y: v.y, r: 30, verb: 'ENTER', name: 'SEALED VAULT', color: '#e8c170', top: 40, act: () => CH.Interiors && CH.Interiors.enter(v) });
    // buildings you can walk into, and the way out of one
    if (L.interior && L.door) add({ x: L.door.x, y: L.door.y - 4, r: 30, verb: 'LEAVE', name: L.name ? String(L.name).toUpperCase() : 'OUTSIDE', color: '#fee761', top: 20, act: () => (CH.Interiors && CH.Interiors.outside ? CH.Interiors.leave() : CH.Cult && CH.Cult.leave && CH.Cult.leave()) });
    if (L.interior && !L.door && L.exit && CH.Cult && CH.Cult.leave) add({ x: L.exit.x, y: L.exit.y, r: 30, verb: 'LEAVE', name: 'THE HIDEOUT', color: '#fee761', top: 20, act: () => CH.Cult.leave() });
    if (!L.isTown && !L.interior && CH.Interiors) for (const b of L.props || []) {
      if (!b.enter || b.dead) continue;
      const d = b.door || { x: b.x, y: b.y + 4 };
      add({ x: d.x, y: d.y, r: 30, verb: 'ENTER', name: CH.Interiors.nameOf(b), color: '#fee761', top: 40, act: (q) => CH.Interiors.enter(b, q) });
    }
  });
  // gear on the ground
  IX.sources.push(function (p, add) {
    if (!CH.Items) return;
    const R = CH.Items.RARITY;
    for (const g of CH.Items.ground) if (g.z <= 0) add({ x: g.x, y: g.y, r: 30, verb: 'PICK UP', name: g.it.name || CH.Items.nameOf(g.it), color: (R[g.it.rarity] || {}).color || '#ffffff', top: 20, gear: g, act: (q) => CH.Items.pickUp(g, q) });
  });

  /* a landmark's lore: read once per area for a little experience and gold (the world remembers it was read) */
  IX.read = function (s, p) {
    const W = CH.Areas && CH.Areas.world();
    const st = W && G.level && W.areas[G.level.stage];
    const first = !s.read && !(st && st.lore);
    s.read = true;
    if (st) st.lore = 1;
    if (first) {
      CH.Upgrades.addXp(G, Math.round(CH.Balance.xp.need(p.level || 1) * 0.12), p);
      G.addCoins(Math.round(10 + 4 * G.tier()), s.x, s.y);
      CH.FX.text(s.x, s.y - 34, 'LORE DISCOVERED', '#e8c170', 1);
      Audio.sfx('levelup');
    } else Audio.sfx('page');
    if (CH.Dialogue) CH.Dialogue.say({ who: s.name, portrait: null, lines: s.lines.slice(), color: 0 });
  };
  /* an unread lore stone glows and sheds motes, so a landmark tells you there is something to read */
  CH.Hooks.world.push((ctx, cam) => {
    const L = G.level;
    if (!L || !L.lore) return;
    const W = CH.Areas && CH.Areas.world(), st = W && W.areas[L.stage];
    for (const s of L.lore) {
      if (s.read || (st && st.lore)) continue;
      const x = Math.round(s.x - cam.x), y = Math.round(s.y - cam.y);
      if (x < -40 || x > B.view.w + 40 || y < -60 || y > B.view.h + 40) continue;
      const t = G.wall + s.x * 0.01;
      const gr = ctx.createRadialGradient(x, y - 10, 1, x, y - 10, 24);
      gr.addColorStop(0, 'rgba(255,214,130,' + (0.26 + 0.1 * Math.sin(t * 3)) + ')');
      gr.addColorStop(1, 'rgba(255,214,130,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = gr;
      ctx.fillRect(x - 24, y - 34, 48, 48);
      ctx.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 4; k++) { const ph = (t * 0.6 + k * 0.25) % 1; ctx.globalAlpha = 1 - ph; ctx.fillStyle = '#ffe7a8'; ctx.fillRect(x - 8 + k * 5, Math.round(y - 6 - ph * 26), 1, 1); }
      ctx.globalAlpha = 1;
    }
  });

  /* the stage's exit: on to the next area, or, after the final boss, the victory */
  IX.leaveStage = function (home) {
    if (home) {
      G.won = true;
      G.victory();
      return;
    }
    CH.Run.complete();
  };

  /* ------------------------------------------------------------------ focus */
  /* the nearest usable target in reach of hero p (a target without an action only shows itself when nothing else does) */
  IX.find = function (p) {
    if (!p || p.dead || G.state !== 'playing') return null;
    let best = null, bd = Infinity, info = null, id = Infinity;
    const add = (t) => {
      const d = Math.hypot(p.x - t.x, p.y - t.y);
      if (d > t.r) return;
      if (t.act) { if (d < bd) { bd = d; best = t; } }
      else if (d < id) { id = d; info = t; }
    };
    for (const s of IX.sources) s(p, add);
    return best || info;
  };
  IX.focus = new Map(); // hero -> target, refreshed every frame
  IX.focusOf = (p) => IX.focus.get(p || G.player) && IX.focus.get(p || G.player).gear;

  G.canInteract = function (p) {
    const t = IX.find(p);
    return !!(t && t.act);
  };
  G.interact = function (who) {
    const p = who || G.player;
    if (!p || p.dead || G.state !== 'playing') return;
    const t = IX.find(p);
    if (!t) return legacy.call(G, who);
    if (!t.act) { Audio.sfx('nope'); FX().text(t.x, t.y - t.top - 4, t.name, '#e43b44', 1); return; }
    IX.used = (IX.used || 0) + 1;
    t.act(p);
  };
  const FX = () => CH.FX;

  G.on('step', function () {
    IX.focus.clear();
    if (G.state !== 'playing') return;
    for (const p of G.players) { const t = IX.find(p); if (t) IX.focus.set(p, t); }
  });

  /* ------------------------------------------------------------------ the prompt */
  const keyOf = (p) => {
    if (p && p.inp && p.inp.kind === 'pad') return 'B';
    const code = (CH.Storage.settings.keys || {}).interact || 'KeyE';
    return code.replace(/^Key/, '').replace(/^Digit/, '');
  };
  function prompt(ctx, cam, p, t) {
    const x = Math.round(t.x - cam.x), y = Math.round(t.y - cam.y);
    if (x < -40 || x > B.view.w + 40 || y < -60 || y > B.view.h + 40) return;
    const pulse = 0.5 + 0.5 * Math.sin(G.wall * 5);
    // a ring at its feet
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.3 * pulse;
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 13 + pulse * 2, 5 + pulse, 0, 0, U.TAU);
    ctx.stroke();
    ctx.restore();
    // the plate: [key] VERB on one line, the name under it
    const key = keyOf(p), verb = t.verb, name = t.name;
    const kw = Font.width(key, 1) + 4, vw = Font.width(verb, 1), nw = Font.width(name, 1);
    const top = t.act ? kw + 3 + vw : vw;
    const w = Math.max(top, nw) + 8, h = 19;
    const px = Math.round(x - w / 2), py = Math.round(y - t.top - h - Math.round(pulse));
    ctx.fillStyle = 'rgba(12,7,16,0.86)';
    ctx.fillRect(px, py, w, h);
    ctx.fillStyle = t.act ? '#8a6a3a' : '#4a4458';
    ctx.fillRect(px, py, w, 1);
    ctx.fillRect(px, py + h - 1, w, 1);
    ctx.fillRect(px, py, 1, h);
    ctx.fillRect(px + w - 1, py, 1, h);
    let lx = Math.round(x - top / 2);
    if (t.act) {
      ctx.fillStyle = '#e8d8b0';
      ctx.fillRect(lx, py + 2, kw, 8);
      ctx.fillStyle = '#1b1226';
      ctx.fillRect(lx + 1, py + 3, kw - 2, 6);
      Font.draw(ctx, key, lx + 2, py + 4, '#ffffff', 1, false, 'left');
      lx += kw + 3;
    }
    Font.draw(ctx, verb, lx, py + 4, t.act ? '#f4e4c0' : '#9a92a8', 1, false, 'left');
    Font.draw(ctx, name, x, py + 12, t.color, 1, false, 'center');
    // a little chevron pointing down at it
    ctx.fillStyle = t.color;
    ctx.fillRect(x - 2, py + h + 1, 5, 1);
    ctx.fillRect(x - 1, py + h + 2, 3, 1);
    ctx.fillRect(x, py + h + 3, 1, 1);
  }
  CH.Hooks.world.push((ctx, cam, v) => {
    if (G.state !== 'playing' && G.state !== 'paused') return;
    const shown = new Set();
    for (const p of (v && v.players) || G.players) {
      const t = IX.focus.get(p);
      if (!t || shown.has(t.x + ',' + t.y)) continue;
      shown.add(t.x + ',' + t.y);
      prompt(ctx, cam, p, t);
    }
  });
})(window.CH);
