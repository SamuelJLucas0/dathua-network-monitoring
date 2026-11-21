"""
Motor de sondeo ICMP. Extraído de la implementación original del agente
(dathua_agent_gui.py), separado de la clase de Tkinter para poder probarlo
y reutilizarlo desde el servicio. El parseo de Windows se ajustó contra la
salida real de un Windows 11 en español (ver _WINDOWS_RTT_RE).
"""
import platform
import re
import statistics
import subprocess
from datetime import datetime, timezone

# Windows en español imprime "tiempo=2ms", pero para respuestas de menos de
# 1 ms imprime "tiempo<1m" (sin la "s") — capturado de un Windows 11 es-MX
# real (tests/fixtures/windows_es_ping_submillisecond.txt). Exigir "ms"
# contaba esas respuestas como paquetes perdidos. El [=<] pegado a la
# palabra evita confundirlo con "Tiempo de espera agotado".
_WINDOWS_RTT_RE = re.compile(r'(?:tiempo|time)[=<](\d+)\s*m', re.IGNORECASE)


def run_command(cmd: list, timeout: float) -> str:
    """
    Corre una herramienta del SO (ping, arp) y devuelve su stdout como texto.

    En Windows, `ping`/`arp` escriben en la página de código OEM de la
    consola (cp850 en español), no en la ANSI (cp1252) que `text=True` usa
    por default — sin esto los acentos ("Estadísticas") salen corruptos.
    CREATE_NO_WINDOW evita que parpadee una consola por cada llamada cuando
    el proceso padre es el .exe sin consola (asistente gráfico).
    """
    if platform.system().lower() == "windows":
        # getattr: la constante solo existe en el Python de Windows (las
        # pruebas simulan Windows también desde Linux).
        no_window = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
        kwargs = {"encoding": "oem", "errors": "replace", "creationflags": no_window}
    else:
        kwargs = {"text": True}

    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout, **kwargs)
    return res.stdout


def execute_ping(host: str, count: int = 5) -> dict:
    is_windows = platform.system().lower() == "windows"
    cmd = [
        "ping",
        "-n" if is_windows else "-c", str(count),
        "-w" if is_windows else "-W", "1000" if is_windows else "1",
        host,
    ]

    try:
        output = run_command(cmd, timeout=count * 2)
    except Exception as e:
        return {"error": str(e), "rtts": [], "transmitted": count, "received": 0}

    if is_windows:
        matches = _WINDOWS_RTT_RE.findall(output)
        rtts = [float(m) for m in matches]
    else:
        matches = re.findall(r'time=([\d\.]+)\s*ms', output, re.IGNORECASE)
        rtts = [float(m) for m in matches]

    received = len(rtts)
    return {
        "error": None if received > 0 else "Host inalcanzable",
        "rtts": rtts,
        "transmitted": count,
        "received": received,
    }


def calculate_jitter(rtts: list) -> float:
    if len(rtts) < 2:
        return 0.0
    diffs = [abs(rtts[i] - rtts[i - 1]) for i in range(1, len(rtts))]
    return round(sum(diffs) / len(diffs), 2)


def build_metric_doc(node: dict, org_id, ping_result: dict) -> dict:
    rtts = ping_result["rtts"]
    transmitted = ping_result["transmitted"]
    received = ping_result["received"]

    loss = int(((transmitted - received) / transmitted) * 100) if transmitted > 0 else 100
    status = "UP" if received > 0 else "DOWN"

    return {
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "metadata": {
            "node_id": node["nodeId"],
            "org_id": org_id,
            "site_id": node["siteId"],
            "zone_id": node.get("zoneId"),
            "protocol": "ICMP",
            "target": node["ipAddress"],
        },
        "status": status,
        "transmitted": transmitted,
        "received": received,
        "loss_percent": loss,
        "min_ms": int(round(min(rtts))) if rtts else None,
        "max_ms": int(round(max(rtts))) if rtts else None,
        "avg_ms": round(statistics.mean(rtts), 2) if rtts else None,
        "stddev_ms": round(statistics.stdev(rtts), 2) if len(rtts) > 1 else 0.0,
        "jitter_ms": calculate_jitter(rtts),
        "rtts_ms": [int(round(r)) for r in rtts],
        "error": ping_result["error"],
    }


def ping_node(node: dict, org_id, count: int = 5) -> dict:
    ping_result = execute_ping(node["ipAddress"], count=count)
    return build_metric_doc(node, org_id, ping_result)
