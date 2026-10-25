/* The stage editor's saving (PLAN.md 23). The game runs from its folder with no server, so the editor writes into
   that folder through the browser's file access (asked once: pick the game's folder, the one with index.html):
     data/stages.js       every hand-made stage (window.CH_STAGES), one line each
     data/asset_meta.js   pieces' own settings (window.CH_ASSET_META): kind, flat or standing, collision, animation, light
     data/bundle_user.js  the owner's own pictures, brought in by the editor (import.js)
   Before a file is written again its last version goes to data/editor_backups/ (the newest 30 kept). Where the
   browser cannot write files, the file is downloaded instead, with a note of where it goes. Unsaved work is kept in
   the browser (restored from Open) every few seconds. */
(function (CH) {
  const ED = CH.Editor;
  const F = (ED.files = {});
  const DB = 'chaos-editor', STORE = 'handles';
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const idbGet = async (k) => { const d = await idb(); return new Promise((res) => { const t = d.transaction(STORE).objectStore(STORE).get(k); t.onsuccess = () => res(t.result); t.onerror = () => res(null); }); };
  const idbSet = async (k, v) => { const d = await idb(); return new Promise((res) => { const t = d.transaction(STORE, 'readwrite').objectStore(STORE).put(v, k); t.onsuccess = () => res(true); t.onerror = () => res(false); }); };
  F.canWrite = () => typeof window.showDirectoryPicker === 'function';

  /* the game's folder (asked for once, then remembered) */
  let dirHandle = null;
  F.dir = async function (ask) {
    if (!F.canWrite()) return null;
    if (!dirHandle) dirHandle = await idbGet('gameDir').catch(() => null);
    if (dirHandle) {
      const opts = { mode: 'readwrite' };
      let p = await dirHandle.queryPermission(opts);
      if (p !== 'granted' && ask) p = await dirHandle.requestPermission(opts);
      if (p === 'granted') return dirHandle;
      if (!ask) return null;
    }
    if (!ask) return null;
    const ok = await new Promise((res) => ED.modal('Where is the game?', [
      ED.$('p', { text: 'The editor saves your stages into the game itself. Pick the game\'s folder: the one with index.html in it (' + decodeURIComponent(location.pathname.replace(/^\//, '').replace(/\/[^/]*$/, '')) + ').' }),
      ED.$('p', { class: 'note', text: 'The browser asks once whether the editor may change files there. It only writes into data/.' }),
    ], [ED.$('button', { text: 'Cancel', onclick: () => { ED.closeModal(); res(false); } }), ED.$('button', { class: 'primary', text: 'Pick the folder', onclick: () => { ED.closeModal(); res(true); } })]));
    if (!ok) return null;
    try {
      const h = await window.showDirectoryPicker({ id: 'chaos-game', mode: 'readwrite' });
      try { await h.getFileHandle('index.html'); await h.getDirectoryHandle('data'); } catch (e) { ED.toast('That folder has no index.html and data folder: pick the game\'s own folder.', false, 6000); return null; }
      dirHandle = h;
      await idbSet('gameDir', h).catch(() => {});
      return h;
    } catch (e) { return null; } // (cancelled)
  };
  async function readText(dir, path) {
    try { let d = dir; const parts = path.split('/'); for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p); const f = await (await d.getFileHandle(parts[parts.length - 1])).getFile(); return await f.text(); } catch (e) { return null; }
  }
  async function writeText(dir, path, text) {
    let d = dir;
    const parts = path.split('/');
    for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
    const fh = await d.getFileHandle(parts[parts.length - 1], { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
  }
  /* the last version of a file kept in data/editor_backups before it is written again */
  async function backup(dir, path) {
    const old = await readText(dir, path);
    if (old == null) return;
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const name = path.split('/').pop().replace(/\.js$/, '') + '-' + stamp + '.js';
    try {
      await writeText(dir, 'data/editor_backups/' + name, old);
      const bd = await (await dir.getDirectoryHandle('data')).getDirectoryHandle('editor_backups');
      const names = [];
      for await (const [n] of bd.entries()) names.push(n);
      names.sort();
      for (const n of names.slice(0, Math.max(0, names.length - 30))) await bd.removeEntry(n).catch(() => {});
    } catch (e) { /* (a backup that fails does not stop the save) */ }
  }
  /* write a file of the game, or hand it over as a download */
  async function put(path, text, what) {
    const dir = await F.dir(true);
    if (!dir) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
      a.download = path.split('/').pop();
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      ED.modal('Saved as a download', [ED.$('p', { text: 'The browser could not write into the game\'s folder, so ' + what + ' was downloaded as ' + a.download + '. Put it in the game\'s ' + path.replace(/[^/]*$/, '') + ' folder (replacing the old one) and reload the game.' })], [ED.$('button', { text: 'OK', onclick: ED.closeModal })]);
      return false;
    }
    await backup(dir, path);
    await writeText(dir, path, text);
    return true;
  }

  /* ------------------------------------------------------------------ the stages */
  F.stagesText = function () {
    const lines = ['/* Stages made by hand in the stage editor (js/editor/, PLAN.md 23). The editor writes this file: change the stages there. */', 'window.CH_STAGES = window.CH_STAGES || {};'];
    for (const id of Object.keys(CH.Stages.data).sort((a, b) => (+a || 999) - (+b || 999))) lines.push('window.CH_STAGES[' + JSON.stringify(id) + '] = ' + JSON.stringify(CH.Stages.data[id]) + ';');
    return lines.join('\n') + '\n';
  };
  F.saveStage = async function () {
    if (!ED.L) return;
    const id = ED.area;
    const before = CH.Stages.data[id];
    const data = CH.Stages.serialize(ED.L, { area: id, from: ED.how });
    CH.Stages.data[id] = data;
    try {
      const ok = await put('data/stages.js', F.stagesText(), 'your stages');
      ED.dirty = false;
      ED.L.handmade = true;
      ED.how = 'saved';
      F.dropDraft(id);
      ED.refreshTop();
      ED.toast(ok ? '✓ Saved. The game plays this stage from now on.' : 'Saved as a download.', false, 4000);
    } catch (e) {
      if (before) CH.Stages.data[id] = before; else delete CH.Stages.data[id];
      console.error(e);
      ED.toast('Could not save: ' + e.message, false, 6000);
    }
  };
  F.deleteStage = async function (id) {
    if (!CH.Stages.data[id] || !confirm('Delete your hand-made stage for ' + ED.areaName(id) + '? The game makes this stage itself again. (The last saved file is kept in data/editor_backups.)')) return;
    const was = CH.Stages.data[id];
    delete CH.Stages.data[id];
    try { await put('data/stages.js', F.stagesText(), 'your stages'); ED.toast('Deleted. The game makes that stage itself again.'); } catch (e) { CH.Stages.data[id] = was; ED.toast('Could not delete: ' + e.message); }
  };

  /* ------------------------------------------------------------------ a piece's own settings */
  F.metaText = function () {
    const M = window.CH_ASSET_META || {};
    const lines = ['/* Pieces\' own settings from the stage editor (PLAN.md 23): kind, layer (floor | stand), box (collision; null: walked through), fps, glow, lr, scale, name. The editor writes this file. */', 'window.CH_ASSET_META = window.CH_ASSET_META || {};'];
    for (const k of Object.keys(M).sort()) lines.push('window.CH_ASSET_META[' + JSON.stringify(k) + '] = ' + JSON.stringify(M[k]) + ';');
    return lines.join('\n') + '\n';
  };
  F.saveMeta = () => put('data/asset_meta.js', F.metaText(), "the pieces' settings");
  F.setDefault = async function (key, meta) {
    const M = (window.CH_ASSET_META = window.CH_ASSET_META || {});
    const was = M[key];
    if (meta) { const clean = {}; for (const [k, v] of Object.entries(Object.assign({}, was || {}, meta))) if (v !== undefined) clean[k] = v; M[key] = clean; } else delete M[key];
    CH.Props.rebuild();
    CH.EdCatalog.reset();
    try {
      await put('data/asset_meta.js', F.metaText(), 'the pieces\' settings');
      ED.toast(meta ? '✓ That is this piece\'s default now, everywhere.' : 'Its default is forgotten.');
    } catch (e) { if (was) M[key] = was; else delete M[key]; ED.toast('Could not save the setting: ' + e.message); }
    ED.inspect();
    if (ED.drawer) ED.drawer.refresh();
  };

  /* ------------------------------------------------------------------ the owner's pictures */
  F.userText = function () {
    const U = window.CH_USER_ASSETS || { img: {}, kits: {}, anims: {} };
    return '/* The owner\'s own pictures, brought in by the stage editor (js/editor/import.js, PLAN.md 23). The editor writes this file. */\n'
      + 'window.CH_USER_ASSETS = ' + JSON.stringify(U) + ';\n'
      + '(function (U) { var W = (window.CH_ASSETS = window.CH_ASSETS || { img: {}, sfx: {}, loops: {}, music: {}, meta: {} }); W.img = W.img || {}; W.meta = W.meta || {}; for (var k in U.img) W.img[k] = U.img[k]; W.meta.kits = W.meta.kits || {}; for (var id in U.kits) W.meta.kits[id] = U.kits[id]; W.meta.lands = W.meta.lands || {}; W.meta.lands.anims = W.meta.lands.anims || {}; for (var n in U.anims) W.meta.lands.anims[n] = U.anims[n]; })(window.CH_USER_ASSETS);\n';
  };
  F.saveUser = () => put('data/bundle_user.js', F.userText(), 'your pictures');

  /* ------------------------------------------------------------------ unsaved work, kept in the browser */
  const DK = (id) => 'chaos.editor.draft.' + id;
  let draftT = 0;
  F.draftSoon = function () { clearTimeout(draftT); draftT = setTimeout(F.draftNow, 4000); };
  F.draftNow = function () {
    clearTimeout(draftT);
    if (!ED.L || !ED.dirty) return;
    try { localStorage.setItem(DK(ED.area), JSON.stringify({ at: Date.now(), stage: CH.Stages.serialize(ED.L, { area: ED.area, draft: true }) })); } catch (e) { /* (the browser's store is full: the draft is skipped) */ }
  };
  F.draftOf = function (id) { try { return JSON.parse(localStorage.getItem(DK(id))); } catch (e) { return null; } };
  F.dropDraft = function (id) { try { localStorage.removeItem(DK(id)); } catch (e) { /* (no store) */ } };
})(window.CH);
