import * as React from 'react';
import { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Copy, Check, ExternalLink, User, LogOut, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Command as CommandPrimitive } from 'cmdk';

interface Userd {
  display_name: string;
  profile_image_url: string;
  email: string;
}

interface UpdateSettings {
  checkPreReleases: boolean;
}

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
  gtsEnabled: boolean;
  subsOnly: boolean;
  appleMusicAppToken: string;
}

interface SettingsProps {
  userd: Userd | null;
  setUserd: (user: Userd | null) => void;
  overlayPath: string;
  updateSettings: UpdateSettings;
  setUpdateSettings: (settings: UpdateSettings) => void;
  settings: SettingsState;
  setSettings: (settings: SettingsState) => void;
  expermintalFeatureEnabled: boolean;
  setExperimentalFeatureEnabled: (enabled: boolean) => void;
}

export function Settings({ 
  userd, 
  setUserd,
  overlayPath, 
  updateSettings, 
  setUpdateSettings, 
  settings, 
  setSettings,
  expermintalFeatureEnabled,
  setExperimentalFeatureEnabled 
}: SettingsProps) {
  const [copied, setCopied] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const themeOptions = [
    { value: 'default', label: 'Default' },
    { value: 'custom', label: 'Custom (CHECK THE WIKI)' },
    { value: 'gojo', label: 'Gojo' },
    { value: 'hologram', label: 'Hologram' },
    { value: 'mdev', label: 'MDev' },
    { value: 'moonkingbean', label: 'MoonKingBean' },
    { value: 'twinGhost', label: 'TwinGhost' },
    { value: 'nowplaying-default', label: 'NowPlaying (Default)' },
    { value: 'nowplaying-custom', label: 'NowPlaying (Custom)' },
    { value: 'nowplaying-gojo', label: 'NowPlaying (Gojo)' },
    { value: 'nowplaying-hologram', label: 'NowPlaying (Hologram)' },
    { value: 'nowplaying-mdev', label: 'NowPlaying (MDev)' },
    { value: 'nowplaying-moonkingbean', label: 'NowPlaying (MoonKingBean)' },
    { value: 'nowplaying-twinGhost', label: 'NowPlaying (TwinGhost)' }
  ];
  const platformOptions = [
    { value: 'spotify', label: 'Spotify', experimental: false },
    { value: 'apple', label: 'Apple Music (Cider)', experimental: false },
    { value: 'youtube', label: 'YouTube (Pear)', experimental: true },
    { value: 'soundcloud', label: 'SoundCloud (EXPIRMENTAL)', experimental: true }
  ];

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('URL copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy URL');
    }
  };

  const handleTwitchLogin = () => {
    if (typeof window !== 'undefined' && (window as any).api?.twitchLogin) {
      (window as any).api.twitchLogin();
    }
  };

  const handleTwitchLogout = () => {
    if (typeof window !== 'undefined' && (window as any).api?.twitchLogout) {
      (window as any).api.twitchLogout();
      setUserd(null);
    }
  };

  const saveSettings = async () => {
    console.log('Saving settings:', settings);
    
    let success = false;
    
    // Try to save via Electron API first
    if (typeof window !== 'undefined' && (window as any).api?.saveSettings) {
      try {
        success = await (window as any).api.saveSettings(settings);
        console.log('Electron save result:', success);
      } catch (err) {
        console.error('Failed to save via Electron:', err);
      }
    }
    
    // Also save to localStorage as backup
    try {
      localStorage.setItem('settings', JSON.stringify(settings));
      success = true;
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }

    // Send settings to main process for real-time updates
    if (typeof window !== 'undefined' && (window as any).api?.sendSettings) {
      try {
        (window as any).api.sendSettings(settings);
      } catch (err) {
        console.error('Failed to send settings to main process:', err);
      }
    }

    if (success) {
      setSettingsSaved(true);
      toast.success('Settings saved successfully!');
      setTimeout(() => setSettingsSaved(false), 3000);
    } else {
      toast.error('Failed to save settings');
    }
  };

  const handlePreReleaseChange = async (checked: boolean) => {
    const newUpdateSettings = { ...updateSettings, checkPreReleases: checked };
    setUpdateSettings(newUpdateSettings);
    
    if (typeof window !== 'undefined' && (window as any).api?.setPreReleaseCheck) {
      await (window as any).api.setPreReleaseCheck(checked);
    }
  };

  const checkForUpdates = async () => {
    if (typeof window !== 'undefined' && (window as any).api?.checkForUpdates) {
      await (window as any).api.checkForUpdates();
    } else {
      toast.error('Update check not available in web mode');
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

      {/* Content — pushed down 32px, stops scrolling 61px above the bottom */}
      <div className="relative h-full overflow-y-auto px-6" style={{ paddingTop: '40px', paddingBottom: '70px' }}>
        <div className="max-w-md mx-auto space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-gradient-to-r from-purple-500 to-green-500 p-3 rounded-xl">
              <User className="size-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Settings</h3>
              <p className="text-purple-300 text-sm">Configure your Request+ experience</p>
            </div>
          </div>

          {/* Twitch Account Section */}
          <div className="bg-slate-800/60 backdrop-blur-sm border border-purple-500/30 rounded-xl p-5 space-y-4">
            <div className="space-y-1">
              <Label className="text-white">Request+ Account</Label>
              <p className="text-sm text-gray-400">
                Connect your Request+ account to manage requests and overlays
              </p>
            </div>

            {userd ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
                  <img 
                    src={userd.profile_image_url} 
                    alt="Profile" 
                    className="w-12 h-12 rounded-full ring-2 ring-purple-400/50"
                  />
                  <div className="flex-1">
                    <h4 className="text-white font-medium">{userd.display_name}</h4>
                    <p className="text-sm text-gray-400">{userd.email}</p>
                    <p className="text-xs text-green-400">Connected</p>
                  </div>
                </div>
                <button onClick={handleTwitchLogout} className="w-full bg-slate-700/50 hover:bg-red-500/20 text-red-400 hover:text-red-300 px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : (
              <button onClick={handleTwitchLogin} className="w-full bg-gradient-to-r from-purple-600 to-green-600 hover:from-purple-500 hover:to-green-500 text-white px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2">
                <User className="h-4 w-4" />
                Login
              </button>
            )}
          </div>

          {/* OBS Overlay Section */}
          {overlayPath && (
            <div className="bg-slate-800/60 backdrop-blur-sm border border-purple-500/30 rounded-xl p-5 space-y-3">
              <div className="space-y-1">
                <Label className="text-white">OBS Overlay URL</Label>
                <p className="text-sm text-gray-400">
                  Add this as a Browser Source in OBS
                </p>
              </div>
              
              <div className="flex gap-2">
                <Input
                  value={overlayPath}
                  readOnly
                  className="flex-1 bg-slate-900/50 border-purple-500/30 text-white font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(overlayPath)}
                  className="bg-slate-700/50 hover:bg-slate-600/50 text-white p-2 rounded-lg transition-all"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Request Management */}
          <div className="bg-slate-800/60 backdrop-blur-sm border border-purple-500/30 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-white font-medium">Request Management</h3>
              <p className="text-sm text-gray-400">
                Control how song requests work
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-white">Enable Requests</Label>
                  <p className="text-xs text-gray-400">
                    Allow viewers to request songs
                  </p>
                </div>
                <Switch
                  checked={settings.enableRequests}
                  onCheckedChange={(checked) => 
                    setSettings({...settings, enableRequests: checked})
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-white">Moderators Only</Label>
                  <p className="text-xs text-gray-400">
                    Only allow mods to request songs
                  </p>
                </div>
                <Switch
                  checked={settings.modsOnly}
                  onCheckedChange={(checked) => 
                    setSettings({...settings, modsOnly: checked})
                  }
                />
              </div>
              
              <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-white">Subscribers Only</Label>
                  <p className="text-xs text-gray-400">
                    Only allow subscribers and mods to request songs
                  </p>
                </div>
                <Switch
                  checked={settings.subsOnly}
                  onCheckedChange={(checked) => 
                    setSettings({...settings, subsOnly: checked})
                  }
                />
              </div>

              {/* <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-white">Guess The Song</Label>
                  <p className="text-xs text-gray-400">
                    Allow Chat to earn points
                  </p>
                </div>
                <Switch
                  checked={settings.gtsEnabled}
                  onCheckedChange={(checked) => 
                    setSettings({...settings, gtsEnabled: checked})
                  }
                />
              </div> */}

              { settings.platform !== 'youtube' && (
                <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-white">Moderation Queue</Label>
                    <p className="text-xs text-gray-400">
                      Manual song approval
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoPlay || false}
                    onCheckedChange={(checked) => 
                      setSettings({...settings, autoPlay: checked})
                    }
                  />
                </div>
              )}

              {/* { settings.platform !== 'youtube' && (
                <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-white">Allow Explicit Songs</Label>
                    <p className="text-xs text-gray-400">
                      Filter explicit content
                    </p>
                  </div>
                  <Switch
                    checked={settings.filterExplicit || false}
                    onCheckedChange={(checked) => 
                      setSettings({...settings, filterExplicit: checked})
                    }
                  />
                </div>
              )} */}
            </div>
          </div>

          {/* Overlay Settings */}
          <div className="bg-slate-800/60 backdrop-blur-sm border border-purple-500/30 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-white font-medium">Overlay Settings</h3>
              <p className="text-sm text-gray-400">
                Customize the visual appearance
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-white" htmlFor="theme">Theme</Label>
              <Select
                value={settings.theme}
                onValueChange={(value) => setSettings({...settings, theme: value})}
              >
                <SelectTrigger className="bg-slate-900/50 border-purple-500/30 text-white">
                  <SelectValue placeholder="Select a theme" />
                </SelectTrigger>
                <SelectContent position="item-center" align="center" sideOffset={4} sticky="always" side="bottom" className="bg-slate-800 border-purple-500/30">
                  {themeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-white hover:bg-purple-500/20">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

         {/* Platform Settings */}
          <div className="bg-slate-800/60 backdrop-blur-sm border border-purple-500/30 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-white font-medium">Platform Settings</h3>
              <p className="text-sm text-gray-400">
                Customize the platform-specific behavior
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-white" htmlFor="platform">Main Platform</Label>
                <Select
                  value={settings.platform}
                  onValueChange={(value) => setSettings({...settings, platform: value})}
                >
                  <SelectTrigger className="bg-slate-900/50 border-purple-500/30 text-white">
                    <SelectValue placeholder="Select a platform" />
                  </SelectTrigger>
                  <SelectContent position="item-center" className="bg-slate-800 border-purple-500/30">
                    {expermintalFeatureEnabled ? (
                      platformOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-white hover:bg-purple-500/20">
                          {option.label}
                        </SelectItem>
                      ))
                    ) : (
                      platformOptions
                        .filter((option) => option.experimental === false)
                        .map((option) => (
                          <SelectItem key={option.value} value={option.value} className="text-white hover:bg-purple-500/20">
                            {option.label}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              { settings.platform === 'apple' && (
                <div className="space-y-2">
                  <Label className="text-white" htmlFor="appleMusicToken">Cider API Token</Label>
                  <Input
                    id="appleMusicToken"
                    type="text"
                    placeholder="Enter your Apple Music API Token"
                    value={settings.appleMusicAppToken || ''}
                    onChange={(e) => 
                      setSettings({...settings, appleMusicAppToken: e.target.value})
                    }
                    className="bg-slate-900/50 border-purple-500/30 text-white placeholder:text-gray-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="bg-slate-800/60 backdrop-blur-sm border border-purple-500/30 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-white font-medium">Privacy</h3>
              <p className="text-sm text-gray-400">
                Control what data is shared
              </p>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-white">Telemetry Data</Label>
                <p className="text-xs text-gray-400">
                  Help improve Request+
                </p>
              </div>
              <Switch
                checked={settings.telemetryEnabled || false}
                onCheckedChange={(checked) => 
                  setSettings({...settings, telemetryEnabled: checked})
                }
              />
            </div>
          </div>

          {/* Updates Section */}
          <div className="bg-slate-800/60 backdrop-blur-sm border border-purple-500/30 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-white font-medium">Updates</h3>
              <p className="text-sm text-gray-400">
                Manage application updates
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2 p-3 bg-slate-900/30 rounded-lg">
                <Checkbox
                  id="preReleases"
                  checked={updateSettings.checkPreReleases}
                  onCheckedChange={handlePreReleaseChange}
                />
                <div className="grid gap-0.5 leading-none">
                  <Label htmlFor="preReleases" className="text-sm text-white">
                    Include pre-release versions
                  </Label>
                  <p className="text-xs text-gray-400">
                    Pre-releases may contain experimental features
                  </p>
                </div>
              </div>

              <button onClick={checkForUpdates} className="w-full bg-slate-700/50 hover:bg-slate-600/50 text-white px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Check for Updates
              </button>
            </div>
          </div>

          {/* Save Settings Button */}
          <button onClick={saveSettings} className="w-full bg-gradient-to-r from-purple-600 to-green-600 hover:from-purple-500 hover:to-green-500 text-white px-4 py-3 rounded-lg transition-all shadow-lg font-medium">
            Save Settings
          </button>
          {settingsSaved && (
            <p className="text-sm text-green-400 text-center animate-fade-in">
              ✓ Settings saved successfully!
            </p>
          )}

          {/* About Section */}
          <div className="bg-slate-800/60 backdrop-blur-sm border border-purple-500/30 rounded-xl p-5 space-y-3">
            <div>
              <h3 className="text-white font-medium">About Request+</h3>
              <p className="text-sm text-gray-400">
                Version 2.0.1 • Built for streamers by streamers
              </p>
            </div>

            <button onClick={() => window.open('https://requestplus.xyz', '_blank')} className="w-full bg-slate-700/50 hover:bg-slate-600/50 text-white px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Visit requestplus.xyz
            </button>
          </div>
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