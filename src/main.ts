import { app, BrowserWindow, ipcMain, dialog, shell, MessageBoxOptions, MessageBoxReturnValue } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { checkForUpdates } from './updateChecker';
import QueueHandler, { Queue } from './queueHandler';
import { updateElectronApp } from 'update-electron-app';
import { 
  authManager, 
  setupDeepLinkHandling, 
  setupAuthEventListeners 
} from './authmanager';
import { websocketManager } from './websocketweb';

//Handlers
import websocket from './websocket';
import { TrackData } from './websocket';

import logger from './logger';
import APIHandler from './apiHandler';
import SettingsHandler from './settingsHandler';
import { Settings } from './settingsHandler';
import { songData, YTManager } from './ytManager';
import PlaybackHandler, { songInfo } from './playbackHandler';
import GTSHandler from './gtsHandler';
import AMHandler from './amhandler';

var handleStartupEvent = function() {
  if (process.platform !== 'win32') {
    return false;
  }

  var squirrelCommand = process.argv[1];
  switch (squirrelCommand) {
    case '--squirrel-install':
    case '--squirrel-updated':
        var target = path.basename(process.execPath);
        var updateDotExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
        var child = require('child_process').spawn(updateDotExe, ['--createShortcut', target], { detached: true });
        child.unref();
      app.quit();
      return true;
    case '--squirrel-uninstall':
        var target = path.basename(process.execPath);
        var updateDotExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
        var child = require('child_process').spawn(updateDotExe, ['--removeShortcut', target], { detached: true });
        child.unref();
      app.quit();
      return true;
    case '--squirrel-obsolete':
      app.quit();
      return true;
  }
};

handleStartupEvent();
updateElectronApp();

// Type definitions
interface TwitchUser {
    id: string;
    login: string;
    display_name: string;
    profile_image_url: string;
    email: string;
}

