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
  queue: Queue;
  setQueue: (queue: Queue) => void;
  onTrackSelect?: (track: QueueItem) => void;
}

export function QueuePage({ 
  queue,
  setQueue,
  onTrackSelect 
}: QueuePageProps) {

  const [currentTrack, setCurrentTrack] = useState<QueueItem | null>(null);

  useEffect(() => {
    if (queue.items.length > 0) {
      setCurrentTrack(queue.items[0]);
    } else {
      setCurrentTrack(null);
    }
  }, [queue]);



  const removeFromQueue = (trackId: string) => {
    const api = (window as any).api;
    if (!api) {
      toast.error('API not available');
      return;
    }

    


    const trackIndex = queue.items.findIndex(item => item.id === trackId);
    if (trackIndex === -1) {
      toast.error('Track not found in queue');
      return;
    }

    try {
      const removed = api.removeFromQueue?.(trackIndex);
      if (removed !== false) {
        const newQueue = queue.items.filter(item => item.id !== trackId);
        setQueue({ ...queue, items: newQueue});
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
    const api = (window as any).api;
    if (api && api.playTrackAtIndex) {
      try {
        api.playTrackAtIndex(index);
        setTimeout(() => api.skip?.(), 300);
        setTimeout(() => toast.success(`Now playing: ${track.title}`), 300);
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
  };

  return (
    <div className="h-full bg-background p-9 flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col flex-1 gap-4 animate-scale-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-medium">Queue</h1>
          <p className="text-muted-foreground">
            {queue.items.length === 0 ? 'No' : queue.items.length} {queue.items.length === 1 ? 'song' : 'songs'} in queue
          </p>
        </div>

        {/* Queue List */}
        <Card className={`p-4 flex flex-col min-h-0 animate-scale-in `}>
          {queue.items.length === 0 ? (
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
            <ScrollArea className="flex-1">
              <div className="space-y-2">
                {queue.items.map((track, index) => (
                  <div key={track.id}>
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div 
                          className={`flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors ${
                            track.iscurrentlyPlaying ? 'bg-accent' : ''
                          }`}
                          onClick={() => playTrack(track, index)}
                        >
                          {/* Album Art */}
                          <div className="relative">
                            <ImageWithFallback
                              src={track.cover}
                              alt={`${track.title} by ${track.artist}`}
                              className="w-12 h-12 rounded-md object-cover"
                            />
                            {track.iscurrentlyPlaying && (
                              <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center">
                                <Play className="h-4 w-4 text-white fill-white" />
                              </div>
                            )}
                          </div>

                          {/* Track Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-medium truncate ${
                              track.iscurrentlyPlaying ? 'text-primary' : ''
                            }`}>
                              {track.title}
                            </h4>
                            <p className="text-sm text-muted-foreground truncate">
                              {track.artist}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {track.album}
                            </p>
                          </div>

                          {/* Duration and Queue Position */}
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              {formatDuration(track.duration)}
                            </p>
                            {track.iscurrentlyPlaying ? (
                              <p className="text-xs text-primary font-medium">
                                Now Playing
                              </p>
                            ) : track.isQueued ? (
                              <div className="flex items-center gap-1 justify-end">
                                <Clock className="h-3 w-3 text-green-500" />
                                <p className="text-xs text-green-500 font-medium">
                                  Queued
                                </p>
                              </div>
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
                              // This will be handled by the context menu
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
                ))}
              </div>
            </ScrollArea>
          )}
        </Card>

        {/* Queue Actions */}
        {queue.length > 0 && (
          <Card className="p-4 flex-shrink-0">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  clearQueue();
                  toast.success('Queue cleared');
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Queue
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}