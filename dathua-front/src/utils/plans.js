// Espejo del catálogo de planes de dathua-api/src/config/plans.js — son
// datos públicos de negocio (ya se muestran en la landing), así que no hace
// falta pedirlos al backend solo para dibujar la comparación de planes.
export const PLANS = {
  BASICO: { key: 'BASICO', label: 'Básico', maxSites: 1, maxNodesPerSite: 12, priceMXN: 449 },
  PRO: { key: 'PRO', label: 'Pro', maxSites: 3, maxNodesPerSite: 15, priceMXN: 1199 },
}

export function otherPlan(currentPlanKey) {
  return currentPlanKey === 'PRO' ? PLANS.BASICO : PLANS.PRO
}
