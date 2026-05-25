export const PROFILES = [
  { id: 'jarbas', label: 'Jarbas' },
  { id: 'isabella', label: 'Isabella' },
];

export const GLOBAL_KEYS = {
  selectedProfile: 'hybridFitSelectedProfile',
  jetLag: 'hybridFitJetLagMode',
  quiet: 'hybridFitQuietMode',
  lang: 'hybridFitLang',
};

const LEGACY_PREFIX = ['a', 'b', 'b'].join('');

export const LEGACY_KEYS = {
  completedSets: `${LEGACY_PREFIX}WorkoutProgress`,
  weights: `${LEGACY_PREFIX}Weights`,
  workoutHistory: `${LEGACY_PREFIX}WorkoutHistory`,
  swappedExercises: `${LEGACY_PREFIX}SwappedExercises`,
  jetLag: `${LEGACY_PREFIX}JetLagMode`,
  quiet: `${LEGACY_PREFIX}QuietMode`,
  lang: `${LEGACY_PREFIX}Lang`,
};

export const getProfileKeys = (profileId) => ({
  completedSets: `hybridFitWorkoutProgress:${profileId}`,
  weights: `hybridFitWeights:${profileId}`,
  workoutHistory: `hybridFitWorkoutHistory:${profileId}`,
  swappedExercises: `hybridFitSwappedExercises:${profileId}`,
});

export const getActiveSessionKey = (profileId) => `hybridFitActiveSession:${profileId}`;

export const readJsonStorage = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const readBoolStorage = (newKey, legacyKey) => {
  const value = localStorage.getItem(newKey) ?? localStorage.getItem(legacyKey);
  return value === 'true';
};

export const migrateLegacyProfileStorage = (profileId) => {
  const keys = getProfileKeys(profileId);
  Object.entries({
    completedSets: LEGACY_KEYS.completedSets,
    weights: LEGACY_KEYS.weights,
    workoutHistory: LEGACY_KEYS.workoutHistory,
    swappedExercises: LEGACY_KEYS.swappedExercises,
  }).forEach(([field, legacyKey]) => {
    if (!localStorage.getItem(keys[field]) && localStorage.getItem(legacyKey)) {
      localStorage.setItem(keys[field], localStorage.getItem(legacyKey));
    }
  });
};

export const loadLocalProfileData = (profileId) => {
  const keys = getProfileKeys(profileId);
  return {
    completedSets: readJsonStorage(keys.completedSets, {}),
    weights: readJsonStorage(keys.weights, {}),
    workoutHistory: readJsonStorage(keys.workoutHistory, {}),
    swappedExercises: readJsonStorage(keys.swappedExercises, {}),
  };
};

export const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
