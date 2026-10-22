/* CHAOS.exe - gamepad control of the menus. The D-pad and left stick move the focus, A presses, B goes back, START
   pauses / starts. While a run is going only the pads that belong to a player may pause it, and while a player
   picks a level-up card only that player's pad drives the screen, so two people never fight over a menu. */
(function (CH) {
  'use strict';
  const Input = CH.Input;
  const BTN = Input.BTN;

  const PadNav = (CH.PadNav = { timers: {} });

  const FIRST = 0.34; // seconds before a held direction starts repeating
  const REPEAT = 0.12;

  function assigned(G, pad) {
    for (const p of G.players) {
      const s = p.inp.src;
      if (s.kind === 'auto' || (s.kind === 'pad' && s.index === pad.index)) return true;
    }
    return false;
  }

  /* may this pad drive the menu that is currently on screen? */
  function allowed(G, pad) {
    if (G.state === 'menu') return true;
    if (G.state === 'levelup' && G.luPlayer) {
      const s = G.luPlayer.inp.src;
      return s.kind === 'auto' || (s.kind === 'pad' && s.index === pad.index);
    }
    if (G.state === 'shop' && G.coop && CH.Shop && CH.Shop.owner) {
      // the player who opened the machine owns the menu
      const s = CH.Shop.owner.inp.src;
      return s.kind === 'auto' || (s.kind === 'pad' && s.index === pad.index);
    }
    if ((G.state === 'paused' || G.state === 'branch') && G.coop) return assigned(G, pad);
    return true; // single player: whatever pad you are holding
  }

  /* held directions with key-repeat. Returns the directions that "fire" this frame. */
  function directions(pad, dt) {
    const out = [];
    const want = {
      up: pad.b[BTN.UP] || pad.ls.y < -0.6,
      down: pad.b[BTN.DOWN] || pad.ls.y > 0.6,
      left: pad.b[BTN.LEFT] || pad.ls.x < -0.6,
      right: pad.b[BTN.RIGHT] || pad.ls.x > 0.6,
    };
    for (const d of ['up', 'down', 'left', 'right']) {
      const k = pad.index + d;
      if (!want[d]) {
        delete PadNav.timers[k];
        continue;
      }
      if (PadNav.timers[k] === undefined) {
        PadNav.timers[k] = FIRST;
        out.push(d);
      } else {
        PadNav.timers[k] -= dt;
        if (PadNav.timers[k] <= 0) {
          PadNav.timers[k] = REPEAT;
          out.push(d);
        }
      }
    }
    return out;
  }

  PadNav.update = function (dt) {
    Input.pollPads();
    const G = CH.G;
    const UI = CH.UI;
    if (!G || !UI) return;
    for (const pad of Input.connectedPads()) {
      if (G.state === 'playing') {
        if (pad.pressed[BTN.START] && assigned(G, pad)) G.pause(pad.index);
        continue;
      }
      if (!allowed(G, pad)) continue;
      if (UI.active === 'lobby' && CH.Lobby) {
        CH.Lobby.padInput(pad, directions(pad, dt));
        continue;
      }
      for (const d of directions(pad, dt)) UI.navigate(d);
      // shoulders: LB / RB step through cards (level-up) or tabs (Journal, shop, hero book, map); LT / RT flip pages
      const sh = (pad.pressed[BTN.RB] ? 1 : 0) - (pad.pressed[BTN.LB] ? 1 : 0);
      const pg = (pad.pressed[BTN.RT] ? 1 : 0) - (pad.pressed[BTN.LT] ? 1 : 0);
      if (sh) {
        if (UI.active === 'levelup' || UI.active === 'branch') UI.navigate(sh > 0 ? 'right' : 'left');
        else if (['journal', 'vend', 'heroes', 'map'].includes(UI.active)) UI.onMenuKey({ code: sh > 0 ? 'KeyE' : 'KeyQ', preventDefault() {}, target: document.body });
      }
      if (pg && ['journal', 'heroes', 'map'].includes(UI.active)) UI.onMenuKey({ code: pg > 0 ? 'ArrowRight' : 'ArrowLeft', preventDefault() {}, target: document.body });
      if (pad.pressed[BTN.A]) UI.activate();
      if (pad.pressed[BTN.B]) UI.cancel();
      if (pad.pressed[BTN.START]) UI.startKey();
    }
  };
})(window.CH);
