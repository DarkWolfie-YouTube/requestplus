import websocket from './websocket';
import { TrackData } from './websocket';
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
import QueueHandler, { Queue } from './queueHandler';
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
let WSServer: websocket; // Type this according to your websocket class
let currentSongInformation: TrackData; // Define currentTrackInfo interface as needed
let mainWindow: BrowserWindow | null = null;
let AuthManager: Auth; // Type this according to your Auth class
let Logger: logger; // Type this according to your logger class
let chatHandler: ChatHandler; // Type this according to your ChatHandler class
let settings: Settings;
let overlayPath: string;
let apiHandler: APIHandler; // Type this according to your apiHandler class
let settingsHandler: SettingsHandler; // Type this according to your settingsHandler class
let twitchAccessToken: string | undefined;
let twitchUser: TwitchUser | undefined;
let queueHandler: QueueHandler;
let currentTrackId: string | null = null;
let currentTrackId2: string | null = null;
let autoQueueTriggered: boolean = false;
let lastTrackProgress: number = 0;


// Auto-queue monitor function
function monitorTrackProgress(trackData: TrackData): void {
    if (!queueHandler || !trackData) return;

    // Skip if track is not currently playing
    if (!trackData.isPlaying) return;

    // Skip if track progress is not available
    if (!trackData.progress) return;

    // Skip if track duration is not available
    if (!trackData.duration) return;



    const queue = queueHandler.getQueue();
    if (queue.items.length === 0) return;

    // Get current track info
    const progress = trackData.progress || 0;
    const duration = trackData.duration || 0;
    const trackId = trackData.id || trackData.uri;

    // Reset auto-queue trigger when a new track starts
    if (currentTrackId !== trackId) {
        currentTrackId = trackId;
        autoQueueTriggered = false;
        lastTrackProgress = progress;
        Logger.info(`New track detected: ${trackId}`);
        
        // Check if this track matches any queue item and mark as currently playing
        checkCurrentlyPlayingTrack(trackData);
        return;
    }

    // Skip if duration is not available
    if (duration <= 0) return;

    // Calculate time remaining in milliseconds
    const timeRemaining = duration - progress;
    const TEN_SECONDS = 10000; // 10 seconds in milliseconds

    // Trigger auto-queue when 10 seconds remaining and not already triggered
    if (timeRemaining <= TEN_SECONDS && timeRemaining > 0 && !autoQueueTriggered) {
        Logger.info(`Track ending soon (${Math.floor(timeRemaining / 1000)}s remaining), adding next queue item`);
        autoQueueNextTrack();
        autoQueueTriggered = true;
    }

    lastTrackProgress = progress;
}

// Function to add the next track from queue to Spotify queue
async function autoQueueNextTrack(): Promise<void> {
    if (!queueHandler || !WSServer) return;

    const queue = queueHandler.getQueue();
    if (queue.items.length === 0) {
        Logger.info('No items in queue to auto-add');
        return;
    }

    // Get the first item in queue (index 0)
    const nextTrack = queue.items[0];
    
    try {
        // Add track to Spotify queue
        WSServer.WSSend({
            command: 'addTrack',
            data: { uri: `spotify:track:${nextTrack.id}` }
        });

        Logger.info(`Auto-queued track: ${nextTrack.title} by ${nextTrack.artist}`);
        
        // Show toast notification
        sendToast(
            `Auto-queued: ${nextTrack.title} by ${nextTrack.artist}`,
            'info',
            4000
        );

        // Mark this track as queued for auto-play (we'll handle the currently playing update when it actually starts)
        await queueHandler.setTrackAsQueued(0);

    } catch (error) {
        Logger.error('Error auto-queueing track:', error);
        sendToast('Failed to auto-queue next track', 'error', 3000);
    }
}

