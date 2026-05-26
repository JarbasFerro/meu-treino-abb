const withMobility = (items, extended = false) => [
  ...items,
  { name: "Thoracic Bench Extensions", position: "Bench/Floor", desc: extended ? "4 min mobility" : "2 min mobility", sets: "1", reps: extended ? "4 min" : "2 min", rest: "0s", restSeconds: 0, category: "mobility", noWeight: true, equipment: ["floorSpace"], instructions: "Kneel facing the bench with elbows on the pad and hands behind the head. Drop the chest toward the floor and breathe deeply into the lats and thoracic spine." },
  { name: "World's Greatest Stretch", position: "Floor", desc: extended ? "4 min mobility" : "2 min mobility", sets: "1", reps: extended ? "4 min" : "2 min", rest: "0s", restSeconds: 0, category: "mobility", noWeight: true, equipment: ["floorSpace"], instructions: "Step into a deep lunge, place the opposite hand on the floor, reach the near-side hand to the instep, then rotate open toward the ceiling. Perform slow rotations on both sides." },
  { name: "90/90 Hip Switches", position: "Floor", desc: extended ? "4 min mobility" : "2 min mobility", sets: "1", reps: extended ? "4 min" : "2 min", rest: "0s", restSeconds: 0, category: "mobility", noWeight: true, equipment: ["floorSpace"], instructions: "Sit tall with both knees bent at 90 degrees. Pivot on the heels to switch both knees side to side while keeping the torso upright." },
  { name: "Downward Dog to Cobra", position: "Floor", desc: extended ? "4 min mobility" : "2 min mobility", sets: "1", reps: extended ? "4 min" : "2 min", rest: "0s", restSeconds: 0, category: "mobility", noWeight: true, equipment: ["floorSpace"], instructions: "Alternate between Downward Dog, pedaling out calves and hamstrings, and Cobra with hips on the floor, chest up, and neck neutral." },
  { name: "Progressive Seated Forward Fold", position: "Floor", desc: extended ? "10 min milestone" : "2 min milestone", sets: "1", reps: extended ? "10 min" : "2 min", rest: "0s", restSeconds: 0, category: "mobility", noWeight: true, equipment: ["floorSpace"], instructions: "Sit tall with legs straight and toes pulled back. Hinge at the hips on each exhale, then gently round the upper back and aim the top of the head toward the knees." },
];

const fallbackAlternates = {
  push: [
    { name: "Wall Push-Ups", desc: "No-equipment press", reps: "12-20", category: "push", noWeight: true, equipment: ["floorSpace"], instructions: "Use a wall or high desk, keep ribs down, and stop with one clean rep in reserve." },
    { name: "Band Chest Press", desc: "Band press", reps: "10-15", category: "push", noWeight: true, equipment: ["bands"], instructions: "Anchor the band behind you, step forward until lightly loaded, and press without flaring ribs." },
  ],
  pull: [
    { name: "Prone Lat Pulls", desc: "Floor back work", reps: "12-15", category: "pull", noWeight: true, equipment: ["floorSpace"], instructions: "Lie face down, pull elbows toward ribs, and keep the neck long." },
    { name: "Band Rows", desc: "Band row", reps: "10-15", category: "pull", noWeight: true, equipment: ["bands"], instructions: "Anchor the band securely and row elbows toward ribs with a braced trunk." },
  ],
  legs: [
    { name: "Bodyweight Squats", desc: "No-equipment legs", reps: "15-20", category: "legs", noWeight: true, equipment: ["floorSpace"], instructions: "Use full-foot pressure, slow down the descent, and keep knees tracking over toes." },
    { name: "Suitcase Goblet Squats", desc: "Travel load", reps: "10-15", category: "legs", noWeight: true, equipment: ["floorSpace"], instructions: "Hold packed luggage close to the chest only if it feels stable and controlled." },
  ],
  core: [
    { name: "Dead Bugs", desc: "Floor core", reps: "10-12/side", category: "core", noWeight: true, equipment: ["floorSpace"], instructions: "Exhale, keep ribs down, and move only as far as you can hold the brace." },
    { name: "Side Planks", desc: "Floor brace", reps: "30-45s/side", category: "core", noWeight: true, equipment: ["floorSpace"], instructions: "Stack shoulder, ribs, hips, and feet. Use knees down if needed." },
  ],
  shouldersArmsCore: [
    { name: "Pike Push-Ups", desc: "No-equipment shoulders", reps: "6-12", category: "shouldersArmsCore", noWeight: true, equipment: ["floorSpace"], instructions: "Use a pike position to bias shoulders and shorten range if form degrades." },
    { name: "Band Curls + Pressdowns", desc: "Band arms", reps: "10-15 + 10-15", category: "shouldersArmsCore", noWeight: true, equipment: ["bands"], instructions: "Use smooth band tension and keep elbows controlled." },
  ],
  recovery: [
    { name: "Light Bodyweight Flow", desc: "Room-only flow", reps: "10-20 min", category: "recovery", noWeight: true, equipment: ["floorSpace"], instructions: "Move through easy squats, lunges, planks, and breathing at a restorative pace." },
  ],
  mobility: [
    { name: "Downward Dog to Cobra", desc: "Floor mobility", reps: "2 min", category: "mobility", noWeight: true, equipment: ["floorSpace"], instructions: "Alternate positions slowly and stay out of painful range." },
  ],
};

