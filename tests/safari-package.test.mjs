import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectFile = fileURLToPath(new URL('../safari/Just Following.xcodeproj/project.pbxproj', import.meta.url));
const projectRoot = dirname(dirname(projectFile));
const extensionRoot = fileURLToPath(new URL('../extension/', import.meta.url));
const safariOnly = { skip: process.platform !== 'darwin' && 'Safari packaging requires macOS plutil' };
const readProject = () => JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', projectFile], { encoding: 'utf8' }));

test('Safari targets use the esoxjem bundle identifiers in every configuration', safariOnly, () => {
  const { objects } = readProject();
  for (const [name, identifier] of [
    ['Just Following', 'com.esoxjem.justfollowing'],
    ['Just Following Extension', 'com.esoxjem.justfollowing.Extension'],
  ]) {
    const target = Object.values(objects).find(object => object.isa === 'PBXNativeTarget' && object.name === name);
    assert.ok(target, `Missing target: ${name}`);
    for (const id of objects[target.buildConfigurationList].buildConfigurations) {
      const configuration = objects[id];
      assert.equal(configuration.buildSettings.PRODUCT_BUNDLE_IDENTIFIER, identifier, `${name} ${configuration.name}`);
    }
  }
});

function assertSafariResourcesMatch(project) {
  const objects = project.objects;
  const paths = new Map();
  function visit(id, parent) {
    const object = objects[id];
    const path = resolve(object.sourceTree === 'SOURCE_ROOT' ? projectRoot : parent, object.path || '');
    if (object.isa === 'PBXFileReference') paths.set(id, path);
    for (const child of object.children || []) visit(child, path);
  }
  visit(objects[project.rootObject].mainGroup, projectRoot);
  const target = Object.values(objects).find(object => object.isa === 'PBXNativeTarget' && object.name === 'Just Following Extension');
  assert.ok(target, 'Safari extension resources require an extension target');
  const resources = target.buildPhases.map(id => objects[id]).find(phase => phase.isa === 'PBXResourcesBuildPhase');
  assert.ok(resources, 'Safari extension resources require a Copy Bundle Resources phase');
  const bundled = resources.files.map(id => paths.get(objects[id].fileRef));
  const shared = readdirSync(extensionRoot, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() || entry.isSymbolicLink())
    .filter(entry => entry.name !== '.amo-upload-uuid')
    .map(entry => resolve(entry.parentPath, entry.name));
  assert.deepEqual(bundled.sort(), shared.sort(), 'Safari extension resources must match the shared extension source files');
}

test('Safari bundles the same shared source files as Firefox', safariOnly, () => {
  assertSafariResourcesMatch(readProject());
});

test('Safari resource parity rejects a shared file omitted from the extension target', safariOnly, () => {
  const project = readProject();
  const objects = project.objects;
  const target = Object.values(objects).find(object => object.isa === 'PBXNativeTarget' && object.name === 'Just Following Extension');
  const resources = target.buildPhases.map(id => objects[id]).find(phase => phase.isa === 'PBXResourcesBuildPhase');
  resources.files = resources.files.filter(id => !objects[objects[id].fileRef].path.endsWith('/settings.js'));
  assert.throws(() => assertSafariResourcesMatch(project), /Safari extension resources/);
});
