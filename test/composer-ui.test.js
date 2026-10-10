import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enhance } from '../extension/src/engine.js';
import {
  INITIAL_ASSIST,
  afterLevelChange,
  canInsert,
  placeAnchor,
  reduceAssist,
} from '../extension/src/composer-ui.js';

test('the mark sits in the field and opens upward when the composer is low', () => {
  const placed = placeAnchor(
    { top: 700, right: 900, bottom: 780, left: 400 },
    { width: 1000, height: 800 },
  );
  assert.equal(placed.left, 848);
  assert.equal(placed.top, 710);
  assert.equal(placed.opensUp, true);
  assert.equal(placed.alignEnd, true);
});

test('the card grows to the right when the field is near the left edge', () => {
  const placed = placeAnchor(
    { top: 120, right: 80, bottom: 200, left: 20 },
    { width: 1000, height: 800 },
  );
  assert.equal(placed.alignEnd, false);
  assert.equal(placed.opensUp, false);
  assert.ok(placed.left >= 8);
});

test('rewrite waits for a draft and does not insert by itself', () => {
  const opened = reduceAssist(INITIAL_ASSIST, { type: 'toggle' }, enhance);
  assert.equal(opened.open, true);
  assert.equal(opened.phase, 'choose');
  assert.equal(canInsert(opened), false);

  const empty = reduceAssist(opened, { type: 'rewrite', draft: '   ' }, enhance);
  assert.equal(empty.status, 'empty');
  assert.equal(empty.improved, '');
  assert.equal(canInsert(empty), false);

  const ready = reduceAssist(
    opened,
    { type: 'rewrite', draft: 'pls write a py function to reverse a string' },
    enhance,
  );
  assert.equal(ready.phase, 'result');
  assert.match(ready.improved, /Python/);
  assert.doesNotMatch(ready.improved, /React|budget|audience/i);
  assert.equal(canInsert(ready), true);
  assert.equal(afterLevelChange(ready), 'rewrite');
  assert.equal(afterLevelChange(opened), 'stay');

  const closed = reduceAssist(ready, { type: 'close' }, enhance);
  assert.deepEqual(closed, INITIAL_ASSIST);
  assert.equal(canInsert(closed), false);
});

test('an unknown level is ignored and insert clears the card', () => {
  const opened = reduceAssist(INITIAL_ASSIST, { type: 'toggle' }, enhance);
  const same = reduceAssist(opened, { type: 'level', level: 'nope' }, enhance);
  assert.equal(same.level, 'detailed');
  const expert = reduceAssist(opened, { type: 'level', level: 'expert' }, enhance);
  const ready = reduceAssist(expert, { type: 'rewrite', draft: 'help' }, enhance);
  assert.equal(ready.level, 'expert');
  assert.match(ready.improved, /Open question:/);
  assert.deepEqual(reduceAssist(ready, { type: 'inserted' }, enhance), INITIAL_ASSIST);
});

test('the content script is the ChatGPT entry and the card offers insert', () => {
  const entry = readFileSync(new URL('../extension/src/composer-button.js', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../extension/src/composer-ui.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../extension/composer/styles.js', import.meta.url), 'utf8');
  assert.match(entry, /startComposerButton/);
  assert.match(entry, /writePromptField/);
  assert.match(ui, /Insert into field/);
  assert.match(ui, /Keep original/);
  assert.match(ui, /aria-label="Polish this prompt"/);
  assert.match(css, /@keyframes pp-float/);
  assert.match(css, /@keyframes pp-panel/);
  assert.match(css, /prefers-reduced-motion/);
});
