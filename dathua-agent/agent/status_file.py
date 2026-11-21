"""
status.json: lo que el servicio le cuenta a la pantalla de estado del
asistente. El servicio corre en sesión 0 y no puede mostrar ventanas ni
avisos; sin esto, una llave de sucursal revocada (sucursal borrada en el
panel) o una falla de internet solo quedaban en el log y el dueño no se
enteraba hasta ver el dashboard vacío.

El servicio lo escribe en cada vuelta del loop de monitoreo (ver
monitor_service.monitoring_loop, parámetro `status`); el asistente lo lee
(read_status) sin necesitar permisos de administrador.
"""
import json
import os
from datetime import datetime, timezone

from agent.config import get_base_dir
from agent.monitor_service import (
    STATUS_API_UNREACHABLE, STATUS_ERROR, STATUS_KEY_REVOKED, STATUS_NO_NODES, STATUS_OK,
)

# Texto para el dueño de la PyME, sin jerga (ver CLAUDE.md, sección 3).
MESSAGES = {
    STATUS_OK: "Todo en orden: el agente está revisando tu red y enviando los datos a DatHua.",
    STATUS_NO_NODES: ("Tu sucursal todavía no tiene equipos registrados. Agrégalos o "
                      "apruébalos desde el panel de DatHua para que el agente los revise."),
    STATUS_KEY_REVOKED: ("La llave de esta sucursal ya no funciona (puede que la sucursal se "
                         "haya borrado en el panel de DatHua). Presiona Reconfigurar y pega la "
                         "llave nueva."),
    STATUS_API_UNREACHABLE: ("No se puede conectar con DatHua. Revisa que esta computadora tenga "
                             "internet; el agente lo seguirá intentando solo."),
    STATUS_ERROR: ("Ocurrió un error inesperado. El agente lo seguirá intentando solo; si se "
                   "repite, revisa el registro."),
}


def get_status_path():
    return get_base_dir() / "status.json"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class StatusFile:
    """Callable que se pasa como `status` a monitor_service.run_forever()."""

    def __init__(self, path=None):
        self.path = path or get_status_path()
        # La hora del último reporte exitoso se conserva entre reinicios del
        # servicio: "último reporte hace 2 días" es justo lo que importa ver
        # cuando algo lleva tiempo fallando.
        self.last_report_at = (read_status(self.path) or {}).get("lastReportAt")

    def __call__(self, state: str, site: dict | None = None, nodeCount: int | None = None):
        now = _now()
        if state == STATUS_OK:
            self.last_report_at = now

        data = {
            "state": state,
            "message": MESSAGES.get(state, MESSAGES[STATUS_ERROR]),
            "updatedAt": now,
            "lastReportAt": self.last_report_at,
        }
        if site:
            data["siteName"] = site.get("name")
        if nodeCount is not None:
            data["nodeCount"] = nodeCount

        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        # Reemplazo atómico: la ventana nunca lee un JSON a medio escribir.
        os.replace(tmp, self.path)


def read_status(path=None) -> dict | None:
    path = path or get_status_path()
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def clear_status() -> None:
    try:
        get_status_path().unlink()
    except OSError:
        pass
