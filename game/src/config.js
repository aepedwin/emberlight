// Emberlight — tuning constants. One place for every number the game balances on,
// so a wave, an enemy or a pickup can be retuned without touching the logic.
export const VIEW = { width: 1280, height: 720 };

export const ARENA = {
  // Playable bounds inside the canvas (the HUD sits above this band).
  x: 24,
  y: 76,
  width: VIEW.width - 48,
  height: VIEW.height - 100,
};

export const PLAYER = {
  radius: 16,
  speed: 265,
  maxHealth: 5,
  flareCooldown: 0.27,
  flareSpeed: 640,
  flareLife: 0.85,
  flareRadius: 6,
  flareDamage: 1,
  invulnAfterHit: 1.1,
  spreadSeconds: 10,
  shieldSeconds: 5,
};

export const ENEMY = {
  drifter: { radius: 15, hp: 1, speed: 96, damage: 1, score: 50, embers: 2, color: '#5b4a8a', eye: '#c9b8ff' },
  spitter: { radius: 14, hp: 2, speed: 58, damage: 1, score: 100, embers: 3, color: '#3f6d5a', eye: '#8dffc9' },
  brute: { radius: 30, hp: 8, speed: 44, damage: 2, score: 250, embers: 6, color: '#7a3b4d', eye: '#ffb3c1' },
};

export const BOLT = { radius: 7, speed: 210, damage: 1, life: 4 };

export const PICKUP = {
  ember: { radius: 8, score: 10, life: 9 },
  heart: { radius: 12, life: 10 },
  spread: { radius: 13, life: 10 },
  shield: { radius: 13, life: 10 },
};

export const WAVE = {
  // How long the banner hangs before the next wave's enemies start arriving.
  bannerSeconds: 2.4,
  spawnInterval: 0.55,
  betweenSeconds: 1.6,
};

/** Enemy mix for a wave number (1-based). Counts grow; new kinds join later. */
export function waveComposition(wave) {
  return {
    drifter: 4 + wave * 2,
    spitter: wave >= 2 ? Math.floor(1 + wave / 2) : 0,
    brute: wave >= 3 ? wave - 2 : 0,
  };
}

/** Score bonus for clearing a wave without taking a hit. */
export function waveClearBonus(wave) {
  return 100 * wave;
}
