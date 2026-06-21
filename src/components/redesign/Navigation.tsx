import { Music, Settings, List } from "lucide-react";
import type { View } from "./shared";
import { t } from "../../i18n";

export function Navigation({ current, onNavigate, showQueue, locale }: {
  current: View; onNavigate: (v: View) => void; showQueue: boolean; locale: string;
}) {
  const tabs = [
    { id: "player" as View, icon: Music, label: t("CLIENT_NAV_PLAYER", locale) },
    ...(showQueue ? [{ id: "queue" as View, icon: List, label: t("CLIENT_NAV_QUEUE", locale) }] : []),
    { id: "settings" as View, icon: Settings, label: t("NAV_SETTINGS", locale) },
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
