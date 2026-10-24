/* CHAOS.exe - omens (PLAN.md 18, K10): the random chaos events, reworked. A character's stage may carry one omen (never
   the first stage, about two in five after it, chosen by the world seed), with a cause standing somewhere in the stage
   that you can find and break. Left alone the omen grows (every minute, up to three times); breaking its cause ends it
   and pays out, more the longer it grew. An ended omen stays ended in that area.
     BLOOD MOON     night; monsters hit harder and shrug off hits, and drop more gold   cause: the moon altar
     THE RITUAL     a circle in blood summons monsters, faster as it grows             cause: the chanting cultists
     BREACH SURGE   every breach breeds faster                                         cause: the surge crystal
     FROST WIND     a blizzard that slows everyone (the Frozen Kingdom)                cause: the rune pillar
     THE HAUNTING   ghosts slip through the walls                                      cause: the cursed coffin
     THE WARP       the old chaos returns: low gravity, exploding dead, big heads      cause: the warp stone
   With a character the old random chaos timer is off; without one (tests, arenas) it runs as before. */
(function (CH) {
  'use strict';
  const G = CH.G;
  const U = CH.U;
  const FX = CH.FX;
  const Audio = CH.Audio;
  const B = CH.Balance;
  const TS = CH.Level.TS;

  const O = (CH.Omens = { cur: null, chance: 0.4 });
  const world = () => (CH.Areas && CH.Areas.world()) || null;

  O.DEFS = {
    bloodmoon: { name: 'BLOOD MOON', text: 'The moon bleeds. Monsters are stronger and richer. Break the moon altar.', cause: ['kit.cf20.3', 'kit.cf19.9'], colour: '#e43b44' },
    ritual: { name: 'THE RITUAL', text: 'A circle in blood is calling monsters. Kill the chanting cultists.', cause: null, colour: '#b55088' },
    surge: { name: 'BREACH SURGE', text: 'The breaches breed faster. Break the surge crystal.', cause: ['kit.fk9.0', 'kit.fk9.3'], colour: '#3ccbe6' },
    frost: { name: 'FROST WIND', text: 'A wind off the glacier slows everything. Break the rune pillar.', cause: ['kit.fk19.7', 'kit.fk19.8'], colour: '#9fd8ef', only: ['frozen'] },
    haunting: { name: 'THE HAUNTING', text: 'Ghosts slip through the walls. Break the cursed coffin.', cause: ['kit.cf11.30', 'kit.cf10.38'], colour: '#a6b0bf', not: ['frozen'] },
    warp: { name: 'THE WARP', text: 'Reality is loose here. Break the warp stone.', cause: ['kit.hv12.19', 'kit.hv20.20'], colour: '#ff2bd6' },
  };

  /* which omen (if any) a stage of this world carries */
  O.pick = function (n, biome, seed) {
    if (n < 2) return null;
    const r = U.seeded(((seed || 0) + n * 7717) >>> 0);
    if (r() > O.chance) return null;
    const ids = Object.keys(O.DEFS).filter((id) => { const d = O.DEFS[id]; return (!d.only || d.only.includes(biome)) && (!d.not || !d.not.includes(biome)); });
    return ids[Math.floor(r() * ids.length)];
  };

  /* ------------------------------------------------------------------ the start: the cause in a room away from the way in */
  G.on('startWave', function (ev) {
    O.end(false);
    const W = world(), L = G.level;
    if (!W || !L || L.isTown || L.stage !== ev.n) return;
    const done = (W.omens = W.omens || {});
    if (done[ev.n]) return;
    const id = O.pick(ev.n, L.biome, W.seed);
    if (!id) return;
    O.begin(id, L);
  });
  O.begin = function (id, L) {
    const d = O.DEFS[id];
    const rooms = L.rooms.filter((rm) => rm.tag !== 'start' && rm.tag !== 'exit').sort((a, b) => U.dist(b.cx, b.cy, L.entrance.x, L.entrance.y) - U.dist(a.cx, a.cy, L.entrance.x, L.entrance.y));
    const rm = rooms[Math.floor(rooms.length / 2)] || L.rooms[0];
    const at = L.randomNear(rm.cx, rm.cy, 0, 90, 26) || L.nearestOpen(rm.cx, rm.cy);
    const o = { id, def: d, t: 0, grow: 0, x: at.x, y: at.y, stage: L.stage, cause: null, chanters: null, spawnT: 6 };
    if (id === 'ritual') { // a circle and three chanting cultists round it
      const circle = CH.Props && CH.Props.pool('decal', 'c').find((k) => /^kit\.cf12\.[0-8]$/.test(k));
      if (circle && CH.Assets.images[circle]) L.decals.push({ key: circle, x: Math.round(at.x), y: Math.round(at.y), a: 0.95 }), L.chunks.clear();
      o.chanters = [];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * 6.283;
        const e = G.spawnEnemy('influencer', at.x + Math.cos(a) * 40, at.y + Math.sin(a) * 28, { elite: true });
        if (e) { e.chanter = true; o.chanters.push(e); }
      }
    } else {
      const key = d.cause.find((k) => CH.Assets.images[k]);
      const name = key && CH.Sheets ? CH.Sheets.sprite(key) : 'missing';
      CH.Arenas.addProp(L.props, name, at.x, at.y, { solid: true, cr: 14, cy: -3, destructible: true, hp: 220 + 40 * L.stage, resourceType: 'stone', resourceAmt: 3 });
      o.cause = L.props[L.props.length - 1];
      o.cause.omen = id;
      o.cause.sp = true;
      CH.Props.invalidate();
    }
    O.cur = o;
    O.apply(o, true);
    // (the banner says it; no toast on top of it)
    G.banner('OMEN: ' + d.name, d.text, 3.2);
    Audio.sfx('glitch');
  };
  /* the omen's lasting effects (and their undoing) */
  O.apply = function (o, on) {
    const A = CH.Atmos;
    if (o.id === 'bloodmoon' && A) { if (on) { A.clock = 0.92; A.setMode('bloodrain'); } else { A.clock = 0.35; A.setMode('clear'); } A.dark = A.darkness ? A.darkness(A.clock) : A.dark; }
    if (o.id === 'frost' && A) A.setMode(on ? 'blizzard' : 'snow');
    if (o.id === 'warp') { G.mods.lowGrav = on; G.mods.kbMul = on ? 2.6 : 1; G.mods.explosiveDeaths = on; G.mods.bigHead = on; }
    for (const p of G.players) CH.Upgrades.recalc(p);
  };
  /* ended: by breaking its cause (natural = true pays) or by leaving the stage */
  O.end = function (natural) {
    const o = O.cur;
    if (!o) return;
    O.cur = null;
    O.apply(o, false);
    if (!natural) return;
    const W = world();
    if (W) (W.omens = W.omens || {})[o.stage] = true;
    const x = o.x, y = o.y;
    G.addCoins(Math.round((40 + 10 * o.stage) * (1 + o.grow)), x, y);
    for (let i = 0; i < 4 + o.grow * 2; i++) G.dropPickup('coin', x + U.rand(-24, 24), y + U.rand(-24, 24), 3, {});
    for (let i = 0; i < 2; i++) CH.PowerUps.dropCurio(G, x + U.rand(-20, 20), y + U.rand(-20, 20));
    if (G.dropLoot) G.dropLoot({ x, y, type: 'chicken', isElite: true, def: B.enemies.chicken }, G.player);
    FX.ring(x, y, 6, 110, o.def.colour, 0.8);
    G.banner('OMEN BROKEN', o.def.name + (o.grow ? ' (grown ' + o.grow + 'x): a bigger reward' : ''), 2.4);
    Audio.sfx('boss_defeated');
    if (CH.Character) CH.Character.save();
  };

  /* ------------------------------------------------------------------ every step: growth, effects, the end */
  G.on('step', function (dt) {
    const o = O.cur;
    if (!o || G.state !== 'playing') return;
    const L = G.level;
    if (!L || L.isTown || L.stage !== o.stage) return;
    o.t += dt;
    const g = Math.min(3, Math.floor(o.t / 60));
    if (g > o.grow) { o.grow = g; G.ui.toast(o.def.name + ' GROWS (' + g + '/3)'); Audio.sfx('glitch'); }
    if (o.cause && (o.cause.dead || !L.props.includes(o.cause))) return O.end(true);
    if (o.chanters && o.chanters.every((e) => e.dead)) return O.end(true);
    o.spawnT -= dt;
    if (o.id === 'ritual' && o.spawnT <= 0) {
      o.spawnT = 12 - o.grow * 2.5;
      const mobs = CH.LevelGen.MOBS[L.biome] || ['slime'];
      for (let i = 0; i < 2 + o.grow; i++) { const q = L.randomNear(o.x, o.y, 30, 80, 14); if (q) G.spawnEnemy(U.pick(mobs), q.x, q.y, {}); }
      FX.ring(o.x, o.y, 5, 70, '#b55088', 0.6);
    }
    if (o.id === 'haunting' && o.spawnT <= 0) {
      o.spawnT = 15 - o.grow * 3;
      const p = G.randomAlivePlayer();
      for (let i = 0; i < 2 + o.grow; i++) { const a = Math.random() * 6.283; const q = L.nearestOpen(p.x + Math.cos(a) * 180, p.y + Math.sin(a) * 140); G.spawnEnemy('potato', q.x, q.y, {}); }
    }
  });
  /* blood moon: monsters hit harder and take less; surge: breaches breed faster */
  G.on('hurtPlayer:before', function (ev) {
    const o = O.cur;
    if (o && o.id === 'bloodmoon' && ev.dmg) ev.dmg *= 1.2 + 0.1 * o.grow;
  });
  G.on('damageEnemy:before', function (ev) {
    const o = O.cur;
    if (o && o.id === 'bloodmoon' && ev.dmg && !(ev.e && ev.e.isBoss)) ev.dmg *= 0.85 - 0.05 * o.grow;
  });
  G.on('kill', function (e) {
    const o = O.cur;
    if (o && o.id === 'bloodmoon' && !e.isSpawner && Math.random() < 0.35) G.dropPickup('coin', e.x, e.y, 3, {});
  });
  O.breedRate = () => (O.cur && O.cur.id === 'surge' ? 1.8 + 0.4 * O.cur.grow : 1);
  G.on('newRun:before', function () { O.end(false); });

  /* ------------------------------------------------------------------ the omen line under the stage */
  CH.Hooks.screen.push((ctx) => {
    const o = O.cur;
    if (!o || G.state === 'menu' || !G.level || G.level.isTown) return;
    const s = 'OMEN: ' + o.def.name + (o.grow ? '  ' + '!'.repeat(o.grow) : ''), w = CH.Font.width(s, 1) + 10;
    ctx.fillStyle = 'rgba(12,7,16,0.7)';
    ctx.fillRect(Math.round(B.view.w / 2 - w / 2), 16, w, 10); // top centre, on a dark strip (PLAN.md 20)
    CH.Font.draw(ctx, s, B.view.w / 2, 18, o.def.colour, 1, false, 'center');
  });
  /* the cause glows so it can be found */
  CH.Hooks.world.push((ctx, cam) => {
    const o = O.cur;
    if (!o || (!o.cause && !o.chanters)) return;
    const x = Math.round(o.x - cam.x), y = Math.round(o.y - cam.y);
    const r = 26 + Math.sin((G.time || 0) * 3) * 3;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = o.def.colour;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.45, 0, 0, 6.283); ctx.fill();
    ctx.restore();
  });
})(window.CH);
