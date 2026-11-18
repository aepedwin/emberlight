// Screenshot scenes behind ?shot=title|play|wave|over. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (kite away from the nearest shadow, fire at it, chase the
// nearest ember when safe), so the frame is what a real game looks like and
// the same seed always gives the same frame.
import { STEP, createWorld, startGame, stepWorld } from './world.js';
import { ARENA } from './config.js';
import { distance } from './rng.js';

const SAMPLE = STEP;

/** A fake input the autopilot drives, shaped like the real input object. */
function autopilotInput(world, skill) {
  const p = world.player;
  let nearestEnemy = null;
  let nearestDist = Infinity;
  for (const e of world.enemies) {
    const d = distance(e.x, e.y, p.x, p.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearestEnemy = e;
    }
  }
  let nearestEmber = null;
  let emberDist = Infinity;
  for (const pk of world.pickups) {
    if (pk.kind !== 'ember') continue;
    const d = distance(pk.x, pk.y, p.x, p.y);
    if (d < emberDist) {
      emberDist = d;
      nearestEmber = pk;
    }
  }
  // Flee direction: away from the nearest enemy, plus a sideways kite.
  let mx = 0;
  let my = 0;
  if (nearestEnemy) {
    const away = Math.atan2(p.y - nearestEnemy.y, p.x - nearestEnemy.x);
    const kite = away + Math.PI / 2;
    mx = Math.cos(away) * 0.8 + Math.cos(kite) * 0.6;
    my = Math.sin(away) * 0.8 + Math.sin(kite) * 0.6;
    // Chase an ember when it is close and no shadow is on top of us.
    if (nearestEmber && emberDist < 200 && nearestDist > 130) {
      mx += ((nearestEmber.x - p.x) / emberDist) * 0.9;
      my += ((nearestEmber.y - p.y) / emberDist) * 0.9;
    }
  }
  const len = Math.hypot(mx, my) || 1;
  mx /= len;
  my /= len;
  // Stay in the middle of the arena: the frame reads best with the keeper
  // central and the shadows closing in from all sides.
  if (p.x < ARENA.x + 170) mx += 1.1;
  if (p.x > ARENA.x + ARENA.width - 170) mx -= 1.1;
  if (p.y < ARENA.y + 150) my += 1.1;
  if (p.y > ARENA.y + ARENA.height - 150) my -= 1.1;
  // Aim at the nearest enemy (the autopilot's skill sets how often it fires).
  const aimX = nearestEnemy ? nearestEnemy.x : p.x;
  const aimY = nearestEnemy ? nearestEnemy.y : p.y - 100;
  return {
    move: () => ({ x: mx, y: my }),
    mouse: { x: aimX, y: aimY, down: false, clicked: false },
    firing: () => nearestEnemy !== null && nearestDist < 480 && skill > Math.random() * 0.3,
    consume: () => false,
    endFrame: () => {},
  };
}

/**
 * Stage `name` in `world` and return the screen to draw. Unknown names are the title.
 * The world is quiet (no audio) and seeded, so the frame is reproducible.
 */
export function stageShot(name, world) {
  const input = autopilotInput(world, 1);
  if (name === 'play') {
    startGame(world);
    // Play ~26 seconds of wave 1-2 with a good pilot: busy arena, HUD alive.
    for (let t = 0; t < 26; t += SAMPLE) {
      if (world.screen === 'over') break;
      stepWorld(world, SAMPLE, autopilotInput(world, 1));
    }
    // If the clock stopped mid-banner, let the banner finish so the frame is play.
    for (let t = 0; t < 4 && world.screen === 'banner'; t += SAMPLE) {
      stepWorld(world, SAMPLE, autopilotInput(world, 1));
    }
    // And if the new wave has not spawned anyone in yet, wait for the field
    // to fill — an empty arena is not a gameplay shot.
    for (let t = 0; t < 5 && world.enemies.length < 3; t += SAMPLE) {
      if (world.screen === 'over') break;
      stepWorld(world, SAMPLE, autopilotInput(world, 1));
    }
    return world.screen === 'over' ? 'over' : 'play';
  }
  if (name === 'wave') {
    startGame(world);
    // Play until wave 3 is in full swing — brutes on the field, bolts in the
    // air, embers scattered — the most intense moment the game offers.
    for (let t = 0; t < 400; t += SAMPLE) {
      if (world.screen === 'over') break;
      const brutes = world.enemies.filter((e) => e.kind === 'brute').length;
      if (world.wave >= 3 && world.screen === 'play' && world.enemies.length >= 8 && brutes >= 1) break;
      stepWorld(world, SAMPLE, autopilotInput(world, 1));
    }
    return world.screen === 'over' ? 'over' : 'play';
  }
  if (name === 'over') {
    startGame(world);
    // A careless pilot that stands still and never fires: the dark wins fast,
    // and the game-over panel shows real stats.
    const still = {
      move: () => ({ x: 0, y: 0 }),
      mouse: { x: world.player.x, y: world.player.y - 100, down: false, clicked: false },
      firing: () => false,
      consume: () => false,
      endFrame: () => {},
    };
    for (let t = 0; t < 300; t += SAMPLE) {
      if (world.screen === 'over') break;
      stepWorld(world, SAMPLE, still);
    }
    // If the keeper somehow survived, force the ending — the shot must show it.
    if (world.screen !== 'over') {
      world.player.health = 0;
      world.screen = 'over';
      world.overStats = {
        score: world.score,
        wave: world.wave,
        kills: world.kills,
        embers: world.embers,
        best: Math.max(world.best, world.score),
        isBest: world.score > 0,
      };
    }
    return 'over';
  }
  // Title: let the attract mode run a few seconds so the arena behind the
  // title is alive with shadows and embers.
  for (let t = 0; t < 7; t += SAMPLE) stepWorld(world, SAMPLE, null);
  return 'title';
}

export { createWorld };
