import WebSocket, { WebSocketServer as WSS } from 'ws';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as net from 'net';
import * as musicmetadata from 'music-metadata';
import { BrowserWindow } from 'electron';
import { EventEmitter } from 'events';

// Type definitions
interface Logger {
    info(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
}

interface TrackData {
    local_file_path?: string;
    image?: string;
    isPlaying?: boolean;
    progress?: number;
    volume?: number;
    shuffle?: boolean;
    repeat?: number;
    isLiked?: boolean;
    id?: string;
    duration?: number;
    [key: string]: any;
}

interface ParsedMessage {
    command: string;
    data?: TrackData;
    type?: string;
    isPlaying?: boolean;
    progress?: number;
    volume?: number;
    shuffle?: boolean;
    repeat?: number;
    isLiked?: boolean;
    id?: string;
    [key: string]: any;
}

interface WSCommand {
    command: string;
    data?: any;
    [key: string]: any;
}

interface RequestData {
    name: string;
    artists: Array<{ name: string }>;
    album: SpotifyAlbum | null;
    [key: string]: any;
}

interface SpotifyAlbum {
    album_type: string;
    total_tracks: number;
    available_markets: string[];
    external_urls: { spotify: string };
    href: string;
    id: string;
    images: Array<{ height: number; width: number; url: string }>;
    cover_group: NewCoverAPIResponse;
    name: string;
    release_date: string;
    release_date_precision: string;
    restrictions?: { reason: string };
    type: string;
    uri: string;
}

interface NewCoverAPIResponse {
    image: Array<{ height: number; width: number; file_id: string }>;
}

interface ClientInfo {
    ws: WebSocket;
    type: string;
    connectedAt: Date;
    version?: string;
}

interface SearchAPITrackData {
    album?: SearchAPIAlbumData
    albumOfTrack?: {
        coverArt?: { sources?: Array<{ height?: number; width?: number; url: string }> };
        id?: string;
        name?: string;
        uri?: string;
    }
    artists: Array<{ name?: string; profile?: { name?: string } }> | { items?: Array<{ name?: string; profile?: { name?: string } }> }
    name: string
    id: string
    uri: string
    external_urls?: { spotify: string }
    duration?: { totalMilliseconds?: number } | number
    duration_ms?: number
    type?: string
    popularity?: number
    is_local?: boolean
    is_playable?: boolean
    track_number?: number
}

interface SearchAPIAlbumData {
    album_type: string;
    total_tracks: number;
    available_markets: string[];
    external_urls: { spotify: string };
    href: string;
    id: string;
    images: Array<{ height: number; width: number; url: string }>;
    name: string;
    release_date: string;
    release_date_precision: string;
    restrictions?: { reason: string };
    type: string;
    uri: string;
    artists: Array<{ name: string }>
}

class WebSocketServer extends EventEmitter {
    private port: number;
    private wss: WSS | null;
    private clients: Map<WebSocket, ClientInfo>;
    private mainWindow: BrowserWindow;
    private logger: Logger;
    public lastSInfo: TrackData | null;
    public lastSOInfo: TrackData | null;
    public lastReq: RequestData | null;
    public SearchResults: Array<SearchAPITrackData> = []

    constructor(port: number, mainWindow: BrowserWindow, logger: Logger) {
        super();
        this.port = port;
        this.wss = null;
        this.clients = new Map();
        this.mainWindow = mainWindow;
        this.logger = logger;
        this.lastSInfo = null;
        this.lastSOInfo = null;
        this.lastReq = null;
        
        this.initServer();
    }

