import { app, BrowserWindow, shell } from 'electron';
import fetch from 'node-fetch';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import * as fs from 'fs';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import * as path from 'path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as wait } from 'node:timers/promises';
import { checkForNativeUpdate } from './nativeUpdater';

declare const __REQUESTPLUS_RELEASE_CHANNEL__: string;

const UPDATE_SERVER_URL = 'https://updates.requestplus.xyz/v1/updates/check';
const UPDATE_CHANNELS_URL = 'https://updates.requestplus.xyz/v1/updates/channels';
const UPDATE_REQUEST_TIMEOUT_MS = 10_000;
const COMPILED_UPDATE_CHANNEL = typeof __REQUESTPLUS_RELEASE_CHANNEL__ === 'string'
    ? __REQUESTPLUS_RELEASE_CHANNEL__
    : 'stable';
const INSTALLED_UPDATE_CHANNEL = validChannel(COMPILED_UPDATE_CHANNEL)
    ? COMPILED_UPDATE_CHANNEL
    : 'stable';

// Type definitions
interface UpdateSettings {
    checkPreReleases: boolean;
    channel: string;
    [key: string]: any;
}

interface UpdateServerRelease {
    version: string;
    publishedAt: string;
    fileName: string;
    downloadUrl: string;
    sha256: string | null;
    size: number;
    format: string;
}

interface UpdateServerResponse {
    product: 'Request+';
    currentVersion: string;
    channel: string;
    platform: string;
    arch: string;
    updateAvailable: boolean;
    latestVersion: string | null;
    mandatory: boolean;
    reason: 'update-available' | 'up-to-date' | 'ahead' | 'no-compatible-release';
    release: UpdateServerRelease | null;
}

interface ToastMessage {
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
    duration: number;
}

interface Logger {
    info(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
}

interface VersionParsed {
    base: number[];
    isBeta: boolean;
    preRelease: number;
}

let settings: UpdateSettings = {
    checkPreReleases: false,
    channel: 'stable'
};

// ── Web-UI modal helpers ────────────────────────────────────────────────────

const pendingModals = new Map<string, (response: number) => void>();

/** Send a modal to the renderer and resolve with the index of the button clicked. */
function sendModal(window: BrowserWindow | null, title: string, message: string, buttons: string[]): Promise<number> {
    return new Promise((resolve) => {
        if (!window || window.isDestroyed()) {
            resolve(0);
            return;
        }
        const id = Math.random().toString(36).substring(2);
        pendingModals.set(id, resolve);
        window.webContents.send('show-modal', { id, title, message, buttons });
    });
}

/** Called from main.ts when the renderer sends back a modal-response event. */
export function resolveModal(id: string, response: number): void {
    const resolver = pendingModals.get(id);
    if (resolver) {
        resolver(response);
        pendingModals.delete(id);
    }
}

/** Shared terms-of-service modal flow used for both first-run and updates. */
async function showTermsFlow(window: BrowserWindow | null, termsUrl: string, termsVersion: string): Promise<void> {
    const result = await sendModal(
        window,
        'Terms of Service Update',
        'The Terms of Service have been updated. Please review and accept the new terms to continue using the application.',
        ['Accept', 'View Terms', 'Decline']
    );
    if (result === 0) {
        fs.writeFileSync(path.join(app.getPath('userData'), 'terms-version.txt'), termsVersion, 'utf8');
        await sendToastWithDelay(window, 'Terms accepted. Thank you!', 'success', 5000, 100);
    } else if (result === 1) {
        await shell.openExternal(termsUrl);
        const acceptResult = await sendModal(
            window,
            'Terms of Service Update',
            'Have you accepted the updated Terms of Service?',
            ['Accept', 'Decline']
        );
        if (acceptResult === 0) {
            fs.writeFileSync(path.join(app.getPath('userData'), 'terms-version.txt'), termsVersion, 'utf8');
            await sendToastWithDelay(window, 'Terms accepted. Thank you!', 'success', 5000, 100);
        } else {
            app.quit();
        }
    } else {
        app.quit();
    }
}

// Load settings
function loadSettings(): void {
    try {
        const settingsPath = path.join(app.getPath('userData'), 'update-settings.json');
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            const saved = JSON.parse(data) as Partial<UpdateSettings>;
            settings = {
                ...settings,
                ...saved,
                channel: validChannel(saved.channel)
                    ? saved.channel
                    : saved.checkPreReleases
                        ? 'beta'
                        : 'stable'
            };
        }
    } catch (error) {
        console.error('Error loading update settings:', error);
    }
}

