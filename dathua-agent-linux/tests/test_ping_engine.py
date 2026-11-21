from unittest.mock import MagicMock, patch

from agent_linux import ping_engine


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
    with patch("agent_linux.ping_engine.platform.system", return_value="Linux"), \
         patch("agent_linux.ping_engine.subprocess.run", return_value=fake_result):
        result = ping_engine.execute_ping("127.0.0.1", count=2)

    assert result["received"] == 2
    assert result["rtts"] == [0.032, 0.045]
    assert result["error"] is None


def test_execute_ping_linux_full_loss():
    fake_output = (
        "PING 10.0.0.99 (10.0.0.99) 56(84) bytes of data.\n"
        "\n--- 10.0.0.99 ping statistics ---\n"
        "4 packets transmitted, 0 received, 100% packet loss, time 3059ms\n"
    )
    fake_result = MagicMock(stdout=fake_output)
    with patch("agent_linux.ping_engine.platform.system", return_value="Linux"), \
         patch("agent_linux.ping_engine.subprocess.run", return_value=fake_result):
        result = ping_engine.execute_ping("10.0.0.99", count=4)

    assert result["received"] == 0
    assert result["error"] == "Host inalcanzable"


def test_execute_ping_real_localhost():
    """Ping real (sin mocks) contra loopback — no requiere root en un Arch
    con el rango de puertos ICMP sin privilegios habilitado por default."""
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
