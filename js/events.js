/* CHAOS.exe - random chaos events. Each event is a plain object registered in one list, so adding
   a new one is just adding an entry. Events change real gameplay through G.mods and their own update().
   Only one event runs at a time, which keeps control-changing events from ever stacking. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const Audio = CH.Audio;

  const Ev = (CH.Events = { list: [], byId: {} });

  /* def: {id, name, desc, duration, warn?, weight?, start(g,ev), tick?(g,dt,ev), end(g,ev), minWave?} */
  Ev.register = function (def) {
    Ev.list.push(def);
    Ev.byId[def.id] = def;
  };

  const randArena = (g, m) => ({ x: U.rand(m, g.arena.w - m), y: U.rand(m, g.arena.h - m) });

  Ev.register({
    id: 'lowgrav',
    music: 'garden',
    sfx: 'wings',
    name: 'LOW GRAVITY',
    desc: 'Everything drifts! Longer slides, longer dodges, enemies fly when hit.',
    duration: 16,
    start(g) {
      g.mods.lowGrav = true;
      g.mods.kbMul = 2.6;
    },
    tick(g, dt) {
      if (Math.random() < dt * 6) FX.burst(U.rand(0, g.arena.w), g.arena.h + 4, { n: 1, colors: ['#ffffff', '#3ccbe6'], speed: 10, up: 40, life: 2, drag: 0.2, size: 2 });
    },
    end(g) {
      g.mods.lowGrav = false;
      g.mods.kbMul = 1;
    },
  });

  Ev.register({
    id: 'chickenrain',
    music: 'rain',
    amb: 'amb_rain',
    sfx: 'thunder',
    name: 'CHICKEN RAIN',
    desc: 'Chickens fall from the sky. Watch the shadows! They hurt everyone.',
    duration: 15,
    start(g, ev) {
      ev.t = 0;
    },
    tick(g, dt, ev) {
      ev.t -= dt;
      if (ev.t > 0) return;
      ev.t = 0.4;
      const p = g.randomAlivePlayer();
      const near = Math.random() < 0.45;
      const pos = near ? { x: U.clamp(p.x + U.rand(-90, 90), 30, g.arena.w - 30), y: U.clamp(p.y + U.rand(-90, 90), 30, g.arena.h - 30) } : randArena(g, 30);
      g.addWarn(pos.x, pos.y, 16, 1.0, (g2, z) => {
        FX.burst(z.x, z.y, { n: 14, colors: ['#ffffff', '#e8e4f0', '#e43b44'], speed: 110, life: 0.5, g: 90 });
        FX.debris('chicken_proj', z.x, z.y - 6, U.rand(-30, 30), -80);
        g2.explode(z.x, z.y, 16, 28, { owner: 'p', hitEnemies: true, hurtPlayer: true, pdmg: g2.edmg(12), colors: 'cheese', knock: 120, noShake: true });
        Audio.sfx('squeak');
      }, { sprite: 'chicken_proj', fall: true });
    },
    end() {},
  });

  Ev.register({
    id: 'bighead',
    music: 'funny',
    sfx: 'popup',
    name: 'BIG HEAD MODE',
    desc: 'Huge heads! Hit boxes are bigger and headshots deal +40% damage.',
    duration: 18,
    start(g) {
      g.mods.bigHead = true;
    },
    end(g) {
      g.mods.bigHead = false;
    },
  });

  Ev.register({
    id: 'reverse',
    music: 'secret',
    sfx: 'glitch',
    name: 'REVERSE CONTROLS',
    desc: 'Movement is REVERSED! Up is down. Left is right. Good luck.',
    duration: 12,
    warn: 2.5,
    start(g) {
      g.mods.reverse = true;
    },
    end(g) {
      g.mods.reverse = false;
    },
  });

  Ev.register({
    id: 'disco',
    music: 'market',
    sfx: 'glass',
    name: 'DISCO INFERNO',
    desc: 'The floor is a dance floor! Enemies move 25% faster. Kills score +50%.',
    duration: 15,
    start(g) {
      g.mods.disco = true;
      g.mods.enemySpeed = 1.25;
      g.mods.scoreMul = 1.5;
    },
    tick(g, dt, ev) {
      ev.t = (ev.t || 0) - dt;
      if (ev.t <= 0) {
        ev.t = 0.5;
        g.mods.discoBeat = (g.mods.discoBeat + 1) % 6;
      }
    },
    end(g) {
      g.mods.disco = false;
      g.mods.enemySpeed = 1;
      g.mods.scoreMul = 1;
    },
  });

  Ev.register({
    id: 'money',
    music: 'shop',
    sfx: 'buy',
    name: 'FREE MONEY',
    desc: 'Coins rain from the sky! Grab as many as you can.',
    duration: 12,
    start(g, ev) {
      ev.t = 0;
    },
    tick(g, dt, ev) {
      ev.t -= dt;
      if (ev.t > 0) return;
      ev.t = 0.16;
      const p = g.randomAlivePlayer();
      const near = Math.random() < 0.5;
      const pos = near ? { x: U.clamp(p.x + U.rand(-140, 140), 24, g.arena.w - 24), y: U.clamp(p.y + U.rand(-90, 90), 24, g.arena.h - 24) } : randArena(g, 24);
      g.dropPickup('coin', pos.x, pos.y, 1, { still: true, life: 14, noBonus: true });
    },
    end() {},
  });

  Ev.register({
    id: 'tiny',
    music: 'funny',
    sfx: 'squeak',
    name: 'TINY ENEMIES',
    desc: 'Enemies shrink to 60% size and run 40% faster. Harder to hit!',
    duration: 15,
    start(g) {
      g.mods.enemyScale = 0.6;
      g.mods.enemySpeed = 1.4;
    },
    end(g) {
      g.mods.enemyScale = 1;
      g.mods.enemySpeed = 1;
    },
  });

  Ev.register({
    id: 'lava',
    music: 'dungeon',
    amb: 'amb_fire',
    sfx: 'sizzle',
    name: 'THE FLOOR IS LAVA',
    desc: 'Lava pools appear (with warning). Burns you AND enemies. Keep moving!',
    duration: 17,
    start(g, ev) {
      ev.t = 0.5;
    },
    tick(g, dt, ev) {
      ev.t -= dt;
      if (ev.t > 0) return;
      ev.t = 1.0;
      if (g.countZones('lava') + g.countZones('warn') > 9) return;
      const p = g.randomAlivePlayer();
      const near = Math.random() < 0.5;
      const pos = near ? { x: U.clamp(p.x + U.rand(-110, 110), 36, g.arena.w - 36), y: U.clamp(p.y + U.rand(-80, 80), 36, g.arena.h - 36) } : randArena(g, 36);
      const r = U.rand(22, 34);
      g.addWarn(pos.x, pos.y, r, 1.5, (g2, z) => {
        g2.addZone({ kind: 'lava', x: z.x, y: z.y, r, life: 4.5, dmgP: g2.edmg(9), dmgE: 5, tick: 0.5 });
      }, { lava: true });
    },
    end(g) {
      for (const z of g.zones) if (z.kind === 'lava') z.life = Math.min(z.life, 0.6);
    },
  });

  Ev.register({
    id: 'explosive',
    music: 'battle',
    sfx: 'big_explosion',
    name: 'EVERYTHING IS EXPLOSIVE',
    desc: 'Defeated enemies EXPLODE. Chain reactions hurt them... and you if you stand close.',
    duration: 16,
    start(g) {
      g.mods.explosiveDeaths = true;
    },
    end(g) {
      g.mods.explosiveDeaths = false;
    },
  });

  Ev.register({
    id: 'restructure',
    music: 'hall',
    sfx: 'door_auto',
    name: 'CORPORATE RESTRUCTURING',
    desc: 'A wave of office workers is arriving. Per my last email: run.',
    duration: 10,
    minWave: 2,
    start(g) {
      const n = Math.min(10, Math.max(5, 4 + g.wave));
      const room = Math.max(0, g.aliveCap() + 6 - g.enemies.length);
      for (let i = 0; i < Math.min(n, room); i++) {
        const pos = g.spawnPos();
        g.spawnEnemy('office', pos.x, pos.y, { summoned: false, spawnTime: 0.6 });
      }
      FX.speech(g.player, 'WHO INVITED THEM?', 2);
    },
    end() {},
  });

  /* ---------- scheduler ---------- */
  Ev.nextGap = function (g, first) {
    const e = B.events;
    const base = first ? U.rand(e.firstGapMin, e.firstGapMax) : U.rand(e.minGap, e.maxGap);
    return base * g.diff.eventInterval;
  };

  Ev.start = function (g, def) {
    def = def || U.pick(Ev.list.filter((d) => (d.minWave || 0) <= g.wave));
    g.event = { def, left: def.duration, warn: def.warn || 0, t: 0, active: !def.warn };
    if (g.event.active) def.start(g, g.event);
    Audio.sfx('event');
    if (def.sfx) Audio.sfx(def.sfx);
    g.playMusic();
    g.banner('CHAOS EVENT: ' + def.name, def.desc, 3.4);
    g.ui.eventStart(def);
  };

  Ev.end = function (g, natural) {
    const ev = g.event;
    if (!ev) return;
    if (ev.active) ev.def.end(g, ev);
    g.event = null;
    Audio.sfx('event_end');
    g.playMusic();
    if (natural) {
      g.addScore(B.score.eventSurvived * g.diff.score);
      g.ui.toast(ev.def.name + ' ENDED  +' + B.score.eventSurvived);
    }
    g.eventTimer = Ev.nextGap(g, false);
  };

  Ev.update = function (g, dt) {
    if (g.event) {
      const ev = g.event;
      if (!ev.active) {
        ev.warn -= dt;
        if (ev.warn <= 0) {
          ev.active = true;
          ev.def.start(g, ev);
          g.playMusic();
          g.banner(ev.def.name + '!', 'NOW!', 1.6);
          Audio.sfx('glitch');
        }
        return;
      }
      ev.left -= dt;
      if (ev.def.tick) ev.def.tick(g, dt, ev);
      if (ev.left <= 0) Ev.end(g, true);
    } else if (g.waveState === 'combat' && !g.bossAlive() && !(CH.Areas && CH.Areas.world())) { // a character's world has omens instead (js/omens.js)
      g.eventTimer -= dt;
      if (g.eventTimer <= 0) Ev.start(g);
    }
  };

  /* scoring helper: kills during an event are worth more */
  Ev.active = (g) => !!(g.event && g.event.active);
})(window.CH);
