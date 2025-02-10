const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Logger {
    constructor() {
        // Make sure app is ready before accessing userData path
        if (!app.isReady()) {
            throw new Error('Logger must be initialized after app is ready');
        }

        this.logFolderPath = path.join(app.getPath('userData'), 'logs');
        this.logFilePath = path.join(this.logFolderPath, `log-${new Date().toISOString().replace(/:/g, '-')}.txt`);
        this.logLevel = 'info';
        
        this.initializeLogFile();
    }

    initializeLogFile() {
        try {
            // Create logs directory if it doesn't exist
            if (!fs.existsSync(this.logFolderPath)) {
                fs.mkdirSync(this.logFolderPath, { recursive: true });
            }
    
            // Create log file if it doesn't exist
            if (!fs.existsSync(this.logFilePath)) {
                fs.writeFileSync(this.logFilePath, `Log file created at: ${new Date().toISOString()}\n`);
            }
        } catch (error) {
            console.error('Failed to initialize log file:', error);
            throw new Error(`Logger initialization failed: ${error.message}`);
        }
    }

    

    /**
     * Write to log file
     * @param {string} message - Formatted message to write
     */
    async writeToLog(message) {
        try {
            await fs.promises.appendFile(this.logFilePath, message);
        } catch (error) {
            console.error('Error writing to log file:', error);
        }
    }

    /**
     * Format the log message with timestamp and level
     * @param {string} level - Log level (info, error, warn)
     * @param {...any} args - Arguments to log
     * @returns {string} Formatted log message
     */
    formatLogMessage(level, ...args) {
        const timestamp = new Date().toISOString();
        const message = args
            .map(arg => {
                if (typeof arg === 'object') {
                    return JSON.stringify(arg);
                }
                return String(arg);
            })
            .join(' ');
        return `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    }

    /**
     * Log info level message
     * @param {...any} args - Arguments to log
     */
    info(...args) {
        const formattedMessage = this.formatLogMessage('info', ...args);
        this.writeToLog(formattedMessage);
    }

    /**
     * Log error level message
     * @param {...any} args - Arguments to log
     */
    error(...args) {
        const formattedMessage = this.formatLogMessage('error', ...args);
        this.writeToLog(formattedMessage);
    }

    /**
     * Log warning level message
     * @param {...any} args - Arguments to log
     */
    warn(...args) {
        const formattedMessage = this.formatLogMessage('warn', ...args);
        this.writeToLog(formattedMessage);
    }
    /**
     * Clear the log file
     */
    async clearLogs() {
        try {
            await fs.promises.writeFile(this.logFilePath, '');
        } catch (error) {
            console.error('Error clearing log file:', error);
        }
    }
}

module.exports = Logger;