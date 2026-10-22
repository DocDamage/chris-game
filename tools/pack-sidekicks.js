/* Sidekick pipeline (M1): unzip the 17 sidekick packs into assets/sidekicks/_unpacked/<id>,
   map their animation folders to the standard set and pack them as strips (bundle 'sidekicks').
   Usage: node tools/pack-sidekicks.js unpack | scan | (no args = pack, used by build-assets) */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', 'assets', 'sidekicks');
const OUT = path.join(ROOT, '_unpacked');
const SEVENZ = ['C:/Program Files/7-Zip/7z.exe', '7z'].find((p) => p === '7z' || fs.existsSync(p));

/* id -> [kind, folder-name prefix of the zip's parent folder] */
const PACKS = {
  kael: ['Main Sidekicks', 'KAEL-09'],
  velkhar: ['Main Sidekicks', 'VELKHAR'],
  inferna: ['Main Sidekicks', 'INFERNA'],
  elowen: ['Main Sidekicks', 'Elowen'],
  viper: ['Main Sidekicks', 'Neon Viper'],
  archangel: ['Main Sidekicks', 'Archangel'],
  aurex: ['Secret Sidekicks', 'AUREX'],
  corvus: ['Secret Sidekicks', 'CORVUS'],
  kitsune: ['Secret Sidekicks', 'Crimson Kitsune'],
  oni: ['Secret Sidekicks', 'Crimson Oni'],
  monk: ['Secret Sidekicks', 'Crimson Shadow'],
  lich: ['Secret Sidekicks', 'LICH KING'],
  maldrath: ['Secret Sidekicks', 'MALDRATH'],
  morwen: ['Secret Sidekicks', 'MORWEN'],
  nightrider: ['Secret Sidekicks', 'NIGHT RIDER'],
  raven: ['Secret Sidekicks', 'RAVEN'],
  runegolem: ['Secret Sidekicks', 'RUNE GOLEM'],
};

function zipOf(id) {
  const [kind, prefix] = PACKS[id];
  const kd = path.join(ROOT, kind);
  const dir = fs.readdirSync(kd).find((d) => d.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!dir) return null;
  const z = fs.readdirSync(path.join(kd, dir)).find((f) => /\.zip$/i.test(f));
  return z ? path.join(kd, dir, z) : null;
}

function unpack() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of Object.keys(PACKS)) {
    const dest = path.join(OUT, id);
    if (fs.existsSync(dest) && fs.readdirSync(dest).length) continue;
    const z = zipOf(id);
    if (!z) {
      console.warn('  ! no zip for', id);
      continue;
    }
    fs.mkdirSync(dest, { recursive: true });
    console.log('unpacking', id);
    execFileSync(SEVENZ, ['x', z, '-o' + dest, '-y', '-bso0', '-bsp0']);
  }
}

/* list every folder holding PNG frames: [{rel, n}] */
function scan(id) {
  const out = [];
  const walk = (d) => {
    const ents = fs.readdirSync(d, { withFileTypes: true });
    const n = ents.filter((e) => e.isFile() && /\.png$/i.test(e.name)).length;
    if (n) out.push({ rel: path.relative(path.join(OUT, id), d).replace(/\\/g, '/'), n });
    for (const e of ents) if (e.isDirectory()) walk(path.join(d, e.name));
  };
  walk(path.join(OUT, id));
  return out;
}

module.exports = { PACKS, OUT, unpack, scan };

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'unpack') unpack();
  else if (cmd === 'scan') for (const id of process.argv[3] ? [process.argv[3]] : Object.keys(PACKS)) {
    console.log('==', id);
    for (const f of scan(id)) console.log(String(f.n).padStart(4), f.rel);
  }
}
