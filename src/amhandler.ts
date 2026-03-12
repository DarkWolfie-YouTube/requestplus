/**
 * @file amhandler.ts
 * @copyright 2026 Quil DayTrack
 *
 * @license GPL-v3.0
 * @version 2.0.2
 *
 * @description
 * An Apple Music Handler for Cider enchancing playback and song information retrieval.
 * Uses Cider's Socket.io RPC for real-time playback state instead of HTTP polling.
 */;
import { Settings } from "./settingsHandler";
import { BrowserWindow } from "electron";
import Logger from "./logger";
import axios, { AxiosInstance } from "axios";
import QueueHandler, { QueueItem } from "./queueHandler";
import fetch from "node-fetch";
import { io, Socket } from "socket.io-client";


interface AMSongObject {
    id: string;
    type: string;
    href: string;
    attributes: AMSongAttributes;
    relationships: Object;
}

interface AMAPISongObject {
    data: {
        data: AMSongObject[];
    };
}

interface AMISPlayingResponse {
    status: string;
    is_playing: boolean;
}


interface AMCurrentSongResponse {
    status: string;
    info: AMCurrentSongObject;
}

interface AMCurrentSongObject {
    albumName: string;
    artistName: string;
    artwork: AMSongAttributeArtwork;
    contentRating: string;
    discNumber: number;
    durationInMillis: number;
    genreNames: string[];
    hasLyrics: boolean;
    name: string;
    playParams: AMSongAttributePlayParams;
    releaseDate: string;
    trackNumber: number;
    composerName: string;
    isrc: string;
    previews: Object[];
    currentPlaybackTime: number;
    remainingTime: number;
    inFavorites: boolean;
    inLibrary: boolean;
    shuffleMode: number;
    repeatMode: number;
}

interface AMVolumeResponse {
    status: string;
    volume: number;
}


interface AMSongAttributes {
    albumName: string;
    artistName: string;
    artwork: AMSongAttributeArtwork;
    audioLocale: string;
    audioTraits: string[];
    composerName: string;
    discNumber: number;
    durationInMillis: number;
    genreNames: string[];
    hasLyrics: boolean;
    hasTimeSyncedLyrics: boolean;
    isAppleDigitalMaster: boolean;
    isMasteredForItunes: boolean;
    isVocalAttenuationAllowed: boolean;
    isrc: string;
    name: string;
    playParams: AMSongAttributePlayParams;
    previews: Object[];
    releaseDate: string;
    trackNumber: number;
    url: string;
}

interface AMSongAttributeArtwork {
    bgColor?: string;
    hasP3?: boolean;
    height: number;
    textColor1?: string;
    textColor2?: string;
    textColor3?: string;
    textColor4?: string;
    url: string;
    width: number;
}

interface AMSongAttributePlayParams {
    id: string;
    kind: string;
    catalogId?: string;
    [key: string]: any;
}


export default class AMHandler {
    private mainWindow: BrowserWindow;
    private logger: Logger;
    private settings: Settings;
    private apptoken: string;
    private axiosInstance: AxiosInstance;
    private socket: Socket | null = null;
    private cachedSongInfo: AMCurrentSongObject | null = null;
    private cachedIsPlaying: boolean = false;
    private cachedVolume: number = 0;
    private slowPollInterval: NodeJS.Timeout | null = null;

    constructor(mainWindow: BrowserWindow, logger: Logger, settings: Settings) {
        this.mainWindow = mainWindow;
        this.logger = logger;
        this.settings = settings;
        this.apptoken = this.settings.appleMusicAppToken;
        this.axiosInstance = axios.create({
            baseURL: 'http://localhost:10767/api/v1',
            timeout: 10000,
            headers: {
                'apptoken': this.apptoken,
                'User-Agent': 'Request+/2.0.1 Release'
            }
        });
        this.connectWebSocket();
        this.startSlowPoll();
    }

