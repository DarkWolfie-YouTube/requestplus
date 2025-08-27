import websocket from './websocket';
import { app, BrowserWindow, ipcMain, dialog, shell, MessageBoxOptions, MessageBoxReturnValue } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Auth from './authManager';
import logger from './logger';
import ChatHandler from './chatHandler';
import APIHandler from './apiHandler';
import SettingsHandler from './settingsHandler';
import { Settings } from './settingsHandler';
import * as os from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';
import { checkForUpdates } from './updateChecker';
import { exec } from 'child_process';

// Type definitions
interface TwitchUser {
    id: string;
    login: string;
    display_name: string;
    profile_image_url: string;
    email: string;
}

interface TwitchTokenData {
    access_token: string;
    id: string;
    login: string;
    display_name: string;
    profile_image_url: string;
    email: string;
    scopes: string[];
}

interface TwitchApiResponse {
    data: TwitchUser[];
}

interface ToastMessage {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    duration: number;
}


interface WSCommand {
    command: string;
    [key: string]: any;
}

interface UpdateSettings {
    preRelease?: boolean;
    [key: string]: any;
}

// Constants
const TWITCH_CLIENT_ID: string = 'if6usvbqj58fwdbycnu6v77jjsluq5';
const TWITCH_REDIRECT_URI: string = 'http://localhost:444';
const TWITCH_SCOPES: string[] = ['user:read:email', 'chat:read', 'chat:edit'];

// Global variables with proper typing
let WSServer: any; // Type this according to your websocket class
let currentSongInformation: any;
let mainWindow: BrowserWindow | null = null;
let AuthManager: any; // Type this according to your Auth class
let Logger: any; // Type this according to your logger class
let chatHandler: any | null = null; // Type this according to your ChatHandler class
let settings: Settings;
let overlayPath: string;
let apiHandler: APIHandler; // Type this according to your apiHandler class
let settingsHandler: SettingsHandler; // Type this according to your settingsHandler class
let twitchAccessToken: string | undefined;
let twitchUser: TwitchUser | undefined;

// Declare global variables that might be set by build process
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

settingsHandler = new SettingsHandler(app.getPath('userData'));

async function createAuthWindow(): Promise<void> {
    const authUrl: string = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${TWITCH_REDIRECT_URI}&response_type=token&scope=${TWITCH_SCOPES.join('+')}`;
    // open this url in a browser
    shell.openExternal(authUrl);
}

async function handleAuthCallback(event: any, url: string): Promise<void> {
    Logger.info('Navigated to:', url);
    if (url.includes('#access_token=')) {
        const token: string = url.split('#access_token=')[1].split('&')[0];
        twitchAccessToken = token;
        
        // Get user info
        try {
            const response = await fetch('https://api.twitch.tv/helix/users', {
                headers: {
                    'Client-ID': TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${token}`
                }
            });
            const data: TwitchApiResponse = await response.json();
            twitchUser = data.data[0];
            mainWindow?.webContents.send('twitch-auth-success', twitchUser);

            // Save token to file
            const tokenData: TwitchTokenData = {
                access_token: token,
                id: twitchUser.id,
                login: twitchUser.login,
                display_name: twitchUser.display_name,
                profile_image_url: twitchUser.profile_image_url,
                email: twitchUser.email,
                scopes: TWITCH_SCOPES
            };
            await AuthManager.saveToken(tokenData);

            if (!chatHandler) {
                chatHandler = new ChatHandler(Logger, mainWindow, tokenData, WSServer);
                chatHandler.connect();
            }
        } catch (error) {
            Logger.error('Error fetching user data:', error);
        }
    }
}

