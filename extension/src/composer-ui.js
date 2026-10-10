/**
 * In-page ChatGPT control. The content script and the demo page both mount this.
 * Rewriting stays local. The composer changes only after Insert.
 */

import { LEVELS, TASK_LABELS, detectTask, parseMarkers } from './engine.js';
import { COMPOSER_CSS } from '../composer/styles.js';

export const BUTTON_SIZE = 42;

export const INITIAL_ASSIST = {
  open: false,
  level: 'detailed',
  phase: 'choose',
  improved: '',
  taskLabel: '',
  status: '',
};

const mountedDocs = new WeakSet();

/**
 * @param {{ top: number, right: number, bottom: number, left: number }} rect
 * @param {{ width: number, height: number }} viewport
 */
export function placeAnchor(rect, viewport) {
  const inset = 10;
  const left = clamp(rect.right - BUTTON_SIZE - inset, 8, Math.max(8, viewport.width - BUTTON_SIZE - 8));
  const top = clamp(rect.top + inset, 8, Math.max(8, viewport.height - BUTTON_SIZE - 8));
  const roomBelow = viewport.height - (top + BUTTON_SIZE + 12);
  return {
    left: Math.round(left),
    top: Math.round(top),
    opensUp: roomBelow < 340 && top > 80,
    alignEnd: left + BUTTON_SIZE > 336,
  };
}

/**
 * @param {typeof INITIAL_ASSIST} state
 * @param {{ type: string, level?: string, draft?: string }} event
 * @param {(draft: string, level: string) => { improved: string, taskLabel: string, level: string }} enhance
 */
export function reduceAssist(state, event, enhance) {
  switch (event.type) {
    case 'toggle':
      if (state.open) return { ...INITIAL_ASSIST };
      return { ...INITIAL_ASSIST, open: true };
    case 'close':
      return { ...INITIAL_ASSIST };
    case 'level':
      if (!LEVELS.some((item) => item.id === event.level)) return state;
      return { ...state, level: event.level };
    case 'rewrite': {
      const draft = String(event.draft ?? '');
      if (!draft.trim()) {
        return { ...state, open: true, phase: 'choose', improved: '', taskLabel: '', status: 'empty' };
      }
      const result = enhance(draft, state.level);
      return {
        ...state,
        open: true,
        phase: 'result',
        improved: result.improved,
        taskLabel: result.taskLabel,
        level: result.level,
        status: 'ready',
      };
    }
    case 'inserted':
      return { ...INITIAL_ASSIST };
    default:
      return state;
  }
}

/** After a result is showing, picking another level rewrites. Before that, it only selects. */
export function afterLevelChange(state) {
  return state.phase === 'result' ? 'rewrite' : 'stay';
}

export function canInsert(state) {
  return Boolean(state.open && state.phase === 'result' && state.improved.trim());
}

/**
 * @param {Document} doc
 * @param {{ selectors: string[], enhance: Function, writeText: (el: Element, text: string) => { ok?: boolean } }} options
 */
