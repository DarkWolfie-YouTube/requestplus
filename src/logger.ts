import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

type LogLevel = 'info' | 'error' | 'warn';

class Logger {
    private logFolderPath: string;
    private logFilePath: string;
    private logLevel: string;

    constructor() {
        // Make sure app is ready before accessing userData path
        if (!app.isReady()) {
            throw new Error('Logger must be initialized after app is ready');
        }

        this.logFolderPath = path.join(app.getPath('userData'), 'logs');
        this.logFilePath = path.join(this.logFolderPath, `log.txt`);
        this.logLevel = 'info';
        
        this.initializeLogFile();
    }

    private initializeLogFile(): void {
        try {
            // Create logs directory if it doesn't exist
            if (!fs.existsSync(this.logFolderPath)) {
                fs.mkdirSync(this.logFolderPath, { recursive: true });
            }
    
            // Create log file if it doesn't exist
            if (!fs.existsSync(this.logFilePath)) {
                fs.writeFileSync(this.logFilePath, `Log file created at: ${new Date().toISOString()}\n`);
            } else {
                if (fs.existsSync(path.join(this.logFolderPath, `log_old.txt`))) {
                    fs.unlinkSync(path.join(this.logFolderPath, `log_old.txt`));
                    fs.renameSync(this.logFilePath, path.join(this.logFolderPath, `log_old.txt`));
                    fs.writeFileSync(this.logFilePath, `Log file created at: ${new Date().toISOString()}\n`);
                } else {
                    fs.renameSync(this.logFilePath, path.join(this.logFolderPath, `log_old.txt`));
                    fs.writeFileSync(this.logFilePath, `Log file created at: ${new Date().toISOString()}\n`);
                }

            }
        } catch (error) {
            console.error('Failed to initialize log file:', error);
            throw new Error(`Logger initialization failed: ${(error as Error).message}`);
        }
    }

    /**
     * Write to log file
     * @param message - Formatted message to write
     */
    private async writeToLog(message: string): Promise<void> {
        try {
            await fs.promises.appendFile(this.logFilePath, message);
        } catch (error) {
            console.error('Error writing to log file:', error);
        }
    }

    /**
     * Format the log message with timestamp and level
     * @param level - Log level (info, error, warn)
     * @param args - Arguments to log
     * @returns Formatted log message
     */
    private formatLogMessage(level: LogLevel, ...args: any[]): string {
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
     * @param args - Arguments to log
     */
    info(...args: any[]): void {
        const formattedMessage = this.formatLogMessage('info', ...args);
        this.writeToLog(formattedMessage);
    }

    /**
     * Log error level message
     * @param args - Arguments to log
     */
    error(...args: any[]): void {
        const formattedMessage = this.formatLogMessage('error', ...args);
        this.writeToLog(formattedMessage);
    }

    /**
     * Log warning level message
     * @param args - Arguments to log
     */
    warn(...args: any[]): void {
        const formattedMessage = this.formatLogMessage('warn', ...args);
        this.writeToLog(formattedMessage);
    }

    /**
     * Clear the log file
     */
    async clearLogs(): Promise<void> {
        try {
            await fs.promises.writeFile(this.logFilePath, '');
        } catch (error) {
            console.error('Error clearing log file:', error);
        }
    }

    /**
     * Clear the Log File Folder to clear space on the drive.
     */
    async clearLogFolder(): Promise<void> {
        try {
            await fs.promises.rm(this.logFolderPath, { recursive: true, force: true });
        } catch (error) {
            console.error('Error clearing log folder:', error);
        }
    }
}

export default Logger;