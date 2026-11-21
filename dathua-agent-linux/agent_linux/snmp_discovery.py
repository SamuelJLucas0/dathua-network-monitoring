"""
Identificación de equipo ADMINISTRADO (routers/switches/APs/servidores con
SNMP habilitado) y descubrimiento de su topología real vía LLDP-MIB.

Deliberadamente NO cubre el caso más común en una PyME (un switch no
administrado): ese tipo de switch no tiene IP ni responde absolutamente
nada — no es una limitación de este módulo, es que ese dispositivo no
existe como algo direccionable en la red. Este módulo solo aporta señal
extra para lo que SÍ es administrado; lo demás sigue cayendo en el
heurístico de MAC/puertos de siempre (ver dathua-api deviceClassifier.js).

Solo hace polling ACTIVO por UDP (SNMP GET/WALK) — nunca escucha LLDP de
forma pasiva, que requeriría un socket crudo con privilegios de root y
solo vería el segmento directo del agente. Con polling activo cualquier
dispositivo alcanzable por IP puede consultarse, sin privilegios
especiales, consistente con el resto de este agente (ver README).

LLDP (IEEE 802.1AB) se eligió sobre CDP por ser el estándar neutral de
vendor — lo soportan Ubiquiti, MikroTik, TP-Link Omada, HP/Aruba y Cisco
(que además soporta su propio CDP, fuera de alcance de esta primera
versión).
"""
import asyncio
import logging
import re

from pysnmp.hlapi.v3arch.asyncio import (
    SnmpEngine, CommunityData, UdpTransportTarget, ContextData,
    ObjectType, ObjectIdentity, get_cmd, bulk_walk_cmd,
)

from agent_linux.config import SNMP_COMMUNITIES, SNMP_PORT, SNMP_TIMEOUT

log = logging.getLogger(__name__)

OID_SYS_DESCR = "1.3.6.1.2.1.1.1.0"
OID_SYS_OBJECT_ID = "1.3.6.1.2.1.1.2.0"
OID_SYS_NAME = "1.3.6.1.2.1.1.5.0"

# lldpRemEntry — cada columna trae el mismo índice
# {lldpRemTimeMark, lldpRemLocalPortNum, lldpRemIndex} al final del OID;
# se agrupan por ese sufijo para reconstruir cada fila (un vecino por fila).
OID_LLDP_REM_CHASSIS_ID_SUBTYPE = "1.0.8802.1.1.2.1.4.1.1.4"
OID_LLDP_REM_CHASSIS_ID = "1.0.8802.1.1.2.1.4.1.1.5"
OID_LLDP_REM_PORT_ID = "1.0.8802.1.1.2.1.4.1.1.7"
OID_LLDP_REM_SYS_NAME = "1.0.8802.1.1.2.1.4.1.1.9"

_LLDP_COLUMNS = {
    OID_LLDP_REM_CHASSIS_ID_SUBTYPE: "chassisIdSubtype",
    OID_LLDP_REM_CHASSIS_ID: "chassisId",
    OID_LLDP_REM_PORT_ID: "portId",
    OID_LLDP_REM_SYS_NAME: "sysName",
}

_MAC_CHASSIS_SUBTYPE = "4"  # lldpChassisIdSubtype ::= macAddress(4)
_HEX_OCTETS_RE = re.compile(r'^[0-9A-Fa-f]{2}([:\s-][0-9A-Fa-f]{2}){5}$')


def _normalize_chassis_mac(raw: str) -> str | None:
    """
    chassisId cuando el subtype es macAddress(4) puede llegar como texto
    ya legible ("aa:bb:cc:dd:ee:01") o como una cadena de bytes crudos
    según cómo el stack SNMP del dispositivo la codifique — se normaliza a
    MAYÚSCULAS con ":" para poder cruzarla contra nodes.macAddress tal
    como la guarda el resto del sistema (ver discoveryController.js).
    """
    if not raw:
        return None
    if _HEX_OCTETS_RE.match(raw.strip()):
        return re.sub(r'[\s-]', ':', raw.strip()).upper()
    # Bytes crudos (uno por carácter) — pysnmp los da como str latin-1 en
    # ese caso.
    if len(raw) == 6:
        return ":".join(f"{ord(c):02X}" for c in raw)
    return None


async def _get(ip: str, community: str, oids: list, port: int, timeout: float):
    engine = SnmpEngine()
    target = await UdpTransportTarget.create((ip, port), timeout=timeout, retries=0)
    error_indication, error_status, _error_index, var_binds = await get_cmd(
        engine,
        CommunityData(community, mpModel=1),  # mpModel=1 -> SNMPv2c
        target,
        ContextData(),
        *[ObjectType(ObjectIdentity(oid)) for oid in oids],
    )
    if error_indication or error_status:
        return None
    return [str(vb[1]) for vb in var_binds]


def identify(ip: str, communities=SNMP_COMMUNITIES, port: int = SNMP_PORT, timeout: float = SNMP_TIMEOUT) -> dict | None:
    """
    Prueba cada community de la lista hasta que una conteste. None es el
    resultado NORMAL para la mayoría de los dispositivos de una LAN de
    PyME (switch tonto, cámara, endpoint sin SNMP) — no es un error.
    """
    for community in communities:
        try:
            values = asyncio.run(_get(ip, community, [OID_SYS_DESCR, OID_SYS_OBJECT_ID, OID_SYS_NAME], port, timeout))
        except Exception:
            log.debug("SNMP identify falló para %s con community %r", ip, community, exc_info=True)
            values = None
        if values:
            return {
                "community": community,
                "sysDescr": values[0],
                "sysObjectId": values[1],
                "sysName": values[2],
            }
    return None


async def _walk_lldp(ip: str, community: str, port: float, timeout: float) -> list:
    engine = SnmpEngine()
    target = await UdpTransportTarget.create((ip, port), timeout=timeout, retries=0)
    rows: dict[str, dict] = {}

    for base_oid, field in _LLDP_COLUMNS.items():
        async for error_indication, error_status, _error_index, var_binds in bulk_walk_cmd(
            engine, CommunityData(community, mpModel=1), target, ContextData(),
            0, 10, ObjectType(ObjectIdentity(base_oid)), lexicographicMode=False,
        ):
            if error_indication or error_status:
                break
            for var_bind in var_binds:
                oid_str = str(var_bind[0])
                if not oid_str.startswith(base_oid + "."):
                    continue
                index = oid_str[len(base_oid) + 1:]
                rows.setdefault(index, {})[field] = str(var_bind[1])

    neighbors = []
    for row in rows.values():
        if row.get("chassisIdSubtype") == _MAC_CHASSIS_SUBTYPE:
            mac = _normalize_chassis_mac(row.get("chassisId"))
        else:
            mac = None
        neighbors.append({
            "remoteChassisId": row.get("chassisId"),
            "remoteMac": mac,
            "remotePortId": row.get("portId"),
            "remoteSysName": row.get("sysName"),
        })
    return neighbors


def lldp_neighbors(ip: str, community: str, port: int = SNMP_PORT, timeout: float = SNMP_TIMEOUT) -> list:
    """
    Vecinos LLDP directos de `ip` — solo tiene sentido llamarlo con la
    community que ya se confirmó en `identify()`. Lista vacía es normal:
    LLDP puede estar apagado aunque SNMP sí esté prendido.
    """
    try:
        return asyncio.run(_walk_lldp(ip, community, port, timeout))
    except Exception:
        log.debug("SNMP LLDP walk falló para %s", ip, exc_info=True)
        return []
