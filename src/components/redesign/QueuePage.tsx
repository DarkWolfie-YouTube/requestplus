import { Music, Settings, List, X, Minus, Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat, Repeat1, Volume2, Trash2, Check, Copy, Eye, Headphones, ListChecks, Lock, Radio, Shield, Sparkles, UserRound, ExternalLink, RefreshCw, LogOut, User as UserIcon, ArrowLeft, ArrowRight, Music2 } from "lucide-react";
import { toast } from "sonner";
import { Blobs, fmt, TrackArt } from "./shared";
import type { QueueItem } from "./shared";
import { t } from "../../i18n";

export function QueuePage({ items, setItems, locale }: { items: QueueItem[]; setItems: (q: QueueItem[]) => void; locale: string }) {
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
    toast.success(t("CLIENT_REMOVE_FROM_QUEUE", locale));
  };

  const clear = async () => {
    const cleared = await api()?.clearQueue?.();
    if (cleared === false) {
      toast.error("Could not clear the queue");
      return;
    }

    setItems([]);
    toast.success(t("CLIENT_CLEAR_QUEUE", locale));
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
              <h3 className="text-sm font-bold text-white">{t("CLIENT_NAV_QUEUE", locale)}</h3>
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
              {t("CLIENT_CLEAR_QUEUE", locale)}
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
                <p className="text-sm font-bold text-white">{t("CLIENT_QUEUE_EMPTY", locale)}</p>
                <p className="mt-0.5 text-xs text-slate-600">{t("CLIENT_QUEUE_EMPTY_DESC", locale)}</p>
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
                        {t("CLIENT_PLAYING", locale)}
                      </span>
                    )}
                    {item.isQueued && !item.iscurrentlyPlaying && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-400">
                        {t("CLIENT_QUEUED", locale)}
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Settings section helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
