# Validación de staging — 25 de noviembre de 2026

Proyecto probado: `radarrisas-staging` (`stckxqupsgcaifpwpshv`). El ref de
producción `jfvvawackvodlvhrcndl` no se utilizó para migraciones ni escrituras.

## Base de datos

- Baseline y migraciones `202611250001`–`202611250005`: aplicadas.
- `supabase db lint --remote --schema public,private`: sin errores.
- Catálogo: 16 constraints, 15 índices, 1 trigger de usuario, 6 tablas con RLS,
  7 políticas y 8 funciones en `public`/`private`.
- Hook `radarrisas_custom_access_token_hook`: ejecutable solo por
  `supabase_auth_admin`.
- La RPC heredada de archivado tenía un error de columnas; la migración `005`
  conserva su firma y la convierte en archivado lógico.

## Auth y permisos reales

- Token técnico: ES256, rol `radarrisas_automation`, duración 3600 segundos.
- RPC de automatización con token técnico: HTTP 200.
- Escritura directa a `events` con token técnico: HTTP 403.
- RPC administrativa anónima: HTTP 401.
- `publish_event_candidate` con usuario autenticado no administrador: rechazada.
- Login y aprobación manual con administrador registrado: correctos.

## Flujo de datos real

- Ingesta concurrente de un candidato: una inserción y tres respuestas
  idempotentes, sin duplicados.
- El candidato permaneció `pending` hasta la aprobación administrativa.
- Publicación manual: correcta.
- Transiciones verificadas: `available` → `sold_out` → `available` → `limited`.
- Reposición detectada con transición `restocked`.
- Timeout registrado como `unknown` sin perder precio ni estado confirmado.
- Cinco observaciones con cinco claves únicas; la concurrencia no duplicó
  historial.
- Campos editoriales permanecieron sin cambios.
- Evento finalizado: `archived_at` informado y registro conservado.
- `RADARRISAS_WRITE_ENABLED=false`: 19 acciones planificadas, 19 dry-run, cero
  escrituras y cero errores, incluso con credenciales deliberadamente inválidas.

## Descubrimiento y aplicación

- 47 fichas encontradas: 14 Ticketplus, 18 PuntoTicket y 15 Comedy Pass.
- 21 quedaron para revisión; 19 se normalizaron como listas para la bandeja y
  2 requieren verificación.
- Comedy Pass conservó año y precio como desconocidos cuando no había evidencia.
- Ticketmaster se omitió por ausencia de `TICKETMASTER_API_KEY`.
- El plan contra staging leyó 1 evento publicado y dejó 19 candidatos en
  dry-run; no ejecutó RPC de escritura.

## Next.js

- Sitio público contra staging: mostró el evento y el estado `limited`.
- Protección `/admin`: redirección al login correcta.
- Login, bandeja e importación administrativa: operativos contra staging.
- Turbopack 16.4.5 se bloquea durante el build aun con `.next` limpia. Webpack
  compila en aproximadamente 3,4 segundos y genera las 14 rutas.
- Tests unitarios (11), precios, integración PostgreSQL, ESLint, TypeScript,
  YAML, `git diff --check` y build Webpack: correctos.

## Advisors pendientes

Supabase reporta tres advertencias, ninguna bloquea la activación:

1. `publish_event_candidate` es `SECURITY DEFINER` y ejecutable por
   `authenticated`; es intencional y comprueba `admin_users` internamente. Un
   usuario no administrador fue rechazado en la prueba real.
2. Dos políticas permisivas de actualización de candidatos se superponen. Es
   una advertencia de rendimiento heredada; no se fusionaron para evitar cambiar
   el flujo administrativo antes del lanzamiento.
3. Leaked Password Protection está desactivado. Evaluar su disponibilidad en el
   plan antes de activarlo; no se contrató ningún servicio.

Al cerrar esta validación de staging no se habían ejecutado migraciones o
escrituras en producción. La activación posterior sigue el procedimiento de
`PRODUCTION_RUNBOOK.md`.
