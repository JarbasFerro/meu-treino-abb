import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- FIREBASE SETUP ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

let app, auth, db, appId;
let firebaseInitialized = false;

try {
  const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
  appId = typeof __app_id !== 'undefined' ? __app_id : 'abb-hybrid-fit';
  if (firebaseConfig && Object.keys(firebaseConfig).length > 0) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    firebaseInitialized = true;
  }
} catch (e) {
  console.warn("Firebase offline/local mode.", e);
}
// ----------------------

const translations = {
  pt: {
    title: "HYBRID FIT",
    subtitle: "PROTOCOLO DE TREINO // ABB",
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
    rest: "DESCANDO ATIVO",
    voiceEnd: "Ciclo de descanso terminado. Retomar protocolo.",
    jetLagOn: "JET LAG [ON]",
    jetLagOff: "JET LAG [OFF]",
    statsStreak: "OFENSIVA (DIAS)",
    statsRate: "TAXA DE SUCESSO (7D)",
    statsVolume: "DISTRIBUIÇÃO DE CARGA MUSCULAR",
    syncOnline: "UPLINK [ON]",
    syncOffline: "UPLINK [OFF]"
  },
  en: {
    title: "HYBRID FIT",
    subtitle: "TRAINING PROTOCOL // ABB",
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
    syncOffline: "UPLINK [OFF]"
  },
  es: {
    title: "HYBRID FIT",
    subtitle: "PROTOCOLO DE ENTRENAMIENTO // ABB",
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
    syncOffline: "UPLINK [OFF]"
  }
};

