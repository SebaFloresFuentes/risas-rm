# Activación de automatización de producción — 26 de noviembre de 2026

Proyecto validado: `risas-rm` (`jfvvawackvodlvhrcndl`). Staging permanece
separado en `stckxqupsgcaifpwpshv`.

## Respaldo y línea base

Los dumps de datos `public` anterior, posterior a la primera corrida y posterior
a la prueba de idempotencia están fuera del repositorio, en un directorio local
con permisos `0700`; los ficheros son `0600` y no se versionan. La restauración
es la indicada en [`PRODUCTION_RUNBOOK.md`](PRODUCTION_RUNBOOK.md).

Antes de habilitar escrituras:

- 17 eventos publicados;
- 14 candidatos: todos `approved`;
- 1 administrador;
- 5 registros de archivo histórico;
- 0 observaciones comerciales;
- 0 identidades duplicadas de funciones publicadas;
- hash SHA-256 de campos editoriales: `a6f3c9fa4049d1fc1536c13877b1e976fb2a1bd5411495af809404b5b872a79d`.

## Corridas reales

Se habilitó `RADARRISAS_WRITE_ENABLED=true` y se verificó su lectura desde
GitHub Actions.

| Flujo | Run | Resultado |
| --- | --- | --- |
| Descubrimiento inicial | [45738848486](https://github.com/SebaFloresFuentes/risas-rm/actions/runs/45738848486) | 20/20 RPC correctas: 9 candidatos `pending` y 11 observaciones. |
| Verificación inicial | [45739065593](https://github.com/SebaFloresFuentes/risas-rm/actions/runs/45739065593) | 17/17 observaciones correctas; archivado lógico: 0. |
| Descubrimiento repetido | [45739298301](https://github.com/SebaFloresFuentes/risas-rm/actions/runs/45739298301) | Las nueve claves devolvieron `existing_candidate`; no se duplicaron candidatos. |
| Verificación repetida | [45739463333](https://github.com/SebaFloresFuentes/risas-rm/actions/runs/45739463333) | 17/17 observaciones correctas; archivado lógico: 0. |

La verificación comercial de ambas corridas leyó 17 eventos, confirmó 2 como
`available`, informó 15 como `unknown`, detectó 10 precios, no confirmó
agotamientos ni disponibilidad limitada y no tuvo fallos HTTP. `unknown` no
sobrescribió estados confirmados; los dos estados confirmados mantienen su
marca de verificación. Las nuevas observaciones de ejecuciones separadas son
historial intencional, no duplicados: el total final es 56.

## Estado final verificado

- 17 eventos, 23 candidatos (14 `approved`, 9 `pending`), 1 administrador y
  5 archivados históricos;
- 56 observaciones comerciales, 13 precios conocidos, 0 `sold_out` y 0 nuevos
  archivados;
- hash editorial sin cambios respecto de la línea base;
- cero identidades duplicadas por `ticket_url + event_date + event_time`;
- una llamada anónima a una RPC administrativa fue rechazada con HTTP 401;
- el éxito de las cuatro escrituras confirma renovación desatendida de JWT
  corto y el rol restringido `radarrisas_automation`;
- producción visualmente validada en escritorio y móvil: CSS cargado, logo de
  36 px, cabecera adaptable, cartelera de 17 tarjetas y sin desbordamiento.

## Mantenimiento y recuperación

1. Ante un error crítico, ejecutar:

   ```bash
   gh variable set RADARRISAS_WRITE_ENABLED --body false --repo SebaFloresFuentes/risas-rm
   ```
2. Revisar el artefacto del workflow y los campos de evidencia antes de volver a
   intentar. Un error de ticketera solo es `unknown`.
3. Para revocación inmediata, deshabilitar el principal técnico y aplicar el
   procedimiento defensivo de `rollback/disable_automation.sql` con
   autorización. No elimina columnas, candidatos ni historial.
4. Restaurar desde el dump externo solo si una auditoría confirma corrupción;
   nunca usar restauración como primera respuesta a una observación errónea.

## Pendientes de revisión manual

- Paloma Salas: el slug de Ticketplus contiene una fecha que no coincide con
  la evidencia de la página; candidato sigue `pending`.
- Luis Slimming, Patio Bulnes: el slug declara 22:00 y la página indicó 21:00;
  candidato sigue `pending`.
- GitHub Actions informa una advertencia de deprecación del runtime Node.js 20
  en acciones de terceros. Actualizar esas dependencias y validarlas en staging
  antes de cambiar producción.
