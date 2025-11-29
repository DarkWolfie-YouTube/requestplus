import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import { app, dialog, BrowserWindow } from 'electron';
import { Settings } from './settingsHandler';

// Type definitions
interface EncryptedData {
    key: string;
    iv: string;
    content: string;
}

interface TwitchValidationResponse {
    client_id: string;
    login: string;
    scopes: string[];
    user_id: string;
    expires_in: number;
}
interface KickValidationResponse {
    data: [{
        id: string;
        name: string;
        email: string;
        profile_picture: string;
    }];
    message: string;
}

interface ValidationResult {
    valid: boolean;
    data?: TwitchValidationResponse | KickValidationResponse;
    error?: string;
}

interface TwitchUser {
    id: string;
    login: string;
    display_name: string;
    profile_image_url: string;
    email?: string;
    type?: string;
    broadcaster_type?: string;
    description?: string;
    created_at?: string;
}

interface KickUser {
    id: string;
    login: string;
    profile_image_url: string;
    email?: string;
    bio?: string;
    verified?: boolean;
}

interface UserDataResult {
    success: boolean;
    user?: TwitchUser | KickUser;
    error?: string;
}

interface TokenData {
    access_token: string;
    refresh_token?: string;
    user_data?: TwitchUser | KickUser;
    client_id?: string;
    scopes?: string[];
    platform: string;
}

interface StoredTokenData {
    id: string;
    login: string;
    email: string | null;
    profile_image_url: string;
    display_name: string;
    expiresAt: number;
    encryptedToken: EncryptedData;
    encryptedRefreshToken?: EncryptedData;
    platform: string;
    scopes?: string[];
}

interface RetrievedTokenData {
    id: string;
    login: string;
    email: string | null;
    profile_image_url: string;
    display_name: string;
    access_token: string;
    refresh_token?: string;
    expiresAt: number;
    scopes: string[];
    platform: string;
}

interface KickTokenRefreshResponse {
    success: boolean;
    token: string;
    error?: string;
}

interface Logger {
    info(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
}

class AuthManager {
    private twitchTokenFilePath: string;
    private kickTokenFilePath: string;
    private logger: Logger;
    private window: BrowserWindow;
    private settings: any;

    constructor(userDataPath: string, logger: Logger, window: BrowserWindow, settings: Settings) {
        this.twitchTokenFilePath = path.join(userDataPath, 'twitch_auth.json');
        this.kickTokenFilePath = path.join(userDataPath, 'kick_auth.json');
        this.logger = logger;
        this.window = window;
        this.settings = settings;
        
    }


    private getTokenFilePath(platform: string): string {
        return platform === 'twitch' ? this.twitchTokenFilePath : this.kickTokenFilePath;
    }

    private encrypt(text: string): EncryptedData {
        const algorithm = 'aes-256-cbc';
        const key = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return {
            key: key.toString('hex'),
            iv: iv.toString('hex'),
            content: encrypted
        };
    }

    private decrypt(encryptedData: string, key: string, iv: string): string {
        const algorithm = 'aes-256-cbc';
        
        const decipher = crypto.createDecipheriv(
            algorithm, 
            Buffer.from(key, 'hex'), 
            Buffer.from(iv, 'hex')
        );
        
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    async validateTwitchToken(token: string): Promise<ValidationResult> {
        try {
            const response = await fetch('https://id.twitch.tv/oauth2/validate', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 200) {
                const data = await response.json() as TwitchValidationResponse;
                return { valid: true, data: data };
            } else {
                return { valid: false, error: `Token validation failed with status ${response.status}` };
            }
        } catch (error) {
            this.logger.error('Twitch token validation error:', error);
            return { valid: false, error: (error as Error).message };
        }
    }

    async validateKickToken(token: string): Promise<ValidationResult> {
        try {
            const response = await fetch('https://api.kick.com/public/v1/users', {
                headers: {
                    'Authorization': `Bearer ${token}`, 
                    'User-Agent': 'Request+/1.2.1 (https://github.com/DarkWolfie-YouTube/requestplus) darkwolfiefiver@gmail.com'
                }
            });

            if (response.status === 200) {
                const data = await response.json() as KickValidationResponse;
                return { valid: true, data: data };
            } else {
                return { valid: false, error: `Token validation failed with status ${response.status}` };
            }
        } catch (error) {
            this.logger.error('Kick token validation error:', error);
            return { valid: false, error: (error as Error).message };
        }
    }

    async validateToken(token: string, platform: string): Promise<ValidationResult> {
        if (platform === 'twitch') {
            return this.validateTwitchToken(token);
        } else {
            return this.validateKickToken(token);
        }
    }

    async getTwitchUserData(token: string, clientId: string): Promise<UserDataResult> {
        try {
            const response = await fetch('https://api.twitch.tv/helix/users', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Client-Id': clientId
                }
            });

            if (response.status === 200) {
                const data = await response.json() as { data: TwitchUser[] };
                return { success: true, user: data.data[0] };
            } else {
                return { success: false, error: `User data fetch failed with status ${response.status}` };
            }
        } catch (error) {
            this.logger.error('Twitch user data fetch error:', error);
            return { success: false, error: (error as Error).message };
        }
    }

