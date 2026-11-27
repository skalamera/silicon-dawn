const STORAGE_KEY = 'silicon-dawn-campaign-v1';

export function getCompletedMissions(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function markMissionCompleted(missionId: string): Set<string> {
  const next = getCompletedMissions();
  next.add(missionId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
  } catch {
    // Ignore storage errors in private mode
  }
  return next;
}

export function resetCampaignProgress(): Set<string> {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors in private mode
  }
  return new Set();
}
