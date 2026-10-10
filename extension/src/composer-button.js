import { enhance } from './engine.js';
import { SITE_RULES, writePromptField } from './page-field.js';
import { startComposerButton } from './composer-ui.js';

const chatgpt = SITE_RULES.find((rule) => rule.id === 'chatgpt');

startComposerButton(document, {
  selectors: chatgpt.selectors,
  enhance,
  writeText(el, text) {
    return writePromptField(selectorFor(el), text);
  },
});

function selectorFor(el) {
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