    async getKickUserData(token: string): Promise<UserDataResult> {
        try {
            const response = await fetch('https://api.kick.com/public/v1/users', {
                headers: {
                    'Authorization': `Bearer ${token}`, 
                    'User-Agent': 'Request+/1.2.1 (https://github.com/DarkWolfie-YouTube/requestplus) darkwolfiefiver@gmail.com'
                }
            });

            if (response.status === 200) {
                const data = await response.json() as KickUser;
                return { success: true, user: data };
            } else {
                return { success: false, error: `User data fetch failed with status ${response.status}` };
            }
        } catch (error) {
            this.logger.error('Kick user data fetch error:', error);
            return { success: false, error: (error as Error).message };
        }
    }

    async getUserData(token: string, platform: string, clientId?: string): Promise<UserDataResult> {
        if (platform === 'twitch') {
            if (!clientId) {
                return { success: false, error: 'Client ID required for Twitch' };
            }
            return this.getTwitchUserData(token, clientId);
        } else {
            return this.getKickUserData(token);
        }
    }

    private normalizeUserData(userData: TwitchUser | KickUser, platform: string): {
        id: string;
        login: string;
        email: string | null;
        profile_image_url: string;
        display_name: string;
    } {
        if (platform === 'twitch') {
            const twitchUser = userData as TwitchUser;
            return {
                id: twitchUser.id,
                login: twitchUser.login,
                email: twitchUser.email || null,
                profile_image_url: twitchUser.profile_image_url,
                display_name: twitchUser.display_name
            };
        } else {
            const kickUser = userData as KickUser;
            return {
                id: kickUser.id,
                login: kickUser.login,
                email: kickUser.email || null,
                profile_image_url: kickUser.profile_image_url,
                display_name: kickUser.login
            };
        }
    }

    /**
     * Refresh Kick token via API
     */
    async refreshKickToken(userId: string): Promise<TokenData | null> {
        try {
            this.logger.info('Refreshing Kick token via API for user:', userId);
            
            const response = await fetch('https://api.requestplus.xyz/kickTokenRefresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Request+ v1.2.1/release'
                },
                body: JSON.stringify({
                    userId: userId
                })
            });

            if (!response.ok) {
                this.logger.error('Kick token refresh failed. Status:', response.status);
                return null;
            }

            const data = await response.json() as KickTokenRefreshResponse;
            
            if (!data.success || !data.token) {
                this.logger.error('Kick token refresh failed:', data.error || 'No token returned');
                return null;
            }

