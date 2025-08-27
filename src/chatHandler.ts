import * as tmi from 'tmi.js';
import { setTimeout as wait } from 'node:timers/promises';
import { BrowserWindow } from 'electron';

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
    lastReq: SpotifyTrackInfo | null;
}

interface SpotifyArtist {
    name: string;
}

interface SpotifyTrackInfo {
    name: string;
    artists: SpotifyArtist[] | null;
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

    constructor(logger: Logger, mainWindow: BrowserWindow, twitchAuth: TwitchAuth, WSServer: WSServerInterface) {
        this.mainWindow = mainWindow;
        this.logger = logger;
        this.WSServer = WSServer;

        const clientOptions: TMIClientOptions = {
            options: { debug: true },
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
            console.log(message);
            
            if (message.toLowerCase().startsWith('!sr')) {
                const request = message.split(' ').slice(1).join(' ');
                console.log(request);
                
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
                    
                    this.WSServer.WSSend({ command: 'addTrack', data: { uri: `spotify:track:${id}` } });
                    await wait(2000);
                    
                    if (this.WSServer.lastReq) {
                        const dataArtists: string[] = [];
                        const response = this.WSServer.lastReq;
                        console.log(response.name);
                        console.log(response.artists != null);
                        
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
            }
        });
    }

    async connect(): Promise<void> {
        await this.Client.connect();
    }

    async disconnect(): Promise<void> {
        await this.Client.disconnect();
    }
}

export default ChatHandler;