const inferEquipment = (exercise) => {
  if (exercise.equipment) return exercise.equipment;
  const text = `${exercise.name} ${exercise.position || ""} ${exercise.desc || ""} ${exercise.instructions || ""}`.toLowerCase();
  const equipment = new Set();
  if (text.includes("db") || text.includes("dumbbell") || text.includes("weighted")) equipment.add("dumbbells");
  if (text.includes("bench") || text.includes("chair") || text.includes("bed")) equipment.add("bench");
  if (text.includes("band")) equipment.add("bands");
  if (text.includes("pull-up")) equipment.add("pullUpBar");
  if (text.includes("floor") || exercise.noWeight || equipment.size === 0) equipment.add("floorSpace");
  return Array.from(equipment);
};

const uniqueAlternates = (exercise) => {
  const existing = [
    ...(exercise.alt ? [exercise.alt] : []),
    ...(exercise.altOptions || []),
    ...(fallbackAlternates[exercise.category] || []),
  ];
  const seen = new Set();
  return existing
    .filter((option) => {
      const key = option.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((option) => ({
      ...option,
      sets: option.sets || exercise.sets,
      rest: option.rest || exercise.rest,
      restSeconds: option.restSeconds ?? exercise.restSeconds,
      category: option.category || exercise.category,
      noWeight: option.noWeight ?? exercise.noWeight,
      equipment: inferEquipment(option),
    }));
};

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
      { name: "Bulgarian Split Squats", desc: "Rear foot on bed/chair", sets: "3", reps: "8-12/leg", rest: "60s", restSeconds: 60, category: "legs", noWeight: true, instructions: "Keep the front knee tracking and lean slightly forward to protect the knee while loading the glute.", safetyCaution: "Ensure the bed or chair is fully stable, non-slip, and can safely support your body weight before placing your foot." },
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
      { name: "Towel Door Rows", desc: "Back strength", sets: "4", reps: "8-12", rest: "90s", restSeconds: 90, category: "pull", noWeight: true, instructions: "Anchor a towel securely around a closed door handle and row with a braced trunk. Use only a safe, solid setup.", safetyCaution: "Verify that the door closes securely away from you, and test the handle and anchor strength before putting full weight on the towel.", alt: { name: "Bed Frame Rows", desc: "Back strength", reps: "8-12", instructions: "Use a stable bed frame only if it is safe and does not move.", safetyCaution: "Check that the bed frame is solid, heavy, and will not slide or tip over under your pulling force." } },
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
      { name: "Bodyweight Step-Ups", desc: "Chair/step", sets: "3", reps: "15/leg", rest: "45s", restSeconds: 45, category: "recovery", noWeight: true, instructions: "Use a stable chair, stair, or low platform. Keep the movement easy and controlled.", safetyCaution: "Use a sturdy, flat-surfaced chair or platform. Avoid using folding chairs, wheeled objects, or slippery surfaces." },
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

const translateWorkoutText = (value, workoutCopy) => {
  if (typeof value !== 'string') return value;
  return workoutCopy[value] || value;
};

const localizeExercise = (exercise, workoutCopy, includeAlternates = true) => ({
  ...exercise,
  sourceName: exercise.name,
  equipment: inferEquipment(exercise),
  name: translateWorkoutText(exercise.name, workoutCopy),
  position: translateWorkoutText(exercise.position, workoutCopy),
  desc: translateWorkoutText(exercise.desc, workoutCopy),
  reps: translateWorkoutText(exercise.reps, workoutCopy),
  instructions: translateWorkoutText(exercise.instructions, workoutCopy),
  safetyCaution: translateWorkoutText(exercise.safetyCaution, workoutCopy),
  alt: exercise.alt ? localizeExercise(exercise.alt, workoutCopy, false) : undefined,
  altOptions: includeAlternates ? uniqueAlternates(exercise).map((option) => localizeExercise(option, workoutCopy, false)) : [],
});

export const createWorkoutData = (t, workoutCopy = {}) => workoutDataBase.map((dayData, dayIndex) => ({
  ...dayData,
  day: t.days[dayIndex] || translateWorkoutText(dayData.day, workoutCopy),
  focus: translateWorkoutText(dayData.focus, workoutCopy),
  session: translateWorkoutText(dayData.session, workoutCopy),
  home: dayData.home.map((exercise) => localizeExercise(exercise, workoutCopy)),
  hotel: dayData.hotel.map((exercise) => localizeExercise(exercise, workoutCopy)),
}));
