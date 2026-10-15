import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const code = ts.transpileModule(fs.readFileSync(new URL('../src/installedUpdate.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function('require', 'exports', 'module', code)(id => id === 'electron' ? { app: {} } : require(id), module.exports, module);
const { resolveInstalledChannel: resolve } = module.exports;
const current = { version: '3.2.1', fingerprint: 'beta-bundle' };
test('confirmed beta installation does not become a stable-to-beta switch on restart', () => {
  const state = { installed: { ...current, channel: 'beta' } };
  assert.equal(resolve(state, current, 'stable').channel, 'beta');
});
test('new version and same-version branch installs confirm after the bundle changes', () => {
  for (const version of ['3.1.2', '3.2.1']) {
    const state = { installed: { version, fingerprint: 'old-bundle', channel: 'stable' }, pending: { ...current, fingerprint: 'old-bundle', channel: 'beta' } };
    assert.equal(resolve(state, current, 'stable').channel, 'beta');
    assert.equal(resolve(state, { version, fingerprint: 'old-bundle' }, 'stable').channel, 'stable');
  }
});
test('cancelled, failed, and unrelated installations do not confirm the requested branch', () => {
  const pending = { channel: 'beta', version: '3.2.1', fingerprint: 'old-bundle' };
  assert.equal(resolve({ pending }, { version: '3.1.2', fingerprint: 'old-bundle' }, 'stable').channel, 'stable');
  assert.equal(resolve({ pending }, { version: '3.3.0', fingerprint: 'other-bundle' }, 'stable').channel, 'stable');
  assert.equal(resolve({ installed: { ...current, channel: 'beta' } }, { ...current, fingerprint: 'manual-install' }, 'stable').channel, 'stable');
});
test('untracked installs use build metadata and reject invalid stored branches', () => {
  assert.equal(resolve({}, current, 'beta').channel, 'beta');
  assert.equal(resolve({ installed: { ...current, channel: '../bad' } }, current, 'stable').channel, 'stable');
});
