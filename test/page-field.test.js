import test from 'node:test';
import assert from 'node:assert/strict';
import { SITE_RULES, pickBestRead, siteForHost } from '../extension/src/page-field.js';

test('site rules cover the three chats and not lookalikes', () => {
  assert.equal(siteForHost('chatgpt.com')?.id, 'chatgpt');
  assert.equal(siteForHost('www.chatgpt.com')?.id, 'chatgpt');
  assert.equal(siteForHost('chat.openai.com')?.id, 'chatgpt');
  assert.equal(siteForHost('claude.ai')?.id, 'claude');
  assert.equal(siteForHost('www.claude.ai')?.id, 'claude');
  assert.equal(siteForHost('gemini.google.com')?.id, 'gemini');
  assert.equal(siteForHost('example.com'), null);
  assert.equal(siteForHost('notchatgpt.com'), null);
  assert.equal(siteForHost('evilchatgpt.com'), null);
  assert.deepEqual(
    SITE_RULES.map((rule) => rule.id),
    ['chatgpt', 'claude', 'gemini'],
  );
});

test('focused text beats a composer, and a filled composer beats an empty focus', () => {
  const composer = {
    frameId: 0,
    result: {
      ok: true,
      source: 'composer',
      text: 'draft in the composer',
      selector: '#prompt-textarea',
      site: 'chatgpt',
      area: 1000,
    },
  };
  const emptyFocus = {
    frameId: 2,
    result: {
      ok: true,
      source: 'focused',
      text: '',
      selector: 'textarea[name="search"]',
      site: null,
      area: 40,
    },
  };
  const filledFocus = {
    frameId: 2,
    result: {
      ok: true,
      source: 'focused',
      text: 'the box I clicked',
      selector: 'textarea[name="notes"]',
      site: null,
      area: 40,
    },
  };
  assert.equal(pickBestRead([composer, emptyFocus]).selector, '#prompt-textarea');
  assert.equal(pickBestRead([composer, filledFocus]).text, 'the box I clicked');
  assert.equal(pickBestRead([{ result: { ok: false } }, emptyFocus]).source, 'focused');
  assert.equal(pickBestRead([]), null);
});
