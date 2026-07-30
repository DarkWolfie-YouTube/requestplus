import type websocket from './websocket';
import type { YTManager } from './ytManager';
import type AMHandler from './amhandler';
import type QueueHandler from './queueHandler';
import type { QueueItem } from './queueHandler';
import type { Settings } from './settingsHandler';

interface WSCommand {
    command: string;
    [key: string]: any;
}

interface Logger {
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
}

/**
 * Dependencies are injected as getters because the underlying managers are not
 * available at construction time — they're assigned during app startup (after
 * auth / platform selection) and `currentTrackId2` mutates as tracks change.
 * Reading them lazily keeps the controller in sync with main.ts's module state.
 */
export interface PlaybackControllerDeps {
    getSettings: () => Settings;
    getWSServer: () => websocket | null;
    getYtManager: () => YTManager | null;
    getAmHandler: () => AMHandler | null;
    getQueueHandler: () => QueueHandler | null;
    getCurrentTrackId2: () => string | null;
    getQueueItemTrackId: (item: QueueItem) => string;
    /** Cached volume (0..1); seeds the relative-volume accumulator. */
    getCurrentVolume: () => number;
    logger: Logger;
}

/**
 * Owns the platform-branching playback logic that used to live inline in each
 * `song-*` IPC handler. Both the IPC handlers and (later) the HTTP control routes
 * call into this single service so the platform switch isn't duplicated.
 */
export class PlaybackController {
    constructor(private deps: PlaybackControllerDeps) {}

    /**
     * Server-side target volume (0..1) for relative adjustments. Reading the
     * player's volume back over /info lags (it's an interval-cached value), so a
     * read-modify-write "volume up" can race a not-yet-reflected change and end
     * up *lower* than the real level. Accumulating from the last commanded target
     * instead guarantees up always increases and down always decreases.
     */
    private volumeTarget: number | null = null;

    private get platform(): string {
        return this.deps.getSettings().platform;
    }

    /** song-play */
    async playPause(): Promise<void> {
        const platform = this.platform;
        const WSServer = this.deps.getWSServer();
        const ytManager = this.deps.getYtManager();
        const amHandler = this.deps.getAmHandler();

        if (platform === 'spotify' && WSServer) {
            WSServer.WSSendToType({ command: 'PlayPause' } as WSCommand, 'spotify');
        } else if (platform === 'youtube' && ytManager) {
            await ytManager.playPause();
        } else if (platform === 'apple' && amHandler) {
            await amHandler.playPause();
        } else if (platform === 'soundcloud' && WSServer) {
            WSServer.WSSendToType({ command: 'PlayPause' } as WSCommand, 'soundcloud');
        }
    }

    /** song-pause (kept identical to the original — also a PlayPause toggle) */
    async pause(): Promise<void> {
        const platform = this.platform;
        const WSServer = this.deps.getWSServer();
        const ytManager = this.deps.getYtManager();
        const amHandler = this.deps.getAmHandler();

        if (platform === 'spotify' && WSServer) {
            WSServer.WSSendToType({ command: 'PlayPause' } as WSCommand, 'spotify');
        } else if (platform === 'youtube' && ytManager) {
            await ytManager.playPause();
        } else if (platform === 'apple' && amHandler) {
            await amHandler.playPause();
        }
    }

    /** song-skip */
    async skip(): Promise<void> {
        const platform = this.platform;
        const WSServer = this.deps.getWSServer();
        const ytManager = this.deps.getYtManager();
        const amHandler = this.deps.getAmHandler();
        const queueHandler = this.deps.getQueueHandler();
        const currentTrackId2 = this.deps.getCurrentTrackId2();
        const getQueueItemTrackId = this.deps.getQueueItemTrackId;
        const Logger = this.deps.logger;

        if (platform === 'spotify' && WSServer) {
            WSServer.WSSendToType({ command: 'Next' } as WSCommand, 'spotify');
        } else if (platform === 'youtube' && ytManager) {
            // Advance to the next request in queue order (skip only the track playing
            // right now). A hard next() jumps straight to YouTube Music's autoplay
            // up-next, which wins the race against our freshly-inserted song. So feed
            // the request, then actively wait until Pear's queue actually shows it as
            // the track right after the current one before calling next(). POST /queue
            // returns before YTM applies the insert, so polling the queue (instead of
            // a blind delay) makes next() reliably land on our request.
            let advanceToNext = true; // empty queue: let YouTube Music advance normally
            if (queueHandler) {
                const nextTrack = queueHandler.getQueue().items.find(
                    item => item.id !== currentTrackId2 && !item.iscurrentlyPlaying
                );
                if (nextTrack) {
                    const videoId = getQueueItemTrackId(nextTrack);
                    if (!nextTrack.isQueued) {
                        const queued = await ytManager.addItemToQueueById(videoId);
                        if (queued) {
                            await queueHandler.setTrackAsQueued(queueHandler.findTrackById(nextTrack.id));
                            Logger.info(`Skip: fed "${nextTrack.title}" to the player`);
                        }
                    }
                    let ready = await ytManager.waitUntilQueuedNext(videoId, 5000);
                    if (!ready) {
                        // The first insert may not have landed; re-feed once and re-check.
                        await ytManager.addItemToQueueById(videoId);
                        ready = await ytManager.waitUntilQueuedNext(videoId, 3000);
                    }
                    // Only advance once our request is actually next. A blind next() on
                    // timeout can fall through to YouTube Music's autoplay/radio — the very
                    // race this guards against — so skip next() and let the user retry.
                    advanceToNext = ready;
                    Logger.info(`Skip: "${nextTrack.title}" ${ready ? 'is now the next track in Pear' : 'did not become next within timeout; not advancing (would risk YouTube radio)'}`);
                }
            }
            if (advanceToNext) {
                await ytManager.next();
            }
        } else if (platform === 'apple' && amHandler) {
            await amHandler.nextTrack();
        } else if (platform === 'soundcloud' && WSServer) {
            WSServer.WSSendToType({ command: 'Next' } as WSCommand, 'soundcloud');
        }
    }

