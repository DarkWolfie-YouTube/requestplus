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
      console.log('[WebSocket] Already connected');
      return;
    }

    this.token = token;
    this.deviceId = deviceId;

    return new Promise((resolve, reject) => {
      console.log('[WebSocket] Connecting to:', WS_URL);

      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log('[WebSocket] Connected');
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

      this.ws.on('close', (code, reason) => {
        console.log('[WebSocket] Disconnected:', code, reason.toString());
        this.isAuth = false;
        this.stopPingInterval();
        this.emit('disconnected', { code, reason: reason.toString() });
        
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (error) => {
        console.error('[WebSocket] Error:', error);
        this.emit('error', error);
        reject(error);
      });

      // Timeout if connection takes too long
      setTimeout(() => {
        if (!this.isAuth) {
          reject(new Error('Connection timeout'));
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

    console.log('[WebSocket] Authenticating with device ID:', this.deviceId);

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
    console.log('[WebSocket] Received message:', message.type);

    switch (message.type) {
      case 'connected':
        console.log('[WebSocket] Server says connected');
        break;

      case 'auth_success':
        console.log('[WebSocket] Authentication successful');
        this.isAuth = true;
        this.startPingInterval();
        this.emit('authenticated', message);
        if (resolve) resolve();
        break;

      case 'auth_error':
        console.error('[WebSocket] Authentication failed:', message.error);
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

      case 'error':
        console.error('[WebSocket] Server error:', message.error);
        this.emit('server-error', message);
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

    console.log('[WebSocket] Sending message:', data.type);
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
    console.log('[WebSocket] Disconnected');
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
    console.log(
      `[WebSocket] Reconnecting in ${this.reconnectDelay}ms... (attempt ${this.reconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      if (this.token && this.deviceId) {
        this.connect(this.token, this.deviceId).catch((error) => {
          console.error('[WebSocket] Reconnection failed:', error);
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
    }, 30000); // Send ping every 30 seconds
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
