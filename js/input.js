/* CHAOS.exe - keyboard + mouse + gamepads. Held state is wiped on blur/visibility change so nothing sticks.

   Gameplay never reads devices directly: every player owns a PlayerInput (p.inp) that is rebuilt once per
   frame from its source (keyboard+mouse, or one gamepad), so two players can use two different devices and the
   rest of the game only asks "what does this player want to do right now". */
(function (CH) {
  'use strict';

  const Input = (CH.Input = {
    held: {}, // action -> bool
    pressed: {}, // action -> bool, one-shot edge
    raw: {}, // code -> bool
    mouse: { x: 240, y: 135, down: false, right: false, inside: false },
    wheel: 0,
    canvas: null,
    capture: null, // fn(code) while rebinding a key
    onGlobal: null, // fn(action) for non-gameplay hotkeys (pause, mute, fullscreen)
    onMenuKey: null, // fn(event) for keyboard navigation while not playing
    codeToActions: {},
    lastUsed: 'kbm', // 'kbm' | 'pad': decides which device a single-player run listens to
    pads: [], // normalised gamepad snapshots, indexed by gamepad index
  });

  const FIXED = {
    Escape: 'pause',
    KeyM: 'mute',
    F11: 'fullscreen', // F belongs to fortify (build a barricade)
    Digit1: 'w1',
    Digit2: 'w2',
    Digit3: 'w3',
    Digit4: 'w4',
    Digit5: 'w5',
    Digit6: 'w6',
    Tab: 'nextweapon',
    KeyC: 'prevweapon',
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ShiftRight: 'sprint',
  };

  Input.rebuild = function () {
    const map = {};
    const add = (code, act) => {
      (map[code] = map[code] || []).push(act);
    };
    const keys = CH.Storage.settings.keys;
    for (const act of Object.keys(keys)) add(keys[act], act);
    for (const code of Object.keys(FIXED)) add(code, FIXED[code]);
    Input.codeToActions = map;
  };

  Input.clear = function () {
    Input.held = {};
    Input.pressed = {};
    Input.raw = {};
    Input.mouse.down = false;
    Input.mouse.right = false;
    Input.wheel = 0;
    for (const p of Input.pads) if (p) p.pressed = {};
  };

  Input.down = (a) => !!Input.held[a];

  /* one-shot: returns true once per key press */
  Input.consume = (a) => {
    if (Input.pressed[a]) {
      Input.pressed[a] = false;
      return true;
    }
    return false;
  };

  Input.endFrame = function () {
    Input.pressed = {};
    Input.wheel = 0;
    Input._polled = false;
  };

  function recomputeHeld(code, isDown) {
    const acts = Input.codeToActions[code];
    if (!acts) return;
    for (const a of acts) {
      // an action stays held while any key bound to it is still down
      let any = false;
      for (const c in Input.raw) {
        if (Input.raw[c] && (Input.codeToActions[c] || []).includes(a)) {
          any = true;
          break;
        }
      }
      Input.held[a] = any;
      if (isDown && !Input.pressed[a] && any) Input.pressed[a] = true;
    }
  }

  const GAME_CODES = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  Input.init = function (canvas) {
    Input.canvas = canvas;
    Input.rebuild();

    window.addEventListener('keydown', (e) => {
      if (Input.capture) {
        e.preventDefault();
        const fn = Input.capture;
        Input.capture = null;
        fn(e.code);
        return;
      }
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      Input.lastUsed = 'kbm';
      const playing = CH.G && CH.G.state === 'playing';
      if ((playing && (GAME_CODES.has(e.code) || (Input.codeToActions[e.code] || []).length)) || e.code === 'F11') e.preventDefault();
      if (e.repeat) return;
      Input.raw[e.code] = true;
      const acts = Input.codeToActions[e.code] || [];
      // global hotkeys always work; gameplay actions only matter while playing
      for (const a of acts) {
        if (a === 'pause' || a === 'mute' || a === 'fullscreen') {
          if (Input.onGlobal) Input.onGlobal(a, e);
        }
      }
      recomputeHeld(e.code, true);
      if (!playing && Input.onMenuKey) Input.onMenuKey(e);
    });

    window.addEventListener('keyup', (e) => {
      Input.raw[e.code] = false;
      recomputeHeld(e.code, false);
    });

    window.addEventListener('blur', Input.clear);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) Input.clear();
    });

    window.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      if (r.width <= 0) return;
      Input.lastUsed = 'kbm';
      Input.mouse.x = ((e.clientX - r.left) / r.width) * CH.Balance.view.w;
      Input.mouse.y = ((e.clientY - r.top) / r.height) * CH.Balance.view.h;
      Input.mouse.inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    });

    canvas.addEventListener('mousedown', (e) => {
      Input.lastUsed = 'kbm';
      if (e.button === 0) Input.mouse.down = true;
      if (e.button === 2) Input.mouse.right = true;
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) Input.mouse.down = false;
      if (e.button === 2) Input.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener(
      'wheel',
      (e) => {
        if (CH.G && CH.G.state === 'playing') {
          Input.wheel += Math.sign(e.deltaY);
          e.preventDefault();
        }
      },
      { passive: false }
    );
    // first gesture unlocks audio
    const unlock = () => CH.Audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('mousedown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('click', unlock);
    window.addEventListener('gamepadconnected', (e) => {
      unlock();
      if (CH.UI && CH.UI.toast && CH.G && CH.G.state !== 'menu') CH.UI.toast('CONTROLLER ' + (e.gamepad.index + 1) + ' CONNECTED');
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (Input.pads[e.gamepad.index]) Input.pads[e.gamepad.index] = null;
      if (CH.G && CH.G.onPadLost) CH.G.onPadLost(e.gamepad.index);
    });
  };

  /* movement vector from held actions (normalised) */
  Input.moveVec = function () {
    let x = 0;
    let y = 0;
    if (Input.held.left) x -= 1;
    if (Input.held.right) x += 1;
    if (Input.held.up) y -= 1;
    if (Input.held.down) y += 1;
    if (x && y) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  };

  /* ================================================================== gamepads */
  /* Standard-mapping button indices (Xbox layout; PlayStation / Switch pads report the same positions). */
  const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  Input.BTN = BTN;
  const TRIGGER_ON = 0.35;

  /* radial deadzone with the live range rescaled to 0..1 so slow, precise movement is possible */
  function stick(x, y, dz) {
    const m = Math.hypot(x, y);
    if (m < dz) return { x: 0, y: 0, m: 0 };
    const k = Math.min(1, (m - dz) / (1 - dz)) / m;
    return { x: x * k, y: y * k, m: Math.min(1, (m - dz) / (1 - dz)) };
  }

  function rawPads() {
    try {
      return (navigator.getGamepads && navigator.getGamepads()) || [];
    } catch (e) {
      return [];
    }
  }

  /* Rebuild the snapshot of every connected pad. Edges (pressed) are derived against the previous snapshot. */
  Input.pollPads = function (force) {
    // once per frame: a second call before endFrame() must not erase the button edges the first one found
    if (Input._polled && !force) return;
    Input._polled = true;
    const list = rawPads();
    const dz = (CH.Storage && CH.Storage.settings && CH.Storage.settings.padDeadzone) || 0.2;
    for (let i = 0; i < list.length; i++) {
      const gp = list[i];
      if (!gp || !gp.connected) {
        if (Input.pads[i]) Input.pads[i] = null;
        continue;
      }
      const prev = Input.pads[i];
      const b = {};
      const val = {};
      for (let k = 0; k < 17; k++) {
        const bt = gp.buttons[k];
        val[k] = bt ? (typeof bt === 'object' ? bt.value || (bt.pressed ? 1 : 0) : +bt) : 0;
        b[k] = k === BTN.LT || k === BTN.RT ? val[k] > TRIGGER_ON : bt ? (typeof bt === 'object' ? !!bt.pressed : !!bt) : false;
      }
      const ax = gp.axes || [];
      const ls = stick(ax[0] || 0, ax[1] || 0, dz);
      const rs = stick(ax[2] || 0, ax[3] || 0, dz);
      const pressed = {};
      const released = {};
      for (let k = 0; k < 17; k++) {
        if (b[k] && !(prev && prev.b[k])) pressed[k] = true;
        if (!b[k] && prev && prev.b[k]) released[k] = true;
      }
      const pad = { index: i, id: gp.id || 'gamepad', b, val, ls, rs, pressed, released, raw: gp, t: prev ? prev.t : 0 };
      Input.pads[i] = pad;
      // activity switches single-player between keyboard and pad
      let active = ls.m > 0.5 || rs.m > 0.5;
      for (const k in pressed) active = true;
      if (active) {
        Input.lastUsed = 'pad';
        if (!CH.Audio.unlocked || (CH.Audio.ctx && CH.Audio.ctx.state === 'suspended')) CH.Audio.unlock();
      }
    }
    for (let i = list.length; i < Input.pads.length; i++) Input.pads[i] = null;
  };

  Input.connectedPads = function () {
    const out = [];
    for (const p of Input.pads) if (p) out.push(p);
    return out;
  };
  Input.firstPad = function () {
    for (const p of Input.pads) if (p) return p;
    return null;
  };

  /* haptics: strong/weak motors 0..1, duration in ms. Silently ignored where unsupported. */
  Input.rumble = function (padIndex, strong, weak, ms) {
    if (!CH.Storage.settings.rumble) return;
    const p = Input.pads[padIndex];
    const gp = p && p.raw;
    if (!gp) return;
    const act = gp.vibrationActuator;
    try {
      if (act && act.playEffect) act.playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: strong, weakMagnitude: weak });
      else if (gp.hapticActuators && gp.hapticActuators[0] && gp.hapticActuators[0].pulse) gp.hapticActuators[0].pulse(Math.max(strong, weak), ms);
    } catch (e) {}
  };

  /* ================================================================== per-player input */
  /* What one player wants this frame. `src` is {kind:'kbm'} | {kind:'pad', index} | {kind:'auto'} | {kind:'script'}.
     'auto' (single player) listens to whichever device was touched last; 'script' is driven by tests/bots. */
  class PlayerInput {
    constructor(src) {
      this.src = src || { kind: 'auto' };
      this.mx = 0; // movement, -1..1
      this.my = 0;
      this.ax = 0; // pad aim stick
      this.ay = 0;
      this.am = 0; // aim stick magnitude 0..1
      this.fire1 = false; // primary weapon held (RT / left mouse)
      this.fire2 = false; // secondary weapon held (LT / right mouse)
      this.sprint = false;
      this.edges = {}; // one-shot actions this frame
      this.kind = 'kbm'; // resolved device kind this frame
      this.padIndex = -1;
      this.sprintOn = false; // pad sprint is a toggle on the left stick click
    }
    /* one-shot action (dodge, reload, interact, special, gadget, swap, cycle1+, cycle1-, cycle2, cycleG) */
    take(a) {
      if (this.edges[a]) {
        this.edges[a] = false;
        return true;
      }
      return false;
    }
    get isPad() {
      return this.kind === 'pad';
    }
  }
  Input.PlayerInput = PlayerInput;

  const PAD_EDGES = [
    [BTN.A, 'dodge'],
    [BTN.A, 'jump'],
    [BTN.B, 'dodge'],
    [BTN.B, 'interact'],
    [BTN.R3, 'fortify'],
    [BTN.X, 'reload'],
    [BTN.Y, 'swap'],
    [BTN.LB, 'gadget'],
    [BTN.RB, 'special'],
    [BTN.LEFT, 'cycle1-'],
    [BTN.RIGHT, 'cycle1+'],
    [BTN.UP, 'cycle2'],
    [BTN.DOWN, 'cycleG'],
  ];

  /* resolve the device for a player and rebuild its state. `allowKbm` is false for a pad-only second player. */
  Input.updatePlayer = function (inp, dt) {
    const src = inp.src;
    if (src.kind === 'script') return;
    inp.edges = {}; // whoever owns the script writes the fields directly
    let kind = src.kind;
    let pad = null;
    if (kind === 'auto') {
      const fp = Input.firstPad();
      kind = Input.lastUsed === 'pad' && fp ? 'pad' : 'kbm';
      if (kind === 'pad') pad = fp;
    } else if (kind === 'pad') {
      pad = Input.pads[src.index] || null;
    }
    inp.kind = kind;
    inp.padIndex = pad ? pad.index : -1;
    if (kind === 'pad') {
      if (!pad) {
        inp.mx = inp.my = inp.ax = inp.ay = inp.am = 0;
        inp.fire1 = inp.fire2 = false;
        return;
      }
      inp.mx = pad.ls.x;
      inp.my = pad.ls.y;
      inp.ax = pad.rs.x;
      inp.ay = pad.rs.y;
      inp.am = pad.rs.m;
      inp.fire1 = pad.b[BTN.RT];
      inp.fire2 = pad.b[BTN.LT];
      for (const [btn, name] of PAD_EDGES) if (pad.pressed[btn]) inp.edges[name] = true;
      if (pad.pressed[BTN.L3]) inp.sprintOn = !inp.sprintOn;
      if (inp.mx === 0 && inp.my === 0) inp.sprintOn = false;
      inp.sprint = inp.sprintOn;
      return;
    }
    // keyboard + mouse
    const mv = Input.moveVec();
    inp.mx = mv.x;
    inp.my = mv.y;
    inp.am = 0;
    inp.fire1 = Input.mouse.down;
    inp.fire2 = Input.mouse.right;
    inp.sprint = Input.down('sprint');
    for (const a of ['dodge', 'jump', 'reload', 'interact', 'special', 'gadget', 'swap', 'fortify']) if (Input.pressed[a]) inp.edges[a] = true;
    if (Input.pressed.secondary) inp.edges.cycle2 = true;
    if (Input.pressed.gadgetType) inp.edges.cycleG = true;
    if (Input.pressed.nextweapon) inp.edges['cycle1+'] = true;
    if (Input.pressed.prevweapon) inp.edges['cycle1-'] = true;
    if (Input.wheel) inp.edges[Input.wheel > 0 ? 'cycle1+' : 'cycle1-'] = true;
    for (let i = 1; i <= 6; i++) if (Input.pressed['w' + i]) inp.edges['w' + i] = true;
    Input.pressed = {}; // the keyboard player owns the edges
    Input.wheel = 0;
  };

  Input.rumbleFor = function (inp, strong, weak, ms) {
    if (inp && inp.kind === 'pad' && inp.padIndex >= 0) Input.rumble(inp.padIndex, strong, weak, ms);
  };
})(window.CH);