export function mountComposerAssist(doc, options) {
  const host = doc.createElement('div');
  host.id = 'promptpolish-composer';
  host.setAttribute('data-promptpolish', 'composer');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = COMPOSER_CSS;
  const stack = doc.createElement('div');
  stack.className = 'stack';
  stack.innerHTML = panelMarkup();
  shadow.append(style, stack);

  const fab = stack.querySelector('.fab');
  const panel = stack.querySelector('.panel');
  const toast = stack.querySelector('.toast');
  const taskLine = stack.querySelector('.task');
  const statusLine = stack.querySelector('.status');
  const preview = stack.querySelector('.preview');
  const previewBlock = stack.querySelector('.preview-block');
  const markers = stack.querySelector('.markers');
  const levelButtons = [...stack.querySelectorAll('.level')];

  let state = { ...INITIAL_ASSIST };
  let composer = null;
  let sourceDraft = '';
  let revealTicket = 0;
  let toastTimer = 0;

  function placeHost() {
    if (!composer) {
      host.hidden = true;
      return;
    }
    const place = placeAnchor(anchorRect(composer), viewportOf(doc));
    host.hidden = false;
    host.style.left = `${place.left}px`;
    host.style.top = `${place.top}px`;
    stack.classList.toggle('opens-up', place.opensUp);
    stack.classList.toggle('align-start', !place.alignEnd);
  }

  function render(next) {
    state = next;
    placeHost();
    fab.setAttribute('aria-expanded', state.open ? 'true' : 'false');
    panel.hidden = !state.open;
    for (const button of levelButtons) {
      button.setAttribute('aria-checked', button.dataset.level === state.level ? 'true' : 'false');
    }
    const draft = composer ? readFieldText(composer) : '';
    if (state.status === 'empty' || (state.open && !draft.trim())) {
      taskLine.textContent = state.open ? 'Write a prompt in the field first.' : '';
    } else if (state.open && draft.trim()) {
      taskLine.textContent = `Detected task: ${TASK_LABELS[detectTask(draft)]}`;
    } else {
      taskLine.textContent = '';
    }
    previewBlock.hidden = state.phase !== 'result';
    preview.textContent = state.improved;
    renderMarkers(markers, state.phase === 'result' ? state.improved : '');
    if (state.status === 'ready') {
      const stale = draft !== sourceDraft;
      statusLine.textContent = stale
        ? 'The field changed. Rewrite again to refresh. Nothing is inserted yet.'
        : `Enhanced as ${state.taskLabel}. Nothing is inserted yet.`;
    } else if (state.status === 'empty') {
      statusLine.textContent = 'Write a prompt in the field first.';
    } else if (state.status === 'working') {
      statusLine.textContent = 'Rewriting locally…';
    } else if (state.status === 'rejected') {
      statusLine.textContent = 'The field did not keep that text. Copy it from the card or use the toolbar.';
    } else {
      statusLine.textContent = state.open ? 'Pick a level, then rewrite. The field stays as it is until you insert.' : '';
    }
    const insertButton = stack.querySelector('.insert');
    insertButton.disabled = !canInsert(state) || state.status === 'working';
  }

  function burst() {
    fab.classList.remove('is-burst');
    // Restart the keyframes when the mark is clicked again.
    void fab.offsetWidth;
    fab.classList.add('is-burst');
  }

  function openPanel() {
    burst();
    sourceDraft = '';
    render(reduceAssist(state, { type: 'toggle' }));
    const chosen = stack.querySelector('.level[aria-checked="true"]');
    chosen?.focus();
  }

  function closePanel() {
    revealTicket += 1;
    panel.classList.remove('is-rewriting');
    render(reduceAssist(state, { type: 'close' }));
  }

  function beginRewrite(base) {
    const draft = composer ? readFieldText(composer) : '';
    const ticket = ++revealTicket;
    panel.classList.add('is-rewriting');
    render({ ...base, open: true, phase: 'choose', improved: '', status: 'working' });
    const delay = prefersReducedMotion(doc) ? 0 : 460;
    doc.defaultView.setTimeout(() => {
      if (ticket !== revealTicket) return;
      panel.classList.remove('is-rewriting');
      sourceDraft = draft;
      render(reduceAssist(base, { type: 'rewrite', draft }, options.enhance));
      if (canInsert(state)) stack.querySelector('.insert').focus();
    }, delay);
  }

  fab.addEventListener('animationend', (event) => {
    if (event.animationName === 'pp-pop') fab.classList.remove('is-burst');
  });

  fab.addEventListener('click', () => {
    if (state.open) closePanel();
    else openPanel();
  });

  stack.querySelector('.close').addEventListener('click', closePanel);
  stack.querySelector('.keep').addEventListener('click', closePanel);
  stack.querySelector('.rewrite').addEventListener('click', () => beginRewrite(state));

  for (const button of levelButtons) {
    button.addEventListener('click', () => {
      const next = reduceAssist(state, { type: 'level', level: button.dataset.level });
      if (afterLevelChange(state) === 'rewrite') beginRewrite(next);
      else render(next);
    });
  }

  stack.querySelector('.insert').addEventListener('click', () => {
    if (!canInsert(state) || !composer) return;
    const written = options.writeText(composer, state.improved);
    if (written?.ok) {
      const message = 'Inserted into the field.';
      closePanel();
      showToast(message);
      return;
    }
    render({ ...state, status: 'rejected' });
  });

  function showToast(message) {
    toast.hidden = false;
    toast.textContent = message;
    doc.defaultView.clearTimeout(toastTimer);
    toastTimer = doc.defaultView.setTimeout(() => {
      toast.hidden = true;
      toast.textContent = '';
    }, 1600);
  }

  function onKeydown(event) {
    if (event.key !== 'Escape' || !state.open) return;
    event.preventDefault();
    event.stopPropagation();
    closePanel();
  }

  function onPointerDown(event) {
    if (!state.open) return;
    const path = event.composedPath();
    if (path.includes(host)) return;
    if (composer && path.includes(composer)) return;
    closePanel();
  }

  function tick() {
    if (!host.isConnected) doc.documentElement.append(host);
    composer = findComposer(doc, options.selectors);
    placeHost();
    if (!state.open || !composer || state.status === 'working') return;
    const draft = readFieldText(composer);
    if (state.phase === 'result' && state.status === 'ready') {
      statusLine.textContent = draft !== sourceDraft
        ? 'The field changed. Rewrite again to refresh. Nothing is inserted yet.'
        : `Enhanced as ${state.taskLabel}. Nothing is inserted yet.`;
      return;
    }
    taskLine.textContent = draft.trim()
      ? `Detected task: ${TASK_LABELS[detectTask(draft)]}`
      : 'Write a prompt in the field first.';
  }

  doc.addEventListener('keydown', onKeydown, true);
  doc.addEventListener('pointerdown', onPointerDown, true);
  doc.addEventListener('scroll', tick, true);
  doc.defaultView.addEventListener('resize', tick);
  const observer = new MutationObserver(tick);
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  const timer = doc.defaultView.setInterval(tick, 400);
  doc.documentElement.append(host);
  tick();

  return function stop() {
    revealTicket += 1;
    observer.disconnect();
    doc.defaultView.clearInterval(timer);
    doc.defaultView.clearTimeout(toastTimer);
    doc.removeEventListener('keydown', onKeydown, true);
    doc.removeEventListener('pointerdown', onPointerDown, true);
    doc.removeEventListener('scroll', tick, true);
    doc.defaultView.removeEventListener('resize', tick);
    host.remove();
  };
}