    /** song-previous */
    async previous(): Promise<void> {
        const platform = this.platform;
        const WSServer = this.deps.getWSServer();
        const ytManager = this.deps.getYtManager();
        const amHandler = this.deps.getAmHandler();

        if (platform === 'spotify' && WSServer) {
            WSServer.WSSendToType({ command: 'Prev' } as WSCommand, 'spotify');
        } else if (platform === 'youtube' && ytManager) {
            await ytManager.previous();
        } else if (platform === 'apple' && amHandler) {
            await amHandler.previousTrack();
        } else if (platform === 'soundcloud' && WSServer) {
            WSServer.WSSendToType({ command: 'Prev' } as WSCommand, 'soundcloud');
        }
    }

    /** song-like */
    async like(): Promise<void> {
        const platform = this.platform;
        const WSServer = this.deps.getWSServer();
        const ytManager = this.deps.getYtManager();
        const amHandler = this.deps.getAmHandler();

        if (platform === 'spotify' && WSServer) {
            WSServer.WSSendToType({ command: 'like' } as WSCommand, 'spotify');
        } else if (platform === 'youtube' && ytManager) {
            await ytManager.toggleLike();
        } else if (platform === 'apple' && amHandler) {
            await amHandler.likeSong();
        } else if (platform === 'soundcloud' && WSServer) {
            WSServer.WSSendToType({ command: 'like' } as WSCommand, 'soundcloud');
        }
    }

    /** song-volume */
    async setVolume(level: number): Promise<void> {
        const platform = this.platform;
        const WSServer = this.deps.getWSServer();
        const ytManager = this.deps.getYtManager();
        const amHandler = this.deps.getAmHandler();

        if (platform === 'spotify' && WSServer) {
            WSServer.WSSendToType({ command: 'volume', data: { volume: level } } as WSCommand, 'spotify');
        } else if (platform === 'youtube' && ytManager) {
            await ytManager.setVolume(level * 100);
        } else if (platform === 'apple' && amHandler) {
            await amHandler.setVolume(level);
        } else if (platform === 'soundcloud' && WSServer) {
            WSServer.WSSendToType({ command: 'volume', data: { volume: level } } as WSCommand, 'soundcloud');
        }

        // Keep the accumulator in sync with the last absolute level we commanded.
        this.volumeTarget = Math.min(1, Math.max(0, level));
    }

    /**
     * Relative volume change (delta in -1..1). Accumulates from the last commanded
     * target rather than a laggy read-back, so repeated "up" presses keep rising.
     * Seeds from the freshest available volume on the very first nudge.
     */
    async nudgeVolume(delta: number): Promise<void> {
        // Uniform step on the slider scale. We track our own commanded slider target
        // (which Request+ also displays), so each press moves it by exactly delta —
        // no laggy read-back, no low-end rounding cliff. Seed once from the player's
        // reported volume; on YouTube that report is effective (~slider^2.5), so
        // invert the curve to recover the slider position for a sane first step.
        const seed = Math.min(1, Math.max(0, this.deps.getCurrentVolume()));
        const base = this.volumeTarget ?? (this.platform === 'youtube' ? Math.pow(seed, 1 / 2.5) : seed);
        const target = Math.min(1, Math.max(0, base + delta));
        await this.setVolume(target);
    }

    /** The last slider value we commanded (0..1), or null if we haven't set one this session. */
    getCommandedVolume(): number | null {
        return this.volumeTarget;
    }

    /** song-seek */
    async seek(position: number): Promise<void> {
        const platform = this.platform;
        const WSServer = this.deps.getWSServer();
        const ytManager = this.deps.getYtManager();
        const amHandler = this.deps.getAmHandler();

        if (platform === 'spotify' && WSServer) {
            WSServer.WSSendToType({ command: 'seek', data: { position } } as WSCommand, 'spotify');
        } else if (platform === 'youtube' && ytManager) {
            await ytManager.seek(Math.floor(position / 1000));
        } else if (platform === 'apple' && amHandler) {
            await amHandler.seekTo(position / 1000);
        } else if (platform === 'soundcloud' && WSServer) {
            WSServer.WSSendToType({ command: 'seek', data: { position } } as WSCommand, 'soundcloud');
        }
    }

    /** song-shuffle */
    async shuffle(): Promise<void> {
        const platform = this.platform;
        const WSServer = this.deps.getWSServer();
        const ytManager = this.deps.getYtManager();
        const amHandler = this.deps.getAmHandler();

        if (platform === 'spotify' && WSServer) {
            WSServer.WSSendToType({ command: 'shuffle' } as WSCommand, 'spotify');
        } else if (platform === 'youtube' && ytManager) {
            await ytManager.toggleShuffle();
        } else if (platform === 'apple' && amHandler) {
            await amHandler.setShuffle();
        }
    }

    /** song-repeat */
    async repeat(): Promise<void> {
        const platform = this.platform;
        const WSServer = this.deps.getWSServer();
        const ytManager = this.deps.getYtManager();
        const amHandler = this.deps.getAmHandler();

        if (platform === 'spotify' && WSServer) {
            WSServer.WSSendToType({ command: 'repeat' } as WSCommand, 'spotify');
        } else if (platform === 'youtube' && ytManager) {
            await ytManager.cycleRepeat();
        } else if (platform === 'apple' && amHandler) {
            await amHandler.setRepeat();
        }
    }
}

export default PlaybackController;
