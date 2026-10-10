/**
 * Offline prompt rewriter. Rules and templates only: no network, no model.
 * The popup and the Node tests both import this file.
 */

export const LEVELS = [
  {
    id: 'quick',
    label: 'Quick Fix',
    description: 'Correct and clarify wording only.',
  },
  {
    id: 'detailed',
    label: 'Detailed',
    description: 'Add implied context and constraints, without new facts.',
  },
  {
    id: 'expert',
    label: 'Expert',
    description: 'Structure objectives, requirements, edge cases, and expected output.',
  },
];

export const TASK_LABELS = {
  coding: 'Coding',
  debugging: 'Debugging',
  research: 'Research',
  writing: 'Writing',
  learning: 'Learning',
  building: 'Building a project',
  general: 'General',
};

/** Extra characters allowed beyond the trimmed draft. The eval imports these. */
export const GROWTH_BUDGET = {
  quick: 120,
  detailed: 800,
  expert: 1200,
};

const IMPLIED_SCOPE = {
  coding: 'Solve the request as written. Do not add features, libraries, or languages it does not name.',
  debugging: 'Limit the fix to the failure described. Do not rewrite behavior that was not reported as broken.',
  research: 'Answer the question that was asked. Do not widen the topic or invent sources.',
  writing: 'Produce only the text that was requested. Do not invent an audience, a tone, or extra sections.',
  learning: 'Explain only the stated topic. Do not expand this into a full course.',
  building: 'Build or plan only what the request describes. Do not choose a stack that was not named.',
  general: 'Respond to the request as written. Do not add a goal that is not there.',
};

