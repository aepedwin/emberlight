// Emberlight's world: the whole game state and one fixed-step update.
// Screens: 'title' (attract mode — the arena plays behind the title),
// 'play', 'banner' (between waves), 'over', 'paused'.
import {
  ARENA,
  BOLT,
  PICKUP,
  PLAYER,
  VIEW,
  WAVE,
  waveClearBonus,
  waveComposition,
} from './config.js';
import { clamp, distance, mulberry32, range } from './rng.js';
import {
  KIND_BRUTE,
  KIND_DRIFTER,
  KIND_SPITTER,
  buildWaveQueue,
  makeBolt,
  makeEnemy,
  pickDropKind,
  spawnPoint,
  stepEnemy,
} from './enemies.js';
import { createParticles } from './particles.js';
import { sfx } from './audio.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_BANNER = 'banner';
export const SCREEN_OVER = 'over';
export const SCREEN_PAUSED = 'paused';

export const STEP = 1 / 60;

export function createWorld(seed, options = {}) {
  const random = mulberry32(seed);
  const quiet = options.quiet === true; // screenshot mode: no sound
  const world = {
    seed,
    random,
    quiet,
    screen: SCREEN_TITLE,
    time: 0,
    wave: 0,
    score: 0,
    embers: 0,
    kills: 0,
    best: 0,
    waveHitsTaken: 0,
    shake: 0,
    flash: 0,
    bannerTimer: 0,
    bannerText: '',
    bannerSub: '',
    spawnQueue: [],
    spawnTimer: 0,
    betweenTimer: 0,
    player: null,
    enemies: [],
    flares: [],
    bolts: [],
    pickups: [],
    particles: createParticles(random),
    attract: false, // title-screen autopilot
    overStats: null,
    ambientTimer: 0,
  };
  resetPlayer(world);
  return world;
}

function resetPlayer(world) {
  world.player = {
    x: VIEW.width / 2,
    y: VIEW.height / 2 + 60,
    radius: PLAYER.radius,
    health: PLAYER.maxHealth,
    maxHealth: PLAYER.maxHealth,
    aim: -Math.PI / 2,
    cooldown: 0,
    invuln: 0,
    spreadTimer: 0,
    shieldTimer: 0,
    moving: false,
    dead: false,
  };
}

export function startGame(world) {
  world.screen = SCREEN_BANNER;
  world.time = 0;
  world.wave = 0;
  world.score = 0;
  world.embers = 0;
  world.kills = 0;
  world.waveHitsTaken = 0;
  world.enemies = [];
  world.flares = [];
  world.bolts = [];
  world.pickups = [];
  world.particles.clear();
  world.overStats = null;
  resetPlayer(world);
  nextWave(world);
}

function nextWave(world) {
  world.wave += 1;
  world.waveHitsTaken = 0;
  const composition = waveComposition(world.wave);
  world.spawnQueue = buildWaveQueue(world.wave, composition, world.random);
  world.spawnTimer = 0.4;
  world.bannerText = `WAVE ${world.wave}`;
  const total = world.spawnQueue.length;
  world.bannerSub =
    total + (total === 1 ? ' shadow' : ' shadows') +
    (world.wave >= 2 ? ' — spitters keep their distance' : '') +
    (world.wave >= 3 ? ' — brutes incoming' : '');
  world.bannerTimer = WAVE.bannerSeconds;
  world.screen = SCREEN_BANNER;
  if (!world.quiet) sfx.wave();
}

export function gameOver(world) {
  world.screen = SCREEN_OVER;
  world.player.dead = true;
  const best = Math.max(world.best, world.score);
  const isBest = world.score > world.best && world.score > 0;
  world.best = best;
  world.overStats = {
    score: world.score,
    wave: world.wave,
    kills: world.kills,
    embers: world.embers,
    best,
    isBest,
  };
  try {
    localStorage.setItem('emberlight.best', String(best));
  } catch {
    // Storage may be unavailable (private mode); the best score just won't persist.
  }
  if (!world.quiet) sfx.over();
  world.particles.burst(world.player.x, world.player.y, 60, '#ffb347', 260, 1.1, 4);
  world.shake = 14;
}

