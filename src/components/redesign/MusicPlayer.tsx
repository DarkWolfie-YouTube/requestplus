import { useEffect, useRef, useState } from "react";
import { Music, Settings, List, X, Minus, Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat, Repeat1, Volume2, Trash2, Check, Copy, Eye, Headphones, ListChecks, Lock, Radio, Shield, Sparkles, UserRound, ExternalLink, RefreshCw, LogOut, User as UserIcon, ArrowLeft, ArrowRight, Music2 } from "lucide-react";
import { Blobs, fmt, TrackArt } from "./shared";
import type { Track } from "./shared";
import { t } from "../../i18n";

export function MusicPlayer({ track, setTrack, locale }: { track: Track; setTrack: (t: Track) => void; locale: string }) {
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
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-400">{t("CLIENT_NOW_PLAYING", locale)}</p>
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
