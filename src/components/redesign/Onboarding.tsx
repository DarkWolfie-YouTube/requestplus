import { useState } from "react";
import { Check, Copy, Eye, Headphones, ListChecks, Lock, Music2, Radio, Shield, Sparkles, UserRound, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "./shared";
import type { AppSettings, AppUser } from "./shared";
import { t } from "../../i18n";

const defaultSettings: AppSettings = {
  enableRequests: true, modsOnly: false, subsOnly: false,
  requestLimitEnabled: false, requestLimit: 10, autoPlay: true,
  autoAcceptSearchResults: false, useChannelPoints: false,
  channelPointRequestsEnabled: true, telemetryEnabled: true,
  platform: "spotify", filterExplicit: false, gtsEnabled: false,
  theme: "default", appleMusicAppToken: "", ciderApiVersion: "3",
  ciderV4AppToken: "", primarySearchPlatform: "spotify", showNotifications: true,
};

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

export function Onboarding({ onComplete, user, overlayPath, locale = "en" }: {
  onComplete: () => void;
  user: AppUser | null;
  overlayPath: string;
  locale?: string;
}) {
  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState(defaultSettings);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const p = (patch: Partial<AppSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const pct = ((step + 1) / STEPS.length) * 100;
  const api = (window as any).api;
  const finish = async () => {
    setSaving(true);
    try {
      const next = { ...settings, oobeCompleted: true };
      localStorage.setItem("settings", JSON.stringify(next));
      localStorage.setItem("requestplus:v3:oobe-complete", "true");
      const api = (window as any).api;
      if (api?.completeOnboarding) await api.completeOnboarding(next);
      else await api?.saveSettings?.(next);
      onComplete();
      toast.success(t("OOBE_TOAST_READY", locale));
    } catch { onComplete(); }
    finally { setSaving(false); }
  };

  const goNext = () => {
    if (step === STEPS.length - 1) { void finish(); return; }
    setStep((s) => s + 1);
  };


  const copyOverlay = async () => {
    await navigator.clipboard.writeText(overlayPath).catch(() => {});
    setCopied(true);
    toast.success(t("OOBE_TOAST_OVERLAY_COPIED", locale));
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="relative flex h-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/50">
      {/* Blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.16]">
        <div className="blob absolute -left-16 -top-16 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600 blur-[100px]" />
        <div className="blob d2 absolute -right-16 top-24 h-[28rem] w-[28rem] rounded-full bg-emerald-500 blur-[100px]" />
        <div className="blob d4 absolute -bottom-24 left-40 h-[32rem] w-[32rem] rounded-full bg-cyan-500 blur-[100px]" />
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Sidebar Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <aside className="relative z-10 flex w-[220px] shrink-0 flex-col border-r border-white/[0.07] bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
        {/* Brand */}
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-emerald-500 shadow-md">
            <Sparkles className="size-4 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">{t("OOBE_SETUP_LABEL", locale)}</p>
            <p className="text-sm font-extrabold text-white">Request+</p>
          </div>
        </div>

        {/* Step list */}
        <nav className="flex-1 space-y-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(i)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
                  active
                    ? "bg-white/10 text-white ring-1 ring-white/15"
                    : done
                    ? "text-emerald-300/80 hover:bg-white/5 hover:text-emerald-200"
                    : "text-slate-600 hover:bg-white/5 hover:text-slate-400"
                }`}
              >
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black transition-colors ${
                  done
                    ? "bg-emerald-400/20 text-emerald-300"
                    : active
                    ? "bg-white/15 text-white"
                    : "bg-white/5 text-slate-600"
                }`}>
                  {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                </span>
                <span className="font-semibold">{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Progress */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
            <span>Progress</span>
            <span>{Math.round(pct)}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-violet-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Skip */}
        <button
          onClick={() => void finish()}
          className="mt-4 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-white/8 hover:text-slate-400"
        >
                    {t("OOBE_SKIP", locale)}
        </button>
      </aside>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Main content Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        {/* Content area */}
        <div className="flex-1 overflow-y-auto no-sb px-8 py-7">

          {/* Welcome */}
          {step === 0 && (
            <div className="flex h-full flex-col justify-center gap-7">
              <div className="space-y-4 max-w-lg">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  <Radio className="size-3" />
                  Live Music Requests
                </div>
                <h2 className="text-4xl font-extrabold leading-[1.15] tracking-tight">
                  Welcome to<br />Request+
                </h2>
                <p className="text-[15px] leading-7 text-slate-400 max-w-md">
            The ultimate song request tool for streamers. Let your viewers queue up tracks from Spotify, YouTube, Apple Music, and more - all without leaving your stream.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 max-w-lg">
                {[
                  { n: "01", title: "Sign In", desc: "Connect your Request+ account to identify who's requesting and enable moderation." },
            { n: "02", title: "Pick Platform", desc: "Choose your music source - Spotify, YouTube, Apple Music." },
                  { n: "03", title: "Set Rules", desc: "Control who can request and how many songs per user." },
                ].map(({ n, title, desc }) => (
                  <div key={n} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="mb-2 text-[10px] font-black tracking-widest text-violet-400">{n}</p>
                    <p className="text-sm font-bold text-white">{title}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-600">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Account */}
          {step === 1 && (
            <div className="flex h-full flex-col justify-center gap-6 max-w-lg">
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">Step 2 of 5</p>
                <h2 className="text-3xl font-extrabold">{t("OOBE_ACCOUNT_TITLE", locale)}</h2>
                <p className="mt-2 text-[15px] leading-7 text-slate-400">{t("OOBE_ACCOUNT_DESC", locale)}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">Request+ Account</p>
                    <p className="text-sm text-slate-600">{user ? `Signed in as ${user.display_name}` : "Not yet connected"}</p>
                  </div>
                  <UserRound className="size-5 text-fuchsia-300" />
                </div>
                {user ? (
                  <div className="flex items-center gap-3 rounded-xl bg-slate-950/60 p-4">
                    <img src={user.profile_image_url} alt="" className="size-12 rounded-full ring-2 ring-emerald-300/40" />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-white">{user.display_name}</p>
                      <p className="truncate text-sm text-slate-600">{user.email}</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => (window as any).api?.requestPlusLogin?.()}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-emerald-500 font-bold text-white transition-all hover:from-fuchsia-500 hover:to-emerald-400"
                  >
                    <UserRound className="size-4" />
                    Sign In with Request+
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">OBS Overlay URL</p>
                    <p className="text-sm text-slate-600">Add this as a Browser Source in OBS Studio</p>
                  </div>
                  <Eye className="size-5 text-emerald-300" />
                </div>
                <div className="flex gap-2">
                  <input
                    readOnly value={overlayPath}
                    className="h-10 flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-3 font-mono text-xs text-slate-400 focus:outline-none"
                  />
                  <button
                    onClick={copyOverlay}
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/15"
                  >
                    {copied ? <Check className="size-4 text-emerald-300" /> : <Copy className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Platform */}
          {step === 2 && (
            <div className="flex h-full flex-col justify-center gap-6 max-w-lg">
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">Step 3 of 5</p>
                <h2 className="text-3xl font-extrabold">Music Platform</h2>
                <p className="mt-2 text-[15px] leading-7 text-slate-400">Choose which platform your viewers will request songs from.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {OOBE_PLATFORMS.map((pl) => {
                  const sel = settings.platform === pl.value;
                  return (
                    <button
                      key={pl.value}
                      onClick={() => p({ platform: pl.value })}
                      className={`rounded-2xl border p-5 text-left transition-all ${
                        sel
                          ? "border-emerald-400/50 bg-emerald-400/10 shadow-xl shadow-emerald-950/50"
                          : "border-white/8 bg-white/[0.03] hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-bold text-white">{pl.label}</span>
                        <span className={`flex size-6 items-center justify-center rounded-full text-xs ${
                          sel ? "bg-emerald-400 text-slate-950" : "bg-white/8 text-slate-700"
                        }`}>
                          {sel && <Check className="size-3.5" />}
                        </span>
                      </div>
                      <p className="text-xs leading-5 text-slate-600">{pl.desc}</p>
                    </button>
                  );
                })}
              </div>
              {settings.platform === "apple" && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
                  <p className="text-sm font-bold text-white">Cider Version</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(["3", "4"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => p({ ciderApiVersion: v })}
                        className={`rounded-xl px-4 py-3 font-bold transition-all ${
                          settings.ciderApiVersion === v
                            ? "bg-emerald-400 text-slate-950"
                            : "bg-slate-800/80 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        Cider {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rules */}
          {step === 3 && (
            <div className="flex h-full flex-col justify-center gap-6 max-w-lg">
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">Step 4 of 5</p>
                <h2 className="text-3xl font-extrabold">Request Rules</h2>
                <p className="mt-2 text-[15px] leading-7 text-slate-400">Configure who can request songs and how the queue behaves.</p>
              </div>
              <div className="space-y-2.5">
                {[
                  { icon: Music2, key: "enableRequests", label: "Enable Requests", desc: "Allow viewers to request songs during your stream" },
                  { icon: Shield, key: "autoPlay", label: "Auto-play Queue", desc: "Automatically start the next song when the current one ends" },
                  { icon: Lock, key: "modsOnly", label: "Mods Only", desc: "Restrict requests to channel moderators only" },
                  { icon: Shield, key: "filterExplicit", label: "Filter Explicit", desc: "Block explicit content from being requested" },
                  { icon: Radio, key: "telemetryEnabled", label: "Anonymous Telemetry", desc: "Help improve Request+ with anonymous usage data" },
                ].map(({ icon: Icon, key, label, desc }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 text-emerald-300">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white">{label}</p>
                        <p className="text-xs leading-5 text-slate-600">{desc}</p>
                      </div>
                    </div>
                    <Switch checked={!!settings[key]} onChange={(v) => p({ [key]: v })} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Done */}
          {step === 4 && (
            <div className="flex h-full flex-col items-center justify-center gap-7">
              <div className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-fuchsia-500 to-emerald-500 shadow-2xl shadow-emerald-900/60">
                <Check className="size-10 text-white" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-extrabold">All set!</h2>
                <p className="max-w-sm text-[15px] leading-7 text-slate-400">
                  Request+ is configured and ready. Hit Finish to start accepting song requests from your viewers.
                </p>
              </div>
              <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bold text-white">Documentation</p>
                    <p className="mt-0.5 text-sm text-slate-600">Everything you need to get started</p>
                    <p className="mt-0.5 text-xs text-slate-700 font-mono">docs.requestplus.xyz</p>
                  </div>
                  <button
                    onClick={() => api?.yesnt("https://docs.requestplus.xyz", "_blank")}
                    className="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-emerald-600 px-4 py-2 text-sm font-bold text-white transition-all hover:from-violet-500 hover:to-emerald-500"
                  >
                    Open Docs
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Footer nav Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <div className="shrink-0 flex items-center justify-between border-t border-white/[0.06] bg-slate-950/40 px-8 py-4 backdrop-blur-sm">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex h-10 items-center gap-2 rounded-xl bg-white/8 px-5 text-sm font-bold text-white transition-colors disabled:opacity-30 hover:bg-white/12"
          >
            <ArrowLeft className="size-4" />
            {t("OOBE_BACK", locale)}
          </button>
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`block rounded-full transition-all duration-300 ${
                  i === step ? "w-5 h-1.5 bg-emerald-400" : i < step ? "size-1.5 bg-emerald-400/50" : "size-1.5 bg-white/20"
                }`}
              />
            ))}
          </div>
          <button
            onClick={goNext}
            disabled={saving}
            className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-emerald-500 px-6 text-sm font-bold text-white shadow-lg transition-all disabled:opacity-60 hover:from-fuchsia-500 hover:to-emerald-400"
          >
              {step === STEPS.length - 1 ? (saving ? t("OOBE_SAVING", locale) : t("OOBE_FINISH", locale)) : t("OOBE_NEXT", locale)}
            {step === STEPS.length - 1 ? <Check className="size-4" /> : <ArrowRight className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ App Root Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