function hurtPlayer(world, damage) {
  const p = world.player;
  if (p.invuln > 0 || p.shieldTimer > 0 || p.dead) return;
  p.health -= damage;
  p.invuln = PLAYER.invulnAfterHit;
  world.waveHitsTaken += 1;
  world.shake = Math.max(world.shake, 9);
  world.flash = 0.5;
  if (!world.quiet) sfx.hurt();
  world.particles.burst(p.x, p.y, 18, '#ff5d5d', 200, 0.6, 3);
  if (p.health <= 0) {
    p.health = 0;
    gameOver(world);
  }
}

function fireFlare(world) {
  const p = world.player;
  if (p.cooldown > 0 || p.dead) return;
  p.cooldown = PLAYER.flareCooldown;
  const angles = p.spreadTimer > 0 ? [-0.22, 0, 0.22] : [0];
  for (const offset of angles) {
    const a = p.aim + offset;
    world.flares.push({
      x: p.x + Math.cos(a) * (p.radius + 8),
      y: p.y + Math.sin(a) * (p.radius + 8),
      vx: Math.cos(a) * PLAYER.flareSpeed,
      vy: Math.sin(a) * PLAYER.flareSpeed,
      radius: PLAYER.flareRadius,
      damage: PLAYER.flareDamage,
      life: PLAYER.flareLife,
    });
  }
  if (!world.quiet) sfx.shoot();
}

function dropPickup(world, x, y, kind) {
  const def = PICKUP[kind];
  world.pickups.push({
    kind,
    x: clamp(x, ARENA.x + 16, ARENA.x + ARENA.width - 16),
    y: clamp(y, ARENA.y + 16, ARENA.y + ARENA.height - 16),
    radius: def.radius,
    life: def.life,
    bob: world.random() * Math.PI * 2,
  });
}

function killEnemy(world, enemy) {
  enemy.dead = true;
  world.kills += 1;
  world.score += enemy.score;
  world.particles.burst(enemy.x, enemy.y, enemy.kind === KIND_BRUTE ? 42 : 22, enemy.eye, 220, 0.7, 3.5);
  world.particles.burst(enemy.x, enemy.y, 10, '#ffb347', 140, 0.5, 2.5);
  world.particles.floatText(enemy.x, enemy.y - enemy.radius, `+${enemy.score}`, '#ffd98a');
  world.shake = Math.max(world.shake, enemy.kind === KIND_BRUTE ? 7 : 3);
  if (!world.quiet) sfx.kill();
  // Embers scatter as pickups; a rarer roll drops a heart, spread or shield.
  for (let i = 0; i < enemy.embers; i += 1) {
    dropPickup(world, enemy.x + range(world.random, -26, 26), enemy.y + range(world.random, -26, 26), 'ember');
  }
  const bonus = pickDropKind(world.random);
  if (bonus !== 'ember') dropPickup(world, enemy.x, enemy.y, bonus);
}

function collectPickup(world, pickup) {
  const p = world.player;
  if (pickup.kind === 'ember') {
    world.embers += 1;
    world.score += PICKUP.ember.score;
    if (!world.quiet) sfx.ember();
  } else if (pickup.kind === 'heart') {
    p.health = Math.min(p.maxHealth, p.health + 1);
    world.particles.floatText(p.x, p.y - 28, '+1 ♥', '#ff8fa3');
    if (!world.quiet) sfx.heart();
  } else if (pickup.kind === 'spread') {
    p.spreadTimer = PLAYER.spreadSeconds;
    world.particles.floatText(p.x, p.y - 28, 'TRIPLE FLARE!', '#8fd0ff');
    if (!world.quiet) sfx.power();
  } else if (pickup.kind === 'shield') {
    p.shieldTimer = PLAYER.shieldSeconds;
    world.particles.floatText(p.x, p.y - 28, 'SHIELD!', '#a5f2c1');
    if (!world.quiet) sfx.power();
  }
  world.particles.embers(pickup.x, pickup.y, 4);
}

