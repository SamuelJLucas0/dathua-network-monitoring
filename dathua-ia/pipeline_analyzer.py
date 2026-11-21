# pipeline_analyzer.py - ORQUESTADOR DEL PIPELINE DE IA
"""
Pipeline completo de análisis de anomalías para red Telco.
Conecta preprocesador → detectores → estacional → agrupador → priorizador
"""

import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from flask import Flask, request, jsonify

# Importar módulos del pipeline
from module1_preprocessor import preprocesar
from module2_detectors import detectar_ewma, detectar_percentiles, WARMUP_COUNT
from module3_cusum import detectar_cusum
from module4_seasonal import analizar_estacional
from module5_aggregator import agrupar_alertas
from module6_prioritizer import priorizar

# ==================== CONFIGURACIÓN ====================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# module6_prioritizer clasifica en español para las reglas de negocio
# internas (CRÍTICA/ALTA/MEDIA/BAJA/INFORMATIVA), pero el esquema AiAnomaly
# de Mongo y aiService.js en dathua-api solo aceptan estos 5 valores exactos.
# Este es el punto único de traducción entre ambos mundos.
CLASSIFICATION_MAP = {
    'CRÍTICA': 'CRITICAL',
    'CRITICA': 'CRITICAL',   # por si llega sin acento desde algún cliente
    'ALTA': 'HIGH',
    'MEDIA': 'MEDIUM',
    'BAJA': 'LOW',
    'INFORMATIVA': 'LOW',
}

app = Flask(__name__)

# ==================== ESTADÍSTICAS DEL PIPELINE ====================
class PipelineStats:
    def __init__(self):
        self.total_metrics = 0
        self.total_anomalies = 0
        self.total_incidents = 0
        self.start_time = datetime.now()
        self.reset()
    
    def reset(self):
        self.processed = 0
        self.ignored = 0
        self.anomalies_detected = 0
        self.incidents_created = 0
    
    def to_dict(self):
        return {
            'processed_metrics': self.processed,
            'ignored_metrics': self.ignored,
            'anomalies_detected': self.anomalies_detected,
            'incidents_created': self.incidents_created,
            'total_processed_since_start': self.total_metrics,
            'total_anomalies_since_start': self.total_anomalies,
            'total_incidents_since_start': self.total_incidents,
            'uptime_seconds': int((datetime.now() - self.start_time).total_seconds())
        }

stats = PipelineStats()

# ==================== PIPELINE PRINCIPAL ====================

