/* CHAOS.exe - loads the bundled art/audio (data/assets.js, built by tools/build-assets.js).
   Everything is embedded as data: URIs, so the game works from file:// with no server.
   If the bundle is missing the game falls back to its procedural art and synthesized sound. */
(function (CH) {
  'use strict';

  const Assets = (CH.Assets = {
    ready: false,
    available: !!window.CH_ASSETS,
    images: {},
    sfx: (window.CH_ASSETS && window.CH_ASSETS.sfx) || {},
    music: (window.CH_ASSETS && window.CH_ASSETS.music) || {},
    meta: (window.CH_ASSETS && window.CH_ASSETS.meta) || {},
    loops: (window.CH_ASSETS && window.CH_ASSETS.loops) || {},
    count: 0,
    total: 0,
  });

  /* Decode every embedded PNG. Resolves when all are ready (failed ones are simply skipped). */
  Assets.load = function (onProgress) {
    const src = window.CH_ASSETS && window.CH_ASSETS.img;
    if (!src) {
      Assets.ready = false;
      return Promise.resolve(false);
    }
    const keys = Object.keys(src);
    Assets.total = keys.length;
    let done = 0;
    return new Promise((resolve) => {
      const finish = () => {
        done++;
        Assets.count = done;
        if (onProgress) onProgress(done / keys.length);
        if (done >= keys.length) {
          Assets.ready = true;
          resolve(true);
        }
      };
      if (!keys.length) {
        Assets.ready = true;
        resolve(true);
        return;
      }
      for (const k of keys) {
        const im = new Image();
        im.onload = () => {
          Assets.images[k] = im;
          finish();
        };
        im.onerror = () => {
          console.warn('asset failed to decode', k);
          finish();
        };
        im.src = src[k];
      }
    });
  };

  /* all frames of a VFX effect, in order: vfx.p5.28.1, .2, ... */
  Assets.frames = function (prefix) {
    const out = [];
    for (let i = 1; Assets.images[prefix + '.' + i]; i++) out.push(Assets.images[prefix + '.' + i]);
    return out;
  };
})(window.CH);
