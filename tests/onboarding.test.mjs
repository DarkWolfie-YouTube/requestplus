import test from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const source = fs.readFileSync(new URL('../src/onboarding.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { setupPatch, setupReady, hasLinkedChannel, setupChatPlatforms, finishSetup, SetupRequestCheck } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const healthy = { cloud: true, music: true, platform: 'spotify', overlay: true, overlayPath: 'overlay.html', previewUrl: null, track: null, request: { accepted: true, code: 'OKAY_SP_QUEUED' } };

function fixture(overrides = {}) {
  let saved = { oobeCompleted: false, oobeRulesReviewed: true, platform: 'apple', appleMusicAppToken: 'existing-token', theme: 'custom', modsOnly: true, ...overrides };
  const events = [];
  const dependencies = {
    persistDraft: patch => { saved = { ...saved, ...setupPatch(patch) }; events.push('draft'); },
    load: () => saved,
    save: value => { saved = value; events.push('save'); },
    status: () => healthy,
    connections: async () => ({ twitch: { connected: true } }),
    openClient: async () => { events.push('open'); },
    closeSetup: () => { events.push('close'); },
  };
  return { dependencies, events, saved: () => saved };
}
const finished = { patch: {}, overlayConfirmed: true, requestConfirmed: true };

test('deferring preserves existing settings and does not mark unfinished setup complete', async () => {
  const f = fixture();
  await finishSetup({ patch: {}, deferred: true }, { ...f.dependencies, connections: async () => { throw new Error('offline'); } });
  assert.deepEqual(f.saved(), { oobeCompleted: false, oobeRulesReviewed: true, platform: 'apple', appleMusicAppToken: 'existing-token', theme: 'custom', modsOnly: true });
  assert.deepEqual(f.events, ['draft', 'save', 'open', 'close']);
});
test('reopening then deferring does not reset previously completed setup', async () => {
  const f = fixture({ oobeCompleted: true });
  await finishSetup({ patch: { modsOnly: false }, deferred: true }, f.dependencies);
  assert.equal(f.saved().oobeCompleted, true);
  assert.equal(f.saved().modsOnly, false);
  assert.equal(f.saved().appleMusicAppToken, 'existing-token');
});
test('draft-save failure leaves the window open and completion unset', async () => {
  const f = fixture();
  await assert.rejects(finishSetup(finished, { ...f.dependencies, persistDraft: () => { throw new Error('disk full'); } }), /disk full/);
  assert.equal(f.saved().oobeCompleted, false);
  assert.deepEqual(f.events, []);
});
test('completion-save failure never opens the client or closes setup', async () => {
  const f = fixture();
  await assert.rejects(finishSetup(finished, { ...f.dependencies, save: () => { throw new Error('disk full'); } }), /disk full/);
  assert.equal(f.saved().oobeCompleted, false);
  assert.deepEqual(f.events, ['draft']);
});
test('client launch failure rolls back the completion flag and keeps setup open', async () => {
  const f = fixture();
  await assert.rejects(finishSetup(finished, { ...f.dependencies, openClient: async () => { throw new Error('launch failed'); } }), /launch failed/);
  assert.equal(f.saved().oobeCompleted, false);
  assert.equal(f.events.includes('close'), false);
});
test('local readiness is checked after the remote account check finishes', async () => {
  const f = fixture();
  let connected = true;
  await assert.rejects(finishSetup(finished, {
    ...f.dependencies,
    status: () => ({ ...healthy, cloud: connected }),
    connections: async () => { connected = false; return { twitch: { connected: true } }; },
  }));
  assert.equal(f.saved().oobeCompleted, false);
});
test('completion requires fresh backend checks, rules review, and both user confirmations', async () => {
  for (const field of ['cloud', 'music', 'overlay']) {
    const f = fixture();
    await assert.rejects(finishSetup(finished, { ...f.dependencies, status: () => ({ ...healthy, [field]: false }) }));
    assert.equal(f.saved().oobeCompleted, false);
    assert.equal(f.events.includes('close'), false);
  }
  for (const options of [{ ...finished, overlayConfirmed: false }, { ...finished, requestConfirmed: false }]) {
    const f = fixture();
    await assert.rejects(finishSetup(options, f.dependencies));
  }
  await assert.rejects(finishSetup(finished, fixture({ oobeRulesReviewed: false }).dependencies));
  const f = fixture();
  await finishSetup(finished, f.dependencies);
  assert.equal(f.saved().oobeCompleted, true);
});
test('unlinked and expired accounts cannot pass readiness', () => {
  assert.equal(hasLinkedChannel(null), false);
  assert.equal(hasLinkedChannel({ twitch: { connected: true, expired: true } }), false);
  assert.equal(hasLinkedChannel({ patreon: { connected: true } }), false);
  assert.equal(hasLinkedChannel({ twitch: { connected: true, expired: true }, youtube: { connected: true }, experimentalAccess: true }), true);
  assert.equal(setupReady(healthy, false, true), false);
  assert.equal(setupReady({ ...healthy, request: { accepted: false } }, true, true), false);
});
test('setup accepts only owned fields and rejects invalid limits and platform values', () => {
  assert.deepEqual(setupPatch({ oobeCompleted: true, unrelated: 'reset', modsOnly: false, ciderV4AppToken: 'new' }), { modsOnly: false, ciderV4AppToken: 'new' });
  for (const requestLimit of [0, -1, 1.5, Infinity, NaN, '10']) assert.throws(() => setupPatch({ requestLimit }));
  assert.throws(() => setupPatch({ platform: 'unknown' }));
  assert.throws(() => setupPatch({ ciderApiVersion: '5' }));
  assert.throws(() => setupPatch({ enableRequests: 'false' }));
  assert.deepEqual(setupPatch({ requestLimit: 2 }), { requestLimit: 2 });
});
test('request test ignores earlier, unrelated, and expired responses', () => {
  let now = 100;
  const check = new SetupRequestCheck(() => now);
  const response = { type: 'song_request_response', msgID: 'one', message: 'OKAY_SP_QUEUED' };
  check.observe('one');
  check.start();
  check.respond(response);
  assert.equal(check.result, null);
  check.observe('one');
  check.respond({ ...response, msgID: 'other' });
  assert.equal(check.result, null);
  check.respond({ ...response, message: 'ERR_MODS_ONLY' });
  assert.equal(check.result.accepted, false);
  check.respond(response);
  assert.equal(check.result.accepted, true);
  check.start();
  check.observe('one');
  now += 300001;
  check.respond(response);
  assert.equal(check.result, null);
  check.reset();
  assert.equal(check.result, null);
});
test('search results are not treated as accepted queue requests', () => {
  const check = new SetupRequestCheck(() => 100);
  check.start();
  check.observe('search');
  check.respond({ type: 'song_search_response', msgID: 'search', message: 'OKAY_SP_SEARCH' });
  assert.equal(check.result.accepted, false);
});
test('all setup strings and interpolation variables exist in all supported languages', () => {
  const read = locale => JSON.parse(fs.readFileSync(new URL(`../src/locales/${locale}.json`, import.meta.url), 'utf8'));
  const en = read('en');
  const keys = Object.keys(en).filter(key => key.startsWith('SETUP_'));
  for (const locale of ['de', 'es', 'fr', 'pt']) {
    const strings = read(locale);
    for (const key of keys) {
      assert.ok(strings[key], `${locale}: ${key}`);
      assert.deepEqual(strings[key].match(/\{\w+\}/g)?.sort(), en[key].match(/\{\w+\}/g)?.sort(), `${locale}: ${key} placeholders`);
    }
  }
});

test('the local overlay is served before completion and the setup preview cannot satisfy OBS detection', async () => {
  const require = createRequire(import.meta.url);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'requestplus-oobe-test-'));
  const overlayDirectory = path.join(directory, 'overlay');
  fs.mkdirSync(overlayDirectory);
  fs.writeFileSync(path.join(overlayDirectory, 'overlay.html'), '<!doctype html><title>Test overlay</title>');
  let server;
  const actualExpress = require('express');
  const express = Object.assign(() => {
    const application = actualExpress();
    const listen = application.listen.bind(application);
    application.listen = (...args) => { server = listen(...args); return server; };
    return application;
  }, actualExpress);
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/apiHandler.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const mockedRequire = id => id === 'electron' ? { app: { getPath: () => directory } }
    : id === 'express' ? express
    : id === './localPorts' ? { LOCAL_API_PORTS: [0], LOCAL_LOOPBACK_HOST: '127.0.0.1' }
    : require(id);
  new Function('require', 'exports', 'module', code)(mockedRequire, module.exports, module);
  try {
    const handler = new module.exports.default(
      { isDestroyed: () => false, webContents: { send() {} } },
      { currentSong: { title: 'Local test', artist: 'Fixture' } },
      { info() {}, warn() {}, error() {} },
      { theme: 'default' },
    );
    await new Promise(resolve => server.listening ? resolve() : server.once('listening', resolve));
    const preview = handler.getOverlayPreviewUrl();
    const origin = new URL(preview).origin;
    assert.match(preview, /\/overlay\/overlay\.html\?preview=1$/);
    assert.match(await (await fetch(preview)).text(), /Test overlay/);
    assert.equal(handler.isOverlayConnected(), false);
    const info = await (await fetch(`${origin}/info?source=setup-preview`)).json();
    assert.equal(info.title, 'Local test');
    assert.equal(handler.isOverlayConnected(), false);
    await fetch(`${origin}/info?source=overlay`);
    assert.equal(handler.isOverlayConnected(), true);
    handler.updateSettings({ theme: 'nowplaying-gojo' });
    assert.equal((await (await fetch(`${origin}/settings`)).json()).theme, 'nowplaying-gojo');
    // One consumer can consume the legacy refresh flag, but every consumer gets the theme.
    for (const source of ['overlay', 'setup-preview', 'overlay']) {
      const response = await (await fetch(`${origin}/info?source=${source}`)).json();
      assert.equal(response.theme, 'nowplaying-gojo');
    }
    assert.match((await fetch(preview)).headers.get('cache-control'), /no-store/);

  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    fs.unlinkSync(path.join(overlayDirectory, 'overlay.html'));
    fs.rmdirSync(overlayDirectory);
    fs.rmdirSync(directory);
  }
});

