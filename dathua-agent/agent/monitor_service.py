"""
Loop principal de monitoreo, agnóstico de sistema operativo. Tanto el
Servicio de Windows (winservice.py) como el modo de depuración en primer
plano (__main__.py --debug, útil para probar en Linux) llaman a
run_forever() — no hay lógica de loop duplicada entre ambos modos.
"""
import threading
import time

from agent.api_client import ApiUnreachableError, SiteKeyRevokedError
from agent.config import DISCOVERY_INTERVAL, PING_COUNT, POLL_INTERVAL
from agent.discovery import run_discovery_cycle
from agent.ping_engine import ping_node

SITE_KEY_REVOKED_BACKOFF = 300  # 5 min
UNREACHABLE_BACKOFF = 30
RESCAN_POLL_INTERVAL = 10  # segundos entre chequeos de "¿pidieron re-escanear desde el dashboard?"

# Estados que se reportan a `status` (ver monitoring_loop).
STATUS_OK = "ok"
STATUS_NO_NODES = "no_nodes"
STATUS_KEY_REVOKED = "key_revoked"
STATUS_API_UNREACHABLE = "api_unreachable"
STATUS_ERROR = "error"


def _notify(status, log, state: str, **info) -> None:
    """Avisa el estado de esta vuelta del loop; nunca debe tumbar el monitoreo."""
    if status is None:
        return
    try:
        status(state, **info)
    except Exception:
        log.exception("No se pudo registrar el estado del agente.")


def monitoring_loop(client, stop_event: threading.Event, log, status=None) -> None:
    """
    `status` (opcional) se llama en cada vuelta con uno de los STATUS_* — así
    quien corre el loop puede mostrarle al dueño qué está pasando sin leer
    el log. El servicio de Windows lo usa para escribir status.json, que lee
    la pantalla de estado del asistente: un servicio en sesión 0 no puede
    mostrar ventanas, así que una llave revocada pasaba desapercibida.
    """
    log.info("Loop de monitoreo ICMP iniciado.")

    while not stop_event.is_set():
        loop_start = time.time()

        try:
            site, nodes = client.get_active_nodes()
        except SiteKeyRevokedError:
            log.error(
                "Site API Key revocada o inválida. El servicio sigue corriendo y "
                "reintentará en %s s (no requiere reinicio si se reactiva la key).",
                SITE_KEY_REVOKED_BACKOFF,
            )
            _notify(status, log, STATUS_KEY_REVOKED)
            stop_event.wait(SITE_KEY_REVOKED_BACKOFF)
            continue
        except ApiUnreachableError as e:
            log.warning("API inalcanzable (%s). Reintentando en %s s.", e, UNREACHABLE_BACKOFF)
            _notify(status, log, STATUS_API_UNREACHABLE)
            stop_event.wait(UNREACHABLE_BACKOFF)
            continue
        except Exception:
            log.exception("Error inesperado consultando nodos activos.")
            _notify(status, log, STATUS_ERROR)
            stop_event.wait(UNREACHABLE_BACKOFF)
            continue

        if not nodes:
            log.info("Sin nodos asignados a esta sucursal todavía.")
            _notify(status, log, STATUS_NO_NODES, site=site)
        else:
            try:
                org_id = site.get("orgId")
                metrics = [ping_node(node, org_id, count=PING_COUNT) for node in nodes]
                result = client.report_telemetry(metrics)
                log.info(
                    "Telemetría enviada: %s aceptadas, %s rechazadas.",
                    result.get("insertedCount"), result.get("rejectedCount", 0),
                )
                _notify(status, log, STATUS_OK, site=site, nodeCount=len(nodes))
            except SiteKeyRevokedError as e:
                log.warning("No se pudo enviar telemetría: %s", e)
                _notify(status, log, STATUS_KEY_REVOKED)
            except ApiUnreachableError as e:
                log.warning("No se pudo enviar telemetría: %s", e)
                _notify(status, log, STATUS_API_UNREACHABLE)
            except Exception:
                # Antes de esto, cualquier excepción no prevista aquí (p.ej.
                # un campo inesperado en la respuesta de la API) tumbaba el
                # hilo de monitoreo para siempre sin dejar rastro en el log
                # — el servicio seguía "Running" pero sin volver a pingar ni
                # reportar nada.
                log.exception("Error inesperado pingueando/reportando nodos.")
                _notify(status, log, STATUS_ERROR)

        elapsed = time.time() - loop_start
        stop_event.wait(max(0.0, POLL_INTERVAL - elapsed))

    log.info("Loop de monitoreo detenido.")


