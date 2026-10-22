/* CHAOS.exe - shared helpers. All modules hang off the global CH namespace
   (classic scripts, so the game runs straight from file:// with no server). */
window.CH = window.CH || {};
(function (CH) {
  'use strict';
  const U = (CH.U = {});

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  U.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.chance = (p) => Math.random() < p;
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  U.dist2 = (x1, y1, x2, y2) => (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  U.ang = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
  U.TAU = Math.PI * 2;

  /* shortest signed difference b - a, wrapped to [-PI, PI] */
  U.angDiff = (a, b) => {
    let d = (b - a) % U.TAU;
    if (d > Math.PI) d -= U.TAU;
    if (d < -Math.PI) d += U.TAU;
    return d;
  };
  U.turnToward = (cur, target, maxStep) => {
    const d = U.angDiff(cur, target);
    return Math.abs(d) <= maxStep ? target : cur + Math.sign(d) * maxStep;
  };

  U.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  };

  /* items: array, w: item => weight */
  U.weighted = (items, w) => {
    let total = 0;
    for (const it of items) total += Math.max(0, w(it));
    if (total <= 0) return items[0];
    let r = Math.random() * total;
    for (const it of items) {
      r -= Math.max(0, w(it));
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  };

  U.easeOut = (t) => 1 - (1 - t) * (1 - t);
  U.easeOutBack = (t) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };

  U.fmtTime = (sec) => {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  };
  U.fmtNum = (n) => Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  /* unit vector from angle */
  U.dir = (a) => ({ x: Math.cos(a), y: Math.sin(a) });

  /* deterministic RNG for daily runs */
  U.seeded = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* drawing hooks so add-on modules can paint into the world / the screen overlay */
  CH.Hooks = {
    world: [],
    screen: [],
    run(kind, a, b, c) {
      const list = CH.Hooks[kind];
      for (let i = 0; i < list.length; i++) {
        try {
          list[i](a, b, c);
        } catch (e) {
          if (CH.errors && CH.errors.length < 20) CH.errors.push(String(e && e.stack ? e.stack : e));
        }
      }
    },
  };
})(window.CH);
