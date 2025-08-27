// Global type declarations for Electron API

interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
  email?: string;
}

interface TrackInfo {
  title: string;
  artist_name?: string;
  'artist_name:1'?: string;
  'artist_name:2'?: string;
  'artist_name:3'?: string;
  'artist_name:4'?: string;
  'artist_name:5'?: string;
  image?: string;
  image_large_url?: string;
  duration: number;
  progress: number;
  isPlaying: boolean;
}

interface Settings {
  showNotifications?: boolean;
  theme?: string;
  enableRequests?: boolean;
  modsOnly?: boolean;
  requestLimit?: number;
  [key: string]: any;
}

interface UpdateSettings {
  checkPreReleases: boolean;
  [key: string]: any;
}

interface ElectronAPI {
  // Window controls
  minimize: () => Promise<void>;
  close: () => Promise<void>;

  // Music controls
  playPause: () => Promise<void>;
  skip: () => Promise<void>;
  previous: () => Promise<void>;

  // Twitch authentication
  twitchLogin: () => Promise<void>;
  twitchLogout: () => Promise<void>;
  authSuccess: (callback: (user: TwitchUser) => void) => void;

  // Settings
  loadSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<void>;
  settingsUpdated: (settings: Settings) => void;

  // Update system
  checkForUpdates: () => Promise<void>;
  getUpdateSettings: () => Promise<UpdateSettings>;
  setPreReleaseCheck: (enabled: boolean) => Promise<void>;

  // Overlay
  getOverlayPath: () => Promise<string>;

  // Track info
  getInfo: (callback: (info: TrackInfo) => void) => void;

  // First time setup
  runFirstTime: () => Promise<void>;

  // Preload function
  preload: () => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
    electronAPI: ElectronAPI;
  }
}

export {};