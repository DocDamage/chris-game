/* CHAOS.exe - all canvas drawing for gameplay. Draw order: floor -> hazards -> pickups -> y-sorted
   entities -> projectiles -> particles -> text -> screen overlays -> crosshair. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const G = CH.G;
  const Input = CH.Input;
  const Font = CH.Font;

  const W = B.view.w;
  const H = B.view.h;

  // pre-rendered screen vignettes
  let vignette = null;
  let redVignette = null;
  function makeVignette(rgb, inner, a) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(W / 2, H / 2, H * inner, W / 2, H / 2, H * 0.95);
    grd.addColorStop(0, `rgba(${rgb},0)`);
    grd.addColorStop(1, `rgba(${rgb},${a})`);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    return c;
  }

  const drawList = [];

  /* ---------------------------------------------------------------- zones */
  function drawZone(ctx, z, cam, top) {
    const x = z.x - cam.x;
    const y = z.y - cam.y;
    const isTop = z.kind === 'beam' || (z.kind === 'warn' && z.shape === 'line');
    if (isTop !== top) return;
    const t = G.wall;
    switch (z.kind) {
      case 'warn': {
        const prog = 1 - z.life / z.T;
        const col = CH.X && CH.X.telegraphColor ? CH.X.telegraphColor(z) : z.lava ? '#feae34' : '#e43b44';
        if (z.shape === 'line') {
          ctx.save();
          ctx.translate(Math.round(x), Math.round(y));
          ctx.rotate(z.ang);
          ctx.globalAlpha = 0.1 + 0.3 * prog;
          ctx.fillStyle = col;
          ctx.fillRect(0, -z.w / 2, z.len, z.w);
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = Math.floor(t * 14) % 2 ? '#ffffff' : col;
          ctx.fillRect(0, -z.w / 2, z.len, 1);
          ctx.fillRect(0, z.w / 2 - 1, z.len, 1);
          ctx.restore();
          ctx.globalAlpha = 1;
        } else {
          if (z.r > 0) {
            ctx.globalAlpha = 0.1 + 0.3 * prog;
            FX.circleFill(ctx, x, y, z.r, col);
            ctx.globalAlpha = 1;
            FX.circleOutline(ctx, x, y, z.r, Math.floor(t * 12) % 2 ? '#ffffff' : col);
            FX.circleOutline(ctx, x, y, z.r * (1 - prog), col);
          }
          if (z.fall && z.sprite) {
            const fy = y - 90 * (1 - prog) * (1 - prog);
            CH.Sprites.draw(ctx, z.sprite, x, fy - 6, { rot: prog * 9, alpha: Math.min(1, prog * 2) });
          }
        }
        break;
      }
      case 'toast': {
        const a = Math.min(1, z.life / 0.6);
        ctx.globalAlpha = 0.55 * a;
        FX.circleFill(ctx, x, y, z.r, '#3a2418');
        if (CH.Art.on && CH.Sprites.has('vfx.p7.23')) {
          const fr = Math.floor((t * 14 + z.x) % 10);
          ctx.globalAlpha = 0.9 * a;
          CH.Sprites.draw(ctx, 'vfx.p7.23', x, y - 4, { frame: fr, sx: 0.6, sy: 0.6 });
        }
        ctx.globalAlpha = a;
        for (let i = 0; i < 3; i++) {
          const k = i * 2.1 + z.x;
          ctx.fillStyle = Math.sin(t * 9 + k) > 0 ? '#f77622' : '#feae34';
          ctx.fillRect(Math.round(x + Math.cos(k) * z.r * 0.6), Math.round(y + Math.sin(k * 1.7) * z.r * 0.5), 1, 1);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'lava': {
        const a = Math.min(1, z.life / 0.6);
        ctx.globalAlpha = a;
        FX.circleFill(ctx, x, y, z.r, '#a22633');
        FX.circleFill(ctx, x, y, z.r - 3, Math.floor(t * 4 + z.x) % 2 ? '#f77622' : '#e8531c');
        FX.circleFill(ctx, x + Math.sin(t * 3 + z.x) * 4, y + Math.cos(t * 2 + z.y) * 3, z.r * 0.4, '#feae34');
        FX.circleOutline(ctx, x, y, z.r, '#fee761');
        ctx.globalAlpha = 1;
        break;
      }
      case 'acid': {
        // a bubbling green pool
        const a = Math.min(1, z.life / 0.6);
        ctx.globalAlpha = 0.55 * a;
        FX.circleFill(ctx, x, y, z.r, '#2e7d32');
        ctx.globalAlpha = 0.8 * a;
        FX.circleFill(ctx, x, y, z.r * 0.7, '#63c74d');
        for (let i = 0; i < 4; i++) {
          const k = i * 1.9 + z.x;
          const ph = (t * 1.4 + i * 0.37) % 1;
          ctx.globalAlpha = a * (1 - ph);
          ctx.fillStyle = '#d5f5b0';
          ctx.fillRect(Math.round(x + Math.cos(k) * z.r * 0.6), Math.round(y + Math.sin(k * 1.7) * z.r * 0.4 - ph * 5), 2, 2);
        }
        ctx.globalAlpha = a;
        FX.circleOutline(ctx, x, y, z.r, '#b8f08a');
        ctx.globalAlpha = 1;
        break;
      }
      case 'field': {
        // a lingering patch of coloured ground (frost, spores, sand, void): z.color / z.color2
        const a = Math.min(1, z.life / 0.6);
        ctx.globalAlpha = 0.4 * a;
        FX.circleFill(ctx, x, y, z.r, z.color || '#9fd8ef');
        ctx.globalAlpha = 0.6 * a;
        FX.circleFill(ctx, x, y, z.r * 0.62, z.color2 || z.color || '#e8f6ff');
        for (let i = 0; i < 5; i++) {
          const k = i * 2.1 + z.x;
          const ph = (t * 1.2 + i * 0.29) % 1;
          ctx.globalAlpha = a * (1 - ph);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(x + Math.cos(k) * z.r * 0.6), Math.round(y + Math.sin(k * 1.7) * z.r * 0.4 - ph * 5), 2, 2);
        }
        ctx.globalAlpha = a;
        FX.circleOutline(ctx, x, y, z.r, z.color2 || '#ffffff');
        ctx.globalAlpha = 1;
        break;
      }
      case 'corrupt': {
        const a = Math.min(1, z.life / 0.6);
        ctx.globalAlpha = 0.6 * a;
        FX.circleFill(ctx, x, y, z.r, '#120a22');
        ctx.globalAlpha = a;
        for (let i = 0; i < 7; i++) {
          ctx.fillStyle = ['#00ffd0', '#ff00aa', '#ffffff'][(i + Math.floor(t * 12)) % 3];
          ctx.fillRect(Math.round(x + U.rand(-z.r, z.r) * 0.8), Math.round(y + U.rand(-z.r, z.r) * 0.6), U.randInt(1, 5), 1);
        }
        FX.circleOutline(ctx, x, y, z.r, '#ff00aa');
        ctx.globalAlpha = 1;
        break;
      }
      case 'cheese': {
        const a = Math.min(1, z.life / 0.8);
        ctx.globalAlpha = 0.55 * a;
        FX.circleFill(ctx, x, y, z.r, '#fee761');
        ctx.globalAlpha = 0.9 * a;
        ctx.fillStyle = '#feae34';
        for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(x + Math.cos(i * 1.9 + z.x) * z.r * 0.6), Math.round(y + Math.sin(i * 2.3) * z.r * 0.5), 2, 2);
        ctx.globalAlpha = 1;
        break;
      }
      case 'beam': {
        const a = Math.min(1, z.life / 0.2);
        ctx.save();
        ctx.translate(Math.round(x), Math.round(y));
        ctx.rotate(z.ang);
        ctx.globalAlpha = a * 0.6;
        ctx.fillStyle = '#00ffd0';
        ctx.fillRect(0, -z.w / 2 - 2, z.len, z.w + 4);
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, -z.w / 2 + 2, z.len, z.w - 4);
        ctx.restore();
        ctx.globalAlpha = 1;
        break;
      }
    }
  }

  /* --------------------------------------------------------------- pickups */
  function drawPickups(ctx, cam) {
    for (const pk of G.pickups) {
      if (pk.collected) continue;
      const x = pk.x - cam.x;
      const y = pk.y - cam.y;
      if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
      if (pk.life < 3 && Math.floor(pk.life * 8) % 2 === 0) continue;
      const bob = Math.sin(pk.age * 5 + pk.phase) * 1.5;
      ctx.fillStyle = 'rgba(20,10,30,0.3)';
      ctx.fillRect(Math.round(x - 2), Math.round(y + 4), 5, 1);
      if ((pk.type === 'power' && !pk.icon) || pk.type === 'token') {
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(pk.age * 8);
        FX.circleOutline(ctx, x, y + bob, 7 + Math.sin(pk.age * 6) * 1.5, pk.type === 'token' ? '#fee761' : '#b55088');
        ctx.globalAlpha = 1;
      }
      const iconic = pk.icon && CH.Art.on && CH.Sprites.has(pk.icon);
      if (iconic) {
        // an item icon: power-ups pulse in their colour, loot glows with its rarity
        let ring = null;
        if (pk.type === 'power' && pk.pu) ring = CH.PowerUps.KINDS[pk.pu].color;
        else if (pk.type === 'loot') {
          const it = CH.Loot.byId(pk.item);
          if (it && it.rarity !== 'c') ring = CH.Loot.RARITY[it.rarity].color;
        }
        if (ring) {
          ctx.globalAlpha = 0.45 + 0.3 * Math.sin(pk.age * 8);
          FX.circleOutline(ctx, x, y + bob - 2, 8 + Math.sin(pk.age * 6) * 1.2, ring);
          ctx.globalAlpha = 1;
        }
        const sc = pk.type === 'power' ? 1.0 : pk.type === 'curio' ? 0.75 : pk.type === 'hp' ? 0.85 : 0.8;
        CH.Sprites.draw(ctx, pk.icon, x, y + bob - 3, { sx: sc, sy: sc });
        continue;
      }
      const art = CH.Art.on && CH.Sprites.has('pk.' + pk.sprite);
      if (art) {
        // the coin art is a single frame: fake the spin by squashing its width
        const spin = pk.type === 'coin' ? 0.3 + 0.7 * Math.abs(Math.cos(pk.age * 6 + pk.phase)) : 1;
        const sc = pk.type === 'token' ? 1.2 : 1;
        CH.Sprites.draw(ctx, 'pk.' + pk.sprite, x, y + bob - 2, { sx: spin * sc, sy: sc });
      } else CH.Sprites.draw(ctx, pk.sprite, x, y + bob, { frame: pk.type === 'coin' ? Math.floor(pk.age * 9 + pk.phase) % 4 : 0, sx: pk.type === 'token' ? 1.3 : 1, sy: pk.type === 'token' ? 1.3 : 1 });
    }
  }

  /* ----------------------------------------------------------- entity pass */
  function collectDrawables() {
    drawList.length = 0;
    // sorted by where each body touches the ground (props sort by their base too), ties by a stable id
    for (const e of G.enemies) if (!e.dead) drawList.push({ y: e.y + (e.isBoss ? 4 : (e.look && !e.look.fly ? e.look.foot * e.scale : 4)) + (e.uid || 0) * 1e-5, kind: 0, o: e });
    for (const p of G.players) drawList.push({ y: p.y + 13, kind: 1, o: p });
    if (CH.SK) for (const s of CH.SK.list) drawList.push({ y: s.y + 12, kind: 5, o: s });
    if (G.machine) drawList.push({ y: G.machine.y, kind: 2, o: G.machine });
    for (const d of G.decoys) drawList.push({ y: d.y, kind: 3, o: d });
    if (G.arena && G.arena.props) {
      for (const prop of G.arena.props) {
        drawList.push({ y: prop.y, kind: 4, o: prop });
      }
    }
    drawList.sort((a, b) => a.y - b.y);
  }

  function drawProp(ctx, prop, cam) {
    const x = prop.x - cam.x;
    const y = prop.y - cam.y;
    if (x < -100 || x > W + 100 || y < -120 || y > H + 80) return;
    if (prop.invisible) { // a solid stand-in: townspeople are drawn here so they sort with the scenery
      if (prop.npc && CH.Town && CH.Town.drawNpc && G.level && G.level.npcs) { const n = G.level.npcs.find((q) => q.id === prop.npc); if (n) CH.Town.drawNpc(ctx, n, Math.round(n.px - cam.x), Math.round(n.py - cam.y)); }
      return;
    }

    ctx.save();
    if (prop.kind === 'tree' || prop.kind === 'rock' || prop.kind === 'furniture') {
      const sw = prop.kind === 'tree' ? 24 : 16;
      CH.Enemies.shadow(ctx, x, y - 2, sw);
    }

    if (prop.fire) {
      CH.Enemies.shadow(ctx, x, y - 2, 14);
      CH.Fires.draw(ctx, prop, x, y);
      ctx.restore();
      return;
    }

    if (prop.dead) {
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(Math.round(x - 6), Math.round(y - 5), 12, 5);
      ctx.fillStyle = '#ead4aa';
      ctx.fillRect(Math.round(x - 5), Math.round(y - 7), 10, 3);
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(Math.round(x - 3), Math.round(y - 6), 6, 1);
      ctx.restore();
      return;
    }

    const shakeX = prop.shake > 0 ? (Math.random() - 0.5) * 5 : 0;
    const wind = prop.swayable ? Math.sin(G.wall * 2.2 + prop.x * 0.03 + prop.y * 0.02) * (prop.kind === 'tree' ? 0.04 : 0.08) * (CH.Fires ? CH.Fires.windMul() : 1) : 0;
    const totalBend = wind + (prop.bend || 0);

    ctx.translate(Math.round(x + shakeX), Math.round(y));

    if (prop.falling) {
      ctx.rotate(prop.fallDir * prop.fallT * (Math.PI / 2));
    } else if (totalBend !== 0) {
      ctx.transform(1, 0, totalBend, 1, 0, 0);
    }

    if (prop.additive) ctx.globalCompositeOperation = 'lighter';
    CH.Sprites.draw(ctx, prop.sprite, 0, 0, prop.flip ? { flip: true } : undefined);
    ctx.restore();
  }

  function drawMachine(ctx, m, cam) {
    if (m.town) return; // in town the vendor NPC stands there instead
    const x = m.x - cam.x;
    const y = m.y - cam.y;
    CH.Enemies.shadow(ctx, x, y + 13, 18);
    CH.Sprites.draw(ctx, 'vending', x, y + 14, { frame: m.uses > 0 && Math.sin(G.wall * 7) > 0.2 ? 1 : 0, alpha: m.uses > 0 ? 1 : 0.65 });
    // the pack's $ road sign floats above the machine
    if (CH.UIK && CH.UIK.on && m.uses > 0) {
      const sy = y - 46 + Math.sin(G.wall * 3) * 1.5;
      ctx.fillStyle = '#d1c29a';
      ctx.beginPath();
      ctx.moveTo(x, sy + 1);
      ctx.lineTo(x + 11, sy + 12);
      ctx.lineTo(x, sy + 23);
      ctx.lineTo(x - 11, sy + 12);
      ctx.fill();
      CH.UIK.draw(ctx, '0 - Sprites/Signs/4.png', x - 12, sy, { w: 24, h: 24 });
    }
    const p = G.players.find((q) => !q.dead && U.dist(q.x, q.y, m.x, m.y) < 60);
    if (p) {
      const txt = m.uses > 0 ? (p.inp.kind === 'pad' ? 'B:' : 'E:') + 'SHOP' : 'EMPTY';
      const ok = m.uses > 0;
      Font.draw(ctx, txt, x, y - 24 + Math.sin(G.wall * 6) * 1.2, ok ? '#fee761' : '#b9b4c8', 1, true);
    } else if (m.uses > 0 && m.t < 6) {
      Font.draw(ctx, 'VENDING!', x, y - 24, '#ffffff', 1, true);
    }
  }

  function drawDecoy(ctx, d, cam) {
    const x = d.x - cam.x;
    const y = d.y - cam.y;
    CH.Enemies.shadow(ctx, x, y + 6, 10);
    CH.Sprites.draw(ctx, 'prob_decoy', x, y + Math.sin(d.t * 6) * 1.5, { alpha: d.life < 1 ? 0.5 : 1 });
    ctx.globalAlpha = 0.35;
    FX.circleOutline(ctx, x, y, 14 + Math.sin(d.t * 5) * 2, '#feae34');
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------- overlays */
  function drawDisco(ctx) {
    const beat = G.mods.discoBeat;
    const flashing = CH.Storage.settings.flashing;
    const size = 32;
    ctx.globalAlpha = flashing ? 0.22 : 0.1;
    for (let y = 0; y < H; y += size) {
      for (let x = 0; x < W; x += size) {
        const hue = ((x / size) * 47 + (y / size) * 83 + beat * 60) % 360;
        ctx.fillStyle = `hsl(${hue},85%,55%)`;
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawGlitch(ctx, phase, v) {
    const cv = ctx.canvas;
    const n = phase >= 3 ? 4 : 2;
    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.6) continue;
      const y = Math.floor(Math.random() * (H - 12));
      const h = U.randInt(2, 10);
      const off = U.randInt(-10, 10);
      ctx.drawImage(cv, v.x, y, v.w, h, v.x + off, y, v.w, h);
    }
    ctx.globalAlpha = phase >= 3 ? 0.1 : 0.06;
    ctx.fillStyle = '#00ffd0';
    ctx.fillRect(v.x, Math.floor(Math.random() * H), v.w, 1);
    ctx.fillStyle = '#ff00aa';
    ctx.fillRect(v.x, Math.floor(Math.random() * H), v.w, 1);
    ctx.globalAlpha = 1;
  }

  /* edge arrows, in screen space of one view: toward an off-screen boss, and toward a partner who is out of view */
  function arrowAt(ctx, v, wx, wy, cam, color, glyph) {
    const cx = v.x + v.w / 2;
    const sx = v.off + (wx - cam.x);
    const sy = wy - cam.y;
    const pad = 12;
    if (sx > v.x + 8 && sx < v.x + v.w - 8 && sy > 8 && sy < H - 8) return false;
    const a = Math.atan2(sy - H / 2, sx - cx);
    const px = U.clamp(cx + Math.cos(a) * 600, v.x + pad, v.x + v.w - pad);
    const py = U.clamp(H / 2 + Math.sin(a) * 600, pad, H - pad);
    ctx.save();
    ctx.translate(Math.round(px), Math.round(py));
    ctx.rotate(a);
    ctx.fillStyle = '#1b1226';
    ctx.fillRect(-6, -5, 12, 10);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-4, 5);
    ctx.fill();
    ctx.restore();
    if (glyph) Font.draw(ctx, glyph, Math.round(px), Math.round(py) - 11, color, 1, true);
    return true;
  }
  function drawPointers(ctx, v, cam) {
    for (const e of G.enemies) {
      if (!e.isBoss || e.dead || e.dying) continue;
      arrowAt(ctx, v, e.x, e.y, cam, Math.floor(G.wall * 4) % 2 ? '#e43b44' : '#fee761');
    }
    if (!G.coop) return;
    for (const q of G.players) {
      if (q === v.player) continue;
      const split = G.views.length > 1;
      if (!split && !q.dead) continue; // on the shared screen both heroes are always visible
      arrowAt(ctx, v, q.x, q.y, cam, q.dead ? '#e43b44' : q.color, q.dead ? q.name + ' +' : q.name);
    }
  }

  /* the mouse crosshair belongs to whichever hero is playing on keyboard + mouse */
  function drawCrosshair(ctx) {
    const m = Input.mouse;
    if (!m.inside) return;
    const p = G.players.find((q) => q.inp.kind === 'kbm' && !q.dead);
    if (!p) return;
    const x = Math.round(m.x);
    const y = Math.round(m.y);
    const ws = p.ws[p.weapon];
    const reloading = ws && ws.reload > 0;
    const col = reloading ? '#feae34' : G.coop ? p.color : '#ffffff';
    ctx.fillStyle = '#1b1226';
    ctx.fillRect(x - 6, y - 1, 5, 3);
    ctx.fillRect(x + 2, y - 1, 5, 3);
    ctx.fillRect(x - 1, y - 6, 3, 5);
    ctx.fillRect(x - 1, y + 2, 3, 5);
    ctx.fillStyle = col;
    ctx.fillRect(x - 5, y, 4, 1);
    ctx.fillRect(x + 2, y, 4, 1);
    ctx.fillRect(x, y - 5, 1, 4);
    ctx.fillRect(x, y + 2, 1, 4);
    if (reloading) {
      const d = CH.Balance.weapons[p.weapon].reload;
      const k = 1 - ws.reload / d;
      ctx.fillStyle = '#1b1226';
      ctx.fillRect(x - 8, y + 9, 17, 4);
      ctx.fillStyle = '#feae34';
      ctx.fillRect(x - 7, y + 10, Math.round(15 * k), 2);
    }
  }

  /* a stick-aimed hero shows where the shot will go: a small reticle on the aim line, drawn in the world */
  function drawReticles(ctx, cam) {
    for (const p of G.players) {
      if (p.dead || p.inp.kind !== 'pad') continue;
      const d = Math.min(64, Math.max(34, (p.aimDist || 70) * 0.55));
      const x = Math.round(p.x - cam.x + Math.cos(p.aim) * d);
      const y = Math.round(p.y - cam.y - 6 + Math.sin(p.aim) * d);
      const col = G.coop ? p.color : '#ffffff';
      const ws = p.ws[p.weapon];
      const reloading = ws && ws.reload > 0;
      ctx.fillStyle = '#1b1226';
      ctx.fillRect(x - 4, y - 1, 9, 3);
      ctx.fillRect(x - 1, y - 4, 3, 9);
      ctx.fillStyle = reloading ? '#feae34' : col;
      ctx.fillRect(x - 3, y, 7, 1);
      ctx.fillRect(x, y - 3, 1, 7);
      ctx.fillStyle = '#1b1226';
      ctx.fillRect(x, y, 1, 1);
    }
  }

  /* ----------------------------------------------------------------- main */
  /* one viewport: the world, clipped to its slice of the canvas, then that slice's screen-space overlays */
  function drawView(ctx, v, sh) {
    const reduced = CH.Storage.settings.reduced;
    const off = v.off;
    const cam = { x: Math.round(v.cam.x + sh.x), y: Math.round(v.cam.y + sh.y) };

    ctx.save();
    ctx.beginPath();
    ctx.rect(v.x, 0, v.w, H);
    ctx.clip();
    ctx.translate(off, 0);

    CH.Arenas.drawBg(ctx, G.arena, cam);
    CH.Arenas.drawAnim(ctx, G.arena, cam, G.wall, G.state === 'playing' ? 0.016 : 0);
    if (CH.Weather && CH.Weather.drawGround) CH.Weather.drawGround(ctx, cam);
    if (CH.Atmos && CH.Atmos.snap) CH.Atmos.snap('floor', ctx, v); // the puddle shader tells floor from characters with these two
    if (G.mods.disco) drawDisco(ctx);

    for (const z of G.zones) drawZone(ctx, z, cam, false);
    for (const e of G.enemies) if (!e.dead) CH.Enemies.drawGround(ctx, e, cam);
    drawPickups(ctx, cam);

    collectDrawables();
    for (const d of drawList) {
      if (d.kind === 0) {
        if (d.o.isBoss) CH.Bosses.draw(ctx, d.o, cam);
        else CH.Enemies.draw(ctx, d.o, cam);
      } else if (d.kind === 1) CH.Player.draw(ctx, d.o, cam, G);
      else if (d.kind === 2) drawMachine(ctx, d.o, cam);
      else if (d.kind === 3) drawDecoy(ctx, d.o, cam);
      else if (d.kind === 4) drawProp(ctx, d.o, cam);
      else if (d.kind === 5) CH.SK.draw(ctx, d.o, cam);
    }

    CH.Weapons.draw(ctx, G, cam);
    for (const z of G.zones) drawZone(ctx, z, cam, true);
    FX.draw(ctx, cam);
    FX.drawTexts(ctx, cam);
    if (CH.Atmos && CH.Atmos.snap) CH.Atmos.snap('actors', ctx, v); // before the full-screen tints, rays and vignette
    if (CH.Weather && CH.Weather.drawAtmosphere) CH.Weather.drawAtmosphere(ctx, cam, v);
    drawReticles(ctx, cam);
    CH.Hooks.run('world', ctx, cam, v);
    ctx.restore();

    // ---- screen-space overlays for this slice ----
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.x, 0, v.w, H);
    ctx.clip();
    if (!reduced) ctx.drawImage(vignette, 0, 0, W, H, v.x, 0, v.w, H);
    // low health pulses red on the screen of the hero who is hurting (the shared screen shows the worst of the party)
    const watch = v.players || G.players;
    let low = 1;
    for (const p of watch) if (!p.dead) low = Math.min(low, p.hp / p.maxHp);
    if (low < 0.3) {
      ctx.globalAlpha = (0.3 - low) * 2.2 * (0.6 + 0.4 * Math.sin(G.wall * 6));
      ctx.drawImage(redVignette, 0, 0, W, H, v.x, 0, v.w, H);
      ctx.globalAlpha = 1;
    }
    if (G.hurtFlash > 0) {
      ctx.globalAlpha = Math.min(CH.Storage.settings.flashing ? 0.4 : 0.15, G.hurtFlash * 0.9);
      ctx.fillStyle = '#e43b44';
      ctx.fillRect(v.x, 0, v.w, H);
      ctx.globalAlpha = 1;
    }
    if (G.flashT > 0) {
      ctx.globalAlpha = Math.min(1, G.flashT);
      ctx.fillStyle = G.flashColor;
      ctx.fillRect(v.x, 0, v.w, H);
      ctx.globalAlpha = 1;
    }
    if (G.mods.reverse) {
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(G.wall * 8);
      ctx.strokeStyle = '#b55088';
      ctx.lineWidth = 4;
      ctx.strokeRect(v.x + 2, 2, v.w - 4, H - 4);
      ctx.globalAlpha = 1;
    }
    const boss = G.enemies.find((e) => e.isBoss && !e.dead);
    if (boss && boss.kind === 'bug' && !reduced && CH.Storage.settings.flashing && (boss.phase >= 2 || boss.dying)) drawGlitch(ctx, boss.dying ? 3 : boss.phase, v);
    drawPointers(ctx, v, cam);
    CH.Hooks.run('screen', ctx, cam, v);
    ctx.restore();
  }

  G.render = function () {
    const ctx = G.ctx;
    ctx.imageSmoothingEnabled = false;
    if (!vignette) {
      vignette = makeVignette('20,10,30', 0.5, 0.3);
      redVignette = makeVignette('228,59,68', 0.35, 0.85);
    }

    if (G.state === 'menu' || !G.player) {
      ctx.fillStyle = G.arena.theme.clear;
      ctx.fillRect(0, 0, W, H);
      const cam = { x: Math.round(G.demoCam.x), y: Math.round(G.demoCam.y) };
      CH.Arenas.drawBg(ctx, G.arena, cam);
      CH.Arenas.drawAnim(ctx, G.arena, cam, G.wall, 0);
      const L = G.demo.slice().sort((a, b) => a.y - b.y);
      for (const d of L) {
        const look = CH.Enemies.look[d.type];
        const x = d.x - cam.x;
        const y = d.y - cam.y;
        if (x < -30 || x > W + 30 || y < -30 || y > H + 30) continue;
        CH.Enemies.shadow(ctx, x, y + (look.fly ? 8 : look.foot), look.shadow);
        const f = look.anim === 'flap' ? Math.floor(d.age * 10) % 2 : look.anim === 'walk3' ? 1 + (Math.floor(d.age * 7) % 2) : look.anim === 'two' ? Math.floor(d.age * 8) % 2 : 0;
        CH.Sprites.draw(ctx, look.sprite, x, look.fly ? y - 3 + Math.sin(d.age * 6) * 1.5 : y + look.foot - Math.abs(Math.sin(d.age * 9)), { frame: f, flip: look.faceRight ? d.face < 0 : false });
      }
      FX.draw(ctx, cam);
      ctx.drawImage(vignette, 0, 0);
      ctx.fillStyle = 'rgba(20,10,40,0.12)';
      ctx.fillRect(0, 0, W, H);
      // the chosen hero(es) wait at the side of the menu
      CH.Player.drawShowcase(ctx, CH.Storage.settings.hero, 62, 232, 2, 'idle', G.wall);
      if (G.menuCoop) CH.Player.drawShowcase(ctx, CH.Storage.settings.hero2, 112, 236, 2, 'idle', G.wall + 0.7);
      return;
    }

    ctx.fillStyle = G.arena.theme.clear;
    ctx.fillRect(0, 0, W, H);
    const sh = G.shakeOffset();
    for (const v of G.views) drawView(ctx, v, sh);

    // divider between the two screens
    if (G.views.length > 1) {
      const x = G.views[1].x;
      ctx.fillStyle = '#1b1226';
      ctx.fillRect(x - 1, 0, 2, H);
      ctx.fillStyle = '#fff3d6';
      ctx.fillRect(x - 1, 0, 1, H);
    }
    if (G.state === 'playing') drawCrosshair(ctx);
  };
})(window.CH);
