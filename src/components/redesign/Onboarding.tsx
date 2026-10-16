import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Copy, ExternalLink, Headphones, ListChecks, Radio, RefreshCw, Sparkles, UserRound, Monitor } from "lucide-react";
import { toast } from "sonner";
import type { AppSettings, AppUser } from "./shared";
import { overlayThemes, hasLinkedChannel, setupChatPlatforms, setupReady, type SetupConnections, type SetupStatus } from "../../onboarding";
import { t } from "../../i18n";
import "../../styles/onboarding.css";

const steps = ["WELCOME", "ACCOUNT", "MUSIC", "RULES", "OVERLAY", "TEST"] as const;
const icons = [Sparkles, UserRound, Headphones, ListChecks, Monitor, Radio];
const platforms = ["spotify", "youtube", "apple", "soundcloud"] as const;
const guidePaths: Record<string, string> = {
  spotify: "spotify", youtube: "youtube-music", apple: "apple-music", soundcloud: "soundcloud",
};
const platformNames: Record<string, string> = { spotify: "Spotify", youtube: "YouTube Music", apple: "Apple Music", soundcloud: "SoundCloud" };

export function Onboarding({ locale, setLocale }: { locale: string; setLocale: (locale: string) => void }) {
  const api = window.api;
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const dirty = useRef<Partial<AppSettings>>({});
  const [step, setStep] = useState(0);
  const [user, setUser] = useState<AppUser | null>(null);
  const [connections, setConnections] = useState<SetupConnections | null>(null);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [overlayConfirmed, setOverlayConfirmed] = useState(false);
  const [testStarted, setTestStarted] = useState(false);
  const [requestConfirmed, setRequestConfirmed] = useState(false);
  const [queue, setQueue] = useState<Array<{ title: string; isQueued?: boolean; iscurrentlyPlaying?: boolean }>>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const lock = useRef(false);
  const tx = (key: string, vars?: Record<string, string>) => t(key, locale, vars);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const saved = await api.loadSettings();
      if (!saved || typeof saved !== "object") throw new Error("Missing settings");
      setSettings(saved);
      dirty.current = {};
    } catch { setError("SETUP_LOAD_FAILED"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await api.setupStatus();
        if (!stopped) setStatus(next);
        if (testStarted) {
          const nextQueue = await api.getQueue();
          if (!stopped) setQueue(nextQueue.items || []);
        }
      } catch { if (!stopped) setStatus(null); }
      if (!stopped) timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [testStarted]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const account = await api.fetchUserData();
        if (stopped) return;
        setUser(account);
        if (!account) { setConnections(null); setConnectionError(false); return; }
        const accountLocale = await api.getLocale();
        if (stopped) return;
        if (accountLocale) setLocale(accountLocale);
        const linked = await api.setupConnections();
        if (!stopped) { setConnections(linked); setConnectionError(false); }
      } catch { if (!stopped) { setConnectionError(true); setConnections(null); } }
    };
    const poll = async () => { await refresh(); if (!stopped) timer = setTimeout(poll, 10000); };
    const focus = () => { void refresh(); };
    void poll();
    const unsubscribe = api.authSuccess((response: { status?: string }) => {
      if (response?.status === "error") setError("SETUP_LOGIN_FAILED");
      if (["success", "restored", "refreshed", "logged-out"].includes(response?.status || "")) void refresh();
    });
    window.addEventListener("focus", focus);
    return () => { stopped = true; clearTimeout(timer); unsubscribe?.(); window.removeEventListener("focus", focus); };
  }, []);

  useEffect(() => { heading.current?.focus(); }, [step]);

  const patch = (next: Partial<AppSettings>) => {
    dirty.current = { ...dirty.current, ...next };
    setSettings(current => current ? { ...current, ...next } : current);
    if ("platform" in next || "ciderApiVersion" in next || "appleMusicAppToken" in next || "ciderV4AppToken" in next) {
      setTestStarted(false);
      setRequestConfirmed(false);
    }
  };
  const run = async (action: () => Promise<void>, errorKey = "SETUP_ACTION_FAILED") => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try { await action(); }
    catch { setError(errorKey); }
    finally { lock.current = false; setBusy(false); }
  };
  const save = async () => {
    await api.saveSetupDraft(dirty.current);
    dirty.current = {};
  };
  const selectTheme = (theme: string): void => void run(async () => {
    await api.saveSetupDraft({ ...dirty.current, theme });
    dirty.current = {};
    setSettings(current => current ? { ...current, theme } : current);
    setOverlayConfirmed(false);
    setTestStarted(false);
    setRequestConfirmed(false);
    setPreviewRevision(value => value + 1);
  }, "SETUP_SAVE_FAILED");
  const navigate = (index: number): void => void run(async () => {
    if (step === 3 && index > step) patch({ oobeRulesReviewed: true });
    await save();
    setStep(index);
  }, "SETUP_SAVE_FAILED");
  const finish = (deferred: boolean): void => void run(async () => {
    await api.completeOnboarding({ patch: dirty.current, deferred, overlayConfirmed, requestConfirmed });
  }, "SETUP_FINISH_FAILED");
  const checkMusic = (): void => void run(async () => {
    await save();
    setStatus(await api.setupStatus());
  }, "SETUP_SAVE_FAILED");
  const startTest = (): void => void run(async () => {
    await save();
    await api.setupBeginTest();
    setStatus(current => current ? { ...current, request: null } : current);
    setTestStarted(true);
    setRequestConfirmed(false);
  });
  const openDocs = (): void => void run(() => api.yesnt(`https://docs.requestplus.xyz/integrations/music/${guidePaths[settings?.platform || ""] || ""}`));
  const copy = (): void => void run(async () => {
    if (!status?.overlayPath) throw new Error("Missing overlay");
    await navigator.clipboard.writeText(status.overlayPath);
    toast.success(tx("SETUP_COPIED"));
  }, "SETUP_COPY_FAILED");
  const linked = !!user && hasLinkedChannel(connections);
  const music = !!status?.music && status.platform === settings?.platform && !Object.keys(dirty.current).some(key => ["platform", "ciderApiVersion", "appleMusicAppToken", "ciderV4AppToken"].includes(key));
  const ready = requestConfirmed && music && setupReady(status, linked, overlayConfirmed) && !!settings?.oobeRulesReviewed;
  const completed = [true, linked && !!status?.cloud, music, !!settings?.oobeRulesReviewed, !!status?.overlay && overlayConfirmed, ready];
  const done = completed.slice(1).filter(Boolean).length;
  const title = tx(`SETUP_${steps[step]}_TITLE`);

  const indicator = (ok: boolean, label: string) => <span className={`setup-status ${ok ? "is-ready" : ""}`}>{ok ? <Check size={14} aria-hidden="true" /> : <span className="setup-status-dot" />}{label}</span>;
  const toggle = (key: string, labelKey: string, descKey?: string) => <label className="setup-toggle" key={key}>
    <span><strong>{tx(labelKey)}</strong>{descKey && <small>{tx(descKey)}</small>}</span>
    <input type="checkbox" checked={!!settings?.[key]} onChange={event => patch({ [key]: event.target.checked })} />
  </label>;

  return <div className="setup-shell">
    <aside className="setup-sidebar">
      <div className="setup-brand"><span className="setup-brand-icon"><Sparkles size={22} /></span><div><strong>Request+</strong><small>{tx("OOBE_SETUP_LABEL")}</small></div></div>
      <nav aria-label={tx("OOBE_SETUP_LABEL")}>
        {steps.map((key, index) => { const Icon = icons[index]; return <button type="button" key={key} disabled={busy || !settings} aria-label={tx(`SETUP_STEP_${key}`)} aria-current={step === index ? "step" : undefined} onClick={() => navigate(index)}>
          <span className={completed[index] && index > 0 ? "setup-nav-done" : ""}>{completed[index] && index > 0 ? <Check size={18} /> : <Icon size={18} />}</span><span>{tx(`SETUP_STEP_${key}`)}</span>
        </button>; })}
      </nav>
      <div className="setup-sidebar-bottom"><label htmlFor="setup-language">{tx("SETUP_LANGUAGE")}</label>
        <select aria-label={tx("SETUP_LANGUAGE")} id="setup-language" disabled={!!user} value={locale} onChange={event => setLocale(event.target.value)}>{Object.entries({ en: "English", es: "Español", fr: "Français", pt: "Português", de: "Deutsch" }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <p>{tx("SETUP_PROGRESS", { done: String(done), total: "5" })}</p><progress max={5} value={done} aria-label={tx("SETUP_PROGRESS", { done: String(done), total: "5" })} />
      </div>
    </aside>
    <div className="setup-main">
      <main className="setup-content">
        <header><p className="setup-eyebrow">{tx("SETUP_STEP_COUNT", { step: String(step + 1), total: "6" })}</p><h1 ref={heading} tabIndex={-1}>{title}</h1><p>{tx(`SETUP_${steps[step]}_DESC`)}</p></header>
        {error && <div className="setup-alert" role="alert">{tx(error)}{!settings && <button type="button" onClick={() => void load()}>{tx("SETUP_RETRY")}</button>}</div>}
        {loading && <p role="status">{tx("SETUP_LOADING")}</p>}
        {settings && <fieldset disabled={busy} className="setup-fields">
          {step === 0 && <>
            <div className="setup-hero"><Radio size={32} /><h2>{tx("SETUP_OUTCOME")}</h2><p>{tx("SETUP_OUTCOME_DESC")}</p></div>
            <div className="setup-card"><h2>{tx("SETUP_BEFORE")}</h2><p>{tx("SETUP_BEFORE_DESC")}</p></div>
            <p className="setup-note">{tx("SETUP_LATER_HINT")}</p>
          </>}
          {step === 1 && <>
            <div className="setup-card"><div className="setup-row"><h2>{tx("OOBE_REQUEST_ACCOUNT_TITLE")}</h2>{indicator(!!user, tx(user ? "SETUP_SIGNED_IN" : "SETUP_NOT_CONNECTED"))}</div>
              {user ? <p>{user.display_name}</p> : <button className="setup-primary" type="button" onClick={() => void run(() => api.requestPlusLogin(), "SETUP_LOGIN_FAILED")}><UserRound size={16} />{tx("OOBE_SIGN_IN_BUTTON")}</button>}
              <p className="setup-note">{tx("SETUP_LOGIN_HINT")}</p>
            </div>
            <div className="setup-card"><div className="setup-row"><h2>{tx("SETUP_CHANNELS")}</h2><button type="button" onClick={() => void run(async () => { setConnections(await api.setupConnections()); setConnectionError(false); })} disabled={!user}><RefreshCw size={15} />{tx("SETUP_REFRESH")}</button></div>
              <p>{tx("SETUP_CHANNELS_HINT")}</p>
              {connectionError && <p role="status" className="setup-warning">{tx("SETUP_CONNECTIONS_FAILED")}</p>}
              {setupChatPlatforms(connections).map(({ key, label }) => { const connection = connections?.[key]; return <div className="setup-connection" key={key}><strong>{label}</strong><span>{connection?.username || connection?.channelTitle || connection?.displayName}</span>{indicator(!!connection?.connected && !connection.expired, tx(connection?.expired ? "SETUP_RECONNECT" : connection?.connected ? "SETUP_LINKED" : connections ? "SETUP_NOT_LINKED" : "SETUP_NOT_CHECKED"))}</div>; })}
              <button type="button" onClick={() => void run(() => api.setupDashboard())}><ExternalLink size={15} />{tx("SETUP_LINK_ACCOUNTS")}</button>
            </div>
            {indicator(!!status?.cloud, tx(status?.cloud ? "SETUP_CLOUD_READY" : "SETUP_CLOUD_WAIT"))}
          </>}
          {step === 2 && <>
            <div className="setup-platforms" role="radiogroup" aria-label={tx("SETUP_STEP_MUSIC")}>
              {platforms.map(platform => <label className={settings.platform === platform ? "selected" : ""} key={platform}><input type="radio" name="platform" value={platform} checked={settings.platform === platform} onChange={() => patch({ platform })} /><strong>{platformNames[platform]}</strong>{platform === "soundcloud" && <small>{tx("SETUP_EXPERIMENTAL")}</small>}</label>)}
            </div>
            <div className="setup-card"><h2>{platformNames[settings.platform] || settings.platform}</h2><p className="setup-instructions">{tx(platformNames[settings.platform] ? `SETUP_GUIDE_${settings.platform.toUpperCase()}` : "SETUP_GUIDE_UNKNOWN")}</p><button type="button" onClick={openDocs}><ExternalLink size={15} />{tx("SETUP_OPEN_GUIDE")}</button>
              {settings.platform === "apple" && <div className="setup-token"><label htmlFor="setup-cider">{tx("CLIENT_CIDER_VERSION")}</label><select id="setup-cider" value={settings.ciderApiVersion || "3"} onChange={event => patch({ ciderApiVersion: event.target.value as "3" | "4" })}><option value="3">Cider 3</option><option value="4">Cider 4</option></select>
                {settings.ciderApiVersion === "4" ? <><p>{tx("CLIENT_CIDER_V4_DESCRIPTION")}</p><button type="button" onClick={() => void run(async () => { const token = await api.setupCiderToken(); patch({ ciderV4AppToken: token }); await save(); }, "CLIENT_CIDER_CONNECT_FAILED")}>{tx(busy ? "CLIENT_CIDER_V4_WAITING" : "CLIENT_CIDER_V4_CONNECT")}</button></> : <><label htmlFor="setup-cider-token">{tx("CLIENT_CIDER_TOKEN")}</label><input id="setup-cider-token" type="password" autoComplete="off" value={settings.appleMusicAppToken || ""} onChange={event => patch({ appleMusicAppToken: event.target.value })} /></>}
              </div>}
            </div>
            <div className="setup-card"><div className="setup-row"><h2>{tx("SETUP_MUSIC_CHECK")}</h2>{indicator(music, tx(music ? "SETUP_TRACK_RECEIVED" : "SETUP_WAITING_MUSIC"))}</div><p>{tx("SETUP_PLAY_HINT")}</p><button type="button" onClick={checkMusic}><RefreshCw size={15} />{tx("SETUP_CHECK_MUSIC")}</button>{music && status?.track && <p className="setup-track">{status.track.title} · {status.track.artist}</p>}</div>
          </>}
          {step === 3 && <div className="setup-card setup-rule-list">
            {toggle("enableRequests", "CLIENT_ENABLE_REQUESTS", "CLIENT_ENABLE_REQUESTS_DESC")}
            {toggle("autoPlay", "CLIENT_MOD_QUEUE_TITLE", "OOBE_RULE_MOD_QUEUE_DESC")}
            {toggle("modsOnly", "CLIENT_MODS_ONLY", "CLIENT_MODS_ONLY_DESC")}
            {toggle("subsOnly", "CLIENT_SUBS_ONLY", "CLIENT_SUBS_ONLY_DESC")}
            {toggle("requestLimitEnabled", "CLIENT_LIMIT_PER_USER", "CLIENT_LIMIT_PER_USER_DESC")}
            {settings.requestLimitEnabled && <label className="setup-toggle"><strong>{tx("CLIENT_REQUEST_LIMIT")}</strong><input aria-label={tx("CLIENT_REQUEST_LIMIT")} type="number" min={1} step={1} value={settings.requestLimit} onChange={event => patch({ requestLimit: Math.max(1, Math.floor(Number(event.target.value) || 1)) })} /></label>}
            {toggle("autoAcceptSearchResults", "CLIENT_AUTO_ACCEPT_SEARCH", "CLIENT_AUTO_ACCEPT_SEARCH_DESC")}
            {toggle("filterExplicit", "OOBE_RULE_FILTER_EXPLICIT_TITLE", "OOBE_RULE_FILTER_EXPLICIT_DESC")}
            {toggle("telemetryEnabled", "OOBE_RULE_TELEMETRY_TITLE", "OOBE_RULE_TELEMETRY_DESC")}
            {toggle("reducedMotion", "CLIENT_REDUCED_MOTION", "CLIENT_REDUCED_MOTION_DESC")}
          </div>}
          {step === 4 && <>
            <div className="setup-card"><h2>{tx("SETUP_LOCAL_FILE")}</h2><ol><li>{tx("SETUP_OBS_1")}</li><li>{tx("SETUP_OBS_2")}</li><li>{tx("SETUP_OBS_3")}</li></ol><label htmlFor="setup-overlay-path">{tx("SETUP_LOCAL_FILE")}</label><div className="setup-copy"><input id="setup-overlay-path" readOnly value={status?.overlayPath || ""} /><button type="button" disabled={!status?.overlayPath} onClick={copy}><Copy size={16} />{tx("SETUP_COPY")}</button></div></div>
            <div className="setup-card"><div className="setup-row"><h2>{tx("SETUP_PREVIEW")}</h2>{indicator(!!status?.overlay, tx(status?.overlay ? "SETUP_OVERLAY_CONNECTED" : "SETUP_OVERLAY_WAIT"))}</div>
              <label htmlFor="setup-overlay-theme">{tx("CLIENT_OVERLAY_SETTINGS_TITLE")}</label>
              <select id="setup-overlay-theme" value={settings.theme} disabled={busy} onChange={event => selectTheme(event.target.value)}>
                {!overlayThemes.some(theme => theme.value === settings.theme) && <option value={settings.theme}>{settings.theme}</option>}
                {overlayThemes.map(theme => <option key={theme.value} value={theme.value}>{tx(theme.label)}</option>)}
              </select>
              {status?.previewUrl && <iframe key={previewRevision} title={tx("SETUP_PREVIEW")} className="setup-preview" src={status.previewUrl} sandbox="allow-scripts" />}
              <p className="setup-note">{tx("SETUP_PREVIEW_HINT")}</p>
              <label className="setup-toggle"><span>{tx("SETUP_OVERLAY_CONFIRM")}</span><input type="checkbox" checked={overlayConfirmed} onChange={event => setOverlayConfirmed(event.target.checked)} /></label>
            </div>
          </>}
          {step === 5 && <>
            <div className="setup-card"><h2>{tx(ready ? "SETUP_READY" : "SETUP_REMAINING")}</h2><div className="setup-checklist">{steps.slice(1, 5).map((key, index) => <button type="button" key={key} onClick={() => navigate(index + 1)}>{indicator(completed[index + 1], tx(`SETUP_STEP_${key}`))}<ChevronRight size={16} /></button>)}</div></div>
            <div className="setup-card"><h2>{tx("SETUP_FIRST_REQUEST")}</h2><p>{tx("SETUP_TEST_HINT")}</p><code>!sr {settings.platform === "spotify" ? "https://open.spotify.com/track/…" : settings.platform === "youtube" ? "https://music.youtube.com/watch?v=…" : settings.platform === "apple" ? "https://music.apple.com/…" : "https://soundcloud.com/…"}</code><p className="setup-note">{tx("SETUP_TEST_LINK_HINT")}</p>
              <button type="button" className="setup-primary" disabled={!linked || !music || !status?.cloud || !settings.enableRequests} onClick={startTest}><Radio size={16} />{tx(testStarted ? "SETUP_TEST_AGAIN" : "SETUP_START_TEST")}</button>
              {testStarted && <p role="status">{tx(status?.request?.accepted ? "SETUP_REQUEST_ACCEPTED" : status?.request ? "SETUP_REQUEST_FAILED" : "SETUP_REQUEST_WAIT")}{status?.request && <span className="setup-request-detail">{status.request.songName || status.request.code}</span>}</p>}
              {testStarted && queue.some(item => !item.isQueued && !item.iscurrentlyPlaying) && <><p>{tx("SETUP_APPROVE_HINT")}</p>{queue.map((item, index) => !item.isQueued && !item.iscurrentlyPlaying && <button type="button" key={`${item.title}-${index}`} onClick={() => void run(async () => { if (!await api.playTrackAtIndex(index)) throw new Error("Playback failed"); })}>{tx("SETUP_APPROVE")} · {item.title}</button>)}</>}
              {status?.request?.accepted && <label className="setup-toggle"><span>{tx("SETUP_REQUEST_CONFIRM")}</span><input type="checkbox" checked={requestConfirmed} onChange={event => setRequestConfirmed(event.target.checked)} /></label>}
              <p className="setup-note">{tx("SETUP_TEST_TROUBLESHOOT")}</p>
            </div>
          </>}
        </fieldset>}
      </main>
      <footer className="setup-footer"><button type="button" disabled={busy || !settings} onClick={() => finish(true)}>{tx("SETUP_SAVE_LATER")}</button><div><button type="button" disabled={busy || !settings || step === 0} onClick={() => navigate(step - 1)}>{tx("OOBE_BACK")}</button><button type="button" className="setup-primary" disabled={busy || !settings || step === 5 && !ready} onClick={() => step === 5 ? finish(false) : navigate(step + 1)}>{tx(busy ? "OOBE_SAVING" : step === 5 ? "OOBE_FINISH" : "OOBE_NEXT")}<ChevronRight size={16} /></button></div></footer>
    </div>
  </div>;
}
