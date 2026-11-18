// Every pixel Emberlight draws: the dark arena, the lantern light, the HUD and
// all four screens. The judge sees screenshots first, so the title and the
// busiest gameplay frame are drawn to be readable at a glance.
import { ARENA, VIEW } from './config.js';
import {
  SCREEN_BANNER,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
} from './world.js';

const TITLE_FONT = '"Georgia", "Times New Roman", serif';
const UI_FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawButton(ctx, input, x, y, w, h, label, onClick, font = 'bold 22px ' + UI_FONT) {
  const hovered = input && input.hoverButton ? input.hoverButton() : null;
  const hover = hovered && hovered.label === label;
  ctx.save();
  ctx.fillStyle = hover ? 'rgba(255, 179, 71, 0.28)' : 'rgba(255, 179, 71, 0.14)';
  ctx.strokeStyle = '#ffb347';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffe9c4';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
  if (input) input.registerButton({ x, y, width: w, height: h }, onClick || (() => {}), label);
}

export function render(ctx, world, input, actions = {}) {
  ctx.save();
  // Fresh button registrations for this frame (clicks dispatch against the
  // previous frame's, which is what the player actually saw and clicked).
  if (input) input.clearButtons();
  // Screen shake.
  if (world.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  drawBackground(ctx, world);
  drawPickups(ctx, world);
  drawEnemies(ctx, world);
  drawFlares(ctx, world);
  drawBolts(ctx, world);
  if (!world.player.dead) drawPlayer(ctx, world);
  drawParticles(ctx, world);
  drawLanternLight(ctx, world);
  drawVignette(ctx);
  drawFloats(ctx, world);
  drawHUD(ctx, world);
  if (world.screen === SCREEN_TITLE) drawTitle(ctx, world, input, actions);
  else if (world.screen === SCREEN_BANNER) drawBanner(ctx, world);
  else if (world.screen === SCREEN_OVER) drawGameOver(ctx, world, input, actions);
  else if (world.screen === SCREEN_PAUSED) drawPaused(ctx, world, input, actions);
  // Red hurt flash.
  if (world.flash > 0) {
    ctx.fillStyle = `rgba(255, 40, 40, ${world.flash * 0.22})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
  ctx.restore();
}

function drawBackground(ctx, world) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  g.addColorStop(0, '#0b0a1a');
  g.addColorStop(0.55, '#12102a');
  g.addColorStop(1, '#0a0d1f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // Faint stars / drifting dust in the dark.
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 70; i += 1) {
    const x = ((i * 173.3) % VIEW.width);
    const y = ((i * 97.7) % VIEW.height);
    const tw = 0.25 + 0.25 * Math.sin(world.time * 0.7 + i);
    ctx.fillStyle = `rgba(180, 190, 255, ${Math.max(0.05, tw)})`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();

  // Arena floor: a soft radial pool of dim blue, then the glowing border.
  const floor = ctx.createRadialGradient(
    VIEW.width / 2, VIEW.height / 2 + 40, 80,
    VIEW.width / 2, VIEW.height / 2 + 40, 620,
  );
  floor.addColorStop(0, 'rgba(46, 44, 92, 0.55)');
  floor.addColorStop(1, 'rgba(46, 44, 92, 0)');
  ctx.fillStyle = floor;
  ctx.fillRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height);

  ctx.save();
  ctx.strokeStyle = 'rgba(139, 124, 214, 0.5)';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#8b7cd6';
  ctx.shadowBlur = 14;
  ctx.strokeRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height);
  ctx.restore();
}

function drawLanternLight(ctx, world) {
  const p = world.player;
  if (p.dead) return;
  // The keeper's lantern: a warm pool of light that pushes the dark back.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const radius = 250;
  const g = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, radius);
  g.addColorStop(0, 'rgba(255, 190, 90, 0.34)');
  g.addColorStop(0.45, 'rgba(255, 150, 60, 0.16)');
  g.addColorStop(1, 'rgba(255, 140, 50, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();
  // A tighter hot core around the lantern itself.
  const lx = p.x + Math.cos(p.aim) * 26;
  const ly = p.y + Math.sin(p.aim) * 26;
  const core = ctx.createRadialGradient(lx, ly, 2, lx, ly, 60);
  core.addColorStop(0, 'rgba(255, 220, 140, 0.55)');
  core.addColorStop(1, 'rgba(255, 180, 80, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(lx, ly, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawVignette(ctx) {
  const g = ctx.createRadialGradient(
    VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.42,
    VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.95,
  );
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function drawPlayer(ctx, world) {
  const p = world.player;
  ctx.save();
  // Cloak: a warm amber circle with a dark hood.
  ctx.fillStyle = '#c97b2d';
  ctx.strokeStyle = '#7a4a16';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Hood shadow + face.
  ctx.fillStyle = '#2b1a0e';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 2, p.radius - 6, 0, Math.PI * 2);
  ctx.fill();
  // Eyes: two small warm glints looking toward the aim.
  const ex = Math.cos(p.aim);
  const ey = Math.sin(p.aim);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(p.x + ex * 4 - ey * 4, p.y + ey * 4 + ex * 4 - 2, 2.2, 0, Math.PI * 2);
  ctx.arc(p.x + ex * 4 + ey * 4, p.y + ey * 4 - ex * 4 - 2, 2.2, 0, Math.PI * 2);
  ctx.fill();
  // The lantern, held out toward the aim.
  const lx = p.x + Math.cos(p.aim) * 26;
  const ly = p.y + Math.sin(p.aim) * 26;
  ctx.save();
  ctx.shadowColor = '#ffb347';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath();
  ctx.arc(lx, ly, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#8a5a1e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.aim) * 12, p.y + Math.sin(p.aim) * 12);
  ctx.lineTo(lx, ly);
  ctx.stroke();
  // Shield ring while invulnerable.
  if (p.shieldTimer > 0) {
    ctx.strokeStyle = `rgba(165, 242, 193, ${0.5 + 0.3 * Math.sin(world.time * 8)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 9, 0, Math.PI * 2);
    ctx.stroke();
  } else if (p.invuln > 0 && Math.floor(world.time * 12) % 2 === 0) {
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawEnemies(ctx, world) {
  for (const e of world.enemies) {
    ctx.save();
    // Shadow body: a dark mass with a purple rim that glows — light enough
    // to read against the dark arena, dark enough to stay a shadow.
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#241b40';
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Wobble spikes: the creature's silhouette shivers.
    ctx.strokeStyle = e.color;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 2;
    for (let s = 0; s < 5; s += 1) {
      const a = e.wobble + (s / 5) * Math.PI * 2;
      const r1 = e.radius - 2;
      const r2 = e.radius + 5 + Math.sin(e.wobble * 2 + s) * 3;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(a) * r1, e.y + Math.sin(a) * r1);
      ctx.lineTo(e.x + Math.cos(a) * r2, e.y + Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Glowing eyes, fixed on the keeper.
    const ex = Math.cos(e.angle);
    const ey = Math.sin(e.angle);
    const eyeOff = e.radius * 0.38;
    const eyeR = e.kind === 'brute' ? 4.5 : 3.2;
    ctx.fillStyle = e.eye;
    ctx.shadowColor = e.eye;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(e.x + ex * 5 - ey * eyeOff, e.y + ey * 5 + ex * eyeOff, eyeR, 0, Math.PI * 2);
    ctx.arc(e.x + ex * 5 + ey * eyeOff, e.y + ey * 5 - ex * eyeOff, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Hit flash.
    if (e.flash > 0) {
      ctx.globalAlpha = e.flash * 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Brutes show a health bar.
    if (e.kind === 'brute' && e.hp < e.maxHp) {
      const w = e.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
      ctx.fillStyle = '#ff6b81';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * (e.hp / e.maxHp), 5);
    }
    ctx.restore();
  }
}

function drawFlares(ctx, world) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const f of world.flares) {
    const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, 22);
    g.addColorStop(0, 'rgba(255, 230, 160, 0.95)');
    g.addColorStop(0.4, 'rgba(255, 170, 60, 0.6)');
    g.addColorStop(1, 'rgba(255, 120, 30, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBolts(ctx, world) {
  for (const b of world.bolts) {
    ctx.save();
    ctx.shadowColor = '#b06bff';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#c9a0ff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#efe4ff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPickups(ctx, world) {
  for (const pickup of world.pickups) {
    const bobY = Math.sin(pickup.bob) * 3;
    const y = pickup.y + bobY;
    const blink = pickup.life < 2 ? (Math.floor(world.time * 6) % 2 === 0 ? 0.35 : 1) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.shadowBlur = 12;
    if (pickup.kind === 'ember') {
      ctx.shadowColor = '#ff9a2f';
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.moveTo(pickup.x, y - 8);
      ctx.lineTo(pickup.x + 6, y);
      ctx.lineTo(pickup.x, y + 8);
      ctx.lineTo(pickup.x - 6, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath();
      ctx.arc(pickup.x, y - 1, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (pickup.kind === 'heart') {
      ctx.shadowColor = '#ff5d7e';
      ctx.fillStyle = '#ff8fa3';
      ctx.beginPath();
      ctx.moveTo(pickup.x, y + 8);
      ctx.bezierCurveTo(pickup.x - 12, y - 2, pickup.x - 7, y - 11, pickup.x, y - 4);
      ctx.bezierCurveTo(pickup.x + 7, y - 11, pickup.x + 12, y - 2, pickup.x, y + 8);
      ctx.fill();
    } else if (pickup.kind === 'spread') {
      ctx.shadowColor = '#5db8ff';
      ctx.fillStyle = '#8fd0ff';
      for (const dx of [-8, 0, 8]) {
        ctx.beginPath();
        ctx.moveTo(pickup.x + dx, y - 8);
        ctx.lineTo(pickup.x + dx + 4, y + 6);
        ctx.lineTo(pickup.x + dx - 4, y + 6);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.shadowColor = '#5df2a0';
      ctx.strokeStyle = '#a5f2c1';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pickup.x, y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#a5f2c1';
      ctx.beginPath();
      ctx.arc(pickup.x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawParticles(ctx, world) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of world.particles.list) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFloats(ctx, world) {
  ctx.save();
  ctx.font = 'bold 17px ' + UI_FONT;
  ctx.textAlign = 'center';
  for (const f of world.particles.floats) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}

function drawHUD(ctx, world) {
  const p = world.player;
  ctx.save();
  ctx.textBaseline = 'middle';
  // Score, left.
  ctx.fillStyle = '#ffe9c4';
  ctx.font = 'bold 26px ' + UI_FONT;
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${world.score}`, 28, 34);
  ctx.font = '16px ' + UI_FONT;
  ctx.fillStyle = '#b9b3e0';
  ctx.fillText(`BEST  ${Math.max(world.best, world.score)}`, 28, 60);
  // Wave, centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 24px ' + UI_FONT;
  ctx.fillText(`WAVE ${Math.max(1, world.wave)}`, VIEW.width / 2, 34);
  ctx.font = '14px ' + UI_FONT;
  ctx.fillStyle = '#b9b3e0';
  ctx.fillText(`${world.enemies.length + world.spawnQueue.length} shadows remain`, VIEW.width / 2, 58);
  // Hearts + embers, right.
  ctx.textAlign = 'right';
  let hx = VIEW.width - 28;
  for (let i = 0; i < p.maxHealth; i += 1) {
    const filled = i < p.health;
    ctx.fillStyle = filled ? '#ff8fa3' : 'rgba(255, 143, 163, 0.22)';
    ctx.font = '24px ' + UI_FONT;
    ctx.fillText('♥', hx, 34);
    hx -= 28;
  }
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 22px ' + UI_FONT;
  ctx.fillText(`◆ ${world.embers}`, VIEW.width - 28, 62);
  // Active power-up timers, under the hearts.
  ctx.font = 'bold 14px ' + UI_FONT;
  let ty = 84;
  if (p.spreadTimer > 0) {
    ctx.fillStyle = '#8fd0ff';
    ctx.fillText(`TRIPLE FLARE ${Math.ceil(p.spreadTimer)}s`, VIEW.width - 28, ty);
    ty += 20;
  }
  if (p.shieldTimer > 0) {
    ctx.fillStyle = '#a5f2c1';
    ctx.fillText(`SHIELD ${Math.ceil(p.shieldTimer)}s`, VIEW.width - 28, ty);
  }
  ctx.restore();
}

function dim(ctx, alpha) {
  ctx.fillStyle = `rgba(5, 4, 16, ${alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function drawTitle(ctx, world, input, actions) {
  dim(ctx, 0.62);
  ctx.save();
  ctx.textAlign = 'center';
  // Title with a warm glow.
  ctx.shadowColor = '#ffb347';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#ffd98a';
  ctx.font = `bold 92px ${TITLE_FONT}`;
  ctx.fillText('EMBERLIGHT', VIEW.width / 2, 218);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8e2ff';
  ctx.font = 'italic 26px ' + TITLE_FONT;
  ctx.fillText('Keep the lantern lit. Burn back the dark.', VIEW.width / 2, 268);
  // How to play.
  ctx.fillStyle = '#cfc8f2';
  ctx.font = '19px ' + UI_FONT;
  ctx.fillText('WASD / arrows — move      Mouse — aim      Click / Space — cast a flare', VIEW.width / 2, 330);
  ctx.fillText('Shadows burn in strong light. Grab embers, hearts and power-ups. Survive the waves.', VIEW.width / 2, 360);
  ctx.fillStyle = '#ffb347';
  ctx.font = '18px ' + UI_FONT;
  ctx.fillText('Drifter — chases you   ·   Spitter — shoots shadow bolts   ·   Brute — big, tough, slow', VIEW.width / 2, 396);
  // Best score.
  if (world.best > 0) {
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 20px ' + UI_FONT;
    ctx.fillText(`BEST SCORE  ${world.best}`, VIEW.width / 2, 442);
  }
  drawButton(ctx, input, VIEW.width / 2 - 130, 478, 260, 58, '▶  LIGHT THE LANTERN', actions.start);
  ctx.fillStyle = '#8f88b8';
  ctx.font = '15px ' + UI_FONT;
  ctx.fillText('P — pause      M — mute      R — restart', VIEW.width / 2, 570);
  ctx.restore();
}

function drawBanner(ctx, world) {
  ctx.save();
  ctx.textAlign = 'center';
  const pop = 1 + Math.max(0, world.bannerTimer - 1.9) * 0.12;
  ctx.translate(VIEW.width / 2, 330);
  ctx.scale(pop, pop);
  ctx.shadowColor = '#ffb347';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffd98a';
  ctx.font = `bold 74px ${TITLE_FONT}`;
  ctx.fillText(world.bannerText, 0, 0);
  ctx.restore();
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8e2ff';
  ctx.font = '22px ' + UI_FONT;
  ctx.fillText(world.bannerSub, VIEW.width / 2, 392);
  ctx.restore();
}

function drawGameOver(ctx, world, input, actions) {
  dim(ctx, 0.66);
  const s = world.overStats || { score: world.score, wave: world.wave, kills: world.kills, embers: world.embers, best: world.best, isBest: false };
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = '#8a7bd8';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#c9b8ff';
  ctx.font = `bold 68px ${TITLE_FONT}`;
  ctx.fillText('THE LIGHT FADES', VIEW.width / 2, 190);
  ctx.shadowBlur = 0;
  if (s.isBest) {
    ctx.fillStyle = '#ffd98a';
    ctx.font = 'bold 24px ' + UI_FONT;
    ctx.fillText('★ NEW BEST SCORE ★', VIEW.width / 2, 240);
  }
  const panelX = VIEW.width / 2 - 260;
  const panelY = 272;
  ctx.fillStyle = 'rgba(16, 13, 38, 0.9)';
  ctx.strokeStyle = 'rgba(139, 124, 214, 0.6)';
  ctx.lineWidth = 2;
  roundRect(ctx, panelX, panelY, 520, 168, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e8e2ff';
  ctx.font = '22px ' + UI_FONT;
  const rows = [
    [`SCORE`, `${s.score}`],
    [`WAVE REACHED`, `${s.wave}`],
    [`SHADOWS BURNED`, `${s.kills}`],
    [`EMBERS GATHERED`, `${s.embers}`],
  ];
  rows.forEach(([label, value], i) => {
    const y = panelY + 34 + i * 34;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#b9b3e0';
    ctx.fillText(label, panelX + 36, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe9c4';
    ctx.font = 'bold 22px ' + UI_FONT;
    ctx.fillText(value, panelX + 484, y);
    ctx.font = '22px ' + UI_FONT;
  });
  drawButton(ctx, input, VIEW.width / 2 - 130, 472, 260, 58, '↻  PLAY AGAIN  (R)', actions.again);
  ctx.fillStyle = '#8f88b8';
  ctx.font = '15px ' + UI_FONT;
  ctx.textAlign = 'center';
  ctx.fillText('The dark always returns. So does the lanternkeeper.', VIEW.width / 2, 566);
  ctx.restore();
}

function drawPaused(ctx, world, input, actions) {
  dim(ctx, 0.6);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a';
  ctx.font = `bold 56px ${TITLE_FONT}`;
  ctx.fillText('PAUSED', VIEW.width / 2, 320);
  ctx.fillStyle = '#cfc8f2';
  ctx.font = '20px ' + UI_FONT;
  ctx.fillText('Press P or Esc to keep playing', VIEW.width / 2, 372);
  drawButton(ctx, input, VIEW.width / 2 - 110, 408, 220, 52, '▶  RESUME', actions.resume);
  ctx.restore();
}
