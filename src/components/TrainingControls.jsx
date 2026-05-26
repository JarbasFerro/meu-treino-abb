export const ModeSwitch = ({ mode, setMode, t }) => (
  <div className="grid grid-cols-2 rounded-full bg-[#E8E0D1] p-1" aria-label={t.modeLabel}>
    {['home', 'hotel'].map((option) => (
      <button
        key={option}
        onClick={() => setMode(option)}
        className={`min-h-11 rounded-full px-4 text-sm font-black transition ${
          mode === option ? 'bg-[#17352D] text-white shadow-sm' : 'text-[#596155]'
        }`}
      >
        {option === 'home' ? t.homeMode : t.hotelMode}
      </button>
    ))}
  </div>
);

export const BottomNav = ({ activeView, setActiveView, t }) => {
  const items = [
    { id: 'today', label: t.navToday, icon: '●' },
    { id: 'plan', label: t.navPlan, icon: '▦' },
    { id: 'progress', label: t.navProgress, icon: '↗' },
  ];

  return (
    <nav data-testid="bottom-nav" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#D8CFBE] bg-[#FFFCF4]/95 px-2 pb-[var(--safe-bottom)] pt-1 backdrop-blur-xl">
      <div className="mx-auto grid h-[var(--nav-content-height)] max-w-md grid-cols-3 gap-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`flex min-h-11 items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-black uppercase transition ${
              activeView === item.id ? 'bg-[#17352D] text-white' : 'text-[#626A5E]'
            }`}
          >
            <span className="text-sm leading-none">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export const ExerciseGuidance = ({ guidance, exercise, expanded, setExpanded, t }) => (
  <section className="rounded-3xl border border-[#D8CFBE] bg-[#FFFCF4] p-4">
    <button
      onClick={() => setExpanded(!expanded)}
      className="flex min-h-11 w-full items-center justify-between text-left"
    >
      <span className="text-sm font-black uppercase tracking-wide text-[#17352D]">
        {expanded ? t.hideGuidance : t.showGuidance}
      </span>
      <span className="text-xl">{expanded ? '−' : '+'}</span>
    </button>

    <div className="mt-3 flex flex-wrap gap-2">
      {guidance.cues.slice(0, 3).map((cue) => (
        <span key={cue} className="rounded-full bg-[#EAF1EA] px-3 py-2 text-xs font-bold text-[#17352D]">
          {cue}
        </span>
      ))}
    </div>

    {expanded && (
      <div className="mt-5 space-y-5 text-sm leading-relaxed text-[#31362F]">
        <p className="font-bold">{exercise.instructions}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-[#2F6F5E]">{t.guidanceCues}</p>
            <ul className="space-y-1">{guidance.cues.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-[#2F6F5E]">{t.guidanceAvoid}</p>
            <ul className="space-y-1">{guidance.mistakes.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-[#2F6F5E]">{t.guidanceSetup}</p>
            <ul className="space-y-1">{guidance.setup.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
        <p className="border-t border-[#D8CFBE] pt-4 text-xs font-semibold text-[#626A5E]">{guidance.progression}</p>
        <p className="rounded-2xl bg-[#FFF8E8] p-3 text-xs font-bold text-[#654C12]">{t.safetyNote}</p>
      </div>
    )}
  </section>
);

export const RestTimer = ({ timer, formatTime, adjustTimer, setTimer, t, elevated = false }) => {
  if (!timer.active && timer.time <= 0) return null;

  return (
    <div data-testid="rest-timer" className="fixed inset-x-0 z-50 px-3" style={{ bottom: elevated ? 'var(--timer-elevated-bottom)' : 'var(--timer-bottom)' }}>
      <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-[#17352D] bg-[#17352D] text-white shadow-2xl">
        <div
          className="h-1 bg-[#9AD0B1] transition-all duration-1000"
          style={{ width: `${timer.total ? (timer.time / timer.total) * 100 : 0}%` }}
        />
        <div className="flex items-center justify-between gap-2 p-2">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#BBD8C9]">{t.rest}</p>
            <p className="text-2xl font-black leading-none">{formatTime(timer.time)}</p>
          </div>
          <div className="flex gap-1 text-[11px] font-black">
            <button onClick={() => adjustTimer(-15)} className="min-h-11 rounded-xl border border-white/20 px-2">-15</button>
            <button onClick={() => adjustTimer(30)} className="min-h-11 rounded-xl border border-white/20 px-2">+30</button>
            <button
              onClick={() => setTimer((prev) => ({ ...prev, active: !prev.active }))}
              className="min-h-11 rounded-xl bg-white px-3 text-[#17352D]"
            >
              {timer.active && timer.time > 0 ? t.pause : t.play}
            </button>
            <button onClick={() => setTimer({ active: false, time: 0, total: 60 })} className="min-h-11 rounded-xl border border-white/20 px-2">
              {t.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