const TECH_RULES = [
  ['Python', /(?<![\w.])py(?![\w])|\bpython\b|\bdef \w+\s*\(/i],
  ['JavaScript', /(?<![\w.])js(?![\w])|\bjavascript\b|\bconsole\.log\b|\bdocument\./i],
  ['TypeScript', /(?<![\w.])ts(?![\w])|\btypescript\b/i],
  ['Java', /\bjava\b|\bSystem\.out\b|\bpublic static void\b/i],
  ['Rust', /\brust\b|\bfn main\b|\bprintln!/i],
  ['Go', /\bgolang\b|\bpackage main\b|\bfmt\./i],
  ['C++', /\bc\+\+/i],
  ['C#', /\bc#/i],
  ['Ruby', /\bruby\b/i],
  ['PHP', /\bphp\b/i],
  ['Kotlin', /\bkotlin\b/i],
  ['Swift', /\bswift\b/i],
  ['SQL', /\bsql\b/i],
  ['HTML', /\bhtml\b/i],
  ['CSS', /\bcss\b/i],
  ['React', /\breact\b/i],
  ['Vue', /\bvue\b/i],
  ['Angular', /\bangular\b/i],
  ['Node.js', /\bnode\.?js\b|\bnpm\b/i],
  ['Docker', /\bdocker\b/i],
  ['Kubernetes', /\bkubernetes\b|\bk8s\b/i],
];

const PROTECTED = /```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s]+|"[^"\n]*"/g;

const YOU_NEXT_BLOCK = new Set(['shaped', 'turn', 'boat', 'value', 'lock', 'tube', 'haul']);
const YOU_PREV = new Set([
  'can', 'could', 'would', 'should', 'will', 'please', 'help', 'if', 'when',
  'for', 'to', 'with', 'and', 'or', 'do', 'did', 'are', 'thank',
]);
const YOU_NEXT = new Set(['can', 'could', 'should', 'want', 'need', 'have', 'are', 'know', 'think']);

const NOT_AUDIENCE = new Set([
  'code', 'app', 'project', 'function', 'bug', 'script', 'program', 'list',
  'api', 'assignment', 'prompt', 'error', 'class', 'course', 'paper',
]);

/**
 * @param {string} text
 * @param {(plain: string) => string} fn
 */
function mapPlain(text, fn) {
  let out = '';
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
    if (atStart || (prev && YOU_PREV.has(prev)) || (next && YOU_NEXT.has(next))) {
      return match[0] === 'U' ? 'You' : 'you';
    }
    return match;
  });
}

function replaceLanguageAbbrevs(text) {
  const map = { py: 'Python', js: 'JavaScript', ts: 'TypeScript' };
  return text.replace(/(?<![\w.])(py|js|ts)(?![\w])/gi, (match) => map[match.toLowerCase()]);
}

function replacePronounI(text) {
  return text.replace(/(?<![\w])i(?![\w])/g, (match, offset, str) => {
    if (/^i\.e\b/i.test(str.slice(offset))) return match;
    return 'I';
  });
}

/**
 * Wording-only cleanup. Code fences, inline code, URLs, and double quotes
 * are copied through unchanged.
 * @param {string} text
 */
export function cleanupWording(text) {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n');
  let cleaned = mapPlain(normalized, (plain) => {
    let segment = plain.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n');
    segment = segment.replace(/\bit dont\b/gi, "it doesn't");
    segment = segment.replace(/\bit don't\b/gi, "it doesn't");
    segment = segment.replace(/\bpls\b/gi, 'please');
    segment = segment.replace(/\bplz\b/gi, 'please');
    segment = segment.replace(/\bidk\b/gi, "I don't know");
    segment = segment.replace(/\basap\b/gi, 'as soon as possible');
    segment = segment.replace(/\bwanna\b/gi, 'want to');
    segment = segment.replace(/\bgonna\b/gi, 'going to');
    segment = segment.replace(/\bkinda\b/gi, 'kind of');
    segment = segment.replace(/\bcuz\b/gi, 'because');
    segment = segment.replace(/\bb\/c\b/gi, 'because');
    segment = segment.replace(/\bbc\b/gi, 'because');
    segment = segment.replace(/\btho\b/gi, 'though');
    segment = segment.replace(/\bw\/\s/g, 'with ');
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
    segment = segment.replace(/\bur\b/gi, 'your');
    segment = replacePronounYou(segment);
    segment = replaceLanguageAbbrevs(segment);
    segment = replacePronounI(segment);
    segment = segment.replace(
      /([a-z0-9])\s+(it doesn't|it does|this doesn't)\b/gi,
      (_match, prev, next) => `${prev}. ${next[0].toUpperCase()}${next.slice(1)}`,
    );
    return segment;
  });

  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
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
  const firstWord = cleaned.split(/\s+/)[0]?.toLowerCase() ?? '';
  const questionWords = new Set([
    'how', 'what', 'why', 'when', 'where', 'who', 'is', 'are', 'can', 'could',
    'should', 'do', 'does', 'did',
  ]);
  return cleaned + (questionWords.has(firstWord) ? '?' : '.');
}

/**
 * @param {string} text
 * @returns {'coding'|'debugging'|'research'|'writing'|'learning'|'building'|'general'}
 */
export function detectTask(text) {
  const raw = String(text ?? '');
  if (!raw.trim()) return 'general';

  const teachDebug = /\b(teach me|learn to|explain how to)\b[\s\S]{0,60}\bdebug/i.test(raw);
  const hasBug = /\b(error|exception|traceback|stack trace|typeerror|referenceerror|syntaxerror|crash(?:es|ed|ing)?|doesn'?t work|dont work|not working|isn'?t working|broken|bug)\b/i.test(raw)
    || /\bfix (this|my|the)\b/i.test(raw)
    || /\bdebug (this|my|the)\b/i.test(raw);
  if (hasBug && !teachDebug) return 'debugging';

  const hasTeach = /\b(explain|teach me|teach|learn|tutorial|eli5|help me understand|understand)\b/i.test(raw)
    || /\bhow (?:does|do)\b[\s\S]{0,40}\bwork/i.test(raw)
    || /\bwhat (?:is|are)\b/i.test(raw);
  if (hasTeach) return 'learning';

  if (/\b(build|scaffold|mvp|from scratch)\b/i.test(raw)
    && /\b(app|application|website|web app|side project|project|product|tool|cli)\b/i.test(raw)) {
    return 'building';
  }

  if (/\b(email|essay|blog(?:\s+post)?|story|poem|cover letter|resume|article|paragraph|report)\b/i.test(raw)) {
    return 'writing';
  }
  if (/^\s*(please\s+)?write\b/i.test(raw)
    && !/\b(function|script|class|algorithm|code|program|regex|sql|api)\b/i.test(raw)) {
    return 'writing';
  }

  if (/\b(research|survey|literature|sources?|evidence|compare|comparison|pros and cons|trade-?offs?|paper|study|studies)\b/i.test(raw)) {
    return 'research';
  }

  if (/\b(function|method|algorithm|refactor|implement|script|regex|sql|api|code|program|snippet|python|javascript|typescript|java|golang|rust|ruby|php|kotlin|swift|component)\b/i.test(raw)
    || /\b(c\+\+|c#)\b/i.test(raw)
    || /(?<![\w.])(py|js|ts)(?![\w])/i.test(raw)
    || /\bdef \w+\s*\(/.test(raw)
    || /\bconsole\.log\b/.test(raw)) {
    return 'coding';
  }

  return 'general';
}

function plainText(text) {
  return text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]+`/g, ' ');
}

