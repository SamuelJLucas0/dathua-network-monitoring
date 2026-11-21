"""
Pruebas de identificación SNMP + vecinos LLDP contra un responder SNMPv2c
real (UDP en 127.0.0.1, puerto alto sin privilegios) — no mocks del
cliente: los paquetes viajan de verdad por el stack de pysnmp en ambos
lados. El responder sirve una MIB mínima en memoria: identidad de un
"switch" y una fila de lldpRemTable con la MAC del vecino en bytes crudos,
como la mandaría un equipo administrado.
"""
import asyncio
import socket
import threading

import pytest
from pysnmp.entity import config, engine
from pysnmp.entity.rfc3413 import cmdrsp, context
from pysnmp.carrier.asyncio.dgram import udp
from pysnmp.proto.api import v2c
from pysnmp.smi import instrum

from agent_linux import discovery, snmp_discovery

LLDP_INDEX = (0, 3, 1)  # {lldpRemTimeMark, lldpRemLocalPortNum, lldpRemIndex}
NEIGHBOR_MAC = "64:6E:60:C9:93:1E"

FAKE_MIB = {
    (1, 3, 6, 1, 2, 1, 1, 1, 0): v2c.OctetString("TP-Link JetStream 8-Port Gigabit Smart Switch"),
    (1, 3, 6, 1, 2, 1, 1, 2, 0): v2c.ObjectIdentifier((1, 3, 6, 1, 4, 1, 11863, 5, 1)),
    (1, 3, 6, 1, 2, 1, 1, 5, 0): v2c.OctetString("switch-recepcion"),
    (1, 0, 8802, 1, 1, 2, 1, 4, 1, 1, 4) + LLDP_INDEX: v2c.Integer(4),  # macAddress(4)
    (1, 0, 8802, 1, 1, 2, 1, 4, 1, 1, 5) + LLDP_INDEX: v2c.OctetString(
        hexValue=NEIGHBOR_MAC.replace(":", "")
    ),
    (1, 0, 8802, 1, 1, 2, 1, 4, 1, 1, 7) + LLDP_INDEX: v2c.OctetString("gi0/1"),
    (1, 0, 8802, 1, 1, 2, 1, 4, 1, 1, 9) + LLDP_INDEX: v2c.OctetString("router-principal"),
}


class _DictMibController(instrum.AbstractMibInstrumController):
    def __init__(self, mib: dict):
        self.oids = sorted(mib)
        self.mib = mib

    def read_variables(self, *var_binds, **context):
        return [
            (oid, self.mib.get(tuple(oid), v2c.NoSuchInstance()))
            for oid, _ in var_binds
        ]

    def read_next_variables(self, *var_binds, **context):
        result = []
        for oid, _ in var_binds:
            nxt = next((o for o in self.oids if o > tuple(oid)), None)
            if nxt is None:
                result.append((oid, v2c.EndOfMibView()))
            else:
                result.append((v2c.ObjectIdentifier(nxt), self.mib[nxt]))
        return result


def _free_udp_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def snmp_responder():
    port = _free_udp_port()
    loop = asyncio.new_event_loop()
    ready = threading.Event()
    engines = []

    def serve():
        asyncio.set_event_loop(loop)
        snmp_engine = engine.SnmpEngine()
        engines.append(snmp_engine)
        config.add_transport(
            snmp_engine, udp.DOMAIN_NAME,
            udp.UdpAsyncioTransport().open_server_mode(("127.0.0.1", port)),
        )
        config.add_v1_system(snmp_engine, "area", "public")
        config.add_vacm_user(snmp_engine, 2, "area", "noAuthNoPriv", (1,))

        snmp_context = context.SnmpContext(snmp_engine)
        snmp_context.unregister_context_name(v2c.OctetString(""))
        snmp_context.register_context_name(v2c.OctetString(""), _DictMibController(FAKE_MIB))
        cmdrsp.GetCommandResponder(snmp_engine, snmp_context)
        cmdrsp.NextCommandResponder(snmp_engine, snmp_context)
        cmdrsp.BulkCommandResponder(snmp_engine, snmp_context)

        loop.call_soon(ready.set)
        loop.run_forever()

        pending = asyncio.all_tasks(loop)
        for task in pending:
            task.cancel()
        loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        loop.close()

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    assert ready.wait(10), "el responder SNMP no arrancó"
    yield port

    def shutdown():
        engines[0].close_dispatcher()
        loop.stop()

    loop.call_soon_threadsafe(shutdown)
    thread.join(5)


def test_identify_real_snmp(snmp_responder):
    identity = snmp_discovery.identify("127.0.0.1", port=snmp_responder)

    assert identity == {
        "community": "public",
        "sysDescr": "TP-Link JetStream 8-Port Gigabit Smart Switch",
        "sysObjectId": "1.3.6.1.4.1.11863.5.1",
        "sysName": "switch-recepcion",
    }


def test_identify_wrong_community_returns_none(snmp_responder):
    assert snmp_discovery.identify("127.0.0.1", communities=("privada",), port=snmp_responder, timeout=0.5) is None


def test_identify_nothing_listening_returns_none():
    """El caso normal en una LAN de PyME: el equipo no tiene SNMP."""
    assert snmp_discovery.identify("127.0.0.1", port=_free_udp_port(), timeout=0.5) is None


def test_lldp_neighbors_real_snmp(snmp_responder):
    neighbors = snmp_discovery.lldp_neighbors("127.0.0.1", "public", port=snmp_responder)

    assert neighbors == [{
        "remoteChassisId": neighbors[0]["remoteChassisId"],  # bytes crudos, sin formato fijo
        "remoteMac": NEIGHBOR_MAC,
        "remotePortId": "gi0/1",
        "remoteSysName": "router-principal",
    }]


@pytest.mark.parametrize("raw,expected", [
    ("aa:bb:cc:dd:ee:01", "AA:BB:CC:DD:EE:01"),
    ("aa-bb-cc-dd-ee-01", "AA:BB:CC:DD:EE:01"),
    ("aa bb cc dd ee 01", "AA:BB:CC:DD:EE:01"),
    ("\xaa\xbb\xcc\xdd\xee\x01", "AA:BB:CC:DD:EE:01"),
    ("router-principal", None),
    ("", None),
])
def test_normalize_chassis_mac(raw, expected):
    assert snmp_discovery._normalize_chassis_mac(raw) == expected


def test_snmp_enrich_only_adds_field_when_device_answers(monkeypatch):
    answers = {"192.168.1.5": {"sysDescr": "x", "sysObjectId": "y", "sysName": "z", "lldpNeighbors": []}}
    monkeypatch.setattr(discovery, "probe_snmp", lambda ip: answers.get(ip))
    candidates = [{"ip": "192.168.1.5"}, {"ip": "192.168.1.6"}]

    discovery.snmp_enrich(candidates)

    assert candidates[0]["snmp"]["sysDescr"] == "x"
    assert "snmp" not in candidates[1]  # sin SNMP: el campo no se manda
