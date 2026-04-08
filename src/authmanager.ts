import { app, BrowserWindow, shell } from 'electron';
import { createHash } from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

/**
 * Deep Link Protocol Handler for RequestPlus Desktop Client
 * Handles requestplus:// URLs and hardware-based authentication
 */

const PROTOCOL = 'requestplus';
const AUTH_API_URL = process.env.AUTH_API_URL || 'https://testapi.requestplus.xyz';
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://testdev.requestplus.xyz';
let initialized = false;

// Safe logger helpers — no-ops if Logger isn't initialized yet (e.g. during auth callback process)
const log = {
    info:  (...args: any[]) => (global as any).Logger?.info(...args),
    warn:  (...args: any[]) => (global as any).Logger?.warn(...args),
    error: (...args: any[]) => (global as any).Logger?.error(...args),
};

export interface AuthToken {
  token: string;
  refreshToken: string;
  expiresAt: number;
  deviceId: string;
}

export interface HardwareInfo {
  deviceId: string;
  machineId: string;
  platform: string;
  hostname: string;
  cpus: string;
  totalMemory: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  photoURL: string | null;
  createdAt: string;
  lastSignIn: string;
}

export interface DeviceInfo {
  deviceId: string;
  platform: string;
  hostname: string;
  lastSeen: string;
}

export interface ProfileResponse {
  user: UserProfile;
  device?: DeviceInfo;
}

class AuthManager extends EventEmitter {
  private static instance: AuthManager;
  private authToken: AuthToken | null = null;
  private hardwareInfo: HardwareInfo | null = null;
  private configPath: string;
  private isProtocolRegistered: boolean = false;

  private constructor() {
    super();
    this.configPath = path.join(app.getPath('userData'), 'auth-config.json');
    this.init();
  }

  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  private async init(){
    if (initialized) return;
    initialized = true;

    if (!app.isReady()) {
        await app.whenReady();
    }
    await this.initialize();
  }

  /**
   * Initialize the auth manager
   */
  private async initialize() {
    // Generate or load hardware ID
    this.hardwareInfo = this.getHardwareInfo();
    
    // Load saved auth token if exists
    this.loadAuthToken();
    
    // Register protocol handler
    this.registerProtocolHandler();
    
    console.log('[AuthManager] Initialized with device ID:', this.hardwareInfo.deviceId);
  }

  /**
   * Generate a unique hardware-based device ID
   * This ID is consistent across app restarts but unique per machine
   */
  private getHardwareInfo(): HardwareInfo {
    const platform = os.platform();
    const hostname = os.hostname();
    const cpuInfo = os.cpus();
    const totalMemory = os.totalmem();
    
    // Create a unique fingerprint based on hardware
    const cpuModel = cpuInfo[0]?.model || 'unknown';
    const cpuCount = cpuInfo.length;
    
    // Combine hardware info into a unique string
    const hardwareString = [
      platform,
      hostname,
      cpuModel,
      cpuCount,
      totalMemory,
      os.arch(),
      os.type()
    ].join('|');
    
    // Create a hash of the hardware info
    const machineId = createHash('sha256')
      .update(hardwareString)
      .digest('hex')
      .substring(0, 32);
    
    // Create a shorter device ID
    const deviceId = `rp_${platform}_${machineId.substring(0, 16)}`;
    
    return {
      deviceId,
      machineId,
      platform,
      hostname,
      cpus: cpuModel,
      totalMemory
    };
  }

