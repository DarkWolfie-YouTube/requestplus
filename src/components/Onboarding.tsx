import * as React from 'react';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Eye,
  Headphones,
  ListChecks,
  Lock,
  Music2,
  Radio,
  Shield,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { t } from '../i18n';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Button } from './ui/button';

type User = {
  display_name: string;
  profile_image_url: string;
  email: string;
};

type SettingsState = {
  showNotifications: boolean;
  theme: string;
  enableRequests: boolean;
  modsOnly: boolean;
  requestLimitEnabled: boolean;
  requestLimit: number;
  autoPlay: boolean;
  autoAcceptSearchResults: boolean;
  useChannelPoints: boolean;
  telemetryEnabled: boolean;
  platform: string;
  filterExplicit: boolean;
  gtsEnabled: boolean;
  subsOnly: boolean;
  appleMusicAppToken: string;
  ciderApiVersion: '3' | '4';
  ciderV4AppToken: string;
  primarySearchPlatform: string;
  [key: string]: any;
};

interface OnboardingProps {
  user: User | null;
  settings: SettingsState;
  setSettings: React.Dispatch<React.SetStateAction<SettingsState>>;
  overlayPath: string;
  locale?: string;
  onComplete: () => void;
}

const steps = [
  { id: 'welcome', labelKey: 'OOBE_STEP_START', icon: Sparkles },
  { id: 'account', labelKey: 'OOBE_STEP_ACCOUNT', icon: UserRound },
  { id: 'music', labelKey: 'OOBE_STEP_MUSIC', icon: Headphones },
  { id: 'rules', labelKey: 'OOBE_STEP_RULES', icon: ListChecks },
  { id: 'guide', labelKey: 'OOBE_STEP_GUIDE', icon: Check},
];

const platformOptions = [
  {
    value: 'spotify',
    label: 'Spotify',
    descriptionKey: 'OOBE_PLATFORM_SPOTIFY_DESC',
  },
  {
    value: 'youtube',
    label: 'YouTube',
    descriptionKey: 'OOBE_PLATFORM_YOUTUBE_DESC',
  },
  {
    value: 'apple',
    label: 'Apple Music',
    descriptionKey: 'OOBE_PLATFORM_APPLE_DESC',
  },
  {
    value: 'soundcloud',
    label: 'SoundCloud',
    descriptionKey: 'OOBE_PLATFORM_SOUNDCLOUD_DESC',
  },
];