interface KickUser {
    id: string;
    display_name: string;
    profile_image_url: string;
    email?: string;
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
let WSServer: websocket;
let currentSongInformation: songInfo;
let mainWindow: BrowserWindow | null = null;
let Logger: logger;
let settings: Settings;
let overlayPath: string;
let apiHandler: APIHandler;
let settingsHandler: SettingsHandler;
let twitchAccessToken: string | undefined;
let twitchUser: TwitchUser | undefined;
let kickAccessToken: string | undefined;
let kickUser: KickUser | undefined;
let queueHandler: QueueHandler;
let currentTrackId: string | null = null;
let currentTrackId2: string | null = null;
let autoQueueTriggered: boolean = false;
let lastTrackProgress: number = 0;
let ytManager: YTManager;
let playbackHandler: PlaybackHandler;
let gtsHandler: GTSHandler;
let amHandler: AMHandler;
let lastRequestQueueName: string;
let songIntervalID: NodeJS.Timeout;

// Auto-queue monitor function
async function monitorTrackProgress(trackData: songInfo): Promise<void> {
    if (!queueHandler || !trackData) return;
    if (!trackData.isPlaying) return;
    if (!trackData.progress) return;
    if (!trackData.duration) return;
    if (!gtsHandler) return;
    const progress = trackData.progress || 0;
    const duration = trackData.duration || 0;
    const trackId = trackData.id || '';
    const timeRemaining = duration - progress;
    const timeElapsed = progress;
    const TEN_SECONDS = 10000;
    const THIRTY_SECONDS = 30000;

    if (gtsHandler.hasGuessed = false && timeElapsed >= THIRTY_SECONDS) {
        gtsHandler.failedToGuess();
    }

    if (timeRemaining <= 6000 && timeRemaining > 0 && !apiHandler.hideSongFromView && settings.gtsEnabled) {
        Logger.info(`Track ending soon (${Math.floor(timeRemaining / 1000)}s remaining) calling Guess the song hide function...`);
        gtsHandler.callForHide();
        // await chatHandler.sendChatMessage('Guess the Song! Type !guess <song name> to make your guess before the guessing period ends!');
    }
    const queue = queueHandler.getQueue();
    if (queue.items.length === 0) return;


    if (currentTrackId !== trackId) {
        currentTrackId = trackId;
        autoQueueTriggered = false;
        lastTrackProgress = progress;
        Logger.info(`New track detected: ${trackId}`);
        checkCurrentlyPlayingTrack(trackData);
        return;
    }

    if (duration <= 0) return;

    
    if (timeRemaining <= TEN_SECONDS && timeRemaining > 0 && !autoQueueTriggered) {
        Logger.info(`Track ending soon (${Math.floor(timeRemaining / 1000)}s remaining) calling auto-queue function...`);
        autoQueueNextTrack();
        autoQueueTriggered = true;
    }

    lastTrackProgress = progress;
}

async function autoQueueNextTrack(): Promise<void> {
    if (!queueHandler || !WSServer) return;

    const queue = queueHandler.getQueue();
    if (queue.items.length === 0) {
        Logger.info('No items in queue to auto-add');
        return;
    }

    const nextTrack = queue.items[0];
    
    try {
        if (settings.platform === 'spotify') {
            if (nextTrack.platform === 'spotify') {
                WSServer.WSSendToType({
                    command: 'addTrack',
                    data: { uri: `spotify:track:${nextTrack.id.split('-')[0]}` }
                }, 'spotify');
            } 
        } else if (settings.platform === 'apple') {
            if (nextTrack.platform === 'apple') {
                amHandler.queueTrack(nextTrack.id.split('-')[0]);
            }
        }

        Logger.info(`Auto-queued track: ${nextTrack.title} by ${nextTrack.artist}`);
        
        sendToast(
            `Auto-queued: ${nextTrack.title} by ${nextTrack.artist}`,
            'info',
            4000
        );

        // await chatHandler.sendChatMessage(`Auto-queued: ${nextTrack.title} by ${nextTrack.artist}`);
        lastRequestQueueName = nextTrack.requestedBy;

        await queueHandler.setTrackAsQueued(0);

    } catch (error) {
        Logger.error('Error auto-queueing track:', error);
        sendToast('Failed to auto-queue next track', 'error', 3000);
    }
}

async function checkCurrentlyPlayingTrack(trackData: TrackData): Promise<void> {
    if (!queueHandler || !trackData) return;

    const queue = queueHandler.getQueue();
    if (queue.items.length === 0) return;

    let trackId = trackData.id;
    if (!trackId && trackData.uri) {
        trackId = trackData.uri.replace('spotify:track:', '');
    }
    if (!trackId) return;

    if (trackId.includes('spotify:track:')) {
        trackId = trackId.replace('spotify:track:', '');
    }

    const matchingTrackIndex = queue.items.findIndex(item => item.id === trackId + '-' + lastRequestQueueName);

    if (matchingTrackIndex !== -1) {
        if (currentTrackId2 === trackId) {
            return;
        }
        Logger.info(`Currently playing track matches queue item at index ${matchingTrackIndex}`);
        if (matchingTrackIndex !== 0) {
          Logger.info('Song is not at the top of the queue. Stopping.') 
          return; 
        }
        
        await queueHandler.setCurrentlyPlaying(matchingTrackIndex);
        
        const track = queue.items[matchingTrackIndex];
        sendToast(
            `Now Playing from Queue: ${track.title}`,
            'success',
            3000
        );
        Logger.info(`Now playing from queue: ${track.title} by ${track.artist}`);
        
        currentTrackId2 = trackId;

        setTimeout(async () => {
            await queueHandler.removeFromQueue(matchingTrackIndex);
            Logger.info(`Removed played track from queue: ${track.title}`);
            currentTrackId2 = '';
        }, 2000);
    }
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

settingsHandler = new SettingsHandler(app.getPath('userData'));



async function ensureOverlayFile(): Promise<string> {
    const userDataPath: string = app.getPath('userData');
    const overlayDir: string = path.join(userDataPath, 'overlay');
    const targetPath: string = path.join(overlayDir, 'overlay.html');

    if (!fs.existsSync(overlayDir)) {
        fs.mkdirSync(overlayDir, { recursive: true });
    }

    if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
    }

    const sourceFile: string = path.join(__dirname, 'views', 'overlay.html');
    if (!fs.existsSync(targetPath) || !app.isPackaged) {
        fs.copyFileSync(sourceFile, targetPath);
    }

    overlayPath = targetPath;

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
        width: 600,
        height: 1000,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            devTools: !app.isPackaged,
            webSecurity: true,
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
            if (twitchUser) mainWindow?.webContents.send('twitch-auth-success', twitchUser);
            if (kickUser) mainWindow?.webContents.send('kick-auth-success', kickUser);
        });
    } else {
        mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }
    //load devtools
    // mainWindow.webContents.openDevTools();
    
    const userDataPath: string = app.getPath('userData');
    if (Logger) {
        Logger.info('Logger initialized');
    } else {
        Logger = new logger();
        Logger.info('Logger initialized');
    }
    queueHandler = new QueueHandler(Logger, mainWindow, settings);
    settings = await settingsHandler.load();

        
    if (!WSServer) {
        WSServer = new websocket(443, mainWindow, Logger);
    }
    
    if (!ytManager) {
        ytManager = new YTManager(Logger);
    }

    if (!amHandler) {
        amHandler = new AMHandler(mainWindow, Logger, settings);
    }

    await checkForUpdates(mainWindow, Logger);
    setupDeepLinkHandling(mainWindow);

    // Setup auth event listeners
    setupAuthEventListeners(mainWindow);
    
    if (!playbackHandler) {
        playbackHandler = new PlaybackHandler(settings.platform, WSServer, Logger, ytManager, amHandler);
    }
    
    if (authManager.isAuthenticated()) {
    const token = authManager.getAuthToken();
    const hardwareInfo = authManager.getHardwareInfoPublic();
    
    if (token && hardwareInfo) {
      websocketManager.connect(token.token, hardwareInfo.deviceId);
    }
  }
    

    if (!gtsHandler) {
        gtsHandler = new GTSHandler(app, mainWindow, apiHandler, playbackHandler, Logger, settings);
    }
    
    updateIntervalForSongInfo();
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}



