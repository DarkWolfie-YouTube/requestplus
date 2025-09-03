import * as fs from 'node:fs';
import * as path from 'node:path';

// Type definitions for settings structure
interface Settings {
    theme?: string;
    showNotifications?: boolean;
    enableRequests?: boolean;
    modsOnly?: boolean;
    requestLimit?: number;
    autoPlay?: boolean;
    filterExplicit?: boolean;
    [key: string]: any; // Allow additional properties
}

class SettingsHandler {
    private settingsFilePath: string;

    constructor(userDataPath: string) {
        this.settingsFilePath = path.join(userDataPath, 'settings.json');
    }

    load(): Settings {
        if (!fs.existsSync(this.settingsFilePath)) {
            return {};
        }
        try {
            const data = fs.readFileSync(this.settingsFilePath, 'utf-8');
            return JSON.parse(data) as Settings;
        } catch (error) {
            console.error('Error loading settings:', error);
            return {};
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