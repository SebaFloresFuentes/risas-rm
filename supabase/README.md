# Supabase: staging y activación segura

Producción y staging están separados:

- producción: `jfvvawackvodlvhrcndl` (`risas-rm`);
- staging: `stckxqupsgcaifpwpshv` (`radarrisas-staging`).

El enlace CLI principal sigue apuntando a producción. El enlace de staging vive
en `supabase/.temp/staging-workdir/`, está ignorado por Git y debe usarse para
cualquier operación remota de ensayo. Nunca se debe ejecutar `db push` desde un
contexto cuyo project ref no se haya comprobado primero.

## Esquema reproducible

`baseline/202611240000_production_public_schema.sql` es un dump de esquema de
producción, sin filas ni credenciales. En una base vacía se aplica antes de las
migraciones incrementales:

1. `202611250001`: disponibilidad, historial y archivado lógico;
2. `202611250002`: RPC de mínimo privilegio para automatización;
3. `202611250003`: grants explícitos y endurecimiento de privilegios;
4. `202611250004`: usuario técnico mediante Custom Access Token Hook;
5. `202611250005`: corrige la RPC heredada de archivado sin eliminar eventos.

Las seis versiones (`202611240000` a `202611250005`) están aplicadas y probadas
en staging. La baseline fue registrada como histórica y las cinco migraciones
incrementales también están aplicadas en producción. La automatización está
activa después de dos ejecuciones reales e idempotentes; consulta
[`PRODUCTION_ACTIVATION.md`](PRODUCTION_ACTIVATION.md) para los conteos, runs y
pendientes de revisión.

## Credenciales de automatización

GitHub Actions no usa `service_role`, claves de firma ni JWT persistentes. Cada
ejecución inicia sesión con un usuario de Supabase Auth registrado en
`private.radarrisas_automation_principals`. El Custom Access Token Hook cambia
únicamente su claim `role` a `radarrisas_automation`; el token expira en una
hora y se mantiene solo en memoria.

Secretos requeridos:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clave publicable para lecturas existentes);
- `SUPABASE_PUBLISHABLE_KEY`;
- `SUPABASE_AUTOMATION_EMAIL`;
- `SUPABASE_AUTOMATION_PASSWORD`;
- `TICKETMASTER_API_KEY`, solo si se habilita esa fuente.

Los inputs manuales de los workflows nacen desactivados. Desde la activación
validada del 26 de noviembre de 2026, la variable de repositorio de producción
`RADARRISAS_WRITE_ENABLED` está en `true`. Ante una anomalía, cambiarla
inmediatamente a `false`, conservar el historial y seguir la sección de
recuperación del runbook; no borrar datos ni deshacer las migraciones.

## Pruebas

Prueba aislada en PostgreSQL efímero, sin red:

```bash
npm run test:supabase
```

Prueba destructiva solo para datos sintéticos del proyecto staging conocido:

```bash
RADARRISAS_STAGING_TEST_ENABLED=true npm run test:staging
```

El segundo comando además requiere las cinco variables de staging descritas en
`scripts/test-staging-integration.mjs`. El script rechaza cualquier URL cuyo ref
no sea `stckxqupsgcaifpwpshv`.

Las pruebas cubren ingesta idempotente, concurrencia, aprobación manual,
actualización de precio, agotamiento, reposición, fallos temporales, protección
editorial, acceso anónimo y archivado sin borrado.

## Producción

El procedimiento completo de respaldo, reconciliación, migración, secretos,
dry-run, activación y reversión está en
[`PRODUCTION_RUNBOOK.md`](PRODUCTION_RUNBOOK.md). No ejecutar sus pasos de
mutación sin autorización explícita.