// IPC Handlers
ipcMain.handle('load-settings', async (): Promise<Settings> => {
    return settingsHandler.load();
});

ipcMain.handle('ytTest', async (): Promise<songData> => {
    return ytManager.getCurrentSong();
});

ipcMain.handle('save-settings', (event: Electron.IpcMainInvokeEvent, settinga: Settings): Promise<void> => {
    return new Promise((resolve, reject) => {
        var saved = settingsHandler.save(settinga);

        if (saved) {
            settings = settinga;
            playbackHandler.updateSettings(settings.platform);
            apiHandler.updateSettings(settings);
            gtsHandler.updateSettings(settings);
            amHandler.updateSettings(settings);
            updateIntervalForSongInfo();
            resolve();
        } else {
            reject(new Error('Failed to save settings'));
        }
    });
});

ipcMain.on('settings-updated', (event: Electron.IpcMainEvent, settings: Settings): void => {
    console.log('Settings updated:', settings);
    settings = settings;
    settingsHandler.save(settings);
    playbackHandler.updateSettings(settings.platform);
    apiHandler.updateSettings(settings);
    gtsHandler.updateSettings(settings);
    amHandler.updateSettings(settings);
    updateIntervalForSongInfo();
});

ipcMain.handle('window-minimize', (): void => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-close', async (): Promise<void> => {
    if (mainWindow) {
        await mainWindow.close();
    }
});

ipcMain.handle('song-play', async (): Promise<void> => {
    const platform = settings.platform
    
    if (platform === 'spotify' && WSServer) {
        WSServer.WSSendToType({ command: 'PlayPause' } as WSCommand, 'spotify');
    } else if (platform === 'youtube' && ytManager) {
        await ytManager.playPause();
    } else if (platform === 'apple' && amHandler) {
        await amHandler.playPause();
    } else if (platform === 'soundcloud' && WSServer) {
        WSServer.WSSendToType({ command: 'PlayPause' } as WSCommand, 'soundcloud');
    }
});

