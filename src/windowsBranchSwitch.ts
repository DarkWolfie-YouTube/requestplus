export interface WindowsBranchSwitchOptions {
    helperPath: string;
    updateExecutable: string;
    installerPath: string;
    parentPid: number;
    launchExecutable: string;
    logPath: string;
}

/**
 * Keep every path as its own PowerShell argument. Besides handling spaces and
 * plus signs correctly, named parameters make a detached helper much easier to
 * diagnose than interpolating paths into a command string.
 */
export function windowsBranchSwitchArguments(options: WindowsBranchSwitchOptions): string[] {
    return [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        options.helperPath,
        '-UpdateExe',
        options.updateExecutable,
        '-InstallerPath',
        options.installerPath,
        '-ParentPid',
        String(options.parentPid),
        '-LaunchExe',
        options.launchExecutable,
        '-LogPath',
        options.logPath,
    ];
}

/**
 * Squirrel's uninstaller may hand work to a child process and return before the
 * old app directory is gone. Starting the other branch's installer at that
 * point makes Squirrel keep launching the old (higher-version) branch. The
 * helper waits for both Request+ and the old app directories before installing.
 */
export const WINDOWS_BRANCH_SWITCH_SCRIPT = [
    'param(',
    '    [Parameter(Mandatory=$true)][string]$UpdateExe,',
    '    [Parameter(Mandatory=$true)][string]$InstallerPath,',
    '    [Parameter(Mandatory=$true)][int]$ParentPid,',
    '    [Parameter(Mandatory=$true)][string]$LaunchExe,',
    '    [Parameter(Mandatory=$true)][string]$LogPath',
    ')',
    "$ErrorActionPreference = 'Stop'",
    'function Write-SwitchLog([string]$Message) {',
    '    Add-Content -LiteralPath $LogPath -Value ("[{0:o}] {1}" -f (Get-Date), $Message) -Encoding UTF8',
    '}',
    'try {',
    '    Write-SwitchLog "Waiting for Request+ process $ParentPid to exit"',
    '    try {',
    '        Wait-Process -Id $ParentPid -Timeout 60 -ErrorAction Stop',
    '    } catch {',
    '        if (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue) { throw }',
    '    }',
    '    $installRoot = Split-Path -Parent $UpdateExe',
    '    $oldAppDirs = @(Get-ChildItem -LiteralPath $installRoot -Directory -Filter "app-*" -ErrorAction SilentlyContinue | ForEach-Object FullName)',
    '    Write-SwitchLog "Uninstalling the current branch with $UpdateExe"',
    '    $uninstall = Start-Process -FilePath $UpdateExe -ArgumentList @("--uninstall", "--silent") -WindowStyle Hidden -Wait -PassThru',
    '    if ($uninstall.ExitCode -ne 0) { throw "Request+ uninstall failed with exit code $($uninstall.ExitCode)" }',
    '    $deadline = (Get-Date).AddSeconds(90)',
    '    do {',
    '        $remaining = @($oldAppDirs | Where-Object { Test-Path -LiteralPath $_ })',
    '        if ($remaining.Count -eq 0) { break }',
    '        Start-Sleep -Milliseconds 500',
    '    } while ((Get-Date) -lt $deadline)',
    '    if ($remaining.Count -ne 0) { throw "The old Request+ app directory was not removed: $($remaining -join ", ")" }',
    '    Write-SwitchLog "Installing the selected branch from $InstallerPath"',
    '    $install = Start-Process -FilePath $InstallerPath -ArgumentList @("--silent") -WindowStyle Hidden -Wait -PassThru',
    '    if ($install.ExitCode -ne 0) { throw "Request+ install failed with exit code $($install.ExitCode)" }',
    '    $deadline = (Get-Date).AddSeconds(90)',
    '    while (-not (Test-Path -LiteralPath $LaunchExe) -and (Get-Date) -lt $deadline) {',
    '        Start-Sleep -Milliseconds 500',
    '    }',
    '    if (-not (Test-Path -LiteralPath $LaunchExe)) { throw "Request+ was installed but its launcher was not created" }',
    '    Write-SwitchLog "Branch switch completed; starting $LaunchExe"',
    '    Start-Process -FilePath $LaunchExe',
    '    exit 0',
    '} catch {',
    '    Write-SwitchLog ("Branch switch failed: " + $_.Exception.Message)',
    '    if (Test-Path -LiteralPath $LaunchExe) {',
    '        Write-SwitchLog "Restarting the existing Request+ installation"',
    '        Start-Process -FilePath $LaunchExe',
    '    }',
    '    exit 1',
    '}',
    '',
].join('\r\n');
