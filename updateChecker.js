const { app, dialog } = require('electron');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const currentVersion = require('./package.json').version;
const fs = require('fs');
const path = require('path');

let settings = {
    checkPreReleases: false
};

// Load settings
function loadSettings() {
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
function saveSettings() {
    try {
        const settingsPath = path.join(app.getPath('userData'), 'update-settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify(settings), 'utf8');
    } catch (error) {
        console.error('Error saving update settings:', error);
    }
}

async function checkForUpdates(window, silent = false, logger) {
    try {
        // Load current settings
        logger.info('Checking for updates...');
        loadSettings();

        // Always fetch all releases to properly handle both stable and pre-releases
        const endpoint = 'https://api.github.com/repos/DarkWolfie-YouTube/requestplus/releases';

        const response = await fetch(endpoint);
        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            if (!silent) {
                dialog.showMessageBox(window, {
                    type: 'info',
                    title: 'Update Check Failed',
                    message: 'Unable to check for updates at this time.',
                    buttons: ['OK']
                });
                logger.warn("Unable to check for updates at this time.");
            }
            return;
        }

        // Find the appropriate release based on settings
        let latestRelease;
        if (settings.checkPreReleases) {
            // Find the latest release (including pre-releases)
            latestRelease = data[0];
        } else {
            // Find the latest stable release (not pre-release)
            latestRelease = data.find(release => !release.prerelease);
        }

        if (!latestRelease || !latestRelease.tag_name) {
            if (!silent) {
                dialog.showMessageBox(window, {
                    type: 'info',
                    title: 'Update Check Failed',
                    message: 'Unable to find a suitable release.',
                    buttons: ['OK']
                });
                logger.warn("Unable to find a suitable release.");
            }
            return;
        }

        const latestVersion = latestRelease.tag_name.replace('v', '');
        const updateAvailable = compareVersions(currentVersion, latestVersion);

        if (updateAvailable) {
            const releaseType = latestRelease.prerelease ? 'pre-release' : 'release';
            const choice = await dialog.showMessageBox(window, {
                type: 'info',
                title: 'Update Available',
                message: `A new ${releaseType} (${latestVersion}) is available!\n\nCurrent version: ${currentVersion}`,
                detail: latestRelease.body || 'No release notes available.',
                buttons: ['Download', 'Later'],
                defaultId: 0
            });

            logger.info(`Update available: ${latestVersion}`);

            if (choice.response === 0) {
                require('electron').shell.openExternal(latestRelease.html_url);
            }
        } else if (!silent) {
            dialog.showMessageBox(window, {
                type: 'info',
                title: 'No Updates Available',
                message: `You're running the latest version (${currentVersion}).`,
                buttons: ['OK']
            });
            logger.info(`No updates available: ${currentVersion}`);
        } else {
            logger.info(`No updates available: ${currentVersion}`);
        }
    } catch (error) {
        console.error('Update check failed:', error);
        if (!silent) {
            dialog.showMessageBox(window, {
                type: 'error',
                title: 'Update Check Failed',
                message: 'Unable to check for updates at this time.',
                detail: error.message,
                buttons: ['OK']
            });
        }
    }
}

function compareVersions(current, latest) {
    // Helper function to parse version string
    function parseVersion(version) {
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

function setPreReleaseCheck(enabled) {
    settings.checkPreReleases = enabled;
    saveSettings();
}

function getSettings() {
    loadSettings();
    return settings;
}

module.exports = { checkForUpdates, setPreReleaseCheck, getSettings };