ipcMain.handle('song-pause', async (): Promise<void> => {
    const platform = settings.platform
    
    if (platform === 'spotify' && WSServer) {
        WSServer.WSSendToType({ command: 'PlayPause' } as WSCommand, 'spotify');
    } else if (platform === 'youtube' && ytManager) {
        await ytManager.playPause();
    } else if (platform === 'apple' && amHandler) {
        await amHandler.playPause();
    }
});

ipcMain.handle('song-skip', async (): Promise<void> => {
    const platform = settings.platform
    
    if (platform === 'spotify' && WSServer) {
        WSServer.WSSendToType({ command: 'Next' } as WSCommand, 'spotify');
    } else if (platform === 'youtube' && ytManager) {
        await ytManager.next();
    } else if (platform === 'apple' && amHandler) {
        await amHandler.nextTrack();
    } else if (platform === 'soundcloud' && WSServer) {
        WSServer.WSSendToType({ command: 'Next' } as WSCommand, 'soundcloud');
    }
});

ipcMain.handle('play-track-at-index', async (event: Electron.IpcMainInvokeEvent, index: number): Promise<void> => {
    const platform = settings.platform
    autoQueueNextTrack();
});

ipcMain.handle('song-previous', async (): Promise<void> => {
    const platform = settings.platform
    
    if (platform === 'spotify' && WSServer) {
        WSServer.WSSendToType({ command: 'Prev' } as WSCommand, 'spotify');
    } else if (platform === 'youtube' && ytManager) {
        await ytManager.previous();
    } else if (platform === 'apple' && amHandler) {
        await amHandler.previousTrack();
    } else if (platform === 'soundcloud' && WSServer) {
        WSServer.WSSendToType({ command: 'Prev' } as WSCommand, 'soundcloud');
    }

});

ipcMain.handle('song-like', async (): Promise<void> => {
    const platform = settings.platform
    
    if (platform === 'spotify' && WSServer) {
        WSServer.WSSendToType({ command: 'like' } as WSCommand, 'spotify');
    } else if (platform === 'youtube' && ytManager) {
        await ytManager.toggleLike();
    } else if (platform === 'apple' && amHandler) {
        await amHandler.likeSong();
    } else if (platform === 'soundcloud' && WSServer) {
        WSServer.WSSendToType({ command: 'like' } as WSCommand, 'soundcloud');
    }
});

ipcMain.handle('song-volume', async (event: Electron.IpcMainInvokeEvent, level: number): Promise<void> => {
    const platform = settings.platform
    
    if (platform === 'spotify' && WSServer) {
        WSServer.WSSendToType({ command: 'volume', data: { volume: level } } as WSCommand, 'spotify');
    } else if (platform === 'youtube' && ytManager) {
        await ytManager.setVolume(level * 100);
    } else if (platform === 'apple' && amHandler) {
        await amHandler.setVolume(level);
    } else if (platform === 'soundcloud' && WSServer) {
        WSServer.WSSendToType({ command: 'volume', data: { volume: level } } as WSCommand, 'soundcloud');
    }
});

ipcMain.handle('song-seek', async (event: Electron.IpcMainInvokeEvent, position: number): Promise<void> => {
    const platform = settings.platform
    
    if (platform === 'spotify' && WSServer) {
        WSServer.WSSendToType({ command: 'seek', data: { position } } as WSCommand, 'spotify');
    } else if (platform === 'youtube' && ytManager) {
        await ytManager.seek(Math.floor(position / 1000));
    } else if (platform === 'apple' && amHandler) {
        await amHandler.seekTo(position / 1000);
    }
});

ipcMain.handle('song-shuffle', async (): Promise<void> => {
    const platform = settings.platform
    
    if (platform === 'spotify' && WSServer) {
        WSServer.WSSendToType({ command: 'shuffle' } as WSCommand, 'spotify');
    } else if (platform === 'youtube' && ytManager) {
        await ytManager.toggleShuffle();
    } else if (platform === 'apple' && amHandler) {
        await amHandler.setShuffle();
    }
});

ipcMain.handle('song-repeat', async (): Promise<void> => {
    const platform = settings.platform
    
    if (platform === 'spotify' && WSServer) {
        WSServer.WSSendToType({ command: 'repeat' } as WSCommand, 'spotify');
    } else if (platform === 'youtube' && ytManager) {
        await ytManager.cycleRepeat();
    } else if (platform === 'apple' && amHandler) {
        await amHandler.setRepeat();
    }   
});

