"""
Rutas y configuración persistente del agente Linux.

A diferencia del agente de Windows (que corre como Servicio de máquina sin
sesión y por eso usa %PROGRAMDATA%), aquí se sigue el estándar XDG Base
Directory de Linux: la config vive en el perfil del usuario que instala el
agente (~/.config/dathua-agent), y arranca sin necesitar que ese usuario
tenga sesión gráfica abierta gracias a `loginctl enable-linger` (ver
service.py) — el equivalente funcional a "corre sin que nadie inicie
sesión" del Servicio de Windows, sin requerir una cuenta de sistema aparte
ni permisos de root para instalarse.

El formato del archivo de config es EL MISMO que el del agente de Windows
({"apiBaseUrl", "apiKey", "site"}) a propósito — son el mismo backend y el
mismo contrato, solo cambia dónde vive el archivo.
"""
import json
import os
from pathlib import Path

APP_NAME = "dathua-agent"

POLL_INTERVAL = 20            # segundos entre rondas de ping
PING_COUNT = 5                # paquetes ICMP por nodo
DISCOVERY_INTERVAL = 30 * 60  # segundos entre ciclos de descubrimiento de red
PORT_PROBE_LIST = (80, 443, 22, 23, 554, 3389, 9100)
PORT_PROBE_TIMEOUT = 0.3      # segundos por puerto

# SNMP: solo para equipo ADMINISTRADO (routers/switches/APs/servidores con
# SNMP habilitado) — un switch no administrado nunca va a contestar esto,
# y eso está bien: se queda clasificado por el heurístico de MAC/puertos
# de siempre (ver deviceClassifier.js). "public" es la community de solo
# lectura que trae por default la gran mayoría de equipo sin endurecer;
# se prueba de forma oportunista, nunca se pide al usuario de entrada.
SNMP_COMMUNITIES = ("public",)
SNMP_PORT = 161
SNMP_TIMEOUT = 1.0             # segundos por intento — no se reintenta (retries=0):
                                # un dispositivo que no contesta SNMP en 1s casi
                                # siempre es porque no lo tiene habilitado, no porque
                                # el paquete se haya perdido en la LAN local.


def _xdg_path(env_var: str, default_relative: str) -> Path:
    override = os.environ.get(env_var)
    if override:
        return Path(override)
    return Path.home() / default_relative


def get_config_dir() -> Path:
    return _xdg_path("XDG_CONFIG_HOME", ".config") / APP_NAME


def get_config_path() -> Path:
    return get_config_dir() / "config.json"


def get_data_dir() -> Path:
    return _xdg_path("XDG_DATA_HOME", ".local/share") / APP_NAME


def get_log_dir() -> Path:
    return get_data_dir() / "logs"


def get_systemd_user_dir() -> Path:
    return _xdg_path("XDG_CONFIG_HOME", ".config") / "systemd" / "user"


def load_config() -> dict | None:
    path = get_config_path()
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return None

    if not data.get("apiKey") or not data.get("apiBaseUrl"):
        return None
    return data


def save_config(api_base_url: str, api_key: str, site: dict) -> None:
    config_dir = get_config_dir()
    config_dir.mkdir(parents=True, exist_ok=True)

    payload = {"apiBaseUrl": api_base_url, "apiKey": api_key, "site": site}
    path = get_config_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    # La Site API Key es equivalente a una contraseña — igual que
    # cualquier archivo de credenciales, no debe quedar legible para otros
    # usuarios de la misma máquina.
    os.chmod(path, 0o600)


def clear_config() -> None:
    path = get_config_path()
    if path.exists():
        try:
            path.unlink()
        except OSError:
            pass
