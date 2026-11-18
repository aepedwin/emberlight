// Particles and floating score text: the game's juice. Everything here is pure
// data + a step function; render.js draws it.
export function createParticles(random) {
  return {
    list: [],
    floats: [],
    burst(x, y, count, color, speed = 160, life = 0.6, size = 3) {
      for (let i = 0; i < count; i += 1) {
        const angle = random() * Math.PI * 2;
        const v = speed * (0.3 + random() * 0.7);
        this.list.push({
          x,
          y,
          vx: Math.cos(angle) * v,
          vy: Math.sin(angle) * v,
          life: life * (0.5 + random() * 0.5),
          maxLife: life,
          size: size * (0.6 + random() * 0.8),
          color,
          drag: 0.92,
          glow: true,
        });
      }
    },
    embers(x, y, count = 1) {
      for (let i = 0; i < count; i += 1) {
        this.list.push({
          x: x + (random() - 0.5) * 8,
          y: y + (random() - 0.5) * 8,
          vx: (random() - 0.5) * 24,
          vy: -30 - random() * 40,
          life: 0.9 + random() * 0.6,
          maxLife: 1.5,
          size: 2 + random() * 2,
          color: random() < 0.5 ? '#ffb347' : '#ff7b2f',
          drag: 0.99,
          glow: true,
        });
      }
    },
    trail(x, y, color) {
      this.list.push({
        x,
        y,
        vx: (random() - 0.5) * 20,
        vy: (random() - 0.5) * 20,
        life: 0.25,
        maxLife: 0.25,
        size: 2.5,
        color,
        drag: 0.9,
        glow: true,
      });
    },
    floatText(x, y, text, color = '#ffd98a') {
      this.floats.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
    },
    step(dt) {
      for (let i = this.list.length - 1; i >= 0; i -= 1) {
        const p = this.list[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.list.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= p.drag;
        p.vy *= p.drag;
      }
      for (let i = this.floats.length - 1; i >= 0; i -= 1) {
        const f = this.floats[i];
        f.life -= dt;
        f.y -= 34 * dt;
        if (f.life <= 0) this.floats.splice(i, 1);
      }
    },
    clear() {
      this.list.length = 0;
      this.floats.length = 0;
    },
  };
}
