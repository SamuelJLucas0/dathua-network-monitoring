"""
Descubrimiento de dispositivos en la LAN local.

Deliberadamente NO usa ARP crudo/scapy (requeriría que el cliente instale
un driver Npcap adicional — un paso manual más para un dueño de PyME sin
conocimiento técnico). En vez de eso: un ping-sweep del /24 local puebla la
tabla ARP que ya mantiene el propio sistema operativo, y se lee esa tabla
con las herramientas que ya vienen instaladas (`arp -a` en Windows, `ip
neigh`/`arp -a` en Linux — esta última rama solo existe para poder probar
el parseo en este equipo de desarrollo).

La clasificación de qué tipo de dispositivo es cada uno NO se hace aquí:
el agente solo junta evidencia cruda (IP, MAC, hostname, puertos abiertos,
y también identidad + vecinos LLDP por SNMP para equipo administrado — ver
snmp_discovery.py) y se la manda a dathua-api, que aplica el heurístico de forma centralizada
(ver dathua-api/src/services/deviceClassifier.js). Así, mejorar el
heurístico no requiere recompilar ni redistribuir el .exe a cada cliente.
"""
import platform
import re
import socket
from concurrent.futures import ThreadPoolExecutor

from agent.config import PORT_PROBE_LIST, PORT_PROBE_TIMEOUT
from agent.ping_engine import execute_ping, run_command
from agent import snmp_discovery

_WINDOWS_ARP_RE = re.compile(
    r'(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F]{2}(?:-[0-9a-fA-F]{2}){5})'
)
_LINUX_NEIGH_RE = re.compile(
    r'(\d+\.\d+\.\d+\.\d+)\s+dev\s+\S+\s+lladdr\s+([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5})'
)


def get_local_ip() -> str | None:
    """IP local vía un socket UDP 'conectado' — no se manda ningún paquete."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def get_subnet_hosts(local_ip: str) -> list[str]:
    """
    Simplificación consciente: se asume /24. Cubre el caso casi universal de
    una PyME de 1-3 sucursales detrás de un router doméstico/SMB con un
    solo segmento plano; redes con VLANs o subredes más grandes quedan
    fuera de esta primera versión.
    """
    prefix = ".".join(local_ip.split(".")[:3])
    return [f"{prefix}.{i}" for i in range(1, 255) if f"{prefix}.{i}" != local_ip]


def ping_sweep(hosts: list[str], max_workers: int = 32) -> None:
    """Pobla la tabla ARP del SO; el resultado del ping no importa."""
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        list(pool.map(lambda ip: execute_ping(ip, count=1), hosts))


def read_arp_table() -> dict:
    """IP -> MAC (formato AA:BB:CC:DD:EE:FF), leída de la tabla ARP del SO."""
    is_windows = platform.system().lower() == "windows"
    cmd = ["arp", "-a"] if is_windows else ["ip", "neigh", "show"]

    try:
        output = run_command(cmd, timeout=10)
    except Exception:
        return {}

    pattern = _WINDOWS_ARP_RE if is_windows else _LINUX_NEIGH_RE
    matches = pattern.findall(output)

    table = {}
    for ip, mac in matches:
        table[ip] = mac.replace("-", ":").upper()
    return table


def resolve_hostname(ip: str) -> str | None:
    try:
        return socket.gethostbyaddr(ip)[0]
    except (socket.herror, socket.gaierror, OSError):
        return None


def probe_ports(ip: str, ports=PORT_PROBE_LIST, timeout: float = PORT_PROBE_TIMEOUT) -> list:
    """Connect-scan plano — sin banner grabbing, sin exploits, solo saber si el puerto responde."""
    open_ports = []
    for port in ports:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(timeout)
            if s.connect_ex((ip, port)) == 0:
                open_ports.append(port)
    return open_ports


def probe_snmp(ip: str) -> dict | None:
    """
    Identificación + vecinos LLDP para equipo ADMINISTRADO (ver
    snmp_discovery.py). None es el resultado normal para la inmensa
    mayoría de dispositivos de una LAN de PyME (switch no administrado,
    cámara, endpoint) — no significa error, significa "no es SNMP".
    """
    identity = snmp_discovery.identify(ip)
    if not identity:
        return None
    return {
        "sysDescr": identity["sysDescr"],
        "sysObjectId": identity["sysObjectId"],
        "sysName": identity["sysName"],
        "lldpNeighbors": snmp_discovery.lldp_neighbors(ip, identity["community"]),
    }


def snmp_enrich(candidates: list, max_workers: int = 16) -> None:
    """Corre probe_snmp() en paralelo sobre cada candidato, in-place."""
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        results = pool.map(lambda c: probe_snmp(c["ip"]), candidates)
        for candidate, snmp in zip(candidates, results):
            if snmp:
                candidate["snmp"] = snmp


def run_discovery_cycle(known_ips: set) -> list:
    """
    Un ciclo completo de descubrimiento. `known_ips` son las IPs de los
    nodos que la sucursal ya tiene registrados (vía /nodes/worker/active) —
    se excluyen para no re-reportar como "candidato" algo que ya se está
    monitoreando.
    """
    local_ip = get_local_ip()
    if not local_ip:
        return []

    hosts = get_subnet_hosts(local_ip)
    ping_sweep(hosts)
    arp_table = read_arp_table()

    # `arp -a` de Windows lista TODAS las interfaces e incluye entradas
    # estáticas de broadcast (x.x.x.255) y multicast (224.x, 239.x) — sin
    # este filtro se reportaban como "equipos descubiertos". Solo cuenta lo
    # que está dentro del /24 que se acaba de barrer.
    swept = set(hosts)

    candidates = []
    for ip, mac in arp_table.items():
        if ip not in swept or ip in known_ips:
            continue
        candidates.append({
            "ip": ip,
            "mac": mac,
            "hostname": resolve_hostname(ip),
            "openPorts": probe_ports(ip),
        })

    # SNMP solo aporta señal para equipo administrado — se prueba después
    # del sondeo normal, sobre los mismos candidatos, nunca reemplaza la
    # evidencia de ARP/puertos que ya se recolectó arriba.
    snmp_enrich(candidates)
    return candidates
