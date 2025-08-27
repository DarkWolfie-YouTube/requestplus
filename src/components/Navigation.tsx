import { Button } from './ui/button';
import { Music, Settings, Home } from 'lucide-react';
import * as React from 'react';
import { useState } from 'react';

interface NavigationProps {
  currentView: 'player' | 'settings';
  onViewChange: (view: 'player' | 'settings') => void;
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
      <div className="flex items-center justify-center max-w-md mx-auto">
        <div className="flex gap-1 p-2">
          <Button
            variant={currentView === 'player' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('player')}
            className="flex-1 gap-2"
          >
            <Music className="h-4 w-4" />
            Player
          </Button>
          
          <Button
            variant={currentView === 'settings' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('settings')}
            className="flex-1 gap-2"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>
    </div>
  );
}