    // Fetches slow-changing values (volume, shuffle, repeat) via HTTP every 2500ms
    private startSlowPoll(): void {
        if (this.slowPollInterval) clearInterval(this.slowPollInterval);
        this.slowPollInterval = setInterval(async () => {
            try {
                const [volRes, shuffleRes, repeatRes] = await Promise.all([
                    this.axiosInstance.get<AMVolumeResponse>('/playback/volume'),
                    this.axiosInstance.get<{ status: string; value: number }>('/playback/shuffle-mode'),
                    this.axiosInstance.get<{ status: string; value: number }>('/playback/repeat-mode'),
                ]);
                this.cachedVolume = volRes.data.volume ?? 0;
                if (this.cachedSongInfo) {
                    this.cachedSongInfo.shuffleMode = shuffleRes.data.value ?? 0;
                    this.cachedSongInfo.repeatMode = repeatRes.data.value ?? 0;
                }
            } catch {
                // Cider not running — silently ignore
            }
        }, 2500);
    }

    private connectWebSocket(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        this.socket = io("http://localhost:10767/", {
            transports: ['websocket']
        });

        this.socket.on("connect", () => {
            this.logger.info('[AMHandler] Connected to Cider WebSocket RPC');
        });

        this.socket.on("disconnect", () => {
            this.logger.info('[AMHandler] Disconnected from Cider WebSocket, retrying in 5s...');
            this.cachedIsPlaying = false;
            setTimeout(() => this.connectWebSocket(), 5000);
        });

        this.socket.on("API:Playback", ({ data, type }: { data: any; type: string }) => {
            switch (type) {
                // Song changed — update full cached song info
                case "playbackStatus.nowPlayingItemDidChange":
                    if (data) {
                        // Preserve playback-state fields not included in this event
                        const prev = this.cachedSongInfo;
                        this.cachedSongInfo = {
                            albumName: data.albumName || '',
                            artistName: data.artistName || '',
                            artwork: data.artwork || { url: '', width: 0, height: 0 },
                            contentRating: data.contentRating || '',
                            discNumber: data.discNumber || 0,
                            durationInMillis: data.durationInMillis || 0,
                            genreNames: data.genreNames || [],
                            hasLyrics: data.hasLyrics || false,
                            name: data.name || '',
                            playParams: data.playParams || { id: '', kind: '' },
                            releaseDate: data.releaseDate || '',
                            trackNumber: data.trackNumber || 0,
                            composerName: data.composerName || '',
                            isrc: data.isrc || '',
                            previews: data.previews || [],
                            currentPlaybackTime: data.currentPlaybackTime ?? 0,
                            remainingTime: data.remainingTime ?? 0,
                            // These fields are not emitted in this event — preserve previous values
                            inFavorites: prev?.inFavorites ?? false,
                            inLibrary: prev?.inLibrary ?? false,
                            shuffleMode: prev?.shuffleMode ?? 0,
                            repeatMode: prev?.repeatMode ?? 0,
                        };
                    }
                    break;

                // Progress tick — update playback time on cached info
                case "playbackStatus.playbackTimeDidChange":
                    if (this.cachedSongInfo && data) {
                        this.cachedSongInfo.currentPlaybackTime = data.currentPlaybackTime ?? this.cachedSongInfo.currentPlaybackTime;
                        this.cachedSongInfo.remainingTime = data.currentPlaybackTimeRemaining ?? this.cachedSongInfo.remainingTime;
                        if (data.isPlaying !== undefined) {
                            this.cachedIsPlaying = data.isPlaying;
                        }
                    }
                    break;

                // Play/pause state changed
                case "playbackStatus.playbackStateDidChange":
                    if (data !== null && data !== undefined) {
                        this.cachedIsPlaying = data.state === 'playing';
                        // Use attributes as a fallback to seed cachedSongInfo if nowPlayingItemDidChange
                        // hasn't fired yet (e.g. app just launched while a song is already playing)
                        const attr = data.attributes;
                        if (attr && !this.cachedSongInfo) {
                            this.cachedSongInfo = {
                                albumName: attr.albumName || '',
                                artistName: attr.artistName || '',
                                artwork: attr.artwork || { url: '', width: 0, height: 0 },
                                contentRating: attr.contentRating || '',
                                discNumber: attr.discNumber || 0,
                                durationInMillis: attr.durationInMillis || 0,
                                genreNames: attr.genreNames || [],
                                hasLyrics: attr.hasLyrics || false,
                                name: attr.name || '',
                                playParams: attr.playParams || { id: '', kind: '' },
                                releaseDate: attr.releaseDate || '',
                                trackNumber: attr.trackNumber || 0,
                                composerName: attr.composerName || '',
                                isrc: attr.isrc || '',
                                previews: attr.previews || [],
                                currentPlaybackTime: attr.currentPlaybackTime ?? 0,
                                remainingTime: attr.remainingTime ?? 0,
                                inFavorites: false,
                                inLibrary: false,
                                shuffleMode: 0,
                                repeatMode: 0,
                            };
                        } else if (attr && this.cachedSongInfo) {
                            // Keep time in sync from this event too
                            this.cachedSongInfo.currentPlaybackTime = attr.currentPlaybackTime ?? this.cachedSongInfo.currentPlaybackTime;
                            this.cachedSongInfo.remainingTime = attr.remainingTime ?? this.cachedSongInfo.remainingTime;
                        }
                    }
                    break;
            }
        });
    }


