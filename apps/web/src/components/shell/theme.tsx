'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';

type ThemePreference = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'mp.theme';
const THEME_EVENT = 'mp:theme-change';

/**
 * Inline script executed before first paint so the correct theme class is present on
 * <html> immediately (no flash of the wrong theme).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${STORAGE_KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

function apply(preference: ThemePreference) {
  const dark =
    preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

const ORDER: ThemePreference[] = ['system', 'light', 'dark'];
const LABELS: Record<ThemePreference, string> = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' };
const ICONS = { system: Monitor, light: Sun, dark: Moon };

/** The stored preference is an external store shared by every theme control (header, settings). */
function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useThemePreference() {
  const preference = useSyncExternalStore<ThemePreference>(subscribe, readPreference, () => 'system');

  useEffect(() => {
    apply(preference);
    if (preference !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const update = (next: ThemePreference) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference applies to this page only when storage is unavailable.
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return { preference, setPreference: update };
}

export function ThemeToggle() {
  const { preference, setPreference } = useThemePreference();
  const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length]!;
  const Icon = ICONS[preference];
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
      aria-label={`${LABELS[preference]} (switch to ${LABELS[next].toLowerCase()})`}
      title={LABELS[preference]}
    >
      <Icon className="size-4" />
    </button>
  );
}
