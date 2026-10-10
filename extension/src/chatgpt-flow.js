/**
 * In-page ChatGPT panel state. The rewriter is extension/src/engine.js.
 * Insert writes text. It never sends the chat message.
 */

import { LEVELS, enhance, parseMarkers } from './engine.js';

export const REWRITE_ANIMATION_MS = 360;

export const NOTICES = {
  empty: 'The composer is empty. Type a prompt first.',
  inserted: 'Inserted into the composer. The message was not sent.',
  rejected: 'ChatGPT did not keep the inserted text. Copy it instead.',
  missing: 'The composer is gone. Copy the prompt instead.',
};

export function createSession() {
  return {
    phase: 'closed',
    level: null,
    original: '',
    improved: '',
    taskLabel: '',
    assumptions: [],
    openQuestions: [],
    notice: '',
    inserted: false,
  };
}

export function openChooser(session) {
  return {
    ...session,
    phase: 'choosing',
    notice: '',
    inserted: false,
  };
}

/** Close the panel. Does not describe a write. */
export function dismiss(session) {
  return {
    ...createSession(),
    level: session.level,
  };
}

export function requestRewrite(session, draft, level) {
  if (!LEVELS.some((item) => item.id === level)) {
    return { ...session, phase: 'choosing', notice: '' };
  }
  if (!String(draft ?? '').trim()) {
    return {
      ...session,
      phase: 'result',
      level,
      original: String(draft ?? ''),
      improved: '',
      taskLabel: '',
      assumptions: [],
      openQuestions: [],
      notice: NOTICES.empty,
      inserted: false,
    };
  }
  return {
    ...session,
    phase: 'rewriting',
    level,
    notice: '',
    inserted: false,
  };
}

export function completeRewrite(session, draft) {
  const result = enhance(draft, session.level);
  return {
    ...session,
    phase: 'result',
    original: result.original,
    improved: result.improved,
    taskLabel: result.taskLabel,
    assumptions: result.assumptions,
    openQuestions: result.openQuestions,
    notice: '',
    inserted: false,
  };
}

export function editImproved(session, text) {
  const markers = parseMarkers(text);
  return {
    ...session,
    improved: text,
    assumptions: markers.assumptions,
    openQuestions: markers.openQuestions,
  };
}

/**
 * Insert is the confirmation. send is always false.
 * @param {ReturnType<typeof createSession>} session
 */
export function planInsert(session) {
  if (session.phase !== 'result') return { write: false, send: false, reason: 'not-ready' };
  if (!String(session.improved ?? '').trim()) return { write: false, send: false, reason: 'empty' };
  return { write: true, send: false, text: session.improved };
}

export function noteInserted(session, verified) {
  if (!verified) {
    return { ...session, inserted: false, notice: NOTICES.rejected };
  }
  return { ...session, inserted: true, notice: NOTICES.inserted };
}

export function noteMissingComposer(session) {
  return { ...session, inserted: false, notice: NOTICES.missing };
}
