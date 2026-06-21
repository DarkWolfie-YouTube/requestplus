import { useEffect } from "react";
import { X, Minus } from "lucide-react";
import { toast } from "sonner";

export function Topbar({ title = "Request+" }: { title?: string }) {
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Navigation Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
