import { readFile, writeFile } from "node:fs/promises";

const input = new URL(
  "../data/ticketplus-discovered.json",
  import.meta.url
);

const output = new URL(
  "../data/rm-discovered.json",
  import.meta.url
);

const data = JSON.parse(await readFile(input, "utf8"));

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isRM(event) {
  const address = normalize(event.venueAddress);

  return (
    address.includes("region metropolitana") ||
    address.includes("metropolitan region")
  );
}

const events = [];
const excluded = [];

for (const event of data.events ?? []) {
  if (isRM(event)) {
    events.push(event);
  } else {
    excluded.push({
      name: event.name,
      location: event.location,
      address: event.venueAddress,
      reason: "Fuera de la RM o ubicación sin confirmar",
    });
  }
}

const result = {
  generatedAt: new Date().toISOString(),
  source: "Ticketplus",
  total: events.length,
  excludedCount: excluded.length,
  events,
  excluded,
};

await writeFile(
  output,
  JSON.stringify(result, null, 2) + "\n",
  "utf8"
);

console.log("\n🎭 RISAS RM - FILTRO GEOGRÁFICO");
console.log(`Detectados: ${(data.events ?? []).length}`);
console.log(`En Región Metropolitana: ${events.length}`);
console.log(`Excluidos: ${excluded.length}`);

console.log("\nEVENTOS EN LA RM:");

for (const event of events) {
  console.log(
    `✅ ${event.startDate} | ${event.name} | ${event.location}`
  );
}

console.log("\nEVENTOS EXCLUIDOS:");

for (const event of excluded) {
  console.log(
    `⛔ ${event.name} | ${event.address ?? "Sin dirección"}`
  );
}

console.log("\nArchivo generado: data/rm-discovered.json");
console.log("Supabase no fue modificado.");
