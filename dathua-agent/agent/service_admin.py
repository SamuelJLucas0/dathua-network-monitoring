"""
Alta, baja y consulta del Servicio de Windows. Solo Windows (pywin32).

`install_service()` y `uninstall_service()` corren en el proceso ELEVADO
que lanza elevate.py (`DathuaAgent.exe --setup-service` /
`--remove-service`). No usa HandleCommandLine de pywin32
porque ese camino no deja saber si de verdad funcionó (imprime a una
consola que el .exe no tiene) y registra el servicio apuntando al .exe
donde el dueño le dio doble clic — normalmente Descargas: si después lo
borraba o lo movía, el servicio dejaba de arrancar sin ningún aviso.

Aquí, en cambio, el .exe se copia a %ProgramFiles%\\DathuaAgent y el
servicio apunta a esa copia; cada paso se registra en el log y el
resultado se devuelve como código de salida del proceso, que el asistente
gráfico lee para decirle al dueño si quedó instalado o no.
"""
import logging
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import winreg

import pythoncom
import pywintypes
import win32service
import win32serviceutil
import winerror
from win32com.shell import shell, shellcon

from agent import config as agent_config
from agent import status_file
from agent.config import APP_DISPLAY_NAME, APP_NAME, APP_VERSION
from agent.winservice import DathuaAgentService

SERVICE_NAME = DathuaAgentService._svc_name_
EXE_NAME = "DathuaAgent.exe"
UNINSTALL_KEY = rf"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{APP_NAME}"

# Códigos de salida de `--setup-service` (los lee elevate.py / la GUI).
EXIT_OK = 0
EXIT_FAILED = 1
EXIT_NOT_FROZEN = 2

_STATE_NAMES = {
    win32service.SERVICE_STOPPED: "stopped",
    win32service.SERVICE_START_PENDING: "starting",
    win32service.SERVICE_STOP_PENDING: "stopping",
    win32service.SERVICE_RUNNING: "running",
    win32service.SERVICE_CONTINUE_PENDING: "starting",
    win32service.SERVICE_PAUSE_PENDING: "stopping",
    win32service.SERVICE_PAUSED: "stopped",
}


def get_install_dir() -> Path:
    return Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / APP_NAME


def get_installed_exe() -> Path:
    return get_install_dir() / EXE_NAME


def query_state() -> str | None:
    """'running' / 'stopped' / 'starting' / 'stopping', o None si no está instalado.
    No requiere permisos de administrador."""
    try:
        status = win32serviceutil.QueryServiceStatus(SERVICE_NAME)
    except pywintypes.error as e:
        if e.winerror == winerror.ERROR_SERVICE_DOES_NOT_EXIST:
            return None
        raise
    return _STATE_NAMES.get(status[1], "stopped")


def _stop_and_wait(log) -> None:
    try:
        win32serviceutil.StopService(SERVICE_NAME)
    except pywintypes.error as e:
        if e.winerror != winerror.ERROR_SERVICE_NOT_ACTIVE:
            raise
    win32serviceutil.WaitForServiceStatus(SERVICE_NAME, win32service.SERVICE_STOPPED, 30)
    log.info("Servicio detenido.")


def _copy_exe(source: Path, target: Path, log) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    # Recién detenido el servicio, Windows puede tardar un momento en soltar
    # el .exe anterior (el bootloader de PyInstaller y su proceso hijo).
    for attempt in range(10):
        try:
            shutil.copy2(source, target)
            log.info("Ejecutable copiado a %s", target)
            return
        except PermissionError:
            if attempt == 9:
                raise
            time.sleep(1)


