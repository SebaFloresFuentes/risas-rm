type EventArtworkProps = {
    comedian: string;
    show: string;
    date: string;
  };
  
  function formatArtworkDate(date: string) {
    return new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "short",
    })
      .format(new Date(`${date}T12:00:00`))
      .replace(".", "")
      .toUpperCase();
  }
  
  export default function EventArtwork({
    comedian,
    show,
    date,
  }: EventArtworkProps) {
    return (
      <div className="absolute inset-0 overflow-hidden bg-[#120d1c]">
        {/* Luces de fondo */}
        <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-purple-600/30 blur-3xl" />
        <div className="absolute -bottom-20 -right-12 h-64 w-64 rounded-full bg-fuchsia-600/20 blur-3xl" />
  
        {/* Círculo decorativo */}
        <div className="absolute right-[-45px] top-[-55px] h-44 w-44 rounded-full border-[30px] border-purple-400/10" />
  
        {/* Patrón */}
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:32px_32px]" />
  
        <div className="relative flex h-full flex-col justify-between p-6">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-300">
              Risas RM
            </span>
  
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-bold text-zinc-300 backdrop-blur">
              {formatArtworkDate(date)}
            </span>
          </div>
  
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-purple-300/80">
              {show}
            </p>
  
            <h3 className="max-w-[90%] text-3xl font-black uppercase leading-[0.9] tracking-[-0.04em] text-white">
              {comedian}
            </h3>
  
            <div className="mt-4 h-1 w-12 rounded-full bg-purple-400" />
          </div>
        </div>
      </div>
    );
  }