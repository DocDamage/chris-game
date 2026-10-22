/* Mock gamepads for the browser tests. open() installs navigator.getGamepads before the game loads, so the game
   sees real Gamepad-shaped objects; tests then press buttons / push sticks with the helpers below. */
const { open } = require('./lib');

/* injected in the page before the game scripts run */
const INIT = () => {
  window.__rumbles = [];
  window.__pads = [null, null, null, null];
  const mk = (i) => ({
    id: 'Mock Xbox Controller (STANDARD GAMEPAD)',
    index: i,
    connected: true,
    mapping: 'standard',
    timestamp: 0,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    vibrationActuator: { playEffect: (type, o) => { window.__rumbles.push({ i, type, strong: o.strongMagnitude, weak: o.weakMagnitude, ms: o.duration }); return Promise.resolve('complete'); } },
  });
  navigator.getGamepads = () => window.__pads;
  window.__connect = (i) => {
    window.__pads[i] = mk(i);
  };
  window.__disconnect = (i) => {
    const p = window.__pads[i];
    window.__pads[i] = null;
    const e = new Event('gamepaddisconnected');
    e.gamepad = { index: i };
    window.dispatchEvent(e);
    return p;
  };
  /* __pad(i, {ls:[x,y], rs:[x,y], hold:[buttonIndexes], lt:0..1, rt:0..1}) sets the complete held state */
  window.__pad = (i, s) => {
    const p = window.__pads[i];
    if (!p) return;
    s = s || {};
    p.axes = [(s.ls || [0, 0])[0], (s.ls || [0, 0])[1], (s.rs || [0, 0])[0], (s.rs || [0, 0])[1]];
    for (let k = 0; k < 17; k++) p.buttons[k] = { pressed: false, touched: false, value: 0 };
    for (const k of s.hold || []) p.buttons[k] = { pressed: true, touched: true, value: 1 };
    if (s.lt) p.buttons[6] = { pressed: s.lt > 0.5, touched: true, value: s.lt };
    if (s.rt) p.buttons[7] = { pressed: s.rt > 0.5, touched: true, value: s.rt };
  };
};
async function openPad(opts = {}) {
  const r = await open(Object.assign({ init: INIT }, opts));
  // frame helper: one full game frame (devices, menus, simulation, drawing, HUD), then clear the frame's edges
  await r.page.evaluate(() => {
    window.__f = (n = 1, dt = 1 / 60) => {
      for (let i = 0; i < n; i++) {
        if (window.__pre) window.__pre(i);
        CH.stepFrame(dt);
        CH.Input.endFrame();
      }
    };
    /* press = hold the buttons for one frame, then release */
    window.__tap = (i, btn, frames = 2) => {
      window.__pad(i, { hold: [btn] });
      window.__f(1);
      window.__pad(i, {});
      window.__f(frames - 1);
    };
  });
  return r;
}

module.exports = { openPad, BTN: { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } };
