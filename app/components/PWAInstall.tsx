"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
  }>;
}

export default function PWAInstall() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((error) => {
          console.error(
            "Service Worker registration failed:",
            error
          );
        });
    }

    // Check if app is already installed
    const isStandalone =
      window.matchMedia(
        "(display-mode: standalone)"
      ).matches ||
      (window.navigator as Navigator & {
        standalone?: boolean;
      }).standalone === true;

    if (isStandalone) {
      setInstalled(true);
    }

    // Detect browser install prompt
    const handleBeforeInstallPrompt = (
      event: Event
    ) => {
      event.preventDefault();

      setInstallEvent(
        event as BeforeInstallPromptEvent
      );
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;

    await installEvent.prompt();

    const choice =
      await installEvent.userChoice;

    if (choice.outcome === "accepted") {
      setInstalled(true);
    }

    setInstallEvent(null);
  };

  // Don't show button when already installed
  // or browser doesn't provide install prompt
  if (installed || !installEvent) {
    return null;
  }

  return (
    <button
      onClick={handleInstall}
      style={{
        position: "fixed",
        top: "72px",
        right: "14px",
        zIndex: 9999,
        border: "none",
        borderRadius: "999px",
        padding: "10px 16px",
        background: "#ff3040",
        color: "#ffffff",
        fontSize: "14px",
        fontWeight: 700,
        boxShadow:
          "0 6px 20px rgba(0,0,0,0.35)",
        cursor: "pointer",
      }}
    >
      📲 App Install
    </button>
  );
}