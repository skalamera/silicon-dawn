const SETTINGS_KEY = 'silicon-dawn-settings-v1';

export interface UserSettings {
  colorblindPalette: boolean;
  crtScanlines: boolean;
  lowPowerMode: boolean;
  touchRadialMenu: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  colorblindPalette: false,
  crtScanlines: false,
  lowPowerMode: false,
  touchRadialMenu: true,
};

export function loadUserSettings(): UserSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_USER_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_USER_SETTINGS };
    return { ...DEFAULT_USER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_USER_SETTINGS };
  }
}

export function saveUserSettings(settings: UserSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}
