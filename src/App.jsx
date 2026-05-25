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
    profileLabel: "PERFIL",
    heatmapLabel: "LINK",
    resetShort: "[RST]",
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
    cockpitEyebrow: "Painel de hoje",
    cockpitBody: "Comece a sessão planejada de 50 minutos, mude para hotel quando estiver viajando ou use Jet Lag para manter o hábito com menos séries.",
    startToday: "Começar hoje",
    useHomePlan: "Usar plano de casa",
    useHotelPlan: "Usar plano de hotel",
    lowEnergy: "Baixa energia",
    lowEnergyOn: "Baixa energia ativa",
    metricToday: "Hoje",
    metricSets: "Séries",
    metricStreak: "Sequência",
    nextUp: "A seguir",
    sessionComplete: "Sessão concluída",
    sessionCompleteBody: "O treino de hoje está registrado. Mantenha a sequência.",
    setsDoneText: "séries feitas",
    restText: "Descanso",
    dataPointOne: "DADO.01",
    dataPointTwo: "DADO.02",
    volumeShort: "VOL",
    categories: {
      push: "EMPURRAR",
      pull: "PUXAR",
      legs: "PERNAS",
      shouldersArmsCore: "OMBROS // BRAÇOS // CORE",
      recovery: "RECUPERAÇÃO // MOBILIDADE",
    },
    locLabel: "LOC",
    targetLabel: "OBJ",
    setShort: "S",
    repsShort: "R",
    mobilityLabel: "MOBILIDADE",
    swap: "[TROCAR]",
    altTitle: "Alternativa",
    info: "[INFO]",
    guidanceCues: "Pistas",
    guidanceAvoid: "Evite",
    guidanceSetup: "Preparação",
    close: "[X]",
    days: ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"],
    guidance: {
      squat: {
        cues: ["Pressão no pé inteiro", "Joelho acompanha os dedos", "Controle o fundo do movimento"],
        mistakes: ["Deixar os joelhos caírem para dentro", "Apressar a descida"],
        setup: ["Libere espaço no chão", "Use cadeira, parede ou cama para equilíbrio se necessário"],
      },
      press: {
        cues: ["Costelas para baixo", "Ombros estáveis", "Pare uma repetição limpa antes da forma quebrar"],
        mistakes: ["Encolher os ombros em direção ao pescoço", "Abrir as costelas para terminar repetições"],
        setup: ["Ajuste o ângulo dos punhos primeiro", "Escolha a inclinação que permite movimento suave"],
      },
      pull: {
        cues: ["Comece pelas escápulas", "Puxe os cotovelos em direção às costelas", "Mantenha o pescoço longo"],
        mistakes: ["Puxar no tranco com os braços", "Perder tensão no tronco"],
        setup: ["Teste a estabilidade do apoio antes de carregar", "Use tempo mais lento quando a carga for leve"],
      },
      core: {
        cues: ["Expire antes do esforço", "Trave costelas sobre pelve", "Reduza a amplitude antes de perder a contração"],
        mistakes: ["Arquear a lombar", "Prender a respiração durante toda a série"],
        setup: ["Comece mais fácil do que parece necessário", "Termine a série quando a contração desaparecer"],
      },
      mobility: {
        cues: ["Respire devagar", "Mova sem dor", "Use a expiração para ganhar amplitude"],
        mistakes: ["Forçar o fim da amplitude", "Transformar mobilidade em alongamento máximo"],
        setup: ["Mantenha leve após séries pesadas", "Reduza se sentir dor aguda ou sintomas nervosos"],
      },
      general: {
        cues: ["Mova com intenção", "Mantenha tensão onde interessa", "Deixe uma repetição limpa em reserva"],
        mistakes: ["Priorizar velocidade em vez de controle", "Deixar a fadiga mudar o movimento"],
        setup: ["Confira espaço e apoio dos pés", "Use a versão mais fácil que seja repetível hoje"],
      },
      bodyweightProgression: "Progrida adicionando repetições limpas, tempo mais lento, pausas mais longas ou uma variação mais difícil.",
      weightedProgression: "Quando todas as séries chegarem ao topo da faixa de repetições com forma limpa, aumente a menor carga possível na próxima vez.",
    },
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
    profileLabel: "PROFILE",
    heatmapLabel: "LINK",
    resetShort: "[RST]",
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
    cockpitEyebrow: "Today cockpit",
    cockpitBody: "Start the planned 50-minute session, switch to hotel mode when traveling, or use Low Energy mode to keep the habit alive with fewer sets.",
    startToday: "Start today",
    useHomePlan: "Use home plan",
    useHotelPlan: "Use hotel plan",
    lowEnergy: "Low energy",
    lowEnergyOn: "Low energy on",
    metricToday: "Today",
    metricSets: "Sets",
    metricStreak: "Streak",
    nextUp: "Next up",
    sessionComplete: "Session complete",
    sessionCompleteBody: "Today is logged. Keep the streak clean.",
    setsDoneText: "sets done",
    restText: "Rest",
    dataPointOne: "DATA.01",
    dataPointTwo: "DATA.02",
    volumeShort: "VOL",
    categories: {
      push: "PUSH",
      pull: "PULL",
      legs: "LEGS",
      shouldersArmsCore: "SHOULDERS // ARMS // CORE",
      recovery: "RECOVERY // MOBILITY",
    },
    locLabel: "LOC",
    targetLabel: "TGT",
    setShort: "S",
    repsShort: "R",
    mobilityLabel: "MOBILITY",
    swap: "[SWAP]",
    altTitle: "Alternative",
    info: "[INFO]",
    guidanceCues: "Cues",
    guidanceAvoid: "Avoid",
    guidanceSetup: "Setup",
    close: "[X]",
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    guidance: {
      squat: {
        cues: ["Full-foot pressure", "Knee tracks over toes", "Control the bottom"],
        mistakes: ["Collapsing knees inward", "Rushing the descent"],
        setup: ["Clear floor space", "Use a chair, wall, or bed edge for balance if needed"],
      },
      press: {
        cues: ["Ribs down", "Shoulders stable", "Stop one clean rep before form breaks"],
        mistakes: ["Shrugging into the neck", "Flaring ribs to finish reps"],
        setup: ["Set wrist angle first", "Choose the incline that lets you move smoothly"],
      },
      pull: {
        cues: ["Start with shoulder blades", "Pull elbows toward ribs", "Keep neck long"],
        mistakes: ["Yanking with the arms", "Losing trunk tension"],
        setup: ["Test anchor stability before loading", "Use a slower tempo when equipment is light"],
      },
      core: {
        cues: ["Exhale before effort", "Lock ribs over pelvis", "Scale range before losing brace"],
        mistakes: ["Arching the lower back", "Holding breath through the whole set"],
        setup: ["Start easier than you think", "End the set when the brace disappears"],
      },
      mobility: {
        cues: ["Breathe slowly", "Move without pain", "Use exhale to increase range"],
        mistakes: ["Forcing end range", "Turning mobility into a max-effort stretch"],
        setup: ["Keep it gentle after hard sets", "Back off if you feel sharp pain or nerve symptoms"],
      },
      general: {
        cues: ["Move deliberately", "Keep tension where intended", "Leave one clean rep in reserve"],
        mistakes: ["Chasing speed over control", "Letting fatigue change the movement"],
        setup: ["Check space and footing", "Use the easiest version that feels repeatable today"],
      },
      bodyweightProgression: "Progress by adding clean reps, slower tempo, longer holds, or a harder variation.",
      weightedProgression: "When all sets hit the top of the rep range with clean form, add the smallest load next time.",
    },
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
    profileLabel: "PERFIL",
    heatmapLabel: "LINK",
    resetShort: "[RST]",
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
    cockpitEyebrow: "Panel de hoy",
    cockpitBody: "Empieza la sesión planificada de 50 minutos, cambia al modo hotel cuando viajes o usa Baja Energía para mantener el hábito con menos series.",
    startToday: "Empezar hoy",
    useHomePlan: "Usar plan de casa",
    useHotelPlan: "Usar plan de hotel",
    lowEnergy: "Baja energía",
    lowEnergyOn: "Baja energía activa",
    metricToday: "Hoy",
    metricSets: "Series",
    metricStreak: "Racha",
    nextUp: "Siguiente",
    sessionComplete: "Sesión completa",
    sessionCompleteBody: "El entrenamiento de hoy está registrado. Mantén la racha.",
    setsDoneText: "series hechas",
    restText: "Descanso",
    dataPointOne: "DATO.01",
    dataPointTwo: "DATO.02",
    volumeShort: "VOL",
    categories: {
      push: "EMPUJE",
      pull: "TIRÓN",
      legs: "PIERNAS",
      shouldersArmsCore: "HOMBROS // BRAZOS // CORE",
      recovery: "RECUPERACIÓN // MOVILIDAD",
    },
    locLabel: "UBI",
    targetLabel: "OBJ",
    setShort: "S",
    repsShort: "R",
    mobilityLabel: "MOVILIDAD",
    swap: "[CAMBIAR]",
    altTitle: "Alternativa",
    info: "[INFO]",
    guidanceCues: "Claves",
    guidanceAvoid: "Evita",
    guidanceSetup: "Preparación",
    close: "[X]",
    days: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
    guidance: {
      squat: {
        cues: ["Presión en todo el pie", "La rodilla sigue la línea de los dedos", "Controla la parte baja"],
        mistakes: ["Dejar que las rodillas caigan hacia dentro", "Acelerar la bajada"],
        setup: ["Despeja espacio en el suelo", "Usa silla, pared o borde de la cama para equilibrio si hace falta"],
      },
      press: {
        cues: ["Costillas abajo", "Hombros estables", "Para una repetición limpia antes de perder la técnica"],
        mistakes: ["Encoger los hombros hacia el cuello", "Abrir las costillas para terminar repeticiones"],
        setup: ["Ajusta primero el ángulo de las muñecas", "Elige la inclinación que permita moverte con fluidez"],
      },
      pull: {
        cues: ["Empieza con los omóplatos", "Tira los codos hacia las costillas", "Mantén el cuello largo"],
        mistakes: ["Tirar con los brazos de golpe", "Perder tensión en el tronco"],
        setup: ["Comprueba la estabilidad del apoyo antes de cargar", "Usa un tempo más lento cuando la carga sea ligera"],
      },
      core: {
        cues: ["Exhala antes del esfuerzo", "Bloquea costillas sobre pelvis", "Reduce rango antes de perder la tensión"],
        mistakes: ["Arquear la zona lumbar", "Aguantar la respiración toda la serie"],
        setup: ["Empieza más fácil de lo que crees", "Termina la serie cuando desaparezca la tensión"],
      },
      mobility: {
        cues: ["Respira despacio", "Muévete sin dolor", "Usa la exhalación para ganar rango"],
        mistakes: ["Forzar el final del rango", "Convertir la movilidad en un estiramiento máximo"],
        setup: ["Hazlo suave después de series duras", "Reduce si notas dolor agudo o síntomas nerviosos"],
      },
      general: {
        cues: ["Muévete con intención", "Mantén tensión donde toca", "Deja una repetición limpia en reserva"],
        mistakes: ["Buscar velocidad antes que control", "Dejar que la fatiga cambie el movimiento"],
        setup: ["Comprueba espacio y apoyo de pies", "Usa la versión más fácil que puedas repetir hoy"],
      },
      bodyweightProgression: "Progresa añadiendo repeticiones limpias, tempo más lento, pausas más largas o una variante más difícil.",
      weightedProgression: "Cuando todas las series lleguen al máximo del rango con técnica limpia, añade la menor carga posible la próxima vez.",
    },
  }
};

