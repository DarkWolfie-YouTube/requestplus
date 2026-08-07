import { Client, type SetActivity } from '@xhayper/discord-rpc';
import type { songInfo } from './playbackHandler';

const DISCORD_APPLICATION_ID = '1491277997549027348';
const REQUEST_PLUS_HOMEPAGE = 'https://requestplus.xyz';
const RECONNECT_DELAY_MS = 15_000;
const SEEK_DRIFT_THRESHOLD_MS = 5_000;

interface PresenceLogger {
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
}

const platformNames: Record<string, string> = {
    spotify: 'Spotify',
    youtube: 'YouTube Music',
    apple: 'Apple Music',
    soundcloud: 'SoundCloud',
    spotube: 'Spotube',
};

function isWebUrl(value: string | undefined): value is string {
    if (!value) return false;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}

function truncate(value: string, length = 128): string {
    return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export class DiscordPresenceManager {
    private client: Client | null = null;
    private enabled = false;
    private connecting = false;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private latestSong: songInfo | null = null;
    private latestPlatform = '';
    private activityIsSet = false;
    private refreshing = false;
    private refreshAgain = false;
    private lastSignature = '';
    private lastPublishedProgress = 0;
    private lastPublishedAt = 0;

    constructor(private readonly logger: PresenceLogger) {}

    setEnabled(enabled: boolean): void {
        if (this.enabled === enabled) return;
        this.enabled = enabled;
        this.resetPublishedState();

        if (enabled) {
            this.ensureConnected();
        } else {
            void this.disconnect(true);
        }
    }

    update(song: songInfo | null, platform: string): void {
        this.latestSong = song;
        this.latestPlatform = platform;
        if (!this.enabled) return;

        if (!this.client?.isConnected) {
            this.ensureConnected();
            return;
        }

        void this.refresh();
    }

    async shutdown(): Promise<void> {
        this.enabled = false;
        await this.disconnect(true);
    }

    private ensureConnected(): void {
        if (!this.enabled || this.connecting || this.client?.isConnected) return;

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.connecting = true;
        const client = new Client({ clientId: DISCORD_APPLICATION_ID });
        this.client = client;

        client.on('ready', () => {
            if (this.client !== client) return;
            this.connecting = false;
            this.logger.info('Discord Rich Presence connected');
            void this.refresh();
        });

        client.on('disconnected', () => {
            if (this.client !== client) return;
            this.client = null;
            this.connecting = false;
            this.activityIsSet = false;
            this.resetPublishedState();
            this.logger.info('Discord Rich Presence disconnected');
            this.scheduleReconnect();
        });

        void client.login().catch(async (error: unknown) => {
            if (this.client !== client) return;
            this.client = null;
            this.connecting = false;
            this.logger.warn('Discord Rich Presence is unavailable; retrying when Discord is running', error);
            try {
                await client.destroy();
            } catch {
                // The transport was never connected.
            }
            this.scheduleReconnect();
        });
    }

    private scheduleReconnect(): void {
        if (!this.enabled || this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.ensureConnected();
        }, RECONNECT_DELAY_MS);
        this.reconnectTimer.unref?.();
    }

    private async disconnect(clearActivity: boolean): Promise<void> {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        const client = this.client;
        this.client = null;
        this.connecting = false;

        if (!client) return;
        try {
            if (clearActivity && client.isConnected && client.user) {
                await client.user.clearActivity();
            }
        } catch (error) {
            this.logger.warn('Could not clear Discord Rich Presence', error);
        }

        try {
            await client.destroy();
        } catch {
            // Closing an already-disconnected IPC transport is harmless.
        }
        this.activityIsSet = false;
    }

    private async refresh(): Promise<void> {
        if (this.refreshing) {
            this.refreshAgain = true;
            return;
        }

        this.refreshing = true;
        try {
            do {
                this.refreshAgain = false;
                await this.refreshOnce();
            } while (this.refreshAgain);
        } finally {
            this.refreshing = false;
        }
    }

    private async refreshOnce(): Promise<void> {
        const client = this.client;
        const song = this.latestSong;
        if (!this.enabled || !client?.isConnected || !client.user) return;

        if (!song?.isPlaying || !song.title) {
            if (this.activityIsSet) {
                await client.user.clearActivity();
                this.activityIsSet = false;
                this.resetPublishedState();
            }
            return;
        }

        const signature = [
            song.id,
            song.title,
            song.artist,
            song.album,
            song.cover,
            song.duration,
            song.songUrl,
            this.latestPlatform,
        ].join('\u0000');

        const now = Date.now();
        const expectedProgress = this.lastPublishedProgress + (now - this.lastPublishedAt);
        const seeked = this.lastPublishedAt > 0 && Math.abs(song.progress - expectedProgress) >= SEEK_DRIFT_THRESHOLD_MS;
        if (signature === this.lastSignature && !seeked) return;

        const activity = this.buildActivity(song, this.latestPlatform, now);
        try {
            await client.user.setActivity(activity);
            this.activityIsSet = true;
            this.lastSignature = signature;
            this.lastPublishedProgress = Math.max(0, song.progress || 0);
            this.lastPublishedAt = now;
            this.logger.info(
                `Discord Rich Presence updated: ${song.title} (${activity.largeImageKey ? 'album artwork' : 'application artwork fallback'})`
            );
        } catch (error) {
            this.logger.warn('Could not update Discord Rich Presence', error);
        }
    }

    private buildActivity(song: songInfo, platform: string, now: number): SetActivity {
        const platformName = platformNames[platform] || platform || 'Music';
        const artists = song.artist || 'Unknown Artist';
        const state = truncate(`${artists} • ${platformName}`);
        const songUrl = isWebUrl(song.songUrl) ? song.songUrl : '';
        const cover = isWebUrl(song.cover) ? song.cover : '';
        const duration = Math.max(0, song.duration || 0);
        const progress = Math.min(duration || Number.MAX_SAFE_INTEGER, Math.max(0, song.progress || 0));

        const activity: SetActivity = {
            name: 'Request+',
            type: 2,
            details: truncate(song.title),
            state,
            statusDisplayType: 0,
            buttons: [
                ...(songUrl ? [{ label: 'Listen to Song', url: songUrl }] : []),
                { label: 'Request+ Homepage', url: REQUEST_PLUS_HOMEPAGE },
            ],
        };

        if (duration > 0) {
            activity.startTimestamp = now - progress;
            activity.endTimestamp = now + Math.max(0, duration - progress);
        }

        if (cover) {
            activity.largeImageKey = cover;
            activity.largeImageText = truncate(song.album || song.title);
            if (songUrl) activity.largeImageUrl = songUrl;
        }

        return activity;
    }

    private resetPublishedState(): void {
        this.lastSignature = '';
        this.lastPublishedProgress = 0;
        this.lastPublishedAt = 0;
    }
}
