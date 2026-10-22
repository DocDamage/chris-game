/* CHAOS.exe - quests per act (PLAN.md section 4.10), difficulty tiers (4.11) and the secret sidekick unlocks (section 7).
   Quests start by themselves when their act is reached; progress comes from game events; rewards are claimed in the
   Journal. Unlock conditions for the eleven secret sidekicks live here too. Saved under Storage.data.diablo. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const G = CH.G;
  const X = CH.X;
  const Storage = CH.Storage;
  const Audio = CH.Audio;
  const wrap = X.wrap;

  const Q = (CH.Quests = {});
  Q.ACTS = ['I. The Broken Backyard', 'II. Corporate Hell', 'III. The Deep', 'IV. The Glitch'];
  Q.actOf = (stage) => Math.min(4, Math.max(1, Math.ceil(stage / 3)));

  /* ev: the event name that advances the quest (all but 'lost' count per occurrence) */
  Q.LIST = [
    { id: 'a1_breach', act: 1, name: 'Weed Whacker', desc: 'Close 6 breaches.', ev: 'breach', goal: 6, coins: 60 },
    { id: 'a1_chest', act: 1, name: 'Treasure Hunter', desc: 'Open 5 chests.', ev: 'chest', goal: 5, coins: 60, gear: 'magic' },
    { id: 'a1_lost', act: 1, name: 'The Lost Shrine', desc: 'Find the Lost Shrine in the second stage and light it.', ev: 'lost', goal: 1, coins: 100, sidekick: 'runegolem' },
    { id: 'a2_kill', act: 2, name: 'Exterminator', desc: 'Defeat 150 enemies.', ev: 'kill', goal: 150, coins: 90 },
    { id: 'a2_elite', act: 2, name: 'Champion Slayer', desc: 'Defeat 10 champions.', ev: 'elite', goal: 10, coins: 90, gear: 'rare' },
    { id: 'a2_secret', act: 2, name: 'Secret Squirrel', desc: 'Find 2 secret rooms.', ev: 'secret', goal: 2, coins: 90 },
    { id: 'a3_shrine', act: 3, name: 'Shrine Hopper', desc: 'Use 4 shrines.', ev: 'shrine', goal: 4, coins: 120 },
    { id: 'a3_boss', act: 3, name: 'Boss Fan', desc: 'Defeat 2 bosses.', ev: 'boss', goal: 2, coins: 140, gear: 'rare' },
    { id: 'a3_stage', act: 3, name: 'Cold Case', desc: 'Clear 3 stages.', ev: 'stage', goal: 3, coins: 120 },
    { id: 'a4_breach', act: 4, name: 'Zero Day', desc: 'Close 8 breaches.', ev: 'breach', goal: 8, coins: 160 },
    { id: 'a4_elite', act: 4, name: 'Final Exam', desc: 'Defeat 15 champions.', ev: 'elite', goal: 15, coins: 160, gear: 'legendary' },
    { id: 'a4_boss', act: 4, name: 'Debug the Universe', desc: 'Defeat the final boss.', ev: 'final', goal: 1, coins: 300, gear: 'legendary' },
  ];
  Q.byId = {};
  for (const q of Q.LIST) Q.byId[q.id] = q;

  const D = () => {
    const d = Storage.data;
    if (!d.diablo || typeof d.diablo !== 'object') d.diablo = { bag: [], stash: [], equipped: {}, belt: [], tier: 0 };
    if (!d.diablo.quests) d.diablo.quests = {};
    if (!d.diablo.counts) d.diablo.counts = {};
    return d.diablo;
  };
  Q.state = (id) => D().quests[id] || { n: 0, st: 'active' };
  Q.active = () => Q.LIST.filter((q) => q.act <= Q.actOf(G.wave || 1) || Q.state(q.id).st === 'done' || Q.state(q.id).st === 'claimed');

  Q.event = function (ev, n) {
    n = n || 1;
    D().counts[ev] = (D().counts[ev] || 0) + n;
    for (const q of Q.LIST) {
      if (q.ev !== ev || q.act > Q.actOf(G.wave || 1)) continue;
      const s = D().quests[q.id] || (D().quests[q.id] = { n: 0, st: 'active' });
      if (s.st !== 'active') continue;
      s.n = Math.min(q.goal, s.n + n);
      if (s.n >= q.goal) {
        s.st = 'done';
        if (G.ui && G.ui.toast) G.ui.toast('QUEST COMPLETE: ' + q.name);
        Audio.sfx('levelup');
        if (q.sidekick && CH.SK) CH.SK.unlock(q.sidekick);
      }
    }
    secrets(ev, n);
  };
  Q.claim = function (id) {
    const q = Q.byId[id];
    const s = D().quests[id];
    if (!q || !s || s.st !== 'done') return false;
    s.st = 'claimed';
    if (q.coins) { if (G.state === 'menu' || !G.player) Storage.stats.totalCoins += q.coins; else G.addCoins(q.coins, G.player.x, G.player.y); }
    if (q.gear && CH.Items) {
      const it = CH.Items.roll(Math.max(1, G.wave || 1), { rarity: q.gear });
      if (!CH.Items.addToBag(it)) CH.Items.drop(G.player ? G.player.x : 0, G.player ? G.player.y : 0, it);
    }
    Audio.sfx('buy');
    Storage.save();
    return true;
  };

  /* ------------------------------------------------------------------ events from the game */
  wrap(G, 'killEnemy', function (orig, e) {
    const was = e.dead;
    orig.call(G, e);
    if (was || e.training || e.isSpawner) return;
    Q.event('kill');
    if (e.isElite || e.affix) {
      Q.event('elite');
      D().counts.eliteLife = (D().counts.eliteLife || 0) + 1;
      if (D().counts.eliteLife >= 100) CH.SK && CH.SK.unlock('raven');
    }
  });
  const R = CH.Run;
  if (R) {
    const ob = R.onBreachClosed;
    R.onBreachClosed = function (h) { ob(h); Q.event('breach'); };
    R.onChest = () => Q.event('chest');
    R.onSecret = (s) => { Q.event('secret'); if (s.kind === 'dojo') CH.SK && CH.SK.unlock('monk'); if (s.kind === 'garage') CH.SK && CH.SK.unlock('nightrider'); };
  }
  wrap(G, 'waveComplete', function (orig) {
    const r = orig.call(G);
    Q.event('stage');
    return r;
  });
  wrap(G, 'onBossDefeated', function (orig, b) {
    const r = orig.call(G, b);
    Q.event('boss');
    const k = b.kind, SK = CH.SK;
    if (SK) {
      if (['dragon', 'dunewyrm', 'bloodwyrm'].includes(k)) SK.unlock('aurex');
      if (['ooze', 'sporeeye'].includes(k)) SK.unlock('corvus');
      if (k === 'demon' && Q.tier() >= 1) SK.unlock('oni');
      if (k === 'yeti' && G.level && G.level.biome === 'frozen' || (k === 'yeti' && G.arena && G.arena.id === 'frozen')) SK.unlock('lich');
      if (k === 'skull') SK.unlock('maldrath');
      if (k === 'voideye' && G.night) SK.unlock('morwen');
    }
    if (['bug', 'skull', 'daddy'].includes(k) && b.tier === 0 && !G.endless) Q.event('final');
    return r;
  });
  /* secret sidekicks that count something */
  function secrets(ev) {
    if (ev === 'parry' && G.run && (G.run.parries = (G.run.parries || 0) + 1) >= 25 && CH.SK) CH.SK.unlock('kitsune');
  }
  wrap(G, 'deflectProjectiles', function (orig, x, y, r, ang, arc, who) {
    const before = G.projectiles.filter((p) => p.owner === 'e' && !p.dead).length;
    const res = orig.call(G, x, y, r, ang, arc, who);
    if (before > G.projectiles.filter((p) => p.owner === 'e' && !p.dead).length) Q.event('parry');
    return res;
  });
  const origNew = G.newRun;
  G.newRun = function (c) { const r = origNew.call(G, c); if (G.run) G.run.parries = 0; return r; };

  /* ------------------------------------------------------------------ difficulty tiers */
  Q.TIERS = [
    { name: 'NORMAL', hp: 1, dmg: 1, loot: 1 },
    { name: 'NIGHTMARE', hp: 1.5, dmg: 1.25, loot: 1.3 },
    { name: 'HELL', hp: 2.3, dmg: 1.6, loot: 1.7 },
  ];
  Q.tier = () => Math.min(2, D().tier || 0);
  Q.unlockedTier = () => Math.min(2, D().tierUnlocked || 0);
  Q.setTier = (t) => { if (t <= Q.unlockedTier()) { D().tier = t; Storage.save(); return true; } return false; };
  wrap(G, 'newRun', function (orig, config) {
    const r = orig.call(G, config);
    const t = Q.TIERS[Q.tier()];
    if (t.hp !== 1 || t.dmg !== 1) G.diff = Object.assign({}, G.diff, { enemyHp: G.diff.enemyHp * t.hp, enemyDmg: G.diff.enemyDmg * t.dmg });
    G.tierName = t.name;
    return r;
  });
  wrap(G, 'victory', function (orig) {
    const t = Q.tier();
    if (t >= D().tierUnlocked && t < 2) { D().tierUnlocked = t + 1; Storage.save(); G.ui.toast && G.ui.toast(Q.TIERS[t + 1].name + ' UNLOCKED'); }
    return orig.call(G);
  });
})(window.CH);