async function ensureOverlayFile(): Promise<string> {
    const userDataPath: string = app.getPath('userData');
    const overlayDir: string = path.join(userDataPath, 'overlay');
    const targetPath: string = path.join(overlayDir, 'overlay.html');

    // Create overlay directory if it doesn't exist
    if (!fs.existsSync(overlayDir)) {
        fs.mkdirSync(overlayDir, { recursive: true });
    }

    // Delete overlay file if it already exists
    if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
    }

    // Copy overlay file if it doesn't exist or if we're in development
    const sourceFile: string = path.join(__dirname, 'views', 'overlay.html');
    if (!fs.existsSync(targetPath) || !app.isPackaged) {
        fs.copyFileSync(sourceFile, targetPath);
    }

    overlayPath = targetPath;

    // make it copy the styles folder with it.
    const stylesDir: string = path.join(__dirname, 'views', 'styles');
    const targetStylesDir: string = path.join(overlayDir, 'styles');
    if (!fs.existsSync(targetStylesDir)) {
        fs.mkdirSync(targetStylesDir, { recursive: true });
    }
    const styles: string[] = fs.readdirSync(stylesDir);
    styles.forEach((style: string) => {
        const sourceStyle: string = path.join(stylesDir, style);
        const targetStyle: string = path.join(targetStylesDir, style);
        fs.copyFileSync(sourceStyle, targetStyle);
    });

    return targetPath;
}

async function createWindow(): Promise<void> {
    ensureOverlayFile();

    mainWindow = new BrowserWindow({
        width: 500,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            // devTools: !app.isPackaged
        }, 
        frame: false,
        title: "Request+",
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        titleBarOverlay: false,
        resizable: false,
        icon: path.join(__dirname, 'assets', 'the_letter.png'),
   });

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow?.webContents.send('twitch-auth-success', twitchUser);
        });
    } else {
        mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }
    
    // Initialize AuthManager with user data path
    const userDataPath: string = app.getPath('userData');
    if (Logger) {
        Logger.info('Logger initialized');
    } else {
        Logger = new logger();
        Logger.info('Logger initialized');
    }

    AuthManager = new Auth(userDataPath, Logger, mainWindow);
    if (!WSServer) {
        WSServer = new websocket(443, mainWindow, Logger);
    }
    settings = await settingsHandler.load();
    // Check for existing valid token
    await checkStoredToken();

    await checkForUpdates(mainWindow, false, Logger);

    if (!apiHandler) {
        apiHandler = new APIHandler(mainWindow, WSServer, Logger, settings, (tokenData: TwitchTokenData) => AuthManager.saveToken(tokenData));
    }
    
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

async function checkStoredToken(): Promise<void> {
    try {
        const storedToken: TwitchTokenData | null = await AuthManager.getStoredToken();
        console.log('Stored token:', storedToken);
        if (storedToken) {
            twitchAccessToken = storedToken.access_token;
            twitchUser = storedToken as TwitchUser;
            console.log('Twitch user from stored token:', twitchUser);
            mainWindow?.webContents.send('twitch-auth-success', twitchUser);
            if (!chatHandler) {
                chatHandler = new ChatHandler(Logger, mainWindow, ({ login: twitchUser.login, access_token: twitchAccessToken }), WSServer);
                chatHandler.connect();
            }
        }
    } catch (error) {
        Logger.error('Error checking stored token:', error);
        mainWindow?.webContents.send('twitch-auth-error', { message: 'Failed to validate token' });
    }
}

// IPC Handlers
ipcMain.handle('load-settings', async (): Promise<Settings> => {
    return settingsHandler.load();
});

ipcMain.handle('save-settings', (event: Electron.IpcMainInvokeEvent, settings: Settings): Promise<void> => {
    return new Promise((resolve, reject) => {
        var saved = settingsHandler.save(settings);
        if (saved) {
            resolve();
        } else {
            reject(new Error('Failed to save settings'));
        }
    });
});

ipcMain.on('settings-updated', (event: Electron.IpcMainEvent, settings: Settings): void => {
    // Handle real-time settings updates
    console.log('Settings updated:', settings);
});

ipcMain.handle('window-minimize', (): void => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-close', async (): Promise<void> => {
    if (mainWindow) {
        await mainWindow.close();
    }
});

ipcMain.handle('song-play', (): void => {
    if (WSServer) {
        WSServer.WSSend({ command: 'PlayPause' } as WSCommand);
    }
});

ipcMain.handle('song-pause', (): void => {
    if (WSServer) {
        WSServer.WSSend({ command: 'PlayPause' } as WSCommand);
    }
});

