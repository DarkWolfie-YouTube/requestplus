import { useState } from "react";
import { Music, Settings, List, X, Minus, Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat, Repeat1, Volume2, Trash2, Check, Copy, Eye, Headphones, ListChecks, Lock, Radio, Shield, Sparkles, UserRound, ExternalLink, RefreshCw, LogOut, User as UserIcon, ArrowLeft, ArrowRight, Music2 } from "lucide-react";
import { toast } from "sonner";
import { Blobs, Switch } from "./shared";
import type { AppSettings, AppUser } from "./shared";
import { t } from "../../i18n";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-violet-500/15 bg-slate-900/60">
      <div className="border-b border-white/[0.05] px-4 py-2.5">
        <h4 className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-400/80">{title}</h4>
      </div>
      <div className="divide-y divide-white/[0.04]">{children}</div>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-white">{label}</p>
        {desc && <p className="mt-0.5 text-[11px] leading-[1.5] text-slate-600">{desc}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Settings Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export function SettingsView({ settings, setSettings, user, setUser, overlayPath, locale }: {
  settings: AppSettings; setSettings: (s: AppSettings) => void;
  user: AppUser | null; setUser: (u: AppUser | null) => void;
  overlayPath: string; locale: string;
}) {
  const [copied, setCopied] = useState(false);
  const api = () => (window as any).api;
  const p = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);

    try {
      localStorage.setItem("settings", JSON.stringify(next));
    } catch {
      // Local storage is only a fallback for browser-only mode.
    }

    void api()?.saveSettings?.(next).catch((error: unknown) => {
      console.error("Failed to autosave settings:", error);
      toast.error("Could not save settings");
    });
    api()?.settingsUpdated?.(next);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(overlayPath).catch(() => {});
    setCopied(true);
    toast.success("Overlay URL copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const platforms = [
    { value: "spotify", label: "Spotify" },
    { value: "youtube", label: "YouTube (Pear)" },
    { value: "apple", label: "Apple Music (Cider)" },
    { value: "soundcloud", label: "SoundCloud" },
    { value: 'spotube', label: 'Spotify and YouTube (EXPIRMENTAL)', experimental: true },
    
  ];

  const multiPlatformMembers: Record<string, { value: string; label: string }[]> = {
    spotube: [
      { value: 'spotify', label: 'Spotify' },
      { value: 'youtube', label: 'YouTube (Pear)' },
    ],
  };

  const isMultiPlatform = settings.platform in multiPlatformMembers;

  const themes = [
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

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-slate-950">
      <Blobs opacity="opacity-[0.14]" />
      <div className="relative h-full overflow-y-auto no-sb px-5 pb-4 pt-3 space-y-3">

        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 pb-1">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-emerald-600 shadow-lg shadow-violet-900/40">
            <Settings className="size-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{t("SETTINGS_TITLE", locale)}</h3>
            <p className="text-[11px] text-violet-400">Request+</p>
          </div>
        </div>

        {/* Account */}
        <Section title={t("CLIENT_ACCOUNT_TITLE", locale)}>
          {user ? (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-slate-950/60 p-3">
                <img src={user.profile_image_url} alt="" className="size-10 rounded-full ring-2 ring-violet-400/40" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{user.display_name}</p>
                  <p className="truncate text-xs text-slate-600">{user.email}</p>
                  <p className="text-[10px] font-bold text-emerald-400">Connected</p>
                </div>
              </div>
              <button
                onClick={() => { api()?.requestPlusLogout?.(); setUser(null); }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/20"
              >
                <LogOut className="size-3.5" />
                {t("COMMON_LOG_OUT", locale)}
              </button>
            </div>
          ) : (
            <div className="p-4">
              <p className="mb-3 text-xs text-slate-600">Sign in to identify who's requesting songs and enable moderation features.</p>
              <button
                onClick={() => api()?.requestPlusLogin?.()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:from-violet-500 hover:to-emerald-500"
              >
                <UserIcon className="size-4" />
                {t("COMMON_LOG_IN", locale)}
              </button>
            </div>
          )}
        </Section>

        {/* OBS Overlay */}
        {overlayPath && (
          <Section title={t("CLIENT_OVERLAY_URL_TITLE", locale)}>
            <div className="p-4 space-y-2">
              <p className="text-xs text-slate-600">{t("CLIENT_OVERLAY_URL_DESC", locale)}</p>
              <div className="flex gap-2">
                <input
                  readOnly value={overlayPath}
                  className="h-9 flex-1 rounded-xl border border-violet-500/20 bg-slate-950/70 px-3 font-mono text-[11px] text-slate-400 focus:outline-none"
                />
                <button
                  onClick={copy}
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white transition-colors hover:bg-slate-700"
                >
                  {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                </button>
              </div>
            </div>
          </Section>
        )}

        {/* Song Requests */}
        <Section title={t("CLIENT_REQUEST_MGMT_TITLE", locale)}>
          <ToggleRow label={t("CLIENT_ENABLE_REQUESTS", locale)} desc={t("CLIENT_ENABLE_REQUESTS_DESC", locale)} checked={settings.enableRequests} onChange={(v) => p({ enableRequests: v })} />
          <ToggleRow label={t("CLIENT_MODS_ONLY", locale)} desc={t("CLIENT_MODS_ONLY_DESC", locale)} checked={settings.modsOnly} onChange={(v) => p({ modsOnly: v })} />
          <ToggleRow label={t("CLIENT_SUBS_ONLY", locale)} desc={t("CLIENT_SUBS_ONLY_DESC", locale)} checked={settings.subsOnly} onChange={(v) => p({ subsOnly: v })} />
          <ToggleRow label="Per-user Limit" checked={settings.requestLimitEnabled} onChange={(v) => p({ requestLimitEnabled: v })} />
          {settings.requestLimitEnabled && (
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-[13px] font-semibold text-white">Limit per user</p>
              <input
                type="number" min={1} value={settings.requestLimit}
                onChange={(e) => p({ requestLimit: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-16 rounded-xl border border-violet-500/20 bg-slate-950/70 px-2.5 py-1.5 text-right text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          )}
          <ToggleRow label="Auto-accept Search" desc="Accept first search result automatically" checked={!!settings.autoAcceptSearchResults} onChange={(v) => p({ autoAcceptSearchResults: v })} />
        </Section>

        {/* Modules */}
        <Section title="Modules">
          <ToggleRow label="Auto-play Queue" desc="Automatically play next queued song" checked={!!settings.autoPlay} onChange={(v) => p({ autoPlay: v })} />
          <ToggleRow label="GTS Mode" desc="Global shared queue for all viewers" checked={!!settings.gtsEnabled} onChange={(v) => p({ gtsEnabled: v })} />
          {settings.platform !== "youtube" && (
            <ToggleRow label="Filter Explicit" desc="Block explicit content from requests" checked={!!settings.filterExplicit} onChange={(v) => p({ filterExplicit: v })} />
          )}
        </Section>

        {/* Platform */}
        <Section title="Music Platform">
          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Primary Platform</label>
              <select
                value={settings.platform}
                onChange={(e) => {
                  const platform = e.target.value;
                  const members = multiPlatformMembers[platform];
                  const primarySearchPlatform = members
                    ? members.some((member) => member.value === settings.primarySearchPlatform)
                      ? settings.primarySearchPlatform
                      : members[0].value
                    : settings.primarySearchPlatform;
                  p({ platform, primarySearchPlatform });
                }}
                className="w-full rounded-xl border border-violet-500/20 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                {platforms.map((o) => <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>)}
              </select>
            </div>
            {isMultiPlatform && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Primary Search Platform</label>
                <p className="text-[11px] leading-4 text-slate-600">Use this service when a request does not include a direct URL.</p>
                <select
                  value={settings.primarySearchPlatform || multiPlatformMembers[settings.platform][0].value}
                  onChange={(e) => p({ primarySearchPlatform: e.target.value })}
                  className="w-full rounded-xl border border-violet-500/20 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  {multiPlatformMembers[settings.platform].map((option) => (
                    <option key={option.value} value={option.value} className="bg-slate-900">{option.label}</option>
                  ))}
                </select>
              </div>
            )}
            {settings.platform === "apple" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Cider Version</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["3", "4"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => p({ ciderApiVersion: v })}
                      className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                        settings.ciderApiVersion === v
                          ? "bg-gradient-to-r from-violet-600 to-emerald-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      Cider {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Overlay Theme */}
        <Section title="Overlay Theme">
          <div className="p-4">
            <select
              value={settings.theme}
              onChange={(e) => p({ theme: e.target.value })}
              className="w-full rounded-xl border border-violet-500/20 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {themes.map((t) => <option key={t.value} value={t.value} className="bg-slate-900">{t.label}</option>)}
            </select>
          </div>
        </Section>

        {/* Privacy */}
        <Section title="Privacy">
          <ToggleRow label="Anonymous Telemetry" desc="Help improve Request+ with usage data" checked={!!settings.telemetryEnabled} onChange={(v) => p({ telemetryEnabled: v })} />
        </Section>

        {/* About */}
        <Section title="About">
          <div className="p-4 space-y-2.5">
            <p className="text-xs text-slate-600">Version 3.0.0 • Built for streamers by streamers</p>
            <button
              onClick={() => api()?.yesnt?.("https://requestplus.xyz")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-700"
            >
              <ExternalLink className="size-3.5" />
              Visit Website
            </button>
            <button
              onClick={async () => {
                if (api()?.checkForUpdates) await api().checkForUpdates();
                else toast.info("Update check not available in web mode");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800/50 px-4 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
            >
              <RefreshCw className="size-3.5" />
              Check for Updates
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Onboarding Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const STEPS = [
  { id: "welcome", label: "Welcome", icon: Sparkles },
  { id: "account", label: "Account", icon: UserRound },
  { id: "music", label: "Platform", icon: Headphones },
  { id: "rules", label: "Rules", icon: ListChecks },
  { id: "done", label: "Done", icon: Check },
];

const OOBE_PLATFORMS = [
  { value: "spotify", label: "Spotify", desc: "Stream and request songs from Spotify." },
  { value: "youtube", label: "YouTube", desc: "Request songs via YouTube Pear." },
  { value: "apple", label: "Apple Music", desc: "Use Cider for Apple Music integration." },
  { value: "soundcloud", label: "SoundCloud", desc: "Request tracks from SoundCloud." },
];
