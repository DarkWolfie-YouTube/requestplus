import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface
interface ElectronAPI {
  // Window controls
  minimize: () => Promise<void>;
  close: () => Promise<void>;

  // Music controls
  playPause: () => Promise<void>;
  skip: () => Promise<void>;
  previous: () => Promise<void>;
  like: () => Promise<void>;
  volume: (level: number) => Promise<void>;
  seek: (position: number) => Promise<void>;
  shuffle: () => Promise<void>;
  repeat: () => Promise<void>;

  // Twitch authentication
  twitchLogin: () => Promise<void>;
  twitchLogout: () => Promise<void>;
  authSuccess: (callback: (user: any) => void) => void;

  // Settings
  loadSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<void>;
  settingsUpdated: (settings: any) => void;

  // Update system
  checkForUpdates: () => Promise<void>;
  getUpdateSettings: () => Promise<any>;
  setPreReleaseCheck: (enabled: boolean) => Promise<void>;

  // Overlay
  getOverlayPath: () => Promise<string>;

  // Track info
  getInfo: (callback: (info: any) => void) => void;

  // First time setup
  runFirstTime: () => Promise<void>;

  // Preload function
  preload: () => void;


}

// Create the API object
const electronAPI: ElectronAPI = {
  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  close: () => ipcRenderer.invoke('window-close'),

  // Music controls
  playPause: () => ipcRenderer.invoke('song-play'),
  skip: () => ipcRenderer.invoke('song-skip'),
  previous: () => ipcRenderer.invoke('song-previous'),
  volume: (level) => ipcRenderer.invoke('song-volume', level),
  seek: (position) => ipcRenderer.invoke('song-seek', position),
  shuffle: () => ipcRenderer.invoke('song-shuffle'),
  repeat: () => ipcRenderer.invoke('song-repeat'),
  like: () => ipcRenderer.invoke('song-like'),

  // Twitch authentication
  twitchLogin: () => ipcRenderer.invoke('twitch-login'),
  twitchLogout: () => ipcRenderer.invoke('twitch-logout'),
  authSuccess: (callback) => {
    ipcRenderer.on('twitch-auth-success', (_, user) => callback(user));
  },

  // Settings
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  settingsUpdated: (settings) => ipcRenderer.send('settings-updated', settings),

  // Update system
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getUpdateSettings: () => ipcRenderer.invoke('get-update-settings'),
  setPreReleaseCheck: (enabled) => ipcRenderer.invoke('set-pre-release-check', enabled),

  // Overlay
  getOverlayPath: () => ipcRenderer.invoke('get-overlay-path'),

  // Track info
  getInfo: (callback) => {
    ipcRenderer.on('song-info', (_, info) => callback(info));
  },

  // First time setup
  runFirstTime: () => ipcRenderer.invoke('runFirstTime'),

  // Preload function
  preload: () => {
    console.log('Preload called - API is ready');
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', electronAPI);

// Also expose for backward compatibility
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for TypeScript
declare global {
  interface Window {
    api: ElectronAPI;
    electronAPI: ElectronAPI;
  }
}

export type { ElectronAPI };