/* Campfire pack (Idylwild's Chromatic Campfires): cuts the atlas into one strip per flame colour.
     prop.camp.<colour>       192x48  4 frames, ring of stones + logs + flame (no smoke)
     prop.campsmoke.<colour>  192x64  4 frames, the same fire with a smoke plume above
   colours: cyan green amber orange purple. Usage: build-assets calls packProps(). */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./png');

const SHEET = path.resolve(__dirname, '..', 'assets', 'additional props', '_unpacked', 'campfires', 'campfires_PNG.png');
const CLEAN = ['cyan', 'green', 'amber', 'orange', 'purple']; // top rows, y = 0, 48, ...
const SMOKE = ['orange', 'amber', 'green', 'cyan', 'purple']; // smoke rows, y = 241 + 64 k

function packProps() {
  const img = {};
  const meta = { colors: CLEAN, frames: 4 };
  if (!fs.existsSync(SHEET)) return { img, meta };
  const sheet = P.decode(fs.readFileSync(SHEET));
  const url = (im) => 'data:image/png;base64,' + P.encode(im).toString('base64');
  CLEAN.forEach((c, k) => { img['prop.camp.' + c] = url(P.crop(sheet, 0, k * 48, 192, 48)); });
  SMOKE.forEach((c, k) => { img['prop.campsmoke.' + c] = url(P.crop(sheet, 0, 241 + k * 64, 192, 64)); });
  return { img, meta };
}
module.exports = { packProps };
