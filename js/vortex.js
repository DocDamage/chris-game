/* CHAOS.exe - the portal vortex (PLAN.md 18, K5). Every portal is one front-facing circle instead of the sideways
   rings: a soft glow, a bright rim, spiral arms turning inward, sparks drawn into a dark eye, and a pool of light on the
   ground under it. Drawn in screen space on the world canvas, stateless (everything moves with t), one call per portal:
     Vortex.draw(ctx, x, y, r, t, pal, o)   x, y = the ground point under it, r = radius, pal = a palette name or
                                           {rim, arm, glow, core}, o = { alpha, lift (px above the ground) }
   Palettes: town (blue), exit (gold), waypoint (green), cult (purple), frost (ice blue), hell (red), glitch (magenta). */
(function (CH) {
  'use strict';
  const TAU = Math.PI * 2;

  const PAL = {
    town: { rim: '#9fe8ff', arm: '#3ccbe6', glow: '60,203,230', core: '#06141c' },
    exit: { rim: '#fff3a8', arm: '#feae34', glow: '254,200,80', core: '#1c1206' },
    waypoint: { rim: '#c8ffb0', arm: '#63c74d', glow: '99,199,77', core: '#08160a' },
    cult: { rim: '#f0b8ff', arm: '#b55088', glow: '181,80,200', core: '#14061a' },
    frost: { rim: '#ffffff', arm: '#9fd8ef', glow: '170,220,255', core: '#0a1620' },
    hell: { rim: '#ffd0a0', arm: '#e43b44', glow: '228,59,40', core: '#1a0404' },
    glitch: { rim: '#ffb8f4', arm: '#ff2bd6', glow: '255,43,214', core: '#12041a' },
  };
  const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255); };

  const Vortex = (CH.Vortex = { PAL });

  /* a palette from a hex colour (breaches pass their glow colour) */
  Vortex.palette = function (hex) {
    if (PAL[hex]) return PAL[hex];
    return { rim: '#ffffff', arm: hex, glow: hexRgb(hex), core: '#0a0610' };
  };

  Vortex.draw = function (ctx, x, y, r, t, pal, o) {
    o = o || {};
    const P = typeof pal === 'string' ? Vortex.palette(pal) : pal || PAL.town;
    const a0 = o.alpha === undefined ? 1 : o.alpha;
    const lift = o.lift === undefined ? Math.round(r * 1.15) : o.lift;
    const cx = Math.round(x), cy = Math.round(y - lift);
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.1);
    ctx.save();
    // light on the ground under it
    ctx.globalCompositeOperation = 'lighter';
    let g = ctx.createRadialGradient(cx, y, 0, cx, y, r * 1.8);
    g.addColorStop(0, 'rgba(' + P.glow + ',' + (0.32 * a0) + ')');
    g.addColorStop(1, 'rgba(' + P.glow + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, y, r * 1.8, r * 0.7, 0, 0, TAU);
    ctx.fill();
    // the halo
    g = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.7);
    g.addColorStop(0, 'rgba(' + P.glow + ',' + ((0.35 + 0.15 * pulse) * a0) + ')');
    g.addColorStop(1, 'rgba(' + P.glow + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r * 1.8, cy - r * 1.8, r * 3.6, r * 3.6);
    ctx.globalCompositeOperation = 'source-over';
    // the dark eye
    ctx.globalAlpha = 0.85 * a0;
    ctx.fillStyle = P.core;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.92, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = a0;
    // spiral arms turning inward: dots along four log-spirals, sliding toward the centre
    ctx.globalCompositeOperation = 'lighter';
    const arms = 4, steps = Math.max(8, Math.round(r * 0.9));
    for (let k = 0; k < arms; k++) {
      for (let i = 0; i < steps; i++) {
        const f = ((i / steps + t * 0.55) % 1); // 0 at the rim .. 1 at the eye
        const rr = r * 0.9 * (1 - f);
        const ang = (k / arms) * TAU + f * 4.2 - t * 1.6;
        const px = Math.round(cx + Math.cos(ang) * rr), py = Math.round(cy + Math.sin(ang) * rr);
        ctx.fillStyle = f < 0.15 ? P.rim : P.arm;
        ctx.globalAlpha = a0 * (0.35 + 0.65 * (1 - Math.abs(f - 0.45) * 1.6));
        const s = rr > r * 0.45 ? 2 : 1;
        ctx.fillRect(px, py, s, s);
      }
    }
    // sparks falling in from outside the rim
    for (let k = 0; k < 10; k++) {
      const ph = (t * 0.8 + k * 0.137) % 1;
      const ang = k * 2.39996 + t * 0.9;
      const rr = r * (1.6 - ph * 1.5);
      ctx.globalAlpha = a0 * Math.min(1, ph * 3) * (1 - ph * 0.6);
      ctx.fillStyle = k % 3 ? P.rim : P.arm;
      ctx.fillRect(Math.round(cx + Math.cos(ang) * rr), Math.round(cy + Math.sin(ang) * rr), 1, 1);
    }
    // the rim: a bright ring and a softer one outside it
    ctx.globalAlpha = a0 * (0.75 + 0.25 * pulse);
    ctx.strokeStyle = P.rim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = a0 * 0.45;
    ctx.strokeStyle = P.arm;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2 + pulse, 0, TAU);
    ctx.stroke();
    ctx.restore();
  };
})(window.CH);
