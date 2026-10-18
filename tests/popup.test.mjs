import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const windows = [];
afterEach(() => { for (const win of windows.splice(0)) win.close(); });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function popup(saved = {}, set) {
  const path = new URL('../popup.html', import.meta.url);
  assert.ok(existsSync(path), 'Popup HTML exists');
  const win = new JSDOM(readFileSync(path, 'utf8'), { runScripts: 'outside-only' }).window;
  windows.push(win);
  let change;
  const writes = [];
  win.browser = { storage: {
    local: { get: async () => saved, set: set || (async patch => { writes.push(patch); Object.assign(saved, patch); }) },
    onChanged: { addListener: listener => { change = listener; } }
  } };
  win.eval(readFileSync(new URL('../settings.js', import.meta.url), 'utf8'));
  win.eval(readFileSync(new URL('../popup.js', import.meta.url), 'utf8'));
  await tick();
  return { win, doc: win.document, writes, saved, change };
}

test('popup loads four labeled switches with agreed defaults and saved overrides', async () => {
  const p = await popup({ hideStories: true });
  const inputs = [...p.doc.querySelectorAll('input[type="checkbox"]')];
  assert.equal(inputs.length, 4);
  for (const input of inputs) {
    assert.equal(input.checked, true, input.name);
    assert.ok(input.labels.length, input.name);
    assert.equal(input.disabled, false);
  }
  assert.equal(p.doc.querySelector('#options').disabled, false);
  assert.equal(p.writes.length, 0);
});

test('the suggestion switch explains that it also hides sponsored posts', async () => {
  const p = await popup();
  const label = p.doc.querySelector('[name="hideSuggestions"]').labels[0];
  assert.match(label.textContent, /Hide suggestions and ads/);
  assert.match(label.textContent, /Suggested accounts, posts, and sponsored posts/);
});

test('switches save only their own preference and retain the other options', async () => {
  const p = await popup({ hideStories: true });
  p.doc.querySelector('[name="hideExplore"]').click();
  await tick();
  assert.equal(p.writes.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(p.writes[0])), { hideExplore: false });
  assert.equal(p.saved.hideStories, true);
  assert.equal(p.doc.querySelector('[name="hideStories"]').checked, true);
});

test('reset restores all agreed defaults in storage and the popup', async () => {
  const p = await popup({ hideExplore: false, hideStories: true });
  p.doc.querySelector('#reset').click();
  await tick();
  assert.equal(p.writes.length, 1);
  for (const [key, value] of Object.entries(p.win.JFSettings.defaults)) {
    assert.equal(p.saved[key], value, key);
    assert.equal(p.doc.querySelector(`[name="${key}"]`).checked, value, key);
  }
  assert.equal(p.doc.querySelector('#options').disabled, false);
});

test('popup stays in sync when another popup changes local preferences', async () => {
  const p = await popup();
  assert.equal(typeof p.change, 'function');
  p.change({ hideExplore: { newValue: false }, hideStories: { newValue: true } }, 'local');
  assert.equal(p.doc.querySelector('[name="hideExplore"]').checked, false);
  assert.equal(p.doc.querySelector('#options').disabled, false);
  assert.equal(p.doc.querySelector('[name="hideStories"]').checked, true);
  assert.equal(p.writes.length, 0);
});

test('failed saves restore the persisted switch and show a retry message', async () => {
  const p = await popup({}, async () => { throw new Error('Storage unavailable'); });
  p.doc.querySelector('[name="hideStories"]').click();
  await tick();
  assert.equal(p.doc.querySelector('[name="hideStories"]').checked, false);
  assert.match(p.doc.querySelector('#status').textContent, /Could not save/);
  assert.equal(p.doc.querySelector('[name="hideStories"]').disabled, false);
});

test('pending writes disable controls so fast clicks cannot reorder settings', async () => {
  let finish;
  const p = await popup({}, () => new Promise(resolve => { finish = resolve; }));
  p.doc.querySelector('[name="hideStories"]').click();
  assert.equal(p.doc.querySelector('[name="hideExplore"]').disabled, true);
  assert.equal(p.doc.querySelector('#reset').disabled, true);
  finish();
  await tick();
  assert.equal(p.doc.querySelector('[name="hideStories"]').checked, true);
  assert.equal(p.doc.querySelector('[name="hideExplore"]').disabled, false);
});

test('storage events during a pending save keep controls locked until completion', async () => {
  let finish;
  const p = await popup({}, () => new Promise(resolve => { finish = resolve; }));
  p.doc.querySelector('[name="hideStories"]').click();
  p.change({ hideStories: { newValue: true } }, 'local');
  assert.equal(p.doc.querySelector('[name="hideExplore"]').disabled, true);
  finish();
  await tick();
  assert.equal(p.doc.querySelector('[name="hideExplore"]').disabled, false);
});
