"""
Módulo 2: Detectores en tiempo real (CON PERÍODO DE CALENTAMIENTO)
"""

import numpy as np
from typing import Dict, Optional
import math

EWMA_CACHE = {}
WARMUP_COUNT = {}  # Contador de puntos por nodo

# Cuántas veces SEGUIDAS ha alertado cada nodo+métrica+algoritmo. Antes solo
# CUSUM llenaba 'persistencia_count' en su alerta — module6_prioritizer.py
# exige persistencia >= 2/3 para escalar a ALTA/CRÍTICA, así que una
# anomalía de latencia (EWMA/Percentiles) nunca traía ese dato y se quedaba
# atorada en BAJA sin importar qué tan alto fuera el score. Se resetea a 0
# en cuanto la métrica vuelve a la normalidad.
PERSISTENCE_CACHE = {}

def detectar_ewma(metric_data: Dict, window_stats: Dict) -> Optional[Dict]:
    """
    Detector de picos usando EWMA con bandas adaptativas (CON CALENTAMIENTO)
    """
    
    # 1. Extraer valores
    node_id = metric_data['node_id']
    metric_type = 'avg_ms'
    
    if metric_data['metrics'].get('avg_ms') is not None:
        value = metric_data['metrics']['avg_ms']
        metric_type = 'avg_ms'
    elif metric_data['metrics'].get('jitter_ms') is not None:
        value = metric_data['metrics']['jitter_ms']
        metric_type = 'jitter_ms'
    elif metric_data['metrics'].get('stddev_ms') is not None:
        value = metric_data['metrics']['stddev_ms']
        metric_type = 'stddev_ms'
    else:
        return None
    
    if value is None:
        return None

    # Baseline de ESTA métrica específicamente (nunca el de otra métrica
    # distinta que haya quedado en window_stats — ver module1_preprocessor).
    stats_metrica = window_stats.get('by_metric', {}).get(metric_type, {})

    # 2. 🔥 NUEVO: Calentar el sistema
    cache_key = f"{node_id}_{metric_type}"
    warmup_key = f"warmup_{cache_key}"

    if warmup_key not in WARMUP_COUNT:
        WARMUP_COUNT[warmup_key] = 0

    # Incrementar contador de warmup
    WARMUP_COUNT[warmup_key] += 1

    # 🔥 PERÍODO DE CALENTAMIENTO: 10 puntos antes de generar alertas
    if WARMUP_COUNT[warmup_key] < 10:
        # Solo acumular datos, no generar alertas
        # Actualizar EWMA sin generar alerta
        if cache_key not in EWMA_CACHE:
            EWMA_CACHE[cache_key] = {
                'ewma': value,
                'std': stats_metrica.get('std', value * 0.1)
            }
        else:
            cache = EWMA_CACHE[cache_key]
            alpha = 0.3
            new_ewma = alpha * value + (1 - alpha) * cache['ewma']
            new_std = np.sqrt(alpha * (value - new_ewma)**2 + (1 - alpha) * cache['std']**2)
            EWMA_CACHE[cache_key] = {
                'ewma': new_ewma,
                'std': new_std
            }
        
        # No generar alerta durante warmup
        return None
    
    # 3. Obtener EWMA anterior (ya con warmup completado)
    if cache_key not in EWMA_CACHE:
        EWMA_CACHE[cache_key] = {
            'ewma': value,
            'std': stats_metrica.get('std', value * 0.1)
        }
    
    cache = EWMA_CACHE[cache_key]
    
    # 4. Calcular nuevo EWMA
    alpha = 0.3
    new_ewma = alpha * value + (1 - alpha) * cache['ewma']
    new_std = np.sqrt(alpha * (value - new_ewma)**2 + (1 - alpha) * cache['std']**2)
    
    limite_superior = new_ewma + (3 * new_std)
    
    EWMA_CACHE[cache_key] = {
        'ewma': new_ewma,
        'std': new_std
    }
    
    # 5. Detectar anomalía (SOLO DESPUÉS DEL WARMUP)
    persist_key = f"persist_ewma_{cache_key}"

    if value > limite_superior:
        # Calcular desviación relativa
        if limite_superior - new_ewma > 0:
            deviation_ratio = (value - new_ewma) / (limite_superior - new_ewma)
        else:
            deviation_ratio = 1.0

        # Calcular score
        if deviation_ratio <= 10:
            anomaly_score = 0.5 + 0.5 * (1 - math.exp(-deviation_ratio * 1.2))
        else:
            anomaly_score = 0.95 + (1 - math.exp(-(deviation_ratio - 10) * 0.1)) * 0.05

        anomaly_score = min(1.0, anomaly_score)
        anomaly_score = max(0.0, anomaly_score)

        PERSISTENCE_CACHE[persist_key] = PERSISTENCE_CACHE.get(persist_key, 0) + 1

        return {
            'alert_id': f"alert_ewma_{cache_key}_{int(np.random.random()*10000)}",
            'node_id': node_id,
            'org_id': metric_data.get('org_id'),
            'site_id': metric_data.get('site_id'),
            'zone_id': metric_data.get('zone_id'),
            'metric_type': metric_type,
            'value': value,
            'ewma': round(new_ewma, 2),
            'std': round(new_std, 2),
            'limite_superior': round(limite_superior, 2),
            'deviation_ratio': round(deviation_ratio, 2),
            'anomaly_score': round(anomaly_score, 4),
            'algorithm': 'EWMA',
            'timestamp': metric_data.get('captured_at'),
            'warmup_status': f"Completado ({WARMUP_COUNT[warmup_key]} puntos)",
            'persistencia_count': PERSISTENCE_CACHE[persist_key]
        }

    # La métrica volvió a la normalidad — se corta la racha.
    PERSISTENCE_CACHE[persist_key] = 0
    return None

