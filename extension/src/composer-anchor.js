/**
 * Where the ChatGPT launcher sits, and where its panel opens.
 * Pure geometry so tests can run without a browser.
 */

export const LAUNCHER_SIZE = 36;
export const PANEL_WIDTH = 320;
export const PANEL_MAX_HEIGHT = 360;

export const CHATGPT_HOSTS = ['chatgpt.com', 'chat.openai.com'];

export const CHATGPT_SEND_SELECTORS = [
  'button[data-testid="send-button"]',
  'button[data-testid="composer-send-button"]',
  'button[aria-label="Send prompt"]',
  'button[aria-label="Send message"]',
];

/**
 * @param {{ top: number, left: number, right: number, bottom: number }} a
 * @param {{ top: number, left: number, right: number, bottom: number }} b
 */
export function rectsOverlap(a, b) {
  if (!a || !b) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * @param {{ top: number, left: number, right: number, bottom: number }} rect
 * @param {number} pad
 */
export function padRect(rect, pad) {
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    right: rect.right + pad,
    bottom: rect.bottom + pad,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Place the launcher on the composer, clear of the send button.
 * Returns visible: false when the field is off screen.
 */
export function anchorControl({
  composer,
  send = null,
  viewport,
  size = LAUNCHER_SIZE,
  margin = 8,
}) {
  if (!composer || !viewport) return { visible: false };
  const width = composer.right - composer.left;
  const height = composer.bottom - composer.top;
  const onScreen = composer.bottom > size
    && composer.top < viewport.height - 4
    && composer.right > size
    && composer.left < viewport.width - 4
    && width >= 120
    && height >= 28;
  if (!onScreen) return { visible: false };

  let top = composer.top + margin;
  let left = composer.right - size - margin;
  // The send control sits on the bottom edge. Keep the launcher on the top edge.
  if (send && send.top > composer.top + height * 0.4) {
    top = composer.top + margin;
  }

  const box = () => ({ top, left, right: left + size, bottom: top + size });
  const sendBox = send ? padRect(send, 6) : null;
  if (sendBox && rectsOverlap(box(), sendBox)) {
    const shiftLeft = send.left - size - margin;
    if (shiftLeft >= composer.left + 4) left = shiftLeft;
  }
  if (sendBox && rectsOverlap(box(), sendBox)) {
    const above = send.top - size - margin;
    if (above >= 4) top = above;
  }
  if (sendBox && rectsOverlap(box(), sendBox)) {
    const below = send.bottom + margin;
    if (below + size <= viewport.height - 4) top = below;
  }

  left = clamp(left, 4, viewport.width - size - 4);
  top = clamp(top, 4, viewport.height - size - 4);
  const placed = box();
  return {
    visible: true,
    top,
    left,
    width: size,
    height: size,
    clearsSend: !sendBox || !rectsOverlap(placed, sendBox),
  };
}

/**
 * The panel prefers to open upward from a composer that sits low on the screen.
 */
export function panelOpensUp({ anchorTop, panelHeight = PANEL_MAX_HEIGHT, gap = 8 }) {
  return anchorTop - gap - panelHeight >= 8;
}

/**
 * Fixed-position panel that stays on screen and off the send button.
 */
export function placePanel({
  icon,
  send = null,
  viewport,
  panelWidth = PANEL_WIDTH,
  panelHeight = PANEL_MAX_HEIGHT,
  gap = 8,
}) {
  const opensUp = panelOpensUp({
    anchorTop: icon.top,
    panelHeight: Math.min(panelHeight, PANEL_MAX_HEIGHT),
    gap,
  });
  const height = Math.min(panelHeight, PANEL_MAX_HEIGHT, opensUp
    ? Math.max(120, icon.top - gap - 8)
    : Math.max(120, viewport.height - (icon.top + icon.height) - gap - 8));
  let top = opensUp ? icon.top - gap - height : icon.top + icon.height + gap;
  let left = icon.left + icon.width - panelWidth;
  left = clamp(left, 8, Math.max(8, viewport.width - panelWidth - 8));
  top = clamp(top, 8, Math.max(8, viewport.height - height - 8));

  if (send && rectsOverlap({ left, top, right: left + panelWidth, bottom: top + height }, padRect(send, 4))) {
    const shifted = send.left - gap - panelWidth;
    if (shifted >= 8) left = shifted;
  }

  const box = { left, top, right: left + panelWidth, bottom: top + height };
  return {
    top,
    left,
    width: panelWidth,
    height,
    opensUp,
    clearsSend: !send || !rectsOverlap(box, send),
  };
}
