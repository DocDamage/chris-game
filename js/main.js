/* CHAOS.exe - bootstrap and the single requestAnimationFrame loop. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const G = CH.G;

  CH.errors = [];

  function start() {
    if (CH.started) return; // never start a second loop
    CH.started = true;
    CH.Storage.load();
    const canvas = document.getElementById('game');
    // size the stage first so the loading screen is laid out correctly
    const fill = document.getElementById('lfill');
    const stage = document.getElementById('stage');
    const s = Math.max(0.5, Math.min(window.innerWidth / B.ui.w, window.innerHeight / B.ui.h));
    stage.style.width = Math.floor(B.ui.w * s) + 'px';
    stage.style.height = Math.floor(B.ui.h * s) + 'px';
    stage.style.setProperty('--u', s + 'px');
    CH.Assets.load((p) => (fill.style.width = Math.round(p * 100) + '%')).then(() => {
      CH.Art.register();
      boot(canvas);
    });
  }

  /* one frame of the whole game: devices, menus, simulation, drawing, HUD. The loop and the tests both call this. */
  CH.stepFrame = function (dt) {
    CH.PadNav.update(dt);
    G.update(dt);
    G.render();
    if (G.state !== 'menu') CH.UI.updateHUD();
    CH.UI.tick(dt);
  };

  function boot(canvas) {
    CH.Input.init(canvas);
    G.ui = CH.UI;
    G.init(canvas);
    if (CH.UIK && CH.UIK.install()) { CH.Journal.init(); if (CH.Menus) CH.Menus.init(); } // pack UI: nine-slice theme, the Journal book, pause row, hero select
    CH.UI.init();
    if (CH.PostFX) CH.PostFX.boot();
    CH.Audio.setMusic('menu');
    document.getElementById('loading').classList.add('done');
    let last = performance.now();

    function frame(now) {
      requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      if (!(dt > 0)) dt = 0;
      if (dt > B.maxDt) dt = B.maxDt; // tab was inactive: do not simulate the gap
      try {
        CH.stepFrame(dt);
      } catch (e) {
        if (CH.errors.length < 20) {
          CH.errors.push(String(e && e.stack ? e.stack : e));
          console.error(e);
        }
      }
      CH.Input.endFrame();
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.CH);
