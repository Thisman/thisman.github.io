const STORAGE_KEYS = {
  tutorialCompleted: "dropItNot.tutorialCompleted",
  tutorialVersion: "dropItNot.tutorialVersion",
  bestStreak: "dropItNot.bestStreak",
  bestWallHits: "dropItNot.bestWallHits",
  bestScore: "dropItNot.bestScore",
  bestCombo: "dropItNot.bestCombo",
};

function readBoolean(key) {
  try {
    return localStorage.getItem(key) === "true";
  } catch (error) {
    return false;
  }
}

function readNumber(key) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? value : 0;
  } catch (error) {
    return 0;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch (error) {
    return false;
  }
}

export function loadProgress(config) {
  const tutorialCompleted = readBoolean(STORAGE_KEYS.tutorialCompleted);
  const tutorialVersion = readNumber(STORAGE_KEYS.tutorialVersion);

  return {
    tutorialCompleted:
      tutorialCompleted && tutorialVersion === config.tutorial.version,
    bestStreak: readNumber(STORAGE_KEYS.bestStreak),
    bestWallHits: readNumber(STORAGE_KEYS.bestWallHits),
    bestScore: readNumber(STORAGE_KEYS.bestScore),
    bestCombo: readNumber(STORAGE_KEYS.bestCombo),
  };
}

export function saveTutorialCompletion(config) {
  safeWrite(STORAGE_KEYS.tutorialCompleted, true);
  safeWrite(STORAGE_KEYS.tutorialVersion, config.tutorial.version);
}

export function saveRecords(records) {
  safeWrite(STORAGE_KEYS.bestStreak, records.bestStreak);
  safeWrite(STORAGE_KEYS.bestWallHits, records.bestWallHits);
  safeWrite(STORAGE_KEYS.bestScore, records.bestScore);
  safeWrite(STORAGE_KEYS.bestCombo, records.bestCombo);
}
