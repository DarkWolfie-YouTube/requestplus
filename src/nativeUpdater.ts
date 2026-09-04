import { app, autoUpdater, BrowserWindow, dialog } from 'electron';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

interface NativeUpdaterLogger {
    info(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
}

const UPDATE_FEED_ROOT = 'https://updates.requestplus.xyz/v1/updates/feeds';

let listenersRegistered = false;
let updaterWindow: BrowserWindow | null = null;
let updaterLogger: NativeUpdaterLogger | null = null;
let currentFeed: string | null = null;
let checkInProgress = false;
let macDeveloperIdSignature: boolean | undefined;

export function isNativeUpdaterSupported(): boolean {
    if (!app.isPackaged || process.windowsStore || process.mas) {
        return false;
    }
    const squirrelInstalled =
        process.platform === 'win32' &&
        existsSync(path.resolve(path.dirname(process.execPath), '..', 'Update.exe'));
    return squirrelInstalled || (process.platform === 'darwin' && hasMacDeveloperIdSignature());
}

export async function checkForNativeUpdate(
    branch: string,
    window: BrowserWindow | null,
    logger: NativeUpdaterLogger
): Promise<boolean> {
    if (!isNativeUpdaterSupported()) {
        if (app.isPackaged && process.platform === 'darwin' && !process.mas) {
            logger.info(
                'Native macOS auto-update is disabled because this build is not signed with Developer ID; using the manual download flow'
            );
        }
        return false;
    }

    updaterWindow = window;
    updaterLogger = logger;
    registerUpdaterListeners();

    if (checkInProgress) {
        logger.info('A native update check is already in progress');
        return true;
    }
    checkInProgress = true;

    const platform = process.platform === 'win32' ? 'windows' : 'macos';
    const feedBase = `${UPDATE_FEED_ROOT}/${encodeURIComponent(branch)}/${platform}/${process.arch}`;
    const feedUrl = process.platform === 'darwin' ? `${feedBase}/RELEASES.json` : feedBase;
    const metadataUrl = process.platform === 'darwin' ? feedUrl : `${feedUrl}/RELEASES`;
    if (!await nativeFeedExists(metadataUrl, logger)) {
        checkInProgress = false;
        return false;
    }

    if (currentFeed !== feedUrl) {
        autoUpdater.setFeedURL({
            url: feedUrl,
            headers: { 'User-Agent': `RequestPlus/${app.getVersion()} NativeUpdater` },
            ...(process.platform === 'darwin' ? { serverType: 'json' as const } : {})
        });
        currentFeed = feedUrl;
        logger.info(`Native updater feed configured for ${branch}: ${feedUrl}`);
    }

    autoUpdater.checkForUpdates();
    return true;
}

async function nativeFeedExists(metadataUrl: string, logger: NativeUpdaterLogger): Promise<boolean> {
    try {
        const response = await fetch(metadataUrl, {
            headers: { 'User-Agent': `RequestPlus/${app.getVersion()} NativeUpdaterPreflight` },
            signal: AbortSignal.timeout(10_000)
        });
        if (response.status === 404) {
            await response.body?.cancel();
            logger.warn(`Native update metadata is not published: ${metadataUrl}`);
            return false;
        }
        if (!response.ok) {
            await response.body?.cancel();
            logger.warn(`Native update metadata returned HTTP ${response.status}`);
            return false;
        }
        await response.body?.cancel();
        return true;
    } catch (error) {
        logger.warn('Could not preflight the native update feed:', error);
        return false;
    }
}

function hasMacDeveloperIdSignature(): boolean {
    if (macDeveloperIdSignature !== undefined) {
        return macDeveloperIdSignature;
    }
    try {
        const result = spawnSync(
            '/usr/bin/codesign',
            ['--display', '--verbose=4', process.execPath],
            { encoding: 'utf8', timeout: 5000, windowsHide: true }
        );
        const details = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
        macDeveloperIdSignature =
            result.status === 0 && /(?:^|\n)Authority=Developer ID Application:/m.test(details);
    } catch {
        macDeveloperIdSignature = false;
    }
    return macDeveloperIdSignature;
}

function registerUpdaterListeners(): void {
    if (listenersRegistered) {
        return;
    }
    listenersRegistered = true;

    autoUpdater.on('error', (error) => {
        checkInProgress = false;
        updaterLogger?.error(`Native updater error: ${describeUpdaterError(error)}`);
        sendToast('Automatic update failed. You can retry from Settings.', 'error', 6000);
    });
    autoUpdater.on('checking-for-update', () => {
        checkInProgress = true;
        updaterLogger?.info('Native updater is checking for an update');
    });
    autoUpdater.on('update-available', () => {
        updaterLogger?.info('Native update available; downloading in the background');
        sendToast('Update found. Downloading in the background...', 'info', 5000);
    });
    autoUpdater.on('update-not-available', () => {
        checkInProgress = false;
        updaterLogger?.info(`No native update available for ${app.getVersion()}`);
        sendToast(`You're running the latest version (${app.getVersion()})`, 'success', 5000);
    });
    autoUpdater.on('update-downloaded', async (_event, _notes, releaseName) => {
        checkInProgress = false;
        updaterLogger?.info(`Native update downloaded: ${releaseName}`);
        const result = updaterWindow && !updaterWindow.isDestroyed()
            ? await dialog.showMessageBox(updaterWindow, {
                type: 'info',
                buttons: ['Restart and Install', 'Later'],
                defaultId: 0,
                cancelId: 1,
                title: 'Request+ Update Ready',
                message: 'A Request+ update has finished downloading.',
                detail: 'Restart Request+ now to install it. If you choose Later, it will be applied after you close the app.'
            })
            : await dialog.showMessageBox({
                type: 'info',
                buttons: ['Restart and Install', 'Later'],
                defaultId: 0,
                cancelId: 1,
                title: 'Request+ Update Ready',
                message: 'A Request+ update has finished downloading.'
            });

        if (result.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
}

function describeUpdaterError(error: unknown): string {
    if (error instanceof Error) {
        return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
    }
    if (typeof error === 'string') return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

function sendToast(message: string, type: 'info' | 'success' | 'error', duration: number): void {
    if (updaterWindow && !updaterWindow.isDestroyed()) {
        updaterWindow.webContents.send('show-toast', message, type, duration);
    }
}
