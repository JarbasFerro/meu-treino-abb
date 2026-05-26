import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  ACTIVE_PROFILE_ID,
  LEGACY_KEYS,
  flushSyncOutbox,
  getOutboxCount,
  importProfile,
  migrateProfileFromLocalStorage,
  normalizeProfileData,
  saveOutboxMutation,
  validateProfileBackup,
} from './workoutStorage.js';

const createLocalStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
};

const validBackup = {
  completedSets: { '0-home-0-0': true },
  weights: { '0-home-0': '24' },
  workoutHistory: { '2026-05-26': 1 },
  swappedExercises: {},
};

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  globalThis.localStorage = createLocalStorage();
});

describe('single-profile backup validation', () => {
  test('accepts backups without a profile id or with the active profile id', () => {
    expect(validateProfileBackup(validBackup)).toMatchObject({ valid: true });
    expect(validateProfileBackup({ ...validBackup, profileId: ACTIVE_PROFILE_ID })).toMatchObject({ valid: true });
  });

  test('rejects malformed backups and non-active profile ids', () => {
    expect(validateProfileBackup({})).toMatchObject({ valid: false, reason: 'missingField' });
    expect(validateProfileBackup({ ...validBackup, weights: [] })).toMatchObject({ valid: false, reason: 'invalidField', field: 'weights' });
    expect(validateProfileBackup({ ...validBackup, profileId: 'isabella' })).toMatchObject({ valid: false, reason: 'unknownProfile' });
  });
});

describe('profile normalization and import', () => {
  test('normalizes optional fields without changing the active profile id', () => {
    const normalized = normalizeProfileData(ACTIVE_PROFILE_ID, {
      ...validBackup,
      profileId: 'ignored',
      sessionDuration: 99,
      sessionMetrics: {},
    });

    expect(normalized).toMatchObject({
      profileId: ACTIVE_PROFILE_ID,
      sessionDuration: 50,
      sessionMetrics: [],
      activeSession: null,
      exerciseNotes: {},
      rpeLog: {},
      personalRecords: {},
      setLog: {},
    });
  });

  test('imports valid backups into the active profile and rejects other profile ids', async () => {
    await expect(importProfile(ACTIVE_PROFILE_ID, { ...validBackup, profileId: 'isabella' })).rejects.toThrow('unknownProfile');

    const imported = await importProfile(ACTIVE_PROFILE_ID, validBackup);
    expect(imported).toMatchObject({
      profileId: ACTIVE_PROFILE_ID,
      completedSets: validBackup.completedSets,
      weights: validBackup.weights,
    });
  });
});

describe('legacy migration and outbox compaction', () => {
  test('migrates legacy localStorage data without deleting legacy keys', async () => {
    localStorage.setItem(LEGACY_KEYS.completedSets, JSON.stringify({ '0-home-0-0': true }));
    localStorage.setItem(LEGACY_KEYS.weights, JSON.stringify({ '0-home-0': '22' }));
    localStorage.setItem(LEGACY_KEYS.workoutHistory, JSON.stringify({ '2026-05-26': 1 }));
    localStorage.setItem(LEGACY_KEYS.swappedExercises, JSON.stringify({ '0-home-1': true }));

    const migrated = await migrateProfileFromLocalStorage(ACTIVE_PROFILE_ID);

    expect(migrated).toMatchObject({
      profileId: ACTIVE_PROFILE_ID,
      completedSets: { '0-home-0-0': true },
      weights: { '0-home-0': '22' },
      workoutHistory: { '2026-05-26': 1 },
      swappedExercises: { '0-home-1': true },
    });
    expect(localStorage.getItem(LEGACY_KEYS.completedSets)).toContain('0-home-0-0');
  });

  test('keeps only the latest pending profile snapshot per profile', async () => {
    await saveOutboxMutation(ACTIVE_PROFILE_ID, { type: 'profileData', data: { version: 1 } });
    await saveOutboxMutation(ACTIVE_PROFILE_ID, { type: 'profileData', data: { version: 2 } });

    expect(await getOutboxCount()).toBe(1);

    const flushed = [];
    await flushSyncOutbox(async (record) => flushed.push(record));

    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toMatchObject({
      profileId: ACTIVE_PROFILE_ID,
      type: 'profileData',
      data: { version: 2 },
    });
    expect(await getOutboxCount()).toBe(0);
  });
});
