// websocket-manager.ts
import WebSocket from 'ws';
import { EventEmitter } from 'events';

const WS_URL = 'wss://api.requestplus.xyz';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

class WebSocketManager extends EventEmitter {
  private static instance: WebSocketManager;
  private ws: WebSocket | null = null;
  private isAuth: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private token: string | null = null;
  private deviceId: string | null = null;
  private intentionalDisconnect: boolean = false;

  private constructor() {
    super();
  }

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Connect to WebSocket server with hardware token authentication
   */
  public async connect(token: string, deviceId: string): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      (global as any).Logger.info('[WebSocket] Already connected');
      return;
    }

    this.token = token;
    this.deviceId = deviceId;
    this.intentionalDisconnect = false;

    return new Promise((resolve, reject) => {
      (global as any).Logger.info('[WebSocket] Connecting to:', WS_URL);

      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        (global as any).Logger.info('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;

        // Authenticate immediately after connection
        this.authenticate();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(message, resolve, reject);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      });

      // Explicitly respond to server's protocol-level ping frames
      this.ws.on('ping', () => {
        this.ws?.pong();
      });

      this.ws.on('close', (code, reason) => {
        (global as any).Logger.info('[WebSocket] Disconnected:', code, reason.toString());
        this.isAuth = false;
        this.stopPingInterval();
        this.emit('disconnected', { code, reason: reason.toString() });

        // Attempt to reconnect (skip if intentionally disconnected)
        if (!this.intentionalDisconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else if (!this.intentionalDisconnect) {
          (global as any).Logger.error('[WebSocket] Max reconnection attempts reached');
          if (reject) reject(new Error('Max reconnection attempts reached'));
        }
      });

      this.ws.on('error', (error) => {
        (global as any).Logger.error('[WebSocket] Error:', error);
        this.emit('error', error);
      });

      // Timeout if connection takes too long
      setTimeout(() => {
        if (!this.isAuth) {
          reject(new Error('Connection timeout'));
          this.scheduleReconnect();
        }
      }, 10000);
    });
  }

  /**
   * Authenticate with the server using hardware token
   */
  private authenticate() {
    if (!this.token || !this.deviceId) {
      console.error('[WebSocket] Missing token or device ID');
      return;
    }

    (global as any).Logger.info('[WebSocket] Authenticating with device ID:', this.deviceId);

    this.send({
      type: 'auth_desktop',
      token: this.token,
      deviceId: this.deviceId
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(
    message: WebSocketMessage,
    resolve?: () => void,
    reject?: (error: Error) => void
  ) {

    switch (message.type) {
      case 'connected':
        (global as any).Logger.info('[WebSocket] Server says connected');
        break;

      case 'auth_success':
        (global as any).Logger.info('[WebSocket] Authentication successful');
        this.isAuth = true;
        this.startPingInterval();
        this.emit('authenticated', message);
        try {
          this.send({ type: 'chat_listen' });
          (global as any).Logger.info('[WebSocket] Sent chat_listen request');
        } catch (error) {
          (global as any).Logger.error('[WebSocket] Error sending chat_listen:', error);
        }

        if (resolve) resolve();
        break;

      case 'auth_error':
        (global as any).Logger.error('[WebSocket] Authentication failed:', message.error);
        this.isAuth = false;
        this.emit('auth-error', message);
        if (reject) reject(new Error(message.error));
        break;

      case 'pong':
        // Keep-alive response
        break;

      case 'kick_message':
        // Handle Kick chat message
        this.emit('kick-message', message.data);
        break;

      case 'notification':
        // Handle notification
        this.emit('notification', message);
        break;

      case 'message_received':
        // Acknowledgment
        this.emit('message-received', message);
        break;

      case 'subscribed':
        this.emit('channel-subscribed', message);
        break;

      case 'unsubscribed':
        this.emit('channel-unsubscribed', message);
        break;

      case 'restarting': {
        const delaySec = message.reconnectInSec ?? 10;
        (global as any).Logger.info(`[WebSocket] Server restarting — reconnecting in ${delaySec}s`);
        // Reset reconnect state so we get a fresh run of attempts starting at the server-specified delay
        this.reconnectAttempts = 0;
        this.reconnectDelay = delaySec * 1000;
        this.intentionalDisconnect = false;
        this.emit('restarting', { reconnectInSec: delaySec });
        break;
      }

      case 'error':
        console.error('[WebSocket] Server error:', message.error);
        this.emit('server-error', message);
        break;

      case 'song_request':
        this.emit('song-request', message);
        break;

      case 'song_search_request':
        this.emit('song-search-request', message);
        break;

      default:
        console.warn('[WebSocket] Unknown message type:', message.type);
        this.emit('message', message);
    }
  }

  /**
   * Send a message to the server
   */
  public send(data: WebSocketMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[WebSocket] Cannot send, not connected');
      throw new Error('WebSocket not connected');
    }

    if (!this.isAuth && data.type !== 'auth_desktop') {
      console.error('[WebSocket] Cannot send, not authenticated');
      throw new Error('WebSocket not authenticated');
    }

    (global as any).Logger.info('[WebSocket] Sending message:', data.type);
    this.ws.send(JSON.stringify(data));
  }

  /**
   * Subscribe to a Kick channel
   */
  public subscribeToChannel(channelId: string) {
    this.send({
      type: 'subscribe_channel',
      channelId
    });
  }

  /**
   * Unsubscribe from a Kick channel
   */
  public unsubscribeFromChannel(channelId: string) {
    this.send({
      type: 'unsubscribe_channel',
      channelId
    });
  }

  /**
   * Disconnect from WebSocket
   */
  public disconnect() {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopPingInterval();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isAuth = false;
    this.token = null;
    this.deviceId = null;
    (global as any).Logger.info('[WebSocket] Disconnected');
  }

  /**
   * Check if WebSocket is connected
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Check if WebSocket is authenticated
   */
  public isAuthenticated(): boolean {
    return this.isAuth;
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    (global as any).Logger.info(
      `[WebSocket] Reconnecting in ${this.reconnectDelay}ms... (attempt ${this.reconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      if (this.token && this.deviceId) {
        this.connect(this.token, this.deviceId).catch((error) => {
          (global as any).Logger.error('[WebSocket] Reconnection failed:', error);
        });
      }
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  /**
   * Start sending ping messages to keep connection alive
   */
  private startPingInterval() {
    this.stopPingInterval();

    this.pingInterval = setInterval(() => {
      if (this.isConnected() && this.isAuth) {
        try {
          this.send({ type: 'ping' });
        } catch (error) {
          console.error('[WebSocket] Error sending ping:', error);
        }
      }
    }, 20000); // Every 20s — under the server's 30s heartbeat check
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

// Export singleton instance
export const websocketManager = WebSocketManager.getInstance();
