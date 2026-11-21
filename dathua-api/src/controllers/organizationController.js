import pool from '../config/mysql.js';
import { getPlanLimits, EXTRA_NODE_PRICE_MXN } from '../config/plans.js';

// GET /api/organizations/usage
//
// Da una fotografía de cómo va la organización respecto a los límites de
// su plan: cuántas sucursales/nodos tiene vs. lo incluido, cuántos nodos
// se pasan del límite (esos SÍ se permiten, pero se facturan aparte según
// el modelo de negocio), y el estado de la prueba gratuita.
export const getUsage = async (req, res) => {
  try {
    const { orgId } = req.user;

    const [orgRows] = await pool.query(
      'SELECT name, plan, subscriptionStatus, trialEndsAt FROM organizations WHERE orgId = ?',
      [orgId]
    );
    if (orgRows.length === 0) {
      return res.status(404).json({ message: 'Organización no encontrada' });
    }
    const org = orgRows[0];
    const limits = getPlanLimits(org.plan);

    const [sites] = await pool.query(
      `SELECT s.siteId, s.name,
              COUNT(n.nodeId) AS nodeCount
       FROM sites s
       LEFT JOIN nodes n ON n.siteId = s.siteId
       WHERE s.orgId = ?
       GROUP BY s.siteId, s.name`,
      [orgId]
    );

    let totalExtraNodes = 0;
    const sitesUsage = sites.map((s) => {
      const extraNodes = Math.max(0, s.nodeCount - limits.maxNodesPerSite);
      totalExtraNodes += extraNodes;
      return {
        siteId: s.siteId,
        name: s.name,
        nodeCount: s.nodeCount,
        nodeLimit: limits.maxNodesPerSite,
        extraNodes
      };
    });

    const daysLeftInTrial = org.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(org.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24)))
      : null;

    res.json({
      organization: org.name,
      plan: org.plan,
      planLabel: limits.label,
      subscriptionStatus: org.subscriptionStatus,
      trialEndsAt: org.trialEndsAt,
      daysLeftInTrial,
      limits: {
        maxSites: limits.maxSites,
        maxNodesPerSite: limits.maxNodesPerSite
      },
      usage: {
        totalSites: sites.length,
        sites: sitesUsage,
        totalExtraNodes,
        estimatedExtraChargeMXN: totalExtraNodes * EXTRA_NODE_PRICE_MXN
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo el uso del plan', error: error.message });
  }
};
