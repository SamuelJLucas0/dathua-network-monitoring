import logging
import threading
from unittest.mock import MagicMock, patch

from agent import monitor_service, status_file
from agent.api_client import ApiUnreachableError, SiteKeyRevokedError

LOG = logging.getLogger("test")
SITE = {"siteId": 39, "orgId": 36, "name": "Sucursal Centro"}
NODES = [{"nodeId": 1, "siteId": 39, "ipAddress": "192.168.1.1"}]


def _run_one_round(client):
    """Corre una sola vuelta de monitoring_loop y devuelve lo que reportó a `status`."""
    stop = threading.Event()
    calls = []

    def status(state, **info):
        calls.append((state, info))
        stop.set()

    with patch("agent.monitor_service.ping_node", return_value={"status": "UP"}):
        monitor_service.monitoring_loop(client, stop, LOG, status=status)
    return calls


def test_status_ok_after_successful_report():
    client = MagicMock()
    client.get_active_nodes.return_value = (SITE, NODES)
    client.report_telemetry.return_value = {"insertedCount": 1}

    assert _run_one_round(client) == [("ok", {"site": SITE, "nodeCount": 1})]


def test_status_key_revoked():
    client = MagicMock()
    client.get_active_nodes.side_effect = SiteKeyRevokedError("Forbidden")

    assert _run_one_round(client) == [("key_revoked", {})]


def test_status_key_revoked_while_reporting():
    client = MagicMock()
    client.get_active_nodes.return_value = (SITE, NODES)
    client.report_telemetry.side_effect = SiteKeyRevokedError("Forbidden")

    assert _run_one_round(client) == [("key_revoked", {})]


def test_status_api_unreachable():
    client = MagicMock()
    client.get_active_nodes.side_effect = ApiUnreachableError("timeout")

    assert _run_one_round(client) == [("api_unreachable", {})]


def test_status_no_nodes():
    client = MagicMock()
    client.get_active_nodes.return_value = (SITE, [])

    assert _run_one_round(client) == [("no_nodes", {"site": SITE})]


def test_broken_status_callback_does_not_stop_monitoring():
    client = MagicMock()
    client.get_active_nodes.return_value = (SITE, NODES)
    client.report_telemetry.return_value = {"insertedCount": 1}
    stop = threading.Event()
    rounds = []

    def broken_status(state, **info):
        rounds.append(state)
        if len(rounds) == 2:
            stop.set()
        raise OSError("disco lleno")

    with patch("agent.monitor_service.ping_node", return_value={"status": "UP"}), \
         patch("agent.monitor_service.POLL_INTERVAL", 0):
        monitor_service.monitoring_loop(client, stop, LOG, status=broken_status)

    assert rounds == ["ok", "ok"]  # siguió a la segunda vuelta


def test_status_file_keeps_last_report_across_restarts(tmp_path):
    path = tmp_path / "status.json"

    status_file.StatusFile(path)("ok", site=SITE, nodeCount=1)
    first = status_file.read_status(path)
    assert first["state"] == "ok"
    assert first["siteName"] == "Sucursal Centro"
    assert first["lastReportAt"] == first["updatedAt"]

    # El servicio se reinicia y la llave ya no sirve: el último reporte
    # exitoso se conserva, el estado y el mensaje cambian.
    status_file.StatusFile(path)("key_revoked")
    second = status_file.read_status(path)
    assert second["state"] == "key_revoked"
    assert second["lastReportAt"] == first["lastReportAt"]
    assert "Reconfigurar" in second["message"]


def test_read_status_missing_or_corrupt(tmp_path):
    assert status_file.read_status(tmp_path / "no-existe.json") is None
    corrupt = tmp_path / "status.json"
    corrupt.write_text("{a medio escribir", encoding="utf-8")
    assert status_file.read_status(corrupt) is None
