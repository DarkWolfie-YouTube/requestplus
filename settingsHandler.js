const fs = require('node:fs');
const path = require('node:path');

class SettingsHandler {
    constructor(userDataPath) {
        this.settingsFilePath = path.join(userDataPath, 'settings.json');
    }

    load() {
        if (!fs.existsSync(this.settingsFilePath)) {
            return null;
        }
        try {
            return JSON.parse(fs.readFileSync(this.settingsFilePath, 'utf-8'));
        } catch (error) {
            return null;
        }
    }

    save(settings) {
        try {
            fs.writeFileSync(this.settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8');
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = SettingsHandler;