import PlaybackHandler, { songInfo } from './playbackHandler';
import WebSocketServer from './websocket';
import Logger from './logger';
import { YTManager } from './ytManager';
import AMHandler from './amhandler';

export type MusicPlatform = 'spotify' | 'youtube' | 'apple' | 'soundcloud';

export interface ActiveSongInfo {
  song: songInfo;
  platform: MusicPlatform;
}

interface PlatformState {
  handler: PlaybackHandler;
  song: songInfo | null;
  /** Timestamp of the last time this platform was observed playing */
  lastActiveAt: number;
}

class MultiPlatformHandler {
  private states: Map<string, PlatformState> = new Map();
  private primarySearchPlatform: string;
  private logger: Logger;

  constructor(
    platforms: string[],
    primarySearchPlatform: string,
    spotifyWS: WebSocketServer,
    ytManager: YTManager,
    amHandler: AMHandler,
    logger: Logger
  ) {
    this.primarySearchPlatform = primarySearchPlatform;
    this.logger = logger;
    this.buildHandlers(platforms, spotifyWS, ytManager, amHandler);
  }

  private buildHandlers(
    platforms: string[],
    spotifyWS: WebSocketServer,
    ytManager: YTManager,
    amHandler: AMHandler
  ) {
    for (const platform of platforms) {
      if (!this.states.has(platform)) {
        this.states.set(platform, {
          handler: new PlaybackHandler(platform, spotifyWS, this.logger, ytManager, amHandler),
          song: null,
          lastActiveAt: 0,
        });
      }
    }
  }

  /**
   * Poll all enabled platforms in parallel and return whichever is active.
   *
   * Priority:
   *   1. A platform that is currently playing
   *      — if multiple are playing, the one most recently seen playing wins
   *   2. If nothing is playing, the platform that was most recently playing/paused
   */
  async getCurrentSong(): Promise<ActiveSongInfo | null> {
    const polls = Array.from(this.states.entries()).map(async ([platform, state]) => {
      try {
        const song = await state.handler.getCurrentSong();
        return { platform, song };
      } catch (err) {
        this.logger.error(`[MultiPlatform] Error polling ${platform}:`, err);
        return { platform, song: null };
      }
    });

    const results = await Promise.all(polls);
    const now = Date.now();

    for (const { platform, song } of results) {
      const state = this.states.get(platform)!;
      state.song = song;
      if (song?.isPlaying) {
        state.lastActiveAt = now;
      }
    }

    return this.pickActive();
  }

  /**
   * Returns the platform currently considered active without re-polling.
   * Useful for routing controls after getCurrentSong() has already been called.
   */
  getActivePlatform(): MusicPlatform | null {
    const active = this.pickActive();
    return active ? active.platform : null;
  }

  /**
   * Determine which music platform a song request should be routed to.
   *
   * Resolution order:
   *   1. Platform explicitly specified by the API in the incoming message
   *   2. Platform detected from the URL/URI in the request body
   *   3. User's configured primary search platform
   */
  resolveRequestPlatform(songInput: string, apiPlatform?: string): string {
    // 1. API-specified
    if (apiPlatform && this.states.has(apiPlatform)) {
      return apiPlatform;
    }

    // 2. URL / URI detection
    if (
      songInput.includes('spotify:track:') ||
      songInput.includes('open.spotify.com/')
    ) return 'spotify';

    if (
      songInput.includes('youtube.com/watch') ||
      songInput.includes('youtu.be/') ||
      songInput.includes('music.youtube.com/')
    ) return 'youtube';

    if (
      songInput.includes('music.apple.com/') ||
      songInput.includes('itunes.apple.com/')
    ) return 'apple';

    if (songInput.includes('soundcloud.com/')) return 'soundcloud';

    // 3. Fall back to primary search platform
    return this.primarySearchPlatform;
  }

  /**
   * Update the active platform list. Adds new ones, removes stale ones.
   * Existing platform state (lastActiveAt, cached song) is preserved across updates.
   */
  updatePlatforms(
    platforms: string[],
    spotifyWS: WebSocketServer,
    ytManager: YTManager,
    amHandler: AMHandler
  ) {
    for (const platform of this.states.keys()) {
      if (!platforms.includes(platform)) {
        this.states.delete(platform);
      }
    }
    this.buildHandlers(platforms, spotifyWS, ytManager, amHandler);
  }

  updatePrimarySearchPlatform(platform: string) {
    this.primarySearchPlatform = platform;
  }

  // ---------------------------------------------------------------------------

  private pickActive(): ActiveSongInfo | null {
    const playing: Array<[string, PlatformState]> = [];
    const withSong: Array<[string, PlatformState]> = [];

    for (const entry of this.states.entries()) {
      const [, state] = entry;
      if (!state.song) continue;
      if (state.song.isPlaying) {
        playing.push(entry);
      } else if (state.song.title) {
        withSong.push(entry);
      }
    }

    if (playing.length > 0) {
      // Most recently seen playing wins
      playing.sort(([, a], [, b]) => b.lastActiveAt - a.lastActiveAt);
      const [platform, state] = playing[0];
      return { song: state.song!, platform: platform as MusicPlatform };
    }

    if (withSong.length > 0) {
      // Fall back to most recently active paused platform
      withSong.sort(([, a], [, b]) => b.lastActiveAt - a.lastActiveAt);
      const [platform, state] = withSong[0];
      return { song: state.song!, platform: platform as MusicPlatform };
    }

    return null;
  }
}

export default MultiPlatformHandler;
