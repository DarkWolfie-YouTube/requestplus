import { useState, useEffect, useRef } from "react";
import { createRoot } from 'react-dom/client';
import {
  Music, Settings, List, X, Minus, Play, Pause, SkipBack, SkipForward,
  Heart, Shuffle, Repeat, Repeat1, Volume2, Trash2, Check, Copy, Eye,
  Headphones, ListChecks, Lock, Radio, Shield, Sparkles, UserRound,
  ExternalLink, RefreshCw, LogOut, User as UserIcon, ArrowLeft,
  ArrowRight, Music2,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { Topbar as RedesignedTopbar } from "./components/redesign/Topbar";
import { Navigation as RedesignedNavigation } from "./components/redesign/Navigation";
import { MusicPlayer as RedesignedMusicPlayer } from "./components/redesign/MusicPlayer";
import { QueuePage as RedesignedQueuePage } from "./components/redesign/QueuePage";
import { SettingsView as RedesignedSettingsView } from "./components/redesign/SettingsView";
import { ErrorBoundary } from "./components/redesign/ErrorBoundary";
import { t } from "./i18n";



type View = "player" | "queue" | "settings";

interface Track {
  title: string; artist: string; album: string;
  duration: number; progress: number; cover: string;
  isPlaying: boolean; volume: number; shuffle: boolean;
  repeat: number; isLiked: boolean;
}

interface QueueItem {
  id: string; title: string; artist: string; cover: string;
  duration: number; iscurrentlyPlaying: boolean; isQueued: boolean;
  requestedBy?: string;
}

interface AppUser {
  display_name: string; profile_image_url: string; email: string;
}

interface AppSettings {
  enableRequests: boolean; modsOnly: boolean; subsOnly: boolean;
  requestLimitEnabled: boolean; requestLimit: number; autoPlay: boolean;
  autoAcceptSearchResults: boolean; useChannelPoints: boolean;
  channelPointRequestsEnabled: boolean; telemetryEnabled: boolean;
  platform: string; filterExplicit: boolean; gtsEnabled: boolean;
  theme: string; appleMusicAppToken: string; ciderApiVersion: "3" | "4";
  ciderV4AppToken: string; primarySearchPlatform: string;
  showNotifications: boolean; [key: string]: any;
}

// â”€â”€â”€ Defaults & mock data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const defaultSettings: AppSettings = {
  enableRequests: true, modsOnly: false, subsOnly: false,
  requestLimitEnabled: false, requestLimit: 10, autoPlay: true,
  autoAcceptSearchResults: false, useChannelPoints: false,
  channelPointRequestsEnabled: true, telemetryEnabled: true,
  platform: "spotify", filterExplicit: false, gtsEnabled: false,
  theme: "default", appleMusicAppToken: "", ciderApiVersion: "3",
  ciderV4AppToken: "", primarySearchPlatform: "spotify", showNotifications: true,
  reducedMotion: false, hardwareAcceleration: true,
};

const initialTrack: Track = {
  title: "Unknown Track",
  artist: "Unknown Artist",
  album: "",
  duration: 0,
  progress: 0,
  cover: "",
  isPlaying: false,
  volume: 1,
  shuffle: false,
  repeat: 0,
  isLiked: false,
};


// â”€â”€â”€ Utils â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
};

