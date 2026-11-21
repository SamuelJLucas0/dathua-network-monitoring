"""
Rutas y configuración persistente del agente.

En Windows, el Servicio corre sin sesión de usuario, así que la config y los
logs viven en una ruta de máquina (%PROGRAMDATA%), no en el directorio de
trabajo del proceso (que PyInstaller vuelve impredecible) ni en el perfil de
un usuario en particular. En Linux (solo para desarrollo/pruebas de este
proyecto, nunca la ruta real de un cliente) se usa ~/.dathua-agent.
"""
import json
import os
import platform
from pathlib import Path

APP_NAME = "DathuaAgent"
APP_DISPLAY_NAME = "DatHua Agent"  # menú Inicio, Aplicaciones instaladas, ventana
APP_VERSION = "1.0.0"

# Dirección de dathua-api que usa el asistente si el dueño no abre "Opciones
# avanzadas". Todavía no existe un servidor de producción: cuando exista, va
# aquí (y se recompila el .exe). Mientras tanto, para probar contra el
# servidor de desarrollo hay que escribir su dirección en Opciones avanzadas.
DEFAULT_API_BASE_URL = "http://localhost:3000/api"

POLL_INTERVAL = 20          # segundos entre rondas de ping
PING_COUNT = 5              # paquetes ICMP por nodo
DISCOVERY_INTERVAL = 30 * 60  # segundos entre ciclos de descubrimiento de red
PORT_PROBE_LIST = (80, 443, 22, 23, 554, 3389, 9100)
PORT_PROBE_TIMEOUT = 0.3    # segundos por puerto

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


def get_base_dir() -> Path:
    if platform.system() == "Windows":
        return Path(os.environ.get("PROGRAMDATA", r"C:\ProgramData")) / APP_NAME
    return Path.home() / ".dathua-agent"


def get_config_path() -> Path:
    return get_base_dir() / "config.json"


def get_log_dir() -> Path:
    return get_base_dir() / "logs"


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
    base_dir = get_base_dir()
    base_dir.mkdir(parents=True, exist_ok=True)

    payload = {"apiBaseUrl": api_base_url, "apiKey": api_key, "site": site}
    with open(get_config_path(), "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)


def clear_config() -> None:
    path = get_config_path()
    if path.exists():
        try:
            path.unlink()
        except OSError:
            pass
