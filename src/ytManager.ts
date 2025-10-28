import axios, { AxiosError, AxiosInstance } from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

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

class YTManager {
    private apiBaseUrl: string;
    private instance: AxiosInstance;
    private token: string | null = null;
    private tokenPath: string;

    constructor() {
        this.apiBaseUrl = 'http://localhost:26538/api/v1';
        this.tokenPath = path.join(app.getPath('userData'), 'ytmanager.token');
        
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
                }
            } catch (error) {
                await this.newToken();
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
            } else {
                throw new Error("Invalid token response");
            }
        } catch (error) {
            throw new Error("Failed to obtain new token for YTManager.");
        }
    }

    private async makeAuthenticatedRequest<T>(
        requestFn: () => Promise<any>,
        endpoint?: string
    ): Promise<T | null> {
        try {
            const response = await requestFn();
            
            if (response.status === 204) {
                return null;
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
        return this.makeAuthenticatedRequest<repeatMode>(() =>
            this.instance.get('/repeat', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            }), '/repeat'
        );
    }

    async getShuffleMode(): Promise<boolean | null> {
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
        if (this.isLiked()) {
            await this.makeAuthenticatedRequest(() =>
                this.instance.post('/dislike', {}, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                }), '/dislike'
            );
            return;
        }
        await this.makeAuthenticatedRequest(() =>
            this.instance.post('/like', {}, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            }), '/like'
        );
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
                headers: { 'Authorization': `Bearer ${this.token}` }
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
                headers: { 'Authorization': `Bearer ${this.token}` }
            }), '/switch-repeat'
        );
    }
    async addItemToQueueById(videoId: string): Promise<songData | null> {
        return this.makeAuthenticatedRequest<songData>(() =>
            this.instance.post(`/queue`, { videoId: videoId }, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            }), `/queue/${videoId}`
        );
    }
}


export { YTManager, songData, volumeState, repeatMode };