// â”€â”€â”€ Global injected CSS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CSS = `
  *, *::before, *::after { font-family: 'Manrope', system-ui, sans-serif; }

  .no-sb::-webkit-scrollbar { display: none; }
  .no-sb { scrollbar-width: none; }

  @keyframes blob {
    0%   { transform: translate(0,0) scale(1); }
    33%  { transform: translate(28px,-46px) scale(1.08); }
    66%  { transform: translate(-18px,18px) scale(0.93); }
    100% { transform: translate(0,0) scale(1); }
  }
  .blob  { animation: blob 8s infinite ease-in-out; }
  .d2    { animation-delay: 2.5s; }
  .d4    { animation-delay: 4.5s; }

  /* Reduced motion mode: freeze the background glow and drop backdrop blur panels,
     for lowest GPU/CPU usage while the window just sits open (e.g. during a stream). */
  .reduce-motion .blob { animation: none; }
  .reduce-motion .backdrop-blur,
  .reduce-motion .backdrop-blur-sm,
  .reduce-motion .backdrop-blur-xl {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }

  .vol::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px; height: 14px; border-radius: 50%;
    background: linear-gradient(to right, #8b5cf6, #10b981);
    cursor: pointer; margin-top: -5px;
    box-shadow: 0 0 8px rgba(139,92,246,.55);
  }
  .vol::-moz-range-thumb {
    width: 14px; height: 14px; border-radius: 50%;
    background: linear-gradient(to right, #8b5cf6, #10b981);
    border: none; cursor: pointer;
    box-shadow: 0 0 8px rgba(139,92,246,.55);
  }
  .vol::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; }
  .vol::-moz-range-track { height: 4px; border-radius: 2px; background: #1e293b; }
  .vol { -webkit-appearance: none; appearance: none; background: transparent;
         width: 100%; height: 4px; border-radius: 2px; cursor: pointer; }
`;

// â”€â”€â”€ Art placeholder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TrackArt({ cover, title, artist, className = "" }: { cover: string; title: string; artist: string; className?: string }) {
  const [err, setErr] = useState(false);
  // Reset the error latch when the cover changes, otherwise one failed load
  // pins the placeholder for every subsequent track (the component isn't remounted).
  useEffect(() => { setErr(false); }, [cover]);
  const hue = ((title.charCodeAt(0) || 65) * 47 + (artist.charCodeAt(0) || 65) * 19) % 360;

  if (cover && !err) {
    return <img src={cover} alt={`${title} - ${artist}`} className={`${className} object-cover`} onError={() => setErr(true)} />;
  }
  return (
    <div
      className={`${className} flex items-center justify-center`}
      style={{ background: `linear-gradient(135deg, hsl(${hue},55%,22%), hsl(${(hue+90)%360},55%,18%))` }}
    >
      <Music className="size-[35%] text-white/25" />
    </div>
  );
}

// â”€â”€â”€ Switch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
        checked ? "bg-gradient-to-r from-violet-500 to-emerald-500" : "bg-slate-700"
      }`}
    >
      <span className={`pointer-events-none block size-4 rounded-full bg-white shadow transition-transform duration-200 my-0.5 ${
        checked ? "translate-x-[18px]" : "translate-x-0.5"
      }`} />
    </button>
  );
}

// â”€â”€â”€ Blobs background â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Blobs({ opacity = "opacity-20" }: { opacity?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${opacity}`}>
      <div className="blob absolute -left-10 -top-10 h-80 w-80 rounded-full bg-violet-600 blur-[80px]" />
      <div className="blob d2 absolute -right-10 top-16 h-80 w-80 rounded-full bg-emerald-500 blur-[80px]" />
      <div className="blob d4 absolute -bottom-16 left-24 h-96 w-96 rounded-full bg-cyan-500 blur-[80px]" />
    </div>
  );
}


// â”€â”€â”€ Settings section helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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

