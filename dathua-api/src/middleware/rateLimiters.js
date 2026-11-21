import rateLimit from 'express-rate-limit';

// Protege /api/auth/login contra fuerza bruta: pocos intentos por IP.
// No limitamos /register con la misma dureza para no bloquear registros
// legítimos desde una misma red (oficina/coworking).
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.' }
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados registros desde esta red. Intenta de nuevo más tarde.' }
});

// Protege /api/telemetry/report contra saturación. El agente reporta cada
// ~20s por diseño, así que 10 requests/minuto por sucursal deja margen de
// sobra sin abrir la puerta a un flood accidental o malicioso.
export const telemetryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers['x-site-key'] || req.ip,
  message: { message: 'Demasiados reportes de telemetría en poco tiempo para esta sucursal.' }
});

// El descubrimiento de red corre cada 30-60 min por diseño (no cada 20s
// como la telemetría), así que el límite puede ser más laxo.
export const discoveryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers['x-site-key'] || req.ip,
  message: { message: 'Demasiados reportes de descubrimiento en poco tiempo para esta sucursal.' }
});
