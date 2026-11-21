# module1_preprocessor.py - VERSIÓN LIMPIA PARA PRODUCCIÓN
"""
Módulo 1: Preprocesador - Versión Producción
Filtra métricas inválidas y prepara datos para análisis
"""

import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from collections import deque
import numpy as np
import logging

# Configurar logger silencioso
logger = logging.getLogger(__name__)

# Historial real por nodo+métrica (ventana móvil de hasta WINDOW_SIZE puntos).
# NOTA: vive en memoria del proceso, igual que EWMA_CACHE/CUSUM_CACHE en los
# módulos 2 y 3 — no sobrevive un reinicio ni se comparte entre workers si se
# despliega con más de 1 proceso. Ese es un pendiente ya documentado aparte
# (mover a Redis/Mongo); aquí solo se resuelve que el baseline sea real.
HISTORY_WINDOWS: Dict[str, deque] = {}
WINDOW_SIZE = 60

def preprocesar(metrics_array: List[Dict], verbose: bool = False) -> Dict:
    """
    Preprocesa un array de métricas
    
    Args:
        metrics_array: Lista de métricas con formato estándar
        verbose: Si es True, muestra detalles de filtrado
    
    Returns:
        Dict con datos procesados y estadísticas
    """
    
    processed_metrics = []
    metricas_ignoradas = []
    
    for idx, metric in enumerate(metrics_array):
        # Extraer datos
        metadata = metric.get('metadata', {})
        node_id = metadata.get('node_id')
        status = metric.get('status', 'UNKNOWN')
        loss_percent = metric.get('loss_percent', 0)
        avg_ms = metric.get('avg_ms')
        rtts_ms = metric.get('rtts_ms', [])
        transmitted = metric.get('transmitted', 0)
        
        # Obtener timestamp
        captured_at = metric.get('captured_at', {})
        if isinstance(captured_at, dict) and '$date' in captured_at:
            timestamp_str = captured_at['$date']
        else:
            timestamp_str = captured_at
        
        # Filtros (comentados para producción, solo log si verbose)
        filtro_aplicado = None
        
        # FILTRO 1: Status DEGRADED o DOWN
        if status in ['DEGRADED', 'DOWN']:
            filtro_aplicado = f'Status {status} - problema conocido'
            metricas_ignoradas.append({
                'node_id': node_id,
                'status': status,
                'reason': f'El nodo ya está en estado {status}'
            })
            if verbose:
                logger.debug(f"Filtrado: node_{node_id} - {filtro_aplicado}")
            continue
        
        # FILTRO 2 (ELIMINADO): antes descartaba cualquier métrica con
        # pérdida > 10% como "problema ya conocido, no hace falta detectarlo".
        # Pero a diferencia de FILTRO 1 (status DEGRADED/DOWN, donde SÍ hay
        # otra señal visible — el estado del nodo), una pérdida del 11-99%
        # con al menos un paquete recibido deja al agente reportando
        # status='UP' igual que siempre (ver telemetryController.ingestTelemetry:
        # nodeStatus = 'Online' si status==='UP') — el nodo se ve "En línea" en
        # el dashboard. Como CUSUM (module3_cusum.py) es justo el detector
        # diseñado para pérdida de paquetes, este filtro le impedía ver el
        # 100% de los casos que le importan: una pérdida sostenida del 20-35%
        # (un problema real y serio) nunca generaba anomalía, nunca incidente,
        # nunca notificación — quedaba invisible en todo el sistema. Encontrado
        # con una inyección de prueba de 15 min con una caída de paquetes real
        # y sostenida en un nodo que nunca escaló a incidente.
        # FILTRO 3: avg_ms null
        if avg_ms is None:
            filtro_aplicado = 'avg_ms null'
            metricas_ignoradas.append({
                'node_id': node_id,
                'status': status,
                'reason': 'Datos incompletos'
            })
            if verbose:
                logger.debug(f"Filtrado: node_{node_id} - {filtro_aplicado}")
            continue
        
        # FILTRO 4: RTTs erráticos (ruido de medición, NO latencia alta real)
        #
        # La versión anterior descartaba la métrica si más de la mitad de los
        # RTTs superaban 100ms — eso confunde "latencia alta" con "medición
        # no confiable". Un RTT de [400, 410, 395, 405, 400]ms es una
        # degradación REAL y sostenida que el sistema debe poder detectar
        # como anomalía, no descartar antes de que llegue a los detectores.
        #
        # Lo que sí conviene filtrar es cuando los valores saltan de forma
        # errática entre sí (ej. [5, 200, 8, 150, 12]ms), que sugiere ruido
        # de medición o pérdida intermitente de paquetes, sin importar si el
        # promedio es alto o bajo. Para eso usamos el coeficiente de
        # variación (desviación estándar / media): alto = errático/no
        # confiable, bajo = consistente aunque el valor absoluto sea alto.
        if rtts_ms and len(rtts_ms) >= 3:
            rtts_validos = [r for r in rtts_ms if r is not None and r >= 0]
            if len(rtts_validos) >= 3:
                media_rtt = sum(rtts_validos) / len(rtts_validos)
                if media_rtt > 0:
                    varianza = sum((r - media_rtt) ** 2 for r in rtts_validos) / len(rtts_validos)
                    coef_variacion = (varianza ** 0.5) / media_rtt

                    if coef_variacion > 0.75:
                        filtro_aplicado = f'RTTs erráticos (coef. variación {coef_variacion:.2f})'
                        metricas_ignoradas.append({
                            'node_id': node_id,
                            'status': status,
                            'reason': 'RTTs con dispersión anómala entre sí (posible ruido de medición)'
                        })
                        if verbose:
                            logger.debug(f"Filtrado: node_{node_id} - {filtro_aplicado}")
                        continue
        
        # FILTRO 5: pérdida 100%
        if loss_percent == 100:
            filtro_aplicado = 'Pérdida 100% - nodo caído'
            metricas_ignoradas.append({
                'node_id': node_id,
                'status': status,
                'loss_percent': 100,
                'reason': 'Nodo sin respuesta'
            })
            if verbose:
                logger.debug(f"Filtrado: node_{node_id} - {filtro_aplicado}")
            continue
        
        # ✅ Pasa todos los filtros
        window_stats = calcular_estadisticas_ventana(str(node_id), metric)
        
        processed = {
            'node_id': str(node_id),
            'node_name': f"node_{node_id}",
            'org_id': metadata.get('org_id'),
            'site_id': metadata.get('site_id'),
            'zone_id': metadata.get('zone_id'),
            'captured_at': timestamp_str,
            'status': status,
            'metrics': {
                'avg_ms': avg_ms,
                'min_ms': metric.get('min_ms'),
                'max_ms': metric.get('max_ms'),
                'loss_percent': loss_percent,
                'jitter_ms': metric.get('jitter_ms'),
                'stddev_ms': metric.get('stddev_ms'),
                'transmitted': transmitted,
                'received': metric.get('received', 0),
            },
            'window_stats': window_stats,
            'protocol': metadata.get('protocol', 'ICMP'),
            'target': metadata.get('target'),
            'rtts_ms': rtts_ms,
            'filtros_pasados': True
        }
        
        processed_metrics.append(processed)
    
    # Log resumido (si hay métricas ignoradas)
    if metricas_ignoradas and verbose:
        logger.info(f"Filtradas {len(metricas_ignoradas)} métricas inválidas")
    
    return {
        'processed_metrics': processed_metrics,
        'ignored_metrics': metricas_ignoradas if verbose else [],  # Solo guardar si verbose
        'timestamp': datetime.now().isoformat(),
        'total_metrics': len(metrics_array),
        'total_processed': len(processed_metrics),
        'total_ignored': len(metricas_ignoradas)
    }


