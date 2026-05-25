import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { translations, workoutTranslations } from './data/i18n.js';
import { createWorkoutData } from './data/workouts.js';
import { BottomNav, ExerciseGuidance, ModeSwitch, RestTimer } from './components/TrainingControls.jsx';
import {
  GLOBAL_KEYS,
  LEGACY_KEYS,
  PROFILES,
  getActiveSessionKey,
  getLocalDateString,
  getProfileKeys,
  loadLocalProfileData,
  migrateLegacyProfileStorage,
  readBoolStorage,
  readJsonStorage,
} from './storage/workoutStorage.js';

let app, auth, db;
let firebaseInitialized = false;

try {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  };

  if (firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    firebaseInitialized = true;
  }
} catch (error) {
  console.warn('Firebase offline/local mode.', error);
}

const getInitialProfile = () => {
  try {
    const savedProfile = localStorage.getItem(GLOBAL_KEYS.selectedProfile);
    return PROFILES.some((profile) => profile.id === savedProfile) ? savedProfile : '';
  } catch {
    return '';
  }
};

const getInitialLanguage = () => {
  try {
    const savedLang = localStorage.getItem(GLOBAL_KEYS.lang);
    return translations[savedLang] ? savedLang : 'en';
  } catch {
    return 'en';
  }
};

const getSetCount = (exercise, lowEnergy) => {
  const originalSets = parseInt(exercise.sets, 10) || 1;
  return lowEnergy ? Math.min(2, originalSets) : originalSets;
};