def _set_recovery_actions() -> None:
    """Si el proceso del servicio llega a morir, Windows lo vuelve a levantar
    solo (al minuto), en vez de dejarlo detenido hasta el siguiente reinicio."""
    hscm = win32service.OpenSCManager(None, None, win32service.SC_MANAGER_ALL_ACCESS)
    try:
        hs = win32service.OpenService(hscm, SERVICE_NAME, win32service.SERVICE_ALL_ACCESS)
        try:
            restart = (win32service.SC_ACTION_RESTART, 60 * 1000)
            win32service.ChangeServiceConfig2(
                hs,
                win32service.SERVICE_CONFIG_FAILURE_ACTIONS,
                {"ResetPeriod": 24 * 3600, "RebootMsg": None, "Command": None,
                 "Actions": [restart, restart, restart]},
            )
        finally:
            win32service.CloseServiceHandle(hs)
    finally:
        win32service.CloseServiceHandle(hscm)


def get_start_menu_shortcut() -> Path:
    """Menú Inicio de TODOS los usuarios: el servicio es de la máquina, no de
    quien lo instaló, y cualquiera que use la computadora debe poder ver
    cómo va el agente."""
    programs = shell.SHGetFolderPath(0, shellcon.CSIDL_COMMON_PROGRAMS, None, 0)
    return Path(programs) / f"{APP_DISPLAY_NAME}.lnk"


def _create_start_menu_shortcut(exe: Path, log) -> None:
    pythoncom.CoInitialize()
    try:
        link = pythoncom.CoCreateInstance(
            shell.CLSID_ShellLink, None, pythoncom.CLSCTX_INPROC_SERVER, shell.IID_IShellLink
        )
        link.SetPath(str(exe))
        link.SetWorkingDirectory(str(exe.parent))
        link.SetIconLocation(str(exe), 0)
        link.SetDescription("Ver cómo va el agente de DatHua en esta computadora")
        link.QueryInterface(pythoncom.IID_IPersistFile).Save(str(get_start_menu_shortcut()), 0)
    finally:
        pythoncom.CoUninitialize()
    log.info("Acceso directo en el menú Inicio: %s", get_start_menu_shortcut())


def _register_installed_app(exe: Path, log) -> None:
    """Entrada en Configuración → Aplicaciones instaladas (y Panel de control),
    con nuestro ícono y un Desinstalar que abre la confirmación del agente."""
    size_kb = exe.stat().st_size // 1024
    with winreg.CreateKeyEx(winreg.HKEY_LOCAL_MACHINE, UNINSTALL_KEY, 0, winreg.KEY_WRITE) as key:
        for name, value in {
            "DisplayName": APP_DISPLAY_NAME,
            "DisplayVersion": APP_VERSION,
            "Publisher": "DatHua",
            "DisplayIcon": f"{exe},0",
            "InstallLocation": str(exe.parent),
            "UninstallString": f'"{exe}" --uninstall',
        }.items():
            winreg.SetValueEx(key, name, 0, winreg.REG_SZ, value)
        for name, value in {"NoModify": 1, "NoRepair": 1, "EstimatedSize": size_kb}.items():
            winreg.SetValueEx(key, name, 0, winreg.REG_DWORD, value)
    log.info("Registrado en Aplicaciones instaladas.")


def _unregister_app(log) -> None:
    try:
        get_start_menu_shortcut().unlink()
    except FileNotFoundError:
        pass
    try:
        winreg.DeleteKey(winreg.HKEY_LOCAL_MACHINE, UNINSTALL_KEY)
    except FileNotFoundError:
        pass
    log.info("Acceso directo y registro de la aplicación eliminados.")


def _schedule_folder_removal(folders: list[Path]) -> None:
    """
    Un .exe no puede borrarse a sí mismo mientras corre — y este proceso
    elevado ES DathuaAgent.exe (muchas veces el de Program Files), igual
    que la ventana sin elevar que lo lanzó. Se deja un PowerShell oculto,
    ya elevado por heredar el token de este proceso, que reintenta borrar
    las carpetas hasta que esos procesos terminen (máx. ~10 min: la ventana
    abierta desde Program Files mantiene bloqueado el .exe hasta que el
    dueño la cierra).
    """
    quoted = ",".join("'" + str(f).replace("'", "''") + "'" for f in folders)
    script = (
        f"$dirs = @({quoted}); "
        "for ($i = 0; $i -lt 300; $i++) { "
        "$left = @($dirs | Where-Object { Test-Path $_ }); "
        "if ($left.Count -eq 0) { break }; "
        "$left | ForEach-Object { Remove-Item -LiteralPath $_ -Recurse -Force -ErrorAction SilentlyContinue }; "
        "Start-Sleep -Seconds 2 }"
    )
    # Ojo: NO usar DETACHED_PROCESS — sin consola, powershell.exe sale de
    # inmediato sin ejecutar nada (probado en Windows 11). CREATE_NO_WINDOW
    # le da una consola oculta; el grupo propio evita que le lleguen los
    # Ctrl+C/cierre del proceso que lo lanzó.
    flags = subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
    subprocess.Popen(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden",
         "-Command", script],
        creationflags=flags, close_fds=True,
    )


