/**
 * @file amhandler.ts
 * @copyright 2026 Quil DayTrack
 *
 * @license GPL-v3.0
 * @version 2.2.0
 *
 * @description
 * Apple Music handler for Cider. Cider 4 uses the scoped /api/v2 API when
 * available; Cider 3 falls back to the legacy /api/v1 API at a lower polling
 * rate to avoid the timeout problems seen in older Cider builds.
 */

import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { BrowserWindow } from "electron";
import { Settings } from "./settingsHandler";
import Logger from "./logger";
import QueueHandler, { QueueItem } from "./queueHandler";
import WebSocketServer, { ParsedMessage } from "./websocket";

type CiderApiVersion = "3" | "4";
type CiderRuntimeApi = "v1" | "v2";

interface AMSongObject {
    id: string;
    type: string;
    href: string;
    attributes: AMSongAttributes;
    relationships: Object;
}

interface AMSearchObject {
    songs: AMSearchSongObject;
}

interface AMSearchSongObject {
    href: string;
    next: string;
    data: AMSearchSongDataObject[];
}

interface AMSearchSongDataObject {
    id: string;
    type: string;
    href: string;
    attributes: AMSongAttributes;
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

interface CiderV2Playback {
    state?: "playing" | "paused" | "stopped" | string;
    nowPlaying?: Partial<AMSongAttributes> & {
        inFavorites?: boolean;
        inLibrary?: boolean;
        flavor?: string;
    };
    time?: {
        currentTime?: number;
        duration?: number;
        remaining?: number;
    };
    volume?: number;
    repeatMode?: "none" | "one" | "all" | number;
    shuffleMode?: boolean | number;
}

export default class AMHandler {
    private mainWindow: BrowserWindow;
    private logger: Logger;
    private settings: Settings;
    private apptoken: string;
    private v1: AxiosInstance;
    private v2: AxiosInstance;
    private preferredVersion: CiderApiVersion;
    private runtimeApi: CiderRuntimeApi;
    private cachedSongInfo: AMCurrentSongObject | null = null;
    private cachedIsPlaying: boolean = false;
    private cachedVolume: number = 0;
    private hasPluginData: boolean = false;
    private lastV1PollAt: number = 0;
    private lastV2PollAt: number = 0;
    private lastTokenRequestFailedAt: number = 0;
    private readonly v1PollIntervalMs = 3000;
    private readonly v2PollIntervalMs = 900;
    private readonly tokenRequestCooldownMs = 10000;
    private readonly appImageUrl = "https://requestplus.xyz/hotlink-ok/logo.png";

    constructor(mainWindow: BrowserWindow, logger: Logger, settings: Settings, localWebSocket?: WebSocketServer) {
        this.mainWindow = mainWindow;
        this.logger = logger;
        this.settings = settings;
        this.preferredVersion = this.resolvePreferredVersion(settings);
        this.apptoken = this.resolveAppToken(settings);
        this.runtimeApi = this.preferredVersion === "4" ? "v2" : "v1";
        this.v1 = this.createClient("/api/v1");
        this.v2 = this.createClient("/api/v2");
        localWebSocket?.on("cider-current-track", (message: ParsedMessage) => {
            if (this.preferredVersion === "3") {
                this.handleCiderTrackMessage(message);
            }
        });
        if (this.canUseHttpApi()) {
            void this.testConnection();
        }
    }

    private resolvePreferredVersion(settings: Settings): CiderApiVersion {
        return String(settings.ciderApiVersion || "3") === "4" ? "4" : "3";
    }

    private resolveAppToken(settings: Settings): string {
        return this.resolvePreferredVersion(settings) === "4"
            ? settings.ciderV4AppToken || ""
            : settings.appleMusicAppToken || "";
    }