// Save settings
function saveSettings(): void {
    try {
        const settingsPath = path.join(app.getPath('userData'), 'update-settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify(settings), 'utf8');
    } catch (error) {
        console.error('Error saving update settings:', error);
    }
}

// Helper function to send toast to renderer with proper error handling
function sendToast(window: BrowserWindow | null, message: string, type: ToastMessage['type'] = 'info', duration: number = 5000): void {
    if (!window || window.isDestroyed()) {
        console.warn('Cannot send toast - window is null or destroyed');
        return;
    }

    try {
        // Create a plain object to ensure serializability
        const toastMessage = {
            message: String(message),
            type: String(type),
            duration: Number(duration)
        };

        
        // Send each property separately to avoid serialization issues
        window.webContents.send('show-toast', toastMessage.message, toastMessage.type, toastMessage.duration);
    } catch (error) {
        console.error('Error sending toast:', error);
        
        // Fallback: try sending just the message
        try {
            window.webContents.send('show-toast', String(message), 'info', 5000);
        } catch (fallbackError) {
            console.error('Fallback toast also failed:', fallbackError);
        }
    }
}

// Add a small delay between toasts to ensure they're properly displayed
async function sendToastWithDelay(window: BrowserWindow | null, message: string, type: ToastMessage['type'] = 'info', duration: number = 5000, delay: number = 100): Promise<void> {
    await wait(delay);
    sendToast(window, message, type, duration);
}

function getUpdateTarget(): { platform: string; arch: string } {
    const platforms: Partial<Record<NodeJS.Platform, string>> = {
        aix: 'aix',
        android: 'android',
        darwin: 'macos',
        freebsd: 'freebsd',
        haiku: 'haiku',
        linux: 'linux',
        openbsd: 'openbsd',
        sunos: 'sunos',
        win32: 'windows'
    };
    const architectures: Record<string, string> = {
        arm64: 'arm64',
        ia32: 'x86',
        x64: 'x64'
    };
    return {
        platform: platforms[process.platform] ?? process.platform,
        arch: architectures[process.arch] ?? process.arch
    };
}

async function requestUpdate(
    currentVersion: string,
    channel: string,
    logger: Logger,
    forceArtifact = false
): Promise<UpdateServerResponse> {
    const target = getUpdateTarget();
    const endpoint = new URL(UPDATE_SERVER_URL);
    // The update service intentionally omits the artifact when versions match.
    // Query from a baseline version when changing feeds so a same-version branch
    // build can still be downloaded and installed.
    endpoint.searchParams.set('currentVersion', forceArtifact ? '0.0.0' : currentVersion);
    endpoint.searchParams.set('platform', target.platform);
    endpoint.searchParams.set('arch', target.arch);
    endpoint.searchParams.set('channel', channel);

    const response = await fetch(endpoint, {
        headers: { 'User-Agent': `RequestPlus/${currentVersion} UpdateChecker` },
        signal: AbortSignal.timeout(UPDATE_REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) {
        throw new Error(`Update server returned HTTP ${response.status} for ${channel}`);
    }

    const data = await response.json() as UpdateServerResponse;
    if (
        data?.product !== 'Request+' ||
        typeof data.updateAvailable !== 'boolean' ||
        (data.updateAvailable && (!data.release?.downloadUrl || !data.latestVersion))
    ) {
        throw new Error(`Update server returned an invalid response for ${channel}`);
    }
    logger.info(
        `Update server ${channel} result: ${data.reason}` +
        (data.latestVersion ? ` (${data.latestVersion})` : '') +
        (forceArtifact ? ' [branch switch]' : '')
    );
    return data;
}

async function getAvailableUpdateChannels(): Promise<string[]> {
    const response = await fetch(UPDATE_CHANNELS_URL, {
        headers: { 'User-Agent': `RequestPlus/${app.getVersion()} UpdateChannelPicker` },
        signal: AbortSignal.timeout(UPDATE_REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) {
        throw new Error(`Update server returned HTTP ${response.status} while listing feeds`);
    }

    const data = await response.json() as { channels?: unknown };
    if (!Array.isArray(data.channels)) {
        throw new Error('Update server returned an invalid feed list');
    }
    const channels = [...new Set(data.channels.filter(validChannel))];
    if (channels.length === 0) {
        throw new Error('No update feeds are currently available');
    }
    return channels.sort(channelSort);
}

function selectNewestUpdate(responses: UpdateServerResponse[]): UpdateServerResponse | undefined {
    return responses
        .filter((response) => response.updateAvailable && response.release && response.latestVersion)
        .reduce<UpdateServerResponse | undefined>((selected, candidate) => {
            if (!selected?.latestVersion || compareVersions(selected.latestVersion, candidate.latestVersion!)) {
                return candidate;
            }
            return selected;
        }, undefined);
}

async function downloadAndInstallLinuxUpdate(
    release: UpdateServerRelease,
    window: BrowserWindow | null,
    logger: Logger
): Promise<void> {
    if (!release.sha256) {
        throw new Error('Linux update is missing its required SHA-256 checksum');
    }
    const downloadUrl = new URL(release.downloadUrl);
    if (downloadUrl.protocol !== 'https:') {
        throw new Error('Update server returned a non-HTTPS download URL');
    }

    const updateDirectory = path.join(app.getPath('temp'), 'requestplus-updates', release.version);
    await mkdir(updateDirectory, { recursive: true });
    const fileName = path.basename(release.fileName);
    const destination = path.join(updateDirectory, fileName);
    const response = await fetch(downloadUrl, {
        headers: { 'User-Agent': `RequestPlus/${app.getVersion()} LinuxUpdater` },
        signal: AbortSignal.timeout(30 * 60 * 1000)
    });
    if (!response.ok || !response.body) {
        throw new Error(`Update download returned HTTP ${response.status}`);
    }

    sendToast(window, `Downloading Request+ ${release.version}...`, 'info', 5000);
    const hash = createHash('sha256');
    const hashTransform = new Transform({
        transform(chunk, _encoding, callback) {
            hash.update(chunk);
            callback(null, chunk);
        }
    });

    try {
        await pipeline(response.body, hashTransform, createWriteStream(destination));
        const downloadedSize = (await stat(destination)).size;
        const downloadedHash = hash.digest('hex');
        if (downloadedSize !== release.size) {
            throw new Error(`Update size mismatch: expected ${release.size}, received ${downloadedSize}`);
        }
        if (downloadedHash.toLowerCase() !== release.sha256.toLowerCase()) {
            throw new Error('Update SHA-256 verification failed');
        }
    } catch (error) {
        await rm(destination, { force: true });
        throw error;
    }

    logger.info(`Verified Linux update package: ${destination}`);
    const choice = await sendModal(
        window,
        'Request+ Update Ready',
        `Request+ ${release.version} has been downloaded and verified. Open your system package installer now?`,
        ['Install', 'Later']
    );
    if (choice === 0) {
        const openError = await shell.openPath(destination);
        if (openError) {
            throw new Error(openError);
        }
        sendToast(window, 'Update opened in your system package installer.', 'success', 5000);
    }
}

async function downloadUpdatePackage(
    release: UpdateServerRelease,
    window: BrowserWindow | null,
    logger: Logger
): Promise<string> {
    if (!release.downloadUrl || !release.fileName) {
        throw new Error('Update server did not provide a downloadable artifact');
    }
    const downloadUrl = new URL(release.downloadUrl);
    if (downloadUrl.protocol !== 'https:') {
        throw new Error('Update server returned a non-HTTPS download URL');
    }

    const fileName = path.basename(release.fileName);
    if (fileName !== release.fileName || fileName === '.' || fileName === '..') {
        throw new Error('Update server returned an invalid artifact filename');
    }
    const updateDirectory = path.join(app.getPath('temp'), 'requestplus-updates', release.version);
    await mkdir(updateDirectory, { recursive: true });
    const destination = path.join(updateDirectory, fileName);
    const response = await fetch(downloadUrl, {
        headers: { 'User-Agent': `RequestPlus/${app.getVersion()} UpdateDownloader` },
        signal: AbortSignal.timeout(30 * 60 * 1000)
    });
    if (!response.ok || !response.body) {
        throw new Error(`Update download returned HTTP ${response.status}`);
    }

    const expectedSize = release.size > 0
        ? release.size
        : Number(response.headers.get('content-length') ?? 0);
    const hash = createHash('sha256');
    let downloaded = 0;
    let lastProgressAt = 0;
    const progress = new Transform({
        transform(chunk, _encoding, callback) {
            downloaded += chunk.length;
            hash.update(chunk);
            const now = Date.now();
            if (now - lastProgressAt >= 1000 || (expectedSize > 0 && downloaded >= expectedSize)) {
                lastProgressAt = now;
                const percent = expectedSize > 0 ? Math.min(100, downloaded / expectedSize * 100) : 0;
                logger.info(`Downloading ${fileName}: ${percent.toFixed(1)}% (${downloaded}/${expectedSize || '?'} bytes)`);
            }
            callback(null, chunk);
        }
    });

    sendToast(window, `Downloading Request+ ${release.version}...`, 'info', 5000);
    try {
        await pipeline(response.body, progress, createWriteStream(destination));
        const downloadedSize = (await stat(destination)).size;
        const downloadedHash = hash.digest('hex');
        if (expectedSize > 0 && downloadedSize !== expectedSize) {
            throw new Error(`Update size mismatch: expected ${expectedSize}, received ${downloadedSize}`);
        }
        if (release.sha256 && downloadedHash.toLowerCase() !== release.sha256.toLowerCase()) {
            throw new Error('Update SHA-256 verification failed');
        }
    } catch (error) {
        await rm(destination, { force: true });
        throw error;
    }

    logger.info(`Verified update package: ${destination}`);
    return destination;
}

function squirrelUpdateExecutable(): string | null {
    if (process.platform !== 'win32') return null;
    const updateExecutable = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
    return fs.existsSync(updateExecutable) ? updateExecutable : null;
}

async function scheduleWindowsBranchSwitch(
    installerPath: string,
    selectedChannel: string,
    logger: Logger
): Promise<void> {
    const updateExecutable = squirrelUpdateExecutable();
    if (!updateExecutable) {
        throw new Error('The Squirrel uninstaller could not be found for this installation');
    }
    if (path.extname(installerPath).toLowerCase() !== '.exe') {
        throw new Error('The selected Windows branch does not provide an executable installer');
    }

    const helperPath = path.join(
        app.getPath('temp'),
        'requestplus-updates',
        `switch-to-${selectedChannel}.ps1`
    );
    fs.writeFileSync(helperPath, [
        "$ErrorActionPreference = 'Stop'",
        'Start-Sleep -Seconds 2',
        "$uninstall = Start-Process -FilePath $args[0] -ArgumentList @('--uninstall', '--silent') -WindowStyle Hidden -PassThru",
        '$uninstall.WaitForExit()',
        "if ($uninstall.ExitCode -ne 0) { throw \"Request+ uninstall failed with exit code $($uninstall.ExitCode)\" }",
        'Start-Sleep -Seconds 2',
        'Start-Process -FilePath $args[1]'
    ].join('\r\n'), 'utf8');

    await new Promise<void>((resolve, reject) => {
        const helper = spawn(
            'powershell.exe',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', helperPath, updateExecutable, installerPath],
            { detached: true, stdio: 'ignore', windowsHide: true }
        );
        helper.once('error', reject);
        helper.once('spawn', () => {
            helper.unref();
            resolve();
        });
    });
    logger.info(`Scheduled reinstall from ${INSTALLED_UPDATE_CHANNEL} to ${selectedChannel}`);
    app.quit();
}

async function openUpdateInstaller(
    destination: string,
    selected: UpdateServerResponse,
    switchingChannel: boolean,
    window: BrowserWindow | null,
    logger: Logger
): Promise<void> {
    const selectedChannel = selected.channel;
    const releaseVersion = selected.latestVersion ?? selected.release?.version ?? app.getVersion();
    const squirrelSwitch = switchingChannel &&
        squirrelUpdateExecutable() !== null &&
        !compareVersions(app.getVersion(), releaseVersion);
    const choice = await sendModal(
        window,
        switchingChannel ? 'Switch Request+ Update Feed' : 'Request+ Update Ready',
        squirrelSwitch
            ? `Request+ will close, remove the ${INSTALLED_UPDATE_CHANNEL} build, and install the ${selectedChannel} build (${releaseVersion}). Your settings will be kept.`
            : switchingChannel
                ? `The ${selectedChannel} build (${releaseVersion}) has been downloaded and verified. Open its installer now?`
                : `Request+ ${releaseVersion} has been downloaded and verified. Open the installer now?`,
        [squirrelSwitch ? 'Restart and switch' : 'Open installer', 'Later']
    );
    if (choice !== 0) {
        await sendToastWithDelay(window, 'Update downloaded. You can install it from your temporary files.', 'info', 5000, 100);
        return;
    }

    if (squirrelSwitch) {
        await scheduleWindowsBranchSwitch(destination, selectedChannel, logger);
        return;
    }

    const openError = await shell.openPath(destination);
    if (openError) throw new Error(openError);
    await sendToastWithDelay(window, 'Update installer opened.', 'success', 3000, 100);
}

async function checkForUpdates(window: BrowserWindow | null, logger: Logger): Promise<void> {
    try {
        // Load current settings
        logger.info('Checking for updates...');
        loadSettings();

        // Send initial checking toast
        sendToast(window, 'Checking for updates...', 'info', 3000);

        const currentVersion = app.getVersion();
        const selectedChannel = validChannel(settings.channel)
            ? settings.channel
            : settings.checkPreReleases
                ? 'beta'
                : 'stable';
        const channels = [selectedChannel];
        const nativeBranch = selectedChannel;
        const switchingChannel = selectedChannel !== INSTALLED_UPDATE_CHANNEL;
        logger.info(
            `Using update feed: ${selectedChannel}; installed feed: ${INSTALLED_UPDATE_CHANNEL}` +
            (switchingChannel ? '; branch reinstall required' : '')
        );
        if (process.windowsStore || process.mas) {
            const storeName = process.windowsStore ? 'Microsoft Store' : 'Mac App Store';
            logger.info(`Updates for this installation are managed by the ${storeName}`);
            sendToast(window, `Updates for this installation are managed by ${storeName}.`, 'info', 5000);
        } else {
            try {
            const checks = await Promise.allSettled(
                channels.map((channel) => requestUpdate(currentVersion, channel, logger, switchingChannel))
            );
            const responses = checks
                .filter((result): result is PromiseFulfilledResult<UpdateServerResponse> => result.status === 'fulfilled')
                .map((result) => result.value);
            for (const failed of checks.filter((result): result is PromiseRejectedResult => result.status === 'rejected')) {
                logger.warn(`Update branch check failed: ${String(failed.reason)}`);
            }
            if (responses.length === 0) {
                throw new Error('No update branch could be reached');
            }

            const selected = selectNewestUpdate(responses);
            if (selected?.release && selected.latestVersion) {
                if (!switchingChannel && await checkForNativeUpdate(nativeBranch, window, logger)) {
                    logger.info(`Started Forge native update check on the ${nativeBranch} branch`);
                } else {
                    const releaseType = selected.channel === 'stable' ? 'release' : `${selected.channel} release`;
                    await sendToastWithDelay(
                        window,
                        switchingChannel
                            ? `Preparing the ${selected.channel} build (${selected.latestVersion})...`
                            : `New ${releaseType} (${selected.latestVersion}) available! Current: ${currentVersion}`,
                        'warning',
                        8000,
                        1000
                    );
                    logger.info(
                        `Update available: ${selected.latestVersion}; ` +
                        `file=${selected.release.fileName}; sha256=${selected.release.sha256 ?? 'unavailable'}`
                    );

                    setTimeout(() => {
                        void (async () => {
                        try {
                            if (process.platform === 'linux') {
                                await downloadAndInstallLinuxUpdate(selected.release!, window, logger);
                            } else {
                                const destination = await downloadUpdatePackage(selected.release!, window, logger);
                                await openUpdateInstaller(destination, selected, switchingChannel, window, logger);
                            }
                        } catch (error) {
                            logger.error('Error opening update download:', error);
                            await sendToastWithDelay(window, 'Failed to download or install the update', 'error', 6000, 100);
                        }
                        })();
                    }, 2000);
                }
            } else {
                logger.info(
                    switchingChannel
                        ? `No compatible build is available on ${selectedChannel}`
                        : `No updates available: ${currentVersion}`
                );
                await sendToastWithDelay(
                    window,
                    switchingChannel
                        ? `No compatible ${selectedChannel} build is currently available for this system.`
                        : `You're running the latest version (${currentVersion})`,
                    switchingChannel ? 'warning' : 'success',
                    5000,
                    2000
                );
            }
            } catch (error) {
            logger.error('Update server check failed:', error);
            await sendToastWithDelay(
                window,
                'Unable to check for updates at this time',
                'error',
                6000,
                500
            );
            }
        }

        const endpoint2 = "https://api.requestplus.xyz/termsUpdate";
        var response2 = await fetch(endpoint2, {
            headers: {
                'User-Agent': 'RequestPlus-UpdateChecker'
            },
            method: "GET",
        });

        if (response2.status !== 200) {
            logger.warn(`Terms update check returned status ${response2.status}`);
            return;
        }
        var data2 = await response2.json() as { latestTermsVersion: string; termsUrl: string; mstesting: boolean; mstestingversion: string; showDialog: boolean; dialogMessage: string; dialogTitle: string; dialogVersion: string; };
        const latestTermsVersion = data2.latestTermsVersion;
        const termsUrl = data2.termsUrl;
        const mstesting = data2.mstesting;
        const mstestingversion = data2.mstestingversion;
        const showDialog = data2.showDialog;
        const dialogMessage = data2.dialogMessage;
        const dialogTitle = data2.dialogTitle;
        const dialogVersion = data2.dialogVersion;

        if (showDialog) {
            const dialogVersionPath = path.join(app.getPath('userData'), 'dialog-version.txt');
            const seenVersion = fs.existsSync(dialogVersionPath)
                ? fs.readFileSync(dialogVersionPath, 'utf8')
                : null;

            if (seenVersion !== dialogVersion) {
                const result = await sendModal(window, dialogTitle, dialogMessage, ['OK']);
                if (result === 0) {
                    fs.writeFileSync(dialogVersionPath, dialogVersion, 'utf8');
                }
            }
        }

        if (mstesting && currentVersion === mstestingversion) {
            logger.info('MS Testing mode enabled');
            await sendModal(
                window,
                'Hello! 👋',
                "Hello Tester! Thanks for opening Request+! To test full functionality you will need to open the docs page and do the setup guide or youtube tutorial! If you need any help as to why the program name is different, I can't reserve the name Request+ because of a old project I deleted to favor this one to upload the MSIX/APPX bundles... It doesn't misrepresent anything, it's just a naming issue with Microsoft Store policies (3 MONTH WAIT). Thanks for testing! - Quil\n\nThis message will be disabled in the future using an API call.",
                ['OK']
            );
        }

        const termsVersionPath = path.join(app.getPath('userData'), 'terms-version.txt');
        if (fs.existsSync(termsVersionPath)) {
            const localTermsVersion = fs.readFileSync(termsVersionPath, 'utf8').trim();
            if (localTermsVersion !== latestTermsVersion) {
                await sendToastWithDelay(window, 'New Terms of Service available.', 'info', 10000, 500);
                await showTermsFlow(window, termsUrl, latestTermsVersion);
            }
        } else {
            await showTermsFlow(window, termsUrl, latestTermsVersion);
        }

    } catch (error) {
        console.error('Update check failed:', error);
        logger.error('Update check failed: ' + (error as Error).message);
        
        // Send error toast with delay to ensure it shows
        await sendToastWithDelay(
            window, 
            'Update check failed: ' + (error as Error).message, 
            'error', 
            6000,
            500
        );
    }


}

function compareVersions(current: string, latest: string): boolean {
    // Helper function to parse version string
    function parseVersion(version: string): VersionParsed {
        // Clean the version string
        const cleanVersion = version.replace(/^v/, '').trim();
        
        // Handle beta versions like "2.0.1-BETA-PreR4" 
        const betaMatch = cleanVersion.match(/^(.+?)-BETA-PreR(\d+)$/i);
        if (betaMatch) {
            const baseVersion = betaMatch[1];
            const preReleaseNumber = parseInt(betaMatch[2], 10);
            return {
                base: baseVersion.split('.').map(Number),
                isBeta: true,
                preRelease: preReleaseNumber
            };
        }
        
        // Handle other pre-release formats like "2.0.1-beta.1", "2.0.1-alpha.1", etc.
        const preReleaseMatch = cleanVersion.match(/^(.+?)-(alpha|beta|rc)\.?(\d+)?$/i);
        if (preReleaseMatch) {
            const baseVersion = preReleaseMatch[1];
            const preReleaseNumber = parseInt(preReleaseMatch[3] || '1', 10);
            return {
                base: baseVersion.split('.').map(Number),
                isBeta: true,
                preRelease: preReleaseNumber
            };
        }
        
        // Handle regular versions like "2.0.1"
        return {
            base: cleanVersion.split('.').map(Number),
            isBeta: false,
            preRelease: 0
        };
    }

    const currentParsed = parseVersion(current);
    const latestParsed = parseVersion(latest);

    

    // Compare base versions first (major.minor.patch)
    const maxLength = Math.max(currentParsed.base.length, latestParsed.base.length);
    
    for (let i = 0; i < maxLength; i++) {
        const currentPart = currentParsed.base[i] || 0;
        const latestPart = latestParsed.base[i] || 0;
        
        if (latestPart > currentPart) {
           
            return true;
        }
        if (latestPart < currentPart) {
            
            return false;
        }
    }

   
    // If base versions are equal, check beta status
    if (currentParsed.isBeta && !latestParsed.isBeta) {
        // Current is beta, latest is stable - stable is newer
        
        return true;
    }
    
    if (!currentParsed.isBeta && latestParsed.isBeta) {
        // Current is stable, latest is beta - stable is newer
        
        return false;
    }
    
    if (currentParsed.isBeta && latestParsed.isBeta) {
        // Both are betas, compare pre-release numbers
        const isNewer = latestParsed.preRelease > currentParsed.preRelease;
        return isNewer;
    }

    // Both are stable and equal
   
    return false;
}

function setPreReleaseCheck(enabled: boolean): void {
    loadSettings();
    settings.checkPreReleases = enabled;
    // Keep a custom feed selected when the legacy pre-release toggle is used.
    // The toggle only changes the stable/beta choice; it should not silently
    // move users off a branch they selected in the feed picker.
    if (!enabled || settings.channel === 'stable' || settings.channel === 'beta') {
        settings.channel = enabled ? 'beta' : 'stable';
    }
    saveSettings();
}

function setUpdateChannel(channel: string): void {
    if (!validChannel(channel)) {
        throw new Error('Invalid update feed');
    }
    loadSettings();
    settings.channel = channel;
    settings.checkPreReleases = channel !== 'stable';
    saveSettings();
}

function getSettings(): UpdateSettings {
    loadSettings();
    return settings;
}

function validChannel(value: unknown): value is string {
    return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,29}$/.test(value);
}

function channelSort(left: string, right: string): number {
    const priority = (value: string): number => value === 'stable' ? 0 : value === 'beta' ? 1 : 2;
    return priority(left) - priority(right) || left.localeCompare(right);
}

export {
    checkForUpdates,
    getAvailableUpdateChannels,
    getSettings,
    setPreReleaseCheck,
    setUpdateChannel
};