export function Onboarding({
  user,
  settings,
  setSettings,
  overlayPath,
  locale = 'en',
  onComplete,
}: OnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const StepIcon = steps[stepIndex].icon;
  const progress = useMemo(() => ((stepIndex + 1) / steps.length) * 100, [stepIndex]);

  const patchSettings = (patch: Partial<SettingsState>) => {
    setSettings((current) => ({ ...current, ...patch }));
  };

  const connectRequestPlus = () => {
    const api = (window as any).api;
    if (api?.requestPlusLogin) {
      api.requestPlusLogin();
      toast.info(t('OOBE_TOAST_SIGN_IN_OPENING', locale));
    } else if (api?.twitchLogin) {
      api.twitchLogin();
      toast.info(t('OOBE_TOAST_SIGN_IN_OPENING', locale));
    } else {
      toast.error(t('OOBE_TOAST_SIGN_IN_UNAVAILABLE', locale));
    }
  };

  const copyOverlayUrl = async () => {
    if (!overlayPath) return;

    try {
      await navigator.clipboard.writeText(overlayPath);
      setCopied(true);
      toast.success(t('OOBE_TOAST_OVERLAY_COPIED', locale));
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t('OOBE_TOAST_OVERLAY_COPY_FAILED', locale));
    }
  };

  const finish = async () => {
    setIsFinishing(true);
    const nextSettings = {
      ...settings,
      oobeCompleted: true,
    };

    try {
      localStorage.setItem('settings', JSON.stringify(nextSettings));
      localStorage.setItem('requestplus:v3:oobe-complete', 'true');

      const api = (window as any).api;
      if (api?.saveSettings) {
        await api.saveSettings(nextSettings);
      }

      onComplete();
      toast.success(t('OOBE_TOAST_READY', locale));
    } catch (error) {
      console.error('Failed to finish onboarding:', error);
      toast.error(t('OOBE_TOAST_SAVE_FAILED', locale));
      onComplete();
    } finally {
      setIsFinishing(false);
    }
  };

  const goNext = () => {
    if (steps[stepIndex].id === 'account' && !user) {
      toast.error(t('OOBE_TOAST_SIGN_IN_REQUIRED', locale));
      return;
    }

    if (stepIndex === steps.length - 1) {
      void finish();
      return;
    }

    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const goBack = () => {
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  return (
    <div className="relative min-h-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white">
      <div className="absolute inset-0 opacity-25">
        <div className="absolute left-[-10%] top-[8%] h-72 w-72 rounded-full bg-fuchsia-500 blur-3xl" />
        <div className="absolute right-[-8%] top-[20%] h-80 w-80 rounded-full bg-emerald-500 blur-3xl" />
        <div className="absolute bottom-[-16%] left-[28%] h-96 w-96 rounded-full bg-cyan-500 blur-3xl" />
      </div>

      <div className="relative flex min-h-full flex-col px-5 pb-7 pt-12">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <StepIcon className="size-5 text-emerald-200" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-200">{t('OOBE_SETUP_LABEL', locale)}</p>
                <h1 className="text-2xl font-bold tracking-normal">{t('OOBE_TITLE', locale)}</h1>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void finish()}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              {t('OOBE_SKIP', locale)}
            </button>
          </header>

          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-violet-400 to-emerald-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="grid flex-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="hidden rounded-xl border border-white/10 bg-slate-950/40 p-3 lg:block">
              <div className="space-y-2">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const isActive = index === stepIndex;
                  const isDone = index < stepIndex;

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setStepIndex(index)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm ${
                        isActive
                          ? 'bg-white/12 text-white ring-1 ring-white/15'
                          : 'text-slate-400 hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      <span
                        className={`flex size-8 items-center justify-center rounded-lg ${
                          isDone ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10'
                        }`}
                      >
                        {isDone ? <Check className="size-4" /> : <Icon className="size-4" />}
                      </span>
                      {t(step.labelKey, locale)}
                    </button>
                  );
                })}
              </div>
            </aside>

            <main className="rounded-xl border border-white/10 bg-slate-950/45 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
              {stepIndex === 0 && (
                <section className="grid h-full content-center gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-5">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-sm text-emerald-100">
                      <Radio className="size-4" />
                      {t('OOBE_WELCOME_BADGE', locale)}
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-4xl font-bold leading-tight tracking-normal">{t('OOBE_WELCOME_TITLE', locale)}</h2>
                      <p className="max-w-2xl text-base leading-7 text-slate-300">
                        {t('OOBE_WELCOME_DESC', locale)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {[
                      ['OOBE_WELCOME_CARD_SIGN_IN_TITLE', 'OOBE_WELCOME_CARD_SIGN_IN_DESC'],
                      ['OOBE_WELCOME_CARD_PLAYBACK_TITLE', 'OOBE_WELCOME_CARD_PLAYBACK_DESC'],
                      ['OOBE_WELCOME_CARD_RULES_TITLE', 'OOBE_WELCOME_CARD_RULES_DESC'],
                    ].map(([title, body]) => (
                      <div key={title} className="rounded-lg border border-white/10 bg-white/7 p-4">
                        <p className="font-semibold text-white">{t(title, locale)}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{t(body, locale)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {stepIndex === 1 && (
                <section className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-normal">{t('OOBE_ACCOUNT_TITLE', locale)}</h2>
                    <p className="max-w-2xl text-sm leading-6 text-slate-300">
                      {t('OOBE_ACCOUNT_DESC', locale)}
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-white/7 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">{t('OOBE_REQUEST_ACCOUNT_TITLE', locale)}</p>
                          <p className="mt-1 text-sm text-slate-400">
                            {user ? t('OOBE_SIGNED_IN_AS', locale, { name: user.display_name }) : t('OOBE_SIGN_IN_HINT', locale)}
                          </p>
                        </div>
                        <UserRound className="size-5 text-fuchsia-200" />
                      </div>

                      {user ? (
                        <div className="mt-5 flex items-center gap-3 rounded-lg bg-slate-950/55 p-3">
                          <img src={user.profile_image_url} alt="" className="size-11 rounded-full ring-2 ring-emerald-300/40" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{user.display_name}</p>
                            <p className="truncate text-xs text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={connectRequestPlus}
                          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-emerald-500 px-4 font-medium text-white hover:from-fuchsia-500 hover:to-emerald-400"
                        >
                          <UserRound className="size-4" />
                          {t('OOBE_SIGN_IN_BUTTON', locale)}
                        </button>
                      )}
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/7 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">{t('OOBE_OVERLAY_TITLE', locale)}</p>
                          <p className="mt-1 text-sm text-slate-400">{t('OOBE_OVERLAY_DESC', locale)}</p>
                        </div>
                        <Eye className="size-5 text-emerald-200" />
                      </div>

                      <div className="mt-5 flex gap-2">
                        <Input
                          value={overlayPath || t('OOBE_OVERLAY_PLACEHOLDER', locale)}
                          readOnly
                          className="h-11 border-white/10 bg-slate-950/55 font-mono text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={copyOverlayUrl}
                          disabled={!overlayPath}
                          className="flex size-11 items-center justify-center rounded-lg bg-white/10 text-white disabled:opacity-45"
                        >
                          {copied ? <Check className="size-4 text-emerald-200" /> : <Copy className="size-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {stepIndex === 2 && (
                <section className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-normal">{t('OOBE_MUSIC_TITLE', locale)}</h2>
                    <p className="max-w-2xl text-sm leading-6 text-slate-300">
                      {t('OOBE_MUSIC_DESC', locale)}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {platformOptions.map((platform) => {
                      const selected = settings.platform === platform.value;

                      return (
                        <button
                          key={platform.value}
                          type="button"
                          onClick={() => patchSettings({ platform: platform.value })}
                          className={`rounded-lg border p-4 text-left ${
                            selected
                              ? 'border-emerald-300/60 bg-emerald-300/12 shadow-lg shadow-emerald-950/30'
                              : 'border-white/10 bg-white/7 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold">{platform.label}</span>
                            <span className={`flex size-6 items-center justify-center rounded-full ${selected ? 'bg-emerald-300 text-slate-950' : 'bg-white/10 text-slate-500'}`}>
                              {selected && <Check className="size-4" />}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-400">{t(platform.descriptionKey, locale)}</p>
                        </button>
                      );
                    })}
                  </div>

                  {settings.platform === 'apple' && (
                    <div className="rounded-lg border border-white/10 bg-white/7 p-4">
                      <Label className="text-white">{t('OOBE_CIDER_VERSION', locale)}</Label>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {['3', '4'].map((version) => (
                          <button
                            key={version}
                            type="button"
                            onClick={() => patchSettings({ ciderApiVersion: version as '3' | '4' })}
                            className={`rounded-lg px-4 py-3 text-sm font-medium ${
                              settings.ciderApiVersion === version ? 'bg-emerald-300 text-slate-950' : 'bg-slate-950/55 text-slate-200'
                            }`}
                          >
                            Cider {version}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {stepIndex === 3 && (
                <section className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-normal">{t('OOBE_RULES_TITLE', locale)}</h2>
                    <p className="max-w-2xl text-sm leading-6 text-slate-300">
                      {t('OOBE_RULES_DESC', locale)}
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <OobeSwitch
                      icon={Music2}
                      title={t('OOBE_RULE_ENABLE_REQUESTS_TITLE', locale)}
                      description={t('OOBE_RULE_ENABLE_REQUESTS_DESC', locale)}
                      checked={settings.enableRequests}
                      onCheckedChange={(checked) => patchSettings({ enableRequests: checked })}
                    />
                    <OobeSwitch
                      icon={Shield}
                      title={t('OOBE_RULE_MOD_QUEUE_TITLE', locale)}
                      description={t('OOBE_RULE_MOD_QUEUE_DESC', locale)}
                      checked={Boolean(settings.autoPlay)}
                      onCheckedChange={(checked) => patchSettings({ autoPlay: checked })}
                    />
                    <OobeSwitch
                      icon={Lock}
                      title={t('OOBE_RULE_MODS_ONLY_TITLE', locale)}
                      description={t('OOBE_RULE_MODS_ONLY_DESC', locale)}
                      checked={settings.modsOnly}
                      onCheckedChange={(checked) => patchSettings({ modsOnly: checked })}
                    />
                    <OobeSwitch
                      icon={Shield}
                      title={t('OOBE_RULE_FILTER_EXPLICIT_TITLE', locale)}
                      description={t('OOBE_RULE_FILTER_EXPLICIT_DESC', locale)}
                      checked={Boolean(settings.filterExplicit)}
                      onCheckedChange={(checked) => patchSettings({ filterExplicit: checked })}
                    />
                    <OobeSwitch
                      icon={Radio}
                      title={t('OOBE_RULE_TELEMETRY_TITLE', locale)}
                      description={t('OOBE_RULE_TELEMETRY_DESC', locale)}
                      checked={settings.telemetryEnabled}
                      onCheckedChange={(checked) => patchSettings({ telemetryEnabled: checked })}
                    />
                  </div>
                </section>
              )}

              {stepIndex == 4 && (
                <section className="grid h-full content-center gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <h2 className="text-4xl font-bold leading-tight tracking-normal">{t('OOBE_GUIDE_TITLE', locale)}</h2>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    
                      <div key="yes" className="rounded-lg border border-white/10 bg-white/7 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-semibold text-white">
                              Go to our guide to get more help for setup!
                            </p>
                            <p className="mt-1 truncate text-sm leading-6 text-slate-400">
                              https://docs.requestplus.xyz
                            </p>
                          </div>

                          <Button
                            className="primary shrink-0"
                            title="yes"
                            onClick={() => window.api.yesnt('https://docs.requestplus.xyz')}
                          >Open the Guide!</Button>
                        </div>
                      </div>
                    
                  </div>
                </section>
              )}
            </main>
          </div>

          <footer className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0}
              className="flex h-11 items-center gap-2 rounded-lg bg-white/10 px-4 font-medium text-white disabled:opacity-40"
            >
              <ArrowLeft className="size-4" />
              {t('OOBE_BACK', locale)}
            </button>

            <div className="flex gap-1 lg:hidden">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  aria-label={t(step.labelKey, locale)}
                  onClick={() => setStepIndex(index)}
                  className={`size-2.5 rounded-full ${index === stepIndex ? 'bg-emerald-300' : 'bg-white/25'}`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={isFinishing}
              className="flex h-11 items-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-emerald-500 px-5 font-medium text-white shadow-lg hover:from-fuchsia-500 hover:to-emerald-400 disabled:opacity-60"
            >
              {stepIndex === steps.length - 1 ? (isFinishing ? t('OOBE_SAVING', locale) : t('OOBE_FINISH', locale)) : t('OOBE_NEXT', locale)}
              {stepIndex === steps.length - 1 ? <Check className="size-4" /> : <ArrowRight className="size-4" />}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

type OobeSwitchProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

function OobeSwitch({ icon: Icon, title, description, checked, onCheckedChange }: OobeSwitchProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/7 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-950/60 text-emerald-200">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-white">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