def discovery_loop(client, stop_event: threading.Event, log) -> None:
    log.info(
        "Loop de descubrimiento de red iniciado (cada %s s, o antes si se pide "
        "un re-escaneo manual desde el dashboard).",
        DISCOVERY_INTERVAL,
    )

    # True hasta el primer envío exitoso de esta corrida del agente — le
    # dice a la API "este es el arranque del proceso". La API lo usa para
    # devolver a 'pending' los candidatos que el dueño ya había rechazado
    # antes, pero solo una vez por arranque: mientras el agente sigue
    # corriendo sin interrupciones, un dispositivo rechazado no debe
    # "resucitar" solo porque el ciclo de escaneo lo vuelve a ver.
    is_first_scan = True

    # `last_scan_at = 0` fuerza un escaneo en la primera vuelta del loop, en
    # vez de esperar el DISCOVERY_INTERVAL completo antes del primer aviso.
    last_scan_at = 0.0
    # Último valor de `rescanRequestedAt` ya procesado — si cambia (botón
    # "Re-escanear" en Nodos y topología, ver requestSiteRescan en
    # siteController.js) se adelanta el escaneo sin esperar el intervalo
    # normal. Se revisa cada RESCAN_POLL_INTERVAL en vez de cada
    # DISCOVERY_INTERVAL para que el botón se sienta casi inmediato.
    last_seen_rescan_flag = None

    while not stop_event.is_set():
        try:
            site, nodes = client.get_active_nodes()
            rescan_flag = site.get("rescanRequestedAt")
            manual_rescan_pending = rescan_flag is not None and rescan_flag != last_seen_rescan_flag
            scheduled_scan_due = (time.time() - last_scan_at) >= DISCOVERY_INTERVAL

            if scheduled_scan_due or manual_rescan_pending:
                if manual_rescan_pending and not scheduled_scan_due:
                    log.info("Re-escaneo manual solicitado desde el dashboard.")

                known_ips = {n["ipAddress"] for n in nodes}
                candidates = run_discovery_cycle(known_ips)

                # Un re-escaneo manual siempre reporta, aunque no haya
                # encontrado nada — el dashboard necesita esa confirmación
                # para apagar su animación de carga y avisar "no se
                # encontró nada" (ver discoveryController.js). Un ciclo
                # automático de fondo, en cambio, se queda callado si no
                # hay candidatos, para no generarle tráfico de más a la API.
                if candidates or manual_rescan_pending:
                    # Un re-escaneo manual es un "vuelve a mirar" explícito
                    # del dueño, no un ciclo automático de fondo — se trata
                    # igual que el arranque de una corrida nueva del agente
                    # para efectos de la API: los candidatos que ya estaban
                    # rechazados sí pueden volver a 'pending' aquí (ver
                    # discoveryController.js), aunque el proceso del agente
                    # nunca se haya reiniciado.
                    client.submit_discovery_candidates(
                        candidates, session_start=(is_first_scan or manual_rescan_pending)
                    )
                    if candidates:
                        log.info(
                            "Descubrimiento: %s dispositivo(s) nuevo(s) reportado(s) como candidatos.",
                            len(candidates),
                        )
                    else:
                        log.info("Re-escaneo manual: no se encontraron equipos nuevos en la red.")
                    is_first_scan = False

                last_scan_at = time.time()
                last_seen_rescan_flag = rescan_flag
        except SiteKeyRevokedError:
            pass  # el loop de ping ya está reportando/esperando la reconexión
        except ApiUnreachableError as e:
            log.warning("Descubrimiento: API inalcanzable (%s).", e)
        except Exception:
            log.exception("Error inesperado en el ciclo de descubrimiento.")

        stop_event.wait(RESCAN_POLL_INTERVAL)

    log.info("Loop de descubrimiento detenido.")


def run_forever(client, stop_event: threading.Event, log, status=None) -> None:
    discovery_thread = threading.Thread(
        target=discovery_loop, args=(client, stop_event, log), daemon=True
    )
    discovery_thread.start()

    monitoring_loop(client, stop_event, log, status=status)
