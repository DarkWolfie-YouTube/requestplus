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
    <div className="relative w-full h-full bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-green-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
      </div>

      {/* Content */}
      <div className="relative h-full px-8 flex flex-col overflow-hidden" style={{ paddingTop: '40px', paddingBottom: '70px' }}>
        <div className="max-w-md mx-auto w-full flex flex-col flex-1 gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-purple-500 to-green-500 p-3 rounded-xl">
                <Music className="size-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Queue</h3>
                <p className="text-purple-300 text-sm">
                  {queue.items.length === 0 ? 'No' : queue.items.length} {queue.items.length === 1 ? 'song' : 'songs'}
                </p>
              </div>
            </div>
          </div>

          {/* Queue List */}
          <div className="bg-slate-800/40 backdrop-blur-sm border border-purple-500/20 rounded-xl p-4 flex-1 min-h-0 flex flex-col">
            {queue.items.length === 0 ? (
              <div className="text-center py-12 space-y-3 flex-1 flex flex-col items-center justify-center">
                <div className="size-16 bg-gradient-to-br from-purple-500/30 to-green-500/30 rounded-full flex items-center justify-center">
                  <Music className="h-8 w-8 text-purple-300" />
                </div>
                <div>
                  <h3 className="font-medium text-white">No songs in queue</h3>
                  <p className="text-sm text-gray-400">
                    Songs will appear here when they're requested
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1 -mx-4 px-4">
                <div className="space-y-2">
                  {queue.items.map((track, index) => (
                    <div key={track.id}>
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div 
                            className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-900/70 cursor-pointer transition-all ${
                              track.iscurrentlyPlaying ? 'bg-slate-900/50' : 'bg-slate-900/30'
                            }`}
                            onClick={() => playTrack(track, index)}
                          >
                            {/* Album Art */}
                            <div className="relative">
                              <div className="size-12 bg-gradient-to-br from-purple-500/30 to-green-500/30 rounded flex items-center justify-center overflow-hidden">
                                {track.cover ? (
                                  <ImageWithFallback
                                    src={track.cover}
                                    alt={`${track.title} by ${track.artist}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Music className="size-5 text-purple-300" />
                                )}
                              </div>
                              {track.iscurrentlyPlaying && (
                                <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center">
                                  <Play className="h-4 w-4 text-white fill-white" />
                                </div>
                              )}
                            </div>

                            {/* Track Info */}
                            <div className="flex-1 min-w-0">
                              <h4 className={`font-medium truncate text-sm ${
                                track.iscurrentlyPlaying ? 'text-purple-300' : 'text-white'
                              }`}>
                                {track.title}
                              </h4>
                              <p className="text-xs text-gray-400 truncate">
                                {track.artist}
                              </p>
                            </div>

                            {/* Duration and Status */}
                            <div className="flex items-center gap-2">
                              {track.iscurrentlyPlaying ? (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-300">
                                  Playing
                                </span>
                              ) : track.isQueued ? (
                                <div className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/20">
                                  <Clock className="h-3 w-3 text-green-400" />
                                  <span className="text-xs text-green-400 font-medium">
                                    Queued
                                  </span>
                                </div>
                              ) : null}
                              <span className="text-gray-400 text-xs">{formatDuration(track.duration)}</span>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        
                        <ContextMenuContent className="bg-slate-800 border-purple-500/30">
                          <ContextMenuItem
                            onClick={() => playTrack(track, index)}
                            className="cursor-pointer text-white hover:bg-purple-500/20"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Play Now
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => removeFromQueue(track.id)}
                            className="cursor-pointer text-red-400 hover:bg-red-500/20 focus:text-red-400"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove from Queue
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Queue Actions */}
          {queue.items.length > 0 && (
            <button
              onClick={clearQueue}
              className="bg-slate-700/50 hover:bg-red-500/20 text-red-400 hover:text-red-300 px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear Queue
            </button>
          )}
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
      `}</style>
    </div>
  );
}