const App = () => {
  const [selectedProfile, setSelectedProfile] = useState(getInitialProfile);
  const [activeView, setActiveView] = useState('today');
  const [mode, setMode] = useState('home');
  const [jetLagMode, setJetLagMode] = useState(false);
  const [completedSets, setCompletedSets] = useState({});
  const [expandedInfo, setExpandedInfo] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [swappedExercises, setSwappedExercises] = useState({});
  const [weights, setWeights] = useState({});
  const [workoutHistory, setWorkoutHistory] = useState({});
  const [quietMode, setQuietMode] = useState(false);
  const [lang, setLang] = useState(getInitialLanguage);
  const [user, setUser] = useState(null);
  const [isSynced, setIsSynced] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [timer, setTimer] = useState({ active: false, time: 0, total: 60 });

  const hasLoadedCloudData = useRef(false);
  const activeProfileRef = useRef('');
  const currentDayIndex = (new Date().getDay() + 6) % 7;

  const t = translations[lang] || translations.en;
  const workoutData = useMemo(() => createWorkoutData(t, workoutTranslations[lang] || {}), [lang, t]);
  const selectedProfileLabel = PROFILES.find((profile) => profile.id === selectedProfile)?.label || '';

  const applyWorkoutData = useCallback((data) => {
    setCompletedSets(data.completedSets || {});
    setWeights(data.weights || {});
    setWorkoutHistory(data.workoutHistory || {});
    setSwappedExercises(data.swappedExercises || {});
  }, []);

  useEffect(() => {
    if (!firebaseInitialized) return;
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.warn('Offline auth fallback.', error.message);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedProfile) return;

    activeProfileRef.current = selectedProfile;
    hasLoadedCloudData.current = false;
    setIsSynced(false);

    try {
      localStorage.setItem(GLOBAL_KEYS.selectedProfile, selectedProfile);
      migrateLegacyProfileStorage(selectedProfile);
      applyWorkoutData(loadLocalProfileData(selectedProfile));
      setActiveSession(readJsonStorage(getActiveSessionKey(selectedProfile), null));
    } catch {
      applyWorkoutData({ completedSets: {}, weights: {}, workoutHistory: {}, swappedExercises: {} });
      setActiveSession(null);
    }
  }, [selectedProfile, applyWorkoutData]);

  useEffect(() => {
    if (!firebaseInitialized || !user || !selectedProfile) return;
    const profileId = selectedProfile;
    const userDocRef = doc(db, 'workout_profiles', profileId, 'app_data', 'workout_data');

    const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
      if (activeProfileRef.current !== profileId) return;
      if (docSnap.exists()) {
        if (!hasLoadedCloudData.current) {
          applyWorkoutData(docSnap.data());
          hasLoadedCloudData.current = true;
          setIsSynced(true);
        }
      } else {
        const localProfileData = loadLocalProfileData(profileId);
        hasLoadedCloudData.current = true;
        setDoc(userDocRef, { profileId, ...localProfileData, lastUpdated: new Date().toISOString() }, { merge: true })
          .then(() => setIsSynced(true))
          .catch(() => setIsSynced(false));
      }
    }, () => setIsSynced(false));

    return () => unsubscribeSnapshot();
  }, [user, selectedProfile, applyWorkoutData]);

  useEffect(() => {
    if (firebaseInitialized && user && selectedProfile && hasLoadedCloudData.current) {
      const profileId = selectedProfile;
      const userDocRef = doc(db, 'workout_profiles', profileId, 'app_data', 'workout_data');
      setDoc(userDocRef, {
        profileId,
        completedSets,
        weights,
        workoutHistory,
        swappedExercises,
        lastUpdated: new Date().toISOString(),
      }, { merge: true }).then(() => setIsSynced(true)).catch(() => setIsSynced(false));
    }
  }, [completedSets, weights, workoutHistory, swappedExercises, user, selectedProfile]);

  useEffect(() => {
    try {
      const legacyJetLag = localStorage.getItem(LEGACY_KEYS.jetLag);
      const legacyQuiet = localStorage.getItem(LEGACY_KEYS.quiet);
      const legacyLang = localStorage.getItem(LEGACY_KEYS.lang);

      if (!localStorage.getItem(GLOBAL_KEYS.jetLag) && legacyJetLag !== null) localStorage.setItem(GLOBAL_KEYS.jetLag, legacyJetLag);
      if (!localStorage.getItem(GLOBAL_KEYS.quiet) && legacyQuiet !== null) localStorage.setItem(GLOBAL_KEYS.quiet, legacyQuiet);
      if (!localStorage.getItem(GLOBAL_KEYS.lang) && legacyLang !== null) localStorage.setItem(GLOBAL_KEYS.lang, legacyLang);

      setJetLagMode(readBoolStorage(GLOBAL_KEYS.jetLag, LEGACY_KEYS.jetLag));
      setQuietMode(readBoolStorage(GLOBAL_KEYS.quiet, LEGACY_KEYS.quiet));
      const savedLang = localStorage.getItem(GLOBAL_KEYS.lang);
      if (translations[savedLang]) setLang(savedLang);
    } catch {
      console.warn('Unable to load local preferences.');
    }
  }, []);

  useEffect(() => {
    if (!selectedProfile) return;
    try {
      const keys = getProfileKeys(selectedProfile);
      localStorage.setItem(keys.completedSets, JSON.stringify(completedSets));
      localStorage.setItem(keys.weights, JSON.stringify(weights));
      localStorage.setItem(keys.workoutHistory, JSON.stringify(workoutHistory));
      localStorage.setItem(keys.swappedExercises, JSON.stringify(swappedExercises));
      localStorage.setItem(GLOBAL_KEYS.jetLag, jetLagMode.toString());
      localStorage.setItem(GLOBAL_KEYS.quiet, quietMode.toString());
      localStorage.setItem(GLOBAL_KEYS.lang, lang);
    } catch {
      console.warn('Unable to save local workout data.');
    }
  }, [completedSets, weights, workoutHistory, swappedExercises, jetLagMode, quietMode, lang, selectedProfile]);

  useEffect(() => {
    if (!selectedProfile) return;
    try {
      const key = getActiveSessionKey(selectedProfile);
      if (activeSession) localStorage.setItem(key, JSON.stringify(activeSession));
      else localStorage.removeItem(key);
    } catch {
      console.warn('Unable to save active session.');
    }
  }, [activeSession, selectedProfile]);

  const playAlert = useCallback(() => {
    if (quietMode) return;
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(t.voiceEnd);
      utterance.lang = lang === 'pt' ? 'pt-PT' : lang === 'en' ? 'en-US' : 'es-ES';
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
  }, [quietMode, lang, t.voiceEnd]);

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
    if (!quietMode && 'speechSynthesis' in window && window.speechSynthesis.getVoices().length === 0) {
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
    setActiveSession(null);
    setShowResetModal(false);
  };

  const toggleSet = (dayIndex, sessionMode, exIndex, setIndex, restSeconds = 60) => {
    const key = `${dayIndex}-${sessionMode}-${exIndex}-${setIndex}`;
    const todayStr = getLocalDateString();
    const isCheckedBefore = !!completedSets[key];

    setCompletedSets((prev) => ({ ...prev, [key]: !prev[key] }));
    if (!isCheckedBefore) startRestTimer(restSeconds);

    setWorkoutHistory((prev) => {
      const currentCount = prev[todayStr] || 0;
      const newCount = Math.max(0, currentCount + (isCheckedBefore ? -1 : 1));
      return { ...prev, [todayStr]: newCount };
    });
  };

  const updateWeight = (dayIndex, sessionMode, exIndex, value) => {
    const key = `${dayIndex}-${sessionMode}-${exIndex}`;
    setWeights((prev) => ({ ...prev, [key]: value }));
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

  const cycleLanguage = () => {
    const langs = ['pt', 'en', 'es'];
    const nextIdx = (langs.indexOf(lang) + 1) % langs.length;
    setLang(langs[nextIdx]);
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

  const getDayProgress = (dayIndex, sessionMode = mode, lowEnergy = jetLagMode) => {
    const data = workoutData[dayIndex]?.[sessionMode] || [];
    let totalSets = 0;
    let completed = 0;
    data.forEach((ex, i) => {
      const numSets = getSetCount(ex, lowEnergy);
      totalSets += numSets;
      completed += getCompletedCount(dayIndex, sessionMode, i, numSets);
    });
    return totalSets === 0 ? 0 : Math.round((completed / totalSets) * 100);
  };

  const getWorkoutSummary = (dayIndex, sessionMode = mode, lowEnergy = jetLagMode) => {
    const exercises = workoutData[dayIndex]?.[sessionMode] || [];
    let totalSets = 0;
    let completed = 0;
    let nextExercise = null;

    exercises.forEach((ex, i) => {
      const numSets = getSetCount(ex, lowEnergy);
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
    const dayExercises = dayData[mode] || dayData.home || [];
    return sum + dayExercises.reduce((daySum, ex) => daySum + getSetCount(ex, jetLagMode), 0);
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

  const startSession = (lowEnergy = jetLagMode) => {
    setJetLagMode(lowEnergy);
    setActiveSession({ dayIndex: currentDayIndex, mode, exerciseIndex: 0, currentSetIndex: 0, lowEnergy, startedAt: new Date().toISOString() });
    setActiveView('session');
    setExpandedInfo(null);
  };

  const openDaySession = (dayIndex) => {
    setActiveSession({ dayIndex, mode, exerciseIndex: 0, currentSetIndex: 0, lowEnergy: jetLagMode, startedAt: new Date().toISOString() });
    setActiveView('session');
    setExpandedInfo(null);
  };

  const finishSession = () => {
    setActiveSession(null);
    setActiveView('today');
    setExpandedInfo(null);
  };

  const clearSelectedProfile = () => {
    try {
      localStorage.removeItem(GLOBAL_KEYS.selectedProfile);
    } catch (error) {
      console.warn('Unable to clear selected profile.', error);
    }
    setActiveSession(null);
    setSelectedProfile('');
  };

  const last14Days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return getLocalDateString(d);
  });

  const todaySummary = getWorkoutSummary(currentDayIndex, mode, jetLagMode);

  const StatusHeader = () => (
    <header className="sticky top-0 z-30 border-b border-[#D8CFBE] bg-[#F4F0E8]/95 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#2F6F5E]">{t.statusTitle}</p>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black leading-none text-[#171915]">Hybrid Fit</h1>
            {firebaseInitialized && (
              <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${isSynced ? 'bg-[#EAF1EA] text-[#17352D]' : 'bg-[#FFF0EC] text-[#A6422F]'}`}>
                {isSynced ? t.syncOnline : t.syncOffline}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 text-xs font-black">
          <button onClick={cycleLanguage} className="min-h-11 rounded-full border border-[#D8CFBE] bg-[#FFFCF4] px-3 uppercase">[{lang}]</button>
          <button onClick={() => setQuietMode(!quietMode)} className="min-h-11 rounded-full border border-[#D8CFBE] bg-[#FFFCF4] px-3">{quietMode ? t.quietOn : t.quietOff}</button>
          <button onClick={clearSelectedProfile} className="min-h-11 rounded-full border border-[#D8CFBE] bg-[#FFFCF4] px-3">{selectedProfileLabel}</button>
          <button onClick={() => setShowResetModal(true)} className="min-h-11 rounded-full border border-[#D9B8B0] bg-[#FFF8F6] px-3 text-[#A6422F]">{t.resetActionShort}</button>
        </div>
      </div>
    </header>
  );

  const TodayView = () => {
    const next = todaySummary.nextExercise;
    return (
      <main className="mx-auto max-w-5xl space-y-5 px-4 pb-36 pt-5">
        <section className="rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5 shadow-[0_20px_80px_rgba(42,48,39,0.08)]">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2F6F5E]">{t.cockpitEyebrow}</p>
              <h2 className="mt-2 text-4xl font-black leading-[0.95] text-[#171915]">{workoutData[currentDayIndex].focus}</h2>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-[#626A5E]">{t.cockpitBody}</p>
            </div>
            <div className="sm:min-w-64"><ModeSwitch mode={mode} setMode={setMode} t={t} /></div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Metric label={t.metricToday} value={`${getDayProgress(currentDayIndex, mode, jetLagMode)}%`} />
            <Metric label={t.metricSets} value={`${todaySummary.completed}/${todaySummary.totalSets}`} />
            <Metric label={t.metricStreak} value={calculateStreak()} />
          </div>

          <div className="mt-4 rounded-3xl bg-[#ECE5D8] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#626A5E]">{t.nextUp}</p>
            <h3 className="mt-1 text-2xl font-black text-[#171915]">{next ? next.name : t.sessionComplete}</h3>
            <p className="mt-1 text-sm font-semibold text-[#626A5E]">
              {next ? `${next.done}/${next.total} ${t.setsDoneText}. ${next.desc}. ${t.restText} ${next.rest || '0s'}.` : t.sessionCompleteBody}
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <button onClick={() => startSession(false)} className="min-h-14 rounded-2xl bg-[#17352D] px-5 text-sm font-black text-white">{t.fullSession}</button>
            <button onClick={() => startSession(true)} className="min-h-14 rounded-2xl border border-[#C9B68F] bg-[#FFF8E8] px-5 text-sm font-black text-[#654C12]">{t.lowEnergySession}</button>
            {activeSession && <button onClick={() => setActiveView('session')} className="min-h-14 rounded-2xl border border-[#D8CFBE] bg-white px-5 text-sm font-black text-[#17352D]">{t.resumeSession}</button>}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5">
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
    <main className="mx-auto max-w-5xl space-y-4 px-4 pb-36 pt-5">
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
            <span className="rounded-full bg-[#EAF1EA] px-3 py-2 text-sm font-black text-[#17352D]">{getDayProgress(index, mode, jetLagMode)}%</span>
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
      <main className="mx-auto max-w-5xl space-y-5 px-4 pb-36 pt-5">
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
      </main>
    );
  };

  const SessionView = () => {
    if (!activeSession) return <TodayView />;
    const dayData = workoutData[activeSession.dayIndex] || workoutData[currentDayIndex];
    const sessionMode = activeSession.mode || mode;
    const exercises = dayData[sessionMode] || [];
    const exerciseIndex = Math.min(activeSession.exerciseIndex, Math.max(0, exercises.length - 1));
    const baseExercise = exercises[exerciseIndex];
    const isSwapped = swappedExercises[`${activeSession.dayIndex}-${sessionMode}-${exerciseIndex}`];
    const exercise = isSwapped && baseExercise?.alt ? baseExercise.alt : baseExercise;
    const lowEnergy = activeSession.lowEnergy ?? jetLagMode;
    const totalSets = getSetCount(baseExercise, lowEnergy);
    const completedCount = getCompletedCount(activeSession.dayIndex, sessionMode, exerciseIndex, totalSets);
    const guidance = getExerciseGuidance(exercise, baseExercise);
    const nextExercise = exercises[exerciseIndex + 1];
    const currentWeight = weights[`${activeSession.dayIndex}-${sessionMode}-${exerciseIndex}`] || '';

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
      if (setIndex === totalSets - 1) moveToNextExercise();
    };

    if (!exercise) return null;

    return (
      <main className="mx-auto max-w-3xl space-y-5 px-4 pb-36 pt-5">
        <section className="rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5 shadow-[0_20px_80px_rgba(42,48,39,0.08)]">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2F6F5E]">{t.activeSession}</p>
              <h2 className="mt-1 text-3xl font-black leading-tight text-[#171915]">{exercise.name}</h2>
              <p className="mt-2 text-sm font-bold text-[#626A5E]">{dayData.day} · {sessionMode === 'home' ? t.homeMode : t.hotelMode}</p>
            </div>
            <button onClick={finishSession} className="min-h-11 rounded-full border border-[#D8CFBE] px-3 text-xs font-black text-[#626A5E]">{t.endSession}</button>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2">
            <Metric label={t.exerciseOf} value={`${exerciseIndex + 1}/${exercises.length}`} />
            <Metric label={t.setOf} value={`${completedCount}/${totalSets}`} />
            <Metric label={t.restText} value={exercise.rest || '0s'} />
          </div>

          <div className="rounded-3xl bg-[#ECE5D8] p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#626A5E]">{t.targetLabel}</p>
            <p className="mt-1 text-lg font-black text-[#171915]">{exercise.desc}</p>
            <p className="mt-2 text-sm font-bold text-[#626A5E]">{t.repsShort}: {baseExercise.reps}</p>
          </div>

          {!exercise.noWeight && (
            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#626A5E]">{t.load}</span>
              <input value={currentWeight} onChange={(event) => updateWeight(activeSession.dayIndex, sessionMode, exerciseIndex, event.target.value)} placeholder={t.weightPlaceholder} className="min-h-12 w-full rounded-2xl border border-[#D8CFBE] bg-white px-4 text-lg font-black outline-none focus:border-[#2F6F5E]" />
            </label>
          )}

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

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <button disabled={exerciseIndex === 0} onClick={() => setActiveSession((prev) => ({ ...prev, exerciseIndex: Math.max(0, prev.exerciseIndex - 1) }))} className="min-h-12 rounded-2xl border border-[#D8CFBE] px-4 text-sm font-black disabled:opacity-40">{t.previous}</button>
            <button onClick={completeNextSet} className="min-h-12 rounded-2xl bg-[#17352D] px-4 text-sm font-black text-white">{completedCount >= totalSets ? t.nextExercise : t.completeSet}</button>
            <button onClick={() => (exerciseIndex >= exercises.length - 1 ? finishSession() : setActiveSession((prev) => ({ ...prev, exerciseIndex: prev.exerciseIndex + 1 })))} className="min-h-12 rounded-2xl border border-[#D8CFBE] px-4 text-sm font-black">{exerciseIndex >= exercises.length - 1 ? t.finishWorkout : t.nextExercise}</button>
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
    const exercises = dayData?.[sessionMode] || [];
    return (
      <div className="space-y-3">
        {exercises.map((baseExercise, exIndex) => {
          const isSwapped = swappedExercises[`${dayIndex}-${sessionMode}-${exIndex}`];
          const exercise = isSwapped && baseExercise.alt ? baseExercise.alt : baseExercise;
          const numSets = getSetCount(baseExercise, jetLagMode);
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
      <strong className="mt-1 block text-2xl font-black text-[#17352D]">{value}</strong>
    </div>
  );

  if (!selectedProfile) {
    return (
      <div className="min-h-screen bg-[#F4F0E8] px-4 py-10 text-[#171915]">
        <section className="mx-auto flex min-h-[80vh] max-w-xl flex-col justify-center">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#2F6F5E]">{t.selectProfile}</p>
          <h1 className="mt-3 text-6xl font-black leading-[0.9]">Hybrid<br />Fit</h1>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {PROFILES.map((profile) => (
              <button key={profile.id} onClick={() => setSelectedProfile(profile.id)} className="min-h-24 rounded-3xl border border-[#D8CFBE] bg-[#FFFCF4] p-5 text-left shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-wide text-[#626A5E]">{t.profileLabel}</span>
                <strong className="mt-2 block text-3xl font-black">{profile.label}</strong>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

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
        {activeView === 'today' && <TodayView />}
        {activeView === 'plan' && <PlanView />}
        {activeView === 'progress' && <ProgressView />}
        {activeView === 'session' && <SessionView />}
        <RestTimer timer={timer} formatTime={formatTime} adjustTimer={adjustTimer} setTimer={setTimer} t={t} />
        <BottomNav activeView={activeView === 'session' ? 'today' : activeView} setActiveView={setActiveView} t={t} />
      </div>
    </>
  );
};

export default App;
