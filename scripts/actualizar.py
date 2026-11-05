"""Descarga la última Excel semanal de precios del gasóleo del Ministerio de
Transportes y actualiza data.json para la calculadora.

Se ejecuta desde GitHub Actions (.github/workflows/actualizar.yml).
Sale con código 0 si todo va bien, haya o no cambios.
"""
import datetime as dt
import io
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

import openpyxl

PAGINA = ("https://www.transportes.gob.es/transporte-terrestre/servicios-al-transportista/"
          "indice-de-variacion-semanal-de-los-precios-medios-del-gasoleo-en-espana")
BASE = "https://www.transportes.gob.es"
DESDE_SERIAL = 43101  # 01/01/2018
EPOCH = dt.datetime(1899, 12, 30)
DATA = Path(__file__).resolve().parent.parent / "data.json"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (calculadora-revision-gasoleo; +https://github.com)",
    "Accept-Language": "es-ES,es;q=0.9",
}


def descargar(url, intentos=3):
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if i == intentos - 1:
                raise
            print(f"Reintento {i + 1} tras error: {e}")
            time.sleep(10 * (i + 1))


def a_serial(v):
    """Fecha de Excel (número o datetime) a serial entero."""
    if v is None:
        return None
    if isinstance(v, dt.datetime):
        return (v - EPOCH).days
    if isinstance(v, dt.date):
        return (dt.datetime(v.year, v.month, v.day) - EPOCH).days
    if isinstance(v, (int, float)):
        return int(v)
    if isinstance(v, str) and v.strip().isdigit():
        return int(v.strip())
    return None


def num(v):
    if v is None or v == "":
        return None
    try:
        return round(float(str(v).replace(",", ".")), 5)
    except ValueError:
        return None


def leer_excel(contenido):
    wb = openpyxl.load_workbook(io.BytesIO(contenido), data_only=True, read_only=True)
    if "PRECIOS_DEL_GASOLEO" not in wb.sheetnames:
        raise RuntimeError(f"No está la hoja PRECIOS_DEL_GASOLEO. Hojas: {wb.sheetnames}")

    pmed = {}
    if "PRECIOS DE REFERENCIA" in wb.sheetnames:
        # Columnas B (fecha), C (Pmed MMA >= 7,5 t), D (Pmed MMA < 7,5 t)
        for fila in wb["PRECIOS DE REFERENCIA"].iter_rows(min_col=2, max_col=4, values_only=True):
            s = a_serial(fila[0])
            if s and s > 40000 and num(fila[1]) is not None:
                pmed[s] = [num(fila[1]), num(fila[2])]

    filas = []
    # Columnas D (fecha), E (PVP), F, G, H (PVP sin IVA), I (IEH), J (PAI), K (devolución GP)
    for fila in wb["PRECIOS_DEL_GASOLEO"].iter_rows(min_col=4, max_col=11, values_only=True):
        s = a_serial(fila[0])
        if not s or s < DESDE_SERIAL or num(fila[1]) is None:
            continue
        p = pmed.get(s, [0, 0])
        filas.append([s, num(fila[1]), num(fila[4]), num(fila[5]), num(fila[6]), num(fila[7]), p[0], p[1]])

    filas.sort(key=lambda r: r[0])
    if len(filas) < 50:
        raise RuntimeError(f"Formato no reconocido: solo {len(filas)} semanas")
    return filas


def main():
    html = descargar(PAGINA).decode("utf-8", "replace")
    m = re.search(r'href="([^"]*preciogasoleosemanalweb-(\d{2})(\d{2})(\d{4})\.xlsx)"', html, re.I)
    if not m:
        print("No encuentro el enlace a la Excel en la página del Ministerio", file=sys.stderr)
        sys.exit(1)
    enlace = m.group(1)
    url = enlace if enlace.startswith("http") else BASE + enlace
    fecha_fichero = f"{m.group(4)}-{m.group(3)}-{m.group(2)}"
    print("Excel publicada:", url)

    filas = leer_excel(descargar(url))
    ultima = (EPOCH + dt.timedelta(days=filas[-1][0])).strftime("%d/%m/%Y")
    print(f"Leídas {len(filas)} semanas; última del {ultima}")

    anterior = json.loads(DATA.read_text(encoding="utf-8")) if DATA.exists() else {}
    cambio = anterior.get("rows") != filas or anterior.get("fileDate") != fecha_fichero

    nuevo = {
        "fileDate": fecha_fichero,
        "source": url,
        "checkedAt": int(time.time() * 1000) if cambio else anterior.get("checkedAt"),
        "rows": filas,
    }
    if cambio:
        DATA.write_text(json.dumps(nuevo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print("data.json actualizado")
    else:
        print("Sin cambios: los datos ya estaban al día")


if __name__ == "__main__":
    main()
