import { Button } from './ui/button';
import { Music, Settings, List } from 'lucide-react';
import * as React from 'react';
import { useState } from 'react';



interface SettingsState {
  showNotifications: boolean;
  theme: string;
  enableRequests: boolean;
  modsOnly: boolean;
  requestLimit: number;
  autoPlay: boolean;
  platform: string;
  filterExplicit: boolean;
  telemetryEnabled: boolean;
}
interface NavigationProps {
  currentView: 'player' | 'queue' | 'settings';
  onViewChange: (view: 'player' | 'queue' | 'settings') => void;
  settings: SettingsState;
}

export function Navigation({ currentView, onViewChange, settings}: NavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-800/80 backdrop-blur-lg border-t border-purple-500/30 shadow-lg z-50">
      <div className="flex items-center justify-center max-w-md mx-auto px-4">
        <div className="flex gap-2 p-3 w-full">
          <button
            onClick={() => onViewChange('player')}
            className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-lg transition-all font-medium ${
              currentView === 'player' 
                ? 'bg-gradient-to-r from-purple-600 to-green-600 text-white shadow-lg' 
                : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Music className="h-4 w-4" />
            Player
          </button>
          
          { settings.platform !== 'youtube' && settings.autoPlay !== false && (
            <button
              onClick={() => onViewChange('queue')}
              className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-lg transition-all font-medium ${
                currentView === 'queue' 
                  ? 'bg-gradient-to-r from-purple-600 to-green-600 text-white shadow-lg' 
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <List className="h-4 w-4" />
              Queue
            </button>
          )}
          
          <button
            onClick={() => onViewChange('settings')}
            className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-lg transition-all font-medium ${
              currentView === 'settings' 
                ? 'bg-gradient-to-r from-purple-600 to-green-600 text-white shadow-lg' 
                : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}