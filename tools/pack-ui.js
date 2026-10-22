/* UI pipeline (M1): packs the whole "Mini Pocket Status" bundle into the 'ui' asset bundle.
     - every PNG becomes image key  ui.<path relative to the bundle root>   (all 4 colour variants)
     - every .aseprite is exported with the Aseprite CLI: tags / frame durations / layers go to meta.ui.ase[<rel path>];
       the six menu documents (Player HUD, Dialogue, Popup, Pause, Mini Dialogue, Settings) also give a trimmed
       per-layer atlas of frame 0 as image  ui.ase.<slug>  so layers can be drawn separately
   meta.ui.files lists every packed PNG, meta.ui.ase every .aseprite: tests/t13_ui.js checks them against the disk.
   Usage: node tools/pack-ui.js [list]    (build-assets calls packUI()) */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', 'assets', 'UI');
const EXPORT = path.join(ROOT, '_export'); // generated; ignored by the coverage walk
const ASEPRITE = [
  process.env.ASEPRITE_PATH,
  'C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe',
  'C:/Program Files/Aseprite/Aseprite.exe',
].find((p) => p && fs.existsSync(p));

function bundleRoot() {
  const d = fs.readdirSync(ROOT).find((n) => /Mini Pocket Status/i.test(n) && fs.statSync(path.join(ROOT, n)).isDirectory());
  if (!d) throw new Error('UI bundle not found in ' + ROOT);
  return path.join(ROOT, d);
}

function walk(dir, ext, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (ext.test(e.name)) out.push(p);
  }
  return out;
}

const slugOf = (rel) => rel.replace(/\.aseprite$/i, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
const MENU_DOCS = /More Mini Pocket Assets\/Aseprite\/\d /; // numbered menu documents

function runAseprite(args) {
  execFileSync(ASEPRITE, ['-b'].concat(args), { stdio: ['ignore', 'ignore', 'inherit'] });
}

function exportAse(file, rel) {
  const slug = slugOf(rel);
  fs.mkdirSync(EXPORT, { recursive: true });
  const json = path.join(EXPORT, slug + '.json');
  const png = path.join(EXPORT, slug + '.png');
  const isMenu = MENU_DOCS.test(rel);
  const stale = !fs.existsSync(json) || fs.statSync(json).mtimeMs < fs.statSync(file).mtimeMs;
  if (stale) {
    if (isMenu) {
      // layers of frame 0, trimmed and packed into one atlas
      runAseprite([file, '--frame-range', '0,0', '--split-layers', '--trim', '--sheet-pack', '--sheet', png, '--data', json, '--format', 'json-array', '--list-tags', '--list-layers']);
    } else {
      // animated documents: only the tags / durations / layer names are wanted (the frames exist as PNGs)
      const tmp = path.join(EXPORT, slug + '.tmp.png');
      runAseprite([file, '--sheet', tmp, '--data', json, '--format', 'json-array', '--list-tags', '--list-layers']);
      fs.rmSync(tmp, { force: true });
    }
  }
  const j = JSON.parse(fs.readFileSync(json, 'utf8'));
  const info = {
    slug,
    size: j.meta.size,
    frames: j.frames.length,
    durations: isMenu ? undefined : j.frames.map((f) => f.duration),
    tags: (j.meta.frameTags || []).map((t) => ({ name: t.name, from: t.from, to: t.to, dir: t.direction })),
    layers: (j.meta.layers || []).map((l) => l.name),
  };
  if (isMenu) {
    info.atlas = 'ui.ase.' + slug;
    info.rects = j.frames.map((f) => ({ name: f.filename, x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h, ox: f.spriteSourceSize.x, oy: f.spriteSourceSize.y, sw: f.sourceSize.w, sh: f.sourceSize.h }));
  }
  return { info, png: isMenu ? png : null };
}

/** @returns {{img:{[key:string]:string}, meta:{files:string[], ase:{[rel:string]:object}, root:string}}} */
function packUI() {
  const root = bundleRoot();
  const rel = (p) => path.relative(root, p).replace(/\\/g, '/');
  const img = {};
  const files = [];
  for (const f of walk(root, /\.png$/i, []).sort()) {
    const r = rel(f);
    files.push(r);
    img['ui.' + r] = 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  }
  const ase = {};
  if (!ASEPRITE) console.warn('  ! Aseprite not found (set ASEPRITE_PATH): .aseprite files are listed but not exported');
  for (const f of walk(root, /\.aseprite$/i, []).sort()) {
    const r = rel(f);
    if (!ASEPRITE) {
      ase[r] = { slug: slugOf(r) };
      continue;
    }
    const e = exportAse(f, r);
    ase[r] = e.info;
    if (e.png) img['ui.ase.' + e.info.slug] = 'data:image/png;base64,' + fs.readFileSync(e.png).toString('base64');
  }
  return { img, meta: { root: path.basename(root), files, ase } };
}

module.exports = { packUI, bundleRoot };

if (require.main === module) {
  const r = packUI();
  const bytes = Object.values(r.img).reduce((a, s) => a + s.length, 0);
  console.log('ui png', r.meta.files.length, 'aseprite', Object.keys(r.meta.ase).length, 'bundle', (bytes / 1048576).toFixed(2) + ' MB');
}
