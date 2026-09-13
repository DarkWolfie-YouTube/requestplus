import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

/**
 * Catches render-time errors so a single bad prop can't blank the whole window.
 *
 * Without this, React unmounts the entire tree on any throw and the app shows a
 * black window that only an application restart recovers from — with nothing in
 * the log to explain it, because renderer errors never reached the main process.
 * The boundary keeps the window usable and reports the error so it lands in
 * log.txt next to everything else.
 */
interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Reaches the main process so it shows up in log.txt; DevTools are disabled
    // in packaged builds, so the console alone is not reachable for users.
    (window as any).api?.reportRendererError?.({
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
    console.error("[Renderer] Unhandled render error:", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-center text-white">
        <div className="text-lg font-semibold">Something went wrong</div>
        <div className="max-w-lg break-words text-sm text-slate-400">{error.message}</div>
        <button
          onClick={() => this.setState({ error: null })}
          className="rounded-full bg-slate-800 px-5 py-2 text-sm ring-1 ring-white/10 transition-all hover:bg-slate-700 active:scale-95"
        >
          Try again
        </button>
      </div>
    );
  }
}