// Twitch Auth Handlers


ipcMain.handle('get-overlay-path', (): string | null => {
    return overlayPath;
});

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
    app.quit();
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

ipcMain.handle('login', async () => {
    try {
    await authManager.startAuthFlow();
    return { success: true };
  } catch (error: any) {
    console.error('Error starting auth flow:', error);
    return { success: false, error: error.message };
  }
});


ipcMain.handle('auth:getStatus', async () => {
  const isAuthenticated = authManager.isAuthenticated();
  const token = authManager.getAuthToken();
  const hardwareInfo = authManager.getHardwareInfoPublic();

  return {
    isAuthenticated,
    token: token?.token || null,
    deviceId: hardwareInfo?.deviceId || null,
    expiresAt: token?.expiresAt || null
  };
});

ipcMain.handle('fetch-user-data', async () => {
    const userData = await authManager.fetchUserData();
    return {
        display_name: userData?.displayName || null,
        profile_image_url: userData?.photoUrl || null,
    }
});



ipcMain.handle('auth:getHardwareInfo', async () => {
  return authManager.getHardwareInfoPublic();
});

/**
 * Logout
 */
ipcMain.handle('auth:logout', async () => {
  authManager.logout();
  websocketManager.disconnect();
  return { success: true };
});

/**
 * Refresh token
 */
ipcMain.handle('auth:refresh', async () => {
  const success = await authManager.refreshAuthToken();
  return { success };
});


async function requestTrackInfo(): Promise<void> {
    if (!playbackHandler) return;
    const info = await playbackHandler.getCurrentSong();

    if (!info) return;
    const currentSongInformation: songInfo = { ...info };
    mainWindow?.webContents.send('song-info', currentSongInformation);
    if (settings.platform !== 'youtube') {
        monitorTrackProgress(currentSongInformation);
        await wait(2000);
        checkCurrentlyPlayingTrack(currentSongInformation);
    }
}

function sendToast(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info', duration: number = 5000): void {
    if (!mainWindow || mainWindow.isDestroyed()) {
        console.warn('Cannot send toast - window is null or destroyed');
        return;
    }
    
    try {
        const toastData = {
            message: String(message),
            type: String(type),
            duration: Number(duration)
        };
        mainWindow.webContents.send('show-toast', toastData);
    } catch (error) {
        console.error('Error sending toast:', error);
    }
}

function updateIntervalForSongInfo(): void {
    if (songIntervalID) {
        clearInterval(songIntervalID);
    }
    if (settings.platform === 'apple') {
    songIntervalID = setInterval(() => {
        requestTrackInfo();
    }, 2000);}
    else {
    songIntervalID = setInterval(() => {
        requestTrackInfo();
    }, 500);
 }
}



ipcMain.handle('searchTest', async (): Promise<void> => {
    if (WSServer) {
        WSServer.WSSendToType({ command: "searchRequest", data: { query: "Shockwave Marshmello" } } as WSCommand, 'spotify');
    }
    await wait(1000);
    console.log('first search result', WSServer?.SearchResults[0]);
})

// fetch https://api.requestplus.xyz/experimental when logged in to Twitch or Kick and find the user's ID and if it is in the list set global.IsExperimentalUser = true; else false

authManager.on('auth-success', (token) => {
  console.log('[Main] Auth success, connecting WebSocket...');
  const hardwareInfo = authManager.getHardwareInfoPublic();
  if (hardwareInfo) {
    websocketManager.connect(token.token, hardwareInfo.deviceId);
  }
});

authManager.on('auth-refreshed', (token) => {
  console.log('[Main] Token refreshed, reconnecting WebSocket...');
  const hardwareInfo = authManager.getHardwareInfoPublic();
  if (hardwareInfo) {
    websocketManager.disconnect();
    websocketManager.connect(token.token, hardwareInfo.deviceId);
  }
});

authManager.on('auth-logout', () => {
  console.log('[Main] Auth logout, disconnecting WebSocket...');
  websocketManager.disconnect();
});


