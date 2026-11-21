# module3_cusum.py - VERSIÓN LIMPIA PARA PRODUCCIÓN
"""
Módulo 3: Detector de cambios persistentes con CUSUM
"""

import numpy as np
from typing import Dict, Optional
import math
import logging
import os

logger = logging.getLogger(__name__)

CUSUM_CACHE = {}
WARMUP_COUNT = {}

# Configuración desde entorno
CUSUM_K = float(os.getenv('CUSUM_K', '0.5'))
CUSUM_H = float(os.getenv('CUSUM_H', '5.0'))
WARMUP_POINTS = int(os.getenv('WARMUP_POINTS', '10'))


def detectar_cusum(metric_data: Dict, window_stats: Dict, verbose: bool = False) -> Optional[Dict]:
    """
    Detector de cambios graduales usando CUSUM.

    IMPORTANTE: la referencia contra la que se mide el "cambio" es el
    promedio RECIENTE de pérdida de ESTE equipo (window_stats), no un
    número fijo (CUSUM_K) igual para los 14 equipos de la cuenta. Con un
    valor fijo, cualquier equipo cuya pérdida normal fuera de 2% o más
    (común en enlaces WiFi reales) acumulaba S+ sin parar aunque nunca
    cambiara — CUSUM_K sigue existiendo, pero ahora es el margen de
    tolerancia SOBRE ese baseline propio, no el baseline en sí.
    """

    node_id = metric_data['node_id']

    if metric_data['metrics'].get('loss_percent') is not None:
        value = metric_data['metrics']['loss_percent']
        metric_type = 'loss_percent'
    else:
        return None

    if value is None:
        return None

    baseline_mean = window_stats.get('by_metric', {}).get(metric_type, {}).get('mean', value)
    referencia = baseline_mean + CUSUM_K

    # Warmup
    warmup_key = f"warmup_{node_id}_{metric_type}"

    if warmup_key not in WARMUP_COUNT:
        WARMUP_COUNT[warmup_key] = 0

    WARMUP_COUNT[warmup_key] += 1

    if WARMUP_COUNT[warmup_key] < WARMUP_POINTS:
        cache_key = f"cusum_{node_id}_{metric_type}"
        if cache_key not in CUSUM_CACHE:
            CUSUM_CACHE[cache_key] = {
                's_pos': 0,
                's_neg': 0,
                'count': 0
            }

        cache = CUSUM_CACHE[cache_key]
        deviation = value - referencia
        s_pos_new = max(0, cache['s_pos'] + deviation - 0.5)
        s_neg_new = max(0, cache['s_neg'] - deviation - 0.5)

        CUSUM_CACHE[cache_key] = {
            's_pos': s_pos_new,
            's_neg': s_neg_new,
            'count': cache['count'] + 1
        }
        return None

    # Procesamiento normal
    cache_key = f"cusum_{node_id}_{metric_type}"
    if cache_key not in CUSUM_CACHE:
        CUSUM_CACHE[cache_key] = {
            's_pos': 0,
            's_neg': 0,
            'count': 0
        }

    cache = CUSUM_CACHE[cache_key]

    deviation = value - referencia
    s_pos_new = max(0, cache['s_pos'] + deviation - 0.5)
    s_neg_new = max(0, cache['s_neg'] - deviation - 0.5)
    
    CUSUM_CACHE[cache_key] = {
        's_pos': s_pos_new,
        's_neg': s_neg_new,
        'count': cache['count'] + 1
    }
    
    # Detectar anomalía
    if s_pos_new > CUSUM_H:
        normalized = s_pos_new / CUSUM_H
        
        if normalized <= 2.0:
            anomaly_score = 0.6 + (normalized - 1.0) * 0.3
        elif normalized <= 5.0:
            anomaly_score = 0.85 + ((normalized - 2.0) * 0.04)
        else:
            anomaly_score = 0.95 + (1 - math.exp(-(normalized - 5.0) * 0.1)) * 0.05
        
        anomaly_score = min(1.0, max(0.0, anomaly_score))
        
        if verbose:
            logger.debug(f"CUSUM alerta: node_{node_id} - loss={value}%, S+={s_pos_new:.2f} > {CUSUM_H}")
        
        return {
            'alert_id': f"alert_cusum_{cache_key}_{int(np.random.random()*10000)}",
            'node_id': node_id,
            'org_id': metric_data.get('org_id'),
            'site_id': metric_data.get('site_id'),
            'zone_id': metric_data.get('zone_id'),
            'metric_type': metric_type,
            'value': value,
            's_pos': round(s_pos_new, 2),
            's_neg': round(s_neg_new, 2),
            'umbral': CUSUM_H,
            'normalized': round(normalized, 2),
            'anomaly_score': round(anomaly_score, 4),
            'algorithm': 'CUSUM',
            'timestamp': metric_data.get('captured_at'),
            'persistencia_count': CUSUM_CACHE[cache_key]['count']
        }
    
    return None