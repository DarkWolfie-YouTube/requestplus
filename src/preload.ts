import { contextBridge, ipcRenderer } from 'electron';
import { Queue } from './queueHandler';
import { songData } from './ytManager';

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

  // Queue controls
  getQueue: () => Promise<Queue>;
  removeFromQueue: (index: number) => Promise<boolean>;
  clearQueue: () => Promise<boolean>;
  playTrackAtIndex: (index: number) => Promise<boolean>;
  updateQueuePage: (callback: (queue: Queue) => void) => void;
  removeQueueListener: () => void;

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

  // Toast notifications
  onToast: (callback: (event: any, toastData: any) => void) => void;
  removeToastListener: () => void;

  // Debug function
  debugAddQueueItem?: () => Promise<void>;

  ytTest: () => Promise<songData>;

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

  // Queue controls
  getQueue: () => {
    console.log('Getting queue via IPC');
    return ipcRenderer.invoke('get-queue');
  },
  
  removeFromQueue: (index) => {
    console.log('Removing from queue index:', index);
    return ipcRenderer.invoke('remove-from-queue', index);
  },
  
  clearQueue: () => {
    console.log('Clearing queue via IPC');
    return ipcRenderer.invoke('clear-queue');
  },
  
  playTrackAtIndex: (index) => {
    console.log('Playing track at index:', index);
    return ipcRenderer.invoke('play-track-at-index', index);
  },
  
  // Queue update listener - this is the key fix
  updateQueuePage: (callback) => {
    console.log('Setting up queue update listener in preload');
    
    // Remove any existing listeners first
    ipcRenderer.removeAllListeners('update-queue');
    
    // Set up the new listener
    ipcRenderer.on('update-queue', (event, queue) => {
      console.log('Queue update received in preload:', queue);
      callback(queue); // Call the renderer callback with just the queue data
    });
  },
  
  removeQueueListener: () => {
    console.log('Removing queue update listener');
    ipcRenderer.removeAllListeners('update-queue');
  },

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

  // Toast handling
  onToast: (callback) => {
    console.log('Setting up toast listener in preload');
    ipcRenderer.on('show-toast', (event, toastData) => {
      console.log('Toast received in preload:', toastData);
      callback(event, toastData);
    });
  },
  
  removeToastListener: () => {
    ipcRenderer.removeAllListeners('show-toast');
  },

  // Debug function (optional - for testing)
  debugAddQueueItem: () => ipcRenderer.invoke('debug-add-queue-item'),

  ytTest: async () => {
    return await ipcRenderer.invoke('ytTest');
  },

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