// â”€â”€â”€ App Root â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function App() {
  const [view, setView] = useState<View>("player");
  const [track, setTrack] = useState<Track>(initialTrack);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [user, setUser] = useState<AppUser | null>(null);
  const [modal, setModal] = useState<{ id: string; title: string; message: string; buttons: string[] } | null>(null);
  const [overlayPath, setOverlayPath] = useState("");
  const [locale, setLocale] = useState("en");
  const [isMac, setIsMac] = useState<boolean>(false);
  useEffect(() => {
    const api = (window as any).api;
    if (!api) return;

    api.getInfo?.((info: any) => {
      setTrack((prev) => ({
        ...prev, ...info,
        cover: info?.cover?.includes("spotify:image:")
          ? info.cover.replace("spotify:image:", "https://i.scdn.co/image/")
          : info?.cover,
      }));
    });

    const removeSettingsListener = api.onSettingsChanged?.((next: AppSettings) => {
      setSettings(previous => ({ ...previous, ...next }));
    });
    api.loadSettings?.().then((s: any) => {
      if (s) setSettings((prev) => ({ ...prev, ...s }));
    });

    api.getOverlayPath?.()
      .then((path: string) => setOverlayPath(path || ""))
      .catch((error: unknown) => console.error("Failed to load overlay path:", error));
    api.getLocale?.().then((nextLocale: string) => {
      if (nextLocale) setLocale(nextLocale);
    });
    api.onLocaleUpdate?.((nextLocale: string) => {
      if (nextLocale) setLocale(nextLocale);
    });

    const loadUser = async () => {
      const u = await api.fetchUserData?.();
      setUser(u || null);
    };
    void loadUser();

    api.authSuccess?.((res: any) => {
      if (res?.status === "logged-out" || res?.status === "error") { setUser(null); return; }
      void loadUser();
    });

    api.onModal?.((data: any) => setModal(data));

    api.onToast?.((event: any, data: any) => {
      const msg = typeof data === "string" ? data : data?.message;
      const type = typeof data === "object" ? data?.type : "info";
      if (type === "success") toast.success(msg);
      else if (type === "error") toast.error(msg);
      else toast.info(msg);
    });

    api.updateQueuePage?.((q: any) => {
      if (q?.items) setQueueItems(q.items);
    });
    api.getQueue?.().then((q: any) => {
      if (q?.items) setQueueItems(q.items);
    }).catch(() => setQueueItems([]));

    api.preload?.();
    const checkIsMac = async () => {
      try {
        const result = await api.isMac?.();
        setIsMac(result || false);
      } catch (error) {
        console.error("Failed to check if running on macOS:", error);
      }
    };
    void checkIsMac();
    return () => removeSettingsListener?.();

  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", !!settings.reducedMotion);
  }, [settings.reducedMotion]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-white">
      <style>{CSS}</style>
      <RedesignedTopbar title="Request+" isMac={isMac} />

      <div className="h-full pt-8 pb-[52px] overflow-hidden">
        {view === "player" && (
          <RedesignedMusicPlayer
            track={track}
            setTrack={setTrack}
            queueItems={queueItems}
            platform={settings.platform}
            locale={locale}
          />
        )}
        {view === "queue" && (
          <RedesignedQueuePage items={queueItems} setItems={setQueueItems} locale={locale} />
        )}
        {view === "settings" && (
          <RedesignedSettingsView
            settings={settings}
            setSettings={setSettings}
            user={user}
            setUser={setUser}
            overlayPath={overlayPath}
            locale={locale}
          />
        )}
      </div>

      <RedesignedNavigation
        current={view}
        onNavigate={setView}
        showQueue={settings.autoPlay !== false}
        locale={locale}
      />

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 px-5">
          <div className="w-full max-w-[340px] rounded-2xl border border-violet-500/25 bg-slate-900 p-5 shadow-2xl">
            <h2 className="text-base font-extrabold text-white">{modal.title}</h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-400 whitespace-pre-wrap">{modal.message}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {modal.buttons.map((btn, i) => {
                const isDecline = btn.toLowerCase() === "decline";
                const isPrimary = i === 0;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      const id = modal.id;
                      setModal(null);
                      (window as any).api?.respondToModal?.(id, i);
                    }}
                    className={
                      isDecline
                        ? "rounded-xl bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/25 transition-colors"
                        : isPrimary
                        ? "rounded-xl bg-gradient-to-r from-violet-600 to-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:from-violet-500 hover:to-emerald-500 transition-all"
                        : "rounded-xl bg-slate-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-600 transition-colors"
                    }
                  >
                    {btn}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <Toaster position="top-right" richColors />
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
