import { openDB } from 'idb';

export const ACTIVE_PROFILE_ID = 'jarbas';

export const GLOBAL_KEYS = {
  jetLag: 'hybridFitJetLagMode',
};

export const HOTEL_EQUIPMENT_IDS = ['dumbbells', 'bench', 'cableStation', 'bands', 'pullUpBar', 'floorSpace', 'roomOnly'];

export const DEFAULT_HOTEL_EQUIPMENT = {
  dumbbells: false,
  bench: false,
  cableStation: false,
  bands: false,
  pullUpBar: false,
  floorSpace: true,
  roomOnly: true,
};

const LEGACY_PREFIX = ['a', 'b', 'b'].join('');

export const LEGACY_KEYS = {
  completedSets: `${LEGACY_PREFIX}WorkoutProgress`,
  weights: `${LEGACY_PREFIX}Weights`,
  workoutHistory: `${LEGACY_PREFIX}WorkoutHistory`,
  swappedExercises: `${LEGACY_PREFIX}SwappedExercises`,
  jetLag: `${LEGACY_PREFIX}JetLagMode`,
};

const DB_NAME = 'hybridFitDb';
const DB_VERSION = 1;
const PROFILE_STORE = 'profileData';
const OUTBOX_STORE = 'syncOutbox';
const META_STORE = 'appMeta';
const STORAGE_VERSION = 2;
const REQUIRED_PROFILE_OBJECTS = ['completedSets', 'weights', 'workoutHistory', 'swappedExercises'];

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

export const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const emptyProfileData = (profileId) => ({
  profileId,
  completedSets: {},
  weights: {},
  workoutHistory: {},
  swappedExercises: {},
  activeSession: null,
  exerciseNotes: {},
  rpeLog: {},
  personalRecords: {},
  setLog: {},
  sessionMetrics: [],
  sessionDuration: 50,
  hotelEquipment: DEFAULT_HOTEL_EQUIPMENT,
  storageVersion: STORAGE_VERSION,
  updatedAt: new Date().toISOString(),
});

export const normalizeHotelEquipment = (value = {}) => {
  const source = isPlainObject(value) ? value : {};
  return HOTEL_EQUIPMENT_IDS.reduce((next, id) => ({
    ...next,
    [id]: typeof source[id] === 'boolean' ? source[id] : DEFAULT_HOTEL_EQUIPMENT[id],
  }), {});
};

export const normalizeProfileData = (profileId, data = {}) => ({
  ...emptyProfileData(profileId),
  ...data,
  profileId,
  completedSets: data.completedSets || {},
  weights: data.weights || {},
  workoutHistory: data.workoutHistory || {},
  swappedExercises: data.swappedExercises || {},
  activeSession: data.activeSession || null,
  exerciseNotes: data.exerciseNotes || {},
  rpeLog: data.rpeLog || {},
  personalRecords: data.personalRecords || {},
  setLog: data.setLog || {},
  sessionMetrics: Array.isArray(data.sessionMetrics) ? data.sessionMetrics : [],
  sessionDuration: [15, 30, 50].includes(data.sessionDuration) ? data.sessionDuration : 50,
  hotelEquipment: normalizeHotelEquipment(data.hotelEquipment),
  storageVersion: STORAGE_VERSION,
  updatedAt: data.updatedAt || new Date().toISOString(),
});

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const validateProfileBackup = (data) => {
  if (!isPlainObject(data)) {
    return { valid: false, reason: 'notObject' };
  }

  const missingField = REQUIRED_PROFILE_OBJECTS.find((field) => !(field in data));
  if (missingField) {
    return { valid: false, reason: 'missingField', field: missingField };
  }

  const invalidObjectField = [
    ...REQUIRED_PROFILE_OBJECTS,
    'exerciseNotes',
    'rpeLog',
    'personalRecords',
    'setLog',
  ].find((field) => field in data && !isPlainObject(data[field]));
  if (invalidObjectField) {
    return { valid: false, reason: 'invalidField', field: invalidObjectField };
  }

  if ('activeSession' in data && data.activeSession !== null && !isPlainObject(data.activeSession)) {
    return { valid: false, reason: 'invalidField', field: 'activeSession' };
  }

  if ('sessionMetrics' in data && !Array.isArray(data.sessionMetrics)) {
    return { valid: false, reason: 'invalidField', field: 'sessionMetrics' };
  }

  if ('hotelEquipment' in data) {
    if (!isPlainObject(data.hotelEquipment)) {
      return { valid: false, reason: 'invalidField', field: 'hotelEquipment' };
    }
    const invalidEquipment = Object.entries(data.hotelEquipment)
      .find(([key, value]) => !HOTEL_EQUIPMENT_IDS.includes(key) || typeof value !== 'boolean');
    if (invalidEquipment) {
      return { valid: false, reason: 'invalidField', field: 'hotelEquipment' };
    }
  }

  if ('profileId' in data && data.profileId !== ACTIVE_PROFILE_ID) {
    return { valid: false, reason: 'unknownProfile' };
  }

  return { valid: true };
};

