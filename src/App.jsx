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
  console.warn("Firebase não inicializado no ambiente. Usando LocalStorage como fallback.", e);
}
// ----------------------

// Dicionário de Idiomas (UI)
const translations = {
  pt: {
    title: "Plano Híbrido de Treino",
    home: "Em Casa",
    hotel: "No Hotel",
    analytics: "Estatísticas",
    reset: "Isso limpará os botões das séries (mas manterá seu histórico geral). Tem certeza?",
    cancel: "Cancelar",
    confirmReset: "Sim, Limpar",
    today: "HOJE",
    completed: "Concluído",
    markSets: "Marcar Séries",
    sets: "Séries",
    weight: "Carga (kg/lb):",
    lastWeight: "Última:",
    rest: "Descanso",
    voiceEnd: "Tempo de descanso encerrado. Prepare-se!",
    jetLagOn: "Modo Jet Lag ON",
    jetLagOff: "Jet Lag OFF",
    statsStreak: "Dias Seguidos (Streak)",
    statsRate: "Taxa de Conclusão (7 dias)",
    statsVolume: "Distribuição de Volume",
    syncOnline: "Sincronizado",
    syncOffline: "Modo Offline"
  },
  en: {
    title: "Hybrid Workout Plan",
    home: "At Home",
    hotel: "At Hotel",
    analytics: "Analytics",
    reset: "This will clear current set checkmarks (history is kept). Are you sure?",
    cancel: "Cancel",
    confirmReset: "Yes, Reset",
    today: "TODAY",
    completed: "Completed",
    markSets: "Mark Sets",
    sets: "Sets",
    weight: "Weight (kg/lb):",
    lastWeight: "Last:",
    rest: "Rest",
    voiceEnd: "Rest time is over. Get ready!",
    jetLagOn: "Jet Lag Mode ON",
    jetLagOff: "Jet Lag OFF",
    statsStreak: "Current Streak",
    statsRate: "Completion Rate (7 days)",
    statsVolume: "Volume Distribution",
    syncOnline: "Synced",
    syncOffline: "Offline Mode"
  },
  es: {
    title: "Plan Híbrido de Entrenamiento",
    home: "En Casa",
    hotel: "En Hotel",
    analytics: "Estadísticas",
    reset: "Esto limpiará las series actuales (el historial se mantiene). ¿Estás seguro?",
    cancel: "Cancelar",
    confirmReset: "Sí, Limpiar",
    today: "HOY",
    completed: "Completado",
    markSets: "Marcar Series",
    sets: "Series",
    weight: "Peso (kg/lb):",
    lastWeight: "Último:",
    rest: "Descanso",
    voiceEnd: "Tiempo de descanso terminado. ¡Prepárate!",
    jetLagOn: "Modo Jet Lag ON",
    jetLagOff: "Jet Lag OFF",
    statsStreak: "Racha Actual",
    statsRate: "Tasa de Finalización",
    statsVolume: "Distribución de Volumen",
    syncOnline: "Sincronizado",
    syncOffline: "Modo Offline"
  }
};

