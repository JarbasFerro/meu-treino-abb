/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useRef } from 'react';

// --- FIREBASE SETUP ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

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
} catch (e) {
  console.warn("Firebase offline/local mode.", e);
}
// ----------------------

const PROFILES = [
  { id: 'jarbas', label: 'Jarbas' },
  { id: 'isabella', label: 'Isabella' },
];

const GLOBAL_KEYS = {
  selectedProfile: 'hybridFitSelectedProfile',
  jetLag: 'hybridFitJetLagMode',
  quiet: 'hybridFitQuietMode',
  lang: 'hybridFitLang',
};

const LEGACY_PREFIX = ['a', 'b', 'b'].join('');
const LEGACY_KEYS = {
  completedSets: `${LEGACY_PREFIX}WorkoutProgress`,
  weights: `${LEGACY_PREFIX}Weights`,
  workoutHistory: `${LEGACY_PREFIX}WorkoutHistory`,
  swappedExercises: `${LEGACY_PREFIX}SwappedExercises`,
  jetLag: `${LEGACY_PREFIX}JetLagMode`,
  quiet: `${LEGACY_PREFIX}QuietMode`,
  lang: `${LEGACY_PREFIX}Lang`,
};

const getProfileKeys = (profileId) => ({
  completedSets: `hybridFitWorkoutProgress:${profileId}`,
  weights: `hybridFitWeights:${profileId}`,
  workoutHistory: `hybridFitWorkoutHistory:${profileId}`,
  swappedExercises: `hybridFitSwappedExercises:${profileId}`,
});

