"""
`setup --url ... --key ... --install`: el bloque de comandos que da la
página "Instalar agente" del dashboard. No debe preguntar nada por
terminal (si llamara a input(), un pegado de varios comandos se atora).
"""
import pytest

from agent_linux import __main__ as cli
from agent_linux import config as agent_config
from agent_linux import service, setup_wizard

SITE = {"siteId": 40, "orgId": 36, "name": "Sucursal Centro"}


@pytest.fixture
def isolated(tmp_path, monkeypatch):
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "config"))
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path / "data"))

    def no_input(prompt=""):
        raise AssertionError(f"no debía preguntar nada: {prompt!r}")

    monkeypatch.setattr("builtins.input", no_input)

    class FakeClient:
        def __init__(self, url, key):
            self.url, self.key = url, key

        def get_active_nodes(self):
            return SITE, [{"nodeId": 1}]

    monkeypatch.setattr(setup_wizard, "DathuaApiClient", FakeClient)
    return tmp_path


def test_setup_with_flags_saves_config_without_prompting(isolated, monkeypatch):
    monkeypatch.setattr(service, "systemd_available", lambda: False)

    args = cli.build_parser().parse_args(
        ["setup", "--url", "http://192.168.1.17:3000/api", "--key", "dth_site_abc"])
    assert args.func(args) == 0

    cfg = agent_config.load_config()
    assert cfg["apiBaseUrl"] == "http://192.168.1.17:3000/api"
    assert cfg["apiKey"] == "dth_site_abc"
    assert cfg["site"]["name"] == "Sucursal Centro"


def test_setup_with_install_flag_installs_service_without_asking(isolated, monkeypatch):
    installed = []
    monkeypatch.setattr(service, "systemd_available", lambda: True)
    monkeypatch.setattr(service, "install", lambda: installed.append(True) or ["Servicio arrancado"])

    args = cli.build_parser().parse_args(
        ["setup", "--url", "http://x/api", "--key", "dth_site_abc", "--install"])
    assert args.func(args) == 0
    assert installed == [True]
