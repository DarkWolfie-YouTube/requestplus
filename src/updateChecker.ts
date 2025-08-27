import { app, BrowserWindow, shell } from 'electron';
import fetch from 'node-fetch';
import { version as currentVersion } from '../package.json';
import * as fs from 'fs';
import * as path from 'path';

// Type definitions
interface UpdateSettings {
    checkPreReleases: boolean;
    [key: string]: any;
}

interface GitHubRelease {
    tag_name: string;
    prerelease: boolean;
    html_url: string;
    name?: string;
    body?: string;
    published_at?: string;
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
    checkPreReleases: false
};

// Load settings
function loadSettings(): void {
    try {
        const settingsPath = path.join(app.getPath('userData'), 'update-settings.json');
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            settings = { ...settings, ...JSON.parse(data) };
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

// Helper function to send toast to renderer
function sendToast(window: BrowserWindow | null, message: string, type: ToastMessage['type'] = 'info', duration: number): void {
    if (window && !window.isDestroyed()) {
        const toastMessage: ToastMessage = { message, type, duration };
        window.webContents.send('show-toast', toastMessage);
    }
}

async function checkForUpdates(window: BrowserWindow | null, silent: boolean, logger: Logger): Promise<void> {
    try {
        // Load current settings
        logger.info('Checking for updates...');
        loadSettings();

        if (!silent) {
            sendToast(window, 'Checking for updates...', 'info', 3000);
        }

        // Always fetch all releases to properly handle both stable and pre-releases
        const endpoint = 'https://api.github.com/repos/DarkWolfie-YouTube/requestplus/releases';

        const response = await fetch(endpoint);
        const data = await response.json() as GitHubRelease[];
        
        if (!Array.isArray(data) || data.length === 0) {
            if (!silent) {
                sendToast(window, 'Unable to check for updates at this time', 'error', 6000);
                logger.warn("Unable to check for updates at this time.");
            }
            return;
        }

        // Find the appropriate release based on settings
        let latestRelease: GitHubRelease | undefined;
        if (settings.checkPreReleases) {
            // Find the latest release (including pre-releases)
            latestRelease = data[0];
        } else {
            // Find the latest stable release (not pre-release)
            latestRelease = data.find(release => !release.prerelease);
        }

        if (!latestRelease || !latestRelease.tag_name) {
            if (!silent) {
                sendToast(window, 'Unable to find a suitable release', 'error', 6000);
                logger.warn("Unable to find a suitable release.");
            }
            return;
        }

        const latestVersion = latestRelease.tag_name.replace('v', '');
        const updateAvailable = compareVersions(currentVersion, latestVersion);

        if (updateAvailable) {
            const releaseType = latestRelease.prerelease ? 'pre-release' : 'release';
            
            // Send update available toast with action
            sendToast(
                window, 
                `New ${releaseType} (${latestVersion}) available! Current: ${currentVersion}`, 
                'info', 
                8000
            );

            logger.info(`Update available: ${latestVersion}`);

            // Open download page automatically after a short delay
            setTimeout(() => {
                shell.openExternal(latestRelease.html_url);
                sendToast(window, 'Opening download page...', 'success', 3000);
            }, 2000);

        } else if (!silent) {
            sendToast(
                window, 
                `You're running the latest version (${currentVersion})`, 
                'success', 
                4000
            );
            logger.info(`No updates available: ${currentVersion}`);
        } else {
            logger.info(`No updates available: ${currentVersion}`);
        }
    } catch (error) {
        console.error('Update check failed:', error);
        if (!silent) {
            sendToast(
                window, 
                'Update check failed: ' + (error as Error).message, 
                'error', 
                6000
            );
        }
    }
}

function compareVersions(current: string, latest: string): boolean {
    // Helper function to parse version string
    function parseVersion(version: string): VersionParsed {
        // Handle beta versions like "1.2.3-BETA-PreR4" 
        const betaMatch = version.match(/^(.+?)-BETA-PreRe(\d+)$/);
        if (betaMatch) {
            const baseVersion = betaMatch[1];
            const preReleaseNumber = parseInt(betaMatch[2], 10);
            return {
                base: baseVersion.split('.').map(Number),
                isBeta: true,
                preRelease: preReleaseNumber
            };
        }
        
        // Handle regular versions like "1.2.3"
        return {
            base: version.split('.').map(Number),
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
        
        if (latestPart > currentPart) return true;
        if (latestPart < currentPart) return false;
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
        return latestParsed.preRelease > currentParsed.preRelease;
    }

    // Both are stable and equal
    return false;
}

function setPreReleaseCheck(enabled: boolean): void {
    settings.checkPreReleases = enabled;
    saveSettings();
}

function getSettings(): UpdateSettings {
    loadSettings();
    return settings;
}

export { checkForUpdates, setPreReleaseCheck, getSettings };