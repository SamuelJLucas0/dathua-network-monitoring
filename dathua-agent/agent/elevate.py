"""
Instalar un Servicio de Windows requiere permisos de administrador. El
asistente de configuración (gui_configurator.py) corre sin elevar, y al
terminar dispara este helper para relanzar el propio ejecutable con
"runas" — Windows muestra el prompt de UAC estándar; no se pide ni se
maneja ninguna contraseña directamente.

Antes se usaba ShellExecuteW sin esperar ni revisar nada: si el dueño
rechazaba el UAC o la instalación fallaba, el asistente igual decía
"Servicio instalado correctamente". Ahora se usa ShellExecuteExW para
obtener el proceso elevado, esperarlo y leer su código de salida.
"""
import ctypes
import sys
from ctypes import wintypes

SEE_MASK_NOCLOSEPROCESS = 0x00000040
ERROR_CANCELLED = 1223
INFINITE = 0xFFFFFFFF


class _SHELLEXECUTEINFOW(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.DWORD),
        ("fMask", ctypes.c_ulong),
        ("hwnd", wintypes.HWND),
        ("lpVerb", wintypes.LPCWSTR),
        ("lpFile", wintypes.LPCWSTR),
        ("lpParameters", wintypes.LPCWSTR),
        ("lpDirectory", wintypes.LPCWSTR),
        ("nShow", ctypes.c_int),
        ("hInstApp", wintypes.HINSTANCE),
        ("lpIDList", ctypes.c_void_p),
        ("lpClass", wintypes.LPCWSTR),
        ("hkeyClass", wintypes.HKEY),
        ("dwHotKey", wintypes.DWORD),
        ("hIconOrMonitor", wintypes.HANDLE),
        ("hProcess", wintypes.HANDLE),
    ]


class ElevationCancelled(Exception):
    """El dueño respondió "No" en el prompt de UAC."""


def run_elevated(argument: str) -> int:
    """
    Relanza este mismo .exe como administrador con `argument` y espera a que
    termine. Devuelve su código de salida; lanza ElevationCancelled si el
    UAC se rechazó, u OSError si Windows no pudo lanzarlo.

    Bloquea: llamarlo desde un hilo aparte, no desde el hilo de la ventana.
    """
    # ShellExecuteExW ya arma argv[0] = exe al lanzarlo — pasar sys.argv[0]
    # de nuevo en lpParameters duplicaba la ruta del ejecutable como argv[1]
    # y agent/__main__.py nunca veía el flag.
    info = _SHELLEXECUTEINFOW()
    info.cbSize = ctypes.sizeof(info)
    info.fMask = SEE_MASK_NOCLOSEPROCESS
    info.lpVerb = "runas"
    info.lpFile = sys.executable
    info.lpParameters = argument
    info.nShow = 0  # SW_HIDE — el .exe no tiene consola de todos modos

    shell32 = ctypes.WinDLL("shell32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

    if not shell32.ShellExecuteExW(ctypes.byref(info)):
        err = ctypes.get_last_error()
        if err == ERROR_CANCELLED:
            raise ElevationCancelled()
        raise ctypes.WinError(err)

    try:
        kernel32.WaitForSingleObject(info.hProcess, INFINITE)
        code = wintypes.DWORD()
        kernel32.GetExitCodeProcess(info.hProcess, ctypes.byref(code))
        return code.value
    finally:
        kernel32.CloseHandle(info.hProcess)
