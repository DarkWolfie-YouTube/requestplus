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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-medium">Queue</h1>
          <p className="text-muted-foreground">
            {queue.length} {queue.length === 1 ? 'song' : 'songs'} in queue
          </p>
        </div>

        {/* Queue List */}
        <Card className="p-4">
          {queue.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Music className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="font-medium">No songs in queue</h3>
                <p className="text-sm text-muted-foreground">
                  Songs will appear here when they're requested
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-29rem)]">
              <div className="space-y-2">
                {queue.map((track, index) => {
                  const isCurrentlyPlaying = index === currentlyPlayingIndex;
                  const isQueued = track.isQueued;
                  
                  return (
                    <div key={track.id || `track-${index}`}>
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div 
                            className={`group flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors ${
                              isCurrentlyPlaying ? 'bg-accent' : isQueued ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                            }`}
                            onClick={() => playTrack(track, index)}
                          >
                            {/* Album Art */}
                            <div className="relative">
                              <ImageWithFallback
                                src={track.cover || 'styles/unknown.png'}
                                alt={`${track.title} by ${track.artist}`}
                                className="w-12 h-12 rounded-md object-cover"
                              />
                              {isCurrentlyPlaying && (
                                <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center">
                                  <Play className="h-4 w-4 text-white fill-white" />
                                </div>
                              )}
                              {isQueued && !isCurrentlyPlaying && (
                                <div className="absolute inset-0 bg-blue-500/50 rounded-md flex items-center justify-center">
                                  <Clock className="h-4 w-4 text-white" />
                                </div>
                              )}
                            </div>

                            {/* Track Info */}
                            <div className="flex-1 min-w-0">
                              <h4 className={`font-medium truncate ${
                                isCurrentlyPlaying ? 'text-primary' : isQueued ? 'text-blue-600 dark:text-blue-400 dark:bg-gray-800' : ''
                              }`}>
                                {track.title}
                              </h4>
                              <p className="text-sm text-muted-foreground truncate">
                                {track.artist}
                              </p>
                              {track.album && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {track.album}
                                </p>
                              )}
                              {track.requestedBy && (
                                <p className="text-xs text-muted-foreground truncate">
                                  Requested by {track.requestedBy}
                                </p>
                              )}
                            </div>

                            {/* Duration and Status */}
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">
                                {formatDuration(track.duration)}
                              </p>
                              {isCurrentlyPlaying ? (
                                <p className="text-xs text-primary font-medium">
                                  Now Playing
                                </p>
                              ) : isQueued ? (
                                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                  Queued
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  #{index + 1}
                                </p>
                              )}
                            </div>

                            {/* More Options */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </ContextMenuTrigger>
                        
                        <ContextMenuContent>
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
                      
                      {index < queue.length - 1 && <Separator className="my-2" />}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </Card>

        {/* Queue Actions */}
        {queue.length > 0 && (
          <Card className="p-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={clearQueue}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Queue
              </Button>
            </div>
            
            {/* Auto-Queue Info */}
            <div className="mt-3 p-2 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground text-center">
                Songs will auto-queue 10 seconds before the current track ends
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}