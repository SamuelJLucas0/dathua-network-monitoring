"""
Asistente gráfico de configuración (customtkinter). Reutiliza el flujo del
wizard original (bienvenida -> términos -> llave de sucursal), pero ya NO
corre el loop de monitoreo dentro de sí mismo: un Servicio de Windows en
Sesión 0 no puede mostrar ventanas, así que el trabajo del asistente termina
en "guardar configuración + instalar el servicio elevado", y el servicio es
quien de verdad hace el sondeo en segundo plano.

Si el agente ya estaba configurado o instalado, en vez del asistente se abre
una pantalla de estado (sucursal vinculada, si el servicio está funcionando)
con la opción de reconfigurar — antes, volver a abrir el .exe empezaba el
asistente de cero sin decir nada de lo que ya estaba instalado.
"""
import sys
import threading
import tkinter as tk
from datetime import datetime, timezone
from pathlib import Path

import customtkinter as ctk
import requests

from agent import config as agent_config
from agent import elevate
from agent import service_admin
from agent import status_file
from agent.monitor_service import STATUS_NO_NODES, STATUS_OK

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

# Identidad visual de DatHua (ver CLAUDE.md, sección 3).
ACCENT = "#D96B14"
ACCENT_HOVER = "#B45309"
TEXT_SOFT = "#9CA3AF"
OK_GREEN = "#4ade80"
ERROR_RED = "#ef4444"

SERVICE_STATE_TEXT = {
    "running": ("Funcionando", OK_GREEN),
    "starting": ("Iniciando...", TEXT_SOFT),
    "stopping": ("Deteniéndose...", TEXT_SOFT),
    "stopped": ("Detenido", ERROR_RED),
    None: ("No instalado", ERROR_RED),
}

STATUS_REFRESH_MS = 5000

# El servicio reporta cada ~20 s (POLL_INTERVAL); si lleva más de esto sin
# reportar estando "Funcionando", algo lo tiene atorado.
STALE_REPORT_SECONDS = 3 * 60


def _seconds_since(iso_ts: str | None) -> float | None:
    if not iso_ts:
        return None
    try:
        return (datetime.now(timezone.utc) - datetime.fromisoformat(iso_ts)).total_seconds()
    except ValueError:
        return None


def format_ago(iso_ts: str | None) -> str:
    """'hace 12 segundos' / 'hace 3 minutos' / 'el 24/10 a las 13:05'."""
    seconds = _seconds_since(iso_ts)
    if seconds is None:
        return "Todavía no"
    seconds = max(0, int(seconds))
    if seconds < 60:
        return "hace unos segundos" if seconds < 10 else f"hace {seconds} segundos"
    if seconds < 3600:
        minutes = seconds // 60
        return "hace 1 minuto" if minutes == 1 else f"hace {minutes} minutos"
    local = datetime.fromisoformat(iso_ts).astimezone()
    return local.strftime("el %d/%m a las %H:%M")


def validate_site_key(api_base_url: str, api_key: str):
    """Devuelve (site_dict, None) si la llave es válida, o (None, mensaje_error)."""
    try:
        res = requests.get(
            f"{api_base_url.rstrip('/')}/nodes/worker/active",
            headers={"x-site-key": api_key},
            timeout=5,
        )
    except requests.exceptions.RequestException:
        return None, ("No se pudo conectar con DatHua. Revisa que esta computadora "
                      "tenga internet e inténtalo de nuevo.")

    if res.status_code == 200:
        return res.json().get("site", {}), None

    if res.status_code in (401, 403):
        return None, ("Esa llave no es válida. Cópiala de nuevo desde el panel de DatHua "
                      "(Sucursales y zonas → Ver llave de API).")

    try:
        message = res.json().get("message", "La llave no es válida o no tiene acceso.")
    except ValueError:
        message = "La llave no es válida o no tiene acceso."
    return None, message


def asset_path(name: str) -> Path:
    """assets/ junto al código en desarrollo, o dentro del .exe (PyInstaller
    lo desempaca en sys._MEIPASS; ver datas en DathuaAgent.spec)."""
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
    return base / "assets" / name


