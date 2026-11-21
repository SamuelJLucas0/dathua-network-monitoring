import socket
import threading
from unittest.mock import MagicMock, patch

from agent_linux import discovery


def test_get_subnet_hosts_excludes_self():
    hosts = discovery.get_subnet_hosts("192.168.1.10")
    assert len(hosts) == 253
    assert "192.168.1.10" not in hosts
    assert "192.168.1.1" in hosts
    assert "192.168.1.254" in hosts


def test_read_arp_table_linux_ip_neigh():
    fake_output = (
        "192.168.1.1 dev eth0 lladdr aa:bb:cc:dd:ee:ff REACHABLE\n"
        "192.168.1.20 dev eth0 lladdr 11:22:33:44:55:66 STALE\n"
        "192.168.1.30 dev eth0  FAILED\n"
    )
    fake_result = MagicMock(stdout=fake_output)
    with patch("agent_linux.discovery.platform.system", return_value="Linux"), \
         patch("agent_linux.ping_engine.subprocess.run", return_value=fake_result):
        table = discovery.read_arp_table()

    assert table == {
        "192.168.1.1": "AA:BB:CC:DD:EE:FF",
        "192.168.1.20": "11:22:33:44:55:66",
    }
    assert "192.168.1.30" not in table  # sin MAC (FAILED), no debe aparecer


def test_read_arp_table_real_ip_neigh_command():
    """Corre `ip neigh show` de verdad en esta máquina Arch — solo valida
    que el comando exista y el parseo no truene, sin asumir contenido."""
    table = discovery.read_arp_table()
    assert isinstance(table, dict)


def test_probe_ports_detects_open_local_port():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(("127.0.0.1", 0))
    server.listen(1)
    port = server.getsockname()[1]
    stop = threading.Event()

    def accept_loop():
        server.settimeout(1)
        try:
            while not stop.is_set():
                conn, _ = server.accept()
                conn.close()
        except OSError:
            pass

    t = threading.Thread(target=accept_loop, daemon=True)
    t.start()
    try:
        open_ports = discovery.probe_ports("127.0.0.1", ports=(port, port + 1), timeout=0.5)
    finally:
        stop.set()
        server.close()

    assert port in open_ports
    assert (port + 1) not in open_ports


def test_run_discovery_cycle_excludes_known_ips():
    with patch("agent_linux.discovery.get_local_ip", return_value="192.168.1.10"), \
         patch("agent_linux.discovery.ping_sweep"), \
         patch("agent_linux.discovery.read_arp_table", return_value={
             "192.168.1.1": "AA:BB:CC:DD:EE:FF",
             "192.168.1.20": "11:22:33:44:55:66",
         }), \
         patch("agent_linux.discovery.resolve_hostname", return_value=None), \
         patch("agent_linux.discovery.probe_ports", return_value=[]):
        candidates = discovery.run_discovery_cycle(known_ips={"192.168.1.1"})

    ips = [c["ip"] for c in candidates]
    assert "192.168.1.20" in ips
    assert "192.168.1.1" not in ips  # ya monitoreado, no debe salir como candidato


def test_run_discovery_cycle_ignores_addresses_outside_swept_subnet():
    """
    La tabla de vecinos puede traer entradas de otras interfaces (docker0,
    link-local) o de broadcast/multicast — solo cuenta lo que está dentro
    del /24 que se acaba de barrer. Mismo filtro que el agente de Windows,
    donde `arp -a` sí lista broadcast/multicast estáticos.
    """
    with patch("agent_linux.discovery.get_local_ip", return_value="192.168.1.24"), \
         patch("agent_linux.discovery.ping_sweep"), \
         patch("agent_linux.discovery.read_arp_table", return_value={
             "192.168.1.3": "24:B7:2A:69:AC:D1",
             "192.168.1.255": "FF:FF:FF:FF:FF:FF",
             "224.0.0.22": "01:00:5E:00:00:16",
             "172.17.0.2": "02:42:AC:11:00:02",
         }), \
         patch("agent_linux.discovery.resolve_hostname", return_value=None), \
         patch("agent_linux.discovery.probe_ports", return_value=[]), \
         patch("agent_linux.discovery.snmp_enrich"):
        candidates = discovery.run_discovery_cycle(known_ips=set())

    assert [c["ip"] for c in candidates] == ["192.168.1.3"]
