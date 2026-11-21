# DatHua Agent — Linux

Agente de monitoreo de red de DatHua para Linux. Es un proyecto **separado**
de `dathua-agent` (el `.exe` de Windows, con GUI de customtkinter y
Servicio de Windows) — mismo protocolo contra `dathua-api`, implementación
distinta porque el modelo de "programa siempre corriendo sin sesión
abierta" se resuelve muy distinto en cada sistema operativo.

Desarrollado y probado primero en **Arch Linux** (systemd, iproute2). El
núcleo (ping ICMP, descubrimiento de red, cliente HTTP) no usa nada
específico de Arch — debería funcionar igual en cualquier distro con
systemd y `ping`/`ip` disponibles (la inmensa mayoría hoy en día). Ver
"Generalizar más adelante" al final.

## Por qué es un proyecto aparte de `dathua-agent`

- El Servicio de Windows (`winservice.py`, pywin32) y la GUI
  (`gui_configurator.py`, customtkinter) no tienen sentido en Linux.
- El equivalente funcional de "corre siempre, sin depender de que alguien
  inicie sesión" en Linux es un servicio de **usuario** de systemd +
  `loginctl enable-linger` — un mecanismo completamente distinto al
  Service Control Manager de Windows.
- Los módulos que SÍ son 100% portables (`ping_engine.py`, `discovery.py`,
  `api_client.py`, `monitor_service.py`) están duplicados aquí tal cual,
  no importados desde `dathua-agent`, porque hoy son dos paquetes Python
  independientes sin instalación empaquetada compartida. Si esto empieza a
  generar deriva entre los dos (un fix en uno que se olvida en el otro),
  el siguiente paso es extraerlos a un tercer paquete
  (`dathua-agent-core`) del que ambos agentes importen — ver sección de
  generalización.

## Requisitos

- Python 3.11+ (probado con 3.14).
- `systemd` (para el modo servicio — Arch lo trae de fábrica).
- `ping` e `ip` (iproute2) en el `PATH` — ambos vienen preinstalados en
  Arch. **No** se usa `arp -a` (net-tools), que Arch ya no instala por
  default.
- **No requiere root** en ningún paso: ni para pinguear (Arch permite
  sockets ICMP sin privilegios por default), ni para instalar el servicio
  (es un servicio de *usuario*, no de sistema).

## Instalación y primer arranque

```bash
cd dathua-agent-linux
python -m venv .venv
./.venv/bin/pip install -r requirements.txt

# Asistente interactivo: pide la Site API Key (la ves en el dashboard, en
# Sucursales y zonas o en el aviso "Instala el agente"), valida contra la
# API real y guarda la configuración en ~/.config/dathua-agent/config.json
./.venv/bin/python -m agent_linux setup
```

El asistente te pregunta al final si quieres instalarlo como servicio.
También puedes hacerlo por separado en cualquier momento:

```bash
./.venv/bin/python -m agent_linux install     # instala + arranca + habilita linger
journalctl --user -u dathua-agent.service -f  # ver logs en vivo
./.venv/bin/python -m agent_linux status      # config + estado del servicio
./.venv/bin/python -m agent_linux uninstall   # detiene y quita el servicio
```

Para probar sin instalar nada como servicio (útil mientras se desarrolla):

```bash
./.venv/bin/python -m agent_linux run   # primer plano, Ctrl+C para parar
```

## Qué hace, en corto

Cada `POLL_INTERVAL` (20s por defecto, `agent_linux/config.py`):
1. Pide a `dathua-api` (`GET /nodes/worker/active`, autenticado con la
   Site API Key vía header `x-site-key`) la lista de equipos que le tocan
   a esta sucursal.
2. Les hace ping ICMP real (`ping_engine.py`) y manda el resultado
   (`POST /telemetry/report`).

Cada `DISCOVERY_INTERVAL` (30 min por defecto), en un hilo aparte:
1. Hace un ping-sweep del /24 local para poblar la tabla de vecinos del
   kernel, la lee con `ip neigh show`, resuelve hostname y sondea puertos
   comunes de cada IP nueva (`discovery.py`).
2. Manda los candidatos a `POST /discovery/candidates` para que el dueño
   los apruebe/rechace desde el dashboard.

Ambos hilos manejan por separado una Site API Key revocada (backoff de 5
min, no requiere reinstalar nada si se reactiva) y la API caída
(reintentos con backoff) — ver `monitor_service.py`.

## Dudas conocidas / decisiones tomadas para esta primera versión

- **Servicio de usuario, no de sistema.** Se decidió así para no requerir
  sudo/root en ningún paso de instalación (ver arriba). El costo es que
  depende de `loginctl enable-linger`, que en algunas configuraciones
  restrictivas de PAM/polkit podría no estar permitido para el usuario
  sin intervención de un administrador — `install` avisa explícitamente
  si linger no se pudo activar, en vez de fallar en silencio.
- **Sin GUI.** A diferencia del agente de Windows, aquí el "asistente" es
  de terminal. Si en algún momento se necesita una versión gráfica (por
  ejemplo, para distribuir una imagen de Linux ya armada a un cliente sin
  conocimientos de terminal), se puede agregar como un módulo más sin
  tocar el resto — la lógica de configuración ya está separada de la
  interfaz (`setup_wizard.py` solo llama a `config.py`/`api_client.py`).
- **Sin capa SNMP**, igual que el agente de Windows — sigue fuera de
  alcance por ahora.

Si en el camino aparece alguna decisión de diseño que no esté cubierta
aquí, se documenta en este README en vez de asumir en silencio.

## Generalizar más adelante

Este agente se desarrolló primero contra Arch Linux porque es la máquina
disponible para probarlo de verdad end-to-end. Nada de lo que usa es
específico de Arch — es specíficamente Arch solo en el sentido de "es
donde se probó primero", no en el de "solo funciona ahí". Pendiente para
generalizar a otras distros:

- **Empaquetado real**: hoy `install` apunta el `.service` directo al
  intérprete y checkout actuales (ver `service.py`). Para distribuir a
  clientes reales, el siguiente paso natural es un paquete instalable de
  verdad — ya sea `pip install dathua-agent-linux` (con un entry point de
  consola) o, siguiendo el mismo patrón que el `.exe` de Windows
  (PyInstaller), un binario Linux de un solo archivo (PyInstaller también
  soporta ELF de Linux, no solo `.exe`).
- **Detección de gestor de paquetes/init sin systemd**: distros sin
  systemd (Alpine con OpenRC, por ejemplo) necesitarían un `service.py`
  alterno. No es el caso de ninguna distro mayor de escritorio/servidor
  hoy (Ubuntu, Debian, Fedora, Arch, openSUSE... todas usan systemd), así
  que se pospuso a propósito.
- **Servicio de sistema como alternativa**: para el caso de una máquina
  compartida por varias cuentas, o un dueño que prefiera no activar
  linger en su usuario — mismo `UNIT_TEMPLATE`, solo cambiaría a
  `systemctl` (sin `--user`) y la ruta de instalación del `.service`.
- **Empujar los módulos portables a un paquete común** con
  `dathua-agent` (Windows) si la duplicación empieza a doler de verdad
  (ver sección de arriba).
