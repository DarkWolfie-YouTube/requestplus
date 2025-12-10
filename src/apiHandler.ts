import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { Settings } from './settingsHandler';
import * as path from 'path';
import { BrowserWindow } from 'electron';
import PlaybackHandler from './playbackHandler';

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
    platform: string;
    verifier?: string;
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
    private playbackHandler: PlaybackHandler;
    private logger: Logger;
    private theme: string;
    private refresh: boolean;
    private callback: any;
    public hideSongFromView: boolean = false;

    constructor(
        mainWindow: BrowserWindow, 
        playbackHandler: PlaybackHandler, 
        logger: Logger, 
        settings: Settings, 
        callback: any
    ) {
        this.app = express();
        this.mainWindow = mainWindow;
        this.playbackHandler = playbackHandler;
        this.logger = logger;
        this.theme = settings.theme;
        this.refresh = null;
        this.callback = callback;
        this.hideSongFromView = false;
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
                                    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Request+/1.2.2 (https://github.com/DarkWolfie-YouTube/requestplus) darkwolfiefiver@gmail.com'},
                                    body: JSON.stringify({
                                        access_token: accessToken,
                                        token_type: tokenType,
                                        scope: scope
                                    })
                                })
                                .then(response => response.json())
                                .then(data => {
                                    if (data.success) {
                                        window.location.href = '/success?platform=twitch';
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
                    
                    <p id="message">Your account is connected to Request+! You can now receive song requests from your viewers during streams.</p>
                    
                </div>
                
                <script>



                    function getQueryParam(param) {
                        const urlParams = new URLSearchParams(window.location.search);
                        return urlParams.get(param);
                    }

                    const platformMessages = {
                        'twitch': {
                            message: 'Your Twitch account is connected to Request+! You can now receive song requests from your viewers during streams.'
                            },
                        'youtube': {
                            message: 'Your YouTube account is connected to Request+! You can now receive song requests from your viewers during streams.'
                            },
                        'kick': {
                            message: 'Your Kick account is connected to Request+! You can now receive song requests from your viewers during streams.'
                            }
                    };
                    function initializePage() {
                        const platformType = getQueryParam('platform') || 'unknown';
                        const platformMessageEl = document.getElementById('message');

                        if (platformMessages[platformType]) {
                            platformMessageEl.textContent = platformMessages[platformType].message;
                        } else {
                            platformMessageEl.textContent = 'Your account is connected to Request+! You can now receive song requests from your viewers during streams.';
                        }
                    }
                    

                    initializePage();
                
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
                            'Authorization': `Bearer ${access_token}`,
                            'User-Agent': 'Request+/1.2.2 (https://github.com/DarkWolfie-YouTube/requestplus) darkwolfiefiver@gmail.com'
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
                        scopes: TWITCH_SCOPES,
                        platform: 'twitch'

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
                res.json({ ...this.playbackHandler.currentSong, refresh: this.refresh });
                this.refresh = false;
                return;
            }
            if (this.hideSongFromView) {
                res.json({ songHidden: true, gtsActive: true });
                return;
            };
            res.json(this.playbackHandler.currentSong);
        });

        this.app.get("/settings", (req: Request, res: Response): void => {
            res.json({ theme: this.theme });
        });
        

        this.app.get('/error', (req: Request, res: Response): void => {
            var errorHTML = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Connection Failed - Request+</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: linear-gradient(135deg, oklch(0.145 0 0) 0%, oklch(0.2 0.1 0) 100%);
                        color: oklch(0.985 0 0);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                    }
                    .container { text-align: center; padding: 2rem; max-width: 500px; width: 90%; }
                    .error-icon {
                        width: 80px; height: 80px; margin: 0 auto 2rem;
                        background: oklch(0.55 0.25 30); border-radius: 50%;
                        display: flex; align-items: center; justify-content: center;
                        animation: scaleIn 0.5s ease-out;
                        box-shadow: 0 10px 30px rgba(239, 68, 68, 0.3);
                    }
                    .error-x {
                        width: 40px; height: 40px; stroke: white; stroke-width: 3; fill: none;
                        animation: drawX 0.8s ease-out 0.3s both;
                    }
                    h1 {
                        font-size: 2rem; font-weight: 600; margin-bottom: 1rem;
                        color: oklch(0.985 0 0); animation: fadeInUp 0.6s ease-out 0.2s both;
                    }
                    .error-code {
                        display: inline-block;
                        background: oklch(0.3 0.1 30);
                        color: oklch(0.7 0.2 30);
                        padding: 0.5rem 1rem;
                        border-radius: 6px;
                        font-family: 'Courier New', monospace;
                        font-size: 0.9rem;
                        margin-bottom: 1.5rem;
                        animation: fadeInUp 0.6s ease-out 0.3s both;
                    }
                    p {
                        font-size: 1.1rem; color: oklch(0.8 0.05 30); margin-bottom: 2rem;
                        line-height: 1.6; animation: fadeInUp 0.6s ease-out 0.4s both;
                    }
                    .button-group {
                        display: flex;
                        gap: 1rem;
                        justify-content: center;
                        flex-wrap: wrap;
                        animation: fadeInUp 0.6s ease-out 0.6s both;
                    }
                    .button {
                        border: none;
                        padding: 1rem 2rem; border-radius: 8px; font-size: 1rem; font-weight: 500;
                        cursor: pointer; transition: all 0.3s ease;
                        text-decoration: none;
                        display: inline-block;
                    }
                    .retry-button {
                        background: oklch(0.6 0.3 280); color: white;
                        box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
                    }
                    .retry-button:hover {
                        background: oklch(0.7 0.35 280); transform: translateY(-2px);
                        box-shadow: 0 8px 25px rgba(139, 92, 246, 0.4);
                    }
                    .close-button {
                        background: oklch(0.3 0.05 30); color: oklch(0.8 0.05 30);
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                    }
                    .close-button:hover {
                        background: oklch(0.35 0.05 30); transform: translateY(-2px);
                        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
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
                        background: linear-gradient(45deg, oklch(0.55 0.25 30), oklch(0.5 0.2 0));
                        opacity: 0.08; animation: float 6s ease-in-out infinite;
                    }
                    .shape:nth-child(1) { width: 100px; height: 100px; top: 20%; left: 10%; animation-delay: 0s; }
                    .shape:nth-child(2) { width: 60px; height: 60px; top: 60%; right: 15%; animation-delay: 2s; }
                    .shape:nth-child(3) { width: 80px; height: 80px; bottom: 20%; left: 20%; animation-delay: 4s; }
                    
                    @keyframes scaleIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                    @keyframes drawX { 
                        from { stroke-dasharray: 0 100; } 
                        to { stroke-dasharray: 100 100; } 
                    }
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
                    <div class="error-icon">
                        <svg class="error-x" viewBox="0 0 52 52">
                            <path d="M16 16l20 20M36 16l-20 20" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    
                    <h1>Connection Failed</h1>
                    
                    <div class="error-code" id="errorCode">Error: Unknown</div>
                    
                    <p id="errorMessage">We couldn't connect your Kick account. Please try again or contact support if the problem persists.</p>
                    
                    <div class="button-group">
                        <button class="button retry-button" onclick="retryConnection()">Try Again</button>
                        <button class="button close-button" onclick="closeWindow()">Close Window</button>
                    </div>
                </div>
                
                <script>
                    const errorMessages = {
                        'kinvalid_response': {
                            title: 'Invalid Response',
                            message: 'Kick returned an invalid response. This might be a temporary issue. Please try connecting again.'
                        },
                        'tinvalid_response': {
                            title: 'Invalid Response',
                            message: 'Twitch returned an invalid response. This might be a temporary issue. Please try connecting again.'
                        },
                        'access_denied': {
                            title: 'Access Denied',
                            message: 'Authorization was denied. Please make sure to approve the connection when prompted by Kick.'
                        },
                        'invalid_grant': {
                            title: 'Invalid Grant',
                            message: 'The authorization code is invalid or has expired. Please try connecting again.'
                        },
                        'server_error': {
                            title: 'Server Error',
                            message: "The application couldn't complete the request due to a server error. Please try again later."
                        },
                        'kserver_error': {
                            title: 'Server Error',
                            message: "Kick's servers encountered an error. Please try again in a few moments."
                        }, 
                        'tserver_error': {
                            title: 'Server Error',
                            message: "Twitch's servers encountered an error. Please try again in a few moments."
                        },
                        'invalid_token': {
                            title: 'Invalid Token',
                            message: 'The access token received is invalid. Please try connecting your account again.'
                        },
                        'kinvalid_token': {
                            title: 'Invalid Token',
                            message: 'The access token received is invalid. Please try connecting your account again.'
                        }
                    };

                    function getQueryParam(param) {
                        const urlParams = new URLSearchParams(window.location.search);
                        return urlParams.get(param);
                    }

                    function initializePage() {
                        const errorType = getQueryParam('error') || 'unknown';
                        const errorCodeEl = document.getElementById('errorCode');
                        const errorMessageEl = document.getElementById('errorMessage');

                        if (errorMessages[errorType]) {
                            errorCodeEl.textContent = \`Error: \${errorMessages[errorType].title}\`;
                            errorMessageEl.textContent = errorMessages[errorType].message;
                        } else {
                            errorCodeEl.textContent = \`Error: \${errorType}\`;
                            errorMessageEl.textContent = 'An unexpected error occurred while connecting your Kick account. Please try again.';
                        }
                    }

                    function retryConnection() {
                        var state = getQueryParam('state');
                        window.location.href = 'https://api.requestplus.xyz/kcallback?state=' + state;
                    }
                    initializePage();
                </script>
            </body>
            </html>`;   
            res.send(errorHTML);
        });

        this.app.get('/kickdone', async (req: Request, res: Response): Promise<void> => {
            const { token, userID, verifier } = req.query;

            const response = await fetch('https://api.kick.com/public/v1/users', {
                headers: {
                    'Authorization': `Bearer ${token}`, 
                    'User-Agent': 'Request+/1.2.2 (https://github.com/DarkWolfie-YouTube/requestplus) darkwolfiefiver@gmail.com'
                }
            });
            const data = await response.json();
            var kickuser: TokenData = {
                access_token: token as string,
                user_data: {
                    id: userID as string,
                    login: data.data[0].name,
                    profile_image_url: data.data[0].profile_picture,
                    email: data.data[0].email || '',
                    display_name: data.data[0].name  
                },
                scopes: ['user:read', 'event:subscribe', 'chat:write'],
                platform: 'kick',
                verifier: verifier as string
            };
            this.mainWindow.webContents.send('kick-auth-success', kickuser.user_data);

            if (this.callback) {
                try {
                    const result = await this.callback(kickuser);
                    if (result) {
                        res.redirect(`http://localhost:444/success?platform=kick`);
                    } else {
                        res.redirect(`http://localhost:444/error?error=kinvalid_token`);
                    }
                } catch (error) {
                    console.error('Callback error:', error);
                    res.redirect(`http://localhost:444/error?error=server_error`);
                }
            } else {
                res.redirect(`http://localhost:444/error?error=server_error`);
            }




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
    public gtsHideSongFromView(): void {
        this.hideSongFromView = true;
    }
    public gtsShowSongInView(): void {
        this.hideSongFromView = false;
    }
}

export default APIHandler;
export { TwitchUser, TokenData };