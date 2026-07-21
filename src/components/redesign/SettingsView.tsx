import { useEffect, useState } from "react";
import { Music, Settings, List, X, Minus, Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat, Repeat1, Volume2, Trash2, Check, Copy, Eye, Headphones, ListChecks, Lock, Radio, Shield, Sparkles, UserRound, ExternalLink, RefreshCw, LogOut, User as UserIcon, ArrowLeft, ArrowRight, Music2 } from "lucide-react";
import { toast } from "sonner";
import { Blobs, Switch } from "./shared";
import type { AppSettings, AppUser } from "./shared";
import { t } from "../../i18n";

export function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-violet-500/15 bg-slate-900/60">
      <div className="border-b border-white/[0.05] px-4 py-2.5">
        <h4 className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-400/80">{title}</h4>
        {desc && <p className="text-[11px] leading-[1.5] text-slate-600">{desc}</p>}
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
  const [channelPointId, setChannelPointId] = useState<string | null>(null);
  const [channelPointLoading, setChannelPointLoading] = useState(false);
  const [channelPointSaving, setChannelPointSaving] = useState(false);
  const [ciderTokenLoading, setCiderTokenLoading] = useState(false);
  const [channelPointForm, setChannelPointForm] = useState({
    title: "Song Requests",
    prompt: "Redeem this to request a song through Request+.",
    color: "#9146ff",
    cooldown: 30,
  });
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
      toast.error(t("CLIENT_SETTINGS_SAVE_FAILED", locale));
    });
    api()?.settingsUpdated?.(next);
  };

  const requestCiderV4Token = async () => {
    if (!api()?.requestCiderToken) {
      toast.error(t("CLIENT_CIDER_TOKEN_REQUEST_UNAVAILABLE", locale));
      return;
    }

    setCiderTokenLoading(true);
    try {
      toast.info(t("CLIENT_CIDER_APPROVAL_PROMPT", locale));
      const token = await api().requestCiderToken();
      if (!token) throw new Error("Cider did not return a token.");
      p({ platform: "apple", ciderApiVersion: "4", ciderV4AppToken: token });
      toast.success(t("CLIENT_CIDER_CONNECTED", locale));
    } catch (error) {
      console.error("Failed to request Cider 4 token:", error);
      toast.error(error instanceof Error ? error.message : t("CLIENT_CIDER_CONNECT_FAILED", locale));
    } finally {
      setCiderTokenLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(overlayPath);
      setCopied(true);
      toast.success(t("CLIENT_OVERLAY_URL_COPIED", locale));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("CLIENT_OVERLAY_URL_COPY_FAILED", locale));
    }
  };

  const refreshChannelPoint = async () => {
    if (!api()?.getChannelPointReward) return;
    setChannelPointLoading(true);
    try {
      const response = await api().getChannelPointReward();
      setChannelPointId(
        response?.type === "channel_point_response" && response?.message === "ok" && response?.data
          ? response.data
          : null,
      );
    } catch (error) {
      console.error("Failed to load channel point reward:", error);
      setChannelPointId(null);
      toast.error(t("CLIENT_CHANNEL_POINTS_LOAD_FAILED", locale));
    } finally {
      setChannelPointLoading(false);
    }
  };

  useEffect(() => {
    if (settings.useChannelPoints) void refreshChannelPoint();
  }, [settings.useChannelPoints]);

  const createChannelPoint = async () => {
    const title = channelPointForm.title.trim();
    if (!title || !api()?.createChannelPointReward) {
      if (!title) toast.error(t("CLIENT_CHANNEL_POINTS_TITLE_REQUIRED", locale));
      return;
    }

    setChannelPointSaving(true);
    try {
      const response = await api().createChannelPointReward({
        title,
        description: channelPointForm.prompt.trim(),
        color: channelPointForm.color || "#9146ff",
        cooldown: Math.max(0, Number(channelPointForm.cooldown) || 0),
      });
      if (response?.type !== "channel_point_success" || response?.status !== "ok") {
        throw new Error(response?.error || "Channel point create failed");
      }
      toast.success(t("CLIENT_CHANNEL_POINTS_CREATED", locale));
      await refreshChannelPoint();
    } catch (error) {
      console.error("Failed to create channel point reward:", error);
      toast.error(error instanceof Error ? error.message : t("CLIENT_CHANNEL_POINTS_CREATE_FAILED", locale));
    } finally {
      setChannelPointSaving(false);
    }
  };

  const deleteChannelPoint = async () => {
    if (!channelPointId || !api()?.deleteChannelPointReward) return;
    setChannelPointSaving(true);
    try {
      const response = await api().deleteChannelPointReward(channelPointId);
      if (response?.type !== "channel_point_success") {
        throw new Error(response?.error || "Channel point delete failed");
      }
      setChannelPointId(null);
      toast.success(t("CLIENT_CHANNEL_POINTS_DELETED", locale));
    } catch (error) {
      console.error("Failed to delete channel point reward:", error);
      toast.error(error instanceof Error ? error.message : t("CLIENT_CHANNEL_POINTS_DELETE_FAILED", locale));
    } finally {
      setChannelPointSaving(false);
    }
  };

  const platforms = [
    { value: "spotify", label: t("CLIENT_PLATFORM_SPOTIFY", locale) },
    { value: "youtube", label: t("CLIENT_PLATFORM_YOUTUBE", locale) },
    { value: "apple", label: t("CLIENT_PLATFORM_APPLE", locale) },
    { value: "soundcloud", label: t("CLIENT_PLATFORM_SOUNDCLOUD", locale) },
    { value: 'spotube', label: t("CLIENT_PLATFORM_SPOTUBE", locale), experimental: true },
  ];

  const multiPlatformMembers: Record<string, { value: string; label: string }[]> = {
    spotube: [
      { value: 'spotify', label: t("CLIENT_PLATFORM_SPOTIFY", locale) },
      { value: 'youtube', label: t("CLIENT_PLATFORM_YOUTUBE", locale) },
    ],
  };

  const isMultiPlatform = settings.platform in multiPlatformMembers;

  const themes = [
    { value: 'default', label: t("CLIENT_THEME_DEFAULT", locale) },
    { value: 'custom', label: t("CLIENT_THEME_CUSTOM", locale) },
    { value: 'gojo', label: t("CLIENT_THEME_GOJO", locale) },
    { value: 'hologram', label: t("CLIENT_THEME_HOLOGRAM", locale) },
    { value: 'mdev', label: t("CLIENT_THEME_MDEV", locale) },
    { value: 'moonkingbean', label: t("CLIENT_THEME_MOONKINGBEAN", locale) },
    { value: 'twinGhost', label: t("CLIENT_THEME_TWINGHOST", locale) },
    { value: 'nowplaying-default', label: t("CLIENT_THEME_NOWPLAYING_DEFAULT", locale) },
    { value: 'nowplaying-custom', label: t("CLIENT_THEME_NOWPLAYING_CUSTOM", locale) },
    { value: 'nowplaying-gojo', label: t("CLIENT_THEME_NOWPLAYING_GOJO", locale) },
    { value: 'nowplaying-hologram', label: t("CLIENT_THEME_NOWPLAYING_HOLOGRAM", locale) },
    { value: 'nowplaying-mdev', label: t("CLIENT_THEME_NOWPLAYING_MDEV", locale) },
    { value: 'nowplaying-moonkingbean', label: t("CLIENT_THEME_NOWPLAYING_MOONKINGBEAN", locale) },
    { value: 'nowplaying-twinGhost', label: t("CLIENT_THEME_NOWPLAYING_TWINGHOST", locale) }
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
                  <p className="text-[10px] font-bold text-emerald-400">{t("CLIENT_CONNECTED", locale)}</p>
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
              <p className="mb-3 text-xs text-slate-600">{t("CLIENT_SIGN_IN_PROMPT", locale)}</p>
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
        <Section title={t("CLIENT_REQUEST_MGMT_TITLE", locale)} desc={t("CLIENT_REQUEST_MGMT_DESC", locale)}>

          <ToggleRow label={t("CLIENT_ENABLE_REQUESTS", locale)} desc={t("CLIENT_ENABLE_REQUESTS_DESC", locale)} checked={settings.enableRequests} onChange={(v) => p({ enableRequests: v })} />
          <ToggleRow label={t("CLIENT_MODS_ONLY", locale)} desc={t("CLIENT_MODS_ONLY_DESC", locale)} checked={settings.modsOnly} onChange={(v) => p({ modsOnly: v })} />
          <ToggleRow label={t("CLIENT_SUBS_ONLY", locale)} desc={t("CLIENT_SUBS_ONLY_DESC", locale)} checked={settings.subsOnly} onChange={(v) => p({ subsOnly: v })} />
          <ToggleRow label={t('CLIENT_LIMIT_PER_USER', locale)} desc={t('CLIENT_LIMIT_PER_USER_DESC', locale)} checked={settings.requestLimitEnabled} onChange={(v) => p({ requestLimitEnabled: v })} />
          {settings.requestLimitEnabled && (
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-[13px] font-semibold text-white">{t('CLIENT_REQUEST_LIMIT', locale)}</p>
              <input
                type="number" min={1} value={settings.requestLimit}
                onChange={(e) => p({ requestLimit: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-16 rounded-xl border border-violet-500/20 bg-slate-950/70 px-2.5 py-1.5 text-right text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          )}
          <ToggleRow label={t("CLIENT_AUTO_ACCEPT_SEARCH", locale)} desc={t("CLIENT_AUTO_ACCEPT_SEARCH_DESC", locale)} checked={!!settings.autoAcceptSearchResults} onChange={(v) => p({ autoAcceptSearchResults: v })} />
          <ToggleRow
            label={t("CLIENT_CHANNEL_POINTS_TITLE", locale)}
            desc={t("CLIENT_CHANNEL_POINTS_DESC", locale)}
            checked={!!settings.useChannelPoints}
            onChange={(enabled) => p({
              useChannelPoints: enabled,
              channelPointRequestsEnabled: enabled ? settings.channelPointRequestsEnabled : false,
            })}
          />
          {settings.useChannelPoints && (
            <>
              <ToggleRow
                label={t("CLIENT_CHANNEL_POINT_REQUESTS_TITLE", locale)}
                desc={t("CLIENT_CHANNEL_POINT_REQUESTS_DESC", locale)}
                checked={!!settings.channelPointRequestsEnabled}
                onChange={(enabled) => p({ channelPointRequestsEnabled: enabled })}
              />
              <div className="border-t border-white/[0.04] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-white">
                    {channelPointId ? t("CLIENT_CHANNEL_POINTS_CREATED_STATUS", locale) : t("CLIENT_CHANNEL_POINTS_CREATE", locale)}
                  </p>
                  {channelPointLoading && <span className="text-[11px] text-slate-500">{t("COMMON_LOADING", locale)}</span>}
                </div>
                {channelPointId ? (
                  <button
                    type="button"
                    onClick={() => void deleteChannelPoint()}
                    disabled={channelPointSaving}
                    className="w-full rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                  >
                    {t("CLIENT_CHANNEL_POINTS_DELETE", locale)}
                  </button>
                ) : (
                  <>
                    <input
                      value={channelPointForm.title}
                      onChange={(event) => setChannelPointForm((form) => ({ ...form, title: event.target.value }))}
                      placeholder={t("CLIENT_CHANNEL_POINTS_REWARD_TITLE_PLACEHOLDER", locale)}
                      className="h-9 w-full rounded-xl border border-violet-500/20 bg-slate-950/70 px-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <input
                      value={channelPointForm.prompt}
                      onChange={(event) => setChannelPointForm((form) => ({ ...form, prompt: event.target.value }))}
                      placeholder={t("CLIENT_CHANNEL_POINTS_PROMPT_PLACEHOLDER", locale)}
                      className="h-9 w-full rounded-xl border border-violet-500/20 bg-slate-950/70 px-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                        {t("CLIENT_CHANNEL_POINTS_COLOR", locale)}
                        <input
                          type="color"
                          value={channelPointForm.color}
                          onChange={(event) => setChannelPointForm((form) => ({ ...form, color: event.target.value }))}
                          className="block h-9 w-full rounded-lg bg-slate-950"
                        />
                      </label>
                      <label className="space-y-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                        {t("CLIENT_CHANNEL_POINTS_COOLDOWN", locale)}
                        <input
                          type="number"
                          min={0}
                          value={channelPointForm.cooldown}
                          onChange={(event) => setChannelPointForm((form) => ({ ...form, cooldown: Math.max(0, Number(event.target.value) || 0) }))}
                          className="block h-9 w-full rounded-xl border border-violet-500/20 bg-slate-950/70 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => void createChannelPoint()}
                      disabled={channelPointSaving}
                      className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-emerald-600 px-3 py-2 text-xs font-bold text-white transition-all hover:from-violet-500 hover:to-emerald-500 disabled:opacity-50"
                    >
                      {channelPointSaving ? t("COMMON_LOADING", locale) : t("CLIENT_CHANNEL_POINTS_CREATE", locale)}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </Section>

        {/* Modules */}
        <Section title={t("CLIENT_MODULES_TITLE", locale)} desc={t("CLIENT_MODULES_DESC", locale)}>
          <ToggleRow label={t("CLIENT_MOD_QUEUE_TITLE", locale)} desc={t("CLIENT_MOD_QUEUE_DESC", locale)} checked={!!settings.autoPlay} onChange={(v) => p({ autoPlay: v })} />
          <ToggleRow label={t("CLIENT_GTS_TITLE", locale)} desc={t("CLIENT_GTS_DESC", locale)} checked={!!settings.gtsEnabled} onChange={(v) => p({ gtsEnabled: v })} />
          {settings.platform !== "youtube" && (
            <ToggleRow label={t("CLIENT_FILTER_EXPLICIT", locale)} desc={t("CLIENT_FILTER_EXPLICIT_DESC", locale)} checked={!!settings.filterExplicit} onChange={(v) => p({ filterExplicit: v })} />
          )}
        </Section>

        {/* Platform */}
        <Section title={t("CLIENT_PLATFORM_TITLE", locale)} desc={t("CLIENT_PLATFORM_DESC", locale)}>
          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{t("CLIENT_PLATFORM_PRIMARY", locale)}</label>
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
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{t("CLIENT_PLATFORM_PRIMARY_SEARCH", locale)}</label>
                <p className="text-[11px] leading-4 text-slate-600">{t("CLIENT_PLATFORM_PRIMARY_SEARCH_DESC", locale)}</p>
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
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{t("CLIENT_CIDER_VERSION", locale)}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["3", "4"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => {
                        p({ ciderApiVersion: v });
                        if (v === "4" && !settings.ciderV4AppToken) {
                          void requestCiderV4Token();
                        }
                      }}
                      className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                        settings.ciderApiVersion === v
                          ? "bg-gradient-to-r from-violet-600 to-emerald-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {v === "3" ? t("CLIENT_CIDER_VERSION_3", locale) : t("CLIENT_CIDER_VERSION_4", locale)}
                    </button>
                  ))}
                </div>
                {settings.ciderApiVersion === "3" ? (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-600" htmlFor="ciderV3Token">{t("CLIENT_CIDER_TOKEN", locale)}</label>
                    <input
                      id="ciderV3Token"
                      type="password"
                      autoComplete="off"
                      placeholder={t("CLIENT_CIDER_TOKEN_PLACEHOLDER", locale)}
                      value={settings.appleMusicAppToken || ""}
                      onChange={(event) => p({ appleMusicAppToken: event.target.value })}
                      className="w-full rounded-xl border border-violet-500/20 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] leading-4 text-slate-600">
                      {t("CLIENT_CIDER_V4_DESCRIPTION", locale)}
                    </p>
                    <button
                      type="button"
                      onClick={() => void requestCiderV4Token()}
                      disabled={ciderTokenLoading}
                      className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-emerald-600 px-3 py-2 text-xs font-bold text-white transition-all hover:from-violet-500 hover:to-emerald-500 disabled:cursor-wait disabled:opacity-60"
                    >
                      {ciderTokenLoading ? t("CLIENT_CIDER_V4_WAITING", locale) : settings.ciderV4AppToken ? t("CLIENT_CIDER_V4_REFRESH", locale) : t("CLIENT_CIDER_V4_CONNECT", locale)}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* Overlay Theme */}
        <Section title={t("CLIENT_OVERLAY_SETTINGS_TITLE", locale)}>
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
        <Section title={t("CLIENT_PRIVACY_TITLE", locale)}>
          <ToggleRow label={t("CLIENT_TELEMETRY", locale)} desc={t("CLIENT_TELEMETRY_DESC", locale)} checked={!!settings.telemetryEnabled} onChange={(v) => p({ telemetryEnabled: v })} />
        </Section>

        {/* About */}
        <Section title={t("CLIENT_ABOUT_TITLE", locale)}>
          <div className="p-4 space-y-2.5">
            <p className="text-xs text-slate-600">{t("CLIENT_ABOUT_VERSION", locale)}</p>
            <button
              onClick={() => api()?.yesnt?.("https://requestplus.xyz")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-700"
            >
              <ExternalLink className="size-3.5" />
              {t("CLIENT_VISIT_WEBSITE", locale)}
            </button>
            <button
              onClick={async () => {
                if (api()?.checkForUpdates) await api().checkForUpdates();
                else toast.info(t("CLIENT_UPDATE_CHECK_UNAVAILABLE", locale));
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800/50 px-4 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
            >
              <RefreshCw className="size-3.5" />
              {t("CLIENT_CHECK_UPDATES", locale)}
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
