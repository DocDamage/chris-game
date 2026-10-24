/* CHAOS.exe - feedback, readability and accessibility: damage numbers + DPS meter, off-screen attack arrows, low-HP warning,
   threat-coloured telegraphs, minimap, wave countdown/preview, pause build list, auto-fire / auto-aim, tutorial wave. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const G = CH.G;
  const Audio = CH.Audio;
  const Font = CH.Font;
  const X = CH.X;
  const M = CH.Meta;
  const wrap = X.wrap;
  const H = B.view.h;
  const opt = (k, dflt) => {
    const v = X.opts()[k];
    return v === undefined ? dflt : v;
  };
  const playing = () => G.state === 'playing' && !!G.run;

  /* ---- damage numbers toggle */
  wrap(FX, 'text', function (orig, x, y, str, color, scale) {
    if (/^\d+$/.test(String(str)) && !opt('dmgNums', true)) return;
    return orig.call(FX, x, y, str, color, scale);
  });

  /* ---- telegraph colours: yellow = dodge it, red = big / leave the area, orange = lingering hazard */
  X.telegraphColor = (z) => {
    const cb = opt('colorblind', false);
    if (z.lava) return cb ? '#ffffff' : '#feae34';
    const big = (z.r || 0) >= 70 || (z.w || 0) >= 48 || z.big;
    if (big) return cb ? '#ff4fd8' : '#e43b44';
    return cb ? '#3ccbe6' : '#fee761';
  };
  wrap(FX, 'circleOutline', function (orig, ctx, cx, cy, r, color) {
    if (color === '#ff8fb8') color = opt('colorblind', false) ? '#3ccbe6' : '#fee761';
    else if (color === '#e43b44' && opt('colorblind', false)) color = '#ff4fd8';
    return orig.call(FX, ctx, cx, cy, r, color);
  });

  /* ---- DPS meter + low-HP heartbeat (sampled every frame) */
  const hx = (X.hx = { log: [], dps: 0, beat: 0, tut: null, tutDone: false });
  G.on('step', function (dt) {
    if (!playing()) return;
    const log = hx.log;
    log.push([G.wall || 0, X.rs.dmg]);
    while (log.length > 2 && log[0][0] < (G.wall || 0) - 4) log.shift();
    const a = log[0];
    const b = log[log.length - 1];
    hx.dps = b[0] > a[0] ? Math.round((b[1] - a[1]) / (b[0] - a[0])) : 0;
    const low = G.players.some((p) => !p.dead && p.hp / p.maxHp < 0.3);
    if (low && opt('lowHp', true)) {
      hx.beat -= dt;
      if (hx.beat <= 0) {
        hx.beat = 0.95;
        Audio.sfx('heartbeat');
      }
    }
    tutorialStep(dt);
  });

  /* ---- screen overlays (run once per split-screen slice) */
  const edgeArrow = (ctx, v, cam, wx, wy, color, size) => {
    const cx = v.x + v.w / 2;
    const sx = v.off + (wx - cam.x);
    const sy = wy - cam.y;
    if (sx > v.x + 6 && sx < v.x + v.w - 6 && sy > 6 && sy < H - 6) return;
    const a = Math.atan2(sy - H / 2, sx - cx);
    const px = U.clamp(cx + Math.cos(a) * 600, v.x + 8, v.x + v.w - 8);
    const py = U.clamp(H / 2 + Math.sin(a) * 600, 8, H - 8);
    ctx.save();
    ctx.translate(Math.round(px), Math.round(py));
    ctx.rotate(a);
    ctx.fillStyle = '#1b1226';
    ctx.beginPath();
    ctx.moveTo(size + 2, 0);
    ctx.lineTo(-size, -size - 1);
    ctx.lineTo(-size, size + 1);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size + 2, -size + 1);
    ctx.lineTo(-size + 2, size - 1);
    ctx.fill();
    ctx.restore();
  };
  const enemyName = (t) => (B.enemies[t] && B.enemies[t].name) || t;

  CH.Hooks.screen.push((ctx, cam, v) => {
    if (!playing() || !v) return;
    const me = v.player || G.players[0];
    const cx = v.x + v.w / 2;
    const flash = Math.floor((G.wall || 0) * 8) % 2;

    // off-screen incoming attacks
    if (opt('offscreen', true) && G.state === 'playing') {
      const colWarn = opt('colorblind', false) ? '#3ccbe6' : '#fee761';
      const colHit = opt('colorblind', false) ? '#ff4fd8' : '#e43b44';
      for (const e of G.enemies) if (e.tele && !e.dead && !e.isBoss) edgeArrow(ctx, v, cam, e.x, e.y, flash ? colWarn : colHit, 4);
      let n = 0;
      for (const pr of G.projectiles) {
        if (pr.owner !== 'e' || pr.dead || n > 12) continue;
        const d = U.dist(pr.x, pr.y, me.x, me.y);
        if (d > 320) continue;
        const toward = (pr.vx || 0) * (me.x - pr.x) + (pr.vy || 0) * (me.y - pr.y) > 0;
        if (!toward) continue;
        n++;
        edgeArrow(ctx, v, cam, pr.x, pr.y, colHit, 3);
      }
    }

    // low-HP vignette
    if (opt('lowHp', true) && me && !me.dead && me.hp / me.maxHp < 0.3) {
      const k = 1 - me.hp / (me.maxHp * 0.3);
      const pulse = 0.5 + 0.5 * Math.sin((G.wall || 0) * 6.5);
      const g = ctx.createRadialGradient(cx, H / 2, 60, cx, H / 2, 260);
      g.addColorStop(0, 'rgba(228,59,68,0)');
      g.addColorStop(1, 'rgba(228,59,68,' + (0.25 + 0.3 * k + 0.12 * pulse).toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(v.x, 0, v.w, H);
    }

    // wave countdown + incoming preview
    if (G.waveState === 'intro' && G.queue) {
      const counts = {};
      let boss = null;
      for (const q of G.queue) {
        if (q.boss) boss = q.boss;
        else if (q.type) counts[q.type] = (counts[q.type] || 0) + 1;
      }
      const list = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 4);
      Font.draw(ctx, 'WAVE ' + G.wave + ' IN ' + Math.max(0, G.waveT).toFixed(1), cx, 62, '#ffffff', 1, true, 'center');
      let t = list.map((k) => counts[k] + ' ' + enemyName(k).toUpperCase()).join('   ');
      if (boss) t = 'BOSS: ' + ((B.bosses[boss] && B.bosses[boss].name) || boss).toUpperCase() + (t ? '   ' + t : '');
      if (t) Font.draw(ctx, t, cx, 72, '#b9b4c8', 1, true, 'center');
    }

    // minimap / radar
    if (opt('minimap', true) && G.level && G.state === 'playing') CH.Run.drawMinimap(ctx, v, cam);
    else if (opt('minimap', true) && G.arena && G.state === 'playing') {
      const mw = 72;
      const mh = Math.max(24, Math.round((mw * G.arena.h) / G.arena.w));
      const mx = v.x + v.w - mw - 6;
      const my = H - mh - 6;
      const sx = mw / G.arena.w;
      const sy = mh / G.arena.h;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#1b1226';
      ctx.fillRect(mx - 1, my - 1, mw + 2, mh + 2);
      ctx.fillStyle = '#2a2040';
      ctx.fillRect(mx, my, mw, mh);
      ctx.globalAlpha = 1;
      const dot = (x, y, c, s) => {
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(mx + x * sx - s / 2), Math.round(my + y * sy - s / 2), s, s);
      };
      for (const pk of G.pickups) {
        if (pk.dead || pk.type === 'xp') continue;
        dot(pk.x, pk.y, pk.type === 'coin' ? '#fee761' : '#3ccbe6', 1);
      }
      if (G.machine) dot(G.machine.x, G.machine.y, '#63c74d', 3);
      for (const e of G.enemies) {
        if (e.dead) continue;
        if (e.isBoss) dot(e.x, e.y, '#e43b44', 4);
        else if (e.isElite || e.affix || e.mini) dot(e.x, e.y, '#feae34', 3);
        else dot(e.x, e.y, '#8b3a3a', 1);
      }
      for (const p of G.players) dot(p.x, p.y, p.dead ? '#777777' : p.color, 3);
      const vx = mx + cam.x * sx;
      const vy = my + cam.y * sy;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.strokeRect(Math.round(vx) + 0.5, Math.round(vy) + 0.5, Math.round(v.w * sx), Math.round(H * sy));
    }

    // DPS meter
    if (opt('dpsMeter', false)) Font.draw(ctx, 'DPS ' + hx.dps, v.x + v.w - 6, 24, '#feae34', 1, true, 'right');

    // first-area hints
    if (hx.tut && !hx.tut.done) {
      const s = TUT[hx.tut.i];
      // just above the action bar, out of the way of the banners (PLAN.md 20)
      const hy = B.view.h - 60, tw = Font.width(s.text.toUpperCase(), 1) + 10;
      ctx.fillStyle = 'rgba(12,7,16,0.72)';
      ctx.fillRect(Math.round(cx - tw / 2), hy - 3, tw, 19);
      Font.draw(ctx, 'HINT ' + (hx.tut.i + 1) + '/' + TUT.length, cx, hy, '#fee761', 1, false, 'center');
      Font.draw(ctx, s.text, cx, hy + 8, '#ffffff', 1, false, 'center');
    }
  });

  /* ---- auto-fire / auto-aim */
  wrap(CH.Player.prototype, 'updateAim', function (orig, g, dt) {
    orig.call(this, g, dt);
    if (!opt('autoAim', false) || this.inp.src.kind === 'script' || this.dead) return;
    const e = X.nearestEnemy(this.x, this.y, 300);
    if (e) this.aim = Math.atan2(e.y - (this.y - 6), e.x - this.x);
  });
  G.on('playerUpdate', function (ev) {
    const p = ev.p, g = ev.g;
    if (p.fireT > 0 && hx.tut && !hx.tut.done) hx.tut.did.fire = true;
    if (p.vx || p.vy) hx.tut && (hx.tut.did.move = true);
    if (!opt('autoFire', false) || p.dead || p.rolling || g.state !== 'playing' || p.inp.src.kind === 'script') return;
    if (p.inp.fire1) return;
    if (X.nearestEnemy(p.x, p.y, 260)) CH.Weapons.tryFire(g, p, p.weapon);
  });

  /* ---- pause: current build list */
  const pause = document.getElementById('screen-pause');
  const hb = document.createElement('div');
  hb.id = 'hx-build';
  hb.className = 'hint';
  pause.appendChild(hb);
  wrap(CH.UI, 'showPause', function (orig) {
    const rows = [];
    for (const p of G.players) {
      const lines = X.buildLines(p);
      rows.push('<b>' + M.esc(p.name || 'P1') + '</b> - ' + M.esc(p.hero.name) + '<br>' + (lines.length ? lines.map(M.esc).join('<br>') : 'No upgrades yet'));
    }
    hb.innerHTML = '<b>YOUR BUILD</b><br>' + rows.join('<br><br>');
    return orig.call(CH.UI);
  });

  /* ---- first-area hints (PLAN.md 18, K0d: the tutorial wave went with the runs): a new character is shown one skill at
     a time until they have used them all, once per account (Extras > Options > Contextual tutorial tips turns it off) */
  const TUT = [
    { id: 'move', text: 'Move around with the movement keys / left stick' },
    { id: 'fire', text: 'Shoot an enemy: aim and hold fire' },
    { id: 'dodge', text: 'Dodge-roll (just before a hit lands for a PERFECT DODGE)' },
    { id: 'nade', text: 'Throw a grenade' },
    { id: 'special', text: 'Use your special ability (Q / button)' },
    { id: 'interact', text: 'Walk up to a chest and interact to open it' },
  ];
  const tutMark = (id) => {
    if (hx.tut && !hx.tut.done) hx.tut.did[id] = true;
  };
  wrap(CH.Player.prototype, 'startRoll', function (orig, ...a) {
    const r = orig.apply(this, a);
    if (this.rolling) tutMark('dodge');
    return r;
  });
  wrap(CH.Player.prototype, 'throwGadget', function (orig, g) {
    const n = this.nades;
    const r = orig.call(this, g);
    if (this.nades < n) tutMark('nade');
    return r;
  });
  wrap(CH.Player.prototype, 'special', function (orig, g) {
    const r = orig.call(this, g);
    if (this.cast) tutMark('special');
    return r;
  });
  wrap(G, 'interact', function (orig, who) {
    const r = orig.call(G, who);
    tutMark('interact');
    return r;
  });
  G.on('newRun', function () {
    hx.log.length = 0;
    hx.tut = CH.Storage.slot() && !M.data().tutDone && opt('tutorial', true) ? { i: 0, did: {}, done: false, t: 0 } : null;
  });
  function tutorialStep(dt) {
    const T = hx.tut;
    if (!T || T.done || G.state !== 'playing') return;
    while (T.i < TUT.length && T.did[TUT[T.i].id]) {
      T.i++;
      Audio.sfx('levelup');
    }
    if (T.i >= TUT.length) {
      T.done = true;
      M.data().tutDone = true;
      CH.Storage.save();
      G.ui.toast('THAT IS EVERYTHING. NOW GO BREAK THINGS.');
    }
  }
})(window.CH);
