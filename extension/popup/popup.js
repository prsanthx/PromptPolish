import { enhance, detectTask, TASK_LABELS, parseMarkers } from '../src/engine.js';
import { SITE_RULES, readPromptField, writePromptField, pickBestRead } from '../src/page-field.js';

const promptBox = document.querySelector('#prompt');
const originalBox = document.querySelector('#original');
const improvedBox = document.querySelector('#improved');
const taskLine = document.querySelector('#task');
const statusLine = document.querySelector('#status');
const markers = document.querySelector('#markers');
const markersEmpty = document.querySelector('#markers-empty');
const markerSection = document.querySelector('#marker-section');
const confirmBox = document.querySelector('#confirm');
const insertButton = document.querySelector('#insert');
const enhanceButton = document.querySelector('#enhance');

let pageTarget = null;
let lastEnhancedFrom = null;

function setStatus(message) {
  statusLine.textContent = message;
}

function selectedLevel() {
  return document.querySelector('input[name="level"]:checked')?.value || 'detailed';
}

function refreshTask() {
  const draft = promptBox.value;
  if (!draft.trim()) {
    taskLine.textContent = 'Detected task: —';
    return;
  }
  const task = detectTask(draft);
  taskLine.textContent = `Detected task: ${TASK_LABELS[task]}`;
}

function renderMarkers(text) {
  const parsed = parseMarkers(text);
  markers.replaceChildren();
  for (const item of parsed.assumptions) markers.append(markerItem('Assumption', item, 'assumption'));
  for (const item of parsed.openQuestions) markers.append(markerItem('Open question', item, 'question'));
  const empty = parsed.assumptions.length + parsed.openQuestions.length === 0;
  markersEmpty.hidden = !empty;
  markers.hidden = empty;
  const hasResult = originalBox.value.length > 0 || improvedBox.value.length > 0;
  markerSection.hidden = !hasResult;
}

function markerItem(label, text, kind) {
  const li = document.createElement('li');
  const badge = document.createElement('span');
  badge.className = `badge ${kind}`;
  badge.textContent = label;
  const body = document.createElement('span');
  body.textContent = text;
  li.append(badge, body);
  return li;
}

function hideConfirm() {
  confirmBox.hidden = true;
}

function syncInsert() {
  const ready = Boolean(pageTarget?.selector && improvedBox.value.trim());
  insertButton.disabled = !ready;
  if (!ready) hideConfirm();
}

function runEnhance() {
  const draft = promptBox.value;
  if (!draft.trim()) {
    setStatus('Paste a prompt, or read one from this page.');
    promptBox.focus();
    return;
  }
  const result = enhance(draft, selectedLevel());
  originalBox.value = result.original;
  improvedBox.value = result.improved;
  lastEnhancedFrom = draft;
  renderMarkers(result.improved);
  refreshTask();
  syncInsert();
  const gaps = result.assumptions.length + result.openQuestions.length;
  const gapNote = gaps ? ` ${gaps} assumption or open question marked.` : ' No assumptions or open questions.';
  setStatus(`Enhanced as ${result.taskLabel}, ${labelForLevel(result.level)}.${gapNote}`);
}

function labelForLevel(level) {
  if (level === 'quick') return 'Quick Fix';
  if (level === 'expert') return 'Expert';
  return 'Detailed';
}

async function currentTab() {
  const chromeApi = globalThis.chrome;
  if (!chromeApi?.tabs || !chromeApi.scripting) return null;
  const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  return tab?.id ? tab : null;
}