test('a partial disk write cannot replace previously saved settings', () => {
  const require = createRequire(import.meta.url);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'requestplus-settings-test-'));
  const settingsPath = path.join(directory, 'settings.json');
  const original = JSON.stringify({ theme: 'custom', platform: 'apple', appleMusicAppToken: 'preserve-me', oobeCompleted: false });
  fs.writeFileSync(settingsPath, original);
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/settingsHandler.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const failedFs = { ...fs, writeFileSync(target) { fs.writeFileSync(target, 'partial'); throw new Error('Disk full'); } };
  new Function('require', 'exports', 'module', 'console', code)(id => id === 'node:fs' ? failedFs : require(id), module.exports, module, { error() {} });
  try {
    const handler = new module.exports.default(directory);
    assert.equal(handler.save({ ...handler.load(), oobeCompleted: true }), false);
    assert.equal(fs.readFileSync(settingsPath, 'utf8'), original);
    assert.deepEqual(fs.readdirSync(directory), ['settings.json']);
  } finally {
    fs.unlinkSync(settingsPath);
    fs.rmdirSync(directory);
  }
});


test('experimental chat visibility and completion require server-granted access', async () => {
  for (const experimentalAccess of [undefined, false, true]) {
    const connections = { experimentalAccess, youtube: { connected: true }, velora: { connected: true } };
    assert.deepEqual(setupChatPlatforms(connections).map(p => p.key), experimentalAccess === true ? ['twitch', 'kick', 'youtube', 'velora'] : ['twitch', 'kick']);
    assert.equal(hasLinkedChannel(connections), experimentalAccess === true);
  }
  assert.deepEqual(setupChatPlatforms(null).map(p => p.key), ['twitch', 'kick']);
  for (const key of ['youtube', 'velora']) {
    for (const access of [false, true]) {
      const f = fixture();
      const dependencies = { ...f.dependencies, connections: async () => ({ experimentalAccess: access, [key]: { connected: true } }) };
      if (access) {
        await finishSetup(finished, dependencies);
        assert.equal(f.saved().oobeCompleted, true);
      } else {
        await assert.rejects(finishSetup(finished, dependencies));
        assert.equal(f.saved().oobeCompleted, false);
      }
    }
    assert.equal(hasLinkedChannel({ experimentalAccess: true, [key]: { connected: true, expired: true } }), false);
    assert.equal(hasLinkedChannel({ experimentalAccess: true, [key]: { connected: false } }), false);
  }
});


