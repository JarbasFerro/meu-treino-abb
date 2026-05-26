

export const Metric = ({ label, value, onClick, className = '' }) => {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={`rounded-3xl bg-[#ECE5D8] p-3 text-center transition ${onClick ? 'active:bg-[#D8CFBE] cursor-pointer hover:bg-[#E2D9C8] w-full block' : ''} ${className}`}
    >
      <span className="block text-[10px] font-black uppercase tracking-wide text-[#626A5E]">{label}</span>
      <strong className="mt-1 block break-words text-xl font-black text-[#17352D] sm:text-2xl">{value}</strong>
    </Component>
  );
};
