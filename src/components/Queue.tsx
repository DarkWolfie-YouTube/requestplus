import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger, ContextMenuItem } from './ui/context-menu';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Music, Play, MoreVertical, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Queue, QueueItem } from '../queueHandler';

interface QueuePageProps {
  items: QueueItem[];
  currentCount: number;
  currentlyPlayingIndex: number;
  onTrackSelect?: (track: QueueItem) => void;
}

export function QueuePage({ 
  items, 
  currentCount, 
  currentlyPlayingIndex,
  onTrackSelect 
}: QueuePageProps) {
  const [queue, setQueue] = useState<QueueItem[]>(items || []);

  useEffect(() => {
    setQueue(items || []);
  }, [items]);

  const removeFromQueue = (trackId: string) => {
    const api = (window as any).api;
    if (!api) {
      toast.error('API not available');
      return;
    }

    const trackIndex = queue.findIndex(item => item.id === trackId);
    if (trackIndex === -1) {
      toast.error('Track not found in queue');
      return;
    }

    try {
      const removed = api.removeFromQueue?.(trackIndex);
      if (removed !== false) {
        const newQueue = queue.filter(item => item.id !== trackId);
        setQueue(newQueue);
        toast.success('Removed track from queue');
      } else {
        toast.error('Failed to remove track from queue');
      }
    } catch (error) {
      console.error('Error removing from queue:', error);
      toast.error('Failed to remove track from queue');
    }
  };

  const clearQueue = () => {
    const api = (window as any).api;
    if (!api) {
      toast.error('API not available');
      return;
    }

    try {
      const cleared = api.clearQueue?.();
      if (cleared !== false) {
        setQueue([]);
        toast.success('Queue cleared');
      } else {
        toast.error('Failed to clear queue');
      }
    } catch (error) {
      console.error('Error clearing queue:', error);
      toast.error('Failed to clear queue');
    }
  };

  const formatDuration = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playTrack = (track: QueueItem, index: number) => {
    if (onTrackSelect) {
      onTrackSelect(track);
      toast.success(`Now playing: ${track.title}`);
    } else {
      const api = (window as any).api;
      if (api && api.playTrackAtIndex) {
        try {
          api.playTrackAtIndex(index);
          toast.success(`Now playing: ${track.title}`);
        } catch (error) {
          console.error('Error playing track:', error);
          toast.error('Failed to play track');
        }
      } else if (api && api.playTrack) {
        try {
          api.playTrack(track);
          toast.success(`Now playing: ${track.title}`);
        } catch (error) {
          console.error('Error playing track:', error);
          toast.error('Failed to play track');
        }
      }
    }
  };

  return (
    <div className="h-screen bg-background p-6 flex flex-col overflow-hidden">
      <div className="max-w-md mx-auto space-y-6 animate-fade-in flex flex-col h-full">
        {/* Header */}
        <div className="text-center space-y-2 py-4 flex-shrink-0">
          <h1 className="text-3xl">Queue</h1>
          <p className="text-muted-foreground text-lg">
            {queue.length} {queue.length === 1 ? 'song' : 'songs'} in queue
          </p>
        </div>

        {/* Queue List */}
        <Card className="p-5 shadow-card border-border/50 flex-1 overflow-hidden flex flex-col">
          {queue.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <Music className="h-16 w-16 text-muted-foreground/50 mx-auto" />
              <div>
                <h3 className="text-lg">No songs in queue</h3>
                <p className="text-sm text-muted-foreground/80">
                  Songs will appear here when they're requested
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-1">
                {queue.map((track, index) => {
                  const isCurrentlyPlaying = index === currentlyPlayingIndex;
                  const isQueued = track.isQueued;
                  
                  return (
                    <div key={track.id || `track-${index}`}>
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div 
                            className={`group flex items-center gap-4 p-3 rounded-xl hover:bg-accent/60 cursor-pointer transition-all hover-lift ${
                              isCurrentlyPlaying ? 'bg-primary/10 ring-2 ring-primary/30' : isQueued ? 'bg-accent/40' : ''
                            }`}
                            onClick={() => playTrack(track, index)}
                          >
                            {/* Album Art */}
                            <div className="relative flex-shrink-0">
                              <ImageWithFallback
                                src={track.cover || 'styles/unknown.png'}
                                alt={`${track.title} by ${track.artist}`}
                                className="w-14 h-14 rounded-lg object-cover ring-1 ring-border/30"
                              />
                              {isCurrentlyPlaying && (
                                <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                  <Play className="h-5 w-5 text-white fill-white" />
                                </div>
                              )}
                              {isQueued && !isCurrentlyPlaying && (
                                <div className="absolute inset-0 bg-primary/60 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                  <Clock className="h-4 w-4 text-white" />
                                </div>
                              )}
                            </div>

                            {/* Track Info */}
                            <div className="flex-1 min-w-0">
                              <h4 className={`truncate ${
                                isCurrentlyPlaying ? 'text-primary' : ''
                              }`}>
                                {track.title}
                              </h4>
                              <p className="text-sm text-muted-foreground/80 truncate">
                                {track.artist}
                              </p>
                              {track.requestedBy && (
                                <p className="text-xs text-muted-foreground/60 truncate mt-0.5">
                                  Requested by {track.requestedBy}
                                </p>
                              )}
                            </div>

                            {/* Duration and Status */}
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm text-muted-foreground mb-1">
                                {formatDuration(track.duration)}
                              </p>
                              {isCurrentlyPlaying ? (
                                <p className="text-xs text-primary px-2 py-1 rounded-full bg-primary/10">
                                  Playing
                                </p>
                              ) : isQueued ? (
                                <p className="text-xs text-primary/80 px-2 py-1 rounded-full bg-primary/10">
                                  Queued
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground/60">
                                  #{index + 1}
                                </p>
                              )}
                            </div>

                            {/* More Options */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </ContextMenuTrigger>
                        
                        <ContextMenuContent className="w-48">
                          <ContextMenuItem
                            onClick={() => playTrack(track, index)}
                            className="cursor-pointer"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Play Now
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => removeFromQueue(track.id)}
                            className="cursor-pointer text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove from Queue
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </Card>

        {/* Queue Actions */}
        {queue.length > 0 && (
          <Card className="p-5 shadow-card border-border/50 flex-shrink-0">
            <Button
              variant="outline"
              className="w-full hover-lift"
              onClick={clearQueue}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Queue
            </Button>
            
            {/* Auto-Queue Info */}
            <div className="mt-4 p-3 bg-accent/50 rounded-lg border border-border/30">
              <p className="text-xs text-muted-foreground/80 text-center leading-relaxed">
                Songs will auto-queue 10 seconds before the current track ends
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}