"""
Instalación como servicio de usuario de systemd — el equivalente en Linux
al Servicio de Windows (winservice.py del otro agente): arranca solo,
sobrevive a un reinicio de la máquina, y no depende de que quede una
terminal abierta.

Se usa un servicio de USUARIO (`systemctl --user`), no de sistema
(`systemctl` a secas), a propósito:
  - No requiere sudo/root para instalarse, arrancarse ni depurarse — igual
    de friccionoso que instalar cualquier programa de usuario.
  - `loginctl enable-linger` (que sí es un comando de systemd pero que
    cada usuario puede activar PARA SÍ MISMO sin privilegios de root en la
    política por default) hace que el servicio seed siga corriendo aunque
    ese usuario cierre sesión o la máquina arranque sin que nadie inicie
    sesión gráfica — el mismo resultado práctico que un servicio de
    Windows, sin necesitar una cuenta de sistema aparte.
  - Es el patrón que ya usan otros daemons de usuario conocidos en Linux
    (Syncthing, servicios de sincronización de la nube, etc.).

Si más adelante se necesita de verdad un servicio de sistema (varias
cuentas en la misma máquina, o un dueño que prefiera no dejar su usuario
con sesión "fantasma" vía linger), este módulo es el lugar para agregar
esa variante — la plantilla del .service casi no cambiaría.
"""
import shutil
import subprocess
import sys
from pathlib import Path

from agent_linux.config import get_systemd_user_dir

SERVICE_NAME = "dathua-agent.service"

UNIT_TEMPLATE = """[Unit]
Description=DatHua Agent - monitoreo de red de la sucursal
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart={python_exe} -m agent_linux run
WorkingDirectory={project_dir}
Environment=PYTHONPATH={project_dir}
Restart=on-failure
RestartSec=15

[Install]
WantedBy=default.target
"""


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def systemd_available() -> bool:
    return shutil.which("systemctl") is not None


def unit_path() -> Path:
    return get_systemd_user_dir() / SERVICE_NAME


def write_unit_file(project_dir: Path | None = None) -> Path:
    """
    `project_dir` es la raíz de este checkout (donde vive el paquete
    `agent_linux/`) — se apunta ExecStart directo al intérprete que está
    corriendo `install` ahora mismo (venv incluido, si lo hay), en vez de
    asumir una instalación empaquetada. Es la forma más simple de que
    esto funcione HOY, en esta máquina, sin necesitar aún un paso de
    empaquetado (ver README.md, sección "Generalizar más adelante").
    """
    if project_dir is None:
        project_dir = Path(__file__).resolve().parent.parent

    systemd_dir = get_systemd_user_dir()
    systemd_dir.mkdir(parents=True, exist_ok=True)

    content = UNIT_TEMPLATE.format(python_exe=sys.executable, project_dir=project_dir)
    path = unit_path()
    path.write_text(content, encoding="utf-8")
    return path


def install(project_dir: Path | None = None) -> list[str]:
    """Escribe el .service, recarga systemd, habilita+arranca, y activa
    linger. Devuelve la bitácora de pasos (para imprimir desde la CLI)."""
    steps = []

    path = write_unit_file(project_dir)
    steps.append(f"Unidad escrita en {path}")

    _run(["systemctl", "--user", "daemon-reload"])
    steps.append("systemctl --user daemon-reload")

    res = _run(["systemctl", "--user", "enable", SERVICE_NAME])
    if res.returncode != 0:
        steps.append(f"ERROR al habilitar el servicio: {res.stderr.strip()}")
        return steps

    # restart y no `enable --now`: si el servicio ya corría (reconfigurar
    # con otra llave, o actualizar pegando otra vez los comandos del
    # dashboard), `--now` lo dejaba corriendo con la config y el código
    # viejos hasta el siguiente reinicio de la máquina. restart también lo
    # arranca si estaba detenido.
    res = _run(["systemctl", "--user", "restart", SERVICE_NAME])
    if res.returncode != 0:
        steps.append(f"ERROR al arrancar el servicio: {res.stderr.strip()}")
        return steps
    steps.append("Servicio habilitado y (re)arrancado (systemctl --user enable + restart)")

    linger_res = _run(["loginctl", "enable-linger"])
    if linger_res.returncode == 0:
        steps.append("Linger activado — el agente seguirá corriendo aunque cierres sesión.")
    else:
        steps.append(
            "No se pudo activar linger automáticamente "
            f"({linger_res.stderr.strip() or 'sin detalle'}). El agente solo correrá "
            "mientras tengas una sesión activa hasta que actives linger a mano:\n"
            "  loginctl enable-linger $USER"
        )

    return steps


def uninstall(purge_config: bool = False) -> list[str]:
    steps = []

    _run(["systemctl", "--user", "disable", "--now", SERVICE_NAME])
    steps.append("Servicio detenido y deshabilitado")

    path = unit_path()
    if path.exists():
        path.unlink()
        steps.append(f"Unidad eliminada ({path})")

    _run(["systemctl", "--user", "daemon-reload"])
    steps.append("systemctl --user daemon-reload")

    if purge_config:
        from agent_linux.config import clear_config
        clear_config()
        steps.append("Configuración eliminada (--purge)")

    return steps


def status_text() -> str:
    res = _run(["systemctl", "--user", "status", SERVICE_NAME, "--no-pager"])
    return res.stdout or res.stderr or "No se pudo consultar el estado del servicio."


def is_installed() -> bool:
    return unit_path().exists()
