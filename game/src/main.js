// Emberlight — boot, the frame loop and the screen state machine.
// ?shot=title|play|wave|over&seed=N renders one staged frame for screenshots
// (no loop, no audio); without it, the game runs live.
import { VIEW } from './config.js';
import { createInput } from './input.js';
import { render } from './render.js';
import { stageShot } from './shots.js';
import { unlockAudio, sfx, toggleMute } from './audio.js';
import {
  SCREEN_BANNER,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  STEP,
  createWorld,
  startGame,
  stepWorld,
} from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '7') || 7;

let best = 0;
try {
  best = Number(localStorage.getItem('emberlight.best') || '0') || 0;
} catch {
  best = 0;
}

const world = createWorld(seed, { quiet: shotName !== null });
world.best = best;

const actions = {
  start() {
    unlockAudio();
    sfx.click();
    startGame(world);
    announce('Wave 1. Keep the lantern lit.');
  },
  again() {
    unlockAudio();
    sfx.click();
    startGame(world);
    announce('Wave 1. Keep the lantern lit.');
  },
  resume() {
    unlockAudio();
    sfx.click();
    world.screen = SCREEN_PLAY;
    announce('Resumed.');
  },
};

function announce(text) {
  if (status) status.textContent = text;
}

if (shotName !== null) {
  // Screenshot mode: stage the scene, draw one frame, stop. Deterministic.
  const screen = stageShot(shotName, world);
  world.screen = screen;
  render(ctx, world, null, actions);
  announce(`Emberlight screenshot: ${shotName}.`);
} else {
  const input = createInput(canvas);
  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;

    // Global keys.
    if (input.consume('KeyM')) {
      const muted = toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (input.consume('KeyP') || input.consume('Escape')) {
      if (world.screen === SCREEN_PLAY || world.screen === SCREEN_BANNER) {
        world.screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (world.screen === SCREEN_PAUSED) {
        world.screen = SCREEN_PLAY;
        announce('Resumed.');
      }
    }
    if (input.consume('KeyR') && (world.screen === SCREEN_OVER || world.screen === SCREEN_PLAY || world.screen === SCREEN_PAUSED)) {
      startGame(world);
      announce('Wave 1. Keep the lantern lit.');
    }
    if (input.consume('Enter')) {
      if (world.screen === SCREEN_TITLE) actions.start();
      else if (world.screen === SCREEN_OVER) actions.again();
    }

    // Buttons on the title / game-over / pause screens.
    input.clickButtons();

    // Fixed-step updates keep the game identical at any frame rate.
    if (world.screen === SCREEN_PLAY || world.screen === SCREEN_BANNER || world.screen === SCREEN_TITLE) {
      accumulator += elapsed;
      let guard = 0;
      while (accumulator >= STEP && guard < 5) {
        stepWorld(world, STEP, world.screen === SCREEN_TITLE ? null : input);
        accumulator -= STEP;
        guard += 1;
      }
      if (guard === 5) accumulator = 0;
    }

    render(ctx, world, input, actions);
    input.endFrame();
  }

  canvas.addEventListener('mousedown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
  announce('Emberlight. Click to light the lantern.');
  requestAnimationFrame(frame);
}