            this.logger.info('Kick token refreshed successfully');
            var userData = await this.getUserData(data.token, 'kick');
            // Return TokenData format
            return {
                access_token: data.token,
                user_data: userData.success ? userData.user : null,
                platform: 'kick'
            };
        } catch (error) {
            this.logger.error('Error refreshing Kick token:', error);
            return null;
        }
    }

    async saveToken(tokenData: TokenData): Promise<boolean> {
        try {
            this.logger.info(`Saving ${tokenData.platform} token data:`, Object.keys(tokenData));

            // Validate the token first
            const validationResult = await this.validateToken(tokenData.access_token, tokenData.platform);
            if (!validationResult.valid) {
                this.logger.error('Token validation failed:', validationResult.error);
                dialog.showErrorBox('Error', 'Token is invalid! This can be due to no internet or the token is not valid.');
                return false;
            }

            // Get user data if not provided
            let userData = tokenData.user_data;
            if (!userData) {
                const userResult = await this.getUserData(
                    tokenData.access_token, 
                    tokenData.platform,
                    tokenData.client_id
                );
                if (userResult.success) {
                    userData = userResult.user;
                } else {
                    this.logger.error('Failed to get user data:', userResult.error);
                    return false;
                }
            }

            if (!userData) {
                this.logger.error('No user data available');
                return false;
            }

            // Calculate expiration
            let expiresIn: number;
            if (tokenData.platform === 'twitch') {
                const twitchValidation = validationResult.data as TwitchValidationResponse;
                expiresIn = twitchValidation?.expires_in || 3600;
            } else {
                // Kick tokens typically last 30 days
                expiresIn = 30 * 24 * 60 * 60;
            }
            const expiresAt = Date.now() + (expiresIn * 1000);

            // Encrypt the access token
            const encryptedToken = this.encrypt(tokenData.access_token);
            
            // Encrypt refresh token if provided
            let encryptedRefreshToken: EncryptedData | undefined;
            if (tokenData.refresh_token) {
                encryptedRefreshToken = this.encrypt(tokenData.refresh_token);
            }

            // Normalize user data
            const normalizedUser = this.normalizeUserData(userData, tokenData.platform);
            
            // Store the encrypted token and metadata
            const dataToStore: StoredTokenData = {
                ...normalizedUser,
                expiresAt: expiresAt,
                encryptedToken: encryptedToken,
                encryptedRefreshToken: encryptedRefreshToken,
                platform: tokenData.platform,
                scopes: tokenData.scopes
            };

            // Get the appropriate file path
            const tokenFilePath = this.getTokenFilePath(tokenData.platform);

            // Ensure directory exists
            const dir = path.dirname(tokenFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write to file
            fs.writeFileSync(tokenFilePath, JSON.stringify(dataToStore, null, 2));
            this.logger.info(`${tokenData.platform} token saved successfully`);
            
            return true;
        } catch (error) {
            this.logger.error('Error saving token:', (error as Error).message, (error as Error).stack);
            return false;
        }
    }

    async getStoredToken(platform: string): Promise<RetrievedTokenData | null> {
        try {
            const tokenFilePath = this.getTokenFilePath(platform);
            
            // Check if file exists
            
            if (!fs.existsSync(tokenFilePath)) {
                return null;
            }
            
            let tokenData: StoredTokenData;
            try {
                const fileContents = fs.readFileSync(tokenFilePath, 'utf8');
                tokenData = JSON.parse(fileContents);
            } catch (error) {
                this.logger.error(`Error parsing ${platform} token data:`, error);
                return null;
            }

            this.logger.info(`${platform} token data:`, tokenData);

            // Check if token has expired
            if (tokenData.expiresAt < Date.now()) {
                this.logger.warn(`${platform} token has expired! Attempting to refresh...`);
                
                // Try to refresh Kick token if it's expired
                if (platform === 'kick') {
                    const refreshedToken = await this.refreshKickToken(tokenData.id);
                    if (refreshedToken) {
                        const saved = await this.saveToken(refreshedToken);
                        if (saved) {
                            this.logger.info('Successfully refreshed and saved Kick token');
                            // Recursively call getStoredToken to return the new token
                            return await this.getStoredToken(platform);
                        }
                    }
                }
                
                dialog.showErrorBox('Error', `${platform} token has expired! Please re-authenticate.`);
                this.clearToken(platform);
                return null;
            }
            
            // Decrypt the access token
            const accessToken = this.decrypt(
                tokenData.encryptedToken.content,
                tokenData.encryptedToken.key,
                tokenData.encryptedToken.iv
            );

            // Decrypt refresh token if present
            let refreshToken: string | undefined;
            if (tokenData.encryptedRefreshToken) {
                refreshToken = this.decrypt(
                    tokenData.encryptedRefreshToken.content,
                    tokenData.encryptedRefreshToken.key,
                    tokenData.encryptedRefreshToken.iv
                );
            }
            
            // Validate the token
            const validationResult = await this.validateToken(accessToken, platform);
            
            if (!validationResult.valid) {
                this.logger.warn(`Stored ${platform} token is invalid:`, validationResult.error);
                
                // Try to refresh Kick token if validation fails
                if (platform === 'kick') {
                    this.logger.info('Attempting to refresh invalid Kick token...');
                    const refreshedToken = await this.refreshKickToken(tokenData.id);
                    if (refreshedToken) {
                        const saved = await this.saveToken(refreshedToken);
                        if (saved) {
                            this.logger.info('Successfully refreshed and saved Kick token after validation failure');
                            return await this.getStoredToken(platform);
                        }
                    }
                }
                
                this.clearToken(platform);
                return null;
            }

            if (this.settings.telemetryEnabled) {
                await fetch('https://api.requestplus.xyz/registerUser', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Request+ v1.2.1/release'
                    },
                    body: JSON.stringify({
                        userID: tokenData.id,
                        userName: tokenData.login,
                        display_name: tokenData.display_name,
                        platform: platform
                    })
                }).then(res => res.json()).catch(err => {
                    if (err) {
                        this.logger.error('Error registering user:', err);
                    }
                });

                await fetch('https://api.requestplus.xyz/updateLastSeen', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Request+ v1.2.1/release'
                    },
                    body: JSON.stringify({
                        userID: tokenData.id,
                        platform: platform
                    })
                }).then(res => res.json()).catch(err => {
                    if (err) {
                        this.logger.error('Error updating last seen:', err);
                    }
                });
            }

            // Extract scopes
            let scopes: string[] = [];
            if (platform === 'twitch' && validationResult.data) {
                scopes = (validationResult.data as TwitchValidationResponse).scopes || [];
            } else if (tokenData.scopes) {
                scopes = tokenData.scopes;
            }

            return {
                id: tokenData.id,
                login: tokenData.login,
                email: tokenData.email,
                profile_image_url: tokenData.profile_image_url,
                display_name: tokenData.display_name,
                access_token: accessToken,
                refresh_token: refreshToken,
                expiresAt: tokenData.expiresAt,
                scopes: scopes,
                platform: platform
            };
        } catch (error) {
            this.logger.error(`Error retrieving ${platform} token:`, error instanceof Error ? error.stack : JSON.stringify(error));
            return null;
        }
    }

    clearToken(platform: string): boolean {
        try {
            const tokenFilePath = this.getTokenFilePath(platform);
            if (fs.existsSync(tokenFilePath)) {
                fs.unlinkSync(tokenFilePath);
                this.logger.info(`${platform} token cleared successfully`);
            }
            return true;
        } catch (error) {
            this.logger.error(`Error clearing ${platform} token:`, error);
            return false;
        }
    }

    clearAllTokens(): boolean {
        try {
            let success = true;
            success = this.clearToken('twitch') && success;
            success = this.clearToken('kick') && success;
            return success;
        } catch (error) {
            this.logger.error('Error clearing all tokens:', error);
            return false;
        }
    }

    async hasValidToken(platform: string): Promise<boolean> {
        const token = await this.getStoredToken(platform);
        return token !== null;
    }

    async getActivePlatforms(): Promise<string[]> {
        const platforms: string[] = [];

        if (await this.hasValidToken('twitch')) {
            platforms.push('twitch');
        }
        
        if (await this.hasValidToken('kick')) {
            platforms.push('kick');
        }
        
        return platforms;
    }

    async getAllStoredTokens(): Promise<{ twitch: RetrievedTokenData | null; kick: RetrievedTokenData | null }> {
        const [twitchToken, kickToken] = await Promise.all([
            this.getStoredToken('twitch'),
            this.getStoredToken('kick')
        ]);

        return {
            twitch: twitchToken,
            kick: kickToken
        };
    }

    
}

export default AuthManager;
export { TokenData, RetrievedTokenData, UserDataResult, ValidationResult, TwitchUser, KickUser, TwitchValidationResponse, KickValidationResponse, StoredTokenData, EncryptedData };