  /**
   * Register the requestplus:// protocol handler
   */
  private registerProtocolHandler() {
    if (process.defaultApp) {
      // Development mode
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
          path.resolve(process.argv[1])
        ]);
      }
    } else {
      // Production mode
      app.setAsDefaultProtocolClient(PROTOCOL);
    }

    this.isProtocolRegistered = true;
  }

  /**
   * Handle deep link URL
   */
  public handleDeepLink(url: string): boolean {

    if (!url.startsWith(`${PROTOCOL}://`)) {
      console.warn('[AuthManager] Invalid protocol, expected:', PROTOCOL);
      return false;
    }

    try {
      (global as any).ISAUTHING = true;
      const parsedUrl = new URL(url);
      const path = parsedUrl.hostname;
      const params = Object.fromEntries(parsedUrl.searchParams);

      switch (path) {
        case 'auth':
          return this.handleAuthCallback(params);
        case 'logout':
          return this.handleLogout();
        default:
          log.warn(`[AuthManager] Unknown deep link path: ${path}`);
          return false;
      }
    } catch (error) {
      log.error('[AuthManager] Error parsing deep link:', error);
      return false;
    }
  }

  /**
   * Handle authentication callback from web browser
   * URL format: requestplus://auth?token=xxx&refresh_token=yyy&expires_in=3600
   */
  private handleAuthCallback(params: Record<string, string>): boolean {
    const { token, refresh_token, expires_in } = params;

    if (!token) {
      console.error('[AuthManager] No token in auth callback');
      this.emit('auth-error', { error: 'No token provided' });
      return false;
    }

    // Calculate expiration time
    const expiresIn = parseInt(expires_in || '3600', 10);
    const expiresAt = Date.now() + (expiresIn * 1000);

    this.authToken = {
      token,
      refreshToken: refresh_token || '',
      expiresAt,
      deviceId: this.hardwareInfo!.deviceId
    };

    // Save to disk
    this.saveAuthToken();

    // Emit success event
    this.emit('auth-success', this.authToken);

    console.log('[AuthManager] Authentication successful');
    return true;
  }

  /**
   * Handle logout
   */
  private handleLogout(): boolean {
    this.authToken = null;
    this.deleteAuthToken();
    this.emit('auth-logout');
    log.info('[AuthManager] Logged out');
    return true;
  }

  /**
   * Save auth token to disk
   */
  private saveAuthToken() {
    if (!this.authToken) return;

    try {
      const data = {
        ...this.authToken,
        savedAt: Date.now()
      };

      fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2), 'utf-8');
      log.info('[AuthManager] Auth token saved to disk');
    } catch (error) {
      log.error('[AuthManager] Error saving auth token:', error);
    }
  }

  /**
   * Load auth token from disk
   */
  private loadAuthToken() {
    try {
      if (!fs.existsSync(this.configPath)) {
        log.info('[AuthManager] No saved auth token found');
        return;
      }

      const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));

      // Check if token is expired
      if (data.expiresAt && data.expiresAt < Date.now()) {
        log.info('[AuthManager] Saved token is expired');
        this.deleteAuthToken();
        return;
      }

      // Verify device ID matches (prevent token theft)
      if (data.deviceId !== this.hardwareInfo!.deviceId) {
        log.warn('[AuthManager] Device ID mismatch, token may be stolen');
        this.deleteAuthToken();
        return;
      }

      this.authToken = data;
      log.info('[AuthManager] Auth token loaded from disk');
      this.emit('auth-restored', this.authToken);
    } catch (error) {
      log.error('[AuthManager] Error loading auth token:', error);
      this.deleteAuthToken();
    }
  }

  /**
   * Delete auth token from disk
   */
  private deleteAuthToken() {
    try {
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
        log.info('[AuthManager] Auth token deleted from disk');
      }
    } catch (error) {
      log.error('[AuthManager] Error deleting auth token:', error);
    }
  }

  /**
   * Open browser to start authentication flow
   */
  public async startAuthFlow() {
    const deviceId = this.hardwareInfo!.deviceId;
    const authUrl = `${WEBSITE_URL}/desktop-auth?device_id=${encodeURIComponent(deviceId)}`;
    
    // Open in default browser
    await shell.openExternal(authUrl);
    
    this.emit('auth-started');
  }

  /**
   * Get current auth token
   */
  public getAuthToken(): AuthToken | null {
    // Check if token is expired
    if (this.authToken && this.authToken.expiresAt < Date.now()) {
      log.info('[AuthManager] Token expired');
      this.authToken = null;
      this.deleteAuthToken();
      return null;
    }

    return this.authToken;
  }

  /**
   * Get hardware info
   */
  public getHardwareInfoPublic(): HardwareInfo | null {
    return this.hardwareInfo;
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    return this.getAuthToken() !== null;
  }

  /**
   * Fetch user profile data from API
   * Returns full profile including Firebase user data and device info
   */
  public async fetchUserData(): Promise<ProfileResponse> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated. Please login first.');
    }

    const hardwareInfo = this.hardwareInfo;
    if (!hardwareInfo) {
      throw new Error('Hardware info not available');
    }

    try {
      // Set credentials for API client
      apiClient.setCredentials(token.token, hardwareInfo.deviceId);
      
      // Fetch full profile (includes photoURL and Firebase data)
      const profile = await apiClient.getFullProfile();
      
      log.info('[AuthManager] User profile fetched successfully');
      return profile;
    } catch (error) {
      log.error('[AuthManager] Error fetching user data:', error);
      
      // If token is invalid, clear it and emit auth error
      if (error instanceof Error && error.message.includes('Invalid token')) {
        this.authToken = null;
        this.deleteAuthToken();
        this.emit('auth-error', { error: 'Token invalid, please re-authenticate' });
      }
      
      throw error;
    }
  }
 
  /**
   * Refresh the auth token
   */
  public async refreshAuthToken(): Promise<boolean> {
    if (!this.authToken?.refreshToken) {
      console.error('[AuthManager] No refresh token available');
      return false;
    }

    try {
      const response = await fetch(`${AUTH_API_URL}/desktop/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refresh_token: this.authToken.refreshToken,
          device_id: this.hardwareInfo!.deviceId
        })
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      this.authToken = {
        token: data.token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in * 1000),
        deviceId: this.hardwareInfo!.deviceId
      };

      this.saveAuthToken();
      this.emit('auth-refreshed', this.authToken);

      log.info('[AuthManager] Token refreshed successfully');
      return true;
    } catch (error) {
      log.error('[AuthManager] Error refreshing token:', error);
      this.authToken = null;
      this.deleteAuthToken();
      this.emit('auth-error', { error: 'Token refresh failed' });
      return false;
    }
  }

  /**
   * Logout and clear all auth data
   */
  public logout() {
    this.authToken = null;
    this.deleteAuthToken();
    this.emit('auth-logout');
  }

  public async checkExperimentalUser(): Promise<boolean> {
    const token = this.getAuthToken();
    if (!token) {
      log.info('[AuthManager] Not authenticated, cannot check experimental user status');
      return false;
    }

    try {
      const response = await apiClient.checkExperimentalUser();
      return response.status;
    } catch (error) {
      log.error('[AuthManager] Error checking experimental user status:', error);
      return false;
    }
  }

  public async fetchLocale(): Promise<string> {
    const token = this.getAuthToken();
    if (!token) return 'en';
    try {
      apiClient.setCredentials(token.token, this.hardwareInfo!.deviceId);
      return await apiClient.fetchLocale();
    } catch {
      return 'en';
    }
  }
}

// Export singleton instance
export const authManager = AuthManager.getInstance();

/**
 * Setup deep link handling in main process
 */
export function setupDeepLinkHandling(mainWindow: BrowserWindow) {
  // Handle the protocol on macOS
  app.on('open-url', (event, url) => {
    event.preventDefault();
    authManager.handleDeepLink(url);
  });

  // Handle the protocol on Windows/Linux
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    log.info('[DeepLink] Another instance is already running');
    app.quit();
  } else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // Someone tried to run a second instance, focus our window instead
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }

      // Check if a deep link was passed
      const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
      if (url) {
        authManager.handleDeepLink(url);
      }
    });
  }

  // Handle deep link on Windows when app is already running
  if (process.platform === 'win32') {
    const url = process.argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (url) {
      authManager.handleDeepLink(url);
    }
  }
}

/**
 * Example event listeners for auth events
 */
export function setupAuthEventListeners(mainWindow: BrowserWindow) {
  authManager.on('auth-started', () => {
    log.info('[Auth Event] Authentication flow started');
    mainWindow.webContents.send('auth-status', { status: 'started' });
  });

  authManager.on('auth-success', (token: AuthToken) => {
    log.info('[Auth Event] Authentication successful');
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('auth-status', {
      status: 'success',
      token: token.token,
      deviceId: token.deviceId
    });
  });

  authManager.on('auth-error', (error: { error: string }) => {
    log.info('[Auth Event] Authentication error:', error);
    mainWindow.webContents.send('auth-status', { 
      status: 'error', 
      error: error.error 
    });
  });

  authManager.on('auth-logout', () => {
    log.info('[Auth Event] User logged out');
    mainWindow.webContents.send('auth-status', { status: 'logged-out' });
  });

  authManager.on('auth-restored', (token: AuthToken) => {
    log.info('[Auth Event] Authentication restored from disk');
    mainWindow.webContents.send('auth-status', { 
      status: 'restored', 
      token: token.token,
      deviceId: token.deviceId
    });
  });

  authManager.on('auth-refreshed', (token: AuthToken) => {
    log.info('[Auth Event] Token refreshed');
    mainWindow.webContents.send('auth-status', { 
      status: 'refreshed', 
      token: token.token 
    });
  });
}

class APIClient {
  private static instance: APIClient;
  private token: string | null = null;
  private deviceId: string | null = null;

  private constructor() {}

  public static getInstance(): APIClient {
    if (!APIClient.instance) {
      APIClient.instance = new APIClient();
    }
    return APIClient.instance;
  }

  /**
   * Set authentication credentials
   */
  public setCredentials(token: string, deviceId: string) {
    this.token = token;
    this.deviceId = deviceId;
  }

  /**
   * Clear authentication credentials
   */
  public clearCredentials() {
    this.token = null;
    this.deviceId = null;
  }

  /**
   * Make authenticated request to API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.token || !this.deviceId) {
      throw new Error('Not authenticated. Please login first.');
    }

    const url = `${AUTH_API_URL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      'X-Device-Id': this.deviceId,
      'User-Agent': 'RequestPlus/v'+ app.getVersion() + '/Client ' + `(Electron ${process.versions.electron}; ${os.platform()} ${os.arch()} ${os.release()})`,
      ...options.headers
    };

    log.info(`[API] ${options.method || 'GET'} ${endpoint}`);

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get user profile
   */
  public async getProfile(): Promise<ProfileResponse> {
    return this.request<ProfileResponse>('/desktop/profile');
  }

  /**
   * Get full user profile (includes Firebase data like photoURL)
   */
  public async getFullProfile(): Promise<ProfileResponse> {
    return this.request<ProfileResponse>('/desktop/profile/full');
  }

  /**
   * Update device information
   */
  public async updateDeviceInfo(platform: string, hostname: string): Promise<{ message: string; device: DeviceInfo }> {
    return this.request('/desktop/profile/device', {
      method: 'PUT',
      body: JSON.stringify({ platform, hostname })
    });
  }

  /**
   * Check if client is connected (from your existing endpoint)
   */
  public async checkClientConnection(): Promise<{ status: string }> {
    // This endpoint uses Firebase auth, not desktop token
    // You may want to create a desktop version of this endpoint
    return this.request<{ status: string }>('/is-client-connected');
  }

  /**
   * Get popular requests
   */
  public async getPopularRequests(): Promise<any[]> {
    return this.request<any[]>('/popular-requests');
  }

  /**
   * Get requests per day
   */
  public async getRequestsPerDay(): Promise<any[]> {
    return this.request<any[]>('/requests-per-day');
  }

  public async checkExperimentalUser(): Promise<{ status: boolean }> {
    return this.request<{ status: boolean }>('/experimental-user');
  }

  public async fetchLocale(): Promise<string> {
    try {
      const response = await this.request<{ locale: string }>('/user/locale');
      return response.locale ?? 'en';
    } catch {
      return 'en';
    }
  }
}

// Export singleton instance
export const apiClient = APIClient.getInstance();
