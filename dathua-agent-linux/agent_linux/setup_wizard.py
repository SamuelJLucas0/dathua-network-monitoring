"""
Asistente de configuración por terminal — el equivalente en Linux al
asistente gráfico de Windows (gui_configurator.py, con customtkinter).
Aquí no se replicó una GUI a propósito: es más trabajo mantener una
dependencia gráfica (Tk/customtkinter) para lo mismo que un puñado de
`input()` resuelve en una terminal, que es donde de todas formas se va a
instalar/depurar este agente (systemd, journalctl). Si más adelante hace
falta una versión gráfica (por ejemplo, para un dueño de PyME que reciba
una imagen de Linux ya armada), se puede agregar sin tocar el resto del
agente — ver README.md.
"""
from agent_linux import config as agent_config
from agent_linux.api_client import ApiUnreachableError, DathuaApiClient, SiteKeyRevokedError


def _prompt(label: str, default: str | None = None) -> str:
    suffix = f" [{default}]" if default else ""
    while True:
        value = input(f"{label}{suffix}: ").strip()
        if value:
            return value
        if default is not None:
            return default
        print("Este dato es obligatorio.")


def run(api_base_url: str | None = None, api_key: str | None = None) -> bool:
    """
    Sin argumentos pregunta todo por terminal. Con `api_base_url`/`api_key`
    (`setup --url ... --key ...`) no pregunta lo que ya se le dio — así la
    página "Instalar agente" del dashboard puede dar un solo bloque de
    comandos para copiar y pegar, con la llave de esa sucursal incluida.
    """
    print("=== Configuración de DatHua Agent (Linux) ===")

    if not api_base_url or not api_key:
        print("Necesitas la llave de sucursal (Site API Key) — la encuentras en el")
        print("dashboard, en 'Instalar agente' o en Sucursales y zonas.\n")

    existing = agent_config.load_config()
    default_url = existing["apiBaseUrl"] if existing else "http://localhost:3000/api"

    api_base_url = api_base_url or _prompt("URL de la API de DatHua", default_url)
    api_key = api_key or _prompt("Site API Key")

    print("\nValidando la llave contra la API...")
    client = DathuaApiClient(api_base_url, api_key)
    try:
        site, nodes = client.get_active_nodes()
    except SiteKeyRevokedError:
        print("✗ Esa llave no es válida o fue revocada. Revísala e intenta de nuevo.")
        return False
    except ApiUnreachableError as e:
        print(f"✗ No se pudo contactar la API en {api_base_url}: {e}")
        return False

    site_name = site.get("name", "(sin nombre)")
    print(f"✓ Llave válida — sucursal «{site_name}», {len(nodes)} equipo(s) ya dado(s) de alta.")

    agent_config.save_config(api_base_url, api_key, site)
    print(f"\nConfiguración guardada en {agent_config.get_config_path()}.")
    return True
