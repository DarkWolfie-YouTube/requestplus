const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const net = require('net');

class WebSocketServer {
    constructor(port, mainWindow, logger) {
        this.port = port;
        this.wss = null;
        this.clients = new Set(); // Initialize clients Set in constructor
        this.mainWindow = mainWindow;
        this.logger = logger;
        this.lastInfo = null;
        this.lastReq = null;
        
        // Load theme settings from file

        this.initServer();
    }

    initServer() {
        // First, check if the port is available
        const server = net.createServer();
        
        server.listen(this.port, () => {
            // Port is available, close this test server
            server.close(() => {
                // Create WebSocket server
                this.initWSServer();
            });
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                this.logger.error(`Port ${this.port} is already in use. Attempting to close existing connections.`);
                // Optionally, you could implement logic to find an alternative port
            } else {
                this.logger.error('Error starting server:', err);
            }
        });
    }
    // make the websocket server send the string instead of binary
    
    initWSServer() {
        this.wss = new WebSocket.Server({ port: this.port });

        this.wss.on('connection', (ws) => {
            this.clients.add(ws);
            this.logger.info('New client connected');
            this.logger.info(`Total clients connected: ${this.clients.size}`);

            ws.on('message', (message) => {
                // Send message to all clients but not the client that sent the message
                this.clients.forEach((client) => {
                    if (client !== ws) {
                        client.send(JSON.stringify(JSON.parse(message)));
                    }
                });
                let parsed = JSON.parse(message);
                console.log(parsed.command, (parsed.command === "currentTrack"))
                

                if (parsed.command === "currentTrack") {
                    let data = {
                        ...parsed.data,
                        isPlaying: parsed.isPlaying,
                        progress: parsed.progress
                    }

                    this.lastInfo = data;

                    this.mainWindow.webContents.send('song-info', data);
                    return;
                }
                if (parsed.command = "requestHandled") {
                    console.log(parsed.command, parsed.data)
                    this.logger.info('Request handled for: ', parsed.data);
                    this.lastReq = parsed.data;
                    return;
                }


            });

            ws.on('close', () => {
                this.clients.delete(ws);
                this.logger.info('Client disconnected');
                this.logger.info(`Total clients connected: ${this.clients.size}`);
            });

            ws.on('error', (error) => {
                this.logger.error('WebSocket Client Error:', error);
                this.clients.delete(ws);
            });
        });

        this.wss.on('error', (error) => {
            this.logger.error('WebSocket Server Error:', error);
        });

        this.logger.info(`WebSocket server started on port ${this.port}`);
    }


    async WSSend(message) {
        this.clients.forEach((client) => {
            client.send(JSON.stringify(message));
        });
    }


}

module.exports = WebSocketServer;