    private createClient(basePath: string): AxiosInstance {
        return axios.create({
            baseURL: `http://localhost:10767${basePath}`,
            timeout: 10000,
            headers: {
                "apptoken": this.apptoken,
                "User-Agent": "Request+/2.2.0 Release"
            }
        });
    }

    private handleCiderTrackMessage(message: ParsedMessage): void {
        const data = message.data || message.item?.attributes;
        if (!data) return;

        const playParams = data.playParams || message.item?.attributes?.playParams || {};
        const prev = this.cachedSongInfo;
        this.hasPluginData = true;
        if (typeof message.isPlaying === "boolean") {
            this.cachedIsPlaying = message.isPlaying;
        }
        this.cachedVolume = typeof message.volume === "number" ? message.volume : this.cachedVolume;
        const hasTrackIdentity = Boolean(
            data.name ||
            data.artistName ||
            data.albumName ||
            data.durationInMillis ||
            playParams.id ||
            playParams.catalogId ||
            message.item?._songId
        );

        if (!hasTrackIdentity) {
            if (!prev) return;
            if (typeof message.shuffle === "boolean") {
                prev.shuffleMode = message.shuffle ? 1 : 0;
            }
            if (typeof message.repeat === "number") {
                prev.repeatMode = message.repeat;
            }
            if (typeof message.progress === "number") {
                prev.currentPlaybackTime = message.progress / 1000;
                prev.remainingTime = Math.max(0, (prev.durationInMillis - message.progress) / 1000);
            }
            if (typeof message.isLiked === "boolean") {
                prev.inLibrary = message.isLiked;
            }
            this.emitSongInfo(prev);
            return;
        }

        this.cachedSongInfo = {
            albumName: data.albumName || prev?.albumName || "",
            artistName: data.artistName || prev?.artistName || "",
            artwork: data.artwork || prev?.artwork || { url: "", width: 0, height: 0 },
            contentRating: data.contentRating || prev?.contentRating || "",
            discNumber: data.discNumber ?? prev?.discNumber ?? 0,
            durationInMillis: data.durationInMillis || message.duration || prev?.durationInMillis || 0,
            genreNames: data.genreNames || prev?.genreNames || [],
            hasLyrics: data.hasLyrics ?? prev?.hasLyrics ?? false,
            name: data.name || prev?.name || "",
            playParams: {
                ...(prev?.playParams || {}),
                ...playParams,
                catalogId: playParams.catalogId || message.item?._songId || message.item?.assets?.[0]?.metadata?.itemId,
                id: playParams.id || message.id || message.item?.id || prev?.playParams?.id || ""
            },
            releaseDate: data.releaseDate || prev?.releaseDate || "",
            trackNumber: data.trackNumber ?? prev?.trackNumber ?? 0,
            composerName: data.composerName || prev?.composerName || "",
            isrc: data.isrc || prev?.isrc || "",
            previews: data.previews || prev?.previews || [],
            currentPlaybackTime: data.currentPlaybackTime ?? (typeof message.progress === "number" ? message.progress / 1000 : prev?.currentPlaybackTime ?? 0),
            remainingTime: data.remainingTime ?? (typeof message.progress === "number" ? Math.max(0, ((data.durationInMillis || message.duration || prev?.durationInMillis || 0) - message.progress) / 1000) : prev?.remainingTime ?? 0),
            inFavorites: data.inFavorites ?? prev?.inFavorites ?? false,
            inLibrary: data.inLibrary ?? message.isLiked ?? prev?.inLibrary ?? false,
            shuffleMode: typeof message.shuffle === "boolean" ? (message.shuffle ? 1 : 0) : prev?.shuffleMode ?? 0,
            repeatMode: typeof message.repeat === "number" ? message.repeat : prev?.repeatMode ?? 0,
        };

        this.emitSongInfo(this.cachedSongInfo);
    }