async function readFromPage(explicit) {
  hideConfirm();
  let tab;
  try {
    tab = await currentTab();
    if (!tab) {
      setStatus('Page reading is available from the Chrome toolbar icon.');
      return;
    }
    const frames = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: readPromptField,
      args: [SITE_RULES],
    });
    const found = pickBestRead(frames);
    if (!found) {
      pageTarget = null;
      syncInsert();
      setStatus('No prompt field found. Paste one here. Only a focused field, or the ChatGPT, Claude, or Gemini composer, is read.');
      return;
    }
    pageTarget = {
      tabId: tab.id,
      frameId: found.frameId,
      selector: found.selector,
      siteLabel: found.siteLabel,
    };
    const where = found.siteLabel ? `the ${found.siteLabel} composer` : 'the focused field';
    const text = found.text || '';
    if (text.trim()) {
      const replacing = explicit && promptBox.value.trim() && promptBox.value !== text;
      promptBox.value = text;
      lastEnhancedFrom = null;
      originalBox.value = '';
      improvedBox.value = '';
      renderMarkers('');
      refreshTask();
      setStatus(replacing ? `Replaced the draft with ${where}.` : `Read ${where}.`);
    } else {
      setStatus(`Found ${where}, and it is empty. Write a prompt here, then insert it back.`);
    }
    syncInsert();
  } catch {
    pageTarget = null;
    syncInsert();
    setStatus('This page can’t be read. Browser pages block extensions. Paste a prompt instead.');
  }
}

async function confirmInsert() {
  const text = improvedBox.value;
  if (!pageTarget?.selector || !text.trim()) {
    setStatus('Read a page field before inserting.');
    hideConfirm();
    return;
  }
  try {
    const [written] = await chrome.scripting.executeScript({
      target: { tabId: pageTarget.tabId, frameIds: [pageTarget.frameId] },
      func: writePromptField,
      args: [pageTarget.selector, text],
    });
    const result = written?.result;
    hideConfirm();
    if (result?.ok) {
      setStatus('Inserted into the page field.');
      return;
    }
    if (result?.reason === 'missing') {
      setStatus('The page field is gone. Read from the page again, or copy the prompt.');
      return;
    }
    setStatus('The page did not keep the inserted text. Copy it instead.');
  } catch {
    hideConfirm();
    setStatus('Could not insert into this page. Copy the prompt instead.');
  }
}

async function copyImproved() {
  const text = improvedBox.value;
  if (!text.trim()) {
    setStatus('Enhance a prompt before copying.');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus('Copied the improved prompt.');
  } catch {
    improvedBox.focus();
    improvedBox.select();
    setStatus('Copy was blocked. The improved prompt is selected.');
  }
}

function clearDraft() {
  promptBox.value = '';
  originalBox.value = '';
  improvedBox.value = '';
  lastEnhancedFrom = null;
  renderMarkers('');
  hideConfirm();
  refreshTask();
  syncInsert();
  setStatus('Cleared the draft. The page was not changed.');
  promptBox.focus();
}

promptBox.addEventListener('input', () => {
  refreshTask();
  if (lastEnhancedFrom != null && promptBox.value !== lastEnhancedFrom) {
    setStatus('Draft changed. Enhance again to refresh the result.');
  }
});

improvedBox.addEventListener('input', () => {
  renderMarkers(improvedBox.value);
  syncInsert();
});

document.querySelectorAll('input[name="level"]').forEach((input) => {
  input.addEventListener('change', () => {
    if (promptBox.value.trim() && improvedBox.value.trim()) runEnhance();
  });
});

enhanceButton.addEventListener('click', runEnhance);
document.querySelector('#read-page').addEventListener('click', () => readFromPage(true));
document.querySelector('#copy').addEventListener('click', copyImproved);
document.querySelector('#clear').addEventListener('click', clearDraft);

insertButton.addEventListener('click', () => {
  if (insertButton.disabled) return;
  confirmBox.hidden = false;
  document.querySelector('#confirm-insert').focus();
});

document.querySelector('#confirm-insert').addEventListener('click', confirmInsert);
document.querySelector('#confirm-cancel').addEventListener('click', () => {
  hideConfirm();
  insertButton.focus();
  setStatus('Insert cancelled. The page was not changed.');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !confirmBox.hidden) {
    hideConfirm();
    insertButton.focus();
    setStatus('Insert cancelled. The page was not changed.');
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    runEnhance();
  }
});

renderMarkers('');
refreshTask();
syncInsert();
readFromPage(false);
