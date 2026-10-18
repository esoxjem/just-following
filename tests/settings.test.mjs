import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';

test('settings default to the agreed focus options and reject invalid saved values', () => {
  const win = new JSDOM('', { runScripts: 'outside-only' }).window;
  const path = new URL('../extension/settings.js', import.meta.url);
  if (existsSync(path)) win.eval(readFileSync(path, 'utf8'));
  assert.ok(win.JFSettings, 'Shared settings are available');
  const expected = { hideExplore: true, blockReels: true, hideSuggestions: true, hideStories: false };
  assert.deepEqual(JSON.parse(JSON.stringify(win.JFSettings.defaults)), expected);
  assert.deepEqual(JSON.parse(JSON.stringify(win.JFSettings.normalize({ enabled: false, hideStories: true, blockReels: 'false', unknown: true }))), { ...expected, hideStories: true });
  win.close();
});
