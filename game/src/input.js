// Keyboard + mouse input, translated into one small state object the world reads.
// Also owns the clickable-button registry: screens register their buttons here
// each frame, and a click dispatches to the topmost button under the cursor.
export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const pressed = new Set();
  let buttons = [];

  function toGameCoords(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 720,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(event.code);
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const p = toGameCoords(event);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const p = toGameCoords(event);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    mouse.clicked = true;
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });

  return {
    keys,
    mouse,
    pressed,
    /** Movement vector from WASD / arrows, normalized. */
    move() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    firing() {
      return mouse.down || keys.has('Space');
    },
    /** True once for a key pressed since the last frame; consumed by the caller. */
    consume(code) {
      if (pressed.has(code)) {
        pressed.delete(code);
        return true;
      }
      return false;
    },
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
      // Buttons are NOT cleared here: render() registers each frame's buttons,
      // and clickButtons() runs before render, so it must still see the
      // previous frame's registrations. render() clears them first instead.
    },
    /** Drop the previous frame's button registrations (called by render). */
    clearButtons() {
      buttons = [];
    },
    registerButton(rect, onClick, label) {
      buttons.push({ ...rect, onClick, label });
    },
    /** Dispatch a click to the topmost registered button under the cursor. */
    clickButtons() {
      if (!mouse.clicked) return false;
      for (let i = buttons.length - 1; i >= 0; i -= 1) {
        const b = buttons[i];
        if (mouse.x >= b.x && mouse.x <= b.x + b.width && mouse.y >= b.y && mouse.y <= b.y + b.height) {
          b.onClick();
          mouse.clicked = false;
          return true;
        }
      }
      return false;
    },
    hoverButton() {
      for (let i = buttons.length - 1; i >= 0; i -= 1) {
        const b = buttons[i];
        if (mouse.x >= b.x && mouse.x <= b.x + b.width && mouse.y >= b.y && mouse.y <= b.y + b.height) return b;
      }
      return null;
    },
  };
}
