/**
 * Finds the prompt field on the active tab and writes back only to that field.
 * readPromptField and writePromptField are injected into the page, so they
 * cannot call other module functions. Host matching used by tests lives in
 * siteForHost and is repeated, in short form, inside the injected reader.
 */

export const SITE_RULES = [
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    hosts: ['chatgpt.com', 'chat.openai.com'],
    selectors: ['#prompt-textarea', 'div#prompt-textarea', 'textarea[data-id="root"]'],
  },
  {
    id: 'claude',
    label: 'Claude',
    hosts: ['claude.ai'],
    selectors: [
      'div.ProseMirror[contenteditable="true"]',
      'fieldset [contenteditable="true"]',
      'div[contenteditable="true"][aria-label*="message" i]',
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    hosts: ['gemini.google.com'],
    selectors: [
      'rich-textarea .ql-editor[contenteditable="true"]',
      'div.ql-editor[contenteditable="true"]',
      'rich-textarea div[contenteditable="true"]',
    ],
  },
];

/**
 * @param {string} hostname
 * @param {typeof SITE_RULES} [rules]
 */
export function siteForHost(hostname, rules = SITE_RULES) {
  const host = String(hostname ?? '').toLowerCase().replace(/\.$/, '');
  for (const rule of rules) {
    for (const allowed of rule.hosts) {
      if (host === allowed || host.endsWith(`.${allowed}`)) return rule;
    }
  }
  return null;
}

/**
 * Picks one read result across frames. A focused field that already has text
 * wins. A composer that has text beats an empty focused control.
 * @param {Array<{ frameId?: number, result?: object }>} frameResults
 */
export function pickBestRead(frameResults) {
  const found = [];
  for (const frame of frameResults ?? []) {
    if (!frame?.result?.ok) continue;
    found.push({ frameId: frame.frameId ?? 0, ...frame.result });
  }
  const rank = (result) => {
    let score = 0;
    const hasText = Boolean(result.text && String(result.text).trim());
    if (result.source === 'focused' && hasText) score += 10;
    else if (result.source === 'composer' && hasText) score += 8;
    else if (result.source === 'focused') score += 4;
    else if (result.source === 'composer') score += 2;
    if (result.site) score += 1;
    return score;
  };
  found.sort((a, b) => rank(b) - rank(a) || (b.area || 0) - (a.area || 0));
  return found[0] ?? null;
}

/**
 * Injected into the page. Keep this function self-contained.
 * @param {typeof SITE_RULES} rules
 */
export function readPromptField(rules) {
  const host = String(location.hostname || '').toLowerCase().replace(/\.$/, '');
  let site = null;
  for (const rule of rules) {
    for (const allowed of rule.hosts) {
      if (host === allowed || host.endsWith(`.${allowed}`)) site = rule;
    }
  }

  function areaOf(el) {
    const rect = el.getBoundingClientRect();
    return Math.max(0, rect.width) * Math.max(0, rect.height);
  }

  function isVisible(el) {
    if (!el || !el.getClientRects || el.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }
    return true;
  }

  function tooBig(el) {
    const view = window.innerWidth * window.innerHeight;
    return view > 0 && areaOf(el) > view * 0.7;
  }

  function kindOf(el) {
    if (!el || el === document.body || el === document.documentElement) return null;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return 'textarea';
    if (tag === 'INPUT') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type !== 'text' && type !== 'search') return null;
      const hint = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('placeholder') || ''}`;
      if (!/prompt|message|ask|chat|compose/i.test(hint)) return null;
      return 'input';
    }
    if (el.isContentEditable || el.getAttribute('role') === 'textbox') return 'contenteditable';
    return null;
  }

  function editableRoot(node) {
    let current = node;
    let found = null;
    while (current && current !== document.body) {
      if (current.isContentEditable || current.getAttribute?.('role') === 'textbox') found = current;
      current = current.parentElement;
    }
    return found;
  }

  function readText(el, kind) {
    if (kind === 'textarea' || kind === 'input') return el.value || '';
    return el.innerText || el.textContent || '';
  }

  function selectorFor(el, matchedSelector) {
    if (matchedSelector) {
      try {
        if (document.querySelectorAll(matchedSelector).length === 1) return matchedSelector;
      } catch {
        /* The selector still identifies the element we already hold. */
      }
    }
    if (el.id) {
      const idSelector = `#${CSS.escape(el.id)}`;
      if (document.querySelectorAll(idSelector).length === 1) return idSelector;
    }
    const existing = el.getAttribute('data-promptpolish-target');
    if (existing) return `[data-promptpolish-target="${CSS.escape(existing)}"]`;
    const token = `pp${Math.random().toString(36).slice(2, 10)}`;
    el.setAttribute('data-promptpolish-target', token);
    return `[data-promptpolish-target="${CSS.escape(token)}"]`;
  }

  let focused = null;
  const root = editableRoot(document.activeElement);
  const focusedKind = kindOf(root);
  if (focusedKind && isVisible(root) && (site || !tooBig(root))) {
    focused = {
      el: root,
      kind: focusedKind,
      source: 'focused',
      matched: null,
      area: areaOf(root),
    };
  }

  let composer = null;
  if (site) {
    let best = null;
    let bestSelector = null;
    let bestArea = 0;
    for (const selector of site.selectors) {
      let nodes;
      try {
        nodes = document.querySelectorAll(selector);
      } catch {
        continue;
      }
      for (const el of nodes) {
        if (!isVisible(el)) continue;
        const box = areaOf(el);
        if (box >= bestArea) {
          best = el;
          bestSelector = selector;
          bestArea = box;
        }
      }
    }
    if (best) {
      composer = {
        el: best,
        kind: kindOf(best) || (best.isContentEditable ? 'contenteditable' : 'textarea'),
        source: 'composer',
        matched: bestSelector,
        area: bestArea,
      };
    }
  }

  const focusedText = focused ? readText(focused.el, focused.kind).trim() : '';
  const composerText = composer ? readText(composer.el, composer.kind).trim() : '';
  let chosen = null;
  if (focused && focusedText) chosen = focused;
  else if (composer && composerText) chosen = composer;
  else if (focused) chosen = focused;
  else if (composer) chosen = composer;
  else return { ok: false, reason: 'not-found' };

  return {
    ok: true,
    source: chosen.source,
    selector: selectorFor(chosen.el, chosen.matched),
    text: readText(chosen.el, chosen.kind),
    site: site ? site.id : null,
    siteLabel: site ? site.label : null,
    kind: chosen.kind,
    area: chosen.area,
  };
}

