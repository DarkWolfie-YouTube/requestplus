import { app } from 'electron';
import Websocket from 'ws';
import WebSocketServer, {RequestData} from './websocket';
import QueueHandler from './queueHandler';
import { YTManager } from './ytManager';
import { Settings } from './settingsHandler';
import { setTimeout as wait } from 'node:timers/promises';
import GTSHandler from './gtsHandler';
import Logger from './logger';
import AMHandler from './amhandler';

class KickChat {
    private connection: Websocket;
    public token: string;
    private userId: string;
    private queue: QueueHandler;
    private WSServer: WebSocketServer;
    private settings: Settings;
    private ytManager: YTManager;
    private subscribed: boolean = false;
    private gtsHandler: GTSHandler;
    private logger: Logger;
    private appleMusicHandler: AMHandler;

    constructor( token: string, userId: string, queue: QueueHandler, WSServer: WebSocketServer, settings: Settings, ytManager: YTManager, gtsHandler: GTSHandler, AppleMusicHandler: AMHandler, logger: Logger) {
        this.token = token;
        this.userId = userId;
        this.queue = queue;
        this.WSServer = WSServer;
        this.settings = settings;
        this.ytManager = ytManager;
        this.gtsHandler = gtsHandler;
        this.logger = logger;
        this.appleMusicHandler = AppleMusicHandler;

        this.setupWebsocket(token, userId);
    }