    //Basic Playback Functions

    public async playPause(): Promise<void> {
        try{
            await this.axiosInstance.post('/playback/playpause', {}).then(response => {
                this.logger.info('Toggled play/pause on Apple Music');
            });
        } catch (error) {
            this.logger.error(error);
        }
    }

    /**
     * Returns the cached song info from the Cider WebSocket RPC.
     * Falls back to HTTP if no cached data is available yet.
     */
    public async getCurrentSong(): Promise<AMCurrentSongResponse> {
        if (this.cachedSongInfo) {
            return { status: 'ok', info: this.cachedSongInfo };
        }
        // Fallback to HTTP on first call before WS data arrives
        try {
            const response = await this.axiosInstance.get<AMCurrentSongResponse>('/playback/now-playing');
            return response.data;
        } catch (error) {
            this.logger.error('Error fetching Apple Music current song: ' + error);
            throw error;
        }
    }

    /**
     * Returns the cached playback state from the Cider WebSocket RPC.
     */
    public async getIsPlayingState(): Promise<AMISPlayingResponse> {
        return { status: 'ok', is_playing: this.cachedIsPlaying };
    }

    public async getVolume(): Promise<number> {
        return this.cachedVolume;
    }
    public async setVolume(volume: number): Promise<void> {
        try {
            await this.axiosInstance.post('/playback/volume', { volume: volume }).then(response => {
                this.logger.info('Set Apple Music volume to ' + volume);
            });
        } catch (error) {
            this.logger.error(error);
        }
    }

    public async likeSong(): Promise<void> {
        try{
            await this.axiosInstance.post('/playback/add-to-library', {}).then(response => {
                this.logger.info('Liked Apple Music song');
                if (response.data.status !== 'ok') {
                    this.logger.error('Failed to like the song on Apple Music');
                }
            });
        } catch (error) {
            this.logger.error(error);
        }
    }

    public async seekTo(positionMillis: number): Promise<void> {
        try{
            await this.axiosInstance.post('/playback/seek', { position: positionMillis }).then(response => {
                this.logger.info('Seeked Apple Music song to ' + positionMillis + ' milliseconds');
            });
        } catch (error) {
            this.logger.error(error);
        }
    }

    public async nextTrack(): Promise<void> {
        try{
            await this.axiosInstance.post('/playback/next', {}).then(response => {
                this.logger.info('Skipped to next Apple Music track');
            });
        } catch (error) {
            this.logger.error(error);
        }
    }

    public async previousTrack(): Promise<void> {
        try{
            await this.axiosInstance.post('/playback/previous', {}).then(response => {
                this.logger.info('Skipped to previous Apple Music track');
            });
        } catch (error) {
            this.logger.error(error);
        }
    }

    public async setRepeat(): Promise<void> {
        try{
            await this.axiosInstance.post('/playback/toggle-repeat', {}).then(response => {
                this.logger.info('Toggled repeat on Apple Music');
            });
        } catch (error) {
            this.logger.error(error);
        }
    }


