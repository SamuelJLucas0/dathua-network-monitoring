# module6_prioritizer.py - VERSIÓN LIMPIA
"""
Módulo 6: Priorizador - Versión Producción
"""

from typing import Dict
import logging
import os

logger = logging.getLogger(__name__)

def _load_node_criticality() -> Dict[str, int]:
    """
    Carga criticidad de nodos específicos desde la variable de entorno
    NODE_CRITICALITY_MAP, con formato "nodeId:criticidad,nodeId:criticidad".

    Las llaves DEBEN coincidir con el nodeId real que llega desde MySQL
    (ej. "17"), no con nombres inventados como "node_001" — la versión
    anterior nunca hacía match con un nodo real porque el pipeline entrega
    node_id como string numérico plano (str(node_id)).

    Ejemplo: NODE_CRITICALITY_MAP="1:8,7:10,23:9"
    Cualquier nodo no listado usa el default de 5 (criticidad media).
    """
    raw = os.getenv('NODE_CRITICALITY_MAP', '')
    mapping: Dict[str, int] = {}
    for part in raw.split(','):
        part = part.strip()
        if not part or ':' not in part:
            continue
        node_id, value = part.split(':', 1)
        try:
            mapping[node_id.strip()] = int(value.strip())
        except ValueError:
            logger.warning(f"NODE_CRITICALITY_MAP: entrada inválida ignorada: '{part}'")
    return mapping


# Criticidad de nodos específicos (configurable, ver _load_node_criticality)
NODE_CRITICALITY = _load_node_criticality()


def priorizar(incidente: Dict) -> Dict:
    """Asigna prioridad a un incidente"""
    
    node_id = incidente.get('node_id', 'unknown')
    severity = incidente.get('severity_max', 0.5)
    persistencia = incidente.get('persistencia', 1)
    
    criticidad = NODE_CRITICALITY.get(str(node_id), 5)
    
    # Reglas de prioridad
    if severity >= 0.85 and (persistencia >= 3 or criticidad >= 8):
        prioridad = "CRÍTICA"
        prioridad_numerica = 4
    elif severity >= 0.70 and persistencia >= 2:
        prioridad = "ALTA"
        prioridad_numerica = 3
    elif severity >= 0.50 and persistencia >= 2:
        prioridad = "MEDIA"
        prioridad_numerica = 2
    elif severity >= 0.30:
        prioridad = "BAJA"
        prioridad_numerica = 1
    else:
        prioridad = "INFORMATIVA"
        prioridad_numerica = 0
    
    # Casos especiales
    affected_metrics = incidente.get('affected_metrics', [])
    if 'loss_percent' in affected_metrics and severity >= 0.80:
        if prioridad_numerica < 3:
            prioridad = "ALTA"
            prioridad_numerica = 3
            if severity >= 0.95:
                prioridad = "CRÍTICA"
                prioridad_numerica = 4
    
    # Texto de severidad
    if severity >= 0.85:
        severity_text = "MUY ALTA"
    elif severity >= 0.70:
        severity_text = "ALTA"
    elif severity >= 0.50:
        severity_text = "MEDIA"
    elif severity >= 0.30:
        severity_text = "BAJA"
    else:
        severity_text = "MUY BAJA"
    
    # Solo log si es crítica o alta
    if prioridad_numerica >= 3:
        logger.warning(f"⚠️ {prioridad}: node_{node_id} - score={severity:.3f}, persistencia={persistencia}")
    
    return {
        **incidente,
        'priority': prioridad,
        'priority_numeric': prioridad_numerica,
        'severity_text': severity_text,
        'classification': prioridad,
        'model_confidence': round(0.85 + (1 - severity) * 0.1, 3),
        'final_anomaly_score': round(severity, 4),
        'detection_details': {
            'algorithm': 'reglas_definitivas',
            'persistencia': persistencia,
            'criticidad_nodo': criticidad,
            'metric_type': affected_metrics
        }
    }