// Function to check if currently playing track matches any queue item
async function checkCurrentlyPlayingTrack(trackData: TrackData): Promise<void> {
    if (!queueHandler || !trackData) return;

    const queue = queueHandler.getQueue();
    if (queue.items.length === 0) return;

    // Extract track ID from various possible sources
    let trackId = trackData.id;
    if (!trackId && trackData.uri) {
        trackId = trackData.uri.replace('spotify:track:', '');
    }
    if (!trackId) return;

    if (trackId.includes('spotify:track:')) {
        trackId = trackId.replace('spotify:track:', '');
    }

    // Find matching track in queue by ID
    const matchingTrackIndex = queue.items.findIndex(item => item.id === trackId);


    if (matchingTrackIndex !== -1) {
        if (currentTrackId2 === trackId) {
            // Already marked as currently playing
            return;
        }
        Logger.info(`Currently playing track matches queue item at index ${matchingTrackIndex}`);
        
        // Set this track as currently playing
        await queueHandler.setCurrentlyPlaying(matchingTrackIndex);
        
        // Show notification
        const track = queue.items[matchingTrackIndex];
        sendToast(
            `Now Playing from Queue: ${track.title}`,
            'success',
            3000
        );
        Logger.info(`Now playing from queue: ${track.title} by ${track.artist}`);
        
        // Mark this track as currently playing
        currentTrackId2 = trackId;

        // Remove the track from queue after a short delay (it's now playing)
        setTimeout(async () => {
            await queueHandler.removeFromQueue(matchingTrackIndex);
            Logger.info(`Removed played track from queue: ${track.title}`);
            currentTrackId2 = '';
        }, 20000);
    }
}

// Declare global variables that might be set by build process
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

settingsHandler = new SettingsHandler(app.getPath('userData'));

async function createAuthWindow(): Promise<void> {
    const authUrl: string = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${TWITCH_REDIRECT_URI}&response_type=token&scope=${TWITCH_SCOPES.join('+')}`;
    // open this url in a browser
    shell.openExternal(authUrl);
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
        height: 1080,
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
    queueHandler = new QueueHandler(Logger, WSServer, mainWindow, settings);

    AuthManager = new Auth(userDataPath, Logger, mainWindow);
    if (!WSServer) {
        WSServer = new websocket(443, mainWindow, Logger);
    }
    settings = await settingsHandler.load();
    // Check for existing valid token
    await checkStoredToken();

    await checkForUpdates(mainWindow, Logger);

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
        if (storedToken) {
            twitchAccessToken = storedToken.access_token;
            twitchUser = storedToken as TwitchUser;
            mainWindow?.webContents.send('twitch-auth-success', twitchUser);
            if (!chatHandler) {
                chatHandler = new ChatHandler(Logger, mainWindow, ({ login: twitchUser.login, access_token: twitchAccessToken }), WSServer, settings, queueHandler);
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

ipcMain.handle('save-settings', (event: Electron.IpcMainInvokeEvent, settinga: Settings): Promise<void> => {
    return new Promise((resolve, reject) => {
        var saved = settingsHandler.save(settinga);

        if (saved) {
            settings = settinga;
            chatHandler.updateSettings(settings);
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

// Add update checker IPC handlers
ipcMain.handle('check-for-updates', (): void => {
    checkForUpdates(mainWindow, Logger);
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

ipcMain.handle('get-queue', (): Queue => {
    if (queueHandler) {
        return queueHandler.getQueue();
    }
    return { items: [], currentCount: 0, currentlyPlayingIndex: -1 };
});

ipcMain.handle('remove-from-queue', async  (event: Electron.IpcMainInvokeEvent, index: number): Promise<boolean> => {
    return queueHandler ? queueHandler.removeFromQueue(index) : false;
});

ipcMain.handle('clear-queue', async (): Promise<boolean> => {
    return queueHandler ? queueHandler.clearQueue() : false;
});

async function requestTrackInfo(): Promise<void> {
    if (WSServer) {
        WSServer.WSSend({ command: 'getdata' } as WSCommand);
        
        currentSongInformation = WSServer.lastInfo;
        if (currentSongInformation) {
            monitorTrackProgress(currentSongInformation);
            await wait(2000);
            checkCurrentlyPlayingTrack(currentSongInformation);
        }
    }
}


function sendToast(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info', duration: number = 5000): void {
    if (!mainWindow || mainWindow.isDestroyed()) {
        console.warn('Cannot send toast - window is null or destroyed');
        return;
    }
    
    try {
        // Create a simple, serializable object
        const toastData = {
            message: String(message),
            type: String(type),
            duration: Number(duration)
        };
    
        
        // Send the toast data to the renderer
        mainWindow.webContents.send('show-toast', toastData);
    } catch (error) {
        console.error('Error sending toast:', error);
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