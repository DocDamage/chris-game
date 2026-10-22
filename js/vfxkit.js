/* CHAOS.exe - the attack VFX kit. Every hero, enemy and boss attack asks this module for its effects by
   meaning (a muzzle flash, a ground slam, a charge streak...) and an element (fire, earth, magic...), and the
   kit layers the right pre-baked animations from the VFX packs. Retuning an effect happens here only.

   Layer spec: [effect, {r: size as a multiple of the radius, fps, add: additive glow, rot: follow the aim angle,
   fwd: shift along the aim angle (px, scaled by radius), dy: vertical offset, a: alpha, d: delay seconds, flip}]
   The frame width on screen is about 2.2 x radius x r, which is how the packs' art is framed. */
(function (CH) {
  'use strict';
  const U = CH.U;
  const FX = CH.FX;

  const Kit = (CH.Kit = { count: 0, log: null });

  /* ---------------------------------------------------------------- element recipes */
  const L = (name, o) => [name, o || {}];

  const ELEM = {
    /* plain hits and slashes: yellow-white sparks */
    phys: {
      cast: [L('vfx.p5.19', { r: 0.9, fps: 16, add: 1 })],
      muzzle: [L('vfx.p5.15', { r: 1, fps: 34, add: 1, rot: 1, fwd: 0.6 })],
      hit: [L('vfx.p1.30', { r: 1, fps: 26 })],
      crit: [L('vfx.p5.28', { r: 1.1, fps: 26 }), L('vfx.p1.29', { r: 1.1, fps: 26, add: 1 })],
      slash: [L('vfx.p5.14', { r: 1.1, fps: 30, add: 1, rot: 1, fwd: 0.7 })],
      impact: [L('vfx.p1.22', { r: 1.05, fps: 22 }), L('vfx.p1.1', { r: 0.9, fps: 18, dy: 0.5 })],
      dash: [L('vfx.p7.13', { r: 1, fps: 30, add: 1, rot: 1, a: 0.85 })],
      trail: [L('vfx.p7.32', { r: 0.8, fps: 24, add: 1, a: 0.8 })],
    },
    fire: {
      cast: [L('vfx.p5.17', { r: 1.1, fps: 14, add: 1, dy: 0.3 }), L('vfx.p7.25', { r: 0.9, fps: 14, add: 1 })],
      muzzle: [L('vfx.p7.23', { r: 0.9, fps: 28, add: 1, rot: 1, fwd: 0.6 }), L('vfx.p5.15', { r: 0.7, fps: 34, add: 1, rot: 1, fwd: 0.4 })],
      hit: [L('vfx.p5.32', { r: 0.9, fps: 26 }), L('vfx.p1.22', { r: 0.8, fps: 24, add: 1 })],
      crit: [L('vfx.p1.27', { r: 1, fps: 24 }), L('vfx.p5.28', { r: 1, fps: 26 }), L('vfx.p2.1', { r: 1.1, fps: 24, add: 1 })],
      slash: [L('vfx.p5.14', { r: 1.1, fps: 30, add: 1, rot: 1, fwd: 0.7 }), L('vfx.p7.23', { r: 0.9, fps: 26, add: 1, rot: 1, fwd: 0.9, d: 0.04 })],
      impact: [L('vfx.p7.2', { r: 1.15, fps: 20 }), L('vfx.p7.29', { r: 0.85, fps: 20, dy: -0.15, add: 1, d: 0.05 }), L('vfx.p2.5', { r: 1.2, fps: 20, add: 1, d: 0.03 })],
      dash: [L('vfx.p5.17', { r: 0.9, fps: 20, add: 1, a: 0.9 })],
      trail: [L('vfx.p7.23', { r: 0.7, fps: 24, add: 1, a: 0.8 })],
    },
    ice: {
      cast: [L('vfx.p7.28', { r: 1, fps: 14, add: 1 }), L('vfx.p5.9', { r: 0.8, fps: 14, add: 1, a: 0.7 })],
      muzzle: [L('vfx.p5.1', { r: 0.9, fps: 30, add: 1, rot: 1, fwd: 0.5 })],
      hit: [L('vfx.p7.7', { r: 1, fps: 26, add: 1 }), L('vfx.p5.1', { r: 0.8, fps: 28, add: 1 })],
      crit: [L('vfx.p5.1', { r: 1.1, fps: 26, add: 1 }), L('vfx.p7.9', { r: 1, fps: 24, add: 1 }), L('vfx.p3.1', { r: 1.1, fps: 24, add: 1 })],
      slash: [L('vfx.p5.21', { r: 1.1, fps: 26, add: 1, rot: 1, fwd: 0.7 })],
      impact: [L('vfx.p7.5', { r: 1.1, fps: 24, dy: -0.2 }), L('vfx.p7.18', { r: 1.2, fps: 22, dy: 0.5, a: 0.9 }), L('vfx.p5.24', { r: 1, fps: 22, add: 1 }), L('vfx.p3.6', { r: 1.15, fps: 22, add: 1, d: 0.04 })],
      dash: [L('vfx.p7.1', { r: 1, fps: 26, add: 1, rot: 1, a: 0.85 })],
      trail: [L('vfx.p7.28', { r: 0.7, fps: 20, add: 1, a: 0.8 })],
    },
    /* poison / swamp (only green effect in the packs) */
    toxic: {
      cast: [L('vfx.p5.23', { r: 1, fps: 14, add: 1 })],
      muzzle: [L('vfx.p5.23', { r: 0.7, fps: 28, add: 1, rot: 1, fwd: 0.5 })],
      hit: [L('vfx.p5.23', { r: 0.8, fps: 24, add: 1 }), L('vfx.p1.7', { r: 0.8, fps: 22, a: 0.9 })],
      crit: [L('vfx.p5.23', { r: 1.1, fps: 24, add: 1 }), L('vfx.p1.22', { r: 0.9, fps: 24 })],
      slash: [L('vfx.p5.23', { r: 1.1, fps: 24, add: 1, rot: 1, fwd: 0.7 })],
      impact: [L('vfx.p5.23', { r: 1.2, fps: 18, add: 1 }), L('vfx.p1.7', { r: 1, fps: 16, a: 0.6, dy: 0.2, d: 0.03 })],
      dash: [L('vfx.p5.23', { r: 0.8, fps: 24, add: 1, a: 0.8 })],
      trail: [L('vfx.p5.23', { r: 0.55, fps: 20, add: 1, a: 0.8 })],
    },
    /* stone, dust, shockwaves */
    earth: {
      cast: [L('vfx.p1.19', { r: 1.1, fps: 16, dy: 0.7 }), L('vfx.p1.1', { r: 0.9, fps: 16, dy: 0.6 })],
      muzzle: [L('vfx.p1.18', { r: 0.8, fps: 24, rot: 1, fwd: 0.5 })],
      hit: [L('vfx.p1.18', { r: 0.9, fps: 24 }), L('vfx.p1.31', { r: 0.7, fps: 26 })],
      crit: [L('vfx.p1.22', { r: 1, fps: 24 }), L('vfx.p1.18', { r: 1, fps: 24 })],
      slash: [L('vfx.p5.14', { r: 1.1, fps: 30, add: 1, rot: 1, fwd: 0.7 })],
      impact: [L('vfx.p1.18', { r: 1, fps: 20 }), L('vfx.p5.30', { r: 1.1, fps: 20, a: 0.5, d: 0.02 }), L('vfx.p1.1', { r: 1, fps: 16, dy: 0.4, a: 0.9 }), L('vfx.p7.6', { r: 0.9, fps: 18, dy: 0.1, a: 0.7, d: 0.05 })],
      dash: [L('vfx.p1.1', { r: 0.8, fps: 18, dy: 0.7, a: 0.9 }), L('vfx.p1.14', { r: 0.8, fps: 20, dy: 0.8, rot: 1, a: 0.7 })],
      trail: [L('vfx.p1.8', { r: 0.7, fps: 18, a: 0.9 })],
    },
    /* lightning */
    bolt: {
      cast: [L('vfx.p7.22', { r: 1, fps: 14, add: 1 }), L('vfx.p7.11', { r: 1, fps: 18, add: 1 })],
      muzzle: [L('vfx.p7.11', { r: 1, fps: 26, add: 1, rot: 1, fwd: 0.5 })],
      hit: [L('vfx.p1.32', { r: 1, fps: 24, add: 1 }), L('vfx.p1.31', { r: 0.8, fps: 24 })],
      crit: [L('vfx.p5.28', { r: 1, fps: 26 }), L('vfx.p1.32', { r: 1, fps: 24, add: 1 }), L('vfx.p4.1', { r: 1.1, fps: 26, add: 1 })],
      slash: [L('vfx.p7.11', { r: 1.2, fps: 24, add: 1, rot: 1, fwd: 0.6 })],
      impact: [L('vfx.p7.30', { r: 1.1, fps: 22, dy: -0.45, add: 1 }), L('vfx.p7.33', { r: 1.0, fps: 24, dy: -0.5, add: 1, d: 0.05 }), L('vfx.p7.21', { r: 0.9, fps: 22, add: 1 }), L('vfx.p5.28', { r: 1, fps: 24, d: 0.03 }), L('vfx.p4.8', { r: 1.1, fps: 22, add: 1, d: 0.03 })],
      dash: [L('vfx.p7.10', { r: 0.9, fps: 24, add: 1, a: 0.9 })],
      trail: [L('vfx.p7.10', { r: 0.6, fps: 22, add: 1, a: 0.85 })],
    },
    /* machinery, lasers: cyan-blue */
    tech: {
      cast: [L('vfx.p7.26', { r: 1.1, fps: 14, add: 1 }), L('vfx.p5.8', { r: 0.9, fps: 14, add: 1, a: 0.8 })],
      muzzle: [L('vfx.p5.1', { r: 0.9, fps: 30, add: 1, rot: 1, fwd: 0.5 }), L('vfx.p7.26', { r: 0.6, fps: 26, add: 1, fwd: 0.4, rot: 1 })],
      hit: [L('vfx.p5.1', { r: 0.9, fps: 28, add: 1 }), L('vfx.p7.7', { r: 0.8, fps: 24, add: 1 })],
      crit: [L('vfx.p5.1', { r: 1.1, fps: 26, add: 1 }), L('vfx.p7.27', { r: 0.9, fps: 24, add: 1 })],
      slash: [L('vfx.p5.21', { r: 1.1, fps: 26, add: 1, rot: 1, fwd: 0.7 })],
      impact: [L('vfx.p7.27', { r: 1.1, fps: 22, add: 1, a: 0.9 }), L('vfx.p5.9', { r: 0.95, fps: 20, add: 1, a: 0.7, d: 0.03 }), L('vfx.p5.25', { r: 1.1, fps: 22, add: 1, a: 0.55, d: 0.04 })],
      dash: [L('vfx.p7.1', { r: 1, fps: 26, add: 1, rot: 1, a: 0.85 })],
      trail: [L('vfx.p7.28', { r: 0.65, fps: 22, add: 1, a: 0.85 })],
    },
    /* dark magic, necromancy, glitch: magenta / purple */
    magic: {
      cast: [L('vfx.p7.31', { r: 1.1, fps: 14, add: 1 }), L('vfx.p7.31', { r: 0.7, fps: 18, add: 1, d: 0.08 })],
      muzzle: [L('vfx.p7.31', { r: 0.9, fps: 26, add: 1, rot: 1, fwd: 0.4 })],
      hit: [L('vfx.p7.15', { r: 0.7, fps: 26, add: 1 }), L('vfx.p7.31', { r: 0.8, fps: 24, add: 1 })],
      crit: [L('vfx.p7.15', { r: 0.9, fps: 26, add: 1 }), L('vfx.p5.28', { r: 0.9, fps: 26 }), L('vfx.p6.1', { r: 1.1, fps: 26, add: 1 })],
      slash: [L('vfx.p7.17', { r: 1.1, fps: 24, add: 1, rot: 1, fwd: 0.7 })],
      impact: [L('vfx.p7.12', { r: 1.2, fps: 18, add: 1 }), L('vfx.p7.15', { r: 0.9, fps: 20, add: 1, d: 0.04 }), L('vfx.p7.17', { r: 1.1, fps: 18, add: 1, d: 0.08, a: 0.8 }), L('vfx.p6.7', { r: 1.2, fps: 20, add: 1, d: 0.04 })],
      dash: [L('vfx.p7.3', { r: 1.2, fps: 24, add: 1, rot: 1, a: 0.85 })],
      trail: [L('vfx.p7.31', { r: 0.5, fps: 20, add: 1, a: 0.8 })],
    },
    /* gusts, wings, speed */
    wind: {
      cast: [L('vfx.p7.1', { r: 1, fps: 16, add: 1, a: 0.8 }), L('vfx.p5.5', { r: 0.9, fps: 16, add: 1 })],
      muzzle: [L('vfx.p7.19', { r: 0.8, fps: 26, add: 1, rot: 1, fwd: 0.5 })],
      hit: [L('vfx.p7.19', { r: 0.9, fps: 24, add: 1 }), L('vfx.p1.12', { r: 0.8, fps: 24 })],
      crit: [L('vfx.p5.28', { r: 1, fps: 26 }), L('vfx.p7.20', { r: 1, fps: 24, add: 1 })],
      slash: [L('vfx.p5.22', { r: 1.1, fps: 26, add: 1, rot: 1, fwd: 0.6 }), L('vfx.p5.14', { r: 0.9, fps: 30, add: 1, rot: 1, fwd: 0.8, d: 0.03 })],
      impact: [L('vfx.p7.1', { r: 1.1, fps: 22, add: 1, a: 0.85 }), L('vfx.p1.12', { r: 1, fps: 20, dy: 0.5, d: 0.03 }), L('vfx.p5.26', { r: 1.05, fps: 22, a: 0.4, d: 0.04 })],
      dash: [L('vfx.p7.1', { r: 1, fps: 26, add: 1, rot: 1, a: 0.85 })],
      trail: [L('vfx.p7.19', { r: 0.6, fps: 20, add: 1, a: 0.7 })],
    },
    /* blinding light, holy */
    flash: {
      cast: [L('vfx.p7.22', { r: 1.1, fps: 12, add: 1 })],
      muzzle: [L('vfx.p7.22', { r: 0.9, fps: 26, add: 1 })],
      hit: [L('vfx.p1.5', { r: 1, fps: 24, add: 1 }), L('vfx.p7.21', { r: 0.7, fps: 24, add: 1 })],
      crit: [L('vfx.p5.28', { r: 1, fps: 26 }), L('vfx.p7.21', { r: 0.9, fps: 24, add: 1 })],
      slash: [L('vfx.p5.14', { r: 1.1, fps: 30, add: 1, rot: 1, fwd: 0.7 })],
      impact: [L('vfx.p7.21', { r: 1.1, fps: 20, add: 1 }), L('vfx.p5.26', { r: 1.2, fps: 22, add: 1, a: 0.9, d: 0.03 }), L('vfx.p5.29', { r: 1, fps: 22, add: 1, d: 0.05, a: 0.8 })],
      dash: [L('vfx.p7.13', { r: 1, fps: 30, add: 1, rot: 1, a: 0.85 })],
      trail: [L('vfx.p7.22', { r: 0.5, fps: 20, add: 1, a: 0.8 })],
    },
  };
  /* rubber chicken: feather puffs instead of sparks */
  ELEM.feather = Object.assign({}, ELEM.phys, {
    hit: [L('vfx.p1.7', { r: 1, fps: 24, a: 0.95 }), L('vfx.p1.30', { r: 0.8, fps: 26 })],
    crit: [L('vfx.p1.7', { r: 1.2, fps: 24 }), L('vfx.p5.28', { r: 1, fps: 26 })],
    muzzle: [L('vfx.p1.7', { r: 0.8, fps: 30, rot: 1, fwd: 0.5, a: 0.9 }), L('vfx.p5.15', { r: 0.7, fps: 34, add: 1, rot: 1, fwd: 0.5 })],
    trail: [L('vfx.p1.8', { r: 0.6, fps: 22, a: 0.8 })],
  });
  ELEM.glitch = ELEM.magic;
  ELEM.cheese = ELEM.fire;
  Kit.elements = ELEM;

  /* which element each family uses */
  Kit.byWeapon = { junk: 'phys', chicken: 'feather', pizza: 'fire', baguette: 'wind', chair: 'earth', problem: 'magic' };
  Kit.byTrail = { junk: 'phys', goo: 'phys', cheese: 'fire', fire: 'fire', ice: 'ice', confetti: 'magic' };
  Kit.byBoss = {
    ceo: 'bolt', frog: 'toxic', bd: 'earth', gol: 'tech', maw: 'magic', chicken: 'wind', bug: 'glitch',
    dragon: 'fire', beholder: 'magic', mage: 'ice', demon: 'fire', ooze: 'toxic',
    treant: 'earth', moss: 'earth', knight: 'phys', yeti: 'ice', daddy: 'bolt', skull: 'magic', dunewyrm: 'wind', bloodwyrm: 'magic', sporeeye: 'toxic', voideye: 'magic'
  };
  /* each hero's signature colour, layered over the weapon effects */
  Kit.byHero = { Mercenary: 'tech', Dreadbloom: 'toxic', Vexaria: 'magic' };
  Kit.byEnemy = {
    chicken: 'phys', potato: 'tech', trashcan: 'earth', office: 'phys', toaster: 'fire',
    influencer: 'flash', cart: 'earth', pigeon: 'magic', fridge: 'fire', intern: 'toxic',
    plant: 'toxic', slime: 'toxic', orc: 'phys', goblin: 'phys', spider: 'toxic', golem: 'earth'
  };

  /* ---------------------------------------------------------------- playback */
  function frameW(name) {
    const S = CH.Sprites;
    return S.has(name) ? S.get(name).w : 96;
  }

  /* the packs leave most of each frame empty, so every meaning is drawn larger than its radius suggests */
  const MUL = { cast: 1.6, muzzle: 1.5, hit: 1.5, slash: 1.4, impact: 1.9, dash: 1.5, trail: 1.5 };

  /* play layers at (x,y). R = radius the effect should cover, ang = aim angle for rot/fwd layers */
  function play(layers, x, y, R, ang, o, slot) {
    if (!CH.Art.on || !layers) return false;
    o = o || {};
    const reduced = CH.Storage.settings.reduced;
    const G = CH.G;
    let any = false;
    for (let i = 0; i < layers.length; i++) {
      if ((reduced || o.lite) && i > 0) break; // reduced effects / crowd hits: just the main layer
      const spec = layers[i];
      const name = spec[0];
      const s = spec[1];
      const w = 2.2 * R * (s.r || 1) * (o.size || 1) * (MUL[slot] || 1);
      const scale = Math.max(0.12, w / frameW(name));
      const fwd = (s.fwd || 0) * R;
      const px = x + (s.rot ? Math.cos(ang || 0) * fwd : 0);
      const py = y + (s.rot ? Math.sin(ang || 0) * fwd : 0) + (s.dy || 0) * R;
      const opts = { scale, fps: s.fps || 22, add: !!s.add, alpha: (s.a === undefined ? 1 : s.a) * (o.alpha === undefined ? 1 : o.alpha), rot: s.rot ? ang || 0 : 0, flip: !!o.flip };
      const fire = () => FX.vfx(name, px, py, opts);
      if (s.d && G && G.after) G.after(s.d, fire);
      else fire();
      any = true;
      Kit.count++;
      if (Kit.log) Kit.log.push(name);
    }
    return any;
  }
  Kit.play = play;

  const el = (e) => ELEM[e] || ELEM.phys;

  /* ---------------------------------------------------------------- meanings */
  /* charge-up glow while an attack winds up. k = size (radius px) */
  Kit.cast = (elem, x, y, R, o) => play(el(elem).cast, x, y, R || 14, 0, o, 'cast');
  /* flash at a barrel / hand when something is fired. Throttled so a fan of 5 shots shows one flash. */
  let muzzleT = 0;
  Kit.muzzle = (elem, x, y, ang, R, o) => {
    const now = CH.G ? CH.G.wall : 0;
    if (!(o && o.force) && now - muzzleT < 0.07 && now >= muzzleT) return false;
    muzzleT = now;
    return play(el(elem).muzzle, x, y, R || 8, ang, o, 'muzzle');
  };
  /* something landed on a body */
  Kit.hit = (elem, x, y, R, crit, o) => play(crit ? el(elem).crit : el(elem).hit, x, y, R || 10, 0, o, 'hit');
  /* a melee arc / claw swipe in front of the attacker */
  Kit.slash = (elem, x, y, ang, R, o) => play(el(elem).slash, x, y, R || 16, ang, o, 'slash');
  /* an area strike on the ground (slam, explosion, lightning drop) */
  Kit.impact = (elem, x, y, R, o) => play(el(elem).impact, x, y, R || 24, 0, o, 'impact');
  /* one puff of a speed streak / charge; call every ~0.06s while moving */
  Kit.dash = (elem, x, y, ang, R, o) => play(el(elem).dash, x, y, R || 12, ang, o, 'dash');
  Kit.trail = (elem, x, y, R, o) => play(el(elem).trail, x, y, R || 6, 0, o, 'trail');

  /* a line effect (beam, tongue lash, bolt of lightning) from (x,y) along ang for len px */
  Kit.beam = (elem, x, y, ang, len, w, o) => {
    if (!CH.Art.on) return false;
    const R = Math.max(10, (w || 12) * 1.1);
    play(el(elem).muzzle, x, y, R * 1.4, ang, { force: true });
    const step = Math.max(34, R * 3);
    const n = Math.min(14, Math.floor(len / step));
    for (let i = 1; i <= n; i++) {
      const d = i * step;
      const px = x + Math.cos(ang) * d;
      const py = y + Math.sin(ang) * d;
      const delay = i * 0.025;
      const run = () => play(el(elem).trail, px, py, R * 1.1, ang, o, 'trail');
      if (CH.G && CH.G.after) CH.G.after(delay, run);
      else run();
    }
    return true;
  };

  /* element a projectile carries */
  const PROBLEM_ELEM = { boom: 'fire', mega: 'fire', slow: 'ice', bounce: 'magic', direct: 'phys', decoy: 'magic' };
  Kit.projElem = (pr) => {
    if (pr.fx) return pr.fx;
    if (pr.kind && pr.kind.indexOf('problem_') === 0) return PROBLEM_ELEM[pr.kind.slice(8)] || 'magic';
    if (pr.owner === 'p') return Kit.byWeapon[pr.kind] || 'phys';
    return Kit.byTrail[pr.trail] || null;
  };

  /* hero signature flare layered over a weapon effect */
  Kit.heroElem = (p) => Kit.byHero[p.hero && p.hero.id] || 'tech';
  Kit.heroMuzzle = (p, x, y, ang) => Kit.muzzle(Kit.heroElem(p), x, y, ang, 7, { force: true, alpha: 0.9 });
  Kit.heroHit = (p, x, y, crit) => Kit.hit(Kit.heroElem(p), x, y, 9, crit, { alpha: 0.85 });

  /* element of whatever damaged the player: an enemy, a boss, a projectile or a zone */
  Kit.elemOf = (src) => {
    if (!src) return 'phys';
    if (src.fx) return src.fx;
    if (src.isBoss) return Kit.byBoss[src.kind] || 'magic';
    if (src.type && Kit.byEnemy[src.type]) return Kit.byEnemy[src.type];
    if (src.kind === 'lava' || src.kind === 'toast') return 'fire';
    if (src.kind === 'corrupt') return 'glitch';
    if (src.kind === 'beam') return 'tech';
    return 'phys';
  };

  /* ---------------------------------------------------------------- enemies */
  /* per-type attack recipes: what plays when the wind-up starts, at the strike, and each tick of a charge */
  const EN = {
    chicken: { wind: 'cast', act: 'slash', tick: null },
    potato: { wind: 'cast', act: 'hit', tick: 'trail' },
    trashcan: { wind: 'cast', act: 'impact', tick: null },
    office: { wind: 'cast', act: 'muzzle', tick: null },
    toaster: { wind: 'cast', act: 'dash', tick: 'dash' },
    influencer: { wind: 'cast', act: 'impact', tick: null },
    cart: { wind: 'cast', act: 'dash', tick: 'dash' },
    pigeon: { wind: 'cast', act: 'dash', tick: 'trail' },
    fridge: { wind: 'cast', act: 'muzzle', tick: null },
    intern: { wind: 'cast', act: 'hit', tick: null },
    plant: { wind: 'cast', act: 'muzzle', tick: null },
    slime: { wind: 'cast', act: 'dash', tick: 'trail' },
    orc: { wind: 'cast', act: 'slash', tick: 'dash' },
    goblin: { wind: 'cast', act: 'muzzle', tick: null },
    spider: { wind: 'cast', act: 'dash', tick: 'trail' },
    golem: { wind: 'cast', act: 'impact', tick: null },
  };

  const bodyY = (e) => e.y - Math.min(14, (e.h || 20) * 0.4);

  Kit.enemyWind = (e) => {
    const r = EN[e.type];
    if (!r || !r.wind) return;
    const elem = Kit.byEnemy[e.type];
    if (r.wind === 'cast') {
      // ground attacks gather dust at the feet, everything else glows at the body
      const R = Math.max(9, e.r * 1.3);
      play(el(elem).cast, e.x, e.type === 'trashcan' || e.type === 'cart' ? e.y + 2 : bodyY(e), R, 0, { size: e.type === 'trashcan' ? 1.8 : 1 });
    }
  };

  Kit.enemyAct = (e, ang) => {
    const r = EN[e.type];
    if (!r || !r.act) return;
    const elem = Kit.byEnemy[e.type];
    const toP = e.g && e.g.player ? Math.atan2(e.g.player.y - e.y, e.g.player.x - e.x) : 0;
    const a = ang !== undefined ? ang : r.act === 'muzzle' ? toP : e.lockAng || 0;
    const R = Math.max(8, e.r);
    switch (r.act) {
      case 'slash':
        Kit.slash(elem, e.x, bodyY(e), a, R * 1.5);
        break;
      case 'hit':
        Kit.hit(elem, e.x, bodyY(e), R * 1.4);
        break;
      case 'impact':
        Kit.impact(elem, e.x, e.y + 2, (e.type === 'trashcan' ? e.def.slamRadius : e.def.flashRange * 0.7) * 0.8);
        break;
      case 'muzzle':
        Kit.muzzle(elem, e.x, bodyY(e), a, R * 1.1, { force: true });
        break;
      case 'dash':
        Kit.dash(elem, e.x, bodyY(e) + 4, a + Math.PI, R * 1.4);
        break;
    }
  };

  /* called every frame of a charge; emits a puff roughly every 0.07 s */
  Kit.enemyTick = (e, dt, ang) => {
    const r = EN[e.type];
    if (!r || !r.tick) return;
    e.fxT = (e.fxT || 0) - dt;
    if (e.fxT > 0) return;
    e.fxT = 0.07;
    const elem = Kit.byEnemy[e.type];
    const a = ang !== undefined ? ang : e.lockAng || 0;
    if (r.tick === 'trail') Kit.trail(elem, e.x - Math.cos(a) * 4, bodyY(e) + 4, Math.max(6, e.r * 0.9));
    else Kit.dash(elem, e.x - Math.cos(a) * e.r, bodyY(e) + 6, a + Math.PI, Math.max(8, e.r * 1.2));
  };

  /* ---------------------------------------------------------------- bosses */
  Kit.bossR = (b) => Math.max(14, b.baseR * 0.9);
  Kit.bossBody = (b) => b.y - (b.look ? b.look.h * 0.35 : 20);
  Kit.bossWind = (b) => {
    const e = Kit.byBoss[b.kind];
    Kit.cast(e, b.x, Kit.bossBody(b), Kit.bossR(b) * 0.9);
  };
})(window.CH);
