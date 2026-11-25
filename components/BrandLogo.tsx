export default function BrandLogo() {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <svg aria-hidden="true" viewBox="0 0 48 48" className="h-9 w-9 shrink-0 text-purple-400" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="24" cy="24" r="21" />
        <circle cx="24" cy="24" r="14" opacity=".5" />
        <path d="M24 24V3A21 21 0 0 1 45 24Z" fill="currentColor" opacity=".15" stroke="none" />
        <path d="M24 24L39 9" strokeLinecap="round" />
        <circle cx="34" cy="14" r="2" fill="currentColor" />
        <path d="M15 27Q24 40 33 27" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="font-black tracking-tight text-white">RADAR<span className="text-purple-400">RISAS.</span></span>
    </span>
  );
}
