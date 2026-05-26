import { ModeSwitch } from './TrainingControls.jsx';
import { Metric } from './Metric.jsx';
import { ExerciseList } from './ExerciseList.jsx';
import { DURATION_OPTIONS, EQUIPMENT_ORDER } from '../hooks/useWorkoutState.js';

export const TodayView = ({ state }) => {
  const {
    currentDayIndex,
    workoutData,
    mode,
    setMode,
    jetLagMode,
    sessionDuration,
    hotelEquipment,
    finishSummary,
    setFinishSummary,
    t,
    activeSession,
    setActiveView,
    startSession,
    getDayProgress,
    getWorkoutSummary,
    calculateStreak,
    updateHotelEquipment,
    getEquipmentLabel,
    formatEquipmentSummary,
    travelWeekMode,
    toggleTravelWeekMode,
    setHistoryDrawerExercise,
  } = state;

  const todaySummary = getWorkoutSummary(currentDayIndex, mode, jetLagMode, sessionDuration);
  const next = todaySummary.nextExercise;
  const todayDuration = `${sessionDuration} min`;
  const todayEquipment = mode === 'home' ? t.homeEquipment : formatEquipmentSummary();
  const firstCue = todaySummary.exercises[0]
    ? state.getExerciseGuidance(todaySummary.exercises[0], todaySummary.exercises[0]).cues[0]
    : t.allDone;

  const firstWeightedExercise = (() => {
    const exercises = workoutData[currentDayIndex]?.[mode] || [];
    const exerciseIndex = exercises.findIndex((exercise) => !exercise.noWeight);
    if (exerciseIndex < 0) return null;
    return { exercise: exercises[exerciseIndex], exerciseIndex };
  })();

  const todayLoadHint = firstWeightedExercise
    ? state.getLoadHint(currentDayIndex, mode, firstWeightedExercise.exerciseIndex, firstWeightedExercise.exercise)
    : null;

  const lastRelevantLoad = todayLoadHint?.lastLoad
    ? `${firstWeightedExercise.exercise.name}: ${todayLoadHint.lastLoad}`
    : todayLoadHint?.bestLoad
      ? `${firstWeightedExercise.exercise.name}: ${todayLoadHint.bestLoad}`
      : t.noPreviousLoad;

  return (
    <main className="mx-auto max-w-md space-y-4 px-3 pb-[calc(var(--nav-total-height)+1rem)] pt-3">
      <section className="rounded-3xl border border-[#D8CFBE] bg-[#FFFCF4] p-4 shadow-[0_20px_80px_rgba(42,48,39,0.08)]">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2F6F5E]">{t.cockpitEyebrow}</p>
            <h2 className="mt-2 text-3xl font-black leading-[0.95] text-[#171915]">
              {workoutData[currentDayIndex].focus}
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-[#626A5E]">{t.cockpitBody}</p>
          </div>
          <div className="sm:min-w-64">
            <ModeSwitch mode={mode} setMode={setMode} t={t} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2" data-testid="today-start-actions">
          {activeSession && (
            <button
              onClick={() => setActiveView('session')}
              className="col-span-2 min-h-12 rounded-2xl border border-[#D8CFBE] bg-white px-4 text-sm font-black text-[#17352D]"
            >
              {t.resumeSession}
            </button>
          )}
          {DURATION_OPTIONS.map((duration) => (
            <button
              key={duration}
              onClick={() => startSession(duration, false)}
              className={`min-h-12 rounded-2xl px-4 text-sm font-black ${sessionDuration === duration ? 'bg-[#17352D] text-white' : 'border border-[#D8CFBE] bg-white text-[#17352D]'}`}
            >
              {t[`duration${duration}`]}
            </button>
          ))}
          <button
            onClick={() => startSession(sessionDuration, true)}
            className="min-h-12 rounded-2xl border border-[#C9B68F] bg-[#FFF8E8] px-4 text-sm font-black text-[#654C12]"
          >
            {t.lowEnergySession}
            <span className="block text-[10px] font-bold">{t.habitFallback}</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric label={t.metricToday} value={`${getDayProgress(currentDayIndex, mode, jetLagMode, sessionDuration)}%`} />
          <Metric label={t.metricSets} value={`${todaySummary.completed}/${todaySummary.totalSets}`} />
          <Metric label={t.metricStreak} value={calculateStreak()} />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Metric label={t.estimatedDuration} value={todayDuration} />
          <Metric label={t.equipmentLabel} value={todayEquipment} />
          <Metric label={t.plannedSets} value={todaySummary.totalSets} />
        </div>

        {/* Travel-Week Template Card */}
        <div data-testid="travel-week-card" className="mt-3 rounded-3xl border border-[#D8CFBE] bg-white p-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wide text-[#2F6F5E]">{t.travelWeekToggle}</span>
            <p className="mt-1 text-xs font-bold leading-relaxed text-[#626A5E]">
              {travelWeekMode ? t.travelWeekDesc : t.travelWeekBody}
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleTravelWeekMode(!travelWeekMode)}
            aria-pressed={travelWeekMode}
            className={`min-h-11 shrink-0 rounded-2xl px-4 text-xs font-black transition ${
              travelWeekMode
                ? 'bg-[#A6422F] text-white'
                : 'border border-[#D8CFBE] bg-white text-[#17352D] active:bg-[#ECE5D8]'
            }`}
          >
            {travelWeekMode ? t.travelWeekOn : t.travelWeekToggle}
          </button>
        </div>

        {mode === 'hotel' && (
          <div data-testid="hotel-equipment-panel" className="mt-3 rounded-3xl border border-[#D8CFBE] bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-[#626A5E]">{t.hotelEquipmentTitle}</p>
                <p className="mt-1 text-sm font-black text-[#17352D]">{formatEquipmentSummary()}</p>
              </div>
              {hotelEquipment.roomOnly && (
                <span className="rounded-full bg-[#FFF8E8] px-3 py-2 text-[10px] font-black uppercase text-[#654C12]">
                  {t.hotelRoomOnly}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs font-bold leading-relaxed text-[#626A5E]">
              {hotelEquipment.roomOnly ? t.hotelRoomOnlyHint : t.hotelEquipmentBody}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2" data-testid="hotel-equipment-checklist">
              {EQUIPMENT_ORDER.map((id) => {
                const active = Boolean(hotelEquipment[id]);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => updateHotelEquipment(id)}
                    aria-pressed={active}
                    className={`min-h-11 rounded-2xl border px-3 text-left text-xs font-black transition ${active ? 'border-[#17352D] bg-[#17352D] text-white' : 'border-[#D8CFBE] bg-white text-[#626A5E]'}`}
                  >
                    {getEquipmentLabel(id)}
                    <span className={`mt-0.5 block text-[9px] uppercase ${active ? 'text-[#CFE4D7]' : 'text-[#8D9387]'}`}>
                      {active ? t.equipmentAvailable : t.equipmentUnavailable}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Metric
            label={t.lastRelevantLoad}
            value={lastRelevantLoad}
            onClick={firstWeightedExercise ? () => setHistoryDrawerExercise(firstWeightedExercise.exercise.name) : undefined}
          />
          <Metric label={t.firstCue} value={firstCue} />
        </div>

        {todayLoadHint && (
          <div data-testid="today-load-hint" className="mt-3 rounded-3xl border border-[#D8CFBE] bg-white p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#626A5E]">{t.loadSuggestion}</p>
            <p className="mt-1 text-sm font-black text-[#17352D]">{todayLoadHint.primary}</p>
            <p className="mt-1 text-xs font-bold leading-relaxed text-[#626A5E]">{todayLoadHint.warmup}</p>
            {todayLoadHint.best && <p className="mt-1 text-xs font-black text-[#626A5E]">{todayLoadHint.best}</p>}
          </div>
        )}

        <div className="mt-4 rounded-3xl bg-[#ECE5D8] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#626A5E]">{t.nextUp}</p>
          <h3 className="mt-1 text-2xl font-black text-[#171915]">{next ? next.name : t.sessionComplete}</h3>
          <p className="mt-1 text-sm font-semibold text-[#626A5E]">
            {next ? `${next.done}/${next.total} ${t.setsDoneText}. ${next.desc}. ${t.restText} ${next.rest || '0s'}.` : t.sessionCompleteBody}
          </p>
        </div>
      </section>

      {finishSummary && (
        <section className="rounded-3xl border border-[#D8CFBE] bg-[#FFFCF4] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2F6F5E]">{t.finishSummaryTitle}</p>
          <h3 className="mt-2 text-2xl font-black text-[#171915]">
            {finishSummary.completedSets}/{finishSummary.plannedSets} {t.setsDoneText}
          </h3>
          <p className="mt-2 text-sm font-semibold text-[#626A5E]">{t.finishSummaryBody}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric label={t.sessionType} value={finishSummary.lowEnergy ? t.lowEnergy : finishSummary.mode === 'home' ? t.homeMode : t.hotelMode} />
            <Metric label={t.durationLabel} value={`${finishSummary.durationMinutes} min`} />
            <Metric label={t.timeToStart} value={`${finishSummary.timeToStartSeconds}s`} />
            <Metric label={t.prCount} value={finishSummary.prCount} />
            <Metric label={t.avgRpe} value={finishSummary.avgRpe || '-'} />
            <Metric label={t.bestToday} value={finishSummary.bestLoad || t.noPreviousLoad} />
          </div>
          {finishSummary.exerciseSummaryList && finishSummary.exerciseSummaryList.length > 0 && (
            <div className="mt-6 border-t border-[#D8CFBE] pt-4" data-testid="finish-exercise-summary">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[#2F6F5E] mb-3">
                {t.sessionHighlights}
              </h4>
              <div className="space-y-2">
                {finishSummary.exerciseSummaryList.map((item, idx) => (
                  <div key={idx} className="rounded-2xl border border-[#EAE3D5] bg-[#FAF6EC] p-3 text-xs flex flex-col gap-1">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-black text-[#171915]">{item.name}</span>
                      <span className="shrink-0 font-black text-[#2F6F5E] bg-[#E8F1EE] px-2 py-0.5 rounded-full text-[10px]">
                        {item.completed}/{item.planned} {t.metricSets.toLowerCase()}
                      </span>
                    </div>
                    {(item.weight || item.rpe) && (
                      <div className="flex gap-4 font-bold text-[#626A5E] mt-1">
                        {item.weight && (
                          <span>
                            {t.weightPlaceholder}: <strong className="text-[#171915]">{item.weight}</strong>
                          </span>
                        )}
                        {item.rpe && (
                          <span>
                            {t.rpeLabel}: <strong className="text-[#171915]">{item.rpe}</strong>
                          </span>
                        )}
                      </div>
                    )}
                    {item.note && (
                      <p className="italic text-[#8D9387] mt-1 font-semibold border-l-2 border-[#D8CFBE] pl-2">
                        {item.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => setFinishSummary(null)}
            className="mt-4 min-h-12 w-full rounded-2xl bg-[#17352D] px-4 text-sm font-black text-white"
          >
            {t.backToToday}
          </button>
        </section>
      )}

      <section className="rounded-3xl border border-[#D8CFBE] bg-[#FFFCF4] p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black text-[#171915]">{t.todayPlan}</h3>
          {jetLagMode && <span className="rounded-full bg-[#FFF8E8] px-3 py-2 text-xs font-black text-[#654C12]">{t.lowEnergyOn}</span>}
        </div>
        <ExerciseList dayIndex={currentDayIndex} sessionMode={mode} compact {...state} />
      </section>
    </main>
  );
};
