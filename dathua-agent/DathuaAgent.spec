# -*- mode: python ; coding: utf-8 -*-
# El .exe solo se puede compilar en Windows (PyInstaller no cruza de Linux a
# Windows): en una máquina Windows con Python 3.11 o en el runner
# windows-latest de .github/workflows/agent-build.yml.
#   pyinstaller --clean DathuaAgent.spec   ->  dist\DathuaAgent.exe
# pysnmp no necesita nada aquí: pyinstaller-hooks-contrib trae
# hook-pysnmp.py, que empaqueta sus MIBs (comprobado con un binario real).

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    # Logo para la ventana (ver asset_path en gui_configurator.py). Se
    # regeneran con assets/make_icons.py a partir del logo del dashboard.
    datas=[('assets/dathua.ico', 'assets'), ('assets/dathua_mark.png', 'assets')],
    # pywin32 + servicemanager frecuentemente no se detectan solos con
    # PyInstaller — es un problema conocido, de ahí este hiddenimports.
    hiddenimports=[
        'win32timezone',
        'win32serviceutil',
        'win32service',
        'win32event',
        'servicemanager',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='DathuaAgent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='assets/dathua.ico',
)
