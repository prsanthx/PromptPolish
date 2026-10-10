import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GROWTH_BUDGET,
  LEVELS,
  cleanupWording,
  detectTask,
  enhance,
} from '../extension/src/engine.js';
import { runEval } from '../eval/run-eval.js';

const dataset = JSON.parse(readFileSync(new URL('../eval/dataset.json', import.meta.url), 'utf8'));

test('growth budgets stay at the documented limits', () => {
  assert.deepEqual(GROWTH_BUDGET, { quick: 120, detailed: 800, expert: 1200 });
});

test('detects each task type', () => {
  const cases = [
    ['write a python function to reverse a string', 'coding'],
    ['pls fix my py code it dont work when list empty', 'debugging'],
    ['TypeError: cannot read property map of undefined', 'debugging'],
    ['debug this function', 'debugging'],
    ['teach me how to debug python tracebacks', 'learning'],
    ['explain closures in javascript', 'learning'],
    ['how does quicksort work', 'learning'],
    ['how do I build a todo app', 'building'],
    ['build a small todo app from scratch', 'building'],
    ['build me an app', 'building'],
    ['draft an email to my professor about a late assignment', 'writing'],
    ['write a blog post about a python function', 'writing'],
    ['compare react and vue for a class assignment, with sources', 'research'],
    ['research the effects of sleep on memory', 'research'],
    ['hello there', 'general'],
    ['need thoughts on this', 'general'],
  ];
  for (const [input, task] of cases) {
    assert.equal(detectTask(input), task, input);
  }
});

test('quick fix cleans wording and leaves a clear prompt alone', () => {
  const clear = 'Write a Python function that reverses a string.';
  assert.equal(enhance(clear, 'quick').improved, clear);
  const rough = enhance('pls fix my py code it dont work when list empty', 'quick');
  assert.match(rough.improved, /Please fix my Python code/);
  assert.match(rough.improved, /doesn't work/);
  assert.doesNotMatch(rough.improved, /^Task:/m);
  assert.equal(rough.openQuestions.length, 0);
});

test('cleanup preserves code, quotes, urls, and file extensions', () => {
  const quoted = enhance('See "pls dont change" in the docs', 'quick').improved;
  assert.match(quoted, /"pls dont change"/);
  assert.match(quoted, /^See /);

  const file = enhance('Open main.py and tell me the py entry', 'quick').improved;
  assert.match(file, /main\.py/);
  assert.match(file, /Python entry/);

  const turn = enhance('can u help me with a u turn', 'quick').improved;
  assert.match(turn, /you help/);
  assert.match(turn, /u turn/);

  const fenced = [
    'look at this',
    '',
    '```',
    'pls dont touch',
    '```',
    '',
    'then more',
  ].join('\n');
  const improved = enhance(fenced, 'quick').improved;
  assert.match(improved, /```\npls dont touch\n```/);
  assert.match(improved, /^Look at this/);
});

test('levels use different scaffolds', () => {
  const input = 'write a python function that reverses a string';
  const quick = enhance(input, 'quick');
  const detailed = enhance(input, 'detailed');
  const expert = enhance(input, 'expert');
  assert.equal(quick.task, 'coding');
  assert.doesNotMatch(quick.improved, /Implied scope:/);
  assert.match(detailed.improved, /Request:/);
  assert.match(detailed.improved, /Do not add features, libraries, or languages/);
  assert.doesNotMatch(detailed.improved, /^Objective:/m);
  assert.match(expert.improved, /^Objective:/m);
  assert.match(expert.improved, /Expected output:/);
  assert.match(expert.improved, /Edge cases:/);
  assert.match(expert.improved, /A function, as requested/);
});

test('task scaffolds differ', () => {
  const coding = enhance('write a python function that reverses a string', 'detailed');
  const debugging = enhance('it crashes sometimes', 'detailed');
  assert.match(coding.improved, /Do not add features, libraries, or languages/);
  assert.match(debugging.improved, /Limit the fix to the failure described/);
  assert.match(enhance('research the effects of sleep on memory', 'detailed').improved, /Do not widen the topic/);
  assert.match(enhance('draft an email to my professor', 'detailed').improved, /Do not invent an audience/);
  assert.match(enhance('explain closures', 'detailed').improved, /Do not expand this into a full course/);
  assert.match(enhance('build a small todo app', 'detailed').improved, /Do not choose a stack/);
});

test('does not invent technologies, budgets, or audiences', () => {
  const watch = ['React', 'Vue', 'Angular', 'Kubernetes', 'Docker', 'TypeScript', 'budget', 'MacBook', 'iOS'];
  const samples = [
    'build me an app',
    'make this function faster',
    'research the best laptop',
    'write something nice',
    'it crashes sometimes',
    'need thoughts on this',
  ];
  for (const sample of samples) {
    for (const level of LEVELS.map((item) => item.id)) {
      const { improved } = enhance(sample, level);
      for (const word of watch) {
        const pattern = new RegExp(`(?:^|[^a-z0-9])${word}(?=$|[^a-z0-9])`, 'i');
        assert.equal(pattern.test(improved), false, `${level} added ${word} to "${sample}"\n${improved}`);
      }
    }
  }
});

test('preserves negations and marks missing essentials instead of filling them', () => {
  const sorted = enhance(
    "write a python function that returns the second largest number in a list. don't use sort.",
    'expert',
  );
  assert.match(sorted.improved, /don'?t use sort/i);
  assert.doesNotMatch(sorted.improved, /quicksort/i);
  assert.match(sorted.improved, /Open question:/);

  const app = enhance('build me an app', 'detailed');
  assert.match(app.improved, /Open question:/);
  assert.match(app.improved, /None were named/);
  assert.equal(app.assumptions.length, 0);

  const known = enhance("explain closures in javascript like I'm new", 'detailed');
  assert.equal(known.assumptions.length, 0);

  const lesson = enhance('explain quicksort', 'detailed');
  assert.match(lesson.improved, /Assumption:/);
  assert.match(lesson.improved, /plain/);
});

test('code syntax names a language only when the scaffold is allowed to', () => {
  const input = 'my function crashes\n\n```\ndef f(xs):\n    return xs[0]\n```\n\nTypeError when xs is empty';
  assert.doesNotMatch(enhance(input, 'quick').improved, /\bPython\b/);
  assert.match(enhance(input, 'detailed').improved, /Technologies named in the request: Python/);
  assert.match(enhance(input, 'expert').improved, /Technologies named in the request: Python/);
  assert.doesNotMatch(enhance(input, 'expert').improved, /JavaScript/);
});

test('user text is not repeated as a second full copy', () => {
  const input = 'write a python function that reverses a string and prints an example';
  for (const level of ['detailed', 'expert']) {
    const { improved } = enhance(input, level);
    const copies = improved.toLowerCase().split(input).length - 1;
    assert.equal(copies, 1, improved);
  }
});

test('empty input and unknown levels', () => {
  assert.equal(enhance('   ', 'quick').improved, '');
  assert.equal(enhance('', 'expert').task, 'general');
  assert.throws(() => enhance('hello', 'ultra'), /Unknown level/);
});

test('cleanup is stable', () => {
  const rough = 'pls  can u   fix my py code';
  assert.equal(cleanupWording(cleanupWording(rough)), cleanupWording(rough));
});

test('labeled eval passes', () => {
  const { total, failures } = runEval(dataset);
  assert.equal(
    failures.length,
    0,
    failures.map((failure) => `${failure.id} [${failure.level}] ${failure.problems.join('; ')}\n${failure.improved}`).join('\n\n'),
  );
  assert.ok(total >= dataset.length * 3);
});