const readJsonStorage = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const readBoolStorage = (newKey, legacyKey) => {
  const value = localStorage.getItem(newKey) ?? localStorage.getItem(legacyKey);
  return value === 'true';
};

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const migrateLegacyProfileStorage = (profileId) => {
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

const loadLocalProfileData = (profileId) => {
  const keys = getProfileKeys(profileId);
  return {
    completedSets: readJsonStorage(keys.completedSets, {}),
    weights: readJsonStorage(keys.weights, {}),
    workoutHistory: readJsonStorage(keys.workoutHistory, {}),
    swappedExercises: readJsonStorage(keys.swappedExercises, {}),
  };
};

const translations = {
  pt: {
    title: "HYBRID FIT",
    subtitle: "PROTOCOLO DE TREINO // HYBRID FIT",
    selectProfile: "SELECIONAR PERFIL",
    changeProfile: "TROCAR PERFIL",
    home: "BASE [CASA]",
    hotel: "CAMPO [HOTEL]",
    analytics: "DADOS [STATS]",
    reset: "ATENÇÃO: Este comando irá expurgar o registo de séries da semana atual. O histórico global será mantido. Confirmar purga?",
    cancel: "ABORTAR",
    confirmReset: "CONFIRMAR PURGA",
    today: "CICLO ATUAL",
    completed: "CONCLUÍDO",
    markSets: "REGISTO DE SÉRIES:",
    sets: "SÉRIES",
    weight: "CARGA (KG)",
    lastWeight: "MEMÓRIA:",
    rest: "DESCANSO ATIVO",
    voiceEnd: "Ciclo de descanso terminado. Retomar protocolo.",
    jetLagOn: "JET LAG [ON]",
    jetLagOff: "JET LAG [OFF]",
    statsStreak: "OFENSIVA (DIAS)",
    statsRate: "TAXA DE SUCESSO (7D)",
    statsVolume: "DISTRIBUIÇÃO DE CARGA MUSCULAR",
    syncOnline: "UPLINK [ON]",
    syncOffline: "UPLINK [OFF]",
    resetTitle: "CONFIRMAR PURGA",
    resetAction: "PURGAR",
    quietOn: "[MUDO]",
    quietOff: "[SOM]",
    analyticsTitle: "TELEMETRIA",
    jetLagAlertTitle: "[ALERTA TÁTICO]:",
    jetLagAlertBody: "Modo Jet Lag ativado. Séries limitadas (MAX 2). Executar com precisão.",
    execution: "EXECUÇÃO",
    load: "CARGA [KG/LB]",
    pause: "[PAUSA]",
    play: "[PLAY]",
    progress: "PRG",
    active: "ACTV",
    days: ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"],
  },
  en: {
    title: "HYBRID FIT",
    subtitle: "TRAINING PROTOCOL // HYBRID FIT",
    selectProfile: "SELECT PROFILE",
    changeProfile: "SWITCH PROFILE",
    home: "BASE [HOME]",
    hotel: "FIELD [HOTEL]",
    analytics: "DATA [STATS]",
    reset: "WARNING: This will purge current week's set logs. Global history will be retained. Confirm purge?",
    cancel: "ABORT",
    confirmReset: "CONFIRM PURGE",
    today: "ACTIVE CYCLE",
    completed: "COMPLETED",
    markSets: "SET LOG:",
    sets: "SETS",
    weight: "LOAD (KG)",
    lastWeight: "MEMORY:",
    rest: "ACTIVE REST",
    voiceEnd: "Rest cycle complete. Resume protocol.",
    jetLagOn: "JET LAG [ON]",
    jetLagOff: "JET LAG [OFF]",
    statsStreak: "STREAK (DAYS)",
    statsRate: "SUCCESS RATE (7D)",
    statsVolume: "MUSCLE LOAD DISTRIBUTION",
    syncOnline: "UPLINK [ON]",
    syncOffline: "UPLINK [OFF]",
    resetTitle: "CONFIRM PURGE",
    resetAction: "PURGE",
    quietOn: "[MUTE]",
    quietOff: "[SOUND]",
    analyticsTitle: "TELEMETRY",
    jetLagAlertTitle: "[LOW ENERGY]:",
    jetLagAlertBody: "Low Energy mode is active. Sets are capped at 2. Move with precision.",
    execution: "EXECUTION",
    load: "LOAD [KG/LB]",
    pause: "[PAUSE]",
    play: "[PLAY]",
    progress: "PRG",
    active: "LIVE",
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  },
  es: {
    title: "HYBRID FIT",
    subtitle: "PROTOCOLO DE ENTRENAMIENTO // HYBRID FIT",
    selectProfile: "SELECCIONAR PERFIL",
    changeProfile: "CAMBIAR PERFIL",
    home: "BASE [CASA]",
    hotel: "CAMPO [HOTEL]",
    analytics: "DATOS [STATS]",
    reset: "ADVERTENCIA: Este comando purgará el registro de series de la semana actual. El historial global se mantendrá. ¿Confirmar purga?",
    cancel: "ABORTAR",
    confirmReset: "CONFIRMAR PURGA",
    today: "CICLO ACTIVO",
    completed: "COMPLETADO",
    markSets: "REGISTRO SERIES:",
    sets: "SERIES",
    weight: "CARGA (KG)",
    lastWeight: "MEMORIA:",
    rest: "DESCANSO ACTIVO",
    voiceEnd: "Ciclo de descanso finalizado. Retomar protocolo.",
    jetLagOn: "JET LAG [ON]",
    jetLagOff: "JET LAG [OFF]",
    statsStreak: "RACHA (DÍAS)",
    statsRate: "TASA ÉXITO (7D)",
    statsVolume: "DISTRIBUCIÓN DE CARGA MUSCULAR",
    syncOnline: "UPLINK [ON]",
    syncOffline: "UPLINK [OFF]",
    resetTitle: "CONFIRMAR PURGA",
    resetAction: "PURGAR",
    quietOn: "[MUDO]",
    quietOff: "[SONIDO]",
    analyticsTitle: "TELEMETRÍA",
    jetLagAlertTitle: "[BAJA ENERGÍA]:",
    jetLagAlertBody: "Modo Jet Lag activado. Series limitadas a 2. Ejecutar con precisión.",
    execution: "EJECUCIÓN",
    load: "CARGA [KG/LB]",
    pause: "[PAUSA]",
    play: "[PLAY]",
    progress: "PRG",
    active: "ACTV",
    days: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
  }
};

const App = () => {
  const [selectedProfile, setSelectedProfile] = useState(() => {
    try {
      const savedProfile = localStorage.getItem(GLOBAL_KEYS.selectedProfile);
      return PROFILES.some((profile) => profile.id === savedProfile) ? savedProfile : '';
    } catch {
      return '';
    }
  });
  const [activeTab, setActiveTab] = useState('home');
  const [jetLagMode, setJetLagMode] = useState(false);
  const [completedSets, setCompletedSets] = useState({});
  const [expandedInfo, setExpandedInfo] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [swappedExercises, setSwappedExercises] = useState({});
  const [weights, setWeights] = useState({}); 
  const [workoutHistory, setWorkoutHistory] = useState({});
  
  const [quietMode, setQuietMode] = useState(false);
  const [lang, setLang] = useState('pt');
  
  const [user, setUser] = useState(null);
  const [isSynced, setIsSynced] = useState(false);
  const hasLoadedCloudData = useRef(false);
  const activeProfileRef = useRef('');
  
  const currentDayIndex = (new Date().getDay() + 6) % 7;
  const [expandedDay, setExpandedDay] = useState(currentDayIndex);
  const [timer, setTimer] = useState({ active: false, time: 0, total: 60 });
  const t = translations[lang];
  const selectedProfileLabel = PROFILES.find((profile) => profile.id === selectedProfile)?.label || '';

  const theme = {
    name: 'Daily cockpit',
    concept: 'Today-first training execution with portable fallbacks, beginner cues, and low-friction progress logging.',
    bg: "bg-[#F4F0E8]",
    surface: "bg-[#FFFCF4]",
    border: "border-[#D7CDBB]",
    text: "text-[#171915]",
    muted: "text-[#686F62]",
    accent: "bg-[var(--accent)] text-[#FFFCF4]",
    navBg: "bg-[#FFFCF4]/92",
    inputBg: "bg-[#ECE5D8]",
    accentColor: '#2F6F5E',
    selection: "selection:bg-[var(--accent)] selection:text-white",
    shell: "font-body",
    pattern: "design-rally",
    container: "max-w-7xl mx-auto p-4 md:p-8 space-y-8",
    header: "border p-5 md:p-8 mb-6 shadow-[0_24px_80px_rgba(48,59,46,0.12)] rounded-[28px]",
    masthead: "grid lg:grid-cols-[1fr_420px] gap-8 items-center",
    title: "text-5xl md:text-7xl leading-[0.84] tracking-normal",
    nav: "sticky top-3 z-40 grid grid-cols-3 p-1 rounded-full shadow-[0_16px_50px_rgba(48,59,46,0.14)]",
    navButton: "py-3 px-2 rounded-full",
    dayList: "grid grid-cols-1 lg:grid-cols-2 gap-4",
    dayCard: "rounded-3xl overflow-hidden shadow-[0_14px_40px_rgba(48,59,46,0.08)]",
    dayButton: "p-5 md:p-6 flex items-center justify-between",
    exerciseCard: "p-4 md:p-5 rounded-2xl shadow-[0_12px_32px_rgba(48,59,46,0.08)]",
    tracker: "lg:w-60",
  };

  const getTodayDateString = () => getLocalDateString();

  const applyWorkoutData = useCallback((data) => {
    setCompletedSets(data.completedSets || {});
    setWeights(data.weights || {});
    setWorkoutHistory(data.workoutHistory || {});
    setSwappedExercises(data.swappedExercises || {});
  }, []);

  // --- SYNC & LOAD ---
  useEffect(() => {
    if (!firebaseInitialized) return;
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.warn("Offline auth fallback.", error.message);
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
    } catch {
      applyWorkoutData({
        completedSets: {},
        weights: {},
        workoutHistory: {},
        swappedExercises: {},
      });
    }
  }, [selectedProfile, applyWorkoutData]);

  useEffect(() => {
    if (!firebaseInitialized || !user || !selectedProfile) return;
    const profileId = selectedProfile;
    const userDocRef = doc(db, 'workout_profiles', profileId, 'app_data', 'workout_data');
    
    const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
      if (activeProfileRef.current !== profileId) return;
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!hasLoadedCloudData.current) {
          applyWorkoutData(data);
          hasLoadedCloudData.current = true;
          setIsSynced(true);
        }
      } else {
        const localProfileData = loadLocalProfileData(profileId);
        hasLoadedCloudData.current = true;
        setDoc(userDocRef, {
          profileId,
          ...localProfileData,
          lastUpdated: new Date().toISOString(),
        }, { merge: true }).then(() => setIsSynced(true)).catch(() => setIsSynced(false));
      }
    }, () => {
      setIsSynced(false);
    });
    return () => unsubscribeSnapshot();
  }, [user, selectedProfile, applyWorkoutData]);

  useEffect(() => {
    if (firebaseInitialized && user && selectedProfile && hasLoadedCloudData.current) {
      const profileId = selectedProfile;
      const userDocRef = doc(db, 'workout_profiles', profileId, 'app_data', 'workout_data');
      setDoc(userDocRef, {
        profileId, completedSets, weights, workoutHistory, swappedExercises, lastUpdated: new Date().toISOString()
      }, { merge: true }).then(() => setIsSynced(true)).catch(() => setIsSynced(false));
    }
  }, [completedSets, weights, workoutHistory, swappedExercises, user, selectedProfile]);

  useEffect(() => {
    try {
      const legacyJetLag = localStorage.getItem(LEGACY_KEYS.jetLag);
      const legacyQuiet = localStorage.getItem(LEGACY_KEYS.quiet);
      const legacyLang = localStorage.getItem(LEGACY_KEYS.lang);

      if (!localStorage.getItem(GLOBAL_KEYS.jetLag) && legacyJetLag !== null) {
        localStorage.setItem(GLOBAL_KEYS.jetLag, legacyJetLag);
      }
      if (!localStorage.getItem(GLOBAL_KEYS.quiet) && legacyQuiet !== null) {
        localStorage.setItem(GLOBAL_KEYS.quiet, legacyQuiet);
      }
      if (!localStorage.getItem(GLOBAL_KEYS.lang) && legacyLang !== null) {
        localStorage.setItem(GLOBAL_KEYS.lang, legacyLang);
      }

      setJetLagMode(readBoolStorage(GLOBAL_KEYS.jetLag, LEGACY_KEYS.jetLag));
      setQuietMode(readBoolStorage(GLOBAL_KEYS.quiet, LEGACY_KEYS.quiet));
      const savedLang = localStorage.getItem(GLOBAL_KEYS.lang);
      if (savedLang) setLang(savedLang);
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

  // --- AUDIO / TIMER ---
  const playAlert = useCallback(() => {
    if (quietMode) return;
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(t.voiceEnd);
      utterance.lang = lang === 'pt' ? 'pt-PT' : lang === 'en' ? 'en-US' : 'es-ES';
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    } else {
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
    }
  }, [quietMode, lang, t.voiceEnd]);

  useEffect(() => {
    let interval = null;
    if (timer.active && timer.time > 0) {
      interval = setInterval(() => {
        setTimer(prev => ({ ...prev, time: prev.time - 1 }));
      }, 1000);
    } else if (timer.time === 0 && timer.active) {
      setTimer(prev => ({ ...prev, active: false }));
      playAlert(); 
    }
    return () => clearInterval(interval);
  }, [timer.active, timer.time, playAlert]);

  const startRestTimer = (duration = 60) => {
    if (duration <= 0) return;
    if (!quietMode && 'speechSynthesis' in window && window.speechSynthesis.getVoices().length === 0) {
      const silentVoice = new SpeechSynthesisUtterance("");
      silentVoice.volume = 0;
      window.speechSynthesis.speak(silentVoice);
    }
    setTimer({ active: true, time: duration, total: duration });
  };

  const adjustTimer = (amount) => {
    setTimer(prev => {
      const newTime = Math.max(0, prev.time + amount);
      return { ...prev, time: newTime, total: Math.max(prev.total, newTime) };
    });
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // --- ACTIONS ---
  const resetProgress = () => {
    setCompletedSets({});
    setSwappedExercises({});
    setShowResetModal(false);
  };

  const toggleSet = (dayIndex, tab, exIndex, setIndex, restSeconds = 60) => {
    const key = `${dayIndex}-${tab}-${exIndex}-${setIndex}`;
    const todayStr = getTodayDateString();

    setCompletedSets(prev => {
      const isCurrentlyChecked = !!prev[key];
      const newState = { ...prev, [key]: !isCurrentlyChecked };
      if (!isCurrentlyChecked) startRestTimer(restSeconds);
      return newState;
    });

    setWorkoutHistory(prev => {
      const currentCount = prev[todayStr] || 0;
      const isChecked = !!completedSets[key];
      const newCount = Math.max(0, currentCount + (isChecked ? -1 : 1));
      return { ...prev, [todayStr]: newCount };
    });
  };

  const updateWeight = (dayIndex, tab, exIndex, value) => {
    const key = `${dayIndex}-${tab}-${exIndex}`;
    setWeights(prev => ({ ...prev, [key]: value }));
  };

  const getCompletedCount = (dayIndex, tab, exIndex, totalSets) => {
    let count = 0;
    for (let i = 0; i < totalSets; i++) {
      if (completedSets[`${dayIndex}-${tab}-${exIndex}-${i}`]) count++;
    }
    return count;
  };

  const toggleSwapExercise = (dayIndex, tab, exIndex) => {
    const key = `${dayIndex}-${tab}-${exIndex}`;
    setSwappedExercises(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const cycleLanguage = () => {
    const langs = ['pt', 'en', 'es'];
    const nextIdx = (langs.indexOf(lang) + 1) % langs.length;
    setLang(langs[nextIdx]);
  };

  // --- DATA ---
  const withMobility = (items, extended = false) => [
    ...items,
    { name: "Thoracic Bench Extensions", position: "Bench/Floor", desc: extended ? "4 min mobility" : "2 min mobility", sets: "1", reps: extended ? "4 min" : "2 min", rest: "0s", restSeconds: 0, category: "mobility", noWeight: true, instructions: "Kneel facing the bench with elbows on the pad and hands behind the head. Drop the chest toward the floor and breathe deeply into the lats and thoracic spine." },
    { name: "World's Greatest Stretch", position: "Floor", desc: extended ? "4 min mobility" : "2 min mobility", sets: "1", reps: extended ? "4 min" : "2 min", rest: "0s", restSeconds: 0, category: "mobility", noWeight: true, instructions: "Step into a deep lunge, place the opposite hand on the floor, reach the near-side hand to the instep, then rotate open toward the ceiling. Perform slow rotations on both sides." },
    { name: "90/90 Hip Switches", position: "Floor", desc: extended ? "4 min mobility" : "2 min mobility", sets: "1", reps: extended ? "4 min" : "2 min", rest: "0s", restSeconds: 0, category: "mobility", noWeight: true, instructions: "Sit tall with both knees bent at 90 degrees. Pivot on the heels to switch both knees side to side while keeping the torso upright." },
    { name: "Downward Dog to Cobra", position: "Floor", desc: extended ? "4 min mobility" : "2 min mobility", sets: "1", reps: extended ? "4 min" : "2 min", rest: "0s", restSeconds: 0, category: "mobility", noWeight: true, instructions: "Alternate between Downward Dog, pedaling out calves and hamstrings, and Cobra with hips on the floor, chest up, and neck neutral." },
    { name: "Progressive Seated Forward Fold", position: "Floor", desc: extended ? "10 min milestone" : "2 min milestone", sets: "1", reps: extended ? "10 min" : "2 min", rest: "0s", restSeconds: 0, category: "mobility", noWeight: true, instructions: "Sit tall with legs straight and toes pulled back. Hinge at the hips on each exhale, then gently round the upper back and aim the top of the head toward the knees." },
  ];

  const workoutData = [
    {
      day: "Segunda-feira", focus: "Push (Chest Focus) & Core", category: "push", session: "40m resistance + 10m mobility",
      home: withMobility([
        { name: "DB Bench Press", position: "Flat bench", desc: "Heavy strength", sets: "4", reps: "4-6", rest: "90s", restSeconds: 90, category: "push", instructions: "Use the heaviest controlled load. Plant long legs firmly, keep shoulder blades retracted, and press from a stable flat-bench base." },
        { name: "Incline DB Fly + Decline Push-Ups", position: "30 degree bench", desc: "Superset", sets: "3", reps: "8-12 + failure", rest: "60s", restSeconds: 60, category: "push", instructions: "Perform incline flys, immediately move to decline push-ups with feet on the flat bench, then rest. Keep flys controlled and push-ups crisp." },
        { name: "Weighted Bench Crunches", position: "Decline/flat bench", desc: "Core flexion", sets: "3", reps: "12-15", rest: "60s", restSeconds: 60, category: "core", instructions: "Hold one dumbbell at the chest. Control the descent and avoid hyperextending the lower back." },
        { name: "Hollow Body Holds", position: "Floor", desc: "Core brace", sets: "3", reps: "30-40s", rest: "45s", restSeconds: 45, category: "core", noWeight: true, instructions: "Press the lower back down, extend arms and legs only as far as you can hold a hard brace, and breathe behind the tension." },
      ]),
      hotel: withMobility([
        { name: "Incline Push-Ups", desc: "Hands elevated", sets: "4", reps: "8-15", rest: "75s", restSeconds: 75, category: "push", noWeight: true, instructions: "Use a bed, desk, or wall to match the day's heavy press intent. Lower under control and keep shoulder blades stable.", alt: { name: "Wall Push-Ups", desc: "Low fatigue", reps: "12-20", instructions: "Use a wall for lower-load pressing while preserving the same shoulder and trunk position." } },
        { name: "Feet-Elevated or Knee Push-Ups", desc: "Chest volume", sets: "3", reps: "Failure", rest: "60s", restSeconds: 60, category: "push", noWeight: true, instructions: "Choose feet-elevated if fresh or knee push-ups if fatigued. Stop with one clean rep in reserve." },
        { name: "Towel Chest Fly Isometrics", desc: "Chest squeeze", sets: "3", reps: "30-40s", rest: "45s", restSeconds: 45, category: "push", noWeight: true, instructions: "Pull a towel apart while squeezing the chest hard, then slowly pulse tension in and out." },
        { name: "Hollow Body Holds", desc: "Core brace", sets: "3", reps: "30-40s", rest: "45s", restSeconds: 45, category: "core", noWeight: true, instructions: "Keep the lower back pinned down and reduce limb length if the brace breaks." },
      ]),
    },
    {
      day: "Terça-feira", focus: "Legs (Quad Focus) & Core", category: "legs", session: "40m resistance + 10m mobility",
      home: withMobility([
        { name: "DB Goblet Squats", position: "Standing", desc: "Quad focus", sets: "4", reps: "8-12", rest: "90s", restSeconds: 90, category: "legs", instructions: "Hold one dumbbell at the chest. Elevate heels slightly on plates if ankle mobility restricts depth." },
        { name: "Bulgarian Split Squats", position: "Rear foot on flat bench", desc: "Single-leg strength", sets: "3", reps: "8-10/leg", rest: "60s", restSeconds: 60, category: "legs", instructions: "Lean the torso slightly forward, keep the front knee tracking over the toes, and use the bench only as rear-foot support." },
        { name: "DB Reverse Lunges", position: "Standing", desc: "Controlled lunge", sets: "3", reps: "10/leg", rest: "60s", restSeconds: 60, category: "legs", instructions: "Step back smoothly, keep the front foot rooted, and return without bouncing off the rear knee." },
        { name: "Forearm Plank with DB Pull-Throughs", position: "Floor", desc: "Anti-rotation core", sets: "3", reps: "10 pulls/side", rest: "45s", restSeconds: 45, category: "core", instructions: "Set a wide plank, drag the dumbbell across without letting hips rotate, and reset the brace between pulls." },
      ]),
      hotel: withMobility([
        { name: "Bodyweight Squats", desc: "Quad focus", sets: "4", reps: "15-20", rest: "75s", restSeconds: 75, category: "legs", noWeight: true, instructions: "Use a slow descent and full-foot pressure. Elevate heels on a book if it improves depth." },
        { name: "Bulgarian Split Squats", desc: "Rear foot on bed/chair", sets: "3", reps: "8-12/leg", rest: "60s", restSeconds: 60, category: "legs", noWeight: true, instructions: "Keep the front knee tracking and lean slightly forward to protect the knee while loading the glute." },
        { name: "Reverse Lunges", desc: "Travel legs", sets: "3", reps: "10-12/leg", rest: "60s", restSeconds: 60, category: "legs", noWeight: true, instructions: "Step back with control and keep the torso tall enough to maintain balance." },
        { name: "Forearm Plank Reach-Throughs", desc: "Anti-rotation core", sets: "3", reps: "10/side", rest: "45s", restSeconds: 45, category: "core", noWeight: true, instructions: "Reach one hand under the torso without rolling the hips, then return to a square plank." },
      ]),
    },
    {
      day: "Quarta-feira", focus: "Pull (Back Focus) & Core", category: "pull", session: "40m resistance + 10m mobility",
      home: withMobility([
        { name: "Chest-Supported DB Rows", position: "45 degree incline bench", desc: "Supported strength", sets: "4", reps: "6-8", rest: "90s", restSeconds: 90, category: "pull", instructions: "Lie face down on the incline bench to remove the lower back from the lift. Pull heavy with a stable chest support." },
        { name: "DB Pullovers + Chest-Supported Reverse Flys", position: "Flat + 45 degree bench", desc: "Superset", sets: "3", reps: "10-12 + 12-15", rest: "60s", restSeconds: 60, category: "pull", instructions: "Perform pullovers lying perpendicular across the flat bench, then move directly to reverse flys on the 45 degree bench before resting." },
        { name: "Dead Bugs", position: "Floor", desc: "Slow core control", sets: "3", reps: "12/side", rest: "45s", restSeconds: 45, category: "core", noWeight: true, instructions: "Move slowly and keep the lower back connected to the floor through every rep." },
      ]),
      hotel: withMobility([
        { name: "Towel Door Rows", desc: "Back strength", sets: "4", reps: "8-12", rest: "90s", restSeconds: 90, category: "pull", noWeight: true, instructions: "Anchor a towel securely around a closed door handle and row with a braced trunk. Use only a safe, solid setup.", alt: { name: "Bed Frame Rows", desc: "Back strength", reps: "8-12", instructions: "Use a stable bed frame only if it is safe and does not move." } },
        { name: "Prone Lat Pulls + Reverse Snow Angels", desc: "Back superset", sets: "3", reps: "12 + 12-15", rest: "60s", restSeconds: 60, category: "pull", noWeight: true, instructions: "On the floor, pull elbows toward ribs from overhead, then sweep arms through reverse snow angels." },
        { name: "Dead Bugs", desc: "Slow core control", sets: "3", reps: "12/side", rest: "45s", restSeconds: 45, category: "core", noWeight: true, instructions: "Keep the ribs down and lower back fixed to the floor." },
      ]),
    },
    {
      day: "Quinta-feira", focus: "Active Recovery & Deep Core", category: "recovery", session: "40m functional + 10m mobility",
      home: withMobility([
        { name: "Bodyweight Step-Ups", position: "Flat bench", desc: "Blood flow", sets: "3", reps: "15/leg", rest: "45s", restSeconds: 45, category: "recovery", noWeight: true, instructions: "Step onto the bench with control, stand tall at the top, and use a smooth descent." },
        { name: "Isometric Glute Bridges", position: "Shoulders on bench", desc: "Posterior chain hold", sets: "4", reps: "45s", rest: "45s", restSeconds: 45, category: "core", noWeight: true, instructions: "Drive through the heels, lock the ribs down, and hold the top position without arching the lower back." },
        { name: "Bird-Dogs", position: "Floor", desc: "Spinal control", sets: "3", reps: "10/side", rest: "30s", restSeconds: 30, category: "core", noWeight: true, instructions: "Reach long through the opposite arm and leg while keeping hips square." },
        { name: "Side Planks", position: "Floor", desc: "Lateral core", sets: "3", reps: "45s/side", rest: "30s", restSeconds: 30, category: "core", noWeight: true, instructions: "Stack shoulder, ribs, hips, and feet. Keep the waist lifted for the full hold." },
      ]),
      hotel: withMobility([
        { name: "Bodyweight Step-Ups", desc: "Chair/step", sets: "3", reps: "15/leg", rest: "45s", restSeconds: 45, category: "recovery", noWeight: true, instructions: "Use a stable chair, stair, or low platform. Keep the movement easy and controlled." },
        { name: "Isometric Glute Bridges", desc: "Floor hold", sets: "4", reps: "45s", rest: "45s", restSeconds: 45, category: "core", noWeight: true, instructions: "Hold the bridge from the floor if no bench is available, keeping ribs down and glutes active." },
        { name: "Bird-Dogs", desc: "Spinal control", sets: "3", reps: "10/side", rest: "30s", restSeconds: 30, category: "core", noWeight: true, instructions: "Move slowly and avoid shifting weight side to side." },
        { name: "Side Planks", desc: "Lateral core", sets: "3", reps: "45s/side", rest: "30s", restSeconds: 30, category: "core", noWeight: true, instructions: "Use knees down if needed to keep a clean line and steady breathing." },
      ]),
    },
    {
      day: "Sexta-feira", focus: "Shoulders & Arms & Core", category: "shouldersArmsCore", session: "40m resistance + 10m mobility",
      home: withMobility([
        { name: "Seated DB Overhead Press", position: "90 degree upright bench", desc: "Supported press", sets: "4", reps: "6-8", rest: "90s", restSeconds: 90, category: "shouldersArmsCore", instructions: "Keep the back pressed firmly into the pad and press without flaring the ribs." },
        { name: "DB Lateral Raises + DB Front Raises", position: "Standing", desc: "Shoulder superset", sets: "3", reps: "10-12 + 10-12", rest: "60s", restSeconds: 60, category: "shouldersArmsCore", instructions: "Perform lateral raises, immediately perform front raises, then rest. Use clean shoulder height reps." },
        { name: "DB Bicep Curls + DB Overhead Triceps Extension", position: "Standing/seated", desc: "Arms superset", sets: "3", reps: "8-12 + 8-12", rest: "60s", restSeconds: 60, category: "shouldersArmsCore", instructions: "Alternate curls, then sit for the overhead triceps extension. Keep elbows controlled in both movements." },
        { name: "Russian Twists", position: "Floor", desc: "Rotational core", sets: "3", reps: "20 twists", rest: "45s", restSeconds: 45, category: "core", instructions: "Hold one dumbbell, rotate through the trunk, and keep the motion controlled instead of bouncing." },
      ]),
      hotel: withMobility([
        { name: "Pike Push-Ups", desc: "Shoulder press", sets: "4", reps: "6-12", rest: "90s", restSeconds: 90, category: "shouldersArmsCore", noWeight: true, instructions: "Use a pike position to bias shoulders. Shorten the range if neck or wrist position degrades." },
        { name: "Arm Circles + Wall Front Raises", desc: "Shoulder superset", sets: "3", reps: "45s + 12", rest: "60s", restSeconds: 60, category: "shouldersArmsCore", noWeight: true, instructions: "Use small hard circles, then press the backs of the hands into the wall while raising arms." },
        { name: "Towel Bicep Curls + Wall Triceps Extensions", desc: "Arms superset", sets: "3", reps: "10-12 + 10-15", rest: "60s", restSeconds: 60, category: "shouldersArmsCore", noWeight: true, instructions: "Curl against towel resistance under the thigh, then do triceps extensions against a wall or desk edge." },
        { name: "Russian Twists", desc: "Rotational core", sets: "3", reps: "20 twists", rest: "45s", restSeconds: 45, category: "core", noWeight: true, instructions: "Rotate with control and keep the feet grounded if the lower back starts compensating." },
      ]),
    },
    {
      day: "Sábado", focus: "Legs (Glute/Ham Focus) & Core", category: "legs", session: "40m resistance + 10m mobility",
      home: withMobility([
        { name: "DB Romanian Deadlifts", position: "Standing", desc: "Hinge mechanics", sets: "4", reps: "8-10", rest: "90s", restSeconds: 90, category: "legs", instructions: "Push hips straight back, slide dumbbells down the thighs, and stop when hamstrings are fully stretched. Do not round the spine to go lower." },
        { name: "DB Hip Thrusts", position: "Upper back on bench", desc: "Glute strength", sets: "4", reps: "10-12", rest: "60s", restSeconds: 60, category: "legs", instructions: "Anchor the upper back on the bench, drive through the heels, and finish with glutes locked without lumbar extension." },
        { name: "Hamstring Walkouts", position: "Floor", desc: "Hamstring control", sets: "3", reps: "8 walkouts", rest: "45s", restSeconds: 45, category: "legs", noWeight: true, instructions: "Start in a bridge, walk heels out slowly, then return while keeping hips lifted." },
        { name: "Weighted Bench Crunches", position: "Decline bench", desc: "Core flexion", sets: "3", reps: "15", rest: "45s", restSeconds: 45, category: "core", instructions: "Hold one dumbbell at the chest and keep every rep controlled from top to bottom." },
      ]),
      hotel: withMobility([
        { name: "Single-Leg Romanian Deadlifts", desc: "Hinge control", sets: "4", reps: "8-10/leg", rest: "75s", restSeconds: 75, category: "legs", noWeight: true, instructions: "Use bodyweight or luggage if available. Hinge from the hip and keep the spine long." },
        { name: "Single-Leg Glute Bridges", desc: "Glute strength", sets: "4", reps: "10-12/leg", rest: "60s", restSeconds: 60, category: "legs", noWeight: true, instructions: "Drive through the heel and pause at the top without arching the back." },
        { name: "Hamstring Walkouts", desc: "Hamstring control", sets: "3", reps: "8 walkouts", rest: "45s", restSeconds: 45, category: "legs", noWeight: true, instructions: "Walk heels away from the hips slowly, then return with hips elevated." },
        { name: "Slow Crunches", desc: "Core flexion", sets: "3", reps: "15", rest: "45s", restSeconds: 45, category: "core", noWeight: true, instructions: "Move slowly and exhale through the top of every rep." },
      ]),
    },
    {
      day: "Domingo", focus: "Active Recovery & Mobility Focus", category: "recovery", session: "20m light flow + 30m mobility",
      home: withMobility([
        { name: "Light Bodyweight Flow", position: "Floor/standing", desc: "20 min relaxed pace", sets: "1", reps: "20 min", rest: "0s", restSeconds: 0, category: "recovery", noWeight: true, instructions: "Skip dumbbells. Move through unweighted squats, lunges, push-ups, and planks at a relaxed pace to encourage blood flow." },
      ], true),
      hotel: withMobility([
        { name: "Light Bodyweight Flow", desc: "20 min relaxed pace", sets: "1", reps: "20 min", rest: "0s", restSeconds: 0, category: "recovery", noWeight: true, instructions: "Use open floor space for unweighted squats, lunges, incline push-ups, and planks. Keep the pace restorative." },
      ], true),
    },
  ];

  const getDayProgress = (dayIndex) => {
    if (activeTab === 'analytics') return 0;
    const data = workoutData[dayIndex][activeTab];
    if(!data) return 0;
    let totalSets = 0;
    let completed = 0;
    data.forEach((ex, i) => {
      const numSets = jetLagMode ? Math.min(2, parseInt(ex.sets) || 1) : parseInt(ex.sets) || 1;
      totalSets += numSets;
      completed += getCompletedCount(dayIndex, activeTab, i, numSets);
    });
    return totalSets === 0 ? 0 : Math.round((completed / totalSets) * 100);
  };

  const getExpectedWeeklyUnits = () => workoutData.reduce((sum, dayData) => {
    const dayExercises = dayData[activeTab] || dayData.home || [];
    return sum + dayExercises.reduce((daySum, ex) => daySum + (parseInt(ex.sets) || 1), 0);
  }, 0);

  const calculateStreak = () => {
    let streak = 0;
    let curr = new Date();
    while(true) {
      const ds = getLocalDateString(curr);
      if (workoutHistory[ds] && workoutHistory[ds] > 0) {
        streak++;
        curr.setDate(curr.getDate() - 1);
      } else {
        if (streak === 0 && getTodayDateString() === ds) {
          curr.setDate(curr.getDate() - 1);
          const yestStr = getLocalDateString(curr);
          if (workoutHistory[yestStr] && workoutHistory[yestStr] > 0) {
            streak++;
            curr.setDate(curr.getDate() - 1);
            continue;
          }
        }
        break;
      }
    }
    return streak;
  };

  const calculateCompletionRate = () => {
    let totalCompleted = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = getLocalDateString(d);
      if (workoutHistory[ds] && workoutHistory[ds] > 0) {
        totalCompleted += workoutHistory[ds];
      }
    }
    const expectedSets = getExpectedWeeklyUnits();
    return Math.min(100, Math.round((totalCompleted / expectedSets) * 100));
  };

  const getVolumeData = () => {
    const vol = { push: 0, pull: 0, legs: 0, shouldersArmsCore: 0, recovery: 0 };
    Object.keys(completedSets).forEach(k => {
      if (completedSets[k]) {
        const [dayStr, tab, exStr] = k.split('-');
        const dayIdx = parseInt(dayStr);
        const exIdx = parseInt(exStr);
        const dayData = workoutData[dayIdx];
        const ex = dayData?.[tab]?.[exIdx];
        const category = ex?.category === 'core' || ex?.category === 'mobility' ? dayData?.category : ex?.category;
        if (category && vol[category] !== undefined) vol[category]++;
      }
    });
    return vol;
  };

  const last14Days = Array.from({length: 14}).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return getLocalDateString(d);
  });

  const getExerciseGuidance = (ex, baseEx) => {
    const name = ex.name.toLowerCase();
    const cues = [];
    const mistakes = [];
    const setup = [];

    if (name.includes('squat') || name.includes('lunge') || name.includes('split')) {
      cues.push('Full-foot pressure', 'Knee tracks over toes', 'Control the bottom');
      mistakes.push('Collapsing knees inward', 'Rushing the descent');
      setup.push('Clear floor space', 'Use a chair, wall, or bed edge for balance if needed');
    } else if (name.includes('press') || name.includes('push') || name.includes('fly')) {
      cues.push('Ribs down', 'Shoulders stable', 'Stop one clean rep before form breaks');
      mistakes.push('Shrugging into the neck', 'Flaring ribs to finish reps');
      setup.push('Set wrist angle first', 'Choose the incline that lets you move smoothly');
    } else if (name.includes('row') || name.includes('pull') || name.includes('angel')) {
      cues.push('Start with shoulder blades', 'Pull elbows toward ribs', 'Keep neck long');
      mistakes.push('Yanking with the arms', 'Losing trunk tension');
      setup.push('Test anchor stability before loading', 'Use a slower tempo when equipment is light');
    } else if (ex.category === 'core' || name.includes('plank') || name.includes('bug') || name.includes('hollow')) {
      cues.push('Exhale before effort', 'Lock ribs over pelvis', 'Scale range before losing brace');
      mistakes.push('Arching the lower back', 'Holding breath through the whole set');
      setup.push('Start easier than you think', 'End the set when the brace disappears');
    } else if (ex.category === 'mobility') {
      cues.push('Breathe slowly', 'Move without pain', 'Use exhale to increase range');
      mistakes.push('Forcing end range', 'Turning mobility into a max-effort stretch');
      setup.push('Keep it gentle after hard sets', 'Back off if you feel sharp pain or nerve symptoms');
    } else {
      cues.push('Move deliberately', 'Keep tension where intended', 'Leave one clean rep in reserve');
      mistakes.push('Chasing speed over control', 'Letting fatigue change the movement');
      setup.push('Check space and footing', 'Use the easiest version that feels repeatable today');
    }

    const progression = baseEx.noWeight
      ? 'Progress by adding clean reps, slower tempo, longer holds, or a harder variation.'
      : 'When all sets hit the top of the rep range with clean form, add the smallest load next time.';

    return { cues, mistakes, setup, progression };
  };

  const getWorkoutSummary = (dayIndex, tab = activeTab) => {
    const dayData = workoutData[dayIndex];
    const exercises = dayData?.[tab] || [];
    let totalSets = 0;
    let completed = 0;
    let nextExercise = null;

    exercises.forEach((ex, i) => {
      const numSets = jetLagMode ? Math.min(2, parseInt(ex.sets) || 1) : parseInt(ex.sets) || 1;
      const done = getCompletedCount(dayIndex, tab, i, numSets);
      totalSets += numSets;
      completed += done;
      if (!nextExercise && done < numSets) nextExercise = { ...ex, index: i, done, total: numSets };
    });

    return { totalSets, completed, nextExercise, exercises };
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800;900&family=JetBrains+Mono:wght@400;700;800&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap');
        .font-display { font-family: 'Archivo', sans-serif; letter-spacing: 0; }
        .font-body { font-family: 'Archivo', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        :root { --accent: ${theme.accentColor}; }
        .grain-overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 50; 
          opacity: 0.08;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }
        .design-rally { background-image: linear-gradient(120deg, rgba(47,111,94,0.08), transparent 34%), repeating-linear-gradient(90deg, rgba(23,25,21,0.035) 0 1px, transparent 1px 72px); }
        .neo-brutalism { border-width: 1px; transition: all 0.2s ease; }
        .neo-brutalism:active { transform: scale(0.98); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .proposal-panel { background: linear-gradient(135deg, rgba(47,111,94,0.12), rgba(205,91,66,0.08)); border-radius: 28px; }
        .safe-area-pad { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
      `}</style>
      
      <div className={`min-h-screen ${theme.bg} ${theme.text} ${theme.shell} ${theme.pattern} pb-40 transition-colors duration-300 relative ${theme.selection}`}>
        <div className="grain-overlay"></div>

        {!selectedProfile && (
          <div className={`min-h-screen ${theme.container} flex items-center justify-center relative z-10`}>
            <section className={`w-full max-w-2xl border-2 ${theme.border} ${theme.surface} p-6 md:p-10 shadow-[10px_10px_0_rgba(255,139,61,0.25)]`}>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--accent)] mb-3">
                {t.selectProfile}
              </p>
              <h1 className="font-display text-6xl md:text-8xl leading-[0.8] mb-8">
                HYBRID<br/><span className={theme.muted}>FIT</span>
              </h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PROFILES.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => setSelectedProfile(profile.id)}
                    className={`border-2 ${theme.border} p-6 text-left font-mono uppercase transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[#120B09]`}
                  >
                    <span className="block text-[10px] mb-2 opacity-70">PROFILE</span>
                    <strong className="font-display text-4xl leading-none">{profile.label}</strong>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {selectedProfile && (
        <>
        
        {showResetModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className={`${theme.surface} border-2 ${theme.border} p-8 max-w-sm w-full animate-in zoom-in-95`}>
              <h3 className="font-display text-3xl mb-2 text-[var(--accent)]">// {t.resetTitle}</h3>
              <p className={`font-mono text-xs ${theme.muted} mb-8 uppercase leading-relaxed`}>{t.reset}</p>
              <div className="flex gap-4 font-mono text-sm font-bold">
                <button onClick={() => setShowResetModal(false)} className={`flex-1 py-3 border-2 ${theme.border} hover:bg-[#27272A] uppercase`}>
                  {t.cancel}
                </button>
                <button onClick={resetProgress} className={`flex-1 py-3 border-2 border-red-500 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white uppercase`}>
                  {t.resetAction}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`${theme.container} relative z-10`}>
          
          <header className={`${theme.header} ${theme.border}`}>
            <div className={theme.masthead}>
              
              <div>
                <p className="font-mono text-[10px] text-[var(--accent)] tracking-[0.2em] mb-2 flex items-center gap-2">
                  <span>{t.subtitle}</span>
                  {firebaseInitialized && (
                    <span className={`px-1.5 py-0.5 border ${isSynced ? 'border-[var(--accent)]/50 text-[var(--accent)]' : 'border-red-500/50 text-red-500'}`}>
                      {isSynced ? t.syncOnline : t.syncOffline}
                    </span>
                  )}
                </p>
                <h1 className={`font-display ${theme.title}`}>
                  {t.title.split(' ')[0]}<br/>
                  <span className={theme.muted}>{t.title.split(' ').slice(1).join(' ')}</span>
                </h1>
              </div>

              <div className="w-full md:w-auto">
                {/* Heatmap (Consistência) */}
                <div className="flex items-center gap-3 mb-6 font-mono text-[10px] uppercase">
                  <span className={theme.muted}>LINK:</span>
                  <div className="flex gap-[2px]">
                    {last14Days.map((dateStr) => {
                      const count = workoutHistory[dateStr] || 0;
                      let colorClass = theme.inputBg;
                      if (count > 0 && count <= 5) colorClass = "bg-[var(--accent)]/30";
                      if (count > 5 && count <= 12) colorClass = "bg-[var(--accent)]/60";
                      if (count > 12) colorClass = "bg-[var(--accent)]";
                      
                      return (
                        <div key={dateStr} className={`w-3 h-4 ${colorClass}`}></div>
                      );
                    })}
                  </div>
                </div>

                {/* Controles */}
                <div className="flex flex-wrap gap-2 font-mono text-xs font-bold">
                  <button onClick={cycleLanguage} className={`px-3 py-2 border-2 ${theme.border} hover:${theme.text} uppercase`}>
                    [{lang}]
                  </button>
                  <button onClick={() => setQuietMode(!quietMode)} className={`px-3 py-2 border-2 ${theme.border} ${quietMode ? 'text-red-400 border-red-900' : ''}`}>
                    {quietMode ? t.quietOn : t.quietOff}
                  </button>
                  <button onClick={() => {
                    try {
                      localStorage.removeItem(GLOBAL_KEYS.selectedProfile);
                    } catch {
                      console.warn('Unable to clear selected profile.');
                    }
                    setSelectedProfile('');
                  }} className={`px-3 py-2 border-2 ${theme.border} uppercase`}>
                    [{selectedProfileLabel || t.changeProfile}]
                  </button>
                  <button onClick={() => setJetLagMode(!jetLagMode)} className={`px-4 py-2 border-2 flex items-center gap-2 ${jetLagMode ? 'border-[var(--accent)] text-[var(--accent)]' : theme.border}`}>
                    {jetLagMode ? t.jetLagOn : t.jetLagOff}
                  </button>
                  <button onClick={() => setShowResetModal(true)} className={`px-3 py-2 border-2 ${theme.border} text-red-500 hover:bg-red-500 hover:text-white`}>
                    [RST]
                  </button>
                </div>
              </div>

            </div>
          </header>

          {/* TABS CONTROLS */}
          <div className={`${theme.nav} border-2 ${theme.border} ${theme.navBg} backdrop-blur-md font-mono text-xs sm:text-sm font-bold uppercase`}>
            <button onClick={() => setActiveTab('home')} className={`${theme.navButton} text-center transition-colors ${activeTab === 'home' ? theme.accent : `hover:${theme.surface}`}`}>
              {t.home}
            </button>
            <button onClick={() => setActiveTab('hotel')} className={`${theme.navButton} text-center transition-colors border-l-2 border-r-2 md:border-l-0 md:border-r-0 ${theme.border} ${activeTab === 'hotel' ? theme.accent : `hover:${theme.surface}`}`}>
              {t.hotel}
            </button>
            <button onClick={() => setActiveTab('analytics')} className={`${theme.navButton} text-center transition-colors ${activeTab === 'analytics' ? theme.accent : `hover:${theme.surface}`}`}>
              {t.analytics}
            </button>
          </div>

          {activeTab !== 'analytics' && (() => {
            const todaySummary = getWorkoutSummary(currentDayIndex, activeTab);
            const next = todaySummary.nextExercise;
            return (
              <section className={`proposal-panel border ${theme.border} p-5 md:p-6 grid gap-5 lg:grid-cols-[1fr_360px] items-stretch mb-5`}>
                <div className="flex flex-col justify-between gap-5">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">Today cockpit</p>
                    <h2 className="font-display text-4xl md:text-6xl leading-[0.9] mt-2">
                      {workoutData[currentDayIndex].focus}
                    </h2>
                    <p className={`text-sm md:text-base leading-relaxed mt-3 max-w-2xl ${theme.muted}`}>
                      Start the planned 50-minute session, switch to hotel mode when traveling, or use Jet Lag mode to keep the habit alive with fewer sets.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setExpandedDay(currentDayIndex);
                        if (activeTab === 'analytics') setActiveTab('home');
                      }}
                      className="px-5 py-3 rounded-full bg-[#171915] text-white text-sm font-bold"
                    >
                      Start today
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab(activeTab === 'hotel' ? 'home' : 'hotel');
                        setExpandedDay(currentDayIndex);
                      }}
                      className={`px-5 py-3 rounded-full border ${theme.border} ${theme.surface} text-sm font-bold`}
                    >
                      {activeTab === 'hotel' ? 'Use home plan' : 'Use hotel plan'}
                    </button>
                    <button
                      onClick={() => setJetLagMode(!jetLagMode)}
                      className={`px-5 py-3 rounded-full border text-sm font-bold ${jetLagMode ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : `${theme.border} ${theme.surface}`}`}
                    >
                      {jetLagMode ? 'Low energy on' : 'Low energy'}
                    </button>
                  </div>
                </div>

                <div className={`${theme.surface} border ${theme.border} rounded-3xl p-4 grid gap-3`}>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className={`${theme.inputBg} rounded-2xl p-3`}>
                      <span className={`block font-mono text-[9px] uppercase ${theme.muted}`}>Today</span>
                      <strong className="text-2xl text-[var(--accent)]">{getDayProgress(currentDayIndex)}%</strong>
                    </div>
                    <div className={`${theme.inputBg} rounded-2xl p-3`}>
                      <span className={`block font-mono text-[9px] uppercase ${theme.muted}`}>Sets</span>
                      <strong className="text-2xl">{todaySummary.completed}/{todaySummary.totalSets}</strong>
                    </div>
                    <div className={`${theme.inputBg} rounded-2xl p-3`}>
                      <span className={`block font-mono text-[9px] uppercase ${theme.muted}`}>Streak</span>
                      <strong className="text-2xl">{calculateStreak()}</strong>
                    </div>
                  </div>

                  <div className={`${theme.inputBg} rounded-2xl p-4`}>
                    <p className={`font-mono text-[9px] uppercase tracking-[0.18em] ${theme.muted}`}>Next up</p>
                    <h3 className="font-display text-2xl mt-1">{next ? next.name : 'Session complete'}</h3>
                    <p className={`text-xs mt-2 ${theme.muted}`}>
                      {next ? `${next.done}/${next.total} sets done. ${next.desc}. Rest ${next.rest || 'as needed'}.` : 'Log is complete for today. Keep the streak clean.'}
                    </p>
                  </div>
                </div>
              </section>
            );
          })()}

          {activeTab === 'analytics' ? (
            <div className={`border-2 ${theme.border} p-6 md:p-12 animate-in fade-in`}>
              <h2 className="font-display text-4xl mb-8 border-b-2 border-dashed border-[var(--accent)] pb-2 inline-block">// {t.analyticsTitle}</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className={`border-2 ${theme.border} p-8 flex flex-col items-start`}>
                  <p className="font-mono text-[10px] text-[var(--accent)] mb-4">DATA.01</p>
                  <h3 className="font-display text-7xl leading-none">{calculateStreak()}</h3>
                  <p className={`font-mono text-xs mt-2 uppercase ${theme.muted}`}>{t.statsStreak}</p>
                </div>
                <div className={`border-2 ${theme.border} p-8 flex flex-col items-start`}>
                  <p className="font-mono text-[10px] text-[var(--accent)] mb-4">DATA.02</p>
                  <h3 className="font-display text-7xl leading-none">{calculateCompletionRate()}%</h3>
                  <p className={`font-mono text-xs mt-2 uppercase ${theme.muted}`}>{t.statsRate}</p>
                </div>
              </div>

              <div className={`border-2 ${theme.border} p-8`}>
                <h3 className="font-mono text-sm font-bold uppercase mb-6 flex justify-between">
                  <span>{t.statsVolume}</span>
                  <span className="text-[var(--accent)]">VOL: {Object.values(getVolumeData()).reduce((a,b)=>a+b,0)}</span>
                </h3>
                {(() => {
                  const vol = getVolumeData();
                  const total = Object.values(vol).reduce((a,b)=>a+b, 0) || 1; 
                  return (
                    <div className="space-y-6 font-mono text-xs">
                      <div>
                        <div className="flex justify-between mb-2"><span>PUSH</span><span>{Math.round((vol.push/total)*100)}%</span></div>
                        <div className={`h-1.5 w-full ${theme.inputBg}`}><div className="h-full bg-white dark:bg-zinc-300" style={{width:`${(vol.push/total)*100}%`}}></div></div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2"><span>PULL</span><span>{Math.round((vol.pull/total)*100)}%</span></div>
                        <div className={`h-1.5 w-full ${theme.inputBg}`}><div className="h-full bg-zinc-400 dark:bg-zinc-500" style={{width:`${(vol.pull/total)*100}%`}}></div></div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2"><span>LEGS</span><span>{Math.round((vol.legs/total)*100)}%</span></div>
                        <div className={`h-1.5 w-full ${theme.inputBg}`}><div className="h-full bg-zinc-600 dark:bg-zinc-700" style={{width:`${(vol.legs/total)*100}%`}}></div></div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2"><span>SHOULDERS // ARMS // CORE</span><span>{Math.round((vol.shouldersArmsCore/total)*100)}%</span></div>
                        <div className={`h-1.5 w-full ${theme.inputBg}`}><div className="h-full bg-[var(--accent)]" style={{width:`${(vol.shouldersArmsCore/total)*100}%`}}></div></div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2"><span>RECOVERY // MOBILITY</span><span>{Math.round((vol.recovery/total)*100)}%</span></div>
                        <div className={`h-1.5 w-full ${theme.inputBg}`}><div className="h-full bg-emerald-500" style={{width:`${(vol.recovery/total)*100}%`}}></div></div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          ) : (
            <section className={theme.dayList}>
              {workoutData.map((dayData, index) => {
                const isExpanded = expandedDay === index;
                const progress = getDayProgress(index);
                const isToday = currentDayIndex === index;

                return (
                  <div key={index} className={`border-2 transition-colors duration-300 ${theme.dayCard} ${isExpanded ? 'border-[var(--accent)]' : theme.border}`}>
                    <button 
                      onClick={() => setExpandedDay(isExpanded ? -1 : index)}
                      className={`w-full text-left ${theme.dayButton} ${theme.surface} hover:bg-[var(--accent)]/5 transition-colors`}
                    >
                      <div className="flex items-center gap-4 md:gap-6 flex-1">
                        <div className="font-mono text-xs font-bold w-6 text-center">
                          {isExpanded ? '[-]' : '[+]'}
                        </div>
                        <div className="flex-1 flex flex-col md:flex-row md:items-baseline md:gap-4">
                          <h2 className="font-display text-2xl md:text-3xl tracking-wide">{t.days[index] || dayData.day}</h2>
                          <div className="flex items-center gap-2 mt-1 md:mt-0 flex-wrap">
                            <span className={`font-mono text-[10px] font-bold uppercase ${theme.muted}`}>// {dayData.focus}</span>
                            <span className={`font-mono text-[9px] font-bold uppercase ${theme.muted}`}>[{dayData.session}]</span>
                            {isToday && <span className="bg-[var(--accent)] text-black text-[9px] px-1.5 py-0.5 font-bold font-mono">{t.active}</span>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="hidden md:flex flex-col items-end w-32 shrink-0 font-mono">
                        <span className={`text-[10px] mb-1 font-bold ${progress === 100 ? 'text-[var(--accent)]' : theme.text}`}>
                          {t.progress}: {progress}%
                        </span>
                        <div className={`w-full h-1 ${theme.inputBg}`}>
                          <div className="h-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    </button>

                    <div className={`md:hidden w-full h-0.5 ${theme.inputBg}`}>
                      <div className="h-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>

                    {isExpanded && (
                      <div className={`p-4 md:p-6 border-t-2 ${theme.border} ${theme.bg} animate-in slide-in-from-top-2 duration-300`}>
                        
                        {jetLagMode && (
                          <div className="mb-6 p-3 border-l-4 border-[var(--accent)] bg-[var(--accent)]/10 font-mono text-[10px] uppercase leading-relaxed">
                            <strong>{t.jetLagAlertTitle}</strong> {t.jetLagAlertBody}
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-6">
                          {dayData[activeTab].map((baseEx, i) => {
                            const isSwapped = swappedExercises[`${index}-${activeTab}-${i}`];
                            const ex = isSwapped && baseEx.alt ? baseEx.alt : baseEx;

                            const originalSets = parseInt(baseEx.sets) || 1;
                            const numSets = jetLagMode ? Math.min(2, originalSets) : originalSets;
                            const completedCount = getCompletedCount(index, activeTab, i, numSets);
                            const isInfoExpanded = expandedInfo === `${index}-${activeTab}-${i}`;
                            
                            const weightKey = `${index}-${activeTab}-${i}`;
                            const currentWeight = weights[weightKey] || '';
                            const isCompleted = completedCount === numSets;
                            const guidance = getExerciseGuidance(ex, baseEx);
                            
                            return (
                              <div key={i} className={`border-2 ${theme.exerciseCard} transition-colors ${isCompleted ? 'border-[var(--accent)]' : theme.border} ${theme.surface}`}>
                                
                                <div className="flex flex-col lg:flex-row gap-6">
                                  
                                  {/* EX INFO */}
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex items-baseline gap-2">
                                        <span className="font-mono text-[var(--accent)] font-bold text-sm">0{i + 1}</span>
                                        <h3 className="font-display text-2xl tracking-wide">{ex.name}</h3>
                                        {baseEx.alt && (
                                          <button onClick={() => toggleSwapExercise(index, activeTab, i)} className={`font-mono text-[10px] border px-1 hover:bg-white hover:text-black transition-colors ${theme.border}`} title="Alt">
                                            [SWAP]
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <p className={`font-mono text-[10px] uppercase ${theme.muted} mb-4 flex gap-3 flex-wrap`}>
                                      {ex.position && activeTab === 'home' && <span>LOC: {ex.position}</span>}
                                      <span>TGT: {ex.desc}</span>
                                      {ex.rest && <span>REST: {ex.rest}</span>}
                                    </p>
                                    
                                    <div className="flex items-center gap-3 font-mono text-[10px] font-bold flex-wrap">
                                      <span className={`px-2 py-1 border-2 ${theme.border}`}>S: {numSets}</span>
                                      <span className={`px-2 py-1 border-2 ${theme.border}`}>R: {baseEx.reps}</span>
                                      {ex.category === 'mobility' && <span className={`px-2 py-1 border-2 border-[var(--accent)] text-[var(--accent)]`}>MOBILITY</span>}
                                      <button onClick={() => setExpandedInfo(isInfoExpanded ? null : `${index}-${activeTab}-${i}`)} className={`px-2 py-1 border-2 transition-colors ${isInfoExpanded ? 'bg-white text-black border-white' : `${theme.border} hover:border-[var(--accent)]`}`}>
                                        [INFO]
                                      </button>
                                    </div>

                                    {isInfoExpanded && (
                                      <div className={`mt-4 p-4 rounded-2xl border border-[var(--accent)]/30 ${theme.inputBg} text-sm leading-relaxed animate-in fade-in`}>
                                        <p className="font-bold mb-3">{ex.instructions}</p>
                                        <div className="grid sm:grid-cols-3 gap-3">
                                          <div>
                                            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--accent)] mb-2">Cues</p>
                                            <ul className="space-y-1">
                                              {guidance.cues.map((cue) => <li key={cue}>{cue}</li>)}
                                            </ul>
                                          </div>
                                          <div>
                                            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--accent)] mb-2">Avoid</p>
                                            <ul className="space-y-1">
                                              {guidance.mistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}
                                            </ul>
                                          </div>
                                          <div>
                                            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--accent)] mb-2">Setup</p>
                                            <ul className="space-y-1">
                                              {guidance.setup.map((item) => <li key={item}>{item}</li>)}
                                            </ul>
                                          </div>
                                        </div>
                                        <p className={`mt-3 pt-3 border-t ${theme.border} text-xs ${theme.muted}`}>{guidance.progression}</p>
                                      </div>
                                    )}
                                  </div>

                                  {/* TRACKER & OVERLOAD */}
                                  <div className={`${theme.tracker} shrink-0 flex flex-col gap-4 border-t-2 lg:border-t-0 lg:border-l-2 border-dashed border-zinc-700 pt-4 lg:pt-0 lg:pl-6`}>
                                    
                                    <div>
                                      <div className="flex justify-between font-mono text-[10px] font-bold uppercase mb-2">
                                        <span className={theme.muted}>{t.execution}</span>
                                        <span className={isCompleted ? "text-[var(--accent)]" : ""}>{completedCount}/{numSets}</span>
                                      </div>
                                      <div className="flex gap-2">
                                        {Array.from({ length: numSets }).map((_, setIdx) => {
                                          const isChecked = completedSets[`${index}-${activeTab}-${i}-${setIdx}`];
                                          return (
                                            <button
                                              key={setIdx}
                                              onClick={() => toggleSet(index, activeTab, i, setIdx, ex.restSeconds ?? 60)}
                                              className={`h-8 flex-1 border-2 transition-all font-mono text-xs font-bold neo-brutalism ${isChecked ? 'bg-[var(--accent)] border-[var(--accent)] text-black translate-x-[2px] translate-y-[2px] shadow-none' : `${theme.surface} ${theme.border} hover:border-white text-transparent`}`}
                                            >
                                              X
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    {!ex.noWeight && (
                                    <div>
                                      <label className="font-mono text-[10px] font-bold uppercase mb-2 block text-zinc-500">
                                        {t.load}
                                      </label>
                                      <input 
                                        type="text" 
                                        value={currentWeight}
                                        onChange={(e) => updateWeight(index, activeTab, i, e.target.value)}
                                        placeholder="---" 
                                        className={`w-full h-8 ${theme.inputBg} border-2 ${theme.border} px-2 font-mono text-xs font-bold focus:outline-none focus:border-[var(--accent)] transition-colors uppercase`}
                                      />
                                    </div>
                                    )}

                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </div>

        {/* HUD TIMER (BOTTOM BAR) */}
        <div className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-500 ${timer.active ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className={`${theme.bg} border-t-2 ${theme.border} p-3 md:p-4 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.5)] relative`}>
            
            <div className="absolute top-0 left-0 h-0.5 bg-[var(--accent)] transition-all duration-1000 ease-linear" style={{ width: `${(timer.time / timer.total) * 100}%` }}></div>

            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 md:w-4 md:h-4 ${timer.time <= 10 && timer.time > 0 ? 'bg-red-500 animate-pulse' : 'bg-[var(--accent)]'}`}></div>
              <div>
                <p className="font-mono text-[8px] md:text-[10px] uppercase text-zinc-500 font-bold tracking-widest">{t.rest}</p>
                <p className="font-display text-2xl md:text-4xl leading-none">{formatTime(timer.time)}</p>
              </div>
            </div>

            <div className="flex gap-2 font-mono text-xs font-bold">
              <button onClick={() => adjustTimer(-15)} className={`hidden sm:block px-3 py-2 border-2 ${theme.border} hover:bg-white hover:text-black transition-colors`}>-15</button>
              <button onClick={() => adjustTimer(30)} className={`hidden sm:block px-3 py-2 border-2 ${theme.border} hover:bg-white hover:text-black transition-colors`}>+30</button>
              <button onClick={() => setTimer(prev => ({ ...prev, active: !prev.active }))} className={`px-4 py-2 border-2 transition-colors ${timer.active && timer.time > 0 ? 'border-amber-400 text-amber-400' : 'border-[var(--accent)] text-[var(--accent)]'}`}>
                {timer.active && timer.time > 0 ? t.pause : t.play}
              </button>
              <button onClick={() => setTimer({ active: false, time: 0, total: 60 })} className={`px-4 py-2 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors`}>
                [X]
              </button>
            </div>
          </div>
        </div>

        </>
        )}

      </div>
    </>
  );
};

export default App;
