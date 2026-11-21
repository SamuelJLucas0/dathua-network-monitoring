# module5_aggregator.py - VERSIÓN LIMPIA
"""
Módulo 5: Agrupador y correlador - Versión Producción
"""

from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

ALERTS_ACTIVE = {}


def agrupar_alertas(alertas: List[Dict]) -> List[Dict]:
    """Agrupa alertas relacionadas y calcula correlaciones"""
    
    if not alertas:
        return []
    
    # Agrupar por nodo
    grouped_by_node = {}
    for alerta in alertas:
        node_id = alerta.get('node_id')
        if node_id not in grouped_by_node:
            grouped_by_node[node_id] = []
        grouped_by_node[node_id].append(alerta)
    
    incidentes = []
    
    for node_id, node_alertas in grouped_by_node.items():
        # Buscar alertas de diferentes métricas
        metricas = {}
        for alerta in node_alertas:
            metric_type = alerta.get('metric_type')
            if metric_type not in metricas:
                metricas[metric_type] = []
            metricas[metric_type].append(alerta)
        
        # Si hay múltiples métricas, verificar correlación
        if len(metricas) > 1:
            if 'avg_ms' in metricas and 'loss_percent' in metricas:
                correlacion = calcular_correlacion(
                    metricas['avg_ms'][0]['value'],
                    metricas['loss_percent'][0]['value']
                )
                
                if correlacion > 0.7:
                    incidente = {
                        'incident_id': f"inc_{node_id}_{len(incidentes)}",
                        'node_id': node_id,
                        'org_id': node_alertas[0].get('org_id'),
                        'site_id': node_alertas[0].get('site_id'),
                        'zone_id': node_alertas[0].get('zone_id'),
                        'affected_metrics': list(metricas.keys()),
                        'correlation_score': round(correlacion, 2),
                        'alerts': node_alertas,
                        'severity_max': max([a['anomaly_score'] for a in node_alertas]),
                        'timestamp': node_alertas[0].get('timestamp'),
                        'persistencia': calcular_persistencia(node_id, node_alertas)
                    }
                    incidentes.append(incidente)
                    if len(incidentes) == 1:  # Solo log el primero
                        logger.info(f"Incidente agrupado: node_{node_id} - {len(node_alertas)} alertas")
                    continue
        
        # Alertas separadas — antes esto dejaba 'persistencia' fijo en 1 sin
        # importar cuántas veces seguidas llevara alertando ese nodo, así que
        # module6_prioritizer.py (que exige persistencia >= 2/3 para escalar
        # a ALTA/CRÍTICA) nunca podía subir de BAJA a una anomalía de
        # latencia (EWMA/Percentiles) por más severo que fuera su score. Cada
        # detector ya trae su propio conteo real en 'persistencia_count'.
        for alerta in node_alertas:
            incidentes.append({
                'incident_id': f"inc_{node_id}_{len(incidentes)}",
                'node_id': node_id,
                'org_id': alerta.get('org_id'),
                'site_id': alerta.get('site_id'),
                'zone_id': alerta.get('zone_id'),
                'affected_metrics': [alerta['metric_type']],
                'correlation_score': 0.0,
                'alerts': [alerta],
                'severity_max': alerta['anomaly_score'],
                'timestamp': alerta.get('timestamp'),
                'persistencia': calcular_persistencia(node_id, [alerta])
            })
    
    # Actualizar cache
    for incidente in incidentes:
        node_id = incidente['node_id']
        if node_id not in ALERTS_ACTIVE:
            ALERTS_ACTIVE[node_id] = []
        ALERTS_ACTIVE[node_id].append(incidente)
    
    return incidentes


def calcular_correlacion(valor1: float, valor2: float) -> float:
    """Calcula correlación simulada entre dos valores"""
    if valor1 > 50 and valor2 > 10:
        return 0.85
    elif valor1 > 30 and valor2 > 5:
        return 0.65
    else:
        return 0.2


def calcular_persistencia(node_id: str, alertas: List[Dict]) -> int:
    """Calcula persistencia de la alerta"""
    for alerta in alertas:
        if 'persistencia_count' in alerta:
            return alerta['persistencia_count']
    return 1