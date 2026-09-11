export function AgentsUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 text-base text-[#FFBE00]/90">
      <span>Could not load agents</span>
      <button
        type="button"
        onClick={onRetry}
        className="arena-cta rounded-md border-2 border-[#00FBFF] px-3 py-1 font-dotGothic text-sm tracking-widest text-[#00FBFF] transition hover:bg-[#00FBFF] hover:text-black"
      >
        RETRY
      </button>
    </div>
  );
}
