import WebSocket, { WebSocketServer as WSS } from 'ws';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as net from 'net';
import * as musicmetadata from 'music-metadata';
import { BrowserWindow } from 'electron';

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
    name: string;
    release_date: string;
    release_date_precision: string;
    restrictions?: { reason: string };
    type: string;
    uri: string;
}

interface ClientInfo {
    ws: WebSocket;
    type: string;
    connectedAt: Date;
    version?: string;
}

class WebSocketServer {
    private port: number;
    private wss: WSS | null;
    private clients: Map<WebSocket, ClientInfo>;
    private mainWindow: BrowserWindow;
    private logger: Logger;
    public lastInfo: TrackData | null;
    public lastReq: RequestData | null;

    constructor(port: number, mainWindow: BrowserWindow, logger: Logger) {
        this.port = port;
        this.wss = null;
        this.clients = new Map();
        this.mainWindow = mainWindow;
        this.logger = logger;
        this.lastInfo = null;
        this.lastReq = null;
        
        this.initServer();
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

                    // If client hasn't identified yet, ignore other messages
                    const client = this.clients.get(ws);
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
                            ws.send(JSON.stringify({
                                acknowledged: true,
                                type: parsed.type
                            }));
                        }
                        return;
                    }

                    // Send message to all clients but not the client that sent the message
                    this.clients.forEach((clientInfo, clientWs) => {
                        if (clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
                            clientWs.send(JSON.stringify(parsed));
                        }
                    });

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

                        this.lastInfo = data;
                        
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
                } catch (error) {
                    this.logger.error('Error processing WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                this.clients.delete(ws);
                this.logger.info('Client disconnected');
                this.logger.info(`Total clients connected: ${this.clients.size}`);
            });

            ws.on('error', (error: Error) => {
                this.logger.error('WebSocket Client Error:', error);
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