/**
 * Compare a field's text with what we tried to write.
 * Textareas must match exactly. Contenteditable fields match after whitespace collapses.
 * @param {string} actual
 * @param {string} expected
 * @param {'textarea'|'input'|'contenteditable'} kind
 */
export function fieldTextMatches(actual, expected, kind) {
  if (kind === 'textarea' || kind === 'input') return String(actual ?? '') === String(expected ?? '');
  const norm = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  return norm(actual) === norm(expected);
}

/**
 * Write into an element the content script already holds.
 * Does not press Enter and does not submit a form.
 * @param {Element} el
 * @param {string} text
 */
export function applyFieldText(el, text) {
  if (!el) return { ok: false, reason: 'missing' };
  el.focus();
  const tag = el.tagName;

  if (tag === 'TEXTAREA' || tag === 'INPUT') {
    const proto = tag === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor?.set) descriptor.set.call(el, text);
    else el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    const verified = fieldTextMatches(el.value || '', text, 'textarea');
    if (verified) el.removeAttribute('data-promptpolish-target');
    return verified ? { ok: true, verified: true } : { ok: false, reason: 'not-verified' };
  }

  if (el.isContentEditable || el.getAttribute('role') === 'textbox') {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, text);
    } catch {
      inserted = false;
    }
    if (!inserted) {
      el.textContent = text;
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        data: text,
        inputType: 'insertText',
      }));
    }
    const verified = fieldTextMatches(el.innerText || el.textContent || '', text, 'contenteditable');
    if (verified) el.removeAttribute('data-promptpolish-target');
    return verified ? { ok: true, verified: true } : { ok: false, reason: 'not-verified' };
  }

  return { ok: false, reason: 'unsupported' };
}

/**
 * Injected into the page by the toolbar popup. Must stay self-contained:
 * Chrome serializes this function alone, so it cannot call applyFieldText.
 * @param {string} selector
 * @param {string} text
 */
export function writePromptField(selector, text) {
  const el = document.querySelector(selector);
  if (!el) return { ok: false, reason: 'missing' };
  el.focus();
  const tag = el.tagName;

  if (tag === 'TEXTAREA' || tag === 'INPUT') {
    const proto = tag === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor?.set) descriptor.set.call(el, text);
    else el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    const verified = (el.value || '') === text;
    if (verified) el.removeAttribute('data-promptpolish-target');
    return verified ? { ok: true, verified: true } : { ok: false, reason: 'not-verified' };
  }

  if (el.isContentEditable || el.getAttribute('role') === 'textbox') {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, text);
    } catch {
      inserted = false;
    }
    if (!inserted) {
      el.textContent = text;
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        data: text,
        inputType: 'insertText',
      }));
    }
    const actual = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    const expected = String(text).replace(/\s+/g, ' ').trim();
    const verified = actual === expected;
    if (verified) el.removeAttribute('data-promptpolish-target');
    return verified ? { ok: true, verified: true } : { ok: false, reason: 'not-verified' };
  }

  return { ok: false, reason: 'unsupported' };
}
