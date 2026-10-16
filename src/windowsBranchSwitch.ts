export interface WindowsBranchSwitchOptions {
    updateExecutable: string;
    installerPath: string;
    parentPid: number;
    launchExecutable: string;
    logPath: string;
}

/**
 * Encode the script as UTF-16LE and keep all dynamic values out of the command
 * line so Windows PowerShell never has to re-parse Squirrel paths containing
 * spaces and plus signs.
 */
export function windowsBranchSwitchArguments(): string[] {
    return [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        Buffer.from(WINDOWS_BRANCH_SWITCH_SCRIPT, 'utf16le').toString('base64'),
    ];
}

export function windowsBranchSwitchEnvironment(options: WindowsBranchSwitchOptions): NodeJS.ProcessEnv {
    return {
        REQUESTPLUS_SWITCH_UPDATE_EXE: options.updateExecutable,
        REQUESTPLUS_SWITCH_INSTALLER: options.installerPath,
        REQUESTPLUS_SWITCH_PARENT_PID: String(options.parentPid),
        REQUESTPLUS_SWITCH_LAUNCH_EXE: options.launchExecutable,
        REQUESTPLUS_SWITCH_LOG: options.logPath,
    };
}

/**
 * Squirrel's uninstaller may hand work to a child process and return before the
 * old app directory is gone. Starting the other branch's installer at that
 * point makes Squirrel keep launching the old (higher-version) branch. The
 * helper waits for both Request+ and the old app directories before installing.
 */
export const WINDOWS_BRANCH_SWITCH_SCRIPT = [
    '$UpdateExe = $env:REQUESTPLUS_SWITCH_UPDATE_EXE',
    '$InstallerPath = $env:REQUESTPLUS_SWITCH_INSTALLER',
    '$ParentPid = [int]$env:REQUESTPLUS_SWITCH_PARENT_PID',
    '$LaunchExe = $env:REQUESTPLUS_SWITCH_LAUNCH_EXE',
    '$LogPath = $env:REQUESTPLUS_SWITCH_LOG',
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
