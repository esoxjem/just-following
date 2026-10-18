import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const exec = promisify(execFile);

test('npm amo reads Just Following with Watchbox’s short-lived JWT authentication', { timeout: 10000 }, async t => {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, authorization: req.headers.authorization });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ name: { 'en-US': 'Just Following' } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('WEB_EXT_')));
  Object.assign(env, {
    WEB_EXT_API_KEY: 'user:123:4',
    WEB_EXT_API_SECRET: 'test-secret',
    WEB_EXT_AMO_BASE_URL: `http://127.0.0.1:${server.address().port}/api/v5/`
  });
  const result = await exec('npm', ['run', '--silent', 'amo', '--', 'get'], { env });
  assert.equal(JSON.parse(result.stdout).name['en-US'], 'Just Following');
  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.equal(request.method, 'GET');
  assert.equal(request.url, '/api/v5/addons/addon/just-following%40local.just-following/');
  const [header, payload, signature] = request.authorization.slice('JWT '.length).split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  assert.equal(claims.iss, env.WEB_EXT_API_KEY);
  assert.ok(claims.jti);
  assert.ok(Math.abs(claims.iat - Date.now() / 1000) < 5);
  assert.equal(claims.exp - claims.iat, 60);
  assert.equal(signature, createHmac('sha256', env.WEB_EXT_API_SECRET).update(`${header}.${payload}`).digest('base64url'));
  assert.ok(!result.stdout.includes(env.WEB_EXT_API_SECRET));
});

test('release packages exclude credentials and store submission files', { timeout: 10000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'just-following-package-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = join(dir, 'source'), artifacts = join(dir, 'artifacts');
  await mkdir(source);
  await writeFile(join(source, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Package test', version: '1.0' }));
  for (const file of ['scripts/amo.mjs', 'store/listing.json', 'store/submission.json', 'store/icons/icon.png', 'tests/test.mjs', 'docs/development.md', 'artifacts/old.txt', 'README.md', 'AGENTS.md', 'package.json', '.env', '.env.example']) {
    await mkdir(join(source, file, '..'), { recursive: true });
    await writeFile(join(source, file), 'must not ship');
  }
  await exec(process.execPath, ['node_modules/web-ext/bin/web-ext.js', 'build', '--source-dir', source, '--artifacts-dir', artifacts]);
  const [archive] = await readdir(artifacts);
  const { stdout } = await exec('unzip', ['-Z1', join(artifacts, archive)]);
  assert.deepEqual(stdout.trim().split('\n'), ['manifest.json']);
});