    public async setShuffle(): Promise<void> {
        try{
            await this.axiosInstance.post('/playback/toggle-shuffle', {}).then(response => {
                this.logger.info('Toggled shuffle on Apple Music');
            });
        } catch (error) {
            this.logger.error(error);
        }
    }


    public updateSettings(settings: Settings): void {
        this.settings = settings;
        this.apptoken = this.settings.appleMusicAppToken;
    }

    public async handleChatRequest(message: string, queueHandler: QueueHandler, settings: Settings, username: string): Promise<string> {
        //get song requested data
        let songID: string | undefined = undefined;
        // if message just = "!sr" then return error
        if (message === "!sr") {
            return "ERR_AM_NOLINK";
        }

        // Try ?i= param first (album link with embedded song ID)
        if (message.includes("https://music.apple.com/") && message.includes("?i=")) {
            const iParam = message.split("?i=")[1]?.split("&")[0]?.split(" ")[0];
            if (iParam && /^[0-9]+$/.test(iParam)) {
                songID = iParam;
            }
        }

        // Try combined album/song URL regex
        if (!songID) {
            const amMatch = message.match(/https?:\/\/music\.apple\.com\/[a-z]{2}\/(?:album|song)\/[a-z0-9\-\_]+\/([0-9]+)/i);
            if (amMatch) {
                songID = amMatch[1];
            }
        }

        // Try song.link short URL
        if (!songID) {
            const songLinkMatch = message.match(/https?:\/\/song\.link\/i\/([0-9]+)/);
            if (songLinkMatch) {
                songID = songLinkMatch[1];
            }
        }

        if (!songID) {
            return "ERR_AM_NOLINK";
        }


        let songInfo: AMSongObject | undefined;
        await fetch(`http://localhost:10767/api/v1/amapi/run-v3`, {
            method: 'POST',
            headers: {
                'apptoken': this.apptoken,
                'Content-Type': 'application/json',
                'User-Agent': 'Request+/2.0.1 Release'
            },
            body: JSON.stringify({
                "path": "/v1/catalog/us/songs/" + songID,
            })
        })
        .then(response => response.json())
        .then((data: unknown) => {
            if ((data as AMAPISongObject)?.data?.data?.[0]) {
                songInfo = (data as AMAPISongObject).data.data[0];
            }
        })
        if (songInfo) {
            if (queueHandler && this.settings.autoPlay) {
                let queueItem: QueueItem = {
                    id: songID + '-' + username,
                    title: songInfo.attributes.name,
                    artist: songInfo.attributes.artistName,
                    album: songInfo.attributes.albumName,
                    cover: songInfo.attributes.artwork.url.replace('{w}x{h}', `${songInfo.attributes.artwork.width}x${songInfo.attributes.artwork.height}`),
                    duration: songInfo.attributes.durationInMillis,
                    requestedBy: username,
                    platform: 'apple',
                    iscurrentlyPlaying: false,
                };
                await queueHandler.addToQueue(queueItem);
                return JSON.stringify({...queueItem, isQueued: true});
            } else {
                this.queueTrack(songID);
                return JSON.stringify({ title: songInfo.attributes.name, artist: songInfo.attributes.artistName, isQueued: true });
            }
        } else {
            return "ERR_AM_SONG_NOT_FOUND";
        }

    }

    public async queueTrack(songID: string): Promise<void> {
        try{
            console.log(`Queueing Apple Music track with ID: ${songID}`);
            await fetch(`http://localhost:10767/api/v1/playback/play-next`, {
                method: 'POST',
                headers: {
                    'apptoken': this.apptoken,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Request+/2.0.1 Release'
                },
                body: JSON.stringify({
                    "type": "songs",
                    "id": `${songID}`
                })
            }).then(response => response.json()).then(response => {
                console.log(response);
                this.logger.info('Queued Apple Music track with ID: ' + songID);
            });
        } catch (error) {
            this.logger.error(error);
        }
    }
}



export { AMSongObject, AMCurrentSongResponse, AMISPlayingResponse, AMVolumeResponse, AMCurrentSongObject, AMSongAttributes, AMSongAttributeArtwork, AMSongAttributePlayParams };
