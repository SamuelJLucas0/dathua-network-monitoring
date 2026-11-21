import platform
import time

import pytest

pytestmark = pytest.mark.skipif(platform.system() != "Windows", reason="usa pywin32 y powershell.exe")


def test_schedule_folder_removal_really_deletes(tmp_path):
    """
    Regresión: con DETACHED_PROCESS, powershell.exe salía sin ejecutar nada
    y la desinstalación dejaba Program Files y ProgramData intactos.
    """
    from agent import service_admin

    target = tmp_path / "Dathua Agent's"  # espacio y comilla: el script debe escaparlos
    (target / "logs").mkdir(parents=True)
    (target / "logs" / "agent.log").write_text("x", encoding="utf-8")

    service_admin._schedule_folder_removal([target])

    deadline = time.time() + 20
    while target.exists() and time.time() < deadline:
        time.sleep(0.5)
    assert not target.exists()