def calcular_estadisticas_ventana(node_id: str, metric: Dict) -> Dict:
    """
    Calcula estadísticas de la ventana para un nodo específico a partir de
    su historial REAL acumulado (no de números generados al azar).

    Mientras el historial es corto (menos de 3 puntos), no hay suficiente
    información para un baseline confiable — se usa el valor actual como
    única referencia y se refleja esa incertidumbre con 'baseline_confidence'
    baja, en vez de simular una ventana completa que no existe.

    IMPORTANTE: se calcula un baseline INDEPENDIENTE por cada tipo de
    métrica (avg_ms, loss_percent, jitter_ms, stddev_ms), no solo uno por
    prioridad. La versión anterior elegía un único 'metric_type' (loss_percent
    si era > 0, si no avg_ms, etc.) y devolvía solo ese baseline — pero los
    detectores de module2 casi siempre analizan avg_ms. En cuanto un punto
    tenía loss_percent > 0 (aunque fuera mínimo, p.ej. 2%), el único baseline
    devuelto terminaba siendo el de loss_percent (rango 0-10) y la latencia
    real (decenas/cientos de ms) se comparaba contra ESE baseline equivocado
    — el detector veía "value > limite_superior" casi siempre, marcando como
    anómalo casi cualquier punto con la más mínima pérdida de paquetes.
    """
    valores_por_metrica = {
        'avg_ms': metric.get('avg_ms', 0) or 0,
        'loss_percent': metric.get('loss_percent', 0) or 0,
        'jitter_ms': metric.get('jitter_ms', 0) or 0,
        'stddev_ms': metric.get('stddev_ms', 0) or 0,
    }

    stats_por_metrica: Dict[str, Dict] = {}

    for metric_type, base_value in valores_por_metrica.items():
        key = f"{node_id}_{metric_type}"
        if key not in HISTORY_WINDOWS:
            HISTORY_WINDOWS[key] = deque(maxlen=WINDOW_SIZE)
        history = HISTORY_WINDOWS[key]

        # Calculamos las estadísticas ANTES de meter el punto actual a la
        # ventana, para que el punto se compare contra lo que pasó antes de
        # él, no contra sí mismo.
        if len(history) >= 3:
            arr = np.array(history, dtype=float)
            mean = float(np.mean(arr))
            std = float(np.std(arr))
            if std < 0.1:
                std = max(0.5, mean * 0.05)
            p95 = float(np.percentile(arr, 95))
            p99 = float(np.percentile(arr, 99))
            confidence = round(min(0.95, 0.5 + (len(history) / WINDOW_SIZE) * 0.45), 2)
        else:
            mean = base_value
            std = max(0.5, base_value * 0.15)
            p95 = mean + std * 1.645
            p99 = mean + std * 2.326
            confidence = 0.3  # historial insuficiente todavía

        history.append(base_value)

        stats_por_metrica[metric_type] = {
            'mean': round(mean, 2),
            'std': round(std, 2),
            'min': round(max(0, mean - std * 2), 2),
            'max': round(mean + std * 2, 2),
            'count': len(history),
            'percentile_95': round(p95, 2),
            'percentile_99': round(p99, 2),
            'baseline_confidence': confidence,
            'data_points_available': len(history)
        }

    # 'metric_type' aquí es solo informativo (cuál sería la métrica más
    # relevante de este punto) — module2 ya no lo usa para elegir el
    # baseline, cada detector busca el suyo propio en 'by_metric'.
    if valores_por_metrica['loss_percent'] > 0:
        metric_type_principal = 'loss_percent'
    elif valores_por_metrica['avg_ms'] > 0:
        metric_type_principal = 'avg_ms'
    elif valores_por_metrica['jitter_ms'] > 0:
        metric_type_principal = 'jitter_ms'
    elif valores_por_metrica['stddev_ms'] > 0:
        metric_type_principal = 'stddev_ms'
    else:
        metric_type_principal = 'unknown'

    return {
        'metric_type': metric_type_principal,
        'by_metric': stats_por_metrica,
    }