/* Navigation layer for the test bot (PLAN.md R10): in a level stage the bot walks the flow field to the nearest open
   breach, fights what is in its way, and walks to the exit once the seal breaks. In towns it simply leaves.
   Usage: await page.evaluate(NAV) after lib.open({ levels: true }). */
const NAV = () => {
  const CH = window.CH;
  const bot = window.__bot;
  const base = bot.think;
  bot.nav = { target: null, stuck: 0, lx: 0, ly: 0 };
  bot.think = function () {
    base();
    const G = CH.G, I = CH.Input, p = G.player, L = G.level;
    if (!L || !p || G.state !== 'playing') return;
    if (L.isTown) { // walk back through the portal pad
      const ex = L.exit, d = Math.hypot(ex.x - p.x, ex.y - p.y);
      I.held = {};
      const a = Math.atan2(ex.y - p.y, ex.x - p.x);
      if (Math.cos(a) > 0.3) I.held.right = true; if (Math.cos(a) < -0.3) I.held.left = true; if (Math.sin(a) > 0.3) I.held.down = true; if (Math.sin(a) < -0.3) I.held.up = true;
      return;
    }
    // objective: exit when open, else the closest alive breach by walking distance
    let tgt = null;
    if (L.exit.open) tgt = L.exit;
    else {
      let bd = 1e9;
      for (const e of L.hives || []) { if (e.dead) continue; const d = L.pathDist(p.x, p.y, e.x, e.y); if (d < bd) { bd = d; tgt = e; } }
    }
    if (!tgt) return;
    bot.nav.target = tgt;
    let threat = 0, nearHive = null;
    for (const e of G.enemies) {
      if (e.dead || e.state === 'spawn') continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (e.isSpawner) { if (d < 190 && L.los(p.x, p.y, e.x, e.y)) nearHive = e; continue; }
      if (d < 120) threat += 1;
    }
    if (nearHive && tgt === nearHive) { // in range of the breach: stand and shoot it
      I.mouse.x = nearHive.x - G.cam.x; I.mouse.y = nearHive.y - G.cam.y; I.mouse.down = true;
      if (threat === 0) { I.held = {}; return; }
    }
    if (threat >= 2) return; // fighting: keep the base bot's dodging
    const f = L.flowFor(tgt.x, tgt.y);
    const d = L.flowDir(f, p.x, p.y);
    if (!d) return;
    I.held = {};
    if (d.x > 0.35) I.held.right = true; if (d.x < -0.35) I.held.left = true; if (d.y > 0.35) I.held.down = true; if (d.y < -0.35) I.held.up = true;
    if (p.stamina > 60 && Math.hypot(tgt.x - p.x, tgt.y - p.y) > 400) I.held.sprint = true;
  };
};
module.exports = { NAV };