test('overlay preview fits legacy, tall, and offset artwork in both viewport dimensions', () => {
  const html = fs.readFileSync(new URL('../src/views/overlay.html', import.meta.url), 'utf8');
  const script = html.slice(html.indexOf("        if (new URLSearchParams(location.search).has('preview'))"), html.indexOf('        var songProgress'));
  for (const [viewportWidth, viewportHeight] of [[640, 200], [280, 200]]) {
    for (const [left, top, width, height] of [[20, 20, 600, 200], [20, 100, 570, 100], [0, 0, 360, 400]]) {
      const rect = { left, top, width, height, right: left + width, bottom: top + height };
      const artwork = { left, top: top - 100, width: 200, height: 200, right: left + 200, bottom: top + 100 };
      const root = { getBoundingClientRect: () => rect, querySelectorAll: () => [{ getBoundingClientRect: () => artwork }] };
      const host = { style: {}, firstElementChild: root };
      vm.runInNewContext(script, {
        URLSearchParams, location: { search: '?preview=1' },
        document: { getElementById: id => id === 'body-container' ? host : { addEventListener() {} }, documentElement: { style: {} }, body: { style: {} }, fonts: { ready: { then() {} } } },
        window: { innerWidth: viewportWidth, innerHeight: viewportHeight, addEventListener() {} },
        requestAnimationFrame: callback => { callback(); return 1; }, cancelAnimationFrame() {},
        ResizeObserver: class { observe() {} disconnect() {} }, MutationObserver: class { observe() {} },
      });
      assert.equal(host.style.height, '100vh', 'absolute-positioned themes need a nonzero preview container');
      const [, x, y, scale] = host.style.transform.match(/translate\(([-.\d]+)px, ([-.\d]+)px\) scale\(([-.\d]+)\)/).map(Number);
      for (const box of [rect, artwork]) {
        assert.ok(x + box.left * scale >= 11.99);
        assert.ok(y + box.top * scale >= 11.99);
        assert.ok(x + box.right * scale <= viewportWidth - 11.99);
        assert.ok(y + box.bottom * scale <= viewportHeight - 11.99);
      }
    }
  }
});


