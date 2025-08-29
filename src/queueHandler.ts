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
    private wss: WebSocketServer;
    private settings: Settings;
    private mainWindow: BrowserWindow;
    
    constructor(logger: Logger, wss: WebSocketServer, mainWindow: BrowserWindow, settings: Settings) {
        this.logger = logger;
        this.wss = wss;
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
        return { ...this.queue };
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