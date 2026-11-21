import jwt from 'jsonwebtoken';
import pool from '../config/mysql.js';

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer <TOKEN>

  if (!token) {
    return res.status(401).json({ message: 'Acceso no autorizado: Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Inyecta { userId, orgId, email } en el request

    // Verificar que la prueba gratuita no haya expirado (o que la cuenta
    // tenga una suscripción activa). Esto corre en cada request autenticado
    // con JWT (dashboard web) — deliberadamente NO se aplica a la ingesta
    // de telemetría del agente (esa usa Site API Key, otro middleware),
    // para no perder datos de monitoreo mientras el cliente decide pagar.
    const [orgs] = await pool.query(
      'SELECT subscriptionStatus, trialEndsAt FROM organizations WHERE orgId = ?',
      [decoded.orgId]
    );

    if (orgs.length > 0) {
      const org = orgs[0];
      const trialExpired = org.trialEndsAt && new Date(org.trialEndsAt) < new Date();

      if (org.subscriptionStatus === 'trialing' && trialExpired) {
        // Primera vez que se detecta el vencimiento: se marca como expirada.
        await pool.query(
          "UPDATE organizations SET subscriptionStatus = 'expired' WHERE orgId = ?",
          [decoded.orgId]
        );
        return res.status(402).json({
          message: 'Tu periodo de prueba terminó. Actualiza tu plan para seguir usando DatHua.',
          code: 'TRIAL_EXPIRED'
        });
      }

      if (org.subscriptionStatus === 'expired' || org.subscriptionStatus === 'cancelled') {
        return res.status(402).json({
          message: 'Tu cuenta no tiene una suscripción activa. Actualiza tu plan para continuar.',
          code: 'SUBSCRIPTION_INACTIVE'
        });
      }
    }

    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token inválido o expirado' });
  }
};