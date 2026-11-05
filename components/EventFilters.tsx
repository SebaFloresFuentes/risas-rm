"use client";

type EventFiltersProps = {
  search: string;
  comuna: string;
  venue: string;
  sort: string;
  comunas: string[];
  venues: string[];
  onSearchChange: (value: string) => void;
  onComunaChange: (value: string) => void;
  onVenueChange: (value: string) => void;
  onSortChange: (value: string) => void;
};

export default function EventFilters({
  search,
  comuna,
  venue,
  sort,
  comunas,
  venues,
  onSearchChange,
  onComunaChange,
  onVenueChange,
  onSortChange,
}: EventFiltersProps) {
  return (
    <div className="mb-10 grid gap-3 md:grid-cols-4">
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="🔎 Buscar comediante o show..."
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 outline-none transition focus:border-purple-400"
      />

      <select
        value={comuna}
        onChange={(e) => onComunaChange(e.target.value)}
        className="rounded-xl border border-white/10 bg-[#181720] px-4 py-4"
      >
        <option value="">Todas las comunas</option>

        {comunas.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <select
        value={venue}
        onChange={(e) => onVenueChange(e.target.value)}
        className="rounded-xl border border-white/10 bg-[#181720] px-4 py-4"
      >
        <option value="">Todos los locales</option>

        {venues.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value)}
        className="rounded-xl border border-white/10 bg-[#181720] px-4 py-4"
      >
        <option value="date">Fecha más próxima</option>
        <option value="price">Menor precio</option>
        <option value="name">Comediante A–Z</option>
      </select>
    </div>
  );
}