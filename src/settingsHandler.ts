import * as fs from 'node:fs';
import * as path from 'node:path';

// Type definitions for settings structure
interface Settings {
    theme: string;
    showNotifications: boolean;
    enableRequests: boolean;
    modsOnly: boolean;
    subsOnly: boolean;
    autoPlay: boolean;
    autoAcceptSearchResults: boolean;
    useChannelPoints: boolean;
    filterExplicit: boolean;
    platform: string;
    telemetryEnabled: boolean;
    gtsEnabled: boolean;
    /** Enable multi-platform mode */
    multiPlatform: boolean;
    /** Platforms active in multi-platform mode */
    platforms: string[];
    /** Which platform to search on when a request has no URL (multi-platform mode) */
    primarySearchPlatform: string;
    /** Cider major version for Apple Music integration */
    ciderApiVersion?: '3' | '4';
    /** Scoped Cider 4 API token. Cider 3 keeps using appleMusicAppToken. */
    ciderV4AppToken?: string;
    [key: string]: any; // Allow additional properties
}

class SettingsHandler {
    private settingsFilePath: string;

    constructor(userDataPath: string) {
        this.settingsFilePath = path.join(userDataPath, 'settings.json');
    }

    load(): Settings {
        if (!fs.existsSync(this.settingsFilePath)) {
            return {
                theme: 'default',
                showNotifications: true,
                enableRequests: true,
                modsOnly: false,
                subsOnly: false,
                autoPlay: false,
                autoAcceptSearchResults: false,
                useChannelPoints: false,
                filterExplicit: false,
                platform: 'spotify',
                telemetryEnabled: true,
                gtsEnabled: false,
                multiPlatform: false,
                platforms: ['spotify'],
                primarySearchPlatform: 'spotify',
                ciderApiVersion: '3',
                ciderV4AppToken: '',
            };
        }
        try {
            const data = fs.readFileSync(this.settingsFilePath, 'utf-8');
            const parsed = JSON.parse(data) as Settings;
            return {
                ...parsed,
                ciderApiVersion: parsed.ciderApiVersion || '3',
                ciderV4AppToken: parsed.ciderV4AppToken || '',
            };
        } catch (error) {
            console.error('Error loading settings:', error);
            return {
                theme: 'default',
                showNotifications: true,
                enableRequests: true,
                modsOnly: false,
                subsOnly: false,
                autoPlay: false,
                autoAcceptSearchResults: false,
                useChannelPoints: false,
                filterExplicit: false,
                platform: 'spotify',
                telemetryEnabled: true,
                gtsEnabled: false,
                multiPlatform: false,
                platforms: ['spotify'],
                primarySearchPlatform: 'spotify',
                ciderApiVersion: '3',
                ciderV4AppToken: '',
            };
        }
    }

    save(settings: Settings): boolean {
        try {
            fs.writeFileSync(this.settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8');
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }
}

export default SettingsHandler;

export { Settings };
