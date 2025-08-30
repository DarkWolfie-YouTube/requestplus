import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { Settings } from './settingsHandler';
import * as path from 'path';
import { BrowserWindow } from 'electron';

// Type definitions
interface TwitchUser {
    id: string;
    login: string;
    display_name: string;
    profile_image_url: string;
    email: string;
}

interface TwitchApiResponse {
    data: TwitchUser[];
}

interface AuthTokenRequest {
    access_token: string;
    token_type: string;
    scope: string;
}

interface TokenData {
    access_token: string;
    user_data: {
        id: string;
        login: string;
        display_name: string;
        profile_image_url: string;
        email: string;
    };
    scopes: string[];
}

interface WSServerInterface {
    lastInfo: any;
    WSSend(message: any): void;
}

interface Logger {
    info(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
}



let twitchUser: TwitchUser | null = null;
const TWITCH_SCOPES: string[] = ['user:read:email', 'chat:read', 'chat:edit'];

class APIHandler {
    private app: Express;
    private mainWindow: BrowserWindow;
    private WSServer: WSServerInterface;
    private logger: Logger;
    private theme: string;
    private refresh: boolean;
    private callback: any;

    constructor(
        mainWindow: BrowserWindow, 
        WSServer: WSServerInterface, 
        logger: Logger, 
        settings: Settings, 
        callback: any
    ) {
        this.app = express();
        this.mainWindow = mainWindow;
        this.WSServer = WSServer;
        this.logger = logger;
        this.theme = settings.theme;
        this.refresh = null;
        this.callback = callback;

        this.setupMiddleware();
        this.setupRoutes();
        this.startServer();
    }

    private setupMiddleware(): void {
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(cors({
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));
    }

    private setupRoutes(): void {
        // Serve a simple HTML page that can extract the hash fragment
        this.app.get("/", (req: Request, res: Response): void => {
            const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Request+ Authentication</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: linear-gradient(135deg, oklch(0.145 0 0) 0%, oklch(0.2 0.1 280) 100%);
                        color: oklch(0.985 0 0);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                    }
                    .container { text-align: center; padding: 2rem; max-width: 400px; width: 90%; }
                    .brand { position: absolute; top: 2rem; left: 2rem; font-size: 1.2rem; font-weight: 600; opacity: 0.8; }
                    .loading-icon {
                        width: 80px; height: 80px; margin: 0 auto 2rem;
                        background: oklch(0.6 0.3 280); border-radius: 50%;
                        display: flex; align-items: center; justify-content: center;
                        animation: pulse 2s infinite;
                    }
                    h1 { font-size: 2rem; font-weight: 600; margin-bottom: 1rem; }
                    p { font-size: 1.1rem; color: oklch(0.8 0.05 270); margin-bottom: 2rem; line-height: 1.5; }
                    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                </style>
            </head>
            <body>
                <div class="brand">Request+</div>
                <div class="container">
                    <div class="loading-icon">🔗</div>
                    <h1 id="title">Connecting Account...</h1>
                    <p id="message">Processing your Twitch authentication</p>
                </div>
                
                <script>
                    function extractTokenFromHash() {
                        const hash = window.location.hash.substring(1);
                        if (hash) {
                            const params = new URLSearchParams(hash);
                            const accessToken = params.get('access_token');
                            const tokenType = params.get('token_type');
                            const scope = params.get('scope');
                            
                            if (accessToken) {
                                fetch('/auth/token', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        access_token: accessToken,
                                        token_type: tokenType,
                                        scope: scope
                                    })
                                })
                                .then(response => response.json())
                                .then(data => {
                                    if (data.success) {
                                        window.location.href = '/success';
                                    } else {
                                        document.getElementById('title').textContent = 'Authentication Failed';
                                        document.getElementById('message').textContent = data.message || 'Please try again';
                                    }
                                })
                                .catch(error => {
                                    document.getElementById('title').textContent = 'Connection Error';
                                    document.getElementById('message').textContent = 'Failed to connect to server';
                                });
                            } else {
                                document.getElementById('title').textContent = 'No Token Found';
                                document.getElementById('message').textContent = 'Authentication data missing from URL';
                            }
                        } else {
                            document.getElementById('title').textContent = 'Invalid Request';
                            document.getElementById('message').textContent = 'No authentication data received';
                        }
                    }
                    