const App = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [jetLagMode, setJetLagMode] = useState(false);
  const [completedSets, setCompletedSets] = useState({});
  const [expandedInfo, setExpandedInfo] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [swappedExercises, setSwappedExercises] = useState({});
  const [weights, setWeights] = useState({}); 
  const [workoutHistory, setWorkoutHistory] = useState({});
  
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [quietMode, setQuietMode] = useState(false);
  const [lang, setLang] = useState('pt');
  
  const [user, setUser] = useState(null);
  const [isSynced, setIsSynced] = useState(false);
  const hasLoadedCloudData = useRef(false);
  
  const currentDayIndex = (new Date().getDay() + 6) % 7;
  const [expandedDay, setExpandedDay] = useState(currentDayIndex);
  const [timer, setTimer] = useState({ active: false, time: 0, total: 60 });
  const t = translations[lang];

  const getTodayDateString = () => new Date().toISOString().split('T')[0];

  // --- SYNC & LOAD ---
  useEffect(() => {
    if (!firebaseInitialized) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.warn("Offline auth fallback.", error.message);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseInitialized || !user) return;
    const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'app_data', 'workout_data');
    
    const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!hasLoadedCloudData.current) {
          if (data.completedSets) setCompletedSets(data.completedSets);
          if (data.weights) setWeights(data.weights);
          if (data.workoutHistory) setWorkoutHistory(data.workoutHistory);
          if (data.swappedExercises) setSwappedExercises(data.swappedExercises);
          hasLoadedCloudData.current = true;
          setIsSynced(true);
        }
      } else {
        hasLoadedCloudData.current = true;
      }
    }, (error) => {
      setIsSynced(false);
    });
    return () => unsubscribeSnapshot();
  }, [user]);

  useEffect(() => {
    if (firebaseInitialized && user && hasLoadedCloudData.current) {
      const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'app_data', 'workout_data');
      setDoc(userDocRef, {
        completedSets, weights, workoutHistory, swappedExercises, lastUpdated: new Date().toISOString()
      }, { merge: true }).then(() => setIsSynced(true)).catch(() => setIsSynced(false));
    }
  }, [completedSets, weights, workoutHistory, swappedExercises, user]);

  useEffect(() => {
    if (firebaseInitialized && hasLoadedCloudData.current) return;
    try {
      if (!hasLoadedCloudData.current) {
        const savedSets = localStorage.getItem('abbWorkoutProgress');
        if (savedSets) setCompletedSets(JSON.parse(savedSets));
        const savedWeights = localStorage.getItem('abbWeights');
        if (savedWeights) setWeights(JSON.parse(savedWeights));
        const savedHistory = localStorage.getItem('abbWorkoutHistory');
        if (savedHistory) setWorkoutHistory(JSON.parse(savedHistory));
        const savedSwaps = localStorage.getItem('abbSwappedExercises');
        if (savedSwaps) setSwappedExercises(JSON.parse(savedSwaps));
        hasLoadedCloudData.current = true; 
      }
      const savedJetLag = localStorage.getItem('abbJetLagMode');
      if (savedJetLag) setJetLagMode(savedJetLag === 'true');
      const savedQuiet = localStorage.getItem('abbQuietMode');
      if (savedQuiet) setQuietMode(savedQuiet === 'true');
      const savedLang = localStorage.getItem('abbLang');
      if (savedLang) setLang(savedLang);
      const savedTheme = localStorage.getItem('abbThemeMode');
      if (savedTheme !== null) setIsDarkMode(savedTheme === 'dark');
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('abbWorkoutProgress', JSON.stringify(completedSets));
      localStorage.setItem('abbWeights', JSON.stringify(weights));
      localStorage.setItem('abbWorkoutHistory', JSON.stringify(workoutHistory));
      localStorage.setItem('abbSwappedExercises', JSON.stringify(swappedExercises));
      localStorage.setItem('abbJetLagMode', jetLagMode.toString());
      localStorage.setItem('abbQuietMode', quietMode.toString());
      localStorage.setItem('abbLang', lang);
      localStorage.setItem('abbThemeMode', isDarkMode ? 'dark' : 'light');
    } catch (e) {}
  }, [completedSets, weights, workoutHistory, swappedExercises, jetLagMode, quietMode, lang, isDarkMode]);

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
      } catch (e) {}
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

  const startRestTimer = () => {
    if (!quietMode && 'speechSynthesis' in window && window.speechSynthesis.getVoices().length === 0) {
      const silentVoice = new SpeechSynthesisUtterance("");
      silentVoice.volume = 0;
      window.speechSynthesis.speak(silentVoice);
    }
    setTimer({ active: true, time: 60, total: 60 });
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

  const toggleSet = (dayIndex, tab, exIndex, setIndex) => {
    const key = `${dayIndex}-${tab}-${exIndex}-${setIndex}`;
    const todayStr = getTodayDateString();

    setCompletedSets(prev => {
      const isCurrentlyChecked = !!prev[key];
      const newState = { ...prev, [key]: !isCurrentlyChecked };
      if (!isCurrentlyChecked) startRestTimer();
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
  const workoutData = [
    {
      day: "Segunda-feira", focus: "Peito e Tríceps",
      home: [
        { name: "Flat Dumbbell Press", position: "Banco", desc: "Banco plano", sets: "4", reps: "10-12", instructions: "Deite no banco plano. Pressione os halteres para cima até estender os braços. Desça em 3 segundos.", alt: { name: "Floor Press", position: "Solo", desc: "No chão", instructions: "Deite no chão e faça o movimento de supino. Protege os ombros."} },
        { name: "Incline Dumbbell Press", position: "Banco", desc: "Banco 30-45°", sets: "4", reps: "10-12", instructions: "Incline o banco. Foque em alongar a parte superior do peito na descida. Controle o movimento.", alt: { name: "Reverse Grip Press", position: "Banco", desc: "Pegada invertida", instructions: "Faça o supino reto com a palma das mãos viradas para trás (em sua direção)."} },
        { name: "Flat Dumbbell Fly", position: "Banco", desc: "Crucifixo", sets: "3", reps: "10-12", instructions: "Braços levemente flexionados. Abra os braços como se fosse dar um abraço. Sinta o peitoral alongar.", alt: { name: "Pullovers Cruzados", position: "Banco", desc: "Foco central", instructions: "Aperte os dois halteres um contra o outro enquanto os sobe."} },
        { name: "Close-Grip Dumbbell Press", position: "Banco", desc: "Halteres juntos", sets: "3", reps: "10-12", instructions: "Mantenha os halteres colados no peito e empurre. Foco total em tríceps e parte interna do peito.", alt: { name: "Tate Press", position: "Banco", desc: "Cotovelos out", instructions: "Halteres no peito, empurre-os esticando os braços para fora e para cima."} },
        { name: "Overhead Triceps Ext.", position: "Banco", desc: "Tríceps Francês", sets: "3", reps: "10-12", instructions: "Sentado no banco, segure um halter atrás da cabeça com as duas mãos e estenda os braços para cima.", alt: { name: "Lying Triceps Ext", position: "Banco", desc: "Testa deitado", instructions: "Faça a extensão do tríceps deitado no banco, descendo os pesos até a testa."} }
      ],
      hotel: [
        { name: "Incline Push-ups", desc: "Mãos elevadas", sets: "4", reps: "Falha", instructions: "Mãos apoiadas na beira da cama ou mesa. O corpo inclinado reduz a carga nos braços.", alt: { name: "Wall Push-ups", desc: "Na parede", instructions: "Flexão em pé contra a parede. Excelente para dias de extrema fadiga."} },
        { name: "Knee Push-ups", desc: "Joelhos no chão", sets: "4", reps: "12-15", instructions: "Flexão apoiando os joelhos no chão. Mantenha o corpo em linha reta do joelho até a cabeça.", alt: { name: "Plank Hold", desc: "Prancha alta", instructions: "Mantenha a posição final da flexão (braços esticados) o máximo de tempo que aguentar."} },
        { name: "Push-up Negatives", desc: "Descida 5s", sets: "3", reps: "8-10", instructions: "Comece na posição de prancha. Desça o mais devagar possível (5 seg) até o chão.", alt: { name: "Shoulder Taps", desc: "Toque ombros", instructions: "Na posição de flexão, toque no ombro oposto mantendo o core estabilizado."} },
        { name: "Chair Dips (Bent Knees)", desc: "Mergulho base", sets: "3", reps: "12-15", instructions: "Mãos na beira da cama. Mantenha os joelhos dobrados a 90° e os pés no chão para ajudar a empurrar.", alt: { name: "Floor Dips", desc: "No chão", instructions: "Sente no chão, mãos atrás das costas, levante o quadril e dobre os cotovelos."} },
        { name: "Plank to Down-Dog", desc: "Mobilidade ombro", sets: "3", reps: "10", instructions: "Da posição de prancha, empurre o quadril para cima e para trás, alongando as costas e ativando os ombros.", alt: { name: "Child's Pose", desc: "Fluxo no solo", instructions: "Alterne entre alongar as costas sentado nos calcanhares e alongar o abdômen olhando para cima."} }
      ]
    },
    {
      day: "Terça-feira", focus: "Pernas e Core",
      home: [
        { name: "Goblet Squat", position: "Em pé", desc: "Halter no peito", sets: "4", reps: "10-12", instructions: "Segure o halter colado ao peito. Agache mantendo as costas retas.", alt: { name: "Front Squat", position: "Em pé", desc: "2 halteres", instructions: "Apoie um halter em cada ombro e agache. Mais carga para as pernas."} },
        { name: "Dumbbell Lunges", position: "Em pé", desc: "Passadas no lugar", sets: "4", reps: "10-12", instructions: "Dê um passo à frente e desça o joelho de trás em direção ao chão.", alt: { name: "Reverse Lunges", position: "Em pé", desc: "Passada atrás", instructions: "Dar o passo para trás tira a pressão dos joelhos e foca mais nos glúteos."} },
        { name: "Dumbbell Calf Raises", position: "Em pé", desc: "Panturrilhas em pé", sets: "3", reps: "12-15", instructions: "Segure os halteres e fique na ponta dos pés. Segure 1s no topo.", alt: { name: "Seated Calf Raises", position: "Banco", desc: "Sentado c/ peso", instructions: "Sente no banco, coloque os halteres sobre os joelhos e fique na ponta dos pés."} },
        { name: "Plank", position: "Solo", desc: "Prancha Abdominal", sets: "3", reps: "45s", instructions: "Apoie nos antebraços. Contraia glúteos e abdômen.", alt: { name: "Hollow Body", position: "Solo", desc: "Canoa isométrica", instructions: "Deite de barriga para cima, estique braços e pernas e levante-os levemente."} },
        { name: "Lying Leg Raises", position: "Banco", desc: "Elevação pernas", sets: "3", reps: "12-15", instructions: "Deitado no banco, levante as pernas esticadas até 90°. Desça devagar.", alt: { name: "Flutter Kicks", position: "Solo", desc: "Pernadas curtas", instructions: "Deitado, pernas esticadas ligeiramente acima do chão, movimentos curtos cima/baixo."} }
      ],
      hotel: [
        { name: "Bodyweight Squat", desc: "Agachamento livre", sets: "4", reps: "15-20", instructions: "Foque na profundidade e desça em 4s.", alt: { name: "Jump Squats", desc: "Com salto", instructions: "Agache e salte explosivamente."} },
        { name: "Reverse Lunges", desc: "Passada para trás", sets: "4", reps: "15-20", instructions: "Passo atrás. Exige menos dos joelhos.", alt: { name: "Side Lunges", desc: "Passada lateral", instructions: "Passo para o lado, foco em adutores."} },
        { name: "Single-Leg Calf Raises", desc: "Panturrilha uni", sets: "3", reps: "12-15", instructions: "Apoie-se na parede. Ponta de um pé só.", alt: { name: "Double Calf Raises", desc: "Lento bi", instructions: "Ambas as pernas, subida e descida em 4s."} },
        { name: "Plank", desc: "Prancha Abdominal", sets: "3", reps: "60s", instructions: "Postura o mais reta possível.", alt: { name: "Plank Jacks", desc: "Abre/Fecha pernas", instructions: "Na prancha, salte abrindo e fechando pernas."} },
        { name: "Mountain Climbers", desc: "Corrida prancha", sets: "3", reps: "45s", instructions: "Puxe os joelhos alternadamente.", alt: { name: "Slow Climbers", desc: "Passos lentos", instructions: "Puxe o joelho até o peito bem devagar, segure por 2s e troque."} }
      ]
    },
    {
      day: "Quarta-feira", focus: "Costas e Bíceps",
      home: [
        { name: "Single-Arm Row", position: "Banco", desc: "Remada uni", sets: "4", reps: "10-12", instructions: "Apoie mão/joelho. Puxe em direção ao quadril.", alt: { name: "Chest-Supported", position: "Banco", desc: "Peito apoiado", instructions: "Incline o banco a 45º, deite de bruços e faça a remada dupla."} },
        { name: "Dumbbell Pullover", position: "Banco", desc: "Deitado no banco", sets: "4", reps: "10-12", instructions: "Halter nas duas mãos. Desça para trás da cabeça.", alt: { name: "Renegade Row", position: "Solo", desc: "Prancha c/ remada", instructions: "Na posição de prancha segurando os halteres, puxe um de cada vez."} },
        { name: "Bent-Over Row", position: "Em pé", desc: "Remada curvada", sets: "3", reps: "10-12", instructions: "Incline o tronco para frente (45°).", alt: { name: "Reverse Fly", position: "Em pé", desc: "Crucifixo invert.", instructions: "Inclinado, abra os braços lateralmente."} },
        { name: "Alt Biceps Curl", position: "Em pé", desc: "Rosca direta", sets: "3", reps: "10-12", instructions: "Suba girando o pulso (palma para cima).", alt: { name: "Zottman Curl", position: "Em pé", desc: "Rotação no topo", instructions: "Suba palma cima, gire para baixo no topo e desça."} },
        { name: "Hammer Curls", position: "Em pé", desc: "Pegada neutra", sets: "3", reps: "10-12", instructions: "Segure como martelos.", alt: { name: "Cross-body Curl", position: "Em pé", desc: "Cruzando o peito", instructions: "Suba em direção ao ombro oposto."} }
      ],
      hotel: [
        { name: "Superman", desc: "Elevação lombar", sets: "4", reps: "15", instructions: "Deite de bruços. Levante braços/pernas.", alt: { name: "Aquaman", desc: "Alternado", instructions: "Elevações rápidas de braço/perna opostos."} },
        { name: "Y-W-T Raises", desc: "Movimentos bruços", sets: "4", reps: "12", instructions: "Desenhe as letras Y, W e T no ar.", alt: { name: "Prone Lat Pulldown", desc: "Puxada solo", instructions: "Estique braços à frente e puxe cotovelos para trás."} },
        { name: "Towel Door Row", desc: "Remada toalha", sets: "3", reps: "12-15", instructions: "Prenda toalha na maçaneta e puxe-se.", alt: { name: "Bed Frame Row", desc: "Puxada cama", instructions: "Deite debaixo da beira da cama, segure a borda e puxe-se para cima."} },
        { name: "Reverse Snow Angels", desc: "Bruços no chão", sets: "3", reps: "15", instructions: "Mova os braços da frente da cabeça até o quadril.", alt: { name: "Cobra Pose Hold", desc: "Isometria", instructions: "Eleve o peito empurrando com as mãos e sustente."} },
        { name: "Biceps Isometric", desc: "Mão contra mão", sets: "3", reps: "30s", instructions: "Um braço tenta fazer rosca, o outro impede.", alt: { name: "Under-Leg Curl", desc: "Puxar a perna", instructions: "Passe as mãos sob a coxa e tente puxá-la para cima."} }
      ]
    },
    {
      day: "Quinta-feira", focus: "Ombros e Core",
      home: [
        { name: "Seated Press", position: "Banco", desc: "Desenvolvimento", sets: "4", reps: "10-12", instructions: "Banco 90°. Empurre os halteres para cima.", alt: { name: "Arnold Press", position: "Banco", desc: "Giro na subida", instructions: "Comece palmas para o rosto e gire-as para fora ao empurrar."} },
        { name: "Lateral Raises", position: "Em pé", desc: "Elevação lateral", sets: "4", reps: "10-12", instructions: "Suba braços até a altura dos ombros.", alt: { name: "Leaning Lateral", position: "Em pé", desc: "Inclinado uni", instructions: "Incline o corpo segurando-se numa parede, elevação com 1 braço."} },
        { name: "Front Raises", position: "Em pé", desc: "Elevação frontal", sets: "3", reps: "10-12", instructions: "Levante um halter de cada vez à frente.", alt: { name: "Upright Row", position: "Em pé", desc: "Remada alta", instructions: "Puxe halteres rente ao corpo até o peito."} },
        { name: "Russian Twist", position: "Solo", desc: "Giro de tronco", sets: "3", reps: "20", instructions: "Gire o tronco segurando 1 halter.", alt: { name: "Weighted Sit-Ups", position: "Solo", desc: "Abdominal", instructions: "Abdominal clássico segurando um halter."} },
        { name: "Side Plank", position: "Solo", desc: "Prancha lateral", sets: "3", reps: "30s/lado", instructions: "Apoie num antebraço. Forme uma linha reta.", alt: { name: "Side Plank Dips", position: "Solo", desc: "Descer quadril", instructions: "Desça o quadril até quase tocar o chão e suba."} }
      ],
      hotel: [
        { name: "Pike Push-ups", desc: "Flexão em V", sets: "4", reps: "Falha", instructions: "Quadril para cima. Desça a cabeça.", alt: { name: "Wall Walk", desc: "Andar na parede", instructions: "Pés na parede, ande com as mãos para trás."} },
        { name: "Wall Isometrics", desc: "Empurrar parede", sets: "4", reps: "30s", instructions: "Tente levantar o braço lateralmente empurrando a parede.", alt: { name: "Doorway Press", desc: "Batente porta", instructions: "Tente empurrar os lados do batente para fora."} },
        { name: "Arm Circles", desc: "Giros de braço", sets: "3", reps: "60s", instructions: "Círculos pequenos e rápidos.", alt: { name: "Pike Hold", desc: "Isometria em V", instructions: "Mantenha a posição de Pike empurrando o chão."} },
        { name: "Russian Twist", desc: "Sem peso", sets: "3", reps: "20", instructions: "Cruze as mãos e rotacione a coluna.", alt: { name: "Windshield Wipers", desc: "Limpador", instructions: "Pernas juntas para o ar, gire para os lados."} },
        { name: "Side Plank", desc: "Prancha lateral", sets: "3", reps: "30s/lado", instructions: "Mantenha o quadril bem elevado.", alt: { name: "Star Plank", desc: "Estrela", instructions: "Eleve a perna e o braço de cima."} }
      ]
    },
    {
      day: "Sexta-feira", focus: "Braços",
      home: [
        { name: "Skull Crushers", position: "Banco", desc: "Tríceps Testa", sets: "4", reps: "10-12", instructions: "Desça os halteres em direção às orelhas.", alt: { name: "Overhead Ext", position: "Banco", desc: "Extensão sentada", instructions: "Desça 1 halter pesado atrás da cabeça com duas mãos."} },
        { name: "Concentration", position: "Banco", desc: "Rosca conc.", sets: "4", reps: "10-12", instructions: "Apoie o cotovelo na parte interna da coxa.", alt: { name: "Incline Curls", position: "Banco", desc: "Banco inclinado", instructions: "Banco 45º. Deixe os braços pendurados."} },
        { name: "Triceps Kickbacks", position: "Em pé", desc: "Tríceps Coice", sets: "3", reps: "10-12", instructions: "Tronco inclinado, estenda o braço para trás.", alt: { name: "Diamond Press", position: "Banco", desc: "Supino fechado", instructions: "Halteres colados no peito, supino para tríceps."} },
        { name: "Reverse Grip Curl", position: "Em pé", desc: "Pegada invertida", sets: "3", reps: "10-12", instructions: "Palma das mãos voltadas para baixo.", alt: { name: "Wrist Curls", position: "Banco", desc: "Rosca punho", instructions: "Flexão apenas do punho com halteres leves."} },
        { name: "Farmer's Walk", position: "Em pé", desc: "Caminhada peso", sets: "3", reps: "60s", instructions: "Segure halteres pesados e caminhe.", alt: { name: "Shrugs", position: "Em pé", desc: "Encolhimento", instructions: "Encolha os ombros em direção às orelhas."} }
      ],
      hotel: [
        { name: "Close-Grip Push-up", desc: "Joelhos, fechado", sets: "4", reps: "Falha", instructions: "Mãos coladas no corpo. Foco tríceps.", alt: { name: "Diamond Push", desc: "Mãos diamante", instructions: "Mãos unidas formando um triângulo."} },
        { name: "Chair Dips", desc: "Mergulho", sets: "4", reps: "12-15", instructions: "Usando a força dos tríceps para subir.", alt: { name: "Triceps Ext.", desc: "Na parede", instructions: "Mãos na parede, deixe cotovelos tocarem e empurre."} },
        { name: "Towel Bicep Curls", desc: "Puxar toalha", sets: "3", reps: "12-15", instructions: "Toalha sob a coxa, puxe a perna para cima.", alt: { name: "Suitcase Hold", desc: "Mala pesada", instructions: "Rosca isométrica usando mala de viagem."} },
        { name: "Wall Triceps", desc: "Na parede", sets: "3", reps: "15", instructions: "Mãos na altura dos olhos, empurre o corpo.", alt: { name: "Plank Push", desc: "Sobe e desce", instructions: "Da prancha de antebraços para mãos."} },
        { name: "Plank", desc: "Prancha final", sets: "3", reps: "Falha", instructions: "Prancha isométrica até falhar.", alt: { name: "Hollow Hold", desc: "Canoa", instructions: "Manter abdômen travado formato U."} }
      ]
    },
    {
      day: "Sábado", focus: "Pernas e Core",
      home: [
        { name: "RDL", position: "Em pé", desc: "Terra Romeno", sets: "4", reps: "10-12", instructions: "Pernas semi-retas. Sinta repuxar atrás.", alt: { name: "Stiff-Leg", position: "Em pé", desc: "Pernas duras", instructions: "Pernas ainda mais retas que o RDL."} },
        { name: "Sumo Squat", position: "Em pé", desc: "Afastadas", sets: "4", reps: "10-12", instructions: "Pernas bem abertas. 1 halter no meio.", alt: { name: "Bulgarian", position: "Banco", desc: "Agachamento búlgaro", instructions: "Apoie o peito do pé no banco atrás."} },
        { name: "Glute Bridge", position: "Solo", desc: "Ponte com peso", sets: "3", reps: "12-15", instructions: "Halter no quadril, eleve apertando glúteos.", alt: { name: "Hip Thrust", position: "Banco", desc: "Elevação pélvica", instructions: "Costas no banco, eleve quadril."} },
        { name: "Crunches", position: "Solo", desc: "Abdominal curto", sets: "3", reps: "15-20", instructions: "Pés no banco, suba escápulas.", alt: { name: "V-Ups", position: "Solo", desc: "Canivete", instructions: "Eleve pernas e braços esticados ao mesmo tempo."} },
        { name: "Plank Taps", position: "Solo", desc: "Toques no ombro", sets: "3", reps: "20", instructions: "Toque ombro oposto na prancha alta.", alt: { name: "Spiderman", position: "Solo", desc: "Prancha aranha", instructions: "Joelho no cotovelo do mesmo lado."} }
      ],
      hotel: [
        { name: "Bulgarian Split", desc: "1 pé na cama", sets: "4", reps: "10-12", instructions: "Agache com a perna da frente.", alt: { name: "Step-Ups", desc: "Subida", instructions: "Suba com uma perna numa cadeira."} },
        { name: "Sumo Squat", desc: "Agachamento sumô", sets: "4", reps: "15-20", instructions: "Desça em 4s e suba em 2s.", alt: { name: "Pistol Squat", desc: "1 perna", instructions: "Agache com 1 perna apoiado na porta."} },
        { name: "Glute Bridge", desc: "Elevação pélvica", sets: "3", reps: "15-20", instructions: "Eleve o quadril do chão.", alt: { name: "Single-Leg Bridge", desc: "Unilateral", instructions: "Ponte com uma perna estendida para cima."} },
        { name: "Bicycle Crunches", desc: "Bicicleta", sets: "3", reps: "20", instructions: "Cotovelo no joelho oposto.", alt: { name: "Reverse Crunches", desc: "Reverso", instructions: "Traga os joelhos em direção ao peito."} },
        { name: "Plank Taps", desc: "Toques no ombro", sets: "3", reps: "20", instructions: "Afaste pés para dar mais equilíbrio.", alt: { name: "Commandos", desc: "Sobe/Desce", instructions: "Alterne prancha de braços e mãos."} }
      ]
    },
    {
      day: "Domingo", focus: "Recuperação",
      home: [
        { name: "Stretching", position: "Em pé", desc: "Dinâmico", sets: "1", reps: "10m", instructions: "Torções de tronco, alongue pernas.", alt: { name: "Yoga Flow", position: "Solo", desc: "Fluxo", instructions: "Movimentos intuitivos profundos."} },
        { name: "Cat-Cow", position: "Solo", desc: "Coluna", sets: "3", reps: "12", instructions: "Arquear costas e descer barriga.", alt: { name: "Rotations", position: "Solo", desc: "Giro coluna", instructions: "Gire o peito em direção ao teto."} },
        { name: "Bird-Dog", position: "Solo", desc: "Perdigueiro", sets: "3", reps: "10/ld", instructions: "Braço e perna opostos estendidos.", alt: { name: "Kickbacks", position: "Solo", desc: "Coice glúteos", instructions: "Estenda apenas a perna para trás."} },
        { name: "Dead Bug", position: "Solo", desc: "Inseto morto", sets: "3", reps: "12", instructions: "Braço e perna opostos até o chão.", alt: { name: "Heel Taps", position: "Solo", desc: "Toque calc.", instructions: "Pernas 90°, toque calcanhar no chão."} },
        { name: "Light Plank", position: "Solo", desc: "Prancha leve", sets: "3", reps: "30s", instructions: "Ativar corpo antes do descanso.", alt: { name: "Child's Pose", position: "Solo", desc: "Relaxamento", instructions: "Sente nos calcanhares com braços à frente."} }
      ],
      hotel: [
        { name: "Stretching", desc: "Dinâmico", sets: "1", reps: "10m", instructions: "Torções de tronco, alongamentos fluidos.", alt: { name: "Yoga Flow", desc: "Fluxo livre", instructions: "Movimentos intuitivos profundos."} },
        { name: "Cat-Cow", desc: "Coluna", sets: "3", reps: "12", instructions: "Arquear costas para alívio lombar.", alt: { name: "Rotations", desc: "Giro coluna", instructions: "Gire o peito em direção ao teto."} },
        { name: "Bird-Dog", desc: "Perdigueiro", sets: "3", reps: "10/ld", instructions: "Foca no controle, não velocidade.", alt: { name: "Kickbacks", desc: "Coice glúteos", instructions: "Estenda apenas a perna para trás."} },
        { name: "Dead Bug", desc: "Inseto", sets: "3", reps: "12", instructions: "Lombar não pode descolar do chão.", alt: { name: "Heel Taps", desc: "Toque calc.", instructions: "Pernas 90°, toque calcanhar no chão."} },
        { name: "Light Plank", desc: "Prancha leve", sets: "3", reps: "30s", instructions: "Ativação core rápida.", alt: { name: "Child's Pose", desc: "Relaxamento", instructions: "Sente nos calcanhares com braços à frente."} }
      ]
    }
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

  const calculateStreak = () => {
    let streak = 0;
    let curr = new Date();
    while(true) {
      const ds = curr.toISOString().split('T')[0];
      if (workoutHistory[ds] && workoutHistory[ds] > 0) {
        streak++;
        curr.setDate(curr.getDate() - 1);
      } else {
        if (streak === 0 && getTodayDateString() === ds) {
          curr.setDate(curr.getDate() - 1);
          const yestStr = curr.toISOString().split('T')[0];
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
      const ds = d.toISOString().split('T')[0];
      if (workoutHistory[ds] && workoutHistory[ds] > 0) {
        totalCompleted += workoutHistory[ds];
      }
    }
    const expectedSets = 7 * 16; 
    return Math.min(100, Math.round((totalCompleted / expectedSets) * 100));
  };

  const getVolumeData = () => {
    const vol = { peitoTri: 0, costasBi: 0, pernas: 0, ombrosCore: 0 };
    Object.keys(completedSets).forEach(k => {
      if (completedSets[k]) {
        const [dayStr] = k.split('-');
        const dayIdx = parseInt(dayStr);
        if(dayIdx === 0 || dayIdx === 4) vol.peitoTri++; 
        else if(dayIdx === 2) vol.costasBi++; 
        else if(dayIdx === 1 || dayIdx === 5) vol.pernas++; 
        else if(dayIdx === 3 || dayIdx === 6) vol.ombrosCore++; 
      }
    });
    return vol;
  };

  const last14Days = Array.from({length: 14}).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split('T')[0];
  });

  // Base Theme Classes (Tactical Brutalism)
  const theme = {
    bg: isDarkMode ? "bg-[#09090B]" : "bg-[#F4F4F5]",
    surface: isDarkMode ? "bg-[#18181B]" : "bg-[#FFFFFF]",
    border: isDarkMode ? "border-[#27272A]" : "border-[#E4E4E7]",
    text: isDarkMode ? "text-[#FAFAFA]" : "text-[#18181B]",
    muted: isDarkMode ? "text-[#A1A1AA]" : "text-[#71717A]",
    accent: "bg-[#CCFF00] text-black", // Cyber Yellow / Neon Lime
    accentHover: "hover:bg-[#A3CC00]",
    accentBorder: "border-[#CCFF00]",
    navBg: isDarkMode ? "bg-[#09090B]/80" : "bg-[#F4F4F5]/80",
    inputBg: isDarkMode ? "bg-[#27272A]" : "bg-[#E4E4E7]"
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;700;800&family=Syne:wght@400;600;700;800&display=swap');
        .font-display { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.05em; }
        .font-body { font-family: 'Syne', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .grain-overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 50; 
          opacity: ${isDarkMode ? 0.04 : 0.08};
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }
        .neo-brutalism { border-width: 2px; box-shadow: 4px 4px 0px 0px currentColor; transition: all 0.2s ease; }
        .neo-brutalism:active { transform: translate(2px, 2px); box-shadow: 0px 0px 0px 0px currentColor; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
      
      <div className={`min-h-screen ${theme.bg} ${theme.text} font-body pb-32 transition-colors duration-300 relative selection:bg-[#CCFF00] selection:text-black`}>
        <div className="grain-overlay"></div>
        
        {showResetModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className={`${theme.surface} border-2 ${theme.border} p-8 max-w-sm w-full animate-in zoom-in-95`}>
              <h3 className="font-display text-3xl mb-2 text-[#CCFF00]">// CONFIRMAR PURGA</h3>
              <p className={`font-mono text-xs ${theme.muted} mb-8 uppercase leading-relaxed`}>{t.reset}</p>
              <div className="flex gap-4 font-mono text-sm font-bold">
                <button onClick={() => setShowResetModal(false)} className={`flex-1 py-3 border-2 ${theme.border} hover:bg-[#27272A] uppercase`}>
                  {t.cancel}
                </button>
                <button onClick={resetProgress} className={`flex-1 py-3 border-2 border-red-500 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white uppercase`}>
                  Purga
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 relative z-10">
          
          <header className={`border-b-2 ${theme.border} pb-8 mb-8`}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              
              <div>
                <p className="font-mono text-[10px] text-[#CCFF00] tracking-[0.2em] mb-2 flex items-center gap-2">
                  <span>{t.subtitle}</span>
                  {firebaseInitialized && (
                    <span className={`px-1.5 py-0.5 border ${isSynced ? 'border-[#CCFF00]/50 text-[#CCFF00]' : 'border-red-500/50 text-red-500'}`}>
                      {isSynced ? t.syncOnline : t.syncOffline}
                    </span>
                  )}
                </p>
                <h1 className="font-display text-6xl md:text-8xl leading-[0.8] tracking-tighter">
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
                      let colorClass = isDarkMode ? "bg-[#27272A]" : "bg-[#E4E4E7]";
                      if (count > 0 && count <= 5) colorClass = "bg-[#CCFF00]/30";
                      if (count > 5 && count <= 12) colorClass = "bg-[#CCFF00]/60";
                      if (count > 12) colorClass = "bg-[#CCFF00]";
                      
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
                    {quietMode ? '[MUDO]' : '[SOM]'}
                  </button>
                  <button onClick={() => setIsDarkMode(!isDarkMode)} className={`px-3 py-2 border-2 ${theme.border}`}>
                    {isDarkMode ? '[LUZ]' : '[SOMBRA]'}
                  </button>
                  <button onClick={() => setJetLagMode(!jetLagMode)} className={`px-4 py-2 border-2 flex items-center gap-2 ${jetLagMode ? 'border-[#CCFF00] text-[#CCFF00]' : theme.border}`}>
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
          <div className={`sticky top-4 z-40 flex border-2 ${theme.border} ${theme.navBg} backdrop-blur-md p-1 font-mono text-xs sm:text-sm font-bold uppercase`}>
            <button onClick={() => setActiveTab('home')} className={`flex-1 py-3 px-2 text-center transition-colors ${activeTab === 'home' ? theme.accent : `hover:${theme.surface}`}`}>
              {t.home}
            </button>
            <button onClick={() => setActiveTab('hotel')} className={`flex-1 py-3 px-2 text-center transition-colors border-l-2 border-r-2 ${theme.border} ${activeTab === 'hotel' ? theme.accent : `hover:${theme.surface}`}`}>
              {t.hotel}
            </button>
            <button onClick={() => setActiveTab('analytics')} className={`flex-1 py-3 px-2 text-center transition-colors ${activeTab === 'analytics' ? theme.accent : `hover:${theme.surface}`}`}>
              {t.analytics}
            </button>
          </div>

          {activeTab === 'analytics' ? (
            <div className={`border-2 ${theme.border} p-6 md:p-12 animate-in fade-in`}>
              <h2 className="font-display text-4xl mb-8 border-b-2 border-dashed border-[#CCFF00] pb-2 inline-block">// TELEMETRIA</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className={`border-2 ${theme.border} p-8 flex flex-col items-start`}>
                  <p className="font-mono text-[10px] text-[#CCFF00] mb-4">DATA.01</p>
                  <h3 className="font-display text-7xl leading-none">{calculateStreak()}</h3>
                  <p className={`font-mono text-xs mt-2 uppercase ${theme.muted}`}>{t.statsStreak}</p>
                </div>
                <div className={`border-2 ${theme.border} p-8 flex flex-col items-start`}>
                  <p className="font-mono text-[10px] text-[#CCFF00] mb-4">DATA.02</p>
                  <h3 className="font-display text-7xl leading-none">{calculateCompletionRate()}%</h3>
                  <p className={`font-mono text-xs mt-2 uppercase ${theme.muted}`}>{t.statsRate}</p>
                </div>
              </div>

              <div className={`border-2 ${theme.border} p-8`}>
                <h3 className="font-mono text-sm font-bold uppercase mb-6 flex justify-between">
                  <span>{t.statsVolume}</span>
                  <span className="text-[#CCFF00]">VOL: {Object.values(getVolumeData()).reduce((a,b)=>a+b,0)}</span>
                </h3>
                {(() => {
                  const vol = getVolumeData();
                  const total = Object.values(vol).reduce((a,b)=>a+b, 0) || 1; 
                  return (
                    <div className="space-y-6 font-mono text-xs">
                      <div>
                        <div className="flex justify-between mb-2"><span>PEITO // TRÍCEPS</span><span>{Math.round((vol.peitoTri/total)*100)}%</span></div>
                        <div className={`h-1.5 w-full ${theme.inputBg}`}><div className="h-full bg-white dark:bg-zinc-300" style={{width:`${(vol.peitoTri/total)*100}%`}}></div></div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2"><span>COSTAS // BÍCEPS</span><span>{Math.round((vol.costasBi/total)*100)}%</span></div>
                        <div className={`h-1.5 w-full ${theme.inputBg}`}><div className="h-full bg-zinc-400 dark:bg-zinc-500" style={{width:`${(vol.costasBi/total)*100}%`}}></div></div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2"><span>PERNAS</span><span>{Math.round((vol.pernas/total)*100)}%</span></div>
                        <div className={`h-1.5 w-full ${theme.inputBg}`}><div className="h-full bg-zinc-600 dark:bg-zinc-700" style={{width:`${(vol.pernas/total)*100}%`}}></div></div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2"><span>OMBROS // CORE</span><span>{Math.round((vol.ombrosCore/total)*100)}%</span></div>
                        <div className={`h-1.5 w-full ${theme.inputBg}`}><div className="h-full bg-[#CCFF00]" style={{width:`${(vol.ombrosCore/total)*100}%`}}></div></div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          ) : (
            <section className="space-y-6">
              {workoutData.map((dayData, index) => {
                const isExpanded = expandedDay === index;
                const progress = getDayProgress(index);
                const isToday = currentDayIndex === index;

                return (
                  <div key={index} className={`border-2 transition-colors duration-300 ${isExpanded ? 'border-[#CCFF00]' : theme.border}`}>
                    <button 
                      onClick={() => setExpandedDay(isExpanded ? -1 : index)}
                      className={`w-full text-left p-4 md:p-6 flex items-center justify-between ${theme.surface} hover:bg-[#CCFF00]/5 transition-colors`}
                    >
                      <div className="flex items-center gap-4 md:gap-6 flex-1">
                        <div className="font-mono text-xs font-bold w-6 text-center">
                          {isExpanded ? '[-]' : '[+]'}
                        </div>
                        <div className="flex-1 flex flex-col md:flex-row md:items-baseline md:gap-4">
                          <h2 className="font-display text-2xl md:text-3xl tracking-wide">{dayData.day}</h2>
                          <div className="flex items-center gap-2 mt-1 md:mt-0">
                            <span className={`font-mono text-[10px] font-bold uppercase ${theme.muted}`}>// {dayData.focus}</span>
                            {isToday && <span className="bg-[#CCFF00] text-black text-[9px] px-1.5 py-0.5 font-bold font-mono">ACTV</span>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="hidden md:flex flex-col items-end w-32 shrink-0 font-mono">
                        <span className={`text-[10px] mb-1 font-bold ${progress === 100 ? 'text-[#CCFF00]' : theme.text}`}>
                          PRG: {progress}%
                        </span>
                        <div className={`w-full h-1 ${theme.inputBg}`}>
                          <div className="h-full bg-[#CCFF00] transition-all duration-500" style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    </button>

                    <div className={`md:hidden w-full h-0.5 ${theme.inputBg}`}>
                      <div className="h-full bg-[#CCFF00] transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>

                    {isExpanded && (
                      <div className={`p-4 md:p-6 border-t-2 ${theme.border} ${theme.bg} animate-in slide-in-from-top-2 duration-300`}>
                        
                        {jetLagMode && (
                          <div className="mb-6 p-3 border-l-4 border-[#CCFF00] bg-[#CCFF00]/10 font-mono text-[10px] uppercase leading-relaxed">
                            <strong>[ALERTA TÁTICO]:</strong> Modo Jet Lag ativado. Séries limitadas (MAX 2). Executar com precisão.
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
                            
                            return (
                              <div key={i} className={`border-2 p-4 md:p-5 transition-colors ${isCompleted ? 'border-[#CCFF00]' : theme.border} ${theme.surface}`}>
                                
                                <div className="flex flex-col lg:flex-row gap-6">
                                  
                                  {/* EX INFO */}
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex items-baseline gap-2">
                                        <span className="font-mono text-[#CCFF00] font-bold text-sm">0{i + 1}</span>
                                        <h3 className="font-display text-2xl tracking-wide">{ex.name}</h3>
                                        {baseEx.alt && (
                                          <button onClick={() => toggleSwapExercise(index, activeTab, i)} className={`font-mono text-[10px] border px-1 hover:bg-white hover:text-black transition-colors ${theme.border}`} title="Alt">
                                            [SWAP]
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <p className={`font-mono text-[10px] uppercase ${theme.muted} mb-4 flex gap-3`}>
                                      {ex.position && activeTab === 'home' && <span>LOC: {ex.position}</span>}
                                      <span>TGT: {ex.desc}</span>
                                    </p>
                                    
                                    <div className="flex items-center gap-3 font-mono text-[10px] font-bold">
                                      <span className={`px-2 py-1 border-2 ${theme.border}`}>S: {numSets}</span>
                                      <span className={`px-2 py-1 border-2 ${theme.border}`}>R: {baseEx.reps}</span>
                                      <button onClick={() => setExpandedInfo(isInfoExpanded ? null : `${index}-${activeTab}-${i}`)} className={`px-2 py-1 border-2 transition-colors ${isInfoExpanded ? 'bg-white text-black border-white' : `${theme.border} hover:border-[#CCFF00]`}`}>
                                        [INFO]
                                      </button>
                                    </div>

                                    {isInfoExpanded && (
                                      <div className={`mt-4 p-3 border-l-2 border-[#CCFF00] ${theme.inputBg} font-mono text-[10px] uppercase leading-relaxed animate-in fade-in`}>
                                        {ex.instructions}
                                      </div>
                                    )}
                                  </div>

                                  {/* TRACKER & OVERLOAD */}
                                  <div className="lg:w-64 shrink-0 flex flex-col gap-4 border-t-2 lg:border-t-0 lg:border-l-2 border-dashed border-zinc-700 pt-4 lg:pt-0 lg:pl-6">
                                    
                                    <div>
                                      <div className="flex justify-between font-mono text-[10px] font-bold uppercase mb-2">
                                        <span className={theme.muted}>EXECUÇÃO</span>
                                        <span className={isCompleted ? "text-[#CCFF00]" : ""}>{completedCount}/{numSets}</span>
                                      </div>
                                      <div className="flex gap-2">
                                        {Array.from({ length: numSets }).map((_, setIdx) => {
                                          const isChecked = completedSets[`${index}-${activeTab}-${i}-${setIdx}`];
                                          return (
                                            <button
                                              key={setIdx}
                                              onClick={() => toggleSet(index, activeTab, i, setIdx)}
                                              className={`h-8 flex-1 border-2 transition-all font-mono text-xs font-bold neo-brutalism ${isChecked ? 'bg-[#CCFF00] border-[#CCFF00] text-black translate-x-[2px] translate-y-[2px] shadow-none' : `${theme.surface} ${theme.border} hover:border-white text-transparent`}`}
                                            >
                                              X
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div>
                                      <label className="font-mono text-[10px] font-bold uppercase mb-2 block text-zinc-500">
                                        CARGA [KG/LB]
                                      </label>
                                      <input 
                                        type="text" 
                                        value={currentWeight}
                                        onChange={(e) => updateWeight(index, activeTab, i, e.target.value)}
                                        placeholder="---" 
                                        className={`w-full h-8 ${theme.inputBg} border-2 ${theme.border} px-2 font-mono text-xs font-bold focus:outline-none focus:border-[#CCFF00] transition-colors uppercase`}
                                      />
                                    </div>

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
            
            <div className="absolute top-0 left-0 h-0.5 bg-[#CCFF00] transition-all duration-1000 ease-linear" style={{ width: `${(timer.time / timer.total) * 100}%` }}></div>

            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 md:w-4 md:h-4 ${timer.time <= 10 && timer.time > 0 ? 'bg-red-500 animate-pulse' : 'bg-[#CCFF00]'}`}></div>
              <div>
                <p className="font-mono text-[8px] md:text-[10px] uppercase text-zinc-500 font-bold tracking-widest">{t.rest}</p>
                <p className="font-display text-2xl md:text-4xl leading-none">{formatTime(timer.time)}</p>
              </div>
            </div>

            <div className="flex gap-2 font-mono text-xs font-bold">
              <button onClick={() => adjustTimer(-15)} className={`hidden sm:block px-3 py-2 border-2 ${theme.border} hover:bg-white hover:text-black transition-colors`}>-15</button>
              <button onClick={() => adjustTimer(30)} className={`hidden sm:block px-3 py-2 border-2 ${theme.border} hover:bg-white hover:text-black transition-colors`}>+30</button>
              <button onClick={() => setTimer(prev => ({ ...prev, active: !prev.active }))} className={`px-4 py-2 border-2 transition-colors ${timer.active && timer.time > 0 ? 'border-amber-400 text-amber-400' : 'border-[#CCFF00] text-[#CCFF00]'}`}>
                {timer.active && timer.time > 0 ? '[PAUSA]' : '[PLAY]'}
              </button>
              <button onClick={() => setTimer({ active: false, time: 0, total: 60 })} className={`px-4 py-2 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors`}>
                [X]
              </button>
            </div>
          </div>
        </div>

      </div>
    </>
  );
};

export default App;
