import { app, BrowserWindow, ipcMain, shell} from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;
declare const OOBE_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const OOBE_WINDOW_VITE_NAME: string;

type WindowKind = 'main' | 'oobe';
let overlayPath = path.join(app.getPath('userData'), 'overlay', 'overlay.html')

export interface RequestPlusSettings {
  theme?: string;
  showNotifications?: boolean;
  enableRequests?: boolean;
  modsOnly?: boolean;
  subsOnly?: boolean;
  requestLimitEnabled?: boolean;
  requestLimit?: number;
  autoPlay?: boolean;
  autoAcceptSearchResults?: boolean;
  useChannelPoints?: boolean;
  filterExplicit?: boolean;
  platform?: string;
  telemetryEnabled?: boolean;
  gtsEnabled?: boolean;
  /** Enable multi-platform mode */
  multiPlatform?: boolean;
  /** Platforms active in multi-platform mode */
  platforms?: string[];
  /** Which platform to search on when a request has no URL (multi-platform mode) */
  primarySearchPlatform?: string;
  /** Cider major version for Apple Music integration */
  ciderApiVersion?: '3' | '4';
  /** Scoped Cider 4 API token. Cider 3 keeps using appleMusicAppToken. */
  ciderV4AppToken?: string;
  oobeCompleted?: boolean;
  [key: string]: any;
}

interface ManagedWindowOptions {
  kind: WindowKind;
  title?: string;
  width?: number;
  height?: number;
}

export class WindowHandler {
  private mainWindow: BrowserWindow | null = null;
  private oobeWindow: BrowserWindow | null = null;
  private readonly settingsFilePath: string;
  private readonly onOobeComplete?: () => void | Promise<void>;

  constructor(userDataPath: string = app.getPath('userData'), onOobeComplete?: () => void | Promise<void>) {
    this.settingsFilePath = path.join(userDataPath, 'settings.json');
    this.onOobeComplete = onOobeComplete;
    this.registerIpcHandlers();
  }

  openStartupWindow(): BrowserWindow {
    return this.hasCompletedOobe() ? this.createMainWindow() : this.createOobeWindow();
  }

  createMainWindow(): BrowserWindow {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.focus();
      return this.mainWindow;
    }

    const window = this.makeWindow({
      kind: 'main',
      title: 'Request+',
      width: 600,
      height: 1000,
    });

    this.mainWindow = window;
    window.on('closed', () => {
      this.mainWindow = null;
    });

    this.loadRenderer(window, 'main');
    return window;
  }

  createOobeWindow(): BrowserWindow {
    if (this.oobeWindow && !this.oobeWindow.isDestroyed()) {
      this.oobeWindow.focus();
      return this.oobeWindow;
    }

    const window = this.makeWindow({
      kind: 'oobe',
      title: 'Request+ Setup',
      width: 800,
      height: 800,
    });

    this.oobeWindow = window;
    window.on('closed', () => {
      this.oobeWindow = null;
    });

    this.loadRenderer(window, 'oobe');
    return window;
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow && !this.mainWindow.isDestroyed() ? this.mainWindow : null;
  }

  getOobeWindow(): BrowserWindow | null {
    return this.oobeWindow && !this.oobeWindow.isDestroyed() ? this.oobeWindow : null;
  }

  hasCompletedOobe(): boolean {
    return this.loadSettings().oobeCompleted === true;
  }

  loadSettings(): RequestPlusSettings {
    try {
      if (!fs.existsSync(this.settingsFilePath)) return {};
      return JSON.parse(fs.readFileSync(this.settingsFilePath, 'utf-8')) as RequestPlusSettings;
    } catch (error) {
      console.error('Failed to load Request+ settings:', error);
      return {};
    }
  }

  saveSettings(settings: RequestPlusSettings): boolean {
    try {
      fs.mkdirSync(path.dirname(this.settingsFilePath), { recursive: true });
      fs.writeFileSync(this.settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error('Failed to save Request+ settings:', error);
      return false;
    }
  }

  private makeWindow({ kind, title = 'Request+', width = 600, height = 1000 }: ManagedWindowOptions): BrowserWindow {
    return new BrowserWindow({
      width,
      height,
      minWidth: kind === 'oobe' ? 800 : 420,
      minHeight: kind === 'oobe' ? 900 : 640,
      frame: false,
      resizable: false,
      show: false,
      title,
      autoHideMenuBar: true,
      titleBarStyle: 'hidden',
      titleBarOverlay: false,
      icon: path.join(__dirname, 'assets', 'the_letter.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        devTools: !app.isPackaged,
        webSecurity: true,
      },
    });
  }

  private loadRenderer(window: BrowserWindow, kind: WindowKind): void {
    const devServerUrl = kind === 'oobe' ? OOBE_WINDOW_VITE_DEV_SERVER_URL : MAIN_WINDOW_VITE_DEV_SERVER_URL;
    const rendererName = kind === 'oobe' ? OOBE_WINDOW_VITE_NAME : MAIN_WINDOW_VITE_NAME;

    if (devServerUrl) {
      const url = new URL(kind === 'oobe' ? 'oobe.html' : 'index.html', devServerUrl);
      window.loadURL(url.toString());
    } else {
      window.loadFile(path.join(__dirname, `../renderer/${rendererName}/index.html`));
    }

    window.once('ready-to-show', () => window.show());
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('window:minimize', (event) => {
      BrowserWindow.fromWebContents(event.sender)?.minimize();
    });

    ipcMain.handle('window:close', (event) => {
      BrowserWindow.fromWebContents(event.sender)?.close();
    });

    ipcMain.handle('settings:load', () => this.loadSettings());

    ipcMain.handle('settings:save', (_event, settings: RequestPlusSettings) => {
      const current = this.loadSettings();
      return this.saveSettings({ ...current, ...settings });
    });

    ipcMain.handle('oobe:complete', async (_event, settings: RequestPlusSettings = {}) => {
      const current = this.loadSettings();
      this.saveSettings({ ...current, ...settings, oobeCompleted: true });

      if (this.oobeWindow && !this.oobeWindow.isDestroyed()) {
        this.oobeWindow.close();
      }

      if (this.onOobeComplete) {
        await this.onOobeComplete();
        return true;
      }

      this.createMainWindow();
      return true;
    });

    ipcMain.handle('oobe:overlay', (): string | null => {
        return overlayPath;
    });

    ipcMain.handle('oobe:openURL', async (_e: any, url: string) => {
      await shell.openExternal(url);
    })
  }
}

export default WindowHandler;
