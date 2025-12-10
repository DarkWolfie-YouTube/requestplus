import { app, BrowserWindow, dialog, shell } from 'electron';
import fetch from 'node-fetch';
import { version as currentVersion } from '../package.json';
import * as fs from 'fs';
import * as path from 'path';
import { setTimeout as wait } from 'node:timers/promises';

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

async function checkForUpdates(window: BrowserWindow | null, logger: Logger): Promise<void> {
    try {
        // Load current settings
        logger.info('Checking for updates...');
        loadSettings();

        // Send initial checking toast
        sendToast(window, 'Checking for updates...', 'info', 3000);

        // Always fetch all releases to properly handle both stable and pre-releases
        const endpoint = 'https://api.github.com/repos/DarkWolfie-YouTube/requestplus/releases';
    

        const response = await fetch(endpoint, {
            headers: {
                'User-Agent': 'RequestPlus-UpdateChecker'
            },
        });

        if (response.status !== 200) {
            logger.warn(`GitHub API returned status ${response.status}`);
            await sendToastWithDelay(window, 'Unable to check for updates at this time', 'error', 6000, 500);
            return;
        }

        const data = await response.json() as GitHubRelease[];

        if (!data || !Array.isArray(data) || data.length === 0) {
            logger.warn("No releases found or invalid response format");
            await sendToastWithDelay(window, 'No releases found', 'error', 6000, 500);
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
            logger.warn("Unable to find a suitable release.");
            await sendToastWithDelay(window, 'Unable to find a suitable release', 'error', 6000, 500);
            return;
        }

        const latestVersion = latestRelease.tag_name.replace(/^v/, ''); // Remove leading 'v' if present

        
        const updateAvailable = compareVersions(currentVersion, latestVersion);


        if (updateAvailable) {
            const releaseType = latestRelease.prerelease ? 'pre-release' : 'release';
            
            // Send update available toast with action
            await sendToastWithDelay(
                window, 
                `New ${releaseType} (${latestVersion}) available! Current: ${currentVersion}`, 
                'warning', 
                8000,
                1000
            );

            logger.info(`Update available: ${latestVersion}`);

            // Open download page automatically after a short delay
            setTimeout(async () => {
                try {
                    await shell.openExternal(latestRelease.html_url);
                    await sendToastWithDelay(window, 'Opening download page...', 'success', 3000, 100);
                } catch (error) {
                    console.error('Error opening download page:', error);
                    await sendToastWithDelay(window, 'Failed to open download page', 'error', 4000, 100);
                }
            }, 2000);

        } else {
            logger.info(`No updates available: ${currentVersion}`);
            
            // Wait a bit longer to ensure the checking toast has been displayed
            await sendToastWithDelay(
                window, 
                `You're running the latest version (${currentVersion})`, 
                'success', 
                5000,
                2000 // Wait 2 seconds after the checking toast
            );
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
            if (fs.existsSync(path.join(app.getPath('userData'), 'dialog-version.txt'))) {
                if (fs.readFileSync(path.join(app.getPath('userData'), 'dialog-version.txt'), 'utf8') !== dialogVersion){
                dialog.showMessageBox({
                    type: 'info',
                    buttons: ['OK'],
                    defaultId: 0,
                    cancelId: 0,
                    title: dialogTitle,
                    message: dialogMessage
                }).then(async (result) => {
                    if (result.response === 0) {
                        fs.writeFileSync(path.join(app.getPath('userData'), 'dialog-version.txt'), dialogVersion, 'utf8');
                    }
                })
            } 
        } else { 
            dialog.showMessageBox({
                    type: 'info',
                    buttons: ['OK'],
                    defaultId: 0,
                    cancelId: 0,
                    title: dialogTitle,
                    message: dialogMessage
                }).then(async (result) => {
                    if (result.response === 0) {
                        fs.writeFileSync(path.join(app.getPath('userData'), 'dialog-version.txt'), dialogVersion, 'utf8');
                    }
                })
        }
    }

        if (mstesting && currentVersion === mstestingversion) {
            logger.info('MS Testing mode enabled');
            dialog.showMessageBox({
                type: 'info',
                buttons: ['OK'],
                defaultId: 0,
                cancelId: 0,
                title: 'Hello! :wave:',
                message: 'Hello Tester! Thanks for opening Request+! To test full functionality you will need to open the docs page and do the setup guide or youtube tutorial! If you need any help as to why the program name is different, I can\'t reserve the name Request+ because of a old project I deleted to favor this one to upload the MSIX/APPX bundles... It doesn\'t misrepresent anything, it\'s just a naming issue with Microsoft Store policies (3 MONTH WAIT). Thanks for testing! - Quil\n\nThis message will be disabled in the future using an API call.',
            });
        }

        if (fs.existsSync(path.join(app.getPath('userData'), 'terms-version.txt'))) {
            const localTermsVersion = fs.readFileSync(path.join(app.getPath('userData'), 'terms-version.txt'), 'utf8').trim();
            if (localTermsVersion !== latestTermsVersion) {
                await sendToastWithDelay(
                    window, 
                    `New Terms of Service available.`, 
                    'info', 
                    10000,
                    500
                );

                dialog.showMessageBox({
                    type: 'info',
                    buttons: ['Accept', 'View Terms', 'Decline'],
                    defaultId: 1,
                    cancelId: 2,
                    title: 'Terms of Service Update',
                    message: 'The Terms of Service have been updated. Please review and accept the new terms to continue using the application.',
                }).then(async (result) => {
                    if (result.response === 0) {
                        // Accept
                        fs.writeFileSync(path.join(app.getPath('userData'), 'terms-version.txt'), latestTermsVersion, 'utf8');
                        await sendToastWithDelay(window, 'Terms accepted. Thank you!', 'success', 5000, 100);
                    } else if (result.response === 1) {
                        // View Terms
                        await shell.openExternal(termsUrl);
                        // After viewing, prompt to accept again
                        const acceptResult = await dialog.showMessageBox({
                            type: 'question',
                            buttons: ['Accept', 'Decline'],
                            defaultId: 0,
                            cancelId: 1,
                            title: 'Terms of Service Update',
                            message: 'Have you accepted the updated Terms of Service?',
                        });
                        if (acceptResult.response === 0) {
                            fs.writeFileSync(path.join(app.getPath('userData'), 'terms-version.txt'), latestTermsVersion, 'utf8');
                            await sendToastWithDelay(window, 'Terms accepted. Thank you!', 'success', 5000, 100);
                        } else {
                            app.quit();
                        }
                    } else if (result.response === 2) {
                        // Decline
                        app.quit();
                    }
                });
            }
        } else {
            // No local terms version file, create one with the latest version after accept terms
            dialog.showMessageBox({
                type: 'info',
                buttons: ['Accept', 'View Terms', 'Decline'],
                defaultId: 1,
                cancelId: 2,
                title: 'Terms of Service Update',
                message: 'The Terms of Service have been updated. Please review and accept the new terms to continue using the application.',
            }).then(async (result) => {
                if (result.response === 0) {
                    // Accept
                    fs.writeFileSync(path.join(app.getPath('userData'), 'terms-version.txt'), latestTermsVersion, 'utf8');
                    await sendToastWithDelay(window, 'Terms accepted. Thank you!', 'success', 5000, 100);
                } else if (result.response === 1) {
                    // View Terms
                    await shell.openExternal(termsUrl);
                    // After viewing, prompt to accept again
                    const acceptResult = await dialog.showMessageBox({
                        type: 'question',
                        buttons: ['Accept', 'Decline'],
                        defaultId: 0,
                        cancelId: 1,
                        title: 'Terms of Service Update',
                        message: 'Have you accepted the updated Terms of Service?',
                    });
                    if (acceptResult.response === 0) {
                        fs.writeFileSync(path.join(app.getPath('userData'), 'terms-version.txt'), latestTermsVersion, 'utf8');
                        await sendToastWithDelay(window, 'Terms accepted. Thank you!', 'success', 5000, 100);
                    } else {
                        app.quit();
                    }
                } else if (result.response === 2) {
                    // Decline
                    app.quit();
                }
            })
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
        
        // Handle beta versions like "1.2.3-BETA-PreR4" 
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
        
        // Handle other pre-release formats like "1.2.3-beta.1", "1.2.3-alpha.1", etc.
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
        
        // Handle regular versions like "1.2.3"
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
    settings.checkPreReleases = enabled;
    saveSettings();
}

function getSettings(): UpdateSettings {
    loadSettings();
    return settings;
}

export { checkForUpdates, setPreReleaseCheck, getSettings };