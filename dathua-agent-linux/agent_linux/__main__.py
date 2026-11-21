"""
Punto de entrada de la CLI: `python -m agent_linux <comando>`.

Comandos:
  setup       Asistente — pide la Site API Key y la valida. Con
              --url/--key/--install no pregunta nada (para copiar y pegar
              desde la página "Instalar agente" del dashboard).
  run         Corre el loop de monitoreo en primer plano (Ctrl+C detiene).
              Es lo que ejecuta el servicio de systemd por debajo.
  install     Instala y arranca el servicio de usuario de systemd.
  uninstall   Detiene y quita el servicio ([--purge] borra también la config).
  status      Muestra la config activa (sin exponer la llave completa) y el
              estado del servicio de systemd, si está instalado.
  reset       Borra la configuración guardada (no toca el servicio).
"""
import argparse
import sys
import threading


def cmd_setup(args) -> int:
    from agent_linux.setup_wizard import run as run_wizard
    ok = run_wizard(api_base_url=args.url, api_key=args.key)
    if not ok:
        return 1

    from agent_linux import service
    if service.systemd_available():
        if args.install:
            return cmd_install(args)
        answer = input("\n¿Instalar y arrancar el agente como servicio ahora? [S/n]: ").strip().lower()
        if answer in ("", "s", "si", "sí", "y", "yes"):
            return cmd_install(args)
    print("\nListo. Corre 'python -m agent_linux run' para probarlo en primer plano,")
    print("o 'python -m agent_linux install' cuando quieras dejarlo corriendo solo.")
    return 0


def cmd_run(_args) -> int:
    from agent_linux import config as agent_config
    from agent_linux.api_client import DathuaApiClient
    from agent_linux.logging_setup import configure
    from agent_linux.monitor_service import run_forever

    cfg = agent_config.load_config()
    if not cfg:
        print(f"No hay configuración en {agent_config.get_config_path()}.")
        print("Corre primero: python -m agent_linux setup")
        return 1

    log = configure()
    client = DathuaApiClient(cfg["apiBaseUrl"], cfg["apiKey"])
    stop_event = threading.Event()

    try:
        run_forever(client, stop_event, log)
    except KeyboardInterrupt:
        stop_event.set()
        log.info("Detenido por el usuario (Ctrl+C).")
    return 0


def cmd_install(_args) -> int:
    from agent_linux import config as agent_config
    from agent_linux import service

    if not agent_config.load_config():
        print("No hay configuración todavía — corre primero: python -m agent_linux setup")
        return 1

    if not service.systemd_available():
        print("Este sistema no tiene systemd (systemctl no encontrado).")
        print("Corre el agente manualmente en su lugar: python -m agent_linux run")
        return 1

    for line in service.install():
        print(f"- {line}")
    print(f"\nVer logs en vivo con: journalctl --user -u {service.SERVICE_NAME} -f")
    return 0


def cmd_uninstall(args) -> int:
    from agent_linux import service
    for line in service.uninstall(purge_config=args.purge):
        print(f"- {line}")
    return 0


def cmd_status(_args) -> int:
    from agent_linux import config as agent_config
    from agent_linux import service

    cfg = agent_config.load_config()
    if not cfg:
        print(f"Sin configurar (no existe {agent_config.get_config_path()}).")
    else:
        key = cfg["apiKey"]
        masked = key[:4] + "…" + key[-4:] if len(key) > 8 else "••••"
        site_name = cfg.get("site", {}).get("name", "(desconocida)")
        print(f"Configurado — sucursal «{site_name}», API: {cfg['apiBaseUrl']}, llave: {masked}")

    if service.is_installed():
        print(f"\nServicio instalado en {service.unit_path()}:\n")
        print(service.status_text())
    else:
        print("\nServicio de systemd no instalado (corre 'install' para dejarlo corriendo solo).")
    return 0


def cmd_reset(_args) -> int:
    from agent_linux import config as agent_config
    agent_config.clear_config()
    print("Configuración eliminada.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="dathua-agent-linux", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p_setup = sub.add_parser("setup", help="Asistente de configuración (interactivo, o con --url/--key)")
    p_setup.add_argument("--url", help="Dirección de la API de DatHua (no la pregunta)")
    p_setup.add_argument("--key", help="Llave de la sucursal (no la pregunta)")
    p_setup.add_argument("--install", action="store_true",
                         help="Instala y arranca el servicio al terminar, sin preguntar")
    p_setup.set_defaults(func=cmd_setup)
    sub.add_parser("run", help="Corre el monitoreo en primer plano").set_defaults(func=cmd_run)
    sub.add_parser("install", help="Instala el servicio de systemd (usuario)").set_defaults(func=cmd_install)

    p_uninstall = sub.add_parser("uninstall", help="Quita el servicio de systemd")
    p_uninstall.add_argument("--purge", action="store_true", help="Borra también la configuración guardada")
    p_uninstall.set_defaults(func=cmd_uninstall)

    sub.add_parser("status", help="Muestra config + estado del servicio").set_defaults(func=cmd_status)
    sub.add_parser("reset", help="Borra la configuración guardada").set_defaults(func=cmd_reset)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
