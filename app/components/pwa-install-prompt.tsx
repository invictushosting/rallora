"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "rallora-pwa-install-dismissed";

export default function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (standalone || localStorage.getItem(DISMISSED_KEY) === "true") return;

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIos(ios);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setShow(true);
    };

    const onInstalled = () => {
      setPromptEvent(null);
      setShow(false);
      localStorage.removeItem(DISMISSED_KEY);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS does not expose beforeinstallprompt, so provide manual guidance.
    if (ios) setShow(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setShow(false);
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setShow(false);
    setPromptEvent(null);
  };

  if (!show) return null;

  return (
    <aside className="pwa-install" aria-label="Install Rallora">
      <button className="pwa-install__close" type="button" onClick={dismiss} aria-label="Dismiss install prompt">
        ×
      </button>
      <img className="pwa-install__icon" src="/icon-192.png" alt="" width="48" height="48" />
      <div className="pwa-install__copy">
        <strong>Get the Rallora app</strong>
        {isIos ? (
          <span>For quicker access, tap Share <b>↑</b> then <b>Add to Home Screen</b>.</span>
        ) : (
          <span>Add Rallora to your home screen for quick access to leagues, fixtures and results.</span>
        )}
      </div>
      {!isIos && promptEvent ? (
        <button className="pwa-install__button" type="button" onClick={install}>
          Install
        </button>
      ) : null}
    </aside>
  );
}
