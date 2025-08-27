import * as React from 'react';
import { useState, useEffect } from 'react';
import { X, Minus } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface TopbarProps {
  title?: string;
  onMinimize?: () => void;
  onClose?: () => void;
}

export function Topbar({ 
  title = 'Request+', 
  onMinimize, 
  onClose 
}: TopbarProps) {
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).api?.showToast) {
      const api = (window as any).api;
      
      const handleToast = (message: string, type: string, duration: number) => {
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
            toast.info(message, { duration });
            break;
          default:
            toast(message, { duration });
            break;
        }
      };
      
      api.showToast(handleToast);
    }
  }, []);

  const handleMinimize = () => {
    if (onMinimize) {
      onMinimize();
    } else if (typeof window !== 'undefined' && (window as any).api?.minimize) {
      (window as any).api.minimize();
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (typeof window !== 'undefined' && (window as any).api?.close) {
      (window as any).api.close();
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-8 bg-secondary/50 border-b border-border select-none">
      {/* Draggable area */}
      <div 
        className="flex-1 h-full flex items-center px-3 cursor-move"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <span className="text-sm font-medium text-foreground/80">
          {title}
        </span>
      </div>

      {/* Control buttons */}
      <div 
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-12 rounded-none hover:bg-muted/50 text-foreground/60 hover:text-foreground"
          onClick={handleMinimize}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-12 rounded-none hover:bg-destructive hover:text-destructive-foreground text-foreground/60"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}