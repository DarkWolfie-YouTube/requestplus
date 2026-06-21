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

// â”€â”€â”€ Topbar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Topbar({ title = "Request+" }: { title?: string }) {
  const api = () => (window as any).api;

  useEffect(() => {
    const handleToast = (msg: string, type: string, duration: number) => {
      const opts = { duration };
      if (type === "success") toast.success(msg, opts);
      else if (type === "error") toast.error(msg, opts);
      else if (type === "warning") toast.warning(msg, opts);
      else toast.info(msg, opts);
    };
    api()?.showToast?.(handleToast);
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex h-8 items-center border-b border-violet-500/20 bg-slate-950/95 backdrop-blur">
      <div
        className="flex h-full flex-1 cursor-move select-none items-center px-4"
        style={{ WebkitAppRegion: "drag" } as any}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-400/80">{title}</span>
      </div>
      <div className="flex h-full items-center" style={{ WebkitAppRegion: "no-drag" } as any}>
        <button
          onClick={() => api()?.minimize?.()}
          className="flex h-8 w-10 items-center justify-center text-slate-500 transition-colors hover:bg-slate-800/80 hover:text-slate-200"
          aria-label="Minimize"
        >
          <Minus className="size-3" />
        </button>
        <button
          onClick={() => api()?.close?.()}
          className="flex h-8 w-10 items-center justify-center text-slate-500 transition-colors hover:bg-red-500/80 hover:text-white"
          aria-label="Close"
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  );
}

