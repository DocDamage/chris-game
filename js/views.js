/* CHAOS.exe - cameras and viewports. One player: one camera. Two players: while they are close the party shares a
   single screen centred between them; when they drift apart the screen splits into two views (left / right, each
   following one hero) and merges again when they come back together. The change is animated: the divider slides in
   from one edge, so nothing pops.

   Each view is {x, w, cam, player}: a vertical slice of the 480x270 canvas. The world is drawn as if the full canvas
   showed it, centred on the slice, then clipped to the slice. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const G = CH.G;
  const W = B.view.w;
  const H = B.view.h;

  /* how far apart (px) two heroes can be before the shared screen splits, and how close before it merges again */
  const SPLIT_AT = { x: 300, y: 172 };
  const MERGE_AT = { x: 236, y: 128 };
  const MERGE_DWELL = 0.35; // seconds of being close before merging, so the split does not flicker

  G.vcam = [{ x: 0, y: 0 }, { x: 0, y: 0 }]; // per-slot camera CENTRES (world px) used while split
  G.views = [];
  G.mergeT = 0;

  const clampCam = (c) => {
    c.x = U.clamp(c.x, 0, Math.max(0, G.arena.w - W));
    c.y = U.clamp(c.y, 0, Math.max(0, G.arena.h - H));
  };
  const centreOn = (c, x, y) => {
    c.x = x - W / 2;
    c.y = y - H / 2;
    clampCam(c);
  };
  const ease = (c, tx, ty, k) => {
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * k;
    clampCam(c);
  };
  const easeRaw = (c, tx, ty, k) => {
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * k;
  };

  /* jump every camera straight to its target (new run, new arena) */
  G.snapCamera = function () {
    const mid = G.partyCenter();
    centreOn(G.cam, mid.x, mid.y);
    G.vcam.forEach((c, i) => {
      const p = G.players[G.viewOrder[i]] || G.player;
      c.x = p.x;
      c.y = p.y;
    });
    G.groups = null;
    G.splitT = 0;
    G.mergeT = 0;
    G.viewMode = G.coop ? 'merged' : 'single';
    G.buildViews();
  };

  G.buildViews = function () {
    const views = [];
    const sp = G.splitT;
    if (!G.coop || sp < 0.002 || !G.groups) {
      views.push({ x: 0, w: W, off: 0, cam: G.cam, player: G.coop ? null : G.player, players: G.players });
    } else {
      const lw = Math.round(W * (1 - 0.5 * sp));
      views.push(sliceView(0, lw, G.vcam[0], G.players[G.viewOrder[0]], G.groups[0]));
      if (W - lw >= 2) views.push(sliceView(lw, W - lw, G.vcam[1], G.players[G.viewOrder[1]], G.groups[1]));
    }
    G.views = views;
    return views;
  };

  /* a slice of the canvas [x, x+w) centred on world point c. The world is drawn through a full-size window (cam) that
     is slid sideways by "off" so the slice never shows anything outside the arena, even at the edges. */
  function sliceView(x, w, c, player, players) {
    const cx = U.clamp(c.x, w / 2, Math.max(w / 2, G.arena.w - w / 2));
    const cy = U.clamp(c.y, H / 2, Math.max(H / 2, G.arena.h - H / 2));
    const cam = { x: U.clamp(cx - W / 2, 0, Math.max(0, G.arena.w - W)), y: U.clamp(cy - H / 2, 0, Math.max(0, G.arena.h - H)) };
    const off = x + w / 2 - (cx - cam.x);
    return { x, w, off, cam, player, players };
  }

  /* on-screen position of every hero (logical canvas px), used for mouse aim and HUD anchors */
  function placeHeroes() {
    if (!G.coop) {
      const p = G.player;
      p.sx = p.x - G.cam.x;
      p.sy = p.y - G.cam.y;
      return;
    }
    if (G.views.length === 1) {
      for (const p of G.players) {
        p.sx = p.x - G.cam.x;
        p.sy = p.y - G.cam.y;
      }
      return;
    }
    // each hero is placed in the view of its group; downed heroes go to the nearer camera
    for (const p of G.players) {
      let vi = G.groups.findIndex((l) => l.includes(p));
      if (vi < 0) vi = Math.abs(p.x - G.vcam[0].x) <= Math.abs(p.x - G.vcam[1].x) ? 0 : 1;
      const v = G.views[vi];
      if (!v) {
        p.sx = p.x - G.cam.x;
        p.sy = p.y - G.cam.y;
        continue;
      }
      p.sx = v.off + (p.x - v.cam.x);
      p.sy = p.y - v.cam.y;
    }
  }

  G.screenPos = (p) => ({ x: p.sx, y: p.sy });

  G.updateCamera = function (dt) {
    const k = Math.min(1, 9 * dt);
    if (G.cam.shakeT > 0) G.cam.shakeT -= dt;

    if (!G.coop) {
      const p = G.player;
      const m = CH.Input.mouse;
      // the mouse nudges the camera toward what you are aiming at; a stick-aimed hero stays centred
      const bias = p.inp && p.inp.kind === 'pad' ? 0 : 0.16;
      ease(G.cam, p.x - W / 2 + (m.x - W / 2) * bias, p.y - H / 2 + (m.y - H / 2) * bias, k);
      G.viewMode = 'single';
      G.buildViews();
      placeHeroes();
      return;
    }

    const alive = G.alivePlayers();
    const mid = G.partyCenter();

    // ---- decide: shared screen or split (the bounding box of the living party decides, so 3-4 heroes work too) ----
    let wantSplit = false;
    if (alive.length >= 2) {
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const p of alive) {
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y);
        y1 = Math.max(y1, p.y);
      }
      const lim = G.viewMode === 'split' ? MERGE_AT : SPLIT_AT;
      const far = x1 - x0 > lim.x || y1 - y0 > lim.y;
      if (G.viewMode === 'split') {
        wantSplit = far || G.mergeT < MERGE_DWELL;
        G.mergeT = far ? 0 : G.mergeT + dt;
      } else wantSplit = far;
    }
    if (alive.length >= 2) {
      // the party divides at its widest horizontal gap: the left group takes the left half. Once split, the
      // groups stay as they are (a hero crossing over keeps their screen) until the screens merge again.
      let kept = null;
      if (G.viewMode === 'split' && G.groups) {
        kept = G.groups.map((l) => l.filter((p) => alive.includes(p)));
        for (const p of alive) {
          if (kept.some((l) => l.includes(p))) continue;
          const c = kept.map((l) => (l.length ? l.reduce((s, q) => s + q.x, 0) / l.length : p.x));
          kept[Math.abs(p.x - c[0]) <= Math.abs(p.x - c[1]) ? 0 : 1].push(p);
        }
        if (!kept[0].length || !kept[1].length) kept = null;
      }
      if (kept) G.groups = kept;
      else {
        const sorted = alive.slice().sort((p, q) => p.x - q.x);
        let cut = 1;
        let best = -1;
        for (let i = 1; i < sorted.length; i++) {
          const gap = sorted[i].x - sorted[i - 1].x;
          if (gap > best) {
            best = gap;
            cut = i;
          }
        }
        G.groups = [sorted.slice(0, cut), sorted.slice(cut)];
      }
      G.viewOrder = G.groups.map((l) => l.reduce((m, p) => (p.idx < m ? p.idx : m), 99));
    }
    if (wantSplit && G.viewMode !== 'split') {
      for (const c of G.vcam) {
        c.x = G.cam.x + W / 2;
        c.y = G.cam.y + H / 2;
      }
      G.mergeT = 0;
      G.viewMode = 'split';
    } else if (!wantSplit && G.viewMode === 'split') {
      G.viewMode = 'merged';
    }

    // ---- animate the divider ----
    const target = G.viewMode === 'split' ? 1 : 0;
    const speed = 3.2;
    G.splitT = target > G.splitT ? Math.min(target, G.splitT + dt * speed) : Math.max(target, G.splitT - dt * speed);

    // ---- cameras ----
    ease(G.cam, mid.x - W / 2, mid.y - H / 2, k);
    if (G.splitT > 0.002 && G.groups) {
      G.vcam.forEach((c, i) => {
        const l = G.groups[i];
        const cx = l.reduce((s, p) => s + p.x, 0) / l.length;
        const cy = l.reduce((s, p) => s + p.y, 0) / l.length;
        const f = G.splitT;
        easeRaw(c, U.lerp(mid.x, cx, f), U.lerp(mid.y, cy, f), k);
      });
    } else {
      // fully merged again: the shared camera takes over from wherever the left camera ended up
      for (const c of G.vcam) {
        c.x = G.cam.x + W / 2;
        c.y = G.cam.y + H / 2;
      }
    }
    if (G.splitT < 0.002 && G.viewMode === 'merged') {
      G.viewOrder = [0, 1]; // shared screen: panels return to their home sides
      G.groups = null;
    }
    G.buildViews();
    placeHeroes();
  };

  /* shake offset shared by every view */
  G.shakeOffset = function () {
    const c = G.cam;
    if (c.shakeT <= 0) return { x: 0, y: 0 };
    const mag = c.shakeMag * (c.shakeT / c.shakeDur);
    return { x: (Math.random() * 2 - 1) * mag, y: (Math.random() * 2 - 1) * mag };
  };
})(window.CH);