function splitSentences(text) {
  return plainText(text)
    .split(/\n+|(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function normalizeKey(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function extractTechnologies(text) {
  const found = [];
  for (const [name, pattern] of TECH_RULES) {
    if (pattern.test(text)) found.push(name);
  }
  return found;
}

function extractConstraints(text) {
  return splitSentences(text).filter((sentence) =>
    /\b(must|should|need to|needs to|don't|do not|never|only|without|avoid|at most|no more than|under \d)\b/i.test(sentence));
}

function extractConditions(text) {
  const conditions = [];
  const source = plainText(text);
  for (const match of source.matchAll(/\b(?:when|if|unless)\b(?!\s+you\b)[^.\n?!]{0,140}/gi)) {
    const clause = match[0].replace(/\s+/g, ' ').trim();
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
  return /\b(beginner|beginners|advanced|expert|senior|junior|eli5|5th grade|kids|children)\b/i.test(text)
    || /\b(i'm|im|i am)\s+new\b/i.test(text)
    || /\blike i'm new\b/i.test(text)
    || /\blike i'm 5\b/i.test(text);
}

function hasCodeArtifact(text) {
  return /```[\s\S]*?```/.test(text)
    || /`[^`\n]+`/.test(text)
    || /\bdef \w+\s*\(/.test(text)
    || /\bconsole\.log\b/.test(text)
    || /\bfunction\s+\w+\s*\(/.test(text)
    || /\bpublic static void\b/.test(text);
}

function hasErrorArtifact(text) {
  return /\b(typeerror|referenceerror|syntaxerror|traceback|stack trace|exception|errno|segfault)\b/i.test(text);
}

function extractOutputFormat(text, task) {
  if (/\bjson\b/i.test(text)) return 'JSON, as requested.';
  if (/\bmarkdown\b/i.test(text)) return 'Markdown, as requested.';
  if (/\bbullets?\b/i.test(text)) return 'A bullet list, as requested.';
  if (/\btable\b/i.test(text)) return 'A table, as requested.';
  if (task === 'writing' && /\bemail\b/i.test(text)) return 'An email, as requested.';
  if (task === 'coding' && /\bfunction\b/i.test(text)) return 'A function, as requested.';
  if (task === 'coding' && /\b(script|program)\b/i.test(text)) return 'Code, as requested.';
  if (task === 'writing' && /\b(essay|blog|story|poem|paragraph|article|report|cover letter|resume)\b/i.test(text)) {
    return 'The written piece named in the objective.';
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
    kept.push(item.replace(/\s+/g, ' ').trim());
    if (kept.length === limit) break;
  }
  return kept;
}

function constraintBlock(cleaned, constraints) {
  const kept = keepShortExtracts(cleaned, constraints, 3);
  if (!kept.length) return '- None beyond the request itself.';
  return kept.map((item) => `- ${item}`).join('\n');
}

function wordCount(text) {
  return plainText(text).trim().split(/\s+/).filter(Boolean).length;
}

function buildingIsVague(text) {
  const stripped = plainText(text).toLowerCase()
    .replace(/\b(please|build|me|a|an|the|small|simple|from|scratch|app|application|website|web|project|mvp|tool|cli)\b/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .trim();
  return stripped.split(/\s+/).filter(Boolean).length === 0;
}

function writingTopicIsVague(text) {
  return /\bwrite something\b|\bsomething nice\b|\bwrite a thing\b/i.test(text);
}

function isNonRequest(cleaned) {
  const bare = cleaned.toLowerCase().replace(/[.?!]+$/g, '').trim();
  return /^(help|please|please help|i don't know|hey|hi|hello|yo|sup|test)( there)?$/.test(bare);
}

/**
 * Essential gaps only. Missing details become questions, not invented facts.
 * Expert-only gaps (edge cases, output format) are written in those sections.
 */
function essentialQuestions(task, signals) {
  const questions = [];
  if (task === 'debugging') {
    if (!signals.hasCode && !signals.hasError) {
      questions.push('No code or error message was included. What is the exact failure output?');
    } else if (!signals.hasCode) {
      questions.push('No code was included. Which lines are involved?');
    } else if (!signals.hasError) {
      questions.push('No error message was included. What does the failure look like?');
    }
  }
  if (task === 'coding' && signals.technologies.length === 0) {
    questions.push('Which language or environment should the solution use? None was named.');
  }
  if (task === 'building' && signals.technologies.length === 0) {
    questions.push('Which platform or technologies are in scope? None were named.');
  }
  if (task === 'building' && signals.vagueBuild) {
    questions.push('What should it do? The request does not describe the behavior.');
  }
  if (task === 'writing' && !signals.audience && !signals.tone) {
    questions.push('Who is the reader, and what tone should the text use? Neither was named.');
  } else if (task === 'writing' && !signals.audience) {
    questions.push('Who is the reader? None was named.');
  } else if (task === 'writing' && !signals.tone) {
    questions.push('What tone should the text use? None was named.');
  }
  if (task === 'writing' && signals.vagueWriting) {
    questions.push('What should the text be about? The request does not say.');
  }
  if (task === 'research' && signals.vagueResearch) {
    questions.push('What criteria should the answer be judged by? None were stated.');
  }
  if (task === 'general' && signals.words < 6) {
    questions.push('What outcome do you want? The request does not say.');
  }
  return questions.slice(0, 4);
}

function assumptionsFor(task, signals) {
  if (task === 'learning' && !signals.experience) {
    return ['No experience level was stated, so the explanation should stay plain and define its terms.'];
  }
  return [];
}

function collectSignals(original, cleaned) {
  const task = detectTask(original);
  const technologies = extractTechnologies(`${original}\n${cleaned}`);
  return {
    task,
    technologies,
    constraints: extractConstraints(cleaned),
    conditions: extractConditions(cleaned),
    audience: extractAudience(cleaned),
    tone: extractTone(cleaned),
    experience: hasExperienceLevel(`${original}\n${cleaned}`),
    hasCode: hasCodeArtifact(original) || hasCodeArtifact(cleaned),
    hasError: hasErrorArtifact(original) || hasErrorArtifact(cleaned),
    outputFormat: extractOutputFormat(cleaned, task),
    vagueBuild: buildingIsVague(cleaned),
    vagueWriting: writingTopicIsVague(cleaned),
    vagueResearch: /\bbest\b/i.test(cleaned) && !/\b(criteria|compare|vs\.?|versus|pros and cons)\b/i.test(cleaned),
    words: wordCount(cleaned),
  };
}

function techLine(technologies) {
  if (!technologies.length) return '';
  return `Technologies named in the request: ${technologies.join(', ')}.`;
}

function renderQuick(cleaned) {
  if (!isNonRequest(cleaned)) return cleaned;
  return `${cleaned}\n\nOpen question: What do you want done? The draft does not say.`;
}

function renderDetailed(cleaned, signals) {
  const lines = [
    `Task: ${TASK_LABELS[signals.task]}`,
    '',
    'Request:',
    cleaned,
    '',
    'Constraints stated in the request:',
    constraintBlock(cleaned, signals.constraints),
  ];
  const technologies = techLine(signals.technologies);
  if (technologies) lines.push('', technologies);
  lines.push('', 'Implied scope:', `- ${IMPLIED_SCOPE[signals.task]}`);
  for (const assumption of assumptionsFor(signals.task, signals)) {
    lines.push('', `Assumption: ${assumption}`);
  }
  for (const question of essentialQuestions(signals.task, signals)) {
    lines.push('', `Open question: ${question}`);
  }
  return lines.join('\n');
}

function renderExpert(cleaned, signals) {
  const lines = [
    `Task: ${TASK_LABELS[signals.task]}`,
    '',
    'Objective:',
    cleaned,
    '',
    'Constraints stated in the request:',
    constraintBlock(cleaned, signals.constraints),
  ];
  const technologies = techLine(signals.technologies);
  if (technologies) lines.push('', technologies);

  lines.push('', 'Edge cases:');
  const conditions = keepShortExtracts(cleaned, signals.conditions, 3);
  if (conditions.length) {
    for (const condition of conditions) lines.push(`- Named in the request: ${condition}`);
  } else {
    lines.push('Open question: Which edge cases matter? None were named in the request.');
  }

  lines.push('', 'Expected output:');
  if (signals.outputFormat) lines.push(signals.outputFormat);
  else lines.push('Open question: What output format do you want? None was specified.');

  lines.push('', 'Implied scope:', `- ${IMPLIED_SCOPE[signals.task]}`);
  for (const assumption of assumptionsFor(signals.task, signals)) {
    lines.push('', `Assumption: ${assumption}`);
  }
  for (const question of essentialQuestions(signals.task, signals)) {
    lines.push('', `Open question: ${question}`);
  }
  return lines.join('\n');
}

/**
 * @param {string} text
 */
export function parseMarkers(text) {
  const assumptions = [];
  const openQuestions = [];
  for (const line of String(text ?? '').split('\n')) {
    if (line.startsWith('Assumption:')) assumptions.push(line.slice('Assumption:'.length).trim());
    if (line.startsWith('Open question:')) openQuestions.push(line.slice('Open question:'.length).trim());
  }
  return { assumptions, openQuestions };
}

/**
 * @param {string} input
 * @param {'quick'|'detailed'|'expert'} [level]
 */
export function enhance(input, level = 'detailed') {
  if (!LEVELS.some((item) => item.id === level)) {
    throw new Error(`Unknown level: ${level}`);
  }
  const original = String(input ?? '').replace(/\r\n/g, '\n');
  const task = detectTask(original);
  const cleaned = cleanupWording(original);
  if (!cleaned) {
    return {
      original,
      improved: '',
      task,
      taskLabel: TASK_LABELS[task],
      level,
      assumptions: [],
      openQuestions: [],
    };
  }

  let improved;
  if (level === 'quick') improved = renderQuick(cleaned);
  else {
    const signals = collectSignals(original, cleaned);
    improved = level === 'detailed' ? renderDetailed(cleaned, signals) : renderExpert(cleaned, signals);
  }
  const markers = parseMarkers(improved);
  return {
    original,
    improved,
    task,
    taskLabel: TASK_LABELS[task],
    level,
    assumptions: markers.assumptions,
    openQuestions: markers.openQuestions,
  };
}
