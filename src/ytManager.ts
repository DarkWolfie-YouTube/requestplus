import axios, { AxiosError, AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import Logger from './logger';

interface songData {
    title: string;
    alternativeTitle: string;
    artist: string;
    artistUrl: string;
    views: number;
    uploadDate: string;
    imageSrc: string;
    isPaused: boolean;
    songDuration: number;
    elapsedSeconds: number;
    url: string;
    videoId: string;
    playlistId?: string;
    mediaType: string;
    tags?: string[];
    [key: string]: any;
}

interface volumeState {
    state: number;
    isMuted: boolean;
}

interface repeatMode {
    mode: 'NONE' | 'ONE' | 'ALL';
}

interface shuffleState {
    state: boolean;
}

interface likeState {
    state: string;
}

class YTManager extends EventEmitter {
    private apiBaseUrl: string;
    private wsBaseUrl: string;
    private instance: AxiosInstance;
    private token: string;
    private tokenPath: string;
    private logger: Logger;
    private timesTried: number;

    // WebSocket state
    private ws: WebSocket | null = null;
    private wsConnected: boolean = false;
    private wsReconnectTimer: NodeJS.Timeout | null = null;
    private cachedSong: songData | null = null;
    private cachedRepeat: 'NONE' | 'ALL' | 'ONE' | null = null;
    private cachedShuffle: boolean | null = null;

    constructor(Logger: Logger) {
        super();
        this.apiBaseUrl = 'http://localhost:26538/api/v1';
        this.wsBaseUrl  = 'ws://localhost:26538/api/v1/ws';
        this.tokenPath = path.join(app.getPath('userData'), 'ytmanager.token');
        this.logger = Logger
        this.timesTried = 0;
        this.token = '';
        
        this.instance = axios.create({
            baseURL: this.apiBaseUrl,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Load existing token or create new one
        this.initializeToken();
    }

    private async initializeToken(): Promise<void> {
        if (fs.existsSync(this.tokenPath)) {
            try {
                this.token = fs.readFileSync(this.tokenPath, 'utf-8').trim();
                
                // Validate the token
                const response = await this.instance.get("/song", { 
                    headers: { 'Authorization': `Bearer ${this.token}` } 
                });
                
                if (response.status !== 200 && response.status !== 204) {
                    await this.newToken();
                } else {
                    this.connectWebSocket();
                }
            } catch (error) {
                this.logger.error('[YTManager] Error validating existing token:', (error as AxiosError).message);
                this.logger.warn('[YTManager] This error was thrown while validating the existing token. A new token had been requested but not returned. Please make sure Pear Desktop is running and Request+ is authorized in Pear Desktop. Re running token Check in 30 seconds.');
                
                if (this.timesTried >= 3) {
                    this.logger.error('[YTManager] Maximum token validation attempts reached. Please restart the application if you wish to continue using Youtube playback features.');
                } else{ 
                    setTimeout(() => this.initializeToken(), 30000);
                    this.timesTried++;
                }
            }
        } else {
            await this.newToken();
        }
    }

    async newToken(): Promise<void> {
        try {
            const tempInstance = axios.create({
                baseURL: "http://localhost:26538/",
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            
            const response = await tempInstance.post('/auth/Request+');
            
            if (response.status === 200 && response.data.accessToken) {
                this.token = response.data.accessToken;
                fs.writeFileSync(this.tokenPath, this.token, 'utf-8');
                this.connectWebSocket();
            } else {
                throw new Error("Invalid token response");
            }
        } catch (error) {
            this.logger.error('[YTManager] Error obtaining new token:', (error as AxiosError).message);
            this.logger.warn('[YTManager] This can be due to Pear Desktop not running or Request+ not being authorized in Pear Desktop. Please make sure both are running and authorized.');
            return Promise.reject(error);
        }
    }

    private async makeAuthenticatedRequest<T>(
        requestFn: () => Promise<any>,
        endpoint?: string
    ): Promise<T | null> {
        try {
            const response = await requestFn();
            
            if (response.status === 204) {
                return true as unknown as T;
            }
            
            return response.data;
        } catch (error: any) {
            if (error.response?.status === 401) {
                console.log(`[YTManager] ${endpoint || 'Request'} got 401, refreshing token and retrying`);
                // Token expired, get new one and retry once
                await this.newToken();
                try {
                    const retryResponse = await requestFn();
                    if (retryResponse.status === 204) {
                        console.log(`[YTManager] ${endpoint || 'Request'} retry returned 204 No Content`);
                        return null;
                    }
                    return retryResponse.data;
                } catch (retryError: any) {
                    console.error(`[YTManager] ${endpoint || 'Request'} retry failed:`, retryError.message);
                    return null;
                }
            }
            
            return null;
        }
    }

    // ── WebSocket ─────────────────────────────────────────────────────────────

    public connectWebSocket(): void {
        if (this.ws) {
            this.ws.terminate();
            this.ws = null;
        }

        try {
            this.ws = new WebSocket(this.wsBaseUrl, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            this.ws.on('open', () => {
                this.wsConnected = true;
                this.logger.info('[YTManager] WebSocket connected');
                if (this.wsReconnectTimer) {
                    clearTimeout(this.wsReconnectTimer);
                    this.wsReconnectTimer = null;
                }
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const msg = JSON.parse(data.toString()) as { type: string; [key: string]: any };
                    console.log('[YTManager] WS message received:', msg);

                    switch (msg.type) {
                        case 'VIDEO_CHANGED':
                            // Full song object provided — replace cache entirely
                            this.cachedSong = { ...msg.song, elapsedSeconds: msg.position ?? 0 };
                            this.emit('state-update', this.cachedSong);
                            break;

                        case 'POSITION_CHANGED':
                            // Elapsed position tick — update progress only
                            if (this.cachedSong) {
                                this.cachedSong = { ...this.cachedSong, elapsedSeconds: msg.position };
                                this.emit('state-update', this.cachedSong);
                            }
                            break;

                        case 'PLAYER_STATE_CHANGED':
                            // Play/pause toggle — update cache immediately if available
                            if (this.cachedSong) {
                                this.cachedSong = {
                                    ...this.cachedSong,
                                    isPaused: !msg.isPlaying,
                                    elapsedSeconds: msg.position ?? this.cachedSong.elapsedSeconds
                                };
                                this.emit('state-update', this.cachedSong);
                            }
                            // Always refresh from REST API to ensure accuracy
                            // (handles null cachedSong and stale WS state)
                            this.getCurrentSong().then(song => {
                                if (song) {
                                    this.cachedSong = song;
                                    this.emit('state-update', this.cachedSong);
                                }
                            }).catch(() => {});
                            break;

                        case 'REPEAT_CHANGED':
                            this.cachedRepeat = msg.repeat ?? 'NONE';
                            this.emit('state-update', this.cachedSong);
                            break;

                        case 'SHUFFLE_CHANGED':
                            this.cachedShuffle = msg.shuffle ?? false;
                            this.emit('state-update', this.cachedSong);
                            break;

                        default:
                            this.logger.info(`[YTManager] Unknown WS event: ${msg.type}`);
                    }
                } catch {
                    // ignore non-JSON frames
                }
            });

            this.ws.on('close', () => {
                this.wsConnected = false;
                this.logger.warn('[YTManager] WebSocket disconnected, reconnecting in 5s');
                this.scheduleWSReconnect();
            });

            this.ws.on('error', (err: Error) => {
                this.logger.error('[YTManager] WebSocket error:', err.message);
                this.wsConnected = false;
            });
        } catch (err) {
            this.logger.error('[YTManager] Failed to open WebSocket:', (err as Error).message);
            this.scheduleWSReconnect();
        }
    }

    private scheduleWSReconnect(): void {
        if (this.wsReconnectTimer) return;
        this.wsReconnectTimer = setTimeout(() => {
            this.wsReconnectTimer = null;
            if (this.token) this.connectWebSocket();
        }, 5000);
    }

    /** Latest state pushed by the WebSocket — null if WS not yet connected. */
    public getCachedSong(): songData | null {
        return this.cachedSong;
    }

    public isWSConnected(): boolean {
        return this.wsConnected;
    }

    // ── REST fallbacks ────────────────────────────────────────────────────────

    async getCurrentSong(): Promise<songData | null> {
        return this.makeAuthenticatedRequest<songData>(() =>
            this.instance.get('/song', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            }), '/song'
        );
    }

    async getVolume(): Promise<volumeState | null> {
        return this.makeAuthenticatedRequest<volumeState>(() =>
            this.instance.get('/volume', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            }), '/volume'
        );
    }

    async getRepeatMode(): Promise<repeatMode | null> {
        if (this.cachedRepeat !== null) {
            return { mode: this.cachedRepeat };
        }
        return this.makeAuthenticatedRequest<repeatMode>(() =>
            this.instance.get('/repeat-mode', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            }), '/repeat'
        );
    }

    async getShuffleMode(): Promise<boolean | null> {
        if (this.cachedShuffle !== null) {
            return this.cachedShuffle;
        }
        const response = await this.makeAuthenticatedRequest<shuffleState>(() =>
            this.instance.get('/shuffle', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            }), '/shuffle'
        );
        return response?.state ?? false;
    }

    async isLiked(): Promise<boolean | null> {
        const response = await this.makeAuthenticatedRequest<likeState>(() =>
            this.instance.get('/like-state', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            }), '/like-state'
        );
        return response?.state === "LIKE";
    }

    // Control methods
    async playPause(): Promise<void> {
        await this.makeAuthenticatedRequest(() =>
            this.instance.post('/toggle-play', {}, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            }), '/toggle-play'
        );
        // Fallback: refresh state in case PLAYER_STATE_CHANGED doesn't fire
        setTimeout(() => {
            this.getCurrentSong().then(song => {
                if (song) {
                    this.cachedSong = song;
                    this.emit('state-update', this.cachedSong);
                }
            }).catch(() => {});
        }, 800);
    }

    async next(): Promise<void> {
        await this.makeAuthenticatedRequest(() =>
            this.instance.post('/next', {}, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            }), '/next'
        );
    }

    async previous(): Promise<void> {
        await this.makeAuthenticatedRequest(() =>
            this.instance.post('/previous', {}, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            }), '/previous'
        );
    }

    async toggleLike(): Promise<void> {
        if (await this.isLiked() === true) {
            await this.makeAuthenticatedRequest(() =>
                this.instance.post('/dislike', {}, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                }), '/dislike'
            );
            return;
        } else {
            await this.makeAuthenticatedRequest(() =>
                this.instance.post('/like', {}, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                }), '/like'
            );
        }
    }

    async setVolume(level: number): Promise<void> {
        await this.makeAuthenticatedRequest(() =>
            this.instance.post('/volume', { volume: level }, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            }), '/volume'
        );
    }

    async seek(position: number): Promise<void> {
        console.log('[YTManager] Seeking to position:', position);
        await this.makeAuthenticatedRequest(() =>
            this.instance.post('/seek-to', { seconds: position }, {
                headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' }
            }), '/seek-to'
        );
    }

    async toggleShuffle(): Promise<void> {
        await this.makeAuthenticatedRequest(() =>
            this.instance.post('/shuffle', {}, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            }), '/shuffle'
        );
    }


    async cycleRepeat(): Promise<void> {
        await this.makeAuthenticatedRequest(() =>
            this.instance.post('/switch-repeat', {
                "iteration": 1
            }, {
                headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' }
            }), '/switch-repeat'
        );
    }
    async addItemToQueueById(videoId: string): Promise<boolean> {
        try {
            await this.makeAuthenticatedRequest<songData>(() =>
                this.instance.post(`/queue`, JSON.stringify({ videoId: videoId, insertPosition: "INSERT_AFTER_CURRENT_VIDEO" }), {
                    headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' }
                }), `/queue/${videoId}`
            );
            return true;
        } catch {
            return false;
        }
    }

    /** Fetch title + author for a video ID via YouTube's public oEmbed API (no auth needed). */
    async getSongTitle(videoId: string): Promise<{ title: string; author: string } | null> {
        try {
            const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
            const response = await axios.get(url, { timeout: 5000 });
            if (response.status === 200 && response.data?.title) {
                return { title: response.data.title, author: response.data.author_name ?? 'YouTube Music' };
            }
        } catch {
            // private/unavailable video — fall through
        }
        return null;
    }

    /** Extract an 11-character YouTube video ID from a URL or bare ID string. */
    static extractVideoId(text: string): string | null {
        const urlMatch = text.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/);
        if (urlMatch) return urlMatch[1];
        if (/^[A-Za-z0-9_-]{11}$/.test(text.trim())) return text.trim();
        return null;
    }
}


export { YTManager, songData, volumeState, repeatMode };