const workoutTranslations = {
  pt: {
    "Thoracic Bench Extensions": "Extensões Torácicas no Banco",
    "Bench/Floor": "Banco/chão",
    "Kneel facing the bench with elbows on the pad and hands behind the head. Drop the chest toward the floor and breathe deeply into the lats and thoracic spine.": "Ajoelhe-se de frente para o banco, com os cotovelos no apoio e as mãos atrás da cabeça. Desça o peito em direção ao chão e respire fundo nos dorsais e na coluna torácica.",
    "World's Greatest Stretch": "Maior Alongamento do Mundo",
    "Floor": "Chão",
    "Step into a deep lunge, place the opposite hand on the floor, reach the near-side hand to the instep, then rotate open toward the ceiling. Perform slow rotations on both sides.": "Entre num afundo profundo, coloque a mão oposta no chão, leve a mão do lado da perna da frente ao peito do pé e depois rode abrindo para o teto. Faça rotações lentas nos dois lados.",
    "90/90 Hip Switches": "Trocas de Quadril 90/90",
    "Sit tall with both knees bent at 90 degrees. Pivot on the heels to switch both knees side to side while keeping the torso upright.": "Sente-se alto com os dois joelhos dobrados a 90 graus. Gire sobre os calcanhares para trocar os joelhos de lado mantendo o tronco ereto.",
    "Downward Dog to Cobra": "Cão Olhando para Baixo para Cobra",
    "Alternate between Downward Dog, pedaling out calves and hamstrings, and Cobra with hips on the floor, chest up, and neck neutral.": "Alterne entre Cão Olhando para Baixo, soltando panturrilhas e posteriores, e Cobra com quadris no chão, peito alto e pescoço neutro.",
    "Progressive Seated Forward Fold": "Flexão Sentada Progressiva",
    "Sit tall with legs straight and toes pulled back. Hinge at the hips on each exhale, then gently round the upper back and aim the top of the head toward the knees.": "Sente-se alto com as pernas estendidas e os dedos puxados para trás. Dobre a partir do quadril a cada expiração, depois arredonde suavemente a parte alta das costas e mire o topo da cabeça em direção aos joelhos.",
    "Push (Chest Focus) & Core": "Empurrar (Foco em Peito) e Core",
    "40m resistance + 10m mobility": "40 min resistência + 10 min mobilidade",
    "40m functional + 10m mobility": "40 min funcional + 10 min mobilidade",
    "20m light flow + 30m mobility": "20 min fluxo leve + 30 min mobilidade",
    "DB Bench Press": "Supino com Halteres",
    "Flat bench": "Banco plano",
    "Heavy strength": "Força pesada",
    "Use the heaviest controlled load. Plant long legs firmly, keep shoulder blades retracted, and press from a stable flat-bench base.": "Use a carga mais pesada que consiga controlar. Apoie bem as pernas longas, mantenha as escápulas retraídas e empurre a partir de uma base estável no banco plano.",
    "Incline DB Fly + Decline Push-Ups": "Crucifixo Inclinado com Halteres + Flexões Decline",
    "30 degree bench": "Banco a 30 graus",
    "Superset": "Superset",
    "Perform incline flys, immediately move to decline push-ups with feet on the flat bench, then rest. Keep flys controlled and push-ups crisp.": "Faça crucifixos inclinados, passe imediatamente para flexões decline com os pés no banco plano e depois descanse. Mantenha crucifixos controlados e flexões limpas.",
    "Weighted Bench Crunches": "Abdominais no Banco com Carga",
    "Decline/flat bench": "Banco declinado/plano",
    "Core flexion": "Flexão do core",
    "Hold one dumbbell at the chest. Control the descent and avoid hyperextending the lower back.": "Segure um halter no peito. Controle a descida e evite hiperextender a lombar.",
    "Hollow Body Holds": "Hollow Hold",
    "Core brace": "Contração do core",
    "Press the lower back down, extend arms and legs only as far as you can hold a hard brace, and breathe behind the tension.": "Pressione a lombar contra o chão, estenda braços e pernas só até onde consiga manter uma contração forte e respire por trás da tensão.",
    "Incline Push-Ups": "Flexões Inclinadas",
    "Hands elevated": "Mãos elevadas",
    "Use a bed, desk, or wall to match the day's heavy press intent. Lower under control and keep shoulder blades stable.": "Use cama, mesa ou parede para manter a intenção de empurrar pesado do dia. Desça com controle e mantenha as escápulas estáveis.",
    "Wall Push-Ups": "Flexões na Parede",
    "Low fatigue": "Baixa fadiga",
    "Use a wall for lower-load pressing while preserving the same shoulder and trunk position.": "Use uma parede para empurrar com menor carga mantendo a mesma posição de ombros e tronco.",
    "Feet-Elevated or Knee Push-Ups": "Flexões com Pés Elevados ou Joelhos",
    "Chest volume": "Volume de peito",
    "Choose feet-elevated if fresh or knee push-ups if fatigued. Stop with one clean rep in reserve.": "Escolha pés elevados se estiver bem ou flexões de joelhos se estiver cansado. Pare com uma repetição limpa em reserva.",
    "Towel Chest Fly Isometrics": "Isometria de Crucifixo com Toalha",
    "Chest squeeze": "Contração do peito",
    "Pull a towel apart while squeezing the chest hard, then slowly pulse tension in and out.": "Puxe uma toalha para fora enquanto contrai forte o peito, depois pulse lentamente a tensão.",
    "Keep the lower back pinned down and reduce limb length if the brace breaks.": "Mantenha a lombar colada ao chão e reduza o comprimento dos membros se a contração falhar.",
    "Legs (Quad Focus) & Core": "Pernas (Foco em Quadríceps) e Core",
    "DB Goblet Squats": "Agachamento Goblet com Halter",
    "Standing": "Em pé",
    "Quad focus": "Foco em quadríceps",
    "Hold one dumbbell at the chest. Elevate heels slightly on plates if ankle mobility restricts depth.": "Segure um halter no peito. Eleve levemente os calcanhares em anilhas se a mobilidade do tornozelo limitar a profundidade.",
    "Bulgarian Split Squats": "Agachamento Búlgaro",
    "Rear foot on flat bench": "Pé de trás no banco plano",
    "Single-leg strength": "Força unilateral",
    "Lean the torso slightly forward, keep the front knee tracking over the toes, and use the bench only as rear-foot support.": "Incline o tronco levemente à frente, mantenha o joelho da frente alinhado aos dedos e use o banco apenas como apoio do pé de trás.",
    "DB Reverse Lunges": "Afundos Reversos com Halteres",
    "Controlled lunge": "Afundo controlado",
    "Step back smoothly, keep the front foot rooted, and return without bouncing off the rear knee.": "Dê o passo para trás com suavidade, mantenha o pé da frente firme e volte sem quicar no joelho de trás.",
    "Forearm Plank with DB Pull-Throughs": "Prancha de Antebraço com Arraste de Halter",
    "Anti-rotation core": "Core anti-rotação",
    "Set a wide plank, drag the dumbbell across without letting hips rotate, and reset the brace between pulls.": "Monte uma prancha ampla, arraste o halter sem deixar o quadril rodar e reforce a contração entre puxadas.",
    "Bodyweight Squats": "Agachamentos com Peso Corporal",
    "Use a slow descent and full-foot pressure. Elevate heels on a book if it improves depth.": "Use descida lenta e pressão no pé inteiro. Eleve os calcanhares num livro se isso melhorar a profundidade.",
    "Rear foot on bed/chair": "Pé de trás na cama/cadeira",
    "Keep the front knee tracking and lean slightly forward to protect the knee while loading the glute.": "Mantenha o joelho da frente alinhado e incline levemente à frente para proteger o joelho enquanto carrega o glúteo.",
    "Reverse Lunges": "Afundos Reversos",
    "Travel legs": "Pernas para viagem",
    "Step back with control and keep the torso tall enough to maintain balance.": "Dê o passo para trás com controle e mantenha o tronco alto o suficiente para equilibrar.",
    "Forearm Plank Reach-Throughs": "Prancha de Antebraço com Alcance Cruzado",
    "Reach one hand under the torso without rolling the hips, then return to a square plank.": "Passe uma mão por baixo do tronco sem rodar o quadril e volte para uma prancha alinhada.",
    "Pull (Back Focus) & Core": "Puxar (Foco em Costas) e Core",
    "Chest-Supported DB Rows": "Remada com Halteres Apoiada no Peito",
    "45 degree incline bench": "Banco inclinado a 45 graus",
    "Supported strength": "Força com apoio",
    "Lie face down on the incline bench to remove the lower back from the lift. Pull heavy with a stable chest support.": "Deite de bruços no banco inclinado para tirar a lombar do exercício. Puxe pesado com o peito bem apoiado.",
    "DB Pullovers + Chest-Supported Reverse Flys": "Pullover com Halter + Crucifixo Inverso Apoiado",
    "Flat + 45 degree bench": "Banco plano + 45 graus",
    "Perform pullovers lying perpendicular across the flat bench, then move directly to reverse flys on the 45 degree bench before resting.": "Faça pullovers deitado perpendicularmente no banco plano, depois passe direto para crucifixos inversos no banco a 45 graus antes de descansar.",
    "Dead Bugs": "Dead Bugs",
    "Slow core control": "Controle lento do core",
    "Move slowly and keep the lower back connected to the floor through every rep.": "Mova devagar e mantenha a lombar conectada ao chão em cada repetição.",
    "Towel Door Rows": "Remada na Porta com Toalha",
    "Back strength": "Força de costas",
    "Anchor a towel securely around a closed door handle and row with a braced trunk. Use only a safe, solid setup.": "Prenda uma toalha com segurança numa maçaneta de porta fechada e reme com o tronco firme. Use apenas uma configuração segura e sólida.",
    "Bed Frame Rows": "Remada na Estrutura da Cama",
    "Use a stable bed frame only if it is safe and does not move.": "Use uma estrutura de cama estável apenas se for segura e não se mover.",
    "Prone Lat Pulls + Reverse Snow Angels": "Puxadas de Dorsal no Chão + Anjos Reversos",
    "Back superset": "Superset de costas",
    "On the floor, pull elbows toward ribs from overhead, then sweep arms through reverse snow angels.": "No chão, puxe os cotovelos de cima para as costelas e depois faça anjos reversos com os braços.",
    "Keep the ribs down and lower back fixed to the floor.": "Mantenha as costelas baixas e a lombar fixa no chão.",
    "Active Recovery & Deep Core": "Recuperação Ativa e Core Profundo",
    "Bodyweight Step-Ups": "Step-Ups com Peso Corporal",
    "Blood flow": "Fluxo sanguíneo",
    "Step onto the bench with control, stand tall at the top, and use a smooth descent.": "Suba no banco com controle, fique alto no topo e desça suavemente.",
    "Isometric Glute Bridges": "Pontes de Glúteo Isométricas",
    "Shoulders on bench": "Ombros no banco",
    "Posterior chain hold": "Sustentação da cadeia posterior",
    "Drive through the heels, lock the ribs down, and hold the top position without arching the lower back.": "Empurre pelos calcanhares, trave as costelas para baixo e sustente o topo sem arquear a lombar.",
    "Bird-Dogs": "Bird-Dogs",
    "Spinal control": "Controle da coluna",
    "Reach long through the opposite arm and leg while keeping hips square.": "Alcance longe com braço e perna opostos mantendo o quadril alinhado.",
    "Side Planks": "Pranchas Laterais",
    "Lateral core": "Core lateral",
    "Stack shoulder, ribs, hips, and feet. Keep the waist lifted for the full hold.": "Alinhe ombro, costelas, quadril e pés. Mantenha a cintura elevada durante toda a sustentação.",
    "Chair/step": "Cadeira/degrau",
    "Use a stable chair, stair, or low platform. Keep the movement easy and controlled.": "Use cadeira, escada ou plataforma baixa estável. Mantenha o movimento fácil e controlado.",
    "Floor hold": "Sustentação no chão",
    "Hold the bridge from the floor if no bench is available, keeping ribs down and glutes active.": "Sustente a ponte no chão se não houver banco, mantendo costelas baixas e glúteos ativos.",
    "Move slowly and avoid shifting weight side to side.": "Mova devagar e evite deslocar o peso de um lado para o outro.",
    "Use knees down if needed to keep a clean line and steady breathing.": "Apoie os joelhos se necessário para manter linha limpa e respiração estável.",
    "Shoulders & Arms & Core": "Ombros, Braços e Core",
    "Seated DB Overhead Press": "Desenvolvimento Sentado com Halteres",
    "90 degree upright bench": "Banco vertical a 90 graus",
    "Supported press": "Press com apoio",
    "Keep the back pressed firmly into the pad and press without flaring the ribs.": "Mantenha as costas firmes no encosto e empurre sem abrir as costelas.",
    "DB Lateral Raises + DB Front Raises": "Elevações Laterais + Frontais com Halteres",
    "Shoulder superset": "Superset de ombros",
    "Perform lateral raises, immediately perform front raises, then rest. Use clean shoulder height reps.": "Faça elevações laterais, depois elevações frontais imediatamente e então descanse. Use repetições limpas até a altura dos ombros.",
    "DB Bicep Curls + DB Overhead Triceps Extension": "Rosca Bíceps + Tríceps Acima da Cabeça com Halteres",
    "Standing/seated": "Em pé/sentado",
    "Arms superset": "Superset de braços",
    "Alternate curls, then sit for the overhead triceps extension. Keep elbows controlled in both movements.": "Alterne roscas, depois sente para a extensão de tríceps acima da cabeça. Mantenha cotovelos controlados nos dois movimentos.",
    "Russian Twists": "Torções Russas",
    "Rotational core": "Core rotacional",
    "Hold one dumbbell, rotate through the trunk, and keep the motion controlled instead of bouncing.": "Segure um halter, rode pelo tronco e mantenha o movimento controlado em vez de quicar.",
    "Pike Push-Ups": "Flexões Pike",
    "Shoulder press": "Press de ombros",
    "Use a pike position to bias shoulders. Shorten the range if neck or wrist position degrades.": "Use posição pike para enfatizar ombros. Reduza a amplitude se pescoço ou punhos perderem posição.",
    "Arm Circles + Wall Front Raises": "Círculos de Braço + Elevações Frontais na Parede",
    "Use small hard circles, then press the backs of the hands into the wall while raising arms.": "Faça círculos pequenos e fortes, depois pressione o dorso das mãos na parede enquanto eleva os braços.",
    "Towel Bicep Curls + Wall Triceps Extensions": "Rosca Bíceps com Toalha + Extensões de Tríceps na Parede",
    "Curl against towel resistance under the thigh, then do triceps extensions against a wall or desk edge.": "Faça rosca contra a resistência da toalha sob a coxa, depois extensões de tríceps contra parede ou borda de mesa.",
    "Rotate with control and keep the feet grounded if the lower back starts compensating.": "Rode com controle e mantenha os pés no chão se a lombar começar a compensar.",
    "Legs (Glute/Ham Focus) & Core": "Pernas (Foco em Glúteos/Posteriores) e Core",
    "DB Romanian Deadlifts": "Levantamento Terra Romeno com Halteres",
    "Hinge mechanics": "Mecânica de dobradiça",
    "Push hips straight back, slide dumbbells down the thighs, and stop when hamstrings are fully stretched. Do not round the spine to go lower.": "Empurre o quadril para trás, deslize os halteres pelas coxas e pare quando os posteriores estiverem totalmente alongados. Não arredonde a coluna para descer mais.",
    "DB Hip Thrusts": "Hip Thrust com Halter",
    "Upper back on bench": "Parte alta das costas no banco",
    "Glute strength": "Força de glúteos",
    "Anchor the upper back on the bench, drive through the heels, and finish with glutes locked without lumbar extension.": "Apoie a parte alta das costas no banco, empurre pelos calcanhares e finalize travando glúteos sem estender a lombar.",
    "Hamstring Walkouts": "Caminhadas de Posteriores",
    "Hamstring control": "Controle de posteriores",
    "Start in a bridge, walk heels out slowly, then return while keeping hips lifted.": "Comece em ponte, caminhe lentamente os calcanhares para fora e volte mantendo o quadril elevado.",
    "Decline bench": "Banco declinado",
    "Hold one dumbbell at the chest and keep every rep controlled from top to bottom.": "Segure um halter no peito e mantenha cada repetição controlada de cima a baixo.",
    "Single-Leg Romanian Deadlifts": "Terra Romeno Unilateral",
    "Hinge control": "Controle de dobradiça",
    "Use bodyweight or luggage if available. Hinge from the hip and keep the spine long.": "Use peso corporal ou bagagem se disponível. Dobre pelo quadril e mantenha a coluna longa.",
    "Single-Leg Glute Bridges": "Ponte de Glúteo Unilateral",
    "Drive through the heel and pause at the top without arching the back.": "Empurre pelo calcanhar e pause no topo sem arquear as costas.",
    "Walk heels away from the hips slowly, then return with hips elevated.": "Caminhe os calcanhares para longe do quadril lentamente e depois volte com o quadril elevado.",
    "Slow Crunches": "Abdominais Lentos",
    "Move slowly and exhale through the top of every rep.": "Mova devagar e expire no topo de cada repetição.",
    "Active Recovery & Mobility Focus": "Recuperação Ativa e Foco em Mobilidade",
    "Light Bodyweight Flow": "Fluxo Leve com Peso Corporal",
    "Floor/standing": "Chão/em pé",
    "20 min relaxed pace": "20 min em ritmo relaxado",
    "Skip dumbbells. Move through unweighted squats, lunges, push-ups, and planks at a relaxed pace to encourage blood flow.": "Ignore os halteres. Faça agachamentos, afundos, flexões e pranchas sem carga em ritmo relaxado para estimular o fluxo sanguíneo.",
    "Use open floor space for unweighted squats, lunges, incline push-ups, and planks. Keep the pace restorative.": "Use espaço livre no chão para agachamentos, afundos, flexões inclinadas e pranchas sem carga. Mantenha um ritmo restaurativo.",
    "Failure": "Falha",
    "10 pulls/side": "10 puxadas/lado",
    "20 twists": "20 torções",
    "8 walkouts": "8 caminhadas",
    "8-10/leg": "8-10/perna",
    "10/leg": "10/perna",
    "15/leg": "15/perna",
    "8-12/leg": "8-12/perna",
    "10-12/leg": "10-12/perna",
    "10/side": "10/lado",
    "12/side": "12/lado",
    "45s/side": "45s/lado",
  },
  es: {
    "Thoracic Bench Extensions": "Extensiones Torácicas en Banco",
    "Bench/Floor": "Banco/suelo",
    "Kneel facing the bench with elbows on the pad and hands behind the head. Drop the chest toward the floor and breathe deeply into the lats and thoracic spine.": "Arrodíllate frente al banco con los codos en el apoyo y las manos detrás de la cabeza. Baja el pecho hacia el suelo y respira profundo hacia dorsales y columna torácica.",
    "World's Greatest Stretch": "El Mayor Estiramiento del Mundo",
    "Floor": "Suelo",
    "Step into a deep lunge, place the opposite hand on the floor, reach the near-side hand to the instep, then rotate open toward the ceiling. Perform slow rotations on both sides.": "Entra en una zancada profunda, coloca la mano opuesta en el suelo, lleva la mano del lado de la pierna delantera al empeine y rota abriendo hacia el techo. Haz rotaciones lentas en ambos lados.",
    "90/90 Hip Switches": "Cambios de Cadera 90/90",
    "Sit tall with both knees bent at 90 degrees. Pivot on the heels to switch both knees side to side while keeping the torso upright.": "Siéntate erguido con ambas rodillas a 90 grados. Gira sobre los talones para cambiar las rodillas de lado manteniendo el torso vertical.",
    "Downward Dog to Cobra": "Perro Boca Abajo a Cobra",
    "Alternate between Downward Dog, pedaling out calves and hamstrings, and Cobra with hips on the floor, chest up, and neck neutral.": "Alterna entre perro boca abajo, soltando gemelos e isquios, y cobra con caderas en el suelo, pecho alto y cuello neutro.",
    "Progressive Seated Forward Fold": "Flexión Sentada Progresiva",
    "Sit tall with legs straight and toes pulled back. Hinge at the hips on each exhale, then gently round the upper back and aim the top of the head toward the knees.": "Siéntate erguido con piernas estiradas y dedos hacia atrás. Flexiona desde la cadera en cada exhalación, luego redondea suavemente la parte alta de la espalda y lleva la coronilla hacia las rodillas.",
    "Push (Chest Focus) & Core": "Empuje (Foco Pecho) y Core",
    "40m resistance + 10m mobility": "40 min resistencia + 10 min movilidad",
    "40m functional + 10m mobility": "40 min funcional + 10 min movilidad",
    "20m light flow + 30m mobility": "20 min flujo suave + 30 min movilidad",
    "DB Bench Press": "Press de Banca con Mancuernas",
    "Flat bench": "Banco plano",
    "Heavy strength": "Fuerza pesada",
    "Use the heaviest controlled load. Plant long legs firmly, keep shoulder blades retracted, and press from a stable flat-bench base.": "Usa la carga más pesada que puedas controlar. Apoya bien las piernas largas, mantén los omóplatos retraídos y empuja desde una base estable en banco plano.",
    "Incline DB Fly + Decline Push-Ups": "Aperturas Inclinadas con Mancuernas + Flexiones Declive",
    "30 degree bench": "Banco a 30 grados",
    "Superset": "Superserie",
    "Perform incline flys, immediately move to decline push-ups with feet on the flat bench, then rest. Keep flys controlled and push-ups crisp.": "Haz aperturas inclinadas, pasa inmediatamente a flexiones declive con pies en el banco plano y luego descansa. Mantén aperturas controladas y flexiones limpias.",
    "Weighted Bench Crunches": "Crunch en Banco con Carga",
    "Decline/flat bench": "Banco declinado/plano",
    "Core flexion": "Flexión de core",
    "Hold one dumbbell at the chest. Control the descent and avoid hyperextending the lower back.": "Sujeta una mancuerna en el pecho. Controla la bajada y evita hiperextender la zona lumbar.",
    "Hollow Body Holds": "Hollow Hold",
    "Core brace": "Bloqueo de core",
    "Press the lower back down, extend arms and legs only as far as you can hold a hard brace, and breathe behind the tension.": "Presiona la zona lumbar contra el suelo, extiende brazos y piernas solo hasta donde puedas mantener una tensión fuerte y respira detrás de la tensión.",
    "Incline Push-Ups": "Flexiones Inclinadas",
    "Hands elevated": "Manos elevadas",
    "Use a bed, desk, or wall to match the day's heavy press intent. Lower under control and keep shoulder blades stable.": "Usa cama, escritorio o pared para mantener la intención de empuje pesado del día. Baja con control y mantén los omóplatos estables.",
    "Wall Push-Ups": "Flexiones en Pared",
    "Low fatigue": "Baja fatiga",
    "Use a wall for lower-load pressing while preserving the same shoulder and trunk position.": "Usa una pared para empujar con menor carga conservando la misma posición de hombros y tronco.",
    "Feet-Elevated or Knee Push-Ups": "Flexiones con Pies Elevados o Rodillas",
    "Chest volume": "Volumen de pecho",
    "Choose feet-elevated if fresh or knee push-ups if fatigued. Stop with one clean rep in reserve.": "Elige pies elevados si estás fresco o flexiones de rodillas si estás fatigado. Para con una repetición limpia en reserva.",
    "Towel Chest Fly Isometrics": "Isométrico de Apertura de Pecho con Toalla",
    "Chest squeeze": "Contracción de pecho",
    "Pull a towel apart while squeezing the chest hard, then slowly pulse tension in and out.": "Tira de una toalla hacia fuera mientras aprietas fuerte el pecho, luego pulsa lentamente la tensión.",
    "Keep the lower back pinned down and reduce limb length if the brace breaks.": "Mantén la lumbar pegada al suelo y acorta brazos o piernas si pierdes la tensión.",
    "Legs (Quad Focus) & Core": "Piernas (Foco Cuádriceps) y Core",
    "DB Goblet Squats": "Sentadilla Goblet con Mancuerna",
    "Standing": "De pie",
    "Quad focus": "Foco en cuádriceps",
    "Hold one dumbbell at the chest. Elevate heels slightly on plates if ankle mobility restricts depth.": "Sujeta una mancuerna en el pecho. Eleva ligeramente los talones sobre discos si la movilidad de tobillo limita la profundidad.",
    "Bulgarian Split Squats": "Sentadilla Búlgara",
    "Rear foot on flat bench": "Pie trasero en banco plano",
    "Single-leg strength": "Fuerza unilateral",
    "Lean the torso slightly forward, keep the front knee tracking over the toes, and use the bench only as rear-foot support.": "Inclina ligeramente el torso hacia delante, mantén la rodilla delantera alineada con los dedos y usa el banco solo como apoyo del pie trasero.",
    "DB Reverse Lunges": "Zancadas Inversas con Mancuernas",
    "Controlled lunge": "Zancada controlada",
    "Step back smoothly, keep the front foot rooted, and return without bouncing off the rear knee.": "Da el paso atrás con suavidad, mantén el pie delantero firme y vuelve sin rebotar con la rodilla trasera.",
    "Forearm Plank with DB Pull-Throughs": "Plancha de Antebrazos con Arrastre de Mancuerna",
    "Anti-rotation core": "Core antirotación",
    "Set a wide plank, drag the dumbbell across without letting hips rotate, and reset the brace between pulls.": "Monta una plancha amplia, arrastra la mancuerna sin dejar que la cadera rote y reajusta la tensión entre tirones.",
    "Bodyweight Squats": "Sentadillas con Peso Corporal",
    "Use a slow descent and full-foot pressure. Elevate heels on a book if it improves depth.": "Usa una bajada lenta y presión en todo el pie. Eleva los talones sobre un libro si mejora la profundidad.",
    "Rear foot on bed/chair": "Pie trasero en cama/silla",
    "Keep the front knee tracking and lean slightly forward to protect the knee while loading the glute.": "Mantén la rodilla delantera alineada e inclínate un poco hacia delante para proteger la rodilla mientras cargas el glúteo.",
    "Reverse Lunges": "Zancadas Inversas",
    "Travel legs": "Piernas de viaje",
    "Step back with control and keep the torso tall enough to maintain balance.": "Da el paso atrás con control y mantén el torso lo bastante alto para equilibrarte.",
    "Forearm Plank Reach-Throughs": "Plancha de Antebrazos con Alcance Cruzado",
    "Reach one hand under the torso without rolling the hips, then return to a square plank.": "Pasa una mano bajo el torso sin girar las caderas y vuelve a una plancha cuadrada.",
    "Pull (Back Focus) & Core": "Tirón (Foco Espalda) y Core",
    "Chest-Supported DB Rows": "Remo con Mancuernas Apoyado en Pecho",
    "45 degree incline bench": "Banco inclinado a 45 grados",
    "Supported strength": "Fuerza con apoyo",
    "Lie face down on the incline bench to remove the lower back from the lift. Pull heavy with a stable chest support.": "Túmbate boca abajo en el banco inclinado para quitar la lumbar del ejercicio. Tira pesado con el pecho estable.",
    "DB Pullovers + Chest-Supported Reverse Flys": "Pullover con Mancuerna + Apertura Inversa Apoyada",
    "Flat + 45 degree bench": "Banco plano + 45 grados",
    "Perform pullovers lying perpendicular across the flat bench, then move directly to reverse flys on the 45 degree bench before resting.": "Haz pullovers tumbado perpendicular al banco plano y pasa directamente a aperturas inversas en el banco a 45 grados antes de descansar.",
    "Dead Bugs": "Dead Bugs",
    "Slow core control": "Control lento de core",
    "Move slowly and keep the lower back connected to the floor through every rep.": "Muévete despacio y mantén la lumbar conectada al suelo en cada repetición.",
    "Towel Door Rows": "Remo en Puerta con Toalla",
    "Back strength": "Fuerza de espalda",
    "Anchor a towel securely around a closed door handle and row with a braced trunk. Use only a safe, solid setup.": "Ancla una toalla de forma segura en una manilla de puerta cerrada y rema con el tronco firme. Usa solo un montaje seguro y sólido.",
    "Bed Frame Rows": "Remo en Estructura de Cama",
    "Use a stable bed frame only if it is safe and does not move.": "Usa una estructura de cama estable solo si es segura y no se mueve.",
    "Prone Lat Pulls + Reverse Snow Angels": "Jalones de Dorsal en Suelo + Ángeles Inversos",
    "Back superset": "Superserie de espalda",
    "On the floor, pull elbows toward ribs from overhead, then sweep arms through reverse snow angels.": "En el suelo, tira los codos desde arriba hacia las costillas y luego barre los brazos en ángeles inversos.",
    "Keep the ribs down and lower back fixed to the floor.": "Mantén las costillas abajo y la lumbar fija al suelo.",
    "Active Recovery & Deep Core": "Recuperación Activa y Core Profundo",
    "Bodyweight Step-Ups": "Step-Ups con Peso Corporal",
    "Blood flow": "Flujo sanguíneo",
    "Step onto the bench with control, stand tall at the top, and use a smooth descent.": "Sube al banco con control, ponte alto arriba y baja suavemente.",
    "Isometric Glute Bridges": "Puentes de Glúteo Isométricos",
    "Shoulders on bench": "Hombros en banco",
    "Posterior chain hold": "Sostén de cadena posterior",
    "Drive through the heels, lock the ribs down, and hold the top position without arching the lower back.": "Empuja desde los talones, bloquea las costillas abajo y sostén arriba sin arquear la lumbar.",
    "Bird-Dogs": "Bird-Dogs",
    "Spinal control": "Control de columna",
    "Reach long through the opposite arm and leg while keeping hips square.": "Alarga brazo y pierna opuestos manteniendo las caderas cuadradas.",
    "Side Planks": "Planchas Laterales",
    "Lateral core": "Core lateral",
    "Stack shoulder, ribs, hips, and feet. Keep the waist lifted for the full hold.": "Alinea hombro, costillas, caderas y pies. Mantén la cintura elevada todo el tiempo.",
    "Chair/step": "Silla/escalón",
    "Use a stable chair, stair, or low platform. Keep the movement easy and controlled.": "Usa una silla, escalón o plataforma baja estable. Mantén el movimiento fácil y controlado.",
    "Floor hold": "Sostén en suelo",
    "Hold the bridge from the floor if no bench is available, keeping ribs down and glutes active.": "Sostén el puente desde el suelo si no hay banco, con costillas abajo y glúteos activos.",
    "Move slowly and avoid shifting weight side to side.": "Muévete despacio y evita desplazar el peso de lado a lado.",
    "Use knees down if needed to keep a clean line and steady breathing.": "Apoya las rodillas si hace falta para mantener una línea limpia y respiración estable.",
    "Shoulders & Arms & Core": "Hombros, Brazos y Core",
    "Seated DB Overhead Press": "Press Militar Sentado con Mancuernas",
    "90 degree upright bench": "Banco vertical a 90 grados",
    "Supported press": "Press con apoyo",
    "Keep the back pressed firmly into the pad and press without flaring the ribs.": "Mantén la espalda firme contra el respaldo y empuja sin abrir las costillas.",
    "DB Lateral Raises + DB Front Raises": "Elevaciones Laterales + Frontales con Mancuernas",
    "Shoulder superset": "Superserie de hombros",
    "Perform lateral raises, immediately perform front raises, then rest. Use clean shoulder height reps.": "Haz elevaciones laterales, inmediatamente elevaciones frontales y luego descansa. Usa repeticiones limpias hasta la altura de los hombros.",
    "DB Bicep Curls + DB Overhead Triceps Extension": "Curl de Bíceps + Extensión de Tríceps sobre la Cabeza con Mancuernas",
    "Standing/seated": "De pie/sentado",
    "Arms superset": "Superserie de brazos",
    "Alternate curls, then sit for the overhead triceps extension. Keep elbows controlled in both movements.": "Alterna curls y luego siéntate para la extensión de tríceps sobre la cabeza. Mantén los codos controlados en ambos movimientos.",
    "Russian Twists": "Giros Rusos",
    "Rotational core": "Core rotacional",
    "Hold one dumbbell, rotate through the trunk, and keep the motion controlled instead of bouncing.": "Sujeta una mancuerna, rota desde el tronco y mantén el movimiento controlado sin rebotar.",
    "Pike Push-Ups": "Flexiones Pike",
    "Shoulder press": "Press de hombros",
    "Use a pike position to bias shoulders. Shorten the range if neck or wrist position degrades.": "Usa posición pike para enfatizar hombros. Acorta el rango si cuello o muñecas pierden posición.",
    "Arm Circles + Wall Front Raises": "Círculos de Brazos + Elevaciones Frontales en Pared",
    "Use small hard circles, then press the backs of the hands into the wall while raising arms.": "Haz círculos pequeños y firmes, luego presiona el dorso de las manos contra la pared mientras elevas los brazos.",
    "Towel Bicep Curls + Wall Triceps Extensions": "Curl de Bíceps con Toalla + Extensiones de Tríceps en Pared",
    "Curl against towel resistance under the thigh, then do triceps extensions against a wall or desk edge.": "Haz curl contra la resistencia de una toalla bajo el muslo y luego extensiones de tríceps contra pared o borde de escritorio.",
    "Rotate with control and keep the feet grounded if the lower back starts compensating.": "Rota con control y mantén los pies en el suelo si la lumbar empieza a compensar.",
    "Legs (Glute/Ham Focus) & Core": "Piernas (Foco Glúteos/Isquios) y Core",
    "DB Romanian Deadlifts": "Peso Muerto Rumano con Mancuernas",
    "Hinge mechanics": "Mecánica de bisagra",
    "Push hips straight back, slide dumbbells down the thighs, and stop when hamstrings are fully stretched. Do not round the spine to go lower.": "Lleva las caderas recto hacia atrás, desliza las mancuernas por los muslos y para cuando los isquios estén totalmente estirados. No redondees la columna para bajar más.",
    "DB Hip Thrusts": "Hip Thrust con Mancuerna",
    "Upper back on bench": "Parte alta de la espalda en banco",
    "Glute strength": "Fuerza de glúteos",
    "Anchor the upper back on the bench, drive through the heels, and finish with glutes locked without lumbar extension.": "Apoya la parte alta de la espalda en el banco, empuja con talones y termina con glúteos bloqueados sin extender la lumbar.",
    "Hamstring Walkouts": "Caminatas de Isquios",
    "Hamstring control": "Control de isquios",
    "Start in a bridge, walk heels out slowly, then return while keeping hips lifted.": "Empieza en puente, camina los talones lentamente hacia fuera y vuelve manteniendo caderas elevadas.",
    "Decline bench": "Banco declinado",
    "Hold one dumbbell at the chest and keep every rep controlled from top to bottom.": "Sujeta una mancuerna en el pecho y controla cada repetición de arriba abajo.",
    "Single-Leg Romanian Deadlifts": "Peso Muerto Rumano a Una Pierna",
    "Hinge control": "Control de bisagra",
    "Use bodyweight or luggage if available. Hinge from the hip and keep the spine long.": "Usa peso corporal o equipaje si está disponible. Flexiona desde la cadera y mantén la columna larga.",
    "Single-Leg Glute Bridges": "Puente de Glúteo a Una Pierna",
    "Drive through the heel and pause at the top without arching the back.": "Empuja desde el talón y pausa arriba sin arquear la espalda.",
    "Walk heels away from the hips slowly, then return with hips elevated.": "Aleja los talones lentamente de las caderas y vuelve con las caderas elevadas.",
    "Slow Crunches": "Crunches Lentos",
    "Move slowly and exhale through the top of every rep.": "Muévete despacio y exhala en la parte alta de cada repetición.",
    "Active Recovery & Mobility Focus": "Recuperación Activa y Foco en Movilidad",
    "Light Bodyweight Flow": "Flujo Suave con Peso Corporal",
    "Floor/standing": "Suelo/de pie",
    "20 min relaxed pace": "20 min a ritmo relajado",
    "Skip dumbbells. Move through unweighted squats, lunges, push-ups, and planks at a relaxed pace to encourage blood flow.": "Omite las mancuernas. Haz sentadillas, zancadas, flexiones y planchas sin carga a ritmo relajado para estimular el flujo sanguíneo.",
    "Use open floor space for unweighted squats, lunges, incline push-ups, and planks. Keep the pace restorative.": "Usa espacio libre en el suelo para sentadillas, zancadas, flexiones inclinadas y planchas sin carga. Mantén un ritmo restaurativo.",
    "Failure": "Fallo",
    "10 pulls/side": "10 tirones/lado",
    "20 twists": "20 giros",
    "8 walkouts": "8 caminatas",
    "8-10/leg": "8-10/pierna",
    "10/leg": "10/pierna",
    "15/leg": "15/pierna",
    "8-12/leg": "8-12/pierna",
    "10-12/leg": "10-12/pierna",
    "10/side": "10/lado",
    "12/side": "12/lado",
    "45s/side": "45s/lado",
  },
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
  const [lang, setLang] = useState('en');
  
  const [user, setUser] = useState(null);
  const [isSynced, setIsSynced] = useState(false);
  const hasLoadedCloudData = useRef(false);
  const activeProfileRef = useRef('');
  
  const currentDayIndex = (new Date().getDay() + 6) % 7;
  const [expandedDay, setExpandedDay] = useState(currentDayIndex);
  const [timer, setTimer] = useState({ active: false, time: 0, total: 60 });
  const t = translations[lang] || translations.en;
  const workoutCopy = workoutTranslations[lang] || {};
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

  const translateWorkoutText = (value) => {
    if (typeof value !== 'string') return value;
    return workoutCopy[value] || value;
  };

  const localizeExercise = (exercise) => ({
    ...exercise,
    sourceName: exercise.name,
    name: translateWorkoutText(exercise.name),
    position: translateWorkoutText(exercise.position),
    desc: translateWorkoutText(exercise.desc),
    reps: translateWorkoutText(exercise.reps),
    instructions: translateWorkoutText(exercise.instructions),
    alt: exercise.alt ? localizeExercise(exercise.alt) : undefined,
  });

  // --- DATA ---
  const withMobility = (items, extended = false) => [
    ...items,
    { name: "Thoracic Bench Extensions", position: "Bench/Floor", desc: extended ? "4 min mobility" : "2 min mobility", sets: "1", reps: extended ? "4 min" : "2 min", rest: "0s", restSeconds: 0, category: "mobility", noWeight: true, instructions: "Kneel facing the bench with elbows on the pad and hands behind the head. Drop the chest toward the floor and breathe deeply into the lats and thoracic spine." },
    { name: "World's Greatest Stretch", position: "Floor", desc: extended ? "4 min mobility" : "2 min mobility", sets: "1", reps: extended ? "4 min" : "2 min", rest: "0s", restSeconds: 0, category: "mobility", noWeight: true, instructions: "Step into a deep lunge, place the opposite hand on the floor, reach the near-side hand to the instep, then rotate open toward the ceiling. Perform slow rotations on both sides." },
    { name: "90/90 Hip Switches", position: "Floor", desc: extended ? "4 min mobility" : "2 min mobility", sets: "1", reps: extended ? "4 min" : "2 min", rest: "0s", restSeconds: 0, category: "mobility", noWeight: true, instructions: "Sit tall with both knees bent at 90 degrees. Pivot on the heels to switch both knees side to side while keeping the torso upright." },
    { name: "Downward Dog to Cobra", position: "Floor", desc: extended ? "4 min mobility" : "2 min mobility", sets: "1", reps: extended ? "4 min" : "2 min", rest: "0s", restSeconds: 0, category: "mobility", noWeight: true, instructions: "Alternate between Downward Dog, pedaling out calves and hamstrings, and Cobra with hips on the floor, chest up, and neck neutral." },
    { name: "Progressive Seated Forward Fold", position: "Floor", desc: extended ? "10 min milestone" : "2 min milestone", sets: "1", reps: extended ? "10 min" : "2 min", rest: "0s", restSeconds: 0, category: "mobility", noWeight: true, instructions: "Sit tall with legs straight and toes pulled back. Hinge at the hips on each exhale, then gently round the upper back and aim the top of the head toward the knees." },
  ];

  const workoutDataBase = [
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

  const workoutData = workoutDataBase.map((dayData, dayIndex) => ({
    ...dayData,
    day: t.days[dayIndex] || translateWorkoutText(dayData.day),
    focus: translateWorkoutText(dayData.focus),
    session: translateWorkoutText(dayData.session),
    home: dayData.home.map(localizeExercise),
    hotel: dayData.hotel.map(localizeExercise),
  }));

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
    const name = (baseEx.sourceName || ex.name).toLowerCase();
    const copy = t.guidance;
    let group = copy.general;

    if (name.includes('squat') || name.includes('lunge') || name.includes('split')) {
      group = copy.squat;
    } else if (name.includes('press') || name.includes('push') || name.includes('fly')) {
      group = copy.press;
    } else if (name.includes('row') || name.includes('pull') || name.includes('angel')) {
      group = copy.pull;
    } else if (ex.category === 'core' || name.includes('plank') || name.includes('bug') || name.includes('hollow')) {
      group = copy.core;
    } else if (ex.category === 'mobility') {
      group = copy.mobility;
    }

    const progression = baseEx.noWeight
      ? copy.bodyweightProgression
      : copy.weightedProgression;

    return { ...group, progression };
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
                    <span className="block text-[10px] mb-2 opacity-70">{t.profileLabel}</span>
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
                  <span className={theme.muted}>{t.heatmapLabel}:</span>
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
                    {t.resetShort}
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
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">{t.cockpitEyebrow}</p>
                    <h2 className="font-display text-4xl md:text-6xl leading-[0.9] mt-2">
                      {workoutData[currentDayIndex].focus}
                    </h2>
                    <p className={`text-sm md:text-base leading-relaxed mt-3 max-w-2xl ${theme.muted}`}>
                      {t.cockpitBody}
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
                      {t.startToday}
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab(activeTab === 'hotel' ? 'home' : 'hotel');
                        setExpandedDay(currentDayIndex);
                      }}
                      className={`px-5 py-3 rounded-full border ${theme.border} ${theme.surface} text-sm font-bold`}
                    >
                      {activeTab === 'hotel' ? t.useHomePlan : t.useHotelPlan}
                    </button>
                    <button
                      onClick={() => setJetLagMode(!jetLagMode)}
                      className={`px-5 py-3 rounded-full border text-sm font-bold ${jetLagMode ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : `${theme.border} ${theme.surface}`}`}
                    >
                      {jetLagMode ? t.lowEnergyOn : t.lowEnergy}
                    </button>
                  </div>
                </div>

                <div className={`${theme.surface} border ${theme.border} rounded-3xl p-4 grid gap-3`}>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className={`${theme.inputBg} rounded-2xl p-3`}>
                      <span className={`block font-mono text-[9px] uppercase ${theme.muted}`}>{t.metricToday}</span>
                      <strong className="text-2xl text-[var(--accent)]">{getDayProgress(currentDayIndex)}%</strong>
                    </div>
                    <div className={`${theme.inputBg} rounded-2xl p-3`}>
                      <span className={`block font-mono text-[9px] uppercase ${theme.muted}`}>{t.metricSets}</span>
                      <strong className="text-2xl">{todaySummary.completed}/{todaySummary.totalSets}</strong>
                    </div>
                    <div className={`${theme.inputBg} rounded-2xl p-3`}>
                      <span className={`block font-mono text-[9px] uppercase ${theme.muted}`}>{t.metricStreak}</span>
                      <strong className="text-2xl">{calculateStreak()}</strong>
                    </div>
                  </div>

                  <div className={`${theme.inputBg} rounded-2xl p-4`}>
                    <p className={`font-mono text-[9px] uppercase tracking-[0.18em] ${theme.muted}`}>{t.nextUp}</p>
                    <h3 className="font-display text-2xl mt-1">{next ? next.name : t.sessionComplete}</h3>
                    <p className={`text-xs mt-2 ${theme.muted}`}>
                      {next ? `${next.done}/${next.total} ${t.setsDoneText}. ${next.desc}. ${t.restText} ${next.rest || '0s'}.` : t.sessionCompleteBody}
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
                  <p className="font-mono text-[10px] text-[var(--accent)] mb-4">{t.dataPointOne}</p>
                  <h3 className="font-display text-7xl leading-none">{calculateStreak()}</h3>
                  <p className={`font-mono text-xs mt-2 uppercase ${theme.muted}`}>{t.statsStreak}</p>
                </div>
                <div className={`border-2 ${theme.border} p-8 flex flex-col items-start`}>
                  <p className="font-mono text-[10px] text-[var(--accent)] mb-4">{t.dataPointTwo}</p>
                  <h3 className="font-display text-7xl leading-none">{calculateCompletionRate()}%</h3>
                  <p className={`font-mono text-xs mt-2 uppercase ${theme.muted}`}>{t.statsRate}</p>
                </div>
              </div>

              <div className={`border-2 ${theme.border} p-8`}>
                <h3 className="font-mono text-sm font-bold uppercase mb-6 flex justify-between">
                  <span>{t.statsVolume}</span>
                  <span className="text-[var(--accent)]">{t.volumeShort}: {Object.values(getVolumeData()).reduce((a,b)=>a+b,0)}</span>
                </h3>
                {(() => {
                  const vol = getVolumeData();
                  const total = Object.values(vol).reduce((a,b)=>a+b, 0) || 1; 
                  return (
                    <div className="space-y-6 font-mono text-xs">
                      <div>
                        <div className="flex justify-between mb-2"><span>{t.categories.push}</span><span>{Math.round((vol.push/total)*100)}%</span></div>
                        <div className={`h-1.5 w-full ${theme.inputBg}`}><div className="h-full bg-white dark:bg-zinc-300" style={{width:`${(vol.push/total)*100}%`}}></div></div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2"><span>{t.categories.pull}</span><span>{Math.round((vol.pull/total)*100)}%</span></div>
                        <div className={`h-1.5 w-full ${theme.inputBg}`}><div className="h-full bg-zinc-400 dark:bg-zinc-500" style={{width:`${(vol.pull/total)*100}%`}}></div></div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2"><span>{t.categories.legs}</span><span>{Math.round((vol.legs/total)*100)}%</span></div>
                        <div className={`h-1.5 w-full ${theme.inputBg}`}><div className="h-full bg-zinc-600 dark:bg-zinc-700" style={{width:`${(vol.legs/total)*100}%`}}></div></div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2"><span>{t.categories.shouldersArmsCore}</span><span>{Math.round((vol.shouldersArmsCore/total)*100)}%</span></div>
                        <div className={`h-1.5 w-full ${theme.inputBg}`}><div className="h-full bg-[var(--accent)]" style={{width:`${(vol.shouldersArmsCore/total)*100}%`}}></div></div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2"><span>{t.categories.recovery}</span><span>{Math.round((vol.recovery/total)*100)}%</span></div>
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
                          <h2 className="font-display text-2xl md:text-3xl tracking-wide">{dayData.day}</h2>
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
                                          <button onClick={() => toggleSwapExercise(index, activeTab, i)} className={`font-mono text-[10px] border px-1 hover:bg-white hover:text-black transition-colors ${theme.border}`} title={t.altTitle}>
                                            {t.swap}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <p className={`font-mono text-[10px] uppercase ${theme.muted} mb-4 flex gap-3 flex-wrap`}>
                                      {ex.position && activeTab === 'home' && <span>{t.locLabel}: {ex.position}</span>}
                                      <span>{t.targetLabel}: {ex.desc}</span>
                                      {ex.rest && <span>{t.restText}: {ex.rest}</span>}
                                    </p>
                                    
                                    <div className="flex items-center gap-3 font-mono text-[10px] font-bold flex-wrap">
                                      <span className={`px-2 py-1 border-2 ${theme.border}`}>{t.setShort}: {numSets}</span>
                                      <span className={`px-2 py-1 border-2 ${theme.border}`}>{t.repsShort}: {baseEx.reps}</span>
                                      {ex.category === 'mobility' && <span className={`px-2 py-1 border-2 border-[var(--accent)] text-[var(--accent)]`}>{t.mobilityLabel}</span>}
                                      <button onClick={() => setExpandedInfo(isInfoExpanded ? null : `${index}-${activeTab}-${i}`)} className={`px-2 py-1 border-2 transition-colors ${isInfoExpanded ? 'bg-white text-black border-white' : `${theme.border} hover:border-[var(--accent)]`}`}>
                                        {t.info}
                                      </button>
                                    </div>

                                    {isInfoExpanded && (
                                      <div className={`mt-4 p-4 rounded-2xl border border-[var(--accent)]/30 ${theme.inputBg} text-sm leading-relaxed animate-in fade-in`}>
                                        <p className="font-bold mb-3">{ex.instructions}</p>
                                        <div className="grid sm:grid-cols-3 gap-3">
                                          <div>
                                            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--accent)] mb-2">{t.guidanceCues}</p>
                                            <ul className="space-y-1">
                                              {guidance.cues.map((cue) => <li key={cue}>{cue}</li>)}
                                            </ul>
                                          </div>
                                          <div>
                                            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--accent)] mb-2">{t.guidanceAvoid}</p>
                                            <ul className="space-y-1">
                                              {guidance.mistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}
                                            </ul>
                                          </div>
                                          <div>
                                            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--accent)] mb-2">{t.guidanceSetup}</p>
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
                {t.close}
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
