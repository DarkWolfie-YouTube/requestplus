import * as React from 'react';
import { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Slider } from './ui/slider';
import { Volume2, Heart, SkipBack, Play, Pause, SkipForward, Repeat, Shuffle } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

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
}


interface MusicPlayerProps {
  currentTrack: Track;
  setCurrentTrack: (track: Track) => void;
}

export function MusicPlayer({ currentTrack, setCurrentTrack }: MusicPlayerProps) {
  const [volume, setVolume] = useState([75]);
  const [isLiked, setIsLiked] = useState(false);

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

  const handleNext = () => {
    const api = (window as any).api;
    api.skip?.();
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
  };

  const seek = (newTime: number) => {
    const api = (window as any).api;
    api.seek?.(progressPercentage / 100);
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    const api = (window as any).api;
    api.like?.();
  };
  const sVolume = (volume: number) => {
    const api = (window as any).api;
    api.volume?.(volume / 100);
    setVolume(volume);
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
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="w-full max-w-md mx-auto p-4 space-y-4">
        {/* Album Art */}
        <div className="aspect-square w-full max-w-xs mx-auto rounded-lg overflow-hidden shadow-lg">
          <ImageWithFallback
            key={`${currentTrack.title}-${currentTrack.artist}-${currentTrack.cover}`}
            src={currentTrack.cover}
            alt={`${currentTrack.title} by ${currentTrack.artist}`}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Track Info */}
        <div className="text-center space-y-1">
          <h2 className="text-xl font-medium">{currentTrack.title}</h2>
          <p className="text-muted-foreground">{currentTrack.artist}</p>
          <p className="text-sm text-muted-foreground">{currentTrack.album}</p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <Slider
            value={[progressPercentage]}
            onValueChange={handleProgressChange}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{formatTime(currentTrack.progress)}</span>
            <span>{formatTime(currentTrack.duration)}</span>
          </div>
        </div>

        {/* Main Controls */}
        <div className="flex items-center justify-center gap-3 py-2">
          <Button variant="ghost" size="icon" onClick={handlePrevious}>
            <SkipBack className="h-5 w-5" />
          </Button>
          
          <Button
            size="icon"
            className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90"
            onClick={handlePlayPause}
          >
            {currentTrack.isPlaying ? (
              <Pause className="h-6 w-6 text-primary-foreground" />
            ) : (
              <Play className="h-6 w-6 text-primary-foreground ml-0.5" />
            )}
          </Button>
          
          <Button variant="ghost" size="icon" onClick={handleNext}>
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        {/* Secondary Controls */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleShuffle}>
              <Shuffle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleRepeat}>
              <Repeat className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLike}
          >
            <Heart className={`h-5 w-5 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
          </Button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2 pt-1">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={volume}
            onValueChange={sVolume}
            max={100}
            step={1}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground w-8">{volume[0]}</span>
        </div>
      </Card>
    </div>
  );
}