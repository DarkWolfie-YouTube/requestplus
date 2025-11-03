import { Button } from './ui/button';
import { Music, Settings, List } from 'lucide-react';
import * as React from 'react';
import { useState } from 'react';

interface NavigationProps {
  currentView: 'player' | 'queue' | 'settings';
  onViewChange: (view: 'player' | 'queue' | 'settings') => void;
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border/50 shadow-card z-50">
      <div className="flex items-center justify-center max-w-md mx-auto px-4">
        <div className="flex gap-2 p-3 w-full">
          <Button
            variant={currentView === 'player' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('player')}
            className={`flex-1 gap-2 h-11 transition-all ${
              currentView === 'player' 
                ? 'shadow-lg hover-glow' 
                : 'hover:bg-accent/60'
            }`}
          >
            <Music className="h-4 w-4" />
            Player
          </Button>
          
          <Button
            variant={currentView === 'queue' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('queue')}
            className={`flex-1 gap-2 h-11 transition-all ${
              currentView === 'queue' 
                ? 'shadow-lg hover-glow' 
                : 'hover:bg-accent/60'
            }`}
          >
            <List className="h-4 w-4" />
            Queue
          </Button>
          
          <Button
            variant={currentView === 'settings' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('settings')}
            className={`flex-1 gap-2 h-11 transition-all ${
              currentView === 'settings' 
                ? 'shadow-lg hover-glow' 
                : 'hover:bg-accent/60'
            }`}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>
    </div>
  );
}