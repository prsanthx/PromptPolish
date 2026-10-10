(() => {
  // extension/src/engine.js
  var LEVELS = [
    {
      id: "quick",
      label: "Quick Fix",
      description: "Correct and clarify wording only."
    },
    {
      id: "detailed",
      label: "Detailed",
      description: "Add implied context and constraints, without new facts."
    },
    {
      id: "expert",
      label: "Expert",
      description: "Structure objectives, requirements, edge cases, and expected output."
    }
  ];
  var TASK_LABELS = {
    coding: "Coding",
    debugging: "Debugging",
    research: "Research",
    writing: "Writing",
    learning: "Learning",
    building: "Building a project",
    general: "General"
  };
  var IMPLIED_SCOPE = {
    coding: "Solve the request as written. Do not add features, libraries, or languages it does not name.",
    debugging: "Limit the fix to the failure described. Do not rewrite behavior that was not reported as broken.",
    research: "Answer the question that was asked. Do not widen the topic or invent sources.",
    writing: "Produce only the text that was requested. Do not invent an audience, a tone, or extra sections.",
    learning: "Explain only the stated topic. Do not expand this into a full course.",
    building: "Build or plan only what the request describes. Do not choose a stack that was not named.",
    general: "Respond to the request as written. Do not add a goal that is not there."
  };
  var TECH_RULES = [
    ["Python", /(?<![\w.])py(?![\w])|\bpython\b|\bdef \w+\s*\(/i],
    ["JavaScript", /(?<![\w.])js(?![\w])|\bjavascript\b|\bconsole\.log\b|\bdocument\./i],
    ["TypeScript", /(?<![\w.])ts(?![\w])|\btypescript\b/i],
    ["Java", /\bjava\b|\bSystem\.out\b|\bpublic static void\b/i],
    ["Rust", /\brust\b|\bfn main\b|\bprintln!/i],
    ["Go", /\bgolang\b|\bpackage main\b|\bfmt\./i],
    ["C++", /\bc\+\+/i],
    ["C#", /\bc#/i],
    ["Ruby", /\bruby\b/i],
    ["PHP", /\bphp\b/i],
    ["Kotlin", /\bkotlin\b/i],
    ["Swift", /\bswift\b/i],
    ["SQL", /\bsql\b/i],
    ["HTML", /\bhtml\b/i],
    ["CSS", /\bcss\b/i],
    ["React", /\breact\b/i],
    ["Vue", /\bvue\b/i],
    ["Angular", /\bangular\b/i],
    ["Node.js", /\bnode\.?js\b|\bnpm\b/i],
    ["Docker", /\bdocker\b/i],
    ["Kubernetes", /\bkubernetes\b|\bk8s\b/i]
  ];
  var PROTECTED = /```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s]+|"[^"\n]*"/g;
  var YOU_NEXT_BLOCK = /* @__PURE__ */ new Set(["shaped", "turn", "boat", "value", "lock", "tube", "haul"]);
  var YOU_PREV = /* @__PURE__ */ new Set([
    "can",
    "could",
    "would",
    "should",
    "will",
    "please",
    "help",
    "if",
    "when",
    "for",
    "to",
    "with",
    "and",
    "or",
    "do",
    "did",
    "are",
    "thank"
  ]);
  var YOU_NEXT = /* @__PURE__ */ new Set(["can", "could", "should", "want", "need", "have", "are", "know", "think"]);
  var NOT_AUDIENCE = /* @__PURE__ */ new Set([
    "code",
    "app",
    "project",
    "function",
    "bug",
    "script",
    "program",
    "list",
    "api",
    "assignment",
    "prompt",
    "error",
    "class",
    "course",
    "paper"
  ]);
  function mapPlain(text, fn) {
    let out = "";
    let last = 0;
    for (const match of text.matchAll(PROTECTED)) {
      out += fn(text.slice(last, match.index));
      out += match[0];
      last = match.index + match[0].length;
    }
    out += fn(text.slice(last));
    return out;
  }
  function protectedRanges(text) {
    const ranges = [];
    for (const match of text.matchAll(PROTECTED)) {
      ranges.push([match.index, match.index + match[0].length]);
    }
    return ranges;
  }
  function insideProtected(index, ranges) {
    return ranges.some(([start, end]) => index >= start && index < end);
  }
  function replacePronounYou(text) {
    return text.replace(/\bu\b/gi, (match, offset, str) => {
      const after = str.slice(offset + match.length).match(/^\s+(\w+)/);
      const next = after?.[1]?.toLowerCase();
      if (next && YOU_NEXT_BLOCK.has(next)) return match;
      const before = str.slice(0, offset).match(/(\w+)\s+$/);
      const prev = before?.[1]?.toLowerCase();
      const atStart = offset === 0 || /^\s*$/.test(str.slice(0, offset));
      if (atStart || prev && YOU_PREV.has(prev) || next && YOU_NEXT.has(next)) {
        return match[0] === "U" ? "You" : "you";
      }
      return match;
    });
  }
  function replaceLanguageAbbrevs(text) {
    const map = { py: "Python", js: "JavaScript", ts: "TypeScript" };
    return text.replace(/(?<![\w.])(py|js|ts)(?![\w])/gi, (match) => map[match.toLowerCase()]);
  }
  function replacePronounI(text) {
    return text.replace(/(?<![\w])i(?![\w])/g, (match, offset, str) => {
      if (/^i\.e\b/i.test(str.slice(offset))) return match;
      return "I";
    });
  }
  function cleanupWording(text) {
    const normalized = String(text ?? "").replace(/\r\n/g, "\n");
    let cleaned = mapPlain(normalized, (plain) => {
      let segment = plain.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n");
      segment = segment.replace(/\bit dont\b/gi, "it doesn't");
      segment = segment.replace(/\bit don't\b/gi, "it doesn't");
      segment = segment.replace(/\bpls\b/gi, "please");
      segment = segment.replace(/\bplz\b/gi, "please");
      segment = segment.replace(/\bidk\b/gi, "I don't know");
      segment = segment.replace(/\basap\b/gi, "as soon as possible");
      segment = segment.replace(/\bwanna\b/gi, "want to");
      segment = segment.replace(/\bgonna\b/gi, "going to");
      segment = segment.replace(/\bkinda\b/gi, "kind of");
      segment = segment.replace(/\bcuz\b/gi, "because");
      segment = segment.replace(/\bb\/c\b/gi, "because");
      segment = segment.replace(/\bbc\b/gi, "because");
      segment = segment.replace(/\btho\b/gi, "though");
      segment = segment.replace(/\bw\/\s/g, "with ");
      segment = segment.replace(/\bdoesnt\b/gi, "doesn't");
      segment = segment.replace(/\bdont\b/gi, "don't");
      segment = segment.replace(/\bcant\b/gi, "can't");
      segment = segment.replace(/\bwont\b/gi, "won't");
      segment = segment.replace(/\bisnt\b/gi, "isn't");
      segment = segment.replace(/\barent\b/gi, "aren't");
      segment = segment.replace(/\bwasnt\b/gi, "wasn't");
      segment = segment.replace(/\bdidnt\b/gi, "didn't");
      segment = segment.replace(/\bwouldnt\b/gi, "wouldn't");
      segment = segment.replace(/\bcouldnt\b/gi, "couldn't");
      segment = segment.replace(/\bshouldnt\b/gi, "shouldn't");
      segment = segment.replace(/\bim\b/gi, "I'm");
      segment = segment.replace(/\bive\b/gi, "I've");
      segment = segment.replace(/\bur\b/gi, "your");
      segment = replacePronounYou(segment);
      segment = replaceLanguageAbbrevs(segment);
      segment = replacePronounI(segment);
      segment = segment.replace(
        /([a-z0-9])\s+(it doesn't|it does|this doesn't)\b/gi,
        (_match, prev, next) => `${prev}. ${next[0].toUpperCase()}${next.slice(1)}`
      );
      return segment;
    });
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
    const ranges = protectedRanges(cleaned);
    cleaned = cleaned.replace(/(^|[.?!]\s+)([a-z])/g, (match, lead, ch, offset) => {
      if (insideProtected(offset, ranges)) return match;
      const prior = cleaned.slice(0, offset);
      if (/(?:^|\s)[A-Za-z]\.$/.test(prior) || /(?:^|\s)[A-Za-z]\.[A-Za-z]\.$/.test(prior)) {
        return match;
      }
      return lead + ch.toUpperCase();
    });
    if (!cleaned || /[.?!]$/.test(cleaned) || /```$/.test(cleaned)) return cleaned;
    const firstWord = cleaned.split(/\s+/)[0]?.toLowerCase() ?? "";
    const questionWords = /* @__PURE__ */ new Set([
      "how",
      "what",
      "why",
      "when",
      "where",
      "who",
      "is",
      "are",
      "can",
      "could",
      "should",
      "do",
      "does",
      "did"
    ]);
    return cleaned + (questionWords.has(firstWord) ? "?" : ".");
  }
  function detectTask(text) {
    const raw = String(text ?? "");
    if (!raw.trim()) return "general";
    const teachDebug = /\b(teach me|learn to|explain how to)\b[\s\S]{0,60}\bdebug/i.test(raw);
    const hasBug = /\b(error|exception|traceback|stack trace|typeerror|referenceerror|syntaxerror|crash(?:es|ed|ing)?|doesn'?t work|dont work|not working|isn'?t working|broken|bug)\b/i.test(raw) || /\bfix (this|my|the)\b/i.test(raw) || /\bdebug (this|my|the)\b/i.test(raw);
    if (hasBug && !teachDebug) return "debugging";
    const hasTeach = /\b(explain|teach me|teach|learn|tutorial|eli5|help me understand|understand)\b/i.test(raw) || /\bhow (?:does|do)\b[\s\S]{0,40}\bwork/i.test(raw) || /\bwhat (?:is|are)\b/i.test(raw);
    if (hasTeach) return "learning";
    if (/\b(build|scaffold|mvp|from scratch)\b/i.test(raw) && /\b(app|application|website|web app|side project|project|product|tool|cli)\b/i.test(raw)) {
      return "building";
    }
    if (/\b(email|essay|blog(?:\s+post)?|story|poem|cover letter|resume|article|paragraph|report)\b/i.test(raw)) {
      return "writing";
    }
    if (/^\s*(please\s+)?write\b/i.test(raw) && !/\b(function|script|class|algorithm|code|program|regex|sql|api)\b/i.test(raw)) {
      return "writing";
    }
    if (/\b(research|survey|literature|sources?|evidence|compare|comparison|pros and cons|trade-?offs?|paper|study|studies)\b/i.test(raw)) {
      return "research";
    }
    if (/\b(function|method|algorithm|refactor|implement|script|regex|sql|api|code|program|snippet|python|javascript|typescript|java|golang|rust|ruby|php|kotlin|swift|component)\b/i.test(raw) || /\b(c\+\+|c#)\b/i.test(raw) || /(?<![\w.])(py|js|ts)(?![\w])/i.test(raw) || /\bdef \w+\s*\(/.test(raw) || /\bconsole\.log\b/.test(raw)) {
      return "coding";
    }
    return "general";
  }
  function plainText(text) {
    return text.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]+`/g, " ");
  }
  function splitSentences(text) {
    return plainText(text).split(/\n+|(?<=[.?!])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  }
  function normalizeKey(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function extractTechnologies(text) {
    const found = [];
    for (const [name, pattern] of TECH_RULES) {
      if (pattern.test(text)) found.push(name);
    }
    return found;
  }
  function extractConstraints(text) {
    return splitSentences(text).filter((sentence) => /\b(must|should|need to|needs to|don't|do not|never|only|without|avoid|at most|no more than|under \d)\b/i.test(sentence));
  }
  function extractConditions(text) {
    const conditions = [];
    const source = plainText(text);
    for (const match of source.matchAll(/\b(?:when|if|unless)\b(?!\s+you\b)[^.\n?!]{0,140}/gi)) {
      const clause = match[0].replace(/\s+/g, " ").trim();
      if (clause.split(/\s+/).length >= 3) conditions.push(clause);
    }
    return conditions;
  }
  function extractAudience(text) {
    const known = text.match(/\b(?:to|for)\s+(?:(?:my|our|a|an|the)\s+)?(professor|teacher|recruiter|manager|team|beginners|students|kids|children|developers|users|customers|client|mom|boss)\b/i);
    if (known) return known[0];
    const generic = text.match(/\b(?:to|for)\s+my\s+([a-z]+)\b/i);
    if (generic && !NOT_AUDIENCE.has(generic[1].toLowerCase())) return generic[0];
    return null;
  }
  function extractTone(text) {
    const match = text.match(/\b(formal|informal|casual|friendly|professional|polite|academic|concise|funny|serious|warm)\b/i);
    return match ? match[1] : null;
  }
  function hasExperienceLevel(text) {
    return /\b(beginner|beginners|advanced|expert|senior|junior|eli5|5th grade|kids|children)\b/i.test(text) || /\b(i'm|im|i am)\s+new\b/i.test(text) || /\blike i'm new\b/i.test(text) || /\blike i'm 5\b/i.test(text);
  }
  function hasCodeArtifact(text) {
    return /```[\s\S]*?```/.test(text) || /`[^`\n]+`/.test(text) || /\bdef \w+\s*\(/.test(text) || /\bconsole\.log\b/.test(text) || /\bfunction\s+\w+\s*\(/.test(text) || /\bpublic static void\b/.test(text);
  }
  function hasErrorArtifact(text) {
    return /\b(typeerror|referenceerror|syntaxerror|traceback|stack trace|exception|errno|segfault)\b/i.test(text);
  }
  function extractOutputFormat(text, task) {
    if (/\bjson\b/i.test(text)) return "JSON, as requested.";
    if (/\bmarkdown\b/i.test(text)) return "Markdown, as requested.";
    if (/\bbullets?\b/i.test(text)) return "A bullet list, as requested.";
    if (/\btable\b/i.test(text)) return "A table, as requested.";
    if (task === "writing" && /\bemail\b/i.test(text)) return "An email, as requested.";
    if (task === "coding" && /\bfunction\b/i.test(text)) return "A function, as requested.";
    if (task === "coding" && /\b(script|program)\b/i.test(text)) return "Code, as requested.";
    if (task === "writing" && /\b(essay|blog|story|poem|paragraph|article|report|cover letter|resume)\b/i.test(text)) {
      return "The written piece named in the objective.";
    }
    return null;
  }
  function keepShortExtracts(cleaned, items, limit) {
    const base = normalizeKey(cleaned);
    const kept = [];
    for (const item of items) {
      const key = normalizeKey(item);
      if (!key || key === base) continue;
      if (base.includes(key) && key.length > base.length * 0.7) continue;
      kept.push(item.replace(/\s+/g, " ").trim());
      if (kept.length === limit) break;
    }
    return kept;
  }
  function constraintBlock(cleaned, constraints) {
    const kept = keepShortExtracts(cleaned, constraints, 3);
    if (!kept.length) return "- None beyond the request itself.";
    return kept.map((item) => `- ${item}`).join("\n");
  }
  function wordCount(text) {
    return plainText(text).trim().split(/\s+/).filter(Boolean).length;
  }
  function buildingIsVague(text) {
    const stripped = plainText(text).toLowerCase().replace(/\b(please|build|me|a|an|the|small|simple|from|scratch|app|application|website|web|project|mvp|tool|cli)\b/g, " ").replace(/[^a-z\s]/g, " ").trim();
    return stripped.split(/\s+/).filter(Boolean).length === 0;
  }
  function writingTopicIsVague(text) {
    return /\bwrite something\b|\bsomething nice\b|\bwrite a thing\b/i.test(text);
  }
  function isNonRequest(cleaned) {
    const bare = cleaned.toLowerCase().replace(/[.?!]+$/g, "").trim();
    return /^(help|please|please help|i don't know|hey|hi|hello|yo|sup|test)( there)?$/.test(bare);
  }
  function essentialQuestions(task, signals) {
    const questions = [];
    if (task === "debugging") {
      if (!signals.hasCode && !signals.hasError) {
        questions.push("No code or error message was included. What is the exact failure output?");
      } else if (!signals.hasCode) {
        questions.push("No code was included. Which lines are involved?");
      } else if (!signals.hasError) {
        questions.push("No error message was included. What does the failure look like?");
      }
    }
    if (task === "coding" && signals.technologies.length === 0) {
      questions.push("Which language or environment should the solution use? None was named.");
    }
    if (task === "building" && signals.technologies.length === 0) {
      questions.push("Which platform or technologies are in scope? None were named.");
    }
    if (task === "building" && signals.vagueBuild) {
      questions.push("What should it do? The request does not describe the behavior.");
    }
    if (task === "writing" && !signals.audience && !signals.tone) {
      questions.push("Who is the reader, and what tone should the text use? Neither was named.");
    } else if (task === "writing" && !signals.audience) {
      questions.push("Who is the reader? None was named.");
    } else if (task === "writing" && !signals.tone) {
      questions.push("What tone should the text use? None was named.");
    }
    if (task === "writing" && signals.vagueWriting) {
      questions.push("What should the text be about? The request does not say.");
    }
    if (task === "research" && signals.vagueResearch) {
      questions.push("What criteria should the answer be judged by? None were stated.");
    }
    if (task === "general" && signals.words < 6) {
      questions.push("What outcome do you want? The request does not say.");
    }
    return questions.slice(0, 4);
  }
  function assumptionsFor(task, signals) {
    if (task === "learning" && !signals.experience) {
      return ["No experience level was stated, so the explanation should stay plain and define its terms."];
    }
    return [];
  }
  function collectSignals(original, cleaned) {
    const task = detectTask(original);
    const technologies = extractTechnologies(`${original}
${cleaned}`);
    return {
      task,
      technologies,
      constraints: extractConstraints(cleaned),
      conditions: extractConditions(cleaned),
      audience: extractAudience(cleaned),
      tone: extractTone(cleaned),
      experience: hasExperienceLevel(`${original}
${cleaned}`),
      hasCode: hasCodeArtifact(original) || hasCodeArtifact(cleaned),
      hasError: hasErrorArtifact(original) || hasErrorArtifact(cleaned),
      outputFormat: extractOutputFormat(cleaned, task),
      vagueBuild: buildingIsVague(cleaned),
      vagueWriting: writingTopicIsVague(cleaned),
      vagueResearch: /\bbest\b/i.test(cleaned) && !/\b(criteria|compare|vs\.?|versus|pros and cons)\b/i.test(cleaned),
      words: wordCount(cleaned)
    };
  }
  function techLine(technologies) {
    if (!technologies.length) return "";
    return `Technologies named in the request: ${technologies.join(", ")}.`;
  }
  function renderQuick(cleaned) {
    if (!isNonRequest(cleaned)) return cleaned;
    return `${cleaned}

Open question: What do you want done? The draft does not say.`;
  }
  function renderDetailed(cleaned, signals) {
    const lines = [
      `Task: ${TASK_LABELS[signals.task]}`,
      "",
      "Request:",
      cleaned,
      "",
      "Constraints stated in the request:",
      constraintBlock(cleaned, signals.constraints)
    ];
    const technologies = techLine(signals.technologies);
    if (technologies) lines.push("", technologies);
    lines.push("", "Implied scope:", `- ${IMPLIED_SCOPE[signals.task]}`);
    for (const assumption of assumptionsFor(signals.task, signals)) {
      lines.push("", `Assumption: ${assumption}`);
    }
    for (const question of essentialQuestions(signals.task, signals)) {
      lines.push("", `Open question: ${question}`);
    }
    return lines.join("\n");
  }
  function renderExpert(cleaned, signals) {
    const lines = [
      `Task: ${TASK_LABELS[signals.task]}`,
      "",
      "Objective:",
      cleaned,
      "",
      "Constraints stated in the request:",
      constraintBlock(cleaned, signals.constraints)
    ];
    const technologies = techLine(signals.technologies);
    if (technologies) lines.push("", technologies);
    lines.push("", "Edge cases:");
    const conditions = keepShortExtracts(cleaned, signals.conditions, 3);
    if (conditions.length) {
      for (const condition of conditions) lines.push(`- Named in the request: ${condition}`);
    } else {
      lines.push("Open question: Which edge cases matter? None were named in the request.");
    }
    lines.push("", "Expected output:");
    if (signals.outputFormat) lines.push(signals.outputFormat);
    else lines.push("Open question: What output format do you want? None was specified.");
    lines.push("", "Implied scope:", `- ${IMPLIED_SCOPE[signals.task]}`);
    for (const assumption of assumptionsFor(signals.task, signals)) {
      lines.push("", `Assumption: ${assumption}`);
    }
    for (const question of essentialQuestions(signals.task, signals)) {
      lines.push("", `Open question: ${question}`);
    }
    return lines.join("\n");
  }
  function parseMarkers(text) {
    const assumptions = [];
    const openQuestions = [];
    for (const line of String(text ?? "").split("\n")) {
      if (line.startsWith("Assumption:")) assumptions.push(line.slice("Assumption:".length).trim());
      if (line.startsWith("Open question:")) openQuestions.push(line.slice("Open question:".length).trim());
    }
    return { assumptions, openQuestions };
  }
  function enhance(input, level = "detailed") {
    if (!LEVELS.some((item) => item.id === level)) {
      throw new Error(`Unknown level: ${level}`);
    }
    const original = String(input ?? "").replace(/\r\n/g, "\n");
    const task = detectTask(original);
    const cleaned = cleanupWording(original);
    if (!cleaned) {
      return {
        original,
        improved: "",
        task,
        taskLabel: TASK_LABELS[task],
        level,
        assumptions: [],
        openQuestions: []
      };
    }
    let improved;
    if (level === "quick") improved = renderQuick(cleaned);
    else {
      const signals = collectSignals(original, cleaned);
      improved = level === "detailed" ? renderDetailed(cleaned, signals) : renderExpert(cleaned, signals);
    }
    const markers = parseMarkers(improved);
    return {
      original,
      improved,
      task,
      taskLabel: TASK_LABELS[task],
      level,
      assumptions: markers.assumptions,
      openQuestions: markers.openQuestions
    };
  }

  // extension/src/page-field.js
  var SITE_RULES = [
    {
      id: "chatgpt",
      label: "ChatGPT",
      hosts: ["chatgpt.com", "chat.openai.com"],
      selectors: [
        "#prompt-textarea",
        "div#prompt-textarea",
        '[data-testid="prompt-textarea"]',
        "#mobile-composer-prompt",
        'textarea[name="prompt"]',
        'textarea[data-id="root"]'
      ]
    },
    {
      id: "claude",
      label: "Claude",
      hosts: ["claude.ai"],
      selectors: [
        'div.ProseMirror[contenteditable="true"]',
        'fieldset [contenteditable="true"]',
        'div[contenteditable="true"][aria-label*="message" i]'
      ]
    },
    {
      id: "gemini",
      label: "Gemini",
      hosts: ["gemini.google.com"],
      selectors: [
        'rich-textarea .ql-editor[contenteditable="true"]',
        'div.ql-editor[contenteditable="true"]',
        'rich-textarea div[contenteditable="true"]'
      ]
    }
  ];
  function writePromptField(selector, text) {
    const el = document.querySelector(selector);
    if (!el) return { ok: false, reason: "missing" };
    el.focus();
    const tag = el.tagName;
    if (tag === "TEXTAREA" || tag === "INPUT") {
      const proto = tag === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      if (descriptor?.set) descriptor.set.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      const verified = (el.value || "") === text;
      if (verified) el.removeAttribute("data-promptpolish-target");
      return verified ? { ok: true, verified: true } : { ok: false, reason: "not-verified" };
    }
    if (el.isContentEditable || el.getAttribute("role") === "textbox") {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
      let inserted = false;
      try {
        inserted = document.execCommand("insertText", false, text);
      } catch {
        inserted = false;
      }
      if (!inserted) {
        el.textContent = text;
        el.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          data: text,
          inputType: "insertText"
        }));
      }
      const actual = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      const expected = String(text).replace(/\s+/g, " ").trim();
      const verified = actual === expected;
      if (verified) el.removeAttribute("data-promptpolish-target");
      return verified ? { ok: true, verified: true } : { ok: false, reason: "not-verified" };
    }
    return { ok: false, reason: "unsupported" };
  }

  // extension/composer/styles.js
  var COMPOSER_CSS = `
:host {
  all: initial;
  position: fixed;
  z-index: 2147483646;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  color-scheme: light;
}
.stack {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  font-family: ui-sans-serif, "Segoe UI", sans-serif;
  color: #1c1915;
  font-size: 14px;
  line-height: 1.4;
}
.fab {
  position: absolute;
  left: 0;
  top: 0;
  width: 42px;
  height: 42px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #0f5e56;
  color: #f7fffe;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(15, 94, 86, 0.35);
  animation: pp-float 2.6s ease-in-out infinite;
}
.fab:hover { animation-play-state: paused; transform: translateY(-2px) scale(1.04); }
.fab:focus-visible { outline: 2px solid #f3d48a; outline-offset: 3px; }
.fab svg { display: block; margin: 0 auto; }
.star { transform-origin: 16px 16px; animation: pp-spin 5.5s linear infinite; }
.ring {
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  border: 2px solid rgba(243, 212, 138, 0.85);
  animation: pp-ring 2.6s ease-out infinite;
  pointer-events: none;
}
.spark {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #f3d48a;
  opacity: 0;
  pointer-events: none;
}
.fab.is-burst { animation: pp-pop 0.45s cubic-bezier(0.2, 0.8, 0.2, 1); }
.fab.is-burst .spark { animation: pp-spark 0.55s ease-out; }
.fab.is-burst .s1 { --x: -18px; --y: -16px; }
.fab.is-burst .s2 { --x: 16px; --y: -20px; }
.fab.is-burst .s3 { --x: 20px; --y: 8px; }
.panel {
  position: absolute;
  top: 52px;
  right: 0;
  width: 320px;
  max-height: min(440px, 70vh);
  overflow: auto;
  padding: 12px;
  border-radius: 16px;
  background: #fbf8f3;
  color: #1c1915;
  border: 1px solid #ddd4c6;
  box-shadow: 0 18px 50px rgba(28, 25, 21, 0.28);
  transform-origin: top right;
  animation: pp-panel 0.28s cubic-bezier(0.2, 0.9, 0.2, 1);
}
.stack.opens-up .panel {
  top: auto;
  bottom: 52px;
  transform-origin: bottom right;
}
.stack.align-start .panel { right: auto; left: 0; transform-origin: top left; }
.stack.opens-up.align-start .panel { transform-origin: bottom left; }
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.title { font-weight: 700; letter-spacing: -0.02em; }
.close, .rewrite, .insert, .keep, .level {
  font: inherit;
  cursor: pointer;
}
.close {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid #ddd4c6;
  background: #fff;
  color: #5e574c;
}
.task, .status, .hint {
  margin: 8px 0 0;
  color: #5e574c;
  font-size: 12px;
}
.levels { display: grid; gap: 6px; margin-top: 10px; }
.level {
  display: grid;
  gap: 2px;
  text-align: left;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid #ddd4c6;
  background: #fff;
  color: #1c1915;
}
.level[aria-checked="true"] {
  border-color: #0f5e56;
  background: #e5f2f0;
}
.level-name { font-weight: 700; font-size: 13px; }
.level-help { color: #5e574c; font-size: 12px; font-weight: 400; }
.rewrite, .insert, .keep {
  border-radius: 999px;
  padding: 8px 12px;
  border: 1px solid #ddd4c6;
  background: #fff;
  color: #1c1915;
}
.rewrite, .row { margin-top: 10px; }
.primary {
  background: #0f5e56;
  border-color: #0f5e56;
  color: #f7fffe;
  font-weight: 700;
}
.row { display: flex; flex-wrap: wrap; gap: 8px; }
.preview-block { margin-top: 12px; }
.label {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #5e574c;
}
.preview {
  margin: 0;
  max-height: 180px;
  overflow: auto;
  white-space: pre-wrap;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid #ddd4c6;
  background: #fff;
  font: 12px/1.45 ui-monospace, "Cascadia Code", Menlo, Consolas, monospace;
}
.markers { list-style: none; margin: 8px 0 0; padding: 0; }
.markers li { display: flex; gap: 8px; align-items: baseline; margin: 0 0 6px; font-size: 12px; }
.badge {
  flex: none;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.badge.assumption { color: #6d4a10; background: #f6e6c6; }
.badge.question { color: #1d3e66; background: #e3edf7; }
.shimmer {
  pointer-events: none;
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0;
  background: linear-gradient(110deg, transparent 30%, rgba(243, 212, 138, 0.55) 48%, transparent 62%);
  background-size: 200% 100%;
}
.panel.is-rewriting .shimmer { animation: pp-sheen 0.7s ease-in-out; }
.toast {
  position: absolute;
  top: 50px;
  right: 0;
  width: max-content;
  max-width: 240px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 999px;
  background: #0f5e56;
  color: #f7fffe;
  font-size: 12px;
  box-shadow: 0 8px 20px rgba(15, 94, 86, 0.3);
  animation: pp-panel 0.25s ease-out;
}
@keyframes pp-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes pp-spin { to { transform: rotate(360deg); } }
@keyframes pp-ring {
  0% { transform: scale(0.92); opacity: 0.8; }
  100% { transform: scale(1.25); opacity: 0; }
}
@keyframes pp-pop {
  0% { transform: scale(1); }
  40% { transform: scale(0.86); }
  100% { transform: scale(1); }
}
@keyframes pp-spark {
  0% { opacity: 1; transform: translate(0, 0) scale(1); }
  100% { opacity: 0; transform: translate(var(--x), var(--y)) scale(0.4); }
}
@keyframes pp-panel {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes pp-sheen {
  from { opacity: 1; background-position: 100% 0; }
  to { opacity: 0; background-position: 0 0; }
}
@media (prefers-reduced-motion: reduce) {
  .fab, .star, .ring, .spark, .panel, .shimmer, .toast { animation: none; }
}
`;

  // extension/src/composer-ui.js
  var BUTTON_SIZE = 42;
  var INITIAL_ASSIST = {
    open: false,
    level: "detailed",
    phase: "choose",
    improved: "",
    taskLabel: "",
    status: ""
  };
  var mountedDocs = /* @__PURE__ */ new WeakSet();
  function placeAnchor(rect, viewport) {
    const inset = 10;
    const left = clamp(rect.right - BUTTON_SIZE - inset, 8, Math.max(8, viewport.width - BUTTON_SIZE - 8));
    const top = clamp(rect.top + inset, 8, Math.max(8, viewport.height - BUTTON_SIZE - 8));
    const roomBelow = viewport.height - (top + BUTTON_SIZE + 12);
    return {
      left: Math.round(left),
      top: Math.round(top),
      opensUp: roomBelow < 340 && top > 80,
      alignEnd: left + BUTTON_SIZE > 336
    };
  }
  function reduceAssist(state, event, enhance2) {
    switch (event.type) {
      case "toggle":
        if (state.open) return { ...INITIAL_ASSIST };
        return { ...INITIAL_ASSIST, open: true };
      case "close":
        return { ...INITIAL_ASSIST };
      case "level":
        if (!LEVELS.some((item) => item.id === event.level)) return state;
        return { ...state, level: event.level };
      case "rewrite": {
        const draft = String(event.draft ?? "");
        if (!draft.trim()) {
          return { ...state, open: true, phase: "choose", improved: "", taskLabel: "", status: "empty" };
        }
        const result = enhance2(draft, state.level);
        return {
          ...state,
          open: true,
          phase: "result",
          improved: result.improved,
          taskLabel: result.taskLabel,
          level: result.level,
          status: "ready"
        };
      }
      case "inserted":
        return { ...INITIAL_ASSIST };
      default:
        return state;
    }
  }
  function afterLevelChange(state) {
    return state.phase === "result" ? "rewrite" : "stay";
  }
  function canInsert(state) {
    return Boolean(state.open && state.phase === "result" && state.improved.trim());
  }
  function mountComposerAssist(doc, options) {
    const host = doc.createElement("div");
    host.id = "promptpolish-composer";
    host.setAttribute("data-promptpolish", "composer");
    const shadow = host.attachShadow({ mode: "open" });
    const style = doc.createElement("style");
    style.textContent = COMPOSER_CSS;
    const stack = doc.createElement("div");
    stack.className = "stack";
    stack.innerHTML = panelMarkup();
    shadow.append(style, stack);
    const fab = stack.querySelector(".fab");
    const panel = stack.querySelector(".panel");
    const toast = stack.querySelector(".toast");
    const taskLine = stack.querySelector(".task");
    const statusLine = stack.querySelector(".status");
    const preview = stack.querySelector(".preview");
    const previewBlock = stack.querySelector(".preview-block");
    const markers = stack.querySelector(".markers");
    const levelButtons = [...stack.querySelectorAll(".level")];
    let state = { ...INITIAL_ASSIST };
    let composer = null;
    let sourceDraft = "";
    let revealTicket = 0;
    let toastTimer = 0;
    function placeHost() {
      if (!composer) {
        host.hidden = true;
        return;
      }
      const place = placeAnchor(anchorRect(composer), viewportOf(doc));
      host.hidden = false;
      host.style.left = `${place.left}px`;
      host.style.top = `${place.top}px`;
      stack.classList.toggle("opens-up", place.opensUp);
      stack.classList.toggle("align-start", !place.alignEnd);
    }
    function render(next) {
      state = next;
      placeHost();
      fab.setAttribute("aria-expanded", state.open ? "true" : "false");
      panel.hidden = !state.open;
      for (const button of levelButtons) {
        button.setAttribute("aria-checked", button.dataset.level === state.level ? "true" : "false");
      }
      const draft = composer ? readFieldText(composer) : "";
      if (state.status === "empty" || state.open && !draft.trim()) {
        taskLine.textContent = state.open ? "Write a prompt in the field first." : "";
      } else if (state.open && draft.trim()) {
        taskLine.textContent = `Detected task: ${TASK_LABELS[detectTask(draft)]}`;
      } else {
        taskLine.textContent = "";
      }
      previewBlock.hidden = state.phase !== "result";
      preview.textContent = state.improved;
      renderMarkers(markers, state.phase === "result" ? state.improved : "");
      if (state.status === "ready") {
        const stale = draft !== sourceDraft;
        statusLine.textContent = stale ? "The field changed. Rewrite again to refresh. Nothing is inserted yet." : `Enhanced as ${state.taskLabel}. Nothing is inserted yet.`;
      } else if (state.status === "empty") {
        statusLine.textContent = "Write a prompt in the field first.";
      } else if (state.status === "working") {
        statusLine.textContent = "Rewriting locally\u2026";
      } else if (state.status === "rejected") {
        statusLine.textContent = "The field did not keep that text. Copy it from the card or use the toolbar.";
      } else {
        statusLine.textContent = state.open ? "Pick a level, then rewrite. The field stays as it is until you insert." : "";
      }
      const insertButton = stack.querySelector(".insert");
      insertButton.disabled = !canInsert(state) || state.status === "working";
    }
    function burst() {
      fab.classList.remove("is-burst");
      void fab.offsetWidth;
      fab.classList.add("is-burst");
    }
    function openPanel() {
      burst();
      sourceDraft = "";
      render(reduceAssist(state, { type: "toggle" }));
      const chosen = stack.querySelector('.level[aria-checked="true"]');
      chosen?.focus();
    }
    function closePanel() {
      revealTicket += 1;
      panel.classList.remove("is-rewriting");
      render(reduceAssist(state, { type: "close" }));
    }
    function beginRewrite(base) {
      const draft = composer ? readFieldText(composer) : "";
      const ticket = ++revealTicket;
      panel.classList.add("is-rewriting");
      render({ ...base, open: true, phase: "choose", improved: "", status: "working" });
      const delay = prefersReducedMotion(doc) ? 0 : 460;
      doc.defaultView.setTimeout(() => {
        if (ticket !== revealTicket) return;
        panel.classList.remove("is-rewriting");
        sourceDraft = draft;
        render(reduceAssist(base, { type: "rewrite", draft }, options.enhance));
        if (canInsert(state)) stack.querySelector(".insert").focus();
      }, delay);
    }
    fab.addEventListener("animationend", (event) => {
      if (event.animationName === "pp-pop") fab.classList.remove("is-burst");
    });
    fab.addEventListener("click", () => {
      if (state.open) closePanel();
      else openPanel();
    });
    stack.querySelector(".close").addEventListener("click", closePanel);
    stack.querySelector(".keep").addEventListener("click", closePanel);
    stack.querySelector(".rewrite").addEventListener("click", () => beginRewrite(state));
    for (const button of levelButtons) {
      button.addEventListener("click", () => {
        const next = reduceAssist(state, { type: "level", level: button.dataset.level });
        if (afterLevelChange(state) === "rewrite") beginRewrite(next);
        else render(next);
      });
    }
    stack.querySelector(".insert").addEventListener("click", () => {
      if (!canInsert(state) || !composer) return;
      const written = options.writeText(composer, state.improved);
      if (written?.ok) {
        const message = "Inserted into the field.";
        closePanel();
        showToast(message);
        return;
      }
      render({ ...state, status: "rejected" });
    });
    function showToast(message) {
      toast.hidden = false;
      toast.textContent = message;
      doc.defaultView.clearTimeout(toastTimer);
      toastTimer = doc.defaultView.setTimeout(() => {
        toast.hidden = true;
        toast.textContent = "";
      }, 1600);
    }
    function onKeydown(event) {
      if (event.key !== "Escape" || !state.open) return;
      event.preventDefault();
      event.stopPropagation();
      closePanel();
    }
    function onPointerDown(event) {
      if (!state.open) return;
      const path = event.composedPath();
      if (path.includes(host)) return;
      if (composer && path.includes(composer)) return;
      closePanel();
    }
    function tick() {
      if (!host.isConnected) doc.documentElement.append(host);
      composer = findComposer(doc, options.selectors);
      placeHost();
      if (!state.open || !composer || state.status === "working") return;
      const draft = readFieldText(composer);
      if (state.phase === "result" && state.status === "ready") {
        statusLine.textContent = draft !== sourceDraft ? "The field changed. Rewrite again to refresh. Nothing is inserted yet." : `Enhanced as ${state.taskLabel}. Nothing is inserted yet.`;
        return;
      }
      taskLine.textContent = draft.trim() ? `Detected task: ${TASK_LABELS[detectTask(draft)]}` : "Write a prompt in the field first.";
    }
    doc.addEventListener("keydown", onKeydown, true);
    doc.addEventListener("pointerdown", onPointerDown, true);
    doc.addEventListener("scroll", tick, true);
    doc.defaultView.addEventListener("resize", tick);
    const observer = new MutationObserver(tick);
    observer.observe(doc.documentElement, { childList: true, subtree: true });
    const timer = doc.defaultView.setInterval(tick, 400);
    doc.documentElement.append(host);
    tick();
    return function stop() {
      revealTicket += 1;
      observer.disconnect();
      doc.defaultView.clearInterval(timer);
      doc.defaultView.clearTimeout(toastTimer);
      doc.removeEventListener("keydown", onKeydown, true);
      doc.removeEventListener("pointerdown", onPointerDown, true);
      doc.removeEventListener("scroll", tick, true);
      doc.defaultView.removeEventListener("resize", tick);
      host.remove();
    };
  }
  function startComposerButton(doc, options) {
    if (mountedDocs.has(doc)) return () => {
    };
    mountedDocs.add(doc);
    const stop = mountComposerAssist(doc, options);
    return () => {
      stop();
      mountedDocs.delete(doc);
    };
  }
  function readFieldText(el) {
    if (!el) return "";
    const tag = el.tagName;
    if (tag === "TEXTAREA" || tag === "INPUT") return el.value || "";
    return el.innerText || el.textContent || "";
  }
  function findComposer(doc, selectors) {
    let best = null;
    let bestArea = 0;
    for (const selector of selectors) {
      let nodes;
      try {
        nodes = doc.querySelectorAll(selector);
      } catch {
        continue;
      }
      for (const el of nodes) {
        if (el.closest?.("#promptpolish-composer")) continue;
        if (!shown(el)) continue;
        const rect = el.getBoundingClientRect();
        const area = Math.max(0, rect.width) * Math.max(0, rect.height);
        if (area >= bestArea) {
          best = el;
          bestArea = area;
        }
      }
    }
    return best;
  }
  function anchorRect(el) {
    const rect = el.getBoundingClientRect();
    const parent = el.parentElement;
    if (!parent || rect.height >= 64) return rect;
    const parentRect = parent.getBoundingClientRect();
    const taller = parentRect.height > rect.height && parentRect.height <= 240;
    const wider = parentRect.width >= rect.width - 8 && parentRect.width <= rect.width + 80;
    if (taller && wider && parentRect.width > 200) return parentRect;
    return rect;
  }
  function shown(el) {
    if (!el.getClientRects || el.getClientRects().length === 0) return false;
    const view = el.ownerDocument.defaultView;
    const style = view.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 40 && rect.height > 20;
  }
  function viewportOf(doc) {
    const view = doc.defaultView;
    return { width: view.innerWidth, height: view.innerHeight };
  }
  function prefersReducedMotion(doc) {
    return doc.defaultView.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  }
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
  function renderMarkers(list, text) {
    list.replaceChildren();
    const parsed = parseMarkers(text);
    const owner = list.ownerDocument;
    for (const item of parsed.assumptions) list.append(markerItem(owner, "Assumption", item, "assumption"));
    for (const item of parsed.openQuestions) list.append(markerItem(owner, "Open question", item, "question"));
    list.hidden = parsed.assumptions.length + parsed.openQuestions.length === 0;
  }
  function markerItem(owner, label, text, kind) {
    const li = owner.createElement("li");
    const badge = owner.createElement("span");
    badge.className = `badge ${kind}`;
    badge.textContent = label;
    const body = owner.createElement("span");
    body.textContent = text;
    li.append(badge, body);
    return li;
  }
  function panelMarkup() {
    const levels = LEVELS.map((level) => `
    <button type="button" class="level" role="radio" data-level="${level.id}" aria-checked="false">
      <span class="level-name">${level.label}</span>
      <span class="level-help">${level.description}</span>
    </button>
  `).join("");
    return `
    <button type="button" class="fab" aria-label="Polish this prompt" aria-haspopup="dialog" aria-expanded="false">
      <span class="ring" aria-hidden="true"></span>
      <span class="spark s1" aria-hidden="true"></span>
      <span class="spark s2" aria-hidden="true"></span>
      <span class="spark s3" aria-hidden="true"></span>
      <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
        <path class="star" d="M16 5.5l1.6 6.6 6.6 1.6-6.6 1.6L16 22.5l-1.6-6.6L7.8 13.7l6.6-1.6z" fill="#fbf8f3"/>
        <path d="M23.5 18.2l.55 2.2 2.2.55-2.2.55-.55 2.2-.55-2.2-2.2-.55 2.2-.55z" fill="#f3d48a"/>
      </svg>
    </button>
    <div class="panel" role="dialog" aria-label="Rewrite this prompt" hidden>
      <div class="shimmer" aria-hidden="true"></div>
      <div class="head">
        <span class="title">PromptPolish</span>
        <button type="button" class="close" aria-label="Close">\xD7</button>
      </div>
      <p class="task"></p>
      <div class="levels" role="radiogroup" aria-label="Level">${levels}</div>
      <button type="button" class="rewrite primary">Rewrite</button>
      <div class="preview-block" hidden>
        <p class="label">Improved prompt</p>
        <div class="preview" tabindex="0"></div>
        <ul class="markers" hidden></ul>
        <div class="row">
          <button type="button" class="insert primary">Insert into field</button>
          <button type="button" class="keep">Keep original</button>
        </div>
      </div>
      <p class="status" role="status"></p>
    </div>
    <p class="toast" role="status" hidden></p>
  `;
  }

  // extension/src/composer-button.js
  var chatgpt = SITE_RULES.find((rule) => rule.id === "chatgpt");
  startComposerButton(document, {
    selectors: chatgpt.selectors,
    enhance,
    writeText(el, text) {
      return writePromptField(selectorFor(el), text);
    }
  });
  function selectorFor(el) {
    if (el.id) {
      const idSelector = `#${CSS.escape(el.id)}`;
      if (document.querySelectorAll(idSelector).length === 1) return idSelector;
    }
    const existing = el.getAttribute("data-promptpolish-target");
    if (existing) return `[data-promptpolish-target="${CSS.escape(existing)}"]`;
    const token = `pp${Math.random().toString(36).slice(2, 10)}`;
    el.setAttribute("data-promptpolish-target", token);
    return `[data-promptpolish-target="${CSS.escape(token)}"]`;
  }
})();
