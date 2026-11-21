import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import siteRoutes from './routes/siteRoutes.js';
import zoneRoutes from './routes/zoneRoutes.js';
import nodeRoutes from './routes/nodeRoutes.js';
import incidentRoutes from './routes/incidentRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import discoveryRoutes from './routes/discoveryRoutes.js';
import metricsRoutes from './routes/metricsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import userRoutes from './routes/userRoutes.js';

const app = express();

// exposedHeaders: sin esto, el navegador recibe el Content-Disposition de
// los reportes CSV/PDF en la respuesta real, pero el fetch() del frontend
// no puede leerlo (los headers no-simples quedan ocultos a JS entre
// orígenes distintos por default) — así que el nombre de archivo sugerido
// se perdía y siempre se descargaba como "reporte.csv"/"reporte.pdf".
app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
app.use(express.json());

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/nodes', nodeRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

export default app;