ipcMain.handle('song-skip', (): void => {
    if (WSServer) {
        WSServer.WSSend({ command: 'Next' } as WSCommand);
    }
});

ipcMain.handle('song-previous', (): void => {
    if (WSServer) {
        WSServer.WSSend({ command: 'Prev' } as WSCommand);
    }
});

ipcMain.handle('song-like', (): void => {
    if (WSServer) {
        WSServer.WSSend({ command: 'like' } as WSCommand);
    }
});

ipcMain.handle('song-volume', (event: Electron.IpcMainInvokeEvent, level: number): void => {
    if (WSServer) {
        WSServer.WSSend({ command: 'volume', data: { volume: level } } as WSCommand);
    }
});

ipcMain.handle('song-seek', (event: Electron.IpcMainInvokeEvent, position: number): void => {
    if (WSServer) {
        WSServer.WSSend({ command: 'seek', data: { position } } as WSCommand);
    }
});

ipcMain.handle('song-shuffle', (): void => {
    if (WSServer) {
        WSServer.WSSend({ command: 'shuffle' } as WSCommand);
    }
});

ipcMain.handle('song-repeat', (): void => {
    if (WSServer) {
        WSServer.WSSend({ command: 'repeat' } as WSCommand);
    }

});



ipcMain.handle('twitch-login', (): void => {
    createAuthWindow();
});

function handleTwitchLogout(): void {
    try {
        // Clear stored authentication token
        if (AuthManager) {
            const success: boolean = AuthManager.clearToken();
            if (success) {
                Logger.info('Twitch token cleared successfully');
            } else {
                Logger.warn('Failed to clear stored token');
            }
        }

        // Reset global variables
        twitchAccessToken = undefined;
        twitchUser = undefined;

        // Disconnect and cleanup chat handler
        if (chatHandler) {
            chatHandler.disconnect?.(); // If your ChatHandler has a disconnect method
            chatHandler = null;
        }

        // Notify renderer process that logout was successful
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('twitch-logout-success');
        }

        // Send toast notification
        if (mainWindow && !mainWindow.isDestroyed()) {
            const toastMessage: ToastMessage = { 
                message: 'Successfully logged out of Twitch', 
                type: 'success', 
                duration: 3000 
            };
            mainWindow.webContents.send('show-toast', toastMessage);
        }

        Logger.info('Twitch logout completed successfully');

    } catch (error) {
        Logger.error('Error during Twitch logout:', error);
        
        // Send error notification
        if (mainWindow && !mainWindow.isDestroyed()) {
            const toastMessage: ToastMessage = { 
                message: 'Error logging out of Twitch', 
                type: 'error', 
                duration: 5000 
            };
            mainWindow.webContents.send('show-toast', toastMessage);
        }
    }
}

ipcMain.handle('twitch-logout', (): boolean => {
    handleTwitchLogout();
    return true; // Return success
});

ipcMain.handle('get-overlay-path', (): string | null => {
    return overlayPath;
});

ipcMain.handle('runFirstTime', async (): Promise<void> => {
    await makeFirstRunPopup();
});

// Add update checker IPC handler
ipcMain.handle('check-for-updates', (): void => {
    checkForUpdates(mainWindow, false, Logger);
});

ipcMain.handle('get-update-settings', (): UpdateSettings => {
    const { getSettings } = require('./updateChecker.js');
    return getSettings();
});

