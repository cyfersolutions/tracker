"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";

type Theme = "light" | "dark";

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore<Theme>(subscribe, readTheme, () => "light");
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage may be unavailable (private mode); the toggle still works for this session.
    }
  }

  return (
    <button
      type="button"
      className={`theme-toggle${compact ? " theme-toggle-compact" : ""}`}
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
      {!compact && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
