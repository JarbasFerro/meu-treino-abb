import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { translations } from './data/i18n.js';
import { createWorkoutData } from './data/workouts.js';
import { BottomNav, ExerciseGuidance, ModeSwitch, RestTimer } from './components/TrainingControls.jsx';
import {
  ACTIVE_PROFILE_ID,
  GLOBAL_KEYS,
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
} from './storage/workoutStorage.js';

const APP_LANGUAGE = 'en';
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

const getSetCount = (exercise, lowEnergy) => {
  const originalSets = parseInt(exercise?.sets, 10) || 1;
  return lowEnergy ? Math.min(2, originalSets) : originalSets;
};

const DURATION_OPTIONS = [15, 30, 50];

const getSessionExercises = (exercises = [], durationMinutes = 50) => {
  if (durationMinutes !== 15) return exercises;
  return exercises.filter((exercise) => exercise.category !== 'mobility').slice(0, 4);
};

const getSessionSetCount = (exercise, lowEnergy, durationMinutes = 50) => {
  const baseSets = getSetCount(exercise, lowEnergy);
  if (durationMinutes === 15) return Math.min(1, baseSets);
  if (durationMinutes === 30) return Math.min(2, baseSets);
  return baseSets;
};

const App = () => {
  const activeProfileId = ACTIVE_PROFILE_ID;
  const [activeView, setActiveView] = useState('today');
  const [mode, setMode] = useState('home');
  const [jetLagMode, setJetLagMode] = useState(false);
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
  const [sessionDuration, setSessionDuration] = useState(50);
  const [finishSummary, setFinishSummary] = useState(null);
  const [storageStatus, setStorageStatus] = useState({ persisted: false, pending: 0, estimate: null });
  const [updateReady, setUpdateReady] = useState(false);
  const [pendingImportData, setPendingImportData] = useState(null);
  const [importError, setImportError] = useState('');
  const [timer, setTimer] = useState({ active: false, time: 0, total: 60 });

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
    setSessionDuration(DURATION_OPTIONS.includes(data.sessionDuration) ? data.sessionDuration : 50);
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
    sessionDuration,
  }), [completedSets, weights, workoutHistory, swappedExercises, activeSession, exerciseNotes, rpeLog, personalRecords, setLog, sessionMetrics, sessionDuration]);

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
    if (!activeProfileId) return;

    let isMounted = true;
    activeProfileRef.current = activeProfileId;
    hasLoadedCloudData.current = false;
    hasLoadedLocalData.current = false;
    setIsSynced(false);
    setStorageStatus((prev) => ({ ...prev, pending: 0 }));

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

  useEffect(() => {
    if (!activeProfileId) return;
    try {
      localStorage.setItem(GLOBAL_KEYS.jetLag, jetLagMode.toString());
    } catch {
      console.warn('Unable to save local preferences.');
    }
  }, [jetLagMode, activeProfileId]);

  /*
   * Legacy preference migration stays on localStorage because those values are tiny
   * and should be readable before IndexedDB finishes opening.
   */
  useEffect(() => {
    try {
      const legacyJetLag = localStorage.getItem(LEGACY_KEYS.jetLag);

      if (!localStorage.getItem(GLOBAL_KEYS.jetLag) && legacyJetLag !== null) localStorage.setItem(GLOBAL_KEYS.jetLag, legacyJetLag);

      const value = localStorage.getItem(GLOBAL_KEYS.jetLag) ?? localStorage.getItem(LEGACY_KEYS.jetLag);
      setJetLagMode(value === 'true');
    } catch {
      console.warn('Unable to load local preferences.');
    }
  }, []);

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
    if (timer.active && timer.time > 0) {
      interval = setInterval(() => setTimer((prev) => ({ ...prev, time: prev.time - 1 })), 1000);
    } else if (timer.time === 0 && timer.active) {
      setTimer((prev) => ({ ...prev, active: false }));
      playAlert();
    }
    return () => clearInterval(interval);
  }, [timer.active, timer.time, playAlert]);

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
          lowEnergy: activeSession?.lowEnergy ?? jetLagMode,
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
        const activeDuration = activeSession?.dayIndex === dayIndex && activeSession?.mode === sessionMode
          ? activeSession.durationMinutes
          : sessionDuration;
        const completedForExercise = getCompletedCount(dayIndex, sessionMode, exIndex, getSessionSetCount(exercise, jetLagMode, activeDuration)) + 1;
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

  const getExerciseStats = (dayIndex, sessionMode, exIndex) => {
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
  };

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

  const getCompletedCount = (dayIndex, sessionMode, exIndex, totalSets) => {
    let count = 0;
    for (let i = 0; i < totalSets; i += 1) {
      if (completedSets[`${dayIndex}-${sessionMode}-${exIndex}-${i}`]) count += 1;
    }
    return count;
  };

  const toggleSwapExercise = (dayIndex, sessionMode, exIndex) => {
    const key = `${dayIndex}-${sessionMode}-${exIndex}`;
    setSwappedExercises((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getExerciseGuidance = (ex, baseEx) => {
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
  };

  const getDayProgress = (dayIndex, sessionMode = mode, lowEnergy = jetLagMode, durationMinutes = 50) => {
    const data = getSessionExercises(workoutData[dayIndex]?.[sessionMode] || [], durationMinutes);
    let totalSets = 0;
    let completed = 0;
    data.forEach((ex, i) => {
      const numSets = getSessionSetCount(ex, lowEnergy, durationMinutes);
      totalSets += numSets;
      completed += getCompletedCount(dayIndex, sessionMode, i, numSets);
    });
    return totalSets === 0 ? 0 : Math.round((completed / totalSets) * 100);
  };

  const getWorkoutSummary = (dayIndex, sessionMode = mode, lowEnergy = jetLagMode, durationMinutes = 50) => {
    const exercises = getSessionExercises(workoutData[dayIndex]?.[sessionMode] || [], durationMinutes);
    let totalSets = 0;
    let completed = 0;
    let nextExercise = null;

    exercises.forEach((ex, i) => {
      const numSets = getSessionSetCount(ex, lowEnergy, durationMinutes);
      const done = getCompletedCount(dayIndex, sessionMode, i, numSets);
      totalSets += numSets;
      completed += done;
      if (!nextExercise && done < numSets) nextExercise = { ...ex, index: i, done, total: numSets };
    });

    return { totalSets, completed, nextExercise, exercises };
  };

  const calculateStreak = () => {
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
  };

  const getExpectedWeeklyUnits = () => workoutData.reduce((sum, dayData) => {
    const dayExercises = getSessionExercises(dayData[mode] || dayData.home || [], sessionDuration);
    return sum + dayExercises.reduce((daySum, ex) => daySum + getSessionSetCount(ex, jetLagMode, sessionDuration), 0);
  }, 0);

  const calculateCompletionRate = () => {
    let totalCompleted = 0;
    for (let i = 0; i < 7; i += 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = getLocalDateString(d);
      if (workoutHistory[ds] && workoutHistory[ds] > 0) totalCompleted += workoutHistory[ds];
    }
    const expectedSets = getExpectedWeeklyUnits();
    return Math.min(100, Math.round((totalCompleted / expectedSets) * 100));
  };

  const getVolumeData = () => {
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
  };

  const getSessionPlan = (dayIndex, sessionMode, lowEnergy, durationMinutes) => {
    const exercises = getSessionExercises(workoutData[dayIndex]?.[sessionMode] || [], durationMinutes);
    const plannedSets = exercises.reduce((sum, exercise) => sum + getSessionSetCount(exercise, lowEnergy, durationMinutes), 0);
    const completed = exercises.reduce((sum, exercise, index) => {
      const sets = getSessionSetCount(exercise, lowEnergy, durationMinutes);
      return sum + getCompletedCount(dayIndex, sessionMode, index, sets);
    }, 0);
    return { exercises, plannedSets, completed };
  };

  const getSessionSummary = (session) => {
    const sessionMode = session.mode || mode;
    const durationMinutes = session.durationMinutes || 50;
    const lowEnergy = session.lowEnergy ?? jetLagMode;
    const plan = getSessionPlan(session.dayIndex, sessionMode, lowEnergy, durationMinutes);
    const baseline = session.baselineRecords || {};
    let bestLoad = 0;
    let prCount = 0;
    const rpeValues = [];

    plan.exercises.forEach((exercise, index) => {
      const key = `${session.dayIndex}-${sessionMode}-${index}`;
      const currentLoad = Number.parseFloat(weights[key]);
      const baselineLoad = baseline[key]?.bestLoad || 0;
      if (Number.isFinite(currentLoad)) {
        bestLoad = Math.max(bestLoad, currentLoad);
        if (currentLoad > baselineLoad) prCount += 1;
      }
      const rpe = Number.parseFloat(rpeLog[key]);
      if (Number.isFinite(rpe)) rpeValues.push(rpe);
    });

    const avgRpe = rpeValues.length
      ? Math.round((rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length) * 10) / 10
      : '';

    return {
      date: getLocalDateString(),
      mode: sessionMode,
      durationMinutes,
      lowEnergy,
      startedAt: session.startedAt,
      finishedAt: new Date().toISOString(),
      timeToStartSeconds: session.timeToStartSeconds || 0,
      completedSets: plan.completed,
      plannedSets: plan.plannedSets,
      bestLoad: bestLoad || '',
      prCount,
      avgRpe,
    };
  };

  const startSession = (durationMinutes = sessionDuration, lowEnergy = false) => {
    setSessionDuration(durationMinutes);
    setJetLagMode(lowEnergy);
    const now = new Date();
    setFinishSummary(null);
    setActiveSession({
      dayIndex: currentDayIndex,
      mode,
      exerciseIndex: 0,
      currentSetIndex: 0,
      durationMinutes,
      warmupDone: false,
      lowEnergy,
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
      durationMinutes: sessionDuration,
      warmupDone: false,
      lowEnergy: jetLagMode,
      baselineRecords: personalRecords,
      startedAt: now.toISOString(),
      timeToStartSeconds: Math.max(0, Math.round((now.getTime() - new Date(openedAtRef.current).getTime()) / 1000)),
    });
    setActiveView('session');
    setExpandedInfo(null);
  };

  const finishSession = () => {
    if (activeSession) {
      const summary = getSessionSummary(activeSession);
      setSessionMetrics((prev) => [...prev.slice(-29), summary]);
      setFinishSummary(summary);
    }
    setActiveSession(null);
    setActiveView('today');
    setExpandedInfo(null);
  };

  const last14Days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return getLocalDateString(d);
  });

  const todaySummary = getWorkoutSummary(currentDayIndex, mode, jetLagMode, sessionDuration);
  const todayDuration = `${sessionDuration} min`;
  const todayEquipment = mode === 'home' ? t.homeEquipment : t.hotelEquipment;
  const firstCue = todaySummary.exercises[0]
    ? getExerciseGuidance(todaySummary.exercises[0], todaySummary.exercises[0]).cues[0]
    : t.allDone;
  const lastRelevantLoad = (() => {
    const exercises = workoutData[currentDayIndex]?.[mode] || [];
    const loaded = exercises.find((exercise, index) => !exercise.noWeight && weights[`${currentDayIndex}-${mode}-${index}`]);
    if (!loaded) return t.noPreviousLoad;
    const index = exercises.indexOf(loaded);
    return `${loaded.name}: ${weights[`${currentDayIndex}-${mode}-${index}`]}`;
  })();
  const storageUsageRatio = storageStatus.estimate?.quota
    ? (storageStatus.estimate.usage || 0) / storageStatus.estimate.quota
    : 0;
  const hasStorageWarning = !storageStatus.persisted || storageUsageRatio > 0.85;

  const StatusHeader = () => (
    <header data-testid="status-header" className="sticky top-0 z-30 border-b border-[#D8CFBE] bg-[#F4F0E8]/95 px-3 pb-2 pt-[calc(var(--safe-top)+0.35rem)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#2F6F5E]">{t.statusTitle}</p>
          <div className="mt-0.5 flex min-w-0 items-center gap-1">
            <h1 className="truncate text-lg font-black leading-none text-[#171915]">Hybrid Fit</h1>
            {firebaseReady && (
              <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase ${isSynced ? 'bg-[#EAF1EA] text-[#17352D]' : 'bg-[#FFF0EC] text-[#A6422F]'}`}>
                {isSynced ? t.syncOnline : t.syncOffline}
              </span>
            )}
            <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase ${hasStorageWarning ? 'bg-[#FFF8E8] text-[#654C12]' : 'bg-[#EAF1EA] text-[#17352D]'}`}>
              {storageUsageRatio > 0.85 ? t.storageLow : storageStatus.persisted ? t.storagePersistent : t.storageTemporary}
            </span>
            {storageStatus.pending > 0 && (
              <span className="rounded-full bg-[#FFF8E8] px-1.5 py-0.5 text-[8px] font-black uppercase text-[#654C12]">
                {storageStatus.pending} {t.syncPending}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 justify-end text-[10px] font-black">
          <button onClick={() => setShowResetModal(true)} className="min-h-11 min-w-11 rounded-full border border-[#D9B8B0] bg-[#FFF8F6] px-2 text-[#A6422F]">{t.resetActionShort}</button>
        </div>
      </div>
    </header>
  );

  const TodayView = () => {
    const next = todaySummary.nextExercise;
    return (
      <main className="mx-auto max-w-md space-y-4 px-3 pb-[calc(var(--nav-total-height)+1rem)] pt-3">
        <section className="rounded-3xl border border-[#D8CFBE] bg-[#FFFCF4] p-4 shadow-[0_20px_80px_rgba(42,48,39,0.08)]">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2F6F5E]">{t.cockpitEyebrow}</p>
              <h2 className="mt-2 text-3xl font-black leading-[0.95] text-[#171915]">{workoutData[currentDayIndex].focus}</h2>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-[#626A5E]">{t.cockpitBody}</p>
            </div>
            <div className="sm:min-w-64"><ModeSwitch mode={mode} setMode={setMode} t={t} /></div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Metric label={t.metricToday} value={`${getDayProgress(currentDayIndex, mode, jetLagMode, sessionDuration)}%`} />
            <Metric label={t.metricSets} value={`${todaySummary.completed}/${todaySummary.totalSets}`} />
            <Metric label={t.metricStreak} value={calculateStreak()} />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Metric label={t.estimatedDuration} value={todayDuration} />
            <Metric label={t.equipmentLabel} value={todayEquipment} />
            <Metric label={t.plannedSets} value={todaySummary.totalSets} />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Metric label={t.lastRelevantLoad} value={lastRelevantLoad} />
            <Metric label={t.firstCue} value={firstCue} />
          </div>

          <div className="mt-4 rounded-3xl bg-[#ECE5D8] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#626A5E]">{t.nextUp}</p>
            <h3 className="mt-1 text-2xl font-black text-[#171915]">{next ? next.name : t.sessionComplete}</h3>
            <p className="mt-1 text-sm font-semibold text-[#626A5E]">
              {next ? `${next.done}/${next.total} ${t.setsDoneText}. ${next.desc}. ${t.restText} ${next.rest || '0s'}.` : t.sessionCompleteBody}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {DURATION_OPTIONS.map((duration) => (
              <button
                key={duration}
                onClick={() => startSession(duration, false)}
                className={`min-h-12 rounded-2xl px-4 text-sm font-black ${sessionDuration === duration ? 'bg-[#17352D] text-white' : 'border border-[#D8CFBE] bg-white text-[#17352D]'}`}
              >
                {t[`duration${duration}`]}
              </button>
            ))}
            <button onClick={() => startSession(sessionDuration, true)} className="min-h-12 rounded-2xl border border-[#C9B68F] bg-[#FFF8E8] px-4 text-sm font-black text-[#654C12]">{t.lowEnergySession}<span className="block text-[10px] font-bold">{t.habitFallback}</span></button>
            {activeSession && <button onClick={() => setActiveView('session')} className="min-h-12 rounded-2xl border border-[#D8CFBE] bg-white px-4 text-sm font-black text-[#17352D]">{t.resumeSession}</button>}
          </div>
        </section>

        {finishSummary && (
          <section className="rounded-3xl border border-[#D8CFBE] bg-[#FFFCF4] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2F6F5E]">{t.finishSummaryTitle}</p>
            <h3 className="mt-2 text-2xl font-black text-[#171915]">{finishSummary.completedSets}/{finishSummary.plannedSets} {t.setsDoneText}</h3>
            <p className="mt-2 text-sm font-semibold text-[#626A5E]">{t.finishSummaryBody}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label={t.sessionType} value={finishSummary.lowEnergy ? t.lowEnergy : finishSummary.mode === 'home' ? t.homeMode : t.hotelMode} />
              <Metric label={t.durationLabel} value={`${finishSummary.durationMinutes} min`} />
              <Metric label={t.timeToStart} value={`${finishSummary.timeToStartSeconds}s`} />
              <Metric label={t.prCount} value={finishSummary.prCount} />
              <Metric label={t.avgRpe} value={finishSummary.avgRpe || '-'} />
              <Metric label={t.bestToday} value={finishSummary.bestLoad || t.noPreviousLoad} />
            </div>
            <button onClick={() => setFinishSummary(null)} className="mt-4 min-h-12 rounded-2xl bg-[#17352D] px-4 text-sm font-black text-white">{t.backToToday}</button>
          </section>
        )}

        <section className="rounded-3xl border border-[#D8CFBE] bg-[#FFFCF4] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-black text-[#171915]">{t.todayPlan}</h3>
            {jetLagMode && <span className="rounded-full bg-[#FFF8E8] px-3 py-2 text-xs font-black text-[#654C12]">{t.lowEnergyOn}</span>}
          </div>
          <ExerciseList dayIndex={currentDayIndex} sessionMode={mode} compact />
        </section>
      </main>
    );
  };

  const PlanView = () => (
    <main className="mx-auto max-w-md space-y-4 px-3 pb-[calc(var(--nav-total-height)+1rem)] pt-3">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2F6F5E]">{t.navPlan}</p>
          <h2 className="text-3xl font-black text-[#171915]">{t.planTitle}</h2>
        </div>
        <div className="sm:min-w-64"><ModeSwitch mode={mode} setMode={setMode} t={t} /></div>
      </section>
      {workoutData.map((dayData, index) => (
        <section key={dayData.day} className="rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5">
          <button onClick={() => openDaySession(index)} className="mb-4 flex min-h-14 w-full items-center justify-between text-left">
            <div>
              <h3 className="text-2xl font-black text-[#171915]">{dayData.day}</h3>
              <p className="text-sm font-bold text-[#626A5E]">{dayData.focus} · {dayData.session}</p>
            </div>
            <span className="rounded-full bg-[#EAF1EA] px-3 py-2 text-sm font-black text-[#17352D]">{getDayProgress(index, mode, jetLagMode, sessionDuration)}%</span>
          </button>
          <ExerciseList dayIndex={index} sessionMode={mode} compact />
        </section>
      ))}
    </main>
  );

  const ProgressView = () => {
    const vol = getVolumeData();
    const total = Object.values(vol).reduce((a, b) => a + b, 0) || 1;
    return (
      <main className="mx-auto max-w-md space-y-4 px-3 pb-[calc(var(--nav-total-height)+1rem)] pt-3">
        <section className="rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2F6F5E]">{t.navProgress}</p>
          <h2 className="text-3xl font-black text-[#171915]">{t.progressTitle}</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric label={t.statsStreak} value={calculateStreak()} />
            <Metric label={t.statsRate} value={`${calculateCompletionRate()}%`} />
          </div>
          <div className="mt-5 flex items-center gap-1">
            {last14Days.map((dateStr) => {
              const count = workoutHistory[dateStr] || 0;
              const colorClass = count > 12 ? 'bg-[#17352D]' : count > 5 ? 'bg-[#2F6F5E]' : count > 0 ? 'bg-[#9AD0B1]' : 'bg-[#E8E0D1]';
              return <div key={dateStr} className={`h-8 flex-1 rounded-lg ${colorClass}`} />;
            })}
          </div>
        </section>
        <section className="rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5">
          <h3 className="mb-5 flex justify-between text-sm font-black uppercase tracking-wide text-[#171915]"><span>{t.statsVolume}</span><span>{t.volumeShort}: {Object.values(vol).reduce((a, b) => a + b, 0)}</span></h3>
          {Object.entries(vol).map(([key, value]) => (
            <div key={key} className="mb-4">
              <div className="mb-2 flex justify-between text-xs font-black uppercase text-[#626A5E]"><span>{t.categories[key]}</span><span>{Math.round((value / total) * 100)}%</span></div>
              <div className="h-2 rounded-full bg-[#E8E0D1]"><div className="h-full rounded-full bg-[#2F6F5E]" style={{ width: `${(value / total) * 100}%` }} /></div>
            </div>
          ))}
        </section>
        <section className="rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5">
          <h3 className="text-lg font-black text-[#171915]">{t.ownershipTitle}</h3>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-[#626A5E]">{t.ownershipBody}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <button onClick={handleExportJson} className="min-h-12 rounded-2xl bg-[#17352D] px-4 text-sm font-black text-white">{t.exportJson}</button>
            <button onClick={handleExportCsv} className="min-h-12 rounded-2xl border border-[#D8CFBE] px-4 text-sm font-black">{t.exportCsv}</button>
            <button onClick={() => document.getElementById('profile-import-file')?.click()} className="min-h-12 rounded-2xl border border-[#D8CFBE] px-4 text-sm font-black">{t.importJson}</button>
          </div>
          {importError && <p className="mt-3 rounded-2xl bg-[#FFF0EC] px-4 py-3 text-sm font-black text-[#A6422F]">{importError}</p>}
          <input id="profile-import-file" type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden" />
        </section>
      </main>
    );
  };

  const SessionView = () => {
    if (!activeSession) return <TodayView />;
    const dayData = workoutData[activeSession.dayIndex] || workoutData[currentDayIndex];
    const sessionMode = activeSession.mode || mode;
    const durationMinutes = activeSession.durationMinutes || 50;
    const lowEnergy = activeSession.lowEnergy ?? jetLagMode;
    const exercises = getSessionExercises(dayData[sessionMode] || [], durationMinutes);
    const exerciseIndex = Math.min(activeSession.exerciseIndex, Math.max(0, exercises.length - 1));
    const baseExercise = exercises[exerciseIndex];
    const isSwapped = swappedExercises[`${activeSession.dayIndex}-${sessionMode}-${exerciseIndex}`];
    const exercise = isSwapped && baseExercise?.alt ? baseExercise.alt : baseExercise;
    const totalSets = getSessionSetCount(baseExercise, lowEnergy, durationMinutes);
    const completedCount = getCompletedCount(activeSession.dayIndex, sessionMode, exerciseIndex, totalSets);
    const guidance = getExerciseGuidance(exercise, baseExercise);
    const nextExercise = exercises[exerciseIndex + 1];
    const exerciseStats = getExerciseStats(activeSession.dayIndex, sessionMode, exerciseIndex);
    const currentWeight = exerciseStats.currentWeight;

    const moveToNextExercise = () => {
      if (exerciseIndex >= exercises.length - 1) {
        finishSession();
        return;
      }
      setActiveSession((prev) => ({ ...prev, exerciseIndex: prev.exerciseIndex + 1, currentSetIndex: 0 }));
      setExpandedInfo(null);
    };

    const completeNextSet = () => {
      const setIndex = Array.from({ length: totalSets }).findIndex((_, idx) => !completedSets[`${activeSession.dayIndex}-${sessionMode}-${exerciseIndex}-${idx}`]);
      if (setIndex === -1) {
        moveToNextExercise();
        return;
      }
      if (setIndex >= 0) toggleSet(activeSession.dayIndex, sessionMode, exerciseIndex, setIndex, exercise.restSeconds ?? 60);
      if (setIndex === totalSets - 1) {
        if (exerciseIndex >= exercises.length - 1) {
          setTimeout(finishSession, 0);
        } else {
          moveToNextExercise();
        }
      }
    };

    if (!exercise) return null;

    if (activeSession.warmupDone === false) {
      return (
        <main className="mx-auto max-w-md space-y-4 px-3 pb-[calc(var(--nav-total-height)+1rem)] pt-3">
          <section className="rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5 shadow-[0_20px_80px_rgba(42,48,39,0.08)]">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2F6F5E]">{t.activeSession}</p>
            <h2 className="mt-2 text-3xl font-black text-[#171915]">{t.warmupTitle}</h2>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-[#626A5E]">{t.warmupBody}</p>
            <div className="mt-5 space-y-3">
              {[t.warmupStepOne, t.warmupStepTwo, t.warmupStepThree].map((step, index) => (
                <div key={step} className="flex gap-3 rounded-3xl bg-[#ECE5D8] p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#17352D] text-sm font-black text-white">{index + 1}</span>
                  <p className="text-sm font-bold text-[#31362F]">{step}</p>
                </div>
              ))}
            </div>
            <div data-testid="sticky-actions" className="sticky z-20 mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-[#D8CFBE] bg-[#FFFCF4]/95 p-2 shadow-2xl backdrop-blur-xl" style={{ bottom: 'var(--sticky-action-bottom)' }}>
              <button onClick={() => setActiveSession((prev) => ({ ...prev, warmupDone: true }))} className="min-h-12 rounded-2xl bg-[#17352D] px-2 text-xs font-black text-white">{t.warmupDone}</button>
              <button onClick={() => setActiveSession((prev) => ({ ...prev, warmupDone: true }))} className="min-h-12 rounded-2xl border border-[#D8CFBE] px-2 text-xs font-black text-[#626A5E]">{t.skipWarmup}</button>
            </div>
          </section>
        </main>
      );
    }

    return (
      <main className="mx-auto max-w-md space-y-4 px-3 pb-[calc(var(--nav-total-height)+6.5rem)] pt-3">
        <section className="rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5 shadow-[0_20px_80px_rgba(42,48,39,0.08)]">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2F6F5E]">{t.activeSession}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-3xl font-black leading-tight text-[#171915]">{exercise.name}</h2>
                {exerciseStats.isPr && <span className="rounded-full bg-[#17352D] px-3 py-1 text-[10px] font-black uppercase text-white">{t.prBadge}</span>}
              </div>
              <p className="mt-2 text-sm font-bold text-[#626A5E]">{dayData.day} · {sessionMode === 'home' ? t.homeMode : t.hotelMode} · {durationMinutes} min</p>
            </div>
            <button onClick={finishSession} className="min-h-11 rounded-full border border-[#D8CFBE] px-3 text-xs font-black text-[#626A5E]">{t.endSession}</button>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2">
            <Metric label={t.exerciseOf} value={`${exerciseIndex + 1}/${exercises.length}`} />
            <Metric label={t.setOf} value={`${completedCount}/${totalSets}`} />
            <Metric label={t.restText} value={exercise.rest || '0s'} />
          </div>

          <div className="mb-5 grid gap-2 sm:grid-cols-3">
            <Metric label={t.previousLoad} value={currentWeight || t.noPreviousLoad} />
            <Metric label={t.bestLoad} value={exerciseStats.bestLoad || t.noPreviousLoad} />
            <Metric label={t.bestSets} value={exerciseStats.bestSetCount || 0} />
          </div>

          <div className="rounded-3xl bg-[#ECE5D8] p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#626A5E]">{t.targetLabel}</p>
            <p className="mt-1 text-lg font-black text-[#171915]">{exercise.desc}</p>
            <p className="mt-2 text-sm font-bold text-[#626A5E]">{t.repsShort}: {baseExercise.reps}</p>
            <p className="mt-3 rounded-2xl bg-[#FFFCF4] px-3 py-2 text-sm font-black text-[#17352D]">{guidance.cues[0]}</p>
          </div>

          {!exercise.noWeight && (
            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#626A5E]">{t.load}</span>
              <input value={currentWeight} onChange={(event) => updateWeight(activeSession.dayIndex, sessionMode, exerciseIndex, event.target.value)} placeholder={t.weightPlaceholder} className="min-h-12 w-full rounded-2xl border border-[#D8CFBE] bg-white px-4 text-lg font-black outline-none focus:border-[#2F6F5E]" />
            </label>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#626A5E]">{t.noteLabel}</span>
              <input value={exerciseStats.note} onChange={(event) => updateExerciseNote(activeSession.dayIndex, sessionMode, exerciseIndex, event.target.value)} placeholder={t.notePlaceholder} className="min-h-12 w-full rounded-2xl border border-[#D8CFBE] bg-white px-4 text-sm font-bold outline-none focus:border-[#2F6F5E]" />
            </label>
            <div>
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#626A5E]">{t.rpeLabel}</span>
              <select value={exerciseStats.rpe} onChange={(event) => updateRpe(activeSession.dayIndex, sessionMode, exerciseIndex, event.target.value)} className="min-h-12 rounded-2xl border border-[#D8CFBE] bg-white px-4 text-sm font-black outline-none focus:border-[#2F6F5E]">
                <option value="">-</option>
                {Array.from({ length: 10 }).map((_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            {Array.from({ length: totalSets }).map((_, setIdx) => {
              const isChecked = completedSets[`${activeSession.dayIndex}-${sessionMode}-${exerciseIndex}-${setIdx}`];
              return (
                <button key={setIdx} onClick={() => toggleSet(activeSession.dayIndex, sessionMode, exerciseIndex, setIdx, exercise.restSeconds ?? 60)} className={`min-h-12 flex-1 rounded-2xl border text-sm font-black ${isChecked ? 'border-[#17352D] bg-[#17352D] text-white' : 'border-[#D8CFBE] bg-white text-[#626A5E]'}`}>
                  {setIdx + 1}
                </button>
              );
            })}
          </div>

          <div data-testid="sticky-actions" className="sticky z-20 mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-[#D8CFBE] bg-[#FFFCF4]/95 p-2 shadow-2xl backdrop-blur-xl" style={{ bottom: 'var(--sticky-action-bottom)' }}>
            <button disabled={exerciseIndex === 0} onClick={() => setActiveSession((prev) => ({ ...prev, exerciseIndex: Math.max(0, prev.exerciseIndex - 1) }))} className="min-h-12 rounded-2xl border border-[#D8CFBE] px-2 text-xs font-black disabled:opacity-40">{t.previous}</button>
            <button onClick={completeNextSet} className="min-h-12 rounded-2xl bg-[#17352D] px-2 text-xs font-black text-white">{completedCount >= totalSets ? t.nextExercise : t.completeSet}</button>
            <button onClick={() => (exerciseIndex >= exercises.length - 1 ? finishSession() : setActiveSession((prev) => ({ ...prev, exerciseIndex: prev.exerciseIndex + 1 })))} className="min-h-12 rounded-2xl border border-[#D8CFBE] px-2 text-xs font-black">{exerciseIndex >= exercises.length - 1 ? t.finishWorkout : t.nextExercise}</button>
          </div>
        </section>

        <ExerciseGuidance guidance={guidance} exercise={exercise} expanded={expandedInfo === 'session'} setExpanded={(value) => setExpandedInfo(value ? 'session' : null)} t={t} />

        {nextExercise && (
          <section className="rounded-3xl border border-[#D8CFBE] bg-[#FFFCF4] p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#626A5E]">{t.nextUp}</p>
            <p className="mt-1 text-lg font-black text-[#171915]">{nextExercise.name}</p>
          </section>
        )}
      </main>
    );
  };

  const ExerciseList = ({ dayIndex, sessionMode, compact = false }) => {
    const dayData = workoutData[dayIndex];
    const exercises = getSessionExercises(dayData?.[sessionMode] || [], sessionDuration);
    return (
      <div className="space-y-3">
        {exercises.map((baseExercise, exIndex) => {
          const isSwapped = swappedExercises[`${dayIndex}-${sessionMode}-${exIndex}`];
          const exercise = isSwapped && baseExercise.alt ? baseExercise.alt : baseExercise;
          const numSets = getSessionSetCount(baseExercise, jetLagMode, sessionDuration);
          const completedCount = getCompletedCount(dayIndex, sessionMode, exIndex, numSets);
          const isInfoExpanded = expandedInfo === `${dayIndex}-${sessionMode}-${exIndex}`;
          const guidance = getExerciseGuidance(exercise, baseExercise);
          const currentWeight = weights[`${dayIndex}-${sessionMode}-${exIndex}`] || '';
          return (
            <article key={`${dayIndex}-${sessionMode}-${exIndex}`} className="rounded-3xl border border-[#D8CFBE] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#2F6F5E]">{String(exIndex + 1).padStart(2, '0')}</p>
                  <h4 className="text-lg font-black text-[#171915]">{exercise.name}</h4>
                  <p className="mt-1 text-xs font-bold text-[#626A5E]">{exercise.desc} · {t.repsShort}: {baseExercise.reps} · {t.restText}: {exercise.rest}</p>
                </div>
                <span className="rounded-full bg-[#EAF1EA] px-3 py-2 text-xs font-black text-[#17352D]">{completedCount}/{numSets}</span>
              </div>
              {!compact && <p className="mt-3 text-sm text-[#626A5E]">{exercise.instructions}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {Array.from({ length: numSets }).map((_, setIdx) => {
                  const isChecked = completedSets[`${dayIndex}-${sessionMode}-${exIndex}-${setIdx}`];
                  return <button key={setIdx} onClick={() => toggleSet(dayIndex, sessionMode, exIndex, setIdx, exercise.restSeconds ?? 60)} className={`min-h-11 min-w-11 rounded-2xl border text-sm font-black ${isChecked ? 'border-[#17352D] bg-[#17352D] text-white' : 'border-[#D8CFBE] bg-[#FFFCF4] text-[#626A5E]'}`}>{setIdx + 1}</button>;
                })}
                {baseExercise.alt && <button onClick={() => toggleSwapExercise(dayIndex, sessionMode, exIndex)} className="min-h-11 rounded-2xl border border-[#D8CFBE] px-3 text-xs font-black text-[#626A5E]">{t.swap}</button>}
                <button onClick={() => setExpandedInfo(isInfoExpanded ? null : `${dayIndex}-${sessionMode}-${exIndex}`)} className="min-h-11 rounded-2xl border border-[#D8CFBE] px-3 text-xs font-black text-[#626A5E]">{t.info}</button>
              </div>
              {!exercise.noWeight && !compact && (
                <input value={currentWeight} onChange={(event) => updateWeight(dayIndex, sessionMode, exIndex, event.target.value)} placeholder={t.weightPlaceholder} className="mt-3 min-h-11 w-full rounded-2xl border border-[#D8CFBE] px-3 font-black outline-none focus:border-[#2F6F5E]" />
              )}
              {isInfoExpanded && <div className="mt-4"><ExerciseGuidance guidance={guidance} exercise={exercise} expanded setExpanded={() => setExpandedInfo(null)} t={t} /></div>}
            </article>
          );
        })}
      </div>
    );
  };

  const Metric = ({ label, value }) => (
    <div className="rounded-3xl bg-[#ECE5D8] p-3 text-center">
      <span className="block text-[10px] font-black uppercase tracking-wide text-[#626A5E]">{label}</span>
      <strong className="mt-1 block break-words text-xl font-black text-[#17352D] sm:text-2xl">{value}</strong>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800;900&family=JetBrains+Mono:wght@400;700;800&display=swap');
        body { font-family: 'Archivo', sans-serif; }
        * { letter-spacing: 0; }
      `}</style>
      <div className="min-h-screen bg-[#F4F0E8] text-[#171915]">
        <StatusHeader />
        {showResetModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-[2rem] bg-[#FFFCF4] p-6 shadow-2xl">
              <h3 className="text-2xl font-black text-[#A6422F]">{t.resetTitle}</h3>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#626A5E]">{t.reset}</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button onClick={() => setShowResetModal(false)} className="min-h-12 rounded-2xl border border-[#D8CFBE] font-black">{t.cancel}</button>
                <button onClick={resetProgress} className="min-h-12 rounded-2xl bg-[#A6422F] font-black text-white">{t.resetAction}</button>
              </div>
            </div>
          </div>
        )}
        {pendingImportData && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div data-testid="import-modal" className="w-full max-w-sm rounded-[2rem] bg-[#FFFCF4] p-6 shadow-2xl">
              <h3 className="text-2xl font-black text-[#171915]">{t.importConfirmTitle}</h3>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#626A5E]">{t.importConfirmBody}</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button onClick={() => { setPendingImportData(null); setImportError(''); }} className="min-h-12 rounded-2xl border border-[#D8CFBE] font-black">{t.cancel}</button>
                <button onClick={confirmImportProfile} className="min-h-12 rounded-2xl bg-[#17352D] font-black text-white">{t.importJson}</button>
              </div>
            </div>
          </div>
        )}
        {updateReady && (
          <div className="fixed inset-x-0 bottom-[5.5rem] z-[90] px-4">
            <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-3xl border border-[#17352D] bg-[#FFFCF4] p-4 shadow-2xl">
              <p className="text-sm font-black text-[#171915]">{t.updateAvailable}</p>
              <div className="flex gap-2">
                <button onClick={() => setUpdateReady(false)} className="min-h-11 rounded-2xl border border-[#D8CFBE] px-3 text-xs font-black">{t.later}</button>
                <button onClick={() => updateServiceWorkerRef.current?.(true)} className="min-h-11 rounded-2xl bg-[#17352D] px-3 text-xs font-black text-white">{t.updateNow}</button>
              </div>
            </div>
          </div>
        )}
        {activeView === 'today' && <TodayView />}
        {activeView === 'plan' && <PlanView />}
        {activeView === 'progress' && <ProgressView />}
        {activeView === 'session' && <SessionView />}
        <RestTimer timer={timer} formatTime={formatTime} adjustTimer={adjustTimer} setTimer={setTimer} t={t} elevated={activeView === 'session' && activeSession?.warmupDone !== false} />
        <BottomNav activeView={activeView === 'session' ? 'today' : activeView} setActiveView={setActiveView} t={t} />
      </div>
    </>
  );
};

export default App;
