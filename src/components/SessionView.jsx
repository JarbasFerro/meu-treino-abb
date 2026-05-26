import { Metric } from './Metric.jsx';
import { ExerciseGuidance } from './TrainingControls.jsx';
import { TodayView } from './TodayView.jsx';
import { getSwapValue, getSessionExercises, getSessionSetCount } from '../hooks/useWorkoutState.js';

export const SessionView = ({ state }) => {
  const {
    activeSession,
    setActiveSession,
    workoutData,
    currentDayIndex,
    mode,
    swappedExercises,
    getCompletedCount,
    getExerciseGuidance,
    getExerciseStats,
    getLoadHint,
    updateWeight,
    updateExerciseNote,
    updateRpe,
    toggleSet,
    completedSets,
    finishSession,
    expandedInfo,
    setExpandedInfo,
    t,
    setHistoryDrawerExercise,
  } = state;

  if (!activeSession) return <TodayView state={state} />;

  const dayData = workoutData[activeSession.dayIndex] || workoutData[currentDayIndex];
  const sessionMode = activeSession.mode || mode;
  const durationMinutes = activeSession.durationMinutes || 45;
  const exercises = getSessionExercises(dayData[sessionMode] || []);
  const exerciseIndex = Math.min(activeSession.exerciseIndex, Math.max(0, exercises.length - 1));
  const baseExercise = exercises[exerciseIndex];
  const activeSwapIndex = getSwapValue(swappedExercises[`${activeSession.dayIndex}-${sessionMode}-${exerciseIndex}`]);
  const exercise = activeSwapIndex !== null && baseExercise?.altOptions?.[activeSwapIndex] ? baseExercise.altOptions[activeSwapIndex] : baseExercise;
  const totalSets = getSessionSetCount(baseExercise);
  const completedCount = getCompletedCount(activeSession.dayIndex, sessionMode, exerciseIndex, totalSets);
  const guidance = getExerciseGuidance(exercise, baseExercise);
  const nextExercise = exercises[exerciseIndex + 1];
  const exerciseStats = getExerciseStats(activeSession.dayIndex, sessionMode, exerciseIndex);
  const currentWeight = exerciseStats.currentWeight;
  const exerciseLoadHint = getLoadHint(activeSession.dayIndex, sessionMode, exerciseIndex, exercise);

  const moveToNextExercise = () => {
    if (exerciseIndex >= exercises.length - 1) {
      finishSession();
      return;
    }
    setActiveSession((prev) => ({ ...prev, exerciseIndex: prev.exerciseIndex + 1, currentSetIndex: 0 }));
    setExpandedInfo(null);
  };

  const completeNextSet = () => {
    const setIndex = Array.from({ length: totalSets }).findIndex(
      (_, idx) => !completedSets[`${activeSession.dayIndex}-${sessionMode}-${exerciseIndex}-${idx}`]
    );
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
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#17352D] text-sm font-black text-white">
                  {index + 1}
                </span>
                <p className="text-sm font-bold text-[#31362F]">{step}</p>
              </div>
            ))}
          </div>
          <div
            data-testid="sticky-actions"
            className="sticky z-20 mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-[#D8CFBE] bg-[#FFFCF4]/95 p-2 shadow-2xl backdrop-blur-xl"
            style={{ bottom: 'var(--sticky-action-bottom)' }}
          >
            <button
              onClick={() => setActiveSession((prev) => ({ ...prev, warmupDone: true }))}
              className="min-h-12 rounded-2xl bg-[#17352D] px-2 text-xs font-black text-white"
            >
              {t.warmupDone}
            </button>
            <button
              onClick={() => setActiveSession((prev) => ({ ...prev, warmupDone: true }))}
              className="min-h-12 rounded-2xl border border-[#D8CFBE] px-2 text-xs font-black text-[#626A5E]"
            >
              {t.skipWarmup}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-4 px-3 pb-[calc(var(--nav-total-height)+6.5rem)] pt-3">
      <section className="rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5 shadow-[0_20px_80px_rgba(42,48,39,0.08)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2F6F5E]">{t.activeSession}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-3xl font-black leading-tight text-[#171915] break-words">{exercise.name}</h2>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {exerciseStats.isPr && (
                  <span className="rounded-full bg-[#17352D] px-3 py-1 text-[10px] font-black uppercase text-white">
                    {t.prBadge}
                  </span>
                )}
                <button
                  onClick={() => setHistoryDrawerExercise(exercise.name)}
                  className="rounded-full border border-[#D8CFBE] bg-white px-2.5 py-1 text-[10px] font-black uppercase text-[#626A5E] hover:bg-[#ECE5D8] active:bg-[#D8CFBE]"
                >
                  {t.historyButton}
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm font-bold text-[#626A5E]">
              {dayData.day} · {sessionMode === 'home' ? t.homeMode : t.hotelMode} · {durationMinutes} min
            </p>
          </div>
          <button
            onClick={finishSession}
            className="min-h-11 rounded-full border border-[#D8CFBE] px-3 text-xs font-black text-[#626A5E] shrink-0"
          >
            {t.endSession}
          </button>
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

        {exerciseLoadHint && (
          <div data-testid="session-load-hint" className="mb-5 rounded-3xl border border-[#D8CFBE] bg-white p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#626A5E]">{t.loadSuggestion}</p>
            <p className="mt-1 text-sm font-black text-[#17352D]">{exerciseLoadHint.primary}</p>
            <p className="mt-1 text-xs font-bold leading-relaxed text-[#626A5E]">{exerciseLoadHint.warmup}</p>
            {exerciseLoadHint.best && <p className="mt-1 text-xs font-black text-[#626A5E]">{exerciseLoadHint.best}</p>}
          </div>
        )}

        {exercise.safetyCaution && (
          <div data-testid="safety-caution-box" className="mb-5 rounded-3xl border border-[#D08B2A] bg-[#FFF6E9] p-4 flex gap-3 text-xs">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D08B2A] text-[10px] font-black text-white" aria-hidden="true">
              ⚠️
            </span>
            <div className="space-y-1">
              <p className="font-black text-[#A05C00] uppercase tracking-wide">
                {t.warningLabel}
              </p>
              <p className="font-bold text-[#7A4B00] leading-relaxed">
                {exercise.safetyCaution}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-3xl bg-[#ECE5D8] p-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-[#626A5E]">{t.targetLabel}</p>
          <p className="mt-1 text-lg font-black text-[#171915]">{exercise.desc}</p>
          <p className="mt-2 text-sm font-bold text-[#626A5E]">{t.repsShort}: {baseExercise.reps}</p>
          <p className="mt-3 rounded-2xl bg-[#FFFCF4] px-3 py-2 text-sm font-black text-[#17352D]">
            {guidance.cues[0]}
          </p>
        </div>

        {!exercise.noWeight && (
          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#626A5E]">{t.load}</span>
            <input
              value={currentWeight}
              onChange={(event) => updateWeight(activeSession.dayIndex, sessionMode, exerciseIndex, event.target.value)}
              placeholder={t.weightPlaceholder}
              className="min-h-12 w-full rounded-2xl border border-[#D8CFBE] bg-white px-4 text-lg font-black outline-none focus:border-[#2F6F5E]"
            />
          </label>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#626A5E]">{t.noteLabel}</span>
            <input
              value={exerciseStats.note}
              onChange={(event) => updateExerciseNote(activeSession.dayIndex, sessionMode, exerciseIndex, event.target.value)}
              placeholder={t.notePlaceholder}
              className="min-h-12 w-full rounded-2xl border border-[#D8CFBE] bg-white px-4 text-sm font-bold outline-none focus:border-[#2F6F5E]"
            />
          </label>
          <div>
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#626A5E]">{t.rpeLabel}</span>
            <select
              value={exerciseStats.rpe}
              onChange={(event) => updateRpe(activeSession.dayIndex, sessionMode, exerciseIndex, event.target.value)}
              className="min-h-12 rounded-2xl border border-[#D8CFBE] bg-white px-4 text-sm font-black outline-none focus:border-[#2F6F5E]"
            >
              <option value="">-</option>
              {Array.from({ length: 10 }).map((_, index) => (
                <option key={index + 1} value={index + 1}>
                  {index + 1}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          {Array.from({ length: totalSets }).map((_, setIdx) => {
            const isChecked = completedSets[`${activeSession.dayIndex}-${sessionMode}-${exerciseIndex}-${setIdx}`];
            return (
              <button
                key={setIdx}
                onClick={() => toggleSet(activeSession.dayIndex, sessionMode, exerciseIndex, setIdx, exercise.restSeconds ?? 60)}
                className={`min-h-12 flex-1 rounded-2xl border text-sm font-black ${isChecked ? 'border-[#17352D] bg-[#17352D] text-white' : 'border-[#D8CFBE] bg-white text-[#626A5E]'}`}
              >
                {setIdx + 1}
              </button>
            );
          })}
        </div>

        <div
          data-testid="sticky-actions"
          className="sticky z-20 mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-[#D8CFBE] bg-[#FFFCF4]/95 p-2 shadow-2xl backdrop-blur-xl"
          style={{ bottom: 'var(--sticky-action-bottom)' }}
        >
          <button
            disabled={exerciseIndex === 0}
            onClick={() => setActiveSession((prev) => ({ ...prev, exerciseIndex: Math.max(0, prev.exerciseIndex - 1) }))}
            className="min-h-12 rounded-2xl border border-[#D8CFBE] px-2 text-xs font-black disabled:opacity-40"
          >
            {t.previous}
          </button>
          <button
            onClick={completeNextSet}
            className="min-h-12 rounded-2xl bg-[#17352D] px-2 text-xs font-black text-white"
          >
            {completedCount >= totalSets ? t.nextExercise : t.completeSet}
          </button>
          <button
            onClick={() =>
              exerciseIndex >= exercises.length - 1
                ? finishSession()
                : setActiveSession((prev) => ({ ...prev, exerciseIndex: prev.exerciseIndex + 1 }))
            }
            className="min-h-12 rounded-2xl border border-[#D8CFBE] px-2 text-xs font-black"
          >
            {exerciseIndex >= exercises.length - 1 ? t.finishWorkout : t.nextExercise}
          </button>
        </div>
      </section>

      <ExerciseGuidance
        guidance={guidance}
        exercise={exercise}
        expanded={expandedInfo === 'session'}
        setExpanded={(value) => setExpandedInfo(value ? 'session' : null)}
        t={t}
      />

      {nextExercise && (
        <section className="rounded-3xl border border-[#D8CFBE] bg-[#FFFCF4] p-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-[#626A5E]">{t.nextUp}</p>
          <p className="mt-1 text-lg font-black text-[#171915]">{nextExercise.name}</p>
        </section>
      )}
    </main>
  );
};
