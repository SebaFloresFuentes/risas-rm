# Runbook de activación de producción

Este documento es operativo. Los comandos con `--remote` modifican el proyecto
enlazado y requieren una autorización explícita inmediatamente antes de
ejecutarse. El project ref de producción es `jfvvawackvodlvhrcndl`.

## 1. Respaldo y preflight

1. Confirmar que `supabase/.temp/project-ref` contiene exactamente el ref de
   producción y que staging conserva el ref distinto `stckxqupsgcaifpwpshv`.
2. Dejar `RADARRISAS_WRITE_ENABLED=false` en GitHub.
3. Crear fuera del repositorio un directorio con permisos `0700` y exportar:

```bash
supabase db dump --remote --schema public,auth --file <respaldo>/schema.sql
supabase db dump --remote --data-only --schema public --file <respaldo>/public-data.sql
supabase db dump --remote --role-only --file <respaldo>/roles.sql
supabase migration list --remote > <respaldo>/migration-history.txt
```

4. Guardar también una copia administrada desde Dashboard/Backups si el plan lo
   permite. No versionar estos archivos: pueden contener datos personales.
5. Ejecutar `supabase db lint --remote --schema public` y revisar advisors,
   grants, RLS, triggers y funciones antes de continuar.

## 2. Registrar baseline y aplicar incrementos

Producción ya contiene el esquema representado por la baseline, pero no su
historial local. Después de comparar un dump fresco con la baseline:

```bash
supabase migration repair 202611240000 --status applied --remote --yes
supabase db push --remote --dry-run --include-all
```

El dry-run debe enumerar solo `202611250001` a `202611250005`. Si muestra la
baseline, otra migración o una destrucción, detenerse. Con autorización final:

```bash
supabase db push --remote --include-all --yes
supabase db lint --remote --schema public,private
supabase migration list --remote
```

## 3. Configurar Auth sin claves administrativas en GitHub

1. Crear en Supabase Auth un usuario técnico exclusivo de producción con
   contraseña aleatoria y correo confirmado; no reutilizar el de staging.
2. Insertar su UUID en `private.radarrisas_automation_principals` con
   `enabled=true` usando una sesión administrativa temporal.
3. En Authentication → Hooks, activar **Customize Access Token (JWT) Claims**,
   tipo Postgres, esquema `public`, función
   `radarrisas_custom_access_token_hook`.
4. Iniciar sesión con el usuario técnico y comprobar que el JWT tiene
   `role=radarrisas_automation` y una vida máxima de 3600 segundos.
5. Verificar que ese JWT puede invocar solo las tres RPC `radarrisas_*_v1`, no
   leer tablas privadas ni escribir directamente en tablas.

Renovación: Auth emite un token nuevo al comienzo de cada job. Rotar la
contraseña técnica periódicamente y de inmediato ante sospecha; para revocación
instantánea, poner `enabled=false` y ejecutar el rollback defensivo.

## 4. GitHub Actions

Configurar los secretos de producción:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- `SUPABASE_PUBLISHABLE_KEY`;
- `SUPABASE_AUTOMATION_EMAIL`;
- `SUPABASE_AUTOMATION_PASSWORD`;
- `TICKETMASTER_API_KEY` si corresponde.

Configurar la variable `RADARRISAS_WRITE_ENABLED=false`. Los workflows ya
incluyen concurrencia sin cancelación, timeout, reintentos acotados, artefactos
de diagnóstico y claves de idempotencia.

## 5. Git y Vercel

1. Revisar que no haya secretos: `git diff --check`, estado de Git y escaneo de
   patrones sensibles.
2. Ejecutar `npm test`, `npm run test:prices`, `npm run test:supabase`,
   `npm run lint`, `npx next typegen && npx tsc --noEmit` y `npm run build`.
3. Solo con autorización, crear commit y push de la rama revisada.
4. Configurar Vercel con las variables públicas de producción y desplegar la
   revisión. El build usa `next build --webpack`; no cambiar el proyecto público
   durante las pruebas previas.

## 6. Primera ejecución

1. Ejecutar manualmente ambos workflows con `write_enabled=false`.
2. Descargar artefactos y revisar candidatos, deduplicación, precios,
   disponibilidad y errores por ticketera.
3. Confirmar que ninguna escritura ocurrió.
4. Cambiar `RADARRISAS_WRITE_ENABLED=true` o usar una ejecución manual con el
   input habilitado, nunca ambos por accidente.
5. Ejecutar primero descubrimiento y luego verificación comercial.
6. Consultar candidatos, eventos e historial; comprobar que los nuevos quedan
   pendientes, los campos editoriales no cambian y los errores conservan el
   último estado confirmado.

## 7. Desactivación y recuperación

Acción inmediata:

1. poner `RADARRISAS_WRITE_ENABLED=false`;
2. deshabilitar el principal técnico (`enabled=false`);
3. ejecutar, con autorización, `rollback/disable_automation.sql`;
4. conservar columnas e historial para diagnóstico; no borrar registros;
5. restaurar datos desde el respaldo solo si una auditoría confirma corrupción.

La migración `005` conserva la firma heredada de archivado pero ya no elimina
eventos. Un rollback de aplicación puede volver al despliegue anterior sin
revertir el esquema; las columnas nuevas son compatibles con `sold_out`.
