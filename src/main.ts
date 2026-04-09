import { app, BrowserWindow, ipcMain, dialog, shell, MessageBoxOptions, MessageBoxReturnValue, net, session, Tray, Menu} from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { checkForUpdates, resolveModal } from './updateChecker';
import QueueHandler, { Queue, QueueItem } from './queueHandler';
import { updateElectronApp } from 'update-electron-app';

//Handlers
import websocket from './websocket';
import { TrackData } from './websocket';

import logger from './logger';
import { 
  authManager, 
  setupDeepLinkHandling, 
  setupAuthEventListeners
} from './authmanager';
import { websocketManager } from './websocketweb';
import APIHandler from './apiHandler';
import SettingsHandler from './settingsHandler';
import { Settings } from './settingsHandler';
import { songData, YTManager } from './ytManager';
import PlaybackHandler, { songInfo } from './playbackHandler';
import GTSHandler from './gtsHandler';
import AMHandler from './amhandler';
import { GalleryThumbnailsIcon } from 'lucide-react';

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


// Global variables with proper typing
let WSServer: websocket;
let currentSongInformation: songInfo;
let mainWindow: BrowserWindow | null = null;
let Logger: logger = null as any;
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
let tray: Tray | null = null;
let isQuitting: boolean = false;
let tokenRefreshTimer: NodeJS.Timeout | null = null;

function scheduleTokenRefresh(expiresAt: number): void {
  if (tokenRefreshTimer) clearTimeout(tokenRefreshTimer);
  // Refresh 5 minutes before expiry
  const msUntilRefresh = expiresAt - Date.now() - 5 * 60 * 1000;
  if (msUntilRefresh <= 0) {
    authManager.refreshAuthToken();
    return;
  }
  (global as any).Logger?.info(`[Main] Token refresh scheduled in ${Math.round(msUntilRefresh / 1000)}s`);
  tokenRefreshTimer = setTimeout(() => authManager.refreshAuthToken(), msUntilRefresh);
}

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
        } else if (settings.platform === 'youtube' && ytManager) {
            if (nextTrack.platform === 'youtube') {
                // YouTube video IDs are always 11 chars — slice is safer than split('-')
                const videoId = nextTrack.id.substring(0, 11);
                await ytManager.addItemToQueueById(videoId);
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

// Pre-detect auth deep link so ISAUTHING is set before createWindow runs
if (process.platform === 'win32') {
    const authArg = process.argv.find(arg => arg.startsWith('requestplus://'));
    if (authArg) (global as any).ISAUTHING = true;
}




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
    
    const customSession = session.fromPartition('persist:api-session', { cache: false });
    
    customSession.setCertificateVerifyProc((request, callback) => {
        if (request.hostname === 'api.requestplus.xyz') {
            callback(0); // 0 = success, bypass verification
        } else {
            callback(-3); // -3 = use default verification
        }
    });
    const request = net.request({
        method: 'GET',
        url: 'https://api.requestplus.xyz/hardware/check?id=' + authManager.getHardwareInfoPublic()?.deviceId,
        session: customSession
    });

    request.on('response', (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (data.banned) app.quit();
            } catch (e) {
                if (Logger) Logger.error('Error parsing response:', e);
                app.quit();
            }
        });
    });

    request.on('error', (error) => {
        if (Logger) Logger.error('Error checking hardware ban status:', error);
        app.quit();
    });

    request.end();

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
    
    if (!(global as any).ISAUTHING) {
        await checkForUpdates(mainWindow, Logger);
    }

    // Setup auth event listeners BEFORE deep link handling so events aren't missed
    setupAuthEventListeners(mainWindow);
    setupDeepLinkHandling(mainWindow);
    queueHandler = new QueueHandler(Logger, mainWindow, settings);
    settings = await settingsHandler.load();

        
    if (!WSServer && !(global as any).ISAUTHING) {
        WSServer = new websocket(443, mainWindow, Logger);
    }
    
    if (!ytManager) {
        ytManager = new YTManager(Logger);

        // Push song info to renderer immediately on every WebSocket state update
        ytManager.on('state-update', () => {
            if (settings.platform === 'youtube') {
                requestTrackInfo();
            }
        });
    }

    if (!amHandler) {
        amHandler = new AMHandler(mainWindow, Logger, settings);
    }

    
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
  if (!apiHandler && !(global as any).ISAUTHING) {
        apiHandler = new APIHandler(mainWindow, playbackHandler, Logger, settings);
    }
    

    if (!gtsHandler) {
        gtsHandler = new GTSHandler(app, mainWindow, apiHandler, playbackHandler, Logger, settings);
    }
    
    updateIntervalForSongInfo();
    if (authManager.isAuthenticated()) {
        mainWindow.webContents.send('auth-check', true);
    }

    // Create tray icon
    const iconPath = path.join(__dirname, 'assets', 'tray.png');
    tray = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show Request+',
            click: () => {
                mainWindow?.show();
                mainWindow?.focus();
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Request+');
    tray.setContextMenu(contextMenu);

    // Single click on tray icon shows/focuses the window
    tray.on('click', () => {
        if (mainWindow?.isVisible()) {
            mainWindow.focus();
        } else {
            mainWindow?.show();
        }
    });


    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });
}