    private emitSongInfo(songInfo: AMCurrentSongObject): void {
        this.mainWindow.webContents.send("song-info", {
            id: songInfo.playParams.catalogId || songInfo.playParams.id || "",
            title: songInfo.name || "Unknown Title",
            artist: songInfo.artistName || "Unknown Artist",
            album: songInfo.albumName || "",
            duration: songInfo.durationInMillis || 0,
            progress: songInfo.currentPlaybackTime * 1000 || 0,
            isPlaying: this.cachedIsPlaying,
            cover: this.resolveArtworkUrl(songInfo.artwork),
            volume: this.cachedVolume,
            shuffle: songInfo.shuffleMode === 1,
            repeat: songInfo.repeatMode,
            isLiked: songInfo.inLibrary || false
        });
    }

    private refreshClients(): void {
        this.preferredVersion = this.resolvePreferredVersion(this.settings);
        this.apptoken = this.resolveAppToken(this.settings);
        this.runtimeApi = this.preferredVersion === "4" ? "v2" : "v1";
        this.v1 = this.createClient("/api/v1");
        this.v2 = this.createClient("/api/v2");
    }

    private canUseHttpApi(): boolean {
        return this.preferredVersion === "3" || Boolean(this.apptoken);
    }

    private async testConnection(): Promise<void> {
        if (this.preferredVersion === "3") {
            this.runtimeApi = "v1";
            return;
        }

        try {
            await this.v2.get("/client/info");
            this.runtimeApi = "v2";
            this.logger.info("[AMHandler] Cider v2 API is reachable");
        } catch (error) {
            this.runtimeApi = "v1";
            this.logger.warn("[AMHandler] Cider v2 is not reachable; falling back to v1 at lower polling rate.", error);
        }
    }

    private async requestV2<T>(config: AxiosRequestConfig): Promise<T> {
        if (!this.apptoken) {
            throw new Error("Cider v2 token is not configured");
        }

        if (this.preferredVersion !== "4" || this.runtimeApi !== "v2") {
            throw new Error("Cider v2 is not active");
        }

        try {
            const response = await this.v2.request<T>(config);
            // console.log(response.data)
            return response.data;
        } catch (error) {
            this.logger.warn("[AMHandler] Cider v2 request failed.", error);
            throw error;
        }
    }

    private async requestV1<T>(config: AxiosRequestConfig): Promise<T> {
        if (this.preferredVersion === "4" && !this.apptoken) {
            throw new Error("Cider v2 token is not configured");
        }

        const response = await this.v1.request<T>(config);
        return response.data;
    }

    public async requestCiderV2Token(): Promise<string> {
        const now = Date.now();
        if (this.lastTokenRequestFailedAt && now - this.lastTokenRequestFailedAt < this.tokenRequestCooldownMs) {
            throw new Error("Cider token request is cooling down. Try again in a few seconds.");
        }

        try {
            const response = await this.v2.request<{ data: { token: string; scopes: string[] } }>({
                method: "POST",
                url: "/auth/request",
                data: {
                    app_name: "Request+",
                    app_image: this.appImageUrl,
                    scopes: ["playback", "queue", "library", "audio"]
                },
                headers: {
                    "Content-Type": "application/json"
                },
                timeout: 125000
            });

            const token = response.data?.data?.token;
            if (!token) throw new Error("Cider did not return an app token.");
            this.lastTokenRequestFailedAt = 0;
            return token;
        } catch (error) {
            this.lastTokenRequestFailedAt = Date.now();
            throw error;
        }
    }

    private v2RepeatToNumber(mode: CiderV2Playback["repeatMode"]): number {
        if (typeof mode === "number") return mode;
        if (mode === "one") return 1;
        if (mode === "all") return 2;
        return 0;
    }

    private normalizeArtwork(artwork?: Partial<AMSongAttributeArtwork>): AMSongAttributeArtwork {
        return {
            url: artwork?.url || "",
            width: artwork?.width || 600,
            height: artwork?.height || 600,
            bgColor: artwork?.bgColor,
            hasP3: artwork?.hasP3,
            textColor1: artwork?.textColor1,
            textColor2: artwork?.textColor2,
            textColor3: artwork?.textColor3,
            textColor4: artwork?.textColor4,
        };
    }