    private async setupWebsocket(token: string, userId: string) {
        this.connection = new Websocket('wss://api.requestplus.xyz');

        this.connection.on('message', async (message) => {
            

            const data = JSON.parse(message.toString());
            switch (data.type) {
                case 'connected':
                    // Send auth message
                    this.connection.send(JSON.stringify({
                        type: 'auth',
                        userId: userId,
                        token: token
                    }));
                    break;
                    
                case 'kick_message': 
                    switch (data.event_type) {
                        case 'chat.message.sent':
                            console.log('Sender badges:', data.data.sender.identity?.badges);
                            var messagea = data.data.content;
                            
                            if (data.data.content && data.data.content.length > 0 && messagea.toLowerCase().startsWith('!sr')) {
                                const request = messagea.split(' ').slice(1).join(' ');
                                
                                if (this.settings.enableRequests === false) { 
                                    await this.sendMessage("Song requests are currently disabled.", data.data.message_id);
                                    return;
                                }
                                
                                // Fix: Check if badges exist and are an array before accessing
                                const isModerator = data.data.sender.identity?.badges?.some(
                                    (badge: any) => badge.type === "moderator" || badge.type === "broadcaster"
                                ) || false;
                                
                                if (this.settings.modsOnly === true && !isModerator) {
                                    await this.sendMessage("Only moderators can use song requests.", data.data.message_id);
                                    return;
                                }
                                
                                if (this.settings.platform === 'spotify') {
                                    if (request.includes("https://open.spotify.com/")) {
                                        // Check for invalid link types
                                        if (request.includes("https://open.spotify.com/album")) {
                                            await this.sendMessage(`Please provide a spotify track link!`, data.data.message_id);
                                            return;
                                        }
                                        if (request.includes("https://open.spotify.com/playlist")) {
                                            await this.sendMessage(`Please provide a spotify track link!`, data.data.message_id);
                                            return;
                                        }
                                        if (request.includes("https://open.spotify.com/episode")) {
                                            await this.sendMessage(`Please provide a spotify track link!`, data.data.message_id);
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
                                            await wait(1500);
                                            
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
                                                        coverUrl = response.album.images[0].url;
                                                    }

                                                    if (this.WSServer.lastReq.explicit && !this.settings.filterExplicit) {
                                                        await this.sendMessage(`This song has unsafe lyrics and has been moderated, this song wasn't added to the queue.`, data.data.message_id);
                                                        return;
                                                    }
                                                    
                                                    await this.sendMessage(`Added ${title} by ${artists} to the moderation queue.`, data.data.message_id);
                                                    await this.queue.addToQueue({
                                                        id: id + '-' + data.data.sender.username,
                                                        title: title,
                                                        artist: artists,
                                                        album: response.album.name,
                                                        duration: response.duration_ms,
                                                        requestedBy: data.data.sender.username || "Unknown",
                                                        platform: 'spotify',
                                                        iscurrentlyPlaying: false,
                                                        cover: coverUrl
                                                    });
                                                    return;
                                                } 
                                            }
                                        }
                                        
                                        // Non-autoPlay flow
                                        this.WSServer.WSSend({ command: 'getInfo', data: { uri: `spotify:track:${id}` } });
                                        await wait(1500);
                                        this.WSServer.WSSend({ command: 'addTrack', data: { uri: `spotify:track:${id}` } });
                                        
                                        if (this.WSServer.lastReq) {
                                            const dataArtists: string[] = [];
                                            const response = this.WSServer.lastReq;
                                            
                                            if (response.artist != null) {
                                                for (const artist of response.artist) {
                                                    dataArtists.push(artist.name);
                                                } 
                                            }
                                           
                                            const artists = dataArtists.join(", ");
                                            const title = response.name;
                                            await this.sendMessage(`Song ${title} by ${artists} has been queued.`, data.data.message_id);
                                        } else {
                                            await this.sendMessage("the song was sent to queue, but didn't return any song information. Song maybe is queued. ERR: RPLUS_SONG_KINDA_QUEUED", data.data.message_id);
                                        }
                                    } else {
                                        await this.sendMessage(`Please provide a spotify track link! Usage: !sr <link>`, data.data.message_id);
                                    }
                                } else if (this.settings.platform === 'youtube') {
                                    console.log("YouTube request detected");
                                    console.log("Request link: " + request);
                                    
                                    if (request.includes("https://www.youtube.com/") || request.includes("https://youtube.com/") || request.includes("https://music.youtube.com/") || request.includes("https://youtu.be/")) {
                                        let videoId: string | null = null;
                                        let ida: string | undefined;
                                        
                                        if (request.includes("https://www.youtube.com/watch?v=")) {
                                           ida = request.split("https://www.youtube.com/watch?v=")[1];
                                        } else if (request.includes("https://youtube.com/watch?v=")) {
                                           ida = request.split("https://youtube.com/watch?v=")[1];
                                        } else if (request.includes("https://music.youtube.com/watch?v=")) {
                                           ida = request.split("https://music.youtube.com/watch?v=")[1];
                                        } else if (request.includes("https://youtu.be/")) {
                                           ida = request.split("https://youtu.be/")[1];
                                        }

                                        if (ida) {
                                            if (ida.includes("&si=")) {
                                                videoId = ida.split("&si=")[0];
                                            } else if (ida.includes("&")) {
                                                videoId = ida.split("&")[0];
                                            } else {
                                                videoId = ida;
                                            }
                                        }
                                        
                                        console.log("Extracted video ID: " + videoId);
                                        
                                        if (videoId) {
                                            console.log("Adding video ID to queue: " + videoId);
                                            await this.ytManager.addItemToQueueById(videoId);
                                            console.log("Video added to queue");
                                            await this.sendMessage(`Added the YouTube video to the queue.`, data.data.message_id);
                                            return;
                                        } else {
                                            await this.sendMessage(`Please provide a youtube video link!`, data.data.message_id);
                                            return;
                                        }
                                    } else {
                                        await this.sendMessage(`Please provide a youtube video link!`, data.data.message_id);
                                        return;
                                    }
                                } else if (this.settings.platform === 'apple') {
                                    
                                }
                            }
                            break;
                    }
                    break;
                    
                case 'auth_success':
                    if (this.subscribed) break;
                    this.connection.send(JSON.stringify({
                        type: 'subscribe_channel',
                        channelId: userId
                    }));
                    this.subscribed = true;
                    break;
                    
                case 'subscribed': 
                    this.logger.info('Successfully subscribed to channel:', userId);
                    break;
                    
                case 'refresh_token_callback':
                    var tokenn = data.token;
                    this.token = tokenn; // Fix: update this.token instead of local token
                    break;
                    
                default:
                    break;
            }
        });

        this.connection.on('error', (error) => {
            this.logger.error('WebSocket error:', error);
        });

        this.connection.on('close', () => {
            this.logger.info('WebSocket connection closed. Attempting to reconnect...');
            this.subscribed = false;
            setTimeout(() => {
                this.setupWebsocket(this.token, this.userId);
            }, 5000);
        });
    }

    async saveSettings(settings: Settings) {
        this.settings = settings;
    }

    private async sendMessage(message: string, msg_id?: string, sendAsBot: boolean = true) {
        const payload: any = {
            "content": message,
            "type": sendAsBot ? "bot" : "user"
        };
        
        if (!sendAsBot && this.userId) {
            payload.broadcaster_user_id = parseInt(this.userId);
        }
        
        if (msg_id) {
            payload.reply_to_message_id = msg_id;
        }
        
        this.logger.info('Sending message payload:', payload);
        
        try {
            const response = await fetch('https://api.kick.com/public/v1/chat', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            const responseText = await response.text();
            this.logger.info('Response status:', response.status);
            
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                this.logger.error('Failed to parse response as JSON:', responseText);
                throw new Error('Invalid JSON response from Kick API');
            }
            
            if (!response.ok) {
                this.logger.error('Failed to send message. Status:', response.status);
                this.logger.error('Error details:', result);
                
                if (response.status === 401) {
                    // Token expired, try to refresh
                    this.logger.info('Token expired, attempting refresh...');
                    await this.refreshToken();
                    await this.sendMessage(message, msg_id);
                } else if (response.status === 403) {
                    throw new Error('Forbidden - Bot may not have permission to send messages');
                } else if (response.status === 400) {
                    throw new Error(`Bad Request: ${result.message || 'Invalid request parameters'}`);
                }
                
                throw new Error(`Failed to send message: ${result.message || 'Unknown error'}`);
            }
            
            if (result.data && result.data.is_sent) {
                this.logger.info('✓ Message sent successfully. Message ID:', result.data.message_id);
            }
            
            
            return result;
        } catch (error) {
            this.logger.error('Error sending message to Kick:', error);
            // Don't re-throw, just log the error so the bot continues
        }
    }

    async refreshToken() {
        this.connection.send(JSON.stringify({
            type: 'refresh_token',
            token: this.token
        }));
    }
}

export default KickChat;