                    window.addEventListener('load', extractTokenFromHash);
                </script>
            </body>
            </html>`;
            
            res.send(html);
        });

        // Success page - served when token is valid
        this.app.get("/success", (req: Request, res: Response): void => {
            const successHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Account Linked - Request+</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: linear-gradient(135deg, oklch(0.145 0 0) 0%, oklch(0.2 0.1 280) 100%);
                        color: oklch(0.985 0 0);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                    }
                    .container { text-align: center; padding: 2rem; max-width: 400px; width: 90%; }
                    .success-icon {
                        width: 80px; height: 80px; margin: 0 auto 2rem;
                        background: oklch(0.6 0.25 140); border-radius: 50%;
                        display: flex; align-items: center; justify-content: center;
                        animation: scaleIn 0.5s ease-out;
                        box-shadow: 0 10px 30px rgba(34, 197, 94, 0.3);
                    }
                    .checkmark {
                        width: 40px; height: 40px; stroke: white; stroke-width: 3; fill: none;
                        animation: drawCheckmark 0.8s ease-out 0.3s both;
                    }
                    h1 {
                        font-size: 2rem; font-weight: 600; margin-bottom: 1rem;
                        color: oklch(0.985 0 0); animation: fadeInUp 0.6s ease-out 0.2s both;
                    }
                    p {
                        font-size: 1.1rem; color: oklch(0.8 0.05 270); margin-bottom: 2rem;
                        line-height: 1.5; animation: fadeInUp 0.6s ease-out 0.4s both;
                    }
                    .close-button {
                        background: oklch(0.6 0.3 280); color: white; border: none;
                        padding: 1rem 2rem; border-radius: 8px; font-size: 1rem; font-weight: 500;
                        cursor: pointer; transition: all 0.3s ease;
                        animation: fadeInUp 0.6s ease-out 0.6s both;
                        box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
                    }
                    .close-button:hover {
                        background: oklch(0.7 0.35 280); transform: translateY(-2px);
                        box-shadow: 0 8px 25px rgba(139, 92, 246, 0.4);
                    }
                    .brand {
                        position: absolute; top: 2rem; left: 2rem; font-size: 1.2rem;
                        font-weight: 600; color: oklch(0.985 0 0); opacity: 0.8;
                    }
                    .floating-shapes {
                        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                        pointer-events: none; overflow: hidden; z-index: -1;
                    }
                    .shape {
                        position: absolute; border-radius: 50%;
                        background: linear-gradient(45deg, oklch(0.6 0.3 280), oklch(0.6 0.2 180));
                        opacity: 0.1; animation: float 6s ease-in-out infinite;
                    }
                    .shape:nth-child(1) { width: 100px; height: 100px; top: 20%; left: 10%; animation-delay: 0s; }
                    .shape:nth-child(2) { width: 60px; height: 60px; top: 60%; right: 15%; animation-delay: 2s; }
                    .shape:nth-child(3) { width: 80px; height: 80px; bottom: 20%; left: 20%; animation-delay: 4s; }
                    
                    @keyframes scaleIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                    @keyframes drawCheckmark { from { stroke-dasharray: 0 100; } to { stroke-dasharray: 100 100; } }
                    @keyframes float { 0%, 100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-20px) rotate(180deg); } }
                </style>
            </head>
            <body>
                <div class="floating-shapes">
                    <div class="shape"></div>
                    <div class="shape"></div>
                    <div class="shape"></div>
                </div>
                
                <div class="brand">Request+</div>
                
                <div class="container">
                    <div class="success-icon">
                        <svg class="checkmark" viewBox="0 0 52 52">
                            <path d="M14 27l8 8L38 19" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    
                    <h1>Account Linked Successfully!</h1>
                    
                    <p>Your Twitch account has been connected to Request+. You can now receive song requests from your viewers during streams.</p>
                    
                    <button class="close-button" onclick="closeWindow()">Close Window</button>
                </div>
                
                <script>
                    function closeWindow() {
                        if (window.electronAPI && window.electronAPI.close) {
                            window.electronAPI.close();
                        } else if (window.api && window.api.close) {
                            window.api.close();
                        } else {
                            window.close();
                        }
                    }
                    
                    setTimeout(() => closeWindow(), 10000);
                    
                    document.addEventListener('keydown', (event) => {
                        if (event.key === 'Escape') closeWindow();
                    });
                </script>
            </body>
            </html>`;
            
            res.send(successHtml);
        });

        // New endpoint to receive the extracted token
        this.app.post("/auth/token", async (req: Request, res: Response): Promise<void> => {
            const { access_token, token_type, scope }: AuthTokenRequest = req.body;
            
            if (access_token) {
                this.logger.info('Received access token:', access_token.substring(0, 10) + '...');
                
                try {
                    const response = await fetch('https://api.twitch.tv/helix/users', {
                        headers: {
                            'Client-ID': "if6usvbqj58fwdbycnu6v77jjsluq5",
                            'Authorization': `Bearer ${access_token}`
                        }
                    });
                    const data: TwitchApiResponse = await response.json();
                    twitchUser = data.data[0];
                    this.mainWindow.webContents.send('twitch-auth-success', twitchUser);

                    // Save token to file
                    const tokenData: TokenData = {
                        access_token: access_token,
                        user_data: {
                            id: twitchUser.id,
                            login: twitchUser.login,
                            display_name: twitchUser.display_name,
                            profile_image_url: twitchUser.profile_image_url,
                            email: twitchUser.email,
                        },
                        scopes: TWITCH_SCOPES
                    };
                    
                    // Call your callback with the token
                    if (this.callback) {
                        try {
                            const result = await this.callback(tokenData);
                            if (result) {
                                res.json({ success: true, message: 'Token received successfully' });
                            } else {
                                res.json({ success: false, message: 'Invalid token' });
                            }
                        } catch (error) {
                            console.error('Callback error:', error);
                            res.status(500).json({ success: false, message: 'Server error' });
                        }
                    } else {
                        res.status(500).json({ success: false, message: 'No callback configured' });
                    }
                } catch (error) {
                    this.logger.error('Error fetching user data:', error);
                    res.status(500).json({ success: false, message: 'Failed to fetch user data' });
                }
            } else {
                this.logger.error('No access token received');
                res.status(400).json({ success: false, message: 'No access token provided' });
            }
        });

        this.app.get("/info", (req: Request, res: Response): void => {
            if (this.refresh) {
                res.json({ ...this.WSServer.lastInfo, refresh: this.refresh });
                this.refresh = false;
                return;
            }
            res.json(this.WSServer.lastInfo);
        });

        this.app.get("/settings", (req: Request, res: Response): void => {
            res.json({ theme: this.theme });
        });
    }

    private startServer(): void {
        this.app.listen(444, () => {
            this.logger.info('API server listening on port 444');
        });
    }

    public updateSettings(settings: Settings): void {
        this.theme = settings.theme;
        this.refresh = true;
    }
}

export default APIHandler;