    private normalizeV2Playback(playback: CiderV2Playback): AMCurrentSongResponse {
        const nowPlaying = playback.nowPlaying || {};
        const durationMs = nowPlaying.durationInMillis || ((playback.time?.duration || 0) * 1000);
        const currentTime = playback.time?.currentTime || 0;
        const remaining = playback.time?.remaining ?? Math.max(0, (durationMs / 1000) - currentTime);
        const playParams = nowPlaying.playParams || { id: "", kind: "song" };
        const normalizedPlayParams = {
            ...playParams,
            id: playParams.catalogId || playParams.reportingId || playParams.id || ""
        };
        const prev = this.cachedSongInfo;
        const hasTrackIdentity = Boolean(
            nowPlaying.name ||
            nowPlaying.artistName ||
            nowPlaying.albumName ||
            nowPlaying.durationInMillis ||
            normalizedPlayParams.id ||
            normalizedPlayParams.catalogId
        );

        this.cachedIsPlaying = playback.state === "playing";
        this.cachedVolume = playback.volume ?? this.cachedVolume;

        if (!hasTrackIdentity && prev) {
            prev.currentPlaybackTime = playback.time?.currentTime ?? prev.currentPlaybackTime;
            prev.remainingTime = playback.time?.remaining ?? prev.remainingTime;
            prev.shuffleMode = playback.shuffleMode === true || playback.shuffleMode === 1 ? 1 : playback.shuffleMode === false || playback.shuffleMode === 0 ? 0 : prev.shuffleMode;
            prev.repeatMode = playback.repeatMode !== undefined ? this.v2RepeatToNumber(playback.repeatMode) : prev.repeatMode;
            this.cachedSongInfo = prev;
            return { status: "ok", info: prev };
        }

        const info: AMCurrentSongObject = {
            albumName: nowPlaying.albumName || prev?.albumName || "",
            artistName: nowPlaying.artistName || prev?.artistName || "",
            artwork: this.normalizeArtwork(nowPlaying.artwork || prev?.artwork),
            contentRating: String((nowPlaying as any).contentRating || prev?.contentRating || ""),
            discNumber: nowPlaying.discNumber ?? prev?.discNumber ?? 0,
            durationInMillis: durationMs || prev?.durationInMillis || 0,
            genreNames: nowPlaying.genreNames || prev?.genreNames || [],
            hasLyrics: nowPlaying.hasLyrics ?? prev?.hasLyrics ?? false,
            name: nowPlaying.name || prev?.name || "",
            playParams: { ...(prev?.playParams || {}), ...normalizedPlayParams },
            releaseDate: nowPlaying.releaseDate || prev?.releaseDate || "",
            trackNumber: nowPlaying.trackNumber ?? prev?.trackNumber ?? 0,
            composerName: nowPlaying.composerName || prev?.composerName || "",
            isrc: nowPlaying.isrc || prev?.isrc || "",
            previews: nowPlaying.previews || prev?.previews || [],
            currentPlaybackTime: playback.time?.currentTime ?? prev?.currentPlaybackTime ?? currentTime,
            remainingTime: playback.time?.remaining ?? prev?.remainingTime ?? remaining,
            inFavorites: nowPlaying.inFavorites ?? prev?.inFavorites ?? false,
            inLibrary: nowPlaying.inLibrary ?? prev?.inLibrary ?? false,
            shuffleMode: playback.shuffleMode === true || playback.shuffleMode === 1 ? 1 : playback.shuffleMode === false || playback.shuffleMode === 0 ? 0 : prev?.shuffleMode ?? 0,
            repeatMode: playback.repeatMode !== undefined ? this.v2RepeatToNumber(playback.repeatMode) : prev?.repeatMode ?? 0,
        };

        this.cachedSongInfo = info;
        return { status: "ok", info };
    }

