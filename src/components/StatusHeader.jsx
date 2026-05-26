

export const StatusHeader = ({
  t,
  firebaseReady,
  isSynced,
  hasStorageWarning,
  storageUsageRatio,
  storageStatus,
  setShowResetModal,
}) => (
  <header data-testid="status-header" className="sticky top-0 z-30 border-b border-[#D8CFBE] bg-[#F4F0E8]/95 px-3 pb-2 pt-[calc(var(--safe-top)+0.35rem)] backdrop-blur-xl">
    <div className="mx-auto flex max-w-md items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#2F6F5E]">{t.statusTitle}</p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1">
          <h1 className="truncate text-lg font-black leading-none text-[#171915]">Hybrid Fit</h1>
          {firebaseReady && (
            <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase ${isSynced ? 'bg-[#EAF1EA] text-[#17352D]' : 'bg-[#FFF0EC] text-[#A6422F]'}`}>
              {isSynced ? t.syncOnline : t.syncOffline}
            </span>
          )}
          <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase ${hasStorageWarning ? 'bg-[#FFF8E8] text-[#654C12]' : 'bg-[#EAF1EA] text-[#17352D]'}`}>
            {storageUsageRatio > 0.85 ? t.storageLow : storageStatus.persisted ? t.storagePersistent : t.storageTemporary}
          </span>
          {storageStatus.pending > 0 && (
            <span className="rounded-full bg-[#FFF8E8] px-1.5 py-0.5 text-[8px] font-black uppercase text-[#654C12]">
              {storageStatus.pending} {t.syncPending}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 justify-end text-[10px] font-black">
        <button
          onClick={() => setShowResetModal(true)}
          className="min-h-11 min-w-11 rounded-full border border-[#D9B8B0] bg-[#FFF8F6] px-2 text-[#A6422F]"
        >
          {t.resetActionShort}
        </button>
      </div>
    </div>
  </header>
);
