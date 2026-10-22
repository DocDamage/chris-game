'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./png');

const ROOT = path.resolve(__dirname, '..');
const A = path.join(ROOT, 'assets');

console.log('Testing image processing on Dragon_1...');
const dragWalkPath = path.join(A, 'bosses', 'dragon-pack', 'Dragon_1', 'Walk.png');
const dragWalk = P.decode(fs.readFileSync(dragWalkPath));
console.log('Dragon Walk:', dragWalk.w, dragWalk.h);

// Downscale 0.5x to 128px frame height
const dragDown = P.downscale(dragWalk, 0.5);
console.log('Downscaled Dragon Walk:', dragDown.w, dragDown.h);
const enc = P.encode(dragDown);
console.log('Encoded size:', enc.length, 'bytes');

