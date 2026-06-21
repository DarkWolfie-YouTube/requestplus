import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { Onboarding } from "./components/redesign/Onboarding";
import { Topbar } from "./components/redesign/Topbar";
import type { AppUser } from "./components/redesign/shared";
import { t } from "./i18n";

const onboardingCss = `
  @keyframes blob {
    0% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(28px, -46px) scale(1.08); }
    66% { transform: translate(-18px, 18px) scale(0.93); }
    100% { transform: translate(0, 0) scale(1); }
  }
  .blob { animation: blob 8s infinite ease-in-out; }
  .d2 { animation-delay: 2.5s; }
  .d4 { animation-delay: 4.5s; }
`;

function OobeApp() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [overlayPath, setOverlayPath] = useState("");
  const [locale, setLocale] = useState("en");

  useEffect(() => {
    const api = (window as any).api;
    if (!api) return;

    const loadUser = async () => {
      try {
        const account = await api.fetchUserData?.();
        setUser(account || null);
      } catch (error) {
        console.error("Failed to load Request+ account:", error);
        setUser(null);
      }
    };

    void loadUser();
    void api.yes?.()
      .then((path: string) => setOverlayPath(path || ""))
      .catch((error: unknown) => console.error("Failed to load overlay URL:", error));
    api.getLocale?.().then((nextLocale: string) => {
      if (nextLocale) setLocale(nextLocale);
    });
    api.onLocaleUpdate?.((nextLocale: string) => {
      if (nextLocale) setLocale(nextLocale);
    });

    api.authSuccess?.((response: any) => {
      if (response?.status === "logged-out" || response?.status === "error") {
        setUser(null);
        return;
      }
      void loadUser();
    });
    api.authCheck?.((authenticated: boolean) => {
      if (authenticated) void loadUser();
      else setUser(null);
    });
    void api.authChecker?.();
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-white">
      <style>{onboardingCss}</style>
      <Topbar title={t("OOBE_TOPBAR_TITLE", locale)} />
      <div className="h-full pt-8">
        <Onboarding
          user={user}
          overlayPath={overlayPath}
          locale={locale}
          onComplete={() => window.close()}
        />
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<OobeApp />);
}