def ejecutar_pipeline(metrics_data: List[Dict], verbose: bool = False) -> Dict:
    """
    Ejecuta el pipeline completo de análisis
    
    Args:
        metrics_data: Lista de métricas de ICMP
        verbose: Si es True, muestra logs detallados
    
    Returns:
        Dict con resultados del pipeline
    """
    
    # ========== PASO 1: PREPROCESAMIENTO ==========
    logger.info(f"🔄 [Paso 1/6] Preprocesando {len(metrics_data)} métricas...")
    
    preprocessed = preprocesar(metrics_data, verbose=verbose)
    
    processed_metrics = preprocessed.get('processed_metrics', [])
    ignored_metrics = preprocessed.get('ignored_metrics', [])
    
    stats.processed = len(processed_metrics)
    stats.ignored = len(ignored_metrics)
    stats.total_metrics += len(metrics_data)
    
    logger.info(f"   ✅ {len(processed_metrics)} métricas procesadas, {len(ignored_metrics)} ignoradas")
    
    if len(processed_metrics) == 0:
        return {
            'anomalies': [],
            'summary': {
                'total_metrics': len(metrics_data),
                'total_processed': 0,
                'total_ignored': len(ignored_metrics),
                'total_anomalies': 0,
                'pipeline_stats': stats.to_dict()
            },
            'filtered_metrics': {
                'total_ignored': len(ignored_metrics),
                'details': ignored_metrics
            }
        }
    
    # ========== PASO 2: DETECTORES (Múltiples) ==========
    logger.info(f"🔍 [Paso 2/6] Ejecutando detectores de anomalías...")
    
    all_alerts = []
    detector_stats = {'ewma': 0, 'percentiles': 0, 'cusum': 0}
    
    for metric in processed_metrics:
        window_stats = metric.get('window_stats', {})
        
        # Detector EWMA
        ewma_alert = detectar_ewma(metric, window_stats)
        if ewma_alert:
            all_alerts.append(ewma_alert)
            detector_stats['ewma'] += 1
        
        # Detector de Percentiles
        percentile_alert = detectar_percentiles(metric, window_stats)
        if percentile_alert:
            all_alerts.append(percentile_alert)
            detector_stats['percentiles'] += 1
        
        # Detector CUSUM (solo para loss_percent)
        cusum_alert = detectar_cusum(metric, window_stats, verbose=verbose)
        if cusum_alert:
            all_alerts.append(cusum_alert)
            detector_stats['cusum'] += 1
    
    stats.anomalies_detected = len(all_alerts)
    stats.total_anomalies += len(all_alerts)
    
    logger.info(f"   ⚡ {len(all_alerts)} alertas generadas (EWMA: {detector_stats['ewma']}, Percentiles: {detector_stats['percentiles']}, CUSUM: {detector_stats['cusum']})")
    
    if len(all_alerts) == 0:
        return {
            'anomalies': [],
            'summary': {
                'total_metrics': len(metrics_data),
                'total_processed': len(processed_metrics),
                'total_ignored': len(ignored_metrics),
                'total_anomalies': 0,
                'detector_stats': detector_stats,
                'pipeline_stats': stats.to_dict()
            },
            'filtered_metrics': {
                'total_ignored': len(ignored_metrics),
                'details': ignored_metrics
            }
        }
    
    # ========== PASO 3: CONTEXTO ESTACIONAL ==========
    logger.info(f"📊 [Paso 3/6] Aplicando contexto estacional...")
    
    seasonal_alerts = []
    for alert in all_alerts:
        seasonal_alert = analizar_estacional(alert, verbose=verbose)
        seasonal_alerts.append(seasonal_alert)
    
    logger.info(f"   ✅ {len(seasonal_alerts)} alertas con contexto estacional")
    
    # ========== PASO 4: AGRUPACIÓN Y CORRELACIÓN ==========
    logger.info(f"📦 [Paso 4/6] Agrupando alertas relacionadas...")
    
    incidents = agrupar_alertas(seasonal_alerts)
    
    stats.incidents_created = len(incidents)
    stats.total_incidents += len(incidents)
    
    logger.info(f"   📦 {len(incidents)} incidentes agrupados")
    
    if len(incidents) == 0:
        return {
            'anomalies': seasonal_alerts,
            'summary': {
                'total_metrics': len(metrics_data),
                'total_processed': len(processed_metrics),
                'total_ignored': len(ignored_metrics),
                'total_anomalies': len(seasonal_alerts),
                'total_incidents': 0,
                'detector_stats': detector_stats,
                'pipeline_stats': stats.to_dict()
            },
            'filtered_metrics': {
                'total_ignored': len(ignored_metrics),
                'details': ignored_metrics
            }
        }
    
    # ========== PASO 5: PRIORIZACIÓN ==========
    logger.info(f"🎯 [Paso 5/6] Asignando prioridades...")
    
    prioritized_incidents = []
    for incident in incidents:
        prioritized = priorizar(incident)
        prioritized_incidents.append(prioritized)
    
    logger.info(f"   ✅ {len(prioritized_incidents)} incidentes priorizados")
    
    # ========== PASO 6: TRANSFORMACIÓN A FORMATO DE SALIDA ==========
    logger.info(f"📤 [Paso 6/6] Generando salida para Node.js...")
    
    anomalies_output = _transform_to_output(prioritized_incidents)
    
    logger.info(f"   ✅ Pipeline completado: {len(anomalies_output)} anomalías en formato de salida")
    
    # ========== RESUMEN FINAL ==========
    return {
        'anomalies': anomalies_output,
        'summary': {
            'total_metrics': len(metrics_data),
            'total_processed': len(processed_metrics),
            'total_ignored': len(ignored_metrics),
            'total_anomalies': len(seasonal_alerts),
            'total_incidents': len(prioritized_incidents),
            'detector_stats': detector_stats,
            'priority_distribution': _get_priority_distribution(prioritized_incidents),
            'pipeline_stats': stats.to_dict()
        },
        'filtered_metrics': {
            'total_ignored': len(ignored_metrics),
            'details': ignored_metrics
        }
    }