// IPC Handlers
ipcMain.handle('load-settings', async (): Promise<Settings> => {
    return settingsHandler.load();
});

ipcMain.handle('ytTest', async (): Promise<songData> => {
    var data = await ytManager.getCurrentSong();
    if (data) {
        return data;
    } else {
        return {} as songData;
    }
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
        await mainWindow.hide();
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
        // Push the next queued request into Pear before skipping so it plays immediately
        if (queueHandler) {
            const nextTrack = queueHandler.getQueue().items.find(item => !item.isQueued);
            if (nextTrack) {
                const videoId = nextTrack.id.substring(0, 11);
                await ytManager.addItemToQueueById(videoId);
                await queueHandler.setTrackAsQueued(queueHandler.getQueue().items.indexOf(nextTrack));
            }
        }
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
ipcMain.handle('logout', async (): Promise<void> => {
    authManager.logout();
    websocketManager.disconnect();
})

ipcMain.handle('get-overlay-path', (): string | null => {
    return overlayPath;
});

ipcMain.handle('check-for-updates', (): void => {
    checkForUpdates(mainWindow, Logger);
});

ipcMain.on('modal-response', (_event, id: string, response: number) => {
    resolveModal(id, response);
});

ipcMain.handle('get-update-settings', (): UpdateSettings => {
    const { getSettings } = require('./updateChecker.js');
    return getSettings();
});

ipcMain.handle('set-pre-release-check', (event: Electron.IpcMainInvokeEvent, enabled: boolean): void => {
    const { setPreReleaseCheck } = require('./updateChecker.js');
    setPreReleaseCheck(enabled);
});

app.whenReady().then(async () => {
    if (!(global as any).ISAUTHING) {
        Logger = new logger();
        (global as any).Logger = Logger;
    }
    await createWindow();
});

app.on('window-all-closed', (): void => {
    // app.quit();
});

app.on('before-quit', () => {
    isQuitting = true;
    tray?.destroy();
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
    if (!authManager.isAuthenticated()) return null;
    try {
        const userData = await authManager.fetchUserData();
        return {
            display_name: userData?.user.displayName || null,
            profile_image_url: userData?.user.photoURL || null,
            email: userData?.user.email || null
        };
    } catch {
        return null;
    }
});



ipcMain.handle('auth:getHardwareInfo', async () => {
  return authManager.getHardwareInfoPublic();
});

ipcMain.handle('get-locale', async () => {
  return await authManager.fetchLocale();
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
    monitorTrackProgress(currentSongInformation);
    await wait(2000);
    checkCurrentlyPlayingTrack(currentSongInformation);
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
    songIntervalID = setInterval(() => {
        requestTrackInfo();
    }, 500);
}



ipcMain.handle('searchTest', async (): Promise<void> => {
    if (WSServer) {
        WSServer.WSSendToType({ command: "searchRequest", data: { query: "Shockwave Marshmello" } } as WSCommand, 'spotify');
    }
    await wait(1000);
    console.log('first search result', WSServer?.SearchResults[0]);
})

// fetch https://api.requestplus.xyz/experimental when logged in to Twitch or Kick and find the user's ID and if it is in the list set global.IsExperimentalUser = true; else false

app.whenReady().then(async () => {
    await wait(4000);
    const isExperimentalUser = await authManager.checkExperimentalUser();
    (global as any).IsExperimentalUser = isExperimentalUser;

    if (isExperimentalUser == true) {
        mainWindow?.webContents.send('experimental-user-status', isExperimentalUser);
        mainWindow?.webContents.send('show-toast', {
            message: 'You are an experimental user! Enjoy early access to new features.',
            type: 'success',
            duration: 5000
        })
    }
}
);

ipcMain.handle('auth-checker', async () => {
    const isAuthenticated = authManager.isAuthenticated();
    const userData = await authManager.fetchUserData();
    mainWindow?.webContents.send('auth-success', userData);
})



authManager.on('auth-success', async (token) => {
  (global as any).Logger.info('[Main] Auth success, connecting WebSocket...');
  const hardwareInfo = authManager.getHardwareInfoPublic();
  if (hardwareInfo) {
    websocketManager.connect(token.token, hardwareInfo.deviceId);
  }
  scheduleTokenRefresh(token.expiresAt);
  const isExperimentalUser = await authManager.checkExperimentalUser();
    (global as any).IsExperimentalUser = isExperimentalUser;

    if (isExperimentalUser == true) {
        mainWindow?.webContents.send('experimental-user-status', isExperimentalUser);
        mainWindow?.webContents.send('show-toast', {
            message: 'You are an experimental user! Enjoy early access to new features.',
            type: 'success',
            duration: 5000
        })
    }

  // Notify renderer — send both signals so either listener catches it
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auth-check', true);
  }

  // Push locale to renderer
  authManager.fetchLocale().then(locale => {
    mainWindow?.webContents.send('locale-update', locale);
  });

});

authManager.on('auth-refreshed', (token) => {
  console.log('[Main] Token refreshed, reconnecting WebSocket...');
  const hardwareInfo = authManager.getHardwareInfoPublic();
  if (hardwareInfo) {
    websocketManager.disconnect();
    websocketManager.connect(token.token, hardwareInfo.deviceId);
  }
  scheduleTokenRefresh(token.expiresAt);
});

authManager.on('auth-logout', () => {
  console.log('[Main] Auth logout, disconnecting WebSocket...');
  websocketManager.disconnect();
});


websocketManager.on('notification', (message) => {
    dialog.showMessageBox({
        type: 'info',
        buttons: ['OK'],
        defaultId: 0,
        cancelId: 0,
        title: 'Notification',
        message: message.message || 'You have a new notification.',
    });
});

websocketManager.on('song-request', async (message) => {

    if (settings.modsOnly) {
        if (!message.tags) {
            websocketManager.send({ type: 'song_request_response', message: 'ERR_MODS_ONLY', username: message.username, msgID: message.messageId, platform: message.platform, channel: message.channel });
            return;
        }
        if (message.tags.mod == false) {
            websocketManager.send({ type: 'song_request_response', message: 'ERR_MODS_ONLY', username: message.username, msgID: message.messageId, platform: message.platform, channel: message.channel });
            return;
        }

    }

    if (settings.subsOnly){
        if (!message.tags) {
            websocketManager.send({ type: 'song_request_response', message: 'ERR_SUBS_ONLY', username: message.username, msgID: message.messageId, platform: message.platform, channel: message.channel });
            return;
        } else if (message.tags.subscriber == false && !message.tags.mod) {
            websocketManager.send({ type: 'song_request_response', message: 'ERR_SUBS_ONLY', username: message.username, msgID: message.messageId, platform: message.platform, channel: message.channel });
            return;
        }
    }






  if (settings.platform === 'apple') {
      amHandler.handleChatRequest(message.message, queueHandler, settings, message.username).then((response) => {
          if (response === 'ERR_AM_NOLINK') {
              websocketManager.send({ type: 'song_request_response', message: 'ERR_AM_NOLINK', username: message.username, msgID: message.messageId, platform: message.platform, channel: message.channel });
          } else if (response === 'ERR_AM_IDENTIFIER_MISSING') {
              websocketManager.send({ type: 'song_request_response', message: 'ERR_AM_IDENTIFIER_MISSING', username: message.username, msgID: message.messageId, platform: message.platform, channel: message.channel });
          } else if (response === 'ERR_AM_SONG_NOT_FOUND') { 
              websocketManager.send({ type: 'song_request_response', message: 'ERR_AM_SONG_NOT_FOUND', username: message.username, msgID: message.messageId, platform: message.platform, channel: message.channel });
          } else if (JSON.parse(response).isQueued) {
            const queueObject = JSON.parse(response);
            console.log(queueObject);
            websocketManager.send({ type: 'song_request_response', message: 'OKAY_AM_QUEUED', username: message.username, songName: queueObject.title, artist: queueObject.artist, msgID: message.messageId, platform: message.platform, channel: message.channel });
          }
      })
  } else if (settings.platform === 'spotify') {
    console.log('Handling Spotify song request...');
    let songID = '';
    if (message.message.includes('spotify:track:')) {
        songID = message.message.split('spotify:track:')[1].split(' ')[0];
    } else if (message.message.includes('open.spotify.com/')) {
        const spotifyTrackMatch = message.message.match(/open\.spotify\.com\/(?:[^/]+\/)*track\/([A-Za-z0-9]+)/);
        if (spotifyTrackMatch) songID = spotifyTrackMatch[1];
    } else {
        websocketManager.send({ type: 'song_request_response', message: 'ERR_SP_IDENTIFIER_MISSING', username: message.username, msgID: message.messageId, platform: message.platform, channel: message.channel });
        return;
    }
    console.log('Extracted song ID:', songID);

    if (settings.autoPlay) {
        WSServer.WSSendToType({ command: 'getInfo', data: { uri: 'spotify:track:' + songID } } as WSCommand, 'spotify');
         setTimeout(() => {
            const songInfo = WSServer.lastReq;
            if (songInfo) {
                const queueItem: QueueItem = {
                    id: songID + '-' + message.username,
                    title: songInfo.name,
                    artist: songInfo.artist.map((artist: any) => artist.name).join(', '),
                    requestedBy: message.username,
                    album: songInfo.album?.name || 'Unknown Album',
                    duration: songInfo.duration,
                    progress: 0,
                    cover: 'https://i.scdn.co/image/' + (songInfo.album?.cover_group.image[0]?.file_id || ''),
                    platform: 'spotify',
                    iscurrentlyPlaying: false,
                };
                queueHandler.addToQueue(queueItem);
                websocketManager.send({ type: 'song_request_response', message: 'OKAY_SP_QUEUED', username: message.username, songName: queueItem.title, artist: queueItem.artist, msgID: message.messageId, platform: message.platform, channel: message.channel });
            } else {
                websocketManager.send({ type: 'song_request_response', message: 'ERR_SP_SONG_NOT_FOUND', username: message.username, msgID: message.messageId, platform: message.platform, channel: message.channel });
                return;
            }
        }, 200);
    } else {
        WSServer.WSSendToType({ command: 'getInfo', data: { uri: 'spotify:track:' + songID } } as WSCommand, 'spotify');
         setTimeout(() => {
            const songInfo = WSServer.lastReq;
            if (songInfo) {
                WSServer.WSSendToType({command: 'addTrack', data: { uri: 'spotify:track:' + songID }} as WSCommand, 'spotify');
                websocketManager.send({ type: 'song_request_response', message: 'OKAY_SP_QUEUED', username: message.username, songName: songInfo.name, artist: songInfo.artist.map((artist: any) => artist.name).join(', '), msgID: message.messageId, platform: message.platform, channel: message.channel });
            } else {
                websocketManager.send({ type: 'song_request_response', message: 'ERR_SP_SONG_NOT_FOUND', username: message.username, msgID: message.messageId, platform: message.platform, channel: message.channel });
                return;
            }
        }, 200);
    }
  } else if (settings.platform === 'youtube') {
    const videoId = YTManager.extractVideoId(message.message);

    if (!videoId) {
        websocketManager.send({ type: 'song_request_response', message: 'ERR_YT_IDENTIFIER_MISSING', username: message.username, msgID: message.messageId, platform: message.platform, channel: message.channel });
        return;
    }

    const songInfo = await ytManager.getSongTitle(videoId);
    const songName = songInfo?.title ?? videoId;
    const artist   = songInfo?.author ?? 'YouTube Music';
    const cover    = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    if (settings.autoPlay) {
        // Moderation queue — hold for manual approval
        const queueItem: QueueItem = {
            id: videoId + '-' + message.username,
            title: songName,
            artist,
            requestedBy: message.username,
            album: 'YouTube Music',
            duration: 0,
            progress: 0,
            cover,
            platform: 'youtube',
            iscurrentlyPlaying: false,
        };
        queueHandler.addToQueue(queueItem);
        websocketManager.send({ type: 'song_request_response', message: 'OKAY_YT_QUEUED', username: message.username, songName, artist, msgID: message.messageId, platform: message.platform, channel: message.channel });
    } else {
        // Add directly to Pear's playback queue
        const ok = await ytManager.addItemToQueueById(videoId);
        if (ok) {
            websocketManager.send({ type: 'song_request_response', message: 'OKAY_YT_QUEUED', username: message.username, songName, artist, msgID: message.messageId, platform: message.platform, channel: message.channel });
        } else {
            websocketManager.send({ type: 'song_request_response', message: 'ERR_YT_QUEUE_FAILED', username: message.username, msgID: message.messageId, platform: message.platform, channel: message.channel });
        }
    }
  }
});


websocketManager.on('song-search-request', async (message) => {
    console.log('Received song search request:', message);
    var newQuery = message.query
    if (settings.platform === 'spotify') { 
        websocketManager.send({ type: 'song_search_response', message: 'ERR_SP_SEARCH_NOT_ALLOWED',username: message.username, msgID: message.messageId, channel: message.channel });
    } else if (settings.platform === 'apple') {
        newQuery = newQuery.replace(' ', '+').trim();
        console.log('Performing Apple Music search with query:', newQuery);
        try {
            await amHandler.onSearchRequest(newQuery).then((response) => {
                console.log('Received response from Apple Music search:', response);
                if (response) {
                    const songName = response.songs.data[0]?.attributes?.name || 'Unknown Title';
                    const artist = response.songs.data[0]?.attributes?.artistName || 'Unknown Artist';
                    websocketManager.send({ type: 'song_search_response', message: 'OKAY_AM_SEARCH', username: message.username, songName, artist, msgID: message.messageId, platform: message.platform, channel: message.channel, songLink: response.songs.data[0]?.attributes?.url || '' });
                } else {
                    websocketManager.send({ type: 'song_search_response', message: 'ERR_AM_SEARCH_FAILED', username: message.username, msgID: message.messageId, platform: message.platform, channel: message.channel });
                }
            })}catch (error) {
                websocketManager.send({ type: 'song_search_response', message: 'ERR_AM_SEARCH_FAILED', username: message.username, msgID: message.messageId, platform: message.platform, channel: message.channel });
            }
    } else {
        websocketManager.send({ type: 'song_search_response', message: 'ERR_SEARCH_PLATFORM_NOT_SUPPORTED', username: message.username, msgID: message.messageId, platform: message.platform, channel: message.channel });
    }

});