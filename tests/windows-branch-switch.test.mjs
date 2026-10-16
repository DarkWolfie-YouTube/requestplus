import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/windowsBranchSwitch.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { WINDOWS_BRANCH_SWITCH_SCRIPT: script, windowsBranchSwitchArguments: args } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('branch switch passes paths as distinct named PowerShell parameters', () => {
  const values = args({
    helperPath: 'C:\\Temp Folder\\switch-to-feat.ps1',
    updateExecutable: 'C:\\Request Plus\\Update.exe',
    installerPath: 'C:\\Temp Folder\\Request+-3.2.1 Setup.exe',
    parentPid: 1234,
    launchExecutable: 'C:\\Request Plus\\Request+.exe',
    logPath: 'C:\\Temp Folder\\switch-to-feat.log',
  });
  assert.deepEqual(values.slice(-10), [
    '-UpdateExe', 'C:\\Request Plus\\Update.exe',
    '-InstallerPath', 'C:\\Temp Folder\\Request+-3.2.1 Setup.exe',
    '-ParentPid', '1234',
    '-LaunchExe', 'C:\\Request Plus\\Request+.exe',
    '-LogPath', 'C:\\Temp Folder\\switch-to-feat.log',
  ]);
});

test('branch switch waits for the old installation before installing and relaunching', () => {
  const waitForParent = script.indexOf('Wait-Process -Id $ParentPid');
  const uninstall = script.indexOf('$uninstall = Start-Process');
  const waitForOldApps = script.indexOf('$remaining = @($oldAppDirs');
  const install = script.indexOf('$install = Start-Process');
  const relaunch = script.indexOf('Start-Process -FilePath $LaunchExe');
  assert.ok(waitForParent >= 0);
  assert.ok(waitForParent < uninstall);
  assert.ok(uninstall < waitForOldApps);
  assert.ok(waitForOldApps < install);
  assert.ok(install < relaunch);
  assert.match(script, /Branch switch failed:/);
  assert.match(script, /Restarting the existing Request\+ installation/);
});
