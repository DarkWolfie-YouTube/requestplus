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
const AUTH_API_URL = process.env.AUTH_API_URL || 'https://api.requestplus.xyz';

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
    this.initialize();
  }

  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
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
    console.log('[AuthManager] Protocol handler registered for:', PROTOCOL);
  }

  /**
   * Handle deep link URL
   */
  public handleDeepLink(url: string): boolean {
    console.log('[AuthManager] Handling deep link:', url);

    if (!url.startsWith(`${PROTOCOL}://`)) {
      console.warn('[AuthManager] Invalid protocol, expected:', PROTOCOL);
      return false;
    }

    try {
      const parsedUrl = new URL(url);
      const path = parsedUrl.hostname;
      const params = Object.fromEntries(parsedUrl.searchParams);

      console.log('[AuthManager] Deep link path:', path);
      console.log('[AuthManager] Deep link params:', params);

      switch (path) {
        case 'auth':
          return this.handleAuthCallback(params);
        case 'logout':
          return this.handleLogout();
        default:
          console.warn('[AuthManager] Unknown deep link path:', path);
          return false;
      }
    } catch (error) {
      console.error('[AuthManager] Error parsing deep link:', error);
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
    console.log('[AuthManager] Logged out');
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
      console.log('[AuthManager] Auth token saved to disk');
    } catch (error) {
      console.error('[AuthManager] Error saving auth token:', error);
    }
  }

  /**
   * Load auth token from disk
   */
  private loadAuthToken() {
    try {
      if (!fs.existsSync(this.configPath)) {
        console.log('[AuthManager] No saved auth token found');
        return;
      }

      const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));

      // Check if token is expired
      if (data.expiresAt && data.expiresAt < Date.now()) {
        console.log('[AuthManager] Saved token is expired');
        this.deleteAuthToken();
        return;
      }

      // Verify device ID matches (prevent token theft)
      if (data.deviceId !== this.hardwareInfo!.deviceId) {
        console.warn('[AuthManager] Device ID mismatch, token may be stolen');
        this.deleteAuthToken();
        return;
      }

      this.authToken = data;
      console.log('[AuthManager] Auth token loaded from disk');
      this.emit('auth-restored', this.authToken);
    } catch (error) {
      console.error('[AuthManager] Error loading auth token:', error);
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
        console.log('[AuthManager] Auth token deleted from disk');
      }
    } catch (error) {
      console.error('[AuthManager] Error deleting auth token:', error);
    }
  }

  /**
   * Open browser to start authentication flow
   */
  public async startAuthFlow() {
    const deviceId = this.hardwareInfo!.deviceId;
    const authUrl = `${AUTH_API_URL}/desktop/auth/initiate?device_id=${encodeURIComponent(deviceId)}`;
    
    console.log('[AuthManager] Opening auth URL:', authUrl);
    
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
      console.log('[AuthManager] Token expired');
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
      
      console.log('[AuthManager] User profile fetched successfully');
      return profile;
    } catch (error) {
      console.error('[AuthManager] Error fetching user data:', error);
      
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

      console.log('[AuthManager] Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('[AuthManager] Error refreshing token:', error);
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
    console.log('[DeepLink] Received URL (open-url):', url);
    authManager.handleDeepLink(url);
  });

  // Handle the protocol on Windows/Linux
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    console.log('[DeepLink] Another instance is already running');
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
        console.log('[DeepLink] Received URL (second-instance):', url);
        authManager.handleDeepLink(url);
      }
    });
  }

  // Handle deep link on Windows when app is already running
  if (process.platform === 'win32') {
    const url = process.argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (url) {
      console.log('[DeepLink] Received URL (argv):', url);
      authManager.handleDeepLink(url);
    }
  }
}

/**
 * Example event listeners for auth events
 */
export function setupAuthEventListeners(mainWindow: BrowserWindow) {
  authManager.on('auth-started', () => {
    console.log('[Auth Event] Authentication flow started');
    mainWindow.webContents.send('auth-status', { status: 'started' });
  });

  authManager.on('auth-success', (token: AuthToken) => {
    console.log('[Auth Event] Authentication successful');
    mainWindow.webContents.send('auth-status', { 
      status: 'success', 
      token: token.token,
      deviceId: token.deviceId
    });
  });

  authManager.on('auth-error', (error: { error: string }) => {
    console.log('[Auth Event] Authentication error:', error);
    mainWindow.webContents.send('auth-status', { 
      status: 'error', 
      error: error.error 
    });
  });

  authManager.on('auth-logout', () => {
    console.log('[Auth Event] User logged out');
    mainWindow.webContents.send('auth-status', { status: 'logged-out' });
  });

  authManager.on('auth-restored', (token: AuthToken) => {
    console.log('[Auth Event] Authentication restored from disk');
    mainWindow.webContents.send('auth-status', { 
      status: 'restored', 
      token: token.token,
      deviceId: token.deviceId
    });
  });

  authManager.on('auth-refreshed', (token: AuthToken) => {
    console.log('[Auth Event] Token refreshed');
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

    console.log(`[API] ${options.method || 'GET'} ${endpoint}`);

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
}

// Export singleton instance
export const apiClient = APIClient.getInstance();
