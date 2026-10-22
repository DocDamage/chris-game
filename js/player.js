/* CHAOS.exe - the hero: movement, sprint/stamina, dodge roll, weapons, special ability. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const Audio = CH.Audio;
  const Input = CH.Input;
  const P = B.player;

  function getDir8(a) {
    const norm = Math.atan2(Math.sin(a), Math.cos(a));
    const oct = Math.floor(((norm + Math.PI * 2 + Math.PI / 8) % (Math.PI * 2)) / (Math.PI / 4));
    const dirs = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
    return dirs[oct] || 'e';
  }

  function isNearJumpableProp(p, g) {
    if (p.onProp) return true;
    if (!g || !g.arena || !g.arena.props) return false;
    for (const prop of g.arena.props) {
      if (prop.dead || !prop.jumpable) continue;
      const px = prop.x + (prop.cx || 0);
      const py = prop.y + (prop.cy || 0);
      const dx = p.x - px;
      const dy = p.y - py;
      const jumpDist = (prop.cr || 10) + p.r + 22;
      if (dx * dx + dy * dy <= jumpDist * jumpDist) return true;
    }
    return false;
  }

  class Player {
    constructor(g, idx, heroId, src) {
      this.g = g;
      this.idx = idx || 0;
      this.name = 'P' + (this.idx + 1);
      this.color = ['#3ccbe6', '#feae34', '#63c74d', '#d55fe0'][this.idx] || '#ffffff';
      this.inp = new Input.PlayerInput(src || { kind: 'auto' });
      this.x = B.arena.w / 2;
      this.y = B.arena.h / 2;
      this.r = P.radius;
      this.vx = 0;
      this.vy = 0;
      this.kx = 0;
      this.ky = 0;
      this.stats = {};
      const S = CH.Storage.settings;
      this.hero = B.heroes.find((h) => h.id === (heroId || (this.idx === 0 ? S.hero : S.hero2))) || B.heroes[0];
      this.cast = null; // {t, dur, fireAt, fired} while the hero channels a special
      this.upgrades = CH.Upgrades.newLevels();
      this.passives = { dmg: 0, hp: 0, speed: 0, armor: 0, crit: 0 };
      this.maxHp = 0;
      this.hp = 0;
      CH.Upgrades.recalc(this);
      this.hp = this.maxHp;
      this.stamina = P.stamina;
      this.exhausted = false;
      this.regenDelay = 0;
      this.rolling = false;
      this.rollT = 0;
      this.rollDx = 1;
      this.rollDy = 0;
      this.rollCd = 0;
      this.rollGrace = 0;
      this.invuln = 0;
      this.flash = 0;
      this.dead = false;
      this.deathT = 0;
      this.aim = 0;
      this.face = 1;
      this.dir8 = 'e';
      this.weapons = ['junk'];
      this.weapon = 'junk'; // primary: right trigger / left mouse
      this.weapon2 = null; // secondary: left trigger / right mouse
      this.heldWeapon = 'junk'; // what the hero is visibly holding (last one fired)
      // gadget charges: left bumper / G. The safehouse radio adds one per level.
      this.maxNades = 3 + ((CH.Storage.shelter && CH.Storage.shelter.radio) || 0);
      this.nades = this.maxNades;
      this.nadeT = 0;
      this.gadget = 'frag';
      this.reviveT = 0; // progress while a teammate revives this (downed) player
      this.aimInit = false;
      this.aimDist = 90;
      this.sx = 0; // on-screen position (logical px), maintained by the camera
      this.sy = 0;
      this._sprintPrev = false;
      this.ws = { junk: CH.Weapons.newState('junk') };
      this.kick = 0;
      this.fireT = 0;
      this.swing = null;
      this.swingDir = false;
      this.specialCd = 0;
      this.xp = 0;
      this.level = 1;
      this.buffs = {};
      for (const k of Object.keys(B.pickupsBuff)) this.buffs[k] = 0;
      this.shield = 0;
      this.slowT = 0;
      this.distractT = 0;
      this.walkT = 0;
      this.realityT = 20;
      this.tiredMsgT = 0;
      this.hurtDirX = 0;
      this.hurtDirY = 0;
      this.moving = false;
      this.sprinting = false;
      this.stepT = 0.2;
      this.z = 0;
      this.vz = 0;
      this.jumping = false;
      this.onProp = null;
    }

    get h() {
      return 20;
    }

    get speed() {
      return P.speed * (this.stats && this.stats.speedMult ? this.stats.speedMult : 1);
    }

    update(g, dt) {
      if (this.dead) {
        this.deathT += dt;
        this.vx = this.vy = 0;
        return;
      }
      const mods = g.mods;
      if (this.invuln > 0) this.invuln -= dt;
      if (this.flash > 0) this.flash -= dt * 5;
      if (this.rollCd > 0) this.rollCd -= dt;
      if (this.rollGrace > 0) this.rollGrace -= dt;
      if (this.specialCd > 0) this.specialCd -= dt;
      if (this.kick > 0) this.kick = Math.max(0, this.kick - dt * 30);
      if (this.fireT > 0) this.fireT -= dt;
      if (this.slowT > 0) this.slowT -= dt;
      if (this.distractT > 0) this.distractT -= dt;
      if (this.tiredMsgT > 0) this.tiredMsgT -= dt;
      for (const k in this.buffs) {
        if (this.buffs[k] > 0) {
          this.buffs[k] -= dt;
          if (k === 'regen' && !this.dead) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.035 * dt);
          if (this.buffs[k] <= 0) {
            this.buffs[k] = 0;
            if (k === 'shield') this.shield = 0;
            if (k === 'luck') CH.Upgrades.recalc(this);
          }
        }
      }
      if (this.swing) {
        this.swing.t += dt;
        if (this.swing.t >= this.swing.dur) this.swing = null;
      }

      // ---- aim & facing ----
      this.updateAim(g, dt);
      const inp = this.inp;
      const hasMove = (inp.mx !== 0 || inp.my !== 0);
      const faceAngle = (hasMove && !this.rolling && (!inp || (inp.kind !== 'pad' && !inp.fire1 && !inp.fire2) || (inp.kind === 'pad' && inp.am <= 0.22))) ? Math.atan2(this.vy || inp.my, this.vx || inp.mx) : this.aim;
      this.dir8 = getDir8(faceAngle);
      this.face = Math.cos(faceAngle) >= 0 ? 1 : -1;
      if (this.nades < this.maxNades) {
        this.nadeT -= dt;
        if (this.nadeT <= 0) {
          this.nades++;
          this.nadeT = P.nadeRecharge;
        }
      }

      // ---- channelling a special: rooted and invulnerable until the animation finishes ----
      if (this.cast) {
        const c = this.cast;
        c.t += dt;
        if (!c.fired && c.t >= c.fireAt) {
          c.fired = true;
          this.castEffect(g);
        }
        this.vx = this.vy = 0;
        this.moving = false;
        this.sprinting = false;
        this.x = U.clamp(this.x + this.kx * dt, B.arena.margin + this.r, g.arena.w - B.arena.margin - this.r);
        this.y = U.clamp(this.y + this.ky * dt, B.arena.margin + this.r, g.arena.h - B.arena.margin - this.r);
        this.kx *= Math.max(0, 1 - 9 * dt);
        this.ky *= Math.max(0, 1 - 9 * dt);
        CH.Weapons.updateStates(this, dt);
        inp.take('dodge');
        if (c.t >= c.dur) this.cast = null;
        return;
      }

      // ---- movement ----
      let mv = { x: inp.mx, y: inp.my };
      if (mods.reverse) {
        mv = { x: -mv.x, y: -mv.y };
      }
      this.moving = mv.x !== 0 || mv.y !== 0;

      // standing at a vending machine, B means BUY: it must not also roll you away
      if (inp.edges.interact && g.canInteract(this)) {
        inp.take('dodge');
        inp.take('jump');
      }

      // Jump and Dodge input resolution
      const wantsJump = inp.edges['jump'];
      const wantsDodge = inp.edges['dodge'];
      if (wantsJump && wantsDodge) {
        inp.take('jump');
        inp.take('dodge');
        if (this.onProp || isNearJumpableProp(this, g)) {
          if (!this.rolling && !this.jumping && !this.cast) this.startJump(g);
        } else {
          if (!this.rolling && this.rollCd <= 0) {
            if (this.stamina >= P.dodgeCost) this.startRoll(g, mv, this.moving);
            else this.tired(g);
          }
        }
      } else if (wantsJump) {
        inp.take('jump');
        if (!this.rolling && !this.jumping && !this.cast) this.startJump(g);
      } else if (wantsDodge) {
        inp.take('dodge');
        if (!this.rolling && this.rollCd <= 0) {
          if (this.stamina >= P.dodgeCost) this.startRoll(g, mv, this.moving);
          else this.tired(g);
        }
      }

      // fortify / deploy barricade
      if (inp.take('fortify') && !this.rolling && !this.cast) {
        this.deployBarricade(g);
      }

      let speed = P.speed * this.stats.speedMult;
      if (this.buffs.haste > 0) speed *= 1.25;
      if (this.slowT > 0) speed *= 0.62;

      // sprint
      this.sprinting = false;
      const sprintEdge = inp.sprint && !this._sprintPrev;
      this._sprintPrev = inp.sprint;
      if (inp.sprint && hasMove && !this.rolling) {
        if (!this.exhausted && this.stamina > 0) {
          this.sprinting = true;
          speed *= P.sprintMult;
          this.sprintFx = (this.sprintFx || 0) - dt;
          if (this.sprintFx <= 0) {
            this.sprintFx = 0.17;
            CH.Kit.trail('earth', this.x - mv.x * 4, this.y + 6, 7, { alpha: 0.8 });
          }
          this.stamina -= P.sprintCost * dt;
          this.regenDelay = P.staminaRegenDelay;
          if (this.stamina <= 0) {
            this.stamina = 0;
            this.exhausted = true;
            this.tired(g);
          }
        } else if (sprintEdge) {
          this.tired(g);
          inp.sprintOn = false;
        }
      }
      if (!this.sprinting && !this.rolling) {
        if (this.regenDelay > 0) this.regenDelay -= dt;
        else {
          this.stamina = Math.min(P.stamina, this.stamina + this.stats.staminaRegen * dt);
          if (this.exhausted && this.stamina >= P.exhaustResume) this.exhausted = false;
        }
      }

      if (this.rolling) {
        this.rollT -= dt;
        const sp = (P.dodgeSpeed * this.stats.dodgeDist) * (mods.lowGrav ? 1.25 : 1);
        this.vx = this.rollDx * sp;
        this.vy = this.rollDy * sp;
        this.dustT = (this.dustT || 0) - dt;
        if (this.dustT <= 0) {
          this.dustT = 0.07;
          FX.vfx('vfx.p1.12', this.x, this.y + 7, { scale: 0.45, fps: 26, alpha: 0.8, flip: this.rollDx < 0 });
          CH.Kit.trail(CH.Kit.heroElem(this), this.x - this.rollDx * 4, this.y - 2, 7, { alpha: 0.85 });
        }
        if (this.rollT <= 0) {
          this.rolling = false;
          this.rollGrace = P.dodgeIframesExtra;
        }
      } else {
        const tx = mv.x * speed;
        const ty = mv.y * speed;
        const acc = P.accel * (mods.lowGrav ? 0.12 : 1);
        const dx = tx - this.vx;
        const dy = ty - this.vy;
        const len = Math.hypot(dx, dy);
        const step = acc * dt;
        if (len <= step || len === 0) {
          this.vx = tx;
          this.vy = ty;
        } else {
          this.vx += (dx / len) * step;
          this.vy += (dy / len) * step;
        }
      }

      this.x += (this.vx + this.kx) * dt;
      this.y += (this.vy + this.ky) * dt;
      const k = Math.max(0, 1 - 9 * dt);
      this.kx *= k;
      this.ky *= k;
      const m = B.arena.margin + this.r;
      this.x = U.clamp(this.x, m, g.arena.w - m);
      this.y = U.clamp(this.y, m, g.arena.h - m);

      // ---- vertical elevation & jump simulation ----
      if (this.jumping || this.z > 0) {
        this.vz -= (mods.lowGrav ? 320 : 660) * dt;
        this.z += this.vz * dt;

        // Check landing on a jumpable prop
        let landed = null;
        if (this.vz <= 0 && g.arena && g.arena.props) {
          for (const prop of g.arena.props) {
            if (prop.dead || !prop.jumpable) continue;
            const px = prop.x + (prop.cx || 0);
            const py = prop.y + (prop.cy || 0);
            const dx = this.x - px;
            const dy = this.y - py;
            const topElev = prop.elevation || 12;
            const surfR = (prop.cr || 10) + 7;
            if (dx * dx + dy * dy <= surfR * surfR && this.z <= topElev + 6 && this.z >= topElev - 6) {
              landed = prop;
              break;
            }
          }
        }

        if (landed) {
          this.z = landed.elevation || 12;
          this.vz = 0;
          this.jumping = false;
          this.onProp = landed;
          Audio.sfx('foliage');
          FX.burst(this.x, this.y + 6 - this.z, { n: 4, colors: ['#ffffff', '#3ccbe6'], speed: 20, life: 0.2 });
        } else if (this.z <= 0) {
          this.z = 0;
          this.vz = 0;
          if (this.jumping) {
            this.jumping = false;
            this.onProp = null;
            Audio.sfx('foliage');
            FX.burst(this.x, this.y + 6, { n: 4, colors: ['#5fb347', '#ffffff'], speed: 25, life: 0.2 });
          }
        }
      }

      // Check if player walked off current prop
      if (this.onProp && !this.jumping) {
        const prop = this.onProp;
        if (prop.dead) {
          this.onProp = null;
          this.jumping = true;
          this.vz = 0;
        } else {
          const px = prop.x + (prop.cx || 0);
          const py = prop.y + (prop.cy || 0);
          const dx = this.x - px;
          const dy = this.y - py;
          const surfR = (prop.cr || 10) + 8;
          if (dx * dx + dy * dy > surfR * surfR) {
            this.onProp = null;
            this.jumping = true;
            this.vz = 0;
          }
        }
      }

      // ---- prop collisions & interactive foliage rustle ----
      if (g.arena && g.arena.props) {
        for (const prop of g.arena.props) {
          if (prop.dead) continue;
          const px = prop.x + (prop.cx || 0);
          const py = prop.y + (prop.cy || 0);
          const dx = this.x - px;
          const dy = this.y - py;
          const d2 = dx * dx + dy * dy;

          // Solid prop collision (trees, rocks, pillars, desks, etc.)
          if (prop.solid) {
            // If standing on THIS prop, or airborne above its top surface, don't push out!
            if (this.onProp === prop || (this.z >= (prop.elevation || 10) - 1 && prop.jumpable)) {
              // standing or passing over top surface
            } else {
              const minD = (prop.cr || 10) + this.r;
              if (d2 < minD * minD && d2 > 0.0001) {
                const d = Math.sqrt(d2);
                const push = minD - d;
                this.x += (dx / d) * push;
                this.y += (dy / d) * push;
              }
            }
          }

          // Foliage sway & rustle when player brushes through or walks past
          if (prop.swayable) {
            const triggerR = prop.kind === 'tree' ? 28 : 18;
            if (d2 < triggerR * triggerR) {
              const rustleForce = (hasMove ? 1.4 : 0.4) * (dx < 0 ? -1 : 1) * 0.18;
              prop.bend = U.clamp((prop.bend || 0) + rustleForce, -0.4, 0.4);
              if (hasMove && Math.random() < dt * 7) {
                Audio.sfx('foliage');
                FX.burst(prop.x, prop.y - 4, {
                  n: 2,
                  colors: prop.kind === 'tree' ? ['#5fb347', '#4a9b3a'] : ['#63c74d', '#fee761'],
                  speed: 24,
                  life: 0.3
                });
              }
            }
          }
        }
      }

      if (hasMove || this.rolling) this.walkT += dt * (this.sprinting ? 1.5 : 1);
      if (hasMove && !this.rolling) {
        this.stepT -= dt * (this.sprinting ? 1.5 : 1);
        if (this.stepT <= 0) {
          this.stepT = 0.3;
          Audio.sfx(g.surfaceStep());
        }
      }
      if (this.sprinting && Math.random() < dt * 14) FX.dust(this.x, this.y + 9, 1);

      // ---- weapons ----
      CH.Weapons.updateStates(this, dt);
      for (let i = 1; i <= 6; i++) {
        if (inp.take('w' + i)) this.selectWeapon(B.weaponOrder[i - 1]);
      }
      if (inp.take('cycle1+')) this.cycleWeapon(1, 1);
      if (inp.take('cycle1-')) this.cycleWeapon(-1, 1);
      if (inp.take('cycle2')) this.cycleWeapon(1, 2);
      if (inp.take('cycleG')) this.cycleGadget();
      if (inp.take('swap')) this.swapWeapons();
      if (inp.take('reload')) {
        CH.Weapons.startReload(this, this.weapon);
        if (this.weapon2) CH.Weapons.startReload(this, this.weapon2);
      }
      if (inp.fire1 && !this.rolling && g.state === 'playing') CH.Weapons.tryFire(g, this, this.weapon);
      if (inp.fire2 && this.weapon2 && !this.rolling && g.state === 'playing') CH.Weapons.tryFire(g, this, this.weapon2);
      if (inp.take('special')) this.special(g);
      if (inp.take('gadget')) this.throwGadget(g);
      if (inp.take('interact')) g.interact(this);

      // Reality Is Optional
      if (this.stats.realityEvery > 0) {
        this.realityT -= dt;
        if (this.realityT <= 0) {
          this.realityT = this.stats.realityEvery;
          CH.Upgrades.realityEffect(g, this);
        }
      }
    }

    tired(g) {
      if (this.tiredMsgT > 0) return;
      this.tiredMsgT = 0.8;
      FX.text(this.x, this.y - 20, 'EXHAUSTED!', '#e43b44', 1);
      FX.burst(this.x, this.y - 8, { n: 4, colors: ['#3ccbe6', '#ffffff'], speed: 40, life: 0.5, g: 100, up: 30 });
      Audio.sfx('nope');
      this.g.ui.flashStamina(this.idx);
    }

    startJump(g) {
      if (this.stamina < 8) {
        this.tired(g);
        return;
      }
      this.stamina -= 8;
      this.regenDelay = P.staminaRegenDelay;
      this.jumping = true;
      this.vz = g && g.mods && g.mods.lowGrav ? 230 : 185;
      this.onProp = null;
      Audio.sfx('hero_dash');
      FX.burst(this.x, this.y + 6 - this.z, { n: 4, colors: ['#ffffff', '#e0f8ff'], speed: 30, life: 0.2 });
    }

    deployBarricade(g) {
      const wood = (CH.Storage.resources && CH.Storage.resources.wood) || 0;
      const scrap = (CH.Storage.resources && CH.Storage.resources.scrap) || 0;
      const shBarricades = (CH.Storage.shelter && CH.Storage.shelter.barricades) || 0;
      const costWood = 2;
      const costScrap = 1;
      if (wood < costWood || scrap < costScrap) {
        Audio.sfx('cant_afford');
        FX.text(this.x, this.y - 18, 'NEED 2 WOOD + 1 SCRAP', '#e43b44', 1);
        return;
      }
      CH.Storage.resources.wood -= costWood;
      CH.Storage.resources.scrap -= costScrap;
      CH.Storage.save();
      const a = this.aim;
      const bx = Math.round(this.x + Math.cos(a) * 26);
      const by = Math.round(this.y + Math.sin(a) * 26);
      if (g.arena && g.arena.props) {
        const hp = 100 + shBarricades * 30;
        g.arena.props.push({
          id: 'prop_barricade_' + g.arena.props.length,
          kind: 'barricade',
          sprite: CH.Sprites.has('obj.barricade1') ? 'obj.barricade1' : 'obj.roadblock',
          x: bx,
          y: by,
          hp,
          maxHp: hp,
          cr: 13,
          cx: 0,
          cy: -2,
          solid: true,
          jumpable: true,
          elevation: 10,
          destructible: true,
          resourceType: 'scrap',
          resourceAmt: 1,
          dead: false,
          shake: 0,
          bend: 0,
          rustle: 0
        });
        Audio.sfx('tree_chop');
        FX.burst(bx, by, { n: 8, colors: ['#6b4a2a', '#d1a964', '#a6b0bf'], speed: 40, life: 0.3 });
        FX.text(bx, by - 16, 'BARRICADE DEPLOYED', '#63c74d', 1);
      }
    }

    startRoll(g, mv, hasMove) {
      let dx = mv.x;
      let dy = mv.y;
      if (!hasMove) {
        dx = Math.cos(this.aim);
        dy = Math.sin(this.aim);
      }
      const l = Math.hypot(dx, dy) || 1;
      this.rollDx = dx / l;
      this.rollDy = dy / l;
      this.rolling = true;
      this.rollT = P.dodgeDuration;
      this.rollCd = P.dodgeCooldown;
      this.stamina -= P.dodgeCost;
      this.regenDelay = P.staminaRegenDelay;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.exhausted = true;
      }
      Audio.sfx('dodge');
      if (g.arena && g.arena.id === 'backyard' && Math.random() < 0.4) Audio.sfx('bush');
      FX.dust(this.x, this.y + 8, 5);
      FX.vfx('vfx.p1.12', this.x - this.rollDx * 6, this.y + 7, { scale: 0.7, fps: 24, alpha: 0.9, flip: this.rollDx < 0 });
      CH.Kit.dash(CH.Kit.heroElem(this), this.x - this.rollDx * 8, this.y - 2, Math.atan2(this.rollDy, this.rollDx) + Math.PI, 12, { alpha: 0.9 });
    }

    get canBeHurt() {
      return !this.dead && !this.rolling && this.rollGrace <= 0 && this.invuln <= 0;
    }

    /* equip a weapon in the primary slot; choosing the one in the secondary slot swaps the two */
    selectWeapon(id) {
      if (!this.weapons.includes(id) || id === this.weapon) return;
      if (id === this.weapon2) this.weapon2 = this.weapon;
      this.weapon = id;
      this.heldWeapon = id;
      this.swing = null;
      Audio.sfx('click');
      FX.text(this.x, this.y - 20, CH.Weapons.names[id], '#fee761', 1);
    }
    /* step a slot through the owned weapons, skipping the one the other slot holds when possible */
    cycleWeapon(dir, slot) {
      slot = slot || 1;
      if (this.weapons.length < 2) return;
      const key = slot === 1 ? 'weapon' : 'weapon2';
      const other = slot === 1 ? this.weapon2 : this.weapon;
      let i = this.weapons.indexOf(this[key]);
      for (let n = 0; n < this.weapons.length; n++) {
        i = (i + dir + this.weapons.length) % this.weapons.length;
        if (this.weapons[i] !== other || this.weapons.length < 3) break;
      }
      const id = this.weapons[i];
      if (id === this[key]) return;
      if (id === other) {
        // only two weapons: cycling means trading places
        this.swapWeapons();
        return;
      }
      this[key] = id;
      if (slot === 1) this.heldWeapon = id;
      this.swing = null;
      Audio.sfx('click');
      FX.text(this.x, this.y - 20, (slot === 1 ? '' : 'II: ') + CH.Weapons.names[id], slot === 1 ? '#fee761' : '#3ccbe6', 1);
    }
    swapWeapons() {
      if (!this.weapon2) return;
      const t = this.weapon;
      this.weapon = this.weapon2;
      this.weapon2 = t;
      this.heldWeapon = this.weapon;
      this.swing = null;
      Audio.sfx('click');
      FX.text(this.x, this.y - 20, CH.Weapons.names[this.weapon], '#fee761', 1);
    }
    /* a weapon was found: it becomes the primary, and the old primary moves to the empty secondary slot */
    addWeapon(id) {
      if (!this.weapons.includes(id)) {
        this.weapons.push(id);
        this.ws[id] = CH.Weapons.newState(id);
      }
      if (id === this.weapon || id === this.weapon2) return;
      if (!this.weapon2) this.weapon2 = this.weapon;
      this.weapon = id;
      this.heldWeapon = id;
    }
    cycleGadget() {
      const list = CH.Weapons.gadgets;
      this.gadget = list[(list.indexOf(this.gadget) + 1) % list.length];
      Audio.sfx('click');
      FX.text(this.x, this.y - 20, CH.Weapons.gadgetNames[this.gadget], '#b55088', 1);
    }
    throwGadget(g) {
      if (this.rolling || this.cast) return;
      if (this.nades <= 0) {
        FX.text(this.x, this.y - 20, 'NO GRENADES', '#e43b44', 1);
        Audio.sfx('nope');
        return;
      }
      this.nades--;
      if (this.nadeT <= 0) this.nadeT = P.nadeRecharge;
      CH.Weapons.throwGadget(g, this, this.gadget);
      Input.rumbleFor(this.inp, 0.2, 0.4, 90);
    }

    /* aim: the mouse points from the hero's on-screen position, the right stick gives a direction directly */
    updateAim(g, dt) {
      const inp = this.inp;
      if (inp.src.kind === 'script') {
        if (typeof inp.aimAngle === 'number') this.aim = inp.aimAngle;
        this.aimDist = inp.aimDist || 100;
        return;
      }
      if (inp.kind === 'pad') {
        if (inp.am > 0.22) {
          this.aim = Math.atan2(inp.ay, inp.ax);
          this.aimInit = true;
          this.aimDist = 70 + inp.am * 90;
        } else if (!this.aimInit && (inp.mx || inp.my)) {
          this.aim = Math.atan2(inp.my, inp.mx);
        }
        // gentle aim assist: ease toward the closest enemy near the line of fire while the stick is held
        if (CH.Storage.settings.aimAssist && inp.am > 0.22) this.aim = this.assistAim(g, this.aim, dt);
        return;
      }
      const m = Input.mouse;
      const sx = this.sx || this.x - g.cam.x;
      const sy = this.sy || this.y - g.cam.y;
      this.aim = Math.atan2(m.y - (sy - 6), m.x - sx);
      this.aimDist = Math.hypot(m.x - sx, m.y - (sy - 6));
    }
    assistAim(g, a, dt) {
      let best = null;
      let bd = 1e9;
      for (const e of g.enemies) {
        if (e.dead || e.state === 'spawn' || e.hidden) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d > 230) continue;
        const da = Math.abs(U.angDiff(a, Math.atan2(e.y - (this.y - 6), e.x - this.x)));
        const cone = Math.max(0.12, 0.34 - d / 900); // closer targets are easier to snap to
        if (da > cone) continue;
        const score = d * (1 + da * 3);
        if (score < bd) {
          bd = score;
          best = e;
        }
      }
      if (!best) return a;
      const ta = Math.atan2(best.y - (this.y - 6), best.x - this.x);
      return a + U.angDiff(a, ta) * Math.min(1, dt * 7);
    }

    /* Q: each hero channels their own skill animation, then the effect lands mid-animation */
    special(g) {
      if (this.specialCd > 0 || this.rolling || this.cast) return;
      this.specialCd = this.hero.cooldown || P.specialCooldown;
      this.cast = { t: 0, dur: 0.9, fireAt: 0.42, fired: false };
      this.invuln = Math.max(this.invuln, 1.0);
      Audio.sfx(this.hero.special === 'overdrive' ? 'startup' : 'magic');
      Input.rumbleFor(this.inp, 0.4, 0.6, 260);
      CH.Kit.cast(CH.Kit.heroElem(this), this.x, this.y - 8, 20);
      g.after(0.25, () => this.cast && CH.Kit.cast(CH.Kit.heroElem(this), this.x, this.y - 8, 26, { alpha: 0.9 }));
      FX.text(this.x, this.y - 28, this.hero.specialName + '!', '#fee761', 1);
    }

    castEffect(g) {
      const p = this;
      const dm = p.stats.dmgMult;
      Audio.sfx('special');
      switch (p.hero.special) {
        case 'thornnova':
          g.shake(9, 0.45);
          FX.ring(p.x, p.y, 6, P.specialRadius * 1.2, '#e43b44', 0.45);
          FX.vfx('vfx.p5.27', p.x, p.y, { scale: (P.specialRadius * 1.2) / 46, fps: 22, add: true });
          g.explode(p.x, p.y, P.specialRadius * 1.2, P.specialDamage * 1.25 * dm, { owner: 'p', colors: 'fire', knock: 380, clearProj: true, big: true, noPlayerHurt: true, alpha: 0.55 });
          CH.Kit.impact('toxic', p.x, p.y, P.specialRadius * 0.7, { alpha: 0.9 });
          // a ring of thorns erupting outwards
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * U.TAU;
            const R = P.specialRadius * 0.85;
            g.after(0.03 + i * 0.025, () => CH.Kit.hit('toxic', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R * 0.8, 15, true));
          }
          break;
        case 'bloodmoon': {
          const R = 135;
          g.shake(6, 0.35);
          FX.ring(p.x, p.y, 6, R, '#a22633', 0.5);
          FX.vfx('vfx.p7.12', p.x, p.y - 6, { scale: 2.6, fps: 16, add: true });
          let drained = 0;
          for (const e of g.enemies) {
            if (e.dead || e.state === 'spawn' || e.immune) continue;
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d > R + e.r) continue;
            const a = Math.atan2(e.y - p.y, e.x - p.x);
            drained += g.damageEnemy(e, 70 * dm, { kx: -Math.cos(a), ky: -Math.sin(a), kf: 160, src: 'player' });
            FX.burst(e.x, e.y, { n: 6, colors: ['#e43b44', '#a22633'], speed: 90, life: 0.5, angle: Math.atan2(p.y - e.y, p.x - e.x), spread: 0.4 });
            CH.Kit.hit('magic', e.x, e.y - 6, 15, true);
            CH.Kit.trail('magic', (e.x + p.x) / 2, (e.y + p.y) / 2 - 6, 9);
          }
          g.clearEnemyProjectiles(p.x, p.y, R);
          const heal = Math.min(p.maxHp * 0.5, drained * 0.4);
          if (heal > 0) {
            g.healPlayer(heal / p.stats.healMult / g.diff.heal, p);
            FX.vfx('vfx.p5.18', p.x, p.y - 8, { scale: 1, fps: 14, add: true });
          }
          break;
        }
        default: {
          // overdrive
          g.shake(5, 0.3);
          FX.ring(p.x, p.y, 6, 62, '#3ccbe6', 0.4);
          g.explode(p.x, p.y, 62, 30 * dm, { owner: 'p', colors: 'glitch', knock: 240, clearProj: true, noPlayerHurt: true, fx: 'tech' });
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * U.TAU + 0.6;
            g.after(0.05 + i * 0.06, () => CH.Kit.impact('bolt', p.x + Math.cos(a) * 44, p.y + Math.sin(a) * 34, 15));
          }
          p.buffs.haste = 7;
          p.buffs.shield = 7;
          p.shield = 45;
          FX.text(p.x, p.y - 34, 'HASTE + SHIELD', '#3ccbe6', 1);
        }
      }
    }
  }

  CH.Player = Player;

  /* ---------------- rendering ---------------- */
  /* draw the hero in any pose (menu / victory showcase). Returns false when hero art is unavailable. */
  Player.drawShowcase = function (ctx, heroId, x, y, scale, anim, t) {
    const name = 'hero.' + heroId;
    if (!CH.Art.on || !CH.Sprites.has(name)) return false;
    CH.Enemies.shadow(ctx, x, y, Math.round(16 * scale));
    CH.Sprites.draw(ctx, name, x, y, { frame: CH.Sprites.frame(name, anim, t), sx: scale, sy: scale });
    return true;
  };

  Player.draw = function (ctx, p, cam, g) {
    const x = p.x - cam.x;
    const y = p.y - cam.y;
    const hero = 'hero.' + p.hero.id;
    const art = CH.Art.on && CH.Sprites.has(hero);
    const S = CH.Sprites;
    const foot = art ? 13 : 8;
    CH.Enemies.shadow(ctx, x, y + foot, art ? 16 : 12);
    const down = g.coop && p.dead && !g.allDead(); // downed, not out: a teammate can bring them back
    if (g.coop && !p.dead) {
      // ground ring + arrow in the hero's colour, so two heroes of the same kind are never confused
      ctx.globalAlpha = 0.75;
      CH.FX.circleOutline(ctx, x, y + foot, 8, p.color);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1b1226';
      ctx.fillRect(Math.round(x - 3), Math.round(y - 27), 7, 2);
      ctx.fillRect(Math.round(x - 2), Math.round(y - 25), 5, 2);
      ctx.fillRect(Math.round(x - 1), Math.round(y - 23), 3, 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(x - 2), Math.round(y - 26), 5, 1);
      ctx.fillRect(Math.round(x - 1), Math.round(y - 25), 3, 1);
      ctx.fillRect(Math.round(x), Math.round(y - 24), 1, 1);
    }
    if (p.dead) {
      const fade = down ? 1 : Math.max(0, 1 - Math.max(0, p.deathT - 1.3) * 1.5);
      ctx.globalAlpha = fade;
      if (art) {
        // no death strip in the hero packs: play the hurt reaction, then topple over
        const k = U.easeOut(Math.min(1, p.deathT / 0.5));
        S.draw(ctx, hero, x, y + foot + k * 3, { frame: S.frameAt(hero, 'hurt', Math.min(0.99, p.deathT / 0.5)), flip: p.face < 0, rot: k * (Math.PI / 2) * (p.face < 0 ? -1 : 1) * 0.92 });
      } else S.draw(ctx, 'player_dead', x, y + 4, { flip: p.face < 0 });
      ctx.globalAlpha = 1;
      if (down) {
        // revive ring: fills while a teammate stands close
        const R = B.coop.reviveRadius;
        const k = Math.min(1, p.reviveT / B.coop.reviveTime);
        ctx.globalAlpha = 0.45 + 0.25 * Math.sin(g.wall * 6);
        CH.FX.circleOutline(ctx, x, y + foot - 2, R, p.reviveT > 0 ? '#63c74d' : '#e43b44');
        ctx.globalAlpha = 1;
        const n = Math.round(k * 24);
        ctx.fillStyle = '#63c74d';
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (i / 24) * U.TAU;
          ctx.fillRect(Math.round(x + Math.cos(a) * (R - 3)), Math.round(y + foot - 2 + Math.sin(a) * (R - 3)), 2, 2);
        }
        CH.Font.draw(ctx, p.name + ' DOWN', Math.round(x), Math.round(y - 12), '#e43b44', 1, true);
        CH.Font.draw(ctx, k > 0 ? Math.round(k * 100) + '%' : 'REVIVE', Math.round(x), Math.round(y - 4), k > 0 ? '#63c74d' : '#ffffff', 1, true);
      }
      return;
    }
    const dir8 = p.dir8 || 'e';
    const aimUp = dir8 === 'n' || dir8 === 'ne' || dir8 === 'nw' || Math.sin(p.aim) < -0.3;
    let bob = !art && p.moving && !p.rolling ? -Math.abs(Math.sin(p.walkT * 9)) * 1.2 : 0;
    const blink = p.invuln > 0 && !p.rolling && !p.cast && Math.floor(p.invuln * 20) % 2 === 0;
    const hpf = p.hp / p.maxHp;
    const opts = {
      flip: p.face < 0,
      flash: Math.max(0, p.flash),
      alpha: blink ? 0.45 : 1,
    };
    let name = 'player';
    if (art) {
      name = hero;
      const heroSheet = S.get(hero);
      const hasRot = heroSheet && heroSheet.anims && heroSheet.anims['rot_' + dir8];
      if (p.cast) {
        opts.frame = S.frameAt(hero, 'skill', Math.min(0.99, p.cast.t / p.cast.dur));
        opts.flip = false; // the skill animation faces the camera
      } else if (p.rolling) {
        opts.frame = S.frameAt(hero, 'dash', Math.min(0.99, 1 - p.rollT / P.dodgeDuration));
        opts.flip = p.rollDx < 0;
      } else if (p.flash > 0.45 && p.hp > 0) {
        opts.frame = S.frameAt(hero, 'hurt', (1 - p.flash) / 0.55);
        opts.flip = p.face < 0;
      } else if (p.swing) {
        opts.frame = S.frameAt(hero, 'heavy', Math.min(0.99, p.swing.t / p.swing.dur));
        opts.flip = p.face < 0;
      } else if (p.fireT > 0) {
        opts.frame = S.frameAt(hero, 'attack', Math.min(0.99, 1 - p.fireT / 0.22));
        opts.flip = p.face < 0;
      } else if (p.jumping || p.z > 2 || (g.mods.lowGrav && !p.moving)) {
        opts.frame = S.frame(hero, 'jump', g.time);
        opts.flip = p.face < 0;
      } else if (p.moving) {
        if (dir8 === 'e' || dir8 === 'w') {
          opts.frame = S.frame(hero, p.sprinting ? 'run' : 'walk', p.walkT * (p.sprinting ? 0.9 : 0.85));
          opts.flip = dir8 === 'w';
        } else if (hasRot) {
          opts.frame = S.frame(hero, 'rot_' + dir8, 0);
          opts.flip = false;
          bob = -Math.abs(Math.sin(p.walkT * 10)) * 2.2;
          opts.rot = Math.sin(p.walkT * 10) * 0.06;
        } else {
          opts.frame = S.frame(hero, p.sprinting ? 'run' : 'walk', p.walkT * (p.sprinting ? 0.9 : 0.85));
          opts.flip = p.face < 0;
        }
      } else {
        if (hasRot) {
          opts.frame = S.frame(hero, 'rot_' + dir8, 0);
          opts.flip = false;
          bob = Math.sin(g.wall * 3.5) * 0.6;
        } else {
          opts.frame = S.frame(hero, 'idle', g.time);
          opts.flip = p.face < 0;
        }
      }
      if (g.mods.bigHead) {
        opts.sx = 1.3;
        opts.sy = 1.3;
      }
    } else {
      opts.frame = p.moving || p.rolling ? 1 + (Math.floor(p.walkT * 9) % 2) : 0;
      opts.bigHead = g.mods.bigHead ? 1.6 : 0;
      if (p.rolling) {
        opts.rot = (1 - p.rollT / P.dodgeDuration) * U.TAU * (p.rollDx >= 0 ? 1 : -1);
        opts.sy = 0.85;
        opts.flip = false;
      }
    }
    if (p.buffs.rage > 0) {
      opts.tint = '#e43b44';
      opts.tintA = 0.25;
    } else if (hpf < 0.25) {
      opts.tint = '#e43b44';
      opts.tintA = 0.18 + 0.15 * Math.sin(g.time * 8);
    }
    const pz = p.z || 0;
    if (p.rolling && !art) {
      S.draw(ctx, name, x, y + 4 - pz, opts);
    } else {
      if (aimUp) CH.Weapons.drawHeld(ctx, p, { x: cam.x, y: cam.y + pz });
      S.draw(ctx, name, x, y + foot + bob - pz, opts);
      if (!aimUp) CH.Weapons.drawHeld(ctx, p, { x: cam.x, y: cam.y + pz });
    }
    CH.Weapons.drawSwing(ctx, p, cam);
    // shield bubble
    if (p.buffs.shield > 0 && p.shield > 0) {
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(g.time * 10);
      CH.FX.circleOutline(ctx, x, y - 2, 15, '#3ccbe6');
      ctx.globalAlpha = 0.12;
      CH.FX.circleFill(ctx, x, y - 2, 15, '#3ccbe6');
      ctx.globalAlpha = 1;
    }
    // dodge cooldown pip under the feet
    if (p.rollCd > 0) {
      const w = 12;
      const k = 1 - p.rollCd / P.dodgeCooldown;
      ctx.fillStyle = 'rgba(27,18,38,0.7)';
      ctx.fillRect(Math.round(x - w / 2), Math.round(y + foot + 3), w, 2);
      ctx.fillStyle = '#3ccbe6';
      ctx.fillRect(Math.round(x - w / 2), Math.round(y + foot + 3), Math.round(w * k), 2);
    }
    if (p.distractT > 0 && Math.floor(g.time * 14) % 2 === 0) {
      FX.burst(p.x + U.rand(-8, 8), p.y - 18, { n: 1, colors: ['#ffffff', '#ff8fb8', '#fee761'], speed: 30, life: 0.3, size: 2 });
    }
  };

  Player.getDir8 = getDir8;
  CH.Player = Player;
})(window.CH);
