// src/config/plans.js
//
// Fuente única de verdad para los límites de cada plan de suscripción.
// Si el precio o los límites cambian, este es el único lugar que hay
// que tocar — todo lo demás (registro, creación de sucursales, control
// de nodos) lee de aquí.

export const PLAN_LIMITS = {
  BASICO: {
    label: 'Básico',
    maxSites: 1,
    maxNodesPerSite: 12,
    priceMXN: 449
  },
  PRO: {
    label: 'Pro',
    maxSites: 3,
    maxNodesPerSite: 15,
    priceMXN: 1199
  }
};

// Cargo fijo por nodo que excede el límite incluido en el plan.
// Ver el modelo de negocio: los nodos extra NO se bloquean, se cobran.
export const EXTRA_NODE_PRICE_MXN = 50;

// Duración de la prueba gratuita en días (configurable por entorno).
export const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 30);

export function getPlanLimits(planKey) {
  return PLAN_LIMITS[planKey] || PLAN_LIMITS.BASICO;
}
