
import { Suspense, lazy } from 'react';
import { useWorkoutState } from './hooks/useWorkoutState.js';
import { StatusHeader } from './components/StatusHeader.jsx';
import { TodayView } from './components/TodayView.jsx';
import { SessionView } from './components/SessionView.jsx';
import { BottomNav, RestTimer } from './components/TrainingControls.jsx';

const HistoryDrawer = lazy(() =>
  import('./components/HistoryDrawer.jsx').then((module) => ({ default: module.HistoryDrawer }))
);
const PlanView = lazy(() =>
  import('./components/PlanView.jsx').then((module) => ({ default: module.PlanView }))
);
const ProgressView = lazy(() =>
  import('./components/ProgressView.jsx').then((module) => ({ default: module.ProgressView }))
);

const App = () => {
  const state = useWorkoutState();
  const {
    activeView,
    setActiveView,
    showResetModal,
    setShowResetModal,
    pendingImportData,
    setPendingImportData,
    updateReady,
    setUpdateReady,
    timer,
    setTimer,
    formatTime,
    adjustTimer,
    resetProgress,
    confirmImportProfile,
    setImportError,
    activeSession,
    t,
    firebaseReady,
    isSynced,
    storageStatus,
    storageUsageRatio,
    hasStorageWarning,
    updateServiceWorkerRef,
  } = state;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800;900&family=JetBrains+Mono:wght@400;700;800&display=swap');
        body { font-family: 'Archivo', sans-serif; }
        * { letter-spacing: 0; }
      `}</style>
      <div className="min-h-screen bg-[#F4F0E8] text-[#171915]">
        <StatusHeader
          t={t}
          firebaseReady={firebaseReady}
          isSynced={isSynced}
          hasStorageWarning={hasStorageWarning}
          storageUsageRatio={storageUsageRatio}
          storageStatus={storageStatus}
          setShowResetModal={setShowResetModal}
        />
        {showResetModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-[2rem] bg-[#FFFCF4] p-6 shadow-2xl">
              <h3 className="text-2xl font-black text-[#A6422F]">{t.resetTitle}</h3>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#626A5E]">{t.reset}</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="min-h-12 rounded-2xl border border-[#D8CFBE] font-black"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={resetProgress}
                  className="min-h-12 rounded-2xl bg-[#A6422F] font-black text-white"
                >
                  {t.resetAction}
                </button>
              </div>
            </div>
          </div>
        )}
        {pendingImportData && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div data-testid="import-modal" className="w-full max-w-sm rounded-[2rem] bg-[#FFFCF4] p-6 shadow-2xl">
              <h3 className="text-2xl font-black text-[#171915]">{t.importConfirmTitle}</h3>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#626A5E]">{t.importConfirmBody}</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setPendingImportData(null);
                    setImportError('');
                  }}
                  className="min-h-12 rounded-2xl border border-[#D8CFBE] font-black"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={confirmImportProfile}
                  className="min-h-12 rounded-2xl bg-[#17352D] font-black text-white"
                >
                  {t.importJson}
                </button>
              </div>
            </div>
          </div>
        )}
        {updateReady && (
          <div className="fixed inset-x-0 bottom-[5.5rem] z-[90] px-4">
            <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-3xl border border-[#17352D] bg-[#FFFCF4] p-4 shadow-2xl">
              <p className="text-sm font-black text-[#171915]">{t.updateAvailable}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setUpdateReady(false)}
                  className="min-h-11 rounded-2xl border border-[#D8CFBE] px-3 text-xs font-black"
                >
                  {t.later}
                </button>
                <button
                  onClick={() => updateServiceWorkerRef.current?.(true)}
                  className="min-h-11 rounded-2xl bg-[#17352D] px-3 text-xs font-black text-white"
                >
                  {t.updateNow}
                </button>
              </div>
            </div>
          </div>
        )}
        {activeView === 'today' && <TodayView state={state} />}
        {activeView === 'plan' && (
          <Suspense fallback={null}>
            <PlanView state={state} />
          </Suspense>
        )}
        {activeView === 'progress' && (
          <Suspense fallback={null}>
            <ProgressView state={state} />
          </Suspense>
        )}
        {activeView === 'session' && <SessionView state={state} />}
        <RestTimer
          timer={timer}
          formatTime={formatTime}
          adjustTimer={adjustTimer}
          setTimer={setTimer}
          t={t}
          elevated={activeView === 'session' && activeSession?.warmupDone !== false}
        />
        <BottomNav
          activeView={activeView === 'session' ? 'today' : activeView}
          setActiveView={setActiveView}
          t={t}
        />
        <Suspense fallback={null}>
          <HistoryDrawer state={state} />
        </Suspense>
      </div>
    </>
  );
};

export default App;
