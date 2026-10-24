/* CHAOS.exe - sealed secrets and the abilities that open them (PLAN.md 18, K8): going back, as in Symphony of the Night.
   A stage's secret rooms are behind a cracked wall (shoot it open) or a seal that only an ability from a later act
   opens, so each act sends you back to the ones before:
     GRAVE HOOK       the act I boss      a ledge too high to climb (it also makes every jump longer)
     BONE BREAKER     the act II boss     boarded doors
     FROST STEP       the act III boss    walls of black water
     LANTERN OF TRUTH Jesus' pilgrimage   false walls (they show no sign until you carry it)
     CULT SIGIL       the cult house (K9) sigil doors
   A seal opens when a hero who has its ability walks up to it; one who has not gets a hint, and the map marks the seal
   with a "?" from then on. Abilities belong to the character's world (world.abilities); opened seals are found secrets,
   so js/areas.js keeps them open. Without a character, G._abilities stands in (tests). */
(function (CH) {
  'use strict';
  const G = CH.G;
  const FX = CH.FX;
  const U = CH.U;
  const Audio = CH.Audio;
  const Level = CH.Level;
  const TS = Level.TS;
  const SEALED = (Level.SEALED = 6);

  const SE = (CH.Secrets = {});
  SE.ABILITIES = {
    hook: { name: 'GRAVE HOOK', desc: 'You jump much farther, and pull yourself up the high ledges.', hint: 'A ledge too high to climb. Something to pull yourself up with...', colour: '#9fd8ef' },
    bone: { name: 'BONE BREAKER', desc: 'Your blows smash boarded doors.', hint: 'Boarded up tight. Something heavier might break it.', colour: '#d1a964' },
    frost: { name: 'FROST STEP', desc: 'Black water freezes under your feet.', hint: 'Black water, too deep to wade.', colour: '#3ccbe6' },
    lantern: { name: 'LANTERN OF TRUTH', desc: 'False walls fade before you.', hint: null, colour: '#fee761' },
    sigil: { name: 'CULT SIGIL', desc: 'Sealed sigil doors open for you.', hint: 'A sigil seals this door. The cult would know the word.', colour: '#b55088' },
  };
  SE.ACT = { 1: 'hook', 2: 'bone', 3: 'frost' };
  /* which seals a stage of each act may carry: abilities you can only have later (or at the end of that act) */
  const LATER = { 1: ['hook', 'bone', 'frost', 'lantern'], 2: ['bone', 'frost', 'lantern', 'sigil'], 3: ['frost', 'lantern', 'sigil'], 4: ['lantern', 'sigil'] };

  const world = () => (CH.Areas && CH.Areas.world()) || null;
  SE.list = () => { const W = world(); return W ? (W.abilities = W.abilities || []) : (G._abilities = G._abilities || []); };
  SE.has = (id) => SE.list().includes(id);
  SE.grant = function (id) {
    if (!SE.ABILITIES[id] || SE.has(id)) return false;
    SE.list().push(id);
    const a = SE.ABILITIES[id];
    G.banner(a.name, a.desc + ' Somewhere you have been, something opens for it.', 3.4);
    Audio.sfx('levelup');
    const p = G.player;
    if (p) FX.ring(p.x, p.y, 6, 90, a.colour, 0.8);
    if (CH.Character) CH.Character.save();
    return true;
  };

  /* level generation (js/levelgen.js): seal some of the stage's secret rooms */
  SE.seal = function (L, R, stage) {
    L.gates = [];
    const act = Math.min(4, Math.max(1, Math.ceil(stage / 3)));
    const pool = LATER[act];
    L.secrets.forEach((s, i) => {
      if (i === 0 && R.f() < 0.35) return; // the first one is sometimes a plain cracked wall
      s.need = pool[Math.floor(R.f() * pool.length)];
      L.set(s.crack.x, s.crack.y, SEALED);
      L.gates.push(s);
    });
  };

  /* ------------------------------------------------------------------ opening, hints */
  G.on('step', function () {
    const L = G.level;
    if (!L || !L.gates || !L.gates.length || G.state !== 'playing') return;
    for (const s of L.gates) {
      if (s.found) continue;
      const gx = (s.crack.x + 0.5) * TS, gy = (s.crack.y + 0.5) * TS;
      const reach = s.need === 'lantern' ? 96 : 46;
      const near = G.players.find((p) => !p.dead && U.dist(p.x, p.y + 10, gx, gy) < reach);
      if (!near) continue;
      if (SE.has(s.need)) SE.open(L, s);
      else if (SE.ABILITIES[s.need].hint && (!s.hinted || G.time - s.hinted > 6)) {
        s.hinted = G.time;
        s.seen = true;
        FX.text(gx, gy - 18, SE.ABILITIES[s.need].hint, '#b9b4c8', 2.5);
        Audio.sfx('nope');
      }
    }
  });
  SE.open = function (L, s) {
    s.found = true;
    L.set(s.crack.x, s.crack.y, Level.FLOOR);
    L.chunks.clear();
    L.flows.clear();
    const gx = (s.crack.x + 0.5) * TS, gy = (s.crack.y + 0.5) * TS;
    const a = SE.ABILITIES[s.need];
    FX.burst(gx, gy, { n: 26, colors: [a.colour, '#ffffff'], speed: 120, life: 0.7 });
    G.shake(4, 0.3);
    Audio.sfx('rock');
    G.banner('SECRET FOUND', a.name + ' opened the way.', 2.2);
    L.reveal(s.cx, s.cy, 6);
    if (CH.Run.onSecret) CH.Run.onSecret(s);
  };

  /* ------------------------------------------------------------------ the seals, drawn over their wall tile */
  CH.Hooks.world.push((ctx, cam) => {
    const L = G.level;
    if (!L || !L.gates) return;
    const t = G.time || 0;
    for (const s of L.gates) {
      if (s.found) continue;
      const x = s.crack.x * TS - Math.round(cam.x), y = s.crack.y * TS - Math.round(cam.y);
      if (x < -40 || y < -40 || x > CH.Balance.view.w + 40 || y > CH.Balance.view.h + 40) continue;
      if (!L.explored[L.idx(s.crack.x, s.crack.y)]) continue;
      ctx.save();
      if (s.need === 'bone') { // planks nailed across
        for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? '#6b4a2a' : '#8a6238'; ctx.fillRect(x + 2, y + 6 + i * 9, TS - 4, 6); ctx.fillStyle = '#2a1a0a'; ctx.fillRect(x + 5, y + 8 + i * 9, 2, 2); ctx.fillRect(x + TS - 7, y + 8 + i * 9, 2, 2); }
      } else if (s.need === 'sigil') { // a glowing sigil
        ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 3);
        ctx.strokeStyle = '#b55088';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x + 16, y + 16, 10, 0, 6.283); ctx.stroke();
        ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k * 2.513 - 1.57; ctx[k ? 'lineTo' : 'moveTo'](x + 16 + Math.cos(a) * 9, y + 16 + Math.sin(a) * 9); } ctx.stroke();
      } else if (s.need === 'frost') { // black water standing in the wall's place
        ctx.fillStyle = 'rgba(6,14,28,0.92)';
        ctx.fillRect(x + 1, y + 1, TS - 2, TS - 2);
        ctx.fillStyle = 'rgba(120,200,255,' + (0.25 + 0.15 * Math.sin(t * 2 + x)) + ')';
        ctx.fillRect(x + 6, y + 8 + Math.round(Math.sin(t * 1.5) * 2), 12, 1);
        ctx.fillRect(x + 14, y + 20 + Math.round(Math.cos(t * 1.3) * 2), 10, 1);
      } else if (s.need === 'hook') { // an iron ring high on the ledge, a frayed rope
        ctx.strokeStyle = '#a6b0bf';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x + 16, y + 7, 4, 0, 6.283); ctx.stroke();
        ctx.fillStyle = '#8a6238';
        ctx.fillRect(x + 15, y + 11, 2, 9);
      } else if (s.need === 'lantern' && SE.has('lantern')) { // only the lantern shows a false wall
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 4);
        ctx.strokeStyle = '#fee761';
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(x + 2, y + 2, TS - 4, TS - 4);
      }
      ctx.restore();
    }
  });

  /* the Grave Hook makes every jump longer */
  const prevJump = CH.Player.prototype.startJump;
  CH.Player.prototype.startJump = function (g) {
    prevJump.call(this, g);
    if (this.jumping && SE.has('hook')) this.vz *= 1.35;
  };

  /* act bosses give the act's ability (js/areas.js calls this once an act's boss falls) */
  SE.forAct = (act) => { const id = SE.ACT[act]; return id ? SE.grant(id) : false; };
})(window.CH);
