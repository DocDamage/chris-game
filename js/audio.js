/* CHAOS.exe - procedural Web Audio: arcade sfx + a tiny step-sequenced chiptune player.
   Nothing starts until unlock() is called from a user gesture. Everything is a silent no-op
   if Web Audio is unavailable. */
(function (CH) {
  'use strict';
  const U = CH.U;

  const AC = window.AudioContext || window.webkitAudioContext;

  const A = (CH.Audio = {
    ctx: null,
    master: null,
    sfxBus: null,
    musicBus: null,
    unlocked: false,
    voices: 0,
    last: {},
    track: null,
    trackName: null,
    timer: null,
    pendingTrack: null,
  });

  let noiseBuf = null;

  // Sound gets its own random numbers so the game's Math.random sequence doesn't depend on which samples have
  // decoded yet (or whether audio is on at all): a seeded run then replays the same whatever the sound does.
  let rndState = (Date.now() ^ 0x9e3779b9) >>> 0;
  function rnd() {
    rndState = (rndState + 0x6d2b79f5) >>> 0;
    let t = rndState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  A.bank = {}; // sound name -> [AudioBuffer, ...] decoded from the bundled samples
  A.loopBank = {}; // ambience name -> AudioBuffer
  A.bankReady = false;
  A.lastVariant = {};

  function b64ToBuf(uri) {
    const bin = atob(uri.slice(uri.indexOf(',') + 1));
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8.buffer;
  }

  function decodeLoops() {
    const src = (CH.Assets && CH.Assets.loops) || {};
    for (const n of Object.keys(src)) {
      try {
        const p = A.ctx.decodeAudioData(b64ToBuf(src[n]), (buf) => {
          A.loopBank[n] = buf;
          if (A.pendingAmb === n) A.setAmbience(n);
        }, () => {});
        if (p && p.catch) p.catch(() => {});
      } catch (e) {}
    }
  }

  function decodeBank() {
    decodeLoops();
    const src = (CH.Assets && CH.Assets.sfx) || {};
    const names = Object.keys(src);
    if (!names.length || !A.ctx) return;
    let pending = 0;
    for (const n of names) {
      A.bank[n] = [];
      for (const uri of src[n]) {
        pending++;
        const done = () => {
          if (--pending === 0) A.bankReady = true;
        };
        try {
          const p = A.ctx.decodeAudioData(b64ToBuf(uri), (buf) => {
            A.bank[n].push(buf);
            done();
          }, done);
          if (p && p.catch) p.catch(() => {});
        } catch (e) {
          done();
        }
      }
    }
  }

  A.unlock = function () {
    if (A.unlocked) {
      if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
      return true;
    }
    A.unlocked = true;
    try {
      if (AC) {
        A.ctx = new AC();
        A.master = A.ctx.createGain();
        A.sfxBus = A.ctx.createGain();
        A.musicBus = A.ctx.createGain();
        A.sfxBus.connect(A.master);
        A.musicBus.connect(A.master);
        A.master.connect(A.ctx.destination);
        const len = A.ctx.sampleRate;
        noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = rnd() * 2 - 1;
        A.applySettings();
        if (A.ctx.state === 'suspended') A.ctx.resume();
        decodeBank();
      }
    } catch (e) {
      A.ctx = null;
    }
    if (A.pendingTrack !== undefined && A.pendingTrack !== null) {
      const t = A.pendingTrack;
      A.pendingTrack = null;
      A.setMusic(t);
    }
    return true;
  };

  A.applySettings = function () {
    if (typeof fadeTick === 'function') fadeTick();
    if (!A.ctx) return;
    const s = CH.Storage.settings;
    const t = A.ctx.currentTime;
    A.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.02);
    A.sfxBus.gain.setTargetAtTime(s.sfxOn ? s.sfx : 0, t, 0.02);
    A.musicBus.gain.setTargetAtTime(s.musicOn ? s.music * 0.5 : 0, t, 0.05);
  };

  A.toggleMute = function () {
    const s = CH.Storage.settings;
    s.muted = !s.muted;
    CH.Storage.save();
    A.applySettings();
    return s.muted;
  };

  /* ---------- primitives ---------- */
  function tone(o) {
    const ctx = A.ctx;
    if (!ctx || A.voices > 40) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const dur = o.dur || 0.1;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + dur);
    const a = o.a || 0.004;
    const v = o.vol === undefined ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(o.bus || A.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
    A.voices++;
    osc.onended = () => {
      A.voices--;
      g.disconnect();
    };
  }

  function noise(o) {
    const ctx = A.ctx;
    if (!ctx || !noiseBuf || A.voices > 40) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const dur = o.dur || 0.1;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.f || 2000, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f2), t0 + dur);
    f.Q.value = o.q || 0.7;
    const g = ctx.createGain();
    const v = o.vol === undefined ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.bus || A.sfxBus);
    src.start(t0, rnd() * 0.5);
    src.stop(t0 + dur + 0.03);
    A.voices++;
    src.onended = () => {
      A.voices--;
      g.disconnect();
    };
  }

  const arp = (notes, step, type, vol, dur) => notes.forEach((f, i) => tone({ f, type: type || 'square', dur: dur || step * 1.6, vol: vol || 0.16, delay: i * step }));

  /* ---------- sound effects ---------- */
  const SFX = {
    heartbeat: () => {
      tone({ f: 75, f2: 42, type: 'sine', dur: 0.14, vol: 0.32 });
      tone({ f: 70, f2: 40, type: 'sine', dur: 0.12, vol: 0.24, delay: 0.17 });
    },
    click: () => tone({ f: 660, f2: 990, dur: 0.06, vol: 0.14 }),
    hover: () => tone({ f: 440, type: 'triangle', dur: 0.04, vol: 0.06 }),
    back: () => tone({ f: 500, f2: 280, dur: 0.08, vol: 0.12 }),
    shoot_junk: () => {
      noise({ dur: 0.05, f: 3000, filter: 'highpass', vol: 0.08 });
      tone({ f: 340 + rnd() * 80, f2: 120, dur: 0.09, vol: 0.12 });
    },
    shoot_chicken: () => {
      tone({ f: 650, f2: 1700, dur: 0.07, type: 'sawtooth', vol: 0.1 });
      tone({ f: 1700, f2: 800, dur: 0.1, type: 'sawtooth', vol: 0.1, delay: 0.07 });
    },
    squeak: () => tone({ f: 900 + rnd() * 500, f2: 1900, dur: 0.08, type: 'sawtooth', vol: 0.09 }),
    shoot_pizza: () => {
      tone({ f: 180, f2: 420, dur: 0.14, type: 'triangle', vol: 0.2 });
      noise({ dur: 0.1, f: 800, vol: 0.08 });
    },
    swing: () => noise({ dur: 0.17, filter: 'bandpass', f: 500, f2: 2600, q: 1.2, vol: 0.2 }),
    crunch: () => {
      noise({ dur: 0.09, filter: 'highpass', f: 1500, vol: 0.2 });
      tone({ f: 140, f2: 60, dur: 0.1, vol: 0.16 });
    },
    shoot_chair: () => {
      tone({ f: 130, f2: 55, dur: 0.22, type: 'sawtooth', vol: 0.2 });
      noise({ dur: 0.15, f: 600, vol: 0.12 });
    },
    shoot_problem: () => {
      const b = 330 + Math.floor(rnd() * 6) * 90;
      tone({ f: b, f2: b * 1.5, dur: 0.05, vol: 0.13 });
      tone({ f: b * 2, f2: b * 1.2, dur: 0.07, vol: 0.1, delay: 0.05 });
    },
    empty: () => tone({ f: 180, dur: 0.05, vol: 0.1 }),
    reload: () => {
      tone({ f: 300, dur: 0.04, vol: 0.12 });
      tone({ f: 450, dur: 0.05, vol: 0.12, delay: 0.1 });
    },
    hit: () => {
      noise({ dur: 0.05, f: 2500, vol: 0.1 });
      tone({ f: 210, f2: 100, dur: 0.06, vol: 0.12 });
    },
    crit: () => {
      tone({ f: 880, f2: 1760, dur: 0.09, vol: 0.14 });
      noise({ dur: 0.06, f: 3000, vol: 0.1 });
    },
    enemy_die: () => {
      tone({ f: 420, f2: 70, dur: 0.2, vol: 0.13 });
      noise({ dur: 0.14, f: 1500, f2: 200, vol: 0.12 });
    },
    pickup_coin: () => {
      tone({ f: 988, dur: 0.05, vol: 0.1 });
      tone({ f: 1319, dur: 0.1, vol: 0.1, delay: 0.05 });
    },
    pickup_xp: () => tone({ f: 640 + rnd() * 160, f2: 1100, type: 'triangle', dur: 0.07, vol: 0.09 }),
    pickup_hp: () => arp([523, 659, 784], 0.06, 'sine', 0.18),
    pickup_power: () => {
      tone({ f: 300, f2: 1300, dur: 0.28, type: 'sawtooth', vol: 0.12 });
      arp([784, 988, 1175], 0.07, 'square', 0.1);
    },
    token: () => arp([523, 659, 784, 1047, 1319], 0.07, 'square', 0.15),
    levelup: () => arp([523, 659, 784, 1047, 784, 1047, 1319], 0.065, 'square', 0.16),
    dodge: () => noise({ dur: 0.2, filter: 'bandpass', f: 700, f2: 2400, q: 0.9, vol: 0.18 }),
    hurt: () => {
      tone({ f: 320, f2: 90, dur: 0.22, type: 'sawtooth', vol: 0.22 });
      noise({ dur: 0.12, f: 1800, vol: 0.14 });
    },
    explosion: () => {
      noise({ dur: 0.5, f: 1600, f2: 90, vol: 0.38 });
      tone({ f: 100, f2: 35, dur: 0.4, type: 'sawtooth', vol: 0.26 });
    },
    big_explosion: () => {
      noise({ dur: 1.0, f: 1800, f2: 60, vol: 0.5 });
      tone({ f: 80, f2: 25, dur: 0.9, type: 'sawtooth', vol: 0.34 });
    },
    slam: () => {
      noise({ dur: 0.3, f: 500, f2: 60, vol: 0.4 });
      tone({ f: 90, f2: 30, dur: 0.3, type: 'triangle', vol: 0.34 });
    },
    warn: () => {
      tone({ f: 880, dur: 0.07, vol: 0.11 });
      tone({ f: 880, dur: 0.07, vol: 0.11, delay: 0.11 });
    },
    boss_intro: () => {
      tone({ f: 90, f2: 55, dur: 1.4, type: 'sawtooth', vol: 0.3 });
      noise({ dur: 1.2, f: 300, f2: 80, vol: 0.2 });
      arp([196, 233, 262, 196, 233, 262, 392], 0.15, 'square', 0.14);
    },
    event: () => {
      tone({ f: 200, f2: 900, dur: 0.35, type: 'sawtooth', vol: 0.14 });
      arp([523, 659, 784, 659], 0.08, 'square', 0.1);
    },
    event_end: () => arp([784, 659, 523], 0.08, 'triangle', 0.14),
    special: () => {
      tone({ f: 120, f2: 900, dur: 0.25, type: 'sawtooth', vol: 0.2 });
      SFX.big_explosion();
    },
    shield: () => tone({ f: 500, f2: 250, dur: 0.1, type: 'triangle', vol: 0.14 }),
    flash: () => tone({ f: 1500, f2: 2500, dur: 0.12, type: 'sine', vol: 0.1 }),
    victory: () => {
      arp([523, 523, 523, 659, 784, 659, 784, 1047], 0.13, 'square', 0.17, 0.2);
      arp([262, 262, 262, 330, 392, 330, 392, 523], 0.13, 'triangle', 0.18, 0.2);
    },
    gameover: () => {
      arp([392, 370, 349, 330, 294, 262, 196], 0.17, 'sawtooth', 0.15, 0.3);
      tone({ f: 80, f2: 40, dur: 1.2, type: 'triangle', vol: 0.25, delay: 0.6 });
    },
    glitch: () => {
      noise({ dur: 0.12, filter: 'bandpass', f: 3000, q: 3, vol: 0.15 });
      tone({ f: 1200, f2: 90, dur: 0.12, type: 'square', vol: 0.1 });
    },
    buy: () => arp([659, 880, 1175], 0.06, 'square', 0.14),
    nope: () => tone({ f: 150, f2: 100, dur: 0.15, type: 'sawtooth', vol: 0.14 }),
  };

  const THROTTLE = { step: 0.12, step_grass: 0.12, step_dirt: 0.12, step_sand: 0.12, step_concrete: 0.12, step_stone: 0.12, step_wood: 0.12, growl: 0.4, hiss: 0.4, cre_growl: 0.35, cre_roar: 0.5, cre_bird: 0.3, cre_wet: 0.3, cre_frog: 0.5, cre_trumpet: 0.6, cre_hiss: 0.3, cre_chitter: 0.4, die_bone: 0.06, die_rock: 0.08, die_wet: 0.06, die_bird: 0.06, die_beast: 0.1, bush: 0.2, arrow: 0.1, parry: 0.1, fire_hit: 0.08, ice: 0.1, sizzle: 0.2,  hit: 0.03, crit: 0.05, enemy_die: 0.04, pickup_xp: 0.045, pickup_coin: 0.05, shoot_junk: 0.04, explosion: 0.06, squeak: 0.06, crunch: 0.05, hover: 0.04 };

  // per-sound loudness trims for the recorded samples (default 0.85)
  const TRIM = { step_grass: 0.34, step_dirt: 0.34, step_sand: 0.34, step_concrete: 0.34, step_wood: 0.34, step_stone: 0.34, confirm: 0.7, popup: 0.5, whoosh: 0.5, page: 0.5, cre_growl: 0.55, cre_roar: 0.7, cre_bird: 0.5, cre_wet: 0.55, cre_frog: 0.6, cre_trumpet: 0.7, cre_hiss: 0.5, cre_chitter: 0.5, die_bone: 0.6, die_rock: 0.7, die_wet: 0.55, die_bird: 0.5, die_beast: 0.7, swing_bread: 0.6, bush: 0.4, tree: 0.5, tree_hit: 0.65, tree_fall: 0.85, tree_chop: 0.6, foliage: 0.5, jump: 0.5, land: 0.6, sizzle: 0.5, ice: 0.6, shock: 0.6, chain: 0.5, hit: 0.6, crit: 0.75, step: 0.32, hover: 0.5, click: 0.7, back: 0.7, squeak: 0.6, pickup_xp: 0.55, pickup_coin: 0.6, enemy_die: 0.7, shoot_junk: 0.6, swing: 0.6, shoot_problem: 0.55, explosion: 0.9, big_explosion: 1, boss_intro: 1, growl: 0.55, arrow: 0.6 };
  const FALLBACK = { sword_heavy: 'swing', sword_light: 'swing', saber: 'swing', knife: 'swing', punch: 'swing', bow_draw: 'reload', pistol: 'shoot_junk', hit_flesh: 'hit', hit_heavy: 'crit', clang: 'parry', enemy_die_big: 'enemy_die', boss_defeated: 'victory', confirm: 'click', popup: 'hover', whoosh: 'hover', page: 'hover', book: 'hover', bag: 'hover', scan: 'hover', vend: 'click', chest: 'pickup_power', door_open: 'click', door_close: 'click', door_auto: 'click', swing_bread: 'swing', die_bone: 'enemy_die', die_rock: 'enemy_die', die_wet: 'enemy_die', die_bird: 'enemy_die', die_beast: 'enemy_die', shield_break: 'nope', enchant: 'levelup', item_get: 'pickup_power', fire_hit: 'explosion', rock: 'slam', ice: 'hit', parry: 'hit', startup: 'special', land: 'slam', tree_hit: 'crunch', tree_fall: 'slam', tree_chop: 'swing', foliage: 'bush' };
  const SILENT_WITHOUT_SAMPLES = { growl: 1, hiss: 1, step: 1, arrow: 1, fireball: 1, wings: 1, thunder: 1, magic: 1, teleport: 1 };

  function playSample(name) {
    const list = A.bank[name];
    if (!list || !list.length) return false;
    const ctx = A.ctx;
    if (!ctx) return false;
    if (ctx.state === 'suspended') ctx.resume();
    const src = ctx.createBufferSource();
    let vi = Math.floor(rnd() * list.length);
    if (list.length > 1 && vi === A.lastVariant[name]) vi = (vi + 1 + Math.floor(rnd() * (list.length - 1))) % list.length;
    A.lastVariant[name] = vi;
    src.buffer = list[vi];
    src.playbackRate.value = 0.94 + rnd() * 0.12;
    const g = ctx.createGain();
    g.gain.value = TRIM[name] === undefined ? 0.85 : TRIM[name];
    src.connect(g);
    g.connect(A.sfxBus);
    src.start();
    A.voices++;
    src.onended = () => {
      A.voices--;
      g.disconnect();
    };
    return true;
  }

  A.sfx = function (name) {
    if (!A.ctx || !A.unlocked) return;
    if (A.ctx.state === 'suspended') A.ctx.resume();
    const s = CH.Storage.settings;
    if (s.muted || !s.sfxOn) return;
    const now = A.ctx.currentTime;
    const gap = THROTTLE[name] || 0.015;
    if (A.last[name] !== undefined && now - A.last[name] < gap) return;
    A.last[name] = now;
    if (A.voices > 36) return;
    try {
      if (playSample(name)) return;
      const fb = FALLBACK[name];
      if (fb && playSample(fb)) return;
      if (SILENT_WITHOUT_SAMPLES[name]) return;
      const fn = SFX[name] || SFX[fb];
      if (fn) fn();
    } catch (e) {
      /* audio must never break the game */
    }
  };

  /* ---------- ambience: a quiet seamless loop per arena / event ---------- */
  A.ambName = null;
  A.pendingAmb = null;
  let amb = null; // {src, gain}
  function stopAmb() {
    if (!amb) return;
    const a = amb;
    amb = null;
    try {
      a.gain.gain.setTargetAtTime(0, A.ctx.currentTime, 0.25);
      setTimeout(() => {
        try {
          a.src.stop();
          a.gain.disconnect();
        } catch (e) {}
      }, 1200);
    } catch (e) {}
  }
  A.setAmbience = function (name) {
    if (name === A.ambName && (amb || !name)) return;
    A.pendingAmb = name;
    if (!A.ctx || !A.unlocked) return;
    if (A.ctx.state === 'suspended') A.ctx.resume();
    stopAmb();
    A.ambName = name;
    if (!name) return;
    const buf = A.loopBank[name];
    if (!buf) return; // still decoding: started when ready
    try {
      const src = A.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = A.ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain);
      gain.connect(A.sfxBus);
      src.start();
      gain.gain.setTargetAtTime(0.32, A.ctx.currentTime, 0.6);
      amb = { src, gain };
    } catch (e) {
      amb = null;
    }
  };

  /* ---------- music ---------- */
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const MIN = [0, 3, 7, 12, 15, 19, 24];
  const MAJ = [0, 4, 7, 12, 16, 19, 24];

  const TRACKS = {
    menu: {
      bpm: 104,
      chords: [[57, MIN], [53, MAJ], [48, MAJ], [55, MAJ]],
      lead: [0, -1, 2, -1, 3, -1, 2, -1, 4, -1, 3, -1, 2, -1, 1, -1],
      bass: [0, -1, -1, 0, -1, -1, 0, -1, 0, -1, -1, 0, -1, 7, -1, -1],
      drums: 'k.......s.......',
      hats: 'h.h.h.h.h.h.h.h.',
      leadVol: 0.07,
    },
    combat: {
      bpm: 148,
      chords: [[45, MIN], [41, MAJ], [48, MAJ], [43, MAJ], [45, MIN], [41, MAJ], [43, MAJ], [40, MAJ]],
      lead: [0, 2, 4, 2, 3, 2, 4, 5, 4, 2, 3, 2, 1, 2, 3, 4],
      bass: [0, -1, 12, 0, -1, 12, 0, -1, 0, -1, 12, 0, -1, 12, 7, -1],
      drums: 'k...s...k.k.s...',
      hats: 'hhhhhhhhhhhhhhhh',
      leadVol: 0.075,
    },
    boss: {
      bpm: 168,
      chords: [[40, MIN], [40, MIN], [38, MAJ], [39, MAJ], [40, MIN], [43, MAJ], [41, MAJ], [39, MAJ]],
      lead: [4, 3, 4, 5, 6, 5, 4, 3, 2, 3, 4, 3, 6, 5, 4, 2],
      bass: [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 7, 7, 12, 0],
      drums: 'k.k.s.k.k.k.s.sk',
      hats: 'h.hhh.hhh.hhh.hh',
      leadVol: 0.085,
    },
  };

  const ONE_SHOT = { victory: true, gameover: true };
  const files = []; // active <audio> tracks: {el, name, target, cur}
  let fadeTimer = null;

  const musicGain = () => {
    const s = CH.Storage.settings;
    return s.muted || !s.musicOn ? 0 : s.master * s.music;
  };

  function fadeTick() {
    const g = musicGain();
    for (let i = files.length - 1; i >= 0; i--) {
      const t = files[i];
      t.cur += (t.target - t.cur) * 0.12;
      if (t.target === 0 && t.cur < 0.015) {
        try {
          t.el.pause();
          t.el.src = '';
        } catch (e) {}
        files.splice(i, 1);
        continue;
      }
      try {
        t.el.volume = Math.max(0, Math.min(1, t.cur * g * 0.9));
      } catch (e) {}
    }
    if (!files.length && fadeTimer) {
      clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }

  function startFile(name, url) {
    const el = new Audio(url);
    el.loop = !ONE_SHOT[name];
    el.preload = 'auto';
    el.volume = 0;
    const t = { el, name, target: 1, cur: 0 };
    files.push(t);
    const p = el.play();
    if (p && p.catch) {
      p.catch(() => {
        const i = files.indexOf(t);
        if (i >= 0) files.splice(i, 1);
        if (A.trackName === name) startProcedural(name);
      });
    }
    // a missing/corrupt file falls back to the synthesized track of the same name
    el.addEventListener('error', () => {
      const i = files.indexOf(t);
      if (i >= 0) files.splice(i, 1);
      if (A.trackName === name) startProcedural(name);
    });
    if (!fadeTimer) fadeTimer = setInterval(fadeTick, 40);
  }

  /* diagnostics: what the music layer is doing right now */
  A.musicInfo = () => files.map((t) => ({ name: t.name, paused: t.el.paused, volume: +t.el.volume.toFixed(3), time: +t.el.currentTime.toFixed(2), target: t.target }));

  A.setMusic = function (name) {
    if (!A.unlocked) {
      A.pendingTrack = name;
      return;
    }
    if (name === A.trackName) return;
    A.stopMusic();
    A.trackName = name;
    if (!name) return;
    const url = CH.Assets && CH.Assets.music && CH.Assets.music[name];
    if (url) {
      startFile(name, url);
      return;
    }
    startProcedural(name);
  };

  const QUIET = { menu: 1, theme: 1, garden: 1, shop: 1, library: 1, credits: 1, market: 1, funny: 1 };
  const SILENT_TRACKS = { victory: 1, gameover: 1, sad: 1 };
  const BOSSY = { boss: 1, miniboss: 1, dungeon: 1, finalboss: 1, superboss: 1 };
  function startProcedural(name) {
    const key = SILENT_TRACKS[name] ? null : QUIET[name] ? 'menu' : BOSSY[name] ? 'boss' : 'combat';
    if (!A.ctx || !key) return;
    if (A.timer) clearInterval(A.timer);
    const bus = A.ctx.createGain();
    bus.gain.value = 1;
    bus.connect(A.musicBus);
    A.track = { def: TRACKS[key], bus, step: 0, next: A.ctx.currentTime + 0.08 };
    A.timer = setInterval(schedule, 25);
  }

  A.stopMusic = function () {
    if (A.timer) clearInterval(A.timer);
    A.timer = null;
    A.trackName = null;
    for (const t of files) t.target = 0; // fade out, then removed by fadeTick
    if (A.track && A.ctx) {
      const b = A.track.bus;
      try {
        b.gain.setTargetAtTime(0, A.ctx.currentTime, 0.05);
        setTimeout(() => {
          try {
            b.disconnect();
          } catch (e) {}
        }, 400);
      } catch (e) {}
    }
    A.track = null;
  };

  function schedule() {
    const tr = A.track;
    if (!tr || !A.ctx) return;
    const def = tr.def;
    const stepLen = 60 / def.bpm / 4;
    let guard = 0;
    while (tr.next < A.ctx.currentTime + 0.12 && guard++ < 8) {
      const s = tr.step % 16;
      const bar = Math.floor(tr.step / 16) % def.chords.length;
      const [root, scale] = def.chords[bar];
      const delay = Math.max(0, tr.next - A.ctx.currentTime);
      const li = def.lead[s];
      if (li >= 0) tone({ f: mtof(root + 12 + scale[li % scale.length] + (li >= scale.length ? 12 : 0)), type: 'square', dur: stepLen * 1.5, vol: def.leadVol, delay, bus: tr.bus });
      const bi = def.bass[s];
      if (bi >= 0) tone({ f: mtof(root + bi), type: 'triangle', dur: stepLen * 1.8, vol: 0.2, delay, bus: tr.bus });
      const d = def.drums[s];
      if (d === 'k') {
        tone({ f: 150, f2: 40, type: 'sine', dur: 0.12, vol: 0.3, delay, bus: tr.bus });
      } else if (d === 's') {
        noise({ dur: 0.1, f: 1800, filter: 'highpass', vol: 0.12, delay, bus: tr.bus });
      }
      if (def.hats[s] === 'h') noise({ dur: 0.025, f: 7000, filter: 'highpass', vol: 0.03, delay, bus: tr.bus });
      tr.step++;
      tr.next += stepLen;
    }
  }
})(window.CH);
