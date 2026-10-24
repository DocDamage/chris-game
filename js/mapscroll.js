/* CHAOS.exe - the map: the Pixel Map scroll of the UI pack (open / close frames, ribbon, map pieces, pins). Key N.
   Page 1: the stage automap in ink on parchment (fog of war: only explored rooms), with the pack's road signs as pins:
           ! open breach, check closed breach, house waypoint / portal, castle exit, $ vending machine, + shrine, x secret.
   Page 2: the act map (world map) built from the pack's map pieces: where you are in the four acts.
   Q / E or the arrows flip between the pages, N or Esc closes. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const G = CH.G;
  const UI = CH.UI;
  const UIK = CH.UIK;
  const Audio = CH.Audio;
  const $ = (id) => document.getElementById(id);
  const TS = CH.Level.TS;

  const M = (CH.MapScroll = { open: false, page: 0, from: null });
  let root, frame, cv, cx, title, busy = false, color = 'brown';

  function build() {
    const el = document.createElement('div');
    el.className = 'screen dim';
    el.id = 'screen-map';
    el.innerHTML = '<div class="ms c-brown" id="ms"><img class="ms-frame" id="ms-frame" alt="" draggable="false"><div class="ms-title" id="ms-title"></div><canvas class="ms-cv" id="ms-cv" width="440" height="270"></canvas></div><div class="jb-hint">Q / E pages &nbsp; N or ESC close</div>';
    $('screen-pause').parentNode.appendChild(el);
    UI.SCREENS.push('map');
    frame = $('ms-frame');
    cv = $('ms-cv');
    cx = cv.getContext('2d');
    cx.imageSmoothingEnabled = false;
    title = $('ms-title');
  }
  const F = (dir, n, rev) => {
    const out = [];
    for (let i = 1; i <= n; i++) out.push(UIK.cUrl(color, 'Pixel Map/Sprites/Open & Close/With Ribbon/' + dir + '/' + i + '.png'));
    return out;
  };
  const still = () => UIK.cUrl(color, 'Pixel Map/Sprites/Static/2.png');
  const show = (on) => { cv.style.visibility = on ? 'visible' : 'hidden'; title.style.visibility = on ? 'visible' : 'hidden'; };

  M.show = function (page, from, c) {
    if (!UIK.on || !root_ready() || M.open) return false;
    if (G.state !== 'playing' && G.state !== 'paused' && G.state !== 'menu') return false;
    M.open = true;
    M.page = page || 0;
    M.from = from || UI.active;
    color = c || 'brown';
    $('ms').className = 'ms c-' + color;
    if (G.state === 'playing') { M.resume = true; G.pause(); }
    UI.show('map');
    show(false);
    busy = true;
    Audio.sfx('page');
    UIK.anim(frame, F('Open', 6), 14, { onDone() { frame.src = still(); busy = false; show(true); draw(); } });
    return true;
  };
  M.close = function () {
    if (!M.open || busy) return;
    busy = true;
    show(false);
    Audio.sfx('back');
    UIK.anim(frame, F('Close', 6), 16, {
      onDone() {
        M.open = false;
        busy = false;
        if (M.resume && G.state === 'paused') { M.resume = false; UI.hideAll(); G.resume(); }
        else UI.show(M.from && M.from !== 'map' ? M.from : G.state === 'paused' ? 'pause' : 'main');
      },
    });
  };
  M.flip = function (d) {
    if (!M.open || busy) return;
    M.page = (M.page + d + 2) % 2;
    Audio.sfx('page');
    draw();
  };
  const root_ready = () => { if (!root) { root = true; build(); } return true; };

  /* ---------------------------------------------------------------- drawing */
  const INK = '#3a2a1a';
  function sign(n, x, y, s) { const im = UIK.sprite('Signs/' + n + '.png'); if (im) cx.drawImage(im, Math.round(x - s / 2), Math.round(y - s / 2), s, s); }
  function piece(rel, x, y, w, h) { const im = UIK.c(color, 'Content/Map/' + rel); if (im) cx.drawImage(im, Math.round(x), Math.round(y), w || im.width, h || im.height); }

  function drawAuto() {
    const L = G.level;
    title.textContent = L ? (L.isTown ? 'THE SAFEHOUSE TOWN' : 'STAGE ' + G.wave + ' - ' + L.name.toUpperCase()) : 'NO MAP HERE';
    cx.clearRect(0, 0, 440, 270);
    if (!L) { CH.Font.draw(cx, 'The arena has no map. Walk around.', 220, 130, INK, 1, false, 'center'); return; }
    const sc = Math.min(440 / L.tw, 270 / L.th);
    const ox = Math.round((440 - L.tw * sc) / 2), oy = Math.round((270 - L.th * sc) / 2);
    for (let y = 0; y < L.th; y++) {
      for (let x = 0; x < L.tw; x++) {
        const i = y * L.tw + x;
        if (!L.explored[i]) continue;
        const floor = L.cells[i] === 0;
        if (floor) { cx.fillStyle = 'rgba(255,248,220,0.55)'; cx.fillRect(ox + x * sc, oy + y * sc, Math.ceil(sc), Math.ceil(sc)); }
        else {
          // wall: only where it borders explored floor, so rooms read as outlines (ink on parchment)
          const edge = (L.cell(x + 1, y) === 0 || L.cell(x - 1, y) === 0 || L.cell(x, y + 1) === 0 || L.cell(x, y - 1) === 0);
          if (edge) { cx.fillStyle = INK; cx.fillRect(ox + x * sc, oy + y * sc, Math.ceil(sc), Math.ceil(sc)); }
        }
      }
    }
    const seen = (o) => L.explored[L.idx(Math.floor(o.x / TS), Math.floor(o.y / TS))];
    const P = (o) => [ox + (o.x / TS) * sc, oy + (o.y / TS) * sc];
    for (const w of L.waypoints || []) if (seen(w)) sign(2, ...P(w), 16);
    if (L.exit && seen(L.exit) && !L.isTown) sign(7, ...P(L.exit), 24);
    for (const s of L.spawners || []) if (seen(s)) sign(s.dead ? 3 : 1, ...P(s), 16);
    for (const sh of L.shrines || []) if (seen(sh) && !sh.used) sign(5, ...P(sh), 16);
    for (const c of L.chests || []) if (seen(c) && !c.opened && !c.secret) sign(4, ...P(c), 16);
    for (const s of L.secrets || []) if (s.found) sign(6, ...P({ x: s.cx, y: s.cy }), 16);
    // sealed secrets (PLAN.md 18, K8): a "?" once you have seen the seal, the ability's colour once you can open it
    for (const s of L.gates || []) {
      if (s.found || !(s.seen || (CH.Secrets && CH.Secrets.has(s.need) && L.explored[L.idx(s.crack.x, s.crack.y)]))) continue;
      const [x, y] = P({ x: (s.crack.x + 0.5) * TS, y: (s.crack.y + 0.5) * TS });
      const can = CH.Secrets && CH.Secrets.has(s.need);
      CH.Font.draw(cx, '?', Math.round(x), Math.round(y) - 4, can ? CH.Secrets.ABILITIES[s.need].colour : '#a02a2a', 1, true, 'center');
    }
    if (G.machine && !G.machine.town && seen(G.machine)) sign(4, ...P(G.machine), 16);
    if (L.portal) sign(2, ...P(L.portal), 16);
    if (L.isTown) for (const n of L.npcs) sign(n.sign, ...P({ x: n.px, y: n.py }), 16);
    for (const p of G.players) { const [x, y] = P(p); cx.fillStyle = INK; cx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 7, 7); cx.fillStyle = p.color || '#e43b44'; cx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5); }
    piece('Compass/1.png', 392, 4);
  }

  function drawWorld() {
    title.textContent = 'THE FOUR ACTS';
    cx.clearRect(0, 0, 440, 270);
    // scenery from the pack's map pieces
    piece('Design/1.png', 30, 20); piece('Design/01.png', 300, 18); piece('Design/3.png', 60, 190); piece('Design/7.png', 170, 140);
    piece('Design/6.png', 340, 120); piece('Design/2.png', 240, 60); piece('Design/2.png', 258, 66); piece('Design/4.png', 120, 130); piece('Design/5.png', 150, 150);
    const Q = CH.Quests;
    const act = Q ? Q.actOf(G.wave || 1) : 1;
    const nodes = [[60, 215, 'I. THE BROKEN BACKYARD'], [170, 120, 'II. CORPORATE HELL'], [290, 190, 'III. THE DEEP'], [380, 70, 'IV. THE GLITCH']];
    cx.strokeStyle = INK;
    cx.lineWidth = 2;
    cx.setLineDash([5, 4]);
    cx.beginPath();
    nodes.forEach((n, i) => { if (i) cx.lineTo(n[0], n[1]); else cx.moveTo(n[0], n[1]); });
    cx.stroke();
    cx.setLineDash([]);
    nodes.forEach((n, i) => {
      const a = i + 1;
      sign(a < act ? 3 : a === act ? 6 : 8, n[0], n[1], 24);
      if (a === 4) sign(7, n[0], n[1] - 24, 24);
      CH.Font.draw(cx, n[2], n[0], n[1] + 18, a <= act ? INK : '#8a7a62', 1, false, 'center');
    });
    // you are here
    const here = nodes[Math.max(0, act - 1)];
    const pin = UIK.c(color, 'Content/Map/Pin Points/1.png');
    if (pin) cx.drawImage(pin, here[0] - 5, here[1] - 40 + Math.sin(performance.now() / 300) * 2);
    CH.Font.draw(cx, 'STAGE ' + (G.wave || 1) + (Q ? '   ' + Q.TIERS[Q.tier()].name : ''), 220, 252, INK, 1, false, 'center');
  }
  function draw() { if (M.page === 0) drawAuto(); else drawWorld(); }
  setInterval(() => { if (M.open && !busy && M.page === 1) drawWorld(); }, 300);

  /* keys */
  const prevMenuKey = UI.onMenuKey;
  UI.onMenuKey = function (e) {
    if (M.open && UI.active === 'map') {
      if (e.code === 'KeyQ' || e.code === 'ArrowLeft') { M.flip(-1); e.preventDefault(); return; }
      if (e.code === 'KeyE' || e.code === 'ArrowRight') { M.flip(1); e.preventDefault(); return; }
      if (e.code === 'KeyN') { M.close(); return; }
    }
    return prevMenuKey(e);
  };
  CH.Input.onMenuKey = UI.onMenuKey;
  const prevGlobal = UI.onGlobalKey;
  UI.onGlobalKey = function (a) {
    if (a === 'map') {
      if (M.open) return M.close();
      return M.show(0, G.state === 'paused' ? 'pause' : 'main', UIK.colorFor(0));
    }
    if (a === 'pause' && M.open) return M.close();
    return prevGlobal(a);
  };
  CH.Input.onGlobal = UI.onGlobalKey;
  const prevBack = UI.back;
  UI.back = function () { if (M.open) return M.close(); return prevBack(); };
  const prevCancel = UI.cancel;
  UI.cancel = function () { if (M.open) return M.close(); return prevCancel(); };
})(window.CH);
