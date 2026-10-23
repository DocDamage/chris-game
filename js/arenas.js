/* CHAOS.exe - three procedurally decorated arenas.
   The static floor is baked once per arena into an offscreen canvas;
   Props (trees, rocks, bushes, flowers, furniture, ruins) are stored as interactive,
   depth-sorted entities with collision boxes, wind/walk sway, and tree chopping! */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const S = CH.Sprites;

  const Arenas = (CH.Arenas = {});

  const THEMES = {
    backyard: { id: 'backyard', name: 'The Broken Backyard', tag: 'Gnomes are watching.', clear: '#3d7a2e', music: 'court', amb: 'amb_backyard', weather: 'sun' },
    office: { id: 'office', name: 'Corporate Hell', tag: 'Circle back to your doom.', clear: '#3a4560', music: 'combat', amb: 'amb_office', weather: 'sun' },
    glitch: { id: 'glitch', name: 'The Glitch Dimension', tag: 'Reality.exe has stopped working.', clear: '#1b1226', music: 'combat', amb: 'amb_glitch', weather: 'glitch' },
    zombie: { id: 'zombie', name: 'The Outbreak City', tag: 'The dead do not stay down.', clear: '#2a2d34', music: 'combat', amb: 'amb_rain', weather: 'rain' },
    wasteland: { id: 'wasteland', name: 'Scrapyard Wasteland', tag: 'Rust, radiation, and survival.', clear: '#4a3b2c', music: 'theme', amb: 'amb_wind', weather: 'wind' },
    volcano: { id: 'volcano', name: 'The Molten Caldera', tag: 'Watch your step on the crust.', clear: '#3a1810', music: 'dungeon', amb: 'amb_glitch', weather: 'sun' },
    dungeon: { id: 'dungeon', name: 'Psychological Crypt', tag: 'The walls have thoughts.', clear: '#1c1824', music: 'dungeon', amb: 'amb_glitch', weather: 'rain' },
    frozen: { id: 'frozen', name: 'The Frozen Pass', tag: 'Do not lick the walls.', clear: '#c9dcea', music: 'dungeon', amb: 'amb_wind', weather: 'wind' },
  };
  Arenas.THEMES = THEMES;
  Arenas.themes = THEMES;

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function speckle(g, x, y, w, h, colors, n) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = U.pick(colors);
      g.fillRect(Math.floor(x + Math.random() * w), Math.floor(y + Math.random() * h), 1, 1);
    }
  }

  function stamp(g, name, x, y, o) {
    const s = S.get(name, o && o.variant);
    const f = (o && o.frame) || 0;
    if (s && s.frames && s.frames[f]) {
      g.drawImage(s.frames[f], Math.round(x - s.ax), Math.round(y - s.ay));
    }
  }

  function tileFloor(g, imgKey, W, H) {
    const img = CH.Assets.images[imgKey];
    if (img) {
      const pat = g.createPattern(img, 'repeat');
      g.fillStyle = pat;
      g.fillRect(0, 0, W, H);
    }
  }

  function edgePoint(W, H, m, depth) {
    const side = Math.floor(Math.random() * 4);
    const t = Math.random();
    const d = m + 8 + Math.random() * depth;
    if (side === 0) return { x: 40 + t * (W - 80), y: d + 18 };
    if (side === 1) return { x: 40 + t * (W - 80), y: H - d - 10 };
    if (side === 2) return { x: d + 12, y: 50 + t * (H - 100) };
    return { x: W - d - 12, y: 50 + t * (H - 100) };
  }

  function addProp(props, name, x, y, opt) {
    opt = opt || {};
    let kind = opt.kind || 'other';
    let cr = opt.cr || 10;
    let solid = opt.solid !== undefined ? opt.solid : false;
    let swayable = opt.swayable !== undefined ? opt.swayable : false;
    let choppable = opt.choppable !== undefined ? opt.choppable : false;
    let destructible = opt.destructible !== undefined ? opt.destructible : false;
    let jumpable = opt.jumpable !== undefined ? opt.jumpable : false;
    let elevation = opt.elevation || 10;
    let resourceType = opt.resourceType || 'wood';
    let resourceAmt = opt.resourceAmt || 2;
    let hp = opt.hp || 0;
    let cx = opt.cx !== undefined ? opt.cx : 0;
    let cy = opt.cy !== undefined ? opt.cy : -4;

    const lower = name.toLowerCase();
    if (lower.includes('tree')) {
      kind = 'tree';
      cr = 11;
      solid = true;
      swayable = true;
      choppable = true;
      jumpable = false;
      resourceType = 'wood';
      resourceAmt = 4;
      hp = 40;
    } else if (lower.includes('car')) {
      kind = 'car';
      cr = 16;
      solid = true;
      jumpable = true;
      elevation = 12;
      destructible = true;
      resourceType = 'scrap';
      resourceAmt = 6;
      hp = 80;
    } else if (lower.includes('barricade') || lower.includes('roadblock')) {
      kind = 'barricade';
      cr = 14;
      solid = true;
      jumpable = true;
      elevation = 10;
      destructible = true;
      resourceType = 'scrap';
      resourceAmt = 3;
      hp = 60;
    } else if (lower.includes('fence')) {
      kind = 'fence';
      cr = 10;
      solid = true;
      jumpable = false;
      destructible = true;
      resourceType = 'scrap';
      resourceAmt = 2;
      hp = 40;
    } else if (lower.includes('barrel') || lower.includes('toxic')) {
      kind = 'barrel';
      cr = 9;
      solid = true;
      jumpable = true;
      elevation = 11;
      destructible = true;
      resourceType = 'scrap';
      resourceAmt = 2;
      hp = 30;
    } else if (lower.includes('crate')) {
      kind = 'crate';
      cr = 10;
      solid = true;
      jumpable = true;
      elevation = 13;
      destructible = true;
      resourceType = 'wood';
      resourceAmt = 3;
      hp = 35;
    } else if (lower.includes('pillar') || lower.includes('column')) {
      kind = 'pillar';
      cr = 14;
      solid = true;
      jumpable = false;
      destructible = true;
      resourceType = 'stone';
      resourceAmt = 5;
      hp = 90;
    } else if (lower.includes('altar')) {
      kind = 'altar';
      cr = 15;
      solid = true;
      jumpable = true;
      elevation = 12;
      destructible = true;
      resourceType = 'stone';
      resourceAmt = 4;
      hp = 70;
    } else if (lower.includes('rock') || lower.includes('stone') || lower.includes('rubble') || lower.includes('statue') || lower.includes('jar')) {
      kind = 'rock';
      cr = lower.includes('big') || lower.includes('stone') ? 14 : 9;
      solid = true;
      jumpable = !lower.includes('big');
      elevation = 9;
      destructible = true;
      resourceType = 'stone';
      resourceAmt = 3;
      hp = 50;
    } else if (lower.includes('bush') || lower.includes('plant')) {
      kind = 'bush';
      cr = 10;
      solid = false;
      swayable = true;
    } else if (lower.includes('fl_') || lower.includes('flower') || lower.includes('tuft')) {
      kind = 'grass';
      cr = 6;
      solid = false;
      swayable = true;
    } else if (lower.includes('desk') || lower.includes('cooler') || lower.includes('cubicle') || lower.includes('vending') || lower.includes('couch') || lower.includes('tire') || lower.includes('sh_')) {
      kind = 'furniture';
      cr = lower.includes('desk') || lower.includes('cubicle') ? 16 : 12;
      solid = true;
      jumpable = true;
      elevation = 10;
      destructible = true;
      resourceType = 'scrap';
      resourceAmt = 3;
      hp = 50;
    }

    // hitbox from the picture: a crate or a pillar blocks about a third of its sprite's width (trees keep the trunk);
    // catalogued pieces bring a box footprint instead (opt.box, js/props.js)
    const sp = solid && kind !== 'tree' && kind !== 'fire' && !opt.box ? S.get(name) : null;
    if (sp && sp.w) cr = Math.max(cr, Math.min(26, Math.round(sp.w * 0.36)));
    if (opt.box) cr = Math.max(opt.box.hw, opt.box.hh);
    props.push({
      id: 'prop_' + props.length,
      box: opt.box || null,
      cat: opt.cat || null,
      kind,
      sprite: name,
      x: Math.round(x),
      y: Math.round(y),
      hp,
      maxHp: hp,
      cr,
      cx,
      cy,
      solid,
      swayable,
      choppable,
      jumpable,
      elevation,
      destructible,
      resourceType,
      resourceAmt,
      falling: false,
      fallT: 0,
      fallDir: 1,
      dead: false,
      shake: 0,
      bend: 0,
      rustle: 0,
    });
  }

  /* ---------------- backyard (procedural fallback) ---------------- */
  function buildBackyard(W, H, m, g, anim, props) {
    g.fillStyle = '#5fb347';
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 14) {
      g.fillStyle = (y / 14) % 2 ? '#58ab40' : '#62b84b';
      g.fillRect(0, y, W, 7);
    }
    speckle(g, 0, 0, W, H, ['#4a9b3a', '#76cc5a', '#4a9b3a'], Math.round(W * H * 0.005));

    // central dirt patch
    const blobs = [[W / 2, H / 2, W * 0.22, H * 0.22]];
    for (let i = 0; i < 18; i++) {
      blobs.push([W / 2 + U.rand(-W * 0.35, W * 0.35), H / 2 + U.rand(-H * 0.35, H * 0.35), U.rand(80, 200), U.rand(60, 140)]);
    }
    for (const [cx, cy, rx, ry] of blobs) {
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
        for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          const d = dx * dx + dy * dy;
          if (d <= 1) {
            g.fillStyle = d > 0.85 ? '#d1a964' : (x + y) % 7 === 0 ? '#eacb85' : '#e8c982';
            g.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    // Trees
    for (let x = 40; x < W - 40; x += U.randInt(60, 100)) {
      addProp(props, 'bush', x, m + U.randInt(20, 40));
    }
    for (let i = 0; i < 45; i++) {
      const p = edgePoint(W, H, m, 180);
      addProp(props, 'bush', p.x, p.y);
    }
    for (let i = 0; i < 60; i++) {
      const x = U.rand(m + 30, W - m - 30);
      const y = U.rand(m + 30, H - m - 30);
      addProp(props, 'flower', x, y);
    }
    for (let i = 0; i < 8; i++) {
      const p = edgePoint(W, H, m, 120);
      addProp(props, 'couch', p.x, p.y);
    }
    for (let i = 0; i < 8; i++) {
      const p = edgePoint(W, H, m, 100);
      addProp(props, 'tire', p.x, p.y);
    }

    // Fence border
    g.fillStyle = '#6b4a2a';
    g.fillRect(0, 0, W, m);
    g.fillRect(0, H - m, W, m);
    g.fillRect(0, 0, m, H);
    g.fillRect(W - m, 0, m, H);
    for (let x = 0; x < W; x += 12) {
      stamp(g, 'fence', x + 6, m - 1);
      stamp(g, 'fence', x + 6, H - 1);
    }
    for (let y = 8; y < H; y += 12) {
      g.fillStyle = (y / 12) % 2 ? '#ead4aa' : '#c8a674';
      g.fillRect(0, y, m, 10);
      g.fillRect(W - m, y, m, 10);
      g.fillStyle = '#8b5a2b';
      g.fillRect(0, y + 9, m, 1);
      g.fillRect(W - m, y + 9, m, 1);
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(m, m, W - m * 2, 3);
    g.fillRect(m, m, 3, H - m * 2);
  }

  /* ---------------- valley (asset tiles) ---------------- */
  const PLAIN = { grass: [[1, 1]], sand: [[1, 1]], rock: [[1, 1]] };

  function tileFloor(g, key, W, H) {
    const im = CH.Assets.images[key];
    if (!im) return;
    const list = PLAIN[key.split('.')[1]] || [[1, 1]];
    for (let y = 0; y < H; y += 16) {
      for (let x = 0; x < W; x += 16) {
        const t = U.pick(list);
        g.drawImage(im, t[0] * 16, t[1] * 16, 16, 16, x, y, 16, 16);
        if (Math.random() < 0.45) {
          const n = U.randInt(2, 5);
          for (let i = 0; i < n; i++) {
            g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
            g.fillRect(x + U.randInt(0, 14), y + U.randInt(0, 14), U.randInt(1, 3), U.randInt(1, 2));
          }
        }
      }
    }
  }

  function sandClearing(g, W, H) {
    const mask = canvas(W, H);
    const mg = mask.getContext('2d');
    mg.fillStyle = '#fff';
    const blobs = [[W / 2, H / 2, W * 0.22, H * 0.22]];
    for (let i = 0; i < 16; i++) {
      blobs.push([W / 2 + U.rand(-W * 0.35, W * 0.35), H / 2 + U.rand(-H * 0.35, H * 0.35), U.rand(110, 260), U.rand(80, 180)]);
    }
    for (const [cx, cy, rx, ry] of blobs) {
      mg.beginPath();
      mg.ellipse(cx, cy, rx, ry, 0, 0, U.TAU);
      mg.fill();
    }
    const md = mg.getImageData(0, 0, W, H);
    const a = md.data;
    const inside = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) inside[i] = a[i * 4 + 3] > 128 ? 1 : 0;
    const sand = canvas(W, H);
    tileFloor(sand.getContext('2d'), 'tile.sand', W, H);
    const sg = sand.getContext('2d');
    const sd = sg.getImageData(0, 0, W, H);
    const out = sg.createImageData(W, H);
    const rim = [209, 169, 100];
    const rim2 = [226, 190, 125];
    const shade = [58, 120, 48];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let near = 0;
        if (inside[i]) {
          for (let d = 1; d <= 3 && !near; d++) {
            if (x - d < 0 || y - d < 0 || x + d >= W || y + d >= H || !inside[i - d] || !inside[i + d] || !inside[i - d * W] || !inside[i + d * W]) near = d;
          }
          const o = i * 4;
          if (near === 1 || near === 2) {
            const c = near === 1 ? rim : rim2;
            out.data[o] = c[0];
            out.data[o + 1] = c[1];
            out.data[o + 2] = c[2];
            out.data[o + 3] = 255;
          } else {
            out.data[o] = sd.data[o];
            out.data[o + 1] = sd.data[o + 1];
            out.data[o + 2] = sd.data[o + 2];
            out.data[o + 3] = 255;
          }
        } else if (x > 0 && y > 0 && x < W - 1 && y < H - 1 && (inside[i - 1] || inside[i + 1] || inside[i - W] || inside[i + W])) {
          const o = i * 4;
          out.data[o] = shade[0];
          out.data[o + 1] = shade[1];
          out.data[o + 2] = shade[2];
          out.data[o + 3] = 200;
        }
      }
    }
    sg.putImageData(out, 0, 0);
    g.drawImage(sand, 0, 0);
  }

  function buildValley(W, H, m, g, anim, props) {
    tileFloor(g, 'tile.grass', W, H);
    sandClearing(g, W, H);

    // 1. Flowers & Grass tufts across the vast meadows
    const flowers = ['sun1', 'sun2', 'sun3', 'sun4', 'lavender1', 'lavender2', 'pink1', 'hydrangeaP1', 'hydrangeaP2', 'hydrangeaB1', 'hydrangeaB2', 'violet', 'orange', 'tuft1', 'tuft2', 'tuftTall1', 'tuftTall2', 'tuftTall3'];
    for (let i = 0; i < 220; i++) {
      const x = U.rand(m + 20, W - m - 20);
      const y = U.rand(m + 40, H - m - 20);
      const center = Math.abs(x - W / 2) < 320 && Math.abs(y - H / 2) < 200;
      if (center && Math.random() < 0.85) continue;
      addProp(props, 'obj.fl_' + U.pick(flowers), x, y);
    }

    // 2. Bushes & shrubs (soft / walk-through with sway)
    const bushTypes = ['bush1', 'bush2', 'bush3', 'bush4', 'bush5', 'bush6'];
    for (let i = 0; i < 90; i++) {
      const p = edgePoint(W, H, m, 220);
      addProp(props, 'obj.' + U.pick(bushTypes), p.x, p.y);
    }

    // 3. Rocks, standing stones, ruins (solid collision!)
    const edgeProps = ['rocks1', 'rocks2', 'rockStack', 'mossRocks1', 'mossRocks2', 'mossStack', 'bigRocks', 'standingStone', 'pillar1', 'pillar2', 'pillar3', 'jarClay', 'jarBlue', 'statue'];
    for (let i = 0; i < 70; i++) {
      const p = edgePoint(W, H, m, 240);
      addProp(props, 'obj.' + U.pick(edgeProps), p.x, p.y);
    }

    // 4. Backyard furniture
    for (let i = 0; i < 6; i++) {
      const couch = edgePoint(W, H, m, 160);
      addProp(props, 'couch', couch.x, couch.y);
    }
    for (let i = 0; i < 8; i++) {
      const p = edgePoint(W, H, m, 180);
      addProp(props, 'tire', p.x, p.y);
    }
    for (let i = 0; i < 4; i++) {
      const gr = edgePoint(W, H, m, 200);
      anim.push({ sprite: 'grill', x: gr.x, y: gr.y, n: 2, rate: 2, ph: 0 });
    }
    for (let i = 0; i < 14; i++) {
      const p = edgePoint(W, H, m, 220);
      anim.push({ sprite: 'gnome', x: p.x, y: p.y, n: 2, rate: 0.35, ph: Math.random() * 9, blink: true });
    }

    // 5. Trees along top border + forest groves in corners & meadows (solid trunk, swayable, choppable!)
    const treeTypes = ['tree1', 'tree2', 'tree3', 'treeAutumn1', 'treeAutumn2', 'treeAutumn3', 'treeDark1', 'treeDark2'];
    // Top border forest wall
    for (let x = 30; x < W - 30; x += U.randInt(55, 85)) {
      addProp(props, 'obj.' + U.pick(treeTypes), x, m + U.randInt(22, 38));
    }
    // Left & right border trees
    for (let y = m + 90; y < H - m - 60; y += U.randInt(70, 110)) {
      addProp(props, 'obj.' + U.pick(treeTypes), m + U.randInt(14, 40), y);
      addProp(props, 'obj.' + U.pick(treeTypes), W - m - U.randInt(14, 40), y);
    }
    // Scattered groves across the expanded valley
    for (let i = 0; i < 35; i++) {
      const p = edgePoint(W, H, m, 280);
      addProp(props, 'obj.' + U.pick(treeTypes), p.x, p.y);
    }

    // Fence border
    const fh = CH.Sprites.get('obj.fenceH');
    if (fh && fh.frames && fh.frames[0]) {
      const stampFence = (x, y, rot) => {
        g.save();
        g.translate(x, y);
        g.rotate(rot);
        g.drawImage(fh.frames[0], -fh.ax, -fh.ay);
        g.restore();
      };
      for (let x = 18; x < W + 18; x += 34) {
        stampFence(x, m - 1, 0);
        stampFence(x, H + 3, 0);
      }
      for (let y = 30; y < H; y += 34) {
        stampFence(m - 2, y, Math.PI / 2);
        stampFence(W - m + 2, y, -Math.PI / 2);
      }
    }
  }

  /* ---------------- corporate hell ---------------- */
  function buildOffice(W, H, m, g, anim, props) {
    g.fillStyle = '#5d6b8a';
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 16) {
      for (let x = 0; x < W; x += 16) {
        g.fillStyle = (x / 16 + y / 16) % 2 ? '#667597' : '#5d6b8a';
        g.fillRect(x, y, 16, 16);
      }
    }
    speckle(g, 0, 0, W, H, ['#55627f', '#7482a3', '#4a5672'], Math.round(W * H * 0.006));
    g.fillStyle = 'rgba(27,18,38,0.25)';
    for (let x = 0; x < W; x += 16) g.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += 16) g.fillRect(0, y, W, 1);

    // Hazard tape perimeter in the middle
    g.fillStyle = '#feae34';
    const cw = Math.round(W * 0.35);
    const ch = Math.round(H * 0.35);
    const cx = W / 2 - cw / 2;
    const cy = H / 2 - ch / 2;
    for (let i = 0; i < cw; i += 8) {
      g.fillStyle = (i / 8) % 2 ? '#feae34' : '#1b1226';
      g.fillRect(cx + i, cy, 8, 2);
      g.fillRect(cx + i, cy + ch, 8, 2);
    }
    for (let i = 0; i < ch; i += 8) {
      g.fillStyle = (i / 8) % 2 ? '#feae34' : '#1b1226';
      g.fillRect(cx, cy + i, 2, 8);
      g.fillRect(cx + cw - 2, cy + i, 2, 8);
    }

    // Office props as solid depth-sorted entities
    for (let i = 0; i < 25; i++) {
      const p = edgePoint(W, H, m, 260);
      if (p.y < m + 40) p.y = m + 45;
      anim.push({ sprite: 'desk', x: p.x, y: p.y, n: 2, rate: 3 + Math.random() * 3, ph: Math.random() * 5, flicker: true });
      addProp(props, 'desk', p.x, p.y);
    }
    for (let i = 0; i < 15; i++) {
      const p = edgePoint(W, H, m, 180);
      if (p.y < m + 40) p.y = m + 45;
      anim.push({ sprite: 'vending', x: p.x, y: p.y, n: 2, rate: 5 + Math.random() * 3, ph: Math.random() * 5, flicker: true });
      addProp(props, 'vending', p.x, p.y);
    }
    for (let i = 0; i < 28; i++) {
      const p = edgePoint(W, H, m, 160);
      if (p.y < m + 40) p.y = m + 45;
      addProp(props, Math.random() < 0.65 ? 'plant' : 'cooler', p.x, p.y);
    }

    // Top wall with windows into hell
    g.fillStyle = '#4a4560';
    g.fillRect(0, 0, W, m + 22);
    for (let x = 20; x < W - 40; x += 75) {
      g.fillStyle = '#1b1226';
      g.fillRect(x - 1, 3, 52, 30);
      const grd = g.createLinearGradient(0, 4, 0, 32);
      grd.addColorStop(0, '#a22633');
      grd.addColorStop(0.6, '#f77622');
      grd.addColorStop(1, '#feae34');
      g.fillStyle = grd;
      g.fillRect(x, 4, 50, 28);
      g.fillStyle = '#1b1226';
      g.fillRect(x + 24, 4, 2, 28);
      g.fillRect(x, 17, 50, 2);
    }
    g.fillStyle = '#1b1226';
    g.fillRect(0, m + 22, W, 2);

    // Walls & cubicles
    g.fillStyle = '#4a4560';
    g.fillRect(0, 0, m, H);
    g.fillRect(W - m, 0, m, H);
    g.fillRect(0, H - m, W, m);
    for (let x = 8; x < W - 30; x += 45) stamp(g, 'cubicle', x + 17, H - 1);
  }

  /* ---------------- glitch dimension ---------------- */
  function buildGlitch(W, H, m, g, anim, props) {
    g.fillStyle = '#1b1226';
    g.fillRect(0, 0, W, H);
    const tiled = CH.Art.on && CH.Assets.images['tile.rock'];
    if (tiled) {
      tileFloor(g, 'tile.rock', W, H);
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = '#8e66cc';
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(14,4,30,0.22)';
      g.fillRect(0, 0, W, H);
    } else {
      for (let y = 0; y < H; y += 20) {
        for (let x = 0; x < W; x += 20) {
          g.fillStyle = (x / 20 + y / 20) % 2 ? '#24173a' : '#2b1d46';
          g.fillRect(x, y, 20, 20);
        }
      }
    }
    g.fillStyle = tiled ? 'rgba(120,70,200,0.35)' : '#4a2f7a';
    for (let x = 0; x < W; x += 20) g.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += 20) g.fillRect(0, y, W, 1);

    // Cursed ruins & dead trees as solid depth-sorted entities
    const ruins = ['pillar1', 'pillar2', 'pillar3', 'pillar4', 'mossRocks1', 'rocks2', 'deadTree1', 'deadTree2', 'deadTree3', 'standingStone', 'bigRocks', 'statue'];
    for (let i = 0; i < 75; i++) {
      const p = edgePoint(W, H, m, 240);
      addProp(props, 'obj.' + U.pick(ruins), p.x, p.y);
    }

    // Floating glitch debris
    for (let i = 0; i < 35; i++) {
      anim.push({ sprite: 'glitchblock', x: U.rand(30, W - 30), y: U.rand(30, H - 30), n: 3, rate: 6, ph: Math.random() * 9, drift: true, vx: U.rand(-8, 8), vy: U.rand(-8, 8) });
    }

    // Neon borders
    const cols = ['#00ffd0', '#ff00aa', '#3b6fe0', '#6b2d8b', '#ffffff'];
    for (let i = 0; i < m; i++) {
      g.fillStyle = i < 3 ? '#ff00aa' : i < 6 ? '#6b2d8b' : '#120a22';
      g.fillRect(i, 0, 1, H);
      g.fillRect(W - 1 - i, 0, 1, H);
      g.fillRect(0, i, W, 1);
      g.fillRect(0, H - 1 - i, W, 1);
    }
    for (let i = 0; i < 300; i++) {
      g.fillStyle = U.pick(cols);
      const side = U.randInt(0, 3);
      const t = U.rand(0, side < 2 ? W : H);
      const d = U.rand(0, m - 4);
      if (side === 0) g.fillRect(t, d, U.randInt(2, 12), 1);
      else if (side === 1) g.fillRect(t, H - 1 - d, U.randInt(2, 12), 1);
      else if (side === 2) g.fillRect(d, t, 1, U.randInt(2, 12));
      else g.fillRect(W - 1 - d, t, 1, U.randInt(2, 12));
    }
  }

  /* ---------------- zombie city (The Outbreak City) ---------------- */
  function buildZombieCity(W, H, m, g, anim, props) {
    g.fillStyle = '#262930';
    g.fillRect(0, 0, W, H);
    if (CH.Art.on && CH.Assets.images['tile.zombie_street']) {
      tileFloor(g, 'tile.zombie_street', W, H);
    } else {
      speckle(g, 0, 0, W, H, ['#1f2128', '#2d313b', '#181a1f'], Math.round(W * H * 0.008));
    }
    // Crosswalks and road asphalt markings
    g.fillStyle = 'rgba(230,230,230,0.2)';
    for (let x = m + 80; x < W - m - 80; x += 180) {
      for (let y = m + 60; y < H - m - 60; y += 80) {
        g.fillRect(x, y, 16, 40);
      }
    }
    // Burned marks
    if (CH.Art.on && CH.Assets.images['tile.zombie_burned']) {
      for (let i = 0; i < 18; i++) {
        const bx = U.rand(m + 100, W - m - 100);
        const by = U.rand(m + 100, H - m - 100);
        const img = CH.Assets.images['tile.zombie_burned'];
        g.drawImage(img, bx, by);
      }
    }
    // Concrete & brick borders
    g.fillStyle = '#181b22';
    g.fillRect(0, 0, W, m);
    g.fillRect(0, H - m, W, m);
    g.fillRect(0, 0, m, H);
    g.fillRect(W - m, 0, m, H);

    // Props: Abandoned cars, roadblocks, street lamps, barricades
    const cars = ['obj.car1', 'obj.car2', 'obj.car3'];
    for (let i = 0; i < 28; i++) {
      const p = edgePoint(W, H, m, 260);
      addProp(props, U.pick(cars), p.x, p.y);
    }
    for (let i = 0; i < 35; i++) {
      const p = edgePoint(W, H, m, 240);
      addProp(props, 'obj.roadblock', p.x, p.y);
    }
    for (let x = m + 80; x < W - m - 80; x += 160) {
      addProp(props, 'obj.street_lamp', x, m + 14);
      addProp(props, 'obj.street_lamp', x, H - m - 14);
    }
    for (let i = 0; i < 40; i++) {
      const p = edgePoint(W, H, m, 220);
      addProp(props, 'obj.barricade1', p.x, p.y);
    }
  }

  /* ---------------- wasteland (Scrapyard Wasteland) ---------------- */
  function buildWasteland(W, H, m, g, anim, props) {
    g.fillStyle = '#3d3023';
    g.fillRect(0, 0, W, H);
    if (CH.Art.on && CH.Assets.images['tile.wl_ground']) {
      tileFloor(g, 'tile.wl_ground', W, H);
    } else {
      speckle(g, 0, 0, W, H, ['#4a3b2b', '#2e2419', '#574533'], Math.round(W * H * 0.008));
    }
    // Rusted scrap metal plate patches
    if (CH.Art.on && CH.Assets.images['tile.wl_metal']) {
      for (let i = 0; i < 20; i++) {
        const mx = U.rand(m + 80, W - m - 80);
        const my = U.rand(m + 80, H - m - 80);
        const img = CH.Assets.images['tile.wl_metal'];
        g.drawImage(img, mx, my);
      }
    }
    // Perimeter chain link fences
    g.fillStyle = '#261e16';
    g.fillRect(0, 0, W, m);
    g.fillRect(0, H - m, W, m);
    g.fillRect(0, 0, m, H);
    g.fillRect(W - m, 0, m, H);
    for (let x = m; x < W - m; x += 36) {
      addProp(props, 'obj.chain_fence1', x, m + 8);
      addProp(props, 'obj.chain_fence1', x, H - m - 8);
    }
    // Props: cars, barricades, sandbags, toxic barrels, rubble, dead trees
    const cars = ['obj.car1', 'obj.car2', 'obj.car3'];
    for (let i = 0; i < 30; i++) {
      const p = edgePoint(W, H, m, 280);
      addProp(props, U.pick(cars), p.x, p.y);
    }
    for (let i = 0; i < 35; i++) {
      const p = edgePoint(W, H, m, 240);
      addProp(props, 'obj.barricade2', p.x, p.y);
    }
    for (let i = 0; i < 35; i++) {
      const p = edgePoint(W, H, m, 240);
      addProp(props, 'obj.toxic_barrel', p.x, p.y);
    }
    for (let i = 0; i < 40; i++) {
      const p = edgePoint(W, H, m, 220);
      addProp(props, 'obj.rubble', p.x, p.y);
    }
    for (let i = 0; i < 20; i++) {
      const p = edgePoint(W, H, m, 250);
      addProp(props, 'obj.deadTree1', p.x, p.y);
    }
  }

  /* ---------------- volcano (The Molten Caldera) ---------------- */
  function buildVolcano(W, H, m, g, anim, props) {
    g.fillStyle = '#22110c';
    g.fillRect(0, 0, W, H);
    // The floor art is one rock tile. Repeating it gives a plain grid, so it is laid down as overlapping, randomly
    // flipped patches over a dark base, then veined with glowing lava cracks and dusted with ash and embers.
    const floor = CH.Art.on && CH.Assets.images['tile.volcano_floor'];
    if (floor) {
      const tw = floor.width;
      const th = floor.height;
      for (let y = -th; y < H + th; y += Math.round(th * 0.62)) {
        for (let x = -tw; x < W + tw; x += Math.round(tw * 0.62)) {
          g.save();
          g.globalAlpha = 0.55 + Math.random() * 0.4;
          g.translate(x + U.rand(-8, 8) + tw / 2, y + U.rand(-8, 8) + th / 2);
          g.rotate((Math.floor(Math.random() * 4) * Math.PI) / 2);
          if (Math.random() < 0.5) g.scale(-1, 1);
          g.drawImage(floor, -tw / 2, -th / 2);
          g.restore();
        }
      }
      g.globalAlpha = 1;
    } else {
      speckle(g, 0, 0, W, H, ['#180c08', '#2e140d', '#3d1c12'], Math.round(W * H * 0.008));
    }
    // big soft blotches of shadow and heat break up the repetition
    for (let i = 0; i < Math.round((W * H) / 26000); i++) {
      const bx = U.rand(0, W);
      const by = U.rand(0, H);
      const br = U.rand(60, 170);
      const gr = g.createRadialGradient(bx, by, 4, bx, by, br);
      const hot = Math.random() < 0.3;
      gr.addColorStop(0, hot ? 'rgba(200,70,20,0.16)' : 'rgba(10,3,2,0.30)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    // lava cracks: branching random walks drawn dark, orange, then bright
    const veins = [];
    for (let i = 0; i < Math.round((W * H) / 70000); i++) {
      let x = U.rand(m + 40, W - m - 40);
      let y = U.rand(m + 40, H - m - 40);
      let a = U.rand(0, Math.PI * 2);
      const pts = [[x, y]];
      const n = U.randInt(10, 26);
      for (let s = 0; s < n; s++) {
        a += U.rand(-0.7, 0.7);
        x += Math.cos(a) * U.rand(9, 18);
        y += Math.sin(a) * U.rand(9, 18);
        pts.push([x, y]);
        if (Math.random() < 0.12) veins.push([[x, y], [x + Math.cos(a + 1) * 14, y + Math.sin(a + 1) * 14], [x + Math.cos(a + 1.3) * 30, y + Math.sin(a + 1.3) * 30]]);
      }
      veins.push(pts);
    }
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const pass of [[8, 'rgba(60,12,4,0.55)'], [4, 'rgba(228,87,46,0.85)'], [2, 'rgba(255,170,60,0.95)'], [1, 'rgba(255,232,150,0.9)']]) {
      g.lineWidth = pass[0];
      g.strokeStyle = pass[1];
      for (const v of veins) {
        g.beginPath();
        g.moveTo(v[0][0], v[0][1]);
        for (let k = 1; k < v.length; k++) g.lineTo(v[k][0], v[k][1]);
        g.stroke();
      }
    }
    // ash specks and embers
    speckle(g, 0, 0, W, H, ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.18)', 'rgba(255,140,60,0.18)'], Math.round(W * H * 0.004));
    // Obsidian borders
    g.fillStyle = '#140805';
    g.fillRect(0, 0, W, m);
    g.fillRect(0, H - m, W, m);
    g.fillRect(0, 0, m, H);
    g.fillRect(W - m, 0, m, H);

    // Props: volcanic pillars, rock formations, spike hazards
    for (let i = 0; i < 36; i++) {
      const p = edgePoint(W, H, m, 260);
      addProp(props, i % 2 ? 'obj.volcano_pillar1' : 'obj.volcano_pillar2', p.x, p.y);
    }
    for (let i = 0; i < 45; i++) {
      const p = edgePoint(W, H, m, 240);
      addProp(props, 'obj.volcano_rock', p.x, p.y);
    }
    for (let i = 0; i < 30; i++) {
      const p = edgePoint(W, H, m, 220);
      addProp(props, 'obj.volcano_spikes', p.x, p.y);
    }
  }

  /* ---------------- dungeon (Psychological Horror Crypt) ---------------- */
  function buildDungeon(W, H, m, g, anim, props) {
    g.fillStyle = '#14121a';
    g.fillRect(0, 0, W, H);
    if (CH.Art.on && CH.Assets.images['tile.dungeon_floor']) {
      tileFloor(g, 'tile.dungeon_floor', W, H);
    } else {
      speckle(g, 0, 0, W, H, ['#0d0c12', '#1c1824', '#262233'], Math.round(W * H * 0.008));
    }
    // Brick walls and crypt borders
    g.fillStyle = '#0a090e';
    g.fillRect(0, 0, W, m);
    g.fillRect(0, H - m, W, m);
    g.fillRect(0, 0, m, H);
    g.fillRect(W - m, 0, m, H);

    // Props: columns, dungeon crates, barrels, occult altars
    for (let i = 0; i < 38; i++) {
      const p = edgePoint(W, H, m, 260);
      addProp(props, 'obj.dungeon_column', p.x, p.y);
    }
    for (let i = 0; i < 40; i++) {
      const p = edgePoint(W, H, m, 240);
      addProp(props, 'obj.dungeon_crate', p.x, p.y);
    }
    for (let i = 0; i < 35; i++) {
      const p = edgePoint(W, H, m, 220);
      addProp(props, 'obj.dungeon_barrel', p.x, p.y);
    }
    for (let i = 0; i < 16; i++) {
      const p = edgePoint(W, H, m, 250);
      addProp(props, 'obj.occult_altar', p.x, p.y);
    }
    for (let i = 0; i < 20; i++) {
      const p = edgePoint(W, H, m, 200);
      addProp(props, 'obj.statue', p.x, p.y);
    }
  }

  const BUILD = {
    backyard: (W, H, m, g, anim, props) => (CH.Art.on && CH.Assets.images['tile.grass'] ? buildValley(W, H, m, g, anim, props) : buildBackyard(W, H, m, g, anim, props)),
    office: buildOffice,
    glitch: buildGlitch,
    zombie: buildZombieCity,
    wasteland: buildWasteland,
    volcano: buildVolcano,
    dungeon: buildDungeon,
  };

  Arenas.build = function (id) {
    const theme = THEMES[id] || THEMES.backyard;
    const W = B.arena.w;
    const H = B.arena.h;
    const bg = canvas(W, H);
    const g = bg.getContext('2d');
    const anim = [];
    const props = [];
    BUILD[theme.id](W, H, B.arena.margin, g, anim, props);

    // Static vignette lighting
    const grd = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, theme.id === 'glitch' ? 'rgba(0,0,0,0.3)' : 'rgba(20,10,30,0.12)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);

    return { id: theme.id, name: theme.name, tag: theme.tag, w: W, h: H, bg, anim, props, theme };
  };

  Arenas.addProp = addProp;

  Arenas.drawBg = function (ctx, arena, cam) {
    if (arena.isLevel) return arena.drawFloor(ctx, cam, B.view.w, B.view.h); // tile levels paint their own chunks
    ctx.drawImage(arena.bg, Math.round(-cam.x), Math.round(-cam.y));
  };

  Arenas.drawAnim = function (ctx, arena, cam, time, dt) {
    const reduced = CH.Storage.settings.reduced;
    for (const a of arena.anim) {
      if (a.drift) {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        if (a.x < 24 || a.x > arena.w - 24) a.vx = -a.vx;
        if (a.y < 24 || a.y > arena.h - 24) a.vy = -a.vy;
      }
      const x = a.x - cam.x;
      const y = a.y - cam.y;
      if (x < -40 || y < -40 || x > B.view.w + 40 || y > B.view.h + 40) continue;
      let f;
      if (a.blink) f = Math.sin(time * 0.9 + a.ph) > 0.93 ? 1 : 0;
      else if (a.flicker) f = reduced ? 0 : Math.sin(time * a.rate + a.ph) > 0.55 ? 1 : 0;
      else f = Math.floor((time * a.rate + a.ph) % a.n);
      S.draw(ctx, a.sprite, x, y, { frame: f, alpha: a.drift && !reduced ? 0.55 + 0.3 * Math.sin(time * 3 + a.ph) : 1 });
    }
  };
})(window.CH);
