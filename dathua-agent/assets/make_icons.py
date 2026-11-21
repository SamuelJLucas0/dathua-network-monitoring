"""
Genera los íconos del agente a partir del logo oficial de DatHua
(dathua-front/public/logo.png, 2048x2048 con fondo transparente).

    python assets/make_icons.py        (requiere Pillow, solo para esto)

Salida (versionada, el .exe no necesita Pillow en tiempo de ejecución):
- assets/dathua.ico       ícono del .exe, del acceso directo y de la ventana
- assets/dathua_mark.png  símbolo para la cabecera de la ventana (Tk lee PNG)

A tamaño de ícono el texto "DATHUA" no se lee, así que se usa solo el
símbolo (zorro + nube). La nube y "HUA" son gris oscuro y se pierden sobre
fondos oscuros (barra de tareas, la propia ventana), por eso el símbolo va
sobre una placa redondeada clara.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
LOGO = ROOT.parent.parent / "dathua-front" / "public" / "logo.png"

TILE_COLOR = (255, 255, 255, 255)
ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]


def symbol(logo: Image.Image) -> Image.Image:
    """Recorta el zorro + nube (todo lo que está arriba del texto)."""
    alpha = logo.split()[3].point(lambda a: 255 if a > 40 else 0)
    upper = alpha.crop((0, 0, logo.width, int(logo.height * 0.66)))
    return logo.crop(upper.getbbox())


def tile(mark: Image.Image, size: int, padding: float = 0.14, radius: float = 0.22) -> Image.Image:
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(out).rounded_rectangle(
        (0, 0, size - 1, size - 1), radius=int(size * radius), fill=TILE_COLOR
    )
    inner = int(size * (1 - 2 * padding))
    scale = inner / max(mark.size)
    resized = mark.resize((max(1, int(mark.width * scale)), max(1, int(mark.height * scale))),
                          Image.LANCZOS)
    out.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    return out


def main():
    logo = Image.open(LOGO).convert("RGBA")
    mark = symbol(logo)

    big = tile(mark, 256)
    big.save(ROOT / "dathua.ico", sizes=[(s, s) for s in ICO_SIZES])
    tile(mark, 96).save(ROOT / "dathua_mark.png")
    print("ok:", ROOT / "dathua.ico", ROOT / "dathua_mark.png", "símbolo", mark.size)


if __name__ == "__main__":
    main()
