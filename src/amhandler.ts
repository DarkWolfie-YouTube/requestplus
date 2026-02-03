/**
 * @file amhandler.ts
 * @copyright 2025 Quil DayTrack 
 * 
 * @license GPL-v3.0
 * @version 1.2.3
 *
 * @description
 * An Apple Music Handler for Cider enchancing playback and song information retrieval.
 */

import { App } from "electron";
import { Settings } from "./settingsHandler";
import { BrowserWindow } from "electron";
import PlaybackHandler, {songInfo} from "./playbackHandler";
import Logger from "./logger";
import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu';
import axios, { AxiosInstance } from "axios";
import QueueHandler, { QueueItem } from "./queueHandler";
import fetch from "node-fetch";
import { combineAppliedNumericalValuesIncludingErrorValues } from "recharts/types/state/selectors/axisSelectors";


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
    private playbackHandler: PlaybackHandler;
    private logger: Logger;
    private settings: Settings;
    private apptoken: string;
    private axiosInstance: AxiosInstance;

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
                'User-Agent': 'Request+/1.2.3 Release'
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
     * Retrieves the current song information from Apple Music.
     * @returns A Promise of an AMSongObject containing the current song information.
     * @throws An error if the request fails.
     */
    public async getCurrentSong(): Promise<AMCurrentSongResponse> {
        try {
            const response = await this.axiosInstance.get<AMCurrentSongResponse>('/playback/now-playing');
            return response.data;
        } catch (error) {
            this.logger.error('Error fetching Apple Music current song: ' + error);
            throw error;
        }
    }

    public async getIsPlayingState(): Promise<AMISPlayingResponse> {
        try {
            const response = await this.axiosInstance.get<AMISPlayingResponse>('/playback/is-playing');
            return response.data;
        } catch (error) {
            this.logger.error('Error fetching Apple Music isPlaying state: ' + error);
            throw error;
        }       
    }

    public async getVolume(): Promise<number> {
        try {
            const response = await this.axiosInstance.get<AMVolumeResponse>('/playback/volume');
            if (response.data.volume == 0) {
                return 0; 
            }

            return response.data.volume || 0;
        } catch (error) {
            this.logger.error('Error fetching Apple Music volume: ' + error);
            throw error;
        }
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
                if (response.data.status !== 'success') {
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

    public async handleChatRequest(message: string, channel: string, tags: any, client: any, queueHandler: QueueHandler, settings: Settings): Promise<void> {
        //get song requested data
        let songID;
        // if message just = "!sr" then return error
        if (message === "!sr") {
            client.say(channel, `@${tags.username}, please provide a valid Apple Music song ID or link.`);
            return;
        } else if (!message.includes("https://music.apple.com/")) {
            client.say(channel, `@${tags.username}, please provide a valid Apple Music song ID or link.`);
            return;
        }
        if (!message.includes("?i=")) {
            client.say(channel, `@${tags.username}, please provide a valid Apple Music song link that includes the song ID (i=). This is because albums or playlists are not supported for requests.`);
        }
        var messageLink = message.match(/https?:\/\/music\.apple\.com\/[a-z]{2}\/album\/[a-z0-9\-\_]+\/[0-9]+\?i=([0-9]+)/);
        if (messageLink && messageLink[1]) {
            songID = messageLink[1];
        } else {
            songID = message;
        }
        
        let songInfo: AMSongObject;
        await fetch(`http://localhost:10767/api/v1/amapi/run-v3`, {
            method: 'POST',
            headers: {
                'apptoken': this.apptoken,
                'Content-Type': 'application/json',
                'User-Agent': 'Request+/1.2.3 Release'
            },
            body: JSON.stringify({
                "path": "/v1/catalog/us/songs/" + songID,
            })
        })
        .then(response => response.json())
        .then((data: AMAPISongObject) => {
            songInfo = data.data.data[0];
        })
        console.log(songInfo);
        console.log(songInfo.attributes);
        if (songInfo) {
            if (queueHandler) {
                let queueItem: QueueItem = {
                    id: songID + '-' + tags.username,
                    title: songInfo.attributes.name,
                    artist: songInfo.attributes.artistName,
                    album: songInfo.attributes.albumName,
                    cover: songInfo.attributes.artwork.url.replace('{w}x{h}', `${songInfo.attributes.artwork.width}x${songInfo.attributes.artwork.height}`),
                    duration: songInfo.attributes.durationInMillis,
                    requestedBy: tags.username,
                    platform: 'apple',
                    iscurrentlyPlaying: false,
                };
                await queueHandler.addToQueue(queueItem);
                client.say(channel, `@${tags.username}, your Apple Music request for "${songInfo.attributes.name}" by ${songInfo.attributes.artistName} has been added to the queue!`);
            } else {
                client.say(channel, `@${tags.username}, the request queue is not available at the moment.`);
            }
        } else {
            client.say(channel, `@${tags.username}, sorry, I couldn't find the requested song on Apple Music.`);
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
                    'User-Agent': 'Request+/1.2.3 Release'
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