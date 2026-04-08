import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { t } from '../i18n';
import { Button } from './ui/button';
import { Card } from './ui/card';

import { Slider } from './ui/slider';
import { Volume2, Heart, SkipBack, Play, Pause, SkipForward, Repeat, Shuffle, Repeat1, Music } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Queue } from 'src/queueHandler';
import { Settings } from 'src/settingsHandler';

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

interface MusicPlayerProps {
  currentTrack: Track;
  setCurrentTrack: (track: Track) => void;
  queue: Queue;
  settings: Settings;
  locale?: string;
}

export function MusicPlayer({ currentTrack, setCurrentTrack, queue, settings, locale = 'en' }: MusicPlayerProps) {
  const [volume, setVolume] = useState([Math.floor(currentTrack.volume * 100)]);
  const [isLiked, setIsLiked] = useState(currentTrack.isLiked);

  // Prevents incoming track-info pushes from overriding the slider
  // while the user is actively adjusting volume
  const isAdjustingVolume = useRef(false);
  const volumeAdjustTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update local state when currentTrack changes
  useEffect(() => {
    if (!isAdjustingVolume.current) {
      setVolume([Math.floor(currentTrack.volume * 100)]);
    }
    setIsLiked(currentTrack.isLiked);
  }, [currentTrack.volume, currentTrack.isLiked]);

/**
 * Format a given time in milliseconds to a string in the format
 * mm:ss.
 * @param {number} milliseconds - The time in milliseconds to format.
 * @returns {string} - The formatted time string.
 */
  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    const api = (window as any).api;
    if (!api) return;

    if (currentTrack.isPlaying) {
      api.playPause?.();
      console.log('Music paused');
    } else {
      api.playPause?.();
      console.log('Music playing');
    }
  };

  const handlePrevious = () => {
    const api = (window as any).api;
    api.previous?.();
  };

  const handleNext = async () => {
    console.log(queue)
    const api = (window as any).api;
    if (!api) return;
    if (queue.items.length === 0) {
      api.skip?.();
      return;
    }

    if (queue.currentlyPlayingIndex === queue.items.length - 1) {
      api.skip?.();
      return;
    }

    api.playTrackAtIndex?.(queue.currentlyPlayingIndex + 1);
    console.log("triggering")
    console.log("settings:", settings)
    if (settings.platform === 'apple') {
      setTimeout(() => api.skip?.(), 300);
    } else if (settings.platform === 'youtube') {
      setTimeout(() => api.skip?.(), 1000);
    } else {
      setTimeout(() => api.skip?.(), 50);
    }

  };

  const handleProgressChange = (value: number[]) => {
    // Calculate new time based on slider value
    const newTime = Math.floor((value[0] / 100) * currentTrack.duration);
    
    // Update local state immediately for responsiveness
    setCurrentTrack({
      ...currentTrack,
      progress: newTime
    });

    // You might want to add a seek API call here
    seek(newTime);
    console.log('Seek to:', newTime);
  };

  const seek = (newTime: number) => {
    const api = (window as any).api;
    api.seek?.(newTime);
  };

  const handleLike = () => {
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    
    // Update the track state as well
    setCurrentTrack({
      ...currentTrack,
      isLiked: newLikedState
    });
    
    const api = (window as any).api;
    api.like?.();
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume([newVolume]);

    // Block incoming song-info from snapping the slider back for 2s
    isAdjustingVolume.current = true;
    if (volumeAdjustTimer.current) clearTimeout(volumeAdjustTimer.current);
    volumeAdjustTimer.current = setTimeout(() => {
      isAdjustingVolume.current = false;
    }, 2000);

    setCurrentTrack({ ...currentTrack, volume: newVolume / 100 });

    const api = (window as any).api;
    api.volume?.(newVolume / 100);
  };

  const handleRepeat = () => {
    const api = (window as any).api;
    api.repeat?.();
  };

  const handleShuffle = () => {
    const api = (window as any).api;
    api.shuffle?.();
  };

  const progressPercentage = currentTrack.duration > 0 
    ? (currentTrack.progress / currentTrack.duration) * 100 
    : 0;

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-green-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
      </div>

      {/* Content */}
      <div className="relative h-full px-8 py-6 flex items-center justify-center overflow-y-auto">
        <div className="w-full max-w-md space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-purple-500 to-green-500 p-3 rounded-xl">
                <Music className="size-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">{t('CLIENT_NOW_PLAYING', locale)}</h3>
                <p className="text-purple-300 text-sm">Request+</p>
              </div>
            </div>
          </div>

          {/* Main Player Card */}
          <div className="bg-slate-800/60 backdrop-blur-sm border border-purple-500/30 rounded-xl p-6 space-y-4">
            {/* Album Art with Gradient Border */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-green-500 rounded-2xl opacity-50 blur"></div>
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden">
                <ImageWithFallback
                  key={`${currentTrack.title}-${currentTrack.artist}-${currentTrack.cover}`}
                  src={currentTrack.cover}
                  alt={`${currentTrack.title} by ${currentTrack.artist}`}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Track Info */}
            <div className="text-center space-y-1">
              <h2 className="text-white font-bold text-xl truncate">{currentTrack.title}</h2>
              <p className="text-purple-300 truncate">{currentTrack.artist}</p>
              <p className="text-sm text-gray-400 truncate">{currentTrack.album}</p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const percentage = (x / rect.width) * 100;
                  handleProgressChange([percentage]);
                }}
              >
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-green-500 transition-all duration-200 rounded-full"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>{formatTime(currentTrack.progress)}</span>
                <span>{formatTime(currentTrack.duration)}</span>
              </div>
            </div>

            {/* Main Controls */}
            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={handlePrevious}
                className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-full transition-all"
              >
                <SkipBack className="size-5" />
              </button>
              
              <button 
                onClick={handlePlayPause}
                className="bg-gradient-to-r from-purple-600 to-green-600 hover:from-purple-500 hover:to-green-500 text-white p-4 rounded-full transition-all shadow-lg"
              >
                {currentTrack.isPlaying ? <Pause className="size-6" /> : <Play className="size-6 ml-0.5" />}
              </button>
              
              <button 
                onClick={handleNext}
                className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-full transition-all"
              >
                <SkipForward className="size-5" />
              </button>
            </div>

            {/* Secondary Controls Row */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleShuffle}
                  className={`p-2 rounded-lg transition-all ${
                    currentTrack.shuffle 
                      ? 'bg-purple-500/20 text-purple-400' 
                      : 'bg-slate-700/50 text-gray-400 hover:text-purple-400'
                  }`}
                >
                  <Shuffle className="h-4 w-4" />
                </button>
                <button 
                  onClick={handleRepeat}
                  className={`p-2 rounded-lg transition-all ${
                    currentTrack.repeat !== 0 
                      ? 'bg-purple-500/20 text-purple-400' 
                      : 'bg-slate-700/50 text-gray-400 hover:text-purple-400'
                  }`}
                >
                  {currentTrack.repeat === 2 ? (
                    <Repeat1 className="h-4 w-4" />
                  ) : (
                    <Repeat className="h-4 w-4" />
                  )}
                </button>
              </div>

              <button
                onClick={handleLike}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                  isLiked 
                    ? 'bg-pink-500/20 text-pink-400' 
                    : 'bg-slate-700/50 text-gray-400 hover:text-pink-400'
                }`}
              >
                <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-3 pt-2">
              <Volume2 className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume[0]}
                  onChange={(e) => handleVolumeChange([parseInt(e.target.value)])}
                  className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer volume-slider"
                  style={{
                    background: `linear-gradient(to right, rgb(168 85 247) 0%, rgb(34 197 94) ${volume[0]}%, rgb(51 65 85) ${volume[0]}%, rgb(51 65 85) 100%)`
                  }}
                />
              </div>
              <span className="text-sm text-gray-400 w-10 text-right">{volume[0]}%</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .volume-slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(to right, rgb(168 85 247), rgb(34 197 94));
          cursor: pointer;
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
        }
        .volume-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(to right, rgb(168 85 247), rgb(34 197 94));
          cursor: pointer;
          border: none;
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
        }
      `}</style>
    </div>
  );
}