    private normalizeSearchResults(data: any): Array<SearchAPITrackData> {
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.tracks?.items)) return data.tracks.items;
        if (Array.isArray(data?.items)) return data.items;
        return [];
    }

    private initServer(): void {
        // First, check if the port is available
        const server = net.createServer();
        
        server.listen(this.port, () => {
            // Port is available, close this test server
            server.close(() => {
                // Create WebSocket server
                this.initWSServer();
            });
        }).on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                this.logger.error(`Port ${this.port} is already in use. Attempting to close existing connections.`);
                // Optionally, you could implement logic to find an alternative port
            } else {
                this.logger.error('Error starting server:', err);
            }
        });
    }

    private initWSServer(): void {
        this.wss = new WSS({ port: this.port });

        this.wss.on('connection', (ws: WebSocket) => {
            // Initialize client with unknown type
            const clientInfo: ClientInfo = {
                ws: ws,
                type: 'unknown',
                connectedAt: new Date()
            };
            
            this.clients.set(ws, clientInfo);
            this.logger.info('New client connected');
            this.logger.info(`Total clients connected: ${this.clients.size}`);

            // Send welcome message requesting client type
            ws.send(JSON.stringify({
                welcome: {
                    message: "Please identify your client type",
                    requestType: true
                }
            }));

            ws.on('message', async (message: WebSocket.Data): Promise<void> => {
                try {
                    const messageString = message.toString();
                    const parsed: ParsedMessage = JSON.parse(messageString);

                    const client = this.clients.get(ws);
                    if (client && client.type === 'unknown' && parsed.type) {
                        client.type = parsed.type;
                        this.logger.info(`Client identified from packet as type: ${parsed.type}`);
                        if (parsed.type === 'cider') {
                            this.emit('cider-client-connected');
                        }
                    }

                    // If client hasn't identified yet, ignore other messages
                    if (client && client.type === 'unknown' && parsed.command !== 'identify') {
                        this.logger.warn('Received message from unidentified client, ignoring.');
                        return;
                    }

                    // Handle client type identification
                    if (parsed.command === "identify" && parsed.type) {
                        const client = this.clients.get(ws);
                        if (client) {
                            client.type = parsed.type;
                            if (parsed.version) {
                                client.version = parsed.version;
                            }
                            this.logger.info(`Client identified as type: ${parsed.type}, version: ${parsed.version || 'unknown'}`);
                            if (parsed.type === 'cider') {
                                this.emit('cider-client-connected');
                            }
                            ws.send(JSON.stringify({
                                acknowledged: true,
                                type: parsed.type
                            }));
                        }
                        return;
                    }

                    if (client && client.type === 'cider') {
                        if (parsed.command === 'currentTrack') {
                            this.emit('cider-current-track', parsed);
                            return;
                        }
                    }

                    if (client && client.type === 'spotify') {
                        if (parsed.command === "currentTrack") {
                        const data: TrackData = {
                            ...parsed.data,
                            isPlaying: parsed.isPlaying,
                            progress: parsed.progress,
                            volume: parsed.volume,
                            shuffle: parsed.shuffle,
                            repeat: parsed.repeat,
                            isLiked: parsed.isLiked,
                            id: parsed.id
                        };

                        // Add track ID extraction for auto-queue system
                        if (parsed.data) {
                            // Extract track ID from URI or use existing ID
                            if (parsed.data.uri && parsed.data.uri.includes('spotify:track:')) {
                                data.id = parsed.data.uri.replace('spotify:track:', '');
                            } else if (parsed.data.id) {
                                data.id = parsed.data.id;
                            }

                            // Extract duration if available
                            if (parsed.data.duration_ms) {
                                data.duration = parsed.data.duration_ms;
                            }
                        }

                        if (data.local_file_path) {
                            try {
                                const metadata = await musicmetadata.parseFile(data.local_file_path);
                                if (metadata.common.picture && metadata.common.picture.length > 0) {
                                    const imageB64 = Buffer.from(metadata.common.picture[0].data).toString('base64');
                                    data.image = `data:${metadata.common.picture[0].format};base64,${imageB64}`;
                                }
                            } catch (error) {
                                this.logger.error('Error parsing music metadata:', error);
                            }
                        }

                        this.lastSInfo = data;
                        
                        // Notify main process for auto-queue monitoring
                        try {
                            // Import the global function (you'll need to set this up in main.ts)
                            if ((global as any).setCurrentSongInformation) {
                                (global as any).setCurrentSongInformation(data);
                            }
                        } catch (error) {
                            this.logger.error('Error updating current song information:', error);
                        }
                        
                        return;
                    }
                    
                    if (parsed.command === "requestHandled") {
                        this.logger.info('Request handled for: ', parsed.data);
                        this.lastReq = parsed.data as RequestData;
                        return;
                    }

                    if (parsed.command === "searchResults") {
                        console.log('Search Results:', parsed.data);
                        this.SearchResults = this.normalizeSearchResults(parsed.data);
                        return;
                    }
                    } else if (client && client.type === 'soundcloud') {

                        if (parsed.command === "currentTrack") {
                            const data: TrackData = {
                                ...parsed.data,
                                isPlaying: parsed.isPlaying,
                                progress: parsed.progress,
                                volume: parsed.volume,
                                shuffle: parsed.shuffle,
                                repeat: parsed.repeat,
                                isLiked: parsed.isLiked,
                                id: parsed.id
                            };
                            // Add track ID extraction for auto-queue system
                            if (parsed.data) {
                                // Extract track ID from URI or use existing ID
                                if (parsed.data.uri && parsed.data.uri.includes('spotify:track:')) {
                                    data.id = parsed.data.uri.replace('spotify:track:', '');
                                } else if (parsed.data.id) {
                                    data.id = parsed.data.id;
                                }

                                // Extract duration if available
                                if (parsed.data.duration_ms) {
                                    data.duration = parsed.data.duration_ms;
                                }
                            }

                            if (data.local_file_path) {
                                try {
                                    const metadata = await musicmetadata.parseFile(data.local_file_path);
                                    if (metadata.common.picture && metadata.common.picture.length > 0) {
                                        const imageB64 = Buffer.from(metadata.common.picture[0].data).toString('base64');
                                        data.image = `data:${metadata.common.picture[0].format};base64,${imageB64}`;
                                    }
                                } catch (error) {
                                    this.logger.error('Error parsing music metadata:', error);
                                }
                            }

                            this.lastSOInfo = data;
                            
                            // Notify main process for auto-queue monitoring
                            try {
                                // Import the global function (you'll need to set this up in main.ts)
                                if ((global as any).setCurrentSongInformation) {
                                    (global as any).setCurrentSongInformation(data);
                                }
                            } catch (error) {
                                this.logger.error('Error updating current song information:', error);
                            }
                            
                            return;
                        }
                        
                        if (parsed.command === "requestHandled") {
                            this.logger.info('Request handled for: ', parsed.data);
                            this.lastReq = parsed.data as RequestData;
                            return;
                        }

                        if (parsed.command === "searchResults") {
                            console.log('Search Results:', parsed.data);
                            this.SearchResults = this.normalizeSearchResults(parsed.data);
                            return;
                        }
                    }

                } catch (error) {
                    this.logger.error('Error processing WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                const client = this.clients.get(ws);
                if (client?.type === 'cider') {
                    this.emit('cider-client-disconnected');
                }
                this.clients.delete(ws);
                this.logger.info('Client disconnected');
                this.logger.info(`Total clients connected: ${this.clients.size}`);
            });

            ws.on('error', (error: Error) => {
                this.logger.error('WebSocket Client Error:', error);
                const client = this.clients.get(ws);
                if (client?.type === 'cider') {
                    this.emit('cider-client-disconnected');
                }
                this.clients.delete(ws);
            });
        });

        this.wss.on('error', (error: Error) => {
            this.logger.error('WebSocket Server Error:', error);
        });

        this.logger.info(`WebSocket server started on port ${this.port}`);
    }

    async WSSend(message: WSCommand): Promise<void> {
        const messageString = JSON.stringify(message);
        this.clients.forEach((clientInfo, ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(messageString);
            }
        });
    }

    // Helper method to send to specific client types
    async WSSendToType(message: WSCommand, type: string): Promise<void> {
        const messageString = JSON.stringify(message);
        this.clients.forEach((clientInfo, ws) => {
            if (clientInfo.type === type && ws.readyState === WebSocket.OPEN) {
                ws.send(messageString);
            }
        });
    }

    // Helper method to get all clients of a specific type
    getClientsByType(type: string): ClientInfo[] {
        const clientsOfType: ClientInfo[] = [];
        this.clients.forEach((clientInfo) => {
            if (clientInfo.type === type) {
                clientsOfType.push(clientInfo);
            }
        });
        return clientsOfType;
    }

    // Method to close the server
    close(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.wss) {
                this.wss.close((error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

export default WebSocketServer;
export { TrackData, RequestData, ParsedMessage, ClientInfo };
