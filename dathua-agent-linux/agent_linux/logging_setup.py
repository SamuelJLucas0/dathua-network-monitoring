"""
Logging a archivo rotativo (~/.local/share/dathua-agent/logs/agent.log) —
igual que el agente de Windows, más un handler de consola cuando el
proceso corre en primer plano (`run --foreground` o `setup`), ya que aquí
sí es común ver el log directo en la terminal durante el desarrollo/
pruebas. Cuando corre como servicio de systemd, systemd ya captura stdout/
stderr al journal (`journalctl --user -u dathua-agent -f`), así que el
handler de consola no está de más ahí tampoco.
"""
import logging
from logging.handlers import RotatingFileHandler

from agent_linux.config import get_log_dir

_configured = False


def configure(name: str = "dathua_agent", console: bool = True) -> logging.Logger:
    global _configured

    logger = logging.getLogger(name)

    if _configured:
        return logger

    log_dir = get_log_dir()
    log_dir.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

    file_handler = RotatingFileHandler(
        log_dir / "agent.log", maxBytes=2 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    if console:
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    logger.setLevel(logging.INFO)
    _configured = True

    return logger
