
import { ModeSwitch } from './TrainingControls.jsx';
import { ExerciseList } from './ExerciseList.jsx';

export const PlanView = ({ state }) => {
  const {
    t,
    mode,
    setMode,
    formatEquipmentSummary,
    workoutData,
    openDaySession,
    getDayProgress,
    jetLagMode,
    sessionDuration,
  } = state;

  return (
    <main className="mx-auto max-w-md space-y-4 px-3 pb-[calc(var(--nav-total-height)+1rem)] pt-3">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2F6F5E]">{t.navPlan}</p>
          <h2 className="text-3xl font-black text-[#171915]">{t.planTitle}</h2>
          {mode === 'hotel' && (
            <p className="mt-1 text-sm font-bold text-[#626A5E]">
              {t.equipmentLabel}: {formatEquipmentSummary()}
            </p>
          )}
        </div>
        <div className="sm:min-w-64">
          <ModeSwitch mode={mode} setMode={setMode} t={t} />
        </div>
      </section>
      {workoutData.map((dayData, index) => (
        <section key={dayData.day} className="rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5">
          <button
            onClick={() => openDaySession(index)}
            className="mb-4 flex min-h-14 w-full items-center justify-between text-left"
          >
            <div>
              <h3 className="text-2xl font-black text-[#171915]">{dayData.day}</h3>
              <p className="text-sm font-bold text-[#626A5E]">{dayData.focus} · {dayData.session}</p>
            </div>
            <span className="rounded-full bg-[#EAF1EA] px-3 py-2 text-sm font-black text-[#17352D]">
              {getDayProgress(index, mode, jetLagMode, sessionDuration)}%
            </span>
          </button>
          <ExerciseList dayIndex={index} sessionMode={mode} compact {...state} />
        </section>
      ))}
    </main>
  );
};