/** One fixed step of the live game. `input` is the input state (or null in attract mode). */
export function stepWorld(world, dt, input) {
  world.time += dt;
  world.shake = Math.max(0, world.shake - dt * 26);
  world.flash = Math.max(0, world.flash - dt * 1.6);
  world.particles.step(dt);

  // Ambient ember motes drift up through the arena, always.
  world.ambientTimer -= dt;
  if (world.ambientTimer <= 0) {
    world.ambientTimer = 0.35;
    world.particles.embers(
      range(world.random, ARENA.x, ARENA.x + ARENA.width),
      range(world.random, ARENA.y + ARENA.height * 0.5, ARENA.y + ARENA.height),
      1,
    );
  }

  if (world.screen === SCREEN_TITLE) {
    stepAttract(world, dt);
    return;
  }
  if (world.screen === SCREEN_PAUSED || world.screen === SCREEN_OVER) return;

  if (world.screen === SCREEN_BANNER) {
    world.bannerTimer -= dt;
    stepEnemies(world, dt, true);
    if (world.bannerTimer <= 0) world.screen = SCREEN_PLAY;
    return;
  }

  // --- SCREEN_PLAY ---
  const p = world.player;
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.spreadTimer = Math.max(0, p.spreadTimer - dt);
  p.shieldTimer = Math.max(0, p.shieldTimer - dt);

  if (input) {
    const move = input.move();
    p.moving = move.x !== 0 || move.y !== 0;
    p.x = clamp(p.x + move.x * PLAYER.speed * dt, ARENA.x + p.radius, ARENA.x + ARENA.width - p.radius);
    p.y = clamp(p.y + move.y * PLAYER.speed * dt, ARENA.y + p.radius, ARENA.y + ARENA.height - p.radius);
    p.aim = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
    if (input.firing()) fireFlare(world);
  }

  stepSpawning(world, dt);
  stepEnemies(world, dt, false);
  stepFlares(world, dt);
  stepBolts(world, dt);
  stepPickups(world, dt);

  // Wave cleared: every spawn arrived and every enemy is gone.
  if (world.spawnQueue.length === 0 && world.enemies.length === 0) {
    const bonus = waveClearBonus(world.wave) + (world.waveHitsTaken === 0 ? 50 : 0);
    world.score += bonus;
    world.particles.floatText(p.x, p.y - 40, `WAVE CLEAR +${bonus}`, '#ffe9a8');
    world.betweenTimer = WAVE.betweenSeconds;
    nextWave(world);
  }
}

function stepSpawning(world, dt) {
  if (world.spawnQueue.length === 0) return;
  world.spawnTimer -= dt;
  if (world.spawnTimer > 0) return;
  world.spawnTimer = WAVE.spawnInterval;
  const kind = world.spawnQueue.shift();
  const point = spawnPoint(world.random);
  world.enemies.push(makeEnemy(kind, point.x, point.y, world.random));
  world.particles.burst(point.x, point.y, 8, '#8a7bd8', 90, 0.4, 2.5);
}

function stepEnemies(world, dt, passive) {
  const p = world.player;
  const lightRadius = 190;
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = world.enemies[i];
    const fired = stepEnemy(enemy, dt, p, world.random, passive ? 0 : lightRadius);
    if (fired === 'bolt' && !passive) {
      world.bolts.push(makeBolt(enemy, p));
      if (!world.quiet) sfx.hit();
    }
    if (enemy.dead) {
      killEnemy(world, enemy);
      world.enemies.splice(i, 1);
      continue;
    }
    // Touching the keeper hurts — unless the shield is up.
    if (!passive && !p.dead && distance(enemy.x, enemy.y, p.x, p.y) < enemy.radius + p.radius - 2) {
      hurtPlayer(world, enemy.damage);
      // Push the enemy back a touch so one touch is not a chain of hits.
      const a = Math.atan2(enemy.y - p.y, enemy.x - p.x);
      enemy.x += Math.cos(a) * 18;
      enemy.y += Math.sin(a) * 18;
    }
  }
}

function stepFlares(world, dt) {
  for (let i = world.flares.length - 1; i >= 0; i -= 1) {
    const f = world.flares[i];
    f.life -= dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    world.particles.trail(f.x, f.y, '#ffb347');
    let spent = f.life <= 0 || f.x < ARENA.x - 20 || f.x > ARENA.x + ARENA.width + 20 || f.y < ARENA.y - 20 || f.y > ARENA.y + ARENA.height + 20;
    if (!spent) {
      for (const enemy of world.enemies) {
        if (enemy.dead) continue;
        if (distance(f.x, f.y, enemy.x, enemy.y) < f.radius + enemy.radius) {
          enemy.hp -= f.damage;
          enemy.flash = 1;
          spent = true;
          world.particles.burst(f.x, f.y, 6, '#ffd98a', 120, 0.3, 2.5);
          if (!world.quiet) sfx.hit();
          if (enemy.hp <= 0) {
            killEnemy(world, enemy);
            world.enemies.splice(world.enemies.indexOf(enemy), 1);
          }
          break;
        }
      }
    }
    if (spent) world.flares.splice(i, 1);
  }
}

