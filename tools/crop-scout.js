'use strict';
const fs = require('fs');
const path = require('path');
const { decode } = require('./png.js');

function findBoxes(img, minArea = 1000) {
  const w = img.w;
  const h = img.h;
  const visited = new Uint8Array(w * h);
  const boxes = [];

  for (let y = 0; y < h; y += 4) {
    for (let x = 0; x < w; x += 4) {
      const idx = y * w + x;
      if (visited[idx]) continue;
      if (img.data[idx * 4 + 3] < 30) continue;

      // Flood fill bounding box
      let minX = x, maxX = x, minY = y, maxY = y;
      let count = 0;
      const queue = [x, y];
      visited[idx] = 1;

      while (queue.length > 0) {
        const qy = queue.pop();
        const qx = queue.pop();
        count++;

        if (qx < minX) minX = qx;
        if (qx > maxX) maxX = qx;
        if (qy < minY) minY = qy;
        if (qy > maxY) maxY = qy;

        const neighbors = [
          [qx + 4, qy], [qx - 4, qy],
          [qx, qy + 4], [qx, qy - 4]
        ];

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nidx = ny * w + nx;
            if (!visited[nidx] && img.data[nidx * 4 + 3] > 30) {
              visited[nidx] = 1;
              queue.push(nx, ny);
            }
          }
        }
      }

      const bw = maxX - minX + 4;
      const bh = maxY - minY + 4;
      if (bw * bh >= minArea) {
        boxes.push({ x: minX, y: minY, w: bw, h: bh, area: bw * bh });
      }
    }
  }

  // Sort by Y then X
  boxes.sort((a, b) => (Math.abs(a.y - b.y) > 40 ? a.y - b.y : a.x - b.x));
  return boxes;
}

module.exports = { findBoxes };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.log('Usage: node tools/crop-scout.js <png-path>');
    process.exit(1);
  }
  const img = decode(fs.readFileSync(file));
  console.log(`Image: ${img.w}x${img.h}`);
  const boxes = findBoxes(img, 4000);
  console.log(`Found ${boxes.length} sprites:`);
  boxes.forEach((b, i) => console.log(`  [${i}]: x:${b.x}, y:${b.y}, w:${b.w}, h:${b.h}`));
}