    private resolveArtworkUrl(artwork?: AMSongAttributeArtwork): string {
        if (!artwork?.url) return "";
        const width = artwork.width || 600;
        const height = artwork.height || 600;
        return artwork.url.replace("{w}", width.toString()).replace("{h}", height.toString());
    }

    private async getCatalogSong(songID: string): Promise<AMSongObject | undefined> {
        const response = await this.requestV1<any>({
            method: "POST",
            url: "/amapi/run-v3",
            data: {
                path: `/v1/catalog/us/songs/${songID}`
            },
            headers: {
                "Content-Type": "application/json"
            }
        });
        return (response as AMAPISongObject)?.data?.data?.[0];
    }

    private shouldUseCachedPoll(): boolean {
        if (this.preferredVersion === "3" && this.hasPluginData && this.cachedSongInfo) {
            return true;
        }

        const now = Date.now();
        if (this.runtimeApi === "v1" && this.cachedSongInfo && now - this.lastV1PollAt < this.v1PollIntervalMs) {
            return true;
        }
        if (this.runtimeApi === "v2" && this.cachedSongInfo && now - this.lastV2PollAt < this.v2PollIntervalMs) {
            return true;
        }
        return false;
    }

    public async playPause(): Promise<void> {
        if (!this.canUseHttpApi()) return;
        try {
            try {
                await this.requestV2({ method: "POST", url: "/playback/toggle" });
                return;
            } catch {}
            await this.requestV1({ method: "POST", url: "/playback/playpause", data: {} });
        } catch (error) {
            this.logger.error(error);
        }
    }

    public async onSearchRequest(query: string): Promise<AMSearchObject> {
        if (!this.canUseHttpApi()) throw new Error("Cider token is not configured");
        try {
            const data = await this.requestV1<any>({
                method: "POST",
                url: "/amapi/run-v3",
                data: {
                    path: `/v1/catalog/us/search?types=songs&term=${query}`,
                },
                headers: {
                    "Content-Type": "application/json"
                }
            });

            if ((data.data.results as AMSearchObject).songs !== undefined) {
                return data.data.results as AMSearchObject;
            }
            throw new Error("No search results found");
        } catch (error) {
            this.logger.error("Error searching Apple Music: " + error);
            throw error;
        }
    }

    public async getCurrentSong(): Promise<AMCurrentSongResponse> {
        if (!this.canUseHttpApi()) {
            return this.getEmptyCurrentSong();
        }

        if (this.shouldUseCachedPoll() && this.cachedSongInfo) {
            return { status: "ok", info: this.cachedSongInfo };
        }

        if (this.preferredVersion === "4" && this.runtimeApi === "v2") {
            try {
                this.lastV2PollAt = Date.now();
                const response = await this.requestV2<{ data: CiderV2Playback }>({
                    method: "GET",
                    url: "/playback"
                });
                return this.normalizeV2Playback(response.data);
            } catch {
                // Keep the v2 runtime active; this single call can fall through to v1.
            }
        }

        try {
            this.lastV1PollAt = Date.now();
            const response = await this.requestV1<AMCurrentSongResponse>({
                method: "GET",
                url: "/playback/now-playing"
            });
            this.cachedSongInfo = response.info;
            return response;
        } catch (error) {
            this.logger.error("Error fetching Apple Music current song: " + error);
            throw error;
        }
    }

    private getEmptyCurrentSong(): AMCurrentSongResponse {
        return {
            status: "not_configured",
            info: {
                albumName: "",
                artistName: "",
                artwork: { url: "", width: 0, height: 0 },
                contentRating: "",
                discNumber: 0,
                durationInMillis: 0,
                genreNames: [],
                hasLyrics: false,
                name: "",
                playParams: { id: "", kind: "song" },
                releaseDate: "",
                trackNumber: 0,
                composerName: "",
                isrc: "",
                previews: [],
                currentPlaybackTime: 0,
                remainingTime: 0,
                inFavorites: false,
                inLibrary: false,
                shuffleMode: 0,
                repeatMode: 0,
            }
        };
    }

