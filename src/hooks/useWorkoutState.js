import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { translations } from '../data/i18n.js';
import { createWorkoutData } from '../data/workouts.js';
import {
  ACTIVE_PROFILE_ID,
  DEFAULT_HOTEL_EQUIPMENT,
  GLOBAL_KEYS,
  HOTEL_EQUIPMENT_IDS,
  LEGACY_KEYS,
  exportProfile,
  flushSyncOutbox,
  getOutboxCount,
  getLocalDateString,
  getStorageEstimate,
  importProfile,
  loadProfileData,
  migrateProfileFromLocalStorage,
  requestPersistentStorage,
  saveOutboxMutation,
  saveProfileData,
  validateProfileBackup,
} from '../storage/workoutStorage.js';

export const APP_LANGUAGE = 'en';
export const EQUIPMENT_ORDER = ['dumbbells', 'bench', 'cableStation', 'bands', 'pullUpBar', 'floorSpace', 'roomOnly'];

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

const firebaseConfigured = Boolean(
  firebaseConfig.apiKey
  && firebaseConfig.authDomain
  && firebaseConfig.projectId
  && firebaseConfig.appId,
);

export const getSetCount = (exercise) => {
  return parseInt(exercise?.sets, 10) || 1;
};

export const getSessionExercises = (exercises = []) => {
  return exercises;
};

export const getSessionSetCount = (exercise) => {
  return getSetCount(exercise);
};

export const getSwapValue = (value) => {
  if (value === true) return 0;
  if (Number.isInteger(value)) return value;
  return null;
};

export const parseWeightAndUnit = (str) => {
  if (!str) return { value: 0, unit: '' };
  const match = String(str).match(/([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]*)/);
  if (!match) return { value: 0, unit: '' };
  return {
    value: parseFloat(match[1]),
    unit: match[2] || '',
  };
};

export const getWarmupStepsText = (primaryLoad, t) => {
  const parsed = parseWeightAndUnit(primaryLoad);
  if (parsed.value <= 0) return t.warmupLoadBody;
  const w50 = (parsed.value * 0.5).toFixed(1).replace(/\.0$/, '');
  const w70 = (parsed.value * 0.7).toFixed(1).replace(/\.0$/, '');
  const w90 = (parsed.value * 0.9).toFixed(1).replace(/\.0$/, '');
  const unitStr = parsed.unit ? ` ${parsed.unit}` : '';
  return `Warm-up: 50% (${w50}${unitStr}), 70% (${w70}${unitStr}), 90% (${w90}${unitStr})`;
};

