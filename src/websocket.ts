import WebSocket, { WebSocketServer as WSS } from 'ws';
import * as fs from 'fs';
import * as path from 'path';
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
    [key: string]: any;
}

interface ParsedMessage {
    command: string;
    data?: TrackData;
    isPlaying?: boolean;
    progress?: number;
}

interface WSCommand {
    command: string;
    data?: any;
    [key: string]: any;
}

interface RequestData {
    name: string;
    artists: Array<{ name: string }>;
    [key: string]: any;
}

class WebSocketServer {
    private port: number;
    private wss: WSS | null;
    private clients: Set<WebSocket>;
    private mainWindow: BrowserWindow;
    private logger: Logger;
    public lastInfo: TrackData | null;
    public lastReq: RequestData | null;

    constructor(port: number, mainWindow: BrowserWindow, logger: Logger) {
        this.port = port;
        this.wss = null;
        this.clients = new Set();
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
            this.clients.add(ws);
            this.logger.info('New client connected');
            this.logger.info(`Total clients connected: ${this.clients.size}`);

            ws.on('message', async (message: WebSocket.Data): Promise<void> => {
                try {
                    const messageString = message.toString();
                    const parsed: ParsedMessage = JSON.parse(messageString);

                    // Send message to all clients but not the client that sent the message
                    this.clients.forEach((client) => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify(parsed));
                        }
                    });

                    if (parsed.command === "currentTrack") {
                        const data: TrackData = {
                            ...parsed.data,
                            isPlaying: parsed.isPlaying,
                            progress: parsed.progress
                        };

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
                        this.mainWindow.webContents.send('song-info', data);
                        return;
                    }
                    
                    if (parsed.command === "requestHandled") {
                        console.log(parsed.command, parsed.data);
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
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageString);
            }
        });
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