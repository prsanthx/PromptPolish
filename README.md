# PromptPolish

A free, open-source Chrome extension that turns rough thoughts into clear, detailed, actionable prompts with one click.

It runs in the browser. Rules and templates do the rewriting. There is no account, no analytics, and no network call. v1 does not call an external model. Bring-your-own API key is a follow-up, not this version.

Built for developers and students who want a clearer prompt without a tool that invents a stack, a budget, or a new goal.

## Install

1. Clone this repository.
2. Open `chrome://extensions`.
3. Turn on Developer mode.
4. Choose **Load unpacked** and select the `extension` folder (the folder that contains `manifest.json`).
5. Pin PromptPolish if you want it on the toolbar.

No build step. Reload the extension from that page after you change a file.

## Use the popup

1. Click the toolbar icon.
2. Paste or type a rough prompt. If the active tab has a prompt field, the popup reads it when it opens.
3. Check the detected task. Pick a level: Quick Fix, Detailed, or Expert.
4. Click **Enhance** (or press Ctrl+Enter).
5. Read the original next to the improved prompt. Edit the improved prompt if you want.
6. Lines marked **Assumption** or **Open question** are gaps the rewriter refused to fill in.
7. Click **Copy**. Nothing is stored.

**Clear** wipes the draft in the popup. It does not change the page.

## Insert into the page

1. Focus the prompt field, or open ChatGPT, Claude, or Gemini.
2. Click PromptPolish. Use **Read from page** if you want to read again.
3. Enhance, then edit the result if you need to.
4. Click **Insert into page**, then **Confirm insert**.

The page does not change until you confirm. If the site drops the text, the popup says so and Copy still works.

What it will read:

- The focused field, when it is a `textarea`, a prompt-like text input, or a `contenteditable` region.
- Otherwise the main composer on ChatGPT (`chatgpt.com`, `chat.openai.com`), Claude (`claude.ai`), or Gemini (`gemini.google.com`).

On any other site it does not scan the page for a random box. A focused field that is empty loses to a known composer that already has text, so a focused search box does not hide the draft you were writing.

## Privacy and permissions

The manifest asks for `activeTab` and `scripting` only.

- `activeTab` applies to the tab you are looking at, after you click the icon, and it does not last past that tab.
- `scripting` is how the popup reads and writes that tab. There is no content script on every site, and no host permission.
- Prompts are not stored. The last level is not remembered. `storage` is not used.
- There is no remote code, no API key, and no analytics endpoint.

Browser pages such as `chrome://extensions` cannot be read. Paste the prompt instead.

## How enhancement works

Detection is ordered: debugging, then learning, then building a project, then writing, then research, then coding, then general. A bug report stays a bug report. “Write a function” stays coding. “Explain how to debug” stays learning.

**Quick Fix** corrects wording: a few abbreviations (`pls`, `dont`, a standalone `py`), the pronoun “I,” and missing end punctuation. Code fences, inline code, URLs, and double-quoted strings are copied through. The only line it may add is one open question, and only when the draft is not a request at all (for example, “help”).

**Detailed** keeps that cleaned request once and adds the task, constraints the draft actually stated, technologies it actually named, one implied-scope line, and any essential gap as an `Assumption:` or an `Open question:`.

**Expert** uses the cleaned request as the objective, then states constraints, edge cases, and expected output. An edge case is listed only when the draft names a condition. Expected output is filled only when the draft already says what it is (a function, an email, JSON, and similar). Otherwise the section is an open question.

The rewriter does not invent requirements, technologies, budgets, audiences, or goals. A technology is named only when the draft names it, or when pasted code uses an unambiguous syntax (`def` for Python, `console.log` for JavaScript, and a few similar cases). The one assumption in v1 is for a learning prompt with no experience level: keep the explanation plain and define terms.

Implied scope is a limit for that task (“do not choose a stack that was not named”), not a new fact.

## Tests and eval

Node 18 or newer. No install step beyond the repository itself.

```bash
npm test
npm run eval
```

`npm test` runs the unit tests and the eval. The unit tests cover task detection, the three levels, wording cleanup, and intent protection. The eval runs the labeled dataset in `eval/dataset.json`.

How a check is decided, including the character budgets, is written in [docs/evaluation.md](docs/evaluation.md).

## Not in this version

- An external model, including bring-your-own API key
- Remembering the level you picked
- An in-page review card
- Composers other than ChatGPT, Claude, and Gemini
- Prompt history

## License

Apache License 2.0. See [LICENSE](LICENSE).