/**
 * @param {Document} doc
 * @param {{ selectors: string[], enhance: Function, writeText: (el: Element, text: string) => { ok?: boolean } }} options
 */
export function startComposerButton(doc, options) {
  if (mountedDocs.has(doc)) return () => {};
  mountedDocs.add(doc);
  const stop = mountComposerAssist(doc, options);
  return () => {
    stop();
    mountedDocs.delete(doc);
  };
}

export function readFieldText(el) {
  if (!el) return '';
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT') return el.value || '';
  return el.innerText || el.textContent || '';
}

function findComposer(doc, selectors) {
  let best = null;
  let bestArea = 0;
  for (const selector of selectors) {
    let nodes;
    try {
      nodes = doc.querySelectorAll(selector);
    } catch {
      continue;
    }
    for (const el of nodes) {
      if (el.closest?.('#promptpolish-composer')) continue;
      if (!shown(el)) continue;
      const rect = el.getBoundingClientRect();
      const area = Math.max(0, rect.width) * Math.max(0, rect.height);
      if (area >= bestArea) {
        best = el;
        bestArea = area;
      }
    }
  }
  return best;
}

function anchorRect(el) {
  const rect = el.getBoundingClientRect();
  const parent = el.parentElement;
  if (!parent || rect.height >= 64) return rect;
  const parentRect = parent.getBoundingClientRect();
  const taller = parentRect.height > rect.height && parentRect.height <= 240;
  const wider = parentRect.width >= rect.width - 8 && parentRect.width <= rect.width + 80;
  if (taller && wider && parentRect.width > 200) return parentRect;
  return rect;
}

function shown(el) {
  if (!el.getClientRects || el.getClientRects().length === 0) return false;
  const view = el.ownerDocument.defaultView;
  const style = view.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 40 && rect.height > 20;
}

function viewportOf(doc) {
  const view = doc.defaultView;
  return { width: view.innerWidth, height: view.innerHeight };
}

function prefersReducedMotion(doc) {
  return doc.defaultView.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function renderMarkers(list, text) {
  list.replaceChildren();
  const parsed = parseMarkers(text);
  const owner = list.ownerDocument;
  for (const item of parsed.assumptions) list.append(markerItem(owner, 'Assumption', item, 'assumption'));
  for (const item of parsed.openQuestions) list.append(markerItem(owner, 'Open question', item, 'question'));
  list.hidden = parsed.assumptions.length + parsed.openQuestions.length === 0;
}

function markerItem(owner, label, text, kind) {
  const li = owner.createElement('li');
  const badge = owner.createElement('span');
  badge.className = `badge ${kind}`;
  badge.textContent = label;
  const body = owner.createElement('span');
  body.textContent = text;
  li.append(badge, body);
  return li;
}

function panelMarkup() {
  const levels = LEVELS.map((level) => `
    <button type="button" class="level" role="radio" data-level="${level.id}" aria-checked="false">
      <span class="level-name">${level.label}</span>
      <span class="level-help">${level.description}</span>
    </button>
  `).join('');
  return `
    <button type="button" class="fab" aria-label="Polish this prompt" aria-haspopup="dialog" aria-expanded="false">
      <span class="ring" aria-hidden="true"></span>
      <span class="spark s1" aria-hidden="true"></span>
      <span class="spark s2" aria-hidden="true"></span>
      <span class="spark s3" aria-hidden="true"></span>
      <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
        <path class="star" d="M16 5.5l1.6 6.6 6.6 1.6-6.6 1.6L16 22.5l-1.6-6.6L7.8 13.7l6.6-1.6z" fill="#fbf8f3"/>
        <path d="M23.5 18.2l.55 2.2 2.2.55-2.2.55-.55 2.2-.55-2.2-2.2-.55 2.2-.55z" fill="#f3d48a"/>
      </svg>
    </button>
    <div class="panel" role="dialog" aria-label="Rewrite this prompt" hidden>
      <div class="shimmer" aria-hidden="true"></div>
      <div class="head">
        <span class="title">PromptPolish</span>
        <button type="button" class="close" aria-label="Close">×</button>
      </div>
      <p class="task"></p>
      <div class="levels" role="radiogroup" aria-label="Level">${levels}</div>
      <button type="button" class="rewrite primary">Rewrite</button>
      <div class="preview-block" hidden>
        <p class="label">Improved prompt</p>
        <div class="preview" tabindex="0"></div>
        <ul class="markers" hidden></ul>
        <div class="row">
          <button type="button" class="insert primary">Insert into field</button>
          <button type="button" class="keep">Keep original</button>
        </div>
      </div>
      <p class="status" role="status"></p>
    </div>
    <p class="toast" role="status" hidden></p>
  `;
}