const App = () => {
  // Configurações de Estado
  const [activeTab, setActiveTab] = useState('home');
  const [jetLagMode, setJetLagMode] = useState(false);
  const [completedSets, setCompletedSets] = useState({});
  const [expandedInfo, setExpandedInfo] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [swappedExercises, setSwappedExercises] = useState({});
  const [weights, setWeights] = useState({}); // Progressive Overload
  const [workoutHistory, setWorkoutHistory] = useState({});
  
  // Settings Globais
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [quietMode, setQuietMode] = useState(false);
  const [lang, setLang] = useState('pt');
  
  // Firebase Auth State
  const [user, setUser] = useState(null);
  const [isSynced, setIsSynced] = useState(false);
  const hasLoadedCloudData = useRef(false);
  
  const currentDayIndex = (new Date().getDay() + 6) % 7;
  const [expandedDay, setExpandedDay] = useState(currentDayIndex);
  const [timer, setTimer] = useState({ active: false, time: 0, total: 60 });
  const t = translations[lang];

  const getTodayDateString = () => new Date().toISOString().split('T')[0];

  // --- FIREBASE AUTH & SYNC ---
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
        console.warn("Aviso: Falha na autenticação ou bloqueio de rede. O aplicativo funcionará no Modo Offline (Local Storage).", error.message);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseInitialized || !user) return;

    // FIX: Document references must have an EVEN number of segments.
    // artifacts / appId / users / userId / app_data / workout_data (6 segments)
    const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'app_data', 'workout_data');
    
    // Listener de Nuvem
    const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Apenas carregamos da nuvem a primeira vez ou se outro dispositivo atualizar
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
      console.warn("Aviso ao sincronizar Firestore (Modo Offline ativado)", error.message);
      setIsSynced(false);
    });

    return () => unsubscribeSnapshot();
  }, [user]);

  // Salvar na Nuvem (Debounced/Sempre que mudar)
  useEffect(() => {
    if (firebaseInitialized && user && hasLoadedCloudData.current) {
      const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'app_data', 'workout_data');
      setDoc(userDocRef, {
        completedSets,
        weights,
        workoutHistory,
        swappedExercises,
        lastUpdated: new Date().toISOString()
      }, { merge: true }).then(() => setIsSynced(true)).catch(() => setIsSynced(false));
    }
  }, [completedSets, weights, workoutHistory, swappedExercises, user]);

  // Fallback Local Storage
  useEffect(() => {
    if (firebaseInitialized && hasLoadedCloudData.current) return; // Se a nuvem assumiu, ignora load local

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
        hasLoadedCloudData.current = true; // Marca como carregado do local
      }
      
      const savedJetLag = localStorage.getItem('abbJetLagMode');
      if (savedJetLag) setJetLagMode(savedJetLag === 'true');
      const savedQuiet = localStorage.getItem('abbQuietMode');
      if (savedQuiet) setQuietMode(savedQuiet === 'true');
      const savedLang = localStorage.getItem('abbLang');
      if (savedLang) setLang(savedLang);
      const savedTheme = localStorage.getItem('abbThemeMode');
      if (savedTheme !== null) setIsDarkMode(savedTheme === 'dark');
    } catch (e) {
      console.warn("Erro ao ler LocalStorage", e.message);
    }
  }, []);

  // Salvar no Local Storage sempre
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
    } catch (e) {
      console.warn("Armazenamento local indisponível", e.message);
    }
  }, [completedSets, weights, workoutHistory, swappedExercises, jetLagMode, quietMode, lang, isDarkMode]);

  // Alertas Sonoros e Assistente de Voz
  const playAlert = useCallback(() => {
    if (quietMode) return;
    
    // Voice Assistant
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(t.voiceEnd);
      utterance.lang = lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es-ES';
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    } else {
      // Beep Fallback
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // Frequência A5
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime); // Volume baixo
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5); // Duração de 0.5s
      } catch (e) {
        console.warn("Audio blocked or not supported", e.message);
      }
    }
  }, [quietMode, lang, t.voiceEnd]);

  // Lógica do Cronômetro
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
    // Truque para desbloquear síntese de voz no mobile via interação de clique
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

  const resetProgress = () => {
    setCompletedSets({});
    setSwappedExercises({});
    setShowResetModal(false);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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

  // Base de Dados do Treino
  const workoutData = [
    {
      day: "Segunda-feira",
      focus: "Peito e Tríceps",
      home: [
        { name: "Flat Dumbbell Press", icon: "🏋️‍♂️", position: "Banco", desc: "Banco plano", sets: "4", reps: "10-12 reps", instructions: "Deite no banco plano. Pressione os halteres para cima até estender os braços. Desça em 3 segundos.", alt: { name: "Floor Press", icon: "🛌", position: "Colchonete", desc: "No chão", instructions: "Deite no chão e faça o movimento de supino. Protege os ombros."} },
        { name: "Incline Dumbbell Press", icon: "📐", position: "Banco", desc: "Banco 30-45°", sets: "4", reps: "10-12 reps", instructions: "Incline o banco. Foque em alongar a parte superior do peito na descida. Controle o movimento.", alt: { name: "Reverse Grip Press", icon: "🤲", position: "Banco", desc: "Pegada invertida", instructions: "Faça o supino reto com a palma das mãos viradas para trás (em sua direção)."} },
        { name: "Flat Dumbbell Fly", icon: "🦅", position: "Banco", desc: "Crucifixo", sets: "3", reps: "10-12 reps", instructions: "Braços levemente flexionados. Abra os braços como se fosse dar um abraço. Sinta o peitoral alongar.", alt: { name: "Pullovers Cruzados", icon: "🔄", position: "Banco", desc: "Foco no miolo do peito", instructions: "Aperte os dois halteres um contra o outro enquanto os sobe."} },
        { name: "Close-Grip Dumbbell Press", icon: "👐", position: "Banco", desc: "Halteres juntos", sets: "3", reps: "10-12 reps", instructions: "Mantenha os halteres colados no peito e empurre. Foco total em tríceps e parte interna do peito.", alt: { name: "Tate Press", icon: "🤜", position: "Banco", desc: "Cotovelos para fora", instructions: "Halteres no peito, empurre-os esticando os braços para fora e para cima."} },
        { name: "Overhead Triceps Extension", icon: "💪", position: "Banco", desc: "Tríceps Francês", sets: "3", reps: "10-12 reps", instructions: "Sentado no banco, segure um halter atrás da cabeça com as duas mãos e estenda os braços para cima.", alt: { name: "Lying Triceps Ext", icon: "🤕", position: "Banco", desc: "Testa deitado", instructions: "Faça a extensão do tríceps deitado no banco, descendo os pesos até a testa."} }
      ],
      hotel: [
        { name: "Incline Push-ups", icon: "🛏️", desc: "Mãos na cama/mesa", sets: "4", reps: "Até a falha", instructions: "Mãos apoiadas na beira da cama ou mesa. O corpo inclinado reduz a carga nos braços.", alt: { name: "Wall Push-ups", icon: "🧱", desc: "Mãos na parede", instructions: "Flexão em pé contra a parede. Excelente para dias de extrema fadiga."} },
        { name: "Knee Push-ups", icon: "🧎‍♂️", desc: "Joelhos no chão", sets: "4", reps: "12-15 reps", instructions: "Flexão apoiando os joelhos no chão. Mantenha o corpo em linha reta do joelho até a cabeça.", alt: { name: "Plank Hold", icon: "📏", desc: "Prancha alta", instructions: "Mantenha a posição final da flexão (braços esticados) o máximo de tempo que aguentar."} },
        { name: "Push-up Negatives", icon: "⏳", desc: "Descida super lenta", sets: "3", reps: "8-10 reps", instructions: "Comece na posição de prancha. Desça o mais devagar possível (5 seg) até o chão.", alt: { name: "Shoulder Taps", icon: "👋", desc: "Toque alternado", instructions: "Na posição de flexão, toque no ombro oposto mantendo o core estabilizado."} },
        { name: "Chair Dips (Bent Knees)", icon: "🪑", desc: "Mergulho facilitado", sets: "3", reps: "12-15 reps", instructions: "Mãos na beira da cama. Mantenha os joelhos dobrados a 90° e os pés no chão para ajudar a empurrar.", alt: { name: "Floor Dips", icon: "🦀", desc: "Mergulho no chão", instructions: "Sente no chão, mãos atrás das costas, levante o quadril e dobre os cotovelos."} },
        { name: "Plank to Down-Dog", icon: "⛺", desc: "Mobilidade e ombro", sets: "3", reps: "10 reps", instructions: "Da posição de prancha, empurre o quadril para cima e para trás, alongando as costas e ativando os ombros.", alt: { name: "Child's Pose to Cobra", icon: "🐍", desc: "Fluxo no solo", instructions: "Alterne entre alongar as costas sentado nos calcanhares e alongar o abdômen olhando para cima."} }
      ]
    },
    {
      day: "Terça-feira",
      focus: "Pernas e Core",
      home: [
        { name: "Goblet Squat", icon: "🦵", position: "Em pé", desc: "1 halter no peito", sets: "4", reps: "10-12 reps", instructions: "Segure o halter colado ao peito. Agache mantendo as costas retas, ideal para suas pernas longas.", alt: { name: "Front Squat", icon: "🏋️‍♂️", position: "Em pé", desc: "2 halteres", instructions: "Apoie um halter em cada ombro e agache. Mais carga para as pernas."} },
        { name: "Dumbbell Lunges", icon: "🚶‍♂️", position: "Em pé", desc: "Passadas no lugar", sets: "4", reps: "10-12 reps", instructions: "Dê um passo à frente e desça o joelho de trás em direção ao chão. Mantenha o tronco ereto.", alt: { name: "Reverse Lunges", icon: "⏪", position: "Em pé", desc: "Passada p/ trás", instructions: "Dar o passo para trás tira a pressão dos joelhos e foca mais nos glúteos."} },
        { name: "Dumbbell Calf Raises", icon: "🧦", position: "Em pé", desc: "Panturrilhas em pé", sets: "3", reps: "12-15 reps", instructions: "Segure os halteres e fique na ponta dos pés. Segure 1 segundo no topo e desça devagar.", alt: { name: "Seated Calf Raises", icon: "🪑", position: "Banco", desc: "Sentado c/ peso", instructions: "Sente no banco, coloque os halteres sobre os joelhos e fique na ponta dos pés."} },
        { name: "Plank", icon: "📏", position: "Colchonete", desc: "Prancha Abdominal", sets: "3", reps: "45 seg", instructions: "Apoie nos antebraços. Contraia os glúteos e o abdômen. Respire fundo mantendo a tensão.", alt: { name: "Hollow Body", icon: "🍌", position: "Colchonete", desc: "Canoa isométrica", instructions: "Deite de barriga para cima, estique braços e pernas e levante-os levemente do chão."} },
        { name: "Lying Leg Raises", icon: "📐", position: "Banco", desc: "Elevação de pernas", sets: "3", reps: "12-15 reps", instructions: "Deitado no banco, levante as pernas esticadas até 90°. Desça devagar sem deixar a lombar arquear.", alt: { name: "Flutter Kicks", icon: "🏊", position: "Colchonete", desc: "Pernadas curtas", instructions: "Deitado, pernas esticadas ligeiramente acima do chão, faça movimentos curtos para cima e para baixo."} }
      ],
      hotel: [
        { name: "Bodyweight Squat", icon: "🦵", desc: "Agachamento livre", sets: "4", reps: "15-20 reps", instructions: "Sem peso, foque na profundidade e em descer em 4 segundos para aumentar a dificuldade.", alt: { name: "Jump Squats", icon: "🚀", desc: "Com salto", instructions: "Agache e salte explosivamente. Aumenta a frequência cardíaca (se o hotel permitir o impacto)."} },
        { name: "Reverse Lunges", icon: "🚶‍♂️", desc: "Passada para trás", sets: "4", reps: "15-20 reps", instructions: "Dê o passo para trás em vez de para frente. Exige menos dos joelhos.", alt: { name: "Side Lunges", icon: "↔️", desc: "Passada lateral", instructions: "Dê o passo para o lado, focando nos músculos adutores da coxa."} },
        { name: "Single-Leg Calf Raises", icon: "🧦", desc: "Panturrilha unilateral", sets: "3", reps: "12-15 reps", instructions: "Apoie-se na parede. Fique na ponta de um pé só. Aumenta muito a carga no músculo.", alt: { name: "Double Calf Raises", icon: "👯", desc: "Duas pernas lentas", instructions: "Use ambas as pernas, mas faça a subida e descida super devagar (4 segundos)."} },
        { name: "Plank", icon: "📏", desc: "Prancha Abdominal", sets: "3", reps: "60 seg", instructions: "Mantenha a postura o mais reta possível, ativando o core profundamente.", alt: { name: "Plank Jacks", icon: "✂️", desc: "Abrir/Fechar pernas", instructions: "Na posição de prancha, salte abrindo e fechando as pernas rapidamente."} },
        { name: "Mountain Climbers", icon: "🧗‍♂️", desc: "Corrida na prancha", sets: "3", reps: "45 seg", instructions: "Na posição de prancha alta, puxe os joelhos alternadamente em direção ao peito com ritmo médio.", alt: { name: "Slow Climbers", icon: "🐢", desc: "Passos lentos", instructions: "Puxe o joelho até o peito bem devagar, segure por 2s e troque."} }
      ]
    },
    {
      day: "Quarta-feira",
      focus: "Costas e Bíceps",
      home: [
        { name: "Single-Arm Dumbbell Row", icon: "🚣‍♂️", position: "Banco", desc: "Remada unilateral", sets: "4", reps: "10-12 reps", instructions: "Apoie mão e joelho no banco. Puxe o halter em direção ao quadril, não em direção ao peito.", alt: { name: "Chest-Supported Row", icon: "🪑", position: "Banco", desc: "Peito no banco", instructions: "Incline o banco a 45º, deite de bruços e faça a remada com os dois braços ao mesmo tempo."} },
        { name: "Dumbbell Pullover", icon: "🏋️‍♂️", position: "Banco", desc: "Deitado no banco", sets: "4", reps: "10-12 reps", instructions: "Deitado, segure 1 halter com as duas mãos. Desça para trás da cabeça com os braços levemente dobrados.", alt: { name: "Renegade Row", icon: "🦍", position: "Colchonete", desc: "Prancha com remada", instructions: "Na posição de prancha segurando os halteres, puxe um de cada vez em direção à cintura."} },
        { name: "Bent-Over Dumbbell Row", icon: "🦍", position: "Em pé", desc: "Remada curvada", sets: "3", reps: "10-12 reps", instructions: "Incline o tronco para frente (45°), costas retas. Puxe os dois halteres simulando um movimento de remada.", alt: { name: "Reverse Fly", icon: "🦅", position: "Em pé", desc: "Crucifixo invertido", instructions: "Inclinado, abra os braços lateralmente para focar na parte de trás dos ombros."} },
        { name: "Alternating Biceps Curl", icon: "💪", position: "Em pé", desc: "Rosca direta", sets: "3", reps: "10-12 reps", instructions: "Suba o halter girando o pulso (palma para cima). Controle muito a descida.", alt: { name: "Zottman Curl", icon: "🔄", position: "Em pé", desc: "Rotação no topo", instructions: "Suba com a palma para cima, gire a palma para baixo no topo e desça."} },
        { name: "Hammer Curls", icon: "🔨", position: "Em pé", desc: "Pegada neutra", sets: "3", reps: "10-12 reps", instructions: "Segure os halteres como se fossem martelos. Trabalha o braquial e dá volume aos braços longos.", alt: { name: "Cross-body Curl", icon: "✖️", position: "Em pé", desc: "Cruzando o peito", instructions: "Suba o halter em direção ao ombro oposto, mantendo a pegada neutra."} }
      ],
      hotel: [
        { name: "Superman", icon: "🦸‍♂️", desc: "Elevação no chão", sets: "4", reps: "15 reps", instructions: "Deite de bruços. Levante braços, peito e pernas do chão ao mesmo tempo. Segure 2 segundos no topo.", alt: { name: "Aquaman", icon: "🌊", desc: "Nado de bruços", instructions: "De bruços, alterne elevações rápidas de braço direito/perna esquerda e vice-versa."} },
        { name: "Y-W-T Raises", icon: "🔠", desc: "Movimentos em bruços", sets: "4", reps: "12 reps", instructions: "De bruços, desenhe as letras Y, W e T com os braços elevados no ar.", alt: { name: "Prone Lat Pulldown", icon: "🔙", desc: "Puxada imaginária", instructions: "De bruços, estique os braços à frente e puxe os cotovelos para trás apertando as costas."} },
        { name: "Towel Door Row", icon: "🚪", desc: "Remada na toalha", sets: "3", reps: "12-15 reps", instructions: "Prenda uma toalha na maçaneta dupla. Incline o corpo para trás e puxe-se para frente.", alt: { name: "Bed Frame Row", icon: "🛏️", desc: "Puxada debaixo da cama", instructions: "Deite debaixo da beira de uma cama firme, segure a borda e puxe o corpo para cima."} },
        { name: "Reverse Snow Angels", icon: "❄️", desc: "Bruços no chão", sets: "3", reps: "15 reps", instructions: "De bruços, mova os braços estendidos da frente da cabeça até o quadril, sem tocar no chão.", alt: { name: "Cobra Pose Hold", icon: "🐍", desc: "Isometria lombar", instructions: "Eleve o peito do chão empurrando levemente com as mãos e sustente."} },
        { name: "Biceps Isometric", icon: "🤝", desc: "Uma mão contra a outra", sets: "3", reps: "30 seg", instructions: "Um braço tenta fazer o movimento de rosca enquanto a outra mão empurra para baixo com força máxima.", alt: { name: "Under-Leg Curl", icon: "🦵", desc: "Resistência c/ a perna", instructions: "Sentado, passe as mãos por baixo da coxa e tente puxá-la enquanto a perna resiste empurrando para baixo."} }
      ]
    },
    {
      day: "Quinta-feira",
      focus: "Ombros e Core",
      home: [
        { name: "Seated Shoulder Press", icon: "🪑", position: "Banco", desc: "Desenvolvimento", sets: "4", reps: "10-12 reps", instructions: "Banco a 90°. Empurre os halteres para cima. Não deixe os cotovelos descerem muito abaixo dos ombros.", alt: { name: "Arnold Press", icon: "🔄", position: "Banco", desc: "Giro na subida", instructions: "Comece com as palmas voltadas para o rosto e gire-as para fora enquanto empurra para cima."} },
        { name: "Lateral Raises", icon: "🦅", position: "Em pé", desc: "Elevação lateral", sets: "4", reps: "10-12 reps", instructions: "Suba os braços lateralmente até a altura dos ombros. Como seus braços são longos, use menos peso.", alt: { name: "Leaning Lateral Raise", icon: "📐", position: "Em pé", desc: "Inclinado unilateral", instructions: "Segure numa porta/parede, incline o corpo para longe e faça a elevação com 1 braço. Maior amplitude."} },
        { name: "Front Raises", icon: "⬆️", position: "Em pé", desc: "Elevação frontal", sets: "3", reps: "10-12 reps", instructions: "Levante um halter de cada vez para a frente até a altura do rosto.", alt: { name: "Upright Row", icon: "⬆️", position: "Em pé", desc: "Remada alta", instructions: "Puxe os halteres rente ao corpo até o peito, elevando bem os cotovelos."} },
        { name: "Russian Twist", icon: "🌪️", position: "Colchonete", desc: "Giro de tronco", sets: "3", reps: "20 reps", instructions: "Sentado no chão, incline-se levemente para trás. Gire o tronco (segurando 1 halter) tocando os dois lados.", alt: { name: "Weighted Sit-Ups", icon: "🏋️‍♂️", position: "Colchonete", desc: "Abdominal clássico", instructions: "Abdominal completo segurando um halter leve no peito."} },
        { name: "Side Plank", icon: "📐", position: "Colchonete", desc: "Prancha lateral", sets: "3", reps: "30 seg/lado", instructions: "Apoie-se em apenas um antebraço e na lateral do pé. Forme uma linha reta. Segure 30-45 seg cada lado.", alt: { name: "Side Plank Dips", icon: "↕️", position: "Colchonete", desc: "Descer/Subir quadril", instructions: "Na prancha lateral, desça o quadril até quase tocar o chão e suba ativando os oblíquos."} }
      ],
      hotel: [
        { name: "Pike Push-ups (Knees bent)", icon: "⛺", desc: "Flexão em V", sets: "4", reps: "Até a falha", instructions: "Quadril para cima (pode dobrar os joelhos). Desça o topo da cabeça em direção ao chão para focar nos ombros.", alt: { name: "Wall Walk", icon: "🚶‍♂️", desc: "Andar na parede", instructions: "Prancha com pés na parede. Ande com as mãos para trás elevando o corpo até a posição de parada de mãos (se seguro!)."} },
        { name: "Wall Lateral Isometrics", icon: "🧱", desc: "Empurrar a parede", sets: "4", reps: "30 seg", instructions: "Fique de lado para uma parede. Tente levantar o braço lateralmente empurrando a parede com força total por 30s.", alt: { name: "Doorway Shoulder Press", icon: "🚪", desc: "Empurrar batente", instructions: "Em um batente de porta, levante os braços e tente empurrá-lo para fora com máxima tensão lateral."} },
        { name: "Arm Circles", icon: "🔄", desc: "Giros de braço", sets: "3", reps: "60 seg", instructions: "Estenda os braços e faça círculos pequenos e rápidos. Parece fácil, mas queima após 60 segundos.", alt: { name: "Pike Hold", icon: "⛺", desc: "Isometria em V", instructions: "Mantenha a posição de Pike (quadril elevado) empurrando o chão firmemente por tempo."} },
        { name: "Russian Twist", icon: "🌪️", desc: "Sem peso", sets: "3", reps: "20 reps", instructions: "Faça o mesmo movimento de giro, mas cruze as mãos e foque em rotacionar a coluna ativando o core.", alt: { name: "Windshield Wipers", icon: "🚗", desc: "Limpador de parabrisa", instructions: "Deitado, pernas para o ar. Gire as pernas juntas para um lado e para o outro controlando no abdômen."} },
        { name: "Side Plank", icon: "📐", desc: "Prancha lateral", sets: "3", reps: "30 seg/lado", instructions: "Excelente para a saúde da coluna. Mantenha o quadril bem elevado do chão.", alt: { name: "Star Plank", icon: "⭐", desc: "Prancha estrela", instructions: "Na prancha lateral, eleve a perna de cima e o braço de cima, formando uma estrela."} }
      ]
    },
    {
      day: "Sexta-feira",
      focus: "Foco em Braços",
      home: [
        { name: "Skull Crushers", icon: "🤕", position: "Banco", desc: "Tríceps Testa", sets: "4", reps: "10-12 reps", instructions: "Deitado no banco, desça os halteres em direção às orelhas dobrando apenas o cotovelo. Suba contraindo o tríceps.", alt: { name: "Overhead Ext", icon: "💪", position: "Banco", desc: "Extensão sentada", instructions: "Sentado, desça 1 halter pesado atrás da cabeça segurando com as duas mãos."} },
        { name: "Concentration Curls", icon: "🧠", position: "Banco", desc: "Rosca concentrada", sets: "4", reps: "10-12 reps", instructions: "Sentado, apoie o cotovelo na parte interna da coxa. Isole o bíceps e faça o movimento devagar.", alt: { name: "Incline Curls", icon: "📐", position: "Banco", desc: "Banco inclinado", instructions: "Banco a 45º. Deixe os braços pendurados e faça a rosca. Alonga muito o bíceps."} },
        { name: "Triceps Kickbacks", icon: "🐴", position: "Em pé", desc: "Tríceps Coice", sets: "3", reps: "10-12 reps", instructions: "Tronco inclinado, cotovelo alto. Estenda o braço para trás apertando o tríceps no final do movimento.", alt: { name: "Diamond Press", icon: "💎", position: "Banco", desc: "Supino fechado", instructions: "Use halteres colados no peito para fazer um supino focado inteiramente em tríceps."} },
        { name: "Reverse Grip Curl", icon: "🤲", position: "Em pé", desc: "Pegada invertida", sets: "3", reps: "10-12 reps", instructions: "Faça a rosca direta com a palma das mãos voltadas para baixo. Fortalece muito o antebraço.", alt: { name: "Wrist Curls", icon: "🤚", position: "Banco", desc: "Rosca de punho", instructions: "Antebraços apoiados nas pernas, faça apenas o movimento de flexão do punho com halteres leves."} },
        { name: "Farmer's Walk (Hold)", icon: "🚶‍♂️", position: "Em pé", desc: "Caminhada de fazendeiro", sets: "3", reps: "60 seg", instructions: "Segure os halteres mais pesados que aguentar e caminhe (ou fique parado) por 60 seg. Fortalece o grip e trapézio.", alt: { name: "Shrugs", icon: "🤷‍♂️", position: "Em pé", desc: "Encolhimento", instructions: "Halteres pesados ao lado do corpo, apenas encolha os ombros em direção às orelhas."} }
      ],
      hotel: [
        { name: "Close-Grip Knee Push-ups", icon: "👐", desc: "Mãos juntas (joelhos)", sets: "4", reps: "Até a falha", instructions: "Flexão de joelhos com as mãos coladas no corpo. Pressione usando principalmente os tríceps.", alt: { name: "Diamond Push-ups", icon: "💎", desc: "Mãos em diamante", instructions: "Mãos unidas formando um triângulo no chão sob o peito (pode ser de joelhos)."} },
        { name: "Chair Dips", icon: "🪑", desc: "Mergulhos na cama/cadeira", sets: "4", reps: "12-15 reps", instructions: "Dobre bem as pernas para não forçar os ombros, usando a força dos tríceps para subir.", alt: { name: "Triceps Extensions", icon: "🧱", desc: "Extensões na parede", instructions: "Mãos na parede, curve-se e deixe os cotovelos tocarem a parede, depois empurre com os tríceps."} },
        { name: "Towel Bicep Curls", icon: "🪢", desc: "Puxar toalha com a perna", sets: "3", reps: "12-15 reps", instructions: "Passe a toalha debaixo da coxa e tente puxar a perna para cima com os braços. A perna faz a resistência.", alt: { name: "Suitcase Hold", icon: "🧳", desc: "Segurar mala pesada", instructions: "Faça uma rosca isométrica ou repetições usando sua mala de viagem ou mochila como peso."} },
        { name: "Wall Triceps Extensions", icon: "🧱", desc: "Tríceps na parede", sets: "3", reps: "15 reps", instructions: "Em pé, de frente para a parede. Apoie as mãos na altura dos olhos e empurre o corpo para longe dobrando cotovelos.", alt: { name: "Plank to Push-up", icon: "↕️", desc: "Sobe e desce", instructions: "Da prancha de antebraços, suba para a prancha de mãos, alternando o braço que lidera a subida."} },
        { name: "Plank", icon: "📏", desc: "Prancha final", sets: "3", reps: "Até a falha", instructions: "Finalize o treino com uma prancha isométrica até quase falhar.", alt: { name: "Hollow Hold", icon: "🍌", desc: "Canoa", instructions: "A mesma canoa do treino de core, mantendo o abdômen travado e o corpo em formato de U."} }
      ]
    },
    {
      day: "Sábado",
      focus: "Pernas e Core",
      home: [
        { name: "Romanian Deadlift (RDL)", icon: "🏗️", position: "Em pé", desc: "Terra Romeno", sets: "4", reps: "10-12 reps", instructions: "Pernas semi-retas. Desça os halteres rente às pernas jogando o quadril para trás. Sinta repuxar atrás da coxa.", alt: { name: "Stiff-Leg Deadlift", icon: "📏", position: "Em pé", desc: "Terra pernas duras", instructions: "Mantenha as pernas ainda mais retas que o RDL para isolar completamente os posteriores de coxa."} },
        { name: "Sumo Squat", icon: "🤺", position: "Em pé", desc: "Pernas bem afastadas", sets: "4", reps: "10-12 reps", instructions: "Pernas bem abertas, pés apontando para fora. Segure 1 halter no meio. Foca na parte interna da coxa.", alt: { name: "Bulgarian Split Squat", icon: "🦿", position: "Banco", desc: "Agachamento búlgaro", instructions: "Apoie o peito de um pé no banco atrás de você e agache com a perna da frente segurando halteres."} },
        { name: "Glute Bridge (Weighted)", icon: "🌉", position: "Colchonete", desc: "Ponte com halter", sets: "3", reps: "12-15 reps", instructions: "Deitado, joelhos dobrados. Coloque 1 halter no quadril e eleve-o apertando os glúteos.", alt: { name: "Hip Thrust", icon: "🍑", position: "Banco", desc: "Elevação pélvica", instructions: "Apoie as costas no banco (na linha das escápulas) e eleve o quadril com o peso sobre ele."} },
        { name: "Crunches", icon: "🪑", position: "Colchonete", desc: "Abdominal curto", sets: "3", reps: "15-20 reps", instructions: "Deite no colchonete e apoie os pés em cima do banco Bowflex. Suba apenas as escápulas do chão apertando o abdômen.", alt: { name: "V-Ups", icon: "V", position: "Colchonete", desc: "Canivete", instructions: "Eleve pernas e braços esticados ao mesmo tempo, tentando encostar as mãos nos pés no ar."} },
        { name: "Plank Shoulder Taps", icon: "👋", position: "Colchonete", desc: "Toques no ombro", sets: "3", reps: "20 toques", instructions: "Na posição de prancha alta (mãos no chão), tire uma mão e toque o ombro oposto sem deixar o quadril girar.", alt: { name: "Spiderman Plank", icon: "🕷️", position: "Colchonete", desc: "Prancha aranha", instructions: "Traga o joelho em direção ao cotovelo do mesmo lado (por fora) enquanto está em prancha."} }
      ],
      hotel: [
        { name: "Bulgarian Split Squat", icon: "🦿", desc: "1 pé na cama", sets: "4", reps: "10-12 reps", instructions: "Coloque o peito do pé de trás na cama. Agache com a perna da frente. Se for muito difícil, faça afundo normal.", alt: { name: "Step-Ups", icon: "🪜", desc: "Subida em cadeira", instructions: "Suba com uma perna numa cadeira firme do hotel. Desça controlando o peso."} },
        { name: "Bodyweight Sumo Squat", icon: "🤺", desc: "Agachamento sumô", sets: "4", reps: "15-20 reps", instructions: "Sem peso, desça muito devagar (4s) e suba em 2s. Aperte os glúteos no topo.", alt: { name: "Pistol Squat (Assisted)", icon: "🔫", desc: "Agachamento 1 perna", instructions: "Agache usando apenas uma perna enquanto se apoia na porta ou na parede."} },
        { name: "Glute Bridge", icon: "🌉", desc: "Elevação pélvica", sets: "3", reps: "15-20 reps", instructions: "Eleve o quadril do chão. Tente fazer com uma perna só no ar para aumentar a dificuldade.", alt: { name: "Single-Leg Glute Bridge", icon: "🌉", desc: "Ponte Unilateral", instructions: "Faça o mesmo movimiento com uma perna estendida para o teto."} },
        { name: "Bicycle Crunches", icon: "🚴", desc: "Abdominal bicicleta", sets: "3", reps: "20 reps", instructions: "Deitado, tente encostar o cotovelo direito no joelho esquerdo e vice-versa, simulando pedalar.", alt: { name: "Reverse Crunches", icon: "🔄", desc: "Abdominal reverso", instructions: "Deitado, tire o quadril do chão trazendo os joelhos em direção ao peito."} },
        { name: "Plank Shoulder Taps", icon: "👋", desc: "Toques no ombro", sets: "3", reps: "20 toques", instructions: "Afaste um pouco os pés para dar mais equilíbrio. Mantenha o core muito rígido.", alt: { name: "Commandos", icon: "🪖", desc: "Sobe e desce", instructions: "Alterne entre a prancha com antebraços e a prancha com as palmas das mãos."} }
      ]
    },
    {
      day: "Domingo",
      focus: "Recuperação Ativa",
      home: [
        { name: "Dynamic Stretching", icon: "🧘‍♂️", position: "Em pé", desc: "Corpo todo", sets: "1", reps: "10 min livres", instructions: "Gire os braços, faça torções suaves de tronco, alongue pernas e peitoral de forma suave.", alt: { name: "Yoga Flow", icon: "🧘", position: "Colchonete", desc: "Fluxo de Yoga livre", instructions: "Faça movimentos intuitivos de alongamento profundo por 10 minutos."} },
        { name: "Cat-Cow", icon: "🐈", position: "Colchonete", desc: "Mobilidade de coluna", sets: "3", reps: "12 reps", instructions: "Em quatro apoios, alterne entre arquear as costas para cima (gato) e descer a barriga para o chão (vaca).", alt: { name: "Thoracic Rotations", icon: "🔄", position: "Colchonete", desc: "Giro de coluna", instructions: "Em 4 apoios, coloque uma mão na nuca e gire o peito em direção ao teto abrindo as costas."} },
        { name: "Bird-Dog", icon: "🐕", position: "Colchonete", desc: "Perdigueiro", sets: "3", reps: "10/lado", instructions: "Em quatro apoios, estenda o braço direito à frente e a perna esquerda para trás. Segure 3s e troque.", alt: { name: "Glute Kickbacks", icon: "🐴", position: "Colchonete", desc: "Coice de glúteos", instructions: "Em 4 apoios, estenda apenas a perna para trás focando na contração do glúteo."} },
        { name: "Dead Bug", icon: "🐞", position: "Colchonete", desc: "Inseto morto", sets: "3", reps: "12 reps", instructions: "Deitado de barriga para cima, braços e pernas no ar. Estenda braço direito e perna esquerda até quase o chão, volte.", alt: { name: "Heel Taps", icon: "👠", position: "Colchonete", desc: "Toque de calcanhar", instructions: "Deitado, pernas em 90 graus no ar. Desça uma perna até o calcanhar tocar o chão e volte."} },
        { name: "Light Plank", icon: "📏", position: "Colchonete", desc: "Prancha leve", sets: "3", reps: "30 seg", instructions: "Faça uma prancha curta (ex: 20-30 seg) apenas para ativar o corpo antes do merecido descanso.", alt: { name: "Child's Pose", icon: "👶", position: "Colchonete", desc: "Relaxamento", instructions: "Sente nos calcanhares com os braços esticados no chão à frente e respire."} }
      ],
      hotel: [
        { name: "Dynamic Stretching", icon: "🧘‍♂️", desc: "Corpo todo", sets: "1", reps: "10 min livres", instructions: "Igual em casa: movimentos fluidos para soltar as articulações após o voo ou trabalho.", alt: { name: "Yoga Flow", icon: "🧘", desc: "Fluxo de Yoga livre", instructions: "Faça movimentos intuitivos de alongamento profundo por 10 minutos."} },
        { name: "Cat-Cow", icon: "🐈", desc: "Mobilidade de coluna", sets: "3", reps: "12 reps", instructions: "Essencial para aliviar tensão lombar de ficar sentado no avião ou escritório.", alt: { name: "Thoracic Rotations", icon: "🔄", desc: "Giro de coluna", instructions: "Em 4 apoios, coloque uma mão na nuca e gire o peito em direção ao teto abrindo as costas."} },
        { name: "Bird-Dog", icon: "🐕", desc: "Perdigueiro", sets: "3", reps: "10/lado", instructions: "Foca no controle, não na velocidade. Mantenha o corpo paralelo ao chão.", alt: { name: "Glute Kickbacks", icon: "🐴", desc: "Coice de glúteos", instructions: "Em 4 apoios, estenda apenas a perna para trás focando na contração do glúteo."} },
        { name: "Dead Bug", icon: "🐞", desc: "Inseto morto", sets: "3", reps: "12 reps", instructions: "A lombar não pode descolar do chão em nenhum momento do movimento.", alt: { name: "Heel Taps", icon: "👠", desc: "Toque de calcanhar", instructions: "Deitado, pernas em 90 graus no ar. Desça uma perna até o calcanhar tocar o chão e volte."} },
        { name: "Light Plank", icon: "📏", desc: "Prancha leve", sets: "3", reps: "30 seg", instructions: "Ativação de core simples e rápida.", alt: { name: "Child's Pose", icon: "👶", desc: "Relaxamento", instructions: "Sente nos calcanhares com os braços esticados no chão à frente e respire."} }
      ]
    }
  ];

  const getDayProgress = (dayIndex) => {
    // Evita erro no tab analytics
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

  const getPositionStyle = (position) => {
    switch(position) {
      case "Banco": return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800/50";
      case "Em pé": return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/50";
      case "Colchonete": return "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800/50";
      default: return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
    }
  };

  // Funções para Analytics
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
          // Hoje ainda não treinou, tenta ver ontem
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
    let daysWithWorkout = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      if (workoutHistory[ds] && workoutHistory[ds] > 0) {
        totalCompleted += workoutHistory[ds];
        daysWithWorkout++;
      }
    }
    // Consideramos uma média de 16 séries por dia como 100% de esforço
    const expectedSets = 7 * 16; 
    return Math.min(100, Math.round((totalCompleted / expectedSets) * 100));
  };

  const getVolumeData = () => {
    const vol = { peitoTri: 0, costasBi: 0, pernas: 0, ombrosCore: 0 };
    Object.keys(completedSets).forEach(k => {
      if (completedSets[k]) {
        const [dayStr] = k.split('-');
        const dayIdx = parseInt(dayStr);
        if(dayIdx === 0 || dayIdx === 4) vol.peitoTri++; // Seg, Sex
        else if(dayIdx === 2) vol.costasBi++; // Qua
        else if(dayIdx === 1 || dayIdx === 5) vol.pernas++; // Ter, Sab
        else if(dayIdx === 3 || dayIdx === 6) vol.ombrosCore++; // Qui, Dom
      }
    });
    return vol;
  };

  const last14Days = Array.from({length: 14}).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split('T')[0];
  });

  return (
    <div className={`${isDarkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans pb-24 transition-colors duration-300">
        
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Reset?</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">{t.reset}</p>
              <div className="flex gap-3">
                <button onClick={() => setShowResetModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-colors">
                  {t.cancel}
                </button>
                <button onClick={resetProgress} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors">
                  {t.confirmReset}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
          
          <header className="bg-slate-900 dark:bg-slate-900/80 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-800 dark:border-slate-800 relative overflow-hidden transition-colors">
            <div className="absolute right-0 top-0 bottom-0 left-0 overflow-hidden pointer-events-none">
              <span className="absolute -right-10 -top-20 text-[300px] opacity-5 select-none pointer-events-none">🏋️‍♂️</span>
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
              <div className="text-center md:text-left">
                <div className="flex flex-wrap items-center gap-3 mb-2 justify-center md:justify-start">
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                    {t.title}
                  </h1>
                  {firebaseInitialized && (
                    <span className={`px-2 py-1 text-[10px] rounded flex items-center gap-1 ${isSynced ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                      <span className="text-xs">{isSynced ? '☁️' : '🌩️'}</span>
                      {isSynced ? t.syncOnline : t.syncOffline}
                    </span>
                  )}
                </div>
                
                <div className="mt-4 flex items-center gap-2 justify-center md:justify-start">
                  <span className="opacity-70 text-sm">📅</span>
                  <div className="flex gap-1">
                    {last14Days.map((dateStr) => {
                      const count = workoutHistory[dateStr] || 0;
                      let colorClass = "bg-slate-700";
                      if (count > 0 && count <= 5) colorClass = "bg-emerald-800";
                      if (count > 5 && count <= 12) colorClass = "bg-emerald-600";
                      if (count > 12) colorClass = "bg-emerald-400";
                      
                      return (
                        <div key={dateStr} title={`${dateStr}: ${count} ${t.sets}`} className={`w-3 h-3 md:w-4 md:h-4 rounded-[3px] ${colorClass} transition-colors`}></div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-center items-center gap-2 md:gap-3">
                <button onClick={cycleLanguage} className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors font-bold text-xs uppercase w-10 text-center">
                  {lang}
                </button>
                <button onClick={() => setQuietMode(!quietMode)} className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors">
                  <span className="text-lg">{quietMode ? '🔇' : '🔊'}</span>
                </button>
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors">
                  <span className="text-lg">{isDarkMode ? '☀️' : '🌙'}</span>
                </button>
                <button onClick={() => setJetLagMode(!jetLagMode)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${jetLagMode ? 'bg-amber-500 text-slate-900 shadow-md scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                  <span className="text-base shrink-0">✈️</span> 
                  <span className="hidden lg:inline">{jetLagMode ? t.jetLagOn : t.jetLagOff}</span>
                </button>
                <button onClick={() => setShowResetModal(true)} className="p-2.5 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 rounded-xl transition-colors">
                  <span className="text-lg">🔄</span>
                </button>
              </div>
            </div>

            <div className="relative z-10 flex p-1 bg-slate-800/80 backdrop-blur-md rounded-2xl w-full shadow-inner border border-slate-700 overflow-x-auto hide-scrollbar">
              <button onClick={() => setActiveTab('home')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 px-2 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'home' ? 'bg-white text-blue-600 shadow-md scale-100' : 'text-slate-400 hover:text-white hover:bg-slate-700/50 scale-95'}`}>
                <span className="text-lg">🏠</span> <span className="whitespace-nowrap">{t.home}</span>
              </button>
              <button onClick={() => setActiveTab('hotel')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 px-2 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'hotel' ? 'bg-white text-amber-600 shadow-md scale-100' : 'text-slate-400 hover:text-white hover:bg-slate-700/50 scale-95'}`}>
                <span className="text-lg">🏨</span> <span className="whitespace-nowrap">{t.hotel}</span>
              </button>
              <button onClick={() => setActiveTab('analytics')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 px-2 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'analytics' ? 'bg-white text-emerald-600 shadow-md scale-100' : 'text-slate-400 hover:text-white hover:bg-slate-700/50 scale-95'}`}>
                <span className="text-lg">📊</span> <span className="whitespace-nowrap">{t.analytics}</span>
              </button>
            </div>
          </header>

          {activeTab === 'analytics' ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 animate-in fade-in">
              <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100">{t.analytics} & Performance</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 flex flex-col items-center justify-center text-center">
                  <div className="text-5xl mb-2">🔥</div>
                  <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{calculateStreak()}</h3>
                  <p className="text-slate-600 dark:text-slate-400 font-medium">{t.statsStreak}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/50 flex flex-col items-center justify-center text-center">
                  <div className="text-5xl mb-2">📈</div>
                  <h3 className="text-3xl font-black text-blue-600 dark:text-blue-400">{calculateCompletionRate()}%</h3>
                  <p className="text-slate-600 dark:text-slate-400 font-medium">{t.statsRate}</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold mb-4">{t.statsVolume} (Total: {Object.values(getVolumeData()).reduce((a,b)=>a+b,0)} {t.sets})</h3>
                {(() => {
                  const vol = getVolumeData();
                  const total = Object.values(vol).reduce((a,b)=>a+b, 0) || 1; // previne div por zero
                  return (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1"><span className="text-blue-500">Peito & Tríceps</span><span>{Math.round((vol.peitoTri/total)*100)}%</span></div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full"><div className="h-full bg-blue-500 rounded-full" style={{width:`${(vol.peitoTri/total)*100}%`}}></div></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1"><span className="text-emerald-500">Costas & Bíceps</span><span>{Math.round((vol.costasBi/total)*100)}%</span></div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full"><div className="h-full bg-emerald-500 rounded-full" style={{width:`${(vol.costasBi/total)*100}%`}}></div></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1"><span className="text-amber-500">Pernas</span><span>{Math.round((vol.pernas/total)*100)}%</span></div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full"><div className="h-full bg-amber-500 rounded-full" style={{width:`${(vol.pernas/total)*100}%`}}></div></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1"><span className="text-purple-500">Ombros & Core</span><span>{Math.round((vol.ombrosCore/total)*100)}%</span></div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full"><div className="h-full bg-purple-500 rounded-full" style={{width:`${(vol.ombrosCore/total)*100}%`}}></div></div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          ) : (
            <section className="space-y-4">
              {workoutData.map((dayData, index) => {
                const isExpanded = expandedDay === index;
                const progress = getDayProgress(index);
                const isToday = currentDayIndex === index;

                return (
                  <div key={index} className={`bg-white dark:bg-slate-900 rounded-3xl shadow-sm border overflow-hidden transition-all duration-300 ${isExpanded ? 'border-blue-200 dark:border-slate-600 shadow-md' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}>
                    <button 
                      onClick={() => setExpandedDay(isExpanded ? -1 : index)}
                      className="w-full text-left p-4 md:p-6 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-800/40 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner border transition-colors ${isToday ? 'bg-emerald-100 border-emerald-200 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400' : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}>
                          {isExpanded ? <span className="text-xl">▲</span> : <span className="text-xl">▼</span>}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] md:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dia {index + 1}</span>
                            {isToday && <span className="bg-emerald-500 text-white dark:bg-emerald-600 text-[9px] md:text-[10px] px-2 py-0.5 rounded-full font-bold">{t.today}</span>}
                          </div>
                          <h2 className="text-base md:text-xl font-bold text-slate-800 dark:text-slate-100">{dayData.day}</h2>
                        </div>
                      </div>
                      
                      <div className="hidden md:flex flex-col items-end w-48 shrink-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs ${progress === 100 ? '' : 'grayscale opacity-50'}`}>✅</span>
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{progress}% {t.completed}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-emerald-400 h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    </button>

                    <div className="md:hidden w-full bg-slate-100 dark:bg-slate-800 h-1.5 overflow-hidden">
                      <div className="bg-emerald-400 h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
                        
                        {jetLagMode && (
                          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300 rounded-2xl flex gap-3 transition-colors">
                            <span className="text-lg shrink-0 mt-0.5">✈️</span>
                            <p className="text-sm"><strong>Modo Jet Lag:</strong> As séries foram reduzidas para no máximo 2. Faça um treino rápido e focado.</p>
                          </div>
                        )}

                        <ul className="grid grid-cols-1 gap-4">
                          {dayData[activeTab].map((baseEx, i) => {
                            const isSwapped = swappedExercises[`${index}-${activeTab}-${i}`];
                            const ex = isSwapped && baseEx.alt ? baseEx.alt : baseEx;

                            const originalSets = parseInt(baseEx.sets) || 1;
                            const numSets = jetLagMode ? Math.min(2, originalSets) : originalSets;
                            const completedCount = getCompletedCount(index, activeTab, i, numSets);
                            const isInfoExpanded = expandedInfo === `${index}-${activeTab}-${i}`;
                            const themeColor = activeTab === 'home' ? 'blue' : 'amber';
                            
                            const weightKey = `${index}-${activeTab}-${i}`;
                            const currentWeight = weights[weightKey] || '';
                            
                            return (
                              <li key={i} className={`flex flex-col bg-white dark:bg-slate-900 rounded-2xl p-4 md:p-5 border transition-all ${completedCount === numSets ? 'border-emerald-300 dark:border-emerald-800/50 shadow-sm bg-emerald-50/20 dark:bg-emerald-900/10' : `border-slate-200 dark:border-slate-800 hover:border-${themeColor}-300 dark:hover:border-slate-600 hover:shadow-md`}`}>
                                
                                <div className="flex items-start gap-3 md:gap-4">
                                  <span className={`text-2xl md:text-3xl w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-xl shadow-sm border shrink-0 transition-colors ${completedCount === numSets ? 'bg-emerald-100 border-emerald-200 opacity-80 dark:bg-emerald-900/30 dark:border-emerald-800' : `bg-${themeColor}-50 border-${themeColor}-100 dark:bg-${themeColor}-900/20 dark:border-${themeColor}-800/50`}`}>
                                    {ex.icon}
                                  </span>
                                  
                                  <div className="flex-1 pb-1">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                                      <div className="flex items-center gap-2">
                                        <p className={`font-bold text-sm md:text-base leading-tight ${completedCount === numSets ? 'text-emerald-800 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}`}>
                                          {i + 1}. {ex.name}
                                        </p>
                                        {baseEx.alt && (
                                          <button onClick={() => toggleSwapExercise(index, activeTab, i)} className="p-1 text-slate-400 hover:text-blue-500 bg-slate-100 dark:bg-slate-800 rounded-md transition-colors" title="Trocar Exercício">
                                            <span className="text-xs">↔️</span>
                                          </button>
                                        )}
                                      </div>
                                      {ex.position && activeTab === 'home' && (
                                        <span className={`self-start sm:self-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold tracking-wider uppercase border ${getPositionStyle(ex.position)}`}>
                                          <span className="text-xs">📍</span> {ex.position}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mb-2">{ex.desc}</p>
                                    
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="bg-slate-800 text-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-[9px] md:text-[10px] font-bold tracking-wider uppercase shadow-sm">
                                        {numSets} {t.sets}
                                      </span>
                                      <span className={`bg-${themeColor}-100 text-${themeColor}-800 dark:bg-${themeColor}-900/30 dark:text-${themeColor}-300 px-2 py-1 rounded text-[9px] md:text-[10px] font-bold tracking-wider uppercase shadow-sm`}>
                                        {baseEx.reps}
                                      </span>
                                      
                                      <button 
                                        onClick={() => setExpandedInfo(isInfoExpanded ? null : `${index}-${activeTab}-${i}`)}
                                        className={`ml-auto flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] md:text-xs font-semibold transition-colors ${isInfoExpanded ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                                      >
                                        <span className="text-xs">ℹ️</span>
                                        <span className="hidden xs:inline">Instruções</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {isInfoExpanded && (
                                  <div className="mt-4 p-4 bg-slate-800 text-white dark:bg-slate-950 dark:border dark:border-slate-800 rounded-xl text-xs md:text-sm leading-relaxed animate-in slide-in-from-top-2">
                                    {ex.instructions}
                                  </div>
                                )}

                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="text-[9px] md:text-[10px] text-slate-400 font-semibold uppercase mb-2 flex justify-between items-center max-w-[250px]">
                                      <span>{t.markSets}</span>
                                      <span className={completedCount === numSets ? "text-emerald-600 font-bold" : `text-${themeColor}-500 dark:text-${themeColor}-400`}>
                                        {completedCount} / {numSets}
                                      </span>
                                    </div>
                                    <div className="flex gap-2">
                                      {Array.from({ length: numSets }).map((_, setIdx) => {
                                        const isChecked = completedSets[`${index}-${activeTab}-${i}-${setIdx}`];
                                        return (
                                          <button
                                            key={setIdx}
                                            onClick={() => toggleSet(index, activeTab, i, setIdx)}
                                            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95 border ${isChecked ? 'bg-emerald-500 text-white border-emerald-500 scale-105' : `bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 hover:bg-${themeColor}-100 hover:text-${themeColor}-600 hover:border-${themeColor}-300 dark:hover:bg-${themeColor}-900/30 dark:hover:text-${themeColor}-400 dark:hover:border-${themeColor}-700`}`}
                                          >
                                            {isChecked ? <span className="text-sm md:text-base">✅</span> : <span className="text-sm md:text-base font-bold">{setIdx + 1}</span>}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* PROGRESSIVE OVERLOAD (WEIGHT TRACKER) */}
                                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700 w-full md:w-48 shrink-0">
                                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1 block">
                                      {t.weight}
                                    </label>
                                    <div className="relative">
                                      <input 
                                        type="text" 
                                        value={currentWeight}
                                        onChange={(e) => updateWeight(index, activeTab, i, e.target.value)}
                                        placeholder="Ex: 24" 
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:font-normal placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                      />
                                    </div>
                                  </div>
                                </div>

                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

        </div>

        {/* FLOATING TIMER BAR */}
        <div className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-500 ${timer.active ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="max-w-md mx-auto p-4 mb-2">
            <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-lg border border-slate-700 shadow-2xl rounded-2xl p-4 flex items-center justify-between text-white relative overflow-hidden transition-colors">
              <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-1000 ease-linear" style={{ width: `${(timer.time / timer.total) * 100}%` }}></div>
              <div className="flex items-center gap-4 z-10">
                <div className="bg-slate-800 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-700 transition-colors">
                  <span className={`text-2xl ${timer.time <= 10 && timer.time > 0 ? 'animate-pulse' : ''}`}>⏱️</span>
                </div>
                <div>
                  <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider">{t.rest}</p>
                  <p className="text-xl md:text-2xl font-mono font-bold leading-none">{formatTime(timer.time)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 z-10 bg-slate-800/50 rounded-lg p-1 mr-1 md:mr-2">
                <button onClick={() => adjustTimer(-15)} className="p-1.5 md:p-2 text-slate-400 hover:text-white transition-colors" title="-15 Segundos">
                  <span className="font-bold">➖</span>
                </button>
                <button onClick={() => adjustTimer(30)} className="p-1.5 md:p-2 text-slate-400 hover:text-white transition-colors" title="+30 Segundos">
                  <span className="font-bold">➕</span>
                </button>
              </div>
              <div className="flex gap-1 md:gap-2 z-10">
                <button onClick={() => setTimer(prev => ({ ...prev, active: !prev.active }))} className="p-2 md:p-3 bg-slate-800 dark:bg-slate-900 hover:bg-slate-700 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center">
                  {timer.active && timer.time > 0 ? <span className="text-amber-400 text-lg leading-none">⏹️</span> : <span className="text-emerald-400 text-lg leading-none">▶️</span>}
                </button>
                <button onClick={() => setTimer({ active: false, time: 0, total: 60 })} className="p-2 md:p-3 bg-slate-800 dark:bg-slate-900 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl transition-colors flex items-center justify-center">
                  <span className="text-lg leading-none">❌</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;