// â”€â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Navigation({ current, onNavigate, showQueue }: {
  current: View; onNavigate: (v: View) => void; showQueue: boolean;
}) {
  const tabs = [
    { id: "player" as View, icon: Music, label: "Player" },
    ...(showQueue ? [{ id: "queue" as View, icon: List, label: "Queue" }] : []),
    { id: "settings" as View, icon: Settings, label: "Settings" },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-violet-500/20 bg-slate-950/95 backdrop-blur-xl">
      <div className="flex items-center gap-1.5 px-3 py-2">
        {tabs.map(({ id, icon: Icon, label }) => {
          const active = current === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all ${
                active
                  ? "bg-gradient-to-r from-violet-600 to-emerald-600 text-white shadow-lg shadow-violet-950/50"
                  : "text-slate-500 hover:bg-slate-800/80 hover:text-slate-200"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// â”€â”€â”€ Music Player â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MusicPlayer({ track, setTrack }: { track: Track; setTrack: (t: Track) => void }) {
  const [vol, setVol] = useState(Math.round(track.volume * 100));
  const [liked, setLiked] = useState(track.isLiked);
  const adjusting = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const api = () => (window as any).api;

  useEffect(() => {
    if (!adjusting.current) setVol(Math.round(track.volume * 100));
    setLiked(track.isLiked);
  }, [track.volume, track.isLiked]);

  const pct = track.duration > 0 ? (track.progress / track.duration) * 100 : 0;

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = Math.round(p * track.duration);
    setTrack({ ...track, progress: t });
    api()?.seek?.(t);
  };

  const changeVol = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value);
    setVol(v);
    adjusting.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { adjusting.current = false; }, 2000);
    setTrack({ ...track, volume: v / 100 });
    api()?.volume?.(v / 100);
  };

  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    setTrack({ ...track, isLiked: next });
    api()?.like?.();
  };

  const volBg = `linear-gradient(to right,#8b5cf6 0%,#10b981 ${vol}%,#1e293b ${vol}%,#1e293b 100%)`;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-slate-950">
      <Blobs opacity="opacity-[0.22]" />

      <div className="relative flex h-full flex-col items-center justify-center gap-4 px-7 py-4 overflow-y-auto no-sb">
        {/* Header */}
        <div className="flex w-full max-w-sm items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-400">Now Playing</p>
            <p className="text-[11px] text-slate-500">Request+</p>
          </div>
          <div className="flex size-8 items-center justify-center rounded-xl bg-slate-800/80 ring-1 ring-white/8">
            <Music className="size-3.5 text-violet-300" />
          </div>
        </div>

        {/* Album Art */}
        <div className="relative w-full max-w-sm">
          <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-violet-500 to-emerald-500 opacity-35 blur-2xl" />
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
            <TrackArt cover={track.cover} title={track.title} artist={track.artist} className="h-full w-full" />
          </div>
        </div>

        {/* Track Info */}
        <div className="w-full max-w-sm text-center">
          <h2 className="truncate text-[22px] font-extrabold leading-tight text-white">{track.title}</h2>
          <p className="mt-0.5 truncate text-sm font-semibold text-violet-300">{track.artist}</p>
          <p className="truncate text-xs text-slate-600">{track.album}</p>
        </div>

        {/* Progress */}
        <div className="w-full max-w-sm space-y-1.5">
          <div
            className="h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-slate-800"
            onClick={seek}
            role="progressbar"
            aria-valuenow={pct}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] font-semibold tabular-nums text-slate-600">{fmt(track.progress)}</span>
            <span className="text-[10px] font-semibold tabular-nums text-slate-600">{fmt(track.duration)}</span>
          </div>
        </div>

        {/* Main Controls */}
        <div className="flex w-full max-w-sm items-center justify-center gap-3">
          <button
            onClick={() => api()?.previous?.()}
            className="flex size-12 items-center justify-center rounded-full bg-slate-800/80 text-white ring-1 ring-white/8 transition-all hover:bg-slate-700 active:scale-95"
          >
            <SkipBack className="size-5 fill-current" />
          </button>
          <button
            onClick={() => api()?.playPause?.()}
            className="flex size-[68px] items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-emerald-600 text-white shadow-xl shadow-violet-900/50 transition-all hover:from-violet-500 hover:to-emerald-500 active:scale-95"
          >
            {track.isPlaying
              ? <Pause className="size-7 fill-current" />
              : <Play className="size-7 fill-current ml-0.5" />}
          </button>
          <button
            onClick={() => api()?.skip?.()}
            className="flex size-12 items-center justify-center rounded-full bg-slate-800/80 text-white ring-1 ring-white/8 transition-all hover:bg-slate-700 active:scale-95"
          >
            <SkipForward className="size-5 fill-current" />
          </button>
        </div>

        {/* Secondary Controls */}
        <div className="flex w-full max-w-sm items-center justify-between">
          <div className="flex gap-1">
            <button
              onClick={() => api()?.shuffle?.()}
              className={`flex size-9 items-center justify-center rounded-xl transition-all ${
                track.shuffle ? "bg-violet-500/20 text-violet-400" : "text-slate-600 hover:text-slate-400"
              }`}
            >
              <Shuffle className="size-4" />
            </button>
            <button
              onClick={() => api()?.repeat?.()}
              className={`flex size-9 items-center justify-center rounded-xl transition-all ${
                track.repeat !== 0 ? "bg-violet-500/20 text-violet-400" : "text-slate-600 hover:text-slate-400"
              }`}
            >
              {track.repeat === 2 ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
            </button>
          </div>
          <button
            onClick={toggleLike}
            className={`flex size-9 items-center justify-center rounded-xl transition-all ${
              liked ? "bg-pink-500/20 text-pink-400" : "text-slate-600 hover:text-pink-400"
            }`}
          >
            <Heart className={`size-4 ${liked ? "fill-current" : ""}`} />
          </button>
        </div>

        {/* Volume */}
        <div className="flex w-full max-w-sm items-center gap-3">
          <Volume2 className="size-4 shrink-0 text-slate-600" />
          <input
            type="range" min="0" max="100" value={vol}
            onChange={changeVol}
            className="vol flex-1"
            style={{ background: volBg }}
          />
          <span className="w-9 text-right text-[11px] font-semibold tabular-nums text-slate-600">{vol}%</span>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Queue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function QueuePage({ items, setItems }: { items: QueueItem[]; setItems: (q: QueueItem[]) => void }) {
  const api = () => (window as any).api;

  const remove = async (id: string) => {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;

    const removed = await api()?.removeFromQueue?.(index);
    if (removed === false) {
      toast.error("Could not remove this song");
      return;
    }

    setItems(items.filter((item) => item.id !== id));
    toast.success("Removed from queue");
  };

  const clear = async () => {
    const cleared = await api()?.clearQueue?.();
    if (cleared === false) {
      toast.error("Could not clear the queue");
      return;
    }

    setItems([]);
    toast.success("Queue cleared");
  };

  const play = async (index: number) => {
    const started = await api()?.playTrackAtIndex?.(index);
    if (started === false) toast.error("Could not start this song");
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-slate-950">
      <Blobs opacity="opacity-[0.18]" />
      <div className="relative flex h-full flex-col gap-3 px-5 py-4">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-emerald-600 shadow-lg shadow-violet-900/40">
              <List className="size-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Queue</h3>
              <p className="text-[11px] text-slate-500">
                {items.length === 0 ? "Empty" : `${items.length} song${items.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          {items.length > 0 && (
            <button
              onClick={clear}
              className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/20"
            >
              <Trash2 className="size-3" />
              Clear all
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-violet-500/15 bg-slate-900/60 backdrop-blur-sm">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-emerald-500/20">
                <Music className="size-6 text-violet-300/60" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-white">Queue is empty</p>
                <p className="mt-0.5 text-xs text-slate-600">Song requests will appear here</p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto no-sb divide-y divide-white/[0.04]">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => void play(idx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void play(idx);
                    }
                  }}
                  className={`group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04] ${
                    item.iscurrentlyPlaying ? "bg-violet-500/[0.07]" : ""
                  } cursor-pointer`}
                >
                  {/* Index / playing dot */}
                  <div className="flex w-5 shrink-0 items-center justify-center">
                    {item.iscurrentlyPlaying ? (
                      <span className="block size-2 rounded-full bg-emerald-400 shadow-[0_0_6px_2px] shadow-emerald-500/50" />
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-700">{idx + 1}</span>
                    )}
                  </div>

                  {/* Art */}
                  <div className="size-10 shrink-0 overflow-hidden rounded-lg">
                    <TrackArt cover={item.cover} title={item.title} artist={item.artist} className="size-10" />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-semibold ${item.iscurrentlyPlaying ? "text-violet-300" : "text-white"}`}>
                      {item.title}
                    </p>
                    <p className="truncate text-[11px] text-slate-600">{item.artist}</p>
                  </div>

                  {/* Status + duration + remove */}
                  <div className="flex shrink-0 items-center gap-2">
                    {item.iscurrentlyPlaying && (
                      <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-violet-300">
                        Playing
                      </span>
                    )}
                    {item.isQueued && !item.iscurrentlyPlaying && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-400">
                        Queued
                      </span>
                    )}
                    <span className="text-[11px] font-semibold tabular-nums text-slate-700">{fmt(item.duration)}</span>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void remove(item.id);
                      }}
                      className="flex size-6 items-center justify-center rounded text-slate-700 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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

