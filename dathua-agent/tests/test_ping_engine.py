import platform
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from agent import ping_engine

FIXTURES = Path(__file__).parent / "fixtures"


def test_calculate_jitter_no_variation():
    assert ping_engine.calculate_jitter([10, 10, 10]) == 0.0


def test_calculate_jitter_single_sample():
    assert ping_engine.calculate_jitter([10]) == 0.0


def test_calculate_jitter_varying():
    assert ping_engine.calculate_jitter([10, 12, 8]) == 3.0


def test_execute_ping_linux_regex():
    fake_output = (
        "PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.\n"
        "64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.032 ms\n"
        "64 bytes from 127.0.0.1: icmp_seq=2 ttl=64 time=0.045 ms\n"
    )
    fake_result = MagicMock(stdout=fake_output)
    with patch("agent.ping_engine.platform.system", return_value="Linux"), \
         patch("agent.ping_engine.subprocess.run", return_value=fake_result):
        result = ping_engine.execute_ping("127.0.0.1", count=2)

    assert result["received"] == 2
    assert result["rtts"] == [0.032, 0.045]
    assert result["error"] is None


def test_execute_ping_windows_regex_from_fixture():
    """
    No hay forma de correr `ping.exe` real en este equipo Linux — esta
    prueba valida el parseo del regex de Windows contra una salida de
    ejemplo capturada, sin depender de una máquina Windows real.
    """
    fixture = (FIXTURES / "windows_ping_output.txt").read_text(encoding="utf-8")
    fake_result = MagicMock(stdout=fixture)
    with patch("agent.ping_engine.platform.system", return_value="Windows"), \
         patch("agent.ping_engine.subprocess.run", return_value=fake_result):
        result = ping_engine.execute_ping("192.168.1.1", count=4)

    assert result["received"] == 4
    assert result["rtts"] == [1.0, 1.0, 2.0, 1.0]  # "time<1ms" cuenta como 1
    assert result["error"] is None


def test_execute_ping_windows_timeout_from_fixture():
    fixture = (FIXTURES / "windows_ping_timeout.txt").read_text(encoding="utf-8")
    fake_result = MagicMock(stdout=fixture)
    with patch("agent.ping_engine.platform.system", return_value="Windows"), \
         patch("agent.ping_engine.subprocess.run", return_value=fake_result):
        result = ping_engine.execute_ping("10.0.0.99", count=4)

    assert result["received"] == 0
    assert result["error"] == "Host inalcanzable"


def _parse_windows_fixture(name, count):
    fixture = (FIXTURES / name).read_text(encoding="utf-8")
    fake_result = MagicMock(stdout=fixture)
    with patch("agent.ping_engine.platform.system", return_value="Windows"),          patch("agent.ping_engine.subprocess.run", return_value=fake_result):
        return ping_engine.execute_ping("192.168.1.1", count=count)


def test_execute_ping_windows_spanish_from_real_capture():
    """Salida real de `ping -n 5` en un Windows 11 es-MX ("tiempo=2ms")."""
    result = _parse_windows_fixture("windows_es_ping_output.txt", count=5)

    assert result["rtts"] == [2.0, 4.0, 2.0, 2.0, 3.0]
    assert result["received"] == 5


def test_execute_ping_windows_spanish_submillisecond():
    """
    Windows en español imprime "tiempo<1m" (sin la "s") para respuestas de
    menos de 1 ms — capturado de un Windows real. El regex anterior exigía
    "ms" y contaba estas respuestas como paquetes perdidos (el nodo salía
    caído aunque respondiera perfecto).
    """
    result = _parse_windows_fixture("windows_es_ping_submillisecond.txt", count=4)

    assert result["rtts"] == [1.0, 1.0, 1.0, 1.0]
    assert result["received"] == 4
    assert result["error"] is None


def test_execute_ping_windows_spanish_unreachable():
    """
    "Host de destino inaccesible" lo responde el propio equipo, no el
    destino — Windows lo cuenta como "recibidos = 1", pero no es una
    respuesta real. Ni eso ni "Tiempo de espera agotado" deben contar.
    """
    result = _parse_windows_fixture("windows_es_ping_unreachable.txt", count=3)

    assert result["received"] == 0
    assert result["error"] == "Host inalcanzable"


def test_run_command_windows_uses_oem_encoding_and_no_window():
    fake_result = MagicMock(stdout="")
    with patch("agent.ping_engine.platform.system", return_value="Windows"),          patch("agent.ping_engine.subprocess.run", return_value=fake_result) as run:
        ping_engine.run_command(["ping", "127.0.0.1"], timeout=5)

    kwargs = run.call_args.kwargs
    assert kwargs["encoding"] == "oem"
    assert kwargs["creationflags"] == 0x08000000  # CREATE_NO_WINDOW


@pytest.mark.skipif(platform.system() != "Windows", reason="usa ping.exe real")
def test_execute_ping_real_localhost_windows():
    """`ping` real de esta máquina: localhost responde en <1 ms siempre."""
    result = ping_engine.execute_ping("127.0.0.1", count=2)

    assert result["received"] == 2
    assert result["error"] is None


def test_build_metric_doc_up():
    node = {"nodeId": 5, "siteId": 3, "zoneId": None, "ipAddress": "10.0.0.1"}
    ping_result = {"error": None, "rtts": [10.0, 12.0, 8.0], "transmitted": 3, "received": 3}

    doc = ping_engine.build_metric_doc(node, org_id=7, ping_result=ping_result)

    assert doc["status"] == "UP"
    assert doc["loss_percent"] == 0
    assert doc["avg_ms"] == 10.0
    assert doc["metadata"]["node_id"] == 5
    assert doc["metadata"]["site_id"] == 3
    assert doc["metadata"]["org_id"] == 7
    assert doc["metadata"]["target"] == "10.0.0.1"


def test_build_metric_doc_down():
    node = {"nodeId": 5, "siteId": 3, "ipAddress": "10.0.0.1"}
    ping_result = {"error": "Host inalcanzable", "rtts": [], "transmitted": 4, "received": 0}

    doc = ping_engine.build_metric_doc(node, org_id=7, ping_result=ping_result)

    assert doc["status"] == "DOWN"
    assert doc["loss_percent"] == 100
    assert doc["avg_ms"] is None
    assert doc["error"] == "Host inalcanzable"
