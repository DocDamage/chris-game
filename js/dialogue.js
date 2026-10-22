/* CHAOS.exe - dialogue (PLAN.md section 3c): the pack's Dialogue Box for NPC and story scenes (G.state = 'dialog' pauses
   the game), a Mini Dialogue Box for in-combat barks, and Text Popups for pickups and warnings.
   Dialogue.say({ who, portrait, lines: [...], choices?: [{ label, fn }] }, onDone) */
(function (CH) {
  'use strict';
  const U = CH.U;
  const G = CH.G;
  const UI = CH.UI;
  const UIK = CH.UIK;
  const Audio = CH.Audio;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const D = (CH.Dialogue = { open: false, queue: [] });

  const root = document.createElement('div');
  root.className = 'screen';
  root.id = 'screen-dialog';
  root.innerHTML =
    '<div class="dlg panel" id="dlg"><div class="dlg-port" id="dlg-port"><img alt=""></div><div class="dlg-main"><div class="dlg-who" id="dlg-who"></div>' +
    '<div class="dlg-text" id="dlg-text"></div><div class="dlg-choices" id="dlg-choices"></div></div><div class="dlg-next" id="dlg-next">&#9660;</div></div>';
  $('screen-pause').parentNode.appendChild(root);
  UI.SCREENS.push('dialog');

  let cur = null, shown = 0, timer = null, resume = null;

  /* the villager portraits of the pack (4 colours) double as NPC faces; heroes use their own art */
  D.portraitUrl = (key) => {
    if (!key) return '';
    if (key.indexOf('hero:') === 0) { const im = CH.Assets.images['hero.' + key.slice(5) + '.rot_s']; return im ? im.src : ''; }
    if (key.indexOf('sk:') === 0) { const im = CH.Assets.images['sk.' + key.slice(3) + '.rot_s']; return im ? im.src : ''; }
    if (key.indexOf('npc:') === 0) return UIK.on ? UIK.cUrl(['brown', 'silver', 'gold', 'white'][(+key.slice(4) || 0) % 4], 'Content/icons/' + (3 + ((+key.slice(4) || 0) % 4)) + '.png') : '';
    return '';
  };

  function type() {
    clearTimeout(timer);
    const line = cur.lines[cur.i];
    const el = $('dlg-text');
    if (shown < line.length) {
      shown = Math.min(line.length, shown + 2);
      el.textContent = line.slice(0, shown);
      if (shown % 6 === 0) Audio.sfx('popup');
      timer = setTimeout(type, 22);
    } else {
      const last = cur.i >= cur.lines.length - 1;
      $('dlg-next').style.visibility = last && cur.choices ? 'hidden' : 'visible';
      if (last && cur.choices) renderChoices();
    }
  }
  function renderChoices() {
    const box = $('dlg-choices');
    box.innerHTML = '';
    for (const c of cur.choices) {
      const b = document.createElement('button');
      b.className = 'btn small';
      b.textContent = c.label;
      b.onclick = () => { Audio.sfx('click'); const fn = c.fn; finish(); if (fn) fn(); };
      box.appendChild(b);
    }
    const f = box.querySelector('.btn');
    if (f) f.focus({ preventScroll: true });
  }

  D.say = function (scene, onDone) {
    D.queue.push({ scene, onDone });
    if (!D.open) next();
  };
  function next() {
    const q = D.queue.shift();
    if (!q) return;
    cur = Object.assign({ i: 0 }, q.scene);
    cur.onDone = q.onDone;
    cur.lines = (q.scene.lines || []).slice();
    D.open = true;
    if (G.state === 'playing') { resume = 'playing'; G.state = 'dialog'; CH.Input.clear(); }
    $('dlg-who').textContent = cur.who || '';
    const src = D.portraitUrl(cur.portrait);
    $('dlg-port').style.display = src ? '' : 'none';
    $('dlg-port').firstChild.src = src;
    const color = UIK.on ? UIK.colorFor(cur.color || 0) : 'brown';
    $('dlg').className = 'dlg panel c-' + color;
    $('dlg-choices').innerHTML = '';
    shown = 0;
    UI.show('dialog');
    $('screen-dialog').classList.add('dlg-over'); // sits at the bottom, the world stays visible
    type();
  }
  D.advance = function () {
    if (!D.open || !cur) return;
    const line = cur.lines[cur.i];
    if (shown < line.length) { shown = line.length; type(); return; }
    if (cur.i < cur.lines.length - 1) { cur.i++; shown = 0; type(); Audio.sfx('page'); return; }
    if (!cur.choices) finish();
  };
  function finish() {
    clearTimeout(timer);
    const done = cur && cur.onDone;
    cur = null;
    D.open = false;
    UI.hideAll();
    if (resume && !D.queue.length) { G.state = resume; resume = null; CH.Input.clear(); }
    if (done) done();
    if (D.queue.length) next();
  }
  D.skip = finish;

  root.addEventListener('click', (e) => { if (!e.target.closest('.btn')) D.advance(); });
  const prevMenuKey = UI.onMenuKey;
  UI.onMenuKey = function (e) {
    if (D.open && UI.active === 'dialog') {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') { if (!(cur && cur.choices && cur.i >= cur.lines.length - 1 && shown >= cur.lines[cur.i].length)) { D.advance(); e.preventDefault(); return; } }
    }
    return prevMenuKey(e);
  };
  CH.Input.onMenuKey = UI.onMenuKey;
  const prevGlobal = UI.onGlobalKey;
  UI.onGlobalKey = function (a) {
    if (D.open && a === 'pause') return D.advance();
    return prevGlobal(a);
  };
  CH.Input.onGlobal = UI.onGlobalKey;

  /* ---- barks: a little speech bubble with the Mini Dialogue Box look, over a world position ---- */
  D.barks = [];
  D.bark = function (who, text, color) {
    if (D.barks.length > 5) D.barks.shift();
    D.barks.push({ who, text: String(text).toUpperCase(), t: 0, life: 2.4, color: color || '#ffffff' });
  };
  CH.Hooks.world.push((ctx, cam) => {
    if (!D.barks.length) return;
    const dt = 1 / 60;
    for (let i = D.barks.length - 1; i >= 0; i--) {
      const b = D.barks[i];
      b.t += dt;
      if (b.t > b.life || !b.who || b.who.dead) { D.barks.splice(i, 1); continue; }
      const x = Math.round(b.who.x - cam.x), y = Math.round(b.who.y - cam.y) - 46 - Math.min(6, b.t * 20);
      const w = CH.Font.width ? CH.Font.width(b.text) : b.text.length * 4;
      ctx.globalAlpha = Math.min(1, (b.life - b.t) * 3);
      if (CH.UIK && CH.UIK.on) CH.UIK.drawPanel(ctx, 'brown', x - w / 2 - 8, y - 9, w + 16, 18);
      else { ctx.fillStyle = '#1b1226'; ctx.fillRect(x - w / 2 - 4, y - 7, w + 8, 14); }
      CH.Font.draw(ctx, b.text, x, y - 3, b.color, 1, true, 'center');
      ctx.globalAlpha = 1;
    }
  });

  /* ---- text popups: pickups and warnings in the pack's Text Popup frame ---- */
  D.popup = function (text, color) {
    const el = document.createElement('div');
    el.className = 'toast popup panel c-brown';
    el.style.color = color || '#fee761';
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 2600);
  };
})(window.CH);