class DathuaAgentConfigurator(ctk.CTk):
    def __init__(self, start_screen: str | None = None):
        super().__init__()

        self.title(agent_config.APP_DISPLAY_NAME)
        self.geometry("600x520")
        self.resizable(False, False)
        # Logo de DatHua en la barra de título y en la barra de tareas (sin
        # esto customtkinter pone el suyo). Si el archivo no está, la ventana
        # funciona igual con el ícono por default.
        try:
            self.iconbitmap(str(asset_path("dathua.ico")))
            # PhotoImage de Tk lee PNG sin necesitar Pillow; 96 px / 2 = 48 px.
            self.mark_image = tk.PhotoImage(file=str(asset_path("dathua_mark.png"))).subsample(2)
        except (tk.TclError, OSError):
            self.mark_image = None

        self.view_container = ctk.CTkFrame(self, fg_color="transparent")
        self.view_container.pack(fill="both", expand=True, padx=25, pady=(20, 10))

        self.footer_frame = ctk.CTkFrame(self, height=60, corner_radius=0, fg_color=("#2b2b2b", "#1f1f1f"))

        self.btn_cancel = ctk.CTkButton(
            self.footer_frame, text="Cancelar", width=90, height=32,
            fg_color="gray30", hover_color="gray40", command=self.handle_cancel
        )
        self.btn_cancel.pack(side="right", padx=(10, 20), pady=14)

        self.btn_next = ctk.CTkButton(
            self.footer_frame, text="Siguiente >", width=100, height=32,
            fg_color=ACCENT, hover_color=ACCENT_HOVER, command=self.handle_next_step
        )
        self.btn_next.pack(side="right", padx=10, pady=14)

        self.btn_back = ctk.CTkButton(
            self.footer_frame, text="< Atrás", width=90, height=32,
            fg_color="gray30", hover_color="gray40", command=self.handle_back_step
        )
        self.btn_back.pack(side="right", padx=10, pady=14)

        self.current_step = None
        # True cuando se llegó al paso 3 desde la pantalla de estado
        # ("Reconfigurar"): Atrás/Cancelar regresan a esa pantalla en vez de
        # a los términos, que ya se aceptaron en la primera instalación.
        self.reconfiguring = False
        self.refresh_job = None
        self.installing = False

        installed = agent_config.load_config() or service_admin.query_state() is not None
        if start_screen == "uninstall" and installed:
            self.render_uninstall_confirm()
        elif installed:
            self.render_status()
        else:
            self.render_step_1_welcome()

    def clear_views(self):
        if self.refresh_job:
            self.after_cancel(self.refresh_job)
            self.refresh_job = None
        for widget in self.view_container.winfo_children():
            widget.destroy()

    def show_footer(self, visible: bool):
        if visible:
            self.footer_frame.pack(fill="x", side="bottom")
        else:
            self.footer_frame.pack_forget()

    # ---------------------------------------------------------
    # PANTALLA DE ESTADO (agente ya configurado o instalado)
    # ---------------------------------------------------------
    def render_status(self):
        self.current_step = "status"
        self.reconfiguring = False
        self.clear_views()
        self.show_footer(False)

        header = ctk.CTkFrame(self.view_container, fg_color="transparent")
        header.pack(fill="x", pady=(4, 18))
        if self.mark_image:
            tk.Label(header, image=self.mark_image, bd=0,
                     bg=self._apply_appearance_mode(self.cget("fg_color"))).pack(side="left", padx=(0, 14))
        titles = ctk.CTkFrame(header, fg_color="transparent")
        titles.pack(side="left", fill="x")
        ctk.CTkLabel(
            titles, text=agent_config.APP_DISPLAY_NAME, font=("Segoe UI", 20, "bold")
        ).pack(anchor="w")
        ctk.CTkLabel(
            titles,
            text="Este equipo vigila la red de tu sucursal y le avisa a DatHua.",
            font=("Segoe UI", 12), text_color=TEXT_SOFT
        ).pack(anchor="w")
        ctk.CTkLabel(
            header, text=f"Versión {agent_config.APP_VERSION}",
            font=("Segoe UI", 10), text_color="gray45"
        ).pack(side="right", anchor="n")

        card = ctk.CTkFrame(self.view_container, corner_radius=10)
        card.pack(fill="x")
        card.grid_columnconfigure(1, weight=1)

        self.status_rows = {}
        rows = [("site", "Sucursal"), ("service", "Servicio"), ("last_report", "Último reporte")]
        for row, (key, label) in enumerate(rows):
            ctk.CTkLabel(card, text=label, font=("Segoe UI", 12), text_color=TEXT_SOFT).grid(
                row=row, column=0, sticky="w", padx=(16, 12), pady=8)
            value = ctk.CTkLabel(card, text="", font=("Segoe UI", 13, "bold"), justify="left")
            value.grid(row=row, column=1, sticky="w", padx=(0, 16), pady=8)
            self.status_rows[key] = value

        self.lbl_status_notice = ctk.CTkLabel(
            self.view_container, text="", font=("Segoe UI", 12), justify="left", wraplength=540
        )
        self.lbl_status_notice.pack(anchor="w", pady=(14, 0))

        buttons = ctk.CTkFrame(self.view_container, fg_color="transparent")
        buttons.pack(side="bottom", fill="x", pady=(10, 0))

        ctk.CTkButton(
            buttons, text="Cerrar", width=90, height=34,
            fg_color="gray30", hover_color="gray40", command=self.destroy
        ).pack(side="right")
        ctk.CTkButton(
            buttons, text="Reconfigurar", width=120, height=34,
            fg_color="gray30", hover_color="gray40", command=self.start_reconfigure
        ).pack(side="right", padx=(0, 10))
        self.btn_start_service = ctk.CTkButton(
            buttons, text="Iniciar servicio", width=130, height=34,
            fg_color=ACCENT, hover_color=ACCENT_HOVER, command=self.start_service
        )
        # A la izquierda y sin color: es la acción destructiva, no debe
        # quedar al lado de "Cerrar" donde se pica por accidente.
        ctk.CTkButton(
            buttons, text="Desinstalar", width=100, height=34,
            fg_color="transparent", hover_color="gray25", text_color=TEXT_SOFT,
            border_width=1, border_color="gray30", command=self.render_uninstall_confirm
        ).pack(side="left")

        self.refresh_status()

    def refresh_status(self):
        cfg = agent_config.load_config()
        try:
            state = service_admin.query_state()
        except Exception:
            state = None

        site_name = (cfg or {}).get("site", {}).get("name") if cfg else None
        self.status_rows["site"].configure(text=site_name or "Sin vincular")

        text, color = SERVICE_STATE_TEXT.get(state, SERVICE_STATE_TEXT["stopped"])
        self.status_rows["service"].configure(text=f"● {text}", text_color=color)

        # "Iniciar servicio" solo tiene sentido si hay configuración guardada
        # (sin llave, el servicio se detiene solo al arrancar).
        if cfg and state in ("stopped", None) and not self.installing:
            self.btn_start_service.pack(side="right", padx=(0, 10))
        else:
            self.btn_start_service.pack_forget()

        status = status_file.read_status() or {}
        self.status_rows["last_report"].configure(text=format_ago(status.get("lastReportAt")))

        if not self.installing:
            notice, color = self.status_notice(cfg, state, status)
            self.lbl_status_notice.configure(text=notice, text_color=color)

        self.refresh_job = self.after(STATUS_REFRESH_MS, self.refresh_status)

    @staticmethod
    def status_notice(cfg, state, status: dict):
        """Qué decirle al dueño, de lo más grave a lo más leve."""
        if not cfg:
            return ("Falta vincular este equipo con tu sucursal. "
                    "Presiona Reconfigurar y pega la llave de sucursal."), ERROR_RED
        if state is None:
            return ("El servicio no está instalado, así que no se está vigilando "
                    "la red. Presiona Iniciar servicio."), ERROR_RED
        if state == "stopped":
            return ("El servicio está detenido, así que no se está vigilando la red. "
                    "Presiona Iniciar servicio."), ERROR_RED
        if state != "running" or not status:
            return "El agente está arrancando...", TEXT_SOFT

        reported = status.get("state")
        if reported == STATUS_OK:
            silent_for = _seconds_since(status.get("updatedAt")) or 0
            if silent_for > STALE_REPORT_SECONDS:
                return (f"El agente no ha enviado datos desde {format_ago(status.get('updatedAt'))}. "
                        "Si sigue así, reinicia esta computadora."), ERROR_RED
            return (status.get("message", "") + "\nPuedes cerrar esta ventana: el agente sigue "
                    "trabajando aunque cierres sesión o reinicies."), OK_GREEN
        if reported == STATUS_NO_NODES:
            return status.get("message", ""), ACCENT
        return status.get("message", ""), ERROR_RED

    def start_service(self):
        self.btn_start_service.configure(state="disabled", text="Esperando permiso...")
        self.lbl_status_notice.configure(
            text="Windows te va a pedir permiso de administrador.", text_color=TEXT_SOFT)
        self.run_install(on_done=self.on_start_service_finished)

    def on_start_service_finished(self, outcome: str, detail):
        self.btn_start_service.configure(state="normal", text="Iniciar servicio")
        if outcome != "ok":
            self.lbl_status_notice.configure(text=self.install_error_message(outcome, detail),
                                             text_color=ERROR_RED)
        if self.refresh_job:
            self.after_cancel(self.refresh_job)
        self.refresh_status()

    def start_reconfigure(self):
        self.reconfiguring = True
        self.render_step_3_connection()

    # ---------------------------------------------------------
    # DESINSTALAR
    # ---------------------------------------------------------
    def render_uninstall_confirm(self):
        self.current_step = "uninstall"
        self.clear_views()
        self.show_footer(False)

        ctk.CTkLabel(
            self.view_container, text="¿Quitar DatHua Agent de esta computadora?",
            font=("Segoe UI", 18, "bold")
        ).pack(anchor="w", pady=(10, 15))

        ctk.CTkLabel(
            self.view_container,
            text="Se detiene el agente y se borra de esta computadora, junto con la llave\n"
                 "de tu sucursal. A partir de ese momento DatHua deja de recibir datos de\n"
                 "tu red, y el panel te avisará que el agente dejó de reportar.\n\n"
                 "No se borra nada de tu cuenta: tus equipos y tu historial siguen en el\n"
                 "panel de DatHua. Puedes volver a instalarlo cuando quieras.",
            font=("Segoe UI", 13), justify="left"
        ).pack(anchor="w")

        self.lbl_uninstall_error = ctk.CTkLabel(
            self.view_container, text="", font=("Segoe UI", 12), justify="left", wraplength=540
        )
        self.lbl_uninstall_error.pack(anchor="w", pady=(14, 0))

        buttons = ctk.CTkFrame(self.view_container, fg_color="transparent")
        buttons.pack(side="bottom", fill="x", pady=(10, 0))
        self.btn_uninstall_cancel = ctk.CTkButton(
            buttons, text="Cancelar", width=100, height=34,
            fg_color="gray30", hover_color="gray40", command=self.render_status
        )
        self.btn_uninstall_cancel.pack(side="right")
        self.btn_uninstall = ctk.CTkButton(
            buttons, text="Sí, desinstalar", width=130, height=34,
            fg_color="#b91c1c", hover_color="#991b1b", command=self.do_uninstall
        )
        self.btn_uninstall.pack(side="right", padx=(0, 10))

    def do_uninstall(self):
        self.btn_uninstall.configure(state="disabled", text="Esperando permiso...")
        self.btn_uninstall_cancel.configure(state="disabled")
        self.lbl_uninstall_error.configure(
            text="Windows te va a pedir permiso de administrador.", text_color=TEXT_SOFT)
        self.run_install(on_done=self.on_uninstall_finished, argument="--remove-service")

    def on_uninstall_finished(self, outcome: str, detail):
        if outcome == "ok":
            self.render_uninstalled()
            return

        if outcome == "cancelled":
            message = ("No se dio permiso de administrador, así que no se quitó nada. "
                       "El agente sigue funcionando.")
        else:
            message = ("No se pudo desinstalar. Revisa el registro en "
                       f"{agent_config.get_log_dir()} (código: {detail}).")
        self.lbl_uninstall_error.configure(text=message, text_color=ERROR_RED)
        self.btn_uninstall.configure(state="normal", text="Sí, desinstalar")
        self.btn_uninstall_cancel.configure(state="normal")

    def render_uninstalled(self):
        self.current_step = "uninstalled"
        self.clear_views()
        self.show_footer(False)

        ctk.CTkLabel(
            self.view_container, text="DatHua Agent se desinstaló",
            font=("Segoe UI", 18, "bold")
        ).pack(anchor="w", pady=(10, 15))
        ctk.CTkLabel(
            self.view_container,
            text="El agente ya no está funcionando en esta computadora.\n\n"
                 "Si quieres volver a instalarlo, ejecuta otra vez el instalador\n"
                 "de DatHua Agent y pega la llave de tu sucursal.",
            font=("Segoe UI", 13), justify="left"
        ).pack(anchor="w")
        ctk.CTkButton(
            self.view_container, text="Cerrar", width=100, height=34,
            fg_color=ACCENT, hover_color=ACCENT_HOVER, command=self.destroy
        ).pack(side="bottom", anchor="e")

    # ---------------------------------------------------------
    # PASO 1: BIENVENIDA
    # ---------------------------------------------------------
    def render_step_1_welcome(self):
        self.current_step = 1
        self.clear_views()
        self.show_footer(True)
        self.btn_back.configure(state="disabled")
        self.btn_next.configure(state="normal", text="Siguiente >")

        title = ctk.CTkFrame(self.view_container, fg_color="transparent")
        title.pack(anchor="w", pady=(4, 15))
        if self.mark_image:
            tk.Label(title, image=self.mark_image, bd=0,
                     bg=self._apply_appearance_mode(self.cget("fg_color"))).pack(side="left", padx=(0, 14))
        ctk.CTkLabel(
            title, text="Bienvenido a DatHua Agent", font=("Segoe UI", 18, "bold")
        ).pack(side="left")

        ctk.CTkLabel(
            self.view_container,
            text="Este asistente instala el agente de DatHua en esta computadora.\n"
                 "Queda funcionando por su cuenta, aunque cierres sesión o reinicies.\n\n"
                 "El agente revisa cada pocos segundos que los equipos de tu red\n"
                 "(router, cámaras, computadoras, terminales de cobro) respondan bien,\n"
                 "y le avisa a DatHua para que puedas verlo desde tu panel.\n\n"
                 "Presiona 'Siguiente' para revisar los términos de uso y continuar.",
            font=("Segoe UI", 13), justify="left"
        ).pack(anchor="w", pady=10)

    # ---------------------------------------------------------
    # PASO 2: TÉRMINOS Y CONDICIONES
    # ---------------------------------------------------------
    def render_step_2_terms(self):
        self.current_step = 2
        self.clear_views()
        self.show_footer(True)
        self.btn_back.configure(state="normal")
        self.btn_next.configure(state="disabled", text="Siguiente >")

        ctk.CTkLabel(
            self.view_container, text="Acuerdo de Licencia y Privacidad",
            font=("Segoe UI", 18, "bold")
        ).pack(anchor="w", pady=(5, 10))

        terms_text = (
            "TÉRMINOS Y CONDICIONES DE USO DEL AGENTE DATHUA\n\n"
            "1. ALCANCE DEL MONITOREO:\n"
            "El agente de sonda Dathua ejecuta solicitudes de eco ICMP (Ping) hacia las "
            "direcciones IP que hayas registrado en la plataforma, y adicionalmente hace un "
            "sondeo ligero y periódico de tu red local (ping y consulta de puertos comunes) "
            "para sugerir dispositivos nuevos que podrías querer agregar. Ningún dispositivo "
            "se agrega a tu cuenta sin que tú lo confirmes desde el panel.\n\n"
            "2. PRIVACIDAD DE LOS DATOS:\n"
            "Este software no inspecciona paquetes de datos personales, credenciales de "
            "navegación ni archivos locales. Solo reporta tiempos de ida y vuelta (RTT), "
            "pérdida de paquetes, y evidencia básica de red (IP, MAC, nombre de host, "
            "puertos abiertos) de los dispositivos de tu propia LAN.\n\n"
            "3. OPERACIÓN CONTINUA:\n"
            "El agente se instala como un Servicio de Windows y se mantendrá ejecutando "
            "ciclos de sondeo en segundo plano, incluso sin sesión de usuario iniciada."
        )

        txt_terms = ctk.CTkTextbox(self.view_container, width=540, height=220, font=("Segoe UI", 11))
        txt_terms.pack(pady=5)
        txt_terms.insert("1.0", terms_text)
        txt_terms.configure(state="disabled")

        self.accept_var = ctk.BooleanVar(value=False)
        ctk.CTkCheckBox(
            self.view_container, text="Acepto los términos del acuerdo de licencia",
            variable=self.accept_var, command=self.on_terms_check,
            fg_color=ACCENT, hover_color=ACCENT_HOVER
        ).pack(anchor="w", pady=(15, 0))

    def on_terms_check(self):
        self.btn_next.configure(state="normal" if self.accept_var.get() else "disabled")

    # ---------------------------------------------------------
    # PASO 3: LLAVE DE SUCURSAL (+ dirección de la API, escondida)
    # ---------------------------------------------------------
    def render_step_3_connection(self):
        self.current_step = 3
        self.clear_views()
        self.show_footer(True)
        self.btn_back.configure(state="normal")
        self.btn_next.configure(state="normal", text="Instalar y Conectar")

        ctk.CTkLabel(
            self.view_container, text="Vincula este equipo con tu sucursal",
            font=("Segoe UI", 18, "bold")
        ).pack(anchor="w", pady=(5, 6))

        ctk.CTkLabel(
            self.view_container,
            text="En tu panel de DatHua entra a Sucursales y zonas, abre el menú de tu\n"
                 "sucursal y elige \"Ver llave de API\". Cópiala y pégala aquí.",
            font=("Segoe UI", 12), text_color=TEXT_SOFT, justify="left"
        ).pack(anchor="w", pady=(0, 14))

        ctk.CTkLabel(
            self.view_container, text="Llave de sucursal:", font=("Segoe UI", 12, "bold")
        ).pack(anchor="w", pady=(5, 5))
        self.ent_key = ctk.CTkEntry(
            self.view_container, width=540, height=38,
            placeholder_text="dth_site_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        )
        self.ent_key.pack(pady=(0, 10))

        cfg = agent_config.load_config() or {}
        saved_url = cfg.get("apiBaseUrl")

        # La dirección del servidor no es algo que un dueño de PyME deba
        # entender ni tocar — queda escondida, solo para soporte/pruebas.
        # Se abre sola si la configuración guardada usa una dirección
        # distinta a la de fábrica, para que no se pierda en silencio.
        self.advanced_frame = ctk.CTkFrame(self.view_container, fg_color="transparent")
        ctk.CTkLabel(
            self.advanced_frame, text="Dirección del servidor de DatHua:",
            font=("Segoe UI", 12, "bold")
        ).pack(anchor="w", pady=(0, 5))
        self.ent_api_url = ctk.CTkEntry(self.advanced_frame, width=540, height=34)
        self.ent_api_url.insert(0, saved_url or agent_config.DEFAULT_API_BASE_URL)
        self.ent_api_url.pack()

        self.advanced_visible = False
        self.btn_advanced = ctk.CTkButton(
            self.view_container, text="▸ Opciones avanzadas", width=10, height=24,
            fg_color="transparent", hover_color="gray25", text_color=TEXT_SOFT,
            anchor="w", command=self.toggle_advanced
        )
        self.btn_advanced.pack(anchor="w")
        self.advanced_anchor = ctk.CTkFrame(self.view_container, fg_color="transparent", height=1)
        self.advanced_anchor.pack(fill="x")

        if saved_url and saved_url != agent_config.DEFAULT_API_BASE_URL:
            self.toggle_advanced()

        self.lbl_error = ctk.CTkLabel(
            self.view_container, text="", text_color=ERROR_RED,
            font=("Segoe UI", 11), wraplength=540, justify="left"
        )
        self.lbl_error.pack(anchor="w", pady=(8, 0))

    def toggle_advanced(self):
        self.advanced_visible = not self.advanced_visible
        if self.advanced_visible:
            self.advanced_frame.pack(after=self.advanced_anchor, anchor="w", pady=(6, 0))
            self.btn_advanced.configure(text="▾ Opciones avanzadas")
        else:
            self.advanced_frame.pack_forget()
            self.btn_advanced.configure(text="▸ Opciones avanzadas")

    # ---------------------------------------------------------
    # PASO 4: CONFIRMACIÓN
    # ---------------------------------------------------------
    def render_step_4_done(self, site: dict):
        self.current_step = 4
        self.clear_views()
        self.show_footer(False)

        ctk.CTkLabel(
            self.view_container, text="Listo, el agente ya está funcionando",
            font=("Segoe UI", 18, "bold"), text_color=OK_GREEN
        ).pack(anchor="w", pady=(10, 15))

        ctk.CTkLabel(
            self.view_container,
            text=f"Este equipo quedó vinculado a: {site.get('name', 'tu sucursal')}\n\n"
                 "El agente ya está trabajando en segundo plano y seguirá activo aunque\n"
                 "cierres esta ventana, cierres sesión o reinicies la computadora.\n\n"
                 "En unos minutos verás tus equipos en el panel de DatHua.\n"
                 "Si vuelves a abrir este programa, verás cómo va el agente.",
            font=("Segoe UI", 13), justify="left"
        ).pack(anchor="w", pady=10)

        ctk.CTkButton(
            self.view_container, text="Cerrar", width=100, height=34,
            fg_color=ACCENT, hover_color=ACCENT_HOVER, command=self.destroy
        ).pack(side="bottom", anchor="e")

    def handle_next_step(self):
        if self.current_step == 1:
            self.render_step_2_terms()
        elif self.current_step == 2:
            self.render_step_3_connection()
        elif self.current_step == 3:
            self.finish_setup()

    def handle_back_step(self):
        if self.installing:
            return
        if self.current_step == 2:
            self.render_step_1_welcome()
        elif self.current_step == 3:
            if self.reconfiguring:
                self.render_status()
            else:
                self.render_step_2_terms()

    def handle_cancel(self):
        if self.installing:
            return
        if self.reconfiguring:
            self.render_status()
        else:
            self.destroy()

    def finish_setup(self):
        api_base_url = self.ent_api_url.get().strip()
        api_key = self.ent_key.get().strip()

        if not api_key:
            self.lbl_error.configure(text="Pega la llave de sucursal para continuar.", text_color=ERROR_RED)
            return
        if not api_base_url:
            api_base_url = agent_config.DEFAULT_API_BASE_URL

        self.btn_next.configure(state="disabled", text="Validando...")
        self.lbl_error.configure(text="", text_color=ERROR_RED)
        self.update_idletasks()

        site, error = validate_site_key(api_base_url, api_key)
        if error:
            self.lbl_error.configure(text=error)
            self.btn_next.configure(state="normal", text="Instalar y Conectar")
            return

        # El servicio solo lee la configuración al arrancar: si la
        # instalación no se completa (UAC rechazado, error), se regresa a la
        # anterior para que lo guardado siga coincidiendo con lo que el
        # servicio está usando de verdad.
        self.previous_config = agent_config.load_config()
        try:
            agent_config.save_config(api_base_url, api_key, site)
        except OSError as e:
            self.lbl_error.configure(text=f"No se pudo guardar la configuración: {e}")
            self.btn_next.configure(state="normal", text="Instalar y Conectar")
            return

        self.btn_next.configure(text="Esperando permiso...")
        self.btn_back.configure(state="disabled")
        self.lbl_error.configure(
            text="Windows te va a pedir permiso de administrador para instalar el servicio.",
            text_color=TEXT_SOFT,
        )
        self.run_install(on_done=lambda outcome, detail: self.on_install_finished(site, outcome, detail))

    def run_install(self, on_done, argument: str = "--setup-service"):
        """
        run_elevated bloquea hasta que el dueño responde el UAC y termina la
        instalación (o desinstalación, con `--remove-service`) — en un hilo
        aparte para que la ventana no se congele ("No responde") mientras
        tanto. Tkinter no se puede tocar desde otro hilo, así que el
        resultado regresa vía self.after().
        """
        self.installing = True

        def worker():
            try:
                code = elevate.run_elevated(argument)
                result = ("ok", None) if code == 0 else ("failed", code)
            except elevate.ElevationCancelled:
                result = ("cancelled", None)
            except OSError as e:
                result = ("failed", str(e))
            self.after(0, lambda: self._install_done(on_done, *result))

        threading.Thread(target=worker, daemon=True).start()

    def _install_done(self, on_done, outcome, detail):
        self.installing = False
        on_done(outcome, detail)

    @staticmethod
    def install_error_message(outcome: str, detail) -> str:
        if outcome == "cancelled":
            return ("No se dio permiso de administrador, así que no se hizo ningún cambio. "
                    "Inténtalo otra vez y elige \"Sí\" cuando Windows pregunte.")
        return ("No se pudo instalar el servicio. Revisa el registro en "
                f"{agent_config.get_log_dir()} (código: {detail}).")

    def on_install_finished(self, site: dict, outcome: str, detail):
        if outcome == "ok":
            self.render_step_4_done(site)
            return

        prev = self.previous_config
        try:
            if prev:
                agent_config.save_config(prev["apiBaseUrl"], prev["apiKey"], prev.get("site", {}))
            else:
                agent_config.clear_config()
        except OSError:
            pass

        self.lbl_error.configure(text=self.install_error_message(outcome, detail), text_color=ERROR_RED)
        self.btn_next.configure(state="normal", text="Instalar y Conectar")
        self.btn_back.configure(state="normal")


def run(start_screen: str | None = None):
    app = DathuaAgentConfigurator(start_screen=start_screen)
    app.mainloop()
