const { chromium } = require('playwright-core');
const ENV = require('./env');


async function open(opts = {}) {
  const browser = await chromium.launch({ executablePath: ENV.CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  if (opts.manual !== false) {
    await page.addInitScript(() => {
      window.__raf = [];
      window.requestAnimationFrame = (cb) => { window.__raf.push(cb); return 1; };
    });
  }
  await page.addInitScript(() => { window.__uikInstant = true; }); // book animations are instant under test
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(ENV.URL);
  await page.waitForFunction(() => window.CH && CH.G && CH.G.ui, null, { timeout: 60000 });
  await page.waitForTimeout(200);
  await page.evaluate(BOT);
  return { browser, page, errs, ctx };
}

// bot + manual stepping, injected into the page
const BOT = () => {
  const CH = window.CH;
  const bot = (window.__bot = { god: false, log: [], pickPrefs: ['bonk', 'multi', 'crit', 'life', 'skull', 'speed', 'boom', 'magnet', 'loot'], stats: { steps: 0, dodges: 0, specials: 0, buys: 0 } });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  bot.think = function () {
    const G = CH.G, I = CH.Input, p = G.player;
    if (!p) return;
    if (G.state === 'branch') { if (CH.UI._branchPick) CH.UI._branchPick(Math.random() < 0.5 ? 0 : 1); return; } // the run is frozen on the path-choice screen
    if (G.state === 'levelup') {
      let idx = 0, best = -1;
      G.cards.forEach((c, i) => {
        let sc = 1;
        if (c.kind === 'weapon') sc = 8;
        else if (c.kind === 'upgrade') { const k = bot.pickPrefs.indexOf(c.id); sc = k < 0 ? 2 : 6 - k * 0.4; }
        else if (c.kind === 'weaponup') sc = 4;
        if (sc > best) { best = sc; idx = i; }
      });
      G.pickUpgrade(idx);
      return;
    }
    if (G.state === 'branch' || G.waveState === 'branch') {
      const cards = document.querySelectorAll('#branch-cards .biome-card, #branch-cards .card');
      if (cards.length) { cards[0].click(); return; }
    }
    if (G.state !== 'playing') return;
    if (bot.god) { p.hp = p.maxHp; p.stamina = 100; }
    I.held = {};
    let near = null, nd = 1e9;
    for (const e of G.enemies) {
      if (e.dead || e.state === 'spawn' || e.hidden) continue;
      const d = dist(e, p) - e.r;
      if (d < nd) { nd = d; near = e; }
    }
    if (bot.weaponPolicy) bot.weaponPolicy(p, near, nd);
    else if (bot.stats.steps % 120 === 0 && !bot.fixedWeapon) {
      const pref = ['pizza', 'chicken', 'problem', 'chair', 'junk'];
      for (const w of pref) if (p.weapons.includes(w)) { if (p.weapon !== w) p.selectWeapon(w); break; }
    }
    const tgt = near || { x: p.x, y: p.y };
    I.mouse.x = tgt.x - G.cam.x; I.mouse.y = tgt.y - G.cam.y; I.mouse.inside = true;
    const range = p.weapon === 'baguette' ? 42 : 280;
    I.mouse.down = !!near && nd < range;
    let vx = 0, vy = 0, danger = 0, crowd = 0;
    for (const e of G.enemies) {
      if (e.dead || e.state === 'spawn' || e.hidden) continue;
      const d = Math.max(1, dist(e, p));
      const rng = e.isBoss ? 140 : p.weapon === 'baguette' ? 40 : 95;
      if (d < rng) { const w = (rng - d) / rng * (e.isBoss ? 2 : 1); vx -= (e.x - p.x) / d * w; vy -= (e.y - p.y) / d * w; danger += w; crowd++; }
      if (e.tele && e.tele.t > 0 && d < 160) {
        const a = Math.atan2(p.y - e.y, p.x - e.x); vx += Math.cos(a) * 1.5; vy += Math.sin(a) * 1.5; danger += 1;
      }
    }
    for (const pr of G.projectiles) {
      if (pr.owner !== 'e') continue;
      const d = dist(pr, p);
      if (d < 70) {
        const rel = Math.atan2(pr.vy, pr.vx);
        const nx = -Math.sin(rel), ny = Math.cos(rel);
        const side = ((p.x - pr.x) * nx + (p.y - pr.y) * ny) >= 0 ? 1 : -1;
        vx += nx * side * (70 - d) / 30; vy += ny * side * (70 - d) / 30; danger += 0.5;
        if (d < 22 && p.rollCd <= 0 && p.stamina >= 20) { I.pressed.dodge = true; bot.stats.dodges++; }
      }
    }
    for (const z of G.zones) {
      if (z.kind === 'cheese') continue;
      if (z.shape === 'line') {
        if (G.inZone(z, p.x, p.y, 8)) { const nx = -Math.sin(z.ang), ny = Math.cos(z.ang); const side = ((p.x - z.x) * nx + (p.y - z.y) * ny) >= 0 ? 1 : -1; vx += nx * side * 3; vy += ny * side * 3; danger += 2; }
      } else {
        const d = dist(z, p);
        if (d < z.r + 18) { const a = Math.atan2(p.y - z.y, p.x - z.x); vx += Math.cos(a) * 2.5; vy += Math.sin(a) * 2.5; danger += 1; }
      }
    }
    let pk = null, pd = 150;
    for (const k of G.pickups) { if (k.collected) continue; const d = dist(k, p); if (d < pd) { pd = d; pk = k; } }
    if (pk && danger < 1.2) { const a = Math.atan2(pk.y - p.y, pk.x - p.x); vx += Math.cos(a) * 0.9; vy += Math.sin(a) * 0.9; }
    if (near && nd > 130 && danger < 0.3 && !pk) { const a = Math.atan2(near.y - p.y, near.x - p.x); vx += Math.cos(a) * 0.5; vy += Math.sin(a) * 0.5; }
    if (near && nd < 140) { const a = Math.atan2(near.y - p.y, near.x - p.x) + Math.PI / 2; vx += Math.cos(a) * 0.35; vy += Math.sin(a) * 0.35; }
    const m = 60, W = G.arena.w, H = G.arena.h;
    if (p.x < m) vx += (m - p.x) / m * 2;
    if (p.x > W - m) vx -= (p.x - (W - m)) / m * 2;
    if (p.y < m) vy += (m - p.y) / m * 2;
    if (p.y > H - m) vy -= (p.y - (H - m)) / m * 2;
    if (G.machine && G.machine.uses > 0 && G.coins >= 25) {
      const d = dist(G.machine, p);
      if (d > 28) { const a = Math.atan2(G.machine.y - p.y, G.machine.x - p.x); vx += Math.cos(a) * 0.8; vy += Math.sin(a) * 0.8; }
      else { I.pressed.interact = true; bot.stats.buys++; }
    }
    if (G.mods.reverse) { vx = -vx; vy = -vy; }
    const l = Math.hypot(vx, vy);
    if (l > 0.25) { vx /= l; vy /= l; if (vx > 0.35) I.held.right = true; if (vx < -0.35) I.held.left = true; if (vy > 0.35) I.held.down = true; if (vy < -0.35) I.held.up = true; }
    if (danger > 1.5 && p.stamina > 30) I.held.sprint = true;
    for (const e of G.enemies) {
      if (e.dead || !e.canTouch || !e.canTouch()) continue;
      if (e.hot && dist(e, p) < e.r + 22 && p.rollCd <= 0 && p.stamina >= 20 && p.canBeHurt) { I.pressed.dodge = true; bot.stats.dodges++; break; }
    }
    if (p.hp / p.maxHp < 0.45 && crowd >= 3 && p.specialCd <= 0) { I.pressed.special = true; bot.stats.specials++; }
  };
  bot.hits = { total: 0, byWave: {}, bySrc: {}, minHp: 1e9 };
  (function () {
    const G = CH.G;
    const orig = G.hurtPlayer;
    G.hurtPlayer = function (dmg, src, o) {
      const r = orig.call(G, dmg, src, o);
      if (r > 0) {
        bot.hits.total += r;
        bot.hits.byWave[G.wave] = (bot.hits.byWave[G.wave] || 0) + r;
        const k = (src && (src.type || src.kind)) || 'zone/other';
        bot.hits.bySrc[k] = (bot.hits.bySrc[k] || 0) + r;
      }
      return r;
    };
  })();
  bot.human = null; // {reaction: frames, jitter: rad, mistake: prob}
  bot._held = {}; bot._tick = 0; bot._aim = null;
  const rawThink = bot.think;
  bot.think = function () {
    const G = CH.G, I = CH.Input, p = G.player;
    if (!bot.human || !p || G.state !== 'playing') return rawThink();
    bot._tick++;
    const prevPressed = I.pressed;
    if (bot._tick % bot.human.reaction === 0) {
      rawThink();
      bot._held = Object.assign({}, I.held);
      if (Math.random() < bot.human.mistake) bot._held = {};   // zoned out for a moment
      bot._pressedDodge = I.pressed.dodge && Math.random() < 0.6;
      bot._pressedSpecial = I.pressed.special;
      bot._pressedInteract = I.pressed.interact;
    } else {
      // between decisions: keep last keys, only aim/fire follows the nearest target
      const tmpHeld = I.held;
      rawThink();
      I.held = Object.assign({}, bot._held);
      I.pressed = {};
    }
    if (bot._pressedDodge) { I.pressed.dodge = true; bot._pressedDodge = false; }
    if (bot._pressedSpecial) { I.pressed.special = true; bot._pressedSpecial = false; }
    if (bot._pressedInteract) { I.pressed.interact = true; bot._pressedInteract = false; }
    // aim jitter + lag
    const j = bot.human.jitter;
    I.mouse.x += (Math.random() - 0.5) * 2 * j * 80;
    I.mouse.y += (Math.random() - 0.5) * 2 * j * 80;
  };
  bot.step = function (n, dt, opts) {
    dt = dt || 1 / 60;
    const G = CH.G;
    for (let i = 0; i < n; i++) {
      bot.stats.steps++;
      bot.think();
      G.update(dt);
      if (bot.stats.steps % 5 === 0) { G.render(); if (G.state !== 'menu') CH.UI.updateHUD(); }
      CH.Input.endFrame();
      if (opts && opts.until && opts.until()) return true;
    }
    return false;
  };
  bot.snapshot = function () {
    const G = CH.G, p = G.player;
    return { state: G.state, wave: G.wave, ws: G.waveState, t: +G.time.toFixed(1), hp: p ? Math.round(p.hp) : 0, max: p ? p.maxHp : 0, lvl: p ? p.level : 0, kills: G.kills, enemies: G.enemies.length, queue: G.queue.length, score: Math.floor(G.score), coins: G.coins, proj: G.projectiles.length, pk: G.pickups.length, parts: CH.FX.parts.length, zones: G.zones.length };
  };
};

module.exports = { open };
