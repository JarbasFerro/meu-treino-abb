
import { Metric } from './Metric.jsx';
import { getLocalDateString } from '../storage/workoutStorage.js';

export const ProgressView = ({ state }) => {
  const {
    t,
    calculateStreak,
    calculateCompletionRate,
    workoutHistory,
    getVolumeData,
    handleExportJson,
    handleExportCsv,
    handleImportFile,
    importError,
    getEnvironmentMix,
    setHistoryDrawerExercise,
  } = state;

  const last14Days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return getLocalDateString(d);
  });

  const vol = getVolumeData();
  const total = Object.values(vol).reduce((a, b) => a + b, 0) || 1;
  const mix = getEnvironmentMix;

  return (
    <main className="mx-auto max-w-md space-y-4 px-3 pb-[calc(var(--nav-total-height)+1rem)] pt-3">
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

      {/* Environment Mix Tracker */}
      <section className="rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5">
        <h3 className="text-sm font-black uppercase tracking-wide text-[#171915] mb-4">
          Environment Frequency Mix
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-[#D8CFBE] bg-white p-3 text-center">
            <span className="block text-[9px] font-black uppercase tracking-wide text-[#626A5E]">Home</span>
            <strong className="mt-1 block text-lg font-black text-[#17352D]">{mix.home}</strong>
          </div>
          <div className="rounded-2xl border border-[#D8CFBE] bg-white p-3 text-center">
            <span className="block text-[9px] font-black uppercase tracking-wide text-[#626A5E]">Hotel</span>
            <strong className="mt-1 block text-lg font-black text-[#17352D]">{mix.hotel}</strong>
          </div>
          <div className="rounded-2xl border border-[#D8CFBE] bg-white p-3 text-center">
            <span className="block text-[9px] font-black uppercase tracking-wide text-[#626A5E]">Low Energy</span>
            <strong className="mt-1 block text-lg font-black text-[#654C12]">{mix.lowEnergy}</strong>
          </div>
        </div>
        {mix.total > 0 && (
          <p className="mt-3 text-center text-xs font-semibold text-[#626A5E]">
            Based on {mix.total} logged training sessions.
          </p>
        )}
      </section>

      {/* Benchmarks & Lifts */}
      <section className="rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5">
        <h3 className="text-sm font-black uppercase tracking-wide text-[#171915] mb-4">
          {t.progressBenchmarks}
        </h3>
        <div className="grid gap-2">
          {[
            'DB Bench Press',
            'DB Goblet Squats',
            'Chest-Supported DB Rows',
            'Seated DB Overhead Press',
            'DB Romanian Deadlifts',
          ].map((liftName) => {
            const pr = state.getExercisePr(liftName);
            const displayWeight = pr.bestLoad ? `${pr.bestLoad}` : t.noPreviousLoad;
            return (
              <button
                key={liftName}
                onClick={() => setHistoryDrawerExercise(liftName)}
                className="flex items-center justify-between rounded-2xl border border-[#D8CFBE] bg-white p-3 text-left transition hover:bg-[#ECE5D8] active:bg-[#D8CFBE]"
              >
                <div>
                  <strong className="block text-sm font-black text-[#171915]">{liftName}</strong>
                  <span className="text-[10px] font-bold text-[#626A5E] uppercase">
                    {t.bestSets}: {pr.bestSetCount || 0}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-[9px] font-black uppercase tracking-wide text-[#626A5E]">{t.bestLoad}</span>
                  <strong className="text-sm font-black text-[#17352D]">{displayWeight}</strong>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5">
        <h3 className="mb-5 flex justify-between text-sm font-black uppercase tracking-wide text-[#171915]">
          <span>{t.statsVolume}</span>
          <span>{t.volumeShort}: {Object.values(vol).reduce((a, b) => a + b, 0)}</span>
        </h3>
        {Object.entries(vol).map(([key, value]) => (
          <div key={key} className="mb-4">
            <div className="mb-2 flex justify-between text-xs font-black uppercase text-[#626A5E]">
              <span>{t.categories[key]}</span>
              <span>{Math.round((value / total) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#E8E0D1]">
              <div className="h-full rounded-full bg-[#2F6F5E]" style={{ width: `${(value / total) * 100}%` }} />
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-[#D8CFBE] bg-[#FFFCF4] p-5">
        <h3 className="text-lg font-black text-[#171915]">{t.ownershipTitle}</h3>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-[#626A5E]">{t.ownershipBody}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <button
            onClick={handleExportJson}
            className="min-h-12 rounded-2xl bg-[#17352D] px-4 text-sm font-black text-white"
          >
            {t.exportJson}
          </button>
          <button
            onClick={handleExportCsv}
            className="min-h-12 rounded-2xl border border-[#D8CFBE] px-4 text-sm font-black"
          >
            {t.exportCsv}
          </button>
          <button
            onClick={() => document.getElementById('profile-import-file')?.click()}
            className="min-h-12 rounded-2xl border border-[#D8CFBE] px-4 text-sm font-black"
          >
            {t.importJson}
          </button>
        </div>
        {importError && (
          <p className="mt-3 rounded-2xl bg-[#FFF0EC] px-4 py-3 text-sm font-black text-[#A6422F]">
            {importError}
          </p>
        )}
        <input
          id="profile-import-file"
          type="file"
          accept="application/json,.json"
          onChange={handleImportFile}
          className="hidden"
        />
      </section>
    </main>
  );
};
