# Evaluation

PromptPolish v1 is checked with rules, not with another model. The rewriter is deterministic, so the same draft always produces the same prompt, and a failure points at a specific rule.

## Dataset

`eval/dataset.json` is a list of rough prompts. Each item has:

- `task` — coding, debugging, research, writing, learning, building, or general
- `mustInclude` — phrases from the draft that the rewrite has to keep (matched case-insensitively)
- `mustNotInclude` — specifics the draft did not ask for, such as a framework, a budget, a brand, or an extra algorithm
- `openQuestion` and `assumption` — whether that level should or should not add those markers

Every task type is in the file. Tricky intent cases are in there too: a vague “build me an app,” “research the best laptop,” a negation (`don't use sort`), a quoted API name with a number, and a fenced Python snippet that must be copied through unchanged.

## What the eval checks

`eval/run-eval.js` runs every item at Quick Fix, Detailed, and Expert.

1. **Task.** `detectTask` matches the label.
2. **Intent preserved.** Each `mustInclude` phrase is still in the improved prompt.
3. **Nothing unsupported was added.** A `mustNotInclude` phrase fails the check when it shows up as its own word or token and the draft did not already contain it. `Java` does not match inside `JavaScript`.
4. **Growth has a budget.** The improved prompt may be longer than the trimmed draft by at most 120 characters (Quick Fix), 800 (Detailed), or 1200 (Expert). Those numbers are `GROWTH_BUDGET` in `extension/src/engine.js`. Quick Fix is wording only, so its budget is small. Detailed and Expert spend the budget on a fixed scaffold, extracted constraints, and `Assumption:` / `Open question:` lines — not on a second copy of the draft.
5. **Shape.** Quick Fix must not grow scaffold headings. Detailed must include the request, the stated constraints, and the implied-scope line. Expert must include the objective, edge cases, and expected output.
6. **Markers.** If the label says an open question or an assumption is required, the rewrite has one. If the label says it is not, the rewrite does not invent one.

A language named only by unambiguous code (`def` for Python, `console.log` for JavaScript, and the other syntax rules in the engine) counts as present in the draft. Detailed and Expert may name that language in the technologies line. Quick Fix leaves the code as written and does not add the language name. A language the draft never showed still fails `mustNotInclude`.

## How to run it

```bash
npm test
npm run eval
```

`npm test` includes this eval. `npm run eval` prints each failure with the improved prompt. Any failed check exits non-zero.

This does not score style. A rewrite can pass and still be something you want to edit. The popup keeps the improved prompt editable for that reason.
