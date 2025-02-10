const websocket = require('./websocket.js');
const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('node:fs');
const path = require('node:path');
const Auth = require('./authManager.js');
const logger = require('./logger.js');
const ChatHandler = require('./chatHandler.js');
const apiHandler = require('./apiHandler.js');
const settingsHandler = require('./settingsHandler.js');

const TWITCH_CLIENT_ID = 'if6usvbqj58fwdbycnu6v77jjsluq5';
const TWITCH_REDIRECT_URI = 'http://localhost:3000';
const TWITCH_SCOPES = ['user:read:email', "chat:read", "chat:edit"];

let WSServer;
let currentSongInformation;
let mainWindow;
let AuthManager;
let Logger;
let chatHandler;
let settings;
let overlayPath = null;
let APIHandler;
let SettingsHandler;



async function createAuthWindow() {
    authWindow = new BrowserWindow({
        width: 600,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${TWITCH_REDIRECT_URI}&response_type=token&scope=${TWITCH_SCOPES.join('+')}`;
    authWindow.loadURL(authUrl);

    authWindow.webContents.on('will-navigate', (event, url) => {
        handleAuthCallback(event, url);
    });

    authWindow.webContents.on('did-navigate', (event, url) => {
        handleAuthCallback(event, url);
    });

    authWindow.on('closed', () => {
        authWindow = null;
    });
}

async function handleAuthCallback(event, url) {
    Logger.info('Navigated to:', url);
    if (url.includes('#access_token=')) {
        const token = url.split('#access_token=')[1].split('&')[0];
        twitchAccessToken = token;
        
        // Get user info
        try {
            const response = await fetch('https://api.twitch.tv/helix/users', {
                headers: {
                    'Client-ID': TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            twitchUser = data.data[0];
            mainWindow.webContents.send('twitch-auth-success', twitchUser);

            // Save token to file
            const tokenData = {
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

        if (authWindow) {
            authWindow.close();
        }
    }
}
async function ensureOverlayFile() {
    const userDataPath = app.getPath('userData');
    const overlayDir = path.join(userDataPath, 'overlay');
    const targetPath = path.join(overlayDir, 'overlay.html');

    // Create overlay directory if it doesn't exist
    if (!fs.existsSync(overlayDir)) {
        fs.mkdirSync(overlayDir, { recursive: true });
    }

    // Delete overlay file if it already exists
    if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
    }

    // Copy overlay file if it doesn't exist or if we're in development
    const sourceFile = path.join(__dirname, 'views', 'overlay.html');
    if (!fs.existsSync(targetPath) || !app.isPackaged) {
        fs.copyFileSync(sourceFile, targetPath);
    }

    overlayPath = targetPath;

    // make it copy the styles folder with it.
    const stylesDir = path.join(__dirname, 'views', 'styles');
    const targetStylesDir = path.join(overlayDir, 'styles');
    if (!fs.existsSync(targetStylesDir)) {
        fs.mkdirSync(targetStylesDir, { recursive: true });
    }
    const styles = fs.readdirSync(stylesDir);
    styles.forEach(style => {
        const sourceStyle = path.join(stylesDir, style);
        const targetStyle = path.join(targetStylesDir, style);
        fs.copyFileSync(sourceStyle, targetStyle);
    });


    return targetPath;
}





async function createWindow() {
    ensureOverlayFile();
   

    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            devTools: !app.isPackaged
        }, 
        frame: false,
        title: "Request+ (NEW)",
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        titleBarOverlay: false,
        resizable: false
    });

    mainWindow.loadFile(path.join(__dirname, 'views/index.html'));
    
    // Initialize AuthManager with user data path
    const userDataPath = app.getPath('userData');
    if (Logger) {
        Logger.info('Logger initialized');
    } else {
        Logger = new logger();
        Logger.info('Logger initialized');

    }

    AuthManager = new Auth(userDataPath, Logger, mainWindow);
    if (!WSServer) {
        WSServer = new websocket(443, mainWindow, Logger)
    }

    SettingsHandler = new settingsHandler(app.getPath('userData'));
    //Load saved settings before creating window
    await loadSavedSettings();
    // Check for existing valid token
    await checkStoredToken();


    if (!APIHandler) {
        APIHandler = new apiHandler(mainWindow, WSServer, Logger, settings);
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}


async function checkStoredToken() {
    try {
        const storedToken = await AuthManager.getStoredToken();
        if (storedToken) {
            twitchAccessToken = storedToken.access_token;
            twitchUser = storedToken;
            mainWindow.webContents.send('twitch-auth-success', twitchUser);
            if (!chatHandler) {
                chatHandler = new ChatHandler(Logger, mainWindow, storedToken, WSServer);
                chatHandler.connect();
            }
        }
    } catch (error) {
        logger.error('Error checking stored token:', error);
        mainWindow.webContents.send('twitch-auth-error', { message: 'Failed to validate token' });
    }
}

async function loadSavedSettings() {
    try {
        settings = await SettingsHandler.load();
        if (settings) {
            Logger.info('Loaded settings:', settings);
            mainWindow.webContents.send('settings-loaded', settings);
        } else {
            Logger.info('No settings found.');
        }
    } catch (error) {
        Logger.error('Error loading settings:', error);
    }
}



ipcMain.handle('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-close', async () => {
    if (mainWindow) {
        await mainWindow.close();
    
    }
});
ipcMain.handle('song-play', () => {
    if (WSServer) {
        WSServer.WSSend({'command':'PlayPause'})
    }
})
ipcMain.handle('song-pause', () => {
    if (WSServer) {
        WSServer.WSSend({'command':'PlayPause'})
    }
})

ipcMain.handle('song-skip', () => {
    if (WSServer) {
        WSServer.WSSend({'command':'Next'})
    }
})
ipcMain.handle('song-previous', () => {
    if (WSServer) {
        WSServer.WSSend({'command':'Prev'})
    }
})

ipcMain.handle('twitch-login', () => {
    createAuthWindow()
})

ipcMain.handle('get-overlay-path', () => {
    return overlayPath;
});

ipcMain.handle('send-settings', (event, settingss) => {
    SettingsHandler.save(settingss);
    settings = settingss;
    APIHandler.theme = settingss.theme;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});



function requestTrackInfo() {
    if (WSServer) {
        WSServer.WSSend({'command':'getdata'})
    }

}

setInterval(requestTrackInfo, 1000);



