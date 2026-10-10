import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHATGPT_HOSTS,
  LAUNCHER_SIZE,
  anchorControl,
  panelOpensUp,
  placePanel,
  rectsOverlap,
} from '../extension/src/composer-anchor.js';
import {
  NOTICES,
  completeRewrite,
  createSession,
  dismiss,
  editImproved,
  openChooser,
  planInsert,
  requestRewrite,
} from '../extension/src/chatgpt-flow.js';
import { PANEL_CSS } from '../extension/src/chatgpt-styles.js';
import { fieldTextMatches } from '../extension/src/page-field.js';

const viewport = { width: 1280, height: 800 };
const composer = { top: 700, left: 340, right: 940, bottom: 780 };
const send = { top: 732, left: 880, right: 924, bottom: 768 };

test('launcher sits on the composer and clears a bottom-corner send button', () => {
  const alone = anchorControl({ composer, viewport });
  assert.equal(alone.visible, true);
  assert.ok(alone.top >= composer.top);
  assert.ok(alone.top < composer.top + 24);
  assert.ok(alone.left + LAUNCHER_SIZE <= composer.right);
  assert.ok(alone.left > composer.left);

  const placed = anchorControl({ composer, send, viewport });
  assert.equal(placed.visible, true);
  assert.equal(placed.clearsSend, true);
  const icon = { top: placed.top, left: placed.left, right: placed.left + LAUNCHER_SIZE, bottom: placed.top + LAUNCHER_SIZE };
  assert.equal(rectsOverlap(icon, send), false);
});

test('launcher hides when the composer is off screen or too small', () => {
  assert.equal(anchorControl({
    composer: { top: -120, left: 340, right: 940, bottom: -40 },
    viewport,
  }).visible, false);
  assert.equal(anchorControl({
    composer: { top: 860, left: 340, right: 940, bottom: 940 },
    viewport,
  }).visible, false);
  assert.equal(anchorControl({
    composer: { top: 700, left: 340, right: 400, bottom: 780 },
    viewport,
  }).visible, false);
});

test('panel opens upward from a low composer and stays off the send button', () => {
  const icon = anchorControl({ composer, send, viewport });
  assert.equal(panelOpensUp({ anchorTop: icon.top }), true);
  const panel = placePanel({
    icon: { left: icon.left, top: icon.top, width: LAUNCHER_SIZE, height: LAUNCHER_SIZE },
    send,
    viewport,
  });
  assert.equal(panel.opensUp, true);
  assert.equal(panel.clearsSend, true);
  assert.ok(panel.top >= 8);
  assert.ok(panel.left >= 8);
  assert.ok(panel.left + panel.width <= viewport.width);
});

test('panel moves aside when opening downward would cover send', () => {
  const icon = { left: 700, top: 40, width: 36, height: 36 };
  const lowSend = { top: 88, left: 690, right: 730, bottom: 120 };
  assert.equal(panelOpensUp({ anchorTop: icon.top }), false);
  const panel = placePanel({ icon, send: lowSend, viewport, panelHeight: 360 });
  assert.equal(panel.opensUp, false);
  assert.equal(panel.clearsSend, true);
});

test('in-page insert writes the edited prompt and never sends', () => {
  let session = openChooser(createSession());
  session = requestRewrite(session, 'pls fix my py code it dont work when list empty', 'detailed');
  assert.equal(session.phase, 'rewriting');
  session = completeRewrite(session, 'pls fix my py code it dont work when list empty');
  assert.equal(session.taskLabel, 'Debugging');
  assert.match(session.improved, /Python/);
  assert.doesNotMatch(session.improved, /React/);
  assert.ok(session.openQuestions.length >= 1);

  session = editImproved(session, `${session.improved}\nOpen question: Which file?`);
  assert.ok(session.openQuestions.some((item) => item.includes('Which file?')));
  const plan = planInsert(session);
  assert.equal(plan.write, true);
  assert.equal(plan.send, false);
  assert.match(plan.text, /Which file\?/);

  const closed = dismiss(session);
  assert.equal(closed.phase, 'closed');
  assert.equal(planInsert(closed).write, false);
  assert.equal(planInsert(closed).send, false);
});

test('empty composer and unknown level do not invent a prompt', () => {
  const empty = requestRewrite(createSession(), '   ', 'expert');
  assert.equal(empty.phase, 'result');
  assert.equal(empty.improved, '');
  assert.equal(empty.notice, NOTICES.empty);
  assert.equal(planInsert(empty).write, false);

  const unknown = requestRewrite(openChooser(createSession()), 'build me an app', 'ultra');
  assert.equal(unknown.phase, 'choosing');
  assert.equal(unknown.improved, '');
});

test('field text match is exact for textareas and loose for contenteditable', () => {
  assert.equal(fieldTextMatches('Hello', 'Hello', 'textarea'), true);
  assert.equal(fieldTextMatches('Hello ', 'Hello', 'textarea'), false);
  assert.equal(fieldTextMatches('Hello\nthere', 'Hello there', 'contenteditable'), true);
});

test('panel motion is defined and can be turned off', () => {
  assert.match(PANEL_CSS, /@keyframes pp-float/);
  assert.match(PANEL_CSS, /@keyframes pp-spark/);
  assert.match(PANEL_CSS, /@keyframes pp-open/);
  assert.match(PANEL_CSS, /@keyframes pp-sweep/);
  assert.match(PANEL_CSS, /\.launcher:hover/);
  assert.match(PANEL_CSS, /prefers-reduced-motion:\s*reduce/);
});

test('ChatGPT content script reuses the engine and does not send', () => {
  const content = readFileSync(new URL('../extension/src/chatgpt-content.js', import.meta.url), 'utf8');
  const flow = readFileSync(new URL('../extension/src/chatgpt-flow.js', import.meta.url), 'utf8');
  assert.match(content, /from '\.\/engine\.js'/);
  assert.match(flow, /from '\.\/engine\.js'/);
  assert.match(content, /document\.documentElement\.appendChild/);
  assert.match(content, /Polish this prompt/);
  assert.match(content, /stopPropagation/);
  assert.doesNotMatch(content, /requestSubmit|\.submit\(/);
  assert.doesNotMatch(content, /new KeyboardEvent/);
  assert.doesNotMatch(flow, /send:\s*true/);
  assert.deepEqual(CHATGPT_HOSTS, ['chatgpt.com', 'chat.openai.com']);
  assert.equal(content.includes('claude.ai'), false);
  assert.equal(content.includes('gemini.google.com'), false);
});
