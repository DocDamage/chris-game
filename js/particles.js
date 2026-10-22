/* CHAOS.exe - particles, rings, floating text and speech bubbles. Everything is pooled in plain arrays
   with a hard cap, and every particle expires on its own timer. */
(function (CH) {
  'use strict';
  const U = CH.U;

  const FIRE = ['#fee761', '#feae34', '#f77622', '#e43b44', '#a22633'];
  const CHEESE = ['#fee761', '#feae34', '#ffffff', '#f77622'];
  const ICE = ['#ffffff', '#3ccbe6', '#1b8fb0', '#e8e4f0'];
  const GLITCH = ['#00ffd0', '#ff00aa', '#ffffff', '#3b6fe0', '#b55088'];
  const CRUMB = ['#f4d38a', '#c8a674', '#ead4aa', '#8b5a2b'];
  const JUNK = ['#b9b4c8', '#7d7893', '#8b5a2b', '#63c74d', '#feae34'];
  const BLOOD = ['#63c74d', '#3e8948', '#fee761']; // enemies leak goo, not blood
  const CONFETTI = ['#e43b44', '#feae34', '#fee761', '#63c74d', '#3ccbe6', '#b55088', '#ffffff'];

  const FX = (CH.FX = {
    parts: [],
    texts: [],
    bubbles: [],
    max: 700,
    palettes: { fire: FIRE, cheese: CHEESE, ice: ICE, glitch: GLITCH, crumb: CRUMB, junk: JUNK, goo: BLOOD, confetti: CONFETTI },

    scale() {
      return CH.Storage.settings.reduced ? 0.35 : 1;
    },

    reset() {
      FX.parts.length = 0;
      FX.texts.length = 0;
      FX.bubbles.length = 0;
    },

    add(p) {
      if (FX.parts.length >= FX.max) return null;
      p.max = p.life;
      p.drag = p.drag === undefined ? 0 : p.drag;
      p.g = p.g || 0;
      p.size = p.size || 1;
      FX.parts.push(p);
      return p;
    },

    /* generic burst of square pixels */
    burst(x, y, o) {
      let n = Math.round((o.n || 8) * FX.scale());
      if (o.n && n < 1) n = 1;
      const cols = typeof o.colors === 'string' ? FX.palettes[o.colors] : o.colors || FIRE;
      for (let i = 0; i < n; i++) {
        const a = o.angle !== undefined ? o.angle + U.rand(-(o.spread || 0.5), o.spread || 0.5) : U.rand(0, U.TAU);
        const sp = U.rand((o.speed || 60) * 0.3, o.speed || 60);
        FX.add({
          x: x + U.rand(-(o.jitter || 0), o.jitter || 0),
          y: y + U.rand(-(o.jitter || 0), o.jitter || 0),
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - (o.up || 0),
          life: U.rand((o.life || 0.5) * 0.6, o.life || 0.5),
          size: o.size || (Math.random() < 0.3 ? 2 : 1),
          color: U.pick(cols),
          g: o.g || 0,
          drag: o.drag === undefined ? 2 : o.drag,
          kind: 'px',
        });
      }
    },

    /* play a pre-baked VFX animation (96px frames from the VFX packs). Returns false if unavailable. */
    vfx(name, x, y, o) {
      o = o || {};
      if (!CH.Art.on || !CH.Sprites.has(name)) return false;
      const n = CH.Sprites.get(name).frames.length;
      const dur = o.dur || n / (o.fps || 22);
      const p = FX.add({ x, y, vx: o.vx || 0, vy: o.vy || 0, life: dur, kind: 'vfx', name, n, scale: o.scale || 1, rot: o.rot || 0, alpha: o.alpha === undefined ? 1 : o.alpha, add: !!o.add, flip: !!o.flip, drag: 0 });
      return !!p;
    },

    /* a dead enemy playing its death animation, then fading */
    corpse(name, x, y, o) {
      o = o || {};
      if (!CH.Art.on || !CH.Sprites.has(name)) return false;
      return !!FX.add({ x, y, vx: 0, vy: 0, life: 1.5, kind: 'corpse', name, flip: !!o.flip, scale: o.scale || 1, gold: o.gold || null, foot: o.foot || 8, drag: 0 });
    },

    explosion(x, y, r, o) {
      o = o || {};
      if (CH.Art.on) {
        const kind = o.colors === 'cheese' ? 'cheese' : o.colors === 'ice' ? 'ice' : o.colors === 'glitch' ? 'glitch' : 'fire';
        let name;
        let ref;
        if (kind === 'cheese') (name = 'vfx.p5.31'), (ref = 30);
        else if (kind === 'ice') (name = 'vfx.p7.5'), (ref = 26);
        else if (kind === 'glitch') (name = 'vfx.p7.12'), (ref = 26);
        else if (r >= 60 || o.big) (name = 'vfx.p7.2'), (ref = 44);
        else if (r >= 26) (name = 'vfx.p1.27'), (ref = 38);
        else (name = 'vfx.p5.32'), (ref = 24);
        if (FX.vfx(name, x, y - (kind === 'ice' ? 8 : 0), { scale: Math.max(0.45, r / ref), fps: r >= 60 ? 18 : 24, alpha: o.alpha })) {
          FX.add({ x, y, vx: 0, vy: 0, life: 0.3, kind: 'ring', r0: r * 0.2, r1: r, color: kind === 'cheese' ? '#fee761' : '#ffffff' });
          const k = Math.round(U.clamp(r * 0.35, 4, 16) * FX.scale());
          for (let i = 0; i < k; i++) {
            const a = U.rand(0, U.TAU);
            const sp = U.rand(r * 0.8, r * 2.6);
            FX.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: U.rand(0.2, 0.45), size: 2, color: U.pick(kind === 'ice' ? ICE : kind === 'cheese' ? CHEESE : FIRE), drag: 3.5, kind: 'px' });
          }
          return;
        }
      }
      const cols = o.colors || FIRE;
      const pal = typeof cols === 'string' ? FX.palettes[cols] : cols;
      const n = Math.round(U.clamp(r * 0.7, 8, 46) * FX.scale());
      FX.add({ x, y, vx: 0, vy: 0, life: 0.12, kind: 'flash', r0: r * 0.8, color: '#ffffff' });
      FX.add({ x, y, vx: 0, vy: 0, life: 0.3, kind: 'ring', r0: r * 0.2, r1: r, color: pal[0] });
      FX.add({ x, y, vx: 0, vy: 0, life: 0.22, kind: 'ring', r0: r * 0.1, r1: r * 0.7, color: pal[1] });
      for (let i = 0; i < n; i++) {
        const a = U.rand(0, U.TAU);
        const sp = U.rand(r * 0.6, r * 3.2);
        FX.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: U.rand(0.25, 0.6), size: U.chance(0.4) ? 3 : 2, color: U.pick(pal), drag: 3.5, kind: 'px' });
      }
      const sm = Math.round(U.clamp(r * 0.15, 2, 8) * FX.scale());
      for (let i = 0; i < sm; i++) {
        const a = U.rand(0, U.TAU);
        FX.add({ x: x + Math.cos(a) * r * 0.3, y: y + Math.sin(a) * r * 0.3, vx: Math.cos(a) * 14, vy: Math.sin(a) * 14 - 14, life: U.rand(0.5, 0.9), size: 4, color: '#4a4560', drag: 1.5, kind: 'smoke' });
      }
    },

    ring(x, y, r0, r1, color, life) {
      FX.add({ x, y, vx: 0, vy: 0, life: life || 0.3, kind: 'ring', r0, r1, color });
    },

    dust(x, y, n) {
      const cnt = Math.round((n || 3) * FX.scale());
      for (let i = 0; i < cnt; i++) {
        FX.add({ x: x + U.rand(-3, 3), y: y + U.rand(-1, 1), vx: U.rand(-14, 14), vy: U.rand(-14, -2), life: U.rand(0.25, 0.45), size: 2, color: '#e8d4a8', drag: 3, kind: 'smoke' });
      }
    },

    /* a sprite that tumbles away (dead enemies, flung junk) */
    debris(sprite, x, y, vx, vy, o) {
      if (CH.Storage.settings.reduced && Math.random() < 0.6) return;
      FX.add(Object.assign({ x, y, vx, vy, life: 0.7, kind: 'spr', sprite, rot: 0, vr: U.rand(-12, 12), g: 220, drag: 0.5 }, o || {}));
    },

    text(x, y, str, color, scale) {
      if (FX.texts.length > 70) FX.texts.shift();
      FX.texts.push({ x: x + U.rand(-4, 4), y, vy: -26, str: String(str), color: color || '#ffffff', scale: scale || 1, life: scale > 1 ? 0.85 : 0.65, max: scale > 1 ? 0.85 : 0.65 });
    },

    speech(owner, str, life) {
      for (let i = FX.bubbles.length - 1; i >= 0; i--) if (FX.bubbles[i].owner === owner) FX.bubbles.splice(i, 1);
      FX.bubbles.push({ owner, str: String(str).toUpperCase(), life: life || 2, max: life || 2 });
    },

    update(dt) {
      const ps = FX.parts;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life -= dt;
        if (p.life <= 0) {
          ps[i] = ps[ps.length - 1];
          ps.pop();
          continue;
        }
        if (p.drag) {
          const k = Math.max(0, 1 - p.drag * dt);
          p.vx *= k;
          p.vy *= k;
        }
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.vr) p.rot += p.vr * dt;
      }
      const ts = FX.texts;
      for (let i = ts.length - 1; i >= 0; i--) {
        const t = ts[i];
        t.life -= dt;
        t.y += t.vy * dt;
        t.vy *= Math.max(0, 1 - 3 * dt);
        if (t.life <= 0) ts.splice(i, 1);
      }
      const bs = FX.bubbles;
      for (let i = bs.length - 1; i >= 0; i--) {
        bs[i].life -= dt;
        if (bs[i].life <= 0 || (bs[i].owner && bs[i].owner.dead)) bs.splice(i, 1);
      }
    },

    /* ---- pixel-perfect circles ---- */
    circleOutline(ctx, cx, cy, r, color) {
      ctx.fillStyle = color;
      cx = Math.round(cx);
      cy = Math.round(cy);
      r = Math.round(r);
      if (r < 1) return;
      let x = r;
      let y = 0;
      let err = 1 - r;
      while (x >= y) {
        ctx.fillRect(cx + x, cy + y, 1, 1);
        ctx.fillRect(cx + y, cy + x, 1, 1);
        ctx.fillRect(cx - y, cy + x, 1, 1);
        ctx.fillRect(cx - x, cy + y, 1, 1);
        ctx.fillRect(cx - x, cy - y, 1, 1);
        ctx.fillRect(cx - y, cy - x, 1, 1);
        ctx.fillRect(cx + y, cy - x, 1, 1);
        ctx.fillRect(cx + x, cy - y, 1, 1);
        y++;
        if (err < 0) err += 2 * y + 1;
        else {
          x--;
          err += 2 * (y - x) + 1;
        }
      }
    },
    circleFill(ctx, cx, cy, r, color) {
      ctx.fillStyle = color;
      cx = Math.round(cx);
      cy = Math.round(cy);
      r = Math.round(r);
      for (let dy = -r; dy <= r; dy++) {
        const w = Math.floor(Math.sqrt(r * r - dy * dy + 0.25));
        ctx.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
      }
    },

    draw(ctx, cam) {
      const ps = FX.parts;
      const sx = cam.x;
      const sy = cam.y;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const t = p.life / p.max;
        const x = p.x - sx;
        const y = p.y - sy;
        if (x < -40 || y < -40 || x > CH.Balance.view.w + 40 || y > CH.Balance.view.h + 40) continue;
        switch (p.kind) {
          case 'px':
            ctx.globalAlpha = t < 0.3 ? t / 0.3 : 1;
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(x), Math.round(y), p.size, p.size);
            break;
          case 'smoke': {
            ctx.globalAlpha = t * 0.55;
            const s = Math.round(p.size + (1 - t) * 4);
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
            break;
          }
          case 'ring': {
            const r = U.lerp(p.r1, p.r0, t);
            ctx.globalAlpha = Math.min(1, t * 1.6);
            FX.circleOutline(ctx, x, y, r, p.color);
            break;
          }
          case 'flash':
            ctx.globalAlpha = t * 0.7;
            FX.circleFill(ctx, x, y, p.r0, p.color);
            break;
          case 'vfx': {
            const prog = 1 - p.life / p.max;
            const fi = Math.min(p.n - 1, Math.floor(prog * p.n));
            if (p.add) ctx.globalCompositeOperation = 'lighter';
            CH.Sprites.draw(ctx, p.name, x, y, { frame: fi, sx: p.scale, sy: p.scale, rot: p.rot, alpha: p.alpha, flip: p.flip });
            if (p.add) ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'corpse': {
            const age = p.max - p.life;
            const fade = p.life < 0.5 ? p.life / 0.5 : 1;
            CH.Sprites.draw(ctx, p.name, x, y + p.foot * p.scale, { frame: CH.Sprites.frame(p.name, 'death', age), flip: p.flip, sx: p.scale, sy: p.scale, alpha: fade, gold: p.gold });
            break;
          }
          case 'spr':
            ctx.globalAlpha = t < 0.3 ? t / 0.3 : 1;
            CH.Sprites.draw(ctx, p.sprite, x, y, { rot: p.rot, frame: p.frame || 0, flash: p.flash, sx: p.sx, sy: p.sy });
            break;
        }
      }
      ctx.globalAlpha = 1;
    },

    drawTexts(ctx, cam) {
      const Font = CH.Font;
      for (const t of FX.texts) {
        const x = t.x - cam.x;
        const y = t.y - cam.y;
        const age = t.max - t.life;
        ctx.globalAlpha = t.life < 0.2 ? t.life / 0.2 : 1;
        const sc = t.scale > 1 && age < 0.1 ? t.scale + 1 : t.scale;
        Font.draw(ctx, t.str, x, y, t.color, sc, true);
      }
      ctx.globalAlpha = 1;
      for (const b of FX.bubbles) {
        const o = b.owner;
        if (!o) continue;
        const c = CH.Font.get(b.str, '#1b1226', 1, false);
        const w = c.width + 6;
        const h = 11;
        const bx = Math.round(o.x - cam.x - w / 2);
        const by = Math.round(o.y - cam.y - (o.h || 20) - h - 4);
        ctx.globalAlpha = b.life < 0.25 ? b.life / 0.25 : 1;
        ctx.fillStyle = '#1b1226';
        ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx, by, w, h);
        ctx.fillRect(bx + w / 2 - 1, by + h, 3, 2);
        ctx.drawImage(c, bx + 3, by + 3);
      }
      ctx.globalAlpha = 1;
    },
  });
})(window.CH);
