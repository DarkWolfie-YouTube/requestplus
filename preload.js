const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    minimize: () => ipcRenderer.invoke('window-minimize'),
    close: () => ipcRenderer.invoke('window-close'),
    play: () => ipcRenderer.invoke('song-play'),
    pause: () => ipcRenderer.invoke('song-pause'),
    skip: () => ipcRenderer.invoke('song-skip'),
    previous: () => ipcRenderer.invoke('song-previous'),
    getInfo: (callback) => ipcRenderer.on('song-info', (_, info) => { callback(info) }),
    twitchLogin: () => ipcRenderer.invoke('twitch-login'),
    twitchLogout: () => ipcRenderer.invoke('twitch-logout'),
    authSuccess: (callback) => ipcRenderer.on('twitch-auth-success', (_, user) => { callback(user) }),
    getOverlayPath: () => ipcRenderer.invoke('get-overlay-path'),
    sendSettings: (settings) => { ipcRenderer.invoke('send-settings', settings) },
    preload: () => ipcRenderer.invoke('runFirstTime'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    getUpdateSettings: () => ipcRenderer.invoke('get-update-settings'),
    setPreReleaseCheck: (enabled) => ipcRenderer.invoke('set-pre-release-check', enabled),
    settingsLoaded: (callback) => ipcRenderer.on('settings-loaded', (_, settings) => { callback(settings) })
});

