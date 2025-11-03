import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Slider } from './ui/slider';
import { Volume2, Heart, SkipBack, Play, Pause, SkipForward, Repeat, Shuffle, Repeat1 } from 'lucide-react';
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
  isLiked: boolean;
}

interface MusicPlayerProps {
  currentTrack: Track;
  setCurrentTrack: (track: Track) => void;
}

export function MusicPlayer({ currentTrack, setCurrentTrack }: MusicPlayerProps) {
  const [volume, setVolume] = useState([Math.floor(currentTrack.volume * 100)]);
  const [isLiked, setIsLiked] = useState(currentTrack.isLiked);

  // Update local state when currentTrack changes
  useEffect(() => {
    setVolume([Math.floor(currentTrack.volume * 100)]);
    setIsLiked(currentTrack.isLiked);
  }, [currentTrack.volume, currentTrack.isLiked]);

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
    
    // Update the track state as well
    setCurrentTrack({
      ...currentTrack,
      volume: newVolume / 100
    });
    
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
    <div className="h-screen bg-background p-6 flex items-center justify-center overflow-hidden">
      <Card className="w-full max-w-md mx-auto p-8 space-y-6 shadow-card-hover border-border/50 animate-scale-in max-h-full overflow-y-auto">
        {/* Album Art */}
        <div className="aspect-square w-full max-w-sm mx-auto rounded-2xl overflow-hidden shadow-card-hover ring-1 ring-primary/10">
          <ImageWithFallback
            key={`${currentTrack.title}-${currentTrack.artist}-${currentTrack.cover}`}
            src={currentTrack.cover}
            alt={`${currentTrack.title} by ${currentTrack.artist}`}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Track Info */}
        <div className="text-center space-y-2 px-4">
          <h2 className="text-2xl truncate">{currentTrack.title}</h2>
          <p className="text-muted-foreground text-lg">{currentTrack.artist}</p>
          <p className="text-sm text-muted-foreground/80">{currentTrack.album}</p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2 px-2">
          <Slider
            value={[progressPercentage]}
            onValueChange={handleProgressChange}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground/80 px-1">
            <span>{formatTime(currentTrack.progress)}</span>
            <span>{formatTime(currentTrack.duration)}</span>
          </div>
        </div>

        {/* Main Controls */}
        <div className="flex items-center justify-center gap-4 py-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handlePrevious}
            className="h-12 w-12 rounded-full hover:bg-accent/80 hover-lift"
          >
            <SkipBack className="h-5 w-5" />
          </Button>
          
          <Button
            size="icon"
            className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90 shadow-lg hover-glow"
            onClick={handlePlayPause}
          >
            {currentTrack.isPlaying ? (
              <Pause className="h-7 w-7 text-primary-foreground" />
            ) : (
              <Play className="h-7 w-7 text-primary-foreground ml-0.5" />
            )}
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleNext}
            className="h-12 w-12 rounded-full hover:bg-accent/80 hover-lift"
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        {/* Secondary Controls */}
        <div className="flex items-center justify-between px-4 pt-2">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleShuffle}
              className={`h-10 w-10 rounded-full ${currentTrack.shuffle ? 'text-primary' : 'text-muted-foreground'} hover:bg-accent/80`}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleRepeat}
              className={`h-10 w-10 rounded-full ${currentTrack.repeat !== 0 ? 'text-primary' : 'text-muted-foreground'} hover:bg-accent/80`}
            >
              {currentTrack.repeat === 2 ? (
                <Repeat1 className="h-4 w-4" />
              ) : (
                <Repeat className="h-4 w-4" />
              )}
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLike}
            className="h-10 w-10 rounded-full hover:bg-accent/80"
          >
            {isLiked ? (
              <Heart className="h-5 w-5 text-red-500 fill-red-500" />
            ) : (
              <Heart className="h-5 w-5 text-muted-foreground" />
            )}
          </Button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-3 px-4 pt-2">
          <Volume2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <Slider
            value={volume}
            onValueChange={handleVolumeChange}
            max={100}
            step={1}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground w-10 text-right">{volume[0]}%</span>
        </div>
      </Card>
    </div>
  );
}