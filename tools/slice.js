/* Sheet slicing helpers for the big pack sheets (many pieces on one transparent page): finds every piece as a
   connected blob of opaque pixels (pieces whose gaps are narrower than `gap` px merge), cropped and sorted in reading
   order (rows of similar y, then x). Used by pack-walls.js and pack-ruins.js. */
'use strict';
const P = require('./png');

function components(img, opt) {
  opt = opt || {};
  const B = opt.block || 4, gap = opt.gap || 1, minArea = opt.minArea || 400, ymin = opt.ymin || 0;
  const bw = Math.ceil(img.w / B), bh = Math.ceil(img.h / B);
  const on = new Uint8Array(bw * bh);
  for (let y = ymin; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.data[(y * img.w + x) * 4 + 3] > 40) on[((y / B) | 0) * bw + ((x / B) | 0)] = 1;
  const lab = new Int32Array(bw * bh);
  const out = [];
  let n = 0;
  for (let i = 0; i < on.length; i++) {
    if (!on[i] || lab[i]) continue;
    n++;
    const st = [i];
    lab[i] = n;
    let x0 = bw, y0 = bh, x1 = 0, y1 = 0;
    while (st.length) {
      const c = st.pop(), cx = c % bw, cy = (c / bw) | 0;
      x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
      for (let dy = -gap; dy <= gap; dy++) for (let dx = -gap; dx <= gap; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
        const j = ny * bw + nx;
        if (on[j] && !lab[j]) { lab[j] = n; st.push(j); }
      }
    }
    out.push({ x: x0 * B, y: y0 * B, w: Math.min(img.w, (x1 + 1) * B) - x0 * B, h: Math.min(img.h, (y1 + 1) * B) - y0 * B });
  }
  const list = out.filter((r) => r.w * r.h >= minArea);
  // reading order: bucket by row (y centre within half a median height)
  list.sort((a, b) => a.y - b.y);
  const rows = [];
  for (const r of list) {
    const row = rows.find((q) => Math.abs(q.cy - (r.y + r.h / 2)) < Math.max(r.h, q.h) * 0.45);
    if (row) { row.items.push(r); row.cy = (row.cy + r.y + r.h / 2) / 2; row.h = Math.max(row.h, r.h); }
    else rows.push({ cy: r.y + r.h / 2, h: r.h, items: [r] });
  }
  rows.sort((a, b) => a.cy - b.cy);
  const res = [];
  rows.forEach((row, ri) => row.items.sort((a, b) => a.x - b.x).forEach((r, ci) => res.push(Object.assign(r, { row: ri, col: ci }))));
  return res;
}

/* crop a rect and trim to its opaque bounds */
function cut(img, r) {
  const c = P.crop(img, r.x, r.y, r.w, r.h);
  const b = P.bounds(c);
  return b ? P.crop(c, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1) : c;
}
module.exports = { components, cut };
