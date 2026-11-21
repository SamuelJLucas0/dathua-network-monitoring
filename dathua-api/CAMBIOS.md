# Cambios aplicados a dathua-api

## Antes de correr esto
1. Este zip **no incluye `node_modules` ni `.env`** a propósito (no se debe compartir el `.env` real con secretos).
   Copia tu `.env` existente a la raíz del proyecto y agrega, si quieres personalizarla, la nueva variable:
   ```
   TRIAL_DAYS=30
   ```
2. Corre `npm install` — se agregaron 2 dependencias nuevas: `express-rate-limit` y `pdfkit`.
3. **Aplica la migración de base de datos** antes de levantar el servidor:
   `migrations/002_plan_trial_and_incident_fk.sql` (revisa el comentario dentro sobre el nombre real de tu
   foreign key de `incidents` antes de correrlo — puede variar según cómo se generó tu esquema).

## 🔴 Bugs críticos corregidos

- **`GET /api/nodes/worker/active`** ya NO regresa nodos de toda la organización cuando el agente se
  autentica con la Site API Key — ahora filtra estrictamente por la sucursal dueña de esa key. También
  ahora sí regresa el objeto `site` real (antes el agente siempre veía un default falso) y agrega `zoneId`
  a la respuesta (antes se perdía).
- **`incidentController.js`**: ninguna de sus consultas validaba que el incidente perteneciera a la
  organización del usuario autenticado (fuga de datos entre organizaciones distintas). Se agregó el filtro
  `orgId` en `getIncidents`, `getIncidentById`, `createIncident`, `resolveIncident` y `getIncidentStats`.
- **`app.js`**: se eliminó el import/montaje duplicado de `incidentRoutes` (el bug original que ya habías
  detectado, pero que seguía presente en la copia que yo tenía).

## 🟠 Modelo de negocio implementado

- Nuevas columnas en `organizations`: `plan` (`BASICO`/`PRO`), `subscriptionStatus`
  (`trialing`/`active`/`expired`/`cancelled`), `trialEndsAt`.
- El registro (`POST /api/auth/register`) ahora crea la organización en plan `BASICO`, estado `trialing`,
  con `trialEndsAt` = hoy + `TRIAL_DAYS` (30 por default).
- `verifyToken` ahora revisa en cada request autenticado con JWT si la prueba expiró; si es así, marca la
  cuenta como `expired` y responde `402 Payment Required` con `code: 'TRIAL_EXPIRED'`. Esto **no** afecta la
  ingesta de telemetría del agente (esa usa Site API Key, no JWT) — se decidió así para no perder datos de
  monitoreo mientras el cliente decide pagar.
- `POST /api/sites` ahora valida el límite de sucursales según el plan (`BASICO`: 1, `PRO`: 3) antes de
  crear una nueva. Si se alcanza el límite, responde `403` con `code: 'SITE_LIMIT_REACHED'`.
- Los nodos **no se bloquean** al pasarse del límite del plan (12/sucursal en Básico, 15/sucursal en Pro) —
  según el modelo de negocio, se cobran aparte ($50 MXN/nodo extra). Nuevo endpoint para ver el uso real:
  **`GET /api/organizations/usage`** — regresa sucursales, nodos por sucursal, nodos excedentes y el cargo
  extra estimado.
- Límites y precios centralizados en `src/config/plans.js` — es el único archivo que hay que tocar si cambia
  el precio o los límites de un plan.

## 🟡 Módulo nuevo: reportes de auditoría

- **`GET /api/reports/site/:siteId/audit?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv|pdf`**
- Cruza datos de MySQL (incidentes, catálogo de nodos) con MongoDB (disponibilidad real calculada desde
  `node_metrics`: % de tiempo arriba, latencia/jitter/pérdida promedio).
- `format=csv` y `format=pdf` generan el archivo descargable directamente; sin `format` regresa JSON (útil
  para que el futuro dashboard lo grafique antes de exportar).
- Incluye incidentes de nodos ya eliminados (posible gracias al cambio de `ON DELETE CASCADE` a `SET NULL`
  que ya habías decidido) en vez de perder ese historial.

## 🟢 Seguridad

- Rate limiting agregado: `POST /api/auth/login` (10 intentos/15 min por IP), `POST /api/auth/register`
  (20/hora por IP), `POST /api/telemetry/report` (10/min por sucursal).
- **Pendiente, decidido explícitamente para después:** cifrado en reposo de las credenciales SNMP
  (`snmpCommunity`, `snmpAuthPass`, `snmpPrivPass`). Siguen en texto plano por ahora.

## ⚠️ Importante: esto no se probó contra una base de datos real
No tengo acceso a un MySQL/MongoDB real en mi entorno de trabajo. Verifiqué que:
- Todo el código pasa `node --check` (sintaxis válida).
- `app.js` importa y monta todas las rutas sin errores de módulo (probado con stubs temporales de las
  librerías nuevas, ya eliminados de este zip).

Pero **no** se ejecutaron las queries SQL/Mongo contra datos reales. Antes de considerar esto listo para
producción, corre el servidor contra tu base de datos de desarrollo y prueba al menos: registro de una
organización nueva, creación de una segunda sucursal en plan Básico (debe rechazarse), y la generación de
un reporte de auditoría en los 3 formatos.
