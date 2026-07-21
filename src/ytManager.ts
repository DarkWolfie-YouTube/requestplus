import axios, { AxiosInstance } from 'axios';
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
    private tokenRequestPromise: Promise<void> | null = null;

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
        this.initializeToken().catch((error) => {
            this.logger.warn(`[YTManager] Pear Desktop is not reachable. Make sure Pear is open and the Pear API port is set to 26538. ${this.formatErrorMessage(error)}`);
        });
    }

    private formatErrorMessage(error: unknown): string {
        if (axios.isAxiosError(error)) {
            return error.message ? `(${error.message})` : '';
        }

        if (error instanceof Error) {
            return error.message ? `(${error.message})` : '';
        }

        return '';
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
            this.logger.warn(`[YTManager] Could not validate Pear token. Make sure Pear is open and the Pear API port is set to 26538. ${this.formatErrorMessage(error)}`);
            this.logger.warn('[YTManager] Request+ will retry Pear token validation in 30 seconds.');
                
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
        if (this.tokenRequestPromise) {
            this.logger.info('[YTManager] Pear token request already pending; waiting for the existing request.');
            return this.tokenRequestPromise;
        }

        this.tokenRequestPromise = this.requestNewToken();
        try {
            await this.tokenRequestPromise;
        } finally {
            this.tokenRequestPromise = null;
        }
    }

    private async requestNewToken(): Promise<void> {
        try {
            const tempInstance = axios.create({
                baseURL: "http://localhost:26538/",
                timeout: 120000,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            this.logger.info('[YTManager] Requesting Pear token. Waiting for the user to accept in Pear Desktop.');
            
            const response = await tempInstance.post('/auth/Request+');
            
            if (response.status === 200 && response.data.accessToken) {
                this.token = response.data.accessToken;
                fs.writeFileSync(this.tokenPath, this.token, 'utf-8');
                this.connectWebSocket();
            } else {
                throw new Error("Invalid token response");
            }
        } catch (error) {
            this.logger.warn(`[YTManager] Could not request a Pear token. Make sure Pear is open and the Pear API port is set to 26538. ${this.formatErrorMessage(error)}`);
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
                        return true as unknown as T;
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
            // Pear authenticates the WS handshake via a ?token= query param, NOT the
            // Authorization header — sending the header alone makes Pear accept the
            // upgrade and then immediately close the socket with 1008 Unauthorized.
            // (The same token still works as a Bearer header for the REST endpoints.)
            const wsUrl = `${this.wsBaseUrl}?token=${encodeURIComponent(this.token)}`;
            this.ws = new WebSocket(wsUrl);

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

                    switch (msg.type) {
                        case 'PLAYER_INFO':
                            // Pear's full-state snapshot: song + transport state in one frame.
                            // This is the event Pear actually emits on song/state changes.
                            if (msg.song) {
                                this.cachedSong = { ...msg.song, elapsedSeconds: msg.position ?? msg.song.elapsedSeconds ?? 0 };
                            }
                            if (typeof msg.repeat === 'string') this.cachedRepeat = msg.repeat as 'NONE' | 'ALL' | 'ONE';
                            if (typeof msg.shuffle === 'boolean') this.cachedShuffle = msg.shuffle;
                            this.emit('state-update', this.cachedSong);
                            break;

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

            this.ws.on('close', (code: number, reason: Buffer) => {
                this.wsConnected = false;
                this.logger.warn(`[YTManager] WebSocket disconnected (code=${code} reason=${JSON.stringify(reason?.toString() || '')}), reconnecting in 5s`);
                this.scheduleWSReconnect();
            });

            this.ws.on('unexpected-response', (_req, res: any) => {
                this.logger.warn(`[YTManager] WebSocket upgrade rejected: HTTP ${res?.statusCode}`);
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
        this.refreshCurrentSongSoon();
    }

    async previous(): Promise<void> {
        await this.makeAuthenticatedRequest(() =>
            this.instance.post('/previous', {}, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            }), '/previous'
        );
        this.refreshCurrentSongSoon();
    }

    /**
     * After a track-changing command, the WS VIDEO_CHANGED event may be missing
     * (e.g. Pear closed the socket). Pull the fresh song via REST so the cache and
     * any listeners reflect the new track without waiting for the next poll tick.
     */
    private refreshCurrentSongSoon(): void {
        setTimeout(() => {
            this.getCurrentSong().then(song => {
                if (song) {
                    this.cachedSong = song;
                    this.emit('state-update', this.cachedSong);
                }
            }).catch(() => {});
        }, 500);
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
        // makeAuthenticatedRequest swallows request failures and returns null,
        // so treat a null/undefined result as a rejected insert rather than success.
        const result = await this.makeAuthenticatedRequest<songData>(() =>
            this.instance.post(`/queue`, JSON.stringify({ videoId: videoId, insertPosition: "INSERT_AFTER_CURRENT_VIDEO" }), {
                headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' }
            }), `/queue/${videoId}`
        );
        return result !== null && result !== undefined;
    }

    /** Pull the per-item renderer out of YTM's nested queue item shape. */
    private static queueItemRenderer(item: any): any {
        return item?.playlistPanelVideoRenderer
            ?? item?.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer
            ?? null;
    }

    /**
     * Read Pear's live play queue. Returns the ordered videoIds and the index of
     * the track currently playing (the one flagged `selected`), or null on error.
     */
    async getQueueState(): Promise<{ selectedIndex: number; videoIds: string[] } | null> {
        const data = await this.makeAuthenticatedRequest<any>(() =>
            this.instance.get('/queue', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            }), '/queue'
        );
        if (!data || !Array.isArray(data.items)) return null;

        const videoIds: string[] = [];
        let selectedIndex = -1;
        data.items.forEach((item: any, i: number) => {
            const renderer = YTManager.queueItemRenderer(item);
            videoIds.push(renderer?.videoId ?? '');
            if (renderer?.selected) selectedIndex = i;
        });
        return { selectedIndex, videoIds };
    }

    /**
     * Poll the queue until `videoId` sits immediately after the currently playing
     * track. POST /queue returns 200 before YTM actually applies the insert, so
     * waiting for the queue to reflect it (instead of a blind delay) lets a
     * following next() reliably land on our request rather than YTM autoplay.
     * Returns true once confirmed, false if it didn't appear within the timeout.
     */
    async waitUntilQueuedNext(videoId: string, timeoutMs = 5000): Promise<boolean> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const state = await this.getQueueState();
            if (state && state.selectedIndex >= 0 && state.videoIds[state.selectedIndex + 1] === videoId) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        return false;
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

    /**
     * Search YouTube Music (via Pear's API server) for a free-text query and
     * return the first matching video ID, or null if nothing was found.
     */
    async searchVideoId(query: string): Promise<string | null> {
        const trimmed = query.trim();
        if (!trimmed) return null;
        try {
            const data = await this.makeAuthenticatedRequest<any>(() =>
                this.instance.post(`/search`, JSON.stringify({ query: trimmed }), {
                    headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' }
                }), `/search`
            );
            if (!data) return null;
            return YTManager.findFirstVideoId(data);
        } catch {
            return null;
        }
    }

    /**
     * Walk an arbitrary YouTube Music search response (shape varies by Pear
     * version) and return the first 11-character videoId found, depth-first.
     */
    private static findFirstVideoId(node: any): string | null {
        if (!node || typeof node !== 'object') return null;
        if (typeof node.videoId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(node.videoId)) {
            return node.videoId;
        }
        for (const key of Object.keys(node)) {
            const found = YTManager.findFirstVideoId(node[key]);
            if (found) return found;
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
