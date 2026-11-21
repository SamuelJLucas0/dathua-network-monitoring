"""
Definición del Servicio de Windows. Solo se importa en Windows (ver
agent/__main__.py) — este módulo depende de pywin32, que no existe en
Linux y no hace falta para desarrollar/probar el resto del agente ahí.
"""
import sys
import threading

import servicemanager
import win32event
import win32service
import win32serviceutil

from agent.api_client import DathuaApiClient
from agent.config import load_config
from agent.logging_setup import configure
from agent.monitor_service import run_forever
from agent.status_file import StatusFile


class DathuaAgentService(win32serviceutil.ServiceFramework):
    _svc_name_ = "DathuaAgent"
    _svc_display_name_ = "Dathua Network Agent"
    _svc_description_ = (
        "Sonda de conectividad de red de Dathua: hace ping a los dispositivos "
        "registrados de esta sucursal y reporta métricas a la plataforma."
    )
    # Sin esto, pywin32 registra el servicio apuntando a pythonservice.exe
    # (el host genérico que trae la instalación de pywin32 en un entorno de
    # desarrollo) — que no existe dentro del .exe de un solo archivo que
    # arma PyInstaller. Con _exe_name_ = sys.executable, el SCM arranca el
    # propio .exe sin argumentos, y ese caso (len(sys.argv) == 1) ya está
    # manejado en agent/__main__.py para despachar a SvcDoRun.
    _exe_name_ = sys.executable

    def __init__(self, args):
        super().__init__(args)
        # ServiceFramework NO crea este evento por su cuenta — sin esta línea
        # SvcDoRun moría con AttributeError justo después de arrancar los
        # loops (encontrado al correr el servicio por primera vez en Windows).
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        self.stop_event = threading.Event()
        self.monitor_thread = None

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        self.stop_event.set()
        win32event.SetEvent(self.hWaitStop)

    def SvcDoRun(self):
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STARTED,
            (self._svc_name_, ""),
        )

        log = configure()
        config = load_config()

        if not config:
            log.error("No hay configuración guardada. Corre el asistente de instalación primero.")
            self.ReportServiceStatus(win32service.SERVICE_STOPPED)
            return

        client = DathuaApiClient(config["apiBaseUrl"], config["apiKey"])

        self.monitor_thread = threading.Thread(
            target=run_forever, args=(client, self.stop_event, log),
            kwargs={"status": StatusFile()}, daemon=True
        )
        self.monitor_thread.start()

        # Bloquea hasta que SvcStop dispare hWaitStop.
        win32event.WaitForSingleObject(self.hWaitStop, win32event.INFINITE)
