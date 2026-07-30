import Logger from './logger';
import { BrowserWindow } from 'electron';
import WebSocketServer from './websocket';
import { Settings } from './settingsHandler';

interface QueueItem {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
    requestedBy: string;
    platform: string;
    iscurrentlyPlaying: boolean;
    isQueued?: boolean; // Track if item has been added to Spotify queue
    cover?: string;
    [key: string]: any;
}

interface Queue {
    items: QueueItem[];
    currentCount: number;
    currentlyPlayingIndex: number;
    [key: string]: any;
}

class QueueHandler {
    public queue: Queue = {
        items: [],
        currentCount: 0,
        currentlyPlayingIndex: -1
    };
    private logger: Logger;
    private mainWindow: BrowserWindow;
    private settings: Settings;
    
    constructor(logger: Logger, mainWindow: BrowserWindow, settings: Settings) {
        this.logger = logger;
        this.mainWindow = mainWindow;
        this.settings = settings;
    }

    async addToQueue(item: QueueItem): Promise<void> {
        // Add a default cover if not provided
        if (!item.cover) {
            item.cover = 'styles/unknown.png';
        }
        
        // Initialize queue-related flags
        item.isQueued = false;
        
        this.queue.items.push(item);
        this.queue.currentCount = this.queue.items.length;
        this.logger.info(`Added to queue: ${item.title} by ${item.artist}`);
        await this.updateQueuePage();
    }

    async removeFromQueue(index: number): Promise<boolean> {
        if (index >= 0 && index < this.queue.items.length) {
            const removedItem = this.queue.items.splice(index, 1)[0];
            this.queue.currentCount = this.queue.items.length;
            console.log(removedItem)
            
            // Adjust currently playing index if needed
            if (this.queue.currentlyPlayingIndex >= index) {
                this.queue.currentlyPlayingIndex--;
                if (this.queue.currentlyPlayingIndex < 0 && this.queue.items.length > 0) {
                    this.queue.currentlyPlayingIndex = -1;
                } else if (this.queue.items.length === 0) {
                    this.queue.currentlyPlayingIndex = -1;
                }
            }
            
            this.logger.info(`Removed from queue: ${removedItem.title} by ${removedItem.artist}`);
            await this.updateQueuePage();
            return true;
        } else {
            this.logger.warn(`Attempted to remove invalid index from queue: ${index}`);
            return false;
        }
    }

    async removeFromQueueByIdOrPosition(idOrPosition: string): Promise<boolean> {
        const trimmed = String(idOrPosition || '').trim();
        if (!trimmed) return false;

        const position = Number.parseInt(trimmed, 10);
        if (Number.isInteger(position) && String(position) === trimmed && position > 0) {
            return this.removeFromQueue(position - 1);
        }

        const index = this.queue.items.findIndex(item => item.id === trimmed);
        return this.removeFromQueue(index);
    }

    async removeFromQueueById(id: string): Promise<boolean> {
        const index = this.queue.items.findIndex(item => item.id === id);
        return this.removeFromQueue(index);
    }

    /**
     * A song is locked once it is playing or has been handed to the player
     * (Spotify/YTM/SoundCloud). At that point the platform queue owns it and
     * reordering it here would only desync the two lists.
     */
    private isLocked(index: number): boolean {
        const item = this.queue.items[index];
        if (!item) return true;
        return Boolean(item.isQueued) || Boolean(item.iscurrentlyPlaying) || index === this.queue.currentlyPlayingIndex;
    }

