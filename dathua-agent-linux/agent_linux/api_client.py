"""
Cliente HTTP hacia dathua-api. Copia funcional del cliente del agente de
Windows (dathua-agent/agent/api_client.py) — el protocolo es exactamente
el mismo (misma API, mismo header `x-site-key`), así que no hay nada que
adaptar aquí. Se duplica en vez de importarse directo porque son dos
proyectos/paquetes Python independientes; si en el futuro se generaliza a
más plataformas, este es el primer módulo candidato a moverse a un
paquete compartido (`dathua-agent-core`) del que ambos agentes importen.

Centraliza reintentos/backoff para fallas transitorias de red, y
distingue explícitamente una Site API Key revocada (401/403) de un
problema de conectividad.
"""
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class SiteKeyRevokedError(Exception):
    """La Site API Key ya no es válida (401/403) — requiere reconfiguración."""


class ApiUnreachableError(Exception):
    """Fallo de red o error de servidor tras agotar reintentos."""


class DathuaApiClient:
    def __init__(self, base_url: str, api_key: str, timeout: int = 10):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

        self.session = requests.Session()
        retry = Retry(
            total=4,
            backoff_factor=2,
            status_forcelist=[500, 502, 503, 504],
            allowed_methods=["GET", "POST"],
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        self.session.headers.update({"x-site-key": api_key, "Content-Type": "application/json"})

    def _request(self, method: str, path: str, **kwargs):
        url = f"{self.base_url}{path}"
        try:
            res = self.session.request(method, url, timeout=self.timeout, **kwargs)
        except requests.exceptions.RequestException as e:
            raise ApiUnreachableError(str(e)) from e

        if res.status_code in (401, 403):
            raise SiteKeyRevokedError(res.text)

        if res.status_code >= 500:
            raise ApiUnreachableError(f"HTTP {res.status_code}: {res.text}")

        return res

    def get_active_nodes(self) -> tuple[dict, list]:
        res = self._request("GET", "/nodes/worker/active")
        data = res.json()
        return data.get("site") or {}, data.get("nodes", [])

    def report_telemetry(self, metrics: list) -> dict:
        res = self._request("POST", "/telemetry/report", json={"metrics": metrics})
        return res.json()

    def submit_discovery_candidates(self, candidates: list, session_start: bool = False) -> dict:
        # `session_start=True` solo en el primer envío de cada arranque del
        # agente — le indica a la API que puede devolver a "pendiente" los
        # candidatos que el dueño ya había rechazado antes (ver
        # discoveryController.js). En envíos posteriores de la misma
        # corrida va en False para no "resucitar" un rechazo a cada rato.
        res = self._request(
            "POST",
            "/discovery/candidates",
            json={"candidates": candidates, "sessionStart": session_start},
        )
        return res.json()
