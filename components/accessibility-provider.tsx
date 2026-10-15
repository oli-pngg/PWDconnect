'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type ColorFilter = 'none' | 'grayscale' | 'red-green' | 'green-red' | 'blue-yellow';
export type ZoomLevel = '100' | '125' | '150' | '200';

export type AccessibilityPreferences = {
  contrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  visualAlerts: boolean;
  captions: boolean;
  textFirst: boolean;
  spaceNavigation: boolean;
  dyslexiaFriendly: boolean;
  extraSpacing: boolean;
  underlineLinks: boolean;
  focusHighlight: boolean;
  classicInvert: boolean;
  colorFilter: ColorFilter;
  liveRecognition: boolean;
  showBorders: boolean;
  reduceTransparency: boolean;
  reduceWhitePoint: boolean;
  smartInvert: boolean;
  zoom: ZoomLevel;
  dimFlashingLights: boolean;
  hoverText: boolean;
  hoverTyping: boolean;
};

export const defaultAccessibilityPreferences: AccessibilityPreferences = {
  contrast: false,
  largeText: false,
  reducedMotion: false,
  visualAlerts: true,
  captions: true,
  textFirst: true,
  spaceNavigation: false,
  dyslexiaFriendly: false,
  extraSpacing: false,
  underlineLinks: false,
  focusHighlight: false,
  classicInvert: false,
  colorFilter: 'none',
  liveRecognition: false,
  showBorders: false,
  reduceTransparency: false,
  reduceWhitePoint: false,
  smartInvert: false,
  zoom: '100',
  dimFlashingLights: false,
  hoverText: false,
  hoverTyping: false
};

export const ACCESSIBILITY_STORAGE_KEY = 'pwd-connect-accessibility';

function readStoredPreferences(): AccessibilityPreferences {
  if (typeof window === 'undefined') return defaultAccessibilityPreferences;
  try {
    const saved = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
    if (!saved) return defaultAccessibilityPreferences;
    const parsed = JSON.parse(saved) as Partial<AccessibilityPreferences>;
    const next = { ...defaultAccessibilityPreferences };
    for (const key of Object.keys(defaultAccessibilityPreferences) as Array<keyof AccessibilityPreferences>) {
      const value = parsed[key];
      if (key === 'colorFilter' && ['none', 'grayscale', 'red-green', 'green-red', 'blue-yellow'].includes(value as string)) {
        next[key] = value as ColorFilter;
      } else if (key === 'zoom' && ['100', '125', '150', '200'].includes(value as string)) {
        next[key] = value as ZoomLevel;
      } else if (typeof value === 'boolean') {
        next[key] = value as never;
      }
    }
    return next;
  } catch {
    try {
      window.localStorage.removeItem(ACCESSIBILITY_STORAGE_KEY);
    } catch {
      // Storage may be unavailable (private mode). Keep defaults.
    }
    return defaultAccessibilityPreferences;
  }
}

export function applyAccessibilityPreferences(preferences: AccessibilityPreferences) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.contrast = preferences.contrast ? 'high' : 'normal';
  root.dataset.textSize = preferences.largeText ? 'large' : 'normal';
  root.dataset.reducedMotion = preferences.reducedMotion ? 'true' : 'false';
  root.dataset.visualAlerts = preferences.visualAlerts ? 'on' : 'off';
  root.dataset.captions = preferences.captions ? 'on' : 'off';
  root.dataset.textFirst = preferences.textFirst ? 'on' : 'off';
  root.dataset.spaceNavigation = preferences.spaceNavigation ? 'on' : 'off';
  root.dataset.dyslexia = preferences.dyslexiaFriendly ? 'on' : 'off';
  root.dataset.spacing = preferences.extraSpacing ? 'wide' : 'normal';
  root.dataset.underline = preferences.underlineLinks ? 'on' : 'off';
  root.dataset.focusHighlight = preferences.focusHighlight ? 'on' : 'off';
  root.dataset.classicInvert = preferences.classicInvert ? 'on' : 'off';
  root.dataset.colorFilter = preferences.colorFilter;
  root.dataset.liveRecognition = preferences.liveRecognition ? 'on' : 'off';
  root.dataset.showBorders = preferences.showBorders ? 'on' : 'off';
  root.dataset.reduceTransparency = preferences.reduceTransparency ? 'on' : 'off';
  root.dataset.reduceWhitePoint = preferences.reduceWhitePoint ? 'on' : 'off';
  root.dataset.smartInvert = preferences.smartInvert ? 'on' : 'off';
  root.dataset.zoom = preferences.zoom;
  root.dataset.dimFlashingLights = preferences.dimFlashingLights ? 'on' : 'off';
  root.dataset.hoverText = preferences.hoverText ? 'on' : 'off';
  root.dataset.hoverTyping = preferences.hoverTyping ? 'on' : 'off';
}

type AccessibilityContextValue = {
  preferences: AccessibilityPreferences;
  screenReaderEnabled: boolean;
  setScreenReaderEnabled: (enabled: boolean) => void;
  updatePreference: <K extends keyof AccessibilityPreferences>(key: K, value: AccessibilityPreferences[K]) => void;
  setPreferences: (next: AccessibilityPreferences) => void;
  resetPreferences: () => void;
};

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

/**
 * Global provider — mount once in RootLayout so high contrast, larger text,
 * reduced motion, captions, text-first, and space navigation apply to every
 * route (landing, auth, dashboard, jobs, assessment, messages, employer,
 * admin), including loading fallbacks and error states.
 * Persists to localStorage and syncs across tabs via the storage event.
 */
export function AccessibilityProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [preferences, setPreferencesState] = useState<AccessibilityPreferences>(defaultAccessibilityPreferences);
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const loaded = useRef(false);

  // Load once on mount so server render + first paint use defaults, then
  // immediately apply the user's saved system-wide preferences.
  // Deferred via timeout so the initial sync does not cascade-render (lint-safe)
  // and matches the pre-hydration script in RootLayout.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreferencesState(readStoredPreferences());
      loaded.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Apply to <html> dataset + persist on every change.
  useEffect(() => {
    if (!loaded.current) return;
    applyAccessibilityPreferences(preferences);
    try {
      window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore quota / private-mode write failures; dataset still applies.
    }
  }, [preferences]);

  // Keep all open tabs, windows, and remounted tool instances in sync.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== ACCESSIBILITY_STORAGE_KEY) return;
      setPreferencesState(readStoredPreferences());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const updatePreference = useCallback(<K extends keyof AccessibilityPreferences>(key: K, value: AccessibilityPreferences[K]) => {
    setPreferencesState((current) => {
      if (current[key] === value) return current;
      const next = { ...current, [key]: value };
      if (key === 'classicInvert' && value === true) next.smartInvert = false;
      if (key === 'smartInvert' && value === true) next.classicInvert = false;
      return next;
    });
  }, []);

  const setPreferences = useCallback((next: AccessibilityPreferences) => {
    setPreferencesState(next);
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferencesState(defaultAccessibilityPreferences);
  }, []);

  return (
    <AccessibilityContext.Provider value={{ preferences, screenReaderEnabled, setScreenReaderEnabled, updatePreference, setPreferences, resetPreferences }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) throw new Error('useAccessibility must be used inside AccessibilityProvider.');
  return context;
}