export const useWorkoutState = () => {
  const activeProfileId = ACTIVE_PROFILE_ID;
  const [activeView, setActiveView] = useState('today');
  const [mode, setMode] = useState('home');
  const jetLagMode = false;
  const sessionDuration = 45;
  const [completedSets, setCompletedSets] = useState({});
  const [expandedInfo, setExpandedInfo] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [swappedExercises, setSwappedExercises] = useState({});
  const [weights, setWeights] = useState({});
  const [workoutHistory, setWorkoutHistory] = useState({});
  const lang = APP_LANGUAGE;
  const [user, setUser] = useState(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [exerciseNotes, setExerciseNotes] = useState({});
  const [rpeLog, setRpeLog] = useState({});
  const [personalRecords, setPersonalRecords] = useState({});
  const [setLog, setSetLog] = useState({});
  const [sessionMetrics, setSessionMetrics] = useState([]);
  const [hotelEquipment, setHotelEquipment] = useState(DEFAULT_HOTEL_EQUIPMENT);
  const [finishSummary, setFinishSummary] = useState(null);
  const [storageStatus, setStorageStatus] = useState({ persisted: false, pending: 0, estimate: null });
  const [updateReady, setUpdateReady] = useState(false);
  const [pendingImportData, setPendingImportData] = useState(null);
  const [importError, setImportError] = useState('');
  const [timer, setTimer] = useState({ active: false, time: 0, total: 60 });
  const [exerciseHistory, setExerciseHistory] = useState({});
  const [travelWeekMode, setTravelWeekMode] = useState(false);
  const [historyDrawerExercise, setHistoryDrawerExercise] = useState(null);

  const hasLoadedCloudData = useRef(false);
  const hasLoadedLocalData = useRef(false);
  const activeProfileRef = useRef('');
  const firebaseServicesRef = useRef(null);
  const updateServiceWorkerRef = useRef(null);
  const openedAtRef = useRef(new Date().toISOString());
  const currentDayIndex = (new Date().getDay() + 6) % 7;

  const t = translations[lang] || translations.en;
  const workoutData = useMemo(() => createWorkoutData(t), [t]);

  const applyWorkoutData = useCallback((data, options = {}) => {
    setCompletedSets(data.completedSets || {});
    setWeights(data.weights || {});
    setWorkoutHistory(data.workoutHistory || {});
    setSwappedExercises(data.swappedExercises || {});
    setActiveSession(data.activeSession || null);
    setExerciseNotes(data.exerciseNotes || {});
    setRpeLog(data.rpeLog || {});
    setPersonalRecords(data.personalRecords || {});
    setSetLog(data.setLog || {});
    setSessionMetrics(Array.isArray(data.sessionMetrics) ? data.sessionMetrics : []);
    setHotelEquipment(data.hotelEquipment || DEFAULT_HOTEL_EQUIPMENT);
    setExerciseHistory(data.exerciseHistory || {});
    setTravelWeekMode(data.travelWeekMode || false);
    if (options.resumeActiveSession && data.activeSession) setActiveView('session');
  }, []);

  const buildProfileSnapshot = useCallback(() => ({
    completedSets,
    weights,
    workoutHistory,
    swappedExercises,
    activeSession,
    exerciseNotes,
    rpeLog,
    personalRecords,
    setLog,
    sessionMetrics,
    sessionDuration: 45,
    hotelEquipment,
    exerciseHistory,
    travelWeekMode,
  }), [completedSets, weights, workoutHistory, swappedExercises, activeSession, exerciseNotes, rpeLog, personalRecords, setLog, sessionMetrics, hotelEquipment, exerciseHistory, travelWeekMode]);

  const flushOutboxToFirebase = useCallback(() => {
    const services = firebaseServicesRef.current;
    if (!firebaseReady || !user || !services) return Promise.resolve();
    return flushSyncOutbox(async (record) => {
      const profileId = record.profileId;
      const userDocRef = services.doc(services.db, 'workout_profiles', profileId, 'app_data', 'workout_data');
      await services.setDoc(userDocRef, {
        profileId,
        ...record.data,
        lastSyncedAt: new Date().toISOString(),
      }, { merge: true });
    })
      .then(({ remaining }) => {
        setStorageStatus((prev) => ({ ...prev, pending: remaining }));
        setIsSynced(remaining === 0);
      })
      .catch(() => setIsSynced(false));
  }, [firebaseReady, user]);

  useEffect(() => {
    updateServiceWorkerRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setUpdateReady(true);
      },
    });
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) return undefined;
    let isMounted = true;
    const initAuth = async () => {
      try {
        const [{ initializeApp }, { getAuth, signInAnonymously, onAuthStateChanged }, firestore] = await Promise.all([
          import('firebase/app'),
          import('firebase/auth'),
          import('firebase/firestore'),
        ]);
        if (!isMounted) return;
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = firestore.getFirestore(app);
        firebaseServicesRef.current = {
          auth,
          db,
          doc: firestore.doc,
          setDoc: firestore.setDoc,
          onSnapshot: firestore.onSnapshot,
        };
        setFirebaseReady(true);
        await signInAnonymously(auth);
        if (!isMounted) return;
        const unsubscribe = onAuthStateChanged(auth, setUser);
        firebaseServicesRef.current.unsubscribeAuth = unsubscribe;
      } catch (error) {
        console.warn('Offline auth fallback.', error.message);
        if (isMounted) setFirebaseReady(false);
      }
    };
    initAuth();
    return () => {
      isMounted = false;
      firebaseServicesRef.current?.unsubscribeAuth?.();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    activeProfileRef.current = activeProfileId;
    hasLoadedCloudData.current = false;
    hasLoadedLocalData.current = false;

    const loadProfile = async () => {
      try {
        await migrateProfileFromLocalStorage(activeProfileId);
        const localProfileData = await loadProfileData(activeProfileId);
        const [storageResult, estimate, pending] = await Promise.all([
          requestPersistentStorage().catch(() => ({ supported: false, persisted: false })),
          getStorageEstimate().catch(() => null),
          getOutboxCount().catch(() => 0),
        ]);
        if (!isMounted) return;
        applyWorkoutData(localProfileData, { resumeActiveSession: true });
        hasLoadedLocalData.current = true;
        setStorageStatus({ persisted: storageResult.persisted, pending, estimate });
      } catch (error) {
        console.warn('Unable to load local profile data.', error);
        if (!isMounted) return;
        applyWorkoutData({});
        hasLoadedLocalData.current = true;
        setStorageStatus((prev) => ({ ...prev, persisted: false }));
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [activeProfileId, applyWorkoutData]);

  useEffect(() => {
    const services = firebaseServicesRef.current;
    if (!firebaseReady || !user || !activeProfileId || !services) return undefined;
    const profileId = activeProfileId;
    const userDocRef = services.doc(services.db, 'workout_profiles', profileId, 'app_data', 'workout_data');

    const unsubscribeSnapshot = services.onSnapshot(userDocRef, async (docSnap) => {
      if (activeProfileRef.current !== profileId) return;
      hasLoadedCloudData.current = true;
      setIsSynced(docSnap.exists());

      if (!docSnap.exists() && hasLoadedLocalData.current) {
        await saveOutboxMutation(profileId, { type: 'profileData', data: { profileId, ...buildProfileSnapshot() } });
      }
    }, () => setIsSynced(false));

    return () => unsubscribeSnapshot();
  }, [firebaseReady, user, activeProfileId, buildProfileSnapshot]);

  useEffect(() => {
    if (!activeProfileId || !hasLoadedLocalData.current) return;

    const profileId = activeProfileId;
    const data = {
      profileId,
      ...buildProfileSnapshot(),
    };

    saveProfileData(profileId, data)
      .then(() => (firebaseReady ? saveOutboxMutation(profileId, { type: 'profileData', data }) : null))
      .then(() => getOutboxCount())
      .then((pending) => setStorageStatus((prev) => ({ ...prev, pending })))
      .then(() => flushOutboxToFirebase())
      .catch((error) => console.warn('Unable to save local workout data.', error));
  }, [firebaseReady, activeProfileId, buildProfileSnapshot, flushOutboxToFirebase]);

  useEffect(() => {
    if (!firebaseReady || !user) return undefined;
    flushOutboxToFirebase();
    window.addEventListener('online', flushOutboxToFirebase);
    return () => window.removeEventListener('online', flushOutboxToFirebase);
  }, [firebaseReady, user, activeProfileId, flushOutboxToFirebase]);





  const playAlert = useCallback(() => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(t.voiceEnd);
      utterance.lang = 'en-US';
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      console.warn('Unable to play fallback alert sound.');
    }
  }, [t.voiceEnd]);

  useEffect(() => {
    let interval = null;
    if (timer.active) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev.time <= 1) {
            clearInterval(interval);
            playAlert();
            return { ...prev, active: false, time: 0 };
          }
          return { ...prev, time: prev.time - 1 };
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timer.active, playAlert]);

  const startRestTimer = (duration = 60) => {
    if (duration <= 0) return;
    if ('speechSynthesis' in window && window.speechSynthesis.getVoices().length === 0) {
      const silentVoice = new SpeechSynthesisUtterance('');
      silentVoice.volume = 0;
      window.speechSynthesis.speak(silentVoice);
    }
    setTimer({ active: true, time: duration, total: duration });
  };

  const adjustTimer = (amount) => {
    setTimer((prev) => {
      const newTime = Math.max(0, prev.time + amount);
      return { ...prev, time: newTime, total: Math.max(prev.total, newTime) };
    });
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const resetProgress = () => {
    setCompletedSets({});
    setSwappedExercises({});
    setSetLog({});
    setActiveSession(null);
    setShowResetModal(false);
  };

  const getCompletedCount = useCallback((dayIndex, sessionMode, exIndex, totalSets) => {
    let count = 0;
    for (let i = 0; i < totalSets; i += 1) {
      if (completedSets[`${dayIndex}-${sessionMode}-${exIndex}-${i}`]) count += 1;
    }
    return count;
  }, [completedSets]);

  const toggleSet = (dayIndex, sessionMode, exIndex, setIndex, restSeconds = 60) => {
    const key = `${dayIndex}-${sessionMode}-${exIndex}-${setIndex}`;
    const exerciseKey = `${dayIndex}-${sessionMode}-${exIndex}`;
    const todayStr = getLocalDateString();
    const isCheckedBefore = !!completedSets[key];
    const exercise = workoutData[dayIndex]?.[sessionMode]?.[exIndex];

    setCompletedSets((prev) => ({ ...prev, [key]: !prev[key] }));
    if (!isCheckedBefore) startRestTimer(restSeconds);

    setWorkoutHistory((prev) => {
      const currentCount = prev[todayStr] || 0;
      const newCount = Math.max(0, currentCount + (isCheckedBefore ? -1 : 1));
      return { ...prev, [todayStr]: newCount };
    });

    setSetLog((prev) => {
      if (isCheckedBefore) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: {
          date: todayStr,
          dayIndex,
          mode: sessionMode,
          durationMinutes: activeSession?.durationMinutes || sessionDuration,
          lowEnergy: false,
          exerciseIndex: exIndex,
          exerciseName: exercise?.name || '',
          setIndex,
          weight: weights[exerciseKey] || '',
          rpe: rpeLog[exerciseKey] || '',
          note: exerciseNotes[exerciseKey] || '',
        },
      };
    });

    if (!isCheckedBefore) {
      setPersonalRecords((prev) => {
        const current = prev[exerciseKey] || {};
        const completedForExercise = getCompletedCount(dayIndex, sessionMode, exIndex, getSessionSetCount(exercise)) + 1;
        const numericLoad = Number.parseFloat(weights[exerciseKey]);
        return {
          ...prev,
          [exerciseKey]: {
            ...current,
            ...(Number.isFinite(numericLoad) && numericLoad > (current.bestLoad || 0)
              ? {
                  bestLoad: numericLoad,
                  bestLoadAt: new Date().toISOString(),
                }
              : {}),
            bestSetCount: Math.max(current.bestSetCount || 0, completedForExercise),
            updatedAt: new Date().toISOString(),
          },
        };
      });
    }
  };

  const updateLoggedSetValues = (exerciseKey, patch) => {
    setSetLog((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach((setKey) => {
        if (!setKey.startsWith(`${exerciseKey}-`)) return;
        next[setKey] = { ...next[setKey], ...patch };
        changed = true;
      });
      return changed ? next : prev;
    });
  };

  const updateWeight = (dayIndex, sessionMode, exIndex, value) => {
    const key = `${dayIndex}-${sessionMode}-${exIndex}`;
    setWeights((prev) => ({ ...prev, [key]: value }));
    updateLoggedSetValues(key, { weight: value });
  };

  const updateExerciseNote = (dayIndex, sessionMode, exIndex, value) => {
    const key = `${dayIndex}-${sessionMode}-${exIndex}`;
    setExerciseNotes((prev) => ({ ...prev, [key]: value }));
    updateLoggedSetValues(key, { note: value });
  };

  const updateRpe = (dayIndex, sessionMode, exIndex, value) => {
    const key = `${dayIndex}-${sessionMode}-${exIndex}`;
    setRpeLog((prev) => ({ ...prev, [key]: value }));
    updateLoggedSetValues(key, { rpe: value });
  };

  const getExerciseStats = useCallback((dayIndex, sessionMode, exIndex) => {
    const key = `${dayIndex}-${sessionMode}-${exIndex}`;
    const currentWeight = weights[key] || '';
    const record = personalRecords[key] || {};
    const isActiveExercise = activeSession?.dayIndex === dayIndex
      && activeSession?.mode === sessionMode
      && activeSession?.exerciseIndex === exIndex;
    const baselineRecord = isActiveExercise ? activeSession?.baselineRecords?.[key] : null;
    const bestBeforeSession = isActiveExercise ? (baselineRecord?.bestLoad || 0) : (record.bestLoad || 0);
    return {
      key,
      currentWeight,
      note: exerciseNotes[key] || '',
      rpe: rpeLog[key] || '',
      bestLoad: record.bestLoad || '',
      bestSetCount: record.bestSetCount || 0,
      isPr: Number.parseFloat(currentWeight) > 0 && Number.parseFloat(currentWeight) > bestBeforeSession,
    };
  }, [weights, personalRecords, activeSession, exerciseNotes, rpeLog]);

  const getLoadHint = useCallback((dayIndex, sessionMode, exIndex, exercise) => {
    if (!exercise || exercise.noWeight) return null;
    const key = `${dayIndex}-${sessionMode}-${exIndex}`;
    const lastLoad = weights[key] || '';
    const bestLoad = personalRecords[key]?.bestLoad || '';
    const primaryLoad = lastLoad || bestLoad;

    return {
      lastLoad,
      bestLoad,
      primary: primaryLoad ? `${t.suggestedWorkingLoad}: ${primaryLoad}` : t.noLoadHistory,
      warmup: primaryLoad ? `${t.warmupLoadSuggestion}: ${getWarmupStepsText(primaryLoad, t)}` : t.noLoadHistory,
      best: bestLoad ? `${t.bestKnownLoad}: ${bestLoad}` : '',
    };
  }, [weights, personalRecords, t]);

  const downloadTextFile = (fileName, text, type) => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = async () => {
    if (!activeProfileId) return;
    const data = await exportProfile(activeProfileId);
    downloadTextFile(`hybrid-fit-${activeProfileId}.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

  const handleExportCsv = () => {
    const rows = Object.entries(completedSets)
      .filter(([, isDone]) => isDone)
      .map(([key]) => {
        const [dayIndexRaw, sessionMode, exIndexRaw, setIndexRaw] = key.split('-');
        const dayIndex = Number.parseInt(dayIndexRaw, 10);
        const exIndex = Number.parseInt(exIndexRaw, 10);
        const exerciseKey = `${dayIndex}-${sessionMode}-${exIndex}`;
        const exercise = workoutData[dayIndex]?.[sessionMode]?.[exIndex];
        const log = setLog[key] || {};
        return [
          log.date || '',
          sessionMode,
          log.durationMinutes || sessionDuration,
          log.lowEnergy ? 'true' : 'false',
          workoutData[dayIndex]?.day || '',
          exercise?.name || log.exerciseName || '',
          Number.parseInt(setIndexRaw, 10) + 1,
          log.weight || weights[exerciseKey] || '',
          log.rpe || rpeLog[exerciseKey] || '',
          log.note || exerciseNotes[exerciseKey] || '',
        ];
      });

    const csv = [
      ['date', 'mode', 'duration', 'lowEnergy', 'day', 'exercise', 'set', 'weight', 'rpe', 'note'],
      ...rows,
    ].map((row) => row.map(escapeCsv).join(',')).join('\n');

    downloadTextFile(`hybrid-fit-${activeProfileId}-log.csv`, csv, 'text/csv');
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportError('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validation = validateProfileBackup(parsed);
      if (!validation.valid) {
        setImportError(t.importInvalid);
        return;
      }
      setPendingImportData(parsed);
    } catch {
      setImportError(t.importParseError);
    }
  };

  const confirmImportProfile = async () => {
    if (!activeProfileId || !pendingImportData) return;
    try {
      const imported = await importProfile(activeProfileId, pendingImportData);
      applyWorkoutData(imported);
      setPendingImportData(null);
      setImportError('');
      const pending = await getOutboxCount();
      setStorageStatus((prev) => ({ ...prev, pending }));
    } catch {
      setImportError(t.importInvalid);
    }
  };

  const equipmentLabels = useMemo(() => t.equipmentNames || {}, [t.equipmentNames]);

  const getEquipmentLabel = useCallback((id) => equipmentLabels[id] || id, [equipmentLabels]);

  const formatEquipmentSummary = useCallback((equipment = hotelEquipment) => {
    if (equipment.roomOnly) return t.hotelRoomOnly;
    const active = EQUIPMENT_ORDER
      .filter((id) => id !== 'roomOnly' && equipment[id])
      .map(getEquipmentLabel);
    return active.length ? active.join(' + ') : t.noSwapOptions;
  }, [hotelEquipment, getEquipmentLabel, t]);

  const requiresAvailableEquipment = useCallback((exercise, equipment = hotelEquipment) => {
    const required = exercise?.equipment || [];
    if (equipment.roomOnly) return required.every((id) => id === 'floorSpace' || id === 'noEquipment');
    return required.every((id) => id === 'noEquipment' || equipment[id]);
  }, [hotelEquipment]);

  const getSwapOptions = useCallback((baseExercise) => [
    { ...baseExercise, swapIndex: null, swapLabel: t.swapOriginal },
    ...(baseExercise?.altOptions || []).map((option, index) => ({ ...option, swapIndex: index, swapLabel: option.name })),
  ], [t]);

  const getSwapGroup = useCallback((baseExercise, option, sessionMode) => {
    if (option.swapIndex === null) return t.swapGroupSame;
    const equipment = option.equipment || [];
    if (equipment.length === 0 || equipment.every((id) => id === 'floorSpace' || id === 'noEquipment')) return t.swapGroupNone;
    if (sessionMode === 'hotel' && requiresAvailableEquipment(option)) return t.swapGroupYour;
    const baseEquipment = (baseExercise.equipment || []).join('|');
    if (baseEquipment === equipment.join('|')) return t.swapGroupSame;
    return t.swapGroupDifferent;
  }, [requiresAvailableEquipment, t]);

  const selectSwapExercise = (dayIndex, sessionMode, exIndex, swapIndex) => {
    const key = `${dayIndex}-${sessionMode}-${exIndex}`;
    setSwappedExercises((prev) => {
      const next = { ...prev };
      if (swapIndex === null) delete next[key];
      else next[key] = swapIndex;
      return next;
    });
  };

  const updateHotelEquipment = (id) => {
    setHotelEquipment((prev) => {
      if (!HOTEL_EQUIPMENT_IDS.includes(id)) return prev;
      if (id === 'roomOnly') {
        const nextRoomOnly = !prev.roomOnly;
        return nextRoomOnly ? { ...DEFAULT_HOTEL_EQUIPMENT } : { ...prev, roomOnly: false, floorSpace: true };
      }
      const next = {
        ...prev,
        [id]: !prev[id],
        roomOnly: false,
      };
      if (id !== 'floorSpace') next.floorSpace = true;
      return next;
    });
  };

  const getExerciseGuidance = useCallback((ex, baseEx) => {
    const name = (baseEx.sourceName || ex.sourceName || ex.name).toLowerCase();
    const copy = t.guidance;
    let group = copy.general;

    if (name.includes('squat') || name.includes('lunge') || name.includes('split')) group = copy.squat;
    else if (name.includes('press') || name.includes('push') || name.includes('fly')) group = copy.press;
    else if (name.includes('row') || name.includes('pull') || name.includes('angel')) group = copy.pull;
    else if (ex.category === 'core' || name.includes('plank') || name.includes('bug') || name.includes('hollow')) group = copy.core;
    else if (ex.category === 'mobility') group = copy.mobility;

    return {
      ...group,
      progression: baseEx.noWeight ? copy.bodyweightProgression : copy.weightedProgression,
    };
  }, [t]);

  const getDayProgress = useCallback((dayIndex, sessionMode = mode) => {
    const data = getSessionExercises(workoutData[dayIndex]?.[sessionMode] || []);
    let totalSets = 0;
    let completed = 0;
    data.forEach((ex, i) => {
      const numSets = getSessionSetCount(ex);
      totalSets += numSets;
      completed += getCompletedCount(dayIndex, sessionMode, i, numSets);
    });
    return totalSets === 0 ? 0 : Math.round((completed / totalSets) * 100);
  }, [workoutData, mode, getCompletedCount]);

  const getWorkoutSummary = useCallback((dayIndex, sessionMode = mode) => {
    const exercises = getSessionExercises(workoutData[dayIndex]?.[sessionMode] || []);
    let totalSets = 0;
    let completed = 0;
    let nextExercise = null;

    exercises.forEach((ex, i) => {
      const numSets = getSessionSetCount(ex);
      const done = getCompletedCount(dayIndex, sessionMode, i, numSets);
      totalSets += numSets;
      completed += done;
      if (!nextExercise && done < numSets) nextExercise = { ...ex, index: i, done, total: numSets };
    });

    return { totalSets, completed, nextExercise, exercises };
  }, [workoutData, mode, getCompletedCount]);

  const calculateStreak = useCallback(() => {
    let streak = 0;
    const curr = new Date();
    while (true) {
      const ds = getLocalDateString(curr);
      if (workoutHistory[ds] && workoutHistory[ds] > 0) {
        streak += 1;
        curr.setDate(curr.getDate() - 1);
      } else {
        if (streak === 0 && getLocalDateString() === ds) {
          curr.setDate(curr.getDate() - 1);
          const yestStr = getLocalDateString(curr);
          if (workoutHistory[yestStr] && workoutHistory[yestStr] > 0) {
            streak += 1;
            curr.setDate(curr.getDate() - 1);
            continue;
          }
        }
        break;
      }
    }
    return streak;
  }, [workoutHistory]);

  const getExpectedWeeklyUnits = useCallback(() => workoutData.reduce((sum, dayData) => {
    const dayExercises = getSessionExercises(dayData[mode] || dayData.home || []);
    return sum + dayExercises.reduce((daySum, ex) => daySum + getSessionSetCount(ex), 0);
  }, 0), [workoutData, mode]);

  const calculateCompletionRate = useCallback(() => {
    let totalCompleted = 0;
    for (let i = 0; i < 7; i += 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = getLocalDateString(d);
      if (workoutHistory[ds] && workoutHistory[ds] > 0) totalCompleted += workoutHistory[ds];
    }
    const expectedSets = getExpectedWeeklyUnits();
    return Math.min(100, Math.round((totalCompleted / expectedSets) * 100));
  }, [workoutHistory, getExpectedWeeklyUnits]);

  const getVolumeData = useCallback(() => {
    const vol = { push: 0, pull: 0, legs: 0, shouldersArmsCore: 0, recovery: 0 };
    Object.keys(completedSets).forEach((k) => {
      if (!completedSets[k]) return;
      const [dayStr, sessionMode, exStr] = k.split('-');
      const dayIdx = parseInt(dayStr, 10);
      const exIdx = parseInt(exStr, 10);
      const dayData = workoutData[dayIdx];
      const ex = dayData?.[sessionMode]?.[exIdx];
      const category = ex?.category === 'core' || ex?.category === 'mobility' ? dayData?.category : ex?.category;
      if (category && vol[category] !== undefined) vol[category] += 1;
    });
    return vol;
  }, [completedSets, workoutData]);

  const getSessionPlan = useCallback((dayIndex, sessionMode) => {
    const exercises = getSessionExercises(workoutData[dayIndex]?.[sessionMode] || []);
    const plannedSets = exercises.reduce((sum, exercise) => sum + getSessionSetCount(exercise), 0);
    const completed = exercises.reduce((sum, exercise, index) => {
      const sets = getSessionSetCount(exercise);
      return sum + getCompletedCount(dayIndex, sessionMode, index, sets);
    }, 0);
    return { exercises, plannedSets, completed };
  }, [workoutData, getCompletedCount]);

  const getSessionSummary = useCallback((session) => {
    const sessionMode = session.mode || mode;
    const plan = getSessionPlan(session.dayIndex, sessionMode);
    const baseline = session.baselineRecords || {};
    let bestLoad = 0;
    let prCount = 0;
    const rpeValues = [];
    const exerciseSummaryList = [];

    plan.exercises.forEach((baseExercise, index) => {
      const key = `${session.dayIndex}-${sessionMode}-${index}`;
      const currentLoad = Number.parseFloat(weights[key]);
      const baselineLoad = baseline[key]?.bestLoad || 0;
      if (Number.isFinite(currentLoad)) {
        bestLoad = Math.max(bestLoad, currentLoad);
        if (currentLoad > baselineLoad) prCount += 1;
      }
      const rpe = Number.parseFloat(rpeLog[key]);
      if (Number.isFinite(rpe)) rpeValues.push(rpe);

      // Compute individual exercise achievements
      const activeSwapIndex = getSwapValue(swappedExercises[key]);
      const exercise = activeSwapIndex !== null && baseExercise?.altOptions?.[activeSwapIndex] ? baseExercise.altOptions[activeSwapIndex] : baseExercise;
      if (exercise) {
        const sets = getSessionSetCount(baseExercise);
        const completed = getCompletedCount(session.dayIndex, sessionMode, index, sets);
        if (completed > 0) {
          exerciseSummaryList.push({
            name: exercise.name,
            completed,
            planned: sets,
            weight: weights[key] || '',
            rpe: rpeLog[key] || '',
            note: exerciseNotes[key] || '',
          });
        }
      }
    });

    const avgRpe = rpeValues.length
      ? Math.round((rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length) * 10) / 10
      : '';

    return {
      date: getLocalDateString(),
      mode: sessionMode,
      durationMinutes: 45,
      lowEnergy: false,
      startedAt: session.startedAt,
      finishedAt: new Date().toISOString(),
      timeToStartSeconds: session.timeToStartSeconds || 0,
      completedSets: plan.completed,
      plannedSets: plan.plannedSets,
      bestLoad: bestLoad || '',
      prCount,
      avgRpe,
      exerciseSummaryList,
    };
  }, [mode, getSessionPlan, weights, rpeLog, swappedExercises, exerciseNotes, getCompletedCount]);

  const startSession = () => {
    const now = new Date();
    setFinishSummary(null);
    setActiveSession({
      dayIndex: currentDayIndex,
      mode,
      exerciseIndex: 0,
      currentSetIndex: 0,
      durationMinutes: 45,
      warmupDone: false,
      lowEnergy: false,
      baselineRecords: personalRecords,
      startedAt: now.toISOString(),
      timeToStartSeconds: Math.max(0, Math.round((now.getTime() - new Date(openedAtRef.current).getTime()) / 1000)),
    });
    setActiveView('session');
    setExpandedInfo(null);
  };

  const openDaySession = (dayIndex) => {
    const now = new Date();
    setFinishSummary(null);
    setActiveSession({
      dayIndex,
      mode,
      exerciseIndex: 0,
      currentSetIndex: 0,
      durationMinutes: 45,
      warmupDone: false,
      lowEnergy: false,
      baselineRecords: personalRecords,
      startedAt: now.toISOString(),
      timeToStartSeconds: Math.max(0, Math.round((now.getTime() - new Date(openedAtRef.current).getTime()) / 1000)),
    });
    setActiveView('session');
    setExpandedInfo(null);
  };

  const getExercisePr = useCallback((exerciseName) => {
    let bestLoad = 0;
    let bestLoadAt = '';
    let bestSetCount = 0;

    Object.entries(personalRecords).forEach(([key, record]) => {
      const [dayIndexRaw, sessionMode, exIndexRaw] = key.split('-');
      const dayIndex = parseInt(dayIndexRaw, 10);
      const exIndex = parseInt(exIndexRaw, 10);
      const baseExercise = workoutData[dayIndex]?.[sessionMode]?.[exIndex];
      const activeSwapIndex = getSwapValue(swappedExercises[key]);
      const exercise = activeSwapIndex !== null && baseExercise?.altOptions?.[activeSwapIndex] ? baseExercise.altOptions[activeSwapIndex] : baseExercise;

      if (exercise && exercise.name === exerciseName) {
        const loadNum = parseFloat(record.bestLoad);
        if (Number.isFinite(loadNum) && loadNum > bestLoad) {
          bestLoad = loadNum;
          bestLoadAt = record.bestLoadAt || '';
        }
        if (record.bestSetCount && record.bestSetCount > bestSetCount) {
          bestSetCount = record.bestSetCount;
        }
      }
    });

    const historyLogs = exerciseHistory[exerciseName] || [];
    historyLogs.forEach((log) => {
      const weightNum = parseFloat(log.weight);
      if (Number.isFinite(weightNum) && weightNum > bestLoad) {
        bestLoad = weightNum;
        bestLoadAt = log.date;
      }
      if (log.completedSets && log.completedSets > bestSetCount) {
        bestSetCount = log.completedSets;
      }
    });

    return { bestLoad, bestLoadAt, bestSetCount };
  }, [personalRecords, workoutData, swappedExercises, exerciseHistory]);

  const getExerciseHistoryData = useCallback((exerciseName) => {
    return exerciseHistory[exerciseName] || [];
  }, [exerciseHistory]);

  const toggleTravelWeekMode = (active) => {
    setTravelWeekMode(active);
    if (active) {
      setMode('hotel');
      setHotelEquipment((prev) => ({
        ...prev,
        roomOnly: true,
      }));
    } else {
      setMode('home');
      setHotelEquipment(DEFAULT_HOTEL_EQUIPMENT);
    }
  };

  const finishSession = () => {
    if (activeSession) {
      const summary = getSessionSummary(activeSession);
      const sessionMode = activeSession.mode || mode;
      const dayData = workoutData[activeSession.dayIndex];
      const exercises = getSessionExercises(dayData[sessionMode] || []);

      setExerciseHistory((prev) => {
        const next = { ...prev };
        exercises.forEach((baseExercise, index) => {
          const activeSwapIndex = getSwapValue(swappedExercises[`${activeSession.dayIndex}-${sessionMode}-${index}`]);
          const exercise = activeSwapIndex !== null && baseExercise?.altOptions?.[activeSwapIndex] ? baseExercise.altOptions[activeSwapIndex] : baseExercise;
          if (!exercise) return;

          const totalSets = getSessionSetCount(baseExercise);
          const completed = getCompletedCount(activeSession.dayIndex, sessionMode, index, totalSets);
          if (completed === 0) return;

          const exerciseKey = `${activeSession.dayIndex}-${sessionMode}-${index}`;
          const exWeight = weights[exerciseKey] || '';
          const exRpe = rpeLog[exerciseKey] || '';
          const exNote = exerciseNotes[exerciseKey] || '';

          const exerciseName = exercise.name;
          if (!next[exerciseName]) {
            next[exerciseName] = [];
          }
          const todayStr = getLocalDateString();
          next[exerciseName] = next[exerciseName].filter((item) => item.date !== todayStr);
          next[exerciseName].push({
            date: todayStr,
            weight: exWeight,
            rpe: exRpe,
            note: exNote,
            completedSets: completed,
            totalSets: totalSets,
          });
        });
        return next;
      });

      setSessionMetrics((prev) => [...prev.slice(-29), summary]);
      setFinishSummary(summary);
    }
    setActiveSession(null);
    setActiveView('today');
    setExpandedInfo(null);
  };

  // P1 Travel - local environment frequency mix over time helper
  const getEnvironmentMix = useMemo(() => {
    const mix = { home: 0, hotel: 0, lowEnergy: 0, total: 0 };
    sessionMetrics.forEach((m) => {
      mix.total += 1;
      if (m.mode === 'hotel') mix.hotel += 1;
      else if (m.mode === 'home') mix.home += 1;
      if (m.lowEnergy) mix.lowEnergy += 1;
    });
    return mix;
  }, [sessionMetrics]);

  return {
    activeProfileId,
    activeView,
    setActiveView,
    mode,
    setMode,
    jetLagMode,
    completedSets,
    setCompletedSets,
    expandedInfo,
    setExpandedInfo,
    showResetModal,
    setShowResetModal,
    swappedExercises,
    setSwappedExercises,
    weights,
    setWeights,
    workoutHistory,
    setWorkoutHistory,
    user,
    firebaseReady,
    isSynced,
    activeSession,
    setActiveSession,
    exerciseNotes,
    setExerciseNotes,
    rpeLog,
    setRpeLog,
    personalRecords,
    setPersonalRecords,
    setLog,
    setSetLog,
    sessionMetrics,
    setSessionMetrics,
    sessionDuration,
    hotelEquipment,
    setHotelEquipment,
    finishSummary,
    setFinishSummary,
    storageStatus,
    setStorageStatus,
    updateReady,
    setUpdateReady,
    pendingImportData,
    setPendingImportData,
    importError,
    setImportError,
    timer,
    setTimer,
    currentDayIndex,
    t,
    workoutData,
    applyWorkoutData,
    buildProfileSnapshot,
    flushOutboxToFirebase,
    playAlert,
    startRestTimer,
    adjustTimer,
    formatTime,
    resetProgress,
    toggleSet,
    updateWeight,
    updateExerciseNote,
    updateRpe,
    getExerciseStats,
    getLoadHint,
    handleExportJson,
    handleExportCsv,
    handleImportFile,
    confirmImportProfile,
    getEquipmentLabel,
    formatEquipmentSummary,
    requiresAvailableEquipment,
    getSwapOptions,
    getSwapGroup,
    selectSwapExercise,
    updateHotelEquipment,
    getExerciseGuidance,
    getDayProgress,
    getWorkoutSummary,
    calculateStreak,
    calculateCompletionRate,
    getVolumeData,
    getSessionPlan,
    getSessionSummary,
    startSession,
    openDaySession,
    finishSession,
    getEnvironmentMix,
    updateServiceWorkerRef,
    getCompletedCount,
    exerciseHistory,
    setExerciseHistory,
    travelWeekMode,
    setTravelWeekMode,
    historyDrawerExercise,
    setHistoryDrawerExercise,
    getExercisePr,
    getExerciseHistoryData,
    toggleTravelWeekMode,
  };
};
