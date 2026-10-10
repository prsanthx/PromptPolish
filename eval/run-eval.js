/**
 * Rule-based eval. No model. See docs/evaluation.md.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { enhance, GROWTH_BUDGET } from '../extension/src/engine.js';

const QUICK_HEADINGS = [
  /^Task:/m,
  /^Objective:/m,
  /^Implied scope:/m,
  /^Expected output:/m,
  /^Edge cases:/m,
  /^Constraints stated/m,
  /^Request:/m,
];

const DETAILED_HEADINGS = [
  'Task:',
  'Request:',
  'Constraints stated in the request:',
  'Implied scope:',
];

const EXPERT_HEADINGS = [
  'Task:',
  'Objective:',
  'Constraints stated in the request:',
  'Edge cases:',
  'Expected output:',
  'Implied scope:',
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasPhrase(text, phrase) {
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(phrase)}(?=$|[^a-z0-9])`, 'i');
  return pattern.test(text);
}

/**
 * @param {Array<object>} dataset
 * @param {typeof enhance} [enhanceFn]
 */
export function runEval(dataset, enhanceFn = enhance) {
  const failures = [];
  let total = 0;
  for (const item of dataset) {
    for (const level of ['quick', 'detailed', 'expert']) {
      total += 1;
      const result = enhanceFn(item.input, level);
      const problems = [];
      if (result.task !== item.task) problems.push(`task ${result.task} != ${item.task}`);
      const haystack = result.improved.toLowerCase();
      for (const phrase of item.mustInclude ?? []) {
        if (!haystack.includes(phrase.toLowerCase())) problems.push(`missing "${phrase}"`);
      }
      for (const phrase of item.mustNotInclude ?? []) {
        if (!hasPhrase(item.input, phrase) && hasPhrase(result.improved, phrase)) {
          problems.push(`added "${phrase}"`);
        }
      }
      const growth = result.improved.length - item.input.trim().length;
      if (growth > GROWTH_BUDGET[level]) {
        problems.push(`grew by ${growth}, budget ${GROWTH_BUDGET[level]}`);
      }
      if (level === 'quick') {
        for (const heading of QUICK_HEADINGS) {
          if (heading.test(result.improved) && !heading.test(item.input)) {
            problems.push(`quick added heading ${heading}`);
          }
        }
      }
      if (level === 'detailed') {
        for (const heading of DETAILED_HEADINGS) {
          if (!result.improved.includes(heading)) problems.push(`missing heading ${heading}`);
        }
        if (/^Objective:/m.test(result.improved) && !/^Objective:/m.test(item.input)) {
          problems.push('detailed used Objective:');
        }
      }
      if (level === 'expert') {
        for (const heading of EXPERT_HEADINGS) {
          if (!result.improved.includes(heading)) problems.push(`missing heading ${heading}`);
        }
      }
      const expectQuestion = item.openQuestion?.[level];
      if (expectQuestion === true && result.openQuestions.length === 0) {
        problems.push('expected an open question');
      }
      if (expectQuestion === false && result.openQuestions.length > 0) {
        problems.push(`unexpected open question: ${result.openQuestions.join(' | ')}`);
      }
      const expectAssumption = item.assumption?.[level];
      if (expectAssumption === true && result.assumptions.length === 0) {
        problems.push('expected an assumption');
      }
      if (expectAssumption === false && result.assumptions.length > 0) {
        problems.push(`unexpected assumption: ${result.assumptions.join(' | ')}`);
      }
      if (!result.improved.trim()) problems.push('empty improved prompt');
      if (problems.length) {
        failures.push({ id: item.id, level, problems, improved: result.improved });
      }
    }
  }
  return { total, failures };
}

function loadDataset() {
  return JSON.parse(readFileSync(new URL('./dataset.json', import.meta.url), 'utf8'));
}

function main() {
  const { total, failures } = runEval(loadDataset());
  if (!failures.length) {
    console.log(`eval: ${total} checks passed`);
    return;
  }
  for (const failure of failures) {
    console.error(`\n${failure.id} [${failure.level}]`);
    for (const problem of failure.problems) console.error(`  - ${problem}`);
    console.error(failure.improved);
  }
  console.error(`\neval: ${failures.length} of ${total} checks failed`);
  process.exitCode = 1;
}

const invokedDirectly = Boolean(process.argv[1])
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