    /**
     * Move a pending request to another position in the queue.
     *
     * The whole move is rejected (rather than clamped) when it would shift a
     * locked song, so the visible order always matches what will actually play.
     * `expectedId` guards against a stale index: the renderer may send a move
     * that was computed before a new request arrived or another item was removed.
     */
    async moveInQueue(from: number, to: number, expectedId?: string): Promise<boolean> {
        const items = this.queue.items;

        if (!Number.isInteger(from) || !Number.isInteger(to)) {
            this.logger.warn(`Attempted to move queue item with non-integer index: ${from} -> ${to}`);
            return false;
        }

        if (from < 0 || from >= items.length || to < 0 || to >= items.length) {
            this.logger.warn(`Attempted to move queue item out of range: ${from} -> ${to} (size ${items.length})`);
            return false;
        }

        if (expectedId && items[from].id !== expectedId) {
            this.logger.warn(`Queue moved since the move was requested; expected ${expectedId} at index ${from}`);
            return false;
        }

        if (from === to) return true;

        // Everything between source and target shifts by one, so a locked song
        // anywhere in that span (including the source itself) blocks the move.
        const lower = Math.min(from, to);
        const upper = Math.max(from, to);
        for (let i = lower; i <= upper; i++) {
            if (this.isLocked(i)) {
                this.logger.warn(`Cannot move queue item ${from} -> ${to}: "${items[i].title}" is already playing or queued`);
                return false;
            }
        }

        const [movedItem] = items.splice(from, 1);
        items.splice(to, 0, movedItem);
        this.queue.currentCount = items.length;

        // Locked items keep their index by construction, but re-derive the
        // pointer anyway so the queue object stays self-consistent.
        const playingIndex = items.findIndex(item => item.iscurrentlyPlaying);
        if (playingIndex !== -1) {
            this.queue.currentlyPlayingIndex = playingIndex;
        }

        this.logger.info(`Moved in queue: ${movedItem.title} by ${movedItem.artist} (${from + 1} -> ${to + 1})`);
        await this.updateQueuePage();
        return true;
    }

    async clearQueue(): Promise<boolean> {
        try {
            this.queue.items = [];
            this.queue.currentCount = 0;
            this.queue.currentlyPlayingIndex = -1;
            this.logger.info('Queue cleared');
            await this.updateQueuePage();
            return true;
        } catch (error) {
            this.logger.error('Error clearing queue:', error);
            return false;
        }
    }

    async setCurrentlyPlaying(index: number): Promise<void> {
        // Mark all items as not currently playing
        this.queue.items.forEach(item => {
            item.iscurrentlyPlaying = false;
        });
        
        // Mark the specified item as currently playing
        if (index >= 0 && index < this.queue.items.length) {
            this.queue.items[index].iscurrentlyPlaying = true;
            this.queue.currentlyPlayingIndex = index;
            this.logger.info(`Set currently playing: ${this.queue.items[index].title}`);
        } else {
            this.queue.currentlyPlayingIndex = -1;
        }
        
        await this.updateQueuePage();
    }

    async setTrackAsQueued(index: number): Promise<void> {
        if (index >= 0 && index < this.queue.items.length) {
            this.queue.items[index].isQueued = true;
            this.logger.info(`Marked track as queued: ${this.queue.items[index].title}`);
            await this.updateQueuePage();
        }
    }

    // Find track by ID and return its index
    findTrackById(trackId: string): number {
        return this.queue.items.findIndex(item => item.id === trackId);
    }

    // Get the next track that should be auto-queued (first non-queued track)
    getNextTrackToQueue(): QueueItem | null {
        const nextTrack = this.queue.items.find(item => !item.isQueued && !item.iscurrentlyPlaying);
        return nextTrack || null;
    }

    // Check if a track with given ID exists in queue
    hasTrackInQueue(trackId: string): boolean {
        return this.queue.items.some(item => item.id === trackId);
    }

    async updateQueuePage(): Promise<void> {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {

            
            try {
                this.mainWindow.webContents.send('update-queue', this.queue);
            } catch (error) {
                console.error('QueueHandler: Error sending queue update:', error);
            }
        } else {
            console.warn('QueueHandler: Cannot send update - mainWindow is null or destroyed');
        }
    }

    getQueue(): Queue {
        return {
            ...this.queue,
            items: this.queue.items.map((item, index) => ({ ...item, queueId: index + 1 }))
        };
    }

    getFormattedQueue(): Queue {
        const formattedItems = this.queue.items.map(item => ({
            ...item,
            cover: item.cover || 'styles/unknown.png'
        }));

        return {
            ...this.queue,
            items: formattedItems
        };
    }
}

export default QueueHandler;
export { QueueItem, Queue };
