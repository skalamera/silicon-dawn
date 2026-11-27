const STORAGE_KEY = 'silicon-dawn-campaign-v1';
const BONUS_KEY = 'silicon-dawn-campaign-bonus-v1';

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function addToSet(key: string, missionId: string): Set<string> {
  const next = readSet(key);
  next.add(missionId);
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(next)));
  } catch {
    // Ignore storage errors in private mode
  }
  return next;
}

export function getCompletedMissions(): Set<string> {
  return readSet(STORAGE_KEY);
}

export function markMissionCompleted(missionId: string): Set<string> {
  return addToSet(STORAGE_KEY, missionId);
}

export function getBonusMissions(): Set<string> {
  return readSet(BONUS_KEY);
}

export function markMissionBonusCompleted(missionId: string): Set<string> {
  return addToSet(BONUS_KEY, missionId);
}

export function resetCampaignProgress(): Set<string> {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BONUS_KEY);
  } catch {
    // Ignore storage errors in private mode
  }
  return new Set();
}