def detectar_percentiles(metric_data: Dict, window_stats: Dict) -> Optional[Dict]:
    """
    Detector de picos usando percentiles móviles (CON CALENTAMIENTO)
    """
    
    # 1. Extraer valores
    node_id = metric_data['node_id']
    metric_type = 'avg_ms'
    
    if metric_data['metrics'].get('avg_ms') is not None:
        value = metric_data['metrics']['avg_ms']
        metric_type = 'avg_ms'
    elif metric_data['metrics'].get('jitter_ms') is not None:
        value = metric_data['metrics']['jitter_ms']
        metric_type = 'jitter_ms'
    else:
        return None
    
    if value is None:
        return None

    # 2. 🔥 NUEVO: Verificar warmup
    warmup_key = f"warmup_{node_id}_{metric_type}"

    if warmup_key not in WARMUP_COUNT:
        WARMUP_COUNT[warmup_key] = 0

    WARMUP_COUNT[warmup_key] += 1

    # 🔥 PERÍODO DE CALENTAMIENTO: 10 puntos
    if WARMUP_COUNT[warmup_key] < 10:
        return None

    # 3. Obtener percentiles de ESTA métrica específicamente (nunca el de
    # otra métrica distinta que haya quedado en window_stats).
    stats_metrica = window_stats.get('by_metric', {}).get(metric_type, {})
    percentile_99 = stats_metrica.get('percentile_99', value * 2)
    percentile_95 = stats_metrica.get('percentile_95', value * 1.5)
    
    # 4. Detectar anomalías
    persist_key = f"persist_percentile_{node_id}_{metric_type}"

    if value > percentile_99:
        if percentile_99 > 0:
            deviation = (value - percentile_99) / percentile_99
        else:
            deviation = 1.0
        
        if deviation <= 1.0:
            anomaly_score = 0.7 + (deviation * 0.3)
        elif deviation <= 5.0:
            anomaly_score = 0.85 + ((deviation - 1.0) * 0.03)
        else:
            anomaly_score = 0.95 + (1 - math.exp(-(deviation - 5.0) * 0.05)) * 0.05
        
        anomaly_score = min(1.0, anomaly_score)
        anomaly_score = max(0.0, anomaly_score)

        PERSISTENCE_CACHE[persist_key] = PERSISTENCE_CACHE.get(persist_key, 0) + 1

        return {
            'alert_id': f"alert_percentile_{node_id}_{int(np.random.random()*10000)}",
            'node_id': node_id,
            'org_id': metric_data.get('org_id'),
            'site_id': metric_data.get('site_id'),
            'zone_id': metric_data.get('zone_id'),
            'metric_type': metric_type,
            'value': value,
            'percentile_99': round(percentile_99, 2),
            'percentile_95': round(percentile_95, 2),
            'deviation': round(deviation, 2),
            'anomaly_score': round(anomaly_score, 4),
            'algorithm': 'PERCENTILES',
            'timestamp': metric_data.get('captured_at'),
            'warmup_status': f"Completado ({WARMUP_COUNT[warmup_key]} puntos)",
            'persistencia_count': PERSISTENCE_CACHE[persist_key]
        }

    elif value > percentile_95:
        if percentile_95 > 0:
            deviation = (value - percentile_95) / percentile_95
        else:
            deviation = 0.5
        
        if deviation <= 0.3:
            anomaly_score = 0.4 + (deviation * 0.5)
        else:
            anomaly_score = 0.55 + ((deviation - 0.3) * 0.25)
        
        anomaly_score = min(0.75, anomaly_score)
        anomaly_score = max(0.0, anomaly_score)

        PERSISTENCE_CACHE[persist_key] = PERSISTENCE_CACHE.get(persist_key, 0) + 1

        return {
            'alert_id': f"alert_percentile_{node_id}_{int(np.random.random()*10000)}",
            'node_id': node_id,
            'org_id': metric_data.get('org_id'),
            'site_id': metric_data.get('site_id'),
            'zone_id': metric_data.get('zone_id'),
            'metric_type': metric_type,
            'value': value,
            'percentile_99': round(percentile_99, 2),
            'percentile_95': round(percentile_95, 2),
            'deviation': round(deviation, 2),
            'anomaly_score': round(anomaly_score, 4),
            'algorithm': 'PERCENTILES_MEDIA',
            'timestamp': metric_data.get('captured_at'),
            'warmup_status': f"Completado ({WARMUP_COUNT[warmup_key]} puntos)",
            'persistencia_count': PERSISTENCE_CACHE[persist_key]
        }

    # La métrica volvió a la normalidad — se corta la racha.
    PERSISTENCE_CACHE[persist_key] = 0
    return None