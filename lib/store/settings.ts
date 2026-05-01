import { create } from "zustand";

const KEY = "uxflows:settings:google_api_key";

interface SettingsState {
  googleApiKey: string;
  setGoogleApiKey: (key: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  googleApiKey: "",
  setGoogleApiKey: (key) => {
    if (typeof window !== "undefined") {
      try {
        if (key) window.localStorage.setItem(KEY, key);
        else window.localStorage.removeItem(KEY);
      } catch {
        // ignore quota or access errors
      }
    }
    set({ googleApiKey: key });
  },
}));

export function loadSavedSettings(): void {
  if (typeof window === "undefined") return;
  try {
    const key = window.localStorage.getItem(KEY) ?? "";
    if (key) useSettingsStore.setState({ googleApiKey: key });
  } catch {
    // ignore
  }
}
