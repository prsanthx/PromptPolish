import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../extension/', import.meta.url);

function read(path) {
  return readFileSync(new URL(path, root), 'utf8');
}

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

test('manifest is MV3 with only activeTab and scripting', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'scripting']);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.chrome_url_overrides, undefined);
  assert.equal(manifest.externally_connectable, undefined);
  assert.equal(manifest.action.default_popup, 'popup/popup.html');
});

test('popup exposes the v1 controls and accessible labels', () => {
  const html = read('popup/popup.html');
  for (const id of [
    'prompt', 'level-quick', 'level-detailed', 'level-expert', 'enhance',
    'original', 'improved', 'copy', 'insert', 'read-page', 'clear', 'task', 'markers',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /<label[^>]+for="prompt"/);
  assert.match(html, /<label[^>]+for="original"/);
  assert.match(html, /<label[^>]+for="improved"/);
  assert.match(html, /Quick Fix/);
  assert.match(html, /Detailed/);
  assert.match(html, /Expert/);
  assert.match(html, /type="module"/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/);
});

test('extension sources do not call the network or store prompts', () => {
  const files = walk(new URL('.', root).pathname).filter((path) => /\.(js|html|css|json)$/.test(path));
  assert.ok(files.length >= 4);
  const banned = [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /\bsendBeacon\b/,
    /chrome\.storage/,
    /https?:\/\//,
    /api[_-]?key/i,
    /google-analytics|gtag\s*\(/,
  ];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of banned) {
      assert.doesNotMatch(source, pattern, `${file} matched ${pattern}`);
    }
  }
});
