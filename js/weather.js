/* CHAOS.exe - Weather Shaders & Atmospheric FX
   Provides real-time dynamic weather passes:
   - Rain & Storm: Slanted rain streaks, ground puddle ripples, lightning flashes & thunder
   - Wind & Gale: Ambient wind streaks, blowing leaves / petals, wind gusts that drive foliage
   - Sunlight & God Rays: Volumetric diagonal light rays streaming across the canopy & floating dust motes
   - Glitch Storm: Digital scanlines, chromatic shifts & neon void particles
*/
(function (CH) {
  'use strict';
  const U = CH.U;
  const B = CH.Balance;

  const Weather = (CH.Weather = {
    mode: 'sun', // 'sun' | 'rain' | 'wind' | 'glitch' | 'none'
    custom: null,
    time: 0,
    windAngle: 0.35, // slight diagonal
    windSpeed: 1.0,

    // Rain particles
    drops: [],
    maxDrops: 140,
    ripples: [],
    maxRipples: 35,

    // Wind leaves / petals
    leaves: [],
    maxLeaves: 45,

    // Sun dust motes
    motes: [],
    maxMotes: 30,

    // Lightning
    lightningT: 0,
    lightningAlpha: 0,
    nextLightning: 12,
  });

  const LEAF_COLORS = ['#d1a964', '#e43b44', '#f77622', '#feae34', '#8b5a2b', '#62b84b'];

  Weather.init = function () {
    Weather.drops.length = 0;
    Weather.ripples.length = 0;
    Weather.leaves.length = 0;
    Weather.motes.length = 0;

    // Pre-populate particles so there's no pop-in
    for (let i = 0; i < Weather.maxDrops; i++) {
      Weather.drops.push({
        x: Math.random() * (B.view.w + 40) - 20,
        y: Math.random() * (B.view.h + 30),
        speed: U.rand(340, 480),
        len: U.rand(9, 16),
        alpha: U.rand(0.25, 0.65),
      });
    }

    for (let i = 0; i < Weather.maxLeaves; i++) {
      Weather.leaves.push({
        x: Math.random() * (B.view.w + 60) - 30,
        y: Math.random() * (B.view.h + 30),
        vx: U.rand(70, 140),
        vy: U.rand(25, 65),
        rot: Math.random() * U.TAU,
        vrot: U.rand(-4, 4),
        w: U.rand(2, 4),
        h: U.rand(2, 3),
        col: U.pick(LEAF_COLORS),
      });
    }

    for (let i = 0; i < Weather.maxMotes; i++) {
      Weather.motes.push({
        x: Math.random() * B.view.w,
        y: Math.random() * B.view.h,
        vx: U.rand(-5, 10),
        vy: U.rand(-8, 5),
        size: U.rand(1, 2),
        alpha: U.rand(0.2, 0.7),
        phase: Math.random() * 10,
      });
    }
  };

  Weather.setMode = function (m) {
    if (Weather.mode === m) return;
    Weather.mode = m;
    if (m === 'rain') {
      Weather.nextLightning = U.rand(8, 16);
      if (CH.Audio) CH.Audio.sfx('thunder');
    }
  };

  Weather.update = function (dt) {
    Weather.time += dt;
    const reduced = CH.Storage.settings && CH.Storage.settings.reduced;
    if (reduced) return;

    // Decide active weather mode based on current arena / events if not forced
    const G = CH.G;
    if (G && G.arena) {
      if (Weather.custom) {
        Weather.mode = Weather.custom;
      } else if (G.event && G.event.active && G.event.def.id === 'chickenrain') {
        Weather.mode = 'rain';
      } else if (G.arena.id === 'glitch') {
        Weather.mode = 'glitch';
      } else if (G.arena.id === 'office') {
        Weather.mode = 'none'; // corporate indoor lighting
      } else {
        // Backyard: dynamic cycle every 90 seconds
        const cycle = Math.floor(Weather.time / 80) % 3;
        Weather.mode = cycle === 0 ? 'sun' : cycle === 1 ? 'wind' : 'rain';
      }
    }

    // Update Rain
    if (Weather.mode === 'rain') {
      const dropCount = Weather.maxDrops;
      for (let i = 0; i < dropCount; i++) {
        const d = Weather.drops[i];
        if (!d) continue;
        d.x += Math.cos(Weather.windAngle) * d.speed * dt * 0.4;
        d.y += d.speed * dt;
        if (d.y > B.view.h + 10 || d.x > B.view.w + 20) {
          d.y = -10;
          d.x = Math.random() * (B.view.w + 40) - 40;
          if (Math.random() < 0.25 && Weather.ripples.length < Weather.maxRipples) {
            Weather.ripples.push({
              x: d.x,
              y: U.rand(20, B.view.h),
              r: 1,
              maxR: U.rand(3, 7),
              life: 0.3,
              maxLife: 0.3,
            });
          }
        }
      }

      // Update ripples
      for (let i = Weather.ripples.length - 1; i >= 0; i--) {
        const r = Weather.ripples[i];
        r.life -= dt;
        r.r += (r.maxR - r.r) * dt * 10;
        if (r.life <= 0) Weather.ripples.splice(i, 1);
      }

      // Lightning storm flashes
      Weather.nextLightning -= dt;
      if (Weather.nextLightning <= 0) {
        Weather.lightningT = 0.25;
        Weather.lightningAlpha = 0.55;
        Weather.nextLightning = U.rand(12, 28);
        if (CH.Audio) CH.Audio.sfx('thunder');
      }
      if (Weather.lightningT > 0) {
        Weather.lightningT -= dt;
        Weather.lightningAlpha = Math.max(0, Weather.lightningAlpha - dt * 2.2);
      }
    }

    // Update Wind / Leaves
    if (Weather.mode === 'wind' || Weather.mode === 'sun') {
      const spd = Weather.mode === 'wind' ? 1.6 : 0.7;
      for (const lf of Weather.leaves) {
        lf.x += lf.vx * spd * dt;
        lf.y += lf.vy * spd * dt + Math.sin(Weather.time * 2 + lf.x * 0.05) * 0.8;
        lf.rot += lf.vrot * dt;
        if (lf.x > B.view.w + 30 || lf.y > B.view.h + 15) {
          lf.x = -20;
          lf.y = Math.random() * (B.view.h - 10) - 10;
        }
      }
    }

    // Update Sun Dust Motes
    if (Weather.mode === 'sun') {
      for (const m of Weather.motes) {
        m.x += m.vx * dt + Math.cos(Weather.time + m.phase) * 0.3;
        m.y += m.vy * dt + Math.sin(Weather.time * 0.8 + m.phase) * 0.3;
        if (m.x < -10) m.x = B.view.w + 10;
        if (m.x > B.view.w + 10) m.x = -10;
        if (m.y < -10) m.y = B.view.h + 5;
        if (m.y > B.view.h + 5) m.y = -10;
      }
    }
  };

  /* Ground-level shader effects (puddle ripples, ground wetness) */
  Weather.drawGround = function (ctx, cam) {
    if (Weather.mode !== 'rain') return;
    const reduced = CH.Storage.settings && CH.Storage.settings.reduced;
    if (reduced) return;

    ctx.save();
    // Wet sheen overlay
    ctx.fillStyle = 'rgba(10, 24, 45, 0.07)';
    ctx.fillRect(0, 0, B.view.w, B.view.h);

    // Ripple rings
    ctx.lineWidth = 1;
    for (const r of Weather.ripples) {
      const a = (r.life / r.maxLife) * 0.45;
      ctx.strokeStyle = `rgba(180, 220, 255, ${a})`;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r * 1.5, r.r * 0.7, 0, 0, U.TAU);
      ctx.stroke();
    }
    ctx.restore();
  };

  /* Atmospheric fullscreen shader pass (rain, leaves, god rays, lightning, scanlines) */
  Weather.drawAtmosphere = function (ctx, cam, v) {
    const reduced = CH.Storage.settings && CH.Storage.settings.reduced;
    if (reduced || Weather.mode === 'none') return;

    const W = B.view.w;
    const H = B.view.h;
    ctx.save();

    // 1. SUNNY DAY: Volumetric Light Rays (God Rays) & warm dust motes
    if (Weather.mode === 'sun') {
      // Warm sun ambient grade
      ctx.fillStyle = 'rgba(255, 235, 170, 0.04)';
      ctx.fillRect(0, 0, W, H);

      // Diagonal volumetric sunbeams
      const t = Weather.time * 0.25;
      const rayAlpha = 0.06 + 0.02 * Math.sin(Weather.time * 0.7);
      const grd = ctx.createLinearGradient(0, 0, W, H);
      grd.addColorStop(0, `rgba(255, 250, 210, ${rayAlpha * 1.5})`);
      grd.addColorStop(0.5, `rgba(255, 230, 160, ${rayAlpha * 0.7})`);
      grd.addColorStop(1, 'rgba(255, 220, 140, 0)');

      ctx.fillStyle = grd;
      for (let i = 0; i < 4; i++) {
        const off = Math.sin(t + i * 1.4) * 35 + i * 110;
        ctx.beginPath();
        ctx.moveTo(off - 30, 0);
        ctx.lineTo(off + 45, 0);
        ctx.lineTo(off + 170, H);
        ctx.lineTo(off + 40, H);
        ctx.closePath();
        ctx.fill();
      }

      // Drifting sun sparkles / dust motes
      for (const m of Weather.motes) {
        const a = (m.alpha + 0.2 * Math.sin(Weather.time * 2 + m.phase)) * 0.7;
        ctx.fillStyle = `rgba(255, 245, 200, ${Math.max(0, a)})`;
        ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
      }
    }

    // 2. WIND & AUTUMN GALE: Drifting wind trails & spinning foliage
    if (Weather.mode === 'wind') {
      // Light blue-green breeze tint
      ctx.fillStyle = 'rgba(200, 240, 210, 0.025)';
      ctx.fillRect(0, 0, W, H);

      // Fast horizontal wind streaks
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const y = ((Weather.time * 40 + i * 48) % (H + 40)) - 20;
        const x = ((Weather.time * 190 + i * 85) % (W + 120)) - 60;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 55, y + 8);
        ctx.stroke();
      }

      // Swirling leaves / petals
      for (const lf of Weather.leaves) {
        ctx.save();
        ctx.translate(lf.x, lf.y);
        ctx.rotate(lf.rot);
        ctx.fillStyle = lf.col;
        ctx.fillRect(-lf.w / 2, -lf.h / 2, lf.w, lf.h);
        ctx.restore();
      }
    }

    // 3. RAIN & THUNDERSTORM: Slanted streaks, atmospheric dark tint, lightning flash
    if (Weather.mode === 'rain') {
      // Storm mood tint
      ctx.fillStyle = 'rgba(20, 35, 60, 0.14)';
      ctx.fillRect(0, 0, W, H);

      // Rain streaks
      ctx.lineWidth = 1;
      for (const d of Weather.drops) {
        ctx.strokeStyle = `rgba(180, 215, 255, ${d.alpha * 0.75})`;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + Math.cos(Weather.windAngle) * d.len * 0.5, d.y + d.len);
        ctx.stroke();
      }

      // Lightning screen flash
      if (Weather.lightningAlpha > 0.01) {
        ctx.fillStyle = `rgba(240, 245, 255, ${Weather.lightningAlpha})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // 4. GLITCH STORM: Digital scanlines & chromatic distortion
    if (Weather.mode === 'glitch') {
      // Horizontal digital scanlines
      ctx.fillStyle = 'rgba(0, 255, 208, 0.035)';
      const scanY = Math.floor((Weather.time * 60) % 6);
      for (let y = scanY; y < H; y += 6) {
        ctx.fillRect(0, y, W, 1);
      }

      // Random glitch slice bursts
      if (Math.random() < 0.12) {
        const gy = U.randInt(10, H - 30);
        const gh = U.randInt(2, 8);
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255, 0, 170, 0.18)' : 'rgba(0, 255, 208, 0.18)';
        ctx.fillRect(0, gy, W, gh);
      }
    }

    ctx.restore();
  };

  Weather.init();
})(window.CH);

