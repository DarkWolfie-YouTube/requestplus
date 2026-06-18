import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { Toaster } from './components/ui/sonner';
import { Topbar } from './components/Topbar';
import { Onboarding } from './components/Onboarding';
import { t } from './i18n';

type OobeUser = {
  display_name: string;
  profile_image_url: string;
  email: string;
};

const defaultSettings = {
  showNotifications: true,
  theme: 'default',
  enableRequests: true,
  modsOnly: false,
  requestLimitEnabled: false,
  requestLimit: 10,
  autoPlay: false,
  autoAcceptSearchResults: false,
  useChannelPoints: false,
  telemetryEnabled: true,
  platform: 'spotify',
  filterExplicit: false,
  gtsEnabled: false,
  subsOnly: false,
  appleMusicAppToken: '',
  ciderApiVersion: '3' as const,
  ciderV4AppToken: '',
  primarySearchPlatform: 'spotify',
};

function OobeApp() {
  const [settings, setSettings] = useState(defaultSettings);
  const [overlayPath, setOverlayPath] = useState('');
  const [user, setUser] = useState<OobeUser | null>(null);
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    const api = (window as any).api;
    const loadUser = async () => {
      const userData = await api?.fetchUserData?.();
      setUser(userData || null);
    };

    api?.loadSettings?.().then((loadedSettings: any) => {
      if (loadedSettings) {
        setSettings((current) => ({
          ...current,
          ...loadedSettings,
          ciderApiVersion: loadedSettings.ciderApiVersion ?? current.ciderApiVersion,
        }));
      }
    });

    api?.yes?.().then((path: string) => {
      if (path) setOverlayPath(path);
    });

    api?.getLocale?.().then((loadedLocale: string) => {
      if (loadedLocale) setLocale(loadedLocale);
    });

    api?.onLocaleUpdate?.((loadedLocale: string) => {
      if (loadedLocale) setLocale(loadedLocale);
    });

    api?.authSuccess?.((response: any) => {
      if (response?.status === 'started') return;
      if (response?.status === 'logged-out' || response?.status === 'error') {
        setUser(null);
        return;
      }

      if (response?.user) {
        setUser(response.user);
        return;
      }

      void loadUser();
    });

    api?.authCheck?.((isAuthenticated: boolean) => {
      if (isAuthenticated) {
        void loadUser();
      } else {
        setUser(null);
      }
    });

    void api?.authChecker?.();
    void loadUser();
  }, []);

  const completeOnboarding = async () => {
    const nextSettings = { ...settings, oobeCompleted: true };
    localStorage.setItem('settings', JSON.stringify(nextSettings));
    localStorage.setItem('requestplus:v3:oobe-complete', 'true');

    const api = (window as any).api;
    if (api?.completeOnboarding) {
      await api.completeOnboarding(nextSettings);
      return;
    }

    await api?.saveSettings?.(nextSettings);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <Topbar title={t('OOBE_TOPBAR_TITLE', locale)} />
      <div className="h-full pt-8">
        <Onboarding
          user={user}
          settings={settings}
          setSettings={setSettings}
          overlayPath={overlayPath}
          locale={locale}
          onComplete={() => void completeOnboarding()}
        />
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<OobeApp />);
}
