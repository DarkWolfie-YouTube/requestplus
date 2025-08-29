import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import { app, dialog, BrowserWindow } from 'electron';

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

interface ValidationResult {
    valid: boolean;
    data?: TwitchValidationResponse;
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

interface UserDataResult {
    success: boolean;
    user?: TwitchUser;
    error?: string;
}

interface TokenData {
    access_token: string;
    user_data?: TwitchUser;
    client_id?: string;
    scopes?: string[];
}

interface StoredTokenData {
    id: string;
    login: string;
    email: string | null;
    profile_image_url: string;
    display_name: string;
    expiresAt: number;
    encryptedToken: EncryptedData;
}

interface RetrievedTokenData {
    id: string;
    login: string;
    email: string | null;
    profile_image_url: string;
    display_name: string;
    access_token: string;
    expiresAt: number;
    scopes: string[];
}

interface Logger {
    info(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
}

class AuthManager {
    private tokenFilePath: string;
    private logger: Logger;
    private window: BrowserWindow;

    constructor(userDataPath: string, logger: Logger, window: BrowserWindow) {
        this.tokenFilePath = path.join(userDataPath, 'twitch_auth.json');
        this.logger = logger;
        this.window = window;
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

    async validateToken(token: string): Promise<ValidationResult> {
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
            this.logger.error('Token validation error:', error);
            return { valid: false, error: (error as Error).message };
        }
    }

    // Get user data from Twitch API
    async getUserData(token: string, clientId: string): Promise<UserDataResult> {
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
            this.logger.error('User data fetch error:', error);
            return { success: false, error: (error as Error).message };
        }
    }

    async saveToken(tokenData: TokenData): Promise<boolean> {
        try {
            this.logger.info('Saving token data:', Object.keys(tokenData));

            // Validate the token first
            const validationResult = await this.validateToken(tokenData.access_token);
            if (!validationResult.valid) {
                this.logger.error('Token validation failed:', validationResult.error);
                dialog.showErrorBox('Error', 'Token is invalid! This can be due to no internet or the token is not valid.');
                return false;
            }

            // Get user data if not provided
            let userData = tokenData.user_data;
            if (!userData && tokenData.client_id) {
                const userResult = await this.getUserData(tokenData.access_token, tokenData.client_id);
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

            // Calculate expiration (Twitch tokens typically last 60 days, but validation response has expires_in)
            const expiresIn = validationResult.data?.expires_in || 3600; // Default to 1 hour if not specified
            const expiresAt = Date.now() + (expiresIn * 1000);

            // Encrypt the access token
            const encryptedToken = this.encrypt(tokenData.access_token);
            
            // Store the encrypted token and metadata
            const dataToStore: StoredTokenData = {
                id: userData.id,
                login: userData.login,
                email: userData.email || null,
                profile_image_url: userData.profile_image_url,
                display_name: userData.display_name,
                expiresAt: expiresAt,
                encryptedToken: encryptedToken
            };

            // Ensure directory exists
            const dir = path.dirname(this.tokenFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write to file
            fs.writeFileSync(this.tokenFilePath, JSON.stringify(dataToStore, null, 2));
            this.logger.info('Token saved successfully');
            
            return true;
        } catch (error) {
            this.logger.error('Error saving token:', (error as Error).message, (error as Error).stack);
            return false;
        }
    }

    async getStoredToken(): Promise<RetrievedTokenData | null> {
        try {
            
            if (!fs.existsSync(this.tokenFilePath)) {
                return null;
            }
            
            const tokenData: StoredTokenData = JSON.parse(fs.readFileSync(this.tokenFilePath, 'utf8'));

            // Check if token has expired
            if (tokenData.expiresAt < Date.now()) {
                console.log('Token has expired! Please re-authenticate.');
                this.logger.warn('Token has expired! Please re-authenticate.');
                dialog.showErrorBox('Error', 'Token has expired! Please re-authenticate.');
                this.clearToken();
                return null;
            }
            
            // Decrypt the access token
            const accessToken = this.decrypt(
                tokenData.encryptedToken.content,
                tokenData.encryptedToken.key,
                tokenData.encryptedToken.iv
            );
            
            
            // Validate the token
            const validationResult = await this.validateToken(accessToken);
            
            if (!validationResult.valid) {
                this.logger.warn('Stored token is invalid:', validationResult.error);
                this.clearToken();
                return null;
            }
           
            
            return {
                id: tokenData.id,
                login: tokenData.login,
                email: tokenData.email,
                profile_image_url: tokenData.profile_image_url,
                display_name: tokenData.display_name,
                access_token: accessToken,
                expiresAt: tokenData.expiresAt,
                scopes: validationResult.data?.scopes || []
            };
        } catch (error) {
            this.logger.error('Error retrieving token:', error);
            return null;
        }
    }

    clearToken(): boolean {
        try {
            if (fs.existsSync(this.tokenFilePath)) {
                fs.unlinkSync(this.tokenFilePath);
            }
            return true;
        } catch (error) {
            this.logger.error('Error clearing token:', error);
            return false;
        }
    }

    async hasValidToken(): Promise<boolean> {
        const token = await this.getStoredToken();
        return token !== null;
    }
}

export default AuthManager;