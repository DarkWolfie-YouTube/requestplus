import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { Onboarding } from "./components/redesign/Onboarding";
import { X, Minus } from "lucide-react";
import { t } from "./i18n";

function OobeApp() {
  const [locale, setLocale] = useState("en");
  useEffect(() => {
    void window.api.getLocale().then(value => {
      if (value) setLocale(value);
    }).catch(() => {});
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return <div className="setup-app">
    <div className="setup-topbar">
      <span style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>{t("OOBE_TOPBAR_TITLE", locale)}</span>
      <button type="button" aria-label={t("SETUP_MINIMIZE", locale)} onClick={() => void window.api.minimize()}><Minus size={14} /></button>
      <button type="button" aria-label={t("SETUP_CLOSE", locale)} onClick={() => void window.api.close()}><X size={14} /></button>
    </div>
    <Onboarding locale={locale} setLocale={setLocale} />
    <Toaster position="top-right" richColors />
  </div>;
}

const container = document.getElementById("root");
if (container) createRoot(container).render(<OobeApp />);
