/**
 * ChatGPT composer control. Runs only where the manifest matches.
 * Rewrites with the shared engine. Never submits the chat form.
 */

import { LEVELS } from './engine.js';
import { SITE_RULES, applyFieldText, siteForHost } from './page-field.js';
import {
  LAUNCHER_SIZE,
  PANEL_MAX_HEIGHT,
  PANEL_WIDTH,
  CHATGPT_SEND_SELECTORS,
  anchorControl,
  panelOpensUp,
  placePanel,
} from './composer-anchor.js';
import {
  REWRITE_ANIMATION_MS,
  completeRewrite,
  createSession,
  dismiss,
  editImproved,
  noteInserted,
  noteMissingComposer,
  openChooser,
  planInsert,
  requestRewrite,
} from './chatgpt-flow.js';
import { PANEL_CSS } from './chatgpt-styles.js';

if (siteForHost(location.hostname)?.id === 'chatgpt') {
  mountChatgptControl();
}

export function mountChatgptControl() {
  const host = document.createElement('div');
  host.setAttribute('data-promptpolish', 'chatgpt');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = PANEL_CSS;

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'launcher';
  launcher.setAttribute('aria-label', 'Polish this prompt');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'pp-panel');
  launcher.innerHTML = `<svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
    <path class="spark" d="M16 5.5l1.6 6.6 6.6 1.6-6.6 1.6L16 22.5l-1.6-6.6-6.6-1.6 6.6-1.6z" fill="#fbf8f3"/>
    <path d="M23.2 18.2l.7 2.6 2.6.7-2.6.7-.7 2.6-.7-2.6-2.6-.7 2.6-.7z" fill="#f3d48a"/>
  </svg>`;

  const panel = document.createElement('div');
  panel.id = 'pp-panel';
  panel.className = 'panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'PromptPolish');

  const title = document.createElement('h2');
  title.textContent = 'PromptPolish';
  const lede = document.createElement('p');
  lede.className = 'lede';
  lede.textContent = 'Stays in this browser. Does not send.';
  const task = document.createElement('p');
  task.className = 'task';
  task.setAttribute('aria-live', 'polite');

  const levels = document.createElement('div');
  levels.className = 'levels';
  levels.setAttribute('role', 'group');
  levels.setAttribute('aria-label', 'Level');
  const levelButtons = new Map();
  for (const level of LEVELS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'level';
    button.dataset.level = level.id;
    button.setAttribute('aria-pressed', 'false');
    const copy = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'level-name';
    name.textContent = level.label;
    const help = document.createElement('span');
    help.className = 'level-help';
    help.textContent = level.description;
    copy.append(name, help);
    button.append(copy);
    button.addEventListener('click', () => chooseLevel(level.id));
    levels.append(button);
    levelButtons.set(level.id, button);
  }

  const working = document.createElement('div');
  working.className = 'working';
  working.hidden = true;
  const workingText = document.createElement('p');
  workingText.className = 'hint';
  workingText.textContent = 'Rewriting locally…';
  const workingBar = document.createElement('div');
  workingBar.className = 'working-bar';
  workingBar.setAttribute('role', 'progressbar');
  workingBar.setAttribute('aria-label', 'Rewriting locally');
  working.append(workingText, workingBar);

  const result = document.createElement('div');
  result.className = 'result';
  result.hidden = true;

  const originalLabel = document.createElement('label');
  originalLabel.htmlFor = 'pp-original';
  originalLabel.textContent = 'Original';
  const originalBox = document.createElement('textarea');
  originalBox.id = 'pp-original';
  originalBox.rows = 3;
  originalBox.readOnly = true;

  const improvedLabel = document.createElement('label');
  improvedLabel.htmlFor = 'pp-improved';
  improvedLabel.textContent = 'Improved prompt';
  const improvedBox = document.createElement('textarea');
  improvedBox.id = 'pp-improved';
  improvedBox.rows = 6;

  const markerList = document.createElement('ul');
  markerList.className = 'markers';

  const notice = document.createElement('p');
  notice.className = 'notice';
  notice.setAttribute('role', 'status');

  const row = document.createElement('div');
  row.className = 'row';
  const insertButton = document.createElement('button');
  insertButton.type = 'button';
  insertButton.className = 'action';
  insertButton.textContent = 'Insert';
  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'ghost';
  copyButton.textContent = 'Copy';
  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'ghost';
  dismissButton.textContent = 'Dismiss';
  row.append(insertButton, copyButton, dismissButton);
  result.append(originalLabel, originalBox, improvedLabel, improvedBox, markerList, notice, row);

  const chooserDismiss = document.createElement('div');
  chooserDismiss.className = 'row';
  const dismissOnly = document.createElement('button');
  dismissOnly.type = 'button';
  dismissOnly.className = 'ghost';
  dismissOnly.textContent = 'Dismiss';
  chooserDismiss.append(dismissOnly);

  panel.append(title, lede, task, levels, working, result, chooserDismiss);
  shadow.append(style, launcher, panel);
  document.documentElement.appendChild(host);

  let session = createSession();
  let rewriteToken = 0;
  let scheduled = 0;

  function stopAtPanel(event) {
    event.stopPropagation();
  }
  launcher.addEventListener('pointerdown', stopAtPanel);
  panel.addEventListener('pointerdown', stopAtPanel);
  panel.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
    }
  });

  launcher.addEventListener('click', () => {
    if (session.phase === 'closed') {
      session = openChooser(session);
      render();
      levelButtons.get('detailed')?.focus();
      return;
    }
    closePanel();
  });
  dismissButton.addEventListener('click', closePanel);
  dismissOnly.addEventListener('click', closePanel);
  insertButton.addEventListener('click', () => {
    const plan = planInsert(session);
    if (!plan.write || plan.send) return;
    const composer = findComposer();
    if (!composer) {
      session = noteMissingComposer(session);
      render();
      return;
    }
    const written = applyFieldText(composer, plan.text);
    session = noteInserted(session, Boolean(written.ok));
    render();
  });
  copyButton.addEventListener('click', async () => {
    const text = improvedBox.value;
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      notice.textContent = 'Copied. The message was not sent.';
    } catch {
      improvedBox.focus();
      improvedBox.select();
      notice.textContent = 'Copy was blocked. The improved prompt is selected.';
    }
  });
  improvedBox.addEventListener('input', () => {
    session = editImproved(session, improvedBox.value);
    renderMarkers();
    insertButton.disabled = !session.improved.trim();
  });

  document.addEventListener('pointerdown', (event) => {
    if (session.phase === 'closed') return;
    if (event.composedPath().includes(host)) return;
    closePanel();
  }, true);

  document.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  schedule();

  function closePanel() {
    rewriteToken += 1;
    session = dismiss(session);
    render();
    launcher.focus();
  }

  async function chooseLevel(level) {
    const token = ++rewriteToken;
    const composer = findComposer();
    const draft = readComposer(composer);
    session = requestRewrite(session, draft, level);
    render();
    if (session.phase !== 'rewriting') return;
    await delay(REWRITE_ANIMATION_MS);
    if (token !== rewriteToken) return;
    session = completeRewrite(session, draft);
    render();
    improvedBox.focus();
  }

  function render() {
    const open = session.phase !== 'closed';
    host.classList.toggle('is-open', open);
    launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.hidden = !open;
    working.hidden = session.phase !== 'rewriting';
    const showResult = session.phase === 'result';
    result.hidden = !showResult;
    chooserDismiss.hidden = showResult;
    task.textContent = session.taskLabel ? `Detected task: ${session.taskLabel}` : '';
    for (const [id, button] of levelButtons) {
      button.setAttribute('aria-pressed', session.level === id ? 'true' : 'false');
      button.disabled = session.phase === 'rewriting';
    }
    if (showResult) {
      originalBox.value = session.original;
      if (shadow.activeElement !== improvedBox) improvedBox.value = session.improved;
      renderMarkers();
      notice.textContent = session.notice;
      insertButton.disabled = !session.improved.trim();
    } else {
      notice.textContent = '';
    }
    schedule();
  }

  function renderMarkers() {
    markerList.replaceChildren();
    for (const item of session.assumptions) markerList.append(markerItem('Assumption', item, 'assumption'));
    for (const item of session.openQuestions) markerList.append(markerItem('Open question', item, 'question'));
  }

  function schedule() {
    if (scheduled) return;
    scheduled = requestAnimationFrame(() => {
      scheduled = 0;
      position();
    });
  }

  function position() {
    if (!host.isConnected) document.documentElement.appendChild(host);
    const composer = findComposer();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const send = findSend(composer);
    const anchor = anchorControl({
      composer: composer ? rectOf(composer) : null,
      send: send ? rectOf(send) : null,
      viewport,
      size: LAUNCHER_SIZE,
    });
    if (!anchor.visible) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    host.style.top = `${anchor.top}px`;
    host.style.left = `${anchor.left}px`;
    const opensUp = panelOpensUp({ anchorTop: anchor.top, panelHeight: PANEL_MAX_HEIGHT });
    host.classList.toggle('flip', !opensUp);
    const room = opensUp
      ? anchor.top - 12
      : viewport.height - (anchor.top + LAUNCHER_SIZE) - 12;
    const panelHeight = Math.max(140, Math.min(PANEL_MAX_HEIGHT, room));
    host.style.setProperty('--pp-max-h', `${panelHeight}px`);
    const placed = placePanel({
      icon: { left: anchor.left, top: anchor.top, width: LAUNCHER_SIZE, height: LAUNCHER_SIZE },
      send: send ? rectOf(send) : null,
      viewport,
      panelWidth: PANEL_WIDTH,
      panelHeight,
    });
    panel.style.top = `${placed.top}px`;
    panel.style.left = `${placed.left}px`;
  }
}