// â”€â”€â”€ Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SettingsView({ settings, setSettings, user, setUser, overlayPath }: {
  settings: AppSettings; setSettings: (s: AppSettings) => void;
  user: AppUser | null; setUser: (u: AppUser | null) => void;
  overlayPath: string;
}) {
  const [copied, setCopied] = useState(false);
  const p = (patch: Partial<AppSettings>) => setSettings({ ...settings, ...patch });
  const api = () => (window as any).api;

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
  ];

  const themes = [
    "default", "custom", "gojo", "hologram", "mdev", "moonkingbean", "twinGhost",
    "nowplaying-default", "nowplaying-custom", "nowplaying-gojo", "nowplaying-hologram",
    "nowplaying-mdev", "nowplaying-moonkingbean", "nowplaying-twinGhost",
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
            <h3 className="text-sm font-bold text-white">Settings</h3>
            <p className="text-[11px] text-violet-400">Request+</p>
          </div>
        </div>

        {/* Account */}
        <Section title="Request+ Account">
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
                Log Out
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
                Sign In with Request+
              </button>
            </div>
          )}
        </Section>

        {/* OBS Overlay */}
        {overlayPath && (
          <Section title="OBS Overlay">
            <div className="p-4 space-y-2">
              <p className="text-xs text-slate-600">Add this as a Browser Source in OBS Studio.</p>
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
        <Section title="Song Requests">
          <ToggleRow label="Enable Requests" desc="Allow viewers to request songs" checked={settings.enableRequests} onChange={(v) => p({ enableRequests: v })} />
          <ToggleRow label="Mods Only" desc="Only moderators can request" checked={settings.modsOnly} onChange={(v) => p({ modsOnly: v })} />
          <ToggleRow label="Subs Only" desc="Only subscribers can request" checked={settings.subsOnly} onChange={(v) => p({ subsOnly: v })} />
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
                onChange={(e) => p({ platform: e.target.value })}
                className="w-full rounded-xl border border-violet-500/20 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                {platforms.map((o) => <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>)}
              </select>
            </div>
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
              {themes.map((t) => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
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
            <p className="text-xs text-slate-600">Version 3.0.0 · Built for streamers by streamers</p>
            <button
              onClick={() => window.open("https://requestplus.xyz", "_blank")}
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

// â”€â”€â”€ Onboarding â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// Onboarding is rendered in its own 800Ã—800 Electron window (32px topbar â†’ 768px content)
function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState(defaultSettings);
  const [user] = useState<AppUser | null>(null);
  const [overlayPath] = useState("http://localhost:3000/overlay");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const p = (patch: Partial<AppSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const pct = ((step + 1) / STEPS.length) * 100;

  const finish = async () => {
    setSaving(true);
    try {
      const next = { ...settings, oobeCompleted: true };
      localStorage.setItem("settings", JSON.stringify(next));
      localStorage.setItem("requestplus:v3:oobe-complete", "true");
      await (window as any).api?.saveSettings?.(next);
      onComplete();
      toast.success("Request+ is ready!");
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
    toast.success("Overlay URL copied!");
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

      {/* â”€â”€ Sidebar â”€â”€ */}
      <aside className="relative z-10 flex w-[220px] shrink-0 flex-col border-r border-white/[0.07] bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
        {/* Brand */}
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-emerald-500 shadow-md">
            <Sparkles className="size-4 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">Setup</p>
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
                    Skip setup →
        </button>
      </aside>

      {/* â”€â”€ Main content â”€â”€ */}
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
                <h2 className="text-3xl font-extrabold">Connect Account</h2>
                <p className="mt-2 text-[15px] leading-7 text-slate-400">Sign in with your Request+ account to identify song requesters and enable moderation features.</p>
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
                    onClick={() => window.open("https://docs.requestplus.xyz", "_blank")}
                    className="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-emerald-600 px-4 py-2 text-sm font-bold text-white transition-all hover:from-violet-500 hover:to-emerald-500"
                  >
                    Open Docs
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* â”€â”€ Footer nav â”€â”€ */}
        <div className="shrink-0 flex items-center justify-between border-t border-white/[0.06] bg-slate-950/40 px-8 py-4 backdrop-blur-sm">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex h-10 items-center gap-2 rounded-xl bg-white/8 px-5 text-sm font-bold text-white transition-colors disabled:opacity-30 hover:bg-white/12"
          >
            <ArrowLeft className="size-4" />
            Back
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
              {step === STEPS.length - 1 ? (saving ? "Saving..." : "Finish") : "Continue"}
            {step === STEPS.length - 1 ? <Check className="size-4" /> : <ArrowRight className="size-4" />}
          </button>
        </div>
      </div>
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
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-white">
      <style>{CSS}</style>
      <RedesignedTopbar title="Request+" />

      <div className="h-full pt-8 pb-[52px] overflow-hidden">
        {view === "player" && (
          <RedesignedMusicPlayer track={track} setTrack={setTrack} locale={locale} />
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm">
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
  createRoot(container).render(<App />);
}
