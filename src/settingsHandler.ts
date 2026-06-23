import * as fs from 'node:fs';
import * as path from 'node:path';

// Type definitions for settings structure
interface Settings {
    /** Set only after the user finishes the v3 setup flow. */
    oobeCompleted: boolean;
    theme: string;
    showNotifications: boolean;
    enableRequests: boolean;
    modsOnly: boolean;
    subsOnly: boolean;
    requestLimitEnabled: boolean;
    requestLimit: number;
    autoPlay: boolean;
    autoAcceptSearchResults: boolean;
    useChannelPoints: boolean;
    channelPointRequestsEnabled: boolean;
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

    private getDefaultSettings(): Settings {
        return {
            oobeCompleted: false,
            theme: 'default',
            showNotifications: true,
            enableRequests: true,
            modsOnly: false,
            subsOnly: false,
            requestLimitEnabled: false,
            requestLimit: 10,
            autoPlay: false,
            autoAcceptSearchResults: false,
            useChannelPoints: false,
            channelPointRequestsEnabled: true,
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

    load(): Settings {
        if (!fs.existsSync(this.settingsFilePath)) {
            return this.getDefaultSettings();
        }
        try {
            const data = fs.readFileSync(this.settingsFilePath, 'utf-8');
            const parsed = JSON.parse(data) as Settings;
            return {
                ...this.getDefaultSettings(),
                ...parsed,
                // Legacy settings files must always run through the v3 OOBE.
                oobeCompleted: parsed.oobeCompleted === true,
                requestLimitEnabled: parsed.requestLimitEnabled ?? false,
                requestLimit: Math.max(1, Number(parsed.requestLimit || 10)),
                channelPointRequestsEnabled: parsed.channelPointRequestsEnabled ?? true,
                ciderApiVersion: parsed.ciderApiVersion || '3',
                ciderV4AppToken: parsed.ciderV4AppToken || '',
            };
        } catch (error) {
            console.error('Error loading settings:', error);
            return this.getDefaultSettings();
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
