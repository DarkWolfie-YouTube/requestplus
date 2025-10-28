import WebSocketServer from "./websocket";
import Logger from "./logger";
import { YTManager } from "./ytManager";

interface songInfo {
  title: string;
  artist: string;
  album: string;
  duration: number;
  progress: number;
  cover: string;
  isPlaying: boolean;
  volume: number;
  shuffle: boolean;
  repeat: number;
  isLiked: boolean;
}

class PlaybackHandler {
    public currentSong: songInfo | null = null;
    private platform: string; 
    private SpotifyWS: WebSocketServer;
    private logger: Logger;
    private YTManager: YTManager;
    
    constructor(platform: string, spotifyWS: WebSocketServer, logger: Logger, ytManager: YTManager) {
        this.platform = platform;
        this.SpotifyWS = spotifyWS;
        this.logger = logger;
        this.YTManager = ytManager;
    }

    async getCurrentSong(): Promise<songInfo | null> {
        if (this.platform === 'youtube') {
            return this.getYouTubeSong();
        } else if (this.platform === 'spotify') {
            return this.getSpotifySong();
        }
        
        this.logger.error(`Unknown platform: ${this.platform}`);
        return null;
    }

    private async getYouTubeSong(): Promise<songInfo | null> {
        try {
            // Fetch all YouTube data in parallel
            const [ytSongData, ytVolume, ytRepeat, ytShuffle, ytLiked] = await Promise.all([
                this.YTManager.getCurrentSong(),
                this.YTManager.getVolume(),
                this.YTManager.getRepeatMode(),
                this.YTManager.getShuffleMode(),
                this.YTManager.isLiked()
            ]);

            // Check if essential data is available
            if (!ytSongData) {
                this.logger.warn('No YouTube song data available');
                return null;
            }

            // Log what's missing for debugging
            if (!ytVolume) {
                this.logger.warn('YouTube volume data is null, using default');
            }
            if (!ytRepeat) {
                this.logger.warn('YouTube repeat mode is null, using default');
            }

            this.currentSong = {
                title: ytSongData.title,
                artist: ytSongData.artist || 'Unknown Artist',
                album: '',
                duration: ytSongData.songDuration * 1000,
                progress: ytSongData.elapsedSeconds * 1000,
                cover: ytSongData.imageSrc || '',
                isPlaying: !ytSongData.isPaused,
                volume: (ytVolume?.state / 100) || 0,
                shuffle: ytShuffle ?? false,
                repeat: ytRepeat ? this.convertYouTubeRepeatMode(ytRepeat.mode) : 0,
                isLiked: ytLiked ?? false
            };

            return this.currentSong;
        } catch (err) {
            this.logger.error('Error fetching YouTube song data:', err);
            return null;
        }
    }

    private async getSpotifySong(): Promise<songInfo | null> {
        try {
            // Fetch current song info from Spotify WebSocket
            await this.SpotifyWS.WSSendToType({ command: 'getdata' }, 'spotify');
            
            // Wait for data to be received
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const spotifyData = this.SpotifyWS.lastInfo;
            
            if (!spotifyData) {
                this.logger.warn('No Spotify data available');
                return null;
            }

            // Collect all artist names
            const dataArtists: string[] = [];
            if (spotifyData.artist_name) dataArtists.push(spotifyData.artist_name);
            if (spotifyData['artist_name:1']) dataArtists.push(spotifyData['artist_name:1']);
            if (spotifyData['artist_name:2']) dataArtists.push(spotifyData['artist_name:2']);
            if (spotifyData['artist_name:3']) dataArtists.push(spotifyData['artist_name:3']);
            if (spotifyData['artist_name:4']) dataArtists.push(spotifyData['artist_name:4']);
            
            const artists = dataArtists.length > 0 ? dataArtists.join(", ") : 'Unknown Artist';

            this.currentSong = {
                title: spotifyData.title || 'Unknown Title',
                artist: artists,
                album: spotifyData.album || '',
                duration: spotifyData.duration || 0,
                progress: spotifyData.progress || 0,
                cover: spotifyData.image_large_url || spotifyData.image || '',
                isPlaying: spotifyData.isPlaying ?? false,
                volume: spotifyData.volume ?? 100,
                shuffle: spotifyData.shuffle ?? false,
                repeat: spotifyData.repeat ?? 0,
                isLiked: spotifyData.isLiked ?? false
            };

            return this.currentSong;
        } catch (err) {
            this.logger.error('Error fetching Spotify song data:', err);
            return null;
        }
    }

    private convertYouTubeRepeatMode(mode: string): number {
        switch (mode) {
            case "NONE":
                return 0;
            case "ALL":
                return 1;
            case "ONE":
                return 2;
            default:
                return 0;
        }
    }
    updateSettings(settings: string) {
        this.platform = settings;
    }
}

export default PlaybackHandler;
export { songInfo };