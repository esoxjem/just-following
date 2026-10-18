import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

test('Firefox package runs only on Instagram with no data collection', () => {
  const path = new URL('../manifest.json', import.meta.url);
  assert.ok(existsSync(path), 'Firefox manifest is missing');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(manifest.name, 'Just Following');
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, ['none']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://www.instagram.com/*', 'https://instagram.com/*']);
  assert.equal(manifest.content_scripts[0].run_at, 'document_start');
  assert.deepEqual(manifest.permissions ?? [], ['storage']);
  assert.ok(!manifest.background, 'No background account access is needed');
});

test('the declared Firefox minimum supports built-in no-data consent', () => {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.ok(Number.parseInt(manifest.browser_specific_settings.gecko.strict_min_version, 10) >= 142);
});

test('Firefox can load a self-contained icon at each extension display size', () => {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  for (const size of [16, 32, 48, 96, 128]) {
    const icon = manifest.icons?.[size];
    assert.ok(icon, `Missing extension icon for ${size}px`);
    const source = readFileSync(new URL(`../${icon}`, import.meta.url), 'utf8');
    const { document } = new JSDOM(source, { contentType: 'image/svg+xml' }).window;
    assert.equal(document.documentElement.localName, 'svg');
    assert.equal(document.documentElement.getAttribute('viewBox'), '0 0 24 24');
    assert.equal(document.querySelector('image, script, foreignObject, [href]'), null);
  }
});

test('toolbar action opens the local popup with shared settings loaded before content', () => {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.action?.default_popup, 'popup.html');
  assert.deepEqual(manifest.content_scripts[0].js, ['settings.js', 'content.js']);
  assert.ok(existsSync(new URL('../popup.js', import.meta.url)));
  assert.ok(existsSync(new URL('../popup.css', import.meta.url)));
});
