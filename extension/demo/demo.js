import { enhance } from '../src/engine.js';
import { SITE_RULES, writePromptField } from '../src/page-field.js';
import { startComposerButton } from '../src/composer-ui.js';

const chatgpt = SITE_RULES.find((rule) => rule.id === 'chatgpt');
const field = document.querySelector('#prompt-textarea');

startComposerButton(document, {
  selectors: chatgpt.selectors,
  enhance,
  writeText(el, text) {
    const selector = el.id ? `#${CSS.escape(el.id)}` : '#prompt-textarea';
    return writePromptField(selector, text);
  },
});

field.textContent = 'pls write a py function to reverse a string';
