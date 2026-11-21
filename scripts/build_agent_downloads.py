"""
Publica los agentes en el dashboard, para la página "Instalar agente":

    python scripts/build_agent_downloads.py

Deja en dathua-front/public/downloads/ (Vite lo sirve tal cual en
/downloads/...):
- DathuaAgent.exe            copia de dathua-agent/dist/DathuaAgent.exe
                             (compilarlo antes en Windows con el .spec; si
                             no existe, se conserva el que ya estaba)
- dathua-agent-linux.tar.gz  los archivos versionados de dathua-agent-linux
                             (sin pruebas), dentro de una carpeta
                             `dathua-agent/`, con saltos de línea LF
- agents.json                versión, tamaño y SHA-256 de cada uno — el
                             dashboard lo lee para mostrar el botón de
                             descarga solo si el archivo existe

Solo usa la biblioteca estándar: corre igual en Windows y en Linux.
"""
import hashlib
import io
import json
import re
import shutil
import subprocess
import tarfile
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dathua-front" / "public" / "downloads"
WINDOWS_EXE = ROOT / "dathua-agent" / "dist" / "DathuaAgent.exe"
LINUX_DIR = ROOT / "dathua-agent-linux"
LINUX_TARBALL = "dathua-agent-linux.tar.gz"
TEXT_SUFFIXES = {".py", ".txt", ".md", ".example", ".service", ".cfg", ".ini", ".toml", ""}


def agent_version() -> str:
    text = (ROOT / "dathua-agent" / "agent" / "config.py").read_text(encoding="utf-8")
    return re.search(r'APP_VERSION\s*=\s*"([^"]+)"', text).group(1)


def file_info(path: Path) -> dict:
    data = path.read_bytes()
    return {
        "file": path.name,
        "sizeBytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "updatedAt": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(timespec="seconds"),
    }


def build_linux_tarball(dest: Path) -> None:
    files = subprocess.run(
        ["git", "ls-files", "--", "."], cwd=LINUX_DIR, capture_output=True, text=True, check=True
    ).stdout.split()
    files = [f for f in files if not f.startswith("tests/")]

    now = int(time.time())
    with tarfile.open(dest, "w:gz") as tar:
        for rel in sorted(files):
            data = (LINUX_DIR / rel).read_bytes()
            # En una copia de Windows con core.autocrlf los archivos tienen
            # CRLF; en Linux eso rompe scripts y ensucia diffs.
            if Path(rel).suffix in TEXT_SUFFIXES:
                data = data.replace(b"\r\n", b"\n")
            info = tarfile.TarInfo(f"dathua-agent/{rel}")
            info.size = len(data)
            info.mode = 0o644
            info.mtime = now
            tar.addfile(info, io.BytesIO(data))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    exe_out = OUT / "DathuaAgent.exe"
    if WINDOWS_EXE.exists():
        shutil.copy2(WINDOWS_EXE, exe_out)
        print(f"Windows: copiado {WINDOWS_EXE}")
    elif exe_out.exists():
        print("Windows: no hay dist/DathuaAgent.exe aquí; se conserva el publicado.")
    else:
        print("Windows: no hay .exe que publicar (compílalo en Windows con DathuaAgent.spec).")

    tar_out = OUT / LINUX_TARBALL
    build_linux_tarball(tar_out)
    print(f"Linux: generado {tar_out}")

    manifest = {
        "version": agent_version(),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "windows": file_info(exe_out) if exe_out.exists() else None,
        "linux": file_info(tar_out),
    }
    (OUT / "agents.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
