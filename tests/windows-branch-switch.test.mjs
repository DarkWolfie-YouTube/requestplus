import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/windowsBranchSwitch.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const {
  WINDOWS_BRANCH_SWITCH_SCRIPT: script,
  windowsBranchSwitchArguments: args,
  windowsBranchSwitchEnvironment: environment,
} =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('branch switch keeps dynamic paths out of the PowerShell command line', () => {
  const options = {
    updateExecutable: 'C:\\Request Plus\\Update.exe',
    installerPath: 'C:\\Temp Folder\\Request+-3.2.1 Setup.exe',
    parentPid: 1234,
    launchExecutable: 'C:\\Request Plus\\Request+.exe',
    logPath: 'C:\\Temp Folder\\switch-to-feat.log',
  };
  const values = args();
  assert.equal(values.at(-2), '-EncodedCommand');
  assert.ok(values.at(-1).length > 0);
  assert.ok(!values.join(' ').includes('Request Plus'));
  assert.deepEqual(environment(options), {
    REQUESTPLUS_SWITCH_UPDATE_EXE: options.updateExecutable,
    REQUESTPLUS_SWITCH_INSTALLER: options.installerPath,
    REQUESTPLUS_SWITCH_PARENT_PID: '1234',
    REQUESTPLUS_SWITCH_LAUNCH_EXE: options.launchExecutable,
    REQUESTPLUS_SWITCH_LOG: options.logPath,
  });
});

test('branch switch waits for the old installation before installing and relaunching', () => {
  const readyLog = script.indexOf('Write-SwitchLog "Waiting for Request+ process');
  const waitForParent = script.indexOf('Wait-Process -Id $ParentPid');
  const uninstall = script.indexOf('$uninstall = Start-Process');
  const waitForOldApps = script.indexOf('$remaining = @($oldAppDirs');
  const install = script.indexOf('$install = Start-Process');
  const relaunch = script.indexOf('Start-Process -FilePath $LaunchExe');
  assert.ok(readyLog >= 0);
  assert.ok(readyLog < waitForParent);
  assert.ok(waitForParent < uninstall);
  assert.ok(uninstall < waitForOldApps);
  assert.ok(waitForOldApps < install);
  assert.ok(install < relaunch);
  assert.match(script, /Branch switch failed:/);
  assert.match(script, /Restarting the existing Request\+ installation/);
});

test('branch switch helper writes its startup log when launched hidden', { skip: process.platform !== 'win32' }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'requestplus-switch-test-'));
  const logPath = path.join(directory, 'switch.log');
  const options = {
    updateExecutable: path.join(directory, 'missing', 'Update.exe'),
    installerPath: path.join(directory, 'Request+ Setup.exe'),
    parentPid: 2147483646,
    launchExecutable: path.join(directory, 'missing', 'RequestPlus.exe'),
    logPath,
  };

  try {
    const child = spawn('powershell.exe', args(), {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, ...environment(options) },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    const exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    assert.equal(exitCode, 1, `stdout=${stdout}\nstderr=${stderr}`);
    assert.match(fs.readFileSync(logPath, 'utf8'), /Waiting for Request\+ process/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
