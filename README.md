# RadarRisas

Cartelera de espectáculos de comedia en la Región Metropolitana de Chile.

## Arquitectura

- Next.js 16 y React 19 para el sitio público y el panel administrativo.
- Supabase para eventos, candidatos, autenticación y publicación manual.
- Scripts Node.js para descubrimiento, normalización, precios y disponibilidad.
- GitHub Actions para descubrimiento diario y verificación comercial periódica.
- Vercel para el despliegue web.

Los nuevos espectáculos nunca se publican automáticamente: se preparan como candidatos y conservan la aprobación administrativa existente. Las comprobaciones comerciales solo pueden actualizar precio y disponibilidad; no deben modificar datos editoriales.

## Desarrollo

```bash
npm ci
npm run dev
```

Variables locales requeridas por el sitio y por los scripts que consultan eventos publicados:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

`TICKETMASTER_API_KEY` es opcional para la fuente Ticketmaster. No se deben guardar valores reales en Git.

## Pruebas

```bash
npm test
npm run test:prices
npm run test:supabase
npm run lint
npx next typegen && npx tsc --noEmit
npm run build
```

Los tests unitarios usan fixtures locales. `test:prices` consulta una muestra real de Ticketplus y PuntoTicket, pero no escribe en Supabase.

## Automatización local

Descubrir y unificar fuentes:

```bash
npm run automation:discover
```

Auditar contra eventos publicados y normalizar candidatos:

```bash
npm run automation:normalize
```

Preparar una sincronización sin escrituras:

```bash
npm run automation:plan-sync
npm run automation:apply-sync
```

Verificar precios y disponibilidad de eventos publicados sin escrituras:

```bash
npm run automation:verify-commercial
npm run automation:apply-commercial
```

Para los tres comandos que consultan Supabase, exporta las variables públicas en el entorno o usa `node --env-file=.env.local` con el script correspondiente.

Los estados de disponibilidad son `available`, `limited`, `sold_out` y `unknown`. Un error de red, bloqueo o ausencia de evidencia siempre produce `unknown` y no reemplaza el último estado confirmado.

Los comandos `apply-*` siguen en modo dry-run salvo que
`RADARRISAS_WRITE_ENABLED=true`; además, el modo de escritura inicia sesión con
un usuario técnico y Supabase emite un JWT de una hora con el rol restringido
`radarrisas_automation`. Consulta
[supabase/README.md](supabase/README.md) para la preparación de staging y la
activación segura.

## Supabase

El esquema remoto se recuperó, respaldó y reconcilió. La baseline fue registrada
en producción y las migraciones incrementales `202611250001`–`202611250005`
fueron aplicadas el 25 de noviembre de 2026. La automatización fue activada y
validada en producción el 26 de noviembre de 2026:

- `RADARRISAS_WRITE_ENABLED=true` es la variable de repositorio activa;
- descubrimiento diario: `17 12 * * *` UTC;
- verificación comercial: cada tres horas y cada hora para funciones dentro de
  las próximas 36 horas;
- las escrituras usan un JWT efímero (máximo una hora) del rol limitado
  `radarrisas_automation`, nunca una clave `service_role`.

Los candidatos encontrados continúan siendo `pending` hasta la aprobación
manual. Para detener las escrituras ante una incidencia, cambiar inmediatamente
la variable de repositorio a `false`, conservar el historial y revisar
[`supabase/PRODUCTION_RUNBOOK.md`](supabase/PRODUCTION_RUNBOOK.md). El registro
verificable de activación está en
[`supabase/PRODUCTION_ACTIVATION.md`](supabase/PRODUCTION_ACTIVATION.md).

El build de producción usa explícitamente Webpack (`next build --webpack`). En
este Mac, Next.js 16.4.5 con Turbopack queda bloqueado durante la compilación aun
con caché limpia; Webpack completa el mismo build y es compatible con Vercel.

No cambies migraciones, permisos, secretos ni la variable de escrituras sin un
respaldo actual y autorización explícita.