def uninstall_service(log) -> int:
    """
    Detiene y elimina el servicio, borra la configuración (la llave de la
    sucursal) y quita el programa y sus datos de esta computadora. No toca
    nada en DatHua: los equipos y el historial del panel se conservan.
    """
    try:
        state = query_state()
        log.info("Desinstalando (estado previo del servicio: %s).", state)
        if state is not None:
            if state != "stopped":
                _stop_and_wait(log)
            win32serviceutil.RemoveService(SERVICE_NAME)
            log.info("Servicio eliminado.")

        _unregister_app(log)
        agent_config.clear_config()
        status_file.clear_status()
        log.info("Configuración borrada. Desinstalación terminada.")
    except Exception:
        log.exception("Falló la desinstalación.")
        return EXIT_FAILED

    folders = [get_install_dir(), agent_config.get_base_dir()]
    log.info("Se borrarán en unos segundos: %s", ", ".join(str(f) for f in folders))
    # El log vive dentro de una de esas carpetas: se cierra antes para no
    # tener el archivo abierto (y ya no se escribe nada más en él).
    logging.shutdown()
    try:
        _schedule_folder_removal(folders)
    except OSError:
        pass  # el servicio y la llave ya se quitaron; quedan solo archivos
    return EXIT_OK


def install_service(log) -> int:
    if not getattr(sys, "frozen", False):
        # Desde fuentes, sys.executable es python.exe: el SCM lo arrancaría
        # sin el módulo del agente. El servicio real solo existe con el .exe.
        log.error("La instalación del servicio solo funciona desde DathuaAgent.exe.")
        return EXIT_NOT_FROZEN

    try:
        source = Path(sys.executable).resolve()
        target = get_installed_exe()
        state = query_state()
        log.info("Instalando servicio (estado previo: %s, origen: %s).", state, source)

        if state is not None and state != "stopped":
            _stop_and_wait(log)

        if source != target.resolve():
            _copy_exe(source, target, log)

        svc = DathuaAgentService
        if state is None:
            win32serviceutil.InstallService(
                None, SERVICE_NAME, svc._svc_display_name_,
                startType=win32service.SERVICE_AUTO_START,
                exeName=str(target), description=svc._svc_description_,
            )
            log.info("Servicio registrado.")
        else:
            win32serviceutil.ChangeServiceConfig(
                None, SERVICE_NAME,
                startType=win32service.SERVICE_AUTO_START,
                exeName=str(target), displayName=svc._svc_display_name_,
                description=svc._svc_description_,
            )
            log.info("Servicio existente actualizado.")

        _set_recovery_actions()

        # Que el agente se vea como un programa más: se busca en el menú
        # Inicio y aparece en Aplicaciones instaladas. Si esto falla, el
        # servicio igual queda funcionando — no se aborta la instalación.
        try:
            _create_start_menu_shortcut(target, log)
            _register_installed_app(target, log)
        except Exception:
            log.exception("No se pudo crear el acceso directo o el registro de la aplicación.")

        win32serviceutil.StartService(SERVICE_NAME)
        win32serviceutil.WaitForServiceStatus(SERVICE_NAME, win32service.SERVICE_RUNNING, 30)
        log.info("Servicio corriendo.")
        return EXIT_OK
    except Exception:
        log.exception("Falló la instalación del servicio.")
        return EXIT_FAILED