const getDb = () => openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(PROFILE_STORE)) {
      db.createObjectStore(PROFILE_STORE, { keyPath: 'profileId' });
    }
    if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
      const outbox = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id', autoIncrement: true });
      outbox.createIndex('profileId', 'profileId', { unique: false });
      outbox.createIndex('createdAt', 'createdAt', { unique: false });
    }
    if (!db.objectStoreNames.contains(META_STORE)) {
      db.createObjectStore(META_STORE, { keyPath: 'key' });
    }
  },
});

export const migrateProfileFromLocalStorage = async (profileId) => {
  const db = await getDb();
  const existing = await db.get(PROFILE_STORE, profileId);
  if (existing) return normalizeProfileData(profileId, existing);

  const keys = getProfileKeys(profileId);
  const legacyProfile = {
    completedSets: readJsonStorage(keys.completedSets, readJsonStorage(LEGACY_KEYS.completedSets, {})),
    weights: readJsonStorage(keys.weights, readJsonStorage(LEGACY_KEYS.weights, {})),
    workoutHistory: readJsonStorage(keys.workoutHistory, readJsonStorage(LEGACY_KEYS.workoutHistory, {})),
    swappedExercises: readJsonStorage(keys.swappedExercises, readJsonStorage(LEGACY_KEYS.swappedExercises, {})),
    activeSession: readJsonStorage(getActiveSessionKey(profileId), null),
  };

  const migrated = normalizeProfileData(profileId, legacyProfile);
  await db.put(PROFILE_STORE, migrated);
  await db.put(META_STORE, {
    key: `migration:${profileId}`,
    migratedAt: new Date().toISOString(),
    from: 'localStorage',
  });
  return migrated;
};

export const loadProfileData = async (profileId) => {
  const db = await getDb();
  const existing = await db.get(PROFILE_STORE, profileId);
  if (existing) return normalizeProfileData(profileId, existing);
  return migrateProfileFromLocalStorage(profileId);
};

export const saveProfileData = async (profileId, patch = {}) => {
  const db = await getDb();
  const current = normalizeProfileData(profileId, await db.get(PROFILE_STORE, profileId));
  const next = normalizeProfileData(profileId, {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  await db.put(PROFILE_STORE, next);
  return next;
};

export const saveOutboxMutation = async (profileId, mutation = {}) => {
  const db = await getDb();
  const type = mutation.type || 'profileData';
  const record = {
    profileId,
    type,
    data: mutation.data || {},
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  if (type === 'profileData') {
    const existing = await db.getAllFromIndex(OUTBOX_STORE, 'profileId', profileId);
    await Promise.all(
      existing
        .filter((item) => item.type === type)
        .map((item) => db.delete(OUTBOX_STORE, item.id)),
    );
  }

  return db.add(OUTBOX_STORE, record);
};

export const flushSyncOutbox = async (syncFn) => {
  const db = await getDb();
  const records = await db.getAll(OUTBOX_STORE);
  let flushed = 0;

  for (const record of records) {
    try {
      await syncFn(record);
      await db.delete(OUTBOX_STORE, record.id);
      flushed += 1;
    } catch {
      await db.put(OUTBOX_STORE, {
        ...record,
        attempts: (record.attempts || 0) + 1,
        lastAttemptAt: new Date().toISOString(),
      });
    }
  }

  const remaining = await db.count(OUTBOX_STORE);
  return { flushed, remaining };
};

export const exportProfile = async (profileId) => loadProfileData(profileId);

export const importProfile = async (profileId, data) => {
  const validation = validateProfileBackup(data);
  if (!validation.valid) {
    const error = new Error(validation.reason);
    error.validation = validation;
    throw error;
  }

  const imported = normalizeProfileData(profileId, {
    ...data,
    importedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const db = await getDb();
  await db.put(PROFILE_STORE, imported);
  return imported;
};

export const requestPersistentStorage = async () => {
  if (!navigator.storage?.persist) return { supported: false, persisted: false };
  const persisted = await navigator.storage.persist();
  return { supported: true, persisted };
};

export const getStorageEstimate = async () => {
  if (!navigator.storage?.estimate) return null;
  return navigator.storage.estimate();
};

export const getOutboxCount = async () => {
  const db = await getDb();
  return db.count(OUTBOX_STORE);
};
