import * as tmi from 'tmi.js';
import { setTimeout as wait } from 'node:timers/promises';
import { BrowserWindow } from 'electron';
import { Settings } from './settingsHandler';
import { RequestData } from './websocket';
import QueueHandler from './queueHandler';
import { YTManager } from './ytManager';

// Type definitions
interface TwitchAuth {
    login: string;
    access_token: string;
}

interface Logger {
    info(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
}

interface WSCommand {
    command: string;
    data?: {
        uri: string;
    };
    [key: string]: any;
}

interface WSServerInterface {
    WSSend(message: WSCommand): void;
    lastReq: RequestData | null;
}


interface TMIClientOptions {
    options: {
        debug: boolean;
    };
    connection: {
        reconnect: boolean;
        secure: boolean;
    };
    identity: {
        username: string;
        password: string;
    };
    channels: string[];
}

class ChatHandler {
    private logger: Logger;
    private mainWindow: BrowserWindow | null;
    private WSServer: WSServerInterface;
    private Client: tmi.Client;
    private settings: Settings;
    private queueHandler: QueueHandler;
    private ytManager: YTManager;

    constructor(logger: Logger, mainWindow: BrowserWindow, twitchAuth: TwitchAuth, WSServer: WSServerInterface, settings: Settings, queueHandler: QueueHandler, ytManager: YTManager) {
        this.mainWindow = mainWindow;
        this.logger = logger;
        this.WSServer = WSServer;
        this.settings = settings;
        this.queueHandler = queueHandler;
        this.ytManager = ytManager;

        const clientOptions: TMIClientOptions = {
            options: { debug: false },
            connection: {
                reconnect: true,
                secure: true
            },
            identity: {
                username: twitchAuth.login,
                password: twitchAuth.access_token
            },
            channels: [twitchAuth.login]
        };

        this.Client = new tmi.client(clientOptions);
        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        this.Client.on('message', async (channel: string, tags: tmi.ChatUserstate, message: string, self: boolean): Promise<void> => {
            
            if (message.toLowerCase().startsWith('!sr')) {
                const request = message.split(' ').slice(1).join(' ');
                if (this.settings.enableRequests === false) { 
                    this.Client.say(channel, `Request+: Song requests are currently disabled.`);
                    return;
                }
                if (this.settings.modsOnly === true && !tags.mod && tags.username?.toLowerCase() !== channel.replace('#', '').toLowerCase()) {
                    this.Client.say(channel, `Request+: Only moderators can use song requests.`);
                    return;
                }
                if (this.settings.platform === 'spotify') {
                    if (request.includes("https://open.spotify.com/")) {
                        // Check for invalid link types
                        if (request.includes("https://open.spotify.com/album")) {
                            this.Client.say(channel, `Request+: Please provide a spotify track link!`);
                            return;
                        }
                        if (request.includes("https://open.spotify.com/playlist")) {
                            this.Client.say(channel, `Request+: Please provide a spotify track link!`);
                            return;
                        }
                        if (request.includes("https://open.spotify.com/episode")) {
                            this.Client.say(channel, `Request+: Please provide a spotify track link!`);
                            return;
                        }

                        const ida = request.split("https://open.spotify.com/track/")[1];
                        let id: string;
                        if (ida.includes("?si=")) {
                            id = ida.split("?si=")[0];
                        } else {
                            id = ida;
                        }
                        if (this.settings.autoPlay) {
                        
                            this.WSServer.WSSend({ command: 'getInfo', data: { uri: `spotify:track:${id}` } });
                            await wait(500);
                            if (this.WSServer.lastReq) {
                                const response = this.WSServer.lastReq as RequestData;
                                if (response.artists != null) {
                                    const dataArtists: string[] = [];
                                    for (const artist of response.artists) {
                                        dataArtists.push(artist.name);
                                    } 
                                    const artists = dataArtists.join(", ");
                                    const title = response.name;
                                    
                                    // Get album art URL
                                    let coverUrl = 'styles/unknown.png';
                                    if (response.album?.images && response.album.images.length > 0) {
                                        // Use the largest image (first in array)
                                        coverUrl = response.album.images[0].url;
                                    }

                                    if (this.WSServer.lastReq.explicit && !this.settings.filterExplicit) {
                                        this.Client.say(channel, `Request+: This song has unsafe lyrics and has been moderated, this song wasn't added to the queue.`);
                                        return;
                                    }
                                    this.Client.say(channel, `Request+: Added ${title} by ${artists} to the moderation queue.`);
                                    await this.queueHandler.addToQueue({
                                        id: id,
                                        title: title,
                                        artist: artists,
                                        album: response.album.name,
                                        duration: response.duration_ms,
                                        requestedBy: tags.username || "Unknown",
                                        iscurrentlyPlaying: false,
                                        cover: coverUrl // Add the cover image
                                    });
                                    return;
                                } 
                            }
                        
                    }
                
                    this.WSServer.WSSend({ command: 'addTrack', data: { uri: `spotify:track:${id}` } });
                    await wait(1000);
                    
                    if (this.WSServer.lastReq) {
                        const dataArtists: string[] = [];
                        const response = this.WSServer.lastReq;
                        
                        if (response.artists != null) {
                            for (const artist of response.artists) {
                                dataArtists.push(artist.name);
                            } 
                        }
                       
                        const artists = dataArtists.join(", ");
                        const title = response.name;
                        this.Client.say(channel, `Request+: Song ${title} by ${artists} has been queued.`);
                    } else {
                        this.Client.say(channel, "Request+: the song was sent to queue, but didn't return any song information. Song maybe is queued. ERR: RPLUS_SONG_KINDA_QUEUED");
                    }
                } else {
                    this.Client.say(channel, `Request+: Please provide a spotify track link! Usage: !sr <link>`);
                }
            } else if (this.settings.platform === 'youtube') {
                console.log("YouTube request detected");
                console.log("Request link: " + request);
                if (request.includes("https://www.youtube.com/") || request.includes("https://youtube.com/") || request.includes("https://music.youtube.com/") || request.includes("https://youtu.be/")) {
                    let videoId: string | null = null;
                    let ida: string;
                    if (request.includes("https://www.youtube.com/watch?v=")) {
                       ida = request.split("https://www.youtube.com/watch?v=")[1];
                    } else if (request.includes("https://youtube.com/watch?v=")) {
                       ida = request.split("https://youtube.com/watch?v=")[1];
                    } else if (request.includes("https://music.youtube.com/watch?v=")) {
                       ida = request.split("https://music.youtube.com/watch?v=")[1];
                    } else if (request.includes("https://youtu.be/")) {
                       ida = request.split("https://youtu.be/")[1];
                    }

                    if (ida.includes("&si=")) {
                            videoId = ida.split("&si=")[0];
                        } else {
                            videoId = ida;
                        }
                    console.log("Extracted video ID: " + videoId);
                    if (videoId) {
                        console.log("Adding video ID to queue: " + videoId);
                        await this.ytManager.addItemToQueueById(videoId);
                        console.log("Video added to queue");
                        this.Client.say(channel, `Request+: Added the YouTube video to the queue.`);
                        return;
                    } else {
                        this.Client.say(channel, `Request+: Please provide a youtube video link!`);
                        return;
                    }
                }
            }
        }      
    
            if (message.toLowerCase().startsWith('!srhelp')) {
                this.Client.say(channel, `Request+ Commands: !sr <spotify track link> - Request a song. !srhelp - Show this help message.`);
            }
            if (message.toLowerCase().startsWith('!remove')) {
                if (!tags.mod && tags.username?.toLowerCase() !== channel.replace('#', '').toLowerCase()) {
                    this.Client.say(channel, `Request+: Only moderators can remove songs from the queue.`);
                    return;
                }
                const indexStr = message.split(' ')[1];
                const indexraw = parseInt(indexStr, 10);
                const index = indexraw - 1; // Convert to zero-based index

                if (isNaN(index)) {
                    this.Client.say(channel, `Request+: Please provide a valid number.`);
                    return;
                }
                if (index < 0 || index >= this.queueHandler.queue.items.length) {
                    this.Client.say(channel, `Request+: Please provide a valid number.`);
                    return;
                }
                this.Client.say(channel, `Request+: Removed ${this.queueHandler.queue.items[index].title} by ${this.queueHandler.queue.items[index].artist} from the queue.`);
                await this.queueHandler.removeFromQueue(index);
            }
        });
        
    }

    async connect(): Promise<void> {
        await this.Client.connect();
    }

    async disconnect(): Promise<void> {
        await this.Client.disconnect();
    }

    async updateSettings(settinga: Settings): Promise<void> {
        this.settings = settinga;
    }
}

export default ChatHandler;