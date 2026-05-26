import { ExerciseGuidance } from './TrainingControls.jsx';
import { getSwapValue, getSessionExercises, getSessionSetCount } from '../hooks/useWorkoutState.js';

export const ExerciseList = ({
  dayIndex,
  sessionMode,
  compact = false,
  workoutData,
  sessionDuration,
  swappedExercises,
  jetLagMode,
  completedSets,
  expandedInfo,
  setExpandedInfo,
  weights,
  hotelEquipment,
  t,
  getCompletedCount,
  getExerciseGuidance,
  getSwapOptions,
  getSwapGroup,
  requiresAvailableEquipment,
  selectSwapExercise,
  getEquipmentLabel,
  updateWeight,
  toggleSet,
}) => {
  const dayData = workoutData[dayIndex];
  const exercises = getSessionExercises(dayData?.[sessionMode] || [], sessionDuration);

  return (
    <div className="space-y-3">
      {exercises.map((baseExercise, exIndex) => {
        const activeSwapIndex = getSwapValue(swappedExercises[`${dayIndex}-${sessionMode}-${exIndex}`]);
        const exercise = activeSwapIndex !== null && baseExercise.altOptions?.[activeSwapIndex] ? baseExercise.altOptions[activeSwapIndex] : baseExercise;
        const numSets = getSessionSetCount(baseExercise, jetLagMode, sessionDuration);
        const completedCount = getCompletedCount(dayIndex, sessionMode, exIndex, numSets);
        const isInfoExpanded = expandedInfo === `${dayIndex}-${sessionMode}-${exIndex}`;
        const guidance = getExerciseGuidance(exercise, baseExercise);
        const currentWeight = weights[`${dayIndex}-${sessionMode}-${exIndex}`] || '';
        const swapOptions = getSwapOptions(baseExercise);
        const visibleSwapOptions = sessionMode === 'hotel' && hotelEquipment.roomOnly
          ? swapOptions.filter((option) => option.swapIndex === null || requiresAvailableEquipment(option))
          : swapOptions;

        return (
          <article key={`${dayIndex}-${sessionMode}-${exIndex}`} className="rounded-3xl border border-[#D8CFBE] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-[#2F6F5E]">{String(exIndex + 1).padStart(2, '0')}</p>
                <h4 className="text-lg font-black text-[#171915]">{exercise.name}</h4>
                <p className="mt-1 text-xs font-bold text-[#626A5E]">
                  {exercise.desc} · {t.repsShort}: {baseExercise.reps} · {t.restText}: {exercise.rest}
                </p>
              </div>
              <span className="rounded-full bg-[#EAF1EA] px-3 py-2 text-xs font-black text-[#17352D]">{completedCount}/{numSets}</span>
            </div>
            {!compact && <p className="mt-3 text-sm text-[#626A5E]">{exercise.instructions}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {Array.from({ length: numSets }).map((_, setIdx) => {
                const isChecked = completedSets[`${dayIndex}-${sessionMode}-${exIndex}-${setIdx}`];
                return (
                  <button
                    key={setIdx}
                    onClick={() => toggleSet(dayIndex, sessionMode, exIndex, setIdx, exercise.restSeconds ?? 60)}
                    className={`min-h-11 min-w-11 rounded-2xl border text-sm font-black ${isChecked ? 'border-[#17352D] bg-[#17352D] text-white' : 'border-[#D8CFBE] bg-[#FFFCF4] text-[#626A5E]'}`}
                  >
                    {setIdx + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setExpandedInfo(isInfoExpanded ? null : `${dayIndex}-${sessionMode}-${exIndex}`)}
                className="min-h-11 rounded-2xl border border-[#D8CFBE] px-3 text-xs font-black text-[#626A5E]"
              >
                {t.info}
              </button>
            </div>
            {sessionMode === 'hotel' && isInfoExpanded && (
              <div data-testid="swap-options" className="mt-4 space-y-3 rounded-3xl bg-[#F4F0E8] p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-[#626A5E]">{t.swap}</p>
                {[t.swapGroupYour, t.swapGroupNone, t.swapGroupSame, t.swapGroupDifferent].map((group) => {
                  const groupOptions = visibleSwapOptions.filter((option) => getSwapGroup(baseExercise, option, sessionMode) === group);
                  if (!groupOptions.length) return null;
                  return (
                    <div key={group}>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-[#2F6F5E]">{group}</p>
                      <div className="grid gap-2">
                        {groupOptions.map((option) => {
                          const isSelected = activeSwapIndex === option.swapIndex || (activeSwapIndex === null && option.swapIndex === null);
                          const isAvailable = option.swapIndex === null || requiresAvailableEquipment(option);
                          return (
                            <button
                              key={`${option.swapIndex ?? 'original'}-${option.name}`}
                              type="button"
                              disabled={!isAvailable}
                              onClick={() => selectSwapExercise(dayIndex, sessionMode, exIndex, option.swapIndex)}
                              className={`min-h-11 rounded-2xl border px-3 text-left text-xs font-black ${isSelected ? 'border-[#17352D] bg-[#17352D] text-white' : 'border-[#D8CFBE] bg-white text-[#17352D]'} disabled:opacity-45`}
                            >
                              <span>{option.swapLabel || option.name}</span>
                              <span className={`mt-1 block text-[10px] font-bold ${isSelected ? 'text-[#CFE4D7]' : 'text-[#626A5E]'}`}>
                                {isSelected
                                  ? t.swapCurrent
                                  : isAvailable
                                    ? (option.equipment || []).map(getEquipmentLabel).join(' + ') || t.equipmentNames.noEquipment
                                    : t.swapUnavailable}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!exercise.noWeight && !compact && (
              <input
                value={currentWeight}
                onChange={(event) => updateWeight(dayIndex, sessionMode, exIndex, event.target.value)}
                placeholder={t.weightPlaceholder}
                className="mt-3 min-h-11 w-full rounded-2xl border border-[#D8CFBE] px-3 font-black outline-none focus:border-[#2F6F5E]"
              />
            )}
            {isInfoExpanded && (
              <div className="mt-4">
                <ExerciseGuidance
                  guidance={guidance}
                  exercise={exercise}
                  expanded
                  setExpanded={() => setExpandedInfo(null)}
                  t={t}
                />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
};
