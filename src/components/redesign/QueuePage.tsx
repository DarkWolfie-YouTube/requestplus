import { Music, Settings, List, X, Minus, Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat, Repeat1, Volume2, Trash2, Check, Copy, Eye, Headphones, ListChecks, Lock, Radio, Shield, Sparkles, UserRound, ExternalLink, RefreshCw, LogOut, User as UserIcon, ArrowLeft, ArrowRight, Music2, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Blobs, fmt, TrackArt } from "./shared";
import type { QueueItem } from "./shared";
import { t } from "../../i18n";

export function QueuePage({ items, setItems, locale }: { items: QueueItem[]; setItems: (q: QueueItem[]) => void; locale: string }) {
  const api = () => (window as any).api;

  // Index the pointer went down on a drag handle — the row only becomes
  // draggable then, so a plain click anywhere else still starts the song.
  const [armedIndex, setArmedIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const lastDragEnd = useRef(0);

  // Songs that are playing or already handed to Spotify/YTM cannot be reordered:
  // the platform queue owns them at that point. Mirrors QueueHandler.isLocked.
  const isLocked = (item: QueueItem) => Boolean(item.isQueued) || Boolean(item.iscurrentlyPlaying);

  const canMove = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return false;
    for (let i = Math.min(from, to); i <= Math.max(from, to); i++) {
      if (isLocked(items[i])) return false;
    }
    return true;
  };

  const move = async (from: number, to: number) => {
    if (!canMove(from, to)) return;

    const item = items[from];
    const reordered = items.slice();
    reordered.splice(from, 1);
    reordered.splice(to, 0, item);
    setItems(reordered); // optimistic — main pushes the authoritative queue right after

    const moved = await api()?.moveInQueue?.(from, to, item.id);
    if (moved === false) {
      setItems(items);
      toast.error(t("CLIENT_MOVE_FAILED", locale));
    }
  };

  const resetDrag = () => {
    setArmedIndex(null);
    setDragIndex(null);
    setOverIndex(null);
  };

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
              {items.map((item, idx) => {
                const locked = isLocked(item);
                const isDropTarget = dragIndex !== null && dragIndex !== idx && overIndex === idx;

                return (
                <div
                  key={item.id}
                  draggable={!locked && armedIndex === idx}
                  onDragStart={(event) => {
                    if (locked) {
                      event.preventDefault();
                      return;
                    }
                    setDragIndex(idx);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(idx));
                  }}
                  onDragOver={(event) => {
                    if (dragIndex === null || !canMove(dragIndex, idx)) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setOverIndex(idx);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const from = dragIndex;
                    lastDragEnd.current = Date.now();
                    resetDrag();
                    if (from !== null) void move(from, idx);
                  }}
                  onDragEnd={() => {
                    lastDragEnd.current = Date.now();
                    resetDrag();
                  }}
                  onClick={() => {
                    // A drop must not double as a click that starts the song.
                    if (Date.now() - lastDragEnd.current < 300) return;
                    void play(idx);
                  }}
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
                  } ${dragIndex === idx ? "opacity-40" : ""} ${
                    isDropTarget ? "ring-1 ring-inset ring-violet-400/60 bg-violet-500/[0.06]" : ""
                  } cursor-pointer`}
                >
                  {/* Drag handle — only pending requests can be reordered */}
                  {locked ? (
                    <div className="w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <button
                      type="button"
                      title={t("CLIENT_DRAG_TO_REORDER", locale)}
                      aria-label={t("CLIENT_DRAG_TO_REORDER", locale)}
                      onPointerDown={() => setArmedIndex(idx)}
                      onPointerUp={() => setArmedIndex(null)}
                      onClick={(event) => event.stopPropagation()}
                      className="flex w-4 shrink-0 cursor-grab items-center justify-center text-slate-700 opacity-0 transition-all hover:text-violet-300 group-hover:opacity-100 active:cursor-grabbing"
                    >
                      <GripVertical className="size-3.5" />
                    </button>
                  )}

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

                  {/* Status + duration + reorder + remove */}
                  <div className="flex shrink-0 items-center gap-2" onKeyDown={(event) => event.stopPropagation()}>
                    {item.iscurrentlyPlaying && (
                      <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-violet-300">
                        {t("CLIENT_PLAYING", locale)}
                      </span>
                    )}
                    {item.isQueued && !item.iscurrentlyPlaying && (
                      <span
                        title={t("CLIENT_MOVE_LOCKED", locale)}
                        className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-400"
                      >
                        {t("CLIENT_QUEUED", locale)}
                      </span>
                    )}
                    <span className="text-[11px] font-semibold tabular-nums text-slate-700">{fmt(item.duration)}</span>
                    {!locked && (
                      <>
                        <button
                          type="button"
                          disabled={!canMove(idx, idx - 1)}
                          title={t("CLIENT_MOVE_UP", locale)}
                          aria-label={t("CLIENT_MOVE_UP", locale)}
                          onClick={(event) => {
                            event.stopPropagation();
                            void move(idx, idx - 1);
                          }}
                          className="flex size-6 items-center justify-center rounded text-slate-700 opacity-0 transition-all hover:bg-violet-500/20 hover:text-violet-300 group-hover:opacity-100 disabled:cursor-not-allowed disabled:text-slate-800 disabled:hover:bg-transparent disabled:hover:text-slate-800"
                        >
                          <ChevronUp className="size-3" />
                        </button>
                        <button
                          type="button"
                          disabled={!canMove(idx, idx + 1)}
                          title={t("CLIENT_MOVE_DOWN", locale)}
                          aria-label={t("CLIENT_MOVE_DOWN", locale)}
                          onClick={(event) => {
                            event.stopPropagation();
                            void move(idx, idx + 1);
                          }}
                          className="flex size-6 items-center justify-center rounded text-slate-700 opacity-0 transition-all hover:bg-violet-500/20 hover:text-violet-300 group-hover:opacity-100 disabled:cursor-not-allowed disabled:text-slate-800 disabled:hover:bg-transparent disabled:hover:text-slate-800"
                        >
                          <ChevronDown className="size-3" />
                        </button>
                      </>
                    )}
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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Settings section helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
