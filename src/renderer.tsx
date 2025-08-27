import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import { MusicPlayer } from './components/MusicPlayer';
import { Settings } from './components/Settings';
import { Navigation } from './components/Navigation';
import { Toaster } from './components/ui/sonner';
import { Topbar } from './components/Topbar';

interface Track {
  title: string;
  artist: string;
  album: string;
  duration: number;
  progress: number;
  cover: string;
  isPlaying: boolean;
}

interface TrackInfo {
  title: string;
  artist_name?: string;
  'artist_name:1'?: string;
  'artist_name:2'?: string;
  'artist_name:3'?: string;
  'artist_name:4'?: string;
  'artist_name:5'?: string;
  image?: string;
  image_large_url?: string;
  duration: number;
  progress: number;
  isPlaying: boolean;
  volume?: number;
  shuffle?: boolean;
  repeat?: number;
}

interface TwitchUser {
  display_name: string;
  profile_image_url: string;
}

interface UpdateSettings {
  checkPreReleases: boolean;
}

const App = () => {
  const [currentView, setCurrentView] = useState<'player' | 'settings'>('player');
  
  // Global state for track info
  const [currentTrack, setCurrentTrack] = useState<Track>({
    title: 'No track playing',
    artist: 'Unknown Artist',
    album: 'Unknown Album',
    duration: 210,
    progress: 0,
    cover: 'styles/unknown.png',
    isPlaying: false
  });

  // Global state for settings
  const [twitchUser, setTwitchUser] = useState<TwitchUser | null>(null);
  const [overlayPath, setOverlayPath] = useState('');
  const [updateSettings, setUpdateSettings] = useState<UpdateSettings>({ checkPreReleases: false });
  const [settings, setSettings] = useState({
    showNotifications: true,
    theme: 'default',
    enableRequests: true,
    modsOnly: false,
    requestLimit: 10
  });

  // Initialize all API connections once at app level
  useEffect(() => {
    const api = (window as any).api;
    console.log('API available:', !!api);
    if (!api) {
      console.log('No API found - running in web mode');
      return;
    }

    // Track info handler
    const handleTrackInfo = (info: TrackInfo) => {
      console.log('Received track info:', info);
      
      const dataArtists: string[] = [];
      if (info.artist_name) dataArtists.push(info.artist_name);
      if (info['artist_name:1']) dataArtists.push(info['artist_name:1']);
      if (info['artist_name:2']) dataArtists.push(info['artist_name:2']);
      if (info['artist_name:3']) dataArtists.push(info['artist_name:3']);
      if (info['artist_name:4']) dataArtists.push(info['artist_name:4']);
      if (info['artist_name:5']) dataArtists.push(info['artist_name:5']);

      const dataImage = info?.image || info?.image_large_url || null;
      let newImage = 'styles/unknown.png';
      
      if (dataImage != null) {
        if (dataImage.includes('spotify:image:')) {
          newImage = dataImage.replace('spotify:image:', 'https://i.scdn.co/image/');
        } else if (dataImage.includes('data:image/')) {
          newImage = dataImage;
        } else {
          newImage = dataImage;
        }
      }

      setCurrentTrack({
        title: info.title || 'Unknown Track',
        artist: dataArtists.join(', ') || 'Unknown Artist',
        album: 'Current Track',
        duration: info.duration,
        progress: info.progress,
        cover: newImage,
        isPlaying: info.isPlaying,
        volume: info.volume || 100,
        shuffle: info.shuffle || false,
        repeat: info.repeat || 0
      });
    };

    // Set up track info listener
    if (api.getInfo && typeof api.getInfo === 'function') {
      console.log('Setting up getInfo listener');
      api.getInfo(handleTrackInfo);
    }

    // Load settings
    if (api.loadSettings) {
      api.loadSettings().then((loadedSettings: any) => {
        if (loadedSettings) {
          console.log('Loaded settings from Electron:', loadedSettings);
          setSettings(prev => ({ ...prev, ...loadedSettings }));
        }
      }).catch((err: any) => {
        console.error('Failed to load settings from Electron:', err);
        const savedSettings = localStorage.getItem('settings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          setSettings(prev => ({ ...prev, ...parsed }));
        }
      });
    } else {
      const savedSettings = localStorage.getItem('settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    }
    
    // Get overlay path
    api.getOverlayPath?.().then((path: string) => {
      setOverlayPath(path);
    });

    // Get update settings
    api.getUpdateSettings?.().then((updateSettings: UpdateSettings) => {
      setUpdateSettings(updateSettings);
    });

    // Listen for auth success
    api.authSuccess?.((user: TwitchUser) => {
      setTwitchUser(user);
    });

    // Call preload if available
    if (api.preload && typeof api.preload === 'function') {
      console.log('Calling api.preload');
      api.preload();
    }

    return () => {
      console.log('Cleaning up main useEffect');
    };
  }, []);

  return (
    <div className="size-full bg-background">
      <div className="h-screen flex flex-col">
        <Topbar />
        <div className="flex-1 pt-8">
          <div className="pb-16">
            {currentView === 'player' ? (
              <MusicPlayer 
                currentTrack={currentTrack} 
                setCurrentTrack={setCurrentTrack}
              />
            ) : (
              <Settings 
                twitchUser={twitchUser}
                setTwitchUser={setTwitchUser}
                overlayPath={overlayPath}
                updateSettings={updateSettings}
                setUpdateSettings={setUpdateSettings}
                settings={settings}
                setSettings={setSettings}
              />
            )}
          </div>

          <Navigation currentView={currentView} onViewChange={setCurrentView} />
          <Toaster />
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}