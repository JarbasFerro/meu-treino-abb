import { useEffect, useRef } from 'react';
import { Metric } from './Metric.jsx';

export const HistoryDrawer = ({ state }) => {
  const {
    historyDrawerExercise,
    setHistoryDrawerExercise,
    getExerciseHistoryData,
    getExercisePr,
    t,
  } = state;

  const dialogRef = useRef(null);
  const exerciseName = historyDrawerExercise;

  const onClose = () => {
    setHistoryDrawerExercise(null);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (exerciseName) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [exerciseName]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };

    const handleClick = (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isDialogContent) {
        dialog.close();
      }
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('click', handleClick);

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  if (!exerciseName) return null;

  const historyLogs = getExerciseHistoryData(exerciseName);
  const pr = getExercisePr(exerciseName);

  // Parse formatting values
  const displayPrLoad = pr.bestLoad ? `${pr.bestLoad}` : t.noPreviousLoad;

  return (
    <>
      <style>{`
        dialog.history-drawer-dialog {
          margin-top: auto;
          margin-bottom: 0;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          width: 100%;
          max-width: 28rem;
          border-top-left-radius: 2rem;
          border-top-right-radius: 2rem;
          border: 1px solid #D8CFBE;
          background-color: #FFFCF4;
          padding: 1.5rem;
          padding-bottom: calc(1.5rem + var(--safe-bottom));
          box-shadow: 0 -10px 25px -5px rgba(0, 0, 0, 0.1), 0 -8px 10px -6px rgba(0, 0, 0, 0.1);
          transform: translateY(100%);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), display 0.25s allow-discrete;
          outline: none;
        }
        dialog.history-drawer-dialog[open] {
          transform: translateY(0);
        }
        @starting-style {
          dialog.history-drawer-dialog[open] {
            transform: translateY(100%);
          }
        }
        dialog.history-drawer-dialog::backdrop {
          background-color: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          opacity: 0;
          transition: opacity 0.25s ease-out, display 0.25s allow-discrete;
        }
        dialog.history-drawer-dialog[open]::backdrop {
          opacity: 1;
        }
        @starting-style {
          dialog.history-drawer-dialog[open]::backdrop {
            opacity: 0;
          }
        }
      `}</style>

      <dialog
        ref={dialogRef}
        className="history-drawer-dialog"
        data-testid="history-drawer"
        aria-labelledby="history-drawer-title"
      >
        <div className="flex flex-col h-full max-h-[80vh]">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#D8CFBE] pb-4">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wide text-[#2F6F5E]">
                {t.historyDrawerTitle}
              </span>
              <h3 id="history-drawer-title" className="text-2xl font-black text-[#171915] truncate">
                {exerciseName}
              </h3>
            </div>
            <button
              onClick={() => dialogRef.current?.close()}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D8CFBE] bg-white text-sm font-black text-[#626A5E] active:bg-[#ECE5D8]"
              aria-label="Close drawer"
            >
              {t.close}
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
            {/* PR Card */}
            <div className="rounded-3xl border border-[#D8CFBE] bg-white p-4">
              <span className="text-[10px] font-black uppercase tracking-wide text-[#626A5E]">
                {t.historyDrawerPr}
              </span>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Metric label={t.bestLoad} value={displayPrLoad} />
                <Metric label={t.bestSets} value={pr.bestSetCount || 0} />
              </div>
              {pr.bestLoadAt && (
                <p className="mt-2 text-right text-[10px] font-bold text-[#8D9387]">
                  Achieved: {new Date(pr.bestLoadAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Recent Logs list */}
            <div>
              <h4 className="mb-2 text-xs font-black uppercase tracking-wide text-[#626A5E]">
                {t.historyDrawerRecent}
              </h4>
              {historyLogs.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[#D8CFBE] bg-white/40 p-8 text-center">
                  <p className="text-sm font-bold text-[#8D9387]">
                    {t.historyDrawerEmpty}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historyLogs
                    .slice()
                    .reverse()
                    .map((log, idx) => (
                      <div key={idx} className="rounded-2xl border border-[#D8CFBE] bg-white p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-[#171915]">{log.date}</span>
                          <span className="rounded-full bg-[#EAF1EA] px-2.5 py-0.5 text-[10px] font-black text-[#17352D]">
                            {log.completedSets}/{log.totalSets} sets
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-[#626A5E]">
                          {log.weight && (
                            <div>
                              <span className="font-bold">Weight:</span> <strong className="text-[#171915] font-black">{log.weight}</strong>
                            </div>
                          )}
                          {log.rpe && (
                            <div>
                              <span className="font-bold">RPE:</span> <strong className="text-[#171915] font-black">{log.rpe}</strong>
                            </div>
                          )}
                        </div>
                        {log.note && (
                          <div className="rounded-xl bg-[#ECE5D8]/50 p-2 text-xs font-medium text-[#31362F] leading-relaxed italic">
                            {log.note}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
};