function markerItem(label, text, kind) {
  const li = document.createElement('li');
  const badge = document.createElement('span');
  badge.className = `badge ${kind}`;
  badge.textContent = label;
  const body = document.createElement('span');
  body.textContent = text;
  li.append(badge, body);
  return li;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function composerSelectors() {
  return SITE_RULES.find((rule) => rule.id === 'chatgpt')?.selectors ?? [];
}

function findComposer() {
  let best = null;
  let bestArea = 0;
  for (const selector of composerSelectors()) {
    let nodes;
    try {
      nodes = document.querySelectorAll(selector);
    } catch {
      continue;
    }
    for (const el of nodes) {
      if (!isVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea) {
        best = el;
        bestArea = area;
      }
    }
  }
  return best;
}

function findSend(composer) {
  if (!composer) return null;
  const root = composer.closest('form') || document;
  const region = pad(rectOf(composer), 56);
  for (const selector of CHATGPT_SEND_SELECTORS) {
    let nodes;
    try {
      nodes = root.querySelectorAll(selector);
    } catch {
      continue;
    }
    for (const el of nodes) {
      if (!isVisible(el)) continue;
      if (!overlaps(rectOf(el), region)) continue;
      return el;
    }
  }
  return null;
}

function readComposer(el) {
  if (!el) return '';
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value || '';
  return el.innerText || el.textContent || '';
}

function rectOf(el) {
  const rect = el.getBoundingClientRect();
  return { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom };
}

function pad(rect, amount) {
  return {
    top: rect.top - amount,
    left: rect.left - amount,
    right: rect.right + amount,
    bottom: rect.bottom + amount,
  };
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function isVisible(el) {
  if (!el?.getClientRects || el.getClientRects().length === 0) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0;
}
