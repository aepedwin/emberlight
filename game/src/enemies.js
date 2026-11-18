// Enemy kinds, spawning and their per-frame behaviour. The world owns the list;
// this module knows how each kind moves, attacks and dies.
import { ARENA, BOLT, ENEMY } from './config.js';
import { angleTo, clamp, distance, pick, range } from './rng.js';

export const KIND_DRIFTER = 'drifter';
export const KIND_SPITTER = 'spitter';
export const KIND_BRUTE = 'brute';

const KINDS = [KIND_DRIFTER, KIND_SPITTER, KIND_BRUTE];

/** Spawn point on a random arena edge, just outside the player's sight line. */
export function spawnPoint(random) {
  const edge = Math.floor(random() * 4);
  const m = 30;
  if (edge === 0) return { x: range(random, ARENA.x, ARENA.x + ARENA.width), y: ARENA.y - m };
  if (edge === 1) return { x: range(random, ARENA.x, ARENA.x + ARENA.width), y: ARENA.y + ARENA.height + m };
  if (edge === 2) return { x: ARENA.x - m, y: range(random, ARENA.y, ARENA.y + ARENA.height) };
  return { x: ARENA.x + ARENA.width + m, y: range(random, ARENA.y, ARENA.y + ARENA.height) };
}

export function makeEnemy(kind, x, y, random) {
  const def = ENEMY[kind];
  const jitter = 0.85 + random() * 0.3;
  return {
    kind,
    x,
    y,
    radius: def.radius,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed * jitter,
    damage: def.damage,
    score: def.score,
    embers: def.embers,
    color: def.color,
    eye: def.eye,
    angle: random() * Math.PI * 2,
    wobble: random() * Math.PI * 2,
    shootTimer: range(random, 1.2, 2.6),
    flash: 0,
    dead: false,
  };
}

/** Build the spawn queue for a wave: shuffled kinds, so the wave arrives mixed. */
export function buildWaveQueue(wave, composition, random) {
  const queue = [];
  for (const kind of KINDS) {
    for (let i = 0; i < (composition[kind] || 0); i += 1) queue.push(kind);
  }
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

/**
 * Step one enemy. Returns 'bolt' when a spitter fires (the world spawns the bolt),
 * otherwise null. `light` is the lantern radius: creatures inside strong light burn.
 */
export function stepEnemy(enemy, dt, player, random, lightRadius) {
  enemy.flash = Math.max(0, enemy.flash - dt * 6);
  enemy.wobble += dt * 3;
  const dist = distance(enemy.x, enemy.y, player.x, player.y);
  const angle = angleTo(enemy.x, enemy.y, player.x, player.y);
  enemy.angle = angle;

  // Strong lantern light burns shadow creatures that get too close to the keeper.
  const burn = dist < lightRadius * 0.55 ? 0.6 * dt : 0;
  if (burn > 0) enemy.hp -= burn;

  if (enemy.kind === KIND_DRIFTER) {
    const wob = Math.sin(enemy.wobble) * 0.5;
    enemy.x += (Math.cos(angle + wob) * enemy.speed) * dt;
    enemy.y += (Math.sin(angle + wob) * enemy.speed) * dt;
  } else if (enemy.kind === KIND_SPITTER) {
    // Holds a firing distance, strafes, and shoots shadow bolts.
    const want = 260;
    const toward = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
    const strafe = Math.sin(enemy.wobble * 0.6) * 0.7;
    enemy.x += (Math.cos(angle) * toward + Math.cos(angle + Math.PI / 2) * strafe) * enemy.speed * dt;
    enemy.y += (Math.sin(angle) * toward + Math.sin(angle + Math.PI / 2) * strafe) * enemy.speed * dt;
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && dist < 520) {
      enemy.shootTimer = range(random, 1.9, 2.6);
      return 'bolt';
    }
  } else {
    // Brute: slow, relentless, shrugs off knockback.
    enemy.x += Math.cos(angle) * enemy.speed * dt;
    enemy.y += Math.sin(angle) * enemy.speed * dt;
  }

  enemy.x = clamp(enemy.x, ARENA.x - 40, ARENA.x + ARENA.width + 40);
  enemy.y = clamp(enemy.y, ARENA.y - 40, ARENA.y + ARENA.height + 40);
  if (enemy.hp <= 0) enemy.dead = true;
  return null;
}

/** A shadow bolt fired by a spitter, aimed at the player. */
export function makeBolt(enemy, player) {
  const angle = angleTo(enemy.x, enemy.y, player.x, player.y);
  return {
    x: enemy.x + Math.cos(angle) * (enemy.radius + 6),
    y: enemy.y + Math.sin(angle) * (enemy.radius + 6),
    vx: Math.cos(angle) * BOLT.speed,
    vy: Math.sin(angle) * BOLT.speed,
    radius: BOLT.radius,
    damage: BOLT.damage,
    life: BOLT.life,
  };
}

export function pickDropKind(random) {
  // Most kills drop embers; a few drop a heart, a spread or a shield.
  const roll = random();
  if (roll < 0.72) return 'ember';
  if (roll < 0.82) return 'heart';
  if (roll < 0.92) return 'spread';
  return 'shield';
}