ipcMain.handle('set-pre-release-check', (event: Electron.IpcMainInvokeEvent, enabled: boolean): void => {
    const { setPreReleaseCheck } = require('./updateChecker.js');
    setPreReleaseCheck(enabled);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', (): void => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', (): void => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

function requestTrackInfo(): void {
    if (WSServer) {
        WSServer.WSSend({ command: 'getdata' } as WSCommand);
    }
}

setInterval(requestTrackInfo, 1000);

// make a function to make popup text boxes when the user opens the program for the first time.
async function makeFirstRunPopup(): Promise<void> {
    if (fs.existsSync(path.join(app.getPath('userData'), 'firstRun.txt'))) {
        return;
    }
    fs.writeFileSync(path.join(app.getPath('userData'), 'firstRun.txt'), 'true');
    
    const welcomeOptions: MessageBoxOptions = {
        type: 'info',
        buttons: ['Cancel', 'OK'],
        title: 'First Run',
        message: 'Welcome to Request+! these boxes will show how how to get the program up and running for the first time!'
    };
    dialog.showMessageBoxSync(mainWindow!, welcomeOptions);
    
    const haveAlreadyOptions: MessageBoxOptions = {
        type: 'info',
        buttons: ['No', 'Yes'],
        title: 'Install Spicetify',
        message: 'First, I need you to install Spicetify, which is a Spotify client mod. Have you already installed Spicetify?'
    };
    const haveAlready: MessageBoxReturnValue = await dialog.showMessageBox(mainWindow!, haveAlreadyOptions);

    if (haveAlready.response === 0) {
        const { open } = require('openurl');
        open('https://spicetify.app/docs/getting-started');
    
        const installedSpicetifyOptions: MessageBoxOptions = {
            type: 'info',
            buttons: ['Cancel', 'No', 'Yes'],
            defaultId: 2,
            title: 'Have you installed Spicetify?',
            message: 'If you have, please answer yes!'
        };
        const installedSpicetify: MessageBoxReturnValue = await dialog.showMessageBox(mainWindow!, installedSpicetifyOptions);

        if (installedSpicetify.response === 2) {
            const authorizeOptions: MessageBoxOptions = {
                type: 'info',
                buttons: ['Cancel', 'OK'],
                title: 'Since you installed Spicetify, let me spice it up?',
                message: 'Do you authorize me to modify your Spotify Spicetify configuration?'
            };
            const authorize: MessageBoxReturnValue = await dialog.showMessageBox(mainWindow!, authorizeOptions);
            
            if (authorize.response === 1) {
                await handleSpicetifySetup();
            }
        }
    } else {
        const authorizeOptions: MessageBoxOptions = {
            type: 'info',
            buttons: ['Cancel', 'OK'],
            title: 'Since you installed Spicetify, let me spice it up?',
            message: 'Do you authorize me to modify your Spotify Spicetify configuration?'
        };
        const authorize: MessageBoxReturnValue = await dialog.showMessageBox(mainWindow!, authorizeOptions);
        
        if (authorize.response === 1) {
            await handleSpicetifySetup();
        }  
    }
}

async function handleSpicetifySetup(): Promise<void> {
    //TODO: MAC DONT WORK HERE FIXING LATER

    //check to see if they are using windows or mac
    if (process.platform === 'win32') {
        // copy requestplus.js to the spicetify local roaming data folder.
        const sourceFile: string = path.join(__dirname, 'requestplus.js');
        const targetFile: string = path.join(app.getPath('appData'), 'spicetify', 'Extensions', 'requestplus.js');
        fs.copyFileSync(sourceFile, targetFile);
        //run the commands to apply spicetify changes
        exec('start cmd /c "spicetify config extensions requestplus.js"');
        exec('start cmd /c "spicetify apply"');
        await wait(7000);
        
        const successOptions: MessageBoxOptions = {
            type: 'info',
            buttons: ['Cancel', 'OK'],
            title: 'Success!',
            message: 'Welcome to Request+! Make sure to login with your twitch account to enable the requesting feature!'
        };
        dialog.showMessageBoxSync(mainWindow!, successOptions);   
    } else if (process.platform === 'darwin') {
        // MacOS specific code
        const sourceFile: string = path.join(__dirname, 'requestplus.js');
        const targetFile: string = path.join(os.homedir(), 'Library', 'Application Support', 'spicetify', 'Extensions', 'requestplus.js');
        fs.copyFileSync(sourceFile, targetFile);
        exec('open -a Terminal "spicetify config extensions requestplus.js"');
        exec('open -a Terminal "spicetify apply"');
        await wait(7000);
        
        const successOptions: MessageBoxOptions = {
            type: 'info',
            buttons: ['Cancel', 'OK'],
            title: 'Success!',
            message: 'Welcome to Request+! Make sure to login with your twitch account to enable the requesting feature!'
        };
        dialog.showMessageBoxSync(mainWindow!, successOptions);   
    }        
}