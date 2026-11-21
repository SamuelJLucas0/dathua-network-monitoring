# module4_seasonal.py - VERSIÓN LIMPIA PARA PRODUCCIÓN
"""
Módulo 4: Analizador estacional - Versión Producción
"""

from datetime import datetime
from typing import Dict
import logging

logger = logging.getLogger(__name__)

# Patrones estacionales
SEASONAL_PATTERNS = {
    'avg_ms': {
        'hourly': {
            0: 20.0, 1: 19.5, 2: 19.0, 3: 18.5,
            4: 18.0, 5: 17.5, 6: 17.0, 7: 16.5,
            8: 16.0, 9: 15.5, 10: 15.0, 11: 15.5,
            12: 16.0, 13: 16.5, 14: 17.0, 15: 17.5,
            16: 18.0, 17: 18.5, 18: 19.0, 19: 19.5,
            20: 20.0, 21: 20.5, 22: 21.0, 23: 21.5
        }
    },
    'loss_percent': {
        'hourly': {
            0: 0.2, 1: 0.1, 2: 0.1, 3: 0.1,
            4: 0.1, 5: 0.2, 6: 0.3, 7: 0.5,
            8: 0.8, 9: 1.0, 10: 1.2, 11: 1.5,
            12: 1.8, 13: 2.0, 14: 2.2, 15: 2.5,
            16: 2.8, 17: 3.0, 18: 2.5, 19: 2.0,
            20: 1.5, 21: 1.0, 22: 0.5, 23: 0.3
        }
    }
}


def analizar_estacional(alerta: Dict, verbose: bool = False) -> Dict:
    """
    Analiza la alerta en contexto estacional
    """
    
    metric_type = alerta.get('metric_type', 'avg_ms')
    value = alerta.get('value', 0)
    anomaly_score_original = alerta.get('anomaly_score', 0.5)

    # BUG CORREGIDO (encontrado con una inyección de prueba de 15 min): esta
    # función tenía una rama que forzaba 'expected_baseline.ewma' a 0 cuando
    # la alerta traía la llave 'warmup_status', con la idea de "todavía no
    # ajustar el contexto estacional mientras el detector está calentando".
    # Pero detectar_ewma/detectar_percentiles (module2) SIEMPRE incluyen esa
    # llave en la alerta que devuelven (con un mensaje "Completado (N
    # puntos)") y NUNCA devuelven una alerta mientras el calentamiento sigue
    # en curso (regresan None y ni siquiera llegan hasta acá) — así que la
    # condición era verdadera para el 100% de las alertas reales, nunca solo
    # durante el calentamiento. Resultado: 'expected_Baseline' en Mongo/los
    # incidentes salía siempre en 0 ("Línea base: N/A" en el dashboard) para
    # CUALQUIER anomalía de EWMA/Percentiles, sin importar cuál fuera el
    # baseline real. Se elimina esa rama — el cálculo normal de abajo ya
    # cubre el caso de poco historial (usa el valor actual como referencia).

    # Obtener hora
    timestamp = alerta.get('timestamp')
    if timestamp:
        try:
            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            hora = dt.hour
        except:
            hora = datetime.now().hour
    else:
        hora = datetime.now().hour
    
    # Obtener patrón esperado
    pattern_hourly = SEASONAL_PATTERNS.get(metric_type, {}).get('hourly', {})
    expected_value = pattern_hourly.get(hora, 0)
    
    if expected_value == 0:
        expected_value = value
    
    # Calcular ratio
    if expected_value > 0:
        ratio = value / expected_value
    else:
        ratio = 1.0
    
    # Ajustar score
    anomaly_score_ajustado = anomaly_score_original
    
    if metric_type == 'loss_percent' and ratio > 10:
        if anomaly_score_original < 0.7:
            anomaly_score_ajustado = anomaly_score_original * 1.1
    elif ratio <= 1.5:
        factor_ajuste = 0.7 + (ratio / 5)
        anomaly_score_ajustado = anomaly_score_original * factor_ajuste
    elif ratio > 2.0:
        aumento = min(0.1, (ratio - 2) * 0.01)
        anomaly_score_ajustado = anomaly_score_original * (1 + aumento)
    
    anomaly_score_ajustado = min(1.0, max(0.0, anomaly_score_ajustado))
    
    # Solo log si el ajuste es significativo
    if verbose and abs(anomaly_score_ajustado - anomaly_score_original) > 0.05:
        logger.debug(f"Ajuste estacional: {metric_type} {anomaly_score_original:.3f} → {anomaly_score_ajustado:.3f} (ratio={ratio:.2f})")
    
    return {
        **alerta,
        'anomaly_score_original': round(anomaly_score_original, 4),
        'anomaly_score': round(anomaly_score_ajustado, 4),
        'ratio_vs_esperado': round(ratio, 2),
        'expected_baseline': {
            'ewma': round(expected_value, 2),
            'std_dev': round(expected_value * 0.2, 2),
            'percentile_95': round(expected_value + expected_value * 0.2 * 1.645, 2),
            'pattern': 'diario'
        },
        'seasonal_context': {
            'hora': hora,
            'expected_value': round(expected_value, 2),
            'deviation_percent': round(((value - expected_value) / expected_value * 100) if expected_value > 0 else 0, 2),
            'ajuste_aplicado': f"{round((anomaly_score_ajustado - anomaly_score_original) * 100, 1)}%"
        }
    }