function stepBolts(world, dt) {
  const p = world.player;
  for (let i = world.bolts.length - 1; i >= 0; i -= 1) {
    const b = world.bolts[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let spent = b.life <= 0 || b.x < ARENA.x - 16 || b.x > ARENA.x + ARENA.width + 16 || b.y < ARENA.y - 16 || b.y > ARENA.y + ARENA.height + 16;
    if (!spent && !p.dead && distance(b.x, b.y, p.x, p.y) < b.radius + p.radius - 2) {
      hurtPlayer(world, b.damage);
      spent = true;
    }
    if (spent) world.bolts.splice(i, 1);
  }
}

function stepPickups(world, dt) {
  const p = world.player;
  for (let i = world.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = world.pickups[i];
    pickup.life -= dt;
    pickup.bob += dt * 4;
    if (pickup.life <= 0) {
      world.pickups.splice(i, 1);
      continue;
    }
    // Embers drift toward the keeper when close — collecting feels magnetic.
    const d = distance(pickup.x, pickup.y, p.x, p.y);
    if (!p.dead && d < 130 && pickup.kind === 'ember') {
      const a = Math.atan2(p.y - pickup.y, p.x - pickup.x);
      const pull = (1 - d / 130) * 320;
      pickup.x += Math.cos(a) * pull * dt;
      pickup.y += Math.sin(a) * pull * dt;
    }
    if (!p.dead && d < p.radius + pickup.radius + 4) {
      collectPickup(world, pickup);
      world.pickups.splice(i, 1);
    }
  }
}

// --- Attract mode: the arena plays itself behind the title screen. ---
function stepAttract(world, dt) {
  const p = world.player;
  // A ghost keeper wanders and fires at the nearest shadow, so the title
  // screen is alive instead of a static picture.
  if (world.enemies.length < 6 && world.random() < dt * 1.4) {
    const point = spawnPoint(world.random);
    const kinds = [KIND_DRIFTER, KIND_DRIFTER, KIND_SPITTER, KIND_BRUTE];
    world.enemies.push(makeEnemy(kinds[Math.floor(world.random() * kinds.length)], point.x, point.y, world.random));
  }
  let nearest = null;
  let nearestDist = Infinity;
  for (const e of world.enemies) {
    const d = distance(e.x, e.y, p.x, p.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = e;
    }
  }
  if (nearest) {
    const a = Math.atan2(nearest.y - p.y, nearest.x - p.x);
    p.aim = a;
    // Kite: drift sideways, keep some distance.
    const kite = a + Math.PI / 2;
    p.x = clamp(p.x + Math.cos(kite) * 60 * dt, ARENA.x + p.radius, ARENA.x + ARENA.width - p.radius);
    p.y = clamp(p.y + Math.sin(kite) * 60 * dt, ARENA.y + p.radius, ARENA.y + ARENA.height - p.radius);
    p.cooldown -= dt;
    if (p.cooldown <= 0) {
      p.cooldown = 0.5;
      world.flares.push({
        x: p.x + Math.cos(a) * (p.radius + 8),
        y: p.y + Math.sin(a) * (p.radius + 8),
        vx: Math.cos(a) * PLAYER.flareSpeed,
        vy: Math.sin(a) * PLAYER.flareSpeed,
        radius: PLAYER.flareRadius,
        damage: PLAYER.flareDamage,
        life: PLAYER.flareLife,
      });
    }
  }
  stepEnemies(world, dt, false);
  stepFlares(world, dt);
  stepPickups(world, dt);
  // The keeper never dies in attract mode; the scene just keeps burning shadows.
  if (p.health < p.maxHealth) p.health = p.maxHealth;
  if (world.enemies.length === 0 && world.pickups.length === 0) {
    world.particles.embers(p.x, p.y - 20, 2);
  }
}