def _transform_to_output(incidents: List[Dict]) -> List[Dict]:
    """
    Transforma incidentes al formato esperado por Node.js
    """
    output = []

    for incident in incidents:
        # Tomar la primera alerta del incidente
        first_alert = incident.get('alerts', [{}])[0]

        # Construir metadata completa a partir de los valores REALES del
        # incidente (que vienen propagados desde module1 -> module2/3 ->
        # module5 -> module6). Solo se cae al default de 1 si de plano no
        # llegó el dato, y se deja registrado en el log porque no debería
        # pasar en operación normal.
        org_id = incident.get('org_id')
        site_id = incident.get('site_id')
        zone_id = incident.get('zone_id')

        if org_id is None or site_id is None:
            logger.warning(
                f"Incidente de node_{incident.get('node_id')} sin org_id/site_id real "
                f"en el payload — se usa default 1. Revisar que la métrica original "
                f"traiga metadata.org_id/site_id/zone_id."
            )

        metadata = {
            'node_id': incident.get('node_id'),
            'org_id': int(org_id) if org_id is not None else 1,
            'site_id': int(site_id) if site_id is not None else 1,
            'zone_id': int(zone_id) if zone_id is not None else None,
            'protocol': 'ICMP',
            'target': f"node_{incident.get('node_id')}"
        }

        # Extraer el valor observado
        observed_value = first_alert.get('value', 0)

        # Extraer baseline esperado
        expected_baseline = None
        if first_alert.get('ewma') is not None:
            expected_baseline = first_alert.get('ewma')
        elif first_alert.get('expected_baseline', {}).get('ewma') is not None:
            expected_baseline = first_alert.get('expected_baseline', {}).get('ewma')

        # Determinar métrica analizada
        metric_analyzed = first_alert.get('metric_type', 'avg_ms')

        # Obtener score final
        anomaly_score = incident.get('final_anomaly_score', incident.get('severity_max', 0.5))

        # Clasificación: el priorizador (module6) trabaja en español para
        # las reglas de negocio internas, pero el esquema AiAnomaly de Mongo
        # y aiService.js en dathua-api solo aceptan
        # CRITICAL/HIGH/MEDIUM/LOW/UNKNOWN. Sin este mapeo, Mongoose rechaza
        # el documento completo y la anomalía nunca se guarda.
        classification_raw = incident.get('priority', 'MEDIA')
        classification = CLASSIFICATION_MAP.get(
            classification_raw.strip().upper(), 'UNKNOWN'
        )

        # Model confidence
        model_confidence = incident.get('model_confidence', 0.85)

        output.append({
            'timestamp': incident.get('timestamp', datetime.now().isoformat()),
            'metadata': metadata,
            'metricAnalyzed': metric_analyzed,
            'observed_value': float(observed_value),
            'expected_Baseline': float(expected_baseline) if expected_baseline is not None else None,
            'anomalyScore': float(anomaly_score),
            'classification': classification,
            'model_confidence': float(model_confidence),
            'detection_details': incident.get('detection_details', {}),
            'correlation_score': incident.get('correlation_score', 0)
        })

    return output


def _get_priority_distribution(incidents: List[Dict]) -> Dict:
    """
    Obtiene distribución de prioridades
    """
    distribution = {
        'CRÍTICA': 0,
        'ALTA': 0,
        'MEDIA': 0,
        'BAJA': 0,
        'INFORMATIVA': 0
    }
    
    for incident in incidents:
        priority = incident.get('priority', 'INFORMATIVA')
        if priority in distribution:
            distribution[priority] += 1
    
    return distribution


# ==================== ENDPOINTS FLASK ====================

@app.route('/api/analyze', methods=['POST'])
def analyze_metrics():
    """
    Endpoint principal para análisis de métricas
    Espera: { "metrics": [...] }
    """
    try:
        data = request.get_json()
        
        if not data or 'metrics' not in data:
            return jsonify({
                'error': 'Se requiere el campo "metrics" en el body',
                'received': data
            }), 400
        
        metrics = data['metrics']
        verbose = data.get('verbose', False)
        
        if not isinstance(metrics, list):
            return jsonify({
                'error': 'El campo "metrics" debe ser un array',
                'received_type': type(metrics).__name__
            }), 400
        
        if len(metrics) == 0:
            return jsonify({
                'anomalies': [],
                'summary': {
                    'total_metrics': 0,
                    'total_processed': 0,
                    'total_ignored': 0,
                    'total_anomalies': 0,
                    'message': 'No se recibieron métricas para analizar'
                }
            })
        
        # Ejecutar pipeline
        result = ejecutar_pipeline(metrics, verbose=verbose)
        
        # Responder
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"❌ Error en /api/analyze: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Error interno al procesar la solicitud',
            'message': str(e)
        }), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint de salud"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'stats': stats.to_dict(),
        'warmup_status': _get_warmup_status()
    }), 200


@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Endpoint de estadísticas del pipeline"""
    return jsonify({
        'pipeline_stats': stats.to_dict(),
        'warmup_status': _get_warmup_status(),
        'timestamp': datetime.now().isoformat()
    }), 200


@app.route('/api/reset', methods=['POST'])
def reset_pipeline():
    """Reinicia las estadísticas (útil para pruebas)"""
    stats.reset()
    # Resetear warmup también
    from module2_detectors import WARMUP_COUNT
    from module3_cusum import WARMUP_COUNT as CUSUM_WARMUP
    WARMUP_COUNT.clear()
    CUSUM_WARMUP.clear()
    
    return jsonify({
        'message': 'Pipeline reiniciado correctamente',
        'stats': stats.to_dict()
    }), 200


def _get_warmup_status():
    """Obtiene estado del warmup de los detectores"""
    from module2_detectors import WARMUP_COUNT
    from module3_cusum import WARMUP_COUNT as CUSUM_WARMUP
    
    return {
        'ewma_percentiles': dict(WARMUP_COUNT),
        'cusum': dict(CUSUM_WARMUP)
    }


# ==================== MAIN ====================

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 PIPELINE DE IA PARA REDES TELCO")
    print("="*60)
    print(f"📅 Iniciado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔌 Puerto: 5000")
    print(f"📡 Endpoint: http://localhost:5000/api/analyze")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=False)