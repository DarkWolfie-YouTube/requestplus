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

interface User {
  display_name: string;
  profile_image_url: string;
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
}

interface SettingsProps {
  twitchUser: User | null;
  setTwitchUser: (user: User | null) => void;
  kickUser: User | null;
  setKickUser: (user: User | null) => void;
  overlayPath: string;
  updateSettings: UpdateSettings;
  setUpdateSettings: (settings: UpdateSettings) => void;
  settings: SettingsState;
  setSettings: (settings: SettingsState) => void;
}

export function Settings({ 
  twitchUser, 
  setTwitchUser,
  kickUser,
  setKickUser, 
  overlayPath, 
  updateSettings, 
  setUpdateSettings, 
  settings, 
  setSettings 
}: SettingsProps) {
  const [copied, setCopied] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const themeOptions = [
    { value: 'default', label: 'Default' },
    { value: 'custom', label: 'Custom (CHECK THE WIKI)' },
    { value: 'gojo', label: 'Gojo' },
    { value: 'hologram', label: 'Hologram' },
    { value: 'ichinyan', label: 'Ichinyan' },
    { value: 'mdev', label: 'MDev' },
    { value: 'moonkingbean', label: 'MoonKingBean' },
    { value: 'twinGhost', label: 'TwinGhost' }
  ];
  const platformOptions = [
    { value: 'spotify', label: 'Spotify' },
    { value: 'youtube', label: 'YouTube' },
    // { value: 'soundcloud', label: 'SoundCloud' }
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
      setTwitchUser(null);
    }
  };
  const handleKickLogin = () => {
    if (typeof window !== 'undefined' && (window as any).api?.kickLogin) {
      (window as any).api.kickLogin();
    }
  };

  const handleKickLogout = () => {
    if (typeof window !== 'undefined' && (window as any).api?.kickLogout) {
      (window as any).api.kickLogout();
      setKickUser(null);
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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-md mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-2 py-4">
          <h1 className="text-3xl">Settings</h1>
          <p className="text-muted-foreground text-lg">Configure your Request+ experience</p>
        </div>

        {/* Twitch Account Section */}
        <Card className="p-6 space-y-6 shadow-card border-border/50">
          <div className="space-y-2">
            <Label className="text-lg">Streaming Accounts</Label>
            <p className="text-sm text-muted-foreground/80">
              Connect your streaming accounts to manage requests
            </p>
          </div>

          {twitchUser ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-accent/30 rounded-lg">
                <img 
                  src={twitchUser.profile_image_url} 
                  alt="Profile" 
                  className="w-14 h-14 rounded-full ring-2 ring-primary/50"
                />
                <div className="flex-1">
                  <h4 className="mb-1">Twitch</h4>
                  <p>{twitchUser.display_name}</p>
                  <p className="text-sm text-muted-foreground">Connected</p>
                </div>
              </div>
              <Button variant="outline" onClick={handleTwitchLogout} className="w-full hover-lift">
                <LogOut className="h-4 w-4 mr-2" />
                Logout from Twitch
              </Button>
            </div>
          ) : (
            <Button onClick={handleTwitchLogin} className="w-full hover-lift">
              <User className="h-4 w-4 mr-2" />
              Login with Twitch
            </Button>
          )}
          <Separator className="my-4" />
          {kickUser ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-accent/30 rounded-lg">
                <img 
                  src={kickUser.profile_image_url} 
                  alt="Profile" 
                  className="w-14 h-14 rounded-full ring-2 ring-primary/50"
                />
                <div className="flex-1">
                  <h4 className="mb-1">Kick</h4>
                  <p>{kickUser.display_name}</p>
                  <p className="text-sm text-muted-foreground">Connected</p>
                </div>
              </div>
              <Button variant="outline" onClick={handleKickLogout} className="w-full hover-lift">
                <LogOut className="h-4 w-4 mr-2" />
                Logout from Kick
              </Button>
            </div>
          ) : (
            <Button onClick={handleKickLogin} className="w-full hover-lift">
              <User className="h-4 w-4 mr-2" />
              Login with Kick
            </Button>
          )}
        </Card>

        {/* OBS Overlay Section */}
        {overlayPath && (
          <Card className="p-6 space-y-4 shadow-card border-border/50">
            <div className="space-y-2">
              <Label className="text-lg">OBS Overlay URL</Label>
              <p className="text-sm text-muted-foreground/80">
                Add this as a Browser Source in OBS
              </p>
            </div>
            
            <div className="flex gap-2">
              <Input
                value={overlayPath}
                readOnly
                className="flex-1 bg-input-background border-border/50 font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(overlayPath)}
                className="hover-lift flex-shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Request Management */}
        <Card className="p-6 space-y-6 shadow-card border-border/50">
          <div>
            <h3 className="text-lg">Request Management</h3>
            <p className="text-sm text-muted-foreground/80">
              Control how song requests work
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Enable Requests</Label>
                <p className="text-sm text-muted-foreground">
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

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Moderators Only</Label>
                <p className="text-sm text-muted-foreground">
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

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Guess The song</Label>
                <p className="text-sm text-muted-foreground">
                  Allow Chat to earn points based on if they get the song correct before 30 seconds pass.
                </p>
              </div>
              <Switch
                checked={settings.gtsEnabled}
                onCheckedChange={(checked) => 
                  setSettings({...settings, gtsEnabled: checked})
                }
              />
            </div>

            <Separator />
            { settings.platform === 'spotify' && (
            <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Moderation Queue</Label>
                <p className="text-sm text-muted-foreground">
                  Doesn't auto play the next song as requested songs go to seperate queue, songs stored in this queue are auto played when the current song ends. 
                </p>
              </div>
              <Switch
                checked={settings.autoPlay || false}
                onCheckedChange={(checked) => 
                  setSettings({...settings, autoPlay: checked})
                }
              />
            </div>
            </div>
            )}
            <Separator />
            { settings.platform === 'spotify' && (
            <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Allow Explicit Songs</Label>
                <p className="text-sm text-muted-foreground">
                  Allow explicit songs to be played, if this is off explicit songs will be moderated and not added to the queue. (REQUIRES MODERATION QUEUE)
                </p>
              </div>
              <Switch
                checked={settings.filterExplicit || false}
                onCheckedChange={(checked) => 
                  setSettings({...settings, filterExplicit: checked})
                }
              />
            </div>
            
            </div>
            )}
            

            
          </div>
        </Card>

        {/* Overlay Settings */}
        <Card className="p-6 space-y-6 shadow-card border-border/50">
          <div>
            <h3 className="text-lg">Overlay Settings</h3>
            <p className="text-sm text-muted-foreground/80">
              Customize the visual appearance
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select
                value={settings.theme}
                onValueChange={(value) => setSettings({...settings, theme: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a theme" />
                </SelectTrigger>
                <SelectContent>
                  {themeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

       {/* Platform Settings */}
        <Card className="p-6 space-y-6 shadow-card border-border/50">
          <div>
            <h3 className="text-lg">Platform Settings</h3>
            <p className="text-sm text-muted-foreground/80">
              Customize the platform-specific behavior
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select
                value={settings.platform}
                onValueChange={(value) => setSettings({...settings, platform: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a platform" />
                </SelectTrigger>
                <SelectContent>
                  {platformOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Notification Settings */}
        <Card className="p-6 space-y-6 shadow-card border-border/50">
          <div>
            <h3 className="text-lg">Notifications</h3>
            <p className="text-sm text-muted-foreground/80">
              Manage how you receive updates
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>New request notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when someone requests a song via a toast.
              </p>
            </div>
            <Switch
              checked={settings.showNotifications}
              onCheckedChange={(checked) => 
                setSettings({...settings, showNotifications: checked})
              }
            />
          </div>
        </Card>

        {/* Privacy Settings */}
        <Card className="p-6 space-y-6 shadow-card border-border/50">
          <div>
            <h3 className="text-lg">Privacy</h3>
            <p className="text-sm text-muted-foreground/80">
              Control what data is shared
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Telemetry Data</Label>
              <p className="text-sm text-muted-foreground">
                Help improve Request+ by sharing anonymous usage data | Requires a restart to take effect.
              </p>
            </div>
            <Switch
              checked={settings.telemetryEnabled || false}
              onCheckedChange={(checked) => 
                setSettings({...settings, telemetryEnabled: checked})
              }
            />
          </div>
        </Card>

        {/* Updates Section */}
        <Card className="p-6 space-y-6 shadow-card border-border/50">
          <div>
            <h3 className="text-lg">Updates</h3>
            <p className="text-sm text-muted-foreground/80">
              Manage application updates
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="preReleases"
                checked={updateSettings.checkPreReleases}
                onCheckedChange={handlePreReleaseChange}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="preReleases" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Include pre-release versions
                </Label>
                <p className="text-xs text-muted-foreground">
                  Pre-releases may contain experimental features and bugs
                </p>
              </div>
            </div>

            <Button onClick={checkForUpdates} variant="outline" className="w-full hover-lift">
              <RefreshCw className="h-4 w-4 mr-2" />
              Check for Updates
            </Button>
          </div>
        </Card>

        {/* Save Settings Button */}
        <Card className="p-6 shadow-card border-border/50">
          <Button onClick={saveSettings} className="w-full hover-lift shadow-lg hover-glow">
            Save Settings
          </Button>
          {settingsSaved && (
            <p className="text-sm text-green-500 text-center mt-3 animate-fade-in">
              ✓ Settings saved successfully!
            </p>
          )}
        </Card>

        {/* About Section */}
        <Card className="p-6 space-y-4 shadow-card border-border/50">
          <div>
            <h3 className="text-lg">About Request+</h3>
            <p className="text-sm text-muted-foreground/80">
              Version 1.1.1 • Built for streamers by streamers
            </p>
          </div>

          <Button variant="outline" className="w-full hover-lift" onClick={() => window.open('https://requestplus.xyz', '_blank')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Visit requestplus.xyz
          </Button>
        </Card>
      </div>
    </div>
  );
}