    public async getIsPlayingState(): Promise<AMISPlayingResponse> {
        if (!this.canUseHttpApi()) {
            return { status: "ok", is_playing: false };
        }

        if (this.preferredVersion === "3" && this.hasPluginData) {
            return { status: "ok", is_playing: this.cachedIsPlaying };
        }

        if (this.runtimeApi === "v2") {
            try {
                const response = await this.requestV2<{ data: { state: string } }>({
                    method: "GET",
                    url: "/playback/state"
                });
                this.cachedIsPlaying = response.data.state === "playing";
                return { status: "ok", is_playing: this.cachedIsPlaying };
            } catch {
                // fall through to v1
            }
        }

        try {
            const response = await this.requestV1<AMISPlayingResponse>({
                method: "GET",
                url: "/playback/is-playing"
            });
            this.cachedIsPlaying = response.is_playing;
        } catch {
            this.cachedIsPlaying = false;
        }
        return { status: "ok", is_playing: this.cachedIsPlaying };
    }

    public async getVolume(): Promise<number> {
        if (!this.canUseHttpApi()) {
            return this.cachedVolume;
        }

        if (this.preferredVersion === "3" && this.hasPluginData) {
            return this.cachedVolume;
        }

        if (this.runtimeApi === "v2") {
            try {
                const response = await this.requestV2<{ data: { volume: number } }>({
                    method: "GET",
                    url: "/audio/volume"
                });
                this.cachedVolume = response.data.volume;
                return this.cachedVolume;
            } catch {
                // fall through to v1
            }
        }

        try {
            const response = await this.requestV1<AMVolumeResponse>({
                method: "GET",
                url: "/playback/volume"
            });
            this.cachedVolume = response.volume ?? this.cachedVolume;
        } catch {}

        return this.cachedVolume;
    }

    public async setVolume(volume: number): Promise<void> {
        if (!this.canUseHttpApi()) return;
        try {
            try {
                await this.requestV2({ method: "PATCH", url: "/audio/volume", data: { volume } });
                this.cachedVolume = volume;
                return;
            } catch {}
            await this.requestV1({ method: "POST", url: "/playback/volume", data: { volume } });
            this.cachedVolume = volume;
        } catch (error) {
            this.logger.error(error);
        }
    }

    public async likeSong(): Promise<void> {
        if (!this.canUseHttpApi()) return;
        try {
            try {
                await this.requestV2({ method: "POST", url: "/library/now-playing/add" });
                return;
            } catch {}
            await this.requestV1({ method: "POST", url: "/playback/add-to-library", data: {} });
        } catch (error) {
            this.logger.error(error);
        }
    }

    public async seekTo(positionSeconds: number): Promise<void> {
        if (!this.canUseHttpApi()) return;
        try {
            try {
                await this.requestV2({ method: "POST", url: "/playback/seek", data: { position: positionSeconds } });
                return;
            } catch {}
            await this.requestV1({ method: "POST", url: "/playback/seek", data: { position: positionSeconds } });
        } catch (error) {
            this.logger.error(error);
        }
    }

    public async nextTrack(): Promise<void> {
        if (!this.canUseHttpApi()) return;
        try {
            try {
                await this.requestV2({ method: "POST", url: "/playback/next" });
                return;
            } catch {}
            await this.requestV1({ method: "POST", url: "/playback/next", data: {} });
        } catch (error) {
            this.logger.error(error);
        }
    }

    public async previousTrack(): Promise<void> {
        if (!this.canUseHttpApi()) return;
        try {
            try {
                await this.requestV2({ method: "POST", url: "/playback/previous", data: {} });
                return;
            } catch {}
            await this.requestV1({ method: "POST", url: "/playback/previous", data: {} });
        } catch (error) {
            this.logger.error(error);
        }
    }

    public async setRepeat(): Promise<void> {
        if (!this.canUseHttpApi()) return;
        try {
            try {
                await this.requestV2({ method: "POST", url: "/playback/repeat/toggle" });
                return;
            } catch {}
            await this.requestV1({ method: "POST", url: "/playback/toggle-repeat", data: {} });
        } catch (error) {
            this.logger.error(error);
        }
    }

    public async setShuffle(): Promise<void> {
        if (!this.canUseHttpApi()) return;
        try {
            try {
                await this.requestV2({ method: "POST", url: "/playback/shuffle/toggle" });
                return;
            } catch {}
            await this.requestV1({ method: "POST", url: "/playback/toggle-shuffle", data: {} });
        } catch (error) {
            this.logger.error(error);
        }
    }

    public updateSettings(settings: Settings): void {
        this.settings = settings;
        this.refreshClients();
        if (this.canUseHttpApi()) {
            void this.testConnection();
        }
    }

    public async handleChatRequest(message: string, queueHandler: QueueHandler, settings: Settings, username: string): Promise<string> {
        if (!this.canUseHttpApi()) return "ERR_AM_NO_TOKEN";
        let songID: string | undefined = undefined;
        if (message === "!sr") return "ERR_AM_NOLINK";

        if (message.includes("https://music.apple.com/") && message.includes("?i=")) {
            const iParam = message.split("?i=")[1]?.split("&")[0]?.split(" ")[0];
            if (iParam && /^[0-9]+$/.test(iParam)) songID = iParam;
        }

        if (!songID) {
            const amMatch = message.match(/https?:\/\/music\.apple\.com\/[a-z]{2}\/(?:album|song)\/[a-z0-9\-\_]+\/([0-9]+)/i);
            if (amMatch) songID = amMatch[1];
        }

        if (!songID) {
            const songLinkMatch = message.match(/https?:\/\/song\.link\/i\/([0-9]+)/);
            if (songLinkMatch) songID = songLinkMatch[1];
        }

        if (!songID) return "ERR_AM_NOLINK";

        const songInfo = await this.getCatalogSong(songID);
        if (!songInfo) return "ERR_AM_SONG_NOT_FOUND";

        if (queueHandler && settings.autoPlay) {
            const queueItem: QueueItem = {
                id: `${songID}-${username}`,
                title: songInfo.attributes.name,
                artist: songInfo.attributes.artistName,
                album: songInfo.attributes.albumName,
                cover: this.resolveArtworkUrl(songInfo.attributes.artwork),
                duration: songInfo.attributes.durationInMillis,
                requestedBy: username,
                platform: "apple",
                iscurrentlyPlaying: false,
            };
            await queueHandler.addToQueue(queueItem);
            return JSON.stringify({ ...queueItem, isQueued: true });
        }

        await this.queueTrack(songID);
        return JSON.stringify({ title: songInfo.attributes.name, artist: songInfo.attributes.artistName, isQueued: true });
    }

    public async queueTrack(songID: string): Promise<void> {
        if (!this.canUseHttpApi()) return;
        try {
            try {
                await this.requestV2({
                    method: "POST",
                    url: "/queue/add-next",
                    data: { type: "songs", id: songID }
                });
                return;
            } catch {}
            await this.requestV1({
                method: "POST",
                url: "/playback/play-next",
                data: { type: "songs", id: songID }
            });
        } catch (error) {
            this.logger.error(error);
        }
    }
}

export {
    AMSongObject,
    AMCurrentSongResponse,
    AMISPlayingResponse,
    AMVolumeResponse,
    AMCurrentSongObject,
    AMSongAttributes,
    AMSongAttributeArtwork,
    AMSongAttributePlayParams
};
