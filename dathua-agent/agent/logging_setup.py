"""
Logging a archivo rotativo. El Servicio de Windows no tiene consola, así que
imprimir a stdout no sirve para diagnosticar nada en campo — todo lo que
importa tiene que quedar en el log de %PROGRAMDATA%\\DathuaAgent\\logs.
"""
import logging
from logging.handlers import RotatingFileHandler

from agent.config import get_log_dir

_configured = False


def configure(name: str = "dathua_agent") -> logging.Logger:
    global _configured

    logger = logging.getLogger(name)

    if _configured:
        return logger

    log_dir = get_log_dir()
    log_dir.mkdir(parents=True, exist_ok=True)

    handler = RotatingFileHandler(
        log_dir / "agent.log", maxBytes=2 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))

    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    _configured = True

    return logger
