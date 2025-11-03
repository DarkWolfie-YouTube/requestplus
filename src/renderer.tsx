import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import { MusicPlayer } from './components/MusicPlayer';
import { Settings } from './components/Settings';
import { Navigation } from './components/Navigation';
import { Toaster } from './components/ui/sonner';
import { Topbar } from './components/Topbar';
import { QueuePage } from './components/Queue';
import { Queue } from './queueHandler';
import { toast } from 'sonner';

interface Track {
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

interface User {
  display_name: string;
  profile_image_url: string;
}

interface UpdateSettings {
  checkPreReleases: boolean;
}

const App = () => {
  const [currentView, setCurrentView] = useState<'player' | 'settings' | 'queue'>('player');
  
  // Global state for track info
  const [currentTrack, setCurrentTrack] = useState<Track>({
    title: 'No track playing',
    artist: 'Unknown Artist', 
    album: 'Unknown Album',
    duration: 210,
    progress: 0,
    cover: 'styles/unknown.png',
    isPlaying: false,
    volume: 75,
    shuffle: false,
    repeat: 0,
    isLiked: false
  });

  // Global state for settings
  const [twitchUser, setTwitchUser] = useState<User | null>(null);
  const [kickUser, setKickUser] = useState<User | null>(null);
  const [overlayPath, setOverlayPath] = useState('');
  const [updateSettings, setUpdateSettings] = useState<UpdateSettings>({ checkPreReleases: false });
  const [settings, setSettings] = useState({
    showNotifications: true,
    theme: 'default',
    enableRequests: true,
    modsOnly: false,
    requestLimit: 10,
    telemetryEnabled: true
  });
  const [queue, setQueue] = useState<Queue>([]);

  


  // Initialize all API connections once at app level
  useEffect(() => {
    const api = (window as any).api;
    console.log('API available:', !!api);
    if (!api) {
      console.log('No API found - running in web mode');
      // Initialize empty queue for web mode
      setQueue({
        items: [],
        currentCount: 0,
        currentlyPlayingIndex: -1
      });
      return;
    }

    // Track info handler
    const handleTrackInfo = (info: songInfo) => {
      
      

      

      const dataImage = info?.cover || null;
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
        artist: info.artist || 'Unknown Artist',
        album: 'Current Track',
        duration: info.duration,
        progress: info.progress,
        cover: newImage,
        isPlaying: info.isPlaying,
        volume: info.volume || 100,
        shuffle: info.shuffle || false,
        repeat: info.repeat || 0,
        isLiked: info.isLiked || false
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
    api.authSuccess?.((user: User) => {
      setTwitchUser(user);
    });

    api.kickAuthSuccess?.((user: User) => {
      setKickUser(user);
    });

    // Call preload if available
    if (api.preload && typeof api.preload === 'function') {
      console.log('Calling api.preload');
      api.preload();
    }

    // toast notification listener
    // Toast notification listener
    const handleToast = (event: any, toastData: any) => {
      console.log('Received toast:', toastData);
      
      // Handle different toast data formats for backward compatibility
      let message, type, duration;
      
      if (typeof toastData === 'object' && toastData.message) {
        // New format: object with message, type, duration
        message = toastData.message;
        type = toastData.type || 'info';
        duration = toastData.duration || 5000;
      } else if (typeof toastData === 'string') {
        // Fallback: just a string message
        message = toastData;
        type = 'info';
        duration = 5000;
      } else {
        console.warn('Invalid toast data format:', toastData);
        return;
      }
      
      // Use sonner toast with appropriate styling based on type
      switch (type) {
        case 'success':
          toast.success(message, { duration });
          break;
        case 'error':
          toast.error(message, { duration });
          break;
        case 'warning':
          toast.warning(message, { duration });
          break;
        case 'info':
        default:
          toast.info(message, { duration });
          break;
      }
    };

    // Set up the toast listener
    if (api.onToast) {
      api.onToast(handleToast);
    } else if ((window as any).electronAPI) {
      // Alternative approach if using different IPC setup
      (window as any).electronAPI.onToast?.(handleToast);
    }
// Queue handling - fetch initial data
  const handleQueueUpdate = (updatedQueue: Queue) => {
    console.log('Queue update received in renderer:', updatedQueue);
    setQueue(updatedQueue);
  };
  const fetchInitialQueue = async () => {
    try {
      const queueData = await api.getQueue();
      console.log('Initial queue fetch:', queueData);
      if (queueData) {
        setQueue(queueData);
      }
    } catch (err) {
      console.error('Failed to fetch initial queue:', err);
      setQueue({
        items: [],
        currentCount: 0,
        currentlyPlayingIndex: -1
      });
    }
  };

  // Set up queue update listener BEFORE fetching initial data
  

// Then set up listener with the defined callback
  api.updateQueuePage(handleQueueUpdate);

  // Fetch initial queue data
  fetchInitialQueue();

  // ... rest of your existing setup (toast handler, etc.) ...

  // Cleanup function
  return () => {
    console.log('Cleaning up main useEffect');
    api.removeToastListener?.();
    api.removeQueueListener?.();
  };
  }, []);

  // Function to handle track selection from queue
  const handleTrackSelect = (track: any) => {
    // Convert queue item to track format if needed
    setCurrentTrack({
      title: track.title,
      artist: track.artist,
      album: track.album || 'Unknown Album',
      duration: track.duration,
      progress: 0, // Reset progress when selecting new track
      cover: track.cover,
      isPlaying: true, // Start playing when selected
      volume: currentTrack.volume,
      shuffle: currentTrack.shuffle,
      repeat: currentTrack.repeat,
      isLiked: track.isLiked || false
    });
  };

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
            ) : currentView === 'queue' ? (
              queue && (
                <QueuePage 
                  items={queue.items} 
                  currentCount={queue.currentCount} 
                  currentlyPlayingIndex={queue.currentlyPlayingIndex}
                  onTrackSelect={handleTrackSelect}
                />
              )
            ) : (
              <Settings 
                twitchUser={twitchUser}
                setTwitchUser={setTwitchUser}
                kickUser={kickUser}
                setKickUser={setKickUser}
                overlayPath={overlayPath}
                updateSettings={updateSettings}
                setUpdateSettings={setUpdateSettings}
                settings={settings}
                setSettings={setSettings}
              />
            )}
          </div>

          <Navigation currentView={currentView} onViewChange={setCurrentView} settings={settings} />
          <Toaster />
        </div>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}