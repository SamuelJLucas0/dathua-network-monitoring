import cron from 'node-cron';
import AIService from '../services/aiService.js';

// Cursor de "hasta dónde ya se analizó", en memoria del proceso (se resetea
// al reiniciar la API — un solo re-análisis extra de la ventana de 2h en ese
// caso, no un problema recurrente). Antes cada corrida volvía a pedir las
// últimas 2 horas completas de métricas sin importar qué ya se había
// analizado en la corrida anterior, así que una condición que llevara varias
// horas activa se reprocesaba ~60 veces antes de salir de la ventana —
// duplicando puntos en los baselines de EWMA/CUSUM (dathua-ia) y reemitiendo
// la misma anomalía a los clientes conectados cada 2 minutos indefinidamente.
let lastAnalyzedAt = null;

export const startAIScheduler = () => {
  // Se ejecuta cada 2 minutos (ajustable según tu necesidad)
  cron.schedule('*/2 * * * *', async () => {
    console.log('⏰ [Cron Job] Disparando análisis automático de IA...');
    const runStartedAt = new Date();
    try {
      // Primera corrida (o después de un reinicio): sin cursor todavía, se
      // analiza la ventana completa de 2h como antes. De ahí en adelante,
      // solo se piden métricas nuevas desde la corrida anterior.
      const filters = lastAnalyzedAt ? { captured_at: { $gte: lastAnalyzedAt } } : {};
      const result = await AIService.runFullAnalysis(2, filters);
      if (result.anomalies?.length > 0) {
        console.log(`🚨 [Cron Job] Se detectaron ${result.anomalies.length} anomalías.`);
      }
      // Solo avanza el cursor si la corrida fue exitosa — si el motor de IA
      // no respondió, la próxima corrida debe reintentar la misma ventana.
      lastAnalyzedAt = runStartedAt;
    } catch (error) {
      console.error('⚠️ [Cron Job] Error en análisis programado:', error.message);
    }
  });

  console.log('⏳ Programador de tareas de IA activo (frecuencia: cada 2 minutos)');
};
