import { useState, useEffect } from "react";
import { Music } from "lucide-react";

export type View = "player" | "queue" | "settings";

export interface Track {
  title: string; artist: string; album: string;
  duration: number; progress: number; cover: string;
  isPlaying: boolean; volume: number; shuffle: boolean;
  repeat: number; isLiked: boolean;
}

export interface QueueItem {
  id: string; title: string; artist: string; cover: string;
  duration: number; iscurrentlyPlaying: boolean; isQueued: boolean;
  requestedBy?: string;
}

export interface AppUser {
  display_name: string; profile_image_url: string; email: string;
}

export interface AppSettings {
  enableRequests: boolean; modsOnly: boolean; subsOnly: boolean;
  requestLimitEnabled: boolean; requestLimit: number; autoPlay: boolean;
  autoAcceptSearchResults: boolean; useChannelPoints: boolean;
  channelPointRequestsEnabled: boolean; telemetryEnabled: boolean;
  platform: string; filterExplicit: boolean; gtsEnabled: boolean;
  theme: string; appleMusicAppToken: string; ciderApiVersion: "3" | "4";
  ciderV4AppToken: string; primarySearchPlatform: string;
  showNotifications: boolean; [key: string]: any;
}

export const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
};

export function TrackArt({ cover, title, artist, className = "" }: { cover: string; title: string; artist: string; className?: string }) {
  const [err, setErr] = useState(false);
  // Reset the error latch when the cover changes, otherwise one failed load
  // pins the placeholder for every subsequent track (the component isn't remounted).
  useEffect(() => { setErr(false); }, [cover]);
  const hue = ((title.charCodeAt(0) || 65) * 47 + (artist.charCodeAt(0) || 65) * 19) % 360;

  if (cover && !err) {
    return <img src={cover} alt={`${title} - ${artist}`} className={`${className} object-cover`} onError={() => setErr(true)} />;
  }

  return (
    <div className={`${className} flex items-center justify-center`} style={{ background: `linear-gradient(135deg, hsl(${hue},55%,22%), hsl(${(hue + 90) % 360},55%,18%))` }}>
      <Music className="size-[35%] text-white/25" />
    </div>
  );
}

export function Switch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${checked ? "bg-gradient-to-r from-violet-500 to-emerald-500" : "bg-slate-700"}`}>
      <span className={`pointer-events-none block size-4 rounded-full bg-white shadow transition-transform duration-200 my-0.5 ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );
}

export function Blobs({ opacity = "opacity-20" }: { opacity?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${opacity}`}>
      <div className="blob absolute -left-10 -top-10 h-80 w-80 rounded-full bg-violet-600 blur-[80px]" />
      <div className="blob d2 absolute -right-10 top-16 h-80 w-80 rounded-full bg-emerald-500 blur-[80px]" />
      <div className="blob d4 absolute -bottom-16 left-24 h-96 w-96 rounded-full bg-cyan-500 blur-[80px]" />
    </div>
  );
}