test('setup persists a chosen overlay theme without replacing other preferences', async () => {
  const f = fixture();
  await finishSetup({ patch: { theme: 'nowplaying-gojo' }, deferred: true }, f.dependencies);
  assert.equal(f.saved().theme, 'nowplaying-gojo');
  assert.equal(f.saved().appleMusicAppToken, 'existing-token');
  assert.equal(f.saved().platform, 'apple');
  assert.throws(() => setupPatch({ theme: '../../unknown.css' }), /Invalid overlay theme/);
});


test('new installations require OOBE until completion is explicitly saved', () => {
  const require = createRequire(import.meta.url);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'requestplus-first-install-'));
  const settingsPath = path.join(directory, 'settings.json');
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/settingsHandler.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'exports', 'module', 'console', code)(require, module.exports, module, { error() {} });
  try {
    const handler = new module.exports.default(directory);
    assert.equal(handler.load().oobeCompleted, false, 'no settings file means a fresh installation');
    for (const contents of ['{}', '{"theme":"custom"}', '{"oobeCompleted":false}', '{"oobeCompleted":"true"}', '{"oobeCompleted":1}', 'null', 'broken json']) {
      fs.writeFileSync(settingsPath, contents);
      assert.equal(handler.load().oobeCompleted, false, contents);
    }
    assert.equal(handler.save({ ...handler.load(), oobeCompleted: true }), true);
    assert.equal(new module.exports.default(directory).load().oobeCompleted, true, 'completed setup survives a restart');
    fs.unlinkSync(settingsPath);
    assert.equal(handler.load().oobeCompleted, false, 'reset installation opens setup again');
  } finally {
    if (fs.existsSync(settingsPath)) fs.unlinkSync(settingsPath);
    fs.rmdirSync(directory);
  }
});


test('normal and auth-link startup initialize logging before creating local services', async () => {
  const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const start = main.indexOf('app.whenReady().then(async () => {');
  const callback = main.slice(start, main.indexOf('\n});', start) + 4);
  const compiled = ts.transpileModule(callback, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const ISAUTHING of [false, true]) {
    const events = [];
    let startup;
    const context = {
      global: { ISAUTHING }, Logger: null,
      logger: class { constructor(enabled) { this.enabled = enabled; events.push(enabled ? 'logger' : 'silent logger'); } warn() { if (this.enabled) events.push('fallback warning'); } },
      app: { whenReady: () => ({ then: callback => { startup = callback(); } }) },
      createWindow: async () => { context.Logger.warn('port occupied'); assert.equal(context.global.Logger, context.Logger); events.push('window'); },
    };
    vm.runInNewContext(compiled, context);
    await startup;
    assert.deepEqual(events, ISAUTHING ? ['silent logger', 'window'] : ['logger', 'fallback warning', 'window']);
  }
});


test('disabled auth logger never accesses Electron paths or the filesystem', async () => {
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/logger.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const forbidden = new Proxy({}, { get() { throw new Error('Auth logger accessed filesystem or Electron'); } });
  new Function('require', 'exports', 'module', code)(id => id === 'electron' ? { app: forbidden } : forbidden, module.exports, module);
  const logger = new module.exports.default(false);
  const circular = {}; circular.self = circular;
  logger.info(circular);
  logger.warn('port occupied');
  logger.error('connection failed');
  await logger.clearLogs();
  await logger.clearLogFolder();
});
