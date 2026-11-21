"""
Punto de entrada del ejecutable. Un solo .exe dual-modo (el usuario final
solo descarga un archivo):

- Si Windows lo arranca como servicio (Service Control Manager), corre
  como Servicio de Windows.
- Si un humano le da doble clic, `StartServiceCtrlDispatcher()` falla con
  ERROR_FAILED_SERVICE_CONTROLLER_CONNECT (truco estándar de pywin32 para
  distinguir ambos casos) y en su lugar se abre el asistente gráfico.
- `--setup-service` es invocado por agent.elevate ya con permisos de
  administrador, para instalar y arrancar el servicio (ver
  agent/service_admin.py). Su código de salida le dice al asistente si
  funcionó. `--remove-service` es lo mismo para desinstalar; `--uninstall`
  (el que registra Aplicaciones instaladas) abre la confirmación en la GUI.
- Cualquier otro argumento (install/remove/start/stop/debug) se delega a
  win32serviceutil.HandleCommandLine, el mecanismo estándar de pywin32.

En este equipo de desarrollo (Linux) no existe Servicio de Windows ni
pywin32, así que aquí solo se soporta `python -m agent --debug`, que corre
el mismo loop de monitoreo en primer plano — útil para probar la lógica
real sin necesitar Windows.
"""
import platform
import sys


def main():
    if platform.system() != "Windows":
        _run_posix_debug_mode()
        return

    import servicemanager
    import win32service
    import win32serviceutil
    import winerror

    from agent.winservice import DathuaAgentService

    if len(sys.argv) == 1:
        try:
            servicemanager.Initialize()
            servicemanager.PrepareToHostSingle(DathuaAgentService)
            servicemanager.StartServiceCtrlDispatcher()
        except win32service.error as details:
            if details.winerror == winerror.ERROR_FAILED_SERVICE_CONTROLLER_CONNECT:
                from agent.gui_configurator import run as run_gui
                run_gui()
            else:
                raise
    elif sys.argv[1] == "--setup-service":
        from agent import service_admin
        from agent.logging_setup import configure

        sys.exit(service_admin.install_service(configure()))
    elif sys.argv[1] == "--uninstall":
        # Lo que ejecuta Windows al presionar "Desinstalar" en Aplicaciones
        # instaladas (UninstallString): abre la ventana directo en la
        # confirmación, que a su vez pide el UAC para --remove-service.
        from agent.gui_configurator import run as run_gui
        run_gui(start_screen="uninstall")
    elif sys.argv[1] == "--remove-service":
        from agent import service_admin
        from agent.logging_setup import configure

        sys.exit(service_admin.uninstall_service(configure()))
    else:
        win32serviceutil.HandleCommandLine(DathuaAgentService)


def _run_posix_debug_mode():
    if "--debug" not in sys.argv:
        print("Build de Windows. En este equipo solo se soporta:")
        print("  python -m agent --debug     (corre el loop de monitoreo en primer plano)")
        sys.exit(1)

    import threading

    from agent import config as agent_config
    from agent.api_client import DathuaApiClient
    from agent.logging_setup import configure
    from agent.monitor_service import run_forever

    log = configure()
    cfg = agent_config.load_config()
    if not cfg:
        print(f"No hay configuración en {agent_config.get_config_path()}.")
        print('Crea ese archivo con {"apiBaseUrl": "...", "apiKey": "...", "site": {...}}')
        sys.exit(1)

    client = DathuaApiClient(cfg["apiBaseUrl"], cfg["apiKey"])
    stop_event = threading.Event()

    try:
        run_forever(client, stop_event, log)
    except KeyboardInterrupt:
        stop_event.set()


if __name__ == "__main__":
    main()
