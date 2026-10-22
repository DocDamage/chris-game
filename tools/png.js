/* Minimal PNG codec for the asset build (8-bit RGBA / RGB / gray / palette, non-interlaced) plus the
   image helpers the packer needs: crop, area-average downscale with a crisp alpha edge. */
'use strict';
const zlib = require('zlib');

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function decode(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  let o = 8;
  let ihdr = null;
  let plte = null;
  let trns = null;
  const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], ctype: data[9], interlace: data[12] };
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (!ihdr || ihdr.depth !== 8 || ihdr.interlace) throw new Error('unsupported PNG variant');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.ctype];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = ihdr.w * ch;
  const out = Buffer.alloc(ihdr.w * ihdr.h * 4);
  let prev = Buffer.alloc(stride);
  let cur = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < ihdr.h; y++) {
    const ft = raw[p++];
    for (let i = 0; i < stride; i++) {
      const x = raw[p++];
      const a = i >= ch ? cur[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v;
      switch (ft) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        default: {
          const pa = Math.abs(b - c);
          const pb = Math.abs(a - c);
          const pc = Math.abs(a + b - 2 * c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
        }
      }
      cur[i] = v & 255;
    }
    for (let x = 0; x < ihdr.w; x++) {
      const d = (y * ihdr.w + x) * 4;
      if (ihdr.ctype === 6) {
        out[d] = cur[x * 4]; out[d + 1] = cur[x * 4 + 1]; out[d + 2] = cur[x * 4 + 2]; out[d + 3] = cur[x * 4 + 3];
      } else if (ihdr.ctype === 2) {
        out[d] = cur[x * 3]; out[d + 1] = cur[x * 3 + 1]; out[d + 2] = cur[x * 3 + 2]; out[d + 3] = 255;
      } else if (ihdr.ctype === 0) {
        out[d] = out[d + 1] = out[d + 2] = cur[x]; out[d + 3] = 255;
      } else if (ihdr.ctype === 4) {
        out[d] = out[d + 1] = out[d + 2] = cur[x * 2]; out[d + 3] = cur[x * 2 + 1];
      } else {
        const idx = cur[x];
        out[d] = plte[idx * 3]; out[d + 1] = plte[idx * 3 + 1]; out[d + 2] = plte[idx * 3 + 2];
        out[d + 3] = trns && idx < trns.length ? trns[idx] : 255;
      }
    }
    const t = prev;
    prev = cur;
    cur = t;
  }
  return { w: ihdr.w, h: ihdr.h, data: out };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encode(img) {
  const { w, h, data } = img;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function blank(w, h) {
  return { w, h, data: Buffer.alloc(w * h * 4) };
}

/* copy src into dst at (dx, dy) */
function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.h; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= dst.h) continue;
    for (let x = 0; x < src.w; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= dst.w) continue;
      src.data.copy(dst.data, (ty * dst.w + tx) * 4, (y * src.w + x) * 4, (y * src.w + x) * 4 + 4);
    }
  }
}

function bounds(img, thr) {
  let x0 = img.w;
  let y0 = img.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (img.data[(y * img.w + x) * 4 + 3] > (thr || 8)) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

function crop(img, x0, y0, w, h) {
  const out = blank(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x0 + x;
      const sy = y0 + y;
      if (sx < 0 || sy < 0 || sx >= img.w || sy >= img.h) continue;
      img.data.copy(out.data, (y * w + x) * 4, (sy * img.w + sx) * 4, (sy * img.w + sx) * 4 + 4);
    }
  }
  return out;
}

/* area-average downscale (premultiplied alpha) with a hard alpha edge so the result stays crisp */
function downscale(img, f, alphaCut) {
  const w = Math.max(1, Math.round(img.w * f));
  const h = Math.max(1, Math.round(img.h * f));
  const out = blank(w, h);
  const sx = img.w / w;
  const sy = img.h / h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = x * sx;
      const x1 = (x + 1) * sx;
      const y0 = y * sy;
      const y1 = (y + 1) * sy;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let wsum = 0;
      for (let yy = Math.floor(y0); yy < Math.min(img.h, Math.ceil(y1)); yy++) {
        const wy = Math.min(yy + 1, y1) - Math.max(yy, y0);
        for (let xx = Math.floor(x0); xx < Math.min(img.w, Math.ceil(x1)); xx++) {
          const wx = Math.min(xx + 1, x1) - Math.max(xx, x0);
          const wt = wx * wy;
          const i = (yy * img.w + xx) * 4;
          const al = img.data[i + 3] / 255;
          r += img.data[i] * al * wt;
          g += img.data[i + 1] * al * wt;
          b += img.data[i + 2] * al * wt;
          a += al * wt;
          wsum += wt;
        }
      }
      const al = wsum ? a / wsum : 0;
      const o = (y * w + x) * 4;
      if (al >= (alphaCut || 0.5) && a > 0) {
        out.data[o] = Math.min(255, Math.round(r / a));
        out.data[o + 1] = Math.min(255, Math.round(g / a));
        out.data[o + 2] = Math.min(255, Math.round(b / a));
        out.data[o + 3] = 255;
      }
    }
  }
  return out;
}

module.exports = { decode, encode, blank